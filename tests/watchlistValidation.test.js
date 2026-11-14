const request = require('supertest');
const { createApp } = require('../src/app');
const prisma = require('../src/lib/prisma');
const { resetDb } = require('./helpers/db');
const { visitorAgent } = require('./helpers/agent');
const { isValidSymbol, search, normalizeQuery } = require('../src/services/symbolSearchService');
const { requireKnownSymbols, keepKnownSymbols, HttpError } = require('../src/middleware/errors');

const app = createApp();
const noNetwork = async () => [];

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('isValidSymbol (stock master list)', () => {
  it('accepts real NSE stocks, indices and commodities', async () => {
    for (const s of ['RELIANCE.NS', 'reliance.ns', 'TCS', 'IOC.NS', '^NSEI', 'GOLD', 'CRUDEOIL', 'NIFTYBANK', 'SILVER']) {
      expect(await isValidSymbol(s, { fetchRemote: noNetwork })).toBe(true);
    }
  });

  it('rejects text that merely looks like a ticker', async () => {
    for (const s of ['C', 'C.NS', 'XYZ', 'XYZ.NS', 'JACKPOT', '', '   ', null, undefined, 'RELIANCE.XX']) {
      expect(await isValidSymbol(s, { fetchRemote: noNetwork })).toBe(false);
    }
  });

  it('accepts a BSE-only / new listing only when the exchange search returns that exact symbol', async () => {
    const remote = jest.fn(async () => [{ symbol: 'ZZBSEONLY.BO' }, { symbol: 'ZZBSEONLY2.BO' }]);
    expect(await isValidSymbol('ZZBSEONLY.BO', { fetchRemote: remote })).toBe(true);
    expect(await isValidSymbol('ZZB.BO', { fetchRemote: remote })).toBe(false); // prefix is not enough
    expect(await isValidSymbol('ZZBSEONLY.BO', { fetchRemote: noNetwork })).toBe(true); // positives are remembered
  });

  it('a network failure never makes a stock permanently invalid', async () => {
    const down = jest.fn(async () => { throw new Error('offline'); });
    expect(await isValidSymbol('NEWLIST.BO', { fetchRemote: down })).toBe(false);
    expect(await isValidSymbol('NEWLIST.BO', { fetchRemote: async () => [{ symbol: 'NEWLIST.BO' }] })).toBe(true);
  });
});

describe('search edge cases', () => {
  it('trims spaces, ignores case and special characters, and finds from one letter', async () => {
    expect(normalizeQuery('  <b>tcs</b>  ')).toBe('BTCSB');
    expect((await search('  tcs  ', { remote: false }))[0].code).toBe('TCS');
    expect((await search('c', { remote: false })).length).toBeGreaterThan(0);
    expect(await search('<>', { remote: false })).toEqual([]);
    expect(await search('', { remote: false })).toEqual([]);
  });

  it('puts "starts with" matches before "contains" matches and highlights nothing it cannot find', async () => {
    const r = await search('bank', { remote: false, limit: 10 });
    expect(r.length).toBeGreaterThan(0);
    const firstContains = r.findIndex((x) => !x.code.startsWith('BANK') && !x.name.toUpperCase().startsWith('BANK') && !x.name.toUpperCase().split(/[^A-Z0-9&]+/).some((w) => w.startsWith('BANK')));
    const lastStarts = r.map((x) => x.code.startsWith('BANK') || x.name.toUpperCase().startsWith('BANK')).lastIndexOf(true);
    if (firstContains >= 0 && lastStarts >= 0) expect(lastStarts).toBeLessThan(firstContains);
  });
});

describe('requireKnownSymbols middleware', () => {
  const run = (mw, req) => new Promise((resolve) => mw(req, {}, (err) => resolve(err)));
  const valid = async (s) => s === 'TCS.NS';

  it('passes valid symbols and blocks the rest with a 400', async () => {
    expect(await run(requireKnownSymbols((r) => r.body.symbol, valid), { body: { symbol: 'TCS.NS' } })).toBeUndefined();
    const err = await run(requireKnownSymbols((r) => r.body.symbol, valid), { body: { symbol: 'C.NS' } });
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/not a listed stock/);
  });

  it('bulk mode keeps real symbols and drops junk', async () => {
    const req = { body: { symbols: ['TCS.NS', 'C.NS', 'XYZ'] } };
    expect(await run(keepKnownSymbols(valid), req)).toBeUndefined();
    expect(req.body.symbols).toEqual(['TCS.NS']);
  });
});

describe('POST /api/watchlists', () => {
  it('rejects made-up symbols such as "C" and creates nothing, not even a visitor', async () => {
    for (const symbol of ['C', 'C.NS', 'xyz', 'JACKPOT.NS']) {
      const res = await request(app).post('/api/watchlists').send({ symbol });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not a listed stock/);
    }
    expect((await request(app).post('/api/watchlists').send({ symbol: '<script>' })).status).toBe(400);
    expect((await request(app).post('/api/watchlists').send({})).status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.watchlist.count()).toBe(0);
  });

  it('adds a real stock once; adding it again (any spelling) returns the same row', async () => {
    const agent = await visitorAgent();
    const first = await agent.post('/api/watchlists').send({ symbol: 'tcs.ns' });
    const again = await agent.post('/api/watchlists').send({ symbol: 'TCS.NS' });
    expect(first.status).toBe(201);
    expect(again.body.id).toBe(first.body.id);
    expect(await prisma.watchlist.count()).toBe(1);
  });

  it('the same stock can be on two different visitors lists independently', async () => {
    const a = await visitorAgent();
    const b = await visitorAgent();
    await a.post('/api/watchlists').send({ symbol: 'INFY.NS' });
    await b.post('/api/watchlists').send({ symbol: 'INFY.NS' });
    expect(await prisma.watchlist.count()).toBe(2);
  });

  it('bulk import keeps real symbols and silently drops junk saved by older versions', async () => {
    const agent = await visitorAgent();
    const res = await agent.post('/api/watchlists/import').send({ symbols: ['C.NS', 'RELIANCE.NS', 'XYZ.NS', 'GOLD'] });
    expect(res.status).toBe(200);
    expect(res.body.map((w) => w.symbol).sort()).toEqual(['GOLD', 'RELIANCE.NS']);
  });
});

describe('alerts use the same master list', () => {
  it('rejects an alert or backtest for a stock that does not exist', async () => {
    const agent = await visitorAgent();
    const rule = { type: 'PRICE_MOVE', threshold: 2, direction: 'up' };
    expect((await agent.post('/api/alerts').send({ ...rule, symbol: 'C' })).status).toBe(400);
    expect((await agent.post('/api/alerts/backtest').send({ ...rule, symbol: 'XYZ' })).status).toBe(400);
    expect(await prisma.alert.count()).toBe(0);
  });
});
