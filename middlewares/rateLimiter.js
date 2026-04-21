/**
 * ============================================================================
 * RATE LIMITER MIDDLEWARE
 * ============================================================================
 * 
 * This module implements a dual-tier rate limiting system using Redis for
 * production and in-memory storage for testing. It provides two separate
 * rate limiters with different thresholds for public and protected routes.
 * 
 * WHY TWO RATE LIMITERS?
 * ----------------------
 * 1. PUBLIC RATE LIMITER (Stricter - Lower Limits)
 *    - Applied to unauthenticated endpoints (login, register, password reset)
 *    - Uses IP address as the identifier
 *    - Lower limits to prevent brute force attacks and DDoS
 *    - Example: 10 requests per minute
 * 
 * 2. PROTECTED RATE LIMITER (More Lenient - Higher Limits)
 *    - Applied to authenticated endpoints (user data, file uploads, etc.)
 *    - Uses userId (if authenticated) or IP address as fallback
 *    - Higher limits for legitimate users performing normal operations
 *    - Example: 100 requests per minute
 * 
 * REDIS VS IN-MEMORY
 * ------------------
 * - Production: Uses Redis for distributed rate limiting across multiple servers
 * - Testing: Uses in-memory storage for fast tests without external dependencies
 * - Redis ensures rate limits persist across server restarts and work in clusters
 * 
 * RATE LIMIT HEADERS
 * ------------------
 * The middleware sets standard HTTP headers to inform clients about their limits:
 * - X-RateLimit-Limit: Maximum requests allowed in the time window
 * - X-RateLimit-Remaining: Number of requests remaining in current window
 * - X-RateLimit-Reset: ISO timestamp when the rate limit resets
 * - Retry-After: Seconds to wait before retrying (when limit exceeded)
 * 
 * ============================================================================
 */

import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import { config } from '../config/env.js';
import { ERROR_MESSAGES, ERROR_CODES, HTTP_STATUS, STRING_CONSTANTS } from '../constants/index.js';
import { extractClientIP } from '../utils/ipExtractor.js';

// ============================================================================
// MODULE-LEVEL VARIABLES
// ============================================================================

/**
 * Redis client instance for production environments
 * Null in test environment where in-memory limiter is used
 */
let redisClient = null;

/**
 * Public rate limiter instance
 * Applied to unauthenticated routes (login, register, etc.)
 * Uses stricter limits to prevent abuse
 */
let publicLimiter = null;

/**
 * Protected rate limiter instance
 * Applied to authenticated routes (user data, uploads, etc.)
 * Uses more lenient limits for legitimate users
 */
let protectedLimiter = null;

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize rate limiters based on environment
 * 
 * PRODUCTION/DEVELOPMENT:
 * - Creates Redis client with reconnection strategy
 * - Initializes Redis-backed rate limiters
 * - Rate limits persist across server restarts
 * - Works in multi-server deployments
 * 
 * TEST ENVIRONMENT:
 * - Uses in-memory rate limiters
 * - No external dependencies (Redis not required)
 * - Fast and isolated for testing
 * 
 * @throws {Error} If Redis connection fails in non-test environments
 */
export async function initializeRateLimiters() {
  try {

    // ========================================================================
    // PRODUCTION/DEVELOPMENT: Use Redis-backed rate limiters
    // ========================================================================
    console.log('🔄 Connecting to Redis for rate limiting...');

    // Create Redis client with connection options
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        /**
         * Reconnection strategy with exponential backoff
         * - Retries up to 10 times
         * - Delay increases with each retry (100ms, 200ms, 300ms, etc.)
         * - Maximum delay capped at 3 seconds
         * - Gives up after 10 failed attempts
         */
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('✗ Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          // Exponential backoff: min(retries * 100ms, 3000ms)
          const delay = Math.min(retries * 100, 3000);
          console.log(`⏳ Redis reconnection attempt ${retries}, waiting ${delay}ms...`);
          return delay;
        },
      },
    });

    // Redis event handlers for monitoring connection status
    redisClient.on('error', (err) => {
      console.error('✗ Redis client error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('✓ Redis client connected successfully');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis client reconnecting...');
    });

    redisClient.on('ready', () => {
      console.log('✓ Redis client ready');
    });

    // Establish connection to Redis
    await redisClient.connect();

    // ========================================================================
    // Initialize Redis-backed rate limiters
    // ========================================================================

    /**
     * PUBLIC RATE LIMITER
     * -------------------
     * Applied to: Login, register, password reset, public API endpoints
     * Identifier: IP address only (no user authentication)
     * Purpose: Prevent brute force attacks, account enumeration, DDoS
     * 
     * Configuration:
     * - points: Maximum requests allowed (e.g., 10)
     * - duration: Time window in seconds (60 = 1 minute)
     * - blockDuration: How long to block after exceeding (60 = 1 minute)
     * - keyPrefix: Redis key prefix for organization (rl:public:192.168.1.1)
     */
    publicLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:public',
      points: config.rateLimit.public, // e.g., 10 requests
      duration: 60, // per 60 seconds (1 minute)
      blockDuration: 60, // block for 60 seconds after exceeding
    });

    /**
     * PROTECTED RATE LIMITER
     * ----------------------
     * Applied to: User data, file uploads, authenticated API operations
     * Identifier: userId (if authenticated) OR IP address (fallback)
     * Purpose: Allow legitimate users more freedom while preventing abuse
     * 
     * Configuration:
     * - points: Maximum requests allowed (e.g., 100)
     * - duration: Time window in seconds (60 = 1 minute)
     * - blockDuration: How long to block after exceeding (60 = 1 minute)
     * - keyPrefix: Redis key prefix (rl:protected:user123 or rl:protected:192.168.1.1)
     */
    protectedLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:protected',
      points: config.rateLimit.protected, // e.g., 100 requests
      duration: 60, // per 60 seconds (1 minute)
      blockDuration: 60, // block for 60 seconds after exceeding
    });

    console.log('✓ Redis-backed rate limiters initialized');
    console.log(`  - Public limiter: ${config.rateLimit.public} requests/minute`);
    console.log(`  - Protected limiter: ${config.rateLimit.protected} requests/minute`);
  } catch (error) {
    console.error('✗ Failed to initialize rate limiters:', error.message);
    throw error;
  }
}

/**
 * Disconnect from Redis gracefully
 * Called during application shutdown to clean up resources
 */
export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    console.log('✓ Redis client disconnected');
  }
}

// ============================================================================
// RATE LIMITER MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * PUBLIC RATE LIMITER MIDDLEWARE
 * ===============================
 * 
 * Apply this middleware to PUBLIC/UNAUTHENTICATED routes:
 * - POST /api/auth/login
 * - POST /api/auth/register
 * - POST /api/auth/forgot-password
 * - GET /api/public/*
 * 
 * HOW IT WORKS:
 * 1. Extracts client IP address (handles proxies, load balancers, CDNs)
 * 2. Checks if IP has exceeded rate limit
 * 3. If within limit: Sets rate limit headers and allows request
 * 4. If exceeded: Returns 429 Too Many Requests with retry information
 * 
 * RATE LIMIT HEADERS (sent with every response):
 * - X-RateLimit-Limit: Maximum requests allowed (e.g., 10)
 * - X-RateLimit-Remaining: Requests remaining in current window (e.g., 7)
 * - X-RateLimit-Reset: When the limit resets (ISO timestamp)
 * - Retry-After: Seconds to wait before retrying (only when limit exceeded)
 * 
 * EXAMPLE USAGE:
 * ```javascript
 * import { publicRateLimiter } from './middlewares/rateLimiter.js';
 * 
 * // Apply to login route
 * app.post('/api/auth/login', publicRateLimiter, loginController);
 * ```
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function publicRateLimiter(req, res, next) {
  // Skip rate limiting in test environment
  if (config.env === STRING_CONSTANTS.ENVIRONMENT_TEST) {
    return next();
  }

  // Safety check: Ensure rate limiter is initialized
  if (!publicLimiter) {
    console.warn('⚠️  Public rate limiter not initialized, skipping rate limit check');
    return next();
  }

  /**
   * Extract client IP address
   * Handles various proxy headers:
   * - X-Forwarded-For (most common)
   * - X-Real-IP (Nginx)
   * - CF-Connecting-IP (Cloudflare)
   * Falls back to req.ip or connection.remoteAddress
   */
  const clientIP = extractClientIP(req);

  /**
   * Attempt to consume 1 point from the rate limiter
   * Each request consumes 1 point from the client's quota
   */
  publicLimiter
    .consume(clientIP, 1) // Consume 1 point for this request
    .then((rateLimiterRes) => {
      // ====================================================================
      // SUCCESS: Request is within rate limit
      // ====================================================================

      // Set standard rate limit headers to inform client
      res.setHeader('X-RateLimit-Limit', config.rateLimit.public);
      res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString()
      );

      // Allow request to proceed
      next();
    })
    .catch((rateLimiterRes) => {
      // ====================================================================
      // FAILURE: Rate limit exceeded
      // ====================================================================

      console.warn(`⚠️  Rate limit exceeded for IP: ${clientIP} on ${req.path}`);

      // Set rate limit headers (all at 0 since limit exceeded)
      res.setHeader('X-RateLimit-Limit', config.rateLimit.public);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString()
      );
      
      // Set Retry-After header (in seconds)
      const retryAfterSeconds = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      // Return 429 Too Many Requests error
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
          retryAfter: retryAfterSeconds,
        },
      });
    });
}

/**
 * PROTECTED RATE LIMITER MIDDLEWARE
 * ==================================
 * 
 * Apply this middleware to AUTHENTICATED/PROTECTED routes:
 * - GET /api/users/:id
 * - POST /api/users/:id/profile-picture
 * - GET /api/assets
 * - PUT /api/users/:id
 * 
 * HOW IT WORKS:
 * 1. Uses userId (from authentication middleware) if available
 * 2. Falls back to IP address if user is not authenticated
 * 3. Checks if user/IP has exceeded rate limit
 * 4. If within limit: Sets rate limit headers and allows request
 * 5. If exceeded: Returns 429 Too Many Requests with retry information
 * 
 * WHY USE USERID?
 * - More accurate tracking per user (not affected by IP changes)
 * - Prevents users from bypassing limits by changing IPs
 * - Allows per-user rate limiting in multi-tenant applications
 * 
 * RATE LIMIT HEADERS (sent with every response):
 * - X-RateLimit-Limit: Maximum requests allowed (e.g., 100)
 * - X-RateLimit-Remaining: Requests remaining in current window (e.g., 87)
 * - X-RateLimit-Reset: When the limit resets (ISO timestamp)
 * - Retry-After: Seconds to wait before retrying (only when limit exceeded)
 * 
 * EXAMPLE USAGE:
 * ```javascript
 * import { protectedRateLimiter } from './middlewares/rateLimiter.js';
 * import { authenticate } from './middlewares/auth.js';
 * 
 * // Apply to protected route (after authentication)
 * app.get('/api/users/:id', authenticate, protectedRateLimiter, getUserController);
 * ```
 * 
 * @param {Request} req - Express request object (should have req.userId from auth middleware)
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function protectedRateLimiter(req, res, next) {
  // Skip rate limiting in test environment
  if (config.env === STRING_CONSTANTS.ENVIRONMENT_TEST) {
    return next();
  }

  // Safety check: Ensure rate limiter is initialized
  if (!protectedLimiter) {
    console.warn('⚠️  Protected rate limiter not initialized, skipping rate limit check');
    return next();
  }

  /**
   * Determine rate limit key
   * Priority:
   * 1. Use userId if user is authenticated (set by auth middleware)
   * 2. Fall back to IP address if not authenticated
   * 
   * This allows:
   * - Per-user rate limiting for authenticated users
   * - Per-IP rate limiting for unauthenticated users
   */
  const key = req.userId || extractClientIP(req);

  /**
   * Attempt to consume 1 point from the rate limiter
   * Each request consumes 1 point from the user's/IP's quota
   */
  protectedLimiter
    .consume(key, 1) // Consume 1 point for this request
    .then((rateLimiterRes) => {
      // ====================================================================
      // SUCCESS: Request is within rate limit
      // ====================================================================

      // Set standard rate limit headers to inform client
      res.setHeader('X-RateLimit-Limit', config.rateLimit.protected);
      res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString()
      );

      // Allow request to proceed
      next();
    })
    .catch((rateLimiterRes) => {
      // ====================================================================
      // FAILURE: Rate limit exceeded
      // ====================================================================

      const identifier = req.userId ? `User ${req.userId}` : `IP ${extractClientIP(req)}`;
      console.warn(`⚠️  Rate limit exceeded for ${identifier} on ${req.path}`);

      // Set rate limit headers (all at 0 since limit exceeded)
      res.setHeader('X-RateLimit-Limit', config.rateLimit.protected);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString()
      );
      
      // Set Retry-After header (in seconds)
      const retryAfterSeconds = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);

      // Return 429 Too Many Requests error
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
          retryAfter: retryAfterSeconds,
        },
      });
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if Redis client is connected
 * Useful for health checks and monitoring
 * 
 * @returns {boolean} True if Redis is connected, false otherwise
 */
export function isRedisConnected() {
  return redisClient !== null && redisClient.isOpen;
}

/**
 * Reset rate limiters (for testing purposes)
 * Reinitializes rate limiters to clear all rate limit data
 * 
 * WARNING: Only use in test environment!
 */
export async function resetRateLimiters() {
  if (config.env === STRING_CONSTANTS.ENVIRONMENT_TEST) {
    await initializeRateLimiters();
    console.log('✓ Rate limiters reset for testing');
  } else {
    console.warn('⚠️  resetRateLimiters() should only be called in test environment');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initializeRateLimiters,
  disconnectRedis,
  publicRateLimiter,
  protectedRateLimiter,
  isRedisConnected,
  resetRateLimiters,
};
