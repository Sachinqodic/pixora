import { baseController } from './baseController.js';
import {
  createBoardService,
  deleteBoardService,
  getBoardsService,
  updateBoardService,
  savePinToBoardService,
} from '../services/boardService.js';
import {
  HTTP_STATUS,
  MESSAGES,
  ERROR_CODES,
  ERROR_MESSAGES,
  NUMERIC_CONSTANTS,
} from '../constants/index.js';

/**
 * Create a new board
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
export const createBoard = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const user_id = req.user._id;
    const file = req.file; // Optional cover image

    const board = await createBoardService({ name, description, user_id }, file);

    return baseController.sendSuccess(res, board, MESSAGES.BOARD_CREATED, HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all boards for the authenticated user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
export const getBoards = async (req, res, next) => {
  try {
    const user_id = req.user._id;
    const page = parseInt(req.query.page) || NUMERIC_CONSTANTS.PAGINATION_DEFAULT_PAGE;
    const limit = parseInt(req.query.limit) || NUMERIC_CONSTANTS.PAGINATION_DEFAULT_LIMIT;

    const result = await getBoardsService(user_id, page, limit);

    return baseController.sendSuccess(res, result, MESSAGES.BOARDS_FETCHED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a board
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
export const deleteBoard = async (req, res, next) => {
  try {
    const { id } = req.params;

    await deleteBoardService(id);

    return baseController.sendSuccess(res, null, MESSAGES.BOARD_DELETED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a board
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
export const updateBoard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const file = req.file; // Optional new cover image

    const board = await updateBoardService(id, { name, description }, file);

    return baseController.sendSuccess(res, board, MESSAGES.BOARD_UPDATED, HTTP_STATUS.OK);
  } catch (error) {
    next(error);
  }
};

/**
 * Save a pin to a board
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
export const savePinToBoard = async (req, res, next) => {
  try {
    const user_id = req.user._id;
    const { board_id, post_id } = req.body;

    const boardPost = await savePinToBoardService(user_id, board_id, post_id);

    return baseController.sendSuccess(
      res,
      boardPost,
      MESSAGES.PIN_SAVED_TO_BOARD,
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    next(error);
  }
};
