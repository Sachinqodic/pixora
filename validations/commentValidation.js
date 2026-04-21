import { z } from 'zod';
import { createBodyValidationMiddleware } from '../middlewares/validation.js';

/**
 * MongoDB ObjectId validator
 */
const objectIdValidator = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

/**
 * Create Comment Schema
 * Validates user_id, post_id, and comment_text from request body
 */
export const createCommentSchema = z.object({
    user_id: objectIdValidator.refine((val) => val, {
        message: 'User ID is required',
    }),
    post_id: objectIdValidator.refine((val) => val, {
        message: 'Post ID is required',
    }),
    comment_text: z
        .string()
        .min(1, 'Comment text is required')
        .max(1000, 'Comment text must not exceed 1000 characters')
        .trim(),
});

/**
 * Middleware to validate comment creation
 */
export const validateCreateComment = createBodyValidationMiddleware(createCommentSchema);


/**
 * Update Comment Schema
 * Validates comment_text and optional user_id for updating
 */
export const updateCommentSchema = z.object({
    comment_text: z
        .string()
        .min(1, 'Comment text is required')
        .max(1000, 'Comment text must not exceed 1000 characters')
        .trim(),
    user_id: objectIdValidator.optional(), // Optional for testing without auth
});

/**
 * Middleware to validate comment update
 */
export const validateUpdateComment = createBodyValidationMiddleware(updateCommentSchema);
