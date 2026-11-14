jest.mock('../src/services/telegramService', () => ({
  isEnabled: () => false, getBotUsername: async () => null, sendMessage: jest.fn(),
}));

const { app, request, visitorAgent } = require('./helpers/agent');
const { prisma, resetDb } = require('./helpers/db');

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('Each browser can only see and change its own data', () => {
  let alice;
  let bob;
  beforeEach(async () => {
    alice = await visitorAgent();
    bob = await visitorAgent();
  });

  it('watchlists', async () => {
    const item = (await alice.post('/api/watchlists').send({ symbol: 'reliance.ns' })).body;
    expect(item.symbol).toBe('RELIANCE.NS');

    // Adding the same symbol again is idempotent
    expect((await alice.post('/api/watchlists').send({ symbol: 'RELIANCE.NS' })).body.id).toBe(item.id);

    expect((await bob.get('/api/watchlists')).body).toEqual([]);
    expect((await bob.delete(`/api/watchlists/${item.id}`)).status).toBe(404);
    expect((await request(app).delete(`/api/watchlists/${item.id}`)).status).toBe(404); // no cookie at all
    expect((await alice.get('/api/watchlists')).body).toHaveLength(1);

    expect((await alice.delete(`/api/watchlists/${item.id}`)).status).toBe(204);
    expect((await alice.get('/api/watchlists')).body).toEqual([]);
  });

  it('watchlist import skips duplicates', async () => {
    await alice.post('/api/watchlists').send({ symbol: 'TCS.NS' });
    const res = await alice.post('/api/watchlists/import').send({ symbols: ['TCS.NS', 'infy.ns', 'GOLD'] });
    expect(res.body.map((w) => w.symbol).sort()).toEqual(['GOLD', 'INFY.NS', 'TCS.NS']);
  });

  it('alerts, including pause/resume', async () => {
    const alert = (await alice.post('/api/alerts').send({ symbol: 'IOC.NS', threshold: 2, direction: 'up' })).body;
    expect(alert).toMatchObject({ symbol: 'IOC.NS', threshold: 2, direction: 'up', active: true });

    // Bob (or a browser with no cookie) cannot read, pause or delete Alice's alert
    expect((await bob.get('/api/alerts')).body).toEqual([]);
    expect((await bob.patch(`/api/alerts/${alert.id}`).send({ active: false })).status).toBe(404);
    expect((await bob.delete(`/api/alerts/${alert.id}`)).status).toBe(404);
    expect((await request(app).patch(`/api/alerts/${alert.id}`).send({ active: false })).status).toBe(404);

    // Pause and resume (the old frontend sent a bare boolean, so this never worked)
    expect((await alice.patch(`/api/alerts/${alert.id}`).send({ active: false })).body.active).toBe(false);
    expect((await alice.patch(`/api/alerts/${alert.id}`).send({ active: true })).body.active).toBe(true);
    // The string "false" used to become true via Boolean("false"); now it's rejected
    expect((await alice.patch(`/api/alerts/${alert.id}`).send({ active: 'false' })).status).toBe(400);
  });

  it('alert validation', async () => {
    expect((await alice.post('/api/alerts').send({ symbol: 'IOC', threshold: -1, direction: 'up' })).status).toBe(400);
    expect((await alice.post('/api/alerts').send({ symbol: 'IOC', threshold: 2, direction: 'sideways' })).status).toBe(400);
    expect((await alice.post('/api/alerts').send({ symbol: '<script>', threshold: 2, direction: 'up' })).status).toBe(400);
  });

  it('ignores a userId sent in the body', async () => {
    const bobRow = await prisma.user.findFirst({ orderBy: { id: 'desc' } });
    await alice.post('/api/alerts').send({ userId: bobRow.id, symbol: 'SBIN.NS', threshold: 1, direction: 'down' });
    expect((await bob.get('/api/alerts')).body).toEqual([]);
    expect((await alice.get('/api/alerts')).body).toHaveLength(1);
  });

  it('holdings / portfolio (buy-side features) no longer exist', async () => {
    expect((await alice.get('/api/holdings')).status).toBe(404);
    expect((await alice.get('/api/portfolio/summary')).status).toBe(404);
  });
});
