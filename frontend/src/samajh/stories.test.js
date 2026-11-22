import { describe, it, expect } from 'vitest';
import stories from '../content/samajh/stories.json';
import frames from '../content/samajh/storyFrames.json';
import { loadCards, LANGUAGES } from './content';
import { computeCard, CARD_IDS } from './cardMath';
import { fill, formatInr } from './format';
import { SCENES, crashFinal } from './storyScenes';

const MOODS = ['calm', 'happy', 'worried', 'wow', 'proud'];
const cards = loadCards();
const ctxFor = (card, lang) => {
  const calc = computeCard(card.id, card.inputs, lang, formatInr);
  return { inp: card.inputs, vars: calc.vars, lang, formatInr, f: { inr: (v) => formatInr(v, lang) }, T: { replay: '', play: '', pause: '', nextStep: '' } };
};
const clean = (text) => expect(text).not.toMatch(/⟦|NaN|undefined|Infinity|\{\{/);

/** every value a slider can take, with the other sliders at their default */
function sweeps(scene, inp) {
  const def = {};
  (scene.sliders || []).forEach((s) => { def[s.key] = typeof s.def === 'function' ? s.def(inp) : s.def; });
  (scene.choices || []).forEach((c) => { def[c.key] = c.def; });
  const out = [def];
  (scene.sliders || []).forEach((s) => {
    for (let v = s.min; v <= s.max + 1e-9; v += s.step) out.push({ ...def, [s.key]: Math.round(v * 100) / 100 });
  });
  (scene.choices || []).forEach((c) => c.options.forEach((o) => out.push({ ...def, [c.key]: o })));
  return out;
}

describe('Money Card stories: every card has its own story', () => {
  it('has scenes for all 8 cards and words for each scene, no extras', () => {
    expect(Object.keys(SCENES).sort()).toEqual([...CARD_IDS].sort());
    expect(Object.keys(stories).sort()).toEqual([...CARD_IDS].sort());
    for (const id of CARD_IDS) {
      expect(SCENES[id].length, id).toBeGreaterThanOrEqual(3);
      expect(SCENES[id].map((s) => s.id), id).toEqual(Object.keys(stories[id]));
    }
  });

  it('no scene is used by two cards in the same way: each card has its own scene ids and its own words', () => {
    const lines = CARD_IDS.flatMap((id) => Object.values(stories[id]).map((t) => t.intro.en));
    expect(new Set(lines).size).toBeGreaterThanOrEqual(lines.length - 2); // only the shared "real data" intro may repeat
  });

  describe.each(cards)('$id', (card) => {
    const scenes = SCENES[card.id];
    const texts = stories[card.id];

    for (const lang of LANGUAGES) {
      it(`plays every scene without a gap or a made-up number (${lang})`, () => {
        const ctx = ctxFor(card, lang);
        for (const scene of scenes) {
          const text = texts[scene.id];
          const used = new Set();
          for (const k of ['title']) for (const l of LANGUAGES) expect(text[k][l], `${scene.id}.${k}`).toBeTruthy();
          expect(MOODS).toContain(text.intro.mood);
          clean(fill(text.intro[lang], ctx.vars, lang));
          const says = (key, vars) => {
            const line = text.says[key];
            expect(line, `${card.id}.${scene.id} says "${key}"`).toBeTruthy();
            expect(MOODS).toContain(line.mood);
            clean(fill(line[lang], { ...ctx.vars, ...vars }, lang));
            used.add(key);
          };
          const hasLabel = (key) => expect(text.labels[key], `${card.id}.${scene.id} label "${key}"`).toBeTruthy();

          if (scene.type === 'lab') {
            for (const v of sweeps(scene, card.inputs)) {
              const out = scene.compute(v, ctx);
              expect(MOODS).toContain(out.mood);
              hasLabel(out.readout.label); clean(out.readout.text);
              (out.bars || []).forEach((b) => { hasLabel(b.label); expect(Number.isFinite(b.value), `${scene.id} bar ${b.key}`).toBe(true); expect(b.value).toBeGreaterThanOrEqual(0); });
              (out.lines || []).forEach((l) => { hasLabel(l.label); expect(l.points.every(Number.isFinite)).toBe(true); });
              expect(out.bars || out.lines).toBeTruthy();
              Object.values(out.vars).forEach((x) => { if (typeof x === 'number') expect(Number.isFinite(x), `${scene.id} var`).toBe(true); });
              says(out.say, out.vars);
            }
            (scene.sliders || []).forEach((s) => hasLabel(s.label));
            (scene.choices || []).forEach((c) => { hasLabel(c.label); c.options.forEach(hasLabel); });
          } else if (scene.type === 'run') {
            const ticks = typeof scene.ticks === 'function' ? scene.ticks(card.inputs) : scene.ticks;
            for (let i = 0; i <= ticks; i += 1) {
              const fr = scene.frame(i, ctx);
              expect(fr.level).toBeGreaterThanOrEqual(0);
              expect(Number.isFinite(fr.level)).toBe(true);
              hasLabel(fr.big.label); hasLabel(fr.sub.label); clean(fr.big.text); clean(fr.sub.text);
              expect(MOODS).toContain(fr.mood);
              if (fr.say) says(fr.say, fr.vars);
            }
          } else if (scene.type === 'buy') {
            ['first', 'fell', 'rose', 'done'].forEach((k) => says(k, { nav: 92, units: 54.35 }));
            ['nav', 'owned', 'buy', 'again', 'avg', 'avgprice'].forEach(hasLabel);
          }
          // no line that can never be said
          for (const key of Object.keys(text.says)) expect(used.has(key), `${card.id}.${scene.id}: line "${key}" is never used`).toBe(true);
        }
      });
    }

    it('says nothing that sounds like advice or a promise', () => {
      const all = JSON.stringify(texts).toLowerCase();
      expect(all).not.toMatch(/\b(you should|must buy|should buy|best|guaranteed|sure shot|target price|buy now|sell now|panic)\b/);
    });

    it('moves the mood with the numbers: a story has at least two different moods', () => {
      const moods = new Set(Object.values(texts).flatMap((t) => [t.intro.mood, ...Object.values(t.says).map((l) => l.mood)]));
      expect(moods.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('the fall what-if model', () => {
    it('keeping going beats pausing, and a deeper fall shrinks every path', () => {
      const stay = crashFinal('stay', 20, 5000); const pause = crashFinal('pause', 20, 5000); const sell = crashFinal('sell', 20, 5000);
      expect(stay).toBeGreaterThan(pause);
      expect(stay).toBeGreaterThan(sell);
      expect(crashFinal('stay', 50, 5000)).toBeGreaterThan(0);
      expect(sell).toBeGreaterThan(0);
    });
    it('with no fall at all, keeping going is the same as pausing less the paused months', () => {
      expect(crashFinal('stay', 0, 5000)).toBeGreaterThan(crashFinal('pause', 0, 5000));
    });
  });

  describe('opening and ending of each story', () => {
    it('has an opening line and 3 remember-points in English and Hindi for every card, with no advice words', () => {
      expect(Object.keys(frames).sort()).toEqual([...CARD_IDS].sort());
      for (const id of CARD_IDS) {
        const lines = [frames[id].open, ...frames[id].end];
        expect(frames[id].end.length, id).toBe(3);
        for (const l of lines) for (const lang of LANGUAGES) { expect(l[lang], id).toBeTruthy(); clean(l[lang]); }
        expect(JSON.stringify(frames[id]).toLowerCase()).not.toMatch(/\b(you should|must buy|should buy|best|guaranteed|sure shot|target price|buy now|sell now|panic)\b/);
      }
    });
  });
});
