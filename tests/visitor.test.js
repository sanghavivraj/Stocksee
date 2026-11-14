jest.mock('../src/services/telegramService', () => ({
  isEnabled: () => false, getBotUsername: async () => null, sendMessage: jest.fn(),
}));

const { app, request, visitorAgent } = require('./helpers/agent');
const { prisma, resetDb } = require('./helpers/db');

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('Anonymous visitors (no sign-up)', () => {
  it('there are no sign-up / login endpoints', async () => {
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(404);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(404);
  });

  it('a new browser can read without creating anything', async () => {
    expect((await request(app).get('/api/me')).body).toEqual({ visitor: null });
    expect((await request(app).get('/api/watchlists')).body).toEqual([]);
    expect((await request(app).get('/api/alerts')).body).toEqual([]);
    expect((await request(app).get('/api/telegram/status')).body.connected).toBe(false);
    expect(await prisma.user.count()).toBe(0); // reading never creates visitor rows
  });

  it('the first save creates a visitor and an httpOnly cookie; later requests reuse it', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/watchlists').send({ symbol: 'reliance.ns' });
    expect(res.status).toBe(201);

    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toMatch(/stocksee_visitor=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    await agent.post('/api/alerts').send({ symbol: 'IOC.NS', threshold: 2, direction: 'up' });
    expect(await prisma.user.count()).toBe(1);
    expect((await agent.get('/api/watchlists')).body.map((w) => w.symbol)).toEqual(['RELIANCE.NS']);
  });

  it('language preference is saved and returned without exposing internal IDs', async () => {
    const agent = request.agent(app);
    const res = await agent.patch('/api/me').send({ language: 'gu' });
    expect(res.body).toEqual({ visitor: { language: 'gu', telegram: { connected: false } } });
    expect((await agent.get('/api/me')).body.visitor.language).toBe('gu');
    expect((await agent.patch('/api/me').send({ language: 'fr' })).status).toBe(400);
  });

  it('a forged cookie is treated as a brand-new browser, not as someone else', async () => {
    const owner = await visitorAgent();
    await owner.post('/api/alerts').send({ symbol: 'TCS.NS', threshold: 1, direction: 'up' });

    const res = await request(app).get('/api/alerts')
      .set('Cookie', 'stocksee_visitor=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged-signature');
    expect(res.body).toEqual([]);
  });
});
