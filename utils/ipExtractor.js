/**
 * Extract client IP address from request, handling proxies and load balancers
 * @param {Request} req - Express request object
 * @returns {string} Client IP address
 */
export function extractClientIP(req) {
  // Check X-Forwarded-For header (most common)
  // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
  // The first IP is the original client
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ips = forwardedStr.split(',').map((ip) => ip.trim());
    return ips[0];
  }

  // Check X-Real-IP header (Nginx)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Check CF-Connecting-IP header (Cloudflare)
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) {
    return Array.isArray(cfIp) ? cfIp[0] : cfIp;
  }

  // Fallback to Express req.ip (works with trust proxy)
  if (req.ip) {
    return req.ip;
  }

  // Last resort: connection remote address
  return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

/**
 * Check if IP address is valid IPv4 or IPv6
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid IP address
 */
export function isValidIP(ip) {
  if (!ip || ip === 'unknown') return false;

  // IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 regex (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Sanitize IP address for logging (mask last octet for privacy)
 * @param {string} ip - IP address to sanitize
 * @returns {string} Sanitized IP address
 */
export function sanitizeIP(ip) {
  if (!ip || ip === 'unknown') return 'unknown';

  // For IPv4, mask last octet
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = 'xxx';
      return parts.join('.');
    }
  }

  // For IPv6, mask last segment
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length > 0) {
      parts[parts.length - 1] = 'xxxx';
      return parts.join(':');
    }
  }

  return ip;
}
