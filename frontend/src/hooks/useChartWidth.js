import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The drawn width of a chart, kept up to date. SVG charts are drawn at this width (1 unit = 1 pixel), so their
 * labels stay a readable 12px on a phone instead of shrinking with the picture.
 * Returns [ref, width]: put `ref` on the <svg> (which must fill its container, width: 100%).
 * Pass `watch` (values that decide when the <svg> exists, e.g. a loading status) so it is measured once it appears.
 */
export default function useChartWidth(fallback = 640, { min = 280, max = 960 } = {}, watch = []) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(Math.min(max, Math.max(min, w)));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, ...watch]);
  return [ref, width];
}
