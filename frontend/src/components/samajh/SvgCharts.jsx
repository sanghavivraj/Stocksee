import { useId, useMemo, useState } from 'react';
import { formatInr } from '../../samajh/format';
import { pick } from '../../samajh/content';
import useChartWidth from '../../hooks/useChartWidth';

/**
 * Two small charts drawn as plain SVG (no extra library): lines over years, and a few labelled bars.
 * Colours come from the app's validated categorical palette (see .samajh-s1..s3 in samajh.css), and every series
 * is also named in a legend and in the table view, so colour is never the only way to tell them apart.
 */
const W_DEFAULT = 640;
const H = 260;
const PAD = { l: 84, r: 14, t: 14, b: 46 };

const short = (v, lang) => formatInr(v, lang);

/** Split a label into at most two lines at a space, so it fits under its bar. */
function wrapLabel(text, maxChars) {
  const t = String(text);
  if (t.length <= maxChars) return [t];
  const cut = t.lastIndexOf(' ', maxChars);
  if (cut < 1) return [t.slice(0, maxChars - 1) + '…'];
  const rest = t.slice(cut + 1);
  return [t.slice(0, cut), rest.length > maxChars ? rest.slice(0, maxChars - 1) + '…' : rest];
}

export function LineChartSvg({ series, lang, xLabel, ariaLabel }) {
  const uid = useId();
  const [chartRef, W] = useChartWidth(W_DEFAULT);
  const [hover, setHover] = useState(null);
  const g = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p.x));
    const ys = series.flatMap((s) => s.points.map((p) => p.y));
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMax = Math.max(...ys, 1) * 1.05;
    const x = (v) => PAD.l + ((v - xMin) / Math.max(xMax - xMin, 1)) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);
    const paths = series.map((s) => s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(''));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMax * f);
    const xTicks = [xMin, xMin + (xMax - xMin) / 2, xMax].map((v) => Math.round(v));
    return { x, y, paths, ticks, xTicks, xMin, xMax, yMax };
  }, [series, W]);

  const xs = series[0].points.map((p) => p.x);
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const value = g.xMin + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (g.xMax - g.xMin);
    const nearest = xs.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a), xs[0]);
    setHover(nearest);
  };

  const hoverRows = hover === null ? [] : series.map((s) => ({ s, p: s.points.find((p) => p.x === hover) })).filter((r) => r.p);

  return (
    <figure className="samajh-chart" aria-label={ariaLabel}>
      <div className="samajh-legend">
        {series.map((s, i) => (
          <span key={s.id}><i className={`samajh-swatch samajh-s${i + 1}`} aria-hidden="true" />{pick(s.label, lang)}</span>
        ))}
      </div>
      <svg ref={chartRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${uid}-t`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="samajh-svg">
        <title id={`${uid}-t`}>{ariaLabel}</title>
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={g.y(t)} y2={g.y(t)} className="samajh-grid" />
            <text x={PAD.l - 6} y={g.y(t) + 4} textAnchor="end" className="samajh-tick">{short(t, lang)}</text>
          </g>
        ))}
        {g.xTicks.map((t) => <text key={t} x={g.x(t)} y={H - 26} textAnchor="middle" className="samajh-tick">{t}</text>)}
        <text x={PAD.l + (W - PAD.l - PAD.r) / 2} y={H - 7} textAnchor="middle" className="samajh-tick">{xLabel}</text>
        {series.map((s, i) => <path key={s.id} d={g.paths[i]} className={`samajh-line samajh-s${i + 1}`} fill="none" />)}
        {hover !== null && <line x1={g.x(hover)} x2={g.x(hover)} y1={PAD.t} y2={H - PAD.b} className="samajh-cursor" />}
        {hoverRows.map(({ s, p }) => {
          const i = series.indexOf(s);
          return <circle key={s.id} cx={g.x(p.x)} cy={g.y(p.y)} r="4.5" className={`samajh-dot samajh-s${i + 1}`} />;
        })}
      </svg>
      {hover !== null && (
        <figcaption className="samajh-tooltip" aria-live="polite">
          <strong>{xLabel} {hover}</strong>
          {hoverRows.map(({ s, p }) => <span key={s.id}>{pick(s.label, lang)}: {short(p.y, lang)}</span>)}
        </figcaption>
      )}
    </figure>
  );
}

export function BarChartSvg({ bars, lang, ariaLabel }) {
  const uid = useId();
  const [chartRef, W] = useChartWidth(W_DEFAULT);
  const max = Math.max(...bars.map((b) => b.value), 1) * 1.15;
  const bw = Math.max(44, Math.min(120, (W - PAD.l - PAD.r) / (bars.length * 1.7)));
  const maxChars = Math.max(8, Math.floor((bw + 18) / 7.4)); // 12px mono is about 7.2px wide
  const BAR_PAD_B = 46; // room for two lines of label
  const gap = (W - PAD.l - PAD.r - bw * bars.length) / (bars.length + 1);
  const y = (v) => PAD.t + 14 + (1 - v / max) * (H - PAD.t - BAR_PAD_B - 14);
  return (
    <figure className="samajh-chart" aria-label={ariaLabel}>
      <svg ref={chartRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${uid}-t`} className="samajh-svg">
        <title id={`${uid}-t`}>{ariaLabel}</title>
        <line x1={PAD.l - 20} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="samajh-grid" />
        {bars.map((b, i) => {
          const x = PAD.l - 20 + gap * (i + 1) + bw * i;
          const top = y(b.value);
          return (
            <g key={b.id}>
              <rect x={x} y={top} width={bw} height={Math.max(y(0) - top, 1)} rx="4" className={`samajh-bar samajh-s${i + 1}`} />
              <text x={x + bw / 2} y={top - 6} textAnchor="middle" className="samajh-barvalue">{short(b.value, lang)}</text>
              <text x={x + bw / 2} y={H - 28} textAnchor="middle" className="samajh-tick">
                {wrapLabel(pick(b.label, lang), maxChars).map((line, li) => <tspan key={li} x={x + bw / 2} dy={li ? 15 : 0}>{line}</tspan>)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
