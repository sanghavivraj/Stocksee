/**
 * Claim checker: pulls the numbers out of a tip ("double in 7 days", "target 500", "200% return") and puts
 * them next to what this stock has really done over the last years. It states facts about the past, it never
 * says a claim is true or false and never predicts. "In 1,200 windows it did that 0 times" lets people judge.
 */
const { round } = require('../lib/num');
const SESSIONS = { day: 1, week: 5, month: 21 };
const DEFAULT_HORIZON = SESSIONS.month;
const MIN_WINDOWS = 30;

/** Words that show the message is about money or markets. "5x faster" or "double glazing" is not a promised return. */
const MARKET_CONTEXT = /\b(stocks?|shares?|invest\w*|returns?|profit|gains?|money|paisa|paise|sip|nifty|sensex|market|targets?|trad(e|es|ing)|bagger|upside|rupees?|rs|lakh|crore|capital|portfolio|operator|circuit|buy|sell|pakka|guarantee[ds]?|jackpot|tips?|calls?)\b|\b(in|within)\s+\d+\s+(days?|weeks?|months?|years?)\b|\b(din|hafte|mahine)\s+(mein|me)\b|दिन\s*में|દિવસમાં|₹|शेयर|निवेश|पैसा|मुनाफ|पक्का|गारंटी|खरीद|સેર|શેર|રોકાણ|ખરીદ|નફો|પૈસા|પાક્કું|ગેરંટી/i;
const hasMarketContext = (text) => MARKET_CONTEXT.test(String(text || ''));

const toNumber = (s) => Number(String(s).replace(/,/g, ''));

/** Calendar days are about 5/7 trading sessions; weeks are 5; months about 21. */
function toSessions(n, unit) {
  const u = unit.toLowerCase();
  if (/^(d|दि|દિ)/.test(u)) return Math.max(1, Math.round((n * 5) / 7));
  if (/^(w|h|हफ|हफ़|અઠ)/.test(u)) return n * SESSIONS.week;
  return n * SESSIONS.month; // months / mahine / महीने / મહિના
}

/** The time the tip talks about, in trading sessions (or about a month when it says nothing). */
function extractHorizon(text) {
  const m = text.match(/(\d{1,3})\s*(days?|din|दिन|દિવસ|weeks?|hafte?|हफ्ते?|हफ़्ते?|અઠવાડિયા?|months?|mahine?|महीने?|મહિના?)/i);
  if (!m) return { horizonSessions: DEFAULT_HORIZON, assumedHorizon: true };
  return { horizonSessions: Math.max(1, Math.min(252, toSessions(toNumber(m[1]), m[2]))), assumedHorizon: false };
}

/** Numbers promised in the message. At most one claim of each kind (the biggest). */
function extractClaims(text, { marketContext = false } = {}) {
  const t = String(text || '');
  const money = marketContext || hasMarketContext(t);
  if (t.trim().length < 3) return [];
  const { horizonSessions, assumedHorizon } = extractHorizon(t);
  const claims = [];

  const multiples = [];
  if (money) { // "5x faster" or "double glazing" are not promised returns
    for (const m of t.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s?x\b/gi)) multiples.push(toNumber(m[1]));
    for (const m of t.matchAll(/(\d{1,3}(?:\.\d+)?)\s*(?:times|गुना|ગણું|ગણા)/gi)) multiples.push(toNumber(m[1]));
    if (/\b(double|doubled|doubling)\b|डबल|ડબલ/i.test(t)) multiples.push(2);
    if (/\btriple\b|ट्रिपल|ટ્રિપલ/i.test(t)) multiples.push(3);
  }
  const multiple = Math.max(0, ...multiples.filter((n) => n >= 1.5 && n <= 100));
  if (multiple) claims.push({ kind: 'multiple', multiple, requiredPercent: round((multiple - 1) * 100, 1), horizonSessions, assumedHorizon });

  const percents = [...t.matchAll(/(\d{2,4}(?:\.\d+)?)\s?%\s*(?:return|returns|profit|gain|upside|रिटर्न|मुनाफा|मुनाफ़ा|નફો|રિટર્ન|વળતર)/gi)].map((m) => toNumber(m[1]));
  const percent = Math.max(0, ...percents.filter((n) => n >= 20 && n <= 10000));
  if (percent) claims.push({ kind: 'percent', requiredPercent: percent, horizonSessions, assumedHorizon });

  const targets = [...t.matchAll(/target[^\d₹]{0,15}(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)/gi)].map((m) => toNumber(m[1]))
    .concat([...t.matchAll(/(?:reach|touch|cross|go\s+to)\s+(?:₹|rs\.?)\s*(\d[\d,]*(?:\.\d+)?)/gi)].map((m) => toNumber(m[1])));
  const target = Math.max(0, ...targets.filter((n) => n > 0));
  if (target) claims.push({ kind: 'target', targetPrice: target, horizonSessions, assumedHorizon });

  return claims;
}

/** For every start day: the best close within the next h sessions, as a % gain. */
function bestGainWindows(candles, h) {
  const gains = [];
  for (let i = 0; i + h < candles.length; i += 1) {
    let best = -Infinity;
    for (let j = i + 1; j <= i + h; j += 1) best = Math.max(best, (candles[j].close / candles[i].close - 1) * 100);
    gains.push(best);
  }
  return gains;
}

/** Put one claim next to the stock's own history. Returns null when there is not enough history. */
function checkClaim(claim, candles, price) {
  let required = claim.requiredPercent ?? null;
  if (claim.kind === 'target') {
    if (!price || !(claim.targetPrice > price)) return null;
    required = round((claim.targetPrice / price - 1) * 100, 1);
  }
  if (required === null) return null;
  const gains = bestGainWindows(candles, claim.horizonSessions);
  if (gains.length < MIN_WINDOWS) return null;
  const achieved = gains.filter((g) => g >= required).length;
  return {
    kind: claim.kind,
    multiple: claim.multiple ?? null,
    targetPrice: claim.targetPrice ?? null,
    currentPrice: claim.kind === 'target' ? round(price, 2) : null,
    requiredPercent: round(required, 1),
    horizonSessions: claim.horizonSessions,
    assumedHorizon: claim.assumedHorizon,
    cases: gains.length,
    achieved,
    achievedPercent: round((achieved / gains.length) * 100, 1),
    bestGainPercent: round(Math.max(...gains), 1),
    years: round(candles.length / 252, 1),
  };
}

const TEXT = {
  en: {
    label: (c) => (c.kind === 'multiple' ? `${c.multiple}× (about +${c.requiredPercent}%)`
      : c.kind === 'target' ? `target ₹${c.targetPrice} (+${c.requiredPercent}% from ₹${c.currentPrice})`
        : `+${c.requiredPercent}% return`),
    text: (c, label) => `The message claims ${label} within ${c.horizonSessions === 1 ? 'a day' : `${c.horizonSessions} trading days`}${c.assumedHorizon ? ' (no time was given, so about a month is assumed)' : ''}. In the last ${c.years} years, this stock rose that much within that time in ${c.achieved} of ${c.cases} windows (${c.achievedPercent}%). Its best was +${c.bestGainPercent}%. Past data only: it does not show what will happen.`,
    benchText: (c, label) => `The message claims ${label} within ${c.horizonSessions === 1 ? 'a day' : `${c.horizonSessions} trading days`}${c.assumedHorizon ? ' (no time was given, so about a month is assumed)' : ''}. No stock was named, so here is the NIFTY 50 index for comparison: in the last ${c.years} years it rose that much within that time in ${c.achieved} of ${c.cases} windows (${c.achievedPercent}%). Its best was +${c.bestGainPercent}%. Past data only: it does not show what will happen.`,
    noData: 'The message makes a numeric claim, but there is not enough price history to compare it with.',
    noStock: 'The message makes a numeric claim, but no stock was identified to compare it with.',
  },
  hi: {
    label: (c) => (c.kind === 'multiple' ? `${c.multiple}× (लगभग +${c.requiredPercent}%)`
      : c.kind === 'target' ? `टार्गेट ₹${c.targetPrice} (₹${c.currentPrice} से +${c.requiredPercent}%)`
        : `+${c.requiredPercent}% रिटर्न`),
    text: (c, label) => `संदेश ${c.horizonSessions === 1 ? 'एक दिन' : `${c.horizonSessions} कारोबारी दिनों`} में ${label} का दावा करता है${c.assumedHorizon ? ' (समय नहीं बताया, इसलिए लगभग एक महीना माना गया)' : ''}। पिछले ${c.years} वर्षों में इस शेयर ने उस समय में इतना बढ़त ${c.cases} में से ${c.achieved} अवधियों (${c.achievedPercent}%) में हासिल की। इसकी सबसे अच्छी बढ़त +${c.bestGainPercent}% रही। यह सिर्फ पुराना डेटा है, आगे क्या होगा यह नहीं बताता।`,
    benchText: (c, label) => `संदेश ${c.horizonSessions === 1 ? 'एक दिन' : `${c.horizonSessions} कारोबारी दिनों`} में ${label} का दावा करता है${c.assumedHorizon ? ' (समय नहीं बताया, इसलिए लगभग एक महीना माना गया)' : ''}। कोई शेयर नहीं बताया गया, इसलिए तुलना के लिए NIFTY 50 इंडेक्स देखें: पिछले ${c.years} वर्षों में उसने उस समय में इतनी बढ़त ${c.cases} में से ${c.achieved} अवधियों (${c.achievedPercent}%) में हासिल की। उसकी सबसे अच्छी बढ़त +${c.bestGainPercent}% रही। यह सिर्फ पुराना डेटा है, आगे क्या होगा यह नहीं बताता।`,
    noData: 'संदेश में संख्या वाला दावा है, लेकिन तुलना के लिए पर्याप्त भाव-इतिहास नहीं है।',
    noStock: 'संदेश में संख्या वाला दावा है, लेकिन तुलना के लिए कोई शेयर पहचाना नहीं गया।',
  },
  gu: {
    label: (c) => (c.kind === 'multiple' ? `${c.multiple}× (લગભગ +${c.requiredPercent}%)`
      : c.kind === 'target' ? `ટાર્ગેટ ₹${c.targetPrice} (₹${c.currentPrice} થી +${c.requiredPercent}%)`
        : `+${c.requiredPercent}% રિટર્ન`),
    text: (c, label) => `સંદેશ ${c.horizonSessions === 1 ? 'એક દિવસ' : `${c.horizonSessions} ટ્રેડિંગ દિવસ`}માં ${label} નો દાવો કરે છે${c.assumedHorizon ? ' (સમય આપ્યો નથી, તેથી લગભગ એક મહિનો ગણ્યો)' : ''}. છેલ્લા ${c.years} વર્ષમાં આ શેરે તે સમયમાં આટલો વધારો ${c.cases} માંથી ${c.achieved} સમયગાળામાં (${c.achievedPercent}%) મેળવ્યો. તેનો શ્રેષ્ઠ વધારો +${c.bestGainPercent}% રહ્યો. આ ફક્ત ભૂતકાળનો ડેટા છે, આગળ શું થશે તે બતાવતો નથી.`,
    benchText: (c, label) => `સંદેશ ${c.horizonSessions === 1 ? 'એક દિવસ' : `${c.horizonSessions} ટ્રેડિંગ દિવસ`}માં ${label} નો દાવો કરે છે${c.assumedHorizon ? ' (સમય આપ્યો નથી, તેથી લગભગ એક મહિનો ગણ્યો)' : ''}. કોઈ શેર જણાવ્યો નથી, તેથી સરખામણી માટે NIFTY 50 ઇન્ડેક્સ જુઓ: છેલ્લા ${c.years} વર્ષમાં તેણે તે સમયમાં આટલો વધારો ${c.cases} માંથી ${c.achieved} સમયગાળામાં (${c.achievedPercent}%) મેળવ્યો. તેનો શ્રેષ્ઠ વધારો +${c.bestGainPercent}% રહ્યો. આ ફક્ત ભૂતકાળનો ડેટા છે, આગળ શું થશે તે બતાવતો નથી.`,
    noData: 'સંદેશમાં સંખ્યાનો દાવો છે, પણ સરખામણી માટે પૂરતો ભાવ-ઇતિહાસ નથી.',
    noStock: 'સંદેશમાં સંખ્યાનો દાવો છે, પણ સરખામણી માટે કોઈ શેર ઓળખાયો નથી.',
  },
};

/** Claims in the message, checked against price history when a stock is known. Localised, ready to show. */
function describeClaims(text, { candles = null, price = null, language = 'en', benchmark = false, marketContext = false } = {}) {
  const T = TEXT[language] || TEXT.en;
  const claims = extractClaims(text, { marketContext });
  const out = [];
  for (const claim of claims) {
    if (!candles) { out.push({ kind: claim.kind, checked: false, text: T.noStock }); continue; }
    const checked = checkClaim(claim, candles, price);
    if (!checked) { out.push({ kind: claim.kind, checked: false, text: T.noData }); continue; }
    const label = T.label(checked);
    out.push({ ...checked, checked: true, benchmark, label, text: benchmark ? T.benchText(checked, label) : T.text(checked, label) });
  }
  return out;
}

module.exports = { hasMarketContext, extractClaims, TEXT, extractHorizon, checkClaim, describeClaims, bestGainWindows };
