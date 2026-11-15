const fs = require('fs');
const os = require('os');
const path = require('path');
const { MarketDataUnavailableError } = require('../lib/errors');

/**
 * Which stocks does StockSee look at? Not a list typed into the code: it is NSE's own published list of the
 * Nifty 500 companies (the 500 biggest, most traded listed companies), fetched live, with each company's industry.
 * NSE changes that list when companies join or leave the index, and so does this.
 *
 * Order of trust: live NSE file -> the last good copy saved on disk -> "unavailable" (never a made-up list).
 */
const SOURCES = [
  'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv',
  'https://www.niftyindices.com/IndexConstituent/ind_nifty500list.csv',
];
const SOURCE_NAME = 'NSE Nifty 500 constituents';
const REFRESH_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;
// The saved copy lives OUTSIDE the project folder on purpose: `npm run dev` (nodemon) restarts the server whenever a
// file inside the project changes, so saving it in here would make the server restart itself in a loop.
const CACHE_DIR = process.env.STOCKSEE_CACHE_DIR || path.join(os.tmpdir(), 'stocksee');
const CACHE_FILE = path.join(CACHE_DIR, 'universe-cache.json');
const TRADED_SERIES = new Set(['EQ', 'BE']); // rights entitlements (RR) and the like are not stocks you watch

let memory = null; // { fetchedAt, entries, stale, attemptedAt }
let inflight = null;

/** "Company Name,Industry,Symbol,Series,ISIN Code" rows -> [{ symbol, name, industry }]. Pure, easy to test. */
function parseConstituentsCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const col = (name) => header.findIndex((h) => h === name);
  const [iName, iIndustry, iSymbol, iSeries] = [col('company name'), col('industry'), col('symbol'), col('series')];
  if (iSymbol < 0) return [];
  const seen = new Set();
  const out = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.trim());
    const symbol = (cells[iSymbol] || '').toUpperCase();
    const series = iSeries >= 0 ? cells[iSeries] : 'EQ';
    if (!/^[A-Z0-9&-]{1,20}$/.test(symbol) || !TRADED_SERIES.has(series) || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol: `${symbol}.NS`, name: cells[iName] || symbol, industry: cells[iIndustry] || null });
  }
  return out;
}

async function fetchLive() {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) continue;
      const entries = parseConstituentsCsv(await res.text());
      if (entries.length >= 100) return entries; // a tiny result means a broken file, not a real index
    } catch {
      // try the next source
    }
  }
  return null;
}

function readDisk() {
  try {
    const saved = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    return Array.isArray(saved.entries) && saved.entries.length >= 100 ? saved : null;
  } catch {
    return null;
  }
}

function writeDisk(entries, fetchedAt) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ source: SOURCE_NAME, fetchedAt, entries }));
  } catch {
    // Saving a copy is only a convenience for the next restart
  }
}

async function refresh() {
  const entries = await fetchLive();
  if (entries) {
    const fetchedAt = new Date().toISOString();
    memory = { fetchedAt, entries, stale: false, attemptedAt: Date.now() };
    writeDisk(entries, fetchedAt);
    return memory;
  }
  const saved = readDisk();
  if (saved) {
    memory = { fetchedAt: saved.fetchedAt, entries: saved.entries, stale: true, attemptedAt: Date.now() };
    return memory;
  }
  throw new MarketDataUnavailableError('The list of stocks to scan is unavailable right now');
}

/** The stocks we scan: [{ symbol, name, industry }], plus where the list came from and how fresh it is. */
async function getUniverse() {
  // A live copy is good for a day. A copy from disk is used while we retry the live file every 10 minutes
  const fresh = memory && (memory.stale
    ? Date.now() - memory.attemptedAt < RETRY_MS
    : Date.now() - new Date(memory.fetchedAt).getTime() < REFRESH_MS);
  if (!fresh) {
    if (!inflight) inflight = refresh().finally(() => { inflight = null; });
    try {
      await inflight;
    } catch (err) {
      if (!memory) throw err;
    }
  }
  return {
    entries: memory.entries,
    size: memory.entries.length,
    source: SOURCE_NAME,
    fetchedAt: memory.fetchedAt,
    stale: memory.stale,
  };
}

const reset = () => { memory = null; inflight = null; };

module.exports = { getUniverse, parseConstituentsCsv, reset, SOURCE_NAME };
