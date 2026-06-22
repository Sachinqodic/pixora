import express from 'express';
import multer from 'multer';
import { ERROR_MESSAGES } from '../constants/index.js';
import { quotaGuard } from '../middlewares/quotaGuard.js';
import { authChecker } from '../middlewares/authChecker.js';
import { handleMulterError } from '../helpers/multerConfig.js';
import {
  createPost,
  getPost,
  deletePost,
  suggestPostMetadata,
  getAiSuggestionStatus,
  getAllPosts,
  getFollowingPosts,
  getUserPosts,
  updatePostMetadata,
} from '../controllers/postController.js';
import {
  validateCreatePost,
  validateFileUpload,
  validatePostId,
  validateSearchQuery,
  validateEditPost,
} from '../validations/postValidation.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
    ];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mpeg', '.mov'];

    // Get file extension
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    // Validate MIME type and extension
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(ERROR_MESSAGES.POST_FILE_INVALID_TYPE));
    }
  },
});

/**
 * Get all posts with search functionality
 */
router.get('/', authChecker, validateSearchQuery, getAllPosts);

/**
 * Create a new post with image/video upload
 */
router.post(
  '/create',
  authChecker,
  upload.single('postMedia'),
  quotaGuard,
  handleMulterError,
  validateFileUpload,
  validateCreatePost,
  createPost
);

/**
 * Suggest metadata using AI
 */
router.post(
  '/suggest-metadata',
  authChecker,
  upload.single('postMedia'),
  handleMulterError,
  suggestPostMetadata
);

/**
 * Check AI suggestion status (Polling)
 */
router.get('/suggestions/:id', authChecker, getAiSuggestionStatus);

/**
 * Get posts from followed users
 */
router.get('/following', authChecker, getFollowingPosts);

/**
 * Get posts created by a specific user
 */
router.get('/user/:id', authChecker, getUserPosts);

/*
 * Get the Pin by id
 */
router.get('/:id', authChecker, validatePostId, getPost);

/*
 * Update post title and description
 */
router.patch('/:id', authChecker, validatePostId, validateEditPost, updatePostMetadata);

/*
 * Delete the Pin by id
 */
router.delete('/:id', authChecker, validatePostId, deletePost);
export default router;
