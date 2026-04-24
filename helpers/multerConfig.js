import multer from 'multer';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  NUMERIC_CONSTANTS,
  FILE_UPLOAD,
  ERROR_CODES,
} from '../constants/index.js';

// Multer configuration for image uploading
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: NUMERIC_CONSTANTS.MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    // Get file extension
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    // Validate MIME type and extension
    if (
      FILE_UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype) &&
      FILE_UPLOAD.ALLOWED_FORMATS.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      cb(new Error(ERROR_MESSAGES.FILE_INVALID_TYPE));
    }
  },
});

export const handleMulterError = (error, req, res, next) => {
  console.log('Iam in the Handle Multer Error');
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.FILE_TOO_LARGE,
          code: ERROR_CODES.FILE_SIZE_LIMIT_EXCEEDED,
          statusCode: HTTP_STATUS.BAD_REQUEST,
        },
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.UNEXPECTED_FILE_FIELD,
          code: ERROR_CODES.UNEXPECTED_FILE_FIELD,
          statusCode: HTTP_STATUS.BAD_REQUEST,
        },
      });
    }
  }

  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        message: error.message,
        code: ERROR_CODES.INVALID_FILE_TYPE,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      },
    });
  }

  next(error);
};
