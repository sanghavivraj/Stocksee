/**
 * "Unusual activity" rules. Pure functions over real daily candles (same shape as indicators.js).
 *
 * SEBI-safe by design:
 *  - The rules are fixed and public (see RULES) and identical for every stock and every user.
 *  - They describe what already happened ("volume 4.2x its 20-day average"). They never say which way
 *    the price will go, and stocks are ranked by how UNUSUAL the day was, never by expected gain.
 *  - Big up days and big down days are treated the same.
 */

const { dayChangePct, gapPct, volumeRatio, prior52Week } = require('./indicators');
const { round } = require('../lib/num');

const MOVE_LOOKBACK = 60;

/** The public rule book. Shown to users so nothing is hidden. */
const RULES = {
  big_move: { sigma: 2.5, minPercent: 2 },   // move >= 2.5x the stock's own usual daily move, and at least 2%
  volume_spike: { multiple: 3 },             // volume >= 3x its previous 20-session average
  gap: { minPercent: 3 },                    // opening gap vs previous close of at least 3%
  new_52w_high: {},                          // traded above the previous 52-week high
  new_52w_low: {},                           // traded below the previous 52-week low
};
const RULE_CODES = Object.keys(RULES);


function stddev(xs) {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Which rules fire on session i? Each trigger carries the measured value and an intensity (>= 1 when fired). */
function unusualTriggers(c, i) {
  const triggers = [];
  if (i < 21 || i >= c.length) return triggers;

  const move = dayChangePct(c, i);
  if (move !== null) {
    const window = [];
    for (let j = Math.max(1, i - MOVE_LOOKBACK); j < i; j += 1) window.push(dayChangePct(c, j));
    const sd = stddev(window.filter((x) => x !== null));
    if (sd && Math.abs(move) >= RULES.big_move.minPercent) {
      const z = Math.abs(move) / sd;
      if (z >= RULES.big_move.sigma) {
        triggers.push({ code: 'big_move', value: round(move), times: round(z, 1), intensity: z / RULES.big_move.sigma });
      }
    }
  }

  const vr = volumeRatio(c, i);
  if (vr !== null && vr >= RULES.volume_spike.multiple) {
    triggers.push({ code: 'volume_spike', value: round(vr, 1), intensity: vr / RULES.volume_spike.multiple });
  }

  const gap = gapPct(c, i);
  if (gap !== null && Math.abs(gap) >= RULES.gap.minPercent) {
    triggers.push({ code: 'gap', value: round(gap), intensity: Math.abs(gap) / RULES.gap.minPercent });
  }

  const p = prior52Week(c, i);
  if (p && c[i].high > p.high) triggers.push({ code: 'new_52w_high', value: round(p.high), intensity: 1 });
  if (p && c[i].low < p.low) triggers.push({ code: 'new_52w_low', value: round(p.low), intensity: 1 });

  return triggers;
}

/** Milder public rules for the "also worth a look" list. Same facts, lower bar. */
const NOTABLE = {
  big_move: { sigma: 1.5, minPercent: 1.5 },
  volume_spike: { multiple: 2 },
  gap: { minPercent: 2 },
  near_52w: { withinPercent: 1.5 },
};

function notableTriggers(c, i) {
  const triggers = [];
  if (i < 21 || i >= c.length) return triggers;

  const move = dayChangePct(c, i);
  if (move !== null) {
    const window = [];
    for (let j = Math.max(1, i - MOVE_LOOKBACK); j < i; j += 1) window.push(dayChangePct(c, j));
    const sd = stddev(window.filter((x) => x !== null));
    if (sd && Math.abs(move) >= NOTABLE.big_move.minPercent) {
      const z = Math.abs(move) / sd;
      if (z >= NOTABLE.big_move.sigma) triggers.push({ code: 'big_move', value: round(move), times: round(z, 1), intensity: z / RULES.big_move.sigma });
    }
  }
  const vr = volumeRatio(c, i);
  if (vr !== null && vr >= NOTABLE.volume_spike.multiple) {
    triggers.push({ code: 'volume_spike', value: round(vr, 1), intensity: vr / RULES.volume_spike.multiple });
  }
  const gap = gapPct(c, i);
  if (gap !== null && Math.abs(gap) >= NOTABLE.gap.minPercent) {
    triggers.push({ code: 'gap', value: round(gap), intensity: Math.abs(gap) / RULES.gap.minPercent });
  }
  const p = prior52Week(c, i);
  if (p) {
    const close = c[i].close;
    const toHigh = ((p.high - close) / p.high) * 100;
    const toLow = ((close - p.low) / p.low) * 100;
    if (toHigh >= 0 && toHigh <= NOTABLE.near_52w.withinPercent && c[i].high <= p.high) {
      triggers.push({ code: 'near_52w_high', value: round(p.high), distance: round(toHigh), intensity: 0.5 });
    }
    if (toLow >= 0 && toLow <= NOTABLE.near_52w.withinPercent && c[i].low >= p.low) {
      triggers.push({ code: 'near_52w_low', value: round(p.low), distance: round(toLow), intensity: 0.5 });
    }
  }
  return triggers;
}

/** Strong triggers if any; otherwise the milder ones. tier says which list the stock belongs to. */
function triggersFor(c, i) {
  const strong = unusualTriggers(c, i);
  if (strong.length) return { tier: 'unusual', triggers: strong };
  const mild = notableTriggers(c, i);
  return { tier: 'notable', triggers: mild };
}

/** How big a move is normal for this stock: the spread of its last 60 daily changes, in %. A size, not a direction. */
function typicalDailyMove(c, days = MOVE_LOOKBACK) {
  const window = [];
  for (let j = Math.max(1, c.length - days); j < c.length; j += 1) window.push(dayChangePct(c, j));
  const sd = stddev(window.filter((x) => x !== null));
  return sd === null ? null : round(sd, 1);
}

/** How unusual was the session overall? Direction-blind: bigger = more unusual, nothing more. */
const unusualScore = (triggers) => round(triggers.reduce((sum, t) => sum + t.intensity, 0), 2);

/** Scan the latest session of one stock. Returns null when nothing stands out (or not enough history). */
function scanLatest(c) {
  if (!c || c.length < 22) return null;
  const i = c.length - 1;
  const { tier, triggers } = triggersFor(c, i);
  if (!triggers.length) return null;
  return {
    tier,
    date: c[i].time,
    close: c[i].close,
    changePercent: round(dayChangePct(c, i)),
    volumeRatio: round(volumeRatio(c, i), 1),
    triggers,
    score: unusualScore(triggers),
  };
}

/**
 * What happened the NEXT day after earlier sessions that tripped each rule (excluding the latest session).
 * Returned raw so a caller can pool many stocks together: [{ code, next }].
 */
function nextDayAfterTriggers(c) {
  const out = [];
  for (let i = 21; i < c.length - 1; i += 1) {
    const next = dayChangePct(c, i + 1);
    if (next === null) continue;
    const { tier, triggers } = triggersFor(c, i);
    for (const t of triggers) out.push({ code: tier === 'notable' ? `notable_${t.code}` : t.code, next });
  }
  return out;
}

/** Pool next-day outcomes into { code: { cases, upPercent } }. */
function summariseNextDay(samples) {
  const byCode = {};
  for (const { code, next } of samples) {
    const s = byCode[code] || (byCode[code] = { cases: 0, up: 0 });
    s.cases += 1;
    if (next > 0) s.up += 1;
  }
  return Object.fromEntries(
    Object.entries(byCode).map(([code, s]) => [code, { cases: s.cases, upPercent: Math.round((s.up / s.cases) * 100) }]),
  );
}

module.exports = {
  RULES, NOTABLE, RULE_CODES, unusualTriggers, notableTriggers, triggersFor, typicalDailyMove,
  unusualScore, scanLatest, nextDayAfterTriggers, summariseNextDay,
};
