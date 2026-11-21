/**
 * Pins the HTTP behaviour of every /api/markets route (inputs, limits, status codes, error mapping),
 * so internal clean-ups of the routes cannot change what the browser sees.
 */
const marketDataService = require('../src/services/marketDataService');
const insightsService = require('../src/services/insightsService');
const briefingService = require('../src/services/briefingService');
const replayService = require('../src/services/replayService');
const compareService = require('../src/services/compareService');
const snapshotService = require('../src/services/marketSnapshotService');
const unusualService = require('../src/services/unusualActivityService');
const { app, request } = require('./helpers/agent');

afterEach(() => jest.restoreAllMocks());
const quiet = () => jest.spyOn(console, 'error').mockImplementation(() => {});

describe('GET /api/markets/unusual', () => {
  it.each([['', 3], ['?limit=abc', 3], ['?limit=0', 3], ['?limit=5', 5], ['?limit=99', 10], ['?limit=-4', 1]])('limit %s -> %s', async (qs, expected) => {
    const spy = jest.spyOn(unusualService, 'getUnusualActivity').mockResolvedValue({ scanned: 10, items: [] });
    expect((await request(app).get(`/api/markets/unusual${qs}`)).status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ limit: expected });
  });
  it('503 when nothing could be scanned', async () => {
    jest.spyOn(unusualService, 'getUnusualActivity').mockResolvedValue({ scanned: 0, items: [] });
    const res = await request(app).get('/api/markets/unusual');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Market data is unavailable right now' });
  });
});

describe('GET /api/markets/insights', () => {
  it('400 without usable symbols; junk is dropped before the service sees it', async () => {
    const spy = jest.spyOn(insightsService, 'getInsights').mockResolvedValue({ insights: {} });
    const none = await request(app).get('/api/markets/insights');
    expect(none.status).toBe(400);
    expect(none.body).toEqual({ error: 'symbols is required' });
    expect((await request(app).get('/api/markets/insights?symbols=%3Cscript%3E,%20')).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    expect((await request(app).get('/api/markets/insights?symbols=TCS.NS,%3Cb%3E,%20INFY.NS')).status).toBe(200);
    expect(spy).toHaveBeenCalledWith(['TCS.NS', 'INFY.NS']);
  });
});

describe('GET /api/markets/briefing', () => {
  it('passes at most 10 valid symbols', async () => {
    const spy = jest.spyOn(briefingService, 'getBriefing').mockResolvedValue({ range: { dailyPercent: 1 }, cues: {} });
    const symbols = Array.from({ length: 14 }, (_, i) => `S${i}.NS`).join(',');
    expect((await request(app).get(`/api/markets/briefing?symbols=${symbols},%3Cx%3E`)).status).toBe(200);
    expect(spy.mock.calls[0][0].symbols).toHaveLength(10);
  });
  it('503 when there is neither a range nor any overnight cue', async () => {
    jest.spyOn(briefingService, 'getBriefing').mockResolvedValue({ range: null, cues: {} });
    expect((await request(app).get('/api/markets/briefing')).status).toBe(503);
  });
});

describe('GET /api/markets/replay', () => {
  it('filters invalid symbols and still answers when none are given', async () => {
    const spy = jest.spyOn(replayService, 'getReplay').mockResolvedValue({ series: [] });
    expect((await request(app).get('/api/markets/replay?symbols=TCS.NS,%3Cb%3E')).status).toBe(200);
    expect(spy).toHaveBeenLastCalledWith(['TCS.NS']);
    expect((await request(app).get('/api/markets/replay')).status).toBe(200);
    expect(spy).toHaveBeenLastCalledWith([]);
  });
});

describe('GET /api/markets/compare', () => {
  it('trims both symbols and rejects missing, bad or identical ones', async () => {
    const spy = jest.spyOn(compareService, 'compare').mockResolvedValue({ ok: true });
    expect((await request(app).get('/api/markets/compare?a=TCS.NS')).body).toEqual({ error: 'Two stock symbols (a and b) are required' });
    expect((await request(app).get('/api/markets/compare?a=TCS.NS&b=tcs.ns')).body).toEqual({ error: 'Pick two different stocks' });
    expect((await request(app).get('/api/markets/compare?a=%20TCS.NS%20&b=INFY.NS')).status).toBe(200);
    expect(spy).toHaveBeenCalledWith('TCS.NS', 'INFY.NS');
  });
});

describe('GET /api/markets/popular and /breadth', () => {
  const snapshot = { asOf: 'now', source: 's', universeSource: 'u', rows: [] };
  it.each([['', 8], ['?limit=0', 8], ['?limit=500', 30], ['?limit=-1', 1]])('popular limit %s -> %s', async (qs, expected) => {
    jest.spyOn(snapshotService, 'getSnapshot').mockResolvedValue(snapshot);
    const popular = jest.spyOn(snapshotService, 'popularFrom').mockReturnValue([]);
    const res = await request(app).get(`/api/markets/popular${qs}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], asOf: 'now', source: 's', universeSource: 'u' });
    expect(popular).toHaveBeenCalledWith(snapshot, expected);
  });
  it('breadth returns the computed facts', async () => {
    jest.spyOn(snapshotService, 'getSnapshot').mockResolvedValue(snapshot);
    jest.spyOn(snapshotService, 'breadthFrom').mockReturnValue({ up: 1 });
    expect((await request(app).get('/api/markets/breadth')).body).toEqual({ up: 1 });
  });
});

describe('per-symbol routes and error mapping', () => {
  it('quote and scorecard answer 200 with real service output', async () => {
    jest.spyOn(marketDataService, 'getMarketData').mockResolvedValue({ symbol: 'TCS.NS', price: 1 });
    expect((await request(app).get('/api/markets/TCS.NS')).body).toEqual({ symbol: 'TCS.NS', price: 1 });
    const trend = { symbol: 'TCS.NS', price: 100, currency: 'INR', trend: {}, volume: {}, history: [] };
    jest.spyOn(marketDataService, 'getTrendData').mockResolvedValue(trend);
    expect((await request(app).get('/api/markets/TCS.NS/scorecard')).status).toBe(200);
  });
  it('history adds markers/upcoming and tolerates a missing earnings feed', async () => {
    const candles = Array.from({ length: 5 }, (_, i) => ({ time: `2026-01-0${i + 1}`, open: 1, high: 1, low: 1, close: 1, volume: 1 }));
    jest.spyOn(marketDataService, 'getHistory').mockResolvedValue({ symbol: 'TCS.NS', candles, events: [] });
    jest.spyOn(marketDataService, 'getEarningsDates').mockResolvedValue([]);
    const res = await request(app).get('/api/markets/TCS.NS/history?range=3mo');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ symbol: 'TCS.NS', markers: expect.any(Array), upcoming: [] }));
  });
  it('an error with a status keeps its message and status; an unexpected error is a generic 500', async () => {
    quiet();
    const withStatus = Object.assign(new Error('Price for X is unavailable right now'), { status: 503 });
    jest.spyOn(marketDataService, 'getMarketData').mockRejectedValue(withStatus);
    const a = await request(app).get('/api/markets/X');
    expect(a.status).toBe(503);
    expect(a.body).toEqual({ error: 'Price for X is unavailable right now' });
    jest.spyOn(marketDataService, 'getMarketData').mockRejectedValue(new Error('secret db password leaked'));
    const b = await request(app).get('/api/markets/X');
    expect(b.status).toBe(500);
    expect(b.body).toEqual({ error: 'Internal server error' });
  });
});

describe('symbol in the path', () => {
  const request = require('supertest');
  const { createApp } = require('../src/app');
  test.each(['INVALID!!', '%3Cscript%3E', 'TCS%00', 'A'.repeat(21), '..%2F..%2Fetc%2Fpasswd'])('rejects %s with 400, not a provider call', async (sym) => {
    const res = await request(createApp()).get(`/api/markets/${sym}`);
    expect(res.status).toBe(400);
    const res2 = await request(createApp()).get(`/api/markets/${sym}/history`);
    expect(res2.status).toBe(400);
  });
});
