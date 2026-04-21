import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES } from '../constants/index.js';

/**
 * Generate JWT token
 * 
 * @param {string} userId - User ID to include in token
 * @returns {Promise<string>} Generated JWT token
 * 
 * @example
 * const token = await generateToken('1234567890');
 */
export const generateToken = async (userId) => {
  if (!userId) {
    throw new Error(ERROR_MESSAGES.USER_ID_REQUIRED);
  }

  try {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  } catch (error) {
    throw new Error(ERROR_MESSAGES.FAILED_TO_GENERATE_TOKEN);
  }
}

/**
 * Generate JWT refresh token
 * 
 * @param {string} userId - User ID to include in token
 * @returns {Promise<string>} Generated JWT refresh token
 * 
 * @example
 * const token = await generateRefreshToken('1234567890');
 */
export const generateRefreshToken = async (userId) => {
  if (!userId) {
    throw new Error(ERROR_MESSAGES.USER_ID_REQUIRED);
  }

  try {
    return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN });
  } catch (error) {
    throw new Error(ERROR_MESSAGES.FAILED_TO_GENERATE_REFRESH_TOKEN);
  }
}

/**
 * Verify JWT token
 * 
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object>} Decoded token payload
 * 
 * @example
 * const decoded = await verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
  }
};

/**
 * Verify JWT refresh token
 * 
 * @param {string} token - JWT refresh token to verify
 * @returns {Promise<Object>} Decoded token payload
 * 
 * @example
 * const decoded = await verifyRefreshToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }
};