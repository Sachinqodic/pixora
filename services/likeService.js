import Like from '../models/Likes.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { ERROR_MESSAGES } from '../constants/index.js';
import { NotFoundError } from '../utils/errors.js';

export const createLikeService = async (likeData) => {
  const { user_id, post_id } = likeData;

  // Run all queries in parallel for 3x better performance
  const [user, post, existingLike] = await Promise.all([
    User.findById(user_id),
    Post.findById(post_id),
    Like.findOne({ user_id, post_id }),
  ]);

  // Check errors in priority order (user first, then post)
  if (!user) {
    throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
  }

  if (!post) {
    throw new NotFoundError(ERROR_MESSAGES.POST_NOT_FOUND);
  }

  // Handle like/unlike logic
  if (existingLike) {
    // Unlike: Remove the like
    await Like.findByIdAndDelete(existingLike._id);
    return {
      liked: false,
      action: 'unliked',
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
      like,
    };
  }
};
