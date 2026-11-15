jest.mock('yahoo-finance2', () => ({ default: { quote: jest.fn() } }));

const yahooFinance = require('yahoo-finance2').default;
const marketDataService = require('../src/services/marketDataService');
const universe = require('../src/services/universeService');
const snapshot = require('../src/services/marketSnapshotService');
const unusual = require('../src/services/unusualActivityService');
const { app, request } = require('./helpers/agent');

const CSV = [
  'Company Name,Industry,Symbol,Series,ISIN Code',
  'Alpha Ltd.,Financial Services,ALPHA,EQ,INE000000001',
  'Beta Ltd.,Information Technology,BETA,EQ,INE000000002',
  'Gamma Ltd.,Information Technology,GAMMA,BE,INE000000003',
  'Rights Co,Services,RIGHTS,RR,INE000000004',
  'Alpha Ltd.,Financial Services,ALPHA,EQ,INE000000001',
  'Bad Symbol,Services,bad symbol!,EQ,INE000000005',
].join('\n');

describe('the stock list comes from NSE, not from the code', () => {
  it('reads NSE constituent rows: keeps tradable series, drops duplicates and junk', () => {
    const out = universe.parseConstituentsCsv(CSV);
    expect(out.map((e) => e.symbol)).toEqual(['ALPHA.NS', 'BETA.NS', 'GAMMA.NS']);
    expect(out[1]).toEqual({ symbol: 'BETA.NS', name: 'Beta Ltd.', industry: 'Information Technology' });
  });

  it('returns nothing for a broken file instead of guessing', () => {
    expect(universe.parseConstituentsCsv('')).toEqual([]);
    expect(universe.parseConstituentsCsv('<html>error</html>')).toEqual([]);
    expect(universe.parseConstituentsCsv('Company Name,Industry\nA,B')).toEqual([]);
  });
});

describe('market snapshot: one look at the whole list', () => {
  const quote = (symbol, extra = {}) => ({
    symbol, shortName: symbol, regularMarketPrice: 100, regularMarketChangePercent: 0, regularMarketVolume: 1000,
    averageDailyVolume3Month: 1000, fiftyTwoWeekHigh: 150, fiftyTwoWeekLow: 60, marketCap: 5e11, ...extra,
  });

  it('turns a quote into a plain row and rejects quotes without a real price', () => {
    const row = snapshot.toRow(quote('A.NS', { regularMarketVolume: 3500, regularMarketChangePercent: 2.345 }), { name: 'A Ltd', industry: 'IT' });
    expect(row).toMatchObject({ symbol: 'A.NS', name: 'A Ltd', industry: 'IT', changePercent: 2.35, volumeRatio: 3.5 });
    expect(snapshot.toRow({ symbol: 'X.NS' })).toBeNull();
    expect(snapshot.toRow(quote('X.NS', { regularMarketPrice: 0 }))).toBeNull();
  });

  it('builds a row from chart data when the batch quote is throttled', () => {
    const result = {
      meta: { regularMarketPrice: 110, fiftyTwoWeekHigh: 120, fiftyTwoWeekLow: 80, regularMarketVolume: 4000, regularMarketTime: 1_700_000_000 },
      indicators: { quote: [{ close: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100], volume: Array(10).fill(1000) }] },
    };
    const row = snapshot.rowFromChart(result, { symbol: 'A.NS', name: 'A', industry: 'IT' });
    expect(row.changePercent).toBe(10);
    expect(row.volumeRatio).toBe(4);
    expect(row.high52).toBe(120);
    expect(snapshot.rowFromChart({ meta: {}, indicators: { quote: [{ close: [1] }] } })).toBeNull();
  });

  const rows = [
    { symbol: 'A.NS', name: 'A', industry: 'IT', price: 100, changePercent: 2, volumeRatio: 3, high52: 101, low52: 50, tradedValue: 900 },
    { symbol: 'B.NS', name: 'B', industry: 'IT', price: 100, changePercent: -1, volumeRatio: 1, high52: 200, low52: 99, tradedValue: 500 },
    { symbol: 'C.NS', name: 'C', industry: 'Banks', price: 100, changePercent: 0, volumeRatio: 1, high52: 200, low52: 50, tradedValue: 100 },
    { symbol: 'D.NS', name: 'D', industry: 'Banks', price: 100, changePercent: -3, volumeRatio: null, high52: 200, low52: 50, tradedValue: null },
  ];
  const snap = { rows, asOf: 'x', universeSize: 4, quoted: 4, source: 's', universeSource: 'u' };

  it('works out the most traded stocks instead of using a typed list', () => {
    expect(snapshot.popularFrom(snap, 2).map((p) => p.symbol)).toEqual(['A.NS', 'B.NS']);
  });

  it('counts how many rose and fell and ranks industries (describing today only)', () => {
    const b = snapshot.breadthFrom(snap, { minPerIndustry: 2 });
    expect([b.advancers, b.decliners, b.unchanged]).toEqual([1, 2, 1]);
    expect(b.nearHigh).toBe(1);
    expect(b.nearLow).toBe(1);
    expect(b.highVolume).toBe(1);
    expect(b.strongestIndustries[0]).toMatchObject({ name: 'IT', count: 2, avgChangePercent: 0.5 });
    expect(b.weakestIndustries[0]).toMatchObject({ name: 'Banks', avgChangePercent: -1.5 });
    expect(JSON.stringify(b)).not.toMatch(/buy|sell|will (rise|fall)|predict/i);
  });

  it('picks movers from the busiest half of the list', () => {
    expect(snapshot.moversFrom(snap, 'gainers', 1)[0].symbol).toBe('A.NS');
    expect(snapshot.moversFrom(snap, 'losers', 1)[0].symbol).toBe('B.NS'); // D has no traded value, so it is not "busy"
  });

  describe('end to end with a fake exchange list', () => {
    beforeEach(() => {
      snapshot.clearCache();
      jest.spyOn(universe, 'getUniverse').mockResolvedValue({
        entries: [{ symbol: 'ALPHA.NS', name: 'Alpha Ltd.', industry: 'Financial Services' }, { symbol: 'BETA.NS', name: 'Beta Ltd.', industry: 'IT' }],
        size: 2, source: 'NSE Nifty 500 constituents', fetchedAt: 'now', stale: false,
      });
      yahooFinance.quote.mockResolvedValue([
        quote('ALPHA.NS', { regularMarketChangePercent: 5, regularMarketVolume: 9000, regularMarketTime: 1_700_000_000_000 }),
        quote('BETA.NS'),
        quote('NOTINLIST.NS'),
      ]);
    });
    afterEach(() => { jest.restoreAllMocks(); snapshot.clearCache(); });

    it('quotes exactly the stocks on the list and ignores anything else', async () => {
      const s = await snapshot.getSnapshot({ force: true });
      expect(s.rows.map((r) => r.symbol).sort()).toEqual(['ALPHA.NS', 'BETA.NS']);
      expect(s.rows.find((r) => r.symbol === 'ALPHA.NS').industry).toBe('Financial Services');
    });

    it('serves popular and breadth over HTTP', async () => {
      const pop = await request(app).get('/api/markets/popular?limit=5');
      expect(pop.status).toBe(200);
      expect(pop.body.items.length).toBe(2);
      const breadth = await request(app).get('/api/markets/breadth');
      expect(breadth.status).toBe(200);
      expect(breadth.body.advancers).toBe(1);
    });

    it('top movers come from the live list', async () => {
      const movers = await marketDataService.getTopMovers('gainers', 1);
      expect(movers[0]).toMatchObject({ symbol: 'ALPHA.NS', instrument: 'Alpha Ltd.', dayChangePercent: 5 });
    });
  });

  it('says unavailable when the list or the prices cannot be had', async () => {
    snapshot.clearCache();
    jest.spyOn(universe, 'getUniverse').mockRejectedValue(new marketDataService.MarketDataUnavailableError('list unavailable'));
    const res = await request(app).get('/api/markets/popular');
    expect(res.status).toBe(503);
    jest.restoreAllMocks();
  });
});

describe('the unusual scan only studies stocks that look unusual today', () => {
  it('picks candidates from the quick look, most promising first, and skips quiet stocks', () => {
    const rows = [
      { symbol: 'QUIET.NS', changePercent: 0.2, volumeRatio: 1, price: 100, high52: 200, low52: 50 },
      { symbol: 'BIG.NS', changePercent: 6, volumeRatio: 1, price: 100, high52: 200, low52: 50 },
      { symbol: 'BUSY.NS', changePercent: 0.5, volumeRatio: 4, price: 100, high52: 200, low52: 50 },
      { symbol: 'PEAK.NS', changePercent: 0.1, volumeRatio: 1, price: 199, high52: 200, low52: 50 },
    ];
    expect(unusual.pickCandidates(rows).map((r) => r.symbol)).toEqual(['BIG.NS', 'BUSY.NS', 'PEAK.NS']);
  });
});
