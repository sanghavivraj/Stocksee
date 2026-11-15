/**
 * A small in-memory cache with a size limit. The oldest entry is dropped when it is full.
 * The caller decides how fresh an entry must be at read time (`maxAgeMs`), so one cache can serve
 * data with different freshness needs (e.g. quotes vs earnings dates).
 */
function createTtlCache({ maxEntries = 1000 } = {}) {
  const entries = new Map();
  return {
    /** The cached value, or undefined when missing or older than maxAgeMs. */
    get(key, maxAgeMs = Infinity) {
      const entry = entries.get(key);
      return entry && Date.now() - entry.at < maxAgeMs ? entry.data : undefined;
    },
    set(key, data) {
      if (!entries.has(key) && entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      entries.set(key, { at: Date.now(), data });
    },
    clear() { entries.clear(); },
    get size() { return entries.size; },
  };
}

module.exports = { createTtlCache };
