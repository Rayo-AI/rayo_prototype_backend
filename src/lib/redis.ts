import { Redis } from '@upstash/redis';
import { logger } from './logger.ts';
import ENV from '../../db/env.ts';

if (!ENV.UPSTASH.REDIS_REST_URL || !ENV.UPSTASH.REDIS_REST_TOKEN) {
  logger.warn('Upstash Redis credentials not configured - caching disabled');
}

const redis = new Redis({
  url: ENV.UPSTASH.REDIS_REST_URL,
  token: ENV.UPSTASH.REDIS_REST_TOKEN,
});

logger.info('Upstash Redis client initialized');

export default redis;
