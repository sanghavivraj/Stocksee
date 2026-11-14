const express = require('express');
const router = express.Router();
const portfolioService = require('../services/portfolioService');

router.get('/:userId/value', async (req, res) => {
  try {
    const { userId } = req.params;
    const portfolioValue = await portfolioService.calculatePortfolioValue(parseInt(userId));
    res.status(200).json({ portfolioValue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId/delta', async (req, res) => {
  try {
    const { userId } = req.params;
    const portfolioDelta = await portfolioService.calculatePortfolioDelta(parseInt(userId));
    res.status(200).json({ portfolioDelta });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;