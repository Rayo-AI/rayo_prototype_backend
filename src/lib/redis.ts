import { Redis } from '@upstash/redis';
import { logger } from './logger.ts';
import ENV from '../../db/env.ts';

if (!ENV.UPSTASH.REDIS_REST_URL || !ENV.UPSTASH.REDIS_REST_TOKEN) {
  const message = 'Upstash Redis credentials not configured - caching disabled';
  if (ENV.NODE_ENV === 'development') {
    logger.info(message);
  } else {
    logger.warn(message);
  }
}

const redis = new Redis({
  url: ENV.UPSTASH.REDIS_REST_URL,
  token: ENV.UPSTASH.REDIS_REST_TOKEN,
});

logger.debug('Upstash Redis client initialized');

export default redis;
