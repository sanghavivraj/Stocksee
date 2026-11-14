import api from './api';

const telegramService = {
  /** @returns {{ botUrl: string, expiresAt: string }} one-time deep link */
  async createLink() {
    return (await api.post('/api/telegram/link')).data;
  },
  async status() {
    return (await api.get('/api/telegram/status')).data;
  },
  async unlink() {
    await api.delete('/api/telegram/link');
  },
};

export default telegramService;
