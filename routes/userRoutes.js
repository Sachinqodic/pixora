import express from 'express';
import { register, updateProfile } from '../controllers/userController.js';
import { publicRateLimiter } from '../middlewares/rateLimiter.js';
import { validateRegister, validateUpdateProfile } from '../validations/userValidation.js';
import { upload, handleMulterError } from '../helpers/multerConfig.js';

const router = express.Router();

/**
 * Register a new user
 */
router.post(
  '/register',
  //publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  validateRegister, // Validate registration data
  register
);

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
