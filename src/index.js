const config = require('./config');
const Sentry = require('@sentry/node');
const { createApp } = require('./app');
const prisma = require('./lib/prisma');
const jobs = require('./jobs');
const { launchTelegramBot, stopTelegramBot } = require('./services/telegramService');

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn && sentryDsn.startsWith('http')) {
  Sentry.init({ dsn: sentryDsn });
}

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`StockSee API running on port ${config.port}`);
  jobs.start();
  launchTelegramBot();
});

server.on('error', (err) => {
  // e.g. EADDRINUSE: fail fast instead of running half-started (cron + bot without an API)
  console.error('Server failed to start:', err.message);
  process.exit(1);
});

let shuttingDown = false;
function shutdown(signal, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);
  jobs.stop();
  stopTelegramBot(signal);
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(code);
  });
  setTimeout(() => process.exit(code), 10_000).unref(); // don't hang forever
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  if (Sentry.getCurrentHub?.().getClient()) Sentry.captureException(reason);
});
process.on('uncaughtException', (err) => {
  // State is unknown after an uncaught exception: log and exit so the process manager restarts it cleanly.
  console.error('Uncaught exception:', err);
  if (Sentry.getCurrentHub?.().getClient()) Sentry.captureException(err);
  shutdown('uncaughtException', 1);
});

module.exports = { app, server };
