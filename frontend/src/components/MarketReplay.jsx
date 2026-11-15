import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { useWatchlist } from '../context/WatchlistContext';
import marketService from '../services/marketService';
import { formatPercent, shortName } from '../utils/insightCopy';

/**
 * Market replay: the latest session in 5-minute steps for NIFTY and up to 4 watchlist stocks, as % change
 * from the previous close. A look back at what happened. Not a forecast.
 */
const COPY = {
  en: {
    kicker: 'MARKET REPLAY',
    title: 'Replay the session',
    sub: (d) => `Session of ${d}. Each line is the % change from the previous close. Drag the slider or press play.`,
    play: 'Play', pause: 'Pause', at: 'Time',
    table: 'Values at this time',
    facts: 'Moments worth knowing',
    swing: (v, a, b) => `biggest 15-minute swing: ${v} (${a} to ${b})`,
    volume: (v, t) => `busiest 5 minutes: ${v}× typical volume, at ${t}`,
    addStocks: 'Add stocks to your watchlist to compare them with NIFTY here.',
    note: 'A look back at what happened. Not a forecast.',
    unavailable: 'Intraday replay is unavailable right now.',
    loading: 'Loading the session…',
  },
  hi: {
    kicker: 'मार्केट रीप्ले',
    title: 'सत्र को दोबारा देखें',
    sub: (d) => `${d} का सत्र। हर रेखा पिछले बंद भाव से % बदलाव है। स्लाइडर खींचें या प्ले दबाएं।`,
    play: 'प्ले', pause: 'रोकें', at: 'समय',
    table: 'इस समय के मान',
    facts: 'जानने लायक पल',
    swing: (v, a, b) => `सबसे बड़ा 15 मिनट का उतार-चढ़ाव: ${v} (${a} से ${b})`,
    volume: (v, t) => `सबसे व्यस्त 5 मिनट: सामान्य वॉल्यूम का ${v} गुना, ${t} पर`,
    addStocks: 'यहाँ निफ्टी से तुलना के लिए अपनी वॉचलिस्ट में शेयर जोड़ें।',
    note: 'जो हुआ उस पर एक नज़र। भविष्यवाणी नहीं।',
    unavailable: 'इंट्राडे रीप्ले अभी उपलब्ध नहीं है।',
    loading: 'सत्र लोड हो रहा है…',
  },
  gu: {
    kicker: 'માર્કેટ રિપ્લે',
    title: 'સત્ર ફરી જુઓ',
    sub: (d) => `${d} નું સત્ર. દરેક રેખા અગાઉના બંધ ભાવથી % ફેરફાર છે. સ્લાઇડર ખેંચો અથવા પ્લે દબાવો.`,
    play: 'પ્લે', pause: 'થોભો', at: 'સમય',
    table: 'આ સમયના મૂલ્યો',
    facts: 'જાણવા જેવી પળો',
    swing: (v, a, b) => `સૌથી મોટો 15 મિનિટનો ઉતાર-ચઢાવ: ${v} (${a} થી ${b})`,
    volume: (v, t) => `સૌથી વ્યસ્ત 5 મિનિટ: સામાન્ય વોલ્યુમ કરતાં ${v} ગણું, ${t} વાગ્યે`,
    addStocks: 'અહીં નિફ્ટી સાથે સરખામણી માટે વૉચલિસ્ટમાં શેર ઉમેરો.',
    note: 'જે થયું તેના પર એક નજર. આગાહી નથી.',
    unavailable: 'ઇન્ટ્રાડે રિપ્લે હાલ ઉપલબ્ધ નથી.',
    loading: 'સત્ર લોડ થઈ રહ્યું છે…',
  },
};

const W = 720;
const H = 280;
const PAD = { l: 44, r: 96, t: 14, b: 26 };

const MarketReplay = () => {
  const { language } = useContext(UserContext);
  const { symbols } = useWatchlist();
  const T = COPY[language] || COPY.en;
  const [state, setState] = useState({ status: 'loading', data: null });
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);
  const key = symbols.filter((s) => !s.startsWith('^')).slice(0, 4).join(',');

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null });
    marketService.getReplay(key ? key.split(',') : [])
      .then((data) => {
        if (!alive) return;
        setState({ status: 'ready', data });
        setIndex(data.times.length - 1);
      })
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => { alive = false; };
  }, [key]);

  const { status, data } = state;
  const last = data ? data.times.length - 1 : 0;

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setIndex((i) => {
        if (i >= last) { setPlaying(false); return last; }
        return i + 1;
      });
    }, 120);
    return () => clearInterval(timer.current);
  }, [playing, last]);

  const geometry = useMemo(() => {
    if (!data) return null;
    const values = data.series.flatMap((s) => s.bars.map((b) => b.percent)).concat(0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const pad = Math.max((max - min) * 0.1, 0.1);
    const lo = min - pad;
    const hi = max + pad;
    const x = (i) => PAD.l + (i / Math.max(last, 1)) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    // One value per time step; a short gap (up to 3 steps) keeps the last real value, longer gaps stay empty
    const aligned = data.series.map((sr) => {
      const map = new Map(sr.bars.map((b) => [b.time, b.percent]));
      let lastValue;
      let age = 0;
      return data.times.map((t) => {
        if (map.has(t)) { lastValue = map.get(t); age = 0; return lastValue; }
        age += 1;
        return lastValue !== undefined && age <= 3 ? lastValue : undefined;
      });
    });
    const paths = aligned.map((vals) => {
      let d = '';
      let pen = false;
      vals.forEach((v, i) => {
        if (v === undefined) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      return d;
    });
    return { x, y, aligned, paths, lo, hi };
  }, [data, last]);

  if (status === 'loading') {
    return (
      <section className="editorial-flow-section" aria-label={T.title}>
        <div className="flow-section-header"><div><span className="flow-kicker">{T.kicker}</span><h3 className="flow-title">{T.title}</h3></div></div>
        <div className="skeleton feed-skeleton-item" aria-label={T.loading}></div>
      </section>
    );
  }
  if (status === 'error' || !data || !geometry) {
    return (
      <section className="editorial-flow-section" aria-label={T.title}>
        <div className="flow-section-header"><div><span className="flow-kicker">{T.kicker}</span><h3 className="flow-title">{T.title}</h3></div></div>
        <p className="unusual-empty">{T.unavailable}</p>
      </section>
    );
  }

  const time = data.times[index];
  const stocks = data.series.filter((s) => !s.isBenchmark);
  const colorClass = (si) => (data.series[si].isBenchmark ? 'replay-line-bench' : `replay-line-${Math.min(si, 4)}`);
  const ticks = [geometry.hi, 0, geometry.lo].map((v) => Number(v.toFixed(2)));

  return (
    <section className="editorial-flow-section replay-section" aria-label={T.title}>
      <div className="flow-section-header">
        <div>
          <span className="flow-kicker">{T.kicker}</span>
          <h3 className="flow-title">{T.title}</h3>
          <p className="unusual-sub">{T.sub(data.date)}</p>
        </div>
      </div>

      <div className="replay-card">
        <svg viewBox={`0 0 ${W} ${H}`} className="replay-svg" role="img" aria-label={`${T.title}: ${data.series.map((s) => shortName(s.name || s.symbol)).join(', ')}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={geometry.y(v)} y2={geometry.y(v)} className={v === 0 ? 'replay-zero' : 'replay-grid'} />
              <text x={PAD.l - 6} y={geometry.y(v) + 4} textAnchor="end" className="replay-tick">{v > 0 ? '+' : ''}{v}%</text>
            </g>
          ))}
          <text x={PAD.l} y={H - 6} className="replay-tick">{data.times[0]}</text>
          <text x={W - PAD.r} y={H - 6} textAnchor="end" className="replay-tick">{data.times[last]}</text>

          {data.series.map((s, si) => (
            <path key={s.symbol} d={geometry.paths[si]} className={`replay-line ${colorClass(si)}`} fill="none" />
          ))}

          {/* the moment being replayed */}
          <line x1={geometry.x(index)} x2={geometry.x(index)} y1={PAD.t} y2={H - PAD.b} className="replay-cursor" />
          {data.series.map((s, si) => {
            const v = geometry.aligned[si][index];
            if (v === undefined) return null;
            return (
              <g key={`dot-${s.symbol}`}>
                <circle cx={geometry.x(index)} cy={geometry.y(v)} r="5" className={`replay-dot ${colorClass(si)}`} />
                {index === last && (
                  <text x={geometry.x(index) + 9} y={geometry.y(v) + 4} className="replay-end-label">{s.isBenchmark ? 'NIFTY' : shortName(s.symbol)}</text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="replay-controls">
          <button type="button" className="editorial-chip-btn" onClick={() => { if (index >= last) setIndex(0); setPlaying((p) => !p); }}>
            {playing ? <Pause size={12} /> : <Play size={12} />} {playing ? T.pause : T.play}
          </button>
          <input
            type="range" min="0" max={last} value={index}
            onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }}
            aria-label={T.at} className="replay-slider"
          />
          <strong className="replay-time">{time}</strong>
        </div>

        <table className="replay-table" aria-label={T.table}>
          <tbody>
            {data.series.map((s, si) => {
              const v = geometry.aligned[si][index];
              return (
                <tr key={s.symbol}>
                  <td><span className={`replay-swatch ${colorClass(si)}`} aria-hidden="true"></span>{s.isBenchmark ? 'NIFTY 50' : shortName(s.symbol)}</td>
                  <td className={`replay-val ${v > 0 ? 'cue-up' : v < 0 ? 'cue-down' : ''}`}>{v === undefined ? '—' : formatPercent(v)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {stocks.length === 0 ? (
          <p className="briefing-muted">{T.addStocks}</p>
        ) : stocks.some((s) => s.moments.length) && (
          <div className="replay-facts">
            <p className="briefing-label">{T.facts}</p>
            <ul>
              {stocks.flatMap((s) => s.moments.map((m) => (
                <li key={`${s.symbol}-${m.type}`}>
                  <strong>{shortName(s.symbol)}</strong>{' '}
                  {m.type === 'swing' ? T.swing(formatPercent(m.value), m.from, m.time) : T.volume(m.value, m.time)}
                </li>
              )))}
            </ul>
          </div>
        )}
        <p className="unusual-disclaimer">{T.note}</p>
      </div>
    </section>
  );
};

export default MarketReplay;
