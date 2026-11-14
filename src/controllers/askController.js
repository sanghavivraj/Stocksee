const askService = require('../services/askService');

exports.ask = async (req, res) => {
  const { question, language, conversationHistory } = req.body;
  res.json(await askService.askQuestion(question, language, conversationHistory));
};
