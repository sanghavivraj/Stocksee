const express = require('express');
const router = express.Router();
const askController = require('../controllers/askController');

// Ask a financial question
router.post('/', askController.askQuestion);

module.exports = router;