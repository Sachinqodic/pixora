/**
 * ============================================================================
 * QUOTA GUARD MIDDLEWARE
 * ============================================================================
 * 
 * HOW IT WORKS:
 * 1. Extracts file size from req.file (set by multer)
 * 2. Gets user's current storage usage from Redis (fast!)
 * 3. Gets user's storage limit based on plan type and billing period
 * 4. Checks: currentUsage + fileSize > limit?
 * 5. If YES → Block upload with 403 Forbidden
 * 6. If NO → Allow upload to proceed
 * 
 * 
 */
import User from '../models/User.js';
import { redisClient } from './rateLimiter.js';
import { NotFoundError, InternalServerError } from '../utils/errors.js';
import { ERROR_MESSAGES, NUMERIC_CONSTANTS, SIZES } from '../constants/index.js';
import { PLAN_STORAGE_LIMITS, QUOTA_CONFIG, HTTP_STATUS, ERROR_CODES } from '../constants/index.js';

/**
 * Get user's storage limit value based on plan type and billing period
 * @returns {number} Storage limit in bytes
 */
function getUserStorageLimit(planType, billingPeriod) {
  // Free plan has same limit regardless of period
  if (planType === 'free' || !billingPeriod) {
    return PLAN_STORAGE_LIMITS.free.monthly;
  }

  // Get limit based on plan and period
  const limit = PLAN_STORAGE_LIMITS[planType]?.[billingPeriod];
  
  if (!limit) {
    return PLAN_STORAGE_LIMITS.free.monthly;
  }
  return limit;
}

/**
 * Get user's current storage usage from Redis (with DB fallback)
 * @returns {Promise<number>} Current storage usage in bytes
 */
async function getUserStorageUsage(userId) {
  const redisKey = `${QUOTA_CONFIG.REDIS_KEY_PREFIX}${userId}:bytes`;

  try {
    // Try to get from Redis first.
    if (redisClient && redisClient.isOpen) {
      const cachedBytes = await redisClient.get(redisKey);
      
      if (cachedBytes !== null) {
        return parseInt(cachedBytes, 10);
      }
    }

    // Cache miss or Redis unavailable - get from database
    const user = await User.findById(userId).select('storage_used');
    
    if (!user) {
      throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const storageUsed = user.storage_used || 0;

    // Cache the value in Redis for future requests
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(redisKey, QUOTA_CONFIG.CACHE_TTL_SECONDS, storageUsed.toString());
    }

    return storageUsed;

  } catch (error) {
    
    // Fallback to database if Redis fails
    try {
      const user = await User.findById(userId).select('storage_used');
      return user?.storage_used || 0;
    } catch (dbError) {
      throw new InternalServerError(ERROR_MESSAGES.FAILED_TO_GET_STORAGE);
    }
  }
}

/**
 * Format bytes to human-readable string
 * 
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "5.2 MB")
 */
function formatBytes(bytes) {
  if (bytes === NUMERIC_CONSTANTS.DEFAULT_VALUE) return '0 Bytes';
  
  const k = NUMERIC_CONSTANTS.STORAGE_GUARD_VALUE;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${SIZES[i]}`;
}

/**
 * QUOTA GUARD MIDDLEWARE
 * 
 * Validates storage quota before allowing file uploads
 */
export const quotaGuard = async (req, res, next) => {
  try {
    console.log('\n========== QUOTA GUARD CHECK ==========');

    // ========================================================================
    // STEP 1: Check if file exists
    // ========================================================================
    if (!req.file) {
      console.log("There is no file in the request so iam exiting the quotaGurd")
      return next();
    }

    // ========================================================================
    // STEP 2: Check if user is authenticated
    // ========================================================================
    if (!req.user || !req.user._id) {
      console.log("There is no user request so Iam exiting")
      return next();
    }

    const userId = req.user._id.toString();
    const planType = req.user.plan_type || 'free';
    const billingPeriod = req.user.billing_period || null;

    // ========================================================================
    // STEP 3: Get user's storage limit
    // ========================================================================
    const storageLimit = getUserStorageLimit(planType, billingPeriod);
    console.log("The user storage limit was",storageLimit);

    // ========================================================================
    // STEP 4: Get user's current storage usage
    // ========================================================================
    const currentUsage = await getUserStorageUsage(userId);
    console.log("The current usage is ", currentUsage);


    // ========================================================================
    // STEP 5: Calculate if upload would exceed quota
    // ========================================================================
    const fileSize = req.file.size;
    console.log(" The file coming size is :", fileSize);
    const newTotalUsage = currentUsage + fileSize;
    console.log(" The newToptalUsage is :",newTotalUsage);
    const remaining = storageLimit - currentUsage;
    console.log(" The remaining usage is:",remaining);

    // ========================================================================
    // STEP 6: Check and Block upload if user quota already exceeded
    // ========================================================================

    if (currentUsage > storageLimit) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.QUOTA_COMPLETED,
          code: ERROR_CODES.FORBIDDEN,
          statusCode: HTTP_STATUS.FORBIDDEN,
        },
        data: {
          quotaInfo: {
            currentUsage: formatBytes(currentUsage),
            limit: formatBytes(storageLimit),
            overBy: formatBytes(currentUsage - storageLimit),
            isOverQuota: true,
          },
        }
      });
    }

    // ========================================================================
    // STEP 7: Block upload if quota would be exceeded
    // ========================================================================
    if (newTotalUsage > storageLimit) {

      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.QUOTA_EXCEEDING_COMPLETED,
          code: ERROR_CODES.FORBIDDEN,
          statusCode: HTTP_STATUS.FORBIDDEN,
        },
        data: {
          quotaInfo: {
            fileSize: formatBytes(fileSize),
            currentUsage: formatBytes(currentUsage),
            limit: formatBytes(storageLimit),
            remaining: formatBytes(remaining),
            overBy: formatBytes(newTotalUsage - storageLimit),
          },
        },
      });
    }

    // ========================================================================
    // STEP 8: Allow upload - quota is available
    // ========================================================================

    // Attach quota info to request for use in controllers
    req.quotaInfo = {
      currentUsage,
      limit: storageLimit,
      remaining,
      usagePercentage: Math.round((currentUsage / storageLimit) * 100),
    };

    next();

  } catch (error) {
    next();
  }
};

/**
 * Invalidate quota cache from redis for an user
 * @param {string} userId - User's MongoDB ID
 */
export async function invalidateQuotaCache(userId) {
  const redisKey = `${QUOTA_CONFIG.REDIS_KEY_PREFIX}${userId}:bytes`;
  
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(redisKey);
    }
  } catch (error) {
    console.error(`✗ Failed to invalidate quota cache for user ${userId}:`, error.message);
  }
}
