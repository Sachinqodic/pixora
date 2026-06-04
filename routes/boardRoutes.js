import express from 'express';
import multer from 'multer';
import { ERROR_MESSAGES } from '../constants/index.js';
import { authChecker } from '../middlewares/authChecker.js';
import { upload, handleMulterError } from '../helpers/multerConfig.js';
import { validateCreateBoard, validateSavePinToBoard } from '../validations/boardValidation.js';
import { validatePagination } from '../validations/commonValidation.js';
import {
  createBoard,
  getBoards,
  getBoardById,
  getBoardPins,
  updateBoard,
  deleteBoard,
  savePinToBoard,
  removePinFromBoard,
} from '../controllers/boardController.js';

const router = express.Router();

/**
 * Create a new board (with optional cover image)
 */
router.post(
  '/create',
  authChecker,
  upload.single('coverImage'),
  handleMulterError,
  validateCreateBoard,
  createBoard
);

/**
 * Get all boards for authenticated user
 */
router.get('/list', authChecker, validatePagination, getBoards);

/**
 * Get board by ID
 */
router.get('/:id', authChecker, getBoardById);

/**
 * Get pins in a board with pagination
 */
router.get('/:id/pins', authChecker, validatePagination, getBoardPins);

/**
 * Update a board by ID
 */
router.put('/:id', authChecker, upload.single('coverImage'), handleMulterError, updateBoard);

/**
 * Save a pin to a board
 */
router.post('/save-pin', authChecker, validateSavePinToBoard, savePinToBoard);

/**
 * Remove a pin from a board
 */
router.post('/remove-pin', authChecker, validateSavePinToBoard, removePinFromBoard);

/**
 * Delete a board by ID
 */
router.delete('/:id', authChecker, deleteBoard);

export default router;
