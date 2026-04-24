import { createLikeService } from '../services/likeService.js';
import { HTTP_STATUS, MESSAGES, ERROR_CODES, ERROR_MESSAGES } from '../constants/index.js';
import { baseController } from './baseController.js';

/**
 * Create a new like (or unlike if already liked)
 * @route POST /api/likes/create
 */
export const createLike = async (req, res, next) => {
  try {
    // Extract like data from request
    const { user_id, post_id } = req.body;

    // Get user_id from authenticated user (req.user.id)
    // For now, using a placeholder
    const authenticatedUserId = req.user?.id || req.body.user_id;

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

    // Toggle like/unlike
    const result = await createLikeService({
      user_id: authenticatedUserId,
      post_id,
    });

    // Determine message and status code based on action
    const message = result.action === 'liked' ? MESSAGES.LIKE_CREATED : MESSAGES.LIKE_REMOVED;

    const statusCode = result.action === 'liked' ? HTTP_STATUS.CREATED : HTTP_STATUS.OK;

    // Return success response
    return baseController.sendSuccess(res, result, message, statusCode);
  } catch (error) {
    next(error);
  }
};
