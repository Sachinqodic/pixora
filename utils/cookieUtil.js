import { JWT_TOKEN_TYPES } from '../constants/index.js';
import { config } from '../config/env.js';

const setAuthCookies = (res, user) => {
  // Access token - NOT httpOnly so frontend can read it
  res.cookie(JWT_TOKEN_TYPES.ACCESS_TOKEN, user.accessToken, {
    httpOnly: false, // Allow JavaScript access
    secure: config.env === 'production',
    sameSite: 'None',
    path: '/',
    maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
  });

  // Refresh token - Keep httpOnly for security
  res.cookie(JWT_TOKEN_TYPES.REFRESH_TOKEN, user.refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'None',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearAuthCookies = (res) => {
  // Clear access token with same attributes
  res.clearCookie(JWT_TOKEN_TYPES.ACCESS_TOKEN, {
    path: '/',
    secure: config.env === 'production',
    sameSite: 'None',
  });

  // Clear refresh token with same attributes
  res.clearCookie(JWT_TOKEN_TYPES.REFRESH_TOKEN, {
    path: '/',
    secure: config.env === 'production',
    sameSite: 'None',
  });
};

export { setAuthCookies, clearAuthCookies };
