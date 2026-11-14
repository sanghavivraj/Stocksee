const scorecardService = require('./scorecardService');
const { countRedFlags } = require('./tipCheckService');
const marketDataService = require('./marketDataService');
const aiService = require('./aiService');

// Keywords and patterns for entity & intent extraction
const OVERVIEW_KEYWORDS = [
  'indian market', 'indian markets', 'market today', 'markets today',
  'market snapshot', 'market overview', 'what is happening in markets',
  'what is happening in indian markets', 'today\'s market', 'market movement',
  'भारतीय बाजार', 'शेयर बाजार', 'બજાર', 'શેરબજાર'
];

const GAINERS_PATTERNS = [/top gainers/i, /top gainer/i, /top 10 gainers/i, /gainers today/i, /गेनर/i, /તેજી વાળા/i, /સૌથી વધુ વધેલા/i];
const LOSERS_PATTERNS = [/top losers/i, /top loser/i, /top 10 losers/i, /losers today/i, /लूजर/i, /નુકસાન વાળા/i, /સૌથી વધુ ઘટેલા/i];

const BUY_SELL_PATTERNS = [
  /\b(?:should|shoud|shud|sould|shoul|can|shall|could|would|will|must|may|might|ought(?:\s+to)?|need(?:\s+to)?|have\s+to|planning\s+to|want\s+to)\s+(?:i\s+|we\s+|one\s+)?(?:have\s+to\s+)?(?:buy|sell|invest|purchase|purcase|purchse|enter|accumulate|hold|take\s+position)/i,
  /\b(?:is\s+it|is\s+this)\s+(?:a\s+)?(?:good|bad|safe|right|worth|risky|wise|lucrative)?\s*(?:time\s+|opportunity\s+)?to\s+(?:buy|sell|invest|purchase|enter|accumulate|hold)/i,
  /\b(?:good|right|best|safe)\s+time\s+to\s+(?:buy|sell|invest|purchase)/i,
  /\b(?:buy|sell|investment|purchase)\s+(?:call|recommendation|target|view|advice|opinion)/i,
  /\b(?:target\s+price|price\s+target|analyst\s+target|consensus|health\s+score|scorecard)\b/i,
  /\b(?:buy\s+or\s+sell|sell\s+or\s+buy|hold\s+or\s+sell|buy\s+or\s+hold)\b/i,
  /\b(?:worth\s+buying|worth\s+investing|worth\s+purchasing)\b/i,
  /\b(?:purchase\s+it|buy\s+it|sell\s+it|invest\s+in\s+it)\b/i,
  /\b(?:purchase|buy|invest|sell|purcase|purchse)\b.*\b(?:tomorrow|tommorow|tomorow|tommorw|tommorrow|today|now|monday|next\s+week)\b/i,
  /\b(?:tomorrow|tommorow|tomorow|tommorw|tommorrow|today|now|monday|next\s+week)\b.*\b(?:purchase|buy|invest|sell|purcase|purchse)\b/i,
  /\b(?:should|shoud|shud)\s+i\s+(?:have\s+to\s+)?(?:purchase|buy|sell|invest)\b/i,
  /\b(?:what\s+about|how\s+about)\b.*\b(?:buy|purchase|purcase|invest|sell|target|entry|exit)\b/i,
  /\b(?:khareedna|khareedu|khareed|khareedein|lena\s+chahiye|le\s+sakte|nivesh|kharidvu|levay)\b/i,
  /खरीदूं|खरीदना|बेचूं|बेचना|निवेश|टार्गेट|सलाह|लेना चाहिए/i,
  /ખરીદવું|ખરીદી|વેચવું|રોકાણ|ટાર્ગેટ|સલાહ|લેવાય|લેવું જોઈએ/i,
];

const WHY_PATTERNS = [
  /\bwhy\b/i, /reason for/i, /falling/i, /crashing/i, /rallying/i,
  /क्यों/i, /कारण/i, /કેમ/i, /કારણ/i
];

const TREND_PATTERNS = [
  /trend/i, /performing/i, /performance/i, /this week/i, /1 week/i, /1 month/i,
  /past week/i, /past month/i, /returns/i, /ट्रेंड/i, /प्रदर्शन/i, /ટ્રેન્ડ/i, /વળતર/i
];

const SCORECARD_PATTERNS = [
  /scorecard/i, /score card/i, /health score/i, /rating/i, /analyst target/i,
  /broker target/i, /advisor/i, /adviser/i, /target price/i, /consensus/i,
  /प्रिडिक्शन/i, /स्कोरकार्ड/i, /स्कोर/i, /રેટિંગ/i, /ટાર્ગેટ/i
];

// Hype / tip vocabulary that must never be mistaken for a company name
const TIP_HYPE_WORDS = new Set([
  'jackpot', 'alert', 'operator', 'operators', 'guaranteed', 'guarantee', 'circuit', 'upper', 'lower', 'return', 'returns',
  'days', 'day', 'weeks', 'now', 'join', 'vip', 'premium', 'telegram', 'whatsapp', 'group', 'channel', 'rocket',
  'multibagger', 'sure', 'shot', 'target', 'profit', 'urgent', 'breaking', 'news', 'tip', 'tips', 'call', 'calls',
  'before', 'after', 'hurry', 'double', 'triple', 'insider', 'inside', 'info', 'big', 'players', 'buying',
]);

const COMPARE_PATTERNS = [
  /compare (.+) and (.+)/i,
  /(.+) vs (.+)/i,
  /(.+) versus (.+)/i,
  /difference between (.+) and (.+)/i
];

class AskService {
  /**
   * Main entry point for financial Q&A
   */
  async askQuestion(question, language = 'en', conversationHistory = []) {
    const q = (question || '').trim();
    if (!q) {
      return {
        answer: 'Please provide a market-related question or stock name.',
        timestamp: new Date().toISOString(),
      };
    }

    const lang = (language || 'en').toLowerCase();
    const intent = this.detectIntent(q);

    // 0. Forwarded stock tips ("guaranteed", "operator", "upper circuit"...) get the Tip Check instead of a quote
    if (intent === 'TIP_CHECK') {
      const tipCheckService = require('./tipCheckService');
      const tipCheck = await tipCheckService.check({ text: q, language: lang });
      const lines = [
        `🛡️ **Tip Check: ${tipCheck.level} risk** — ${tipCheck.summary}`,
        ...tipCheck.reasons.slice(0, 6).map((r) => `• ${r.text}`),
        ...tipCheck.notes.map((n) => `_${n}_`),
        '',
        ...tipCheck.guidance.map((g) => `• ${g}`),
      ];
      return {
        answer: lines.join('\n'),
        answerSource: 'tip-check',
        tipCheck,
        intent,
        timestamp: new Date().toISOString(),
      };
    }

    // 1. Handle Top Gainers / Top Losers
    if (intent === 'MOVERS_GAINERS' || intent === 'MOVERS_LOSERS') {
      try {
        const type = intent === 'MOVERS_LOSERS' ? 'losers' : 'gainers';
        const moversData = await marketDataService.getTopMovers(type, 10);
        const { answer, source: answerSource } = await aiService.generate({
          history: conversationHistory,
          question: q,
          language: lang,
          intent,
          overviewData: moversData,
        });

        return {
          answer,
          answerSource,
          quotes: moversData,
          intent,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        return {
          answer: 'Unable to retrieve the top movers right now. Please try again shortly.',
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 2. Handle Market Overview
    if (intent === 'MARKET_OVERVIEW') {
      try {
        const overviewData = await marketDataService.getMarketOverview();
        const { answer, source: answerSource } = await aiService.generate({
          history: conversationHistory,
          question: q,
          language: lang,
          intent,
          overviewData,
        });

        return {
          answer,
          answerSource,
          quotes: overviewData,
          intent,
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        return {
          answer: 'Unable to retrieve the current market snapshot right now. Please try again shortly.',
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 3. Handle Comparison
    const comparisonEntities = this.extractComparisonEntities(q);
    if (comparisonEntities) {
      try {
        const [stockA, stockB] = await Promise.all([
          marketDataService.getTrendData(comparisonEntities[0]),
          marketDataService.getTrendData(comparisonEntities[1]),
        ]);

        const { answer, source: answerSource } = await aiService.generate({
          history: conversationHistory,
          question: q,
          language: lang,
          intent: 'COMPARISON',
          marketData: stockA,
          comparisonData: stockB,
        });

        return {
          answer,
          answerSource,
          quotes: [stockA, stockB],
          intent: 'COMPARISON',
          timestamp: new Date().toISOString(),
        };
      } catch (err) {
        // Fall through to single entity or standard resolution
      }
    }

    // 3. Single Entity Resolution (with Conversation History Fallback)
    const entityQuery = await this.extractEntity(q, conversationHistory);

    if (!entityQuery) {
      // Check if general overview was intended
      const { answer, source: answerSource } = await aiService.generate({
          history: conversationHistory,
        question: q,
        language: lang,
        intent: 'UNKNOWN_ENTITY',
      });
      return {
        answer,
        answerSource,
        intent: 'UNKNOWN_ENTITY',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const marketData = await marketDataService.getTrendData(entityQuery);
      if (intent === 'WHY_MOVEMENT' && marketData.type !== 'INDEX') {
        marketData.context = await this.movementContext(marketData);
      }
      let scorecard = null;
      if (marketData && (marketData.type === 'EQUITY' || intent === 'BUY_SELL_QUESTION')) {
        scorecard = scorecardService.generateScorecard(marketData);
      }

      const { answer, source: answerSource } = await aiService.generate({
          history: conversationHistory,
        question: q,
        language: lang,
        intent,
        marketData,
        scorecard,
      });

      return {
        answer,
        answerSource,
        quote: marketData,
        scorecard,
        symbol: marketData.symbol,
        instrument: marketData.instrument,
        intent,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      // Graceful fallback if instrument not found
      const { answer, source: answerSource } = await aiService.generate({
          history: conversationHistory,
        question: q,
        language: lang,
        intent: 'UNKNOWN_ENTITY',
      });

      return {
        answer,
        answerSource,
        intent: 'UNKNOWN_ENTITY',
        timestamp: new Date().toISOString(),
      };
    }
  }

  detectIntent(q) {
    const lower = q.toLowerCase();

    // Two or more red-flag phrase groups = this reads like a forwarded tip
    if (countRedFlags(q) >= 2) return 'TIP_CHECK';

    // Gainers & Losers
    for (const pattern of GAINERS_PATTERNS) {
      if (pattern.test(lower)) return 'MOVERS_GAINERS';
    }
    for (const pattern of LOSERS_PATTERNS) {
      if (pattern.test(lower)) return 'MOVERS_LOSERS';
    }

    // Comparison
    for (const pattern of COMPARE_PATTERNS) {
      if (pattern.test(lower)) return 'COMPARISON';
    }

    // Buy/Sell & Scorecard advice request
    for (const pattern of BUY_SELL_PATTERNS) {
      if (pattern.test(lower)) return 'BUY_SELL_QUESTION';
    }
    for (const pattern of SCORECARD_PATTERNS) {
      if (pattern.test(lower)) return 'BUY_SELL_QUESTION';
    }

    // Market overview
    for (const kw of OVERVIEW_KEYWORDS) {
      if (lower.includes(kw)) return 'MARKET_OVERVIEW';
    }

    // Why movement
    for (const pattern of WHY_PATTERNS) {
      if (pattern.test(lower)) return 'WHY_MOVEMENT';
    }

    // Trend analysis
    for (const pattern of TREND_PATTERNS) {
      if (pattern.test(lower)) return 'TREND_ANALYSIS';
    }

    return 'PRICE_QUOTE';
  }

  /**
   * Real context for "why is X moving?": benchmark comparison, today's volume vs normal,
   * and recent corporate events / unusual days from the price history. Missing pieces are simply omitted.
   */
  async movementContext(marketData) {
    const { volumeRatio, detectUnusualDays } = require('../analytics/indicators');
    const [bench, history] = await Promise.all([
      marketDataService.getTrendData('^NSEI').catch(() => null),
      marketDataService.getHistory(marketData.symbol, '6mo').catch(() => null),
    ]);
    const context = {};
    if (bench && typeof bench.dayChangePercent === 'number' && typeof marketData.dayChangePercent === 'number') {
      context.benchmark = { name: 'NIFTY 50', dayChangePercent: bench.dayChangePercent };
      context.relativeToBenchmark = Number((marketData.dayChangePercent - bench.dayChangePercent).toFixed(2));
    }
    if (history?.candles?.length) {
      const c = history.candles;
      const vr = volumeRatio(c, c.length - 1);
      if (vr !== null) context.volumeRatio = Number(vr.toFixed(1));
      const since = c[Math.max(0, c.length - 30)].time;
      context.recentEvents = [
        ...(history.events || []).filter((e) => e.date >= since),
        ...detectUnusualDays(c).filter((e) => e.date >= since),
      ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
    }
    return context;
  }

  extractComparisonEntities(q) {
    for (const pattern of COMPARE_PATTERNS) {
      const match = q.match(pattern);
      if (match && match[1] && match[2]) {
        return [match[1].trim(), match[2].trim()];
      }
    }
    return null;
  }

  async extractEntity(q, history = []) {
    const clean = q.trim();
    const lower = clean.toLowerCase();

    // 1. Direct regex/dictionary lookups in text
    const knownKeys = [
      // Indices & Commodities
      { key: 'bank nifty', target: 'BANK NIFTY' },
      { key: 'banknifty', target: 'BANK NIFTY' },
      { key: 'nifty 50', target: 'NIFTY 50' },
      { key: 'nifty50', target: 'NIFTY 50' },
      { key: 'nifty', target: 'NIFTY' },
      { key: 'sensex', target: 'SENSEX' },
      { key: 'gold', target: 'GOLD' },
      { key: 'crude oil', target: 'CRUDE OIL' },
      { key: 'crude', target: 'CRUDE OIL' },
      { key: 'सोना', target: 'GOLD' },
      { key: 'સોનું', target: 'GOLD' },
      { key: 'कच्चा तेल', target: 'CRUDE OIL' },
      { key: 'નિફ્ટી', target: 'NIFTY' },
      { key: 'સેન્સેક્સ', target: 'SENSEX' },
      { key: 'બેંક નિફ્ટી', target: 'BANK NIFTY' },

      // High volume equities
            { key: 'bharat electronics limited', target: 'BEL' },
      { key: 'bharat electronics', target: 'BEL' },
      { key: 'bel', target: 'BEL' },
      { key: 'बीईएल', target: 'BEL' },
      { key: 'બીઈએલ', target: 'BEL' },

      { key: 'hindustan aeronautics limited', target: 'HAL' },
      { key: 'hindustan aeronautics', target: 'HAL' },
      { key: 'hal', target: 'HAL' },

      { key: 'zomato limited', target: 'ZOMATO' },
      { key: 'zomato', target: 'ZOMATO' },

      { key: 'indian railway finance corporation', target: 'IRFC' },
      { key: 'irfc', target: 'IRFC' },

      { key: 'vedanta limited', target: 'VEDL' },
      { key: 'vedanta', target: 'VEDL' },
      { key: 'vedl', target: 'VEDL' },

      { key: 'titan company', target: 'TITAN' },
      { key: 'titan', target: 'TITAN' },
      { key: 'jio financial services', target: 'JIOFIN' },
      { key: 'jio financial', target: 'JIOFIN' },
      { key: 'jio fin', target: 'JIOFIN' },
      { key: 'jiofin', target: 'JIOFIN' },
      { key: 'जियो फाइनेंस', target: 'JIOFIN' },
      { key: 'જિયો ફાઇનાન્સ', target: 'JIOFIN' },

      { key: 'indian oil corporation', target: 'IOC' },
      { key: 'indian oil', target: 'IOC' },
      { key: 'iocl', target: 'IOC' },
      { key: 'ioc', target: 'IOC' },
      { key: 'आईओसी', target: 'IOC' },

      { key: 'reliance industries', target: 'RELIANCE' },
      { key: 'reliance', target: 'RELIANCE' },
      { key: 'ril', target: 'RELIANCE' },
      { key: 'रिलायंस', target: 'RELIANCE' },
      { key: 'રિલાયન્સ', target: 'RELIANCE' },

      { key: 'tata consultancy services', target: 'TCS' },
      { key: 'tata consultancy', target: 'TCS' },
      { key: 'tcs', target: 'TCS' },
      { key: 'टीसीएस', target: 'TCS' },

      { key: 'tata motors', target: 'TATAMOTORS' },
      { key: 'tatamotors', target: 'TATAMOTORS' },
      { key: 'टाटा मोटर्स', target: 'TATAMOTORS' },
      { key: 'ટાટા મોટર્સ', target: 'TATAMOTORS' },

      { key: 'tata steel', target: 'TATASTEEL' },
      { key: 'tatasteel', target: 'TATASTEEL' },

      { key: 'infosys limited', target: 'INFY' },
      { key: 'infosys', target: 'INFY' },
      { key: 'infy', target: 'INFY' },
      { key: 'इंफोसिस', target: 'INFY' },

      { key: 'hdfc bank', target: 'HDFCBANK' },
      { key: 'hdfcbank', target: 'HDFCBANK' },
      { key: 'hdfc', target: 'HDFCBANK' },

      { key: 'icici bank', target: 'ICICIBANK' },
      { key: 'icicibank', target: 'ICICIBANK' },
      { key: 'icici', target: 'ICICIBANK' },

      { key: 'state bank of india', target: 'SBIN' },
      { key: 'state bank', target: 'SBIN' },
      { key: 'sbi', target: 'SBIN' },
      { key: 'sbin', target: 'SBIN' },
      { key: 'एसबीआई', target: 'SBIN' },

      { key: 'itc limited', target: 'ITC' },
      { key: 'itc', target: 'ITC' },

      { key: 'adani enterprises', target: 'ADANIENT' },
      { key: 'adanient', target: 'ADANIENT' },
      { key: 'adani ports', target: 'ADANIPORTS' },
      { key: 'adaniports', target: 'ADANIPORTS' },

      { key: 'larsen & toubro', target: 'LT' },
      { key: 'larsen and toubro', target: 'LT' },
      { key: 'l&t', target: 'LT' },
      { key: 'lt', target: 'LT' },

      { key: 'axis bank', target: 'AXISBANK' },
      { key: 'axisbank', target: 'AXISBANK' },

      { key: 'hindustan unilever', target: 'HINDUNILVR' },
      { key: 'hul', target: 'HINDUNILVR' },
      { key: 'hindunilvr', target: 'HINDUNILVR' },

      { key: 'bharti airtel', target: 'BHARTIARTL' },
      { key: 'airtel', target: 'BHARTIARTL' },
      { key: 'bhartiartl', target: 'BHARTIARTL' },

      { key: 'sun pharma', target: 'SUNPHARMA' },
      { key: 'sunpharma', target: 'SUNPHARMA' },

      { key: 'maruti suzuki', target: 'MARUTI' },
      { key: 'maruti', target: 'MARUTI' },

      { key: 'mahindra & mahindra', target: 'M&M' },
      { key: 'mahindra and mahindra', target: 'M&M' },
      { key: 'm&m', target: 'M&M' },
      { key: 'mahindra', target: 'M&M' },

      { key: 'wipro', target: 'WIPRO' },
      { key: 'bajaj finance', target: 'BAJFINANCE' },
      { key: 'bajfinance', target: 'BAJFINANCE' },
      { key: 'kotak bank', target: 'KOTAKBANK' },
      { key: 'kotak', target: 'KOTAKBANK' },

      // Deccan Gold & Precious Metal / Jewelry Equities
      { key: 'deccan gold mines limited', target: 'DECNGOLD' },
      { key: 'deccan gold mines', target: 'DECNGOLD' },
      { key: 'deccan gold', target: 'DECNGOLD' },
      { key: 'deccangold', target: 'DECNGOLD' },
      { key: 'decangold', target: 'DECNGOLD' },
      { key: 'decngold', target: 'DECNGOLD' },
      { key: 'डेक्कन गोल्ड', target: 'DECNGOLD' },
      { key: 'ડેક્કન ગોલ્ડ', target: 'DECNGOLD' },
      { key: 'goldbees', target: 'GOLDBEES' },
      { key: 'gold bees', target: 'GOLDBEES' },
      { key: 'goldiam', target: 'GOLDIAM' },
      { key: 'goldtech', target: 'GOLDTECH' },
      { key: 'muthoot finance', target: 'MUTHOOTFIN' },
      { key: 'muthootfin', target: 'MUTHOOTFIN' },
      { key: 'kalyan jewellers', target: 'KALYANKJIL' },
      { key: 'kalyankjil', target: 'KALYANKJIL' },
    ];

    // Check if query explicitly asks about stocks / shares / companies
    const isExplicitStockQuery = /\b(?:stock|stocks|share|shares|equity|equities|company|companies|ltd|limited|scrip)\b/i.test(lower);

    // Sort known keys longest-first so compound and specific scrip names match before generic single-word commodity tokens
    const sortedKeys = [...knownKeys].sort((a, b) => b.key.length - a.key.length);

    for (const item of sortedKeys) {
      // If user specifically asked about a stock/share/company, NEVER hijack with raw physical commodities (e.g. GOLD, CRUDE OIL)
      if (isExplicitStockQuery && (item.target === 'GOLD' || item.target === 'CRUDE OIL')) {
        continue;
      }

      // Match with Unicode-aware boundaries (works for English words, Devanagari, Gujarati, and symbols like '&')
      const escaped = item.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escaped}(?:$|[^\\p{L}\\p{N}_])`, 'iu');
      if (regex.test(lower)) {
        return item.target;
      }
    }

    // 2. Universal Entity Extraction (Works dynamically for ALL ~5,000+ Indian stocks)
    const punctuationFree = clean.replace(/[?!,;:/\\\"'()]/g, ' ');
    const queryWords = punctuationFree.split(/\s+/).filter(Boolean);
    const universalStopWords = new Set([
      // Question & helper words
      'what', 'about', 'how', 'tell', 'me', 'us', 'give', 'info', 'information', 'detail', 'details',
      'please', 'pls', 'plz', 'pleas', 'can', 'you', 'who', 'where', 'when', 'which', 'why', 'the', 'a', 'an', 'this',
      'that', 'these', 'those', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'to', 'into', 'onto',
      'and', 'or', 'nor', 'but', 'so', 'as', 'like', 'just', 'now', 'right', 'here', 'there',
      // Social & conversational fillers
      'friend', 'friends', 'bro', 'brother', 'sir', 'bhai', 'dost', 'bhaiya', 'guru', 'finguru', 'stocksee', 'ok', 'okay',
      // Modals & verbs + common typos
      'should', 'shoud', 'shud', 'sould', 'shoul', 'would', 'wud', 'could', 'cud', 'shall', 'will', 'must',
      'might', 'may', 'have', 'has', 'had', 'having', 'need', 'needs', 'ought', 'do', 'does', 'did', 'done',
      'doing', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'get', 'getting', 'got',
      // Pronouns
      'i', 'my', 'mine', 'we', 'our', 'ours', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers',
      'it', 'its', 'they', 'them', 'their', 'theirs', 'one',
      // Financial verbs & actions + typos (e.g. 'but' as typo for 'buy')
      'buy', 'buys', 'buying', 'bought', 'purchase', 'purchases', 'purchasing', 'purchased', 'purcase', 'purchse',
      'sell', 'sells', 'selling', 'sold', 'invest', 'invests', 'investing', 'invested', 'hold', 'holds', 'holding', 'held',
      'accumulate', 'accumulating', 'trade', 'trading', 'entry', 'exit', 'position', 'positions',
      // Financial metrics & queries
      'target', 'targets', 'recommend', 'recommendation', 'recommendations', 'rating', 'ratings', 'view', 'opinion',
      'advice', 'suggest', 'suggestion', 'suggestions', 'prediction', 'predictions', 'forecast', 'forecasts',
      'score', 'scorecard', 'health', 'good', 'bad', 'safe', 'right', 'worth', 'lucrative', 'profitable',
      'loss', 'profit', 'gain', 'gainer', 'gainers', 'loser', 'losers', 'price', 'prices', 'rate', 'rates',
      'quote', 'quotes', 'share', 'shares', 'stock', 'stocks', 'equity', 'equities', 'company', 'companies', 'scrip',
      // Time words & dates + extensive spelling typos
      'today', 'tday', '2day', 'tomorrow', 'tommorow', 'tommorrow', 'tomorow', 'tommorw', 'tommow', 'tomrw', 'tmrw', 'tmr', 'tomo', '2moro', '2morrow',
      'yesterday', 'yday', 'now', 'soon', 'later', 'morning', 'evening', 'night', 'monday', 'tuesday',
      'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'week', 'month', 'year', 'daily', 'weekly',
      'monthly', 'yearly', 'intraday', 'future', 'futures', 'expiry', 'next', 'past', 'last',
      // Motion words
      'perform', 'performing', 'performance', 'moving', 'going', 'running', 'falling', 'crashing', 'rising', 'rallying',
      // Vernacular Hindi (Devanagari)
      'क्या', 'के', 'बारे', 'में', 'बताओ', 'बताइए', 'खरीदना', 'खरीदूं', 'चाहिए', 'का', 'की', 'भाव', 'कैसा',
      'है', 'हैं', 'होगा', 'कल', 'आज', 'परसों', 'शेयर', 'स्टॉक', 'कंपनी', 'निवेश', 'करना', 'लेना', 'बेचना', 'सलाह', 'मुझे', 'दोस्त', 'भाई',
      // Vernacular Hindi (Hinglish / Romanized)
      'kya', 'ke', 'bare', 'mein', 'me', 'batao', 'bataiye', 'khareedna', 'khareedu', 'khareed', 'khareedein', 'chahiye',
      'chaahiye', 'ka', 'ki', 'ke', 'ko', 'se', 'bhav', 'kaisa', 'hai', 'hain', 'hoga', 'kal', 'aaj', 'parso', 'parson',
      'nivesh', 'karna', 'lena', 'le', 'bechna', 'bech', 'salah', 'mujhe', 'hum', 'humein', 'sakte', 'sakti', 'rahega',
      // Vernacular Gujarati (Gujarati script)
      'શું', 'વિશે', 'કહો', 'જણાવો', 'ખરીદવું', 'જોઈએ', 'નો', 'ની', 'નું', 'ના', 'ભાવ', 'કેવો', 'છે',
      'હશે', 'કાલે', 'આજે', 'શેર', 'સ્ટોક', 'કંપની', 'રોકાણ', 'કરવું', 'લેવાય', 'વેચવું', 'સલાહ', 'મારે', 'મિત્ર', 'ભાઈ',
      // Vernacular Gujarati (Gujlish / Romanized)
      'shu', 'vishe', 'kaho', 'janavo', 'kharidvu', 'kharidie', 'joiye', 'no', 'ni', 'nu', 'na', 'bhav', 'kevo',
      'chhe', 'hase', 'kaale', 'kale', 'aaje', 'rokan', 'karvu', 'levay', 'vechvu', 'mare', 'amne', 'shakay'
    ]);

    const meaningfulCandidates = queryWords
      .map((w) => w.replace(/^[^\p{L}\p{N}&]+|[^\p{L}\p{N}&]+$/gu, '')) // strip emoji / punctuation at the edges
      .filter((w) => w && !universalStopWords.has(w.toLowerCase()) && !TIP_HYPE_WORDS.has(w.toLowerCase()));

    // Only accept instruments confirmed by the dictionary or the exchange search (no guessing from free text)
    const confirmed = async (candidate) => {
      try {
        const r = await marketDataService.resolveInstrument(candidate, { allowGuess: false });
        return r && (r.symbol.endsWith('.NS') || r.symbol.endsWith('.BO') || r.symbol.startsWith('^')) ? r.symbol : null;
      } catch {
        return null;
      }
    };

    if (meaningfulCandidates.length > 0) {
      // 2a. ALL-CAPS words look like tickers (e.g. "SUZLON", "CCCL"): try those first
      const tickerLike = meaningfulCandidates.filter((w) => /^[A-Z][A-Z0-9&]{1,14}$/.test(w));
      for (const word of tickerLike.slice(0, 3)) {
        const hit = await confirmed(word);
        if (hit) return hit;
      }

      // 2b. Whole phrase (e.g. "Tata Motors", "Kalyan Jewellers"), then 2-word windows, then single words
      const phrase = meaningfulCandidates.slice(0, 6).join(' ');
      const bigrams = [];
      for (let i = 0; i < Math.min(meaningfulCandidates.length, 6) - 1; i += 1) {
        bigrams.push(`${meaningfulCandidates[i]} ${meaningfulCandidates[i + 1]}`);
      }
      const singles = meaningfulCandidates.filter((w) => !tickerLike.includes(w) && w.length >= 3).slice(0, 4);
      for (const candidate of [phrase, ...bigrams, ...singles]) {
        const hit = await confirmed(candidate);
        if (hit) return hit;
      }
    }

    // 3. Multi-Turn Session Context: If user asks "What about this week?", "And today?", check history
    if (Array.isArray(history) && history.length > 0) {
      for (let i = history.length - 1; i >= 0; i--) {
        const prev = history[i];
        if (prev && prev.symbol) {
          return prev.symbol;
        }
        if (prev && prev.instrument) {
          return prev.instrument;
        }
        if (prev && typeof prev.text === 'string') {
          const prevEntity = await this.extractEntity(prev.text, []);
          if (prevEntity) return prevEntity;
        }
      }
    }

    // 4. Default: Return word if clean is short (e.g. "CCCL", "RELIANCE")
    if (clean.split(/\s+/).length <= 2 && !OVERVIEW_KEYWORDS.some(k => lower.includes(k))) {
      return clean;
    }

    return null;
  }
}

module.exports = new AskService();