const tipCheckService = require('../services/tipCheckService');

exports.check = async (req, res) => {
  res.json(await tipCheckService.check(req.body));
};
