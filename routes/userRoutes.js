import express from 'express';
import { publicRateLimiter } from '../middlewares/rateLimiter.js';
import { upload, handleMulterError } from '../helpers/multerConfig.js';
import { protectedRoute, authChecker } from '../middlewares/authChecker.js';
import {
  updateProfile,
  getAllUsers,
  addUserInterest,
  getProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getUserProfile,
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
  '/all',
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

/**
 * Follow a user
 */
router.post('/:id/follow', authChecker, followUser);

/**
 * Unfollow a user
 */
router.delete('/:id/unfollow', authChecker, unfollowUser);

/**
 * Get followers
 */
router.get('/:id/followers', authChecker, getFollowers);

/**
 * Get following users
 */
router.get('/:id/following', authChecker, getFollowing);
router.get('/:id/profile', authChecker, getUserProfile);

export default router;
