const { createClient } = require('redis');
const aiService = require('./aiService');
const marketDataService = require('./marketDataService');
const { istDate } = require('../lib/time');

const CACHE_TTL_SECONDS = 6 * 60 * 60;

/**
 * Daily market narrative per language, built from the real market overview.
 * Cached per IST date in Redis when available, otherwise in memory.
 */
class SharedNarrativeService {
  constructor() {
    this.memory = new Map();
    this.redis = null;
    if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
      const client = createClient({ url: process.env.REDIS_URL });
      client.on('error', () => {}); // offline Redis is fine: we fall back to memory
      client.connect().then(() => { this.redis = client; }).catch(() => {
        console.log('[Narrative] Redis unavailable, using in-memory cache');
      });
    }
  }

  async cacheGet(key) {
    if (this.redis?.isOpen) {
      try { return await this.redis.get(key); } catch { /* fall through */ }
    }
    return this.memory.get(key) ?? null;
  }

  async cacheSet(key, value) {
    if (this.redis?.isOpen) {
      try { await this.redis.set(key, value, { EX: CACHE_TTL_SECONDS }); return; } catch { /* fall through */ }
    }
    // Keep only today's entries in memory
    for (const k of this.memory.keys()) if (!k.includes(istDate())) this.memory.delete(k);
    this.memory.set(key, value);
  }

  /** @returns {Promise<string|null>} narrative text, or null when no market data is available */
  async getSharedNarrative(language = 'en') {
    const key = `narrative:${istDate()}:${language}`;
    const cached = await this.cacheGet(key);
    if (cached) return cached;

    const overviewData = await marketDataService.getMarketOverview();
    if (!overviewData.length) return null;

    const narrative = await aiService.synthesizeAnswer({
      question: 'Give a short, neutral overview of the Indian market today (indices, gold, crude). No advice.',
      language,
      intent: 'MARKET_OVERVIEW',
      overviewData,
    });
    await this.cacheSet(key, narrative);
    return narrative;
  }
}

module.exports = new SharedNarrativeService();
