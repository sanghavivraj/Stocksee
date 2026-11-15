/** Shared way to call Yahoo Finance's public JSON endpoints: browser-like headers and a hard timeout. */
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json',
};
const YAHOO_TIMEOUT_MS = 5000;

/** The parsed JSON, or null when Yahoo answers with an error status. Network errors and timeouts throw. */
async function fetchYahooJson(url, { timeoutMs = YAHOO_TIMEOUT_MS } = {}) {
  const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) return null;
  return res.json();
}

module.exports = { YAHOO_HEADERS, YAHOO_TIMEOUT_MS, fetchYahooJson };
