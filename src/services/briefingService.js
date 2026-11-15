const marketDataService = require('./marketDataService');
const calendar = require('../constants/marketCalendar.json');
const { dayChangePct } = require('../analytics/indicators');
const { istDate } = require('../lib/time');
const { round } = require('../lib/num');

const SESSIONS_PER_YEAR = 252;
const CUES = [
  { key: 'sp500', symbol: '^GSPC' },
  { key: 'nikkei', symbol: '^N225' },
  { key: 'hangseng', symbol: '^HSI' },
  { key: 'crude', symbol: 'CL=F' },
  { key: 'gold', symbol: 'GC=F' },
  { key: 'usdinr', symbol: 'USDINR=X' },
];
const CACHE_MS = 5 * 60 * 1000;
let cache = null;


/** Next weekday after the given IST date (exchange holidays are NOT known here, and the page says so). */
function nextSessionDate(fromIso) {
  const d = new Date(`${fromIso}T12:00:00Z`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while ([0, 6].includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

/**
 * India VIX is the market's own estimate of NIFTY's yearly swing in % (annualised). Divided by sqrt(252)
 * it gives the size of a typical one-day move. This is a RANGE (how big), never a DIRECTION (up or down).
 */
function expectedDailyRange(vix) {
  if (!(vix > 0)) return null;
  return round(vix / Math.sqrt(SESSIONS_PER_YEAR), 2);
}

/**
 * What happened the next day after earlier NIFTY days of a similar size?
 * Pools sessions whose change was within +/-0.3 points of the latest day (latest day excluded).
 */
function similarDayHistory(candles) {
  if (!candles || candles.length < 60) return null;
  const last = candles.length - 1;
  const today = dayChangePct(candles, last);
  if (today === null) return null;
  let cases = 0;
  let up = 0;
  for (let i = 1; i < last; i += 1) {
    const change = dayChangePct(candles, i);
    const next = dayChangePct(candles, i + 1);
    if (change === null || next === null || Math.abs(change - today) > 0.3) continue;
    cases += 1;
    if (next > 0) up += 1;
  }
  if (cases < 30) return null;
  return { todayChangePercent: round(today), band: 0.3, cases, upPercent: Math.round((up / cases) * 100) };
}

function scheduledEvents(fromIso) {
  const horizon = new Date(`${fromIso}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 10);
  const to = horizon.toISOString().slice(0, 10);
  return (calendar.events || [])
    .filter((e) => e.date >= fromIso && e.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ date, title, source }) => ({ date, title, source: source || null }));
}

async function resultsAhead(symbols, fromIso) {
  const out = [];
  const lookups = await Promise.allSettled(symbols.slice(0, 10).map((s) => marketDataService.getEarningsDates(s)));
  lookups.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const date = (r.value || []).filter((d) => d >= fromIso).sort()[0];
    if (date) out.push({ symbol: symbols[i], date });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function buildBriefing() {
  const today = istDate();
  const [vixR, niftyR, ...cueR] = await Promise.allSettled([
    marketDataService.getTrendData('^INDIAVIX'),
    marketDataService.getHistory('^NSEI', '5y'),
    ...CUES.map((c) => marketDataService.getTrendData(c.symbol)),
  ]);

  const vix = vixR.status === 'fulfilled' ? vixR.value : null;
  const range = vix ? expectedDailyRange(vix.currentPrice) : null;
  const cues = {};
  CUES.forEach((c, i) => {
    const r = cueR[i];
    if (r.status !== 'fulfilled') return;
    cues[c.key] = {
      changePercent: r.value.dayChangePercent,
      ...(c.key === 'usdinr' ? { price: r.value.currentPrice } : {}),
      asOf: r.value.lastUpdated,
    };
  });

  return {
    today,
    nextSession: nextSessionDate(today),
    holidaysNote: 'Weekends are skipped. Exchange holidays are not included.',
    range: range === null ? null : {
      vix: round(vix.currentPrice, 1),
      dailyPercent: range,
      asOf: vix.lastUpdated,
      note: 'A typical size of move, not a direction.',
    },
    cues,
    scheduled: scheduledEvents(today),
    history: niftyR.status === 'fulfilled' ? similarDayHistory(niftyR.value.candles) : null,
    source: 'Yahoo Finance (may be delayed) and a hand-maintained calendar',
  };
}

/** Briefing (cached a few minutes). Watchlist results dates are added per request and are best-effort. */
async function getBriefing({ symbols = [] } = {}) {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), data: await buildBriefing() };
  const resultsDates = symbols.length ? await resultsAhead(symbols, cache.data.today) : [];
  return { ...cache.data, results: resultsDates };
}

const clearCache = () => { cache = null; };

module.exports = { getBriefing, clearCache, expectedDailyRange, similarDayHistory, nextSessionDate };
