import { describe, it, expect } from 'vitest';
import { parseNav, isPayoutPlan, lowerBound, upperBound, xirr, drawdown, runSip, DAY_MS } from './realSip';

const d = (y, m, day) => Date.UTC(y, m - 1, day);

describe('parseNav', () => {
  it('reads dd-mm-yyyy rows, sorts oldest first and drops bad rows', () => {
    const out = parseNav({ data: [{ date: '05-02-2021', nav: '20.5' }, { date: '05-01-2021', nav: '10' }, { date: '06-01-2021', nav: '0' }, { date: 'x', nav: '3' }] });
    expect(out).toEqual([{ t: d(2021, 1, 5), nav: 10 }, { t: d(2021, 2, 5), nav: 20.5 }]);
  });
  it('copes with missing data', () => { expect(parseNav(null)).toEqual([]); expect(parseNav({})).toEqual([]); });
});

describe('isPayoutPlan', () => {
  it('flags plans that pay money out', () => {
    expect(isPayoutPlan('X Fund - Monthly IDCW Payout')).toBe(true);
    expect(isPayoutPlan('X Fund - Dividend Reinvestment')).toBe(true);
    expect(isPayoutPlan('X Fund - Direct Plan - Growth')).toBe(false);
  });
});

describe('bounds', () => {
  const arr = [{ t: 10 }, { t: 20 }, { t: 30 }];
  it('finds the first date on/after and after', () => {
    expect(lowerBound(arr, 20)).toBe(1); expect(lowerBound(arr, 21)).toBe(2); expect(lowerBound(arr, 31)).toBe(3);
    expect(upperBound(arr, 20)).toBe(2); expect(upperBound(arr, 5)).toBe(0);
  });
});

describe('xirr', () => {
  it('10% over one year', () => {
    const r = xirr([{ t: 0, a: -1000 }, { t: 365 * DAY_MS, a: 1100 }]);
    expect(r).toBeCloseTo(0.1, 4);
  });
  it('is null when there is no sign change', () => {
    expect(xirr([{ t: 0, a: -1000 }, { t: 365 * DAY_MS, a: -5 }])).toBeNull();
    expect(xirr([{ t: 0, a: -1000 }])).toBeNull();
  });
});

describe('drawdown', () => {
  const mk = (navs) => navs.map((nav, i) => ({ t: d(2020, 1, 1) + i * DAY_MS, nav }));
  it('finds the biggest fall and when it got back', () => {
    const arr = mk([100, 120, 60, 90, 130]);
    expect(drawdown(arr, 0, 4)).toEqual({ pct: 50, peak: 1, low: 2, rec: 4 });
  });
  it('says rec = -1 when it never got back', () => {
    expect(drawdown(mk([100, 120, 60, 90]), 0, 3).rec).toBe(-1);
  });
  it('is 0 for a rising series', () => { expect(drawdown(mk([1, 2, 3]), 0, 2).pct).toBe(0); });
});

describe('runSip', () => {
  // 5 Jan: NAV 10. 5 Feb is a holiday, so 8 Feb (NAV 20) is used. 5 Mar: NAV 25. Valued on 31 Mar at 30.
  const arr = [
    { t: d(2021, 1, 1), nav: 9 }, { t: d(2021, 1, 5), nav: 10 }, { t: d(2021, 2, 8), nav: 20 },
    { t: d(2021, 3, 5), nav: 25 }, { t: d(2021, 3, 31), nav: 30 }, { t: d(2021, 4, 6), nav: 99 },
  ];
  const r = runSip({ arr, start: [2021, 1], end: [2021, 3], day: 5, amount: 1000 });
  it('uses the NAV of the next day when the SIP date has none', () => {
    expect(r.buys.map((b) => b.nav)).toEqual([10, 20, 25]);
    expect(r.buys[1].t).toBe(d(2021, 2, 8));
  });
  it('adds up units, money in and worth on the last day of the end month', () => {
    expect(r.units).toBeCloseTo(100 + 50 + 40, 6);
    expect(r.invested).toBe(3000);
    expect(r.value).toBeCloseTo(190 * 30, 6);
    expect(r.gain).toBeCloseTo(2700, 6);
    expect(r.gainPct).toBeCloseTo(90, 6);
    expect(r.avgCost).toBeCloseTo(3000 / 190, 6);
  });
  it('does not use prices after the end month', () => { expect(r.T[r.N - 1]).toBe(d(2021, 3, 31)); });
  it('shows no yearly rate for a period under a year', () => { expect(r.xirr).toBeNull(); });
  it('returns null when nothing fits or dates are reversed', () => {
    expect(runSip({ arr, start: [2030, 1], end: [2030, 3] })).toBeNull();
    expect(runSip({ arr, start: [2021, 3], end: [2021, 1] })).toBeNull();
  });
  it('skips a month when the data has a gap of more than 10 days', () => {
    const gap = [{ t: d(2021, 1, 5), nav: 10 }, { t: d(2021, 2, 20), nav: 20 }, { t: d(2021, 3, 5), nav: 25 }, { t: d(2021, 3, 31), nav: 30 }];
    const g = runSip({ arr: gap, start: [2021, 1], end: [2021, 3], amount: 1000 });
    expect(g.skipped).toBe(1);
    expect(g.buys).toHaveLength(2);
  });
});
