const alertService = require('../services/alertService');
const marketDataService = require('../services/marketDataService');
const { backtestAlert } = require('../analytics/indicators');
const { HttpError } = require('../middleware/errors');

const requireVisitor = (req) => {
  if (!req.visitor) throw new HttpError(404, 'Alert not found');
  return req.visitor.id;
};

exports.list = async (req, res) => res.json(req.visitor ? await alertService.list(req.visitor.id) : []);
exports.create = async (req, res) => res.status(201).json(await alertService.create(req.visitor.id, req.body));
exports.update = async (req, res) => res.json(await alertService.setActive(requireVisitor(req), req.params.id, req.body.active));
exports.remove = async (req, res) => {
  await alertService.remove(requireVisitor(req), req.params.id);
  res.status(204).end();
};

/** "How often would this rule have fired in the last year?" — same rule as the live alert, on real daily data. */
exports.backtest = async (req, res) => {
  const history = await marketDataService.getHistory(req.body.symbol, '2y');
  res.json({ symbol: history.symbol, rule: req.body, ...backtestAlert(req.body, history.candles), source: history.source });
};
