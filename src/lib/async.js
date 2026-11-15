/**
 * Run `fn` over `items` with at most `limit` running at once. Results keep the input order.
 * One failing item never stops the others: its slot gets `fallback` (null unless given).
 */
async function mapLimit(items, limit, fn, fallback = null) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]).catch(() => fallback);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Resolve with `fallback` if `promise` has not settled after `ms` (the slow work is not cancelled, just not waited for). */
function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { mapLimit, withTimeout };
