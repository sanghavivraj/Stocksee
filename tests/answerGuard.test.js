const { checkAnswer } = require('../src/ai/answerGuard');

const facts = { instrument: { instrument: 'Reliance Industries', currentPrice: 1339.7, dayChangePercent: -0.61, weekChangePercent: 2, fiftyTwoWeekHigh: 1611.8 } };

describe('AI answer guard', () => {
  it('accepts an answer whose numbers all come from the data (rounding allowed)', () => {
    const text = 'Reliance Industries is at ₹1,339.70, down 0.61% today and up 2% this week. Its 52-week high is ₹1,611.8.';
    expect(checkAnswer(text, { facts })).toEqual({ ok: true, reasons: [] });
  });

  it('rejects hallucinated prices', () => {
    const r = checkAnswer('Reliance is at ₹1,412.30, up 3.4% today.', { facts });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/ungrounded_numbers:1412.3,3.4/);
  });

  it.each([
    'You should buy Reliance now while it is cheap.',
    'I recommend accumulating on dips.',
    'Reliance will rise after the results.',
    'Target price is ₹1,611.8.',
    'Returns are guaranteed for long-term investors.',
    'रिलायंस अभी खरीद लें।',
    'રિલાયન્સ ખરીદી લો.',
  ])('rejects advice: %s', (text) => {
    expect(checkAnswer(text, { facts }).reasons).toContain('advice_language');
  });

  it('checks Devanagari digits too', () => {
    expect(checkAnswer('रिलायंस इंडस्ट्रीज़ का भाव ₹१,३३९.७ है और आज ०.६१% नीचे है।', { facts, language: 'hi' }).ok).toBe(true);
    expect(checkAnswer('रिलायंस इंडस्ट्रीज़ का भाव ₹१,४५०.२ है, आज बढ़त है।', { facts, language: 'hi' }).ok).toBe(false);
  });

  it('rejects answers in the wrong language', () => {
    expect(checkAnswer('Reliance Industries is at 1339.7 today and moved by 0.61%.', { facts, language: 'gu' }).reasons)
      .toContain('wrong_language:gu');
  });
});
