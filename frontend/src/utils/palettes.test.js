import { describe, it, expect, vi, afterEach } from 'vitest';
import { PALETTES, DEFAULT_PALETTE, isPalette, safePalette } from './palettes';
import { supportsWebGL, prefersReducedMotion, canPlay3D } from './webgl';

describe('accent colours', () => {
  it('offers exactly five, each with a name and a real colour', () => {
    expect(PALETTES).toHaveLength(5);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(5);
    PALETTES.forEach((p) => { expect(p.label.length).toBeGreaterThan(2); expect(p.dot).toMatch(/^#[0-9a-f]{6}$/i); });
  });
  it('the default is one of them', () => { expect(isPalette(DEFAULT_PALETTE)).toBe(true); });
  it.each(PALETTES.map((p) => p.id))('keeps a saved %s', (id) => { expect(safePalette(id)).toBe(id); });
  it.each([null, undefined, '', 'SKY', 'purple', '<script>alert(1)</script>', 'sky; background:url(x)', 42, {}, [], 'constructor', '__proto__'])('a damaged saved value (%j) falls back to the default', (bad) => {
    expect(safePalette(bad)).toBe(DEFAULT_PALETTE);
  });
});

describe('3D support checks', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('without a browser, 3D is off (so server-side or test code never breaks)', () => {
    expect(supportsWebGL()).toBe(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(canPlay3D()).toBe(false);
  });
  const browser = ({ webgl, reduced }) => {
    vi.stubGlobal('window', { WebGLRenderingContext: function WebGL() {}, matchMedia: () => ({ matches: reduced }) });
    vi.stubGlobal('document', { createElement: () => ({ getContext: (k) => (webgl && k === 'webgl' ? {} : null) }) });
  };
  it('3D plays when the browser can draw it and motion is allowed', () => { browser({ webgl: true, reduced: false }); expect(canPlay3D()).toBe(true); });
  it('people who asked for less motion get the calm 2D story', () => { browser({ webgl: true, reduced: true }); expect(supportsWebGL()).toBe(true); expect(canPlay3D()).toBe(false); });
  it('a browser without WebGL gets the 2D story', () => { browser({ webgl: false, reduced: false }); expect(canPlay3D()).toBe(false); });
  it('a browser that throws while asking is treated as "no 3D", never a crash', () => {
    vi.stubGlobal('window', { WebGLRenderingContext: function WebGL() {}, matchMedia: () => { throw new Error('blocked'); } });
    vi.stubGlobal('document', { createElement: () => { throw new Error('blocked'); } });
    expect(supportsWebGL()).toBe(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(canPlay3D()).toBe(false);
  });
});
