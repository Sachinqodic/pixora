import express from 'express';
import userRoutes from './userRoutes.js';
import postRoutes from './postRoutes.js';
import likesRoutes from './likesRoutes.js';
import commentsRoutes from './commentsRoutes.js';
import authRoutes from './authRoutes.js';

const routes = express.Router();

routes.use('/auth/', authRoutes);
routes.use('/users', userRoutes);
routes.use('/posts', postRoutes);
routes.use('/likes', likesRoutes);
routes.use('/comments', commentsRoutes);

export default routes;
