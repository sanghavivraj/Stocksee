const telegramLinkService = require('../services/telegramLinkService');
const telegramService = require('../services/telegramService');
const { HttpError } = require('../middleware/errors');

exports.createLink = async (req, res) => {
  if (!telegramService.isEnabled()) {
    throw new HttpError(503, 'Telegram bot is not configured on this server');
  }
  const username = await telegramService.getBotUsername();
  const { token, expiresAt } = await telegramLinkService.createLinkToken(req.visitor.id);
  res.status(201).json({ botUrl: `https://t.me/${username}?start=${token}`, expiresAt });
};

exports.status = (req, res) => {
  const v = req.visitor;
  res.json(v?.telegramChatId
    ? { connected: true, username: v.telegramUsername, linkedAt: v.telegramLinkedAt }
    : { connected: false, botEnabled: telegramService.isEnabled() });
};

exports.unlink = async (req, res) => {
  if (req.visitor) await telegramLinkService.unlink(req.visitor.id);
  res.status(204).end();
};
