import dotenv from 'dotenv';
import { REFUSED } from 'node:dns';

dotenv.config({ path: '.env.local' });  // takes priority
dotenv.config({ path: '.env' });        // fallback

const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN
  },
  
  URL: {
    FRONTEND: process.env.APP_URL || 'http://localhost:4000',
    DATABASE: process.env.DATABASE_URL,
    REDIS: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  UPSTASH: {
    REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  
  PORT: process.env.PORT || 3000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  GEMINI: {
    API_KEY: process.env.GEMINI_API_KEY,
    API_URL: process.env.GEMINI_API_URL,
    API_NAME: process.env.GEMINI_API_NAME,
  },

  BREVO: {
    API_KEY: process.env.BREVO_API_KEY,
    SMTP_KEY: process.env.BREVO_SMTP_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM
  },

  SENTRY_DSN: process.env.SENTRY_DSN,
}

export default ENV;