const samajhExplainService = require('../services/samajhExplainService');

exports.explain = async (req, res) => {
  res.json(await samajhExplainService.explain(req.body));
};
