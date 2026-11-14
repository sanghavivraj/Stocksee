const { t } = require('./messages');
const { deliverAll } = require('./deliver');
const { istDate } = require('../lib/time');
const { evaluateCondition } = require('../analytics/indicators');

const LIVE_HISTORY_MAX_AGE_MS = 60 * 1000;

/** Has this alert already fired on the current IST day? */
const firedToday = (alert, now) => alert.lastTriggeredAt && istDate(alert.lastTriggeredAt) === istDate(now);

/**
 * Checks active smart alerts (for visitors with Telegram connected) against real daily candles.
 * Uses the SAME rule as the backtest (analytics/evaluateCondition) on today's session candle.
 * - Each alert fires at most once per IST day.
 * - Only fires when the latest candle is today's session (never on yesterday's data or guesses).
 */
async function runAlertEvaluation({ alertService, marketDataService, sendMessage, now = new Date() }) {
  const alerts = (await alertService.listDeliverable()).filter((a) => !firedToday(a, now));
  if (!alerts.length) return { checked: 0, sent: 0, failed: 0 };

  const bySymbol = new Map();
  for (const a of alerts) bySymbol.set(a.symbol, [...(bySymbol.get(a.symbol) || []), a]);

  const today = istDate(now);
  const items = [];
  const triggered = [];
  for (const [symbol, list] of bySymbol) {
    let history;
    try {
      history = await marketDataService.getHistory(symbol, '2y', { maxAgeMs: LIVE_HISTORY_MAX_AGE_MS });
    } catch {
      continue; // no real data: never alert on guesses
    }
    const candles = history.candles || [];
    const last = candles.length - 1;
    if (history.stale || last < 1 || candles[last].time !== today) continue; // no session today yet

    for (const alert of list) {
      const { fired, value } = evaluateCondition(alert, candles, last);
      if (!fired) continue;
      const m = t(alert.user.language);
      const format = m.alert[alert.type || 'PRICE_MOVE'];
      items.push({ chatId: alert.user.telegramChatId, text: `${format(symbol, value, alert)}\n\n${m.disclaimer}` });
      triggered.push(alert);
    }
  }

  // Mark first so a slow send can't cause a duplicate on the next run
  await Promise.all(triggered.map((a) => alertService.markTriggered(a.id, now)));
  const result = await deliverAll(sendMessage, items, 'AlertEvaluation');
  return { checked: alerts.length, ...result };
}

module.exports = { runAlertEvaluation };
