/** Short, localized strings for Telegram job messages. */
const T = {
  en: {
    morning: '☀️ *StockSee morning brief*',
    weekly: '🗓 *StockSee weekly watchlist digest*',
    yourWatchlist: '*Your watchlist* (last session)',
    weekWatchlist: '*Your watchlist* (past week)',
    noBrief: 'Market overview is unavailable right now.',
    unavailable: 'price unavailable',
    alert: {
      PRICE_MOVE: (s, v, a) => `⚡ *${s}* is ${v >= 0 ? 'up' : 'down'} ${Math.abs(v)}% today (your alert: ${a.direction === 'up' ? '+' : '-'}${a.threshold}%).`,
      GAP: (s, v, a) => `⚡ *${s}* opened with a ${Math.abs(v)}% gap ${v >= 0 ? 'up' : 'down'} (your alert: ${a.direction === 'up' ? '+' : '-'}${a.threshold}%).`,
      VOLUME_SPIKE: (s, v) => `⚡ *${s}* is trading at ${v}× its 20-day average volume today.`,
      NEW_52W_HIGH: (s, v) => `⚡ *${s}* broke above its previous 52-week high (${v}).`,
      NEW_52W_LOW: (s, v) => `⚡ *${s}* fell below its previous 52-week low (${v}).`,
    },
    disclaimer: '_StockSee is not a SEBI-registered adviser. Information only, not investment advice._',
  },
  hi: {
    morning: '☀️ *StockSee सुबह का बाज़ार सार*',
    weekly: '🗓 *StockSee साप्ताहिक वॉचलिस्ट सार*',
    yourWatchlist: '*आपकी वॉचलिस्ट* (पिछला सत्र)',
    weekWatchlist: '*आपकी वॉचलिस्ट* (पिछला सप्ताह)',
    noBrief: 'बाज़ार सार अभी उपलब्ध नहीं है।',
    unavailable: 'भाव उपलब्ध नहीं',
    alert: {
      PRICE_MOVE: (s, v, a) => `⚡ *प्राइस अलर्ट: ${s}* आज ${Math.abs(v)}% ${v >= 0 ? 'ऊपर' : 'नीचे'} है (आपका अलर्ट: ${a.direction === 'up' ? '+' : '-'}${a.threshold}%)।`,
      GAP: (s, v) => `⚡ *${s}* आज ${Math.abs(v)}% ${v >= 0 ? 'गैप-अप' : 'गैप-डाउन'} के साथ खुला।`,
      VOLUME_SPIKE: (s, v) => `⚡ *${s}* में आज 20-दिन के औसत से ${v}× वॉल्यूम है।`,
      NEW_52W_HIGH: (s, v) => `⚡ *${s}* ने पिछला 52-सप्ताह का उच्च स्तर (${v}) पार किया।`,
      NEW_52W_LOW: (s, v) => `⚡ *${s}* पिछले 52-सप्ताह के निम्न स्तर (${v}) से नीचे गया।`,
    },
    disclaimer: '_StockSee सेबी-पंजीकृत सलाहकार नहीं है। केवल जानकारी, निवेश सलाह नहीं।_',
  },
  gu: {
    morning: '☀️ *StockSee સવારનો બજાર સાર*',
    weekly: '🗓 *StockSee સાપ્તાહિક વૉચલિસ્ટ સાર*',
    yourWatchlist: '*તમારી વૉચલિસ્ટ* (છેલ્લું સત્ર)',
    weekWatchlist: '*તમારી વૉચલિસ્ટ* (છેલ્લું સપ્તાહ)',
    noBrief: 'બજાર સાર હાલમાં ઉપલબ્ધ નથી.',
    unavailable: 'ભાવ ઉપલબ્ધ નથી',
    alert: {
      PRICE_MOVE: (s, v, a) => `⚡ *પ્રાઇસ અલર્ટ: ${s}* આજે ${Math.abs(v)}% ${v >= 0 ? 'વધ્યો' : 'ઘટ્યો'} છે (તમારું અલર્ટ: ${a.direction === 'up' ? '+' : '-'}${a.threshold}%).`,
      GAP: (s, v) => `⚡ *${s}* આજે ${Math.abs(v)}% ${v >= 0 ? 'ગેપ-અપ' : 'ગેપ-ડાઉન'} સાથે ખૂલ્યો.`,
      VOLUME_SPIKE: (s, v) => `⚡ *${s}* માં આજે 20-દિવસની સરેરાશ કરતાં ${v}× વોલ્યુમ છે.`,
      NEW_52W_HIGH: (s, v) => `⚡ *${s}* એ અગાઉનો 52-સપ્તાહનો ઉચ્ચ સ્તર (${v}) પાર કર્યો.`,
      NEW_52W_LOW: (s, v) => `⚡ *${s}* અગાઉના 52-સપ્તાહના નીચલા સ્તર (${v}) થી નીચે ગયો.`,
    },
    disclaimer: '_StockSee સેબી-રજિસ્ટર્ડ સલાહકાર નથી. માત્ર માહિતી, રોકાણ સલાહ નથી._',
  },
};

const t = (lang) => T[lang] || T.en;

const fmtPct = (v) => (typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—');
const fmtPrice = (v, currency) =>
  typeof v === 'number' ? `${currency === 'USD' ? '$' : '₹'}${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

module.exports = { t, fmtPct, fmtPrice };
