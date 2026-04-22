import dotenv from 'dotenv';
import { NUMERIC_CONSTANTS, STRING_CONSTANTS } from '../constants/index.js';

// Load environment variables
dotenv.config();

/**
 * Centralized configuration object
 * All environment variables should be accessed through this config object
 */
export const config = {
  // Environment
  env: process.env.NODE_ENV || STRING_CONSTANTS.ENVIRONMENT_DEVELOPMENT,
  
  // Server Configuration
  server: {
    port: parseInt(
      process.env.PORT || NUMERIC_CONSTANTS.DEFAULT_PORT.toString(),
      NUMERIC_CONSTANTS.DECIMAL_RADIX
    ),
    baseUrl: process.env.SERVER_BASE_URL || 'http://localhost:3003',
  },

  // Client Configuration
  client: {
    baseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:3000',
  },

  // Database Configuration
  database: {
    url: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pixora',
    options: {
      maxPoolSize: NUMERIC_CONSTANTS.DATABASE_POOL_MAX,
      minPoolSize: NUMERIC_CONSTANTS.DATABASE_POOL_MIN,
      connectTimeoutMS: NUMERIC_CONSTANTS.DATABASE_ACQUIRE_TIMEOUT,
      socketTimeoutMS: NUMERIC_CONSTANTS.DATABASE_IDLE_TIMEOUT,
    },
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
    credentials: true,
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || NUMERIC_CONSTANTS.RATE_LIMIT_WINDOW_MS.toString(),
      NUMERIC_CONSTANTS.DECIMAL_RADIX
    ),
    public: parseInt(
      process.env.RATE_LIMIT_PUBLIC || NUMERIC_CONSTANTS.RATE_LIMIT_PUBLIC_DEFAULT.toString(),
      NUMERIC_CONSTANTS.DECIMAL_RADIX
    ),
    protected: parseInt(
      process.env.RATE_LIMIT_PROTECTED || NUMERIC_CONSTANTS.RATE_LIMIT_PROTECTED_DEFAULT.toString(),
      NUMERIC_CONSTANTS.DECIMAL_RADIX
    ),
  },

  // Redis Configuration (for rate limiting)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // Security Configuration
  security: {
    bcryptSaltRounds: parseInt(
      process.env.BCRYPT_SALT_ROUNDS || NUMERIC_CONSTANTS.BCRYPT_SALT_ROUNDS.toString(),
      NUMERIC_CONSTANTS.DECIMAL_RADIX
    ),
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtAccessTokenLifetime: NUMERIC_CONSTANTS.JWT_ACCESS_TOKEN_LIFETIME,
    jwtRefreshTokenLifetime: NUMERIC_CONSTANTS.JWT_REFRESH_TOKEN_LIFETIME,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    sendGridSendorEmail: process.env.SEND_GRID_SENDOR_EMAIL,
    sendGridApiKey: process.env.SEND_GRID_API_KEY
  },

  // AWS S3 Configuration
  aws: {
    s3: {
      bucketName: process.env.AWS_S3_BUCKET_NAME|| '',
      region: process.env.AWS_REGION || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEYS || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    successUrl: process.env.PAYMENT_SUCCESS_URL || 'http://localhost:3000/payment/success',
    cancelUrl: process.env.PAYMENT_CANCEL_URL || 'http://localhost:3000/payment/cancel',
    portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:3000/account',
    prices: {
      starter: {
        monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
        yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
      },
      pro: {
        monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
        yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
      },
      enterprise: {
        monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
        yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
      },
    },
  },
};

/**
 * Validate required configuration
 * Throws error if critical configuration is missing
 */
export function validateConfig() {
  const requiredEnvVars = ['MONGO_URI'];
  const recommendedEnvVars = ['JWT_SECRET', 'SERVER_BASE_URL'];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.warn(
      `⚠️  Warning: Missing required environment variables: ${missingVars.join(', ')}`
    );
    console.warn('Using default values. Please set these in production.');
  }

  const missingRecommended = recommendedEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingRecommended.length > 0) {
    console.warn(
      `⚠️  Warning: Missing recommended environment variables: ${missingRecommended.join(', ')}`
    );
  }

  // Validate port is a valid number
  if (isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Invalid PORT configuration. Must be between 1 and 65535.');
  }

  // Validate JWT secret length in production
  if (
    config.env === STRING_CONSTANTS.ENVIRONMENT_PRODUCTION &&
    config.security.jwtSecret.length < 48
  ) {
    throw new Error('JWT_SECRET must be at least 48 characters in production.');
  }

  console.log('✓ Configuration validated successfully');
  console.log(`✓ Environment: ${config.env}`);
  console.log(`✓ Port: ${config.server.port}`);
  console.log(`✓ Database: ${config.database.url.replace(/\/\/.*@/, '//***@')}`); // Hide credentials
}

// Freeze config to prevent modifications
Object.freeze(config);
