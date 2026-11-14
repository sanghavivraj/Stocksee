const prisma = require('../lib/prisma');
const { HttpError } = require('../middleware/errors');

class AlertService {
  constructor(db) {
    this.db = db;
  }

  list(userId) {
    return this.db.alert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  create(userId, { symbol, type, threshold, direction }) {
    return this.db.alert.create({ data: { userId, symbol, type, threshold, direction } });
  }

  async setActive(userId, id, active) {
    const { count } = await this.db.alert.updateMany({ where: { id, userId }, data: { active } });
    if (count === 0) throw new HttpError(404, 'Alert not found');
    return this.db.alert.findUnique({ where: { id } });
  }

  async remove(userId, id) {
    const { count } = await this.db.alert.deleteMany({ where: { id, userId } });
    if (count === 0) throw new HttpError(404, 'Alert not found');
  }

  /** Active alerts whose owner has Telegram connected (used by the alert job). */
  listDeliverable() {
    return this.db.alert.findMany({
      where: { active: true, user: { telegramChatId: { not: null } } },
      include: { user: { select: { id: true, telegramChatId: true, language: true } } },
    });
  }

  markTriggered(id, at = new Date()) {
    return this.db.alert.update({ where: { id }, data: { lastTriggeredAt: at } });
  }
}

module.exports = new AlertService(prisma);
module.exports.AlertService = AlertService;
