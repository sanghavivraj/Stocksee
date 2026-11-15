import api from './api';

const marketService = {
  async getMarketData(symbol) {
    const encoded = encodeURIComponent(symbol);
    const response = await api.get(`/api/markets/${encoded}`);
    return response.data;
  },

  async getScorecard(symbol) {
    const encoded = encodeURIComponent(symbol);
    const response = await api.get(`/api/markets/${encoded}/scorecard`);
    return response.data;
  },

  /** Today's market brief text (real overview data), or null when unavailable. */
  async getBrief(language = 'en') {
    const response = await api.get('/api/brief', { params: { language } });
    return response.data.brief;
  },

  /** Stocks whose latest session tripped the fixed "unusual activity" rules (facts, no direction). */
  async getUnusualActivity(limit = 3) {
    const response = await api.get('/api/markets/unusual', { params: { limit } });
    return response.data;
  },

  /** Facts behind each stock's latest move (powers "in context" lines and the one-line day summary). */
  async getInsights(symbols) {
    const response = await api.get('/api/markets/insights', { params: { symbols: symbols.join(',') } });
    return response.data;
  },

  /** Today & Tomorrow briefing: a typical-move range, overnight cues, scheduled events, history line. */
  async getBriefing(symbols = []) {
    const response = await api.get('/api/markets/briefing', { params: { symbols: symbols.join(',') } });
    return response.data;
  },

  /** The latest session in 5-minute steps for NIFTY and the given stocks. */
  async getReplay(symbols = []) {
    const response = await api.get('/api/markets/replay', { params: { symbols: symbols.join(',') } });
    return response.data;
  },

  /** The most traded companies in the live Nifty 500 list (worked out from market data, not a typed-in list). */
  async getPopular(limit = 8) {
    const response = await api.get('/api/markets/popular', { params: { limit } });
    return response.data;
  },

  /** How many of the live list rose and fell today, and which industries led and lagged. */
  async getBreadth() {
    const response = await api.get('/api/markets/breadth');
    return response.data;
  },

  /** Real daily OHLC candles. range: '1mo' | '3mo' | '6mo' | '1y' */
  async getHistory(symbol, range = '1mo') {
    const encoded = encodeURIComponent(symbol);
    const response = await api.get(`/api/markets/${encoded}/history`, { params: { range } });
    return response.data;
  },
};

export default marketService;
