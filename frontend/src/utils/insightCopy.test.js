import { describe, it, expect } from 'vitest';
import { contextLine, daySentence, formatPercent } from './insightCopy';

describe('insightCopy', () => {
  it('formats signed percents', () => {
    expect(formatPercent(-2.1)).toBe('−2.10%');
    expect(formatPercent(0.5)).toBe('+0.50%');
  });

  it('builds a factual context line', () => {
    const line = contextLine({ symbol: 'TCS.NS', changePercent: -2.1, volumeRatio: 3.2, niftyChangePercent: -0.4, relation: 'on_its_own' }, 'en');
    expect(line).toBe('−2.10% on 3.2× normal volume · NIFTY −0.40% · moved on its own, the market does not explain it');
  });

  it('leaves out volume when it is not high and never invents missing parts', () => {
    expect(contextLine({ symbol: 'A', changePercent: 0.8, volumeRatio: 1.1, niftyChangePercent: null, relation: null }, 'en')).toBe('+0.80%');
    expect(contextLine({ symbol: 'A', changePercent: null }, 'en')).toBe('');
  });

  it('summarises a watchlist in one sentence', () => {
    const items = [
      { symbol: 'TCS.NS', changePercent: -1.4, niftyChangePercent: -0.6, relation: 'with_market' },
      { symbol: 'RELIANCE.NS', changePercent: 0.4, niftyChangePercent: -0.6, relation: null },
      { symbol: 'SUZLON.NS', changePercent: -4, niftyChangePercent: -0.6, relation: 'on_its_own' },
    ];
    expect(daySentence(items, 'en')).toBe('1 of your 3 stocks rose, 2 fell. NIFTY −0.60%. SUZLON moved on its own, not just with the market.');
    expect(daySentence([], 'en')).toBe('');
    expect(daySentence([{ symbol: 'A', changePercent: 0 }, { symbol: 'B', changePercent: 1 }], 'en')).toBe('1 of your 2 stocks rose, 0 fell, 1 unchanged.');
  });

  it('works in Hindi and Gujarati and falls back to English', () => {
    const items = [{ symbol: 'TCS.NS', changePercent: 1, niftyChangePercent: null, relation: null }];
    expect(daySentence(items, 'hi')).toContain('आपके 1 शेयरों');
    expect(daySentence(items, 'gu')).toContain('તમારા 1 શેર');
    expect(daySentence(items, 'xx')).toContain('of your 1');
  });

  it('never uses advice words', () => {
    const all = JSON.stringify([contextLine({ symbol: 'A', changePercent: 5, volumeRatio: 9, niftyChangePercent: 0, relation: 'on_its_own' }), daySentence([{ symbol: 'A', changePercent: 5, relation: 'on_its_own' }])]);
    expect(all).not.toMatch(/buy|sell|target|will (rise|fall|go)|should/i);
  });
});
