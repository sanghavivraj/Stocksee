const marketDataService = require('./marketDataService');
const snapshotService = require('./marketSnapshotService');
const { RULES, NOTABLE, scanLatest, nextDayAfterTriggers, summariseNextDay, typicalDailyMove } = require('../analytics/unusual');
const { marketRiskSignals } = require('../analytics/indicators');
const { istDate } = require('../lib/time');
const { mapLimit, withTimeout } = require('../lib/async');

/**
 * Unusual activity scan. No stock names are typed in here:
 *  1. the stock list is NSE's live Nifty 500 list (universeService),
 *  2. one quick look at all of them (marketSnapshotService) finds the ones that look unusual today,
 *  3. only those get the full one-year history check against the fixed public rules.
 */

const SCAN_TTL_MS = 5 * 60 * 1000;
const CONCURRENCY = 6;
const MAX_ITEMS = 10;
const MAX_CANDIDATES = 150;
// "Thin stock" caution: tiny companies and penny stocks are easier to push around with little money
const THIN_CODES = new Set(['micro_cap', 'penny_stock']);
// A stock is worth a full check when the quick look shows any of these (deliberately looser than the final rules)
const LOOK = { movePercent: 1.2, volumeRatio: 1.7 };

let cached = null; // { at, key, data }
let inflight = null;

/** From the quick look at everything: which stocks deserve the full check, most promising first. */
function pickCandidates(rows) {
  return rows
    .map((r) => {
      const intensity = Math.max(
        Math.abs(r.changePercent) / LOOK.movePercent,
        (r.volumeRatio || 0) / LOOK.volumeRatio,
        snapshotService.isNear(r) ? 1 : 0,
      );
      return { r, intensity };
    })
    .filter((x) => x.intensity >= 1)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, MAX_CANDIDATES)
    .map((x) => x.r);
}

async function runScan(givenSymbols) {
  // Normal path: the live list. Tests (and callers with their own list) can pass symbols to check directly.
  let meta = new Map();
  let overview;
  let symbols;
  if (givenSymbols) {
    symbols = givenSymbols;
    overview = { universeSize: givenSymbols.length, quoted: null, asOf: null, universeSource: null };
  } else {
    const snapshot = await snapshotService.getSnapshot();
    meta = new Map(snapshot.rows.map((r) => [r.symbol, r]));
    symbols = pickCandidates(snapshot.rows).map((r) => r.symbol);
    overview = snapshot;
  }

  const histories = await mapLimit(symbols, CONCURRENCY, (s) => marketDataService.getHistory(s, '1y'));
  const usable = histories.filter((h) => h && h.candles && h.candles.length > 22);

  const flagged = [];
  const samples = [];
  for (const h of usable) {
    samples.push(...nextDayAfterTriggers(h.candles));
    const hit = scanLatest(h.candles);
    if (hit) flagged.push({ symbol: h.symbol, name: h.name, currency: h.currency, candles: h.candles, ...hit });
  }

  // Strong list and "also worth a look" list, each ranked by how unusual the day was. Never by direction.
  const byScore = (a, b) => b.score - a.score;
  const strong = flagged.filter((f) => f.tier === 'unusual').sort(byScore);
  const notable = flagged.filter((f) => f.tier === 'notable').sort(byScore);
  const top = [...strong.slice(0, MAX_ITEMS), ...notable.slice(0, MAX_ITEMS)];

  // Extras for the few we will show: market cap (thin-stock caution; free from the quick look) and the next results date
  const today = istDate();
  const [quotes, results] = await Promise.all([
    mapLimit(top, CONCURRENCY, async (t) => (meta.get(t.symbol)?.marketCap != null
      ? { marketCap: meta.get(t.symbol).marketCap }
      : marketDataService.fetchQuote(t.symbol))),
    mapLimit(top, CONCURRENCY, (t) => withTimeout(marketDataService.getEarningsDates(t.symbol), 2500, [])),
  ]);
  const history = summariseNextDay(samples);

  const items = top.map((t, i) => {
    const cautionCodes = marketRiskSignals(t.candles, { marketCap: quotes[i]?.marketCap ?? null })
      .map((sig) => sig.code).filter((code) => THIN_CODES.has(code));
    const lead = t.triggers.slice().sort((a, b) => b.intensity - a.intensity)[0];
    const key = t.tier === 'notable' ? `notable_${lead.code}` : lead.code;
    const nextResults = (results[i] || []).filter((d) => d >= today).sort()[0] || null;
    return {
      symbol: t.symbol,
      name: meta.get(t.symbol)?.name || t.name,
      industry: meta.get(t.symbol)?.industry || null,
      currency: t.currency,
      tier: t.tier,
      date: t.date,
      close: t.close,
      changePercent: t.changePercent,
      volumeRatio: t.volumeRatio,
      score: t.score,
      triggers: t.triggers.map(({ code, value, times, distance }) => ({ code, value, ...(times ? { times } : {}), ...(distance !== undefined ? { distance } : {}) })),
      thinStock: cautionCodes.length > 0,
      cautionCodes,
      history: history[key] ? { code: lead.code, ...history[key] } : null,
      // "Tomorrow": how big a move is normal for this stock, and what is scheduled. A size and a calendar, not a direction.
      tomorrow: { typicalMovePercent: typicalDailyMove(t.candles), nextResults },
    };
  });

  return {
    asOf: usable.map((h) => h.candles[h.candles.length - 1].time).sort().pop() || null,
    scanned: givenSymbols ? usable.length : overview.quoted,
    universeSize: overview.universeSize,
    universeSource: overview.universeSource,
    checkedInDetail: usable.length,
    flagged: strong.length,
    notableCount: notable.length,
    rules: RULES,
    notableRules: NOTABLE,
    items,
    source: 'Yahoo Finance (may be delayed)',
  };
}

/** Scan result, cached for a few minutes and shared by concurrent requests. */
async function getUnusualActivity({ limit = 3, universe = null, force = false } = {}) {
  const key = universe ? universe.join(',') : 'live';
  const fresh = cached && cached.key === key && Date.now() - cached.at < SCAN_TTL_MS;
  if (!fresh || force) {
    if (!inflight) {
      inflight = runScan(universe)
        .then((data) => { cached = { at: Date.now(), key, data }; return data; })
        .finally(() => { inflight = null; });
    }
    await inflight;
  }
  const { data } = cached;
  const pick = (tier) => data.items.filter((i) => i.tier === tier).slice(0, limit);
  return { ...data, items: [...pick('unusual'), ...pick('notable')] };
}

const clearCache = () => { cached = null; inflight = null; };

module.exports = { getUnusualActivity, clearCache, pickCandidates };
