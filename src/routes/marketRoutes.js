const express = require('express');
const s = require('../controllers/schemas');
const { asyncHandler: h, validate } = require('../middleware/errors');
const market = require('../controllers/marketController');

const router = express.Router();

// Fixed paths must stay above '/:symbol' so "unusual", "compare" ... are not treated as tickers.
router.get('/unusual', validate(s.unusualQuery, 'query'), h(market.unusual));
router.get('/insights', validate(s.insightsQuery, 'query'), h(market.insights));
router.get('/briefing', validate(s.briefingQuery, 'query'), h(market.briefing));
router.get('/replay', validate(s.replayQuery, 'query'), h(market.replay));
router.get('/compare', h(market.compare));
router.get('/popular', validate(s.popularQuery, 'query'), h(market.popular));
router.get('/breadth', h(market.breadth));

router.get('/:symbol/scorecard', h(market.scorecard));
router.get('/:symbol/history', h(market.history));
router.get('/:symbol', h(market.quote));

module.exports = router;
