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

/**
 * "Unusual activity today": GET /api/markets/unusual?limit=3
 * Stocks whose latest session tripped fixed, public rules (big move, volume spike, gap, 52-week break), ranked
 * by how unusual the day was. Facts about what already happened: no direction, no target, no recommendation.
 * Must stay above '/:symbol' so "unusual" is not treated as a ticker.
 */
router.get('/unusual', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 10);
    const scan = await require('../services/unusualActivityService').getUnusualActivity({ limit });
    if (!scan.scanned) {
      return res.status(503).json({ error: 'Market data is unavailable right now' });
    }
    return res.status(200).json(scan);
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Facts behind each stock's latest move: GET /api/markets/insights?symbols=TCS.NS,INFY.NS
 * Powers "why it moved" lines and the one-sentence summary of a watchlist. Descriptions only, no forecasts.
 */
router.get('/insights', async (req, res) => {
  try {
    const symbols = String(req.query.symbols || '').split(',').map((s) => s.trim())
      .filter((s) => /^[A-Za-z0-9&.^=\-]{1,30}$/.test(s));
    if (!symbols.length) return res.status(400).json({ error: 'symbols is required' });
    return res.status(200).json(await require('../services/insightsService').getInsights(symbols));
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Today & Tomorrow briefing: GET /api/markets/briefing?symbols=TCS.NS,INFY.NS
 * A typical-move RANGE from India VIX, overnight global cues, scheduled events and a history line.
 * It never says whether the market will go up or down.
 */
router.get('/briefing', async (req, res) => {
  try {
    const symbols = String(req.query.symbols || '').split(',').map((s) => s.trim())
      .filter((s) => /^[A-Za-z0-9&.^=\-]{1,30}$/.test(s)).slice(0, 10);
    const briefing = await require('../services/briefingService').getBriefing({ symbols });
    if (!briefing.range && !Object.keys(briefing.cues).length) {
      return res.status(503).json({ error: 'Market data is unavailable right now' });
    }
    return res.status(200).json(briefing);
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Market replay: GET /api/markets/replay?symbols=TCS.NS,INFY.NS
 * The latest session in 5-minute steps (as % from the previous close) for NIFTY and the given stocks,
 * plus facts about the biggest swing and busiest volume. A look back at what happened, not a forecast.
 */
router.get('/replay', async (req, res) => {
  try {
    const symbols = String(req.query.symbols || '').split(',').map((s) => s.trim())
      .filter((s) => /^[A-Za-z0-9&.^=\-]{1,30}$/.test(s));
    return res.status(200).json(await require('../services/replayService').getReplay(symbols));
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Compare two stocks: GET /api/markets/compare?a=TCS.NS&b=INFY.NS
 * Side-by-side facts about the last year (returns, swing, range, worst fall). Never says which is better.
 */
router.get('/compare', async (req, res) => {
  try {
    const ok = (s) => typeof s === 'string' && /^[A-Za-z0-9&.^=\-]{1,30}$/.test(s.trim());
    if (!ok(req.query.a) || !ok(req.query.b)) return res.status(400).json({ error: 'Two stock symbols (a and b) are required' });
    if (req.query.a.trim().toUpperCase() === req.query.b.trim().toUpperCase()) return res.status(400).json({ error: 'Pick two different stocks' });
    return res.status(200).json(await require('../services/compareService').compare(req.query.a.trim(), req.query.b.trim()));
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Popular stocks: GET /api/markets/popular?limit=8
 * The most traded companies in the live Nifty 500 list (worked out, not typed in). Used for suggestions.
 */
router.get('/popular', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 30);
    const snapshotService = require('../services/marketSnapshotService');
    const snapshot = await snapshotService.getSnapshot();
    return res.status(200).json({ items: snapshotService.popularFrom(snapshot, limit), asOf: snapshot.asOf, source: snapshot.source, universeSource: snapshot.universeSource });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Market breadth: GET /api/markets/breadth
 * Across the whole live list: how many rose and fell today, near 52-week highs/lows, strongest and weakest industries.
 */
router.get('/breadth', async (req, res) => {
  try {
    const snapshotService = require('../services/marketSnapshotService');
    return res.status(200).json(snapshotService.breadthFrom(await snapshotService.getSnapshot()));
  } catch (error) {
    return sendError(res, error);
  }
});

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
