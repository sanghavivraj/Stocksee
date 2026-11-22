import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { formatInr } from '../../samajh/format';
import { pick } from '../../samajh/content';

/**
 * The three interactive scene types of a Money Card story. They only draw and react; every number comes from
 * samajh/storyScenes.js and every word from content/samajh/stories.json.
 */

const FMT = {
  inr: (v, l) => formatInr(v, l),
  pct: (v) => `${v}%`,
  pct1: (v) => `${v.toFixed(1)}%`,
  plain: (v) => String(v),
  rupee: (v) => `₹${v}`,
  years: (v, l) => `${v} ${l === 'hi' ? 'साल' : v === 1 ? 'year' : 'years'}`,
};
const label = (text, key, lang) => (text.labels[key] ? pick(text.labels[key], lang) : key);

/** Say something again only when what the scene shows has really changed (never on the first draw). */
function useReact(out, onMood, onSay) {
  const sig = JSON.stringify([out.say, out.vars]);
  const lastSig = useRef(sig); const lastMood = useRef(out.mood);
  useEffect(() => {
    if (lastMood.current !== out.mood) { lastMood.current = out.mood; onMood(out.mood); }
  }, [out.mood, onMood]);
  useEffect(() => {
    if (lastSig.current === sig) return undefined;
    lastSig.current = sig;
    const t = setTimeout(() => onSay(out.say, out.vars), 350);
    return () => clearTimeout(t);
  }, [sig, out.say, out.vars, onSay]);
}

function Lines({ lines, text, lang }) {
  const W = 320; const H = 150; const P = 8;
  const n = lines[0].points.length - 1 || 1;
  const max = Math.max(...lines.flatMap((l) => l.points)) * 1.05 || 1;
  const X = (i) => P + (i / n) * (W - 2 * P);
  const Y = (v) => H - P - (v / max) * (H - 2 * P);
  return (
    <div className="sx-lines">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
        {[0, 1, 2, 3].map((g) => <line key={g} className="samajh-grid" x1={P} x2={W - P} y1={Y((max * g) / 3)} y2={Y((max * g) / 3)} />)}
        {lines.map((l) => <path key={l.key} className={`sx-line sx-${l.tone}`} fill="none" d={l.points.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')} />)}
      </svg>
      <ul className="sx-legend">
        {lines.map((l) => (
          <li key={l.key}><span className={`sx-sw sx-${l.tone}`} aria-hidden="true" />{label(text, l.label, lang)}<b>{formatInr(l.points[l.points.length - 1], lang)}</b></li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ bars, scale, text, lang }) {
  const max = scale || Math.max(...bars.map((b) => b.value), 1);
  return (
    <ul className="sx-bars">
      {bars.map((b) => (
        <li key={b.key} className="sx-bar">
          <span className="sx-bar-name">{label(text, b.label, lang)}</span>
          <span className="sx-track"><span className={`sx-fill sx-${b.tone}`} style={{ width: `${Math.max(0, Math.min(100, (b.value / max) * 100))}%` }} /></span>
          <b className="sx-bar-val">{(FMT[b.fmt] || FMT.inr)(b.value, lang)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Sliders / choices -> bars or lines + a big readout. Meera reacts as the numbers move. */
export function Lab({ scene, text, ctx, onMood, onSay }) {
  const { inp, lang } = ctx;
  const [vals, setVals] = useState(() => {
    const v = {};
    (scene.sliders || []).forEach((s) => { v[s.key] = typeof s.def === 'function' ? s.def(inp) : s.def; });
    (scene.choices || []).forEach((c) => { v[c.key] = c.def; });
    return v;
  });
  const out = useMemo(() => scene.compute(vals, ctx), [scene, vals, ctx]);
  useReact(out, onMood, onSay);
  return (
    <div className="sx-lab">
      {(scene.sliders || []).map((s) => (
        <label key={s.key} className="sx-slider">
          <span>{label(text, s.label, lang)}: <b>{FMT[s.fmt](vals[s.key], lang)}</b></span>
          <input type="range" min={s.min} max={s.max} step={s.step} value={vals[s.key]} onChange={(e) => setVals((v) => ({ ...v, [s.key]: Number(e.target.value) }))} />
        </label>
      ))}
      {(scene.choices || []).map((c) => (
        <fieldset key={c.key} className="sx-choice">
          <legend>{label(text, c.label, lang)}</legend>
          <div className="samajh-seg">
            {c.options.map((o) => (
              <button key={o} type="button" aria-pressed={vals[c.key] === o} className={`samajh-seg-btn ${vals[c.key] === o ? 'on' : ''}`} onClick={() => setVals((v) => ({ ...v, [c.key]: o }))}>{label(text, o, lang)}</button>
            ))}
          </div>
        </fieldset>
      ))}
      {out.lines ? <Lines lines={out.lines} text={text} lang={lang} /> : <Bars bars={out.bars} scale={out.scale} text={text} lang={lang} />}
      {out.dots && (
        <div className="sx-dots" role="img" aria-label={`${out.dots.filled} / ${out.dots.total}`}>
          {Array.from({ length: out.dots.total }, (_, i) => <span key={i} className={i < out.dots.filled ? 'on' : ''} />)}
        </div>
      )}
      <p className="sx-read"><span>{label(text, out.readout.label, lang)}</span><b>{out.readout.text}</b></p>
    </div>
  );
}

/** Press Play (or Next step) and watch time pass: a jar fills or drains, with the numbers beside it. */
export function Run({ scene, text, ctx, onMood, onSay }) {
  const { inp, lang } = ctx;
  const ticks = typeof scene.ticks === 'function' ? scene.ticks(inp) : scene.ticks;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useMemo(() => scene.frame(i, ctx), [scene, i, ctx]);
  const prev = useRef(0);
  useEffect(() => {
    if (!playing) return undefined;
    if (i >= ticks) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setI((n) => n + 1), scene.tickMs || 600);
    return () => clearTimeout(t);
  }, [playing, i, ticks, scene.tickMs]);
  useEffect(() => {
    if (prev.current === i) return;
    prev.current = i;
    onMood(frame.mood);
    if (frame.say) onSay(frame.say, frame.vars);
  }, [i, frame, onMood, onSay]);
  const end = i >= ticks;
  const level = Math.max(0, Math.min(1, frame.level));
  return (
    <div className="sx-run">
      <div className="sx-jarbox">
        <div className="sx-jar" role="img" aria-label={`${frame.big.text}`}><div className="sx-jar-fill" style={{ height: `${level * 100}%` }} /></div>
        <div className="sx-run-info">
          <p className="sx-read"><span>{label(text, frame.big.label, lang)}</span><b>{frame.big.text}</b></p>
          <p className="sx-sub"><span>{label(text, frame.sub.label, lang)}</span><b>{frame.sub.text}</b></p>
        </div>
      </div>
      <div className="sx-ticks" aria-hidden="true">{Array.from({ length: ticks + 1 }, (_, k) => <span key={k} className={k <= i ? 'on' : ''} />)}</div>
      <div className="sx-run-btns">
        {end ? (
          <button type="button" className="sstory-btn sstory-main" onClick={() => { setI(0); setPlaying(false); prev.current = 0; onMood(scene.frame(0, ctx).mood); }}><RotateCcw size={16} aria-hidden="true" /> {ctx.T.replay}</button>
        ) : scene.manual ? (
          <button type="button" className="sstory-btn sstory-main" onClick={() => setI((n) => n + 1)}><SkipForward size={16} aria-hidden="true" /> {ctx.T.nextStep}</button>
        ) : (
          <button type="button" className="sstory-btn sstory-main" onClick={() => setPlaying((p) => !p)}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />} {playing ? ctx.T.pause : ctx.T.play}</button>
        )}
        {!end && !scene.manual && <button type="button" className="sstory-btn" onClick={() => { setPlaying(false); setI((n) => Math.min(ticks, n + 1)); }} aria-label={ctx.T.nextStep}><SkipForward size={16} aria-hidden="true" /></button>}
      </div>
    </div>
  );
}

const DOT_COLORS = ['#2a78d6', '#1baf7a', '#eb6834', '#a65bd6', '#d6a21b', '#d65b8a'];

/** SIP: tap to practice-buy units for 6 months at made-up prices; the average cost drops below the average price. */
export function Buy({ text, ctx, onSay }) {
  const { vars, lang, f } = ctx;
  const navs = [1, 2, 3, 4, 5, 6].map((k) => vars[`nav${k}`]);
  const units = [1, 2, 3, 4, 5, 6].map((k) => vars[`u${k}`]);
  const [n, setN] = useState(0);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = () => {
    if (n >= 6) { setN(0); return; }
    const key = n === 0 ? 'first' : navs[n] < navs[n - 1] ? 'fell' : 'rose';
    onSay(key, { nav: navs[n], units: units[n] });
    setN(n + 1);
    if (n + 1 === 6) timer.current = setTimeout(() => onSay('done', {}), 2600);
  };
  const owned = units.slice(0, n).reduce((a, b) => a + b, 0);
  return (
    <div className="sx-buy">
      <div className="sx-buy-top">
        <p className="sx-read"><span>{label(text, 'nav', lang)}</span><b>₹{navs[Math.min(n, 5)]}</b></p>
        <p className="sx-read"><span>{label(text, 'owned', lang)}</span><b>{owned.toFixed(2)}</b></p>
      </div>
      <div className="sx-pile" aria-hidden="true">
        {units.slice(0, n).map((u, k) => Array.from({ length: Math.round(u / 2.4) }, (_, d) => <i key={`${k}-${d}`} style={{ background: DOT_COLORS[k] }} />))}
      </div>
      <table className="samajh-table sx-table">
        <tbody>
          {units.slice(0, n).map((u, k) => (
            <tr key={k}><td><i className="sx-sw" style={{ background: DOT_COLORS[k] }} /> {k + 1}</td><td>₹{navs[k]}</td><td>{u.toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>
      {n === 6 && (
        <p className="sx-sub"><span>{label(text, 'avg', lang)}</span><b>₹{vars.avgCost.toFixed(2)}</b> <span>{label(text, 'avgprice', lang)}</span><b>₹{vars.avgNav.toFixed(2)}</b></p>
      )}
      <button type="button" className="sstory-btn sstory-main" onClick={tap}>{n >= 6 ? label(text, 'again', lang) : `${label(text, 'buy', lang)} ${n + 1} · ${f.inr(vars.monthly)}`}</button>
    </div>
  );
}
