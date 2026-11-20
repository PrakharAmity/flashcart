import crypto from 'node:crypto';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'flashcart_secret_key_2026_mega_shopping_festival_secure',
  appId: process.env.APP_ID || 'DL-APP-001',
  appName: process.env.APP_NAME || 'FlashCart',
  
  // Bug toggle: If true, reference solutions are used (all bugs fixed).
  // If false, intentional bugs DL-BUG-001 through DL-BUG-008 are active.
  get isReferenceMode() {
    return process.env.REFERENCE_MODE === 'true' || process.env.CHALLENGE_MODE === 'false';
  }
};
