const watchlistService = require('../services/watchlistService');
const { HttpError } = require('../middleware/errors');

exports.list = async (req, res) => res.json(req.visitor ? await watchlistService.list(req.visitor.id) : []);
exports.add = async (req, res) => res.status(201).json(await watchlistService.add(req.visitor.id, req.body.symbol));
exports.import = async (req, res) => {
  res.json(await watchlistService.import(req.visitor.id, req.body.symbols));
};
exports.remove = async (req, res) => {
  if (!req.visitor) throw new HttpError(404, 'Watchlist item not found');
  await watchlistService.remove(req.visitor.id, req.params.id);
  res.status(204).end();
};
