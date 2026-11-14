const askService = require('../src/services/askService');

describe('AskService Unit & Flow Tests', () => {
  it('should process IOC stock query', async () => {
    const res = await askService.askQuestion('What is IOC price today?', 'en');
    expect(res).toBeDefined();
    expect(res.quote).toBeDefined();
    expect(res.quote.symbol).toBe('IOC.NS');
    expect(res.quote.currentPrice).toBeGreaterThan(0);
    expect(res.answer).toContain('Indian Oil Corporation');
  });

  it('should process Jio Financial stock query', async () => {
    const res = await askService.askQuestion('What is Jio Financial price?', 'en');
    expect(res).toBeDefined();
    expect(res.quote).toBeDefined();
    expect(res.quote.symbol).toBe('JIOFIN.NS');
    expect(res.answer).toContain('Jio Financial Services');
  });

  it('should process Hindi localized stock query', async () => {
    const res = await askService.askQuestion('आज IOC का भाव क्या है?', 'hi');
    expect(res).toBeDefined();
    expect(res.quote).toBeDefined();
    expect(res.quote.symbol).toBe('IOC.NS');
  });

  it('declines to advise on buy questions and shows only factual data', async () => {
    const res = await askService.askQuestion('Should I buy Reliance?', 'en');
    expect(res).toBeDefined();
    expect(res.scorecard.type).toBe('PRICE_SNAPSHOT');
    const answer = res.answer.toLowerCase();
    expect(answer).toContain('not a sebi-registered investment adviser');
    expect(answer).not.toMatch(/% buy|strong buy|accumulate|target|research desk/);
  });

  it('does not invent an instrument for small talk', async () => {
    const res = await askService.askQuestion('thanks', 'en');
    expect(res.quote).toBeUndefined();
    expect(res.intent).toBe('UNKNOWN_ENTITY');
  });

  it('should resolve decngold and decangold stock to DECNGOLD.NS in INR instead of commodity Gold', async () => {
    const res1 = await askService.askQuestion('what about decngold', 'en');
    expect(res1).toBeDefined();
    expect(res1.quote.symbol).toBe('DECNGOLD.NS');
    expect(res1.quote.currency).toBe('INR');
    expect(res1.answer).toContain('₹');
    expect(res1.answer).not.toContain('$');
    expect(res1.answer).toContain('Deccan Gold');

    const res2 = await askService.askQuestion('what about the decangold stock', 'en');
    expect(res2).toBeDefined();
    expect(res2.quote.symbol).toBe('DECNGOLD.NS');
    expect(res2.quote.currency).toBe('INR');
    expect(res2.answer).toContain('₹');
    expect(res2.answer).not.toContain('$');

    // Verify commodity gold still resolves correctly when asked directly
    const resGold = await askService.askQuestion('what about gold', 'en');
    expect(resGold).toBeDefined();
    expect(resGold.quote.symbol).toBe('GC=F');
  });
});
