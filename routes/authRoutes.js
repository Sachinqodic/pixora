import express from 'express';
import { register, login, refreshToken, forgotPassword, resetPassword } from '../controllers/authController.js';
import { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } from '../validations/authValidation.js';

const router = express.Router();

/**
 * Register a new user
 */
router.post(
  '/register',
  // publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  validateRegister, // Validate registration data
  register
);

/**
 * Login a user
 */
router.post(
  '/login',
  // publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  validateLogin, // Validate login data
  login
);

/**
 * Refresh access token
 */
router.post(
  '/refresh',
  // publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  refreshToken
);

/**
 * Forgot password
 */
router.post(
  '/forgot-password',
  // publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  validateForgotPassword, // Validate forgot password data
  forgotPassword
);

/**
 * Reset password
 */
router.post(
  '/reset-password',
  // publicRateLimiter, // Apply public rate limiter (10 requests/minute)
  validateResetPassword, // Validate reset password data
  resetPassword
);

export default router;
