import { describe, it, expect } from 'vitest';
import { plainForSpeech, pickVoice, speechLangFor } from './speech';

describe('speech helpers', () => {
  it('maps the app languages to browser language tags', () => {
    expect(speechLangFor('hi')).toBe('hi-IN');
    expect(speechLangFor('gu')).toBe('gu-IN');
    expect(speechLangFor('en')).toBe('en-IN');
    expect(speechLangFor('xx')).toBe('en-IN');
  });
  it('strips markdown, links and emoji before reading aloud', () => {
    expect(plainForSpeech('**TCS** is at ₹3,900 🚀\n- up 2%\n[source](https://x.y)')).toBe('TCS is at ₹3,900. up 2%. source');
  });
  it('only returns a voice that speaks the language', () => {
    const voices = [{ lang: 'en-US', name: 'A' }, { lang: 'hi_IN', name: 'B' }];
    expect(pickVoice(voices, 'hi').name).toBe('B');
    expect(pickVoice(voices, 'gu')).toBeNull();
    expect(pickVoice(voices, 'en').name).toBe('A');
    expect(pickVoice([], 'en')).toBeNull();
  });
});
