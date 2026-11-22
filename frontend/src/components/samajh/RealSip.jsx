import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Search } from 'lucide-react';
import useChartWidth from '../../hooks/useChartWidth';
import { fetchScheme, searchFunds } from '../../samajh/mfApi';
import { isPayoutPlan, parseNav, runSip, DAY_MS } from '../../samajh/realSip';
import { fill, formatInr } from '../../samajh/format';
import { recoveryNeeded } from '../../samajh/finance';
import ui from '../../content/samajh/ui.json';

/**
 * Real fund history: what a monthly SIP actually did, using the real daily NAVs that AMFI publishes
 * (read through mfapi.in). Facts only: history is never shown as a forecast, and when the data cannot be
 * loaded we say so instead of filling the gap with made-up numbers.
 */
const H = 150;
const PAD = { l: 58, r: 10, t: 12, b: 24 };
/** Short money labels for the chart axis: ₹70k, ₹1.1L, ₹2.5Cr */
const compact = (v) => (v >= 1e7 ? `₹${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${Math.round(v / 1e3)}k` : `₹${Math.round(v)}`);

const fmtDate = (t, lang) => new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(t);
const toYm = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const parseYm = (s) => String(s).split('-').map(Number);
const signed = (v, digits = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}%`;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Quick periods -> From/To months for the loaded fund. Returns { s, e, note } or { error }. */
function periodFor(key, arr, T, lang) {
  const first = arr[0].t; const last = arr[arr.length - 1].t; const ld = new Date(last);
  if (key === 'covid' || key === 'gfc') {
    const [a, b] = key === 'covid' ? [Date.UTC(2020, 0, 1), Date.UTC(2021, 2, 31)] : [Date.UTC(2007, 11, 1), Date.UTC(2010, 11, 31)];
    if (first > a + 62 * DAY_MS) return { error: fill(T.noDataForFall, { date: fmtDate(first, lang) }, lang) };
    return { s: toYm(Math.max(a, first)), e: toYm(Math.min(b, last)) };
  }
  if (key === 'max') return { s: toYm(first), e: toYm(last) };
  const years = Number(key);
  const start = Date.UTC(ld.getUTCFullYear() - years, ld.getUTCMonth(), 1);
  if (start < first) return { s: toYm(first), e: toYm(last), note: fill(T.shortHistory, { n: years }, lang) };
  return { s: toYm(start), e: toYm(last) };
}

/** A small SVG line chart drawn at its real width, so labels stay 12px on a phone. */
function Chart({ n, ariaLabel, max, xTicks, yFormat, layers, marks, shade, upto }) {
  const [ref, W] = useChartWidth(560);
  const iw = W - PAD.l - PAD.r; const ih = H - PAD.t - PAD.b;
  const X = (i) => PAD.l + (i / Math.max(1, n)) * iw;
  const Y = (v) => PAD.t + ih - (Math.max(0, v) / max) * ih;
  const step = Math.max(1, Math.ceil((n + 1) / 360));
  const idxs = []; for (let i = 0; i <= Math.min(upto, n); i += step) idxs.push(i);
  if (idxs[idxs.length - 1] !== Math.min(upto, n)) idxs.push(Math.min(upto, n));
  const pathOf = (data) => idxs.map((i, k) => `${k ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(data[i]).toFixed(1)}`).join('');
  // the money line is green while worth >= put in and red while below: draw it as runs
  const runs = (data, ref2) => {
    const out = []; let cur = null;
    idxs.forEach((i) => {
      const up = data[i] >= ref2[i];
      if (!cur || cur.up !== up) { if (cur) cur.pts.push(i); cur = { up, pts: [i] }; out.push(cur); } else cur.pts.push(i);
    });
    return out;
  };
  return (
    <svg ref={ref} className="samajh-svg" width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {[0, 1, 2, 3].map((g) => (
        <g key={g}><line className="samajh-grid" x1={PAD.l} x2={W - PAD.r} y1={Y((max * g) / 3)} y2={Y((max * g) / 3)} />
          <text className="samajh-tick" x={PAD.l - 6} y={Y((max * g) / 3) + 4} textAnchor="end">{yFormat((max * g) / 3)}</text></g>
      ))}
      {xTicks.map(([i, label]) => <text key={`${i}-${label}`} className="samajh-tick" x={X(i)} y={H - 6} textAnchor="middle">{label}</text>)}
      {shade && <rect className="real-shade" x={X(shade[0])} y={PAD.t} width={Math.max(1, X(shade[1]) - X(shade[0]))} height={ih} />}
      {layers.map((l) => (l.split
        ? runs(l.data, l.split).map((r, k) => <path key={k} d={r.pts.map((i, j) => `${j ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(l.data[i]).toFixed(1)}`).join('')} className={`real-line ${r.up ? 'real-up' : 'real-down'}`} fill="none" />)
        : <path key={l.key} d={pathOf(l.data)} className={`real-line ${l.cls}`} fill="none" strokeDasharray={l.dash} />))}
      {marks.filter((m) => !m.label && m.i <= upto).map((m) => <circle key={m.key} cx={X(m.i)} cy={Y(m.v)} r={m.r || 2.6} className={m.cls} />)}
      {shade && marks.filter((m) => m.label).map((m) => <text key={`t${m.key}`} className="samajh-tick real-mark" x={Math.min(W - 24, Math.max(PAD.l + 14, X(m.i)))} y={m.dy} textAnchor="middle">{m.label}</text>)}
    </svg>
  );
}

export default function RealSip({ lang }) {
  const T = ui[lang]?.real || ui.en.real;
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState(T.hintNote);
  const [fund, setFund] = useState(null); // { name, meta, arr }
  const [ctl, setCtl] = useState({ s: '', e: '', day: 5, amount: 5000, preset: '5' });
  const [periodNote, setPeriodNote] = useState('');
  const [fall, setFall] = useState(false);
  const [upto, setUpto] = useState(Infinity);
  const searchSeq = useRef(0); const raf = useRef(0); const cache = useRef(new Map());
  const bodyRef = useRef(null);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const search = useCallback(async (text) => {
    const term = text.trim();
    if (term.length < 3) { setStatus(T.tooShort); return; }
    const seq = ++searchSeq.current;
    setStatus(T.searching); setResults([]);
    try {
      const list = await searchFunds(term);
      if (seq !== searchSeq.current) return;
      if (!list.length) { setStatus(T.none); return; }
      const sorted = [...list].sort((a, b) => Number(isPayoutPlan(a.schemeName)) - Number(isPayoutPlan(b.schemeName))).slice(0, 25);
      setResults(sorted);
      setStatus(fill(list.length > 25 ? T.foundMore : T.found, { n: list.length, shown: 25 }, lang));
    } catch {
      if (seq === searchSeq.current) setStatus(T.offline);
    }
  }, [T, lang]);

  const pick = useCallback(async (code, name) => {
    setStatus(T.loading);
    try {
      let json = cache.current.get(code);
      if (!json) { json = await fetchScheme(code); cache.current.set(code, json); }
      const arr = parseNav(json);
      if (arr.length < 40) { setStatus(T.tooLittle); return; }
      const p = periodFor('5', arr, T, lang);
      setFund({ name: json.meta?.scheme_name || name, meta: json.meta || {}, arr });
      setCtl((c) => ({ ...c, s: p.s, e: p.e, preset: '5' }));
      setPeriodNote(p.note || ''); setFall(false); setUpto(Infinity);
      setStatus(fill(T.loaded, { date: fmtDate(arr[arr.length - 1].t, lang) }, lang));
      requestAnimationFrame(() => bodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch {
      setStatus(T.offline);
    }
  }, [T, lang]);

  const applyPreset = (key) => {
    const p = periodFor(key, fund.arr, T, lang);
    if (p.error) { setPeriodNote(p.error); return; }
    setCtl((c) => ({ ...c, s: p.s, e: p.e, preset: key })); setPeriodNote(p.note || ''); setFall(false); setUpto(Infinity);
  };
  const setField = (patch) => { setCtl((c) => ({ ...c, ...patch, preset: '' })); setFall(false); setUpto(Infinity); };

  const res = useMemo(() => {
    if (!fund || !ctl.s || !ctl.e) return null;
    return runSip({ arr: fund.arr, start: parseYm(ctl.s), end: parseYm(ctl.e), day: ctl.day, amount: ctl.amount });
  }, [fund, ctl]);

  const replay = () => {
    if (!res) return;
    cancelAnimationFrame(raf.current);
    if (reducedMotion()) { setUpto(Infinity); return; }
    const t0 = performance.now(); const dur = Math.min(7000, Math.max(3000, res.N * 1.6));
    const frame = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      setUpto(k >= 1 ? Infinity : Math.max(2, Math.round(k * (res.N - 1))));
      if (k < 1) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  // ---- everything the screen shows is worked out here, from the real numbers
  const lastT = fund ? fund.arr[fund.arr.length - 1].t : 0;
  const stale = fund && (Date.now() - lastT) / DAY_MS > 45;
  const show = res ? Math.min(upto, res.N - 1) : 0;
  const inv = res ? res.inv[show] : 0; const val = res ? res.val[show] : 0; const gain = val - inv;
  let notes = '';
  if (fund && ctl.s && ctl.e && !res) {
    const [sy, sm] = parseYm(ctl.s); const [ey, em] = parseYm(ctl.e);
    notes = Date.UTC(ey, em - 1, 1) < Date.UTC(sy, sm - 1, 1) ? T.badDates : T.noInstalments;
  } else if (res) {
    notes = [periodNote, res.skipped ? fill(T.skipped, { n: res.skipped }, lang) : '', fill(T.period, { a: fmtDate(res.buys[0].t, lang), b: fmtDate(res.T[res.N - 1], lang) }, lang)].filter(Boolean).join(' ');
  }

  const xTicks = useMemo(() => {
    if (!res) return [];
    const yrs = []; let ly = -1;
    res.T.forEach((t, i) => { const y = new Date(t).getUTCFullYear(); if (y !== ly) { yrs.push([i, String(y)]); ly = y; } });
    const every = Math.max(1, Math.ceil(yrs.length / 5));
    return yrs.filter((_, k) => k % every === 0);
  }, [res]);

  const dd = res?.dd;
  const fallText = useMemo(() => {
    if (!res || !fund) return null;
    const a = fund.arr; const d = res.dd;
    if (d.pct < 1) return [T.fallNone];
    const low = d.low - res.i0;
    const lines = [fill(T.fall, { pct: d.pct, peakDate: fmtDate(a[d.peak].t, lang), peakNav: a[d.peak].nav, lowDate: fmtDate(a[d.low].t, lang), lowNav: a[d.low].nav, days: Math.round((a[d.low].t - a[d.peak].t) / DAY_MS) }, lang)];
    lines.push(d.rec < 0
      ? fill(T.fallNotBack, { date: fmtDate(a[a.length - 1].t, lang) }, lang)
      : fill(T.fallBack, { date: fmtDate(a[d.rec].t, lang), months: Math.round((a[d.rec].t - a[d.low].t) / 2629800000) }, lang));
    if (low >= 0) lines.push(fill(T.fallSip, { inv: res.inv[low], val: res.val[low] }, lang));
    lines.push(fill(T.fallMaths, { pct: d.pct, need: recoveryNeeded(d.pct) }, lang));
    return lines;
  }, [res, fund, T, lang]);

  const summary = res ? fill(T.summary, { a: fmtDate(res.buys[0].t, lang), b: fmtDate(res.T[res.N - 1], lang), inv: res.invested, n: res.buys.length, end: fmtDate(res.T[res.N - 1], lang), val: res.value, pct: signed(res.gainPct) }, lang) : '';

  const marks = res ? [
    ...(res.bi.length <= 140 ? res.bi.map((i) => ({ key: `b${i}`, i, v: res.nav[i], cls: 'real-buy' })) : []),
    ...(fall && dd && dd.pct >= 1 ? [
      { key: 'pk', i: dd.peak - res.i0, v: res.nav[dd.peak - res.i0], r: 0, cls: '', label: T.peak, dy: PAD.t + 11 },
      { key: 'lw', i: dd.low - res.i0, v: res.nav[dd.low - res.i0], r: 0, cls: '', label: T.low, dy: H - PAD.b - 6 },
    ] : []),
  ] : [];
  const shade = fall && dd && dd.pct >= 1 ? [dd.peak - res.i0, dd.low - res.i0] : null;

  return (
    <div className="real">
      <p className="real-sub">{T.sub}</p>
      <div className="real-box">
        <form className="real-search" onSubmit={(e) => { e.preventDefault(); search(q); }}>
          <label className="sr-only" htmlFor="real-q">{T.searchLabel}</label>
          <input id="real-q" className="real-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.placeholder} autoComplete="off" enterKeyHint="search" />
          <button type="submit" className="real-btn real-primary"><Search size={16} aria-hidden="true" /> {T.searchBtn}</button>
        </form>
        <div className="real-chips" role="group" aria-label={T.hintsLabel}>
          {T.hints.map((h) => <button key={h} type="button" className="real-chip" onClick={() => { setQ(h); search(h); }}>{h}</button>)}
        </div>
        {results.length > 0 && (
          <ul className="real-results">
            {results.map((f) => {
              const bad = isPayoutPlan(f.schemeName);
              return (
                <li key={f.schemeCode}>
                  <button type="button" className="real-item" disabled={bad} onClick={() => pick(f.schemeCode, f.schemeName)}>
                    {f.schemeName}{bad && <small>{T.payout}</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="real-status" role="status" aria-live="polite">{status}</p>
      </div>

      {fund && (
        <div className="real-body" ref={bodyRef}>
          <div className="real-box">
            <h3 className="real-fund">{fund.name}</h3>
            <p className="real-meta">
              {[fund.meta.fund_house, fund.meta.scheme_category].filter(Boolean).join(' · ')}
              {' · '}{fill(T.meta, { first: fmtDate(fund.arr[0].t, lang), nav: fund.arr[fund.arr.length - 1].nav.toFixed(4), last: fmtDate(lastT, lang) }, lang)}
            </p>
            {stale && <p className="real-warn" role="note">⚠ {fill(T.stale, { date: fmtDate(lastT, lang) }, lang)}</p>}
          </div>

          <div className="real-box real-controls">
            <div className="real-chips" role="group" aria-label={T.periodsLabel}>
              {Object.keys(T.periods).map((k) => <button key={k} type="button" className="real-chip" aria-pressed={ctl.preset === k} onClick={() => applyPreset(k)}>{T.periods[k]}</button>)}
            </div>
            <div className="real-grid2">
              <label>{T.from}<input type="month" className="real-input" value={ctl.s} min={toYm(fund.arr[0].t)} max={toYm(lastT)} onChange={(e) => setField({ s: e.target.value })} /></label>
              <label>{T.to}<input type="month" className="real-input" value={ctl.e} min={toYm(fund.arr[0].t)} max={toYm(lastT)} onChange={(e) => setField({ e: e.target.value })} /></label>
              <label>{T.sipDate}
                <select className="real-input" value={ctl.day} onChange={(e) => setField({ day: Number(e.target.value) })}>
                  {Array.from({ length: 28 }, (_, k) => k + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label>{T.amount}: <b>{formatInr(ctl.amount, lang)}</b>
                <input type="range" min="500" max="50000" step="500" value={ctl.amount} onChange={(e) => setField({ amount: Number(e.target.value) })} />
              </label>
            </div>
            <p className="real-note" role="status" aria-live="polite">{notes}</p>
          </div>

          {res && (
            <>
              <div className="real-stats">
                <div><span>{T.putIn}</span><b>{formatInr(inv, lang)}</b></div>
                <div><span>{T.worth}</span><b className={val >= inv ? 'real-pos' : 'real-neg'}>{formatInr(val, lang)}</b></div>
                <div><span>{T.gain}</span><b className={gain >= 0 ? 'real-pos' : 'real-neg'}>{gain >= 0 ? '+' : '−'}{formatInr(Math.abs(gain), lang)} ({signed(inv ? (gain / inv) * 100 : 0)})</b></div>
                <div><span>{T.units}</span><b>{res.units.toFixed(3)}</b></div>
                <div><span>{T.avgCost}</span><b>₹{res.avgCost.toFixed(2)}</b></div>
                <div><span>{T.xirr}</span><b title={res.xirr == null ? T.xirrNote : ''} className={res.xirr == null ? '' : res.xirr >= 0 ? 'real-pos' : 'real-neg'}>{res.xirr == null ? T.xirrNA : signed(res.xirr * 100)}</b></div>
              </div>
              <p className="real-cap">{T.navChart}</p>
              <Chart n={res.N - 1} upto={show} max={Math.max(...res.nav) * 1.06} xTicks={xTicks} yFormat={(v) => String(Math.round(v))}
                ariaLabel={fill(T.navAria, { name: fund.name }, lang)} layers={[{ key: 'nav', data: res.nav, cls: 'real-nav' }]} marks={marks} shade={shade} />
              <p className="real-cap">{T.moneyChart}</p>
              <Chart n={res.N - 1} upto={show} max={Math.max(res.invested, ...res.val) * 1.06} xTicks={xTicks} yFormat={compact}
                ariaLabel={T.moneyAria} layers={[{ key: 'inv', data: res.inv, cls: 'real-inv', dash: '5 5' }, { key: 'val', data: res.val, split: res.inv }]} marks={[]} shade={shade} />
              <div className="real-actions">
                <button type="button" className="real-btn real-primary" onClick={replay}><Play size={16} aria-hidden="true" /> {T.replay}</button>
                <button type="button" className="real-btn" aria-pressed={fall} onClick={() => setFall((v) => !v)}>{fall ? T.hideFall : T.showFall}</button>
              </div>
              <p className="real-summary" aria-live="polite">{summary}</p>
              {fall && fallText && <div className="real-fall" role="note">{fallText.map((t) => <p key={t}>{t}</p>)}</div>}

              <h3 className="real-h">{T.tableTitle}</h3>
              <p className="real-sub">{T.tableSub}</p>
              <div className="samajh-scroll real-table">
                <table className="samajh-table">
                  <thead><tr>{T.tHead.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                  <tbody>
                    {(() => { let cum = 0; return res.buys.map((b) => { cum += b.units; return <tr key={b.idx}><td>{fmtDate(b.t, lang)}</td><td>₹{b.nav.toFixed(4)}</td><td>{b.units.toFixed(3)}</td><td>{cum.toFixed(3)}</td></tr>; }); })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <details className="real-details"><summary>{T.howTitle}</summary><p>{T.how}</p></details>
          <details className="real-details"><summary>{T.payoutTitle}</summary><p>{T.payoutBody}</p></details>
        </div>
      )}
      <p className="real-source">{T.source}</p>
    </div>
  );
}
