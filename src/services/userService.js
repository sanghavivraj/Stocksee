const prisma = require('../lib/prisma');

/** Anonymous visitor preferences (there are no accounts or passwords). */
class UserService {
  constructor(db) {
    this.db = db;
  }

  updatePreferences(visitorId, { language }) {
    return this.db.user.update({ where: { id: visitorId }, data: { language } });
  }
}

module.exports = new UserService(prisma);
module.exports.UserService = UserService;
