import { registerUser, loginUser, accessTokenReCreation, emailVerificationService } from '../services/authService.js';
import { HTTP_STATUS, MESSAGES } from '../constants/index.js';
import { BaseController } from './baseController.js';

// Create an instance of BaseController
const baseController = new BaseController();

/**
 * Register a new user
 * @route POST /api/auth/register
 */
export const register = baseController.handleRequest(async (req, res) => {
  const { name, email, password, role } = req.body;

  const user = await registerUser({ name, email, password, role });

  await emailVerificationService({ email });

  return baseController.sendSuccess(
    res,
    { user },
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

  const user = await loginUser({ email, password });

  return baseController.sendSuccess(
    res,
    { user },
    MESSAGES.USER_LOGGED_IN,
    HTTP_STATUS.OK
  );
});

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 */
export const refreshToken = baseController.handleRequest(async (req, res) => {
  const { refreshToken } = req.body;

  const user = await accessTokenReCreation(refreshToken);

  return baseController.sendSuccess(
    res,
    { user },
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
  const { token, password } = req.body;

  const user = await resetPasswordService({ token, password });

  return baseController.sendSuccess(
    res,
    { user },
    MESSAGES.PASSWORD_RESET
  );
});