import { redisClient } from '../middlewares/rateLimiter.js';
import UserInterest from '../models/UserInterest.js';
import Follower from '../models/Follower.js';
import mongoose from 'mongoose';

/**
 * Cache TTL Constants (in seconds)
 */
const CACHE_TTL = {
  USER_INTERESTS: 3600, // 1 hour
  USER_FOLLOWING: 300, // 5 minutes
};

/**
 * Cache key prefixes
 */
const CACHE_KEYS = {
  USER_INTERESTS: 'feed:interests:',
  USER_FOLLOWING: 'feed:following:',
};

/**
 * Get user interests from cache or database
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of interest categories
 */
export async function getUserInterestsFromCache(userId) {
  try {
    const cacheKey = `${CACHE_KEYS.USER_INTERESTS}${userId}`;

    // Try cache first
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Cache miss - fetch from database
    const userInterestDoc = await UserInterest.findOne({ user_id: userId })
      .select('interest')
      .lean();

    // Interest is an array field in the document
    const interests = userInterestDoc?.interest || [];

    // Cache for future requests
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(cacheKey, CACHE_TTL.USER_INTERESTS, JSON.stringify(interests));
    }

    return interests;
  } catch (error) {
    console.error(`Failed to get user interests from cache: ${error.message}`);
    // Fallback to empty array on error
    return [];
  }
}

/**
 * Get user following list from cache or database
 * @param {string} userId - User ID
 * @returns {Promise<mongoose.Types.ObjectId[]>} Array of following user IDs
 */
export async function getFollowingIdsFromCache(userId) {
  try {
    const cacheKey = `${CACHE_KEYS.USER_FOLLOWING}${userId}`;

    // Try cache first
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        // Parse and convert back to ObjectId
        const ids = JSON.parse(cached);
        return ids.map((id) => new mongoose.Types.ObjectId(id));
      }
    }

    // Cache miss - fetch from database
    const following = await Follower.find({ follower_id: userId }).select('following_id').lean();

    const followingIds = following.map((f) => f.following_id);

    // Cache for future requests (convert ObjectId to string for JSON)
    if (redisClient && redisClient.isOpen) {
      const idsAsStrings = followingIds.map((id) => id.toString());
      await redisClient.setEx(cacheKey, CACHE_TTL.USER_FOLLOWING, JSON.stringify(idsAsStrings));
    }

    return followingIds;
  } catch (error) {
    console.error(`Failed to get following list from cache: ${error.message}`);
    // Fallback to empty array on error
    return [];
  }
}

/**
 * Invalidate user interests cache
 * Call this when user adds/removes interests
 * @param {string} userId - User ID
 */
export async function invalidateUserInterestsCache(userId) {
  try {
    const cacheKey = `${CACHE_KEYS.USER_INTERESTS}${userId}`;
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(cacheKey);
    }
  } catch (error) {
    console.error(`Failed to invalidate user interests cache: ${error.message}`);
  }
}

/**
 * Invalidate user following cache
 * Call this when user follows/unfollows someone
 * @param {string} userId - User ID
 */
export async function invalidateUserFollowingCache(userId) {
  try {
    const cacheKey = `${CACHE_KEYS.USER_FOLLOWING}${userId}`;
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(cacheKey);
    }
  } catch (error) {
    console.error(`Failed to invalidate user following cache: ${error.message}`);
  }
}

/**
 * Invalidate all feed-related caches for a user
 * @param {string} userId - User ID
 */
export async function invalidateAllFeedCaches(userId) {
  await Promise.all([invalidateUserInterestsCache(userId), invalidateUserFollowingCache(userId)]);
}
