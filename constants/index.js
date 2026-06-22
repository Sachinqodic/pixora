// Numeric constants to replace magic numbers
export const NUMERIC_CONSTANTS = {
  DECIMAL_RADIX: 10,
  BCRYPT_SALT_ROUNDS: 12,
  DEFAULT_TIMEOUT_MS: 5000,
  PAGINATION_DEFAULT_PAGE: 1,
  PAGINATION_DEFAULT_LIMIT: 10,
  PAGINATION_MIN_LIMIT: 1,
  PAGINATION_MAX_LIMIT: 100,
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_PORT: 3000,
  CACHE_TTL_SECONDS: 3600,
  RATE_LIMIT_PUBLIC_DEFAULT: 100,
  RATE_LIMIT_PROTECTED_DEFAULT: 1000,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  DATABASE_POOL_MAX: 5,
  DATABASE_POOL_MIN: 0,
  DATABASE_ACQUIRE_TIMEOUT: 30000,
  DATABASE_IDLE_TIMEOUT: 10000,
  JWT_ACCESS_TOKEN_LIFETIME: 1800, // 30 minutes
  JWT_REFRESH_TOKEN_LIFETIME: 604800, // 7 days
  TOKEN_REFRESH_BUFFER_MS: 300000, // 5 minutes buffer for token refresh
  DEFAULT_VALUE: 0,
  DEFAULT_INDEX: 1,
  DEFAULT_LARGE_VALUE: 1000,
  DEFAULT_DECIMAL_PLACES: 2,
  DECIMAL_PLACES: 2,
  MONTHS_IN_YEAR: 12,
  GEOLOCATION_TIMEOUT_MS: 3000,
  FALLBACK_SESSION_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,

  MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB in bytes
  PRESIGNED_URL_EXPIRY_SECONDS: 120, // 2 minutes

  STORAGE_GUARD_VALUE: 1024,
  DEFAULT_ONE: 1,
};

Object.freeze(NUMERIC_CONSTANTS);

// String constants to replace hardcoded string literals
export const STRING_CONSTANTS = {
  ENVIRONMENT_DEVELOPMENT: 'development',
  ENVIRONMENT_PRODUCTION: 'production',
  ENVIRONMENT_TEST: 'test',
  ENVIRONMENT_STAGING: 'staging',
  TOKEN_TYPE_ACCESS: 'access',
  TOKEN_TYPE_REFRESH: 'refresh',
  STATUS_ACTIVE: 'active',
  STATUS_INACTIVE: 'inactive',
  STATUS_PENDING: 'pending',
  STATUS_COMPLETED: 'completed',
  STATUS_CANCELLED: 'cancelled',
  // User Role Constants
  USER_ROLE_USER: 'user',
  USER_ROLE_ADMIN: 'admin',
  USER_ROLE_MODERATOR: 'moderator',

  // Plan Type Constants
  HTTP_METHOD_GET: 'GET',
  HTTP_METHOD_POST: 'POST',
  HTTP_METHOD_PUT: 'PUT',
  HTTP_METHOD_DELETE: 'DELETE',
  HTTP_METHOD_PATCH: 'PATCH',
  CONTENT_TYPE_JSON: 'application/json',
  AUTHORIZATION_HEADER: 'authorization',
  BEARER_PREFIX: 'Bearer ',
  CORS_ORIGIN_HEADER: 'origin',
  USER_AGENT_HEADER: 'user-agent',
  CONTENT_TYPE_HEADER: 'content-type',
  COOKIE_HEADER: 'cookie',
  X_API_KEY_HEADER: 'x-api-key',
  RETRY_AFTER_HEADER: 'retry-after',
};

Object.freeze(STRING_CONSTANTS);

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

Object.freeze(HTTP_STATUS);

// Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_ALREADY_DELETED: 'USER_ALREADY_DELETED',
  CANNOT_DELETE_SELF: 'CANNOT_DELETE_SELF',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  LOGOUT: 'LOGOUT',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED_ACCESS',
  FORBIDDEN: 'FORBIDDEN_ACCESS',
  MISSING_MEDIA: 'MISSING_MEDIA',
  FILE_SIZE_LIMIT_EXCEEDED: 'FILE_SIZE_LIMIT_EXCEEDED',
  UNEXPECTED_FILE_FIELD: 'UNEXPECTED_FILE_FIELD',
};

Object.freeze(ERROR_CODES);

// Error Messages
export const ERROR_MESSAGES = {
  // Authentication & Authorization
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_TOKEN: 'Invalid or malformed token',
  INVALID_REFRESH_TOKEN: 'Invalid or malformed refresh token',
  REVOKED_TOKEN: 'User token has been revoked',
  TOKEN_EXPIRED: 'Token has expired',
  UNAUTHORIZED_ACCESS: 'Unauthorized access',
  FORBIDDEN_ACCESS: 'You do not have permission to access this resource',
  EMAIL_NOT_VERIFIED: 'Email not verified. Please verify your email to login.',
  EMAIL_ALREADY_VERIFIED: 'Email already verified. Please login to continue.',
  EMAIL_VERIFICATION_TOKEN_REQUIRED: 'Email verification token is required',
  PASSWORD_RESET: 'Password reset successfully. Now you can login.',
  PASSWORD_RESET_LINK_SENT: 'Password reset link sent successfully',

  // User Errors
  USER_AUTHENTICATION_REQUIRED: 'User authentication required',
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User with this email already exists',
  FAILED_TO_GENERATE_TOKEN: 'Failed to generate token',
  FAILED_TO_GENERATE_REFRESH_TOKEN: 'Failed to generate refresh token',
  USER_CREATION_FAILED: 'Failed to create user',
  USER_UPDATE_FAILED: 'Failed to update user',
  USER_DELETE_FAILED: 'Failed to delete user',
  USER_PROFILE_DEACTIVATED: 'User account has been deactivated',
  FAILED_TO_GENERATE_TOKEN: 'Failed to generate token',
  FAILED_TO_GENERATE_REFRESH_TOKEN: 'Failed to generate refresh token',
  USER_ID_REQUIRED: 'User ID is required to generate token',

  // post errors
  POST_NOT_FOUND: 'Pin not found',

  // comment errors
  COMMENT_NOT_FOUND: 'Comment not found',
  UNAUTHORIZED_COMMENT_EDIT: 'You are not authorized to edit this comment',
  UNAUTHORIZED_COMMENT_DELETE: 'You are not authorized to delete this comment',

  // s3 errors
  S3_GENERATE_PRESIGNED_URL_FAILED: 'Failed to generate presigned URL',

  // File Upload Errors
  FILE_REQUIRED: 'File is required',
  INVALID_FILE_TYPE: 'Invalid file type',
  FILE_UPLOAD_FAILED: 'Failed to upload profile image',
  FILE_TOO_LARGE: 'File too large. Maximum size is 5MB.',
  FILE_INVALID_TYPE: 'Invalid file type. Only JPG, JPEG, PNG, and GIF files are allowed.',
  FILE_BUFFER_EMPTY: 'Image buffer is empty or invalid',
  MEDIA_FILE_REQUIRED: 'Media file is required',
  UNEXPECTED_FILE_FIELD: 'Unexpected file field.',
  POST_FILE_INVALID_TYPE:
    'Invalid file type. Only JPG, JPEG, PNG, GIF, MP4, MPEG, and MOV files are allowed.',

  // Database Errors
  DATABASE_CONNECTION_ERROR: 'Database connection error',
  DATABASE_QUERY_ERROR: 'Database query error',

  // General Errors
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred',
  VALIDATION_ERROR: 'Validation error',
  VALIDATION_FAILED: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Bad request',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',

  // Rate Limit Messages
  RATE_LIMITERS_INITIALIZED: 'Rate limiters initialized successfully',
  RATE_LIMITERS_INITIALIZED_MEMORY: 'In-memory rate limiters initialized for testing',
  PUBLIC_RATE_LIMITER_NOT_INITIALIZED: 'Public rate limiter not initialized',
  PROTECTED_RATE_LIMITER_NOT_INITIALIZED: 'Protected rate limiter not initialized',

  // Redis Messages
  REDIS_CLIENT_CONNECTED: 'Redis client connected',
  REDIS_CLIENT_DISCONNECTED: 'Redis client disconnected',
  REDIS_RECONNECTION_FAILED: 'Redis reconnection failed after maximum attempts',
  FAILED_TO_INITIALIZE_RATE_LIMITERS: 'Failed to initialize rate limiters',

  // guard Messages
  FAILED_TO_GET_STORAGE: 'Failed to retrieve storage usage',
  QUOTA_COMPLETED: 'Storage quota exceeded. Please upgrade your plan or delete some content',
  QUOTA_EXCEEDING_COMPLETED:
    'Storage quota exceeding. Please upgrade your plan or delete some content.',

  // Board Errors
  BOARD_NOT_FOUND: 'Board not found',
  PIN_ALREADY_SAVED: 'Pin is already saved to this board',
  NOT_AUTHORIZED_USER_TO_REMOVE_PIN: 'You are not authorized to remove pins from this board',
  PIN_NOT_FOUND_IN_BOARD: 'Pin not found in this board',

  // Follower Errors
  FOLLOW_SELF_FORBIDDEN: 'You cannot follow yourself',
  FOLLOW_RELATIONSHIP_NOT_FOUND: 'Follow relationship not found',
};

Object.freeze(ERROR_MESSAGES);

export const MESSAGES = {
  // USER MESSAGES
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User profile updated successfully',

  // LIKE MESSAGES
  LIKE_CREATED: 'Like created successfully',
  LIKE_REMOVED: 'Like removed successfully',

  // COMMENT MESSAGES
  COMMENT_CREATED: 'Comment created successfully',
  COMMENT_UPDATED: 'Comment updated successfully',
  COMMENT_DELETED: 'Comment deleted successfully',
  COMMENTS_FETCHED: 'Comments fetched successfully',

  // POST MESSAGES
  POST_CREATED: 'Post created successfully',
  POST_FETCHED: 'Post fetched successfully',
  POST_DELETED: 'Post deleted successfully',

  // BOARD MESSAGES
  BOARD_CREATED: 'Board created successfully',
  BOARD_UPDATED: 'Board updated successfully',
  BOARD_DELETED: 'Board deleted successfully',
  BOARD_FETCHED: 'Board fetched successfully',
  BOARDS_FETCHED: 'Boards fetched successfully',
  BOARD_PINS_FETCHED: 'Board pins fetched successfully',
  PIN_SAVED_TO_BOARD: 'Pin saved to board successfully',
  PIN_REMOVED_FROM_BOARD: 'Pin removed from board successfully',
};

Object.freeze(MESSAGES);

// Valid plan types from User model
export const VALID_PLAN_TYPES = ['free', 'starter', 'pro', 'enterprise'];
export const VALID_PERIODS = ['monthly', 'yearly'];
export const VALID_PLAN_STATUS = ['active', 'canceled', 'past_due', 'incomplete'];
export const SIZES = ['Bytes', 'KB', 'MB', 'GB'];

// Storage Quota Limits by Plan Type and Billing Period (in bytes)
export const PLAN_STORAGE_LIMITS = {
  free: {
    monthly: 150 * 1024 * 1024, // 150 MB
    yearly: 150 * 1024 * 1024, // 150 MB
  },
  starter: {
    monthly: 300 * 1024 * 1024, // 300 MB
    yearly: 500 * 1024 * 1024, // 500 MB
  },
  pro: {
    monthly: 600 * 1024 * 1024, // 600 MB
    yearly: 800 * 1024 * 1024, // 800 MB
  },
  enterprise: {
    monthly: 900 * 1024 * 1024, // 900 MB
    yearly: 1024 * 1024 * 1024, // 1 GB
  },
};

Object.freeze(PLAN_STORAGE_LIMITS);

// Quota Configuration
export const QUOTA_CONFIG = {
  CACHE_TTL_SECONDS: 3600, // 1 hour cache in Redis
  SYNC_INTERVAL_MS: 300000, // Sync to DB every 5 minutes
  REDIS_KEY_PREFIX: 'quota:user:', // Redis key prefix for quota
};

Object.freeze(QUOTA_CONFIG);

// File Upload Constants
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: NUMERIC_CONSTANTS.MAX_IMAGE_SIZE_BYTES,
  ALLOWED_FORMATS: ['.jpg', '.jpeg', '.png', '.gif'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'],
  UPLOAD_DIR: 'uploads',
  PROFILE_PICTURES_DIR: 'uploads/profile-pictures',
};

Object.freeze(FILE_UPLOAD);

// JWT Token types Constants
export const JWT_TOKEN_TYPES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  PASSWORD_RESET_TOKEN: 'passwordResetToken',
};

Object.freeze(JWT_TOKEN_TYPES);
