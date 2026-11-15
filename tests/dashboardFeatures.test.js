const marketDataService = require('../src/services/marketDataService');
const insights = require('../src/services/insightsService');
const briefing = require('../src/services/briefingService');
const replay = require('../src/services/replayService');
const { app, request } = require('./helpers/agent');

function candles(n, { moves = {}, volume = {} } = {}) {
  const out = [];
  let price = 100;
  for (let i = 0; i < n; i += 1) {
    const open = price;
    price = Number((price * (1 + (moves[i] ?? (i % 2 ? -0.004 : 0.004)))).toFixed(2));
    out.push({
      time: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10),
      open, high: Math.max(open, price) + 0.1, low: Math.min(open, price) - 0.1, close: price, volume: volume[i] ?? 1000,
    });
  }
  return out;
}

afterEach(() => { jest.restoreAllMocks(); briefing.clearCache(); });

describe('relationToMarket', () => {
  const { relationToMarket } = insights;
  it.each([
    [-3, -0.4, 'on_its_own'],
    [1.0, -0.8, 'against_market'],
    [-0.9, -0.8, 'with_market'],
    [0.2, 0.1, null],
    [null, 1, null],
  ])('stock %s vs NIFTY %s -> %s', (a, b, expected) => expect(relationToMarket(a, b)).toBe(expected));
});

describe('insights (why it moved, in context)', () => {
  it('describes the latest session using real candles, and skips stocks without data', async () => {
    const nifty = candles(80, { moves: { 79: -0.004 } });
    const stock = candles(80, { moves: { 79: -0.03 }, volume: { 79: 3300 } });
    jest.spyOn(marketDataService, 'getHistory').mockImplementation(async (s) => {
      if (s === '^NSEI') return { candles: nifty };
      if (s === 'AAA.NS') return { candles: stock };
      throw new Error('unavailable');
    });
    const out = await insights.getInsights(['AAA.NS', 'ZZZ.NS']);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ symbol: 'AAA.NS', changePercent: -3, volumeRatio: 3.3, niftyChangePercent: -0.4, relation: 'on_its_own' });
    expect(out.items[0].triggers).toEqual(expect.arrayContaining(['big_move', 'volume_spike']));
  });

  it('does not compare commodities or indices with NIFTY', async () => {
    jest.spyOn(marketDataService, 'getHistory').mockResolvedValue({ candles: candles(80) });
    const out = await insights.getInsights(['GC=F']);
    expect(out.items[0]).toMatchObject({ niftyChangePercent: null, relation: null, volumeRatio: null });
  });

  it('GET /api/markets/insights validates input', async () => {
    expect((await request(app).get('/api/markets/insights')).status).toBe(400);
    expect((await request(app).get('/api/markets/insights?symbols=%3Cscript%3E')).status).toBe(400);
  });
});

describe('briefing (facts only)', () => {
  it('turns India VIX into a typical one-day range, not a direction', () => {
    expect(briefing.expectedDailyRange(15.87)).toBe(1);
    expect(briefing.expectedDailyRange(null)).toBeNull();
  });

  it('skips weekends when picking the next trading day', () => {
    expect(briefing.nextSessionDate('2026-11-13')).toBe('2026-11-16'); // Friday -> Monday
    expect(briefing.nextSessionDate('2026-11-14')).toBe('2026-11-16'); // Saturday -> Monday
    expect(briefing.nextSessionDate('2026-11-16')).toBe('2026-11-17');
  });

  it('only reports a history line when there are enough similar days', () => {
    expect(briefing.similarDayHistory(candles(40))).toBeNull();
    const many = candles(600);
    const h = briefing.similarDayHistory(many);
    if (h) {
      expect(h.cases).toBeGreaterThanOrEqual(30);
      expect(h.upPercent).toBeGreaterThanOrEqual(0);
      expect(h.upPercent).toBeLessThanOrEqual(100);
    }
  });

  it('builds the briefing from real data and leaves unavailable pieces out', async () => {
    jest.spyOn(marketDataService, 'getTrendData').mockImplementation(async (s) => {
      if (s === '^INDIAVIX') return { currentPrice: 15.87, lastUpdated: 'x' };
      if (s === '^GSPC') return { currentPrice: 7000, dayChangePercent: -0.4, lastUpdated: 'x' };
      throw new Error('down');
    });
    jest.spyOn(marketDataService, 'getHistory').mockRejectedValue(new Error('down'));
    jest.spyOn(marketDataService, 'getEarningsDates').mockResolvedValue([]);
    const out = await briefing.getBriefing();
    expect(out.range.dailyPercent).toBe(1);
    expect(Object.keys(out.cues)).toEqual(['sp500']);
    expect(out.history).toBeNull();
    expect(out.scheduled).toEqual([]); // the calendar file ships empty: we never guess dates
    expect(JSON.stringify(out)).not.toMatch(/buy|sell|target|will (rise|fall)|predict/i);
  });

  it('GET /api/markets/briefing says unavailable instead of inventing data', async () => {
    jest.spyOn(marketDataService, 'getTrendData').mockRejectedValue(new Error('down'));
    jest.spyOn(marketDataService, 'getHistory').mockRejectedValue(new Error('down'));
    const res = await request(app).get('/api/markets/briefing');
    expect(res.status).toBe(503);
  });
});

describe('replay', () => {
  const bars = (vals, vols = []) => vals.map((percent, i) => ({
    time: `09:${String(15 + i * 5).padStart(2, '0')}`, close: 100 + percent, percent, volume: vols[i] ?? 100,
  }));

  it('marks the biggest 15-minute swing and a volume burst', () => {
    const moments = replay.findMoments(bars([0, 0.1, 0.1, 0.2, 1.4, 1.5], [100, 100, 100, 100, 900, 100]));
    expect(moments.find((m) => m.type === 'swing').value).toBe(1.4); // 1.5 at the end minus 0.1 fifteen minutes earlier
    expect(moments.find((m) => m.type === 'volume').value).toBe(9);
  });

  it('marks nothing on a flat session', () => {
    expect(replay.findMoments(bars([0, 0.05, 0.1, 0.05, 0.1, 0.1]))).toEqual([]);
  });

  it('builds a replay from intraday data and drops stocks from other dates', async () => {
    const day = (date, symbol, vals) => ({ symbol, name: symbol, date, previousClose: 100, bars: bars(vals), source: 's' });
    jest.spyOn(marketDataService, 'getIntraday').mockImplementation(async (s) => {
      if (s === '^NSEI') return day('2026-11-13', '^NSEI', [0, -0.2, -0.4, -0.5, -0.6, -0.6]);
      if (s === 'AAA.NS') return day('2026-11-13', 'AAA.NS', [0, 0.5, 1, 1.2, 1.1, 1]);
      if (s === 'OLD.NS') return day('2026-11-12', 'OLD.NS', [0, 1]);
      throw new Error('down');
    });
    const out = await replay.getReplay(['AAA.NS', 'OLD.NS', 'BAD.NS']);
    expect(out.series.map((s) => s.symbol)).toEqual(['^NSEI', 'AAA.NS']);
    expect(out.times).toHaveLength(6);
  });

  it('fails clearly when NIFTY data is missing', async () => {
    jest.spyOn(marketDataService, 'getIntraday').mockRejectedValue(new Error('down'));
    await expect(replay.getReplay(['AAA.NS'])).rejects.toMatchObject({ status: 503 });
  });
});
