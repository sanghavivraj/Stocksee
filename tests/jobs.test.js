const { runAlertEvaluation } = require('../src/jobs/alertEvaluation');
const { runMorningBriefing } = require('../src/jobs/morningBriefing');
const { runWeeklyDigest } = require('../src/jobs/weeklyDigest');

const user = (id, language = 'en') => ({ id, telegramChatId: `chat${id}`, language });
const alert = (id, symbol, type, direction, threshold, extra = {}) => ({
  id, symbol, type, direction, threshold, active: true, lastTriggeredAt: null, user: user(id), ...extra,
});

const quotes = (map) => ({
  getMarketData: jest.fn(async (s) => {
    if (!(s in map)) throw new Error('unavailable');
    return map[s];
  }),
});

/** 30 flat sessions ending on `lastDate`, last candle overridden by `today`. */
function candles(lastDate, today = {}) {
  const out = [];
  const end = new Date(`${lastDate}T00:00:00Z`);
  for (let k = 29; k >= 0; k -= 1) {
    const d = new Date(end.getTime() - k * 86400000).toISOString().slice(0, 10);
    out.push({ time: d, open: 100, high: 101, low: 99, close: 100, volume: 1000 });
  }
  Object.assign(out[out.length - 1], today);
  return out;
}
const history = (map) => ({
  getHistory: jest.fn(async (s) => {
    if (!(s in map)) throw new Error('unavailable');
    return map[s];
  }),
});

describe('Smart alert job', () => {
  const now = new Date('2026-11-16T06:00:00Z'); // Monday 11:30 IST
  const TODAY = '2026-11-16';

  it('fires price-move, gap and volume alerts from today\'s candle and marks them triggered', async () => {
    const alertService = {
      listDeliverable: jest.fn(async () => [
        alert(1, 'IOC.NS', 'PRICE_MOVE', 'up', 2),
        alert(2, 'IOC.NS', 'PRICE_MOVE', 'down', 2),
        alert(3, 'TCS.NS', 'GAP', 'down', 1),
        alert(4, 'TCS.NS', 'VOLUME_SPIKE', 'up', 3),
      ]),
      markTriggered: jest.fn(async () => {}),
    };
    const sendMessage = jest.fn(async () => true);
    const marketDataService = history({
      'IOC.NS': { candles: candles(TODAY, { close: 102.5, high: 103 }) },
      'TCS.NS': { candles: candles(TODAY, { open: 98.5, close: 99, low: 98, volume: 4000 }) },
    });

    const res = await runAlertEvaluation({ alertService, marketDataService, sendMessage, now });

    expect(res).toMatchObject({ checked: 4, sent: 3, failed: 0 });
    expect(marketDataService.getHistory).toHaveBeenCalledTimes(2); // one history per symbol
    expect(sendMessage).toHaveBeenCalledWith('chat1', expect.stringContaining('IOC.NS* is up 2.5% today'));
    expect(sendMessage).toHaveBeenCalledWith('chat3', expect.stringContaining('1.5% gap down'));
    expect(sendMessage).toHaveBeenCalledWith('chat4', expect.stringContaining('4× its 20-day average volume'));
    expect(alertService.markTriggered.mock.calls.map(([id]) => id).sort()).toEqual([1, 3, 4]);
  });

  it('fires at most once per IST day', async () => {
    const alertService = {
      listDeliverable: async () => [
        alert(1, 'IOC.NS', 'PRICE_MOVE', 'up', 2, { lastTriggeredAt: new Date('2026-11-16T04:00:00Z') }), // today 9:30 IST
        alert(2, 'IOC.NS', 'PRICE_MOVE', 'up', 2, { lastTriggeredAt: new Date('2026-11-13T09:00:00Z') }), // last Friday
      ],
      markTriggered: jest.fn(),
    };
    const sendMessage = jest.fn(async () => true);
    await runAlertEvaluation({ alertService, marketDataService: history({ 'IOC.NS': { candles: candles(TODAY, { close: 103 }) } }), sendMessage, now });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith('chat2', expect.any(String));
  });

  it('never alerts on unavailable, stale, or not-today data', async () => {
    const alertService = {
      listDeliverable: async () => [
        alert(1, 'GONE.NS', 'PRICE_MOVE', 'up', 1),
        alert(2, 'OLD.NS', 'PRICE_MOVE', 'up', 1),
        alert(3, 'FRI.NS', 'PRICE_MOVE', 'up', 1),
      ],
      markTriggered: jest.fn(),
    };
    const sendMessage = jest.fn();
    await runAlertEvaluation({
      alertService,
      marketDataService: history({
        'OLD.NS': { stale: true, candles: candles(TODAY, { close: 120 }) },
        'FRI.NS': { candles: candles('2026-11-13', { close: 120 }) }, // market hasn't opened today
      }),
      sendMessage,
      now,
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(alertService.markTriggered).not.toHaveBeenCalled();
  });

  it('localizes alert text', async () => {
    const alertService = {
      listDeliverable: async () => [alert(1, 'IOC.NS', 'PRICE_MOVE', 'up', 2, { user: user(1, 'hi') })],
      markTriggered: jest.fn(),
    };
    const sendMessage = jest.fn(async () => true);
    await runAlertEvaluation({ alertService, marketDataService: history({ 'IOC.NS': { candles: candles(TODAY, { close: 102.2 }) } }), sendMessage, now });
    expect(sendMessage.mock.calls[0][1]).toContain('प्राइस अलर्ट');
  });
});

describe('Morning briefing job', () => {
  it('sends the narrative plus each user\'s watchlist, one narrative per language', async () => {
    const prisma = {
      user: {
        findMany: jest.fn(async () => [
          { ...user(1), watchlists: [{ symbol: 'IOC.NS' }, { symbol: 'NOPE.NS' }] },
          { ...user(2, 'gu'), watchlists: [] },
        ]),
      },
    };
    const narrativeService = { getSharedNarrative: jest.fn(async (lang) => `NARRATIVE-${lang}`) };
    const sendMessage = jest.fn(async () => true);
    const marketDataService = quotes({ 'IOC.NS': { price: 144.04, changePercent: -1.46, currency: 'INR' } });

    const res = await runMorningBriefing({ prisma, narrativeService, marketDataService, sendMessage });

    expect(res).toEqual({ sent: 2, failed: 0 });
    expect(narrativeService.getSharedNarrative).toHaveBeenCalledTimes(2);
    const [chat1, text1] = sendMessage.mock.calls[0];
    expect(chat1).toBe('chat1');
    expect(text1).toContain('NARRATIVE-en');
    expect(text1).toContain('• IOC.NS: ₹144.04 (-1.46%)');
    expect(text1).toContain('• NOPE.NS: price unavailable');
    expect(text1).toContain('not a SEBI-registered adviser');
    expect(sendMessage.mock.calls[1][1]).toContain('NARRATIVE-gu');
  });

  it('keeps going when one user fails', async () => {
    const prisma = { user: { findMany: async () => [{ ...user(1), watchlists: [] }, { ...user(2), watchlists: [] }] } };
    const sendMessage = jest.fn().mockRejectedValueOnce(new Error('blocked by user')).mockResolvedValueOnce(true);
    const res = await runMorningBriefing({
      prisma, narrativeService: { getSharedNarrative: async () => 'N' }, marketDataService: quotes({}), sendMessage,
    });
    expect(res).toEqual({ sent: 1, failed: 1 });
  });
});

describe('Weekly digest job', () => {
  it('lists the watchlist sorted by 1-week change', async () => {
    const prisma = { user: { findMany: async () => [{ ...user(1), watchlists: [{ symbol: 'A.NS' }, { symbol: 'B.NS' }, { symbol: 'C.NS' }] }] } };
    const marketDataService = {
      getTrendData: jest.fn(async (s) => {
        if (s === 'C.NS') throw new Error('unavailable');
        return { currentPrice: 100, currency: 'INR', weekChangePercent: s === 'A.NS' ? -2 : 5 };
      }),
    };
    const sendMessage = jest.fn(async () => true);
    await runWeeklyDigest({ prisma, marketDataService, sendMessage });

    const text = sendMessage.mock.calls[0][1];
    expect(text.indexOf('B.NS')).toBeLessThan(text.indexOf('A.NS'));
    expect(text).toContain('• B.NS: ₹100.00 (+5.00%)');
    expect(text).toContain('• C.NS: price unavailable');
  });
});
