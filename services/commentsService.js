import Post from '../models/Post.js';
import User from '../models/User.js';
import Comments from '../models/Comments.js';
import { ERROR_MESSAGES, NUMERIC_CONSTANTS } from '../constants/index.js';
import { NotFoundError } from '../utils/errors.js';

export const createCommentsService = async (commentsData) => {
  const { user_id, post_id, comment_text } = commentsData;

  // Find user by ID
  const user = await User.findById(user_id);

  if (!user) {
    throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  }

  // Find post By Id
  const post = await Post.findById(post_id);

  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  // Create new comment
  const comment = await Comments.create({
    user_id,
    post_id,
    comments_text: comment_text,
  });

  return {
    success: true,
    comment,
  };
};

/**
 * Get comments for a post with pagination
 * @param {string} postId - The ID of the post
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Number of comments per page (default: 20)
 * @returns {Promise<Object>} - Comments with pagination info
 */
export const getCommentsByPostId = async (postId, page = 1, limit = 20) => {
  // Validate post exists
  const post = await Post.findById(postId);
  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  // Calculate skip value for pagination
  const skip = (page - NUMERIC_CONSTANTS.PAGINATION_DEFAULT_PAGE) * limit;

  // Get comments and total count in parallel
  const [comments, totalComments] = await Promise.all([
    Comments.find({ post_id: postId })
      .populate('user_id', 'name email _id')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comments.countDocuments({ post_id: postId }),
  ]);

  // Format comments response
  const formattedComments = comments.map((comment) => ({
    id: comment._id,
    comment_text: comment.comments_text,
    is_edited: comment.is_edited,
    user: {
      id: comment.user_id._id,
      name: comment.user_id.name,
      email: comment.user_id.email,
    },
  }));

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalComments / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > NUMERIC_CONSTANTS.PAGINATION_DEFAULT_PAGE;

  return {
    comments: formattedComments,
    pagination: {
      currentPage: page,
      totalPages,
      totalComments,
      limit,
      hasNextPage,
      hasPrevPage,
    },
  };
};

/**
 * Update a comment
 * @param {string} commentId - The ID of the comment to update
 * @param {string} userId - The ID of the user making the request
 * @param {string} commentText - The new comment text
 * @returns {Promise<Object>} - Updated comment
 */
export const updateCommentService = async (commentId, userId, commentText) => {
  // Find the comment
  const comment = await Comments.findById(commentId);

  if (!comment) {
    throw new NotFoundError(ERROR_MESSAGES.COMMENT_NOT_FOUND);
  }
  console.log('The comments ', comment);
  // Check if the user is the owner of the comment
  if (comment.user_id.toString() !== userId.toString()) {
    throw new NotFoundError(ERROR_MESSAGES.UNAUTHORIZED_COMMENT_EDIT);
  }

  // Update the comment
  comment.comments_text = commentText;
  comment.is_edited = true;
  await comment.save();

  return {
    success: true,
    comment: {
      id: comment._id,
      comment_text: comment.comments_text,
      is_edited: comment.is_edited,
      updated_at: comment.updated_at,
    },
  };
};

/**
 * Delete a comment
 * @param {string} commentId - The ID of the comment to delete
 * @param {string} userId - The ID of the user making the request
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteCommentService = async (commentId, userId) => {
  // Find the comment
  const comment = await Comments.findById(commentId);

  if (!comment) {
    throw new NotFoundError(ERROR_MESSAGES.COMMENT_NOT_FOUND);
  }

  // Verify the post still exists
  const post = await Post.findById(comment.post_id);
  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  // Check if the user is the owner of the comment
  if (comment.user_id.toString() !== userId.toString()) {
    throw new NotFoundError(ERROR_MESSAGES.UNAUTHORIZED_COMMENT_DELETE);
  }

  // Hard delete the comment
  await Comments.findByIdAndDelete(commentId);

  return {
    success: true,
    message: 'Comment deleted successfully',
  };
};
