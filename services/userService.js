
import User from '../models/User.js';
import { ERROR_MESSAGES, HTTP_STATUS ,PLAN_TYPES} from '../constants/index.js';
import { hashPassword } from '../utils/passwordUtils.js';


/**
 * Register a new user
 * 
 * @param {Object} userData - User registration data
 * @param {string} userData.name - User's full name
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - User's plain text password
 * @returns {Promise<Object>} Created user object (without password)
 * 
 * @throws {Error} If email already exists
 * @throws {Error} If user creation fails
 * 
 */
export async function registerUser(userData) {
  const { name, email, password, role = 'user' } = userData;

  // Check if user already exists (including soft deleted users)
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  
  if (existingUser) {
    // If user is active and not deleted, return conflict error
    if (existingUser.is_active && !existingUser.deleted_at) {
      const error = new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      error.statusCode = HTTP_STATUS.CONFLICT;
      throw error;
    }

    // If user exists but is inactive or soft deleted, reactivate the account
    if (!existingUser.is_active || existingUser.deleted_at) {
      const error = new Error(ERROR_MESSAGES.USER_PROFILE_DEACTIVATED);
      error.statusCode = HTTP_STATUS.FORBIDDEN;
      throw error;
    }
  }

  // Hash password
  const password_hash = await hashPassword(password);

  // Create new user
  const newUser = await User.create({
    name,
    email: email.toLowerCase(),
    password_hash,
    is_email_verified: false,
    plan_type: PLAN_TYPES.FREE,
    storage_used: 0,
    role: role,
    is_active: true,
    profile_url: null,
    deleted_at: null
  });

  // Return user without password hash
  return newUser.getPublicProfile();
}

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
    const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    error.statusCode = HTTP_STATUS.NOT_FOUND;
    throw error;
  }

  // Check if user is active
  if (!user.is_active || user.deleted_at) {
    const error = new Error(ERROR_MESSAGES.USER_PROFILE_DEACTIVATED);
    error.statusCode = HTTP_STATUS.FORBIDDEN;
    throw error;
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
      const error = new Error(ERROR_MESSAGES.FILE_UPLOAD_FAILED);
      error.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      throw error;
    }
  }

  // Save updated user
  await user.save();

  // Return user without password hash
  return user.getPublicProfile();
}


