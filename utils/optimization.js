import { cloudinary, uploadToS3, PROCESSED_FOLDER } from '../services/s3Service.js';
import Post from '../models/Post.js';
import sharp from 'sharp';

// Simple queue to limit concurrent optimizations
const queue = [];
let activeJobs = 0;
const MAX_CONCURRENT = 3;

/**
 * Optimize image using Sharp and upload to Cloudinary as processed version
 */
const optimizeImage = async (originalPublicId, processedPublicId) => {
  try {
    // Download original from Cloudinary
    const originalUrl = cloudinary.url(originalPublicId, {
      resource_type: 'image',
      secure: true,
    });

    const response = await fetch(originalUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optimize with Sharp
    const optimizedBuffer = await sharp(buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    // Upload optimized version to Cloudinary with processed path
    const base64Image = `data:image/webp;base64,${optimizedBuffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      public_id: processedPublicId,
      resource_type: 'image',
    });

    return result.public_id;
  } catch (error) {
    console.error('Image optimization failed:', error);
    throw error;
  }
};

/**
 * Optimize video using Cloudinary's video transformation API
 */
const optimizeVideo = async (originalPublicId, processedPublicId) => {
  try {
    // Use Cloudinary's upload API to create an optimized copy
    // We'll download, then re-upload with transformations applied
    const originalUrl = cloudinary.url(originalPublicId, {
      resource_type: 'video',
      secure: true,
    });

    // Upload from URL with transformations to create processed version
    const result = await cloudinary.uploader.upload(originalUrl, {
      public_id: processedPublicId,
      resource_type: 'video',
      transformation: [
        {
          width: 1280,
          height: 720,
          crop: 'limit',
          quality: 'auto:good',
          video_codec: 'h264',
          audio_codec: 'aac',
        },
      ],
    });

    return result.public_id;
  } catch (error) {
    console.error('Video optimization failed:', error);
    throw error;
  }
};

/**
 * Process optimization job
 */
const processJob = async (job) => {
  const { postId, originalKey, resourceType } = job;

  try {
    console.log(`[${postId}] Starting ${resourceType} optimization`);

    // Generate processed public_id
    const processedKey = originalKey.replace('/original/', '/processed/');

    let optimizedPublicId;

    if (resourceType === 'image') {
      optimizedPublicId = await optimizeImage(originalKey, processedKey);
    } else {
      optimizedPublicId = await optimizeVideo(originalKey, processedKey);
    }

    // Update post with optimized key and set status to ready
    await Post.findByIdAndUpdate(postId, {
      media_url: optimizedPublicId,
      status: 'ready',
    });

    console.log(`[${postId}] Optimization completed`);
  } catch (error) {
    console.error(`[${postId}] Optimization failed:`, error.message);

    // Fallback: use original if optimization fails
    await Post.findByIdAndUpdate(postId, {
      media_url: originalKey,
      status: 'ready',
    });
  } finally {
    activeJobs--;
    processQueue();
  }
};

/**
 * Process queue with concurrency control
 */
const processQueue = () => {
  while (activeJobs < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    activeJobs++;
    processJob(job);
  }
};

/**
 * Add job to queue
 */
export const optimizeMedia = (jobData) => {
  queue.push(jobData);
  processQueue();
};
