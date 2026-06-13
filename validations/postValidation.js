import { z } from 'zod';
import {
  createBodyValidationMiddleware,
  createParamsValidationMiddleware,
  createQueryValidationMiddleware,
} from '../middlewares/validation.js';

// Title validator
const titleValidator = z
  .string()
  .trim()
  .max(200, 'Title must not exceed 200 characters')
  .optional();

// Description validator
const descriptionValidator = z
  .string()
  .trim()
  .max(1000, 'Description must not exceed 1000 characters')
  .optional();

// Create Post Schema
export const createPostSchema = z.object({
  title: titleValidator,
  description: descriptionValidator,
  category: z.string().trim().optional(),
  user_id: z.string().optional(), // Temporary until auth is implemented
});

/**
 * Post ID Parameter Schema
 * Validates post id from URL parameters
 */
export const postIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid post ID format'),
});

/**
 * Search Query Schema
 * Validates search parameters for getAllPosts
 */
export const searchQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .min(1, 'Search term must be at least 1 character')
    .max(100, 'Search term must not exceed 100 characters')
    .optional(),
  page: z.string().regex(/^\d+$/, 'Page must be a positive number').optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a positive number').optional(),
});

/**
 * Middleware to validate file upload
 * Checks if file exists in request // Todo Needs to be shifted.
 */
export const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Media file is required',
        code: 'MISSING_MEDIA',
        statusCode: 400,
      },
    });
  }
  next();
};

export const validateCreatePost = createBodyValidationMiddleware(createPostSchema);
export const validatePostId = createParamsValidationMiddleware(postIdParamSchema);
export const validateSearchQuery = createQueryValidationMiddleware(searchQuerySchema);
