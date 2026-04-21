import z from 'zod';
import { createBodyValidationMiddleware } from '../middlewares/validation.js';

const addUserInterestSchema = z.object({
    userId: z.string().trim().min(1, 'User ID is required'),
    interests: z.array(z.string().trim()).min(1, 'Interests are required').max(10, 'Maximum 10 interests are allowed')
});
/**
 * Name regex pattern
 * - Only letters and spaces allowed
 * - 2-50 characters
 */
const nameRegex = /^[a-zA-Z\s]{2,50}$/;

// Name validator
const nameValidator = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters long')
  .max(50, 'Name must not exceed 50 characters')
  .regex(nameRegex, 'Name must contain only letters and spaces');

/**
 * Update Profile Schema
 * Validates user profile update data
 */
export const updateProfileSchema = z.object({
  name: nameValidator.optional()
});
export const validateAddUserInterest = createBodyValidationMiddleware(addUserInterestSchema);
export const validateUpdateProfile = createBodyValidationMiddleware(updateProfileSchema);
