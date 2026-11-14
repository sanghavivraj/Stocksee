const express = require('express');
const router = express.Router();
const holdingController = require('../controllers/holdingController');

// Create a new holding
router.post('/', holdingController.createHolding);

// Get all holdings for a user
router.get('/:userId', holdingController.getHoldings);

// Delete a holding
router.delete('/:id', holdingController.deleteHolding);

module.exports = router;