import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStoryAudio, STYLES } from './storyAudio';

function fakeCtx() {
  const made = { osc: 0, closed: false };
  class Ctx {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; made.last = this; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect() {} }; }
    createOscillator() { made.osc += 1; const o = { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start(t) { (made.notes = made.notes || []).push({ f: o.frequency.value, t }); }, stop() {} }; return o; }
    close() { made.closed = true; }
  }
  return { Ctx, made };
}

afterEach(() => vi.useRealTimers());

describe('createStoryAudio', () => {
  it('knows its styles', () => { expect(STYLES).toEqual(['off', 'calm', 'lively']); });

  it('makes no sound and opens no audio engine while off', () => {
    const { Ctx, made } = fakeCtx();
    const a = createStoryAudio(Ctx);
    expect(a.style).toBe('off');
    a.cue('rise');
    expect(made.osc).toBe(0);
  });

  it('plays notes when set to calm or lively, and stops cleanly', () => {
    vi.useFakeTimers();
    for (const style of ['calm', 'lively']) {
      const { Ctx, made } = fakeCtx();
      const a = createStoryAudio(Ctx);
      expect(a.setStyle(style)).toBe(true);
      expect(a.style).toBe(style);
      expect(made.osc).toBeGreaterThan(0);
      const before = made.osc;
      made.last.currentTime = 3;
      vi.advanceTimersByTime(300);
      expect(made.osc).toBeGreaterThan(before);
      a.stop();
      expect(made.closed).toBe(true);
      expect(a.style).toBe('off');
    }
  });

  it('lively makes more notes than calm over the same time (it has drums)', () => {
    vi.useFakeTimers();
    const counts = {};
    for (const style of ['calm', 'lively']) {
      const { Ctx, made } = fakeCtx();
      const a = createStoryAudio(Ctx);
      a.setStyle(style);
      made.last.currentTime = 8;
      vi.advanceTimersByTime(300);
      counts[style] = made.osc;
      a.stop();
    }
    expect(counts.lively).toBeGreaterThan(counts.calm);
  });

  it('rejects an unknown style and survives having no audio support', () => {
    const { Ctx } = fakeCtx();
    expect(createStoryAudio(Ctx).setStyle('loud')).toBe(false);
    const none = createStoryAudio(undefined);
    expect(none.setStyle('calm')).toBe(false);
    expect(none.style).toBe('off');
  });

  it('keeps going after the mood changes', () => {
    vi.useFakeTimers();
    const { Ctx, made } = fakeCtx();
    const a = createStoryAudio(Ctx);
    a.setStyle('calm'); a.setMood('worried'); a.cue('sad');
    expect(made.osc).toBeGreaterThan(0);
    a.stop();
  });

  it('makes a sound for every kind of cue, but stays silent when the music is off', () => {
    vi.useFakeTimers();
    for (const kind of ['rise', 'sad', 'pop', 'coin', 'cheer', 'thunder']) {
      const { Ctx, made } = fakeCtx();
      const a = createStoryAudio(Ctx);
      a.setStyle('calm');
      const before = made.osc;
      a.cue(kind);
      expect(made.osc, kind).toBeGreaterThan(before);
      a.stop();
    }
    const quiet = createStoryAudio(fakeCtx().Ctx);
    expect(() => quiet.cue('coin')).not.toThrow();
  });

  it('sounds brighter and quicker when the mood is happy, and softer and slower when worried', () => {
    vi.useFakeTimers();
    const play = (mood) => {
      const { Ctx, made } = fakeCtx();
      const a = createStoryAudio(Ctx);
      a.setMood(mood); a.setStyle('calm');
      made.last.currentTime = 6;
      vi.advanceTimersByTime(150);
      a.stop();
      const notes = made.notes.filter((n) => n.f > 300); // the tune (not bass or pad)
      return { top: Math.max(...notes.map((n) => n.f)), span: made.notes.length };
    };
    const happy = play('happy'); const worried = play('worried');
    expect(happy.top).toBeGreaterThan(worried.top);
    expect(happy.span).toBeGreaterThan(worried.span); // more notes fit in the same time at a faster tempo
  });
});
