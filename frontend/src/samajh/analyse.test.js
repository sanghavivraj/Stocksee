import { describe, it, expect } from 'vitest';
import { analyseClaim, presets, classifyReturn, durationText } from './analyse';

const SECTIONS = ['math', 'hidden', 'missing', 'realistic', 'redFlags', 'verdict'];
const noPlaceholders = (obj) => expect(JSON.stringify(obj)).not.toMatch(/⟦|NaN|undefined|Infinity/);

describe('the mandatory acceptance example', () => {
  const r = analyseClaim('₹5,000 SIP = ₹1 crore in 10 years.', {}, 'en');

  it('calculates about ₹11.5 lakh at an illustrative 12%, not ₹1 crore', () => {
    expect(r.status).toBe('ok');
    const lines = r.math.lines.map((l) => `${l.label} ${l.value}`).join('\n');
    expect(lines).toContain('₹11,50,193');
    expect(lines).toContain('₹6,00,000');
    expect(r.facts.fv).toBeGreaterThan(1150000);
    expect(r.facts.fv).toBeLessThan(1151000);
  });

  it('shows the required return for ₹1 crore, calculated in JavaScript, and flags it as unrealistic', () => {
    expect(r.facts.needNominal).toBeGreaterThan(43.7);
    expect(r.facts.needNominal).toBeLessThan(43.9);
    expect(r.cls).toBe('mathematically_unrealistic');
    expect(r.verdict.label).toBe('Mathematically unrealistic');
    expect(r.verdict.lines).toHaveLength(2);
    expect(r.verdict.lines.join(' ')).toMatch(/43\.8%/);
  });

  it('start-of-month timing gives about ₹11.6 lakh and the user can choose it', () => {
    const s = analyseClaim('₹5,000 SIP = ₹1 crore in 10 years.', { timing: 'month-start' }, 'en');
    expect(s.facts.fv).toBeGreaterThan(1161000);
    expect(s.facts.fv).toBeLessThan(1162000);
    expect(s.controls).toEqual(expect.arrayContaining(['timing', 'years', 'rate']));
  });

  it('year-end timing is also selectable and changes the answer', () => {
    const y = analyseClaim('₹5,000 SIP = ₹1 crore in 10 years.', { timing: 'year-end' }, 'en');
    expect(y.facts.fv).not.toBe(r.facts.fv);
    expect(y.facts.fv).toBeLessThan(1e7);
  });

  it('the user can change the years and the return', () => {
    const a = analyseClaim('₹5,000 SIP = ₹1 crore in 10 years.', { years: 25, rate: 12 }, 'en');
    expect(a.facts.fv).toBeGreaterThan(8e6);
    const b = analyseClaim('₹5,000 SIP = ₹1 crore in 10 years.', { rate: 0 }, 'en');
    expect(b.facts.fv).toBe(600000);
  });

  it('marks calculated lines separately from market-dependent estimates', () => {
    const kinds = new Set(r.math.lines.map((l) => l.kind));
    expect(kinds.has('calculated')).toBe(true);
    expect(kinds.has('estimate')).toBe(true);
  });
});

describe.each(['en', 'hi'])('all five presets work offline and are complete (%s)', (lang) => {
  it.each(presets.map((p) => [p.id, p.text]))('%s', (id, text) => {
    const r = analyseClaim(text[lang], {}, lang);
    expect(r.status).toBe('ok');
    for (const s of SECTIONS) expect(r[s], s).toBeTruthy();
    expect(r.math.formula.length).toBeGreaterThan(10);
    expect(r.math.assumptions.length).toBeGreaterThanOrEqual(2);
    expect(r.hidden.length).toBeGreaterThanOrEqual(2);
    expect(r.missing.length).toBeGreaterThanOrEqual(2);
    expect(r.realistic.normal.length).toBeGreaterThan(20);
    expect(r.realistic.bad.length).toBeGreaterThan(20);
    expect(r.verdict.lines).toHaveLength(2);
    expect(r.cls).not.toBe('unverifiable-fallback');
    noPlaceholders(r);
  });
});

describe('what each preset concludes', () => {
  const run = (t) => analyseClaim(t, {}, 'en');
  it('double in 25 days is mathematically unrealistic, with the numbers shown', () => {
    const r = run('Double your money in 25 days.');
    expect(r.cls).toBe('mathematically_unrealistic');
    expect(r.facts.perDay).toBeGreaterThan(2.8);
    expect(r.facts.perDay).toBeLessThan(2.9);
    expect(Math.round(r.facts.perYear)).toBe(24834);
    expect(r.redFlags.map((f) => f.code)).toEqual(expect.arrayContaining(['quick_riches', 'unrealistic_math']));
  });
  it('FD is dead is misleading and shows the FD after tax and in today’s money', () => {
    const r = run('FD is dead, only stocks make money.');
    expect(r.cls).toBe('misleading');
    expect(r.facts.fdToday).toBeLessThan(r.facts.fdPost);
    expect(r.facts.eqBad).toBeLessThan(r.facts.fdPost); // the 'poor case is below the FD' sentence must be true
    expect(r.realistic.bad).toContain('below the FD');
    expect(r.redFlags.map((f) => f.code)).toContain('misleading_comparison');
  });
  it('SWP salary is incomplete, with how long the money lasts', () => {
    const r = run('SWP = guaranteed monthly salary.');
    expect(r.cls).toBe('incomplete');
    expect(r.facts.outcome).toMatch(/runs out/);
    expect(r.redFlags.map((f) => f.code)).toContain('guaranteed');
  });
  it('a stock 10x with no time is unverifiable and shows the return it needs', () => {
    const r = run('This stock will 10x.');
    expect(r.cls).toBe('unverifiable');
    expect(r.facts.cagr5).toBeGreaterThan(58);
    expect(r.facts.cagr5).toBeLessThan(59);
  });
});

describe('claims that can be true are not called false', () => {
  it('a modest SIP target is "possible, not guaranteed"', () => {
    const r = analyseClaim('₹10,000 SIP = ₹20 lakh in 10 years', {}, 'en');
    expect(r.cls).toBe('possible');
    expect(r.verdict.label).toMatch(/Possible/);
    expect(r.verdict.lines.join(' ')).toMatch(/not guaranteed|Real returns/i);
  });
  it('a stretch target is flagged misleading, not impossible', () => {
    const r = analyseClaim('₹10,000 SIP = ₹30 lakh in 10 years', {}, 'en');
    expect(r.facts.needNominal).toBeGreaterThan(12);
    expect(r.facts.needNominal).toBeLessThan(18);
    expect(r.cls).toBe('misleading');
  });
  it('doubling over a long time is possible in principle, over a short time it needs a stretch', () => {
    expect(analyseClaim('double your money in 8 years', {}, 'en').cls).toBe('possible');
    expect(analyseClaim('double your money in 6 years', {}, 'en').cls).toBe('misleading');
  });
  it('classifyReturn thresholds', () => {
    expect(classifyReturn(8)).toBe('possible');
    expect(classifyReturn(15)).toBe('misleading');
    expect(classifyReturn(44)).toBe('mathematically_unrealistic');
    expect(classifyReturn(null)).toBe('mathematically_unrealistic');
  });
});

describe('guards', () => {
  it('refuses tip and prediction requests with the exact line', () => {
    const r = analyseClaim('Which stock should I buy today?', {}, 'en');
    expect(r.status).toBe('refused');
    expect(r.message).toBe('We do not predict direction. Nobody can do it reliably, and calling it would be a tip.');
    expect(analyseClaim('Will Nifty go up tomorrow?', {}, 'hi').message).toMatch(/भविष्यवाणी नहीं/);
  });
  it('handles empty, short, long and meaningless input', () => {
    expect(analyseClaim('', {}, 'en')).toMatchObject({ status: 'invalid', reason: 'empty' });
    expect(analyseClaim('hi', {}, 'en')).toMatchObject({ status: 'invalid', reason: 'too_short' });
    expect(analyseClaim('x'.repeat(600), {}, 'en')).toMatchObject({ status: 'invalid', reason: 'too_long' });
    expect(analyseClaim('!!!!!!!!!!', {}, 'en')).toMatchObject({ status: 'invalid', reason: 'no_meaning' });
  });
  it('an unsupported claim is called unverifiable and nothing is invented', () => {
    const r = analyseClaim('This is the best opportunity of your life. Limited seats, join my group now', {}, 'en');
    expect(r.status).toBe('ok');
    expect(r.cls).toBe('unverifiable');
    expect(r.math.lines).toHaveLength(0);
    expect(r.redFlags.map((f) => f.code)).toEqual(expect.arrayContaining(['urgency', 'paid_group']));
  });
  it('never implies certainty about the future in any verdict', () => {
    for (const p of presets) {
      for (const lang of ['en', 'hi']) {
        const r = analyseClaim(p.text[lang], {}, lang);
        expect(r.verdict.lines.join(' ').toLowerCase()).not.toMatch(/\bwill (definitely|surely|certainly)|you will (earn|make|get rich)|guaranteed to/);
      }
    }
  });
});

describe('helpers', () => {
  it('durations read naturally', () => {
    expect(durationText(25, 'en')).toBe('25 days');
    expect(durationText(90, 'en')).toBe('3 months');
    expect(durationText(730, 'en')).toBe('2 years');
    expect(durationText(25, 'hi')).toBe('25 दिन');
  });
});
