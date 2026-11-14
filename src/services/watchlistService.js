const prisma = require('../lib/prisma');
const { HttpError } = require('../middleware/errors');

class WatchlistService {
  constructor(db) {
    this.db = db;
  }

  list(userId) {
    return this.db.watchlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  /** Idempotent: adding a symbol that's already there returns the existing item. */
  add(userId, symbol) {
    return this.db.watchlist.upsert({
      where: { userId_symbol: { userId, symbol } },
      update: {},
      create: { userId, symbol },
    });
  }

  /** Bulk import (e.g. a watchlist saved in the browser before the user signed up). */
  async import(userId, symbols) {
    await this.db.watchlist.createMany({
      data: symbols.map((symbol) => ({ userId, symbol })),
      skipDuplicates: true,
    });
    return this.list(userId);
  }

  async remove(userId, id) {
    const { count } = await this.db.watchlist.deleteMany({ where: { id, userId } });
    if (count === 0) throw new HttpError(404, 'Watchlist item not found');
  }
}

module.exports = new WatchlistService(prisma);
module.exports.WatchlistService = WatchlistService;
