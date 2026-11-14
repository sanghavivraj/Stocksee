/**
 * Which stock does the user mean? The ONLY ways to get a valid choice:
 *   1. they picked a suggestion, or
 *   2. what they typed EXACTLY equals the symbol/code of a suggestion (case-insensitive, spaces trimmed).
 * Anything else returns null, so raw text such as "C" or "xyz" can never be added.
 */
export function resolveStockChoice({ selected, typed, suggestions }) {
  if (selected && selected.symbol) return selected;
  const text = String(typed || '').trim().toUpperCase();
  if (!text || !Array.isArray(suggestions)) return null;
  return suggestions.find((r) => r.code.toUpperCase() === text || r.symbol.toUpperCase() === text) || null;
}

export const MESSAGES = {
  empty: 'Start typing a company or symbol, then pick a stock from the list.',
  invalid: 'Please select a valid stock from the list.',
};

/** The message to show when the user tries to add without a valid choice. */
export const validationMessage = (typed) => (String(typed || '').trim() ? MESSAGES.invalid : MESSAGES.empty);
