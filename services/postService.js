import Post from '../models/Post.js';
import Like from '../models/Likes.js';
import Comments from '../models/Comments.js';
import { uploadToS3, ORIGINAL_FOLDER, getOptimizedKey, deleteFromS3 } from './s3Service.js';
import { optimizeMedia } from '../utils/optimization.js';
import { NUMERIC_CONSTANTS, ERROR_MESSAGES } from '../constants/index.js';
import { NotFoundError } from '../utils/errors.js';

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
  const { title, description, user_id } = postData;

  // Determine resource type
  const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'video';

  // Create post in database immediately with processing status
  const post = await Post.create({
    user_id,
    title,
    description,
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
  const post = await Post.findById(postId);
  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  // Get likes count and comments count in parallel
  const [totalLikes, totalComments] = await Promise.all([
    Like.countDocuments({ post_id: postId }),
    Comments.countDocuments({ post_id: postId }),
  ]);

  const postObj = post.toObject();

  // Generate presigned URLs for original and optimized media
  const { generatePresignedUrl } = await import('./s3Service.js');
  const mediaUrl = await generatePresignedUrl(
    postObj.media_url,
    NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
  ); // 2 minutes

  postObj.media_url = mediaUrl;
  postObj.totalLikes = totalLikes;
  postObj.totalComments = totalComments;

  return postObj;
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
