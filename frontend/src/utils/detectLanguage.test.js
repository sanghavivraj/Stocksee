import { describe, it, expect } from 'vitest';
import { detectLanguage } from './detectLanguage';

describe('detectLanguage', () => {
  it('picks Hindi or Gujarati when that is the first language that matters', () => {
    expect(detectLanguage(['hi-IN', 'en-US'])).toBe('hi');
    expect(detectLanguage(['gu'])).toBe('gu');
    expect(detectLanguage(['GU-IN'])).toBe('gu');
  });
  it('respects the order: an English-first phone stays English', () => {
    expect(detectLanguage(['en-IN', 'hi-IN'])).toBe('en');
  });
  it('skips languages we do not offer and falls back to English', () => {
    expect(detectLanguage(['fr-FR', 'hi-IN'])).toBe('hi');
    expect(detectLanguage(['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });
});
