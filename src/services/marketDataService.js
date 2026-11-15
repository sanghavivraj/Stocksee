const yahooFinance = require('yahoo-finance2').default;
const { round } = require('../lib/num');
const { createTtlCache } = require('../lib/ttlCache');
const { fetchYahooJson } = require('../lib/yahooHttp');
const { MarketDataUnavailableError } = require('../lib/errors');
const { SYMBOL_DICTIONARY } = require('../constants/symbolDictionary');

// In-memory cache for quotes, trends, history and earnings dates; each read says how fresh it must be (30s by default)
const CACHE_TTL_MS = 30000;
const cache = createTtlCache({ maxEntries: 2000 });
const DATA_SOURCE = 'Yahoo Finance (may be delayed)';
const HISTORY_RANGES = ['1mo', '3mo', '6mo', '1y', '2y', '5y'];

/** Convert a unix timestamp to the exchange-local calendar date (YYYY-MM-DD). */
function toExchangeDate(unixSeconds, gmtOffsetSeconds = 0) {
  return new Date((unixSeconds + gmtOffsetSeconds) * 1000).toISOString().slice(0, 10);
}


/**
 * Gold, silver and crude are international futures quoted in USD. For Indian users we also express them
 * in rupees using the live USD/INR rate. This is a plain unit/currency conversion of the same market price,
 * NOT the MCX or jeweller price (those include import duty, GST and local premiums), and it is labelled so.
 */
const GRAMS_PER_TROY_OZ = 31.1034768;
const COMMODITY_UNITS = {
  'GC=F': { unitCode: '10g', unit: 'per 10 g', toUnit: (usd) => (usd / GRAMS_PER_TROY_OZ) * 10, decimals: 0 },
  'SI=F': { unitCode: 'kg', unit: 'per kg', toUnit: (usd) => (usd / GRAMS_PER_TROY_OZ) * 1000, decimals: 0 },
  'CL=F': { unitCode: 'barrel', unit: 'per barrel', toUnit: (usd) => usd, decimals: 2 },
};
const CONVERSION_NOTE = 'Converted from the international USD price at the live USD/INR rate. Indian market prices (MCX, jewellers) differ because of import duty, GST and local premiums.';

class MarketDataService {
  /**
   * Resolve user text/symbol into a normalized instrument descriptor
   */
  /**
   * @param {string} query
   * @param {{ allowGuess?: boolean }} options  allowGuess=false: only return instruments confirmed by the
   *   dictionary or the exchange search (used when scanning free text, so words like "JACKPOT" aren't tickers)
   */
  async resolveInstrument(query, { allowGuess = true } = {}) {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim();
    const upper = clean.toUpperCase();

    // 1. Check exact dictionary match
    if (SYMBOL_DICTIONARY[upper]) {
      return { ...SYMBOL_DICTIONARY[upper] };
    }

    // 2. Check localized/trimmed dictionary match
    for (const [key, val] of Object.entries(SYMBOL_DICTIONARY)) {
      if (key.toUpperCase() === upper || clean.toLowerCase() === key.toLowerCase()) {
        return { ...val };
      }
    }

    // 3. Direct exchange ticker patterns (e.g. ^NSEI, GC=F, RELIANCE.NS)
    if (upper.startsWith('^') || upper.includes('=')) {
      return { symbol: upper, name: upper, type: 'INDEX' };
    }
    if (upper.endsWith('.NS') || upper.endsWith('.BO')) {
      const baseName = upper.replace(/\.(NS|BO)$/, '');
      return { symbol: upper, name: baseName, type: 'EQUITY' };
    }

    // 4. Fallback search via Yahoo Finance search API for Indian equities
    const searchUrls = [
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(clean)}&quotesCount=8&newsCount=0`,
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(clean)}&quotesCount=8&newsCount=0`,
    ];

    for (const searchUrl of searchUrls) {
      try {
        const data = await fetchYahooJson(searchUrl);
        if (data) {
          const quotes = data.quotes || [];
          // Prioritize NSE (.NS) then BSE (.BO) then index (^)
          const indianQuote = quotes.find(q => q.symbol && (q.symbol.endsWith('.NS') || q.symbol.endsWith('.BO') || q.symbol.startsWith('^')));
          if (indianQuote) {
            return {
              symbol: indianQuote.symbol,
              name: indianQuote.shortname || indianQuote.longname || indianQuote.symbol.replace(/\.(NS|BO)$/, ''),
              type: indianQuote.quoteType || 'EQUITY',
            };
          }
        }
      } catch (e) {
        // Continue to next endpoint
      }
    }

    // 5. Default assume NSE equity ONLY for clean single-token words (e.g. CCCL, TCS, BEL)
    // Never fabricate symbols for multi-word phrases (e.g. "shankesh tommorw")
    if (allowGuess && !clean.includes(' ')) {
      const cleanUpper = upper.replace(/[^A-Z0-9&]/g, '');
      if (cleanUpper.length >= 2 && cleanUpper.length <= 14) {
        return { symbol: `${cleanUpper}.NS`, name: cleanUpper, type: 'EQUITY' };
      }
    }

    return null;
  }

  resolveProviderSymbol(symbol) {
    const clean = (symbol || '').trim().toUpperCase();
    if (SYMBOL_DICTIONARY[clean]) return SYMBOL_DICTIONARY[clean].symbol;
    if (clean.startsWith('^') || clean.includes('=')) return clean;
    if (!clean.endsWith('.NS') && !clean.endsWith('.BO')) return `${clean}.NS`;
    return clean;
  }

  /**
   * Fetch a Yahoo daily chart for the first candidate symbol that returns data.
   * @returns {Promise<{symbol: string, result: object} | null>}
   */
  async fetchDailyChart(candidateSymbols, range) {
    for (const s of candidateSymbols) {
      for (const host of ['query2', 'query1']) {
        const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=${range}&events=div%7Csplit`;
        try {
          const json = await fetchYahooJson(url);
          const result = json?.chart?.result?.[0];
          if (result?.meta?.regularMarketPrice !== undefined) {
            return { symbol: s, result };
          }
        } catch (e) {
          // Try next host / symbol
        }
      }
    }
    return null;
  }


  /** Live USD/INR rate, or null when unavailable (we then keep the original USD price rather than guess). */
  async getUsdInr() {
    try {
      const fx = await this.fetchQuote('USDINR=X');
      return fx?.price > 0 ? fx.price : null;
    } catch {
      return null;
    }
  }

  /** Rewrite the price fields of a USD commodity into rupees per Indian unit; percentages are unchanged. */
  async toRupees(data, providerSymbol, priceKeys) {
    const spec = COMMODITY_UNITS[(providerSymbol || '').toUpperCase()];
    if (!spec || data.currency !== 'USD') return data;
    const rate = await this.getUsdInr();
    if (!rate) return data;
    const conv = (v) => (typeof v === 'number' ? Number((spec.toUnit(v) * rate).toFixed(spec.decimals)) : v);
    const out = { ...data, currency: 'INR', unit: spec.unit, unitCode: spec.unitCode, converted: true, usdInr: Number(rate.toFixed(2)), conversionNote: CONVERSION_NOTE };
    out.usdPrice = data[priceKeys[0]];
    for (const k of priceKeys) out[k] = conv(data[k]);
    return out;
  }

  /** Latest quote. Commodities quoted in USD are also converted to rupees (see COMMODITY_UNITS). */
  async getMarketData(symbol) {
    const data = await this.fetchQuote(symbol);
    return this.toRupees(data, data.providerSymbol, ['price', 'change', 'high', 'low']);
  }

  /** Day / week / month returns from real closes (rupee-converted for commodities). */
  async getTrendData(symbolOrQuery) {
    const data = await this.fetchTrend(symbolOrQuery);
    return this.toRupees(data, data.symbol, ['currentPrice', 'dayChange', 'dayHigh', 'dayLow', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow']);
  }

  /** NSE symbol first, then the BSE twin (and vice versa). */
  exchangeCandidates(symbol) {
    const candidates = [symbol];
    if (symbol.endsWith('.NS')) candidates.push(symbol.replace(/\.NS$/, '.BO'));
    else if (symbol.endsWith('.BO')) candidates.push(symbol.replace(/\.BO$/, '.NS'));
    return candidates;
  }

  /**
   * Fetch 1-day quote for ticker.
   * Throws MarketDataUnavailableError when no real data exists — never invents a price.
   */
  async fetchQuote(symbol) {
    const cleanSym = (symbol || '').trim();
    if (!cleanSym) {
      throw new MarketDataUnavailableError('Symbol is required', 400);
    }

    const providerSymbol = this.resolveProviderSymbol(cleanSym);
    const cacheKey = `QUOTE_${providerSymbol.toUpperCase()}`;
    const cached = cache.get(cacheKey, CACHE_TTL_MS);
    if (cached) return { ...cached, symbol: cleanSym };

    // 1. Try yahooFinance library if mocked or available
    if (yahooFinance && typeof yahooFinance.quote === 'function') {
      try {
        const result = await yahooFinance.quote(providerSymbol);
        if (result && result.regularMarketPrice !== undefined) {
          const data = {
            symbol: cleanSym,
            name: result.shortName || result.longName || (SYMBOL_DICTIONARY[cleanSym.toUpperCase()]?.name) || cleanSym.replace(/\.(NS|BO)$/, ''),
            providerSymbol,
            price: Number(result.regularMarketPrice.toFixed(2)),
            change: Number((result.regularMarketChange || 0).toFixed(2)),
            changePercent: Number((result.regularMarketChangePercent || 0).toFixed(2)),
            high: Number((result.regularMarketDayHigh || result.regularMarketPrice).toFixed(2)),
            low: Number((result.regularMarketDayLow || result.regularMarketPrice).toFixed(2)),
            currency: result.currency || SYMBOL_DICTIONARY[cleanSym.toUpperCase()]?.currency || 'INR',
            marketCap: Number.isFinite(result.marketCap) ? result.marketCap : null,
            volume: result.regularMarketVolume ? `${(result.regularMarketVolume / 1e6).toFixed(1)}M` : 'N/A',
            source: DATA_SOURCE,
            asOf: new Date().toISOString(),
          };
          cache.set(cacheKey, data);
          return data;
        }
      } catch (err) {
        // Fall through to chart endpoints
      }
    }

    // 2. Try live chart endpoint (range 1d: chartPreviousClose == previous session close here)
    const chart = await this.fetchDailyChart([providerSymbol], '1d');
    if (chart) {
      const meta = chart.result.meta;
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose || price;
      const change = price - prevClose;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;

      const data = {
        symbol: cleanSym,
        name: meta.shortName || meta.longName || (SYMBOL_DICTIONARY[cleanSym.toUpperCase()]?.name) || cleanSym.replace(/\.(NS|BO)$/, ''),
        providerSymbol,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        high: Number((meta.regularMarketDayHigh || price).toFixed(2)),
        low: Number((meta.regularMarketDayLow || price).toFixed(2)),
        currency: meta.currency || 'INR',
        volume: meta.regularMarketVolume
          ? meta.regularMarketVolume > 1e6
            ? `${(meta.regularMarketVolume / 1e6).toFixed(1)}M`
            : meta.regularMarketVolume.toString()
          : 'N/A',
        source: DATA_SOURCE,
        asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
      };

      cache.set(cacheKey, data);
      return data;
    }

    // 3. Serve the last real quote we had, clearly marked as stale
    const lastKnownQuote = cache.get(cacheKey); // any age
    if (lastKnownQuote) return { ...lastKnownQuote, symbol: cleanSym, stale: true };

    throw new MarketDataUnavailableError(`Live price for ${cleanSym} is unavailable right now`);
  }

  /**
   * Fetch 1-month daily history and compute day / 1-week / 1-month returns from real closes.
   * Throws MarketDataUnavailableError when no real data exists — never invents a price.
   */
  async fetchTrend(symbolOrQuery) {
    const instrument = await this.resolveInstrument(symbolOrQuery);
    if (!instrument || !instrument.symbol) {
      throw new MarketDataUnavailableError(`Could not identify instrument "${symbolOrQuery}"`, 404);
    }

    const cacheKey = `TREND_${instrument.symbol.toUpperCase()}`;
    const cached = cache.get(cacheKey, CACHE_TTL_MS);
    if (cached) return cached;

    const chart = await this.fetchDailyChart(this.exchangeCandidates(instrument.symbol), '1mo');
    if (chart) {
      const { result } = chart;
      const meta = result.meta;
      const offset = meta.gmtoffset || 0;
      const timestamps = result.timestamp || [];
      const closes = result?.indicators?.quote?.[0]?.close || [];

      // Real daily closes with their exchange-local dates
      const bars = timestamps
        .map((t, i) => ({ date: toExchangeDate(t, offset), close: closes[i] }))
        .filter((b) => b.close !== null && b.close !== undefined);

      const currentPrice = Number(meta.regularMarketPrice.toFixed(2));

      // Sessions strictly before the current session. NOTE: for range=1mo, meta.chartPreviousClose is the
      // close BEFORE the month started (not yesterday), so it must not be used for the day change.
      const sessionDate = meta.regularMarketTime ? toExchangeDate(meta.regularMarketTime, offset) : null;
      const priorBars = sessionDate ? bars.filter((b) => b.date < sessionDate) : bars.slice(0, -1);

      const prevClose = priorBars.length > 0
        ? priorBars[priorBars.length - 1].close
        : (meta.previousClose ?? null);
      const weekAgoClose = priorBars.length >= 5 ? priorBars[priorBars.length - 5].close : null;
      const monthAgoClose = bars.length > 0 ? bars[0].close : null;

      const pct = (from) => (from ? Number((((currentPrice - from) / from) * 100).toFixed(2)) : null);

      const dayChange = prevClose ? Number((currentPrice - prevClose).toFixed(2)) : null;
      const dayChangePercent = pct(prevClose);
      const weekChangePercent = pct(weekAgoClose);
      const monthChangePercent = pct(monthAgoClose);

      const dayHigh = meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh.toFixed(2)) : null;
      const dayLow = meta.regularMarketDayLow ? Number(meta.regularMarketDayLow.toFixed(2)) : null;
      const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh ? Number(meta.fiftyTwoWeekHigh.toFixed(2)) : null;
      const fiftyTwoWeekLow = meta.fiftyTwoWeekLow ? Number(meta.fiftyTwoWeekLow.toFixed(2)) : null;

      const trendData = {
        instrument: instrument.name,
        symbol: chart.symbol,
        type: instrument.type || 'EQUITY',
        currentPrice,
        currency: meta.currency || (instrument.currency || 'INR'),
        dayChange,
        dayChangePercent,
        weekChangePercent,
        monthChangePercent,
        dayHigh,
        dayLow,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        volume: meta.regularMarketVolume
          ? meta.regularMarketVolume > 1e6
            ? `${(meta.regularMarketVolume / 1e6).toFixed(1)}M`
            : meta.regularMarketVolume.toLocaleString('en-IN')
          : 'N/A',
        lastUpdated: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
        isPositive: (dayChangePercent ?? 0) >= 0,
        source: DATA_SOURCE,
        note: 'Latest available quote',
      };

      cache.set(cacheKey, trendData);
      return trendData;
    }

    // Serve the last real data we had, clearly marked as stale
    const lastKnownTrend = cache.get(cacheKey); // any age
    if (lastKnownTrend) return { ...lastKnownTrend, stale: true };

    throw new MarketDataUnavailableError(`Market data for ${instrument.symbol} is unavailable right now`);
  }

  /**
   * Real daily OHLCV candles plus corporate events (dividends, splits) for charts, alerts and backtests.
   * @param {string} symbolOrQuery
   * @param {'1mo'|'3mo'|'6mo'|'1y'|'2y'|'5y'} range
   * @param {{ maxAgeMs?: number }} options  how old a cached copy may be (alerts use a short age)
   * @returns {Promise<{symbol, currency, range, candles: Array<{time,open,high,low,close,volume}>, events: Array, source}>}
   */
  async getHistory(symbolOrQuery, range = '1mo', { maxAgeMs = CACHE_TTL_MS * 10 } = {}) {
    if (!HISTORY_RANGES.includes(range)) {
      throw new MarketDataUnavailableError(`Unsupported range "${range}"`, 400);
    }

    const instrument = await this.resolveInstrument(symbolOrQuery);
    if (!instrument || !instrument.symbol) {
      throw new MarketDataUnavailableError(`Could not identify instrument "${symbolOrQuery}"`, 404);
    }

    const cacheKey = `HISTORY_${range}_${instrument.symbol.toUpperCase()}`;
    const cached = cache.get(cacheKey, maxAgeMs);
    if (cached) return cached;

    const chart = await this.fetchDailyChart(this.exchangeCandidates(instrument.symbol), range);
    if (!chart) {
      const lastKnownHistory = cache.get(cacheKey); // any age
      if (lastKnownHistory) return { ...lastKnownHistory, stale: true };
      throw new MarketDataUnavailableError(`Price history for ${instrument.symbol} is unavailable right now`);
    }

    const { result } = chart;
    const offset = result.meta.gmtoffset || 0;
    const q = result?.indicators?.quote?.[0] || {};
    const byDate = new Map();
    (result.timestamp || []).forEach((t, i) => {
      const [open, high, low, close] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
      if ([open, high, low, close].some((v) => v === null || v === undefined)) return;
      byDate.set(toExchangeDate(t, offset), {
        open: round(open), high: round(high), low: round(low), close: round(close),
        volume: Number.isFinite(q.volume?.[i]) ? q.volume[i] : 0,
      });
    });

    const candles = [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([time, ohlcv]) => ({ time, ...ohlcv }));

    // Corporate actions reported by the data provider
    const events = [
      ...Object.values(result.events?.dividends || {}).map((d) => ({
        date: toExchangeDate(d.date, offset), type: 'dividend', value: d.amount,
      })),
      ...Object.values(result.events?.splits || {}).map((sp) => ({
        date: toExchangeDate(sp.date, offset), type: 'split', value: sp.splitRatio || `${sp.numerator}:${sp.denominator}`,
      })),
    ].filter((e) => !candles.length || e.date >= candles[0].time)
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const data = {
      symbol: chart.symbol,
      name: result.meta.longName || result.meta.shortName || instrument.name,
      currency: result.meta.currency || 'INR',
      range,
      candles,
      events,
      source: DATA_SOURCE,
    };
    cache.set(cacheKey, data);
    return data;
  }

  /**
   * Next/recent earnings dates (best effort: this provider endpoint is rate-limited, so failures return []).
   * Cached for 12 hours.
   */
  async getEarningsDates(symbol) {
    const key = `EARNINGS_${symbol.toUpperCase()}`;
    const cached = cache.get(key, 12 * 60 * 60 * 1000);
    if (cached) return cached;
    try {
      const res = await yahooFinance.quoteSummary(symbol, { modules: ['calendarEvents'] });
      const dates = (res?.calendarEvents?.earnings?.earningsDate || [])
        .map((d) => new Date(d).toISOString().slice(0, 10));
      cache.set(key, dates);
      return dates;
    } catch {
      return cache.get(key) || []; // any age
    }
  }

  /**
   * 5-minute prices of the latest session as % change from the previous close (for the "market replay").
   * Cached for one minute. Throws MarketDataUnavailableError when there is no real data.
   */
  async getIntraday(symbolOrQuery) {
    const instrument = await this.resolveInstrument(symbolOrQuery, { allowGuess: false });
    if (!instrument || !instrument.symbol) {
      throw new MarketDataUnavailableError(`Could not identify instrument "${symbolOrQuery}"`, 404);
    }
    const cacheKey = `INTRADAY_${instrument.symbol.toUpperCase()}`;
    const cached = cache.get(cacheKey, 60000);
    if (cached) return cached;

    for (const candidate of this.exchangeCandidates(instrument.symbol)) {
      for (const host of ['query2', 'query1']) {
        try {
          const json = await fetchYahooJson(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?interval=5m&range=1d`);
          const result = json?.chart?.result?.[0];
          const prev = result?.meta?.chartPreviousClose ?? result?.meta?.previousClose;
          const stamps = result?.timestamp || [];
          if (!result || !prev || !stamps.length) continue;
          const offset = result.meta.gmtoffset || 0;
          const q = result.indicators?.quote?.[0] || {};
          const bars = [];
          stamps.forEach((t, i) => {
            const close = q.close?.[i];
            if (close === null || close === undefined) return;
            const local = new Date((t + offset) * 1000).toISOString();
            bars.push({
              time: local.slice(11, 16),
              close: Number(close.toFixed(2)),
              percent: Number((((close - prev) / prev) * 100).toFixed(2)),
              volume: Number.isFinite(q.volume?.[i]) ? q.volume[i] : 0,
            });
          });
          if (!bars.length) continue;
          const data = {
            symbol: candidate,
            name: result.meta.longName || result.meta.shortName || instrument.name,
            date: toExchangeDate(stamps[0], offset),
            previousClose: Number(prev.toFixed(2)),
            bars,
            source: DATA_SOURCE,
          };
          cache.set(cacheKey, data);
          return data;
        } catch (e) {
          // try the next host / exchange
        }
      }
    }
    const lastKnownIntraday = cache.get(cacheKey); // any age
    if (lastKnownIntraday) return { ...lastKnownIntraday, stale: true };
    throw new MarketDataUnavailableError(`Intraday prices for ${instrument.symbol} are unavailable right now`);
  }

  /**
   * Fetch current market overview snapshot across key indices and commodities
   */
  async getMarketOverview() {
    const targets = [
      { key: 'NIFTY 50', symbol: '^NSEI', name: 'NIFTY 50' },
      { key: 'SENSEX', symbol: '^BSESN', name: 'SENSEX' },
      { key: 'BANK NIFTY', symbol: '^NSEBANK', name: 'BANK NIFTY' },
      { key: 'GOLD', symbol: 'GC=F', name: 'Gold (international)' },
      { key: 'CRUDE OIL', symbol: 'CL=F', name: 'Crude Oil (WTI)' },
    ];

    const results = await Promise.allSettled(
      targets.map(t => this.getTrendData(t.symbol))
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
  }
}

module.exports = new MarketDataService();
module.exports.MarketDataUnavailableError = MarketDataUnavailableError;