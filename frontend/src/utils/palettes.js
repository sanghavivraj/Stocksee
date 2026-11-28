/** The five accent colours a visitor can choose. Gains are always green and falls always red, whatever is chosen. */
export const PALETTES = [
  { id: 'sky', label: 'Sky blue', dot: '#1d6fd6' },
  { id: 'sun', label: 'Sunshine', dot: '#f2b705' },
  { id: 'rose', label: 'Rose', dot: '#d6336c' },
  { id: 'teal', label: 'Teal', dot: '#0c7c7c' },
  { id: 'mono', label: 'Black and white', dot: '#16181d' },
];
export const DEFAULT_PALETTE = 'sky';
export const isPalette = (id) => PALETTES.some((p) => p.id === id);
/** A saved value is only trusted when it is one of the five (anything else falls back to the default). */
export const safePalette = (id) => (isPalette(id) ? id : DEFAULT_PALETTE);
