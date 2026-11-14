const scorecardService = require('../src/services/scorecardService');
const { DISCLAIMER } = require('../src/services/scorecardService');

const trend = (overrides = {}) => ({
  symbol: 'RELIANCE.NS',
  instrument: 'Reliance Industries Ltd',
  currentPrice: 2500,
  currency: 'INR',
  dayChangePercent: 1.2,
  weekChangePercent: -0.5,
  monthChangePercent: 3.1,
  dayLow: 2480,
  dayHigh: 2510,
  fiftyTwoWeekHigh: 2700,
  fiftyTwoWeekLow: 2200,
  lastUpdated: '2026-11-13T10:00:00.000Z',
  source: 'Yahoo Finance (may be delayed)',
  ...overrides,
});

describe('Price snapshot (educational scorecard)', () => {
  test('contains only real, factual data from the market feed', () => {
    const snap = scorecardService.generateScorecard(trend());

    expect(snap.type).toBe('PRICE_SNAPSHOT');
    expect(snap.currentPrice).toBe(2500);
    expect(snap.returns).toEqual({ day: 1.2, week: -0.5, month: 3.1 });
    expect(snap.fiftyTwoWeekRange).toEqual({
      high: 2700, low: 2200, positionPercent: 60, belowHighPercent: 7.41, aboveLowPercent: 13.64,
    });
    expect(snap.source).toBe('Yahoo Finance (may be delayed)');
    expect(snap.asOf).toBe('2026-11-13T10:00:00.000Z');
    expect(snap.riskFactors.length).toBeGreaterThan(0);
  });

  test('never contains recommendations, analyst counts, targets or grades', () => {
    const snap = scorecardService.generateScorecard(trend({ symbol: 'NEWCO.NS' }));
    const json = JSON.stringify(snap).toLowerCase();

    for (const field of ['consensus', 'healthScore', 'targetPrice', 'grade', 'buyPercentage']) {
      expect(snap).not.toHaveProperty(field);
    }
    expect(json).not.toMatch(/strong buy|accumulate|bullish|target price|research desk/);
    expect(snap.disclaimer).toBe(DISCLAIMER);
    expect(snap.disclaimer).toContain('not a SEBI-registered investment adviser');
  });

  test('returns null when there is no real price instead of assuming one', () => {
    expect(scorecardService.generateScorecard(trend({ currentPrice: undefined }))).toBeNull();
  });

  test('omits the 52-week range when the feed does not provide it', () => {
    const snap = scorecardService.generateScorecard(trend({ fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null }));
    expect(snap.fiftyTwoWeekRange).toBeNull();
  });
});
