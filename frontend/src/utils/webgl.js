/**
 * Can this browser draw the 3D stories? They need WebGL, and people who asked their device for less motion
 * keep the calm step-by-step 2D story instead (the 3D one plays by itself).
 */
const answered = new WeakMap(); // one answer per window: browsers only allow a handful of 3D contexts at a time

export function supportsWebGL() {
  try {
    if (answered.has(window)) return answered.get(window);
    const c = document.createElement('canvas');
    const gl = window.WebGLRenderingContext ? c.getContext('webgl2') || c.getContext('webgl') : null;
    gl?.getExtension?.('WEBGL_lose_context')?.loseContext(); // give the test context straight back
    answered.set(window, !!gl);
    return !!gl;
  } catch { return false; }
}

export function prefersReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

/** True when the 3D versions should be used. */
export const canPlay3D = () => supportsWebGL() && !prefersReducedMotion();
