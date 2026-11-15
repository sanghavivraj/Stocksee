const express = require('express');
const s = require('../controllers/schemas');
const { asyncHandler: h, validate, requireKnownSymbols, keepKnownSymbols } = require('../middleware/errors');
const { identifyVisitor, ensureVisitor } = require('../middleware/visitor');
const { limiter } = require('../middleware/rateLimit');
const visitor = require('../controllers/visitorController');
const telegram = require('../controllers/telegramController');
const watchlist = require('../controllers/watchlistController');
const alerts = require('../controllers/alertController');
const ask = require('../controllers/askController');
const tipCheck = require('../controllers/tipCheckController');
const samajh = require('../controllers/samajhController');
const market = require('../controllers/marketController');

// Routes that save data may create an anonymous visitor: limit them so nobody can flood the database
const save = [limiter(1, 60), ensureVisitor];

const router = express.Router();

// Market data and Q&A: fully public
router.use('/markets', limiter(1, 240), require('./marketRoutes'));
router.post('/ask', limiter(1, 20), validate(s.ask), h(ask.ask));
router.get('/search', limiter(1, 120), validate(s.symbolSearch, 'query'), h(market.search));
router.post('/tip-check', limiter(1, 10), validate(s.tipCheck), h(tipCheck.check));
// Samajh (education): explains numbers the browser already calculated; never adds numbers or advice
router.post('/samajh/explain', limiter(1, 10), validate(s.samajhExplain), h(samajh.explain));
router.get('/brief', limiter(1, 30), validate(s.briefQuery, 'query'), h(market.brief));
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
