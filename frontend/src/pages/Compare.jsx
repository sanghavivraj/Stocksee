import { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import SymbolSearchInput from '../components/SymbolSearchInput';
import api from '../services/api';
import { formatPrice } from '../utils/formatPrice';
import { formatMovePercent, shortName } from '../utils/insightCopy';
import { pick } from '../utils/pickLanguage';

/**
 * Compare two stocks: side-by-side facts about the last year. It never says which is better.
 */
const COPY = {
  en: {
    kicker: 'COMPARE', title: 'Compare two stocks', sub: 'Facts about the last year, side by side. This does not say which is better.',
    first: 'First stock', second: 'Second stock', go: 'Compare', working: 'Comparing…', pick: 'Pick two different stocks from the suggestions.',
    failed: 'Could not compare these right now. Please try again.',
    rows: {
      price: 'Price', week: '1 week', month: '1 month', threeMonths: '3 months', sixMonths: '6 months', year: '1 year',
      daily: 'Typical daily move', swing: 'Yearly swing', range: 'Where it sits in its 52-week range', high: '52-week high', low: '52-week low',
      drawdown: 'Worst fall from a peak (1 year)', best: 'Best day', worst: 'Worst day', traded: 'Average traded value a day',
    },
    groups: { returns: 'What it returned', swings: 'How much it swings', range: 'Its range', days: 'Extremes', size: 'Size of trading' },
    hints: { daily: 'About how much it moves in a normal day, up or down.', swing: 'The same swing stretched to a year.', range: '0% = at its 52-week low, 100% = at its 52-week high.' },
    chart: 'Both prices, rebased to 100 a year ago', together: (n) => `Day to day, how closely the two moved together: ${n} (100 = always together, 0 = unrelated, below 0 = opposite).`,
    crore: 'crore', note: 'Past data only. Not a ranking, not advice.',
  },
  hi: {
    kicker: 'तुलना', title: 'दो शेयरों की तुलना', sub: 'पिछले एक साल के तथ्य, आमने-सामने। यह नहीं बताता कि कौन बेहतर है।',
    first: 'पहला शेयर', second: 'दूसरा शेयर', go: 'तुलना करें', working: 'तुलना हो रही है…', pick: 'सुझावों में से दो अलग शेयर चुनें।',
    failed: 'अभी तुलना नहीं हो सकी। कृपया फिर कोशिश करें।',
    rows: {
      price: 'भाव', week: '1 सप्ताह', month: '1 महीना', threeMonths: '3 महीने', sixMonths: '6 महीने', year: '1 साल',
      daily: 'सामान्य दैनिक चाल', swing: 'सालाना उतार-चढ़ाव', range: '52 सप्ताह की सीमा में स्थिति', high: '52 सप्ताह का उच्च', low: '52 सप्ताह का निम्न',
      drawdown: 'शिखर से सबसे बड़ी गिरावट (1 साल)', best: 'सबसे अच्छा दिन', worst: 'सबसे बुरा दिन', traded: 'रोज़ का औसत कारोबार मूल्य',
    },
    groups: { returns: 'कितना रिटर्न मिला', swings: 'कितना हिलता है', range: 'इसकी सीमा', days: 'चरम दिन', size: 'कारोबार का आकार' },
    hints: { daily: 'सामान्य दिन में लगभग कितना ऊपर या नीचे चलता है।', swing: 'वही उतार-चढ़ाव एक साल के हिसाब से।', range: '0% = 52 सप्ताह के निम्न पर, 100% = 52 सप्ताह के उच्च पर।' },
    chart: 'दोनों भाव, एक साल पहले को 100 मानकर', together: (n) => `रोज़ के हिसाब से दोनों कितने साथ चले: ${n} (100 = हमेशा साथ, 0 = कोई संबंध नहीं, 0 से कम = उलटे)।`,
    crore: 'करोड़', note: 'सिर्फ पुराना डेटा। रैंकिंग नहीं, सलाह नहीं।',
  },
  gu: {
    kicker: 'સરખામણી', title: 'બે શેરની સરખામણી', sub: 'છેલ્લા એક વર્ષના તથ્યો, સામસામે. આ કહેતું નથી કે કયો સારો છે.',
    first: 'પહેલો શેર', second: 'બીજો શેર', go: 'સરખામણી કરો', working: 'સરખામણી થઈ રહી છે…', pick: 'સૂચનોમાંથી બે અલગ શેર પસંદ કરો.',
    failed: 'હાલ સરખામણી થઈ શકી નથી. ફરી પ્રયત્ન કરો.',
    rows: {
      price: 'ભાવ', week: '1 અઠવાડિયું', month: '1 મહિનો', threeMonths: '3 મહિના', sixMonths: '6 મહિના', year: '1 વર્ષ',
      daily: 'સામાન્ય દૈનિક ચાલ', swing: 'વાર્ષિક ઉતાર-ચઢાવ', range: '52 અઠવાડિયાની રેન્જમાં સ્થાન', high: '52 અઠવાડિયાનો ઊંચો', low: '52 અઠવાડિયાનો નીચો',
      drawdown: 'શિખરથી સૌથી મોટો ઘટાડો (1 વર્ષ)', best: 'સૌથી સારો દિવસ', worst: 'સૌથી ખરાબ દિવસ', traded: 'રોજનું સરેરાશ ટ્રેડિંગ મૂલ્ય',
    },
    groups: { returns: 'કેટલું રિટર્ન મળ્યું', swings: 'કેટલો હલે છે', range: 'તેની રેન્જ', days: 'અંતિમ દિવસો', size: 'ટ્રેડિંગનું કદ' },
    hints: { daily: 'સામાન્ય દિવસે લગભગ કેટલો ઉપર કે નીચે ચાલે છે.', swing: 'એ જ ઉતાર-ચઢાવ એક વર્ષ માટે.', range: '0% = 52 અઠવાડિયાના નીચા પર, 100% = 52 અઠવાડિયાના ઊંચા પર.' },
    chart: 'બંને ભાવ, એક વર્ષ પહેલાંને 100 ગણીને', together: (n) => `રોજેરોજ બંને કેટલા સાથે ચાલ્યા: ${n} (100 = હંમેશાં સાથે, 0 = કોઈ સંબંધ નહીં, 0 થી ઓછું = ઉલટા).`,
    crore: 'કરોડ', note: 'ફક્ત ભૂતકાળનો ડેટા. રેન્કિંગ નથી, સલાહ નથી.',
  },
};

const W = 720;
const H = 240;
const PAD = { l: 44, r: 16, t: 12, b: 24 };

const RebasedChart = ({ a, b, label }) => {
  const g = useMemo(() => {
    const vals = [...a.series, ...b.series].map((p) => p.value);
    const lo = Math.min(...vals) - 3;
    const hi = Math.max(...vals) + 3;
    const x = (i, n) => PAD.l + (i / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r);
    const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const path = (s) => s.map((p, i) => `${i ? 'L' : 'M'}${x(i, s.length).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
    return { lo, hi, y, pa: path(a.series), pb: path(b.series) };
  }, [a, b]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="replay-svg" role="img" aria-label={label}>
      {[g.hi, 100, g.lo].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={g.y(v)} y2={g.y(v)} className={v === 100 ? 'replay-zero' : 'replay-grid'} />
          <text x={PAD.l - 6} y={g.y(v) + 4} textAnchor="end" className="replay-tick">{Math.round(v)}</text>
        </g>
      ))}
      <path d={g.pa} className="replay-line replay-line-1" fill="none" />
      <path d={g.pb} className="replay-line replay-line-2" fill="none" />
    </svg>
  );
};

const Compare = () => {
  const { language, addToast } = useContext(UserContext);
  const T = pick(COPY, language);
  const [params] = useSearchParams();
  const startA = (params.get('a') || '').toUpperCase().slice(0, 30);
  const startB = (params.get('b') || '').toUpperCase().slice(0, 30);
  const [inputA, setInputA] = useState(startA);
  const [inputB, setInputB] = useState(startB);
  const [pickA, setPickA] = useState(startA || null);
  const [pickB, setPickB] = useState(startB || null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);

  const run = async (e, a = pickA, b = pickB) => {
    e?.preventDefault();
    if (!a || !b || a === b) { addToast(T.pick, 'info'); return; }
    setBusy(true);
    try {
      const res = await api.get('/api/markets/compare', { params: { a, b } });
      setData(res.data);
    } catch (err) {
      setData(null);
      addToast(err.userMessage || T.failed, 'error');
    } finally {
      setBusy(false);
    }
  };

  // A shared link (/compare?a=TCS.NS&b=INFY.NS) compares straight away
  useEffect(() => {
    if (startA && startB) run(null, startA, startB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = (x, v) => (v === null || v === undefined ? '—' : formatPrice(v, x.currency));
  const pct = (v) => (v === null || v === undefined ? '—' : formatMovePercent(v));
  const sign = (v) => (v > 0 ? 'cue-up' : v < 0 ? 'cue-down' : '');
  const rows = data && [
    [T.groups.returns, [
      [T.rows.price, (x) => money(x, x.price)],
      [T.rows.week, (x) => pct(x.returns.week), (x) => sign(x.returns.week)],
      [T.rows.month, (x) => pct(x.returns.month), (x) => sign(x.returns.month)],
      [T.rows.threeMonths, (x) => pct(x.returns.threeMonths), (x) => sign(x.returns.threeMonths)],
      [T.rows.sixMonths, (x) => pct(x.returns.sixMonths), (x) => sign(x.returns.sixMonths)],
      [T.rows.year, (x) => pct(x.returns.year), (x) => sign(x.returns.year)],
    ]],
    [T.groups.swings, [
      [T.rows.daily, (x) => (x.typicalDailyMovePercent == null ? '—' : `±${x.typicalDailyMovePercent}%`), null, T.hints.daily],
      [T.rows.swing, (x) => (x.yearlySwingPercent == null ? '—' : `±${x.yearlySwingPercent}%`), null, T.hints.swing],
      [T.rows.drawdown, (x) => pct(x.maxDrawdownPercent)],
    ]],
    [T.groups.range, [
      [T.rows.high, (x) => money(x, x.high52)],
      [T.rows.low, (x) => money(x, x.low52)],
      [T.rows.range, (x) => (x.positionInRangePercent == null ? '—' : `${x.positionInRangePercent}%`), null, T.hints.range],
    ]],
    [T.groups.days, [
      [T.rows.best, (x) => `${pct(x.bestDay.percent)} · ${x.bestDay.date}`],
      [T.rows.worst, (x) => `${pct(x.worstDay.percent)} · ${x.worstDay.date}`],
    ]],
    [T.groups.size, [
      [T.rows.traded, (x) => (x.avgTradedValueCrore == null ? '—' : `₹${x.avgTradedValueCrore} ${T.crore}`)],
    ]],
  ];

  return (
    <div className="editorial-page-container">
      <header className="editorial-lead-header">
        <div className="lead-meta-row"><span className="editorial-kicker">{T.kicker}</span></div>
        <h1 className="lead-headline"><Scale size={26} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />{T.title}</h1>
        <p className="lead-description">{T.sub}</p>
      </header>

      <form className="compare-form" onSubmit={run}>
        <label className="compare-field">
          <span className="form-field-label">{T.first}</span>
          <SymbolSearchInput id="cmp-a" value={inputA} onChange={(v) => { setInputA(v); setPickA(null); }} onSelect={(item) => { setInputA(item.symbol); setPickA(item.symbol); }} placeholder="e.g. TCS" />
        </label>
        <label className="compare-field">
          <span className="form-field-label">{T.second}</span>
          <SymbolSearchInput id="cmp-b" value={inputB} onChange={(v) => { setInputB(v); setPickB(null); }} onSelect={(item) => { setInputB(item.symbol); setPickB(item.symbol); }} placeholder="e.g. INFY" />
        </label>
        <button type="submit" className="btn-editorial btn-editorial-primary" disabled={busy || !pickA || !pickB}>{busy ? T.working : T.go}</button>
      </form>

      {data && (
        <section className="compare-result" aria-live="polite">
          <div className="compare-legend">
            <span><i className="replay-swatch replay-line-1" aria-hidden="true" />{shortName(data.a.symbol)} · {data.a.name}</span>
            <span><i className="replay-swatch replay-line-2" aria-hidden="true" />{shortName(data.b.symbol)} · {data.b.name}</span>
          </div>
          <div className="replay-card">
            <p className="briefing-label">{T.chart}</p>
            <RebasedChart a={data.a} b={data.b} label={T.chart} />
          </div>

          <table className="compare-table">
            <thead>
              <tr><th scope="col"></th><th scope="col">{shortName(data.a.symbol)}</th><th scope="col">{shortName(data.b.symbol)}</th></tr>
            </thead>
            {rows.map(([group, items]) => (
              <tbody key={group}>
                <tr className="compare-group"><th colSpan={3}>{group}</th></tr>
                {items.map(([label, get, cls, hint]) => (
                  <tr key={label}>
                    <th scope="row" title={hint || undefined}>{label}</th>
                    <td className={cls ? cls(data.a) : ''}>{get(data.a)}</td>
                    <td className={cls ? cls(data.b) : ''}>{get(data.b)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          {data.movedTogetherPercent != null && <p className="briefing-muted">{T.together(data.movedTogetherPercent)}</p>}
          <p className="unusual-disclaimer">{T.note}</p>
        </section>
      )}
    </div>
  );
};

export default Compare;
