import { describe, it, expect } from 'vitest';
import { TEXT, TOTAL, price, zoom, idxAt, BEATS, MOODS } from './journeyEngine';

describe("the Investor's Journey opening", () => {
  it('has the words in all three languages, with no gaps', () => {
    for (const lang of ['en', 'hi', 'gu']) {
      const T = TEXT[lang];
      expect(T.caps, lang).toHaveLength(5);
      T.caps.forEach((pair) => { expect(pair).toHaveLength(2); pair.forEach((l) => expect(l.trim()).not.toBe('')); });
      expect(T.end).toHaveLength(2);
      expect(T.tag).toHaveLength(2);
      for (const k of ['foot', 'entry', 'port', 'hint']) expect(T[k], `${lang}.${k}`).toBeTruthy();
    }
    expect(TEXT.gu.tag).not.toEqual(TEXT.en.tag); // Gujarati has its own tagline
  });

  it('says it is an illustration and promises nothing', () => {
    expect(TEXT.en.foot.toLowerCase()).toContain('does not guarantee');
    const all = JSON.stringify(TEXT).toLowerCase();
    expect(all).not.toMatch(/\b(you should|must buy|should buy|best|sure shot|target price|buy now|sell now)\b/);
  });

  it('tells the story in order: starts at the entry price, falls, stays low for a while, then recovers', () => {
    expect(price(0)).toBe(0);
    const samples = Array.from({ length: 400 }, (_, i) => price((i / 399) * 8300));
    expect(samples.every(Number.isFinite)).toBe(true);
    expect(Math.max(...samples.slice(0, 100))).toBeGreaterThan(8); // the excited start
    expect(Math.min(...samples)).toBeLessThan(-12); // the fall
    expect(samples.slice(130, 280).every((v) => v < 0)).toBe(true); // it stays below entry through the patient part
    expect(samples[samples.length - 1]).toBeGreaterThan(5); // and ends above entry in this illustration
  });

  it('changes mood at the same moment the chart turns, in five beats', () => {
    expect(BEATS.map((b) => b[0])).toEqual(['excited', 'worried', 'patient', 'focused', 'proud']);
    BEATS.forEach((b, i) => { expect(idxAt(b[1] + 1)).toBe(i); if (i) expect(idxAt(b[1] - 1)).toBe(i - 1); });
    // the worried beat starts when the price starts to fall
    expect(price(BEATS[1][1] + 400)).toBeLessThan(price(BEATS[1][1]) - 3);
    Object.values(MOODS).forEach((m) => { expect(m.mouth).toBeTruthy(); expect(m.arm).toHaveLength(2); expect(m.g).toHaveLength(3); });
  });

  it('keeps the camera zoom in a sensible range and the whole story inside 12 seconds', () => {
    for (let t = 0; t <= 9000; t += 100) { const z = zoom(t); expect(z).toBeGreaterThan(0.85); expect(z).toBeLessThan(1.4); }
    expect(TOTAL).toBeLessThanOrEqual(12000);
  });
});
