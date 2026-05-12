import express from 'express';
import {
  createComments,
  getCommentsByPost,
  updateComment,
  deleteComment,
} from '../controllers/commentController.js';
import { validateCreateComment, validateUpdateComment } from '../validations/commentValidation.js';
import { validatePagination } from '../validations/commonValidation.js';
import { authChecker } from '../middlewares/authChecker.js';

const router = express.Router();

/**
 * Create a comment for a post
 */
router.post('/create', authChecker, validateCreateComment, createComments);

/**
 * Get comments for a post with pagination
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
router.get('/post/:postId', authChecker, validatePagination, getCommentsByPost);

/**
 * Update a comment (only owner can edit)
 */
router.put('/:commentId', authChecker, validateUpdateComment, updateComment);

/**
 * Delete a comment (only owner can delete)
 */
router.delete('/:commentId', authChecker, deleteComment);

export default router;
