const assert = require('assert');

(async () => {
  console.log('=== RUNNING END-TO-END VERIFICATION SUITE ===\n');

  // Helper fetcher
  async function queryAsk(question, language = 'en', conversationHistory = []) {
    const res = await fetch('http://localhost:3000/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, language, conversationHistory })
    });
    if (!res.ok) throw new Error('API returned ' + res.status);
    return await res.json();
  }

  // Test 1: IOC Price
  console.log('Test 1: What is IOC price today?');
  const r1 = await queryAsk('What is IOC price today?');
  assert(r1.quote, 'Expected quote object');
  assert.strictEqual(r1.quote.symbol, 'IOC.NS');
  assert(r1.quote.currentPrice > 0, 'Expected positive price');
  assert(r1.quote.dayHigh >= r1.quote.dayLow, 'High should be >= Low');
  assert(r1.answer.includes('Indian Oil Corporation') || r1.answer.includes('IOC'), 'Answer must mention IOC');
  console.log('✓ Passed: IOC quote returned ₹' + r1.quote.currentPrice + ' (' + r1.quote.dayChangePercent + '%)\n');

  // Test 2: Jio Financial Price (Different Stock)
  console.log('Test 2: What is Jio Financial price?');
  const r2 = await queryAsk('What is Jio Financial price?');
  assert(r2.quote, 'Expected quote object');
  assert.strictEqual(r2.quote.symbol, 'JIOFIN.NS');
  assert(r2.quote.currentPrice !== r1.quote.currentPrice, 'IOC and JIOFIN prices must be different');
  console.log('✓ Passed: JIOFIN quote returned ₹' + r2.quote.currentPrice + ' (' + r2.quote.dayChangePercent + '%)\n');

  // Test 3: Reliance Trend
  console.log('Test 3: What is the trend of Reliance?');
  const r3 = await queryAsk('What is the trend of Reliance?');
  assert(r3.quote, 'Expected quote object');
  assert.strictEqual(r3.quote.symbol, 'RELIANCE.NS');
  assert(r3.quote.weekChangePercent !== undefined, 'Expected weekChangePercent');
  assert(r3.quote.monthChangePercent !== undefined, 'Expected monthChangePercent');
  assert(r3.answer.includes('Trend') || r3.answer.includes('week') || r3.answer.includes('month'), 'Answer must explain trend');
  console.log('✓ Passed: Reliance trend returned 1W: ' + r3.quote.weekChangePercent + '%, 1M: ' + r3.quote.monthChangePercent + '%\n');

  // Test 4: Why NIFTY moving today
  console.log('Test 4: Why is NIFTY moving today?');
  const r4 = await queryAsk('Why is NIFTY moving today?');
  assert(r4.quote, 'Expected quote object');
  assert.strictEqual(r4.quote.symbol, '^NSEI');
  assert(r4.answer.includes('FACT') || r4.answer.includes('CONTEXT'), 'Answer must differentiate fact & context');
  console.log('✓ Passed: NIFTY context returned index value ' + r4.quote.currentPrice + '\n');

  // Test 5: Gold
  console.log('Test 5: What is gold doing today?');
  const r5 = await queryAsk('What is gold doing today?');
  assert(r5.quote, 'Expected quote object');
  assert.strictEqual(r5.quote.symbol, 'GC=F');
  console.log('✓ Passed: Gold quote returned $' + r5.quote.currentPrice + '\n');

  // Test 6: Hindi Localization
  console.log('Test 6: आज IOC का भाव क्या है? (Hindi)');
  const r6 = await queryAsk('आज IOC का भाव क्या है?', 'hi');
  assert(r6.quote, 'Expected quote object');
  assert.strictEqual(r6.quote.symbol, 'IOC.NS');
  assert(r6.answer.includes('उपलब्ध भाव') || r6.answer.includes('आईओसी') || r6.answer.includes('Indian Oil'), 'Answer must be in Hindi');
  console.log('✓ Passed: Hindi response returned: ' + r6.answer.substring(0, 70) + '...\n');

  // Test 7: Gujarati Localization
  console.log('Test 7: આજે IOC નો ભાવ કેટલો છે? (Gujarati)');
  const r7 = await queryAsk('આજે IOC નો ભાવ કેટલો છે?', 'gu');
  assert(r7.quote, 'Expected quote object');
  assert.strictEqual(r7.quote.symbol, 'IOC.NS');
  assert(r7.answer.includes('ઉપલબ્ધ ભાવ') || r7.answer.includes('Indian Oil'), 'Answer must be in Gujarati');
  console.log('✓ Passed: Gujarati response returned: ' + r7.answer.substring(0, 70) + '...\n');

  // Test 8: Should I buy Reliance? (Strict Anti-recommendation safety)
  console.log('Test 8: Should I buy Reliance? (Safety check)');
  const r8 = await queryAsk('Should I buy Reliance?');
  assert(r8.answer.toLowerCase().includes('cannot make') || r8.answer.toLowerCase().includes('educational') || r8.answer.toLowerCase().includes('not registered'), 'Must have educational refusal');
  assert(!r8.answer.toLowerCase().includes('you should buy') && !r8.answer.toLowerCase().includes('i recommend buying'), 'Must NOT have buy recommendations');
  console.log('✓ Passed: Safe educational response without buy recommendations.\n');

  // Test 9: Multi-Turn Conversation Context
  console.log('Test 9: Multi-turn Context (Follow-up query)');
  const history = [
    { role: 'user', text: 'What is TCS price?', symbol: 'TCS.NS', instrument: 'Tata Consultancy Services' },
    { role: 'assistant', text: 'TCS is at 2082', symbol: 'TCS.NS', instrument: 'Tata Consultancy Services' }
  ];
  const r9 = await queryAsk('What about this week?', 'en', history);
  assert(r9.quote, 'Expected quote object in follow-up');
  assert.strictEqual(r9.quote.symbol, 'TCS.NS', 'Follow-up must inherit TCS.NS from conversation history');
  console.log('✓ Passed: Follow up smoothly resolved to ' + r9.quote.instrument + ' (' + r9.quote.symbol + ')\n');

  // Test 10: Comparison (Reliance vs TCS)
  console.log('Test 10: Compare Reliance and TCS');
  const r10 = await queryAsk('Compare Reliance and TCS');
  assert(r10.quotes && r10.quotes.length === 2, 'Expected 2 quote objects for comparison');
  console.log('✓ Passed: Returned ' + r10.quotes.length + ' stocks for comparison (' + r10.quotes.map(q => q.instrument).join(' vs ') + ')\n');

  // Test 11: Market Overview
  console.log('Test 11: What is happening in Indian markets today?');
  const r11 = await queryAsk('What is happening in Indian markets today?');
  assert(r11.quotes && r11.quotes.length >= 4, 'Expected market overview snapshot items');
  console.log('✓ Passed: Market snapshot returned ' + r11.quotes.length + ' instruments.\n');

  console.log('=== ALL 11 END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
})();
