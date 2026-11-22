/**
 * Soft background music for the Money Card stories, made live with the Web Audio API (no audio files).
 * Off by default; a person turns it on with one tap. Styles:
 *   calm   - a warm chord progression: soft arpeggio, bell, bass and pad
 *   lively - the same chords, quicker, with a light drum pulse
 * The mood of the story follows the character: happy, proud and amazed are faster and an octave brighter; worried turns
 * soft and minor, slower and quieter (gentle, never scary), and lifts back up as soon as the mood improves.
 */
export const STYLES = ['off', 'calm', 'lively'];

// Chords as semitones above the root, one per bar. Major progressions feel warm and hopeful; the minor one is soft, never harsh.
const PROG = { major: [0, 7, 9, 5], minor: [9, 5, 0, 7] };
const TRIAD = { major: [0, 4, 7], minor: [0, 3, 7] };
const ROOT = 196; // G3
const BEAT = { calm: 0.5, lively: 0.3 };
// which chord tone the arpeggio plays on each of 8 steps (index into [root, third, fifth, octave, ...]); -1 = rest
const PATTERN = { calm: [0, 2, 1, 2, 3, 2, 1, 2], lively: [0, 1, 2, 3, 2, 3, 4, 3] };
// how the story's mood changes the music: tempo (smaller = faster), brightness (octave shift) and loudness
const MOOD = {
  calm: { mode: 'major', tempo: 1, up: 0, vol: 1 },
  happy: { mode: 'major', tempo: 0.85, up: 12, vol: 1.1 },
  proud: { mode: 'major', tempo: 0.9, up: 12, vol: 1.15 },
  wow: { mode: 'major', tempo: 0.8, up: 12, vol: 1.15 },
  worried: { mode: 'minor', tempo: 1.3, up: 0, vol: 0.85 },
};

const hz = (root, semis) => root * Math.pow(2, semis / 12);

export function createStoryAudio(AudioCtor = (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : undefined)) {
  let ctx = null; let master = null; let timer = null;
  let style = 'off'; let mood = 'calm'; let nextTime = 0; let step = 0;

  const ensure = () => {
    if (ctx || !AudioCtor) return !!ctx;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return true;
  };

  const pluck = (freq, t, len, vol, type = 'triangle') => {
    const o = ctx.createOscillator(); const g = ctx.createGain(); const lp = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o.stop(t + len + 0.05);
  };

  const drum = (t, vol) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.2);
  };

  const moodNow = () => MOOD[mood] || MOOD.calm;
  const beatLen = () => BEAT[style] * moodNow().tempo;

  const scheduleBeat = (t) => {
    const m = moodNow(); const beat = beatLen();
    const bar = Math.floor(step / 8) % 4; const inBar = step % 8;
    const chordRoot = ROOT * Math.pow(2, PROG[m.mode][bar] / 12);
    const tones = [...TRIAD[m.mode], 12, 16 - (m.mode === 'minor' ? 1 : 0)];
    const idx = PATTERN[style][inBar];
    const v = m.vol * (style === 'lively' ? 0.13 : 0.11);
    // the tune: a chord-tone arpeggio, one octave up when the mood is bright
    pluck(hz(chordRoot, tones[idx % tones.length] + 12 + m.up), t, beat * 2.4, v);
    // a gentle bell on the first step of each bar
    if (inBar === 0) {
      pluck(hz(chordRoot, tones[2] + 24 + m.up), t, beat * 4, v * 0.55, 'sine');
      // bass note and a warm pad chord that hold the whole bar
      pluck(chordRoot / 2, t, beat * 7.5, 0.09 * m.vol, 'sine');
      TRIAD[m.mode].forEach((n) => pluck(hz(chordRoot, n), t, beat * 7.5, 0.04 * m.vol, 'sine'));
    }
    if (style === 'lively') {
      if (inBar % 2 === 0) drum(t, inBar % 4 === 0 ? 0.2 : 0.1);
      if (inBar % 2 === 1) pluck(hz(chordRoot, tones[2] + 36), t, 0.08, 0.04, 'square'); // light tick
    }
    step += 1;
  };

  const tick = () => {
    if (!ctx || style === 'off') return;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    while (nextTime < ctx.currentTime + 0.6) { scheduleBeat(nextTime); nextTime += beatLen(); }
  };

  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  return {
    get style() { return style; },
    /** Switch style. Needs to be called from a tap the first time, so the browser lets the sound play. */
    setStyle(next) {
      if (!STYLES.includes(next)) return false;
      style = next; step = 0;
      stopTimer();
      if (next === 'off') return true;
      if (!ensure()) { style = 'off'; return false; }
      nextTime = ctx.currentTime + 0.05;
      tick();
      timer = setInterval(tick, 150);
      return true;
    },
    setMood(next) { mood = next; },
    /** A short sound for a moment in the story ('rise', 'sad', 'pop', 'coin', 'cheer', 'thunder'). Silent when music is off. */
    cue(kind) {
      if (style === 'off' || !ctx) return;
      const t = ctx.currentTime;
      if (kind === 'thunder') { drum(t, 0.3); drum(t + 0.16, 0.18); return; }
      const notes = kind === 'rise' ? [0, 4, 7, 12] : kind === 'sad' ? [7, 3, 0, -5]
        : kind === 'coin' ? [19, 24] : kind === 'cheer' ? [0, 4, 7, 12, 16, 19] : [12];
      const gap = kind === 'coin' ? 0.07 : kind === 'cheer' ? 0.07 : 0.09;
      notes.forEach((n, i) => pluck(hz(ROOT * 2, n), t + i * gap, kind === 'coin' ? 0.3 : 0.5, 0.1));
    },
    stop() {
      stopTimer(); style = 'off';
      if (ctx && ctx.close) { try { ctx.close(); } catch { /* already closed */ } }
      ctx = null; master = null;
    },
  };
}
