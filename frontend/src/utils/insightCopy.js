/**
 * Plain-language lines built ONLY from measured facts (see src/services/insightsService.js).
 * They describe what happened and what it coincided with. They never say why for sure, never predict,
 * and never advise. Fixed templates (not AI) in English, Hindi and Gujarati.
 */
import { pick } from './pickLanguage';
const COPY = {
  en: {
    contextLabel: 'In context',
    volume: (v) => `on ${v}× normal volume`,
    nifty: 'NIFTY',
    with_market: 'moved with the market',
    against_market: 'moved against the market',
    on_its_own: 'moved on its own, the market does not explain it',
    day: (up, down, n) => `${up} of your ${n} stocks rose, ${down} fell${n - up - down > 0 ? `, ${n - up - down} unchanged` : ''}.`,
    dayMarket: (v) => `NIFTY ${v}.`,
    dayOwn: (names, many) => `${names} ${many ? 'moved on their own' : 'moved on its own'}, not just with the market.`,
    dayLabel: 'Your day in one line',
  },
  hi: {
    contextLabel: 'संदर्भ',
    volume: (v) => `सामान्य वॉल्यूम का ${v} गुना`,
    nifty: 'निफ्टी',
    with_market: 'बाजार के साथ चला',
    against_market: 'बाजार के उलट चला',
    on_its_own: 'अपने दम पर चला, बाजार से इसे नहीं समझा जा सकता',
    day: (up, down, n) => `आपके ${n} शेयरों में से ${up} बढ़े, ${down} गिरे${n - up - down > 0 ? `, ${n - up - down} स्थिर` : ''}।`,
    dayMarket: (v) => `निफ्टी ${v}।`,
    dayOwn: (names) => `${names} सिर्फ बाजार के साथ नहीं, अपने दम पर चले।`,
    dayLabel: 'आपका दिन एक पंक्ति में',
  },
  gu: {
    contextLabel: 'સંદર્ભ',
    volume: (v) => `સામાન્ય વોલ્યુમ કરતાં ${v} ગણું`,
    nifty: 'નિફ્ટી',
    with_market: 'બજાર સાથે ચાલ્યો',
    against_market: 'બજારની વિરુદ્ધ ચાલ્યો',
    on_its_own: 'પોતાની રીતે ચાલ્યો, બજારથી તે સમજાતું નથી',
    day: (up, down, n) => `તમારા ${n} શેરમાંથી ${up} વધ્યા, ${down} ઘટ્યા${n - up - down > 0 ? `, ${n - up - down} સ્થિર` : ''}.`,
    dayMarket: (v) => `નિફ્ટી ${v}.`,
    dayOwn: (names) => `${names} ફક્ત બજાર સાથે નહીં, પોતાની રીતે ચાલ્યા.`,
    dayLabel: 'તમારો દિવસ એક લીટીમાં',
  },
};

const T = (lang) => pick(COPY, lang);

export const formatMovePercent = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`;
export const shortName = (symbol) => symbol.replace(/\.(NS|BO)$/, '');

/** One factual line under a stock: its move, volume (if high), the market's move, and how they relate. */
export function contextLine(item, lang = 'en') {
  if (!item || item.changePercent === null || item.changePercent === undefined) return '';
  const c = T(lang);
  const parts = [formatMovePercent(item.changePercent) + (item.volumeRatio >= 1.5 ? ` ${c.volume(item.volumeRatio)}` : '')];
  if (item.niftyChangePercent !== null && item.niftyChangePercent !== undefined) {
    parts.push(`${c.nifty} ${formatMovePercent(item.niftyChangePercent)}`);
  }
  if (item.relation && c[item.relation]) parts.push(c[item.relation]);
  return parts.join(' · ');
}

/** One sentence about the whole watchlist's latest session. Empty when there is nothing to say. */
export function daySentence(items, lang = 'en') {
  const rows = (items || []).filter((i) => i && i.changePercent !== null && i.changePercent !== undefined);
  if (!rows.length) return '';
  const c = T(lang);
  const up = rows.filter((i) => i.changePercent > 0).length;
  const down = rows.filter((i) => i.changePercent < 0).length;
  const out = [c.day(up, down, rows.length)];
  const nifty = rows.find((i) => i.niftyChangePercent !== null && i.niftyChangePercent !== undefined);
  if (nifty) out.push(c.dayMarket(formatMovePercent(nifty.niftyChangePercent)));
  const own = rows.filter((i) => i.relation === 'on_its_own').map((i) => shortName(i.symbol));
  if (own.length) out.push(c.dayOwn(own.join(', '), own.length > 1));
  return out.join(' ');
}

export const insightLabels = (lang = 'en') => ({ context: T(lang).contextLabel, day: T(lang).dayLabel });
