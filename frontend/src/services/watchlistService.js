import api from './api';

const watchlistService = {
  async list() {
    return (await api.get('/api/watchlists')).data;
  },
  async add(symbol) {
    return (await api.post('/api/watchlists', { symbol })).data;
  },
  async import(symbols) {
    return (await api.post('/api/watchlists/import', { symbols })).data;
  },
  async remove(id) {
    await api.delete(`/api/watchlists/${id}`);
  },
};

export default watchlistService;
