
import User from '../models/User.js';
import { ERROR_MESSAGES, HTTP_STATUS, PLAN_TYPES, JWT_TOKEN_TYPES } from '../constants/index.js';
import { hashPassword, comparePassword } from '../utils/passwordUtils.js';
import { generateToken, verifyToken } from '../utils/jwtUtils.js';
import { config } from '../config/env.js';
import sgMail from '@sendgrid/mail';
import { EmailContent } from '../utils/textContent.js';

// Set SendGrid API key
sgMail.setApiKey(config.security.sendGridApiKey);

/**
 * Register a new user
 * 
 * @param {Object} userData - User registration data
 * @param {string} userData.name - User's full name
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - User's plain text password
 * @returns {Promise<Object>} Created user object (without password)
 * 
 * @throws {Error} If email already exists
 * @throws {Error} If user creation fails
 * 
 */
export const registerUser = async (userData) => {
  const { name, email, password, role = 'user' } = userData;

  // Check if user already exists (including soft deleted users)
  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    // If user is active and not deleted, return conflict error
    if (existingUser.is_active && !existingUser.deleted_at) {
      const error = new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }

    // If user exists but is inactive or soft deleted, reactivate the account
    if (!existingUser.is_active || existingUser.deleted_at) {
      const error = new Error(ERROR_MESSAGES.USER_PROFILE_DEACTIVATED);
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }
  }

  // Hash password
  const password_hash = await hashPassword(password);

  // Create new user
  const newUser = await User.create({
    name,
    email: email.toLowerCase(),
    password_hash,
    is_email_verified: false,
    plan_type: PLAN_TYPES.FREE,
    storage_used: 0,
    role: role,
    is_active: true,
    profile_url: null,
    deleted_at: null
  });

  // Generate JWT token
  const accessToken = await generateToken(newUser._id, config.security.jwtSecret, ERROR_MESSAGES.INVALID_TOKEN, config.security.jwtExpiresIn, JWT_TOKEN_TYPES.ACCESS_TOKEN);
  const refreshToken = await generateToken(newUser._id, config.security.jwtSecret, ERROR_MESSAGES.INVALID_REFRESH_TOKEN, config.security.jwtRefreshExpiresIn, JWT_TOKEN_TYPES.REFRESH_TOKEN);

  // Return user without password hash and tokens
  return {
    user: newUser.getPublicProfile(),
    accessToken,
    refreshToken
  };
}

/**
 * Login a user
 * 
 * @param {Object} userData - User login data
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - User's plain text password
 * @returns {Promise<Object>} User object with JWT token
 * 
 * @throws {Error} If user not found
 * @throws {Error} If user profile is deactivated
 * @throws {Error} If invalid credentials
 * 
 */
export const loginUser = async (userData) => {
  const { email, password } = userData;

  // Check if user exists (including soft deleted users)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password_hash -__v');

  if (!user) {
    const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  // Check if user is not active and deleted
  if (!user.is_active || user.deleted_at) {
    const error = new Error(ERROR_MESSAGES.USER_PROFILE_DEACTIVATED);
    error.statusCode = HTTP_STATUS.FORBIDDEN;
    throw error;
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);

  if (!isPasswordValid) {
    const error = new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    error.statusCode = HTTP_STATUS.UNAUTHORIZED;
    throw error;
  }

  // Generate JWT token
  const token = await generateToken(user._id, config.security.jwtSecret, ERROR_MESSAGES.INVALID_TOKEN, config.security.jwtExpiresIn, JWT_TOKEN_TYPES.ACCESS_TOKEN);
  const refreshToken = await generateToken(user._id, config.security.jwtSecret, ERROR_MESSAGES.INVALID_REFRESH_TOKEN, config.security.jwtRefreshExpiresIn, JWT_TOKEN_TYPES.REFRESH_TOKEN);

  // Return user without password hash and token
  return {
    user: user.getPublicProfile(),
    accessToken: token,
    refreshToken: refreshToken
  };
};

/**
 * Refresh access token
 * 
 * @param {string} refreshToken - JWT refresh token
 * @returns {Promise<Object>} User object with new JWT token
 * 
 * @throws {Error} If refresh token is invalid
 * @throws {Error} If user not found
 * @throws {Error} If user profile is deactivated
 * 
 */
export const accessTokenReCreation = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error(ERROR_MESSAGES.REFRESH_TOKEN_REQUIRED);
    error.statusCode = HTTP_STATUS.BAD_REQUEST;
    throw error;
  }

  // Verify refresh token
  const decodedToken = await verifyToken(refreshToken,
    config.security.jwtSecret,
    ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
    JWT_TOKEN_TYPES.REFRESH_TOKEN
  );

  // Check if user exists (including soft deleted users)
  const user = await User.findById(decodedToken.userId).select('+password_hash -__v');

  if (!user) {
    const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  // Check if user is not active and deleted
  if (!user.is_active || user.deleted_at) {
    const error = new Error(ERROR_MESSAGES.USER_PROFILE_DEACTIVATED);
    error.statusCode = HTTP_STATUS.FORBIDDEN;
    throw error;
  }

  // Generate new JWT token
  const token = await generateToken(user._id,
    config.security.jwtSecret,
    ERROR_MESSAGES.INVALID_TOKEN,
    config.security.jwtExpiresIn,
    JWT_TOKEN_TYPES.ACCESS_TOKEN
  );

  // Return user without password hash and token
  return {
    user: user.getPublicProfile(),
    accessToken: token,
    refreshToken: refreshToken
  };
};

/**
 * Forgot password
 * 
 * @param {Object} userData - User data
 * @param {string} userData.email - User's email address
 * @returns {Promise<Object>} User object
 * 
 * @throws {Error} If user not found
 * @throws {Error} If user profile is deactivated
 * 
 */
export const forgotPasswordService = async (userData) => {
  try {
    const { email } = userData;

    // Check if user exists (including soft deleted users)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password_hash -__v');

    if (!user || !user.is_active || user.deleted_at) {
      const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    // Generate short-lived password reset token (1 hour)
    const token = await generateToken(user._id,
      config.security.jwtSecret,
      ERROR_MESSAGES.INVALID_TOKEN,
      '1h',
      JWT_TOKEN_TYPES.PASSWORD_RESET_TOKEN
    );

    const verificationUrl = `${config.client.baseUrl}/reset-password?token=${token}`;
    const subject = "Pixora Password Reset";
    const text = `Click on the link to reset your password: ${verificationUrl}`;
    const html = EmailContent.passwordReset(verificationUrl);

    const response = await sendEmailService(email, subject, text, html);
    return { status: response.status, message: ERROR_MESSAGES.PASSWORD_RESET_LINK_SENT };
  } catch (error) {
    throw error;
  }
};

/**
 * Send email
 * 
 * @param {string} email - User's email address
 * @param {string} subject - Email subject
 * @param {string} text - Email text
 * @param {string} html - Email HTML
 * @returns {Promise<Object>} Response object
 * 
 * @throws {Error} If email cannot be sent
 * 
 */
const sendEmailService = async (email, subject, text, html) => {
  try {
    const response = await sgMail.send({
      to: email,
      from: config.security.sendGridSendorEmail,
      subject: subject,
      text: text,
      html: html,
    });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Reset password
 * 
 * @param {string} token - Password reset token
 * @param {string} password - New password
 * @returns {Promise<Object>} Response object
 * 
 * @throws {Error} If password reset token is invalid
 * @throws {Error} If user not found
 * @throws {Error} If user profile is deactivated
 * @throws {Error} If user is not email verified
 * 
 */
export const resetPasswordService = async (token, password) => {
  try {
    if (!token) {
      const error = new Error(ERROR_MESSAGES.PASSWORD_RESET_TOKEN_REQUIRED);
      error.statusCode = HTTP_STATUS.BAD_REQUEST;
      throw error;
    }

    const decodedToken = await verifyToken(token,
      config.security.jwtSecret,
      ERROR_MESSAGES.INVALID_TOKEN,
      JWT_TOKEN_TYPES.PASSWORD_RESET_TOKEN
    );

    const user = await User.findById(decodedToken.userId).select('+password_hash -__v');

    if (!user) {
      const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      error.statusCode = HTTP_STATUS.NOT_FOUND;
      throw error;
    }

    // Check if user is not active and deleted
    if (!user.is_active || user.deleted_at) {
      const error = new Error(ERROR_MESSAGES.USER_PROFILE_DEACTIVATED);
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Update user password
    user.password_hash = password_hash;
    await user.save();

    return {
      success: true,
      message: ERROR_MESSAGES.PASSWORD_RESET
    };
  } catch (error) {
    throw error;
  }
};