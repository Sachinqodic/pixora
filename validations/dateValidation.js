import { z } from 'zod';
import { HTTP_STATUS } from '../constants/index.js';

/**
 * Zod schema for date range validation
 * Validates YYYY-MM-DD format for startDate and endDate
 */
const dateRangeSchema = z
  .object({
    startDate: z
      .string({
        required_error: 'startDate is required',
      })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format')
      .refine(
        (value) => {
          const date = new Date(value);
          return !isNaN(date.getTime());
        },
        { message: 'startDate must be a valid date' }
      ),

    endDate: z
      .string({
        required_error: 'endDate is required',
      })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format')
      .refine(
        (value) => {
          const date = new Date(value);
          return !isNaN(date.getTime());
        },
        { message: 'endDate must be a valid date' }
      )
      .refine(
        (value) => {
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          const endDate = new Date(value);
          endDate.setHours(0, 0, 0, 0);

          return endDate <= now;
        },
        { message: 'endDate cannot be in the future' }
      ),
  })
  .refine(
    (data) => {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      return endDate >= startDate;
    },
    {
      message: 'endDate must be after or equal to startDate',
      path: ['endDate'],
    }
  );

/**
 * Middleware to validate date range using Zod
 * Validates query parameters for billing analytics endpoints
 */
export const validateDateRange = (req, res, next) => {
  try {
    // Validate query parameters
    dateRangeSchema.parse(req.query);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    // Handle unexpected errors
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'An unexpected error occurred during validation',
    });
  }
};
