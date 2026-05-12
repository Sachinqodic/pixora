import express from 'express';
import { publicRateLimiter } from '../middlewares/rateLimiter.js';
import { upload, handleMulterError } from '../helpers/multerConfig.js';
import { protectedRoute, authChecker } from '../middlewares/authChecker.js';
import {
  updateProfile,
  getAllUsers,
  addUserInterest,
  getProfile,
} from '../controllers/userController.js';
import { validateUpdateProfile, validateAddUserInterest } from '../validations/userValidation.js';

const router = express.Router();

/**
 * Get current user profile
 */
router.get('/profile', authChecker, getProfile);

/**
 * Get all users
 */
router.get(
  '/',
  // publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  protectedRoute,
  getAllUsers
);

/**
 * Add user interest
 */
router.post(
  '/add-user-interest',
  // publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  authChecker,
  validateAddUserInterest,
  addUserInterest
);

/**
 * Update user profile
 */
router.put(
  '/me/update/:id',
  //publicRateLimiter,
  authChecker,
  upload.single('profileImage'), // Handle single file upload with field name 'profileImage'
  handleMulterError, // Handle multer errors
  validateUpdateProfile, // Validate name field
  updateProfile
);

export default router;
