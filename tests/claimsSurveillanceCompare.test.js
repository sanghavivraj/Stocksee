const marketDataService = require('../src/services/marketDataService');
const claims = require('../src/services/claimCheckService');
const surveillance = require('../src/services/surveillanceService');
const compare = require('../src/services/compareService');
const tipCheck = require('../src/services/tipCheckService');
const { app, request } = require('./helpers/agent');

/** n daily candles moving by `step` each day (alternating sign pattern keeps it realistic), starting at 100. */
function series(n, step = (i) => (i % 2 ? -0.004 : 0.005)) {
  const out = [];
  let price = 100;
  for (let i = 0; i < n; i += 1) {
    const open = price;
    price = Number((price * (1 + step(i))).toFixed(2));
    out.push({
      time: new Date(Date.UTC(2024, 0, 1) + i * 86400000).toISOString().slice(0, 10),
      open, high: Math.max(open, price) + 0.1, low: Math.min(open, price) - 0.1, close: price, volume: 1000,
    });
  }
  return out;
}

afterEach(() => jest.restoreAllMocks());

describe('claim checker: reading the numbers in a tip', () => {
  it.each([
    ['SUZLON will double in 7 days', 'multiple', 100, 5],
    ['get 10x in 2 weeks', 'multiple', 900, 10],
    ['guaranteed 200% return in 1 month', 'percent', 200, 21],
    ['buy now, 5 गुना in 3 दिन', 'multiple', 400, 2],
  ])('%s', (text, kind, required, sessions) => {
    const [c] = claims.extractClaims(text);
    expect(c.kind).toBe(kind);
    expect(c.requiredPercent).toBe(required);
    expect(c.horizonSessions).toBe(sessions);
  });

  it('reads a target price and assumes about a month when no time is given', () => {
    const c = claims.extractClaims('Target 500 for this stock')[0];
    expect(c).toMatchObject({ kind: 'target', targetPrice: 500, assumedHorizon: true, horizonSessions: 21 });
  });

  it('finds nothing in ordinary text', () => {
    expect(claims.extractClaims('Results come out next week, let us see')).toEqual([]);
    expect(claims.extractClaims('')).toEqual([]);
  });
});

describe('claim checker: comparing with real history', () => {
  const candles = series(600);

  it('counts how often the stock really did that in the past', () => {
    const r = claims.checkClaim({ kind: 'multiple', multiple: 2, requiredPercent: 100, horizonSessions: 5, assumedHorizon: false }, candles, 134);
    expect(r.cases).toBe(595);
    expect(r.achieved).toBe(0);
    expect(r.bestGainPercent).toBeLessThan(5);
  });

  it('a modest claim was achieved many times', () => {
    const r = claims.checkClaim({ kind: 'percent', requiredPercent: 0.3, horizonSessions: 5, assumedHorizon: false }, candles, 134);
    expect(r.achieved).toBeGreaterThan(100);
    expect(r.achievedPercent).toBeLessThanOrEqual(100);
  });

  it('turns a target price into the % move it needs', () => {
    const r = claims.checkClaim({ kind: 'target', targetPrice: 150, horizonSessions: 21, assumedHorizon: true }, candles, 100);
    expect(r.requiredPercent).toBe(50);
    expect(r.currentPrice).toBe(100);
  });

  it('refuses to guess with too little history or a target below the price', () => {
    expect(claims.checkClaim({ kind: 'percent', requiredPercent: 5, horizonSessions: 5 }, series(20), 100)).toBeNull();
    expect(claims.checkClaim({ kind: 'target', targetPrice: 90, horizonSessions: 21 }, candles, 100)).toBeNull();
  });

  it('describes claims in plain words, in every language, and never predicts', () => {
    for (const language of ['en', 'hi', 'gu']) {
      const [d] = claims.describeClaims('double in 7 days', { candles, price: 134, language });
      expect(d.checked).toBe(true);
      expect(d.text).toMatch(/595/);
      expect(d.text).not.toMatch(/will (rise|fall|double)|buy|sell/i);
    }
  });

  it('says so when there is no stock or not enough data', () => {
    expect(claims.describeClaims('double in 7 days')[0]).toMatchObject({ checked: false });
    expect(claims.describeClaims('double in 7 days', { candles: series(10), price: 100 })[0].checked).toBe(false);
  });
});

describe('NSE surveillance lists', () => {
  const lists = { updated: '2026-11-10', asm: [{ symbol: 'ABC', stage: 'II' }], gsm: [{ symbol: 'XYZ', stage: '3' }] };

  it('finds a listed stock with its list, stage and list date', () => {
    expect(surveillance.check('ABC.NS', lists)).toEqual({ available: true, listDate: '2026-11-10', listed: true, list: 'ASM', stage: 'II' });
    expect(surveillance.check('xyz', lists)).toMatchObject({ listed: true, list: 'GSM', stage: '3' });
  });

  it('says not listed, or that no list is loaded, instead of guessing', () => {
    expect(surveillance.check('TCS.NS', lists)).toMatchObject({ available: true, listed: false });
    expect(surveillance.check('ABC.NS', { updated: null, asm: [], gsm: [] })).toMatchObject({ available: false, listed: false });
  });
});

describe('Tip Check with claims and surveillance', () => {
  const setup = () => {
    jest.spyOn(marketDataService, 'getHistory').mockImplementation(async (s, range) => ({
      symbol: 'AAA.NS', name: 'Aaa Ltd', currency: 'INR', source: 's', candles: range === '5y' ? series(600) : series(130),
    }));
    jest.spyOn(marketDataService, 'getMarketData').mockResolvedValue({ price: 134, marketCap: 5e11 });
  };

  it('adds the claim reality check to the result', async () => {
    setup();
    jest.spyOn(surveillance, 'check').mockReturnValue({ available: false, listDate: null, listed: false });
    const r = await tipCheck.check({ text: 'AAA will double in 7 days, guaranteed!', symbol: 'AAA.NS', language: 'en' });
    expect(r.claims).toHaveLength(1);
    expect(r.claims[0].checked).toBe(true);
    expect(r.claims[0].text).toMatch(/0 of \d+ windows/);
  });

  it('raises the risk and says so when the stock is on an NSE list', async () => {
    setup();
    jest.spyOn(surveillance, 'check').mockReturnValue({ available: true, listDate: '2026-11-10', listed: true, list: 'GSM', stage: '3' });
    const r = await tipCheck.check({ text: '', symbol: 'AAA.NS', language: 'en' });
    expect(r.reasons.map((x) => x.code)).toContain('surveillance_gsm');
    expect(r.reasons.find((x) => x.code === 'surveillance_gsm').text).toMatch(/Graded Surveillance/);
    expect(r.surveillance).toMatchObject({ listed: true, list: 'GSM' });
    expect(r.claims).toEqual([]);
  });
});

describe('compare two stocks (facts only)', () => {
  it('returns a window of the last year without ranking anything', () => {
    const history = { symbol: 'AAA.NS', name: 'Aaa', currency: 'INR', candles: series(260) };
    const d = compare.describeStock(history);
    expect(d.returns.year).toBeCloseTo(((history.candles.at(-1).close / history.candles[0].close) - 1) * 100, 1);
    expect(d.maxDrawdownPercent).toBeLessThanOrEqual(0);
    expect(d.positionInRangePercent).toBeGreaterThanOrEqual(0);
    expect(d.positionInRangePercent).toBeLessThanOrEqual(100);
    expect(JSON.stringify(d)).not.toMatch(/better|best stock|winner|buy|sell/i);
  });

  it('computes how closely two stocks moved together', () => {
    const a = series(100);
    expect(compare.correlation(a, a)).toBe(100);
    expect(compare.correlation(a, series(100, (i) => (i % 2 ? 0.005 : -0.004)))).toBeLessThan(0);
  });

  it('drawdown is the worst fall from a peak', () => {
    const c = [100, 120, 90, 110].map((close, i) => ({ time: `d${i}`, close }));
    expect(compare.maxDrawdown(c)).toBe(-25);
  });

  it('validates the endpoint input', async () => {
    expect((await request(app).get('/api/markets/compare?a=TCS.NS')).status).toBe(400);
    expect((await request(app).get('/api/markets/compare?a=TCS.NS&b=tcs.ns')).status).toBe(400);
    expect((await request(app).get('/api/markets/compare?a=%3Cb%3E&b=INFY.NS')).status).toBe(400);
  });

  it('compares two stocks over HTTP', async () => {
    jest.spyOn(marketDataService, 'getHistory').mockImplementation(async (s) => ({
      symbol: s, name: s, currency: 'INR', source: 's', candles: series(260, s === 'AAA.NS' ? undefined : (i) => (i % 3 ? 0.002 : -0.003)),
    }));
    const res = await request(app).get('/api/markets/compare?a=AAA.NS&b=BBB.NS');
    expect(res.status).toBe(200);
    expect(res.body.a.symbol).toBe('AAA.NS');
    expect(res.body.b.series.length).toBeGreaterThan(40);
    expect(res.body.note).toMatch(/not a ranking/i);
  });
});
