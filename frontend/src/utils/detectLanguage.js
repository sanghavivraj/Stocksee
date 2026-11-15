/**
 * First visit: use the language the browser/phone is set to when it is Hindi or Gujarati, otherwise English.
 * Once the person picks a language themselves, that choice always wins.
 */
export function detectLanguage(preferred) {
  const list = Array.isArray(preferred) ? preferred : [];
  for (const tag of list) {
    const base = String(tag || '').toLowerCase().split('-')[0];
    if (base === 'hi' || base === 'gu') return base;
    if (base === 'en') return 'en';
  }
  return 'en';
}

export const browserLanguages = () => (typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]));
