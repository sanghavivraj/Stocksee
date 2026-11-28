import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Play, Pause, RotateCcw, SkipForward, Search } from 'lucide-react';
import { Stage3D } from './Stage3D';
import { SWP_BEATS, SWP_TEXT, SWP_LABELS, swpVars } from './swpStory';
import { loadCards, pick } from '../samajh/content';
import { computeCard } from '../samajh/cardMath';
import { fill, formatInr } from '../samajh/format';
import { SCENES } from '../samajh/storyScenes';
import { createStoryAudio, STYLES } from '../samajh/storyAudio';
import { fetchScheme, searchFunds } from '../samajh/mfApi';
import { isPayoutPlan, parseNav, runSip } from '../samajh/realSip';
import stories from '../content/samajh/stories.json';
import frames from '../content/samajh/storyFrames.json';
import ui from '../content/samajh/ui.json';
import { storyEstimates, progressFraction, stepAtFraction, smoothFraction } from './timing';
import './story3d.css';

/**
 * The 3D story of one Money Card. It plays by itself from the moment it opens (one start, nothing to press): Meera speaks,
 * the scene moves its own sliders and buttons, and one yellow line shows the time like a video bar. Touching anything pauses it
 * so a visitor can explore. The numbers and words are the same ones the 2D story uses; only the way it looks is new.
 */
const FMT = {
  inr: (v, l) => formatInr(v, l), pct: (v) => `${v}%`, pct1: (v) => `${v.toFixed(1)}%`, plain: (v) => String(v), rupee: (v) => `₹${v}`,
  years: (v, l) => `${v} ${l === 'hi' ? 'साल' : v === 1 ? 'year' : 'years'}`,
};
export const lab = (text, key, lang) => (text.labels?.[key] ? pick(text.labels[key], lang) : key);
const FALL = { en: 'Biggest fall from a high', hi: 'ऊँचाई से सबसे बड़ी गिरावट' };

/** Say something again only when what the scene shows has really changed (never on the first draw). */
function useReact(out, onMood, onSay) {
  const sig = JSON.stringify([out.say, out.vars]); const lastSig = useRef(sig); const lastMood = useRef(out.mood);
  useEffect(() => { if (lastMood.current !== out.mood) { lastMood.current = out.mood; onMood(out.mood); } }, [out.mood, onMood]);
  useEffect(() => { if (lastSig.current === sig) return undefined; lastSig.current = sig; const t = setTimeout(() => onSay(out.say, out.vars), 350); return () => clearTimeout(t); }, [sig, out.say, out.vars, onSay]);
}

function Run({ scene, text, ctx, onMood, onSay, show, setHud, lang, T, auto, onDone, onTouch, ctl }) {
  const ticks = typeof scene.ticks === 'function' ? scene.ticks(ctx.inp) : scene.ticks;
  const [i, setI] = useState(0); const [playing, setPlaying] = useState(false); const prev = useRef(0);
  const frame = useMemo(() => scene.frame(i, ctx), [scene, i, ctx]);
  useEffect(() => { show({ kind: 'jar', level: Math.max(0, Math.min(1, frame.level)) }); setHud({ label: lab(text, frame.big.label, lang), text: frame.big.text, sub: { label: lab(text, frame.sub.label, lang), text: frame.sub.text } }); }, [frame, show, setHud, text, lang]);
  useEffect(() => { if (!playing) return undefined; if (i >= ticks) { setPlaying(false); return undefined; } const t = setTimeout(() => setI((n) => n + 1), scene.tickMs || 600); return () => clearTimeout(t); }, [playing, i, ticks, scene.tickMs]);
  useEffect(() => { if (prev.current === i) return; prev.current = i; onMood(frame.mood); if (frame.say) onSay(frame.say, frame.vars); }, [i, frame, onMood, onSay]);
  const end = i >= ticks;
  // the story plays itself: start after Meera has spoken, keep going, hold at the end, then move on
  useEffect(() => { if (!auto) { setPlaying(false); return undefined; } if (end) return undefined; const t = setTimeout(() => (scene.manual ? setI((n) => n + 1) : setPlaying(true)), i === 0 ? 2600 : scene.manual ? 1700 : 300); return () => clearTimeout(t); }, [auto, end, i, scene.manual]);
  useEffect(() => { if (!auto || !end) return undefined; const t = setTimeout(onDone, 4200); return () => clearTimeout(t); }, [auto, end, onDone]);
  if (!ctl) return null;
  return (
    <div className="s3-row">
      {end ? <button type="button" className="s3-btn" onClick={() => { onTouch(); setI(0); setPlaying(false); prev.current = 0; onMood(scene.frame(0, ctx).mood); }}><RotateCcw size={16} />{T.replay}</button>
        : scene.manual ? <button type="button" className="s3-btn" onClick={() => { onTouch(); setI((n) => n + 1); }}><SkipForward size={16} />{T.nextStep}</button>
        : <button type="button" className="s3-btn" onClick={() => { onTouch(); setPlaying((p) => !p); }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? T.pause : T.play}</button>}
      {!end && !scene.manual && <button type="button" className="s3-btn ghost" aria-label={T.nextStep} onClick={() => { onTouch(); setPlaying(false); setI((n) => Math.min(ticks, n + 1)); }}><SkipForward size={16} /></button>}
      <div className="s3-ticks" aria-hidden="true">{Array.from({ length: ticks + 1 }, (_, k) => <i key={k} className={k <= i ? 'on' : ''} />)}</div>
    </div>
  );
}

function Lab({ scene, text, ctx, onMood, onSay, show, setHud, lang, auto, onDone, onTouch, ctl, setChips }) {
  const { inp } = ctx;
  const [vals, setVals] = useState(() => { const v = {}; (scene.sliders || []).forEach((s) => { v[s.key] = typeof s.def === 'function' ? s.def(inp) : s.def; }); (scene.choices || []).forEach((c) => { v[c.key] = c.def; }); return v; });
  const out = useMemo(() => scene.compute(vals, ctx), [scene, vals, ctx]);
  useReact(out, onMood, onSay);
  // the story moves the sliders and choices by itself: start (Meera explains), a bigger value, a smaller value, then on
  const seq = useMemo(() => {
    const sl = scene.sliders || []; const ch = scene.choices || [];
    const snap = (x, v) => Math.min(x.max, Math.max(x.min, Math.round(v / x.step) * x.step));
    const dflt = (x) => (typeof x.def === 'function' ? x.def(inp) : x.def);
    const mk = (f, ci) => { const v = {}; sl.forEach((x) => { v[x.key] = f(x, dflt(x)); }); ch.forEach((c) => { v[c.key] = c.options[ci % c.options.length]; }); return v; };
    return [mk((x, d) => snap(x, d + (x.max - d) * 0.65), 1), mk((x, d) => snap(x, d > x.min ? x.min + (d - x.min) * 0.35 : d + (x.max - d) * 0.3), 2)];
  }, [scene, inp]);
  const at = useRef(0);
  useEffect(() => {
    if (!auto) return undefined;
    const t = setTimeout(() => { if (at.current >= seq.length) { onDone(); return; } setVals(seq[at.current]); at.current += 1; }, at.current === 0 ? 5200 : 6200);
    return () => clearTimeout(t);
  }, [auto, vals, seq, onDone]);
  useEffect(() => {
    if (out.lines) show({ kind: 'lines', lines: out.lines.map((l) => ({ key: l.key, label: lab(text, l.label, lang), points: l.points, tone: l.tone })) });
    else show({ kind: 'bars', scale: out.scale, dots: out.dots, bars: out.bars.map((b) => ({ key: b.key, label: lab(text, b.label, lang), value: Math.max(0, b.value), tone: b.tone, text: (FMT[b.fmt] || FMT.inr)(b.value, lang) })) });
    setHud({ label: lab(text, out.readout.label, lang), text: out.readout.text });
  }, [out, show, setHud, text, lang]);
  useEffect(() => { // what the story is changing, shown on the stage (the story moves these by itself)
    setChips([...(scene.sliders || []).map((x) => ({ label: lab(text, x.label, lang), text: FMT[x.fmt](vals[x.key], lang) })), ...(scene.choices || []).map((c) => ({ label: lab(text, c.label, lang), text: lab(text, vals[c.key], lang) }))]);
    return () => setChips([]);
  }, [vals, scene, text, lang, setChips]);
  if (!ctl) return null;
  return (
    <div className="s3-grid">
      {(scene.sliders || []).map((s) => (
        <label key={s.key} className="s3-slider">
          <span>{lab(text, s.label, lang)}: <b>{FMT[s.fmt](vals[s.key], lang)}</b></span>
          <input type="range" min={s.min} max={s.max} step={s.step} value={vals[s.key]} onPointerDown={onTouch} onKeyDown={onTouch} onChange={(e) => setVals((v) => ({ ...v, [s.key]: Number(e.target.value) }))} />
        </label>
      ))}
      {(scene.choices || []).map((c) => (
        <fieldset key={c.key} className="s3-choices"><legend>{lab(text, c.label, lang)}</legend>
          <div className="s3-row">{c.options.map((o) => (
            <button type="button" key={o} aria-pressed={vals[c.key] === o} className={`s3-btn ${vals[c.key] === o ? '' : 'ghost'}`} onClick={() => { onTouch(); setVals((v) => ({ ...v, [c.key]: o })); }}>{lab(text, o, lang)}</button>
          ))}</div>
        </fieldset>
      ))}
    </div>
  );
}

function Buy({ text, ctx, onSay, show, setHud, lang, auto, onDone, onTouch, ctl }) {
  const { vars, f } = ctx; const navs = [1, 2, 3, 4, 5, 6].map((k) => vars[`nav${k}`]); const units = [1, 2, 3, 4, 5, 6].map((k) => vars[`u${k}`]);
  const [n, setN] = useState(0); const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { show({ kind: 'pile', units, n }); const owned = units.slice(0, n).reduce((a, b) => a + b, 0); setHud({ label: lab(text, 'nav', lang), text: `₹${navs[Math.min(n, 5)]}`, sub: { label: lab(text, 'owned', lang), text: owned.toFixed(2) } }); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = () => {
    if (n >= 6) { setN(0); return; }
    onSay(n === 0 ? 'first' : navs[n] < navs[n - 1] ? 'fell' : 'rose', { nav: navs[n], units: units[n] }); setN(n + 1);
    if (n + 1 === 6) timer.current = setTimeout(() => onSay('done', {}), 2600);
  };
  // it taps itself: one practice-buy every ~2 seconds, then holds and moves on
  useEffect(() => {
    if (!auto) return undefined; const t = setTimeout(() => (n < 6 ? tap() : onDone()), n === 0 ? 3000 : n < 6 ? 2200 : 6000); return () => clearTimeout(t);
  }, [auto, n]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ctl) return null;
  return (
    <div className="s3-row">
      <button type="button" className="s3-btn" onClick={() => { onTouch(); tap(); }}>{n >= 6 ? lab(text, 'again', lang) : `${lab(text, 'buy', lang)} ${n + 1} · ${f.inr(vars.monthly)}`}</button>
      {n === 6 && <p>{lab(text, 'avg', lang)} <b>₹{vars.avgCost.toFixed(2)}</b> · {lab(text, 'avgprice', lang)} <b>₹{vars.avgNav.toFixed(2)}</b></p>}
    </div>
  );
}

/** One part of the SWP film. It plays by itself; there is nothing to press. */
function Beat({ scene, ctx, onMood, onSay, show, setHud, lang, auto, onDone }) {
  const [p, setP] = useState(0); const el = useRef(0);
  useEffect(() => {
    if (!auto) return undefined; let done;
    const iv = setInterval(() => { el.current += 50; const q = Math.min(1, el.current / scene.dur); setP(q); if (q >= 1) { clearInterval(iv); done = setTimeout(onDone, 900); } }, 50);
    return () => { clearInterval(iv); clearTimeout(done); };
  }, [auto, scene, onDone]);
  const f = useMemo(() => scene.frame(p, { ...ctx, L: (k) => pick(SWP_LABELS[k], lang) }), [p, scene, ctx, lang]);
  useEffect(() => { show(f.visual); setHud(f.hud || null); }, [f, show, setHud]);
  const lm = useRef(''); useEffect(() => { if (f.mood !== lm.current) { lm.current = f.mood; onMood(f.mood); } }, [f.mood, onMood]);
  const ls = useRef(null); useEffect(() => { if (f.say && f.say !== ls.current) { ls.current = f.say; onSay(f.say, f.vars); } }, [f.say, f.vars, onSay]);
  return null;
}

/** Real fund history (AMFI NAVs through mfapi.in). Facts only; when it cannot load we say so, never fill the gap with made-up numbers. */
function Real({ show, setHud, lang, onMood, auto, onDone, onTouch }) {
  const R = ui[lang].real; const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [list, setList] = useState([]);
  const [res, setRes] = useState(null); const [name, setName] = useState('');
  useEffect(() => { show({ kind: 'none' }); setHud(null); }, [show, setHud]);
  useEffect(() => { if (!auto) return undefined; const t = setTimeout(onDone, 9000); return () => clearTimeout(t); }, [auto, onDone]); // move on unless the visitor starts a search
  const search = async () => {
    if (q.trim().length < 3) { setStatus(R.tooShort); return; }
    setStatus(R.searching);
    try {
      const l = await searchFunds(q);
      if (!l.length) { setStatus(R.none); setList([]); return; }
      setList([...l].sort((a, b) => Number(isPayoutPlan(a.schemeName)) - Number(isPayoutPlan(b.schemeName))).slice(0, 8)); setStatus(fill(R.found, { n: l.length }, lang));
    } catch { setStatus(R.offline); }
  };
  const load = async (code, nm) => {
    setStatus(R.loading);
    try {
      const arr = parseNav(await fetchScheme(code)); if (arr.length < 40) { setStatus(R.tooLittle); return; }
      const last = new Date(arr[arr.length - 1].t); const st = new Date(Date.UTC(last.getUTCFullYear() - 5, last.getUTCMonth(), 1));
      const r = runSip({ arr, start: [st.getUTCFullYear(), st.getUTCMonth() + 1], end: [last.getUTCFullYear(), last.getUTCMonth() + 1], day: 5, amount: 5000 });
      if (!r) { setStatus(R.tooLittle); return; }
      const step = Math.max(1, Math.ceil(r.N / 120)); const idx = []; for (let i = 0; i < r.N; i += step) idx.push(i); if (idx[idx.length - 1] !== r.N - 1) idx.push(r.N - 1);
      show({ kind: 'lines', lines: [{ key: 'inv', label: R.putIn, points: idx.map((i) => r.inv[i]), tone: 'a' }, { key: 'val', label: R.worth, points: idx.map((i) => r.val[i]), tone: r.gain >= 0 ? 'pos' : 'neg' }] });
      setHud({ label: R.worth, text: formatInr(r.value, lang), sub: { label: R.putIn, text: formatInr(r.invested, lang) } }); setRes(r); setName(nm); setStatus(''); onMood('calm');
    } catch { setStatus(R.offline); }
  };
  return (
    <div className="s3-grid" style={{ gridTemplateColumns: '1fr' }}>
      <form className="s3-row" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input className="s3-input" value={q} onFocus={onTouch} onChange={(e) => setQ(e.target.value)} placeholder={R.placeholder} aria-label={R.searchLabel} />
        <button type="submit" className="s3-btn"><Search size={16} />{R.searchBtn}</button>
      </form>
      {status && <p role="status" style={{ margin: 0 }}>{status}</p>}
      {!res && list.length > 0 && <ul className="s3-list">{list.map((f) => <li key={f.schemeCode}><button type="button" disabled={isPayoutPlan(f.schemeName)} onClick={() => load(f.schemeCode, f.schemeName)}>{f.schemeName}{isPayoutPlan(f.schemeName) ? ` · ${R.payout}` : ''}</button></li>)}</ul>}
      {res && (
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: '#fff' }}>{name}</p>
          <div className="s3-facts">
            <p>{R.putIn}: <b>{formatInr(res.invested, lang)}</b></p>
            <p>{R.worth}: <b>{formatInr(res.value, lang)}</b> ({res.gainPct >= 0 ? '+' : '−'}{Math.abs(res.gainPct).toFixed(1)}%)</p>
            <p>{R.xirr}: <b>{res.xirr != null ? `${(res.xirr * 100).toFixed(1)}%` : R.xirrNA}</b></p>
            <p>{FALL[lang]}: <b>−{res.dd.pct.toFixed(1)}%</b></p>
          </div>
          <p className="s3-fine">{R.source}</p>
          <button type="button" className="s3-btn ghost" style={{ marginTop: 8 }} onClick={() => { setRes(null); setList([]); show({ kind: 'none' }); setHud(null); }}>{R.searchBtn}</button>
        </div>
      )}
    </div>
  );
}

function Progress({ step, auto, ests, onSeek }) {
  const [el, setEl] = useState(0); const elRef = useRef(0); elRef.current = el; const acts = useRef({});
  useEffect(() => { const st = step; setEl(0); return () => { if (elRef.current > 0.6 * (ests[st] || 1)) acts.current[st] = elRef.current; }; }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!auto) return undefined; const iv = setInterval(() => setEl((e) => e + 50), 50); return () => clearInterval(iv); }, [auto]);
  const { frac: target } = progressFraction({ step, el, ests, acts: acts.current });
  // draw: forward only, catching up gently; the end shows full; a click on the bar jumps straight there
  const shown = useRef(0); const lastStep = useRef(0);
  let frac;
  if (step >= ests.length - 1) frac = 1;
  else if (step < lastStep.current || step > lastStep.current + 1) frac = target;
  else frac = smoothFraction(shown.current, target);
  shown.current = frac; lastStep.current = step;
  const seek = (e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(stepAtFraction(ests, (e.clientX - r.left) / r.width)); };
  return (
    <div className="s3-progress" role="progressbar" aria-label="Story progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)} onClick={seek}>
      <div className="s3-progress-fill" style={{ width: `${frac * 100}%` }} />
    </div>
  );
}

export default function StoryPlayer({ cardId, lang: langIn, onClose }) {
  const lang = langIn === 'hi' ? 'hi' : 'en';
  const card = useMemo(() => loadCards().find((c) => c.id === cardId), [cardId]);
  const T = ui[lang].story; const isSwp = card.id === 'swp';
  const scenes = isSwp ? SWP_BEATS : SCENES[card.id]; const texts = isSwp ? SWP_TEXT : stories[card.id]; const frame = frames[card.id];
  const calc0 = useMemo(() => computeCard(card.id, card.inputs, lang, formatInr), [card, lang]);
  const calc = useMemo(() => ({ ...calc0, vars: isSwp ? { ...calc0.vars, ...swpVars(card.inputs) } : calc0.vars }), [calc0, isSwp, card]);
  const ctx = useMemo(() => ({ inp: card.inputs, vars: calc.vars, lang, formatInr, T, f: { inr: (v) => formatInr(v, lang) } }), [card, calc.vars, lang, T]);
  const [step, setStep] = useState(0);
  const total = scenes.length; const opening = step === 0; const ending = step === total + 1;
  const s = Math.min(Math.max(step - 1, 0), total - 1); const scene = scenes[s]; const text = texts[scene.id];
  const [mood, setMood] = useState('calm'); const [line, setLine] = useState(''); const [hud, setHud] = useState(null); const [chips, setChips] = useState([]);
  const [paused, setPaused] = useState(false); const [sound, setSound] = useState('off'); const audio = useRef(null); if (!audio.current) audio.current = createStoryAudio();
  const auto = !paused; const next = useCallback(() => setStep((n) => Math.min(n + 1, total + 1)), [total]); const touch = useCallback(() => setPaused(true), []);
  const host = useRef(null); const stage = useRef(null); const pend = useRef(null); const rootRef = useRef(null); const playRef = useRef(null);

  useEffect(() => { const st = new Stage3D(host.current); stage.current = st; if (pend.current) st.setVisual(pend.current); return () => st.dispose(); }, []);
  useEffect(() => { stage.current?.setMood(mood); }, [mood]);
  const show = useCallback((v) => { pend.current = v; stage.current?.setVisual(v); }, []);
  const say = useCallback((l, extra) => { if (!l) return; setLine(fill(pick(l, lang), { ...calc.vars, ...(extra || {}) }, lang)); setMood(l.mood); }, [calc.vars, lang]);
  const onSay = useCallback((key, extra) => { const l = text.says?.[key]; if (l) say(l, extra); }, [text, say]);
  useEffect(() => {
    setChips([]); if (opening || ending) setHud(null);
    if (opening) { show({ kind: 'cover', card: card.id }); say({ mood: 'happy', ...frame.open }); }
    else if (ending) { show({ kind: 'cover', card: card.id }); say({ mood: 'proud', en: ui.en.story.endingSay, hi: ui.hi.story.endingSay }); }
    else say(text.intro);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // the opening plays by itself: Meera speaks, then the first scene begins
  useEffect(() => { if (!auto || !opening) return undefined; const t = setTimeout(next, 3000 + pick(frame.open, lang).length * 45); return () => clearTimeout(t); }, [auto, opening, next, frame, lang]);
  useEffect(() => { const a = audio.current; a.setMood(mood); if (mood === 'happy' || mood === 'proud') { a.cue('rise'); a.cue('coin'); } else if (mood === 'worried') { a.cue('sad'); a.cue('thunder'); } else if (mood === 'wow') { a.cue('pop'); a.cue('cheer'); } }, [mood]);
  useEffect(() => { const ok = audio.current.setStyle('calm'); if (ok) setSound('calm'); return () => audio.current.stop(); }, []);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.code === 'Space' && !e.target?.closest?.('input,button,textarea')) { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'Tab' && rootRef.current) { // keep the Tab key inside the story while it is open
        const f = [...rootRef.current.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  // keyboard: focus moves into the story (so Space pauses it) and goes back to the card symbol when it closes
  useEffect(() => { const opener = document.activeElement; playRef.current?.focus(); return () => { opener?.focus?.(); }; }, []);
  // the page behind must not scroll while the story is open
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);

  const ests = useMemo(() => storyEstimates(scenes, frame, lang, card.inputs), [scenes, frame, lang, card]);
  const wp = { scene, text, ctx, onMood: setMood, onSay, show, setHud, lang, T, auto, onDone: next, onTouch: touch, ctl: paused, setChips };
  const body = opening || ending ? null : scene.type === 'beat' ? <Beat key={scene.id} {...wp} /> : scene.type === 'lab' ? <Lab key={scene.id} {...wp} /> : scene.type === 'run' ? <Run key={scene.id} {...wp} /> : scene.type === 'buy' ? <Buy key={scene.id} {...wp} /> : <Real key={scene.id} {...wp} />;
  const title = pick(card.name, lang); const showPanel = (paused || scene.type === 'real') && scene.type !== 'beat' && !opening && !ending;

  return (
    <div ref={rootRef} className="s3-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="s3-wrap">
        <header className="s3-head">
          <div><div className="s3-kicker">{ending ? T.ending : (lang === 'hi' ? 'मीरा की कहानी' : "Meera's story")}</div><h2 className="s3-title">{title}</h2></div>
          <button type="button" className="s3-close" onClick={onClose} aria-label={ui[lang].cards.close}><X size={20} /></button>
        </header>

        <div className="s3-stage">
          <div ref={host} className="s3-host" />
          {hud && (
            <div className="s3-hud">
              <div className="s3-hud-label">{hud.label}</div><div className="s3-hud-big">{hud.text}</div>
              {hud.sub && <div className="s3-hud-sub">{hud.sub.label}: <b>{hud.sub.text}</b></div>}
            </div>
          )}
          {chips.length > 0 && <div className="s3-chips">{chips.map((c) => <span key={c.label} className="s3-chip"><span>{c.label}: </span><b>{c.text}</b></span>)}</div>}
          {ending && <ul className="s3-end" aria-label={T.remember}>{frame.end.map((l) => <li key={l.en}>{pick(l, lang)}</li>)}</ul>}
        </div>

        <p key={line} className="s3-line" aria-live="polite">{line}</p>
        {body && (showPanel ? <div className="s3-panel">{body}</div> : <div className="s3-hidden">{body}</div>)}

        <div className="s3-bar" role="group" aria-label={lang === 'hi' ? 'कहानी नियंत्रण' : 'Story controls'}>
          <button type="button" ref={playRef} className="s3-play" aria-label={ending ? T.again : paused ? T.play : T.pause} onClick={() => { if (ending) { setStep(0); setPaused(false); } else setPaused((p) => !p); }}>
            {ending ? <RotateCcw size={20} /> : paused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
          </button>
          <Progress step={step} auto={auto && !ending} ests={ests} onSeek={setStep} />
          <div className="s3-music" role="group" aria-label={T.sound}>
            {STYLES.map((st) => <button type="button" key={st} aria-pressed={sound === st} onClick={() => { const ok = audio.current.setStyle(st); setSound(ok ? st : 'off'); }}>{T[st]}</button>)}
          </div>
        </div>
        <p className="s3-note">{T.note}</p>
      </div>
    </div>
  );
}
