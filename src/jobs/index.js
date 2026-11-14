const cron = require('node-cron');
const config = require('../config');
const prisma = require('../lib/prisma');
const marketDataService = require('../services/marketDataService');
const narrativeService = require('../services/sharedNarrativeService');
const alertService = require('../services/alertService');
const { sendMessage } = require('../services/telegramService');
const { runMorningBriefing } = require('./morningBriefing');
const { runWeeklyDigest } = require('./weeklyDigest');
const { runAlertEvaluation } = require('./alertEvaluation');

const deps = { prisma, marketDataService, narrativeService, alertService, sendMessage };
const tasks = [];
const running = new Set();

/** Run a job unless the previous run of the same job is still going. */
function guarded(name, fn) {
  return async () => {
    if (running.has(name)) {
      console.warn(`[Jobs] ${name} still running; skipping this tick`);
      return;
    }
    running.add(name);
    try {
      await fn(deps);
    } catch (err) {
      console.error(`[Jobs] ${name} failed:`, err);
    } finally {
      running.delete(name);
    }
  };
}

/**
 * NOTE: with more than one server instance, every instance would send these messages.
 * Run jobs on a single instance (or add a distributed lock) before scaling out.
 */
function start() {
  const opts = { timezone: config.timezone };
  tasks.push(
    cron.schedule('30 8 * * 1-5', guarded('MorningBriefing', runMorningBriefing), opts), // 8:30 IST, Mon–Fri
    cron.schedule('0 9 * * 1', guarded('WeeklyDigest', runWeeklyDigest), opts),          // 9:00 IST, Monday
    cron.schedule('*/2 9-15 * * 1-5', guarded('AlertEvaluation', runAlertEvaluation), opts), // every 2 min, market hours
  );
  console.log('[Jobs] Scheduled (Asia/Kolkata): morning brief, weekly digest, price alerts');
}

function stop() {
  tasks.splice(0).forEach((t) => t.stop());
}

module.exports = { start, stop };
