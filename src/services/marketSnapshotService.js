const yahooFinance = require('yahoo-finance2').default;
const universeService = require('./universeService');
const marketDataService = require('./marketDataService');
const { round } = require('../lib/num');
const { mapLimit } = require('../lib/async');
const { MarketDataUnavailableError } = require('../lib/errors');


/**
 * One cheap look at the whole stock list at once: price, today's change, volume vs its usual volume, 52-week range.
 * Everything else (the unusual-activity scan, "popular stocks", market breadth, top movers) is worked out from this,
 * so no stock names are typed into the code anywhere.
 */
const CHUNK = 80;
const CONCURRENCY = 3;
const TTL_MS = 2 * 60 * 1000;
const NEAR_PERCENT = 2; // "near" a 52-week high or low

let cached = null; // { at, data }
let inflight = null;


/** One Yahoo quote -> one plain row. Returns null when it has no real price. Pure, easy to test. */
function toRow(q, meta = {}) {
  const price = q?.regularMarketPrice;
  if (!(price > 0)) return null;
  const avgVolume = q.averageDailyVolume3Month || q.averageDailyVolume10Day || null;
  const volume = q.regularMarketVolume ?? null;
  return {
    symbol: q.symbol || meta.symbol,
    name: meta.name || q.shortName || q.longName || q.symbol,
    industry: meta.industry || null,
    price: round(price),
    changePercent: round(q.regularMarketChangePercent ?? 0),
    volume,
    avgVolume,
    volumeRatio: volume && avgVolume ? round(volume / avgVolume, 1) : null,
    high52: round(q.fiftyTwoWeekHigh),
    low52: round(q.fiftyTwoWeekLow),
    marketCap: Number.isFinite(q.marketCap) ? q.marketCap : null,
    tradedValue: avgVolume ? price * avgVolume : null, // rupees traded on a typical day: how "popular" it is
    asOf: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : null,
  };
}

const isNear = (row) => (row.high52 && row.price >= row.high52 * (1 - NEAR_PERCENT / 100))
  || (row.low52 && row.price <= row.low52 * (1 + NEAR_PERCENT / 100));

/**
 * Fallback row built from a stock's last month of daily prices (Yahoo's chart data), used when the batch quote
 * endpoint is throttled. Same fields, minus market cap.
 */
function rowFromChart(result, meta = {}) {
  const m = result?.meta;
  const q = result?.indicators?.quote?.[0] || {};
  const closes = (q.close || []).map((c, i) => ({ close: c, volume: q.volume?.[i] })).filter((x) => x.close != null);
  if (!m || closes.length < 3 || !(m.regularMarketPrice > 0)) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const earlier = closes.slice(0, -1).map((x) => x.volume).filter((v) => v > 0);
  const avgVolume = earlier.length >= 5 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : null;
  const volume = m.regularMarketVolume ?? last.volume ?? null;
  return {
    symbol: meta.symbol,
    name: meta.name || m.shortName || m.longName || meta.symbol,
    industry: meta.industry || null,
    price: round(m.regularMarketPrice),
    changePercent: prev.close ? round(((m.regularMarketPrice - prev.close) / prev.close) * 100) : 0,
    volume,
    avgVolume,
    volumeRatio: volume && avgVolume ? round(volume / avgVolume, 1) : null,
    high52: round(m.fiftyTwoWeekHigh),
    low52: round(m.fiftyTwoWeekLow),
    marketCap: null,
    tradedValue: avgVolume ? m.regularMarketPrice * avgVolume : null,
    asOf: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
  };
}

const FALLBACK_CONCURRENCY = 10;
const FALLBACK_BUDGET_MS = 100000;

async function rowsFromCharts(entries) {
  const deadline = Date.now() + FALLBACK_BUDGET_MS;
  const rows = [];
  let next = 0;
  await Promise.all(Array.from({ length: FALLBACK_CONCURRENCY }, async () => {
    while (next < entries.length && Date.now() < deadline) {
      const entry = entries[next];
      next += 1;
      try {
        const chart = await marketDataService.fetchDailyChart([entry.symbol], '1mo');
        const row = chart ? rowFromChart(chart.result, entry) : null;
        if (row) rows.push(row);
      } catch {
        // one stock failing must not stop the rest
      }
    }
  }));
  return rows;
}

async function build() {
  const universe = await universeService.getUniverse();
  const bySymbol = new Map(universe.entries.map((e) => [e.symbol, e]));
  const symbols = universe.entries.map((e) => e.symbol);
  const chunks = [];
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));

  const results = await mapLimit(chunks, CONCURRENCY, (chunk) => yahooFinance.quote(chunk, {}, { validateResult: false }), []);
  let rows = [];
  for (const batch of results) {
    for (const q of Array.isArray(batch) ? batch : []) {
      const meta = bySymbol.get(q?.symbol);
      const row = meta ? toRow(q, meta) : null;
      if (row) rows.push(row);
    }
  }
  // The batch lookup is sometimes throttled: build the same table from each stock's chart data instead
  if (rows.length < universe.size * 0.5) rows = await rowsFromCharts(universe.entries);
  if (!rows.length) throw new MarketDataUnavailableError('Market data for the stock list is unavailable right now');
  return {
    asOf: rows.map((r) => r.asOf).filter(Boolean).sort().pop() || null,
    universeSize: universe.size,
    universeSource: universe.source,
    universeFetchedAt: universe.fetchedAt,
    quoted: rows.length,
    rows,
    source: 'Yahoo Finance (may be delayed)',
  };
}

/** The whole list in one snapshot, cached for 2 minutes and shared by simultaneous requests. */
async function getSnapshot({ force = false } = {}) {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  if (!inflight) {
    inflight = build()
      .then((data) => { cached = { at: Date.now(), data }; return data; })
      .catch((err) => { if (cached) return cached.data; throw err; }) // an older snapshot beats nothing
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** The most traded stocks on a typical day (price x usual volume). Replaces any typed-in "popular stocks" list. */
function popularFrom(snapshot, limit = 10) {
  return snapshot.rows
    .filter((r) => r.tradedValue)
    .sort((a, b) => b.tradedValue - a.tradedValue)
    .slice(0, limit)
    .map(({ symbol, name, industry, price, changePercent }) => ({ symbol, name, industry, price, changePercent }));
}

/** Today across the whole list: how many rose and fell, which industries led and lagged. Facts about today only. */
function breadthFrom(snapshot, { industries = 3, minPerIndustry = 5 } = {}) {
  const rows = snapshot.rows;
  const up = rows.filter((r) => r.changePercent > 0).length;
  const down = rows.filter((r) => r.changePercent < 0).length;
  const byIndustry = new Map();
  for (const r of rows) {
    if (!r.industry) continue;
    const g = byIndustry.get(r.industry) || { name: r.industry, sum: 0, count: 0 };
    g.sum += r.changePercent;
    g.count += 1;
    byIndustry.set(r.industry, g);
  }
  const ranked = [...byIndustry.values()]
    .filter((g) => g.count >= minPerIndustry)
    .map((g) => ({ name: g.name, count: g.count, avgChangePercent: round(g.sum / g.count) }))
    .sort((a, b) => b.avgChangePercent - a.avgChangePercent);
  return {
    asOf: snapshot.asOf,
    universeSize: snapshot.universeSize,
    quoted: snapshot.quoted,
    advancers: up,
    decliners: down,
    unchanged: rows.length - up - down,
    nearHigh: rows.filter((r) => r.high52 && r.price >= r.high52 * (1 - NEAR_PERCENT / 100)).length,
    nearLow: rows.filter((r) => r.low52 && r.price <= r.low52 * (1 + NEAR_PERCENT / 100)).length,
    highVolume: rows.filter((r) => r.volumeRatio >= 2).length,
    strongestIndustries: ranked.slice(0, industries),
    weakestIndustries: ranked.slice(-industries).reverse(),
    source: snapshot.source,
    universeSource: snapshot.universeSource,
  };
}

/** Biggest risers or fallers among the stocks people actually trade (the top half by traded value). */
function moversFrom(snapshot, type = 'gainers', limit = 10) {
  const liquid = snapshot.rows.filter((r) => r.tradedValue).sort((a, b) => b.tradedValue - a.tradedValue)
    .slice(0, Math.ceil(snapshot.rows.length / 2));
  const sorted = liquid.sort((a, b) => (type === 'losers' ? a.changePercent - b.changePercent : b.changePercent - a.changePercent));
  return sorted.slice(0, limit);
}

const clearCache = () => { cached = null; inflight = null; };

/**
 * Top gainers or losers among the most traded stocks of the live Nifty 500 list, shaped for the assistant.
 * No stock names are typed into the code. Throws when the market data is unavailable.
 */
async function getTopMovers(type = 'gainers', limit = 10) {
  const snapshot = await getSnapshot();
  return moversFrom(snapshot, type, limit).map((r) => ({
    instrument: r.name,
    symbol: r.symbol,
    type: 'EQUITY',
    currentPrice: r.price,
    currency: 'INR',
    dayChangePercent: r.changePercent,
    isPositive: r.changePercent >= 0,
    industry: r.industry,
    source: snapshot.source,
  }));
}

module.exports = { getSnapshot, getTopMovers, toRow, rowFromChart, isNear, popularFrom, breadthFrom, moversFrom, clearCache, NEAR_PERCENT };
