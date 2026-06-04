import Post from '../models/Post.js';
import Follower from '../models/Follower.js';
import Like from '../models/Likes.js';
import Comments from '../models/Comments.js';
import AiSuggestion from '../models/AiSuggestion.js';
import mongoose from 'mongoose';
import {
  uploadToS3,
  ORIGINAL_FOLDER,
  getOptimizedKey,
  deleteFromS3,
  uploadToS3AndGetPresignedUrl,
} from './s3Service.js';
import { processAiSuggestionInBackground } from './aiService.js';
import { optimizeMedia } from '../utils/optimization.js';
import { NUMERIC_CONSTANTS, ERROR_MESSAGES } from '../constants/index.js';
import { NotFoundError } from '../utils/errors.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build aggregation stages for counting likes, comments, and author followers
 * This replaces 3 separate queries per post with a single aggregation pipeline
 */
const buildCountStages = () => [
  {
    $lookup: {
      from: 'likes',
      let: { postId: '$_id' },
      pipeline: [{ $match: { $expr: { $eq: ['$post_id', '$$postId'] } } }, { $count: 'count' }],
      as: 'likesCount',
    },
  },
  {
    $lookup: {
      from: 'comments',
      let: { postId: '$_id' },
      pipeline: [{ $match: { $expr: { $eq: ['$post_id', '$$postId'] } } }, { $count: 'count' }],
      as: 'commentsCount',
    },
  },
  {
    $lookup: {
      from: 'followers',
      let: { authorId: '$user_id._id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$following_id', '$$authorId'] } } },
        { $count: 'count' },
      ],
      as: 'authorFollowersCount',
    },
  },
  {
    $addFields: {
      totalLikes: { $ifNull: [{ $arrayElemAt: ['$likesCount.count', 0] }, 0] },
      totalComments: { $ifNull: [{ $arrayElemAt: ['$commentsCount.count', 0] }, 0] },
      authorFollowers: { $ifNull: [{ $arrayElemAt: ['$authorFollowersCount.count', 0] }, 0] },
    },
  },
  { $project: { likesCount: 0, commentsCount: 0, authorFollowersCount: 0 } },
];

/**
 * Attach presigned URLs to posts
 * Centralizes URL generation logic in one place
 */
const attachPresignedUrls = async (posts) => {
  if (posts.length === 0) return posts;
  const { generatePresignedUrl } = await import('./s3Service.js');

  return Promise.all(
    posts.map(async (post) => {
      try {
        let keyToUse = post.media_url;
        if (post.status === 'uploaded' || !post.media_url || post.media_url === 'processing') {
          keyToUse = post.original_media_url;
        }
        if (keyToUse && keyToUse !== 'uploading' && keyToUse !== 'processing') {
          post.media_url = await generatePresignedUrl(
            keyToUse,
            NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
          );
        }
      } catch (err) {
        console.error(`Failed to generate URL for post ${post._id}:`, err.message);
      }
      return post;
    })
  );
};

/**
 * Build aggregation pipeline for following posts
 */
const buildFollowingPostsPipeline = (userId, skip, limit) => [
  {
    $lookup: {
      from: 'followers',
      let: { postAuthor: '$user_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$follower_id', new mongoose.Types.ObjectId(userId)] },
                { $eq: ['$following_id', '$$postAuthor'] },
              ],
            },
          },
        },
      ],
      as: 'followCheck',
    },
  },
  { $match: { followCheck: { $ne: [] }, status: { $ne: 'failed' } } },
  { $sort: { created_at: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $lookup: {
      from: 'users',
      localField: 'user_id',
      foreignField: '_id',
      as: 'user_id',
      pipeline: [{ $project: { name: 1, profile_url: 1 } }],
    },
  },
  { $unwind: { path: '$user_id', preserveNullAndEmpty: true } },
  ...buildCountStages(),
  { $project: { followCheck: 0 } },
];

/**
 * Build aggregation pipeline for user posts
 */
const buildUserPostsPipeline = (userId, skip, limit) => [
  { $match: { user_id: new mongoose.Types.ObjectId(userId), status: { $ne: 'failed' } } },
  { $sort: { created_at: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $lookup: {
      from: 'users',
      localField: 'user_id',
      foreignField: '_id',
      as: 'user_id',
      pipeline: [{ $project: { name: 1, profile_url: 1 } }],
    },
  },
  { $unwind: { path: '$user_id', preserveNullAndEmpty: true } },
  ...buildCountStages(),
];

/**
 * Background upload and processing
 * This function runs asynchronously without blocking the API response
 */
const uploadAndProcess = async (file, postId, userId) => {
  try {
    console.log(`[${postId}] Starting background upload`);

    // Upload original file to S3
    const originalKey = await uploadToS3(
      file.buffer,
      file.originalname,
      file.mimetype,
      ORIGINAL_FOLDER,
      userId
    );

    // Determine resource type
    const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'video';

    // Generate optimized key
    const optimizedKey = getOptimizedKey(originalKey);

    // Update post with S3 keys
    await Post.findByIdAndUpdate(postId, {
      original_media_url: originalKey,
      media_url: optimizedKey,
      status: 'uploaded',
    });

    console.log(`[${postId}] Upload completed, starting optimization`);

    // ========================================================================
    // UPDATE STORAGE QUOTA: Increment storage_used by original file size
    // ========================================================================
    try {
      const { default: User } = await import('../models/User.js');
      const fileSize = file.buffer.length; // Original file size in bytes (actual bytes uploaded to S3)

      // Increment storage_used in database
      await User.findByIdAndUpdate(userId, { $inc: { storage_used: fileSize } }, { new: true });

      // Invalidate Redis cache so next request fetches fresh data
      const { invalidateQuotaCache } = await import('../middlewares/quotaGuard.js');
      await invalidateQuotaCache(userId.toString());
    } catch (quotaError) {
      console.error(`[${postId}] Failed to update storage quota:`, quotaError.message);
      // Don't fail the upload if quota update fails - just log it
    }
    // ========================================================================

    // Queue optimization (non-blocking)
    optimizeMedia({
      postId: postId.toString(),
      originalKey,
      fileName: file.originalname,
      resourceType,
    });
  } catch (error) {
    console.error(`[${postId}] Background upload failed:`, error);
    // Update post status to failed
    await Post.findByIdAndUpdate(postId, {
      status: 'failed',
      error_message: error.message,
    });
  }
};

/**
 * Create a new post with media upload
 * @param {Object} postData - Post data (title, description, user_id)
 * @param {Object} file - Uploaded file from multer
 * @returns {Promise<Object>} - Created post
 *
 */
export const createPostService = async (postData, file) => {
  const { title, description, category, user_id } = postData;

  // Determine resource type
  const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'video';

  // Create post in database immediately with processing status
  const post = await Post.create({
    user_id,
    title,
    description,
    category,
    original_media_url: 'uploading', // Placeholder
    media_url: 'processing', // Placeholder
    resource_type: resourceType,
    status: 'processing', // New field to track upload status
  });

  // Upload and process in background (don't await - fire and forget)
  uploadAndProcess(file, post._id, user_id).catch((err) => {
    console.error('Background upload error:', err);
  });

  // Return post immediately (API responds in < 1 second)
  return {
    ...post.toObject(),
    message: 'Post is being processed. Media will be available shortly.',
  };
};

/**
 * Get a post by ID
 * @param {string} postId - The ID of the post to fetch
 * @returns {Promise<Object>} - The fetched post
 * TODO:Need to include the likes,and comments, and views count in the response.
 */
export const getPostById = async (postId) => {
  const post = await Post.findById(postId).populate('user_id', 'name avatar');
  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  // Get likes count and comments count in parallel
  const [totalLikes, totalComments] = await Promise.all([
    Like.countDocuments({ post_id: postId }),
    Comments.countDocuments({ post_id: postId }),
  ]);

  const postObj = post.toObject();

  // FALLBACK: If optimized media isn't ready yet, use the original high-quality one
  let keyToUse = postObj.media_url;
  if (post.status === 'uploaded' || !post.media_url || post.media_url === 'processing') {
    keyToUse = postObj.original_media_url;
  }

  // Generate presigned URL
  const { generatePresignedUrl } = await import('./s3Service.js');
  try {
    if (keyToUse && keyToUse !== 'uploading' && keyToUse !== 'processing') {
      postObj.media_url = await generatePresignedUrl(
        keyToUse,
        NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
      );
    }
  } catch (err) {
    console.error(`Failed to generate URL for post ${post._id}:`, err.message);
  }

  postObj.totalLikes = totalLikes;
  postObj.totalComments = totalComments;

  return postObj;
};

/**
 * Get all posts with presigned URLs
 * @param {Object} query - Query parameters (page, limit)
 * @returns {Promise<Array>} - List of posts
 */
export const getAllPostsService = async (page = 1, limit = 20, excludeUserId = null) => {
  const skip = (page - 1) * limit;

  const query = { status: { $ne: 'failed' } };
  if (excludeUserId) {
    query.user_id = { $ne: excludeUserId };
  }

  // Fetch posts from database, sorted by latest
  const posts = await Post.find(query)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user_id', 'name avatar');

  const { generatePresignedUrl } = await import('./s3Service.js');

  // Generate presigned URLs for each post
  const postsWithUrls = await Promise.all(
    posts.map(async (post) => {
      const postObj = post.toObject();

      try {
        // Determine which URL to generate (fallback to original if optimized is not ready)
        let keyToUse = post.media_url;
        if (post.status === 'uploaded' || !post.media_url || post.media_url === 'processing') {
          keyToUse = post.original_media_url;
        }

        if (keyToUse && keyToUse !== 'uploading' && keyToUse !== 'processing') {
          postObj.media_url = await generatePresignedUrl(
            keyToUse,
            NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
          );
        }

        // Get counts (in a real app, you might want to cache these or include in schema)
        const [likes, comments, authorFollowers] = await Promise.all([
          Like.countDocuments({ post_id: post._id }),
          Comments.countDocuments({ post_id: post._id }),
          Follower.countDocuments({ following_id: post.user_id?._id }),
        ]);

        postObj.totalLikes = likes;
        postObj.totalComments = comments;
        postObj.authorFollowers = authorFollowers;

        return postObj;
      } catch (err) {
        console.error(`Failed to generate URL for post ${post._id}:`, err.message);
        return postObj;
      }
    })
  );

  return postsWithUrls;
};

/**
 * Delete a post by ID
 * @param {string} postId - The ID of the post to delete
 *
 * TODO: Need to delete the associated likes, comments, and views from the database, and also from the boards if the post is added to any board.
 */
export const deletePostById = async (postId) => {
  const post = await Post.findById(postId);
  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  // Delete media from S3 and post from database in parallel
  await Promise.all([
    deleteFromS3(post.original_media_url),
    deleteFromS3(post.media_url),
    Post.findByIdAndDelete(postId),
  ]);
};

/**
 * Initiate AI suggestion process
 * @param {Object} file - Media file
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Suggestion ID
 */
export const initiateAiSuggestionService = async (file, userId) => {
  let bufferToAnalyze = file.buffer;
  let mimeTypeToAnalyze = file.mimetype;

  // 1. If it's a video, extract a frame
  if (file.mimetype.startsWith('video/')) {
    const TEMP_DIR = path.join(__dirname, '../temp');
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    const tempVideoPath = path.join(TEMP_DIR, `temp-${Date.now()}.mp4`);
    const tempFramePath = path.join(TEMP_DIR, `frame-${Date.now()}.jpg`);

    await fs.promises.writeFile(tempVideoPath, file.buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .screenshots({
          timestamps: [1],
          filename: path.basename(tempFramePath),
          folder: path.dirname(tempFramePath),
          size: '640x?',
        })
        .on('end', resolve)
        .on('error', reject);
    });

    bufferToAnalyze = await fs.promises.readFile(tempFramePath);
    mimeTypeToAnalyze = 'image/jpeg';

    // Cleanup
    if (fs.existsSync(tempVideoPath)) fs.promises.unlink(tempVideoPath).catch(console.error);
    if (fs.existsSync(tempFramePath)) fs.promises.unlink(tempFramePath).catch(console.error);
  }

  // 2. Upload to S3 (temp-ai folder) and get Presigned URL
  const mediaUrl = await uploadToS3AndGetPresignedUrl(bufferToAnalyze, mimeTypeToAnalyze, userId);

  // 3. Create a placeholder record in the database
  const suggestion = await AiSuggestion.create({
    user_id: userId,
    status: 'processing',
  });

  // 4. Trigger the background worker (Fire-and-Forget)
  processAiSuggestionInBackground(suggestion._id, mediaUrl).catch((err) => {
    console.error(`Background worker crash for ${suggestion._id}:`, err);
  });

  return suggestion._id;
};

/**
 * Get posts from users followed by the current user
 * Uses MongoDB aggregation pipeline for efficient querying
 * @param {string} userId - Current user ID
 * @param {number} [page=1] - Page number
 * @param {number} [limit=20] - Items per page
 * @returns {Promise<Array>} - List of posts
 */
export const getFollowingPostsService = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const posts = await Post.aggregate(buildFollowingPostsPipeline(userId, skip, limit));

  return attachPresignedUrls(posts);
};

/**
 * Get posts created by a specific user
 * Uses MongoDB aggregation pipeline for efficient querying
 * @param {string} userId - The ID of the user whose posts to fetch
 * @param {number} [page=1] - Page number
 * @param {number} [limit=20] - Items per page
 * @returns {Promise<Array>} - List of posts
 */
export const getUserPostsService = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const posts = await Post.aggregate(buildUserPostsPipeline(userId, skip, limit));

  return attachPresignedUrls(posts);
};
