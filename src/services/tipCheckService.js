/**
 * Tip Check: "Someone sent me this stock tip — what should I watch out for?"
 *
 * Combines (1) red-flag language in the forwarded message (en / hi / gu / Hinglish) with
 * (2) real market patterns for the mentioned stock (volume spike, run-up, penny / micro-cap...).
 * Output is a risk LEVEL with plain reasons. It never says a tip is a scam or that a stock is safe,
 * and never recommends buying or selling (StockSee is not a SEBI-registered adviser).
 */
const marketDataService = require('./marketDataService');
const { marketRiskSignals } = require('../analytics/indicators');
const { describeClaims } = require('./claimCheckService');
const surveillanceService = require('./surveillanceService');

// [code, weight, regex] — regexes are deliberately broad; each code counts once.
const PHRASE_RULES = [
  ['guaranteed_returns', 3, /\b(guarantee[ds]?|100\s?%\s?(sure|safe|profit)|sure[\s-]?shot|risk[\s-]?free|no\s+loss|fixed\s+return|pakka|confirm(ed)?\s+profit)\b|गारंटी|पक्का|पक्की|ગેરંટી|પાક્કું|પાક્કો/i],
  ['return_promise', 3, /\b(double|triple)\s+(your\s+)?money\b|\b\d{2,4}\s?%\s+(return|profit|gain|upside)|\b[2-9]\d?\s?x\b|\bmulti[\s-]?bagger\b|मल्टीबैगर|पैसा\s*डबल|ડબલ/i],
  ['insider_claim', 3, /\b(insider|inside\s+(news|info|information)|operator|big\s+players?\s+(are\s+)?(buying|entering)|management\s+(source|contact)|leak(ed)?)\b|अंदर\s*की\s*खबर|ऑपरेटर|ओपरेटर|અંદરની\s*ખબર|ઓપરેટર/i],
  ['urgency', 2, /\b(buy\s+(now|today|immediately|before)|hurry|last\s+chance|limited\s+time|don'?t\s+miss|before\s+(it'?s\s+too\s+late|news|announcement)|jaldi|abhi\s+(lo|kharido))\b|जल्दी|अभी\s*खरीद|તરત|જલ્દી/i],
  ['circuit_hype', 2, /\b(upper\s+circuit|uc\s+lock|circuit\s+(lock|after\s+circuit)|rocket|jackpot|to\s+the\s+moon)\b|अपर\s*सर्किट|जैकपॉट|अपर\s*सरकिट|અપર\s*સર્કિટ|જેકપોટ/i],
  ['short_term_target', 2, /\btarget\b.{0,40}\b(\d+\s*(days?|weeks?|din|hafte))\b|\b(in|within)\s+\d+\s+(days?|weeks?)\b|\bdin\s+mein\b|दिन\s*में|દિવસમાં/i],
  ['paid_group', 2, /\b(vip|premium|paid)\b.{0,25}\b(group|channel|membership|tips?|calls?)\b|\bjoin\b.{0,25}\b(telegram|whatsapp)\b|\b(fees?|subscription)\b.{0,30}\b(tips?|calls?)\b/i],
];

const LEVELS = [
  { level: 'HIGH', min: 7 },
  { level: 'MEDIUM', min: 3 },
  { level: 'LOW', min: 0 },
];

const TEXT = {
  en: {
    guaranteed_returns: 'Promises guaranteed / risk-free profit. No genuine investment can guarantee returns.',
    return_promise: 'Promises a specific big return (e.g. "double", "5x", "200%").',
    insider_claim: 'Claims insider / operator information. Trading on such information is illegal, and such claims are a classic pump-and-dump hook.',
    urgency: 'Pushes you to act immediately — pressure tactics stop you from checking facts.',
    circuit_hype: 'Hype words like "upper circuit", "jackpot", "rocket".',
    short_term_target: 'Gives a price target within a few days/weeks.',
    paid_group: 'Mentions a paid / VIP tips group. Only SEBI-registered advisers may charge for advice.',
    volume_extreme: (v) => `Trading volume on the latest day is ${v}× its 20-day average — extremely unusual.`,
    volume_high: (v) => `Trading volume on the latest day is ${v}× its 20-day average.`,
    runup_extreme: (v) => `Price is up ${v}% in about a month.`,
    runup_high: (v) => `Price is up ${v}% in about a month.`,
    repeated_sharp_rises: (v) => `${v} days with a rise of ~5% or more in the last 10 sessions.`,
    very_volatile: (v) => `Very volatile: typical daily move is about ±${v}%.`,
    penny_stock: (v) => `Low-priced (penny) stock at about ₹${v}.`,
    micro_cap: (v) => `Very small company (market value about ₹${v} crore) — easier to move with little money.`,
    surveillance_asm: (v) => `On NSE's Additional Surveillance Measure (ASM) list${v ? `, stage ${v}` : ''}. The exchange itself is watching this stock closely.`,
    surveillance_gsm: (v) => `On NSE's Graded Surveillance Measure (GSM) list${v ? `, stage ${v}` : ''}. The exchange has put this stock under strict watch.`,
    no_symbol: 'Could not identify a stock in this message, so only the wording was checked.',
    no_data: 'Live market data for this stock is unavailable right now, so only the wording was checked.',
    market_only: 'No message was pasted, so only the stock\'s market data was checked. Paste the tip too for a full check.',
    summary: {
      HIGH: 'Many warning signs commonly seen in pump-and-dump tips.',
      MEDIUM: 'Some warning signs. Be careful and verify independently.',
      LOW: 'No major warning signs found in this check. That does not make it safe or a good investment.',
    },
    guidance: [
      'Never act on unsolicited tips from WhatsApp/Telegram/social media.',
      'Check if the sender is a SEBI-registered investment adviser or research analyst on sebi.gov.in.',
      'Report misleading tips on SEBI SCORES (scores.sebi.gov.in).',
    ],
  },
  hi: {
    guaranteed_returns: 'पक्के / बिना जोखिम मुनाफ़े का वादा। कोई भी असली निवेश रिटर्न की गारंटी नहीं दे सकता।',
    return_promise: 'बड़े तय रिटर्न का वादा (जैसे "डबल", "5x", "200%")।',
    insider_claim: 'अंदर की खबर / ऑपरेटर का दावा। ऐसी जानकारी पर ट्रेड करना गैरकानूनी है और यह पंप-एंड-डंप का आम तरीका है।',
    urgency: 'तुरंत खरीदने का दबाव — ताकि आप तथ्य न जाँच सकें।',
    circuit_hype: '"अपर सर्किट", "जैकपॉट" जैसे हाइप शब्द।',
    short_term_target: 'कुछ ही दिनों/हफ्तों में टार्गेट का दावा।',
    paid_group: 'पेड / VIP टिप्स ग्रुप का ज़िक्र। केवल सेबी-पंजीकृत सलाहकार ही सलाह के पैसे ले सकते हैं।',
    volume_extreme: (v) => `पिछले दिन वॉल्यूम 20-दिन के औसत का ${v}× — बहुत असामान्य।`,
    volume_high: (v) => `पिछले दिन वॉल्यूम 20-दिन के औसत का ${v}×।`,
    runup_extreme: (v) => `लगभग एक महीने में भाव ${v}% बढ़ा।`,
    runup_high: (v) => `लगभग एक महीने में भाव ${v}% बढ़ा।`,
    repeated_sharp_rises: (v) => `पिछले 10 सत्रों में ${v} दिन ~5% या ज़्यादा की तेज़ी।`,
    very_volatile: (v) => `बहुत अस्थिर: आम दैनिक बदलाव लगभग ±${v}%।`,
    penny_stock: (v) => `कम कीमत (पेनी) शेयर, लगभग ₹${v}।`,
    micro_cap: (v) => `बहुत छोटी कंपनी (बाज़ार मूल्य लगभग ₹${v} करोड़) — कम पैसे से भाव हिलाना आसान।`,
    surveillance_asm: (v) => `NSE की अतिरिक्त निगरानी सूची (ASM) में${v ? `, चरण ${v}` : ''}। एक्सचेंज खुद इस शेयर पर कड़ी नज़र रख रहा है।`,
    surveillance_gsm: (v) => `NSE की ग्रेडेड निगरानी सूची (GSM) में${v ? `, चरण ${v}` : ''}। एक्सचेंज ने इस शेयर को सख्त निगरानी में रखा है।`,
    no_symbol: 'इस संदेश में कोई शेयर पहचाना नहीं जा सका, इसलिए केवल शब्दों की जाँच हुई।',
    no_data: 'इस शेयर का लाइव डेटा अभी उपलब्ध नहीं है, इसलिए केवल शब्दों की जाँच हुई।',
    market_only: 'कोई संदेश पेस्ट नहीं किया गया, इसलिए केवल शेयर का बाज़ार डेटा जाँचा गया। पूरी जाँच के लिए टिप भी पेस्ट करें।',
    summary: {
      HIGH: 'पंप-एंड-डंप टिप्स में दिखने वाले कई चेतावनी संकेत।',
      MEDIUM: 'कुछ चेतावनी संकेत। सावधान रहें और खुद जाँचें।',
      LOW: 'इस जाँच में कोई बड़ा चेतावनी संकेत नहीं मिला। इसका मतलब यह सुरक्षित या अच्छा निवेश नहीं है।',
    },
    guidance: [
      'WhatsApp/Telegram/सोशल मीडिया पर बिना मांगे मिली टिप्स पर कभी अमल न करें।',
      'sebi.gov.in पर जाँचें कि भेजने वाला सेबी-पंजीकृत सलाहकार/रिसर्च एनालिस्ट है या नहीं।',
      'भ्रामक टिप्स की शिकायत SEBI SCORES (scores.sebi.gov.in) पर करें।',
    ],
  },
  gu: {
    guaranteed_returns: 'પાક્કા / જોખમ વગરના નફાનું વચન. કોઈ સાચું રોકાણ વળતરની ગેરંટી આપી શકે નહીં.',
    return_promise: 'મોટા નિશ્ચિત વળતરનું વચન (જેમ કે "ડબલ", "5x", "200%").',
    insider_claim: 'અંદરની ખબર / ઓપરેટરનો દાવો. આવી માહિતી પર ટ્રેડ કરવું ગેરકાયદેસર છે અને તે પંપ-એન્ડ-ડમ્પની સામાન્ય રીત છે.',
    urgency: 'તરત ખરીદવાનું દબાણ — જેથી તમે હકીકત ચકાસી ન શકો.',
    circuit_hype: '"અપર સર્કિટ", "જેકપોટ" જેવા હાઇપ શબ્દો.',
    short_term_target: 'થોડા દિવસો/અઠવાડિયામાં ટાર્ગેટનો દાવો.',
    paid_group: 'પેઇડ / VIP ટિપ્સ ગ્રુપનો ઉલ્લેખ. માત્ર સેબી-રજિસ્ટર્ડ સલાહકાર જ સલાહના પૈસા લઈ શકે.',
    volume_extreme: (v) => `છેલ્લા દિવસે વોલ્યુમ 20-દિવસની સરેરાશ કરતાં ${v}× — ખૂબ અસામાન્ય.`,
    volume_high: (v) => `છેલ્લા દિવસે વોલ્યુમ 20-દિવસની સરેરાશ કરતાં ${v}×.`,
    runup_extreme: (v) => `લગભગ એક મહિનામાં ભાવ ${v}% વધ્યો.`,
    runup_high: (v) => `લગભગ એક મહિનામાં ભાવ ${v}% વધ્યો.`,
    repeated_sharp_rises: (v) => `છેલ્લા 10 સત્રોમાં ${v} દિવસ ~5% કે વધુ વધારો.`,
    very_volatile: (v) => `ખૂબ અસ્થિર: સામાન્ય દૈનિક ફેરફાર આશરે ±${v}%.`,
    penny_stock: (v) => `ઓછી કિંમતનો (પેની) શેર, આશરે ₹${v}.`,
    micro_cap: (v) => `ખૂબ નાની કંપની (બજાર મૂલ્ય આશરે ₹${v} કરોડ) — ઓછા પૈસાથી ભાવ હલાવવો સરળ.`,
    surveillance_asm: (v) => `NSE ની વધારાની દેખરેખ યાદી (ASM) માં${v ? `, તબક્કો ${v}` : ''}. એક્સચેન્જ પોતે આ શેર પર ચાંપતી નજર રાખે છે.`,
    surveillance_gsm: (v) => `NSE ની ગ્રેડેડ દેખરેખ યાદી (GSM) માં${v ? `, તબક્કો ${v}` : ''}. એક્સચેન્જે આ શેરને કડક દેખરેખ હેઠળ મૂક્યો છે.`,
    no_symbol: 'આ સંદેશમાં કોઈ શેર ઓળખાયો નથી, તેથી માત્ર શબ્દોની ચકાસણી થઈ.',
    no_data: 'આ શેરનો લાઇવ ડેટા હાલમાં ઉપલબ્ધ નથી, તેથી માત્ર શબ્દોની ચકાસણી થઈ.',
    market_only: 'કોઈ સંદેશ પેસ્ટ કર્યો નથી, તેથી માત્ર શેરનો બજાર ડેટા ચકાસાયો. સંપૂર્ણ ચકાસણી માટે ટિપ પણ પેસ્ટ કરો.',
    summary: {
      HIGH: 'પંપ-એન્ડ-ડમ્પ ટિપ્સમાં દેખાતા ઘણા ચેતવણી સંકેતો.',
      MEDIUM: 'કેટલાક ચેતવણી સંકેતો. સાવચેત રહો અને જાતે ચકાસો.',
      LOW: 'આ ચકાસણીમાં કોઈ મોટો ચેતવણી સંકેત મળ્યો નથી. તેનો અર્થ એ નથી કે તે સુરક્ષિત કે સારું રોકાણ છે.',
    },
    guidance: [
      'WhatsApp/Telegram/સોશિયલ મીડિયા પર વગર માંગ્યે મળેલી ટિપ્સ પર ક્યારેય અમલ ન કરો.',
      'sebi.gov.in પર ચકાસો કે મોકલનાર સેબી-રજિસ્ટર્ડ સલાહકાર/રિસર્ચ એનાલિસ્ટ છે કે નહીં.',
      'ભ્રામક ટિપ્સની ફરિયાદ SEBI SCORES (scores.sebi.gov.in) પર કરો.',
    ],
  },
};

/** Red-flag phrases found in the message. */
function phraseSignals(text) {
  return PHRASE_RULES
    .filter(([, , re]) => re.test(text))
    .map(([code, weight]) => ({ code, weight, kind: 'message' }));
}

/** How many red-flag phrase groups appear (used by the chat to route forwarded tips here). */
const countRedFlags = (text) => phraseSignals(text).length;

class TipCheckService {
  /**
   * @param {{ text: string, symbol?: string, language?: 'en'|'hi'|'gu' }} input
   * @param {{ extractEntity?: (text:string) => Promise<string|null> }} deps  injected for tests
   */
  async check({ text = '', symbol, language = 'en' }, deps = {}) {
    const lang = TEXT[language] ? language : 'en';
    const T = TEXT[lang];
    const hasMessage = text.trim().length >= 3;
    const signals = hasMessage ? phraseSignals(text) : [];
    const notes = [];

    let resolved = symbol || null; // a symbol the user typed explicitly is trusted
    if (!resolved && hasMessage) {
      const extractEntity = deps.extractEntity || ((q) => require('./askService').extractEntity(q, []));
      const found = await extractEntity(text).catch(() => null);
      // Free text: only accept instruments the dictionary / exchange search confirms
      const confirmed = found
        ? await marketDataService.resolveInstrument(found, { allowGuess: false }).catch(() => null)
        : null;
      resolved = confirmed?.symbol || null;
    }

    let instrument = null;
    let claimCandles = null;
    let surveillance = null;
    if (!hasMessage) notes.push(T.market_only);
    if (!resolved) {
      notes.push(T.no_symbol);
    } else {
      try {
        const [history, quote] = await Promise.all([
          marketDataService.getHistory(resolved, '6mo'),
          marketDataService.getMarketData(resolved).catch(() => null),
        ]);
        instrument = {
          symbol: history.symbol,
          name: history.name || quote?.name || history.symbol,
          price: quote?.price ?? history.candles.at(-1)?.close ?? null,
          currency: history.currency,
          asOf: history.candles.at(-1)?.time || null,
          source: history.source,
        };
        for (const s of marketRiskSignals(history.candles, { marketCap: quote?.marketCap ?? null, price: instrument.price })) {
          signals.push({ ...s, kind: 'market' });
        }
        // NSE's own surveillance lists (only when a list has been loaded; always reported with its date)
        surveillance = surveillanceService.check(history.symbol);
        if (surveillance.listed) {
          signals.push({ code: surveillance.list === 'GSM' ? 'surveillance_gsm' : 'surveillance_asm', weight: surveillance.list === 'GSM' ? 4 : 3, value: surveillance.stage, kind: 'market' });
        }
        // Numbers promised in the message are compared with up to 5 years of this stock's own history
        if (hasMessage) claimCandles = await marketDataService.getHistory(resolved, '5y').then((h) => h.candles).catch(() => null);
      } catch (err) {
        if (!hasMessage) {
          // Nothing else to check: tell the user plainly instead of returning an empty "Low risk"
          const e = new Error(`No market data found for ${symbol}. Please check the symbol.`);
          e.status = err.status === 404 ? 404 : 503;
          throw e;
        }
        notes.push(T.no_data);
      }
    }

    const claims = hasMessage
      ? describeClaims(text, { candles: claimCandles, price: instrument?.price ?? null, language: lang })
      : [];

    const score = signals.reduce((sum, s) => sum + s.weight, 0);
    const { level } = LEVELS.find((l) => score >= l.min);

    return {
      level,
      score,
      summary: T.summary[level],
      instrument,
      reasons: signals
        .sort((a, b) => b.weight - a.weight)
        .map((s) => ({
          code: s.code,
          kind: s.kind,
          weight: s.weight,
          value: s.value ?? null,
          text: typeof T[s.code] === 'function' ? T[s.code](s.value) : T[s.code],
        })),
      claims,
      surveillance,
      notes,
      guidance: T.guidance,
      disclaimer: 'StockSee is not a SEBI-registered investment adviser. This is an automated risk check, not advice to buy or sell.',
    };
  }
}

module.exports = new TipCheckService();
module.exports.countRedFlags = countRedFlags;
module.exports.phraseSignals = phraseSignals;
