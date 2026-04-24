import express from 'express';
import multer from 'multer';
import { ERROR_MESSAGES } from '../constants/index.js';
import { quotaGuard } from '../middlewares/quotaGuard.js';
import { authChecker } from '../middlewares/authChecker.js'
import { handleMulterError } from '../helpers/multerConfig.js';
import { createPost, getPost, deletePost} from '../controllers/postController.js';
import { validateCreatePost, validateFileUpload, validatePostId } from '../validations/postValidation.js';


const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
    ];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".mp4", ".mpeg", ".mov"];

    // Get file extension
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    // Validate MIME type and extension
    if (
      allowedMimeTypes.includes(file.mimetype) &&
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          ERROR_MESSAGES.POST_FILE_INVALID_TYPE
        )
      );
    }
  },
});

/**
 * Create a new post with image/video upload
 */
router.post(
  '/create',
  authChecker,
  upload.single('postMedia'),
  quotaGuard ,
  handleMulterError,
  validateFileUpload, 
  validateCreatePost,
  createPost
);

/*
* Get the Pin by id 
*/
router.get(
  '/:id',
  validatePostId,
  getPost
);

/*
* Delete the Pin by id
*/
router.delete(
  '/:id',
  validatePostId,
  deletePost
)
export default router;