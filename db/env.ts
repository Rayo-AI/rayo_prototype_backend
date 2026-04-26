import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });  // takes priority
dotenv.config({ path: '.env' });        // fallback

const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  JWT: {
    SECRET: process.env.JWT_SECRET,
    EXPIRES_IN: process.env.JWT_EXPIRES_IN
  },
  
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT || 3000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
}

export default ENV;