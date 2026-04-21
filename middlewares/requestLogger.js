import { extractClientIP, sanitizeIP } from '../utils/ipExtractor.js';
import { config } from '../config/env.js';

/**
 * Add client IP to request object
 * Makes IP easily accessible in controllers
 */
export function attachClientIP(req, res, next) {
  req.clientIP = extractClientIP(req);
  next();
}

/**
 * Security headers middleware
 * Adds security-related information to request
 */
export function securityContext(req, res, next) {
  req.securityContext = {
    ip: extractClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date().toISOString(),
    environment: config.env,
  };
  next();
}
