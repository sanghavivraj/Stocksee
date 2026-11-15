/**
 * Hype Check, step 1: read a pasted claim and decide what kind of claim it is. Plain pattern matching, no AI,
 * so it works offline and always gives the same answer for the same text.
 * Works for English, Hindi and Hinglish. Anything we cannot recognise becomes "unverifiable", never a guess.
 */

export const MAX_LENGTH = 500;
export const MIN_LENGTH = 8;

export const TIP_REFUSAL = {
  en: 'We do not predict direction. Nobody can do it reliably, and calling it would be a tip.',
  hi: 'हम दिशा की भविष्यवाणी नहीं करते। इसे कोई भरोसे से नहीं कर सकता, और बताना टिप देना होगा।',
};

const norm = (s) => String(s || '').toLowerCase().replace(/(\d),(?=\d)/g, '$1').replace(/\s+/g, ' ').trim();

/** Asking for a recommendation or a prediction ("which stock should I buy", "will X go up?"). We refuse these. */
const TIP_REQUEST = [
  /\b(which|what)\s+(stocks?|shares?|funds?|crypto|coins?)\b.{0,40}\b(buy|invest|pick|best|good)\b/,
  /\bshould\s+i\s+(buy|sell|hold|invest|book)\b/,
  /\b(buy|sell|hold)\s+or\s+(buy|sell|hold)\b/,
  /\b(give|tell|suggest|recommend|share)\s+(me\s+)?(a\s+|an\s+|some\s+|any\s+)?(good\s+)?(stocks?|shares?|tips?|calls?|funds?|targets?)\b/,
  /\b(price\s+target|target\s+price)\b.*\?/,
  /\bwill\s+.{1,50}\s+(go\s+up|go\s+down|rise|fall|crash|rally|increase|drop|double)\b.*\?/,
  /\b(tomorrow|next\s+week|next\s+month)\b.*\b(go\s+up|go\s+down|rise|fall|crash|rally)\b/,
  /(कौन\s*सा|कौनसा|kaun\s*sa)\s*(स्टॉक|शेयर|stock|share|fund|फंड)/,
  /(खरीदूं|खरीदूँ|खरीदूं\?|बेचूं|बेचूँ|खरीदना\s*चाहिए|बेचना\s*चाहिए|kharidu|kharidun|bechu)/,
];
export const isTipRequest = (text) => TIP_REQUEST.some((re) => re.test(norm(text)));

/** Is the text worth analysing at all? */
export function validateInput(text) {
  const t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length > MAX_LENGTH) return { ok: false, reason: 'too_long' };
  if (t.length < MIN_LENGTH) return { ok: false, reason: 'too_short' };
  if (!/[\p{L}\p{N}]/u.test(t)) return { ok: false, reason: 'no_meaning' };
  return { ok: true };
}

// ---------------------------------------------------------------- reading numbers, amounts and time

const UNIT_VALUE = { crore: 1e7, cr: 1e7, 'करोड़': 1e7, 'करोड': 1e7, lakh: 1e5, lac: 1e5, lakhs: 1e5, 'लाख': 1e5, k: 1e3, thousand: 1e3, 'हज़ार': 1e3, 'हजार': 1e3 };
const TIME_UNIT = [
  [/^(d|दि)/, 1], // day, days, din, दिन
  [/^(w|h|हफ)/, 7], // week, hafte, हफ्ते
  [/^(m|मह)/, 30], // month, mahine, महीने
  [/^(y|s|सा|व)/, 365], // year, saal, साल, वर्ष
];
const TIME_RE = /(\d+(?:\.\d+)?)\s*(days?|din|दिन|weeks?|hafte?|हफ्ते?|हफ़्ते?|months?|mahine?|महीने?|years?|yrs?|saal|साल|वर्ष)(?![\p{L}\p{M}])/gu;

function findTimes(text) {
  const out = [];
  for (const m of text.matchAll(TIME_RE)) {
    const n = Number(m[1]);
    const unit = TIME_UNIT.find(([re]) => re.test(m[2]));
    out.push({ n, unit: m[2], days: n * (unit ? unit[1] : 1), start: m.index, end: m.index + m[0].length, isYears: unit && unit[1] === 365 });
  }
  return out;
}

function findAmounts(text, times) {
  const out = [];
  const re = /(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(crore|cr|करोड़|करोड|lakhs?|lac|लाख|k|thousand|हज़ार|हजार)?(?![\p{L}\d])/gu;
  for (const m of text.matchAll(re)) {
    const start = m.index;
    const end = start + m[0].length;
    if (times.some((t) => start >= t.start && start < t.end)) continue; // that number is a duration
    const after = text.slice(end, end + 4);
    if (/^\s*(x\b|×|%|गुना|times)/.test(after) || /^\s?x/.test(after)) continue; // a multiple or a percentage
    const unit = m[2];
    out.push({ value: Number(m[1]) * (unit ? UNIT_VALUE[unit] || 1 : 1), hasUnit: Boolean(unit && UNIT_VALUE[unit] >= 1e5), raw: m[0], start, end });
  }
  return out;
}

function findMultiple(text) {
  const nums = [];
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:x\b|×|times\b|गुना)/g)) nums.push(Number(m[1]));
  if (/\b(double|doubled|doubling|2x)\b|दोगुना|दुगना|डबल/.test(text)) nums.push(2);
  if (/\b(triple|tripled)\b|तिगुना|ट्रिपल/.test(text)) nums.push(3);
  const valid = nums.filter((n) => n >= 1.2 && n <= 10000);
  return valid.length ? Math.max(...valid) : null;
}

function findPercent(text) {
  const m = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:%|percent|प्रतिशत)/g)].map((x) => Number(x[1]));
  return m.length ? Math.max(...m) : null;
}

const RE = {
  sip: /\bsip\b|systematic investment|एसआईपी|सिप\b/,
  swp: /\bswp\b|systematic withdrawal|एसडब्ल्यूपी|स्वप\b/,
  fd: /\bfds?\b|fixed deposit|एफडी|फिक्स्ड डिपॉजिट/,
  deadWords: /(dead|useless|waste|worthless|outdated|loot|looting|scam|bekar|बेकार|मरा|बर्बाद|लूट)/,
  marketWords: /(stocks?|shares?|equity|equities|market|mutual\s*funds?|crypto|शेयर|स्टॉक|म्यूचुअल)/,
  guaranteed: /(guarantee[ds]?|assured|sure[\s-]?shot|fixed\s+return|pakka|पक्का|गारंटी|निश्चित)/,
  monthWord: /(per\s+month|a\s+month|every\s+month|each\s+month|monthly|\/month|हर\s*महीने|प्रति\s*माह|महीना)/,
  returnWord: /(return|profit|gain|earn|income|मुनाफ|रिटर्न|कमाई|कमाओ|कमा)/,
};

/**
 * Work out what the claim says.
 * @returns {{ kind: string, ...params }} kind is one of:
 *  sip-target | sip-return | multiple-in-time | pct-in-time | guaranteed-return | multiple-no-time | fd-vs-stocks | swp-income | unverifiable
 */
export function parseClaim(rawText) {
  const text = norm(rawText);
  const times = findTimes(text);
  const amounts = findAmounts(text, times);
  const multiple = findMultiple(text);
  const percent = findPercent(text);
  const years = times.find((t) => t.isYears);
  const anyTime = times[0];
  const hasSip = RE.sip.test(text);

  if (RE.swp.test(text)) {
    const big = amounts.filter((a) => a.hasUnit).sort((a, b) => b.value - a.value)[0];
    const small = amounts.filter((a) => !a.hasUnit && a.value >= 1000).sort((a, b) => a.value - b.value)[0];
    return { kind: 'swp-income', corpus: big?.value ?? null, withdraw: small?.value ?? null, years: years ? years.n : null };
  }

  if (RE.fd.test(text) && RE.deadWords.test(text) && RE.marketWords.test(text)) return { kind: 'fd-vs-stocks' };

  if (hasSip && amounts.length >= 1) {
    const sorted = [...amounts].sort((a, b) => a.value - b.value);
    const monthly = sorted.find((a) => a.value >= 100 && !a.hasUnit) || sorted[0];
    const target = [...amounts].sort((a, b) => b.value - a.value).find((a) => a !== monthly && a.value > monthly.value * 12);
    const yearsN = years ? years.n : anyTime && anyTime.days >= 30 ? anyTime.days / 365 : null;
    if (target && monthly) return { kind: 'sip-target', monthly: monthly.value, target: target.value, years: yearsN, yearsAssumed: yearsN === null };
    if (percent && yearsN) return { kind: 'sip-return', monthly: monthly.value, claimedRate: percent, years: yearsN };
  }

  if (multiple && anyTime) return { kind: 'multiple-in-time', multiple, days: anyTime.days };
  if (RE.guaranteed.test(text) && percent) return { kind: 'guaranteed-return', rate: percent, per: RE.monthWord.test(text) ? 'month' : /(year|yearly|annual|saal|साल|सालाना|वर्ष)/.test(text) ? 'year' : 'unspecified' };
  if (percent && anyTime && RE.returnWord.test(text)) return { kind: 'pct-in-time', multiple: 1 + percent / 100, days: anyTime.days, percent };
  if (multiple) return { kind: 'multiple-no-time', multiple };
  return { kind: 'unverifiable' };
}

// ---------------------------------------------------------------- red flags

const RED_FLAGS = [
  ['guaranteed', /(guarantee[ds]?|assured|sure[\s-]?shot|risk[\s-]?free|no\s+risk|100\s?%\s*(sure|safe|profit|guaranteed)|pakka|पक्का|गारंटी|जोखिम\s*मुक्त|बिना\s*जोखिम|निश्चित\s*रिटर्न)/],
  ['urgency', /(limited\s+(time|seats|slots|offer)|hurry|last\s+chance|only\s+today|today\s+only|before\s+(it'?s\s+)?too\s+late|join\s+now|act\s+now|don'?t\s+miss|जल्दी|आज\s*ही|आखिरी\s*मौका|सीमित\s*समय)/],
  ['screenshot', /(screenshots?|profit\s*(pic|photo|proof)|proof\s+of\s+profit|my\s+(students|followers|clients|subscribers)\s+(made|earned|got)|see\s+my\s+profit|स्क्रीनशॉट|सबूत)/],
  ['secret', /(secret|insider|inside\s+(info|information|news|tip)|operator|leaked?|big\s+players?|bankers?\s+don'?t|nobody\s+tells|they\s+don'?t\s+want\s+you|hidden\s+truth|राज़|सीक्रेट|अंदर\s*की\s*खबर|ऑपरेटर|कोई\s*नहीं\s*बताता)/],
  ['misleading_comparison', /(fds?\s+(is|are)\s+(dead|useless|a\s+waste|outdated)|banks?\s+(are\s+)?(looting|cheating|robbing)|savings?\s+(account\s+)?(is|are)\s+(useless|a\s+scam)|only\s+(stocks?|shares?|crypto|equity|mutual\s*funds?)\s+(make|give|create|build)|एफडी\s*(बेकार|मरी)|fd\s*बेकार|सिर्फ\s*(शेयर|स्टॉक|क्रिप्टो))/],
  ['manipulation', /(don'?t\s+be\s+poor|stay\s+poor|ignore\s+(the\s+)?(haters|doubters)|wake\s+up|everyone\s+is\s+(getting\s+)?rich|missing\s+out|fomo|most\s+people\s+don'?t\s+know|rich\s+people\s+(know|do)|गरीब\s*मत|जाग\s*जाओ|सब\s*अमीर)/],
  ['paid_group', /(dm\s+me|whatsapp\s+(group|me|number)|telegram\s+(group|channel)|paid\s+(course|group|tips?|membership)|join\s+my|link\s+in\s+(bio|description)|signal\s+(group|service)|कोर्स\s*खरीद|ग्रुप\s*जॉइन)/],
  ['quick_riches', /(double\s+(your\s+)?money|overnight|get\s+rich|quick\s+money|easy\s+money|fast\s+money|\b\d+\s*x\s+in\s+\d+|\d+\s*(days?|din|दिन)\s+(me|में)|रातों\s*रात|पैसा\s*दोगुना|जल्दी\s*अमीर)/],
];

/** The warning signs found in the wording (not in the maths). */
export function detectRedFlags(rawText) {
  const text = norm(rawText);
  return RED_FLAGS.filter(([, re]) => re.test(text)).map(([code]) => code);
}

export const RED_FLAG_CODES = RED_FLAGS.map(([code]) => code);
