import { verifyToken } from '../utils/jwtUtils.js';
import { ERROR_MESSAGES, STRING_CONSTANTS, HTTP_STATUS } from '../constants/index.js';
import User from '../models/User.js';

export const authChecker = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error(ERROR_MESSAGES.UNAUTHORIZED_ACCESS);
        }
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        const user = await User.findOne({ _id: decoded.userId });
        if (!user || user?.role !== STRING_CONSTANTS.USER_ROLE_ADMIN || user?.deleted_at !== null) {
            const error = new Error(ERROR_MESSAGES.UNAUTHORIZED_ACCESS);
            error.statusCode = HTTP_STATUS.UNAUTHORIZED;
            throw error;
        }
        next();
    } catch (error) {
        return res.status(error?.statusCode || HTTP_STATUS.UNAUTHORIZED).json({ status: false, message: error?.message || ERROR_MESSAGES.INVALID_TOKEN });
    }
};