import redis from './redis.ts';
import { logger } from './logger.ts';

/**
 * Get cached data or fetch fresh data and cache it
 */
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl = 300, // 5 minutes default
): Promise<T> {
  try {
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      logger.debug({ key }, 'Cache hit');
      return typeof cached === 'string' ? JSON.parse(cached) : (cached as T);
    }

    // Fetch fresh data
    logger.debug({ key }, 'Cache miss, fetching data');
    const data = await fetchFn();

    // Cache the result
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  } catch (err) {
    logger.warn({ err, key }, 'Cache error, falling back to fetch');
    // If cache fails, still return fresh data
    return fetchFn();
  }
}

/**
 * Set cache explicitly
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttl = 300,
): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
    logger.debug({ key, ttl }, 'Cache set');
  } catch (err) {
    logger.warn({ err, key }, 'Failed to set cache');
  }
}

/**
 * Invalidate a specific cache key
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key);
    logger.debug({ key }, 'Cache invalidated');
  } catch (err) {
    logger.warn({ err, key }, 'Failed to invalidate cache');
  }
}

/**
 * Invalidate multiple cache keys by pattern
 * Note: Upstash Redis doesn't support KEYS pattern matching in REST API
 * For pattern-based invalidation, maintain a list of related keys separately
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    // Upstash REST API limitation: KEYS command not available
    // For pattern invalidation, you need to track keys explicitly
    logger.warn({ pattern }, 'Pattern invalidation not supported in Upstash REST API - use specific keys or maintain a list');
  } catch (err) {
    logger.warn({ err, pattern }, 'Failed to invalidate cache pattern');
  }
}

/**
 * Clear all cache (use with caution)
 * Note: Upstash API doesn't expose FLUSHDB, so we provide limited support
 */
export async function clearAllCache(): Promise<void> {
  try {
    logger.warn('FLUSHDB not available in Upstash REST API - manual cache clear not supported');
  } catch (err) {
    logger.warn({ err }, 'Failed to clear all cache');
  }
}
