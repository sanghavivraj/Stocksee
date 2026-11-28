import { describe, it, expect } from 'vitest';
import { storyEstimates, progressFraction, stepAtFraction, smoothFraction, CATCH_UP_STEP } from './timing';
import { SCENES } from '../samajh/storyScenes';
import { loadCards } from '../samajh/content';
import { SWP_BEATS } from './swpStory';
import frames from '../content/samajh/storyFrames.json';

const cards = loadCards();
const scenesOf = (id) => (id === 'swp' ? SWP_BEATS : SCENES[id]);

describe('story estimates', () => {
  it.each(cards.map((c) => c.id))('%s: opening + every scene + ending, all lengths sensible', (id) => {
    const card = cards.find((c) => c.id === id);
    const ests = storyEstimates(scenesOf(id), frames[id], 'en', card.inputs);
    expect(ests).toHaveLength(scenesOf(id).length + 2);
    expect(ests[0]).toBeGreaterThan(3000);
    expect(ests[ests.length - 1]).toBe(0);
    ests.slice(0, -1).forEach((e) => { expect(Number.isFinite(e)).toBe(true); expect(e).toBeGreaterThan(1000); });
  });
  it('Hindi gives longer opening times than the words are long (it never returns NaN)', () => {
    const card = cards.find((c) => c.id === 'sip');
    expect(storyEstimates(scenesOf('sip'), frames.sip, 'hi', card.inputs).every(Number.isFinite)).toBe(true);
  });
});

describe('the yellow line', () => {
  const ests = [6000, 10000, 20000, 15000, 0];

  it('starts at exactly 0', () => {
    expect(progressFraction({ step: 0, el: 0, ests }).frac).toBe(0);
  });
  it('is 1 on the ending, and never above 1', () => {
    expect(progressFraction({ step: 4, el: 0, ests }).frac).toBe(1);
    expect(progressFraction({ step: 1, el: 9e9, ests }).frac).toBeLessThanOrEqual(1);
  });
  it('grows with time inside a part', () => {
    let prev = -1;
    for (let el = 0; el <= 6000; el += 500) { const { frac } = progressFraction({ step: 0, el, ests }); expect(frac).toBeGreaterThan(prev); prev = frac; }
  });
  it('does not stall when a part takes longer than expected', () => {
    const a = progressFraction({ step: 1, el: 10000, ests }).frac;
    const b = progressFraction({ step: 1, el: 14000, ests }).frac;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
  });

  // The whole story, played in 50 ms ticks, with every part running up to 40% faster or slower than expected,
  // drawn the way the player draws it. The line must only move forward and never jump (the old bar jumped by 20%).
  it.each([0.5, 0.6, 0.8, 1, 1.2, 1.4, 1.8])('a whole story at %sx the expected length is drawn forward, in small steps', (speed) => {
    const real = ests.map((e) => e * speed);
    const acts = {}; let shown = 0; let maxStepSeen = 0; let step = 0; let el = 0; let ticks = 0;
    while (step < ests.length - 1) {
      el += 50; ticks += 1;
      const { frac: target } = progressFraction({ step, el, ests, acts });
      const next = smoothFraction(shown, target);
      expect(next).toBeGreaterThanOrEqual(shown);
      maxStepSeen = Math.max(maxStepSeen, next - shown); shown = next;
      if (el >= real[step]) { if (el > 0.6 * ests[step]) acts[step] = el; step += 1; el = 0; }
      expect(ticks).toBeLessThan(50000);
    }
    expect(maxStepSeen).toBeLessThanOrEqual(CATCH_UP_STEP + 1e-12);
    expect(progressFraction({ step, el: 0, ests, acts }).frac).toBe(1);
  });
  it('catching up never overshoots and never goes backwards', () => {
    expect(smoothFraction(0.3, 0.9)).toBeCloseTo(0.3 + CATCH_UP_STEP, 12);
    expect(smoothFraction(0.3, 0.3001)).toBeCloseTo(0.3001, 12);
    expect(smoothFraction(0.5, 0.2)).toBe(0.5);
    expect(smoothFraction(0, 0)).toBe(0);
  });
  it('a line that is far behind its target arrives in a few seconds, not instantly', () => {
    let shown = 0.1; let ticks = 0;
    while (shown < 0.26 - 1e-9) { shown = smoothFraction(shown, 0.26); ticks += 1; }
    expect(ticks * 50).toBeGreaterThan(1500); expect(ticks * 50).toBeLessThan(4000);
  });

  it('clicking the bar picks the part under the click', () => {
    expect(stepAtFraction(ests, 0)).toBe(0);
    expect(stepAtFraction(ests, 0.05)).toBe(0);
    expect(stepAtFraction(ests, 0.2)).toBe(1);
    expect(stepAtFraction(ests, 0.999)).toBe(3);
    expect(stepAtFraction(ests, -3)).toBe(0);
    expect(stepAtFraction(ests, 99)).toBeLessThanOrEqual(ests.length - 1);
  });
});
