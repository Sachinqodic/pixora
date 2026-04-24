import { HTTP_STATUS, ERROR_CODES } from '../constants/index.js';

/**
 * ============================================================================
 * CUSTOM VALIDATION ERROR CLASSES
 * ============================================================================
 *
 * These custom error classes provide structured error responses for validation
 * failures. They extend the base Error class and include additional metadata
 * for consistent error handling across the application.
 */
export class FieldValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'FieldValidationError';
    this.statusCode = HTTP_STATUS.BAD_REQUEST;
    this.code = ERROR_CODES.VALIDATION_ERROR;
    this.details = details; // Can be single object or array of field errors

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

/**
 * Transform Zod validation errors to our custom error format
 *
 * Zod returns errors in a specific format. This function transforms them
 * into our application's standard error format for consistency.
 *
 * @param {z.ZodError} zodError - Zod validation error object
 * @returns {FieldValidationError} Transformed error
 *
 */
export function transformZodError(zodError) {
  const fieldErrors = [];

  // Extract all field errors from Zod error
  zodError.errors.forEach((err) => {
    // Join path array to create field name (e.g., ['user', 'email'] -> 'user.email')
    const fieldPath = err.path.join('.');

    fieldErrors.push({
      field: fieldPath || 'unknown', // Use 'unknown' if path is empty
      message: err.message, // Use Zod's original error message
    });
  });

  // If only one field error, return it as object instead of array
  const details = fieldErrors.length === 1 ? fieldErrors[0] : fieldErrors;

  return new FieldValidationError('Validation failed', details);
}
