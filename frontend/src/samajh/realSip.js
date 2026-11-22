/**
 * Real SIP history maths. Pure functions, no network, no advice: given real daily NAVs (from AMFI via mfapi.in),
 * they work out what a monthly SIP would have bought, and what it was worth on the last day.
 * Assumptions (also shown on screen): each instalment buys at the NAV of the SIP date, or of the next day that has a NAV;
 * exit load, taxes, stamp duty and other charges are ignored; the fund's running cost is already inside the NAV.
 */

export const DAY_MS = 86400000;
const YEAR_MS = 365 * DAY_MS;

/** "20-11-2026" + "95.4585" rows (mfapi.in) -> [{ t: UTC ms, nav }] sorted oldest first. Bad rows are dropped. */
export function parseNav(json) {
  const out = [];
  for (const row of (json && json.data) || []) {
    const [dd, mm, yy] = String(row.date).split('-').map(Number);
    const nav = parseFloat(row.nav);
    if (!(nav > 0) || !yy || !mm || !dd) continue;
    out.push({ t: Date.UTC(yy, mm - 1, dd), nav });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Payout (IDCW / dividend) plans drop their NAV every time they pay out, so units x NAV maths would be wrong for them. */
export const isPayoutPlan = (name) => /idcw|dividend|payout|reinvest|bonus/i.test(String(name));

/** First index whose date is on or after t. */
export function lowerBound(arr, t) {
  let lo = 0; let hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t < t) lo = mid + 1; else hi = mid; }
  return lo;
}
/** First index whose date is after t. */
export function upperBound(arr, t) {
  let lo = 0; let hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t <= t) lo = mid + 1; else hi = mid; }
  return lo;
}

/**
 * The single yearly rate that matches dated cash flows [{ t, a }] (money out is negative, money in positive).
 * Returns null when no rate fits.
 */
export function xirr(flows) {
  if (!flows || flows.length < 2) return null;
  const t0 = flows[0].t;
  const f = (r) => flows.reduce((s, c) => s + c.a / Math.pow(1 + r, (c.t - t0) / YEAR_MS), 0);
  let lo = -0.99; let hi = 50; let flo = f(lo);
  const fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2; const fm = f(mid);
    if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/**
 * The biggest fall from a high, between index a and b. `rec` is the first later index back at that high
 * (looking at all the data), or -1 if it had not got back by the last day.
 */
export function drawdown(arr, a, b) {
  let peak = arr[a].nav; let peakI = a; let best = 0; let bestPeak = a; let bestLow = a;
  for (let i = a; i <= b; i += 1) {
    if (arr[i].nav > peak) { peak = arr[i].nav; peakI = i; }
    const d = (peak - arr[i].nav) / peak;
    if (d > best) { best = d; bestPeak = peakI; bestLow = i; }
  }
  let rec = -1;
  if (best > 0) {
    const high = arr[bestPeak].nav;
    for (let i = bestLow + 1; i < arr.length; i += 1) if (arr[i].nav >= high) { rec = i; break; }
  }
  return { pct: best * 100, peak: bestPeak, low: bestLow, rec };
}

/**
 * Run a monthly SIP over real NAVs.
 * @param arr   parseNav() output
 * @param start [year, month 1-12] of the first SIP month
 * @param end   [year, month 1-12] of the last month; the SIP is valued on the last NAV on or before that month's end
 * @returns null when no instalment fits, otherwise the instalments, the daily series and the totals.
 */
export function runSip({ arr, start, end, day = 5, amount = 5000 }) {
  if (!arr || arr.length < 2) return null;
  const [sy, sm] = start; const [ey, em] = end;
  const endT = Date.UTC(ey, em, 0); // last day of the end month
  if (Date.UTC(ey, em - 1, 1) < Date.UTC(sy, sm - 1, 1)) return null;
  const first = arr[0].t;
  const buys = []; let skipped = 0;
  for (let k = 0; ; k += 1) {
    const target = Date.UTC(sy, sm - 1 + k, day);
    if (target > endT) break;
    if (target < first) continue;
    const idx = lowerBound(arr, target);
    if (idx >= arr.length || arr[idx].t > endT) break;
    if (arr[idx].t - target > 10 * DAY_MS) { skipped += 1; continue; } // a gap in the data: do not guess
    buys.push({ target, idx, t: arr[idx].t, nav: arr[idx].nav, units: amount / arr[idx].nav });
  }
  if (!buys.length) return null;
  const valIdx = upperBound(arr, endT) - 1;
  const i0 = buys[0].idx;
  const T = []; const NAV = []; const INV = []; const VAL = []; const bi = [];
  let b = 0; let units = 0; let invested = 0;
  for (let i = i0; i <= valIdx; i += 1) {
    while (b < buys.length && buys[b].idx === i) { units += buys[b].units; invested += amount; bi.push(i - i0); b += 1; }
    T.push(arr[i].t); NAV.push(arr[i].nav); INV.push(invested); VAL.push(units * arr[i].nav);
  }
  const N = T.length;
  const value = VAL[N - 1];
  const gain = value - invested;
  const spanDays = (T[N - 1] - buys[0].t) / DAY_MS;
  const flows = buys.map((x) => ({ t: x.t, a: -amount }));
  flows.push({ t: T[N - 1], a: value });
  return {
    buys, skipped, N, T, nav: NAV, inv: INV, val: VAL, bi, i0, units, invested, value, gain,
    gainPct: (gain / invested) * 100,
    xirr: spanDays >= 365 ? xirr(flows) : null, // a yearly rate over less than a year misleads, so it is not shown
    avgCost: invested / units,
    dd: drawdown(arr, i0, valIdx),
  };
}
