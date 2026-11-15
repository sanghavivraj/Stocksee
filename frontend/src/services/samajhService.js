import api from './api';

const samajhService = {
  /**
   * Ask the AI to put the already-calculated numbers into simple words.
   * @returns {Promise<{status:'ok'|'refused'|'unavailable', text?:string, message?:string}>}
   */
  async explain(payload) {
    const response = await api.post('/api/samajh/explain', payload);
    return response.data;
  },
};

export default samajhService;
