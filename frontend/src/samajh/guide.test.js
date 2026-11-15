import { describe, it, expect } from 'vitest';
import guide from '../content/samajh/time-guide.json';
import { CARD_IDS } from './cardMath';

const FACTORS = ['liquidity', 'volatility', 'inflation', 'capital'];
const text = JSON.stringify(guide).toLowerCase();

describe('Money-Time Guide content', () => {
  it('has the four time horizons the page asks about', () => {
    expect(guide.horizons.map((h) => h.label.en)).toEqual(['Less than 1 year', '1–3 years', '3–5 years', '5+ years']);
  });

  describe.each(guide.horizons)('$id', (h) => {
    it('explains liquidity, volatility, inflation and capital preservation, in English and Hindi', () => {
      for (const f of FACTORS) {
        expect(h.factors[f].en.length).toBeGreaterThan(20);
        expect(h.factors[f].hi.length).toBeGreaterThan(10);
      }
      expect(h.matters.en.length).toBe(h.matters.hi.length);
    });
    it('names broad types with a reason, and says what is less suited and why', () => {
      expect(h.types.length).toBeGreaterThanOrEqual(2);
      expect(h.lessSuited.length).toBeGreaterThanOrEqual(1);
      for (const t of [...h.types, ...h.lessSuited]) {
        expect(t.name.en && t.name.hi && t.why.en && t.why.hi).toBeTruthy();
        t.cards.forEach((id) => expect(CARD_IDS).toContain(id)); // every link goes to a real Money Card
      }
    });
    it('links to at least one Money Card', () => {
      expect([...h.types, ...h.lessSuited].some((t) => t.cards.length > 0)).toBe(true);
    });
  });

  it('is labelled as a general principle and never recommends a product, fund, stock or return', () => {
    expect(guide.ui.en.principle).toBe('General principle, not personal advice.');
    expect(guide.ui.hi.principle).toBeTruthy();
    expect(text).not.toMatch(/\byou should (buy|sell|invest)|\bbest (stock|fund|scheme)|\bguaranteed (return|profit)|\bwill (rise|grow|double|beat)\b/);
    // no brand or scheme names beyond the generic PPF card
    expect(text).not.toMatch(/hdfc|icici|sbi\b|nippon|axis bank|zerodha|groww|reliance|tcs\b|nifty 50 index fund/);
  });

  it('keeps the unavoidable risk reminder', () => {
    expect(guide.ui.en.caution).toMatch(/No investment is risk-free/);
  });
});
