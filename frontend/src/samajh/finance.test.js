import { describe, it, expect } from 'vitest';
import {
  sipFutureValue, sipSchedule, requiredAnnualReturn, cagrFromMultiple, annualisedMultiple, annualFromMonthly,
  fdReality, swpSchedule, interestOnlyWithdrawal, sipUnits, recoveryNeeded, yearlyDeposits, goldBreakEven, sipWithCost, lumpSum,
} from './finance';
import { formatInr, formatInrFull, fill } from './format';

describe('SIP: the acceptance example (Rs 5,000 a month for 10 years at an illustrative 12%)', () => {
  const base = { monthly: 5000, annualRate: 12, years: 10 };

  it('month-end instalments give about Rs 11.5 lakh, not Rs 1 crore', () => {
    const r = sipFutureValue({ ...base, timing: 'month-end' });
    expect(Math.round(r.futureValue)).toBe(1150193);
    expect(r.invested).toBe(600000);
    expect(formatInr(r.futureValue)).toBe('₹11.5 lakh');
    expect(formatInrFull(r.futureValue)).toBe('₹11,50,193');
    expect(r.futureValue).toBeLessThan(1e7);
  });

  it('month-start instalments give about Rs 11.6 lakh', () => {
    const r = sipFutureValue({ ...base, timing: 'month-start' });
    expect(Math.round(r.futureValue)).toBe(1161695);
    expect(formatInr(r.futureValue)).toBe('₹11.62 lakh');
  });

  it('year-end instalments (12 months counted together, interest yearly) are lower', () => {
    const r = sipFutureValue({ ...base, timing: 'year-end' });
    expect(r.futureValue).toBeGreaterThan(r.invested);
    expect(r.futureValue).toBeLessThan(sipFutureValue({ ...base, timing: 'month-end' }).futureValue);
  });

  it('needs about 43.8% a year (53.8% effective) to reach Rs 1 crore', () => {
    const need = requiredAnnualReturn({ monthly: 5000, years: 10, target: 1e7 });
    expect(need.nominal).toBeGreaterThan(43.7);
    expect(need.nominal).toBeLessThan(43.9);
    expect(need.effective).toBeGreaterThan(53.7);
    expect(need.effective).toBeLessThan(53.9);
    // and that rate really does reach the target
    expect(sipFutureValue({ ...base, annualRate: need.nominal }).futureValue).toBeGreaterThan(9.99e6);
  });

  it('handles a target that is already reached and one that is impossible', () => {
    expect(requiredAnnualReturn({ monthly: 5000, years: 10, target: 500000 }).alreadyReached).toBe(true);
    expect(requiredAnnualReturn({ monthly: 1, years: 1, target: 1e12 }).tooHigh).toBe(true);
    expect(requiredAnnualReturn({ monthly: 0, years: 10, target: 1e7 })).toBeNull();
  });

  it('builds a year by year schedule that ends at the same value', () => {
    const s = sipSchedule(base);
    expect(s).toHaveLength(11);
    expect(s[10].value).toBeCloseTo(sipFutureValue(base).futureValue, 4);
    expect(s[0].value).toBe(0);
  });

  it('zero return gives back exactly what was put in', () => {
    expect(sipFutureValue({ monthly: 1000, annualRate: 0, years: 5 }).futureValue).toBe(60000);
  });
});

describe('returns from claims', () => {
  it('doubling in 25 days, repeated for a year, would be an absurd multiple', () => {
    expect(Math.round(annualisedMultiple(2, 25))).toBe(24834);
  });
  it('a 10x needs about 58% a year over 5 years', () => {
    expect(cagrFromMultiple(10, 5)).toBeCloseTo(58.5, 1);
  });
  it('10% a month is about 214% a year when repeated', () => {
    expect(annualFromMonthly(10)).toBeCloseTo(213.8, 1);
  });
});

describe('FD: tax and inflation', () => {
  const r = fdReality({ principal: 100000, annualRate: 7, years: 5, taxPercent: 30, inflationPercent: 6 });
  it('the bank figure is higher than what you keep after tax', () => {
    expect(r.preTax).toBeGreaterThan(r.postTax);
    expect(r.taxPaid).toBeGreaterThan(0);
    expect(r.postTaxRate).toBeCloseTo(4.9, 5);
  });
  it('after tax and inflation the money buys less than it did', () => {
    expect(r.todaysMoney).toBeLessThan(100000);
    expect(r.realRate).toBeLessThan(0);
  });
  it('with no tax and no inflation the maturity is the whole story', () => {
    const z = fdReality({ principal: 100000, annualRate: 7, years: 5, taxPercent: 0, inflationPercent: 0 });
    expect(z.todaysMoney).toBeCloseTo(z.preTax, 6);
  });
});

describe('SWP: withdrawals eat the corpus', () => {
  it('withdrawing more than the return shrinks the corpus and can finish it', () => {
    const s = swpSchedule({ corpus: 5000000, monthlyWithdrawal: 40000, annualRate: 4, years: 30 });
    expect(s.depletedMonth).not.toBeNull();
    expect(s.remaining).toBe(0);
  });
  it('withdrawing only the return keeps the corpus', () => {
    const w = interestOnlyWithdrawal(5000000, 8);
    expect(Math.round(w)).toBe(33333);
    const s = swpSchedule({ corpus: 5000000, monthlyWithdrawal: w, annualRate: 8, years: 10 });
    expect(Math.round(s.remaining)).toBe(5000000);
  });
  it('total withdrawn never exceeds what was available', () => {
    const s = swpSchedule({ corpus: 100000, monthlyWithdrawal: 20000, annualRate: 0, years: 2 });
    expect(s.withdrawn).toBe(100000);
    expect(s.depletedMonth).toBe(5);
  });
});

describe('NAV and units', () => {
  const u = sipUnits({ monthly: 5000, navs: [100, 80, 100, 125] });
  it('the same amount buys more units when the NAV is low', () => {
    expect(u.rows[1].units).toBeGreaterThan(u.rows[0].units);
    expect(u.rows[0].units).toBe(50);
    expect(u.rows[1].units).toBe(62.5);
  });
  it('the average cost per unit is below the average NAV when prices swing', () => {
    expect(u.averageCostPerUnit).toBeLessThan(u.averageNav);
    expect(u.invested).toBe(20000);
  });
});

describe('other helpers', () => {
  it('a 50% fall needs a 100% rise to recover', () => {
    expect(recoveryNeeded(50)).toBeCloseTo(100, 6);
    expect(recoveryNeeded(60)).toBeCloseTo(150, 6);
  });
  it('yearly deposits add up', () => {
    const p = yearlyDeposits({ yearly: 100000, annualRate: 7.1, years: 15 });
    expect(p.invested).toBe(1500000);
    expect(p.maturity).toBeGreaterThan(p.invested);
  });
  it('jewellery must rise before you break even, a plain gold purchase barely needs to', () => {
    const j = goldBreakEven({ grams: 10, pricePerGram: 7000, makingPercent: 10, gstPercent: 3 });
    expect(j.breakEvenRise).toBeGreaterThan(13);
  });
  it('a higher yearly cost lowers the end value', () => {
    const cheap = sipWithCost({ monthly: 10000, grossRate: 12, costPercent: 0.2, years: 15 }).futureValue;
    const dear = sipWithCost({ monthly: 10000, grossRate: 12, costPercent: 1.5, years: 15 }).futureValue;
    expect(dear).toBeLessThan(cheap);
  });
  it('lump sum compounds', () => {
    expect(lumpSum({ principal: 100, annualRate: 10, years: 2 }).value).toBeCloseTo(121, 6);
  });
});

describe('format', () => {
  it('writes lakh and crore, in Hindi too', () => {
    expect(formatInr(1e7)).toBe('₹1 crore');
    expect(formatInr(1e7, 'hi')).toBe('₹1 करोड़');
    expect(formatInr(1150193, 'hi')).toBe('₹11.5 लाख');
    expect(formatInr(45000)).toBe('₹45,000');
  });
  it('fills templates and flags unknown names', () => {
    expect(fill('Pay {{a|inr}} for {{b}} years at {{c|pct}}', { a: 600000, b: 10, c: 12 })).toBe('Pay ₹6 lakh for 10 years at 12%');
    expect(fill('{{nope}}', {})).toContain('missing:nope');
  });
});
