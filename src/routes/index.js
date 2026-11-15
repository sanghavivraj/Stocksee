const express = require('express');
const rateLimit = require('express-rate-limit');
const s = require('../controllers/schemas');
const { asyncHandler: h, validate, requireKnownSymbols, keepKnownSymbols } = require('../middleware/errors');
const { identifyVisitor, ensureVisitor } = require('../middleware/visitor');
const visitor = require('../controllers/visitorController');
const telegram = require('../controllers/telegramController');
const watchlist = require('../controllers/watchlistController');
const alerts = require('../controllers/alertController');
const ask = require('../controllers/askController');
const tipCheck = require('../controllers/tipCheckController');
const samajh = require('../controllers/samajhController');

const limiter = (windowMinutes, max) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Routes that save data may create an anonymous visitor: limit them so nobody can flood the database
const save = [limiter(1, 60), ensureVisitor];

const router = express.Router();

// Market data and Q&A: fully public
router.use('/markets', require('./marketRoutes'));
router.post('/ask', limiter(1, 20), validate(s.ask), h(ask.ask));
// Typeahead: GET /api/search?q=D -> matching NSE/BSE stocks, indices and commodities
router.get('/search', limiter(1, 120), validate(s.symbolSearch, 'query'), h(async (req, res) => {
  res.json({ results: await require('../services/symbolSearchService').search(req.query.q, { limit: req.query.limit }) });
}));
router.post('/tip-check', limiter(1, 10), validate(s.tipCheck), h(tipCheck.check));
// Samajh (education): explains numbers the browser already calculated; never adds numbers or advice
router.post('/samajh/explain', limiter(1, 10), validate(s.samajhExplain), h(samajh.explain));
// Daily market brief (same narrative as the Telegram morning brief), cached per IST day and language
router.get('/brief', validate(s.briefQuery, 'query'), h(async (req, res) => {
  const narrativeService = require('../services/sharedNarrativeService');
  const text = await narrativeService.getSharedNarrative(req.query.language);
  res.json({ brief: text, language: req.query.language, date: require('../lib/time').istDate() });
}));
router.post('/alerts/backtest', limiter(1, 30), validate(s.alertRule), requireKnownSymbols((req) => req.body.symbol), h(alerts.backtest));

// Everything below belongs to "this browser" (anonymous visitor cookie). No sign-up.
router.use(identifyVisitor);

router.get('/me', visitor.me);
router.patch('/me', validate(s.updatePreferences), ...save, h(visitor.updatePreferences));

router.get('/watchlists', h(watchlist.list));
router.post('/watchlists', validate(s.watchlistAdd), requireKnownSymbols((req) => req.body.symbol), ...save, h(watchlist.add));
router.post('/watchlists/import', validate(s.watchlistImport), keepKnownSymbols(), ...save, h(watchlist.import));
router.delete('/watchlists/:id', validate(s.idParam, 'params'), h(watchlist.remove));

router.get('/alerts', h(alerts.list));
router.post('/alerts', validate(s.alertRule), requireKnownSymbols((req) => req.body.symbol), ...save, h(alerts.create));
router.patch('/alerts/:id', validate(s.idParam, 'params'), validate(s.alertUpdate), h(alerts.update));
router.delete('/alerts/:id', validate(s.idParam, 'params'), h(alerts.remove));

router.post('/telegram/link', limiter(15, 10), ensureVisitor, h(telegram.createLink));
router.get('/telegram/status', telegram.status);
router.delete('/telegram/link', h(telegram.unlink));

module.exports = router;
