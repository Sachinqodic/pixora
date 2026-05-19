import Board from '../models/Board.js';
import { NotFoundError } from '../utils/errors.js';
import { ERROR_MESSAGES, NUMERIC_CONSTANTS } from '../constants/index.js';
import { uploadBoardCoverImage, generatePresignedUrl, deleteFromS3 } from './s3Service.js';

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

  // Delete cover image from S3 if exists
  if (board.cover_image_url) {
    await deleteFromS3(board.cover_image_url);
  }

  // Delete board from database
  await Board.findByIdAndDelete(boardId);
};

/**
 * Get all boards for a user with pagination
 * @param {string} userId - User ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} - Boards with pagination metadata
 */
export const getBoardsService = async (
  userId,
  page = NUMERIC_CONSTANTS.PAGINATION_DEFAULT_PAGE,
  limit = NUMERIC_CONSTANTS.PAGINATION_DEFAULT_LIMIT
) => {
  const skip = (page - NUMERIC_CONSTANTS.PAGINATION_DEFAULT_PAGE) * limit;

  const [boards, total] = await Promise.all([
    Board.find({ user_id: userId })
      .select('-created_at -updated_at -__v')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit),
    Board.countDocuments({ user_id: userId }),
  ]);

  // Generate presigned URLs for cover images
  const boardsWithUrls = await Promise.all(
    boards.map(async (board) => {
      const boardObj = board.toObject();

      if (board.cover_image_url) {
        try {
          boardObj.cover_image_url = await generatePresignedUrl(
            board.cover_image_url,
            NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
          );
        } catch (err) {
          console.error(`Failed to generate URL for board ${board._id}:`, err.message);
        }
      }

      return boardObj;
    })
  );

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
    // Delete old cover image from S3 if exists
    if (board.cover_image_url) {
      await deleteFromS3(board.cover_image_url);
    }

    // Upload new cover image
    const newCoverImageUrl = await uploadBoardCoverImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      board.user_id
    );

    board.cover_image_url = newCoverImageUrl;
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
export const savePinToBoardService = async (boardId, postId) => {
  const BoardPost = (await import('../models/BoardPost.js')).default;
  const Post = (await import('../models/Post.js')).default;

  // Check if board exists
  const board = await Board.findById(boardId);
  if (!board) {
    throw new NotFoundError('Board not found');
  }

  // Check if post exists
  const post = await Post.findById(postId);
  if (!post) {
    throw new NotFoundError('Post not found');
  }

  // Check if pin is already saved to this board
  const existingEntry = await BoardPost.findOne({ board_id: boardId, post_id: postId });
  if (existingEntry) {
    throw new Error('Pin already saved to this board');
  }

  // Create board post entry
  const boardPost = await BoardPost.create({
    board_id: boardId,
    post_id: postId,
  });

  return boardPost;
};
