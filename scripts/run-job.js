#!/usr/bin/env node
/**
 * Run a scheduled job right now (for testing).
 *
 *   node scripts/run-job.js morning   [--dry-run]
 *   node scripts/run-job.js weekly    [--dry-run]
 *   node scripts/run-job.js alerts    [--dry-run]
 *
 * --dry-run prints each Telegram message to the console instead of sending it
 * (works even without TELEGRAM_BOT_TOKEN).
 */
require('../src/config');
const prisma = require('../src/lib/prisma');
const marketDataService = require('../src/services/marketDataService');
const narrativeService = require('../src/services/sharedNarrativeService');
const alertService = require('../src/services/alertService');
const telegram = require('../src/services/telegramService');
const { runMorningBriefing } = require('../src/jobs/morningBriefing');
const { runWeeklyDigest } = require('../src/jobs/weeklyDigest'); const { runAlertEvaluation } = require('../src/jobs/alertEvaluation');

const JOBS = { morning: runMorningBriefing, weekly: runWeeklyDigest, alerts: runAlertEvaluation };
const [name] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');

if (!JOBS[name]) {
  console.error(`Usage: node scripts/run-job.js <${Object.keys(JOBS).join('|')}> [--dry-run]`);
  process.exit(1);
}

const dryRunSend = async (chatId, text) => {
  console.log(`\n────── to Telegram chat ${chatId} ──────\n${text}\n`);
  return true;
};

(async () => {
  try {
    const sendMessage = dryRun ? dryRunSend : telegram.sendMessage;
    if (!dryRun && !telegram.isEnabled()) {
      console.warn('TELEGRAM_BOT_TOKEN is not set: nothing will be delivered. Use --dry-run to preview messages.');
    }
    const result = await JOBS[name]({ prisma, marketDataService, narrativeService, alertService, sendMessage });
    console.log(`\n${name} finished:`, result);
    if (name === 'alerts' && dryRun) {
      console.log('(Alerts that matched were marked as fired for today, so they will not fire again until tomorrow.)');
    }
  } catch (err) {
    console.error(`${name} failed:`, err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
})();
