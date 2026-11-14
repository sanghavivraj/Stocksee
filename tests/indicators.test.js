const { evaluateCondition, backtestAlert, detectUnusualDays, marketRiskSignals, volumeRatio } = require('../src/analytics/indicators');

/** Build n daily candles from closes (open = previous close unless given). */
function series(closes, extra = {}) {
  return closes.map((close, i) => ({
    time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10),
    open: i ? closes[i - 1] : close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    ...(extra[i] || {}),
  }));
}

describe('evaluateCondition', () => {
  it.each([
    [{ type: 'PRICE_MOVE', direction: 'up', threshold: 2 }, [100, 102], true],
    [{ type: 'PRICE_MOVE', direction: 'up', threshold: 2 }, [100, 101.9], false],
    [{ type: 'PRICE_MOVE', direction: 'down', threshold: 2 }, [100, 98], true],
    [{ type: 'PRICE_MOVE', direction: 'down', threshold: 2 }, [100, 103], false],
  ])('%o on closes %o -> %s', (alert, closes, fired) => {
    const c = series(closes);
    expect(evaluateCondition(alert, c, c.length - 1).fired).toBe(fired);
  });

  it('GAP compares the open with the previous close', () => {
    const c = series([100, 100], { 1: { open: 103 } });
    expect(evaluateCondition({ type: 'GAP', direction: 'up', threshold: 3 }, c, 1)).toEqual({ fired: true, value: 3 });
    expect(evaluateCondition({ type: 'GAP', direction: 'down', threshold: 3 }, c, 1).fired).toBe(false);
  });

  it('VOLUME_SPIKE needs 20 prior sessions and compares with their average', () => {
    const c = series(Array(21).fill(100), { 20: { volume: 3500 } });
    expect(volumeRatio(c, 20)).toBe(3.5);
    expect(evaluateCondition({ type: 'VOLUME_SPIKE', direction: 'up', threshold: 3 }, c, 20).fired).toBe(true);
    expect(evaluateCondition({ type: 'VOLUME_SPIKE', direction: 'up', threshold: 3 }, c, 10)).toEqual({ fired: false, value: null });
  });

  it('NEW_52W_HIGH / LOW compare with the previous year only', () => {
    const closes = Array(260).fill(100);
    closes[100] = 150; // old peak inside the window
    const c = series([...closes, 149, 152]);
    const high = { type: 'NEW_52W_HIGH', direction: 'up', threshold: 0 };
    expect(evaluateCondition(high, c, c.length - 2).fired).toBe(false); // 150 high of the window, 149+1 = 150 not >
    expect(evaluateCondition(high, c, c.length - 1).fired).toBe(true);  // 153 > 151
    expect(evaluateCondition({ type: 'NEW_52W_LOW', direction: 'down', threshold: 0 }, c, c.length - 1).fired).toBe(false);
    expect(evaluateCondition(high, c, 50)).toEqual({ fired: false, value: null }); // not enough history
  });
});

describe('backtestAlert', () => {
  it('counts the days the same rule would have fired', () => {
    const closes = [100];
    for (let i = 1; i < 300; i += 1) closes.push(i % 50 === 0 ? closes[i - 1] * 1.05 : closes[i - 1]);
    const bt = backtestAlert({ type: 'PRICE_MOVE', direction: 'up', threshold: 4 }, series(closes));
    expect(bt.sessions).toBe(252);
    expect(bt.fires).toBe(5); // +5% on days 50, 100, 150, 200, 250 (window = sessions 48..299)
    expect(bt.lastFired[0].value).toBe(5);
  });
});

describe('detectUnusualDays', () => {
  it('flags large moves relative to normal volatility and volume spikes', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + (i % 2 ? 0.3 : -0.3));
    closes[75] = closes[74] * 1.08;
    const c = series(closes, { 70: { volume: 5000 } });
    const markers = detectUnusualDays(c);
    expect(markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: c[75].time, type: 'big_move' }),
      expect.objectContaining({ date: c[70].time, type: 'volume_spike', value: 5 }),
    ]));
  });
});

describe('marketRiskSignals', () => {
  it('flags pump-like patterns: run-up, repeated sharp rises, volume, penny, micro-cap', () => {
    const closes = Array(40).fill(10);
    for (let i = 30; i < 40; i += 1) closes[i] = closes[i - 1] * 1.05;
    const c = series(closes, { 39: { volume: 6000 } });
    const codes = marketRiskSignals(c, { marketCap: 200 * 1e7 }).map((s) => s.code);
    expect(codes).toEqual(expect.arrayContaining(['runup_extreme', 'repeated_sharp_rises', 'volume_extreme', 'penny_stock', 'micro_cap']));
  });

  it('a calm large-cap has no signals', () => {
    expect(marketRiskSignals(series(Array(40).fill(1500)), { marketCap: 1e13 })).toEqual([]);
  });
});
