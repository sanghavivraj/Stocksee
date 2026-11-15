import { describe, it, expect } from 'vitest';
import { tr } from './uiStrings';

// Words added in the UX pass: each must read in Hindi and Gujarati, not fall back to English.
const NEW_WORDS = [
  'WATCHLIST', 'YOUR STOCKS', 'stocks', 'Your stocks', 'Popular stocks:', 'Live prices. Tap a stock for its chart.',
  'Compare two stocks', 'Your stocks today', 'TODAY', "Today's market in simple words", 'Read more', 'Show less',
  'Show more', 'Undo', 'Nothing to show yet. Add a stock to see how it did today.',
];

describe('UX pass strings', () => {
  it.each(NEW_WORDS)('"%s" is translated into Hindi and Gujarati', (text) => {
    for (const lang of ['hi', 'gu']) {
      expect(tr(text, lang), `${text} -> ${lang}`).not.toBe(text);
      expect(tr(text, lang).length).toBeGreaterThan(0);
    }
  });
  it('English is returned unchanged', () => {
    expect(tr('Undo', 'en')).toBe('Undo');
  });
});
