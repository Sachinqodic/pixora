
import { z } from 'zod';
import { transformZodError } from '../utils/validationErrors.js';

/**
 * Create validation middleware for request body
 * 
 * This is a higher-order function that takes a Zod schema and returns
 * an Express middleware function that validates the request body against that schema.
 * 
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function createBodyValidationMiddleware(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate request body
      // If validation passes, replace req.body with validated/transformed data
      // This ensures downstream code receives clean, validated data
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      // Transform Zod error to our custom error format
      if (error instanceof z.ZodError) {
        const validationError = transformZodError(error);
        return res.status(validationError.statusCode).json(validationError.toJSON());
      }
      // Pass other errors to error handler
      next(error);
    }
  };
}

/**
 * Create validation middleware for URL parameters
 * 
 * This is a higher-order function that takes a Zod schema and returns
 * an Express middleware function that validates URL parameters against that schema.
 * 
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function createParamsValidationMiddleware(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate URL parameters
      // If validation passes, replace req.params with validated data
      const validatedData = schema.parse(req.params);
      req.params = validatedData;
      next();
    } catch (error) {
      // Transform Zod error to our custom error format
      if (error instanceof z.ZodError) {
        const validationError = transformZodError(error);
        return res.status(validationError.statusCode).json(validationError.toJSON());
      }
      // Pass other errors to error handler
      next(error);
    }
  };
}

/**
 * Create validation middleware for query parameters
 * 
 * This is a higher-order function that takes a Zod schema and returns
 * an Express middleware function that validates query parameters against that schema.
 * 
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function createQueryValidationMiddleware(schema) {
  return (req, res, next) => {
    try {
      // Parse and validate query parameters
      // If validation passes, replace req.query with validated data
      const validatedData = schema.parse(req.query);
      req.query = validatedData;
      next();
    } catch (error) {
      // Transform Zod error to our custom error format
      if (error instanceof z.ZodError) {
        const validationError = transformZodError(error);
        return res.status(validationError.statusCode).json(validationError.toJSON());
      }
      // Pass other errors to error handler
      next(error);
    }
  };
}
