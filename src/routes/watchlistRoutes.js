const express = require('express');
const router = express.Router();
const watchlistController = require('../controllers/watchlistController');

// Create a new watchlist item
router.post('/', watchlistController.createWatchlistItem);

// Get all watchlist items for a user
router.get('/:userId', watchlistController.getWatchlistItems);

// Delete a watchlist item
router.delete('/:id', watchlistController.deleteWatchlistItem);

module.exports = router;