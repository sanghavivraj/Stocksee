jest.mock('../src/services/telegramService', () => ({ isEnabled: () => false, getBotUsername: async () => null, sendMessage: jest.fn() }));
jest.mock('../src/services/marketDataService', () => {
  const actual = jest.requireActual('../src/services/marketDataService');
  return Object.assign(Object.create(Object.getPrototypeOf(actual)), actual, { getHistory: jest.fn() });
});
const marketDataService = require('../src/services/marketDataService');
const { app, request, visitorAgent } = require('./helpers/agent');
const { prisma, resetDb } = require('./helpers/db');

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const flat = (n) => Array.from({ length: n }, (_, i) => ({
  time: new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10),
  open: 100, high: 101, low: 99, close: i === n - 10 ? 104 : 100, volume: 1000,
}));

describe('Smart alerts API', () => {
  it('creates each alert type with the right defaults', async () => {
    const agent = await visitorAgent();
    const make = (body) => agent.post('/api/alerts').send(body);

    expect((await make({ symbol: 'IOC.NS', threshold: 2, direction: 'up' })).body).toMatchObject({ type: 'PRICE_MOVE' }); // old clients
    expect((await make({ type: 'GAP', symbol: 'IOC.NS', threshold: 1.5, direction: 'down' })).body).toMatchObject({ type: 'GAP', direction: 'down' });
    expect((await make({ type: 'VOLUME_SPIKE', symbol: 'IOC.NS', threshold: 3 })).body).toMatchObject({ type: 'VOLUME_SPIKE', direction: 'up', threshold: 3 });
    expect((await make({ type: 'NEW_52W_HIGH', symbol: 'IOC.NS' })).body).toMatchObject({ type: 'NEW_52W_HIGH', direction: 'up', threshold: 0 });
    expect((await make({ type: 'NEW_52W_LOW', symbol: 'IOC.NS' })).body).toMatchObject({ type: 'NEW_52W_LOW', direction: 'down' });

    expect((await make({ type: 'VOLUME_SPIKE', symbol: 'IOC.NS', threshold: 1 })).status).toBe(400); // < 1.5x makes no sense
    expect((await make({ type: 'GAP', symbol: 'IOC.NS', threshold: 2 })).status).toBe(400);           // direction required
    expect((await make({ type: 'MOON', symbol: 'IOC.NS' })).status).toBe(400);
  });

  it('backtests a rule on real history without saving anything', async () => {
    marketDataService.getHistory.mockResolvedValue({ symbol: 'IOC.NS', candles: flat(300), source: 'test' });
    const res = await request(app).post('/api/alerts/backtest').send({ type: 'PRICE_MOVE', symbol: 'IOC.NS', threshold: 3, direction: 'up' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ symbol: 'IOC.NS', fires: 1, sessions: 252 });
    expect(res.body.lastFired[0].value).toBe(4);
    expect(marketDataService.getHistory).toHaveBeenCalledWith('IOC.NS', '2y');
    expect(await prisma.user.count()).toBe(0); // a preview never creates a visitor
  });
});
