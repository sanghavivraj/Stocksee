const yahooFinance = require('yahoo-finance2').default;

// Comprehensive dictionary for top Indian equities, indices, commodities, and multilingual terms
const SYMBOL_DICTIONARY = {
  // Indices
  'NIFTY': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'NIFTY 50': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'NIFTY50': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  '^NSEI': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'निफ्टी': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },
  'નિફ્ટી': { symbol: '^NSEI', name: 'NIFTY 50', type: 'INDEX' },

  'SENSEX': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  'BSE SENSEX': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  '^BSESN': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  'सेंसेक्स': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },
  'સેન્સેક્સ': { symbol: '^BSESN', name: 'SENSEX', type: 'INDEX' },

  'BANK NIFTY': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'BANKNIFTY': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'NIFTYBANK': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'NIFTY BANK': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  '^NSEBANK': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'बैंक निफ्टी': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },
  'બેંક નિફ્ટી': { symbol: '^NSEBANK', name: 'BANK NIFTY', type: 'INDEX' },

  // Commodities
  'GOLD': { symbol: 'GC=F', name: 'Gold (international)', type: 'COMMODITY', currency: 'USD' },
  'GOLD 24K': { symbol: 'GC=F', name: 'Gold (international)', type: 'COMMODITY', currency: 'USD' },
  'GC=F': { symbol: 'GC=F', name: 'Gold', type: 'COMMODITY', currency: 'USD' },
  'सोना': { symbol: 'GC=F', name: 'Gold', type: 'COMMODITY', currency: 'USD' },
  'સોનું': { symbol: 'GC=F', name: 'Gold', type: 'COMMODITY', currency: 'USD' },

  'CRUDE': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'CRUDE OIL': { symbol: 'CL=F', name: 'Crude Oil (WTI)', type: 'COMMODITY', currency: 'USD' },
  'CRUDEOIL': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'OIL': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'CL=F': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'कच्चा तेल': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },
  'ક્રૂડ ઓઇલ': { symbol: 'CL=F', name: 'Crude Oil', type: 'COMMODITY', currency: 'USD' },

  'USD/INR': { symbol: 'USDINR=X', name: 'USD / INR', type: 'CURRENCY', currency: 'INR' },
  'USDINR': { symbol: 'USDINR=X', name: 'USD / INR', type: 'CURRENCY', currency: 'INR' },

  // Indian Equities (Top High-Volume / Requested)
  'IOC': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'IOCL': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'INDIAN OIL': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'INDIAN OIL CORPORATION': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'IOC.NS': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },
  'आईओसी': { symbol: 'IOC.NS', name: 'Indian Oil Corporation', type: 'EQUITY' },

  'JIOFIN': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIO FINANCIAL': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIO FINANCIAL SERVICES': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIO FIN': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'JIOFIN.NS': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'जियो फाइनेंस': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },
  'જિયો ફાઇનાન્સ': { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', type: 'EQUITY' },

  'RELIANCE': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'RELIANCE INDUSTRIES': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'RIL': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'RELIANCE.NS': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'रिलायंस': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },
  'રિલાયન્સ': { symbol: 'RELIANCE.NS', name: 'Reliance Industries', type: 'EQUITY' },

  'TCS': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'TATA CONSULTANCY': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'TATA CONSULTANCY SERVICES': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'TCS.NS': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },
  'टीसीएस': { symbol: 'TCS.NS', name: 'Tata Consultancy Services', type: 'EQUITY' },

  'TATAMOTORS': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },
  'TATA MOTORS': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },
  'टाटा मोटर्स': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },
  'ટાટા મોટર્સ': { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', type: 'EQUITY' },

  'TATASTEEL': { symbol: 'TATASTEEL.NS', name: 'Tata Steel', type: 'EQUITY' },
  'TATA STEEL': { symbol: 'TATASTEEL.NS', name: 'Tata Steel', type: 'EQUITY' },

  'INFY': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },
  'INFOSYS': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },
  'INFOSYS LIMITED': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },
  'इंफोसिस': { symbol: 'INFY.NS', name: 'Infosys Limited', type: 'EQUITY' },

  'HDFCBANK': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },
  'HDFC BANK': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },
  'HDFC': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },
  'एचडीएफसी बैंक': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', type: 'EQUITY' },

  'ICICIBANK': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', type: 'EQUITY' },
  'ICICI BANK': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', type: 'EQUITY' },
  'ICICI': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', type: 'EQUITY' },

  'SBIN': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },
  'SBI': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },
  'STATE BANK OF INDIA': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },
  'एसबीआई': { symbol: 'SBIN.NS', name: 'State Bank of India', type: 'EQUITY' },

  'ITC': { symbol: 'ITC.NS', name: 'ITC Limited', type: 'EQUITY' },
  'ITC LIMITED': { symbol: 'ITC.NS', name: 'ITC Limited', type: 'EQUITY' },
  'आईटीसी': { symbol: 'ITC.NS', name: 'ITC Limited', type: 'EQUITY' },

  'ADANIENT': { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', type: 'EQUITY' },
  'ADANI ENTERPRISES': { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', type: 'EQUITY' },
  'अदाणी एंटरप्राइजेज': { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', type: 'EQUITY' },

  'ADANIPORTS': { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ', type: 'EQUITY' },
  'ADANI PORTS': { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ', type: 'EQUITY' },

  'LT': { symbol: 'LT.NS', name: 'Larsen & Toubro', type: 'EQUITY' },
  'L&T': { symbol: 'LT.NS', name: 'Larsen & Toubro', type: 'EQUITY' },
  'LARSEN & TOUBRO': { symbol: 'LT.NS', name: 'Larsen & Toubro', type: 'EQUITY' },

  'AXISBANK': { symbol: 'AXISBANK.NS', name: 'Axis Bank', type: 'EQUITY' },
  'AXIS BANK': { symbol: 'AXISBANK.NS', name: 'Axis Bank', type: 'EQUITY' },

  'HINDUNILVR': { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', type: 'EQUITY' },
  'HUL': { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', type: 'EQUITY' },
  'HINDUSTAN UNILEVER': { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', type: 'EQUITY' },

  // Defense, PSU & Emerging Bluechips
  'BEL': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'BEL.NS': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'BHARAT ELECTRONICS': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'बीईएल': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },
  'બીઈએલ': { symbol: 'BEL.NS', name: 'Bharat Electronics Limited', type: 'EQUITY' },

  'HAL': { symbol: 'HAL.NS', name: 'Hindustan Aeronautics Limited', type: 'EQUITY' },
  'HAL.NS': { symbol: 'HAL.NS', name: 'Hindustan Aeronautics Limited', type: 'EQUITY' },
  'HINDUSTAN AERONAUTICS': { symbol: 'HAL.NS', name: 'Hindustan Aeronautics Limited', type: 'EQUITY' },

  'ZOMATO': { symbol: 'ZOMATO.NS', name: 'Zomato Limited', type: 'EQUITY' },
  'ZOMATO.NS': { symbol: 'ZOMATO.NS', name: 'Zomato Limited', type: 'EQUITY' },

  'IRFC': { symbol: 'IRFC.NS', name: 'Indian Railway Finance Corporation', type: 'EQUITY' },
  'IRFC.NS': { symbol: 'IRFC.NS', name: 'Indian Railway Finance Corporation', type: 'EQUITY' },

  'VEDL': { symbol: 'VEDL.NS', name: 'Vedanta Limited', type: 'EQUITY' },
  'VEDANTA': { symbol: 'VEDL.NS', name: 'Vedanta Limited', type: 'EQUITY' },

  'TITAN': { symbol: 'TITAN.NS', name: 'Titan Company', type: 'EQUITY' },
  'TITAN.NS': { symbol: 'TITAN.NS', name: 'Titan Company', type: 'EQUITY' },

  'COALINDIA': { symbol: 'COALINDIA.NS', name: 'Coal India Limited', type: 'EQUITY' },
  'COAL INDIA': { symbol: 'COALINDIA.NS', name: 'Coal India Limited', type: 'EQUITY' },

  'NTPC': { symbol: 'NTPC.NS', name: 'NTPC Limited', type: 'EQUITY' },
  'POWERGRID': { symbol: 'POWERGRID.NS', name: 'Power Grid Corporation', type: 'EQUITY' },
  'ONGC': { symbol: 'ONGC.NS', name: 'Oil and Natural Gas Corporation', type: 'EQUITY' },


  'BHARTIARTL': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', type: 'EQUITY' },
  'AIRTEL': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', type: 'EQUITY' },
  'BHARTI AIRTEL': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', type: 'EQUITY' },

  'SUNPHARMA': { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', type: 'EQUITY' },
  'SUN PHARMA': { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', type: 'EQUITY' },

  'MARUTI': { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', type: 'EQUITY' },
  'MARUTI SUZUKI': { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', type: 'EQUITY' },

  'M&M': { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', type: 'EQUITY' },
  'MAHINDRA': { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', type: 'EQUITY' },

  'WIPRO': { symbol: 'WIPRO.NS', name: 'Wipro Limited', type: 'EQUITY' },
  'BAJFINANCE': { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', type: 'EQUITY' },
  'BAJAJ FINANCE': { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', type: 'EQUITY' },
  'KOTAKBANK': { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', type: 'EQUITY' },
  'KOTAK BANK': { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', type: 'EQUITY' },

  // Deccan Gold Mines & Precious Metal / Jewelry Equities
  'DECNGOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECNGOLD.NS': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECNGOLD.BO': { symbol: 'DECNGOLD.BO', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCAN GOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCANGOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECANGOLD': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCAN GOLD MINES': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'DECCAN GOLD MINES LIMITED': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'डेक्कन गोल्ड': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },
  'ડેક્કન ગોલ્ડ': { symbol: 'DECNGOLD.NS', name: 'Deccan Gold Mines Limited', type: 'EQUITY', currency: 'INR' },

  'GOLDBEES': { symbol: 'GOLDBEES.NS', name: 'Nippon India ETF Gold BeES', type: 'EQUITY', currency: 'INR' },
  'GOLD BEES': { symbol: 'GOLDBEES.NS', name: 'Nippon India ETF Gold BeES', type: 'EQUITY', currency: 'INR' },
  'GOLDIAM': { symbol: 'GOLDIAM.NS', name: 'Goldiam International Limited', type: 'EQUITY', currency: 'INR' },
  'GOLDTECH': { symbol: 'GOLDTECH.NS', name: 'Goldstone Technologies Limited', type: 'EQUITY', currency: 'INR' },
  'MUTHOOTFIN': { symbol: 'MUTHOOTFIN.NS', name: 'Muthoot Finance Limited', type: 'EQUITY', currency: 'INR' },
  'MUTHOOT FINANCE': { symbol: 'MUTHOOTFIN.NS', name: 'Muthoot Finance Limited', type: 'EQUITY', currency: 'INR' },
  'KALYANKJIL': { symbol: 'KALYANKJIL.NS', name: 'Kalyan Jewellers India Limited', type: 'EQUITY', currency: 'INR' },
  'KALYAN JEWELLERS': { symbol: 'KALYANKJIL.NS', name: 'Kalyan Jewellers India Limited', type: 'EQUITY', currency: 'INR' },
};

// In-memory cache for market quotes & trend data (30s TTL)
const cache = new Map();
const CACHE_TTL_MS = 30000;
const CACHE_MAX_ENTRIES = 2000;
const FETCH_TIMEOUT_MS = 5000;
const DATA_SOURCE = 'Yahoo Finance (may be delayed)';
const HISTORY_RANGES = ['1mo', '3mo', '6mo', '1y', '2y', '5y'];

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

/**
 * Thrown when no real market data can be obtained.
 * We never invent prices: callers must show "unavailable" instead.
 */
class MarketDataUnavailableError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'MarketDataUnavailableError';
    this.status = status;
  }
}

function cacheSet(key, data) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Drop the oldest entry (Map keeps insertion order)
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { timestamp: Date.now(), data });
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  return res.json();
}

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
        const data = await fetchJson(searchUrl);
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
          const json = await fetchJson(url);
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
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, symbol: cleanSym };
    }

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
          cacheSet(cacheKey, data);
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

      cacheSet(cacheKey, data);
      return data;
    }

    // 3. Serve the last real quote we had, clearly marked as stale
    if (cached) {
      return { ...cached.data, symbol: cleanSym, stale: true };
    }

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
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

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

      cacheSet(cacheKey, trendData);
      return trendData;
    }

    // Serve the last real data we had, clearly marked as stale
    if (cached) {
      return { ...cached.data, stale: true };
    }

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
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < maxAgeMs) {
      return cached.data;
    }

    const chart = await this.fetchDailyChart(this.exchangeCandidates(instrument.symbol), range);
    if (!chart) {
      if (cached) return { ...cached.data, stale: true };
      throw new MarketDataUnavailableError(`Price history for ${instrument.symbol} is unavailable right now`);
    }

    const { result } = chart;
    const offset = result.meta.gmtoffset || 0;
    const q = result?.indicators?.quote?.[0] || {};
    const round = (v) => Number(v.toFixed(2));
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
    cacheSet(cacheKey, data);
    return data;
  }

  /**
   * Next/recent earnings dates (best effort: this provider endpoint is rate-limited, so failures return []).
   * Cached for 12 hours.
   */
  async getEarningsDates(symbol) {
    const key = `EARNINGS_${symbol.toUpperCase()}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < 12 * 60 * 60 * 1000) return cached.data;
    try {
      const res = await yahooFinance.quoteSummary(symbol, { modules: ['calendarEvents'] });
      const dates = (res?.calendarEvents?.earnings?.earningsDate || [])
        .map((d) => new Date(d).toISOString().slice(0, 10));
      cacheSet(key, dates);
      return dates;
    } catch {
      return cached?.data || [];
    }
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

  /**
   * Fetch top gainers or losers across liquid Indian equities
   */
  async getTopMovers(type = 'gainers', limit = 10) {
    const symbols = [
      'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
      'SBIN.NS', 'IOC.NS', 'JIOFIN.NS', 'TATAMOTORS.NS', 'TATASTEEL.NS',
      'ITC.NS', 'ADANIENT.NS', 'ADANIPORTS.NS', 'LT.NS', 'AXISBANK.NS',
      'BHARTIARTL.NS', 'SUNPHARMA.NS', 'MARUTI.NS', 'M&M.NS', 'WIPRO.NS',
      'BAJFINANCE.NS', 'KOTAKBANK.NS'
    ];

    const results = await Promise.allSettled(
      symbols.map(s => this.getTrendData(s))
    );

    const validQuotes = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (type === 'losers') {
      return validQuotes
        .sort((a, b) => a.dayChangePercent - b.dayChangePercent)
        .slice(0, limit);
    }

    return validQuotes
      .sort((a, b) => b.dayChangePercent - a.dayChangePercent)
      .slice(0, limit);
  }
}

module.exports = new MarketDataService();
module.exports.MarketDataUnavailableError = MarketDataUnavailableError;