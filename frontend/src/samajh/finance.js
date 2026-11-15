/**
 * Samajh: every number on the page is calculated here, in plain JavaScript. Nothing is estimated by an AI.
 * These are pure functions: same inputs, same outputs. All rates are ILLUSTRATIVE assumptions chosen by the
 * caller, never promises. Money is in rupees, rates are in percent per year (12 means 12%).
 */

export const TIMINGS = ['month-end', 'month-start', 'year-end'];

const clampPositive = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Future value of equal instalments. See TIMINGS for when each instalment is counted. */
export function sipFutureValue({ monthly, annualRate, years, timing = 'month-end' }) {
  const m = clampPositive(monthly);
  const y = clampPositive(years);
  const months = Math.round(y * 12);
  const invested = m * months;
  let futureValue;
  if (timing === 'year-end') {
    // 12 instalments are added up and counted once, at the end of each year; interest is added yearly
    const i = annualRate / 100;
    const n = Math.round(y);
    futureValue = i === 0 ? m * 12 * n : m * 12 * ((((1 + i) ** n) - 1) / i);
    return { invested: m * 12 * n, futureValue, gain: futureValue - m * 12 * n, months: n * 12, timing };
  }
  const r = annualRate / 100 / 12; // monthly rate = annual rate / 12, compounded monthly
  futureValue = r === 0 ? invested : m * ((((1 + r) ** months) - 1) / r);
  if (timing === 'month-start') futureValue *= 1 + r;
  return { invested, futureValue, gain: futureValue - invested, months, timing };
}

/** Value after each year: [{ year, invested, value }] (year 0 = start). */
export function sipSchedule({ monthly, annualRate, years, timing = 'month-end' }) {
  const out = [{ year: 0, invested: 0, value: 0 }];
  for (let y = 1; y <= Math.round(years); y += 1) {
    const r = sipFutureValue({ monthly, annualRate, years: y, timing });
    out.push({ year: y, invested: r.invested, value: r.futureValue });
  }
  return out;
}

/**
 * The yearly return needed to reach `target` with a monthly SIP (found by bisection).
 * Returns the nominal rate (compounded monthly, 12 x monthly rate) and the effective yearly rate.
 */
export function requiredAnnualReturn({ monthly, years, target, timing = 'month-end' }) {
  const invested = sipFutureValue({ monthly, annualRate: 0, years, timing }).invested;
  if (!(target > 0) || !(monthly > 0) || !(years > 0)) return null;
  if (target <= invested) return { nominal: 0, effective: 0, alreadyReached: true };
  let lo = 0;
  let hi = 5; // 500% a year is far beyond anything real
  const fv = (rate) => sipFutureValue({ monthly, annualRate: rate * 100, years, timing }).futureValue;
  if (fv(hi) < target) return { nominal: null, effective: null, tooHigh: true };
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (fv(mid) < target) lo = mid; else hi = mid;
  }
  const nominal = ((lo + hi) / 2) * 100;
  const effective = timing === 'year-end' ? nominal : (((1 + nominal / 100 / 12) ** 12) - 1) * 100;
  return { nominal, effective, alreadyReached: false };
}

/** One amount growing at a yearly rate (compounded `perYear` times a year). */
export function lumpSum({ principal, annualRate, years, perYear = 1 }) {
  const n = perYear * years;
  const value = principal * ((1 + annualRate / 100 / perYear) ** n);
  return { value, gain: value - principal };
}

export const growthFactor = (annualRate, years) => (1 + annualRate / 100) ** years;

/** Yearly return needed to turn 1 into `multiple` over `years` years (CAGR), in percent. */
export function cagrFromMultiple(multiple, years) {
  if (!(multiple > 0) || !(years > 0)) return null;
  return (multiple ** (1 / years) - 1) * 100;
}

/** If a gain of `multiple` happened in `days` days and kept repeating, what would one year look like? (a multiple) */
export function annualisedMultiple(multiple, days) {
  if (!(multiple > 0) || !(days > 0)) return null;
  return multiple ** (365 / days);
}

/** Effective yearly growth when a monthly return is repeated for 12 months, in percent. */
export function annualFromMonthly(monthlyPercent) {
  return ((1 + monthlyPercent / 100) ** 12 - 1) * 100;
}

/** FD maturity with quarterly compounding (how most banks quote it). */
export function fdMaturity({ principal, annualRate, years }) {
  return lumpSum({ principal, annualRate, years, perYear: 4 }).value;
}

/**
 * What an FD really leaves you with: tax is paid on the interest, and inflation shrinks what the money can buy.
 * Tax is approximated as the slab rate applied to the interest every year (so the after-tax rate is rate x (1 - tax)).
 */
export function fdReality({ principal, annualRate, years, taxPercent, inflationPercent }) {
  const preTax = fdMaturity({ principal, annualRate, years });
  const postRate = annualRate * (1 - taxPercent / 100);
  const postTax = fdMaturity({ principal, annualRate: postRate, years });
  const todaysMoney = postTax / ((1 + inflationPercent / 100) ** years);
  return {
    preTax,
    postTax,
    interestPreTax: preTax - principal,
    taxPaid: preTax - postTax,
    postTaxRate: postRate,
    todaysMoney,
    realGain: todaysMoney - principal,
    // after tax and inflation, the yearly "real" return in percent
    realRate: ((1 + postRate / 100) / (1 + inflationPercent / 100) - 1) * 100,
  };
}

export function fdSchedule({ principal, annualRate, years, taxPercent, inflationPercent }) {
  const out = [];
  for (let y = 0; y <= years; y += 1) {
    const r = fdReality({ principal, annualRate, years: y, taxPercent, inflationPercent });
    out.push({ year: y, preTax: r.preTax, postTax: r.postTax, todaysMoney: r.todaysMoney });
  }
  return out;
}

/**
 * Systematic withdrawal: each month the balance earns the monthly return, then the withdrawal is taken out.
 * Returns the yearly balances, the month the money runs out (null if it lasts), and totals.
 */
export function swpSchedule({ corpus, monthlyWithdrawal, annualRate, years }) {
  const r = annualRate / 100 / 12;
  let balance = corpus;
  let withdrawn = 0;
  let depletedMonth = null;
  const yearly = [{ year: 0, balance: corpus }];
  const months = Math.round(years * 12);
  for (let m = 1; m <= months; m += 1) {
    balance = balance * (1 + r);
    const take = Math.min(balance, monthlyWithdrawal);
    balance -= take;
    withdrawn += take;
    if (balance <= 0.5 && depletedMonth === null) { depletedMonth = m; balance = 0; }
    if (m % 12 === 0) yearly.push({ year: m / 12, balance });
  }
  return { yearly, depletedMonth, remaining: balance, withdrawn };
}

/** The monthly withdrawal that only uses the monthly return and leaves the corpus untouched. */
export const interestOnlyWithdrawal = (corpus, annualRate) => (corpus * annualRate) / 100 / 12;

/** NAV table for a SIP: units = amount / NAV on the day. Returns per-month rows plus totals. */
export function sipUnits({ monthly, navs }) {
  const rows = navs.map((nav, i) => ({ month: i + 1, nav, units: monthly / nav }));
  const totalUnits = rows.reduce((a, r) => a + r.units, 0);
  const invested = monthly * navs.length;
  const lastNav = navs[navs.length - 1];
  return {
    rows,
    totalUnits,
    invested,
    averageCostPerUnit: invested / totalUnits,
    averageNav: navs.reduce((a, b) => a + b, 0) / navs.length,
    valueAtLastNav: totalUnits * lastNav,
  };
}

/** A fall of `fallPercent` needs a rise of what percent to get back to where you were? */
export const recoveryNeeded = (fallPercent) => (fallPercent >= 100 ? null : (1 / (1 - fallPercent / 100) - 1) * 100);

/** Value of an amount after a % change (negative = fall). */
export const afterChange = (amount, changePercent) => amount * (1 + changePercent / 100);

/** Regular monthly investing where the yearly cost (expense ratio) is taken out of the return. */
export function sipWithCost({ monthly, grossRate, costPercent, years, timing = 'month-end' }) {
  return sipFutureValue({ monthly, annualRate: grossRate - costPercent, years, timing });
}

/** PPF-style yearly deposits (deposit at the start of each year, interest added yearly). */
export function yearlyDeposits({ yearly, annualRate, years }) {
  const i = annualRate / 100;
  const out = [{ year: 0, invested: 0, value: 0 }];
  let balance = 0;
  for (let y = 1; y <= years; y += 1) {
    balance = (balance + yearly) * (1 + i);
    out.push({ year: y, invested: yearly * y, value: balance });
  }
  const last = out[out.length - 1];
  return { schedule: out, invested: last.invested, maturity: last.value, interest: last.value - last.invested };
}

/** In today's money: what future rupees can buy, if prices rise `inflationPercent` a year. */
export const todaysValue = (future, inflationPercent, years) => future / ((1 + inflationPercent / 100) ** years);

/** Jewellery vs gold ETF-style buying: how much must the gold price rise before you merely get your money back? */
export function goldBreakEven({ grams, pricePerGram, makingPercent, gstPercent, sellDeductionPercent = 0 }) {
  const metal = grams * pricePerGram;
  const paid = metal * (1 + makingPercent / 100) * (1 + gstPercent / 100);
  // On selling you are usually paid for the metal only (making charges and GST are not returned)
  const breakEvenRise = ((paid / (metal * (1 - sellDeductionPercent / 100))) - 1) * 100;
  return { metal, paid, extraPaid: paid - metal, breakEvenRise };
}
