import UserInterest from '../models/UserInterest.js';
import User from '../models/User.js';
import { ERROR_MESSAGES, HTTP_STATUS } from '../constants/index.js';
import { NotFoundError, ForbiddenError, InternalServerError } from '../utils/errors.js';

/**
 * Get all users
 * @returns {Promise<Array<Object>>} Array of user objects
 *
 * @throws {Error} If user retrieval fails
 *
 */
export const getAllUsersService = async () => {
  const users = await User.find();
  return users;
};

/**
 * Add user interest
 * @param {string} userId - User ID
 * @param {Array<string>} interests - Array of interests
 * @returns {Promise<Object>} User object with added interests
 *
 * @throws {Error} If user not found or interest addition fails
 *
 */
export const addUserInterestService = async (userId, interests) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  }
  // Find or create the UserInterest document for this user
  let userInterest = await UserInterest.findOne({ user_id: userId });
  if (!userInterest) {
    userInterest = new UserInterest({ user_id: userId, interest: [] });
  }
  // Use the instance method — handles dedup + saves internally
  for (const interest of interests) {
    await userInterest.addInterest(interest);
  }
  return userInterest;
};

/**
 * Update user profile
 *
 * @param {string} userId - User's MongoDB ID
 * @param {Object} updateData - Data to update
 * @param {string} updateData.name - User's new name (optional)
 * @param {Object} updateData.profileImage - Uploaded profile image (optional)
 * @returns {Promise<Object>} Updated user object (without password)
 *
 * @throws {Error} If user not found
 * @throws {Error} If update fails
 */
export async function updateUserProfile(userId, updateData) {
  const { name, profileImage } = updateData;

  // Find user by ID
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  }

  // Check if user is active
  if (!user.is_active || user.deleted_at) {
    throw new ForbiddenError(ERROR_MESSAGES.USER_PROFILE_DEACTIVATED);
  }

  // Update name if provided
  if (name) {
    user.name = name;
  }

  // Handle profile image upload to S3
  if (profileImage) {
    const { uploadProfileImage, deleteFromS3 } = await import('./s3Service.js');
    console.log('Uploading new profile image for user:', user.profile_url);

    // Delete old profile image if exists
    if (user.profile_url) {
      const oldKey = user.profile_url;
      await deleteFromS3(oldKey);
    }

    // Upload new profile image
    const uploadResult = await uploadProfileImage(
      profileImage.buffer,
      userId,
      profileImage.mimetype
    );

    if (uploadResult.success) {
      // Store the S3 key (not the presigned URL)
      user.profile_url = uploadResult.objectKey;
    } else {
      throw new InternalServerError(ERROR_MESSAGES.FILE_UPLOAD_FAILED);
    }
  }

  // Save updated user
  await user.save();

  // Return user without password hash
  return user.getPublicProfile();
}
