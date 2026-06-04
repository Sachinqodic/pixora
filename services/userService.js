import UserInterest from '../models/UserInterest.js';
import User from '../models/User.js';
import Follower from '../models/Follower.js';
import mongoose from 'mongoose';
import { ERROR_MESSAGES } from '../constants/index.js';
import { NotFoundError, ForbiddenError, InternalServerError } from '../utils/errors.js';

/**
 * Build aggregation pipeline for fetching followers with user details
 * Replaces N+1 query problem with single aggregation query
 */
const buildFollowersPipeline = (userId) => [
  { $match: { following_id: new mongoose.Types.ObjectId(userId) } },
  { $sort: { created_at: -1 } },
  {
    $lookup: {
      from: 'users',
      localField: 'follower_id',
      foreignField: '_id',
      as: 'follower',
      pipeline: [{ $project: { name: 1, email: 1, profile_url: 1, bio: 1 } }],
    },
  },
  { $unwind: '$follower' },
  { $replaceRoot: { newRoot: '$follower' } },
];

/**
 * Build aggregation pipeline for fetching following users with user details
 * Replaces N+1 query problem with single aggregation query
 */
const buildFollowingPipeline = (userId) => [
  { $match: { follower_id: new mongoose.Types.ObjectId(userId) } },
  { $sort: { created_at: -1 } },
  {
    $lookup: {
      from: 'users',
      localField: 'following_id',
      foreignField: '_id',
      as: 'following',
      pipeline: [{ $project: { name: 1, email: 1, profile_url: 1, bio: 1 } }],
    },
  },
  { $unwind: '$following' },
  { $replaceRoot: { newRoot: '$following' } },
];

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
      .select('name email profile_url bio plan_type created_at updated_at is_active role')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(), // Convert to plain JS objects for better performance
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

  // Batch add interests - filter out duplicates and add all at once
  const newInterests = interests.filter((interest) => !userInterest.interest.includes(interest));

  if (newInterests.length > 0) {
    userInterest.interest.push(...newInterests);
    await userInterest.save(); // Single save instead of multiple
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

    // Run delete and upload in parallel for better performance
    if (user.profile_url) {
      const oldKey = user.profile_url;

      // Execute deletion and upload in parallel
      const [_, uploadResult] = await Promise.all([
        deleteFromS3(oldKey),
        uploadProfileImage(profileImage.buffer, userId, profileImage.mimetype),
      ]);

      if (uploadResult.success) {
        user.profile_url = uploadResult.objectKey;
      } else {
        throw new InternalServerError(ERROR_MESSAGES.FILE_UPLOAD_FAILED);
      }
    } else {
      // No old image, just upload new one
      const uploadResult = await uploadProfileImage(
        profileImage.buffer,
        userId,
        profileImage.mimetype
      );

      if (uploadResult.success) {
        user.profile_url = uploadResult.objectKey;
      } else {
        throw new InternalServerError(ERROR_MESSAGES.FILE_UPLOAD_FAILED);
      }
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
 * Uses MongoDB aggregation pipeline to avoid N+1 query problem
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of followers
 */
export const getFollowersService = async (userId) => {
  const followers = await Follower.aggregate(buildFollowersPipeline(userId));
  return followers;
};

/**
 * Get users being followed by a user
 * Uses MongoDB aggregation pipeline to avoid N+1 query problem
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of following users
 */
export const getFollowingService = async (userId) => {
  const following = await Follower.aggregate(buildFollowingPipeline(userId));
  return following;
};
