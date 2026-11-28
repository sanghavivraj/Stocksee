import { pick } from '../samajh/content';

/**
 * The timing of a Money Card story, kept apart from the player so it can be tested on its own.
 * The yellow line is a video-style bar: it starts at 0 and follows the clock. Each part of the story has an expected length
 * (estimates), and the real lengths replace them as the story plays, so the bar never jumps.
 */

/** How long each part is expected to take: the opening, every scene, then the ending (which has no length). */
export function storyEstimates(scenes, frame, lang, inputs) {
  return [
    3000 + pick(frame.open, lang).length * 45,
    ...scenes.map((sc) => {
      if (sc.type === 'beat') return sc.dur + 900;
      if (sc.type === 'run') return 2600 + (typeof sc.ticks === 'function' ? sc.ticks(inputs) : sc.ticks) * (sc.manual ? 1700 : sc.tickMs || 600) + 4200;
      if (sc.type === 'lab') return 17600;
      if (sc.type === 'buy') return 20000;
      return 9000; // the real-fund scene
    }),
    0,
  ];
}

/**
 * Where the yellow line is, from 0 to 1.
 * step: the current part. el: milliseconds spent in it. acts: the real lengths of parts already played.
 */
export function progressFraction({ step, el, ests, acts = {} }) {
  const last = ests.length - 1;
  const before = ests.slice(0, step).reduce((a, b, i) => a + (acts[i] ?? b), 0);
  const rest = ests.slice(step + 1).reduce((a, b) => a + b, 0);
  const curExp = Math.max(ests[step] || 0, el * 1.02);
  const total = before + curExp + rest || 1;
  return { frac: step >= last ? 1 : Math.min(1, (before + el) / total), total };
}

/** The part of the story at a click position on the bar (0 to 1 along it). */
export function stepAtFraction(ests, x) {
  const total = ests.reduce((a, b) => a + b, 0) || 1; const target = Math.min(Math.max(x, 0), 1) * total;
  let acc = 0; let to = 0;
  for (let i = 0; i < ests.length; i += 1) { to = i; if (acc + (ests[i] || 0) > target) break; acc += ests[i] || 0; }
  return to;
}

/**
 * What is actually drawn. The line never moves backwards, and when the real story runs faster or slower than the estimate it
 * catches up in small steps (at most `maxStep` per tick) instead of jumping.
 */
export const CATCH_UP_STEP = 0.004;
export function smoothFraction(shown, target, maxStep = CATCH_UP_STEP) {
  if (target <= shown) return shown;
  return Math.min(target, shown + maxStep);
}
