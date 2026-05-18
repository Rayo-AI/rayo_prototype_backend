import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Improved key generator for rate limiting
 * For authenticated users: tracks by userId to allow higher limits per user
 * For anonymous users: uses ipKeyGenerator for proper IPv6 support
 */
const keyGeneratorWithUserTracking = (req: Request): string => {
  const userId = (req as any).userId;
  if (userId) {
    return `user:${userId}`;
  }

  // Use ipKeyGenerator instead of req.ip directly — handles IPv6 normalization
  return ipKeyGenerator(req.ip ?? 'unknown');
};

// General API rate limiter - startup-friendly limits
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per 15 minutes
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true, // Return RateLimit-* headers
  legacyHeaders: false,
  // Use default IP-based key generator for proper IPv6 handling
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Stricter limiter for auth endpoints (prevent brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorWithUserTracking, // Track by userId if authenticated
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Strict limiter for signup (prevent account creation spam)
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 signup attempts per hour
  message: { error: 'Too many signup attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default IP-based key generator
  skipSuccessfulRequests: true, // Don't count successful signups
});

// Moderate limiter for AI endpoints (more expensive operations)
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 requests per minute
  message: { error: 'AI request limit exceeded, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorWithUserTracking, // Track by userId if available
});

// Transaction operations limiter
export const transactionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 transaction operations per minute
  message: { error: 'Too many transaction requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorWithUserTracking, // Track by userId if available
});

// Budget operations limiter
export const budgetLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 budget operations per minute
  message: { error: 'Too many budget requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorWithUserTracking, // Track by userId if available
});

// Savings goals operations limiter
export const savingsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 savings operations per minute
  message: { error: 'Too many savings requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGeneratorWithUserTracking, // Track by userId if available
});
