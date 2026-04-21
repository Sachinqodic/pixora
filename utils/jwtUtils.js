import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES } from '../constants/index.js';

/**
 * Generate JWT token
 * 
 * @param {string} userId - User ID to include in token
 * @param {string} secret - JWT secret
 * @param {string} errorMessage - Error message to throw if token is invalid
 * @returns {Promise<string>} Generated JWT token
 * 
 * @example
 * const token = await generateToken('1234567890', process.env.JWT_SECRET, ERROR_MESSAGES.INVALID_TOKEN);
 */
export const generateToken = async (userId, secret, errorMessage, expiresIn, tokenType) => {
  if (!userId) {
    throw new Error(ERROR_MESSAGES.USER_ID_REQUIRED);
  }

  try {
    return jwt.sign({ userId, tokenType }, secret, { expiresIn });
  } catch (error) {
    throw new Error(errorMessage);
  }
}

/**
 * Verify JWT token
 * 
 * @param {string} token - JWT token to verify
 * @param {string} secret - JWT secret
 * @param {string} errorMessage - Error message to throw if token is invalid
 * @returns {Promise<Object>} Decoded token payload
 * 
 * @example
 * const decoded = await verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', process.env.JWT_SECRET, ERROR_MESSAGES.INVALID_TOKEN);
 */
export const verifyToken = (token, secret, errorMessage, tokenType) => {
  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    // Token is expired, malformed, or signature is invalid
    const errorCustom = new Error(errorMessage);
    errorCustom.statusCode = HTTP_STATUS.UNAUTHORIZED;
    throw errorCustom;
  }

  // Token type check is outside try/catch so mismatches throw clearly
  if (decoded.tokenType !== tokenType) {
    const errorCustom = new Error(errorMessage);
    errorCustom.statusCode = HTTP_STATUS.UNAUTHORIZED;
    throw errorCustom;
  }

  return decoded;
};