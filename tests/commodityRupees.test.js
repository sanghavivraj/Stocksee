const marketDataService = require('../src/services/marketDataService');
const aiService = require('../src/services/aiService');

const usdQuote = { symbol: 'GOLD', providerSymbol: 'GC=F', name: 'Gold', price: 3886.3, change: 12.3, changePercent: 0.32, high: 3900.1, low: 3870.2, currency: 'USD' };

afterEach(() => jest.restoreAllMocks());

describe('gold / crude in rupees', () => {
  it('converts a USD gold quote to rupees per 10 g and keeps the percentage', async () => {
    jest.spyOn(marketDataService, 'fetchQuote').mockImplementation(async (s) => (s === 'USDINR=X' ? { price: 88 } : usdQuote));
    const q = await marketDataService.getMarketData('GOLD');
    // 3886.3 USD/oz -> per 10 g -> x 88
    expect(q.currency).toBe('INR');
    expect(q.unit).toBe('per 10 g');
    expect(q.price).toBe(Math.round((3886.3 / 31.1034768) * 10 * 88));
    expect(q.changePercent).toBe(0.32);
    expect(q).toMatchObject({ converted: true, usdInr: 88, usdPrice: 3886.3 });
    expect(q.conversionNote).toMatch(/MCX|jewellers/);
  });

  it('crude oil is rupees per barrel; rupee stocks are untouched', async () => {
    jest.spyOn(marketDataService, 'fetchQuote').mockImplementation(async (s) => {
      if (s === 'USDINR=X') return { price: 88 };
      return s === 'CRUDEOIL'
        ? { ...usdQuote, providerSymbol: 'CL=F', price: 60.5, change: 1, high: 61, low: 59 }
        : { symbol: 'TCS', providerSymbol: 'TCS.NS', price: 2400, currency: 'INR' };
    });
    const oil = await marketDataService.getMarketData('CRUDEOIL');
    expect(oil).toMatchObject({ currency: 'INR', unit: 'per barrel', price: 5324 });
    const tcs = await marketDataService.getMarketData('TCS');
    expect(tcs).toMatchObject({ currency: 'INR', price: 2400 });
    expect(tcs.converted).toBeUndefined();
  });

  it('keeps the honest USD price (never a guess) when the exchange rate is unavailable', async () => {
    jest.spyOn(marketDataService, 'fetchQuote').mockImplementation(async (s) => {
      if (s === 'USDINR=X') throw new Error('down');
      return usdQuote;
    });
    const q = await marketDataService.getMarketData('GOLD');
    expect(q.currency).toBe('USD');
    expect(q.converted).toBeUndefined();
  });

  it('trend data is converted too and the AI answer shows rupees, the unit and the note (en/hi/gu)', async () => {
    jest.spyOn(marketDataService, 'fetchQuote').mockResolvedValue({ price: 88 });
    jest.spyOn(marketDataService, 'fetchTrend').mockResolvedValue({
      instrument: 'Gold', symbol: 'GC=F', currentPrice: 3886.3, currency: 'USD', dayChange: 12.3, dayChangePercent: 0.32,
      weekChangePercent: 1.1, monthChangePercent: 2.2, dayHigh: 3900.1, dayLow: 3870.2, fiftyTwoWeekHigh: 4000, fiftyTwoWeekLow: 3000,
    });
    const data = await marketDataService.getTrendData('GOLD');
    expect(data).toMatchObject({ currency: 'INR', unitCode: '10g', dayChangePercent: 0.32 });

    for (const [language, unit, note] of [['en', 'per 10 g', 'MCX'], ['hi', 'प्रति 10 ग्राम', 'MCX'], ['gu', 'પ્રતિ 10 ગ્રામ', 'MCX']]) {
      const { answer } = await aiService.generate({ question: 'gold price', language, intent: 'PRICE_QUERY', marketData: data });
      expect(answer).toContain('₹');
      expect(answer).not.toContain('$3');
      expect(answer).toContain(unit);
      expect(answer).toContain(note);
    }
  });
});
