import { BaseController } from './baseController.js';
import Follower from '../models/Follower.js';
import {
  getAllUsersService,
  addUserInterestService,
  updateUserProfile,
  followUserService,
  unfollowUserService,
  getFollowersService,
  getFollowingService,
} from '../services/userService.js';
import { HTTP_STATUS, MESSAGES } from '../constants/index.js';

// Create an instance of BaseController to handle common controller logic
const baseController = new BaseController();

/**
 * Get current user profile
 * @route GET /api/users/profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        },
      });
    }

    const publicProfile = user.getPublicProfile();

    // Fetch followers and following counts
    const [followersCount, followingCount, following] = await Promise.all([
      Follower.countDocuments({ following_id: user._id }),
      Follower.countDocuments({ follower_id: user._id }),
      Follower.find({ follower_id: user._id }).select('following_id'),
    ]);

    publicProfile.followers_count = followersCount;
    publicProfile.following_count = followingCount;
    publicProfile.following_ids = following.map((f) => f.following_id);

    // Generate presigned URL for the profile image if it exists
    if (publicProfile.profile_url) {
      const { generatePresignedUrl } = await import('../services/s3Service.js');
      const presignedUrl = await generatePresignedUrl(publicProfile.profile_url, 7200); // 2 hours
      publicProfile.profile_url = presignedUrl;
    }

    return baseController.sendSuccess(
      res,
      { user: publicProfile },
      MESSAGES.POST_FETCHED, // Reusing existing constant or just use string
      HTTP_STATUS.OK
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/users/me/update/:id
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, bio } = req.body;
    const profileImage = req.file;

    // Update user profile
    const updatedUser = await updateUserProfile(id, { name, bio, profileImage });

    // Generate presigned URL for the profile image if it exists
    if (updatedUser.profile_url) {
      const { generatePresignedUrl } = await import('../services/s3Service.js');
      const presignedUrl = await generatePresignedUrl(updatedUser.profile_url, 7200); // 2 hours
      updatedUser.profile_url = presignedUrl;
    }
    // Return success response
    return baseController.sendSuccess(
      res,
      { user: updatedUser },
      MESSAGES.USER_UPDATED,
      HTTP_STATUS.OK
    );
  } catch (error) {
    // Pass errors to error handler
    next(error);
  }
};

/**
 * Get all users
 * @route GET /api/users
 */
export const getAllUsers = baseController.handleRequest(async (req, res) => {
  const { users, pagination } = await getAllUsersService(req.query);
  return baseController.sendSuccess(
    res,
    { users, pagination },
    MESSAGES.USERS_FETCHED,
    HTTP_STATUS.OK
  );
});

/**
 * Add user interest
 * @route POST /api/users/add-user-interest
 */
export const addUserInterest = baseController.handleRequest(async (req, res) => {
  const { userId, interests } = req.body;
  const result = await addUserInterestService(userId, interests);
  return baseController.sendSuccess(res, result, MESSAGES.INTEREST_ADDED, HTTP_STATUS.OK);
});

/**
 * Follow a user
 * @route POST /api/users/:id/follow
 */
export const followUser = async (req, res, next) => {
  try {
    const followerId = req.user._id;
    const { id: followingId } = req.params;
    const follow = await followUserService(followerId, followingId);
    return baseController.sendSuccess(res, follow, 'Successfully followed user', HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Unfollow a user
 * @route DELETE /api/users/:id/unfollow
 */
export const unfollowUser = async (req, res, next) => {
  try {
    const followerId = req.user._id;
    const { id: followingId } = req.params;
    const result = await unfollowUserService(followerId, followingId);
    return baseController.sendSuccess(res, result, 'Successfully unfollowed user', HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Get followers of a user
 * @route GET /api/users/:id/followers
 */
export const getFollowers = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const followers = await getFollowersService(userId);
    return baseController.sendSuccess(
      res,
      followers,
      'Followers fetched successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get following users
 * @route GET /api/users/:id/following
 */
export const getFollowing = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const following = await getFollowingService(userId);
    return baseController.sendSuccess(
      res,
      following,
      'Following users fetched successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get any user's public profile
 * @route GET /api/v1/users/:id/profile
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { getUserByIdService } = await import('../services/userService.js');

    const publicProfile = await getUserByIdService(id);

    return baseController.sendSuccess(
      res,
      { user: publicProfile },
      'User profile fetched',
      HTTP_STATUS.OK
    );
  } catch (error) {
    next(error);
  }
};
