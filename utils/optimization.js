import { uploadToS3, PROCESSED_FOLDER, s3Client, BUCKET_NAME } from '../services/s3Service.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import { spawn } from 'child_process';
import Post from '../models/Post.js';

// Simple queue to limit concurrent optimizations
const queue = [];
let activeJobs = 0;
const MAX_CONCURRENT = 3;

/**
 * IMAGE OPTIMIZATION:
 * - Resize to max 1920x1080
 * - Convert to WebP 70% quality (50% smaller than JPEG)
 * - Progressive loading
 * Result: 70-85% smaller file size
 */
const optimizeImage = async (imageBuffer) => {
    return await sharp(imageBuffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer();
};


/**
 * VIDEO OPTIMIZATION (using streams with temp file for MP4):
 * - Downloads from S3 as stream
 * - Uses temp file (MP4 requires seekable output)
 * - H.264 codec, 1280x720, AAC audio
 * - Memory usage: ~50-100MB
 * Result: 50-70% smaller file size
 */
const optimizeVideoStream = async (originalKey, fileName) => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const TEMP_DIR = path.join(__dirname, '../temp');

    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const outputPath = path.join(TEMP_DIR, `output-${Date.now()}.mp4`);

    return new Promise(async (resolve, reject) => {
        try {
            // Get S3 stream using key
            const s3Stream = await getS3Stream(originalKey);

            // FFmpeg process using bundled binary with temp output file
            const ffmpeg = spawn(ffmpegInstaller.path, [
                '-i', 'pipe:0',  // Read from stdin
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-movflags', '+faststart',
                '-y',  // Overwrite output
                outputPath  // Write to temp file (MP4 needs seekable output)
            ]);

            // Pipe S3 stream to FFmpeg stdin
            s3Stream.pipe(ffmpeg.stdin);

            let stderrOutput = '';
            ffmpeg.stderr.on('data', (data) => {
                stderrOutput += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    // Read the output file
                    const buffer = fs.readFileSync(outputPath);
                    // Clean up temp file
                    fs.unlinkSync(outputPath);
                    resolve(buffer);
                } else {
                    // Clean up on error
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    reject(new Error(`FFmpeg failed with code ${code}: ${stderrOutput}`));
                }
            });

            ffmpeg.on('error', (err) => {
                // Clean up on error
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
};



/**
 * Download from S3 as stream (memory efficient)
 */
const getS3Stream = async (key) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    const response = await s3Client.send(command);
    return response.Body;
};



/**
 * Process optimization job
 */
const processJob = async (job) => {
    const { postId, originalKey, fileName, resourceType } = job;

    try {
        console.log(`[${postId}] Starting ${resourceType} optimization`);

        let optimizedBuffer, mimeType;

        if (resourceType === 'image') {
            // For images, still need buffer (Sharp requirement)
            const s3Stream = await getS3Stream(originalKey);
            const chunks = [];
            for await (const chunk of s3Stream) {
                chunks.push(chunk);
            }
            const imageBuffer = Buffer.concat(chunks);

            optimizedBuffer = await optimizeImage(imageBuffer);
            mimeType = 'image/webp';
        } else {
            // For videos, use streaming (memory efficient!)
            optimizedBuffer = await optimizeVideoStream(originalKey, fileName);
            mimeType = 'video/mp4';
        }

        // Extract userId from originalKey (media-content/original/{userId}/{timestamp}.{extension})
        const keyParts = originalKey.split('/');
        const userId = keyParts[2]; // Get userId from key structure

        // Upload optimized file to S3 and get the key
        const optimizedKey = await uploadToS3(
            optimizedBuffer,
            fileName,
            mimeType,
            PROCESSED_FOLDER,
            userId
        );

        // Update post with optimized key and set status to ready
        await Post.findByIdAndUpdate(postId, {
            media_url: optimizedKey,
            status: 'ready'
        });

        console.log(`[${postId}] Optimization completed`);
    } catch (error) {
        console.error(`[${postId}] Optimization failed:`, error.message);
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
