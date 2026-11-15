const express = require('express');
const cookieParser = require('cookie-parser');
const { securityHeaders, cors } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/errors');

/** Build the Express app with no side effects (no cron, no bot, no listen) so tests can use it directly. */
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(cors);

  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  app.get('/', (req, res) => res.json({ name: 'StockSee API', status: 'online' }));
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.use('/api', require('./routes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
