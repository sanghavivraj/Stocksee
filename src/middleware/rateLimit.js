const rateLimit = require('express-rate-limit');

/** Per-IP rate limit: `max` requests per `windowMinutes`. Off in tests so suites can call routes freely. */
const limiter = (windowMinutes, max) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { limiter };
