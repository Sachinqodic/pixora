import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import { NUMERIC_CONSTANTS } from '../constants/index.js';

let cloudinaryInitialized = false;

// Folder constants (kept for backward compatibility with existing code)
export const ORIGINAL_FOLDER = 'original';
export const PROCESSED_FOLDER = 'processed';
export const AI_TEMP_FOLDER = 'temp-ai';
export const BUCKET_NAME = config.cloudinary.cloudName; // For backward compatibility

/**
 * Initialize Cloudinary client
 */
function initializeCloudinary() {
  if (!cloudinaryInitialized) {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
      secure: true, // Use HTTPS URLs
    });
    cloudinaryInitialized = true;
  }
  return cloudinary;
}

/**
 * Generate unique public_id for user profile image
 *
 * @param {string} userId - User's MongoDB ID
 * @param {string} extension - File extension (ignored by Cloudinary, kept for compatibility)
 * @returns {string} - Generated public_id
 */
export function generateProfileImageKey(userId, extension = 'jpg') {
  const timestamp = Date.now();
  return `profile-images/${userId}/${timestamp}`;
}

/**
 * Generate unique public_id for media content (Pinterest clone)
 *
 * @param {string} userId - User's MongoDB ID
 * @param {string} extension - File extension (ignored by Cloudinary, kept for compatibility)
 * @param {string} folder - Folder type ('original' or 'processed')
 */
export function generateMediaContentKey(userId, extension, folder = ORIGINAL_FOLDER) {
  const timestamp = Date.now();
  return `media-content/${folder}/${userId}/${timestamp}`;
}

/**
 * Generate unique public_id for board cover image
 *
 * @param {string} userId - User's MongoDB ID
 * @param {string} extension - File extension (ignored by Cloudinary, kept for compatibility)
 * @returns {string} - Generated public_id
 */
export function generateBoardCoverKey(userId, extension = 'jpg') {
  const timestamp = Date.now();
  return `board-cover-images/${userId}/${timestamp}`;
}

/**
 * Upload profile image to Cloudinary
 *
 * @param {Buffer} imageBuffer - Image buffer from multer
 * @param {string} userId - User's MongoDB ID
 * @param {string} mimetype - Image MIME type
 * @returns {Promise<{success: boolean, objectKey?: string, presignedUrl?: string, error?: string}>}
 */
export async function uploadProfileImage(imageBuffer, userId, mimetype) {
  try {
    if (!imageBuffer || imageBuffer.length === 0) {
      return {
        success: false,
        error: 'Image buffer is empty or invalid',
      };
    }

    // Get file extension from mimetype
    const extension = mimetype.split('/')[1] || 'jpg';

    // Generate unique public_id
    const publicId = generateProfileImageKey(userId, extension);

    // Initialize Cloudinary
    initializeCloudinary();

    // Convert buffer to base64
    const base64Image = `data:${mimetype};base64,${imageBuffer.toString('base64')}`;

    // Upload to Cloudinary (don't specify folder parameter since public_id already includes it)
    const result = await cloudinary.uploader.upload(base64Image, {
      public_id: publicId,
      resource_type: 'image',
      transformation: [
        { width: 500, height: 500, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
      context: {
        userId: userId.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate signed URL (valid for 2 minutes)
    const presignedUrl = cloudinary.url(result.public_id, {
      sign_url: true,
      type: 'upload',
      resource_type: 'image',
      expires_at: Math.floor(Date.now() / 1000) + NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS,
      secure: true,
    });

    return {
      success: true,
      objectKey: result.public_id, // Return public_id as objectKey for compatibility
      presignedUrl,
    };
  } catch (error) {
    console.error('Error uploading profile image to Cloudinary:', error);
    return {
      success: false,
      error: 'Failed to upload profile image to Cloudinary',
    };
  }
}

/**
 * Upload media to Cloudinary (for posts - images/videos)
 * Returns only the Cloudinary public_id (not the full URL for security)
 *
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} folder - Folder type ('original' or 'processed')
 * @param {string} userId - User's MongoDB ID
 * @returns {Promise<string>} - Cloudinary public_id
 */
export const uploadToS3 = async (
  fileBuffer,
  fileName,
  mimeType,
  folder = ORIGINAL_FOLDER,
  userId = null
) => {
  let publicId;

  if (userId) {
    // Get file extension from filename or mimetype
    const extension = fileName.split('.').pop() || mimeType.split('/')[1] || 'jpg';
    // Use generateMediaContentKey for proper folder structure
    publicId = generateMediaContentKey(userId, extension, folder);
  } else {
    // Fallback for backward compatibility
    publicId = `media-content/${folder}/${Date.now()}-${fileName.replace(/\.[^/.]+$/, '')}`;
  }

  initializeCloudinary();

  // Convert buffer to base64
  const base64File = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

  // Determine resource type
  const resourceType = mimeType.startsWith('video/') ? 'video' : 'image';

  // Upload to Cloudinary (don't specify folder parameter since public_id already includes it)
  const result = await cloudinary.uploader.upload(base64File, {
    public_id: publicId,
    resource_type: resourceType,
  });

  // Return only the public_id (not the full URL for security)
  return result.public_id;
};

/**
 * Get optimized key from original key
 *
 * @param {string} originalKey - Original Cloudinary public_id
 * @returns {string} - Optimized Cloudinary public_id
 */
export const getOptimizedKey = (originalKey) => {
  if (!originalKey) return null;

  // Replace 'original' folder with 'processed' folder
  return originalKey.replace(
    `media-content/${ORIGINAL_FOLDER}/`,
    `media-content/${PROCESSED_FOLDER}/`
  );
};

/**
 * Delete object from Cloudinary
 *
 * @param {string} key - Cloudinary public_id to delete
 * @param {string} resourceType - Optional resource type ('image' or 'video')
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export const deleteFromS3 = async (key, resourceType = null) => {
  try {
    if (!key) {
      console.warn('Cannot delete: key is null or undefined');
      return false;
    }

    initializeCloudinary();

    // If resource type not provided, try to determine it or try both
    if (!resourceType) {
      // Try image first
      try {
        const result = await cloudinary.uploader.destroy(key, {
          resource_type: 'image',
        });

        if (result.result === 'ok') {
          console.log(`Successfully deleted image from Cloudinary: ${key}`);
          return true;
        }
      } catch (imageError) {
        // Image deletion failed, try video
      }

      // Try video
      try {
        const result = await cloudinary.uploader.destroy(key, {
          resource_type: 'video',
        });

        if (result.result === 'ok' || result.result === 'not found') {
          console.log(`Successfully deleted video from Cloudinary: ${key}`);
          return true;
        }
      } catch (videoError) {
        console.warn(`Failed to delete from Cloudinary (tried both image and video): ${key}`);
        return false;
      }

      return false;
    }

    // Resource type provided
    const result = await cloudinary.uploader.destroy(key, {
      resource_type: resourceType,
    });

    if (result.result === 'ok' || result.result === 'not found') {
      console.log(`Successfully deleted object from Cloudinary: ${key}`);
      return true;
    }

    console.warn(`Failed to delete object from Cloudinary: ${key}`, result);
    return false;
  } catch (error) {
    console.error('Error deleting object from Cloudinary:', error);
    return false;
  }
};

/**
 * Generate signed URL for existing Cloudinary object
 *
 * @param {string} objectKey - Cloudinary public_id
 * @param {number} expiresIn - Expiration time in seconds (default: 120 seconds = 2 minutes)
 * @returns {Promise<string>} - Signed URL
 */
export async function generatePresignedUrl(
  objectKey,
  expiresIn = NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
) {
  try {
    if (!objectKey) {
      throw new Error('Object key is required');
    }

    initializeCloudinary();

    // First, check if the resource exists and get its resource_type
    let resourceType = 'image';

    try {
      // Try as image first
      await cloudinary.api.resource(objectKey, { resource_type: 'image' });
      resourceType = 'image';
    } catch (imageError) {
      // If not found as image, try as video
      try {
        await cloudinary.api.resource(objectKey, { resource_type: 'video' });
        resourceType = 'video';
      } catch (videoError) {
        // If still not found, default to image and let it fail with proper error
        console.warn(`Resource not found in Cloudinary: ${objectKey}`);
        resourceType = 'image';
      }
    }

    // Generate signed URL with expiration
    const signedUrl = cloudinary.url(objectKey, {
      sign_url: true,
      type: 'upload',
      resource_type: resourceType,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      secure: true,
    });

    return signedUrl;
  } catch (error) {
    throw new Error('Failed to generate Cloudinary signed URL: ' + error.message);
  }
}

/**
 * Upload a buffer to Cloudinary and return a signed URL immediately.
 * Useful for providing temporary access to AI models like Gemini Vision.
 *
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Signed URL
 */
export const uploadToS3AndGetPresignedUrl = async (buffer, mimeType, userId) => {
  const extension = mimeType.split('/')[1] || 'jpg';
  const publicId = `media-content/${AI_TEMP_FOLDER}/${userId}/${Date.now()}`;

  initializeCloudinary();

  // Convert buffer to base64
  const base64File = `data:${mimeType};base64,${buffer.toString('base64')}`;

  // Upload (don't specify folder parameter since public_id already includes it)
  const result = await cloudinary.uploader.upload(base64File, {
    public_id: publicId,
    resource_type: 'image',
  });

  // Generate Signed URL (valid for 10 minutes for AI processing)
  const signedUrl = cloudinary.url(result.public_id, {
    sign_url: true,
    type: 'upload',
    resource_type: 'image',
    expires_at: Math.floor(Date.now() / 1000) + 600,
    secure: true,
  });

  return signedUrl;
};

/**
 * Upload board cover image to Cloudinary
 *
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} userId - User's MongoDB ID
 * @returns {Promise<string>} - Cloudinary public_id
 */
export async function uploadBoardCoverImage(fileBuffer, fileName, mimeType, userId) {
  const extension = fileName.split('.').pop() || mimeType.split('/')[1] || 'jpg';
  const publicId = generateBoardCoverKey(userId, extension);

  initializeCloudinary();

  // Convert buffer to base64
  const base64Image = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

  // Upload to Cloudinary (don't specify folder parameter since public_id already includes it)
  const result = await cloudinary.uploader.upload(base64Image, {
    public_id: publicId,
    resource_type: 'image',
    transformation: [
      { width: 800, height: 400, crop: 'fill' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
    context: {
      userId: userId.toString(),
      uploadedAt: new Date().toISOString(),
    },
  });

  return result.public_id;
}

// Export cloudinary instance for direct use if needed
export { cloudinary };
