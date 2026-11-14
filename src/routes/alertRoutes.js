const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Get all alerts for a user
router.get('/:userId', alertController.getAlerts);

// Create a new alert
router.post('/', alertController.createAlert);

// Update an alert
router.patch('/:id', alertController.updateAlert);

// Delete an alert
router.delete('/:id', alertController.deleteAlert);

module.exports = router;