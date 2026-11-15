/**
 * The text for the chosen language, or English when that language is not written yet.
 * Works on any object keyed by language: pick({ en: 'Hello', hi: 'नमस्ते' }, 'hi'),
 * or a whole copy table: pick(COPY, language).
 */
export const pick = (field, lang) => {
  if (field == null) return field;
  if (typeof field !== 'object' || Array.isArray(field)) return field;
  return field[lang] ?? field.en;
};
