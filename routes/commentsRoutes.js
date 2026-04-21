import express from 'express';
import { createComments, getCommentsByPost, updateComment, deleteComment } from '../controllers/commentController.js';
import { validateCreateComment, validateUpdateComment } from '../validations/commentValidation.js';
import { validatePagination } from '../validations/commonValidation.js';

const router = express.Router();

/**
 * Create a comment for a post
 */
router.post(
    '/create',
    validateCreateComment,
    createComments
);

/**
 * Get comments for a post with pagination
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
router.get(
    '/post/:postId',
    validatePagination,
    getCommentsByPost
);

/**
 * Update a comment (only owner can edit)
 */
router.put(
    '/:commentId',
    validateUpdateComment,
    updateComment
);

/**
 * Delete a comment (only owner can delete)
 */
router.delete(
    '/:commentId',
    deleteComment
);

export default router;