const crypto = require('crypto');
const prisma = require('../lib/prisma');
const config = require('../config');

// Telegram deep-link payloads allow [A-Za-z0-9_-], max 64 chars.
const LINK_PREFIX = 'link_';

class TelegramLinkService {
  constructor(db) {
    this.db = db;
  }

  /** Create a one-time, short-lived token the user opens in Telegram as t.me/<bot>?start=<token>. */
  async createLinkToken(userId) {
    const token = `${LINK_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + config.telegramLinkTtlMinutes * 60 * 1000);
    await this.db.user.update({
      where: { id: userId },
      data: { telegramLinkToken: token, telegramLinkTokenExpires: expiresAt },
    });
    return { token, expiresAt };
  }

  /**
   * Called by the bot on /start <token>. Links the chat to the token's owner.
   * @returns the linked user, or null when the token is unknown/expired.
   */
  async consumeLinkToken(token, { chatId, username }) {
    if (typeof token !== 'string' || !token.startsWith(LINK_PREFIX)) return null;

    const user = await this.db.user.findFirst({
      where: { telegramLinkToken: token, telegramLinkTokenExpires: { gt: new Date() } },
    });
    if (!user) return null;

    const chat = String(chatId);
    const [, linked] = await this.db.$transaction([
      // A Telegram chat can belong to only one StockSee account
      this.db.user.updateMany({
        where: { telegramChatId: chat, NOT: { id: user.id } },
        data: { telegramChatId: null, telegramUsername: null, telegramLinkedAt: null },
      }),
      this.db.user.update({
        where: { id: user.id },
        data: {
          telegramChatId: chat,
          telegramUsername: username || null,
          telegramLinkedAt: new Date(),
          telegramLinkToken: null,           // one-time use
          telegramLinkTokenExpires: null,
        },
      }),
    ]);
    return linked;
  }

  unlink(userId) {
    return this.db.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null, telegramUsername: null, telegramLinkedAt: null,
        telegramLinkToken: null, telegramLinkTokenExpires: null,
      },
    });
  }

  findByChatId(chatId) {
    return this.db.user.findUnique({ where: { telegramChatId: String(chatId) } });
  }
}

module.exports = new TelegramLinkService(prisma);
module.exports.TelegramLinkService = TelegramLinkService;
module.exports.LINK_PREFIX = LINK_PREFIX;
