import { describe, it, expect } from 'vitest';
import { wrapLines } from './shareCard';

const measure = (t) => t.length * 10; // 10px per character

describe('wrapLines', () => {
  it('wraps on word boundaries and never cuts a word', () => {
    expect(wrapLines('alpha beta gamma delta', 100, measure)).toEqual(['alpha beta', 'gamma', 'delta']);
  });
  it('keeps a single long word on its own line', () => {
    expect(wrapLines('supercalifragilistic is long', 100, measure)).toEqual(['supercalifragilistic', 'is long']);
  });
  it('handles empty text', () => {
    expect(wrapLines('', 100, measure)).toEqual([]);
    expect(wrapLines(undefined, 100, measure)).toEqual([]);
  });
});
