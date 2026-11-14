/**
 * Checks an LLM-written answer BEFORE it reaches the user.
 *
 * 1. Grounding: every number in the answer must come from the market data we gave the model
 *    (small tolerance for rounding). Catches hallucinated prices / percentages.
 * 2. Compliance: no buy/sell/hold calls, targets or guarantees (StockSee is not SEBI-registered).
 * 3. Language: a Hindi/Gujarati request must be answered in that script.
 *
 * If any check fails, the caller falls back to the deterministic template answer.
 */

// Devanagari (०-९) and Gujarati (૦-૯) digits -> ASCII, so "१२३" is checked like "123"
const normalizeDigits = (s) => s
  .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
  .replace(/[૦-૯]/g, (d) => String(d.charCodeAt(0) - 0x0AE6));

/** Every finite number found anywhere in the facts object (and its absolute value). */
function collectFactNumbers(value, out = []) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.push(value, Math.abs(value));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectFactNumbers(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectFactNumbers(v, out));
  } else if (typeof value === 'string') {
    // Dates and labels like "2026-11-13" or "13.8M" contribute their numbers too
    (normalizeDigits(value).match(/\d+(?:\.\d+)?/g) || []).forEach((n) => out.push(Number(n)));
  }
  return out;
}

// Numbers that are safe without being in the data: list numbering, common time spans, "52-week", years
const isHarmlessNumber = (n) => (Number.isInteger(n) && n <= 31) || [52, 100].includes(n) || (Number.isInteger(n) && n >= 1990 && n <= 2100);

function extractNumbers(text) {
  return (normalizeDigits(text).match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map((raw) => Number(raw.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n));
}

function ungroundedNumbers(text, facts) {
  const known = collectFactNumbers(facts);
  const matches = (n) => known.some((k) => Math.abs(n - k) <= Math.max(0.011, Math.abs(k) * 0.0006));
  return extractNumbers(text).filter((n) => !isHarmlessNumber(n) && !matches(n));
}

const ADVICE_PATTERNS = [
  /\b(you|investors?)\s+(should|must|could consider)\s+(buy|sell|hold|accumulate|invest|book)/i,
  /\b(i|we)\s+(would\s+)?(recommend|suggest|advise)\b/i,
  /\b(strong\s+buy|buy\s+now|good\s+time\s+to\s+(buy|sell|invest)|accumulate\s+on\s+dips|book\s+profits?)\b/i,
  /\b(target\s+(price|of)|price\s+target|stop[\s-]?loss\s+(at|of))\b/i,
  /\b(will|is\s+(likely|expected|going)\s+to)\s+(rise|go\s+up|rally|fall|crash|reach|hit)\b/i,
  /\bguarantee/i,
  /खरीद\s*(लें|लो|लीजिए)|खरीदना\s*चाहिए|बेच\s*(दें|दो)|बेचना\s*चाहिए|टार्गेट\s*प्राइस|लक्ष्य\s*मूल्य|स्टॉप\s*लॉस/,
  /ખરીદી\s*લો|ખરીદવું\s*જોઈએ|વેચી\s*દો|વેચવું\s*જોઈએ|ટાર્ગેટ\s*પ્રાઇસ|સ્ટોપ\s*લોસ/,
];

const SCRIPT = { hi: /[ऀ-ॿ]/g, gu: /[઀-૿]/g };

function languageOk(text, lang) {
  if (!SCRIPT[lang]) return true;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const native = (text.match(SCRIPT[lang]) || []).length;
  return letters > 0 && native / letters >= 0.35; // allow English stock names / tickers
}

/**
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function checkAnswer(text, { facts, language = 'en' }) {
  const reasons = [];
  if (!text || text.trim().length < 15) reasons.push('empty_or_too_short');

  const ungrounded = ungroundedNumbers(text || '', facts);
  if (ungrounded.length) reasons.push(`ungrounded_numbers:${ungrounded.slice(0, 5).join(',')}`);

  const advice = ADVICE_PATTERNS.find((re) => re.test(text || ''));
  if (advice) reasons.push('advice_language');

  if (!languageOk(text || '', language)) reasons.push(`wrong_language:${language}`);

  return { ok: reasons.length === 0, reasons };
}

module.exports = { checkAnswer, ungroundedNumbers, normalizeDigits };
