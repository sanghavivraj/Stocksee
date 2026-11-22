/**
 * Real mutual fund prices. Daily NAVs published by AMFI, read through the free mfapi.in service
 * (a community copy, not run by AMFI). Only what the person types in the search box is sent; nothing personal.
 */
const API = 'https://api.mfapi.in/mf';

async function getJson(url, timeoutMs = 25000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`mfapi ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** [{ schemeCode, schemeName }] */
export const searchFunds = (query) => getJson(`${API}/search?q=${encodeURIComponent(String(query).trim())}`);

/** { meta, data: [{ date, nav }] } for one scheme code. */
export function fetchScheme(code) {
  const n = Number(code);
  if (!Number.isInteger(n) || n <= 0) return Promise.reject(new Error('bad scheme code'));
  return getJson(`${API}/${n}`);
}
