const aiService = require('../src/services/aiService');
const samajh = require('../src/services/samajhExplainService');
const { app, request } = require('./helpers/agent');

const body = {
  language: 'en',
  claim: '₹5,000 SIP = ₹1 crore in 10 years.',
  kind: 'sip-target',
  verdictClass: 'mathematically_unrealistic',
  facts: { monthly: 5000, years: 10, rate: 12, fv: 1150193.4473, needNominal: 43.8285, target: 10000000 },
  shown: ['₹11,50,193 (about ₹11.5 lakh)', '43.8% a year every year (53.8% effective)', '₹1 crore'],
};

const fakeProvider = (name, text) => ({ name, call: jest.fn().mockResolvedValue(text) });
afterEach(() => jest.restoreAllMocks());

describe('Samajh explain: the AI only explains numbers that were already calculated', () => {
  it('returns the AI text when every number it uses came from the results', async () => {
    const good = 'At 12% a year the plan reaches about ₹11.5 lakh in 10 years. The claim needs about 43.8% a year, every year, which is far from a normal planning assumption. Nobody can promise that.';
    const provider = fakeProvider('gemini', good);
    jest.spyOn(aiService, 'providers').mockReturnValue([provider]);
    const out = await samajh.explain(body);
    expect(out).toEqual({ status: 'ok', text: good, source: 'gemini' });
    // the AI was told the rules and given the results, and the claim was passed as data
    const sent = provider.call.mock.calls[0][0];
    expect(sent.system).toMatch(/Use ONLY numbers that appear in <results>/);
    expect(sent.user).toContain('<claim>₹5,000 SIP = ₹1 crore in 10 years.</claim>');
    expect(sent.user).toContain('43.8285');
  });

  it('rejects an answer that makes up a number, and tries the next AI', async () => {
    const made = fakeProvider('gemini', 'At 15% a year it would reach about ₹17.5 lakh, so the claim is still far away from what that gives.');
    const fine = fakeProvider('groq', 'The claim needs about 43.8% a year, every year, for 10 years. At 12% a year the result is about ₹11.5 lakh.');
    jest.spyOn(aiService, 'providers').mockReturnValue([made, fine]);
    const out = await samajh.explain(body);
    expect(out.status).toBe('ok');
    expect(out.source).toBe('groq');
  });

  it('rejects advice, predictions and the word "guaranteed"', async () => {
    for (const text of [
      'You should buy mutual funds instead, the claim needs 43.8% a year every year.',
      'The market will rise so the SIP reaches ₹11.5 lakh, and the claim needs 43.8% a year.',
      'This is a guaranteed scam: it needs 43.8% a year every single year for 10 years.',
    ]) {
      jest.spyOn(aiService, 'providers').mockReturnValue([fakeProvider('gemini', text)]);
      const out = await samajh.explain(body);
      expect(out.status).toBe('unavailable');
      expect(out.reasons[0]).toMatch(/advice_language/);
    }
  });

  it('requires the right script for Hindi', async () => {
    jest.spyOn(aiService, 'providers').mockReturnValue([fakeProvider('gemini', 'The claim needs about 43.8% a year, every year, for 10 years in total.')]);
    const out = await samajh.explain({ ...body, language: 'hi' });
    expect(out.status).toBe('unavailable');
    expect(out.reasons[0]).toMatch(/wrong_language/);
  });

  it('reports "unavailable" with no AI keys, so the page falls back to its built-in explanation', async () => {
    jest.spyOn(aiService, 'providers').mockReturnValue([]);
    expect(await samajh.explain(body)).toEqual({ status: 'unavailable', reasons: ['no_ai_configured'] });
  });

  it('survives an AI that errors or times out', async () => {
    jest.spyOn(aiService, 'providers').mockReturnValue([{ name: 'gemini', call: jest.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: 'ECONNABORTED' })) }]);
    const out = await samajh.explain(body);
    expect(out.status).toBe('unavailable');
    expect(out.reasons[0]).toMatch(/error/);
  });

  it('refuses tip and prediction requests with the StockSee line, without calling the AI', async () => {
    const provider = fakeProvider('gemini', 'x');
    jest.spyOn(aiService, 'providers').mockReturnValue([provider]);
    for (const claim of ['Which stock should I buy today?', 'Will Nifty go up tomorrow?', 'give me a stock tip']) {
      const out = await samajh.explain({ ...body, claim });
      expect(out).toEqual({ status: 'refused', message: 'We do not predict direction. Nobody can do it reliably, and calling it would be a tip.' });
    }
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('does not refuse an ordinary claim', () => {
    expect(samajh.isTipRequest('This stock will 10x.')).toBe(false);
    expect(samajh.isTipRequest('Double your money in 25 days.')).toBe(false);
  });
});

describe('POST /api/samajh/explain', () => {
  it('validates the input', async () => {
    expect((await request(app).post('/api/samajh/explain').send({})).status).toBe(400);
    expect((await request(app).post('/api/samajh/explain').send({ ...body, claim: 'x'.repeat(501) })).status).toBe(400);
    expect((await request(app).post('/api/samajh/explain').send({ ...body, kind: 'nonsense' })).status).toBe(400);
    expect((await request(app).post('/api/samajh/explain').send({ ...body, facts: { a: { nested: 1 } } })).status).toBe(400);
  });

  it('answers 200 with the AI text, or "unavailable" when there is no AI', async () => {
    jest.spyOn(aiService, 'providers').mockReturnValue([]);
    const none = await request(app).post('/api/samajh/explain').send(body);
    expect(none.status).toBe(200);
    expect(none.body.status).toBe('unavailable');

    jest.spyOn(aiService, 'providers').mockReturnValue([fakeProvider('gemini', 'The claim needs about 43.8% a year, every year, for 10 years. At 12% a year the result is about ₹11.5 lakh.')]);
    const ok = await request(app).post('/api/samajh/explain').send(body);
    expect(ok.body.status).toBe('ok');
  });

  it('is public: no sign-up or cookie is needed and no visitor is created', async () => {
    jest.spyOn(aiService, 'providers').mockReturnValue([]);
    const res = await request(app).post('/api/samajh/explain').send(body);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
