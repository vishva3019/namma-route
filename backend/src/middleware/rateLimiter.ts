import rateLimit from 'express-rate-limit';

// Standard API rate limiter: 120 requests per minute per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'ERROR',
    message: 'Too many requests. Please wait a few moments before trying again.',
  },
});

// Realtime polling endpoint limiter: 60 requests per minute per IP (ample for 30s poll interval)
export const realtimeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'ERROR',
    message: 'Rate limit exceeded for realtime updates. Default polling interval is 30 seconds.',
  },
});
