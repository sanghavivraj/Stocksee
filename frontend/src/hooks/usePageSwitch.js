import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../utils/webgl';

export const LEAVE_MS = 220; // how long the old page takes to fade away (matches styles/shell.css)

/**
 * Holds the old page on screen while it fades out, then shows the new one from the top.
 * Returns [the location to draw, whether that page is on its way out]. A change inside the same page (only the
 * address options differ) shows at once, and people who asked for less motion do not wait.
 */
export default function usePageSwitch(location) {
  const [shown, setShown] = useState(location);
  const leaving = location.pathname !== shown.pathname;

  useEffect(() => {
    if (!leaving) { setShown(location); return undefined; }
    const timer = setTimeout(() => { setShown(location); window.scrollTo(0, 0); }, prefersReducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [location, leaving]);

  return [leaving ? shown : location, leaving];
}
