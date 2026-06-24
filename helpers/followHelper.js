import Follower from '../models/Follower.js';
import mongoose from 'mongoose';

/**
 * Add isFollowingAuthor flag to posts
 * Checks if the current user follows the author of each post
 * Uses a single batch query + Set lookup � O(n) total, not O(n) queries
 * @param {Array} posts - Array of posts (user_id must be populated with _id)
 * @param {string|null} currentUserId - Current user ID
 * @returns {Promise<Array>} - Posts with isFollowingAuthor flag
 */
export const addIsFollowingAuthorFlag = async (posts, currentUserId) => {
  if (!currentUserId || posts.length === 0) {
    return posts.map((post) => ({ ...post, isFollowingAuthor: false }));
  }

  // Collect unique author IDs (excluding the current user � can't follow yourself)
  const authorIds = [
    ...new Set(
      posts
        .map((post) => post.user_id?._id?.toString())
        .filter((id) => id && id !== currentUserId.toString())
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  if (authorIds.length === 0) {
    return posts.map((post) => ({ ...post, isFollowingAuthor: false }));
  }

  // Single query: fetch all authors that currentUser follows among this page of posts
  const followingEntries = await Follower.find({
    follower_id: new mongoose.Types.ObjectId(currentUserId),
    following_id: { $in: authorIds },
  }).select('following_id');

  // O(1) lookup set
  const followingSet = new Set(followingEntries.map((f) => f.following_id.toString()));

  return posts.map((post) => ({
    ...post,
    isFollowingAuthor:
      post.user_id?._id?.toString() !== currentUserId.toString() &&
      followingSet.has(post.user_id?._id?.toString()),
  }));
};
