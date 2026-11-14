const { t, fmtPct, fmtPrice } = require('./messages');
const { deliverAll } = require('./deliver');

const MAX_WATCHLIST_LINES = 8;

/**
 * 8:30 AM IST: market narrative + the user's watchlist (previous session's move).
 * Dependencies are injected so the job can be tested without Telegram or network.
 */
async function runMorningBriefing({ prisma, narrativeService, marketDataService, sendMessage }) {
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    include: { watchlists: { orderBy: { createdAt: 'desc' }, take: MAX_WATCHLIST_LINES } },
  });
  if (!users.length) return { sent: 0, failed: 0 };

  // One narrative per language (cached), one quote per symbol
  const narratives = {};
  for (const lang of new Set(users.map((u) => u.language))) {
    narratives[lang] = await narrativeService.getSharedNarrative(lang).catch(() => null);
  }
  const symbols = [...new Set(users.flatMap((u) => u.watchlists.map((w) => w.symbol)))];
  const quotes = new Map();
  await Promise.all(symbols.map(async (s) => {
    quotes.set(s, await marketDataService.getMarketData(s).catch(() => null));
  }));

  const items = users.map((user) => {
    const m = t(user.language);
    const lines = [m.morning, '', narratives[user.language] || m.noBrief];
    if (user.watchlists.length) {
      lines.push('', m.yourWatchlist);
      for (const { symbol } of user.watchlists) {
        const q = quotes.get(symbol);
        lines.push(q ? `• ${symbol}: ${fmtPrice(q.price, q.currency)} (${fmtPct(q.changePercent)})` : `• ${symbol}: ${m.unavailable}`);
      }
    }
    lines.push('', m.disclaimer);
    return { chatId: user.telegramChatId, text: lines.join('\n') };
  });

  return deliverAll(sendMessage, items, 'MorningBriefing');
}

module.exports = { runMorningBriefing };
