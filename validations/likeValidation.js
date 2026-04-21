import { z } from 'zod';
import { createBodyValidationMiddleware } from '../middlewares/validation.js';

/**
 * MongoDB ObjectId validator
 */
const objectIdValidator = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

/**
 * Create Like Schema
 * Validates user_id and post_id from request body
 */
export const createLikeSchema = z.object({
  user_id: objectIdValidator.refine((val) => val, {
    message: 'User ID is required',
  }),
  post_id: objectIdValidator.refine((val) => val, {
    message: 'Post ID is required',
  }),
});

/**
 * Middleware to validate like creation
 */
export const validateCreateLike = createBodyValidationMiddleware(createLikeSchema);
