
import User from '../models/User.js';
import { ERROR_MESSAGES, HTTP_STATUS, PLAN_TYPES } from '../constants/index.js';
import { hashPassword, comparePassword } from '../utils/passwordUtils.js';
import { generateToken, verifyRefreshToken, generateRefreshToken } from '../utils/jwtUtils.js';
import sgMail from '@sendgrid/mail';

// Set SendGrid API key
sgMail.setApiKey(process.env.SEND_GRID_API_KEY);

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
export async function registerUser(userData) {
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

  // Return user without password hash
  return newUser.getPublicProfile();
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
  const token = await generateToken(user._id);
  const refreshToken = await generateRefreshToken(user._id);

  // Return user without password hash and token
  return {
    ...user.getPublicProfile(),
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
  const decodedToken = await verifyRefreshToken(refreshToken);

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
  const token = await generateToken(user._id);

  // Return user without password hash and token
  return {
    ...user.getPublicProfile(),
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
  const { email } = userData;

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

  // Generate JWT token
  const token = await generateToken(user._id);

  // Return user without password hash and token
  return {
    ...user.getPublicProfile(),
    accessToken: token
  };
};

/**
 * Email verification
 * 
 * @param {Object} userData - User data
 * @param {string} userData.email - User's email address
 * @returns {Promise<Object>} User object
 * 
 * @throws {Error} If user not found
 * @throws {Error} If user profile is deactivated
 * 
 */
export const emailVerificationService = async (userData) => {
  try {
    const response = await sgMail.send({
      to: "sachin@qodictechnosoft.com",
      from: process.env.SEND_GRID_SENDOR_EMAIL,
      subject: "Test Email",
      text: "It works!",
    });
    console.log('Email sent successfully. Status:', response[0].statusCode);
    return response;
  } catch (error) {
    // SendGrid returns detailed error info in error.response.body
    if (error.response) {
      console.error('SendGrid error status:', error.response.status || error.code);
      console.error('SendGrid error body:', JSON.stringify(error.response.body, null, 2));
    } else {
      console.error('Error sending email:', error.message);
    }
    throw error;
  }
};