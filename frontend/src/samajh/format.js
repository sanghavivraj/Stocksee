/** Number and text formatting for Samajh, with Indian grouping (lakh / crore) and Hindi words. */
const WORDS = {
  en: { lakh: 'lakh', crore: 'crore' },
  hi: { lakh: 'लाख', crore: 'करोड़' },
};
const words = (lang) => WORDS[lang] || WORDS.en;

const trim = (n, digits) => Number(n.toFixed(digits)).toString();

/** 1150193 -> "₹11.5 lakh", 10000000 -> "₹1 crore", 45000 -> "₹45,000" */
export function formatInr(value, lang = 'en') {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  const v = Math.abs(value);
  const w = words(lang);
  if (v >= 1e7) return `${sign}₹${trim(v / 1e7, 2)} ${w.crore}`;
  if (v >= 1e5) return `${sign}₹${trim(v / 1e5, 2)} ${w.lakh}`;
  return `${sign}₹${Math.round(v).toLocaleString('en-IN')}`;
}

/** The exact rupees with Indian grouping: 1150193 -> "₹11,50,193" */
export function formatInrFull(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value < 0 ? '−' : ''}₹${Math.round(Math.abs(value)).toLocaleString('en-IN')}`;
}

export const formatPct = (value, digits = 1) => (Number.isFinite(value) ? `${trim(value, digits)}%` : '—');
export const formatNum = (value) => (Number.isFinite(value) ? Math.round(value).toLocaleString('en-IN') : '—');
export const formatDec = (value, digits = 2) => (Number.isFinite(value) ? trim(value, digits) : '—');

/** A multiple such as 24,834x. Very large values are written as a plain count. */
export const formatTimes = (value) => (Number.isFinite(value) ? `${Math.round(value).toLocaleString('en-IN')}×` : '—');

const FORMATTERS = {
  inr: formatInr,
  inrFull: (v) => formatInrFull(v),
  pct: (v) => formatPct(v, 1),
  pct0: (v) => formatPct(v, 0),
  pct2: (v) => formatPct(v, 2),
  n: (v) => formatNum(v),
  d1: (v) => formatDec(v, 1),
  d2: (v) => formatDec(v, 2),
  x: (v) => formatTimes(v),
};

/** "Years: {{years}}, maturity {{fv|inr}}" -> filled text. Unknown names are marked so a test can catch them. */
export function fill(template, vars, lang = 'en') {
  return String(template ?? '').replace(/\{\{\s*([\w.]+)(?:\|(\w+))?\s*\}\}/g, (_, key, spec) => {
    const value = key.split('.').reduce((o, k) => (o == null ? o : o[k]), vars);
    if (value === undefined || value === null) return `⟦missing:${key}⟧`;
    if (!spec) return String(value);
    const fn = FORMATTERS[spec];
    return fn ? fn(value, lang) : `⟦badformat:${spec}⟧`;
  });
}
