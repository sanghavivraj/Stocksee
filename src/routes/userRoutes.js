const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { getTelegramUserByToken } = require('../services/telegramService');

router.post('/', userController.createUser);
router.get('/:telegramId', userController.getUser);
router.put('/:telegramId/language', userController.updateUserLanguage);

// Check Telegram connection status by deep link token
router.get('/telegram-status/:token', (req, res) => {
  const { token } = req.params;
  const user = getTelegramUserByToken(token);
  if (user) {
    return res.status(200).json({ connected: true, ...user });
  }
  return res.status(200).json({ connected: false });
});

module.exports = router;