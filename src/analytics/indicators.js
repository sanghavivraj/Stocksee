/**
 * Pure functions over real daily candles: [{ time:'YYYY-MM-DD', open, high, low, close, volume }] sorted by time.
 * Shared by smart alerts (live + backtest), chart event markers and the Tip Check.
 * No network, no database: easy to unit-test and identical logic for "live" and "what would have happened".
 */
const { round } = require('../lib/num');

const SESSIONS_PER_YEAR = 252;
const VOLUME_LOOKBACK = 20;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const stddev = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const pct = (from, to) => (from ? ((to - from) / from) * 100 : null);

/** Daily % change of session i vs the previous close. */
const dayChangePct = (c, i) => (i > 0 ? pct(c[i - 1].close, c[i].close) : null);

/** Opening gap % of session i vs the previous close. */
const gapPct = (c, i) => (i > 0 ? pct(c[i - 1].close, c[i].open) : null);

/** Session i volume as a multiple of the previous 20 sessions' average volume. */
function volumeRatio(c, i, lookback = VOLUME_LOOKBACK) {
  if (i < lookback) return null;
  const prior = c.slice(i - lookback, i).map((x) => x.volume).filter((v) => v > 0);
  if (prior.length < lookback * 0.75 || !(c[i].volume > 0)) return null;
  return c[i].volume / mean(prior);
}

/** Highest high / lowest low of the ~52 weeks BEFORE session i (needs most of a year of history). */
function prior52Week(c, i) {
  if (i < SESSIONS_PER_YEAR * 0.8) return null;
  const window = c.slice(Math.max(0, i - SESSIONS_PER_YEAR), i);
  return { high: Math.max(...window.map((x) => x.high)), low: Math.min(...window.map((x) => x.low)) };
}

// ---------------------------------------------------------------- Smart alerts

const ALERT_TYPES = ['PRICE_MOVE', 'GAP', 'VOLUME_SPIKE', 'NEW_52W_HIGH', 'NEW_52W_LOW'];

/**
 * Would this alert fire on session i?
 * @param {{type:string, direction:'up'|'down', threshold:number}} alert
 * @returns {{ fired: boolean, value: number|null }} value = the measured %, multiple or level
 */
function evaluateCondition(alert, c, i) {
  const { type = 'PRICE_MOVE', direction, threshold } = alert;
  const crosses = (v) => v !== null && (direction === 'down' ? v <= -threshold : v >= threshold);

  switch (type) {
    case 'PRICE_MOVE': {
      const v = dayChangePct(c, i);
      return { fired: crosses(v), value: round(v) };
    }
    case 'GAP': {
      const v = gapPct(c, i);
      return { fired: crosses(v), value: round(v) };
    }
    case 'VOLUME_SPIKE': {
      const v = volumeRatio(c, i);
      return { fired: v !== null && v >= threshold, value: round(v, 1) };
    }
    case 'NEW_52W_HIGH': {
      const p = prior52Week(c, i);
      return { fired: Boolean(p) && c[i].high > p.high, value: p ? round(p.high) : null };
    }
    case 'NEW_52W_LOW': {
      const p = prior52Week(c, i);
      return { fired: Boolean(p) && c[i].low < p.low, value: p ? round(p.low) : null };
    }
    default:
      throw new Error(`Unknown alert type: ${type}`);
  }
}

/**
 * "How often would this alert have fired over the last year?" using the same rule as the live alert.
 * Based on daily candles, so intraday-only touches can differ slightly from live behaviour.
 */
function backtestAlert(alert, candles, sessions = SESSIONS_PER_YEAR) {
  const start = Math.max(1, candles.length - sessions);
  const fires = [];
  let evaluated = 0;
  for (let i = start; i < candles.length; i += 1) {
    const { fired, value } = evaluateCondition(alert, candles, i);
    if (value === null && !fired) continue; // not enough history for this day
    evaluated += 1;
    if (fired) fires.push({ date: candles[i].time, value });
  }
  return {
    sessions: evaluated,
    fires: fires.length,
    firesPerMonth: evaluated ? round((fires.length / evaluated) * 21, 1) : null,
    lastFired: fires.slice(-5).reverse(),
    from: candles[start]?.time || null,
    to: candles[candles.length - 1]?.time || null,
  };
}

// ---------------------------------------------------------------- Chart markers

/**
 * Data-derived markers: days with unusually large moves (vs the stock's own volatility) or volume spikes.
 * These are facts about the price series, not predictions.
 */
function detectUnusualDays(c, { sigma = 2.5, volumeMultiple = 3, lookback = 60 } = {}) {
  const markers = [];
  for (let i = lookback; i < c.length; i += 1) {
    const window = [];
    for (let j = i - lookback + 1; j < i; j += 1) window.push(dayChangePct(c, j));
    const sd = stddev(window.filter((x) => x !== null));
    const move = dayChangePct(c, i);
    if (sd && move !== null && Math.abs(move) >= Math.max(sigma * sd, 3)) {
      markers.push({ date: c[i].time, type: 'big_move', value: round(move) });
    }
    const vr = volumeRatio(c, i);
    if (vr !== null && vr >= volumeMultiple) {
      markers.push({ date: c[i].time, type: 'volume_spike', value: round(vr, 1) });
    }
  }
  return markers;
}

// ---------------------------------------------------------------- Tip Check market signals

/**
 * Market patterns commonly seen around pump-and-dump tips. Each signal has a weight (risk points).
 * @returns {Array<{code:string, weight:number, value:number}>}
 */
function marketRiskSignals(c, { marketCap = null, price = null } = {}) {
  const signals = [];
  const last = c.length - 1;
  if (last < 21) return signals;

  const vr = volumeRatio(c, last);
  if (vr !== null && vr >= 5) signals.push({ code: 'volume_extreme', weight: 3, value: round(vr, 1) });
  else if (vr !== null && vr >= 3) signals.push({ code: 'volume_high', weight: 2, value: round(vr, 1) });

  const monthReturn = pct(c[last - 21].close, c[last].close);
  if (monthReturn !== null && monthReturn >= 40) signals.push({ code: 'runup_extreme', weight: 3, value: round(monthReturn, 1) });
  else if (monthReturn !== null && monthReturn >= 20) signals.push({ code: 'runup_high', weight: 2, value: round(monthReturn, 1) });

  const sharpUpDays = c.slice(-10).filter((_, k, arr) => {
    const idx = c.length - arr.length + k;
    const r = dayChangePct(c, idx);
    return r !== null && r >= 4.75;
  }).length;
  if (sharpUpDays >= 3) signals.push({ code: 'repeated_sharp_rises', weight: 2, value: sharpUpDays });

  const returns = [];
  for (let i = Math.max(1, last - 59); i <= last; i += 1) returns.push(dayChangePct(c, i));
  const vol = stddev(returns.filter((x) => x !== null));
  if (vol !== null && vol >= 4) signals.push({ code: 'very_volatile', weight: 1, value: round(vol, 1) });

  const p = price ?? c[last].close;
  if (p !== null && p < 20) signals.push({ code: 'penny_stock', weight: 2, value: round(p) });

  // Market cap in rupees; < ₹500 crore is a micro-cap (easier to move with little money)
  if (marketCap !== null && marketCap < 500 * 1e7) {
    signals.push({ code: 'micro_cap', weight: 2, value: round(marketCap / 1e7, 0) });
  }
  return signals;
}

module.exports = {
  ALERT_TYPES,
  SESSIONS_PER_YEAR,
  dayChangePct,
  gapPct,
  volumeRatio,
  prior52Week,
  evaluateCondition,
  backtestAlert,
  detectUnusualDays,
  marketRiskSignals,
};
