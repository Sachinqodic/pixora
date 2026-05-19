import { z } from 'zod';
import { createBodyValidationMiddleware } from '../middlewares/validation.js';

// Board name validator
const nameValidator = z
  .string()
  .trim()
  .min(1, 'Board name is required')
  .max(100, 'Board name must not exceed 100 characters');

// Board description validator
const descriptionValidator = z
  .string()
  .trim()
  .max(500, 'Description must not exceed 500 characters')
  .optional();

// MongoDB ObjectId validator
const objectIdValidator = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

// Create Board Schema
export const createBoardSchema = z.object({
  name: nameValidator,
  description: descriptionValidator,
});

// Save Pin to Board Schema
export const savePinToBoardSchema = z.object({
  board_id: objectIdValidator,
  post_id: objectIdValidator,
});

export const validateCreateBoard = createBodyValidationMiddleware(createBoardSchema);
export const validateSavePinToBoard = createBodyValidationMiddleware(savePinToBoardSchema);
