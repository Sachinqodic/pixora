// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config/env.js';
import connectDB, { isDatabaseConnected, disconnectDatabase } from './config/db.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { attachClientIP } from './middlewares/requestLogger.js';
import {
  initializeRateLimiters,
  disconnectRedis,
  publicRateLimiter,
} from './middlewares/rateLimiter.js';
import index from './routes/index.js';
import { displayServerStatus } from './utils/monitor.js';
import { HTTP_STATUS, STRING_CONSTANTS } from './constants/index.js';

// Validate configuration
validateConfig();

// Create Express app
const app = express();

// Cookie parser middleware
app.use(cookieParser());

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security Middleware - Helmet (must be early in middleware stack)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    referrerPolicy: {
      policy: 'no-referrer-when-downgrade',
    },
  })
);

// CORS Configuration - Strict origin control
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    if (config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`✗ CORS request blocked from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600, // Cache preflight requests for 10 minutes
};

app.use(cors(corsOptions));

// Attach client IP to request object
app.use(attachClientIP);

// Stripe webhook needs raw body - apply raw parser to /api/v1/payments/webhook/stripe path BEFORE JSON parser
app.use('/api/v1/payments/webhook/stripe', express.raw({ type: 'application/json' }));

// Body parsing middleware for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (with public rate limiter)
app.get('/api/health', publicRateLimiter, (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'Application is running',
      timestamp: new Date().toISOString(),
    },
  });
});

// Ready check endpoint (checks database connection)
app.get('/api/ready', (req, res) => {
  const dbConnected = isDatabaseConnected();
  const ready = dbConnected;

  res.status(ready ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not ready',
      checks: {
        database: dbConnected,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Node.js Application API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
    },
  });
});

// Register routes
app.use('/api/v1', index);

// 404 handler
app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Server instance
let server = null;

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting Node.js application...');

    // Connect to database
    await connectDB();

    // Initialize rate limiters (Redis or in-memory)
    //await initializeRateLimiters();

    // Start HTTP server
    server = app.listen(config.server.port, () => {
      displayServerStatus(config.server.port);
      console.log(`Environment: ${config.env}`);
      console.log(`API Base URL: ${config.server.baseUrl}`);
      console.log(`Health Check: http://localhost:${config.server.port}/api/health`);
      console.log(`Ready Check: http://localhost:${config.server.port}/api/ready`);
    });

    // Setup graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      gracefulShutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled promise rejection:', reason);
      gracefulShutdown();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('⚠️  Shutdown signal received, starting graceful shutdown...');

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      console.log('✓ HTTP server closed');

      try {
        // Close database connection
        await disconnectDatabase();

        // Disconnect from Redis
        //await disconnectRedis();

        console.log('✓ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('✗ Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      console.error('✗ Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

// Start the server if this file is run directly
if (config.env !== STRING_CONSTANTS.ENVIRONMENT_TEST) {
  startServer();
}

export default app;
