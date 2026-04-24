/**
 * Email content for password reset
 * @param {string} verificationUrl - Verification URL
 * @returns {string} HTML content for password reset email
 */
export const EmailContent = {
  passwordReset: (
    verificationUrl
  ) => `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 8px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #666; line-height: 1.6; margin-bottom: 24px;">
          You requested to reset your password. Click the button below to set a new password.
        </p>
        <a href="${verificationUrl}" style="display: inline-block; background: #1a1a2e; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 24px;">
          Reset Password
        </a>
        <p style="color: #999; font-size: 12px; margin-bottom: 8px;">
          If you didn't request a password reset, you can ignore this email.
        </p>
        <p style="color: #999; font-size: 12px;">
          This link will expire in 1 hour.
        </p>
      </div>`,
};
