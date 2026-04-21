
import { z } from 'zod';
import { 
  createBodyValidationMiddleware, 
  createParamsValidationMiddleware 
} from '../middlewares/validation.js';


/**
 * Password regex pattern
 * - At least 8 characters
 * - Must contain lowercase letter
 * - Must contain uppercase letter
 * - Must contain number
 * - Must contain special character
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

/**
 * Name regex pattern
 * - Only letters and spaces allowed
 * - 2-50 characters
 */
const nameRegex = /^[a-zA-Z\s]{2,50}$/;

/**
 * MongoDB ObjectId regex pattern
 * - 24 character hex string
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// ============================================================================
// REUSABLE FIELD VALIDATORS
// ============================================================================

// Email validator
const emailValidator = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim()
  .max(255, 'Email must not exceed 255 characters');

/**
 * Password validator (for login)
 * - Minimum 1 character (just check if provided)
 * - Actual strength validation happens during registration
 */
const passwordValidator = z
  .string()
  .min(1, 'Password is required');

// Strong password validator (for registration)
const strongPasswordValidator = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(passwordRegex, 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');

// Name validator
const nameValidator = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters long')
  .max(50, 'Name must not exceed 50 characters')
  .regex(nameRegex, 'Name must contain only letters and spaces');

/**
 * MongoDB ObjectId validator
 * - Must be 24 character hex string
 */
const objectIdValidator = z
  .string()
  .regex(objectIdRegex, 'Invalid user ID format');

// Role validator
const roleValidator = z
  .enum(['user', 'admin'])
  .default('user');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Login Schema
 * Validates user login data
 */
export const loginSchema = z.object({
  email: emailValidator,
  password: passwordValidator
});

/**
 * Registration Schema
 * Validates new user registration data
 */
export const registerSchema = z.object({
  name: nameValidator,
  email: emailValidator,
  password: strongPasswordValidator,
  role: roleValidator.optional()
});

/**
 * User ID Parameter Schema
 * Validates userId from URL parameters
 */
export const userIdParamSchema = z.object({
  userId: objectIdValidator
});

/**
 * Forgot Password Schema
 * Validates forgot password data
 */
export const forgotPasswordSchema = z.object({
  email: emailValidator
});

/**
 * Reset Password Schema
 * Validates reset password data
 */
export const resetPasswordSchema = z.object({
  password: strongPasswordValidator,
});

export const validateLogin = createBodyValidationMiddleware(loginSchema);
export const validateRegister = createBodyValidationMiddleware(registerSchema);
export const validateUserId = createParamsValidationMiddleware(userIdParamSchema);
export const validateForgotPassword = createBodyValidationMiddleware(forgotPasswordSchema);
export const validateResetPassword = createBodyValidationMiddleware(resetPasswordSchema);