import api from './api';

const askService = {
  async askQuestion(question, language = 'en', conversationHistory = []) {
    const response = await api.post('/api/ask', {
      question,
      language,
      conversationHistory,
      context: conversationHistory,
    });
    return response.data;
  },
};

export default askService;