const { t, fmtPct, fmtPrice } = require('./messages');
const { deliverAll } = require('./deliver');

const MAX_LINES = 15;

/** Monday 9:00 AM IST: each watchlist symbol's change over the past week (real closes). */
async function runWeeklyDigest({ prisma, marketDataService, sendMessage }) {
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null }, watchlists: { some: {} } },
    include: { watchlists: { orderBy: { createdAt: 'desc' }, take: MAX_LINES } },
  });
  if (!users.length) return { sent: 0, failed: 0 };

  const symbols = [...new Set(users.flatMap((u) => u.watchlists.map((w) => w.symbol)))];
  const trends = new Map();
  await Promise.all(symbols.map(async (s) => {
    trends.set(s, await marketDataService.getTrendData(s).catch(() => null));
  }));

  const items = users.map((user) => {
    const m = t(user.language);
    const rows = user.watchlists.map(({ symbol }) => {
      const d = trends.get(symbol);
      return { symbol, d, week: typeof d?.weekChangePercent === 'number' ? d.weekChangePercent : null };
    });
    // Best performers first; unavailable at the bottom
    rows.sort((a, b) => (b.week ?? -Infinity) - (a.week ?? -Infinity));

    const lines = [m.weekly, '', m.weekWatchlist];
    for (const { symbol, d, week } of rows) {
      lines.push(d ? `• ${symbol}: ${fmtPrice(d.currentPrice, d.currency)} (${fmtPct(week)})` : `• ${symbol}: ${m.unavailable}`);
    }
    lines.push('', m.disclaimer);
    return { chatId: user.telegramChatId, text: lines.join('\n') };
  });

  return deliverAll(sendMessage, items, 'WeeklyDigest');
}

module.exports = { runWeeklyDigest };
