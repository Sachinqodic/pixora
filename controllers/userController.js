import { BaseController } from './baseController.js';
import {
  getAllUsersService,
  addUserInterestService,
  updateUserProfile,
} from '../services/userService.js';
import { HTTP_STATUS, MESSAGES } from '../constants/index.js';

// Create an instance of BaseController to handle common controller logic
const baseController = new BaseController();
/**
 * Update user profile
 * @route PUT /api/users/me/update/:id
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const profileImage = req.file;

    // Update user profile
    const updatedUser = await updateUserProfile(id, { name, profileImage });

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
