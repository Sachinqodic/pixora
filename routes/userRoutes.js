import express from 'express';
import { updateProfile } from '../controllers/userController.js';
import { publicRateLimiter } from '../middlewares/rateLimiter.js';
import { validateUpdateProfile } from '../validations/userValidation.js';
import { upload, handleMulterError } from '../helpers/multerConfig.js';
import { protectedRoute, authChecker } from '../middlewares/authChecker.js';
import { getAllUsers, addUserInterest } from '../controllers/userController.js';
import { validateAddUserInterest } from '../validations/userValidation.js';

const router = express.Router();

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
)

/**
 * Update user profile
 */
router.put(
  '/me/update/:id',
  //publicRateLimiter,
  upload.single('profileImage'), // Handle single file upload with field name 'profileImage'
  handleMulterError, // Handle multer errors
  validateUpdateProfile, // Validate name field
  updateProfile
);

export default router;
