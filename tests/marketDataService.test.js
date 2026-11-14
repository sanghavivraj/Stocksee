const marketDataService = require('../src/services/marketDataService');
const { MarketDataUnavailableError } = require('../src/services/marketDataService');
const yahooFinance = require('yahoo-finance2').default;

jest.mock('yahoo-finance2', () => ({
  default: { quote: jest.fn() },
}));

const IST = 19800; // +05:30 in seconds
const day = (iso) => Math.floor(new Date(`${iso}T03:45:00Z`).getTime() / 1000); // 09:15 IST

/** Build a Yahoo v8 chart response from [date, close] pairs. */
function chartResponse(bars, meta = {}) {
  return {
    chart: {
      result: [{
        meta: {
          currency: 'INR',
          gmtoffset: IST,
          regularMarketPrice: bars[bars.length - 1][1],
          regularMarketTime: day(bars[bars.length - 1][0]) + 3600,
          // For range=1mo Yahoo reports the close BEFORE the month here — the old bug used it as "yesterday"
          chartPreviousClose: 50,
          ...meta,
        },
        timestamp: bars.map(([d]) => day(d)),
        indicators: {
          quote: [{
            open: bars.map(([, c]) => c),
            high: bars.map(([, c]) => c + 1),
            low: bars.map(([, c]) => c - 1),
            close: bars.map(([, c]) => c),
          }],
        },
      }],
    },
  };
}

const mockFetchJson = (body, ok = true) =>
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok, json: async () => body });

afterEach(() => jest.restoreAllMocks());

describe('MarketDataService', () => {
  it('fetches a real quote via yahoo-finance2', async () => {
    yahooFinance.quote.mockResolvedValueOnce({
      symbol: 'RELIANCE.NS',
      regularMarketPrice: 2500,
      regularMarketChange: 50,
      regularMarketChangePercent: 2,
      currency: 'INR',
    });
    const marketData = await marketDataService.getMarketData('RELIANCE');
    expect(marketData.symbol).toBe('RELIANCE');
    expect(marketData.price).toBe(2500);
    expect(marketData.change).toBe(50);
    expect(marketData.changePercent).toBe(2);
    expect(marketData.currency).toBe('INR');
  });

  it('throws MarketDataUnavailableError (503) instead of inventing a price for unknown symbols', async () => {
    yahooFinance.quote.mockRejectedValueOnce(new Error('Not found'));
    mockFetchJson({}, false);

    await expect(marketDataService.getMarketData('TVMP.NS')).rejects.toBeInstanceOf(MarketDataUnavailableError);
    await expect(marketDataService.getTrendData('TVMPX')).rejects.toMatchObject({ status: 503 });
  });

  it('computes day change from the previous session close, not the start of the month', async () => {
    mockFetchJson(chartResponse([
      ['2026-10-15', 100], ['2026-10-16', 102], ['2026-10-19', 104], ['2026-10-20', 106],
      ['2026-10-21', 108], ['2026-10-22', 110], ['2026-11-12', 120], ['2026-11-13', 118.8],
    ]));

    const trend = await marketDataService.getTrendData('DAYCHG.NS');
    expect(trend.currentPrice).toBe(118.8);
    expect(trend.dayChangePercent).toBe(-1);            // 120 -> 118.8
    expect(trend.weekChangePercent).toBe(14.23);        // 5 sessions before today: 104 -> 118.8
    expect(trend.monthChangePercent).toBe(18.8);        // first close 100 -> 118.8
    expect(trend.dayChangePercent).not.toBe(trend.monthChangePercent);
  });

  it('returns real OHLC candles sorted by date for charts', async () => {
    mockFetchJson(chartResponse([['2026-11-12', 120], ['2026-11-13', 118.8]]));

    const history = await marketDataService.getHistory('CANDLE.NS', '1mo');
    expect(history.candles).toEqual([
      { time: '2026-11-12', open: 120, high: 121, low: 119, close: 120, volume: 0 },
      { time: '2026-11-13', open: 118.8, high: 119.8, low: 117.8, close: 118.8, volume: 0 },
    ]);
    expect(history.events).toEqual([]);
  });

  it('includes real volume and dividend events from the provider', async () => {
    const body = chartResponse([['2026-11-12', 120], ['2026-11-13', 118.8]]);
    body.chart.result[0].indicators.quote[0].volume = [5000, 7000];
    body.chart.result[0].events = { dividends: { x: { amount: 6, date: day('2026-11-13') } } };
    mockFetchJson(body);

    const history = await marketDataService.getHistory('EVENTS.NS', '1mo');
    expect(history.candles.map((c) => c.volume)).toEqual([5000, 7000]);
    expect(history.events).toEqual([{ date: '2026-11-13', type: 'dividend', value: 6 }]);
  });

  it('rejects unsupported history ranges', async () => {
    await expect(marketDataService.getHistory('RELIANCE', '10y')).rejects.toMatchObject({ status: 400 });
  });
});
