import { verifyToken } from '../utils/jwtUtils.js';
import {
  ERROR_MESSAGES,
  STRING_CONSTANTS,
  HTTP_STATUS,
  JWT_TOKEN_TYPES,
} from '../constants/index.js';
import { config } from '../config/env.js';
import User from '../models/User.js';
import { AuthenticationError, ForbiddenError } from '../utils/errors.js';

/**
 * Protected route middleware
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 * @returns {Promise<void>} - Next middleware
 *
 * @throws {Error} - If user not found or unauthorized access
 *
 */
export const protectedRoute = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    const decoded = verifyToken(
      token,
      config.security.jwtSecret,
      ERROR_MESSAGES.INVALID_TOKEN,
      JWT_TOKEN_TYPES.ACCESS_TOKEN
    );
    const user = await User.findOne({ _id: decoded.userId });
    if (!user) {
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN);
    }

    if (
      user?.role !== STRING_CONSTANTS.USER_ROLE_ADMIN ||
      user?.deleted_at !== null ||
      user?.is_active === false
    ) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_ACCESS);
    }

    next();
  } catch (error) {
    return res
      .status(error?.statusCode || HTTP_STATUS.UNAUTHORIZED)
      .json({ status: false, message: error?.message || ERROR_MESSAGES.INVALID_TOKEN });
  }
};

/**
 * Admin route middleware
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 * @returns {Promise<void>} - Next middleware
 *
 * @throws {Error} - If user not found or unauthorized access
 *
 */
export const authChecker = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    const decoded = verifyToken(
      token,
      config.security.jwtSecret,
      ERROR_MESSAGES.INVALID_TOKEN,
      JWT_TOKEN_TYPES.ACCESS_TOKEN
    );
    const user = await User.findOne({ _id: decoded.userId });
    if (!user || user?.deleted_at !== null || user?.is_active === false) {
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_TOKEN);
    }
    next();
  } catch (error) {
    return res
      .status(error?.statusCode || HTTP_STATUS.UNAUTHORIZED)
      .json({ status: false, message: error?.message || ERROR_MESSAGES.INVALID_TOKEN });
  }
};
