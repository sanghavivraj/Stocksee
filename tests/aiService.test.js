jest.mock('axios', () => ({ post: jest.fn() }));
const axios = require('axios');

process.env.GEMINI_API_KEY = 'test-gemini';
process.env.GROQ_API_KEY = 'test-groq';
const aiService = require('../src/services/aiService');

const marketData = {
  instrument: 'Infosys', symbol: 'INFY.NS', currency: 'INR', currentPrice: 1141.5,
  dayChange: -9.7, dayChangePercent: -0.84, weekChangePercent: 1.2, monthChangePercent: 3.4, dayHigh: 1150, dayLow: 1135,
};
const gemini = (text) => ({ data: { candidates: [{ content: { parts: [{ text }] } }] } });
const groq = (text) => ({ data: { choices: [{ message: { content: text } }] } });

beforeEach(() => axios.post.mockReset());

describe('AI answer pipeline', () => {
  it('uses Gemini when its answer is grounded, with the key in a header (not the URL)', async () => {
    axios.post.mockResolvedValueOnce(gemini('Infosys is at ₹1,141.5, down 0.84% today, and up 1.2% this week.'));
    const res = await aiService.generate({ question: 'How is Infosys doing?', intent: 'PRICE_QUOTE', marketData });

    expect(res).toMatchObject({ source: 'gemini', verified: true });
    const [url, body, opts] = axios.post.mock.calls[0];
    expect(url).not.toContain('key=');
    expect(opts.headers['x-goog-api-key']).toBe('test-gemini');
    expect(body.systemInstruction.parts[0].text).toMatch(/not a SEBI-registered adviser/);
    expect(body.contents[0].parts[0].text).toMatch(/<user_question>\nHow is Infosys doing\?\n<\/user_question>/);
  });

  it('falls back to Groq when Gemini hallucinates a number', async () => {
    axios.post
      .mockResolvedValueOnce(gemini('Infosys is at ₹1,180, up 2.5% today.'))
      .mockResolvedValueOnce(groq('Infosys trades at ₹1,141.5, down 0.84% today.'));
    const res = await aiService.generate({ question: 'Infosys?', intent: 'PRICE_QUOTE', marketData });
    expect(res.source).toBe('groq');
    expect(res.rejected[0]).toMatchObject({ provider: 'gemini' });
  });

  it('falls back to the template when every LLM gives advice or fails', async () => {
    axios.post
      .mockResolvedValueOnce(gemini('You should buy Infosys at ₹1,141.5.'))
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    const res = await aiService.generate({ question: 'Should I buy Infosys?', intent: 'PRICE_QUOTE', marketData });
    expect(res.source).toBe('template');
    expect(res.answer).toContain('Infosys (INFY.NS)');
    expect(res.rejected.map((r) => r.provider)).toEqual(['gemini', 'groq']);
  });

  it('sends recent conversation for follow-up questions', async () => {
    axios.post.mockResolvedValueOnce(gemini('This week Infosys moved 1.2%.'));
    await aiService.generate({
      question: 'And this week?', intent: 'TREND_ANALYSIS', marketData,
      history: [{ role: 'user', text: 'Infosys price?' }, { role: 'assistant', text: 'Infosys is at ₹1,141.5' }],
    });
    expect(axios.post.mock.calls[0][1].contents[0].parts[0].text).toMatch(/<conversation>[\s\S]*User: Infosys price\?/);
  });

  it('never calls an LLM when there is no real data to ground the answer', async () => {
    const res = await aiService.generate({ question: 'hello', intent: 'UNKNOWN_ENTITY' });
    expect(axios.post).not.toHaveBeenCalled();
    expect(res.source).toBe('template');
  });
});
