import { prefersReducedMotion } from './webgl';

/**
 * Switch between light and dark the way the approved design does it: the new colours spread out in a circle from the
 * top-right corner (the browser's View Transitions). Browsers without it, and people who asked for less motion, switch at once.
 * `update` must change the page before it returns. The animation itself is in styles/shell.css.
 */
let running = 0;

export function revealTheme(update) {
  if (typeof document === 'undefined' || !document.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  const root = document.documentElement;
  running += 1;
  root.classList.add('theme-reveal');
  const done = () => {
    running -= 1;
    if (running === 0) root.classList.remove('theme-reveal'); // a second click keeps the effect until its own turn ends
  };
  const transition = document.startViewTransition(update);
  transition.ready?.catch(() => {}); // rejected when a newer click replaces this one: nothing to do
  transition.finished.then(done, done);
}
