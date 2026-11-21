jest.mock('../src/lib/yahooHttp', () => ({ fetchYahooJson: jest.fn() }));
const { fetchYahooJson } = require('../src/lib/yahooHttp');
const marketDataService = require('../src/services/marketDataService');

const search = (quotes) => fetchYahooJson.mockResolvedValue({ quotes });

describe('resolveInstrument in free-text mode (allowGuess: false)', () => {
  beforeEach(() => fetchYahooJson.mockReset());

  test('a loose search hit that is an index is not accepted', async () => {
    search([{ symbol: '^RUT', shortname: 'Russell 2000' }]);
    expect(await marketDataService.resolveInstrument('Sure', { allowGuess: false })).toBeNull();
  });

  test('a listed company whose name does not contain the word is not accepted', async () => {
    search([{ symbol: 'ABC.NS', shortname: 'Abc Industries Ltd' }]);
    expect(await marketDataService.resolveInstrument('guaranteed', { allowGuess: false })).toBeNull();
  });

  test('a listed company whose name contains the words is accepted', async () => {
    search([{ symbol: 'KALYANKJIL.NS', shortname: 'Kalyan Jewellers India Limited' }]);
    const r = await marketDataService.resolveInstrument('Kalyan Jewellers', { allowGuess: false });
    expect(r.symbol).toBe('KALYANKJIL.NS');
  });

  test('a ticker that matches exactly is accepted', async () => {
    search([{ symbol: 'SUZLON.NS', shortname: 'Suzlon Energy Limited' }]);
    const r = await marketDataService.resolveInstrument('SUZLON', { allowGuess: false });
    expect(r.symbol).toBe('SUZLON.NS');
  });

  test('a word inside a company name is not a match ("talk" must not become Bombay Talkies)', async () => {
    search([{ symbol: 'BOMTALKIES.BO', shortname: 'BOMBAY TALKIES LTD', longname: 'Bombay Talkies Limited' }]);
    expect(await marketDataService.resolveInstrument('talk', { allowGuess: false })).toBeNull();
    search([{ symbol: 'ABC.NS', shortname: 'Sunrise Talk Ltd' }]);
    expect(await marketDataService.resolveInstrument('talk', { allowGuess: false })).toBeNull();
  });

  test('several words match when they appear together as whole words', async () => {
    search([{ symbol: 'TATAMOTORS.NS', shortname: 'TATA MOTORS LTD' }]);
    expect((await marketDataService.resolveInstrument('Tata Motors', { allowGuess: false })).symbol).toBe('TATAMOTORS.NS');
  });

  test('typed search (allowGuess true) still accepts the first Indian hit', async () => {
    search([{ symbol: '^NSEI', shortname: 'NIFTY 50' }]);
    const r = await marketDataService.resolveInstrument('qwertyx', { allowGuess: true });
    expect(r.symbol).toBe('^NSEI');
  });
});

describe('ambiguous brand words', () => {
  beforeEach(() => fetchYahooJson.mockReset());
  test('one word that fits several companies picks none', async () => {
    search([
      { symbol: 'TCS.NS', shortname: 'TATA CONSULTANCY SERV LT', longname: 'Tata Consultancy Services Limited' },
      { symbol: 'TATASTEEL.NS', shortname: 'TATA STEEL LIMITED', longname: 'Tata Steel Limited' },
    ]);
    expect(await marketDataService.resolveInstrument('tata', { allowGuess: false })).toBeNull();
  });
  test('the NSE and BSE listings of one company are not ambiguous', async () => {
    search([
      { symbol: 'SUZLON.NS', shortname: 'SUZLON ENERGY LTD', longname: 'Suzlon Energy Limited' },
      { symbol: '532667.BO', shortname: 'SUZLON ENERGY LTD', longname: 'Suzlon Energy Limited' },
    ]);
    expect((await marketDataService.resolveInstrument('suzlon', { allowGuess: false })).symbol).toBe('SUZLON.NS');
  });
});
