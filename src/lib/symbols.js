/** What a stock/index/commodity symbol may look like in a URL query: TCS.NS, ^NSEI, GC=F, M&M.NS ... */
const SYMBOL_PATTERN = /^[A-Za-z0-9&.^=-]{1,30}$/;

const isSymbolLike = (value) => typeof value === 'string' && SYMBOL_PATTERN.test(value.trim());

/** "TCS.NS, INFY.NS,<junk>" -> ['TCS.NS', 'INFY.NS']. Junk is dropped; `max` (optional) caps the list. */
function parseSymbolList(value, max = Infinity) {
  return String(value || '').split(',').map((s) => s.trim())
    .filter((s) => SYMBOL_PATTERN.test(s))
    .slice(0, max);
}

/** A "limit" query value as a whole number kept inside min..max; missing or non-numeric uses `fallback`. */
function clampInt(value, { fallback, min = 1, max }) {
  return Math.min(Math.max(parseInt(value, 10) || fallback, min), max);
}

module.exports = { SYMBOL_PATTERN, isSymbolLike, parseSymbolList, clampInt };
