import {
  registerUser,
  loginUser,
  accessTokenReCreation,
  forgotPasswordService,
  resetPasswordService,
} from '../services/authService.js';
import { HTTP_STATUS, MESSAGES, JWT_TOKEN_TYPES } from '../constants/index.js';
import { BaseController } from './baseController.js';
import { setAuthCookies } from '../utils/cookieUtil.js';

// Create an instance of BaseController
const baseController = new BaseController();

/**
 * Register a new user
 * @route POST /api/auth/register
 */
export const register = baseController.handleRequest(async (req, res) => {
  const { name, email, password, role } = req.body;

  const result = await registerUser({ name, email, password, role });

  setAuthCookies(res, result);

  // Generate presigned URL for the profile image if it exists
  if (result.user.profile_url) {
    const { generatePresignedUrl } = await import('../services/s3Service.js');
    const presignedUrl = await generatePresignedUrl(result.user.profile_url, 7200); // 2 hours
    result.user.profile_url = presignedUrl;
  }

  return baseController.sendSuccess(
    res,
    { user: result.user },
    MESSAGES.USER_CREATED,
    HTTP_STATUS.CREATED
  );
});

/**
 * Login a user
 * @route POST /api/auth/login
 */
export const login = baseController.handleRequest(async (req, res) => {
  const { email, password } = req.body;

  const result = await loginUser({ email, password });

  setAuthCookies(res, result);

  // Generate presigned URL for the profile image if it exists
  if (result.user.profile_url) {
    const { generatePresignedUrl } = await import('../services/s3Service.js');
    const presignedUrl = await generatePresignedUrl(result.user.profile_url, 7200); // 2 hours
    result.user.profile_url = presignedUrl;
  }

  return baseController.sendSuccess(
    res,
    { user: result.user },
    MESSAGES.USER_LOGGED_IN,
    HTTP_STATUS.OK
  );
});

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 */
export const refreshToken = baseController.handleRequest(async (req, res) => {
  const refreshToken = req.cookies[JWT_TOKEN_TYPES.REFRESH_TOKEN];

  const result = await accessTokenReCreation(refreshToken);

  setAuthCookies(res, result);

  // Generate presigned URL for the profile image if it exists
  if (result.user.profile_url) {
    const { generatePresignedUrl } = await import('../services/s3Service.js');
    const presignedUrl = await generatePresignedUrl(result.user.profile_url, 7200); // 2 hours
    result.user.profile_url = presignedUrl;
  }

  return baseController.sendSuccess(
    res,
    { user: result.user },
    MESSAGES.USER_LOGGED_IN,
    HTTP_STATUS.OK
  );
});

/**
 * Forgot password
 * @route POST /api/auth/forgot-password
 */
export const forgotPassword = baseController.handleRequest(async (req, res) => {
  const { email } = req.body;

  const user = await forgotPasswordService({ email });

  return baseController.sendSuccess(
    res,
    { user },
    MESSAGES.EMAIL_SENT // better message
  );
});

/**
 * Reset password
 * @route POST /api/auth/reset-password
 */
export const resetPassword = baseController.handleRequest(async (req, res) => {
  const { password } = req.body;
  const token = req.query.token;

  const user = await resetPasswordService(token, password);

  return baseController.sendSuccess(res, { user }, MESSAGES.PASSWORD_RESET);
});
