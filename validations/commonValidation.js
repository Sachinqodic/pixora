import { z } from 'zod';
import { createQueryValidationMiddleware } from '../middlewares/validation.js';
import { NUMERIC_CONSTANTS } from '../constants/index.js';

/**
 * Common Validation Schemas
 *
 * This file contains reusable validation schemas that can be used across multiple routes.
 *
 */

/**
 * Pagination query parameters schema
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val >= NUMERIC_CONSTANTS.PAGINATION_DEFAULT_PAGE, {
      message: 'Page must be greater than or equal to 1',
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .refine(
      (val) =>
        val >= NUMERIC_CONSTANTS.PAGINATION_DEFAULT_PAGE &&
        val <= NUMERIC_CONSTANTS.PAGINATION_MAX_LIMIT,
      {
        message: 'Limit must be between 1 and 100',
      }
    ),
});

/**
 * Middleware to validate pagination query parameters
 */
export const validatePagination = createQueryValidationMiddleware(paginationSchema);
