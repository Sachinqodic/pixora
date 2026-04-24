import bcrypt from 'bcrypt';
import { config } from '../config/env.js';

/**
 * Hash a plain text password
 *
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password
 *
 * @example
 * const hashedPassword = await hashPassword('mySecurePassword123');
 */
export async function hashPassword(password) {
  if (!password) {
    throw new Error('Password is required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
  const hash = await bcrypt.hash(password, salt);

  return hash;
}

/**
 * Compare a plain text password with its hash
 *
 * @param {string} password - Plain text password to compare
 * @param {string} hash - Hashed password to compare against
 * @returns {Promise<boolean>} True if password matches hash, false otherwise
 *
 * @example
 * const isMatch = await comparePassword('mySecurePassword123', hashedPassword);
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) {
    throw new Error('Password and hash are required');
  }

  return await bcrypt.compare(password, hash);
}
