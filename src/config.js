require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

const placeholder = (v) => !v || /^your_/.test(v) || v === 'dummy_token';

const config = {
  isProd,
  isTest,
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || (isTest ? 'test-secret-do-not-use-in-production' : undefined),
  visitorCookie: 'stocksee_visitor',
  visitorCookieDays: 365,
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  telegramToken: placeholder(process.env.TELEGRAM_BOT_TOKEN) ? (placeholder(process.env.BOT_TOKEN) ? null : process.env.BOT_TOKEN) : process.env.TELEGRAM_BOT_TOKEN,
  telegramLinkTtlMinutes: 15,
  timezone: 'Asia/Kolkata',
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set (at least 32 characters). Add it to .env');
}

module.exports = config;
