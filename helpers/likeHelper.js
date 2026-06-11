import Like from '../models/Likes.js';
import mongoose from 'mongoose';

/**
 * Add isLikedByCurrentUser flag to posts
 * Checks if the current user has liked each post
 * @param {Array} posts - Array of posts
 * @param {string|null} currentUserId - Current user ID
 * @returns {Promise<Array>} - Posts with isLikedByCurrentUser flag
 */
export const addLikedByUserFlag = async (posts, currentUserId) => {
  if (!currentUserId || posts.length === 0) {
    // If no user logged in or no posts, return posts with isLikedByCurrentUser = false
    return posts.map((post) => ({ ...post, isLikedByCurrentUser: false }));
  }

  // Get all post IDs
  const postIds = posts.map((post) => post._id);

  // Find all likes by current user for these posts (single query)
  const userLikes = await Like.find({
    user_id: new mongoose.Types.ObjectId(currentUserId),
    post_id: { $in: postIds },
  }).select('post_id');

  // Create a Set of liked post IDs for O(1) lookup
  const likedPostIds = new Set(userLikes.map((like) => like.post_id.toString()));

  // Add isLikedByCurrentUser flag to each post
  return posts.map((post) => ({
    ...post,
    isLikedByCurrentUser: likedPostIds.has(post._id.toString()),
  }));
};
