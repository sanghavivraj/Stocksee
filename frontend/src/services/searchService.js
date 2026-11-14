import api from './api';

const searchService = {
  /** Matching NSE/BSE stocks, indices and commodities for what the user has typed so far. */
  async search(q, { signal, limit = 8 } = {}) {
    const response = await api.get('/api/search', { params: { q, limit }, signal });
    return response.data.results;
  },
};

export default searchService;
