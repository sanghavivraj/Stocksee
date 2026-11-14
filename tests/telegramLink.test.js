jest.mock('../src/services/telegramService', () => ({
  isEnabled: jest.fn(() => true),
  getBotUsername: jest.fn(async () => 'StockSeeTestBot'),
  sendMessage: jest.fn(),
}));

const telegramService = require('../src/services/telegramService');
const telegramLinkService = require('../src/services/telegramLinkService');
const { app, request, visitorAgent } = require('./helpers/agent');
const { prisma, resetDb } = require('./helpers/db');

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const tokenFrom = (botUrl) => new URL(botUrl).searchParams.get('start');

describe('Telegram account linking', () => {
  it('creates a one-time deep link the bot accepts (prefix matches on both sides)', async () => {
    const agent = await visitorAgent();
    const visitor = await prisma.user.findFirst();

    const res = await agent.post('/api/telegram/link');
    expect(res.status).toBe(201);
    expect(res.body.botUrl).toMatch(/^https:\/\/t\.me\/StockSeeTestBot\?start=link_[a-f0-9]{32}$/);
    const token = tokenFrom(res.body.botUrl);
    expect(token.length).toBeLessThanOrEqual(64); // Telegram's deep-link limit

    expect((await agent.get('/api/telegram/status')).body.connected).toBe(false);

    // What the bot does when the user taps "Start"
    const linked = await telegramLinkService.consumeLinkToken(token, { chatId: 987654321, username: 'tguser' });
    expect(linked.id).toBe(visitor.id);

    const status = (await agent.get('/api/telegram/status')).body;
    expect(status).toMatchObject({ connected: true, username: 'tguser' });
    expect(JSON.stringify(status)).not.toContain('987654321'); // chat id is never exposed

    // The token is single-use
    expect(await telegramLinkService.consumeLinkToken(token, { chatId: 111 })).toBeNull();
  });

  it('rejects expired, unknown and wrongly-prefixed tokens', async () => {
    const agent = await visitorAgent();
    const visitor = await prisma.user.findFirst();
    const token = tokenFrom((await agent.post('/api/telegram/link')).body.botUrl);
    await prisma.user.update({ where: { id: visitor.id }, data: { telegramLinkTokenExpires: new Date(Date.now() - 1000) } });

    expect(await telegramLinkService.consumeLinkToken(token, { chatId: 1 })).toBeNull();
    expect(await telegramLinkService.consumeLinkToken('link_doesnotexist', { chatId: 1 })).toBeNull();
    expect(await telegramLinkService.consumeLinkToken('FINUSER_ABC', { chatId: 1 })).toBeNull();
  });

  it('moves a chat to the new account if it was linked to another one', async () => {
    const a = await visitorAgent();
    const b = await visitorAgent();
    await telegramLinkService.consumeLinkToken(tokenFrom((await a.post('/api/telegram/link')).body.botUrl), { chatId: 42 });
    await telegramLinkService.consumeLinkToken(tokenFrom((await b.post('/api/telegram/link')).body.botUrl), { chatId: 42 });

    expect((await a.get('/api/telegram/status')).body.connected).toBe(false);
    expect((await b.get('/api/telegram/status')).body.connected).toBe(true);
  });

  it('unlinks', async () => {
    const agent = await visitorAgent();
    await telegramLinkService.consumeLinkToken(tokenFrom((await agent.post('/api/telegram/link')).body.botUrl), { chatId: 7 });
    expect((await agent.delete('/api/telegram/link')).status).toBe(204);
    expect((await agent.get('/api/telegram/status')).body.connected).toBe(false);
  });

  it('returns 503 when the bot is not configured', async () => {
    telegramService.isEnabled.mockReturnValueOnce(false);
    const agent = await visitorAgent();
    expect((await agent.post('/api/telegram/link')).status).toBe(503);
  });

  it('a brand-new browser gets a visitor cookie when it starts linking (no sign-up needed)', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/telegram/link');
    expect(res.status).toBe(201);
    expect(res.headers['set-cookie'].join(';')).toMatch(/stocksee_visitor=/);
  });

  it('old public token-status endpoint (which leaked chat IDs) is gone', async () => {
    expect((await request(app).get('/api/users/telegram-status/FINUSER_DEMO')).status).toBe(404);
  });
});
