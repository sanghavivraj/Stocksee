import api from './api';

const alertService = {
  async list() {
    return (await api.get('/api/alerts')).data;
  },
  /** rule: { type, symbol, direction?, threshold? } */
  async create(rule) {
    return (await api.post('/api/alerts', rule)).data;
  },
  /** "How often would this rule have fired in the last year?" (nothing is saved) */
  async backtest(rule) {
    return (await api.post('/api/alerts/backtest', rule)).data;
  },
  async setActive(id, active) {
    return (await api.patch(`/api/alerts/${id}`, { active })).data;
  },
  async remove(id) {
    await api.delete(`/api/alerts/${id}`);
  },
};

export default alertService;
