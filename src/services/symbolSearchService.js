/**
 * Typeahead search for stocks, indices and commodities.
 *
 * 1. Local: the bundled NSE company list (instant, works from the first letter, e.g. "D" -> DECNGOLD).
 * 2. Remote (2+ characters): Yahoo Finance search, keeping only Indian results. This adds BSE-only
 *    companies and very new listings that are not in the bundled list yet.
 *
 * Every suggestion is a real listed instrument; nothing is invented.
 */
const { rows: NSE_ROWS } = require('../constants/nseEquities.json');
const { createTtlCache } = require('../lib/ttlCache');
const { fetchYahooJson } = require('../lib/yahooHttp');

const FETCH_TIMEOUT_MS = 2500;
const REMOTE_CACHE_MS = 10 * 60 * 1000;
const REMOTE_CACHE_MAX = 500;
const remoteCache = createTtlCache({ maxEntries: REMOTE_CACHE_MAX });

/** Indices and commodities users can also watch (symbols match what the watchlist stores). */
const EXTRAS = [
  { symbol: '^NSEI', code: 'NIFTY 50', name: 'NIFTY 50 Index', exchange: 'INDEX', keywords: ['NIFTY', 'NIFTY50', 'NIFTY 50'] },
  { symbol: '^BSESN', code: 'SENSEX', name: 'BSE SENSEX Index', exchange: 'INDEX', keywords: ['SENSEX', 'BSE'] },
  { symbol: 'NIFTYBANK', code: 'BANK NIFTY', name: 'NIFTY Bank Index', exchange: 'INDEX', keywords: ['BANKNIFTY', 'BANK NIFTY', 'NIFTYBANK'] },
  { symbol: 'GOLD', code: 'GOLD', name: 'Gold (COMEX futures)', exchange: 'COMMODITY', keywords: ['GOLD'] },
  { symbol: 'SILVER', code: 'SILVER', name: 'Silver (COMEX futures)', exchange: 'COMMODITY', keywords: ['SILVER'] },
  { symbol: 'CRUDEOIL', code: 'CRUDE OIL', name: 'Crude Oil (WTI futures)', exchange: 'COMMODITY', keywords: ['CRUDE', 'CRUDEOIL', 'OIL'] },
];

// Pre-computed once: upper-cased names and their word starts for fast matching
const NSE_INDEX = NSE_ROWS.map(([code, name]) => {
  const upperName = name.toUpperCase();
  return { code, name, upperName, words: upperName.split(/[^A-Z0-9&]+/).filter(Boolean) };
});
const NSE_CODES = new Set(NSE_ROWS.map(([code]) => code));

/** Clean user input: upper-case, drop a typed .NS/.BO suffix, collapse spaces. */
function normalizeQuery(q) {
  return String(q || '').toUpperCase().replace(/[^A-Z0-9 &.\-^=]/g, '').replace(/\s+/g, ' ').trim().replace(/\.(NS|BO)$/, '').slice(0, 40);
}

/** Higher is better; 0 = no match. */
function scoreEntry(q, code, upperName, words) {
  if (code === q) return 100;
  if (code.startsWith(q)) return 80;
  if (upperName.startsWith(q)) return 70;
  if (words.some((w) => w.startsWith(q))) return 55;
  if (q.length >= 2 && code.includes(q)) return 35;
  if (q.length >= 3 && upperName.includes(q)) return 25;
  return 0;
}

function searchLocal(q, limit) {
  const hits = [];
  for (const e of EXTRAS) {
    const s = Math.max(
      scoreEntry(q, e.code, e.name.toUpperCase(), e.name.toUpperCase().split(' ')),
      e.keywords.some((k) => k.startsWith(q)) ? 75 : 0,
    );
    if (s) hits.push({ s, item: { symbol: e.symbol, code: e.code, name: e.name, exchange: e.exchange } });
  }
  for (const e of NSE_INDEX) {
    const s = scoreEntry(q, e.code, e.upperName, e.words);
    if (s) hits.push({ s, item: { symbol: `${e.code}.NS`, code: e.code, name: e.name, exchange: 'NSE' } });
  }
  // Best score first, then shorter codes (usually the main company), then A-Z
  hits.sort((a, b) => b.s - a.s || a.item.code.length - b.item.code.length || a.item.code.localeCompare(b.item.code));
  return hits.slice(0, limit).map((h) => h.item);
}

async function searchRemote(q) {
  const cached = remoteCache.get(q, REMOTE_CACHE_MS);
  if (cached) return cached;

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&region=IN&lang=en-IN`;
  const data = await fetchYahooJson(url, { timeoutMs: FETCH_TIMEOUT_MS });
  if (!data) return [];
  const items = (data.quotes || [])
    .filter((x) => typeof x.symbol === 'string' && /\.(NS|BO)$/.test(x.symbol) && ['EQUITY', 'ETF'].includes(x.quoteType))
    .map((x) => ({
      symbol: x.symbol,
      code: x.symbol.replace(/\.(NS|BO)$/, ''),
      name: x.longname || x.shortname || x.symbol,
      exchange: x.symbol.endsWith('.BO') ? 'BSE' : 'NSE',
    }));

  remoteCache.set(q, items);
  return items;
}

/**
 * @param {string} query   what the user typed (1+ characters)
 * @param {{ limit?: number, remote?: boolean, fetchRemote?: (q:string) => Promise<object[]> }} options
 * @returns {Promise<Array<{symbol:string, code:string, name:string, exchange:'NSE'|'BSE'|'INDEX'|'COMMODITY'}>>}
 */
async function search(query, { limit = 8, remote = true, fetchRemote = searchRemote } = {}) {
  const q = normalizeQuery(query);
  if (!q) return [];

  const results = searchLocal(q, limit);
  if (!remote || q.length < 2 || results.length >= limit) return results;

  // Top up with Indian results the bundled list doesn't have (BSE-only companies, new listings)
  const remoteItems = await fetchRemote(q).catch(() => []);
  const seen = new Set(results.map((r) => r.code));
  for (const item of remoteItems) {
    if (results.length >= limit) break;
    // Prefer NSE: skip a BSE line when the same company code trades on NSE
    if (seen.has(item.code) || (item.exchange === 'BSE' && NSE_CODES.has(item.code))) continue;
    seen.add(item.code);
    results.push(item);
  }
  return results;
}

const EXTRA_SYMBOLS = new Set(EXTRAS.map((e) => e.symbol));
const validCache = createTtlCache({ maxEntries: REMOTE_CACHE_MAX }); // exact-symbol remote checks, so a repeated check never hits the network twice

/**
 * Is this exactly a real, listed instrument? (Used to reject made-up watchlist/alert symbols like "C".)
 *   1. NSE master list, indices and commodities: instant, offline.
 *   2. Otherwise (BSE-only companies, brand-new listings): exact symbol must appear in the exchange search.
 * Typed text such as "C" or "xyz" is never "valid" just because it looks like a ticker.
 */
async function isValidSymbol(symbol, { fetchRemote = searchRemote } = {}) {
  const s = String(symbol || '').trim().toUpperCase();
  if (!s) return false;
  if (EXTRA_SYMBOLS.has(s)) return true;
  if (s.endsWith('.NS')) return NSE_CODES.has(s.slice(0, -3)) || remoteHas(s, fetchRemote);
  if (s.endsWith('.BO')) return remoteHas(s, fetchRemote);
  return NSE_CODES.has(s); // a bare code means the NSE listing
}

async function remoteHas(symbol, fetchRemote) {
  if (validCache.get(symbol)) return true;
  const base = symbol.replace(/\.(NS|BO)$/, '');
  const found = (await fetchRemote(base).catch(() => [])).some((x) => x.symbol === symbol);
  if (found) validCache.set(symbol, true); // only remember positives: a network blip must not block a stock for good
  return found;
}

module.exports = { search, normalizeQuery, searchLocal, isValidSymbol };
