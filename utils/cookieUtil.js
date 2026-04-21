import { JWT_TOKEN_TYPES } from "../constants/index.js";
import { config } from "../config/env.js";

const setAuthCookies = (res, user) => {
  res.cookie(JWT_TOKEN_TYPES.ACCESS_TOKEN, user.accessToken, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "Strict",
    maxAge: 1 * 24 * 60 * 60 * 1000 // 1 day
  });

  res.cookie(JWT_TOKEN_TYPES.REFRESH_TOKEN, user.refreshToken, {
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

const clearAuthCookies = (res) => {
  res.clearCookie(JWT_TOKEN_TYPES.ACCESS_TOKEN);
  res.clearCookie(JWT_TOKEN_TYPES.REFRESH_TOKEN);
}

export { setAuthCookies, clearAuthCookies };