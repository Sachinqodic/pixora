import UserInterest from '../models/UserInterest.js';
import User from '../models/User.js';
import Follower from '../models/Follower.js';
import { ERROR_MESSAGES } from '../constants/index.js';
import { NotFoundError, ForbiddenError, InternalServerError } from '../utils/errors.js';

/**
 * Get all users with sorting and pagination
 * @param {Object} query - Query parameters
 * @param {number} [query.page=1] - Page number
 * @param {number} [query.limit=10] - Items per page
 * @param {string} [query.sortBy='created_at'] - Field to sort by
 * @param {string} [query.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<Object>} Object containing users and pagination metadata
 *
 * @throws {Error} If user retrieval fails
 *
 */
export const getAllUsersService = async (query = {}) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const sortBy = query.sortBy || 'created_at';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find()
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    User.countDocuments(),
  ]);

  return {
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
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
  const { name, bio, profileImage } = updateData;

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

  // Update bio if provided
  if (bio !== undefined) {
    user.bio = bio;
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

/**
 * Follow a user
 * @param {string} followerId - ID of the user who is following
 * @param {string} followingId - ID of the user being followed
 * @returns {Promise<Object>} The follow record
 */
export const followUserService = async (followerId, followingId) => {
  if (followerId === followingId) {
    throw new ForbiddenError('You cannot follow yourself');
  }

  const followingUser = await User.findById(followingId);
  if (!followingUser) {
    throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  }

  const existingFollow = await Follower.findOne({
    follower_id: followerId,
    following_id: followingId,
  });

  if (existingFollow) {
    return existingFollow;
  }

  const follow = new Follower({
    follower_id: followerId,
    following_id: followingId,
  });

  await follow.save();
  return follow;
};

/**
 * Unfollow a user
 * @param {string} followerId - ID of the user who is unfollowing
 * @param {string} followingId - ID of the user being unfollowed
 * @returns {Promise<Object>} Success message
 */
export const unfollowUserService = async (followerId, followingId) => {
  const result = await Follower.findOneAndDelete({
    follower_id: followerId,
    following_id: followingId,
  });

  if (!result) {
    throw new NotFoundError('Follow relationship not found');
  }

  return { message: 'Successfully unfollowed user' };
};

/**
 * Get followers of a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of followers
 */
export const getFollowersService = async (userId) => {
  const followers = await Follower.find({ following_id: userId })
    .populate('follower_id', 'name email profile_url bio')
    .sort({ created_at: -1 });

  return followers.map((f) => f.follower_id);
};

/**
 * Get users being followed by a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of following users
 */
export const getFollowingService = async (userId) => {
  const following = await Follower.find({ follower_id: userId })
    .populate('following_id', 'name email profile_url bio')
    .sort({ created_at: -1 });

  return following.map((f) => f.following_id);
};
