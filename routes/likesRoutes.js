import express from 'express';
import { createLike } from '../controllers/likeController.js';
import { validateCreateLike } from '../validations/likeValidation.js';
import { authChecker } from '../middlewares/authChecker.js';

const router = express.Router();

/**
 * Create a new like for a post
 */
router.post('/create', authChecker, validateCreateLike, createLike);

export default router;
