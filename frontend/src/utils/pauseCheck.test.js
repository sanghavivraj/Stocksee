import { describe, it, expect } from 'vitest';
import { needsPause } from './pauseCheck';

describe('needsPause', () => {
  it('is true for a move of 10% or more, up or down', () => {
    expect(needsPause(10)).toBe(true);
    expect(needsPause(-12.4)).toBe(true);
    expect(needsPause('14.2')).toBe(true);
  });
  it('is false for smaller moves and for missing data', () => {
    expect(needsPause(9.99)).toBe(false);
    expect(needsPause(0)).toBe(false);
    expect(needsPause(null)).toBe(false);
    expect(needsPause(undefined)).toBe(false);
    expect(needsPause('abc')).toBe(false);
  });
});
