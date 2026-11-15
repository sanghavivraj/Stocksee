const marketDataService = require('../services/marketDataService');
const scorecardService = require('../services/scorecardService');
const insightsService = require('../services/insightsService');
const briefingService = require('../services/briefingService');
const replayService = require('../services/replayService');
const compareService = require('../services/compareService');
const snapshotService = require('../services/marketSnapshotService');
const unusualService = require('../services/unusualActivityService');
const symbolSearchService = require('../services/symbolSearchService');
const narrativeService = require('../services/sharedNarrativeService');
const { HttpError } = require('../middleware/errors');
const { detectUnusualDays } = require('../analytics/indicators');
const { isSymbolLike } = require('../lib/symbols');
const { withTimeout } = require('../lib/async');
const { istDate } = require('../lib/time');

const UNAVAILABLE = 'Market data is unavailable right now';

/**
 * "Unusual activity today": stocks whose latest session tripped fixed, public rules (big move, volume spike,
 * gap, 52-week break), ranked by how unusual the day was. Facts about what already happened: no direction,
 * no target, no recommendation.
 */
exports.unusual = async (req, res) => {
  const scan = await unusualService.getUnusualActivity({ limit: req.query.limit });
  if (!scan.scanned) throw new HttpError(503, UNAVAILABLE);
  res.status(200).json(scan);
};

/** Facts behind each stock's latest move. Powers "In context" lines and the one-sentence watchlist summary. */
exports.insights = async (req, res) => {
  if (!req.query.symbols.length) throw new HttpError(400, 'symbols is required');
  res.status(200).json(await insightsService.getInsights(req.query.symbols));
};

/**
 * Today & Tomorrow briefing: a typical-move RANGE from India VIX, overnight global cues, scheduled events and
 * a history line. It never says whether the market will go up or down.
 */
exports.briefing = async (req, res) => {
  const briefing = await briefingService.getBriefing({ symbols: req.query.symbols });
  if (!briefing.range && !Object.keys(briefing.cues).length) throw new HttpError(503, UNAVAILABLE);
  res.status(200).json(briefing);
};

/**
 * Market replay: the latest session in 5-minute steps (as % from the previous close) for NIFTY and the given
 * stocks, plus facts about the biggest swing and busiest volume. A look back, not a forecast.
 */
exports.replay = async (req, res) => {
  res.status(200).json(await replayService.getReplay(req.query.symbols));
};

/** Compare two stocks side by side: facts about the last year. Never says which is better. */
exports.compare = async (req, res) => {
  const { a, b } = req.query;
  if (!isSymbolLike(a) || !isSymbolLike(b)) throw new HttpError(400, 'Two stock symbols (a and b) are required');
  if (a.trim().toUpperCase() === b.trim().toUpperCase()) throw new HttpError(400, 'Pick two different stocks');
  res.status(200).json(await compareService.compare(a.trim(), b.trim()));
};

/** The most traded companies in the live Nifty 500 list (worked out, not typed in). Used for suggestions. */
exports.popular = async (req, res) => {
  const snapshot = await snapshotService.getSnapshot();
  res.status(200).json({
    items: snapshotService.popularFrom(snapshot, req.query.limit),
    asOf: snapshot.asOf,
    source: snapshot.source,
    universeSource: snapshot.universeSource,
  });
};

/** Across the whole live list: how many rose and fell today, near 52-week highs/lows, strongest/weakest industries. */
exports.breadth = async (req, res) => {
  res.status(200).json(snapshotService.breadthFrom(await snapshotService.getSnapshot()));
};

exports.scorecard = async (req, res) => {
  const marketData = await marketDataService.getTrendData(req.params.symbol);
  res.status(200).json(scorecardService.generateScorecard(marketData));
};

/**
 * Real daily candles + chart markers. Markers = corporate events (dividends, splits, results dates when
 * available) and data-derived unusual days (big moves vs the stock's own volatility, volume spikes).
 * All facts, no predictions.
 */
exports.history = async (req, res) => {
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
};

exports.quote = async (req, res) => {
  res.status(200).json(await marketDataService.getMarketData(req.params.symbol));
};

/** Typeahead: matching NSE/BSE stocks, indices and commodities. */
exports.search = async (req, res) => {
  res.json({ results: await symbolSearchService.search(req.query.q, { limit: req.query.limit }) });
};

/** Daily market brief (same narrative as the Telegram morning brief), cached per IST day and language. */
exports.brief = async (req, res) => {
  const text = await narrativeService.getSharedNarrative(req.query.language);
  res.json({ brief: text, language: req.query.language, date: istDate() });
};
