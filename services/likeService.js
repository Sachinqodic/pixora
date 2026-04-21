import Like from '../models/Likes.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { uploadToS3, ORIGINAL_FOLDER, getOptimizedKey, deleteFromS3 } from './s3Service.js';
import { NUMERIC_CONSTANTS, ERROR_MESSAGES } from '../constants/index.js';
import { NotFoundError } from '../utils/errors.js';


export const createLikeService = async (likeData) => {
  const { user_id, post_id } = likeData;

  // Find user by ID
  const user = await User.findById(user_id);

  if (!user) {
    throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  }

  // Find post By Id 
  const post = await Post.findById(post_id);

  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }


  // Check if like already exists
  const existingLike = await Like.findOne({
    user_id,
    post_id
  });

  if (existingLike) {
    // Unlike: Remove the like
    await Like.findByIdAndDelete(existingLike._id);
    return {
      liked: false,
      action: 'unliked'
    };
  } else {
    // Like: Create new like
    const like = await Like.create({
      user_id,
      post_id,
    });
    return {
      liked: true,
      action: 'liked',
      like
    };
  }
};
