import Board from '../models/Board.js';
import BoardPost from '../models/BoardPost.js';
import Post from '../models/Post.js';
import mongoose from 'mongoose';
import { uploadBoardCoverImage, generatePresignedUrl, deleteFromS3 } from './s3Service.js';
import { NotFoundError } from '../utils/errors.js';
import { ERROR_MESSAGES, NUMERIC_CONSTANTS } from '../constants/index.js';
import { addLikedByUserFlag } from '../helpers/likeHelper.js';
import { addSavedToBoardFlag } from '../helpers/boardHelper.js';

/**
 * Attach presigned URLs to boards
 * Centralizes URL generation logic
 */
const attachPresignedUrlsToBoards = async (boards) => {
  if (boards.length === NUMERIC_CONSTANTS.DEFAULT_VALUE) return boards;

  return Promise.all(
    boards.map(async (board) => {
      if (board.cover_image_url) {
        try {
          board.cover_image_url = await generatePresignedUrl(
            board.cover_image_url,
            NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
          );
        } catch (err) {
          console.error(`Failed to generate URL for board ${board._id}:`, err.message);
        }
      }
      return board;
    })
  );
};

/**
 * Attach presigned URLs to posts
 */
const attachPresignedUrlsToPosts = async (posts) => {
  if (posts.length === NUMERIC_CONSTANTS.DEFAULT_VALUE) return posts;

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
 * Build aggregation stages for counting likes and comments on posts
 */
const buildPostCountStages = () => [
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
    $addFields: {
      totalLikes: { $ifNull: [{ $arrayElemAt: ['$likesCount.count', 0] }, 0] },
      totalComments: { $ifNull: [{ $arrayElemAt: ['$commentsCount.count', 0] }, 0] },
    },
  },
  {
    $project: {
      likesCount: NUMERIC_CONSTANTS.DEFAULT_VALUE,
      commentsCount: NUMERIC_CONSTANTS.DEFAULT_VALUE,
    },
  },
];

/**
 * Build aggregation pipeline for board listing with pin counts
 */
const buildBoardsWithPinCountPipeline = (userId, skip, limit) => [
  { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
  { $sort: { created_at: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $lookup: {
      from: 'boardposts',
      localField: '_id',
      foreignField: 'board_id',
      as: 'pins',
    },
  },
  {
    $addFields: {
      totalPins: { $size: '$pins' },
    },
  },
  {
    $project: {
      pins: NUMERIC_CONSTANTS.DEFAULT_VALUE,
      created_at: NUMERIC_CONSTANTS.DEFAULT_VALUE,
      updated_at: NUMERIC_CONSTANTS.DEFAULT_VALUE,
      __v: NUMERIC_CONSTANTS.DEFAULT_VALUE,
    },
  },
];

/**
 * Build aggregation pipeline for board pins with post details
 */
const buildBoardPinsPipeline = (boardId, skip, limit) => [
  { $match: { board_id: new mongoose.Types.ObjectId(boardId) } },
  { $sort: { created_at: -1 } },
  { $skip: skip },
  { $limit: limit },
  {
    $lookup: {
      from: 'posts',
      localField: 'post_id',
      foreignField: '_id',
      as: 'post',
    },
  },
  { $unwind: { path: '$post', preserveNullAndEmptyArrays: false } },
  {
    $replaceRoot: { newRoot: '$post' },
  },
  {
    $lookup: {
      from: 'users',
      localField: 'user_id',
      foreignField: '_id',
      as: 'user_id',
      pipeline: [
        {
          $project: {
            name: NUMERIC_CONSTANTS.DEFAULT_ONE,
            profile_url: NUMERIC_CONSTANTS.DEFAULT_ONE,
          },
        },
      ],
    },
  },
  { $unwind: { path: '$user_id', preserveNullAndEmptyArrays: true } },
  ...buildPostCountStages(),
];

/**
 * Create a new board
 * @param {Object} boardData - Board data (name, description, user_id)
 * @param {Object} file - Optional cover image file from multer
 * @returns {Promise<Object>} - Created board with presigned URL
 */
export const createBoardService = async (boardData, file) => {
  const { name, description, user_id } = boardData;

  let coverImageUrl = null;

  // Upload cover image to S3 if provided
  if (file) {
    coverImageUrl = await uploadBoardCoverImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      user_id
    );
  }

  // Create board in database
  const board = await Board.create({
    user_id,
    name,
    description: description || null,
    cover_image_url: coverImageUrl,
  });

  const boardObj = board.toObject();

  // Generate presigned URL for cover image if exists
  if (coverImageUrl) {
    boardObj.cover_image_url = await generatePresignedUrl(
      coverImageUrl,
      NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
    );
  }

  return boardObj;
};

/**
 * Delete a board by ID
 * @param {string} boardId - The ID of the board to delete
 * @returns {Promise<void>}
 */
export const deleteBoardService = async (boardId) => {
  const board = await Board.findById(boardId);

  if (!board) {
    throw new NotFoundError(ERROR_MESSAGES.BOARD_NOT_FOUND);
  }

  // Delete cover image from S3, board, and all associated pins in parallel
  await Promise.all([
    board.cover_image_url ? deleteFromS3(board.cover_image_url) : Promise.resolve(),
    Board.findByIdAndDelete(boardId),
    BoardPost.deleteMany({ board_id: boardId }),
  ]);
};

/**
 * Get all boards for a user with pagination and pin counts
 * @param {string} userId - User ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} - Boards with pagination metadata
 */
export const getBoardsService = async (userId, page = 1, limit = 20) => {
  const skip = (page - NUMERIC_CONSTANTS.DEFAULT_ONE) * limit;

  const [boards, total] = await Promise.all([
    Board.aggregate(buildBoardsWithPinCountPipeline(userId, skip, limit)),
    Board.countDocuments({ user_id: userId }),
  ]);

  const boardsWithUrls = await attachPresignedUrlsToBoards(boards);

  return {
    boards: boardsWithUrls,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get board by ID with details
 * @param {string} boardId - Board ID
 * @returns {Promise<Object>} - Board details with presigned URL
 */
export const getBoardByIdService = async (boardId) => {
  const board = await Board.findById(boardId);

  if (!board) {
    throw new NotFoundError(ERROR_MESSAGES.BOARD_NOT_FOUND);
  }

  const boardObj = board.toObject();

  // Get total pins count
  boardObj.totalPins = await BoardPost.countDocuments({ board_id: boardId });

  // Generate presigned URL for cover image
  if (board.cover_image_url) {
    boardObj.cover_image_url = await generatePresignedUrl(
      board.cover_image_url,
      NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
    );
  }

  // Remove timestamps
  delete boardObj.created_at;
  delete boardObj.updated_at;
  delete boardObj.__v;

  return boardObj;
};

/**
 * Get pins in a board with pagination
 * @param {string} boardId - Board ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} - Pins with pagination metadata
 */
export const getBoardPinsService = async (boardId, page = 1, limit = 20, currentUserId = null) => {
  const skip = (page - NUMERIC_CONSTANTS.DEFAULT_ONE) * limit;

  // Check if board exists
  const board = await Board.findById(boardId);
  if (!board) {
    throw new NotFoundError(ERROR_MESSAGES.BOARD_NOT_FOUND);
  }

  const [pins, total] = await Promise.all([
    BoardPost.aggregate(buildBoardPinsPipeline(boardId, skip, limit)),
    BoardPost.countDocuments({ board_id: boardId }),
  ]);

  const pinsWithUrls = await attachPresignedUrlsToPosts(pins);
  const pinsWithLikedFlag = await addLikedByUserFlag(pinsWithUrls, currentUserId);
  const pinsWithBoardFlag = await addSavedToBoardFlag(pinsWithLikedFlag, currentUserId);

  return {
    pins: pinsWithBoardFlag,
    pagination: {
      total,
      page,
      limit,
      totalPages: Number(Math.ceil(total / limit)),
    },
  };
};

/**
 * Update a board by ID
 * @param {string} boardId - The ID of the board to update
 * @param {Object} updateData - Data to update (name, description)
 * @param {Object} file - Optional new cover image file from multer
 * @returns {Promise<Object>} - Updated board with presigned URL
 */
export const updateBoardService = async (boardId, updateData, file) => {
  const board = await Board.findById(boardId);

  if (!board) {
    throw new NotFoundError(ERROR_MESSAGES.BOARD_NOT_FOUND);
  }

  const { name, description } = updateData;

  // Update name if provided
  if (name) {
    board.name = name;
  }

  // Update description if provided
  if (description !== undefined) {
    board.description = description;
  }

  // Handle cover image update
  if (file) {
    const oldCoverUrl = board.cover_image_url;

    // Upload new cover image
    const newCoverImageUrl = await uploadBoardCoverImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      board.user_id
    );

    board.cover_image_url = newCoverImageUrl;

    // Delete old cover image from S3 if exists (after successful upload)
    if (oldCoverUrl) {
      deleteFromS3(oldCoverUrl).catch((err) =>
        console.error('Failed to delete old cover image:', err)
      );
    }
  }

  // Save updated board
  await board.save();

  const boardObj = board.toObject();

  // Generate presigned URL for cover image if exists
  if (board.cover_image_url) {
    boardObj.cover_image_url = await generatePresignedUrl(
      board.cover_image_url,
      NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
    );
  }

  // Remove timestamps and version
  delete boardObj.created_at;
  delete boardObj.updated_at;
  delete boardObj.__v;

  return boardObj;
};

/**
 * Save a pin to a board
 * @param {string} boardId - Board ID
 * @param {string} postId - Post ID
 * @returns {Promise<Object>} - Created board post entry
 */
export const savePinToBoardService = async (userId, boardId, postId) => {
  // Check board and post existence in parallel
  const [board, post, existingEntry] = await Promise.all([
    Board.findById(boardId),
    Post.findById(postId),
    BoardPost.findOne({ board_id: boardId, post_id: postId }),
  ]);

  if (!board) {
    throw new NotFoundError(ERROR_MESSAGES.BOARD_NOT_FOUND);
  }

  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  if (existingEntry) {
    throw new Error(ERROR_MESSAGES.PIN_ALREADY_SAVED);
  }

  // Create board post entry
  const boardPost = await BoardPost.create({
    user_id: userId,
    board_id: boardId,
    post_id: postId,
  });

  return boardPost;
};

/**
 * Remove a pin from a board
 * @param {string} boardId - Board ID
 * @param {string} postId - Post ID
 * @param {string} userId - User ID (board owner)
 * @returns {Promise<void>}
 */
export const removePinFromBoardService = async (boardId, postId, userId) => {
  // Check if board exists and user is the owner
  const board = await Board.findById(boardId);
  if (!board) {
    throw new NotFoundError(ERROR_MESSAGES.BOARD_NOT_FOUND);
  }

  if (board.user_id.toString() !== userId.toString()) {
    throw new Error(ERROR_MESSAGES.UNAUTHORIZED_TO_REMOVE_PIN);
  }

  // Find and delete in one operation
  const result = await BoardPost.findOneAndDelete({ board_id: boardId, post_id: postId });

  if (!result) {
    throw new NotFoundError(ERROR_MESSAGES.PIN_NOT_FOUND_IN_BOARD);
  }
};
