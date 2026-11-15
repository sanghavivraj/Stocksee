const { unusualTriggers, notableTriggers, triggersFor, typicalDailyMove, scanLatest, nextDayAfterTriggers, summariseNextDay, RULES } = require('../src/analytics/unusual');
const marketDataService = require('../src/services/marketDataService');
const unusualService = require('../src/services/unusualActivityService');
const { app, request } = require('./helpers/agent');

/** n calm daily candles (small alternating moves, volume 1000), with overrides per index. */
function calm(n, extra = {}) {
  const candles = [];
  let price = 100;
  for (let i = 0; i < n; i += 1) {
    const open = price;
    price = Number((price * (i % 2 ? 0.995 : 1.005)).toFixed(2));
    candles.push({
      time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10),
      open, high: Math.max(open, price) + 0.2, low: Math.min(open, price) - 0.2, close: price, volume: 1000,
      ...(extra[i] || {}),
    });
  }
  return candles;
}

describe('unusualTriggers (fixed public rules)', () => {
  it('stays quiet on a calm day', () => {
    const c = calm(80);
    expect(unusualTriggers(c, c.length - 1)).toEqual([]);
    expect(scanLatest(c)).toBeNull();
  });

  it('flags a volume spike of 3x or more', () => {
    const c = calm(80, { 79: { volume: 4200 } });
    const t = unusualTriggers(c, 79);
    expect(t.map((x) => x.code)).toContain('volume_spike');
    expect(t.find((x) => x.code === 'volume_spike').value).toBe(4.2);
  });

  it('flags a big move in EITHER direction the same way', () => {
    const up = calm(80); up[79] = { ...up[79], close: up[78].close * 1.06 };
    const down = calm(80); down[79] = { ...down[79], close: down[78].close * 0.94 };
    const upHit = unusualTriggers(up, 79).find((x) => x.code === 'big_move');
    const downHit = unusualTriggers(down, 79).find((x) => x.code === 'big_move');
    expect(upHit.value).toBeGreaterThan(0);
    expect(downHit.value).toBeLessThan(0);
    expect(upHit.intensity).toBeCloseTo(downHit.intensity, 0);
  });

  it('ignores moves under the minimum percent even when the stock is very calm', () => {
    const c = calm(80); c[79] = { ...c[79], close: c[78].close * 1.012 };
    expect(unusualTriggers(c, 79).find((x) => x.code === 'big_move')).toBeUndefined();
  });

  it('flags an opening gap of 3% or more', () => {
    const c = calm(80, { 79: { open: 104 } });
    c[79].open = Number((c[78].close * 1.04).toFixed(2));
    expect(unusualTriggers(c, 79).map((x) => x.code)).toContain('gap');
  });

  it('flags a break of the previous 52-week high and low', () => {
    const hi = calm(260); hi[259] = { ...hi[259], high: 500 };
    const lo = calm(260); lo[259] = { ...lo[259], low: 1 };
    expect(unusualTriggers(hi, 259).map((x) => x.code)).toContain('new_52w_high');
    expect(unusualTriggers(lo, 259).map((x) => x.code)).toContain('new_52w_low');
  });

  it('needs enough history', () => {
    expect(scanLatest(calm(10))).toBeNull();
  });

  it('score only measures how unusual, so more triggers means a higher score', () => {
    const one = calm(80, { 79: { volume: 3500 } });
    const two = calm(80, { 79: { volume: 3500 } });
    two[79].open = Number((two[78].close * 1.05).toFixed(2));
    expect(scanLatest(two).score).toBeGreaterThan(scanLatest(one).score);
  });

  it('publishes its rule book', () => {
    expect(RULES.volume_spike.multiple).toBe(3);
    expect(RULES.big_move.minPercent).toBe(2);
  });
});

describe('milder "worth a look" rules and the typical move', () => {
  it('a 2.2x volume day is notable but not strong', () => {
    const c = calm(80, { 79: { volume: 2200 } });
    expect(unusualTriggers(c, 79)).toEqual([]);
    expect(notableTriggers(c, 79).map((t) => t.code)).toContain('volume_spike');
    const hit = scanLatest(c);
    expect(hit.tier).toBe('notable');
  });

  it('strong triggers win over mild ones', () => {
    const c = calm(80, { 79: { volume: 4000 } });
    expect(triggersFor(c, 79).tier).toBe('unusual');
  });

  it('flags a stock sitting just under its 52-week high without having broken it', () => {
    const c = calm(260);
    const peak = Math.max(...c.slice(0, 259).map((x) => x.high));
    c[259] = { ...c[259], close: Number((peak * 0.995).toFixed(2)), high: Number((peak * 0.996).toFixed(2)), low: peak * 0.98, open: peak * 0.99 };
    const near = notableTriggers(c, 259).find((t) => t.code === 'near_52w_high');
    expect(near).toBeDefined();
    expect(near.distance).toBeLessThanOrEqual(1.5);
  });

  it('typical daily move is a size (always positive), never a direction', () => {
    const c = calm(80);
    const typical = typicalDailyMove(c);
    expect(typical).toBeGreaterThan(0);
    expect(typicalDailyMove(calm(1))).toBeNull();
  });
});

describe('next-day history', () => {
  it('pools what happened the day after earlier trigger days (excluding the latest)', () => {
    const c = calm(120, { 50: { volume: 5000 }, 60: { volume: 5000 }, 119: { volume: 5000 } });
    const samples = nextDayAfterTriggers(c).filter((s) => s.code === 'volume_spike');
    expect(samples).toHaveLength(2); // sessions 50 and 60; the latest session has no "next day" yet
    const summary = summariseNextDay(samples);
    expect(summary.volume_spike.cases).toBe(2);
    expect(summary.volume_spike.upPercent).toBeGreaterThanOrEqual(0);
    expect(summary.volume_spike.upPercent).toBeLessThanOrEqual(100);
  });

  it('computes the share of up days', () => {
    const s = summariseNextDay([{ code: 'gap', next: 1 }, { code: 'gap', next: -1 }, { code: 'gap', next: 2 }, { code: 'gap', next: -3 }]);
    expect(s.gap).toEqual({ cases: 4, upPercent: 50 });
  });
});

describe('GET /api/markets/unusual', () => {
  const universe = ['AAA.NS', 'BBB.NS', 'CCC.NS'];
  const history = {
    'AAA.NS': { symbol: 'AAA.NS', name: 'Aaa Ltd', currency: 'INR', candles: calm(80, { 79: { volume: 9000 } }) },
    'BBB.NS': { symbol: 'BBB.NS', name: 'Bbb Ltd', currency: 'INR', candles: calm(80, { 79: { volume: 3500 } }) },
    'CCC.NS': { symbol: 'CCC.NS', name: 'Ccc Ltd', currency: 'INR', candles: calm(80) },
  };

  beforeEach(() => {
    unusualService.clearCache();
    jest.spyOn(marketDataService, 'getHistory').mockImplementation(async (s) => {
      if (!history[s]) throw new Error('unavailable');
      return history[s];
    });
    jest.spyOn(marketDataService, 'fetchQuote').mockResolvedValue({ marketCap: 5e11 });
  });
  afterEach(() => jest.restoreAllMocks());

  it('ranks by how unusual, never by direction, and reports what it scanned', async () => {
    const out = await unusualService.getUnusualActivity({ limit: 3, universe, force: true });
    expect(out.scanned).toBe(3);
    expect(out.flagged).toBe(2);
    expect(out.items.map((i) => i.symbol)).toEqual(['AAA.NS', 'BBB.NS']);
    expect(out.items[0].triggers[0]).toMatchObject({ code: 'volume_spike', value: 9 });
    expect(out.items[0].thinStock).toBe(false);
    // No advice-style fields anywhere in the payload
    expect(JSON.stringify(out)).not.toMatch(/buy|sell|target|recommend|predict/i);
  });

  it('adds a thin-stock caution for micro caps', async () => {
    marketDataService.fetchQuote.mockResolvedValue({ marketCap: 100 * 1e7 });
    unusualService.clearCache();
    const out = await unusualService.getUnusualActivity({ limit: 3, universe, force: true });
    expect(out.items[0].thinStock).toBe(true);
    expect(out.items[0].cautionCodes).toContain('micro_cap');
  });

  it('skips stocks whose data is unavailable instead of inventing anything', async () => {
    const out = await unusualService.getUnusualActivity({ limit: 3, universe: [...universe, 'ZZZ.NS'], force: true });
    expect(out.universeSize).toBe(4);
    expect(out.scanned).toBe(3);
  });

  it('says unavailable over HTTP when the market data cannot be had', async () => {
    const snapshotService = require('../src/services/marketSnapshotService');
    jest.spyOn(snapshotService, 'getSnapshot').mockRejectedValue(new marketDataService.MarketDataUnavailableError('Market data is unavailable right now'));
    unusualService.clearCache();
    const res = await request(app).get('/api/markets/unusual?limit=2');
    expect(res.status).toBe(503); // not made-up data
    expect(res.body.error).toMatch(/unavailable/i);
  });
});
