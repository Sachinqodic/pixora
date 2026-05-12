import {
  createCommentsService,
  getCommentsByPostId,
  updateCommentService,
  deleteCommentService,
} from '../services/commentsService.js';
import { HTTP_STATUS, MESSAGES, ERROR_CODES, ERROR_MESSAGES } from '../constants/index.js';
import { baseController } from './baseController.js';

/**
 * Add a new comment
 * @route POST /api/comments/create
 */
export const createComments = async (req, res, next) => {
  try {
    // Extract comment data from request
    const { post_id, comment_text } = req.body;

    // Get user_id from authenticated user (req.user.id)
    // For now, using a placeholder
    const authenticatedUserId = req.user?.id; 

    if (!authenticatedUserId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        },
      });
    }

    // Create comment
    const result = await createCommentsService({
      user_id: authenticatedUserId,
      post_id,
      comment_text,
    });

    // Return success response
    return baseController.sendSuccess(res, result, MESSAGES.COMMENT_CREATED, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

/**
 * Get comments for a post with pagination
 * @route GET /api/comments/post/:postId
 */
export const getCommentsByPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { page, limit } = req.query;

    const result = await getCommentsByPostId(postId, page, limit);

    return baseController.sendSuccess(res, result, MESSAGES.COMMENTS_FETCHED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a comment
 * @route PUT /api/comments/:commentId
 */
export const updateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { comment_text } = req.body;

    // Get user_id from authenticated user
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        },
      });
    }

    const result = await updateCommentService(commentId, authenticatedUserId, comment_text);

    return baseController.sendSuccess(res, result, MESSAGES.COMMENT_UPDATED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a comment
 * @route DELETE /api/comments/:commentId
 */
export const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;

    // Get user_id from authenticated user
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        },
      });
    }

    const result = await deleteCommentService(commentId, authenticatedUserId);

    return baseController.sendSuccess(res, result, MESSAGES.COMMENT_DELETED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};
