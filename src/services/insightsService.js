const marketDataService = require('./marketDataService');
const { dayChangePct, volumeRatio } = require('../analytics/indicators');
const { unusualTriggers } = require('../analytics/unusual');
const { round } = require('../lib/num');

const MAX_SYMBOLS = 20;
const BENCHMARK = '^NSEI';
const isNonEquity = (s) => s.startsWith('^') || s.includes('=');


/**
 * How did the stock move compared with the market that day?
 *  on_its_own     : moved much more (or less) than NIFTY did, so the market does not explain it
 *  against_market : went the opposite way to a clearly moving NIFTY
 *  with_market    : moved roughly in step with NIFTY
 * A description of the past session, never a forecast.
 */
function relationToMarket(change, nifty) {
  if (change === null || nifty === null) return null;
  if (Math.abs(change) >= 1.5 && Math.abs(change - nifty) >= 2) return 'on_its_own';
  if (Math.abs(nifty) >= 0.3 && Math.abs(change) >= 0.5 && Math.sign(change) !== Math.sign(nifty)) return 'against_market';
  if (Math.abs(nifty) >= 0.3 && Math.sign(change) === Math.sign(nifty)) return 'with_market';
  return null;
}

/** Facts about the latest session of one instrument (the pieces behind "why it moved"). */
function describeSession(symbol, candles, niftyByDate) {
  if (!candles || candles.length < 2) return null;
  const last = candles.length - 1;
  const date = candles[last].time;
  const change = dayChangePct(candles, last);
  if (change === null) return null;
  const niftyChange = niftyByDate.get(date) ?? null;
  const equityLike = !isNonEquity(symbol);
  return {
    symbol,
    date,
    changePercent: round(change),
    volumeRatio: equityLike ? round(volumeRatio(candles, last), 1) : null,
    niftyChangePercent: equityLike ? round(niftyChange) : null,
    relation: equityLike ? relationToMarket(change, niftyChange) : null,
    triggers: equityLike ? unusualTriggers(candles, last).map((t) => t.code) : [],
  };
}

async function benchmarkByDate() {
  try {
    const nifty = await marketDataService.getHistory(BENCHMARK, '3mo');
    const map = new Map();
    nifty.candles.forEach((c, i) => map.set(c.time, dayChangePct(nifty.candles, i)));
    return map;
  } catch {
    return new Map();
  }
}

/** Per-stock facts for a list of symbols. Stocks without real data are left out (we never guess). */
async function getInsights(symbols) {
  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SYMBOLS);
  const niftyByDate = await benchmarkByDate();
  const settled = await Promise.allSettled(unique.map((s) => marketDataService.getHistory(s, '3mo')));
  const items = [];
  settled.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const item = describeSession(unique[i], r.value.candles, niftyByDate);
    if (item) items.push(item);
  });
  return { items, requested: unique.length, source: 'Yahoo Finance (may be delayed)' };
}

module.exports = { getInsights, describeSession, relationToMarket, MAX_SYMBOLS };
