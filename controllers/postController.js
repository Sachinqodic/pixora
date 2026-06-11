import {
  getPostById,
  deletePostById,
  initiateAiSuggestionService,
  getAllPostsService,
  createPostService,
  getFollowingPostsService,
  getUserPostsService,
} from '../services/postService.js';
import AiSuggestion from '../models/AiSuggestion.js';
import { HTTP_STATUS, MESSAGES, ERROR_CODES, ERROR_MESSAGES } from '../constants/index.js';
import { baseController } from './baseController.js';

/**
 * Get all posts with smart personalized feed
 * @route GET /api/posts
 */
export const getAllPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Pass userId for personalized feed (if authenticated)
    const userId = req.user?._id || null;

    const posts = await getAllPostsService(page, limit, userId);

    return baseController.sendSuccess(res, { posts }, MESSAGES.POST_FETCHED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new post
 * @route POST /api/posts/create
 */
export const createPost = async (req, res, next) => {
  try {
    // Extract post data and file from request
    const { title, description, category } = req.body;
    const file = req.file;

    // Get user_id from authenticated user (req.user.id)
    // For now, using a placeholder
    const user_id = req.user?.id;

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
    const post = await createPostService({ title, description, category, user_id }, file);

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

    // Get current user ID for liked flag (optional)
    const currentUserId = req.user?._id || null;

    // Get post with presigned URLs
    const post = await getPostById(id, currentUserId);

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

/**
 * Suggest metadata using AI (Async Background Version)
 * @route POST /api/posts/suggest-metadata
 */

export const suggestPostMetadata = async (req, res, next) => {
  try {
    // Extract file and user ID from request
    const file = req.file;
    const user_id = req.user?.id;

    // Check if file is present
    if (!file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.FILE_REQUIRED,
          code: ERROR_CODES.VALIDATION_ERROR,
          statusCode: HTTP_STATUS.BAD_REQUEST,
        },
      });
    }

    // Call service to initiate AI suggestion
    const suggestionId = await initiateAiSuggestionService(file, user_id);

    // Return the suggestion ID immediately
    return baseController.sendSuccess(
      res,
      { suggestionId },
      'AI processing started in the background',
      HTTP_STATUS.ACCEPTED
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get the status of an AI suggestion
 * @route GET /api/posts/suggestions/:id
 */
export const getAiSuggestionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const suggestion = await AiSuggestion.findById(id);

    if (!suggestion) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          message: 'Suggestion not found',
          code: ERROR_CODES.NOT_FOUND,
          statusCode: HTTP_STATUS.NOT_FOUND,
        },
      });
    }

    return baseController.sendSuccess(
      res,
      { suggestion },
      'Suggestion status fetched',
      HTTP_STATUS.OK
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get posts from followed users
 * @route GET /api/posts/following
 */
export const getFollowingPosts = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const posts = await getFollowingPostsService(userId, page, limit);

    return baseController.sendSuccess(res, { posts }, MESSAGES.POST_FETCHED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Get posts created by a specific user
 * @route GET /api/posts/user/:id
 */
export const getUserPosts = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Get current user ID for liked flag (optional)
    const currentUserId = req.user?._id || null;

    const posts = await getUserPostsService(userId, page, limit, currentUserId);

    return baseController.sendSuccess(res, { posts }, MESSAGES.POST_FETCHED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};
