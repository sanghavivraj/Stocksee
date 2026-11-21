/** Helpers for voice: which language tag the browser needs, and text that is fine to read aloud. */
export const SPEECH_LANG = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

export const speechLangFor = (language) => SPEECH_LANG[language] || SPEECH_LANG.en;

/** Removes markdown marks, links and emoji so a voice reads the words, not the symbols. */
export function plainForSpeech(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** A voice that really speaks this language (never the English default pretending to read Hindi). */
export function pickVoice(voices, language) {
  const tag = speechLangFor(language).toLowerCase();
  const base = tag.split('-')[0];
  const list = Array.isArray(voices) ? voices : [];
  return list.find((v) => String(v.lang || '').toLowerCase().replace('_', '-') === tag)
    || list.find((v) => String(v.lang || '').toLowerCase().replace('_', '-').split('-')[0] === base)
    || null;
}
