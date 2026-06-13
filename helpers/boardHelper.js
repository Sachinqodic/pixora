import BoardPost from '../models/BoardPost.js';
import mongoose from 'mongoose';

/**
 * Add isAddedToBoardsByCurrentUser flag to posts
 * Checks if the current user has saved each post to any of their boards
 * @param {Array} posts - Array of posts
 * @param {string|null} currentUserId - Current user ID
 * @returns {Promise<Array>} - Posts with isAddedToBoardsByCurrentUser flag
 */
export const addSavedToBoardFlag = async (posts, currentUserId) => {
  if (!currentUserId || posts.length === 0) {
    // If no user logged in or no posts, return posts with isAddedToBoardsByCurrentUser = false
    return posts.map((post) => ({ ...post, isAddedToBoardsByCurrentUser: false }));
  }

  // Get all post IDs
  const postIds = posts.map((post) => post._id);

  // Find all board posts by current user for these posts (single query)
  const userBoardPosts = await BoardPost.find({
    user_id: new mongoose.Types.ObjectId(currentUserId),
    post_id: { $in: postIds },
  }).select('post_id');

  // Create a Set of saved post IDs for O(1) lookup
  const savedPostIds = new Set(userBoardPosts.map((bp) => bp.post_id.toString()));

  // Add isAddedToBoardsByCurrentUser flag to each post
  return posts.map((post) => ({
    ...post,
    isAddedToBoardsByCurrentUser: savedPostIds.has(post._id.toString()),
  }));
};
