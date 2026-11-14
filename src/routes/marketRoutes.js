const express = require('express');
const router = express.Router();
const marketDataService = require('../services/marketDataService');
const scorecardService = require('../services/scorecardService');
const { detectUnusualDays } = require('../analytics/indicators');

// Map known errors to their HTTP status; never leak internal error details for 500s.
const sendError = (res, error) => {
  if (!error.status) console.error('Market route error:', error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
};

router.get('/:symbol/scorecard', async (req, res) => {
  try {
    const marketData = await marketDataService.getTrendData(req.params.symbol);
    res.status(200).json(scorecardService.generateScorecard(marketData));
  } catch (error) {
    sendError(res, error);
  }
});

const withTimeout = (promise, ms, fallback) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);

/**
 * Real daily candles + chart markers: GET /api/markets/RELIANCE/history?range=3mo
 * markers = corporate events (dividends, splits, results dates when available) and data-derived
 * unusual days (big moves vs the stock's own volatility, volume spikes). All facts, no predictions.
 */
router.get('/:symbol/history', async (req, res) => {
  try {
    const range = req.query.range || '1mo';
    const history = await marketDataService.getHistory(req.params.symbol, range);
    const from = history.candles[0]?.time;

    // Unusual days need ~3 months of look-back, so compute them on a longer series and keep this range
    const longer = ['1mo', '3mo', '6mo'].includes(range)
      ? await marketDataService.getHistory(history.symbol, '1y').catch(() => history)
      : history;
    const unusual = detectUnusualDays(longer.candles).filter((m) => !from || m.date >= from);

    const earnings = await withTimeout(marketDataService.getEarningsDates(history.symbol), 2500, []);
    const today = new Date().toISOString().slice(0, 10);
    const results = earnings.map((date) => ({ date, type: 'results', upcoming: date >= today }));

    res.status(200).json({
      ...history,
      markers: [...history.events, ...unusual, ...results.filter((r) => !r.upcoming && (!from || r.date >= from))]
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      upcoming: results.filter((r) => r.upcoming),
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:symbol', async (req, res) => {
  try {
    const marketData = await marketDataService.getMarketData(req.params.symbol);
    res.status(200).json(marketData);
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
