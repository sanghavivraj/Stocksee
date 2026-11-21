jest.mock('../src/services/marketDataService', () => ({
  resolveInstrument: jest.fn(async () => null),
  getHistory: jest.fn(),
  getMarketData: jest.fn(),
}));
const adviser = require('../src/services/adviserService');
const tipCheckService = require('../src/services/tipCheckService');

const registry = {
  updated: '2026-11-01',
  entries: [{ number: 'INH000012345', name: 'Asha Research LLP', status: 'Active', validTill: null }],
};

describe('registration numbers in a message', () => {
  test('finds INA / INH / INZ numbers, with spaces or dashes, once each', () => {
    const found = adviser.extractRegistrations('SEBI Reg INH 000012345, also INH000012345 and INA-000054321 and INZ000111222');
    expect(found).toEqual([
      { number: 'INH000012345', type: 'analyst' },
      { number: 'INA000054321', type: 'adviser' },
      { number: 'INZ000111222', type: 'broker' },
    ]);
  });
  test('ignores words that only look similar', () => {
    expect(adviser.extractRegistrations('INFOSYS 123456789 and INH12345')).toEqual([]);
  });
  test('notices a "SEBI registered" claim in English, Hindi and Gujarati', () => {
    expect(adviser.claimsRegistered('We are SEBI registered experts')).toBe(true);
    expect(adviser.claimsRegistered('हम सेबी रजिस्टर्ड हैं')).toBe(true);
    expect(adviser.claimsRegistered('અમે સેબી રજિસ્ટર્ડ છીએ')).toBe(true);
    expect(adviser.claimsRegistered('SEBI announced new rules')).toBe(false);
  });
});

describe('checking against the loaded list', () => {
  test('a listed number returns the registered name to compare, and no warning', () => {
    const r = adviser.check('Call me, SEBI RA INH000012345', registry);
    expect(r.numbers[0]).toMatchObject({ listed: true, name: 'Asha Research LLP' });
    expect(adviser.signals(r)).toEqual([]);
  });
  test('a number that is not in the list is a warning sign', () => {
    const r = adviser.check('SEBI registered INH999999999', registry);
    expect(r.numbers[0].listed).toBe(false);
    expect(adviser.signals(r).map((s) => s.code)).toEqual(['registration_not_listed']);
  });
  test('with no list loaded nothing is claimed either way', () => {
    const r = adviser.check('SEBI registered INH000012345', { updated: null, entries: [] });
    expect(r.listAvailable).toBe(false);
    expect(r.numbers[0].listed).toBeNull();
    expect(adviser.signals(r)).toEqual([]);
  });
  test('"SEBI registered" with no number is a warning sign', () => {
    const r = adviser.check('We are SEBI registered, join our VIP group', registry);
    expect(adviser.signals(r).map((s) => s.code)).toEqual(['sebi_claim_no_number']);
  });
  test('a broker number does not count as an adviser registration', () => {
    const r = adviser.check('SEBI reg INZ000111222', registry);
    expect(adviser.signals(r).map((s) => s.code)).toEqual(['registration_wrong_type']);
  });
});

describe('importing the official CSV', () => {
  test('reads quoted names with commas, normalises numbers and drops bad rows', () => {
    const csv = [
      'Sr,Registration No.,Name of Entity,Validity,Status',
      '1,INH000012345,"Asha Research, LLP",Perpetual,Active',
      '2,inh 000054321,Ravi Analytics,2029-01-01,Active',
      '3,NOT-A-NUMBER,Broken Row,,',
    ].join('\n');
    const entries = adviser.parseRegistryCsv(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ number: 'INH000012345', name: 'Asha Research, LLP', status: 'Active' });
    expect(entries[1].number).toBe('INH000054321');
  });
  test('refuses a file without the needed columns', () => {
    expect(() => adviser.parseRegistryCsv('a,b\n1,2')).toThrow(/header/);
  });
});

describe('inside Tip Check', () => {
  test('adds the sender check to the result and scores a missing number', async () => {
    const r = await tipCheckService.check({ text: 'We are SEBI registered. Join our VIP telegram group for tips.' });
    expect(r.adviser).toMatchObject({ claimsRegistered: true, numbers: [] });
    expect(r.reasons.map((x) => x.code)).toContain('sebi_claim_no_number');
    expect(r.reasons.find((x) => x.code === 'sebi_claim_no_number').text).toMatch(/registration number/i);
  });
  test('no message means no sender check', async () => {
    const r = await tipCheckService.check({ text: '' }, {});
    expect(r.adviser).toBeNull();
  });
});

describe('promised returns with no stock named', () => {
  const marketDataService = require('../src/services/marketDataService');
  const calm = () => Array.from({ length: 400 }, (_, i) => ({ time: i, close: 100 + i * 0.02 }));

  test('compares the promise with the NIFTY 50 and flags a gain that never happened', async () => {
    marketDataService.getHistory.mockResolvedValue({ symbol: '^NSEI', candles: calm() });
    const r = await tipCheckService.check({ text: 'Guaranteed 300% return in 15 days, join our group' });
    expect(marketDataService.getHistory).toHaveBeenCalledWith('^NSEI', '5y');
    expect(r.claims[0]).toMatchObject({ checked: true, benchmark: true, achieved: 0 });
    expect(r.claims[0].text).toMatch(/NIFTY 50/);
    expect(r.reasons.map((x) => x.code)).toContain('promise_never_seen_index');
    expect(r.promise).toMatchObject({ requiredPercent: 300, benchmark: true });
  });

  test('says so plainly when the index history is unavailable', async () => {
    marketDataService.getHistory.mockRejectedValue(new Error('down'));
    const r = await tipCheckService.check({ text: 'Guaranteed 300% return in 15 days' });
    expect(r.promise).toBeNull();
    expect(r.claims[0].checked).toBe(false);
  });

  test('a message with no promised number does not touch market data', async () => {
    marketDataService.getHistory.mockClear();
    await tipCheckService.check({ text: 'Join our VIP telegram group' });
    expect(marketDataService.getHistory).not.toHaveBeenCalled();
  });
});

describe('claims in Hindi and Gujarati', () => {
  const { extractClaims } = require('../src/services/claimCheckService');
  test('reads a promised percent return and time in Gujarati and Hindi', () => {
    expect(extractClaims('ગેરંટી સાથે 300% રિટર્ન 15 દિવસમાં')[0]).toMatchObject({ kind: 'percent', requiredPercent: 300 });
    expect(extractClaims('પાક્કું 200% વળતર 10 દિવસમાં')[0]).toMatchObject({ kind: 'percent', requiredPercent: 200 });
    expect(extractClaims('पक्का 300% रिटर्न 15 दिन में')[0]).toMatchObject({ kind: 'percent', requiredPercent: 300 });
  });
});

describe('Tip Check: false positives and gaps found in strict testing', () => {
  const marketDataService = require('../src/services/marketDataService');
  const run = (text) => tipCheckService.check({ text });
  beforeEach(() => { marketDataService.getHistory.mockRejectedValue(new Error('no data')); });

  test('"5x faster" and "double glazing" are not promised returns', async () => {
    for (const text of ['Our new phone is 5x faster than the old one', 'We are replacing the double glazing windows']) {
      const r = await run(text);
      expect(r.reasons.map((x) => x.code)).not.toContain('return_promise');
      expect(r.claims).toEqual([]);
    }
  });
  test('"10x" in a money message still counts', async () => {
    const r = await run('This stock will give 10x returns');
    expect(r.reasons.map((x) => x.code)).toContain('return_promise');
  });
  test('Hinglish / Hindi "double hoga" is a promised return', async () => {
    for (const text of ['bhai pakka double hoga', 'पक्का डबल होगा']) {
      expect((await run(text)).reasons.map((x) => x.code)).toContain('return_promise');
    }
  });
  test('a paid tips group alone is a medium warning, and a lone weak sign never says "no warning signs"', async () => {
    const r = await run('Join our VIP telegram group, fees 999 for tips');
    expect(r.level).toBe('MEDIUM');
    const weak = await run('We are SEBI registered experts');
    expect(weak.level).toBe('LOW');
    expect(weak.summary).toMatch(/One warning sign/);
  });
});

describe('pressure wording in short, casual messages', () => {
  const marketDataService = require('../src/services/marketDataService');
  beforeEach(() => { marketDataService.getHistory.mockRejectedValue(new Error('no data')); });
  const codes = async (text) => (await tipCheckService.check({ text })).reasons.map((x) => x.code);

  test('"buy buy buy ... right now ... whatever price" is flagged', async () => {
    const c = await codes('buy buy buy cccl right now what ever price it is it give you the 20% return');
    expect(c).toEqual(expect.arrayContaining(['urgency', 'price_blind', 'return_promise']));
  });
  test.each([
    ['Buy at any price, it will fly'],
    ['खरीदो किसी भी भाव पर'],
    ['ગમે તે ભાવે લઈ લો'],
    ['buy it regardless of the price'],
  ])('price-blind wording: %s', async (text) => {
    expect(await codes(text)).toContain('price_blind');
  });
  test('ordinary sentences are not flagged', async () => {
    for (const text of ['What is happening right now in the market?', 'Please buy milk', 'What price is TCS at today?']) {
      const c = await codes(text);
      expect(c).not.toContain('urgency');
      expect(c).not.toContain('price_blind');
    }
  });
});
