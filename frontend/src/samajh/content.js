import { CARD_IDS } from './cardMath';
import { pick } from '../utils/pickLanguage';

// All teaching content lives in content/samajh/*.json (words), separate from the code that calculates (numbers).
const cardFiles = import.meta.glob('../content/samajh/cards/*.json', { eager: true, import: 'default' });

export const LANGUAGES = ['en', 'hi']; // add 'gu' here (and in the JSON files) to support Gujarati
export const REQUIRED_BLOCKS = ['explain', 'example', 'steps', 'positive', 'negative', 'wrong', 'influencers', 'takeaway'];
export const LEVELS = ['basic', 'medium'];

export { pick };

export const hasLanguage = (lang) => LANGUAGES.includes(lang);

/** The 8 cards, in a fixed teaching order. */
export function loadCards() {
  const byId = Object.fromEntries(Object.values(cardFiles).map((c) => [c.id, c]));
  return CARD_IDS.map((id) => byId[id]).filter(Boolean);
}
