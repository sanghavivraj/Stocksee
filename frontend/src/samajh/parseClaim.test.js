import { describe, it, expect } from 'vitest';
import { parseClaim, detectRedFlags, isTipRequest, validateInput, MAX_LENGTH } from './parseClaim';

describe('the five preset claims are recognised', () => {
  it('₹5,000 SIP = ₹1 crore in 10 years', () => {
    expect(parseClaim('₹5,000 SIP = ₹1 crore in 10 years.')).toMatchObject({ kind: 'sip-target', monthly: 5000, target: 1e7, years: 10 });
  });
  it('Double your money in 25 days', () => {
    expect(parseClaim('Double your money in 25 days.')).toMatchObject({ kind: 'multiple-in-time', multiple: 2, days: 25 });
  });
  it('FD is dead, only stocks make money', () => {
    expect(parseClaim('FD is dead, only stocks make money.').kind).toBe('fd-vs-stocks');
  });
  it('SWP = guaranteed monthly salary', () => {
    expect(parseClaim('SWP = guaranteed monthly salary.').kind).toBe('swp-income');
  });
  it('This stock will 10x', () => {
    expect(parseClaim('This stock will 10x.')).toMatchObject({ kind: 'multiple-no-time', multiple: 10 });
  });
});

describe('Hindi and Hinglish versions work too', () => {
  it.each([
    ['₹5,000 की SIP = 10 साल में ₹1 करोड़।', 'sip-target'],
    ['25 दिन में पैसा दोगुना करें', 'multiple-in-time'],
    ['FD बेकार है, सिर्फ शेयर से पैसा बनता है।', 'fd-vs-stocks'],
    ['SWP = गारंटीशुदा मासिक सैलरी', 'swp-income'],
    ['यह शेयर 10 गुना होगा', 'multiple-no-time'],
    ['5000 ki sip se 10 saal mein 1 crore', 'sip-target'],
  ])('%s -> %s', (text, kind) => expect(parseClaim(text).kind).toBe(kind));
});

describe('other claim shapes', () => {
  it('reads amounts written as lakh, k and with commas', () => {
    expect(parseClaim('Invest 10k monthly in SIP and get 50 lakh in 8 years')).toMatchObject({ kind: 'sip-target', monthly: 10000, target: 5e6, years: 8 });
    expect(parseClaim('₹1,00,000 SIP become ₹5 crore in 15 years')).toMatchObject({ monthly: 100000, target: 5e7 });
  });
  it('a monthly guaranteed return', () => {
    expect(parseClaim('Guaranteed 10% return every month!')).toMatchObject({ kind: 'guaranteed-return', rate: 10, per: 'month' });
  });
  it('a percentage gain in a short time', () => {
    expect(parseClaim('Earn 30% profit in 15 days')).toMatchObject({ kind: 'pct-in-time', days: 15, percent: 30 });
  });
  it('multiples over years and months are converted to days', () => {
    expect(parseClaim('10x in 2 years')).toMatchObject({ kind: 'multiple-in-time', days: 730 });
    expect(parseClaim('triple your money in 3 months')).toMatchObject({ multiple: 3, days: 90 });
  });
  it('a SIP with a claimed return but no target', () => {
    expect(parseClaim('SIP of 5000 for 10 years gives 15% returns')).toMatchObject({ kind: 'sip-return', claimedRate: 15, years: 10 });
  });
  it('anything else is unverifiable, never guessed', () => {
    expect(parseClaim('This is the best opportunity of your life').kind).toBe('unverifiable');
    expect(parseClaim('Markets are interesting today').kind).toBe('unverifiable');
  });
});

describe('red flags in the wording', () => {
  it('finds guarantees, urgency, secrets, screenshots, paid groups, comparisons and quick riches', () => {
    const flags = detectRedFlags('Guaranteed 100% sure profit! Join now, limited seats. Insider tip. DM me. See my profit screenshot. FD is dead. Double your money overnight. Don\'t be poor');
    expect(flags).toEqual(expect.arrayContaining(['guaranteed', 'urgency', 'secret', 'paid_group', 'screenshot', 'misleading_comparison', 'quick_riches', 'manipulation']));
  });
  it('a plain neutral sentence has none', () => {
    expect(detectRedFlags('A SIP invests a fixed amount every month')).toEqual([]);
  });
  it('detects Hindi flags', () => {
    expect(detectRedFlags('गारंटी के साथ पक्का मुनाफा, जल्दी करें')).toEqual(expect.arrayContaining(['guaranteed', 'urgency']));
  });
});

describe('tip and prediction requests are refused, claims are analysed', () => {
  it.each([
    'Which stock should I buy today?',
    'Should I buy Reliance now',
    'Will Nifty go up tomorrow?',
    'give me a stock tip',
    'what is the target price of TCS?',
    'कौन सा शेयर खरीदूं',
    'buy or sell Tata Motors',
  ])('refuses: %s', (text) => expect(isTipRequest(text)).toBe(true));

  it.each([
    'This stock will 10x.',
    '₹5,000 SIP = ₹1 crore in 10 years.',
    'Double your money in 25 days.',
    'FD is dead, only stocks make money.',
  ])('does not refuse a claim to check: %s', (text) => expect(isTipRequest(text)).toBe(false));
});

describe('input validation', () => {
  it('flags empty, short, long and meaningless input', () => {
    expect(validateInput('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateInput('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateInput('hi')).toEqual({ ok: false, reason: 'too_short' });
    expect(validateInput('a'.repeat(MAX_LENGTH + 1))).toEqual({ ok: false, reason: 'too_long' });
    expect(validateInput('!!!!!!!!!!!!')).toEqual({ ok: false, reason: 'no_meaning' });
    expect(validateInput('SIP 5000 10 years').ok).toBe(true);
  });
});
