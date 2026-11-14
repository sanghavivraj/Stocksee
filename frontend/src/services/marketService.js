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

  /** Real daily OHLC candles. range: '1mo' | '3mo' | '6mo' | '1y' */
  async getHistory(symbol, range = '1mo') {
    const encoded = encodeURIComponent(symbol);
    const response = await api.get(`/api/markets/${encoded}/history`, { params: { range } });
    return response.data;
  },
};

export default marketService;
