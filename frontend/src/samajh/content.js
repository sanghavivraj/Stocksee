import { CARD_IDS } from './cardMath';

// All teaching content lives in content/samajh/*.json (words), separate from the code that calculates (numbers).
const cardFiles = import.meta.glob('../content/samajh/cards/*.json', { eager: true, import: 'default' });

export const LANGUAGES = ['en', 'hi']; // add 'gu' here (and in the JSON files) to support Gujarati
export const REQUIRED_BLOCKS = ['explain', 'example', 'steps', 'positive', 'negative', 'wrong', 'influencers', 'takeaway'];
export const LEVELS = ['basic', 'medium'];

/** The text for the chosen language, or English when that language is not written yet. */
export const pick = (field, lang) => {
  if (field == null) return field;
  if (typeof field !== 'object' || Array.isArray(field)) return field;
  return field[lang] ?? field.en;
};

export const hasLanguage = (lang) => LANGUAGES.includes(lang);

/** The 8 cards, in a fixed teaching order. */
export function loadCards() {
  const byId = Object.fromEntries(Object.values(cardFiles).map((c) => [c.id, c]));
  return CARD_IDS.map((id) => byId[id]).filter(Boolean);
}
