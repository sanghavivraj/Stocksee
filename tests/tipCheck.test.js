jest.mock('../src/services/marketDataService', () => ({
  resolveInstrument: jest.fn(async (q) => (q === 'PUMPCO' || q === 'PUMPCO.NS' ? { symbol: 'PUMPCO.NS' } : null)),
  getHistory: jest.fn(),
  getMarketData: jest.fn(),
}));
const marketDataService = require('../src/services/marketDataService');
const tipCheckService = require('../src/services/tipCheckService');

const day = (i) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const pumped = () => {
  const c = [];
  let p = 8;
  for (let i = 0; i < 60; i += 1) {
    if (i >= 50) p *= 1.05;
    c.push({ time: day(i), open: p, high: p, low: p, close: Number(p.toFixed(2)), volume: i === 59 ? 9000 : 1000 });
  }
  return c;
};

beforeEach(() => jest.clearAllMocks());

describe('Tip Check', () => {
  it('combines message red flags with real market signals into a HIGH risk result', async () => {
    marketDataService.getHistory.mockResolvedValue({ symbol: 'PUMPCO.NS', name: 'Pump Co', currency: 'INR', candles: pumped(), source: 'test' });
    marketDataService.getMarketData.mockResolvedValue({ price: 13, marketCap: 120 * 1e7 });

    const r = await tipCheckService.check(
      { text: 'PUMPCO jackpot! Operator entry, guaranteed 300% return in 15 days. Buy now, join our VIP telegram group' },
      { extractEntity: async () => 'PUMPCO' },
    );

    expect(r.level).toBe('HIGH');
    expect(r.instrument).toMatchObject({ symbol: 'PUMPCO.NS', name: 'Pump Co' });
    const codes = r.reasons.map((x) => x.code);
    expect(codes).toEqual(expect.arrayContaining([
      'guaranteed_returns', 'return_promise', 'insider_claim', 'urgency', 'circuit_hype', 'short_term_target', 'paid_group',
      'volume_extreme', 'runup_extreme', 'repeated_sharp_rises', 'penny_stock', 'micro_cap',
    ]));
    expect(r.guidance.join(' ')).toMatch(/scores\.sebi\.gov\.in/);
    expect(JSON.stringify(r)).not.toMatch(/\bscam\b|\bsafe to buy\b/i);
  });

  it('understands Hindi and Gujarati hype', async () => {
    const hi = await tipCheckService.check({ text: 'ये शेयर पक्का डबल होगा, अंदर की खबर है, जल्दी खरीदो', language: 'hi' }, { extractEntity: async () => null });
    expect(hi.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['guaranteed_returns', 'insider_claim', 'urgency']));
    expect(hi.reasons[0].text).toMatch(/[ऀ-ॿ]/);

    const gu = await tipCheckService.check({ text: 'ઓપરેટરની અંદરની ખબર, ગેરંટી સાથે જેકપોટ', language: 'gu' }, { extractEntity: async () => null });
    expect(gu.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['guaranteed_returns', 'insider_claim', 'circuit_hype']));
  });

  it('a neutral question is LOW and does not invent a stock', async () => {
    const r = await tipCheckService.check({ text: 'What do you think about results season?' }, { extractEntity: async () => 'RESULTS' });
    expect(r.level).toBe('LOW');
    expect(r.instrument).toBeNull();
    expect(r.notes[0]).toMatch(/Could not identify a stock/);
  });

  it('still checks the wording when market data is unavailable', async () => {
    marketDataService.getHistory.mockRejectedValue(new Error('down'));
    const r = await tipCheckService.check({ text: 'guaranteed profit, operator stock', symbol: 'PUMPCO.NS' });
    expect(r.notes[0]).toMatch(/unavailable/);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('checks only market patterns when just a symbol is given', async () => {
    marketDataService.getHistory.mockResolvedValue({ symbol: 'PUMPCO.NS', name: 'Pump Co', currency: 'INR', candles: pumped(), source: 'test' });
    marketDataService.getMarketData.mockResolvedValue({ price: 13, marketCap: 120 * 1e7 });
    const extractEntity = jest.fn();

    const r = await tipCheckService.check({ text: '', symbol: 'PUMPCO' }, { extractEntity });

    expect(extractEntity).not.toHaveBeenCalled();
    expect(r.reasons.every((x) => x.kind === 'market')).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.notes.join(' ')).toMatch(/No message was pasted/);
  });

  it('symbol-only check with an unknown symbol fails clearly instead of saying Low risk', async () => {
    marketDataService.getHistory.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    marketDataService.getMarketData.mockRejectedValue(new Error('x'));
    await expect(tipCheckService.check({ text: '', symbol: 'NOPE' })).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/check the symbol/) });
  });
});
