import { config } from '../config/env.js';
import { HTTP_STATUS, STRING_CONSTANTS, ERROR_MESSAGES } from '../constants/index.js';
import { AppError } from '../utils/errors.js';

/**
 * Global error handling middleware
 * Catches all errors from route handlers and returns consistent JSON responses
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  // Log error details for debugging
  console.error('✗ Error occurred:', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    stack: config.env === STRING_CONSTANTS.ENVIRONMENT_DEVELOPMENT ? err.stack : undefined,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });

  // Determine appropriate HTTP status code
  const statusCode = err.statusCode || err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;

  // Format error response
  const errorResponse = {
    success: false,
    error: {
      message: err.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      code: err.code || 'INTERNAL_ERROR',
      statusCode: statusCode,
    },
  };

  // Include additional details if available (for validation errors, etc.)
  if (err.details) {
    errorResponse.error.details = err.details;
  }

  // Include detailed error information in development mode
  if (config.env === STRING_CONSTANTS.ENVIRONMENT_DEVELOPMENT) {
    errorResponse.error.stack = err.stack;
    errorResponse.path = req.path;
    errorResponse.method = req.method;
  }

  // Send JSON error response
  res.status(statusCode).json(errorResponse);
}
