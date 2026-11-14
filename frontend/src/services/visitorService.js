import api from './api';

/** "This browser" — anonymous, no sign-up. The server identifies it by an httpOnly cookie. */
const visitorService = {
  /** @returns {Promise<null | { language, telegram }>} null until this browser saves something */
  async me() {
    return (await api.get('/api/me')).data.visitor;
  },
  async updatePreferences({ language }) {
    return (await api.patch('/api/me', { language })).data.visitor;
  },
};

export default visitorService;
