import { createPostService, getPostById, deletePostById } from '../services/postService.js';
import { HTTP_STATUS, MESSAGES, ERROR_CODES, ERROR_MESSAGES } from '../constants/index.js';
import { baseController } from './baseController.js';

/**
 * Create a new post
 * @route POST /api/posts/create
 */
export const createPost = async (req, res, next) => {
  try {
    // Extract post data and file from request
    const { title, description } = req.body;
    const file = req.file;

    // Get user_id from authenticated user (req.user.id)
    // For now, using a placeholder
    const user_id = req.user?.id || req.body.user_id;

    if (!user_id) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        },
      });
    }

    // Create post with S3 upload
    const post = await createPostService({ title, description, user_id }, file);

    // Return success response
    return baseController.sendSuccess(res, { post }, MESSAGES.POST_CREATED, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a post by ID
 * @route GET /api/posts/:id
 * TODO Required
 */
export const getPost = async (req, res, next) => {
  try {
    // Get post ID from URL params
    const { id } = req.params;

    // Get post with presigned URLs
    const post = await getPostById(id);

    // Return success response
    return baseController.sendSuccess(res, { post }, MESSAGES.POST_FETCHED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/*
 * Delete a post by ID
 * @route DELETE /api/posts/:id
 * TODO Required
 */

export const deletePost = async (req, res, next) => {
  try {
    // Get post ID from URL params
    const { id } = req.params;

    // Delete post
    await deletePostById(id);

    // Return success response
    return baseController.sendSuccess(res, null, MESSAGES.POST_DELETED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};
