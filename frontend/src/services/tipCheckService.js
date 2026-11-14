import api from './api';

const tipCheckService = {
  /** @returns {Promise<{level, score, summary, instrument, reasons[], notes[], guidance[], disclaimer}>} */
  async check({ text, symbol, language }) {
    return (await api.post('/api/tip-check', { text, symbol: symbol || undefined, language })).data;
  },
};

export default tipCheckService;
