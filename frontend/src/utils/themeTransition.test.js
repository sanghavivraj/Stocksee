import { describe, it, expect, vi, afterEach } from 'vitest';
import { revealTheme } from './themeTransition';

describe('light / dark circle effect', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function browser({ supported = true, reduced = false } = {}) {
    const classes = new Set();
    const ends = [];
    const doc = {
      documentElement: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } },
    };
    if (supported) {
      doc.startViewTransition = vi.fn((cb) => {
        cb();
        let end;
        const finished = new Promise((resolve) => { end = resolve; });
        ends.push(async () => { end(); await finished; await Promise.resolve(); });
        return { ready: Promise.resolve(), finished };
      });
    }
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) });
    return { classes, doc, ends };
  }

  it('plays the circle: the theme changes inside the transition and the marker is removed afterwards', async () => {
    const { classes, doc, ends } = browser();
    const update = vi.fn();
    revealTheme(update);
    expect(doc.startViewTransition).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(classes.has('theme-reveal')).toBe(true);
    await ends[0]();
    expect(classes.has('theme-reveal')).toBe(false);
  });
  it('a quick second click keeps the effect until the second one has finished', async () => {
    const { classes, ends } = browser();
    revealTheme(() => {});
    revealTheme(() => {});
    await ends[0]();
    expect(classes.has('theme-reveal')).toBe(true);
    await ends[1]();
    expect(classes.has('theme-reveal')).toBe(false);
  });
  it('switches at once in a browser without view transitions', () => {
    const { classes } = browser({ supported: false });
    const update = vi.fn();
    revealTheme(update);
    expect(update).toHaveBeenCalledOnce();
    expect(classes.size).toBe(0);
  });
  it('switches at once for people who asked for less motion', () => {
    const { doc } = browser({ reduced: true });
    const update = vi.fn();
    revealTheme(update);
    expect(update).toHaveBeenCalledOnce();
    expect(doc.startViewTransition).not.toHaveBeenCalled();
  });
});
