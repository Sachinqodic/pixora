import { S3Client, PutObjectCommand, GetObjectCommand ,DeleteObjectCommand} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { NUMERIC_CONSTANTS } from '../constants/index.js';

let s3Client = null;

// S3 folder constants
export const ORIGINAL_FOLDER = 'original';
export const PROCESSED_FOLDER = 'processed';
export const BUCKET_NAME = config.aws.s3.bucketName;

/**
 * Initialize S3 client
 */
function initializeS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.aws.s3.region,
      credentials: {
        accessKeyId: config.aws.s3.accessKeyId,
        secretAccessKey: config.aws.s3.secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Generate unique object key for user profile image
 * 
 * @param {string} userId - User's MongoDB ID
 * @param {string} extension - File extension
 * @returns {string} - Generated object key
 */
export function generateProfileImageKey(userId, extension = 'jpg') {
  const timestamp = Date.now();
  return `profile-images/${userId}/${timestamp}.${extension}`;
}

/**
 * Generate unique object key for media content (Pinterest clone)
 * 
 * @param {string} userId - User's MongoDB ID
 * @param {string} extension - File extension
 * @param {string} folder - Folder type ('original' or 'processed')
 */
export function generateMediaContentKey(userId, extension, folder = ORIGINAL_FOLDER) {
  const timestamp = Date.now();
  return `media-content/${folder}/${userId}/${timestamp}.${extension}`;
}

/**
 * Upload profile image to S3
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
    
    // Generate unique object key
    const objectKey = generateProfileImageKey(userId, extension);

    // Initialize S3 client
    const client = initializeS3Client();

    // Upload to S3
    const uploadParams = {
      Bucket: config.aws.s3.bucketName,
      Key: objectKey,
      Body: imageBuffer,
      ContentType: mimetype,
      Metadata: {
        userId: userId.toString(),
        uploadedAt: new Date().toISOString(),
      },
    };

    const command = new PutObjectCommand(uploadParams);
    await client.send(command);

    // Generate presigned URL for GET (viewing) - valid for 2 minutes
    const presignedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.aws.s3.bucketName,
        Key: objectKey,
      }),
      { expiresIn: NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS }
    );

    return {
      success: true,
      objectKey,
      presignedUrl,
    };
  } catch (error) {
    console.error('Error uploading profile image to S3:', error);
    return {
      success: false,
      error: 'Failed to upload profile image to S3',
    };
  }
}

/**
 * Upload media to S3 (for posts - images/videos)
 * Returns only the S3 object key (not the full URL for security)
 * 
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} folder - Folder type ('original' or 'processed')
 * @param {string} userId - User's MongoDB ID
 * @returns {Promise<string>} - S3 object key
 */
export const uploadToS3 = async (fileBuffer, fileName, mimeType, folder = ORIGINAL_FOLDER, userId = null) => {
  let key;
  
  if (userId) {
    // Get file extension from filename or mimetype
    const extension = fileName.split('.').pop() || mimeType.split('/')[1] || 'jpg';
    // Use generateMediaContentKey for proper folder structure
    key = generateMediaContentKey(userId, extension, folder);
  } else {
    // Fallback for backward compatibility
    key = `media-content/${folder}/${Date.now()}-${fileName}`;
  }

  const client = initializeS3Client();

  const command = new PutObjectCommand({
    Bucket: config.aws.s3.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await client.send(command);

  // Return only the S3 key (not the full URL for security)
  return key;
};

/**
 * Get optimized key from original key
 * 
 * @param {string} originalKey - Original S3 key
 * @returns {string} - Optimized S3 key
 */
export const getOptimizedKey = (originalKey) => {
  if (!originalKey) return null;

  // Replace 'original' folder with 'processed' folder
  return originalKey.replace(`media-content/${ORIGINAL_FOLDER}/`, `media-content/${PROCESSED_FOLDER}/`);
};


/**
 * Delete object from S3
 * 
 * @param {string} key - S3 object key to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export const deleteFromS3 = async (key) => {
  try {

    const client = initializeS3Client();

    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3.bucketName,
      Key: key,
    });

    await client.send(command);

    console.log(`Successfully deleted object from S3: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting object from S3:', error);
    return false;
  }
};

/**
 * Generate presigned URL for existing S3 object
 * 
 * @param {string} objectKey - S3 object key
 * @param {number} expiresIn - Expiration time in seconds (default: 120 seconds = 2 minutes)
 * @returns {Promise<string>} - Presigned URL
 */
export async function generatePresignedUrl(objectKey, expiresIn = NUMERIC_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS) {
  try {
    const client = initializeS3Client();
    
    const command = new GetObjectCommand({
      Bucket: config.aws.s3.bucketName,
      Key: objectKey,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.S3_GENERATE_PRESIGNED_URL_FAILED);
  }
}

// Export s3Client for direct use in optimization
export { s3Client };
