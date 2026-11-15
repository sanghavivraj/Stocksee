import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, AlertTriangle, Bell, BookmarkPlus, Check, Eye, ShieldCheck } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { useWatchlist } from '../context/WatchlistContext';
import marketService from '../services/marketService';
import alertService from '../services/alertService';

/**
 * "Stocks behaving unusually today", written for someone who has never read a stock chart.
 *  - each card says ONE thing in plain words; the numbers are folded away under "See the numbers"
 *  - only a few cards at first, with "Show more"
 * Facts about what already happened. No direction, no target, no recommendation.
 */
const SHOW_FIRST = 3;

const COPY = {
  en: {
    kicker: 'UNUSUAL ACTIVITY',
    title: 'Stocks behaving unusually today',
    howTitle: 'How to read this page',
    how: [
      'These are stocks that did something out of the ordinary today.',
      'Unusual is not good or bad, and it does not tell you what will happen next.',
      'Use it to decide what to look at more closely. Being on this list is not a reason to buy or sell.',
    ],
    summary: (total, n, k, date) => `We checked ${total} stocks (as of ${date}). ${n} stood out strongly and ${k} more are worth a look.`,
    strongTitle: 'Stood out the most today',
    notableTitle: 'Also worth a look',
    noStrong: 'No stock stood out strongly today.',
    noNotable: 'Nothing else stands out today.',
    more: (m) => `Show ${m} more`, fewer: 'Show fewer',
    headline: {
      big_move: 'Moved much more than usual today',
      volume_spike: 'Many more shares traded than usual',
      gap: 'Started the day far from yesterday’s price',
      new_52w_high: 'Reached its highest price in a year',
      new_52w_low: 'Fell to its lowest price in a year',
      near_52w_high: 'Close to its highest price of the year',
      near_52w_low: 'Close to its lowest price of the year',
    },
    thin: 'Small company. Be extra careful with any tip about it.',
    numbers: 'See the numbers',
    facts: {
      big_move: (v, x) => `Price moved ${v > 0 ? '+' : ''}${v}% in a day, about ${x}× its usual daily move.`,
      volume_spike: (v) => `${v}× the number of shares it usually trades in a day.`,
      gap: (v) => `Opened ${v > 0 ? '+' : ''}${v}% away from yesterday’s closing price.`,
      new_52w_high: (v) => `Traded above its previous 52-week high of ${v}.`,
      new_52w_low: (v) => `Traded below its previous 52-week low of ${v}.`,
      near_52w_high: (v, x, d) => `Within ${d}% of its 52-week high of ${v}.`,
      near_52w_low: (v, x, d) => `Within ${d}% of its 52-week low of ${v}.`,
    },
    normalDay: (p, today) => `On a normal day this stock moves about ±${p}% up or down. Today it moved ${today}.`,
    history: (cases, up) => `After similar days before (${cases} times), the next day was up ${up}% of the time and down ${100 - up}%. That is close to a coin flip, so it tells you little.`,
    resultsDue: (d) => `Company results are due on ${d}.`,
    tipCheck: 'Check a tip about it', watch: 'Watch it', watching: 'Watching',
    alert: 'Tell me if heavy trading happens again', alertSet: (s) => `Alert set for ${s}`,
    rulesTitle: 'How we pick these stocks',
    rulesIntro: 'The same rules for every stock, every day. We never pick by hand.',
    strictRules: ['Moved at least 2.5× its usual daily move (and at least 2%)', 'Traded 3× or more of its usual number of shares', 'Opened 3% or more away from yesterday’s price', 'Went above its 52-week high or below its 52-week low'],
    milderRules: ['Moved 1.5× its usual daily move (and at least 1.5%)', 'Traded 2× or more of its usual number of shares', 'Opened 2% away from yesterday’s price', 'Is within 1.5% of its 52-week high or low'],
    strictLabel: 'Stood out the most:', milderLabel: 'Also worth a look:',
    foot: 'This is not a prediction or advice. Nobody can say how a stock will move tomorrow.',
    unavailable: 'The unusual-activity check is unavailable right now.',
    loading: 'Scanning the market…',
  },
  hi: {
    kicker: 'असामान्य गतिविधि',
    title: 'आज असामान्य व्यवहार वाले शेयर',
    howTitle: 'इस पेज को कैसे पढ़ें',
    how: [
      'ये वे शेयर हैं जिन्होंने आज कुछ सामान्य से हटकर किया।',
      'असामान्य का मतलब अच्छा या बुरा नहीं है, और यह नहीं बताता कि आगे क्या होगा।',
      'इसका उपयोग यह तय करने में करें कि किसे ज़्यादा ध्यान से देखना है। इस सूची में होना खरीदने या बेचने की वजह नहीं है।',
    ],
    summary: (total, n, k, date) => `हमने ${total} शेयर जाँचे (${date} तक)। ${n} बहुत अलग दिखे और ${k} और देखने लायक हैं।`,
    strongTitle: 'आज सबसे ज़्यादा अलग दिखे',
    notableTitle: 'यह भी देखने लायक',
    noStrong: 'आज कोई शेयर बहुत अलग नहीं दिखा।',
    noNotable: 'आज और कुछ खास नहीं है।',
    more: (m) => `${m} और दिखाएं`, fewer: 'कम दिखाएं',
    headline: {
      big_move: 'आज सामान्य से बहुत ज़्यादा चला',
      volume_spike: 'सामान्य से कहीं ज़्यादा शेयरों का कारोबार हुआ',
      gap: 'कल के भाव से काफ़ी दूर खुला',
      new_52w_high: 'एक साल का सबसे ऊँचा भाव छुआ',
      new_52w_low: 'एक साल का सबसे निचला भाव छुआ',
      near_52w_high: 'साल के सबसे ऊँचे भाव के करीब',
      near_52w_low: 'साल के सबसे निचले भाव के करीब',
    },
    thin: 'छोटी कंपनी। इसके बारे में किसी भी टिप से और सावधान रहें।',
    numbers: 'आँकड़े देखें',
    facts: {
      big_move: (v, x) => `भाव एक दिन में ${v > 0 ? '+' : ''}${v}% चला, यानी सामान्य दैनिक चाल का लगभग ${x} गुना।`,
      volume_spike: (v) => `सामान्य रूप से जितने शेयर रोज़ बिकते हैं, उसके ${v} गुना।`,
      gap: (v) => `कल के बंद भाव से ${v > 0 ? '+' : ''}${v}% दूर खुला।`,
      new_52w_high: (v) => `पिछले 52 हफ्ते के उच्च स्तर ${v} से ऊपर कारोबार हुआ।`,
      new_52w_low: (v) => `पिछले 52 हफ्ते के निम्न स्तर ${v} से नीचे कारोबार हुआ।`,
      near_52w_high: (v, x, d) => `52 हफ्ते के उच्च स्तर ${v} के ${d}% के भीतर।`,
      near_52w_low: (v, x, d) => `52 हफ्ते के निम्न स्तर ${v} के ${d}% के भीतर।`,
    },
    normalDay: (p, today) => `सामान्य दिन में यह शेयर लगभग ±${p}% ऊपर-नीचे चलता है। आज यह ${today} चला।`,
    history: (cases, up) => `पहले ऐसे दिनों (${cases} बार) के बाद अगला दिन ${up}% बार बढ़ा और ${100 - up}% बार गिरा। यह लगभग सिक्का उछालने जैसा है, इसलिए इससे ज़्यादा पता नहीं चलता।`,
    resultsDue: (d) => `कंपनी के नतीजे ${d} को आने हैं।`,
    tipCheck: 'इसकी टिप जाँचें', watch: 'इसे देखें', watching: 'देख रहे हैं',
    alert: 'भारी कारोबार फिर हो तो बताएं', alertSet: (s) => `${s} के लिए अलर्ट लगा`,
    rulesTitle: 'हम ये शेयर कैसे चुनते हैं',
    rulesIntro: 'हर शेयर के लिए, हर दिन वही नियम। हम हाथ से नहीं चुनते।',
    strictRules: ['सामान्य दैनिक चाल से कम से कम 2.5 गुना चला (और कम से कम 2%)', 'सामान्य से 3 गुना या अधिक शेयरों का कारोबार', 'कल के भाव से 3% या अधिक दूर खुला', '52 हफ्ते के उच्च से ऊपर या निम्न से नीचे गया'],
    milderRules: ['सामान्य दैनिक चाल से 1.5 गुना चला (और कम से कम 1.5%)', 'सामान्य से 2 गुना या अधिक शेयरों का कारोबार', 'कल के भाव से 2% दूर खुला', '52 हफ्ते के उच्च या निम्न के 1.5% के भीतर'],
    strictLabel: 'सबसे ज़्यादा अलग दिखे:', milderLabel: 'यह भी देखने लायक:',
    foot: 'यह भविष्यवाणी या सलाह नहीं है। कल शेयर कैसे चलेगा, यह कोई नहीं बता सकता।',
    unavailable: 'असामान्य गतिविधि की जाँच अभी उपलब्ध नहीं है।',
    loading: 'बाज़ार स्कैन हो रहा है…',
  },
  gu: {
    kicker: 'અસામાન્ય પ્રવૃત્તિ',
    title: 'આજે અસામાન્ય વર્તન કરતા શેર',
    howTitle: 'આ પેજ કેવી રીતે વાંચવું',
    how: [
      'આ એવા શેર છે જેમણે આજે કંઈક સામાન્યથી અલગ કર્યું.',
      'અસામાન્ય એટલે સારું કે ખરાબ નહીં, અને તે આગળ શું થશે તે કહેતું નથી.',
      'કોને વધુ ધ્યાનથી જોવો તે નક્કી કરવા વાપરો. આ યાદીમાં હોવું ખરીદવા કે વેચવાનું કારણ નથી.',
    ],
    summary: (total, n, k, date) => `અમે ${total} શેર તપાસ્યા (${date} સુધી). ${n} ખૂબ અલગ દેખાયા અને ${k} વધુ જોવા જેવા છે.`,
    strongTitle: 'આજે સૌથી વધુ અલગ દેખાયા',
    notableTitle: 'આ પણ જોવા જેવા',
    noStrong: 'આજે કોઈ શેર ખૂબ અલગ દેખાયો નથી.',
    noNotable: 'આજે બીજું કંઈ ખાસ નથી.',
    more: (m) => `${m} વધુ બતાવો`, fewer: 'ઓછા બતાવો',
    headline: {
      big_move: 'આજે સામાન્ય કરતાં ઘણો વધારે ચાલ્યો',
      volume_spike: 'સામાન્ય કરતાં ઘણા વધુ શેરનો કારોબાર થયો',
      gap: 'ગઈકાલના ભાવથી ઘણો દૂર ખૂલ્યો',
      new_52w_high: 'એક વર્ષનો સૌથી ઊંચો ભાવ સ્પર્શ્યો',
      new_52w_low: 'એક વર્ષનો સૌથી નીચો ભાવ સ્પર્શ્યો',
      near_52w_high: 'વર્ષના સૌથી ઊંચા ભાવની નજીક',
      near_52w_low: 'વર્ષના સૌથી નીચા ભાવની નજીક',
    },
    thin: 'નાની કંપની. તેના વિશેની કોઈ પણ ટીપથી વધુ સાવચેત રહો.',
    numbers: 'આંકડા જુઓ',
    facts: {
      big_move: (v, x) => `ભાવ એક દિવસમાં ${v > 0 ? '+' : ''}${v}% ચાલ્યો, એટલે સામાન્ય દૈનિક ચાલ કરતાં લગભગ ${x} ગણો.`,
      volume_spike: (v) => `સામાન્ય રીતે રોજ જેટલા શેર ટ્રેડ થાય છે તેના ${v} ગણા.`,
      gap: (v) => `ગઈકાલના બંધ ભાવથી ${v > 0 ? '+' : ''}${v}% દૂર ખૂલ્યો.`,
      new_52w_high: (v) => `અગાઉના 52 અઠવાડિયાના ઊંચા સ્તર ${v} ઉપર કારોબાર થયો.`,
      new_52w_low: (v) => `અગાઉના 52 અઠવાડિયાના નીચા સ્તર ${v} નીચે કારોબાર થયો.`,
      near_52w_high: (v, x, d) => `52 અઠવાડિયાના ઊંચા સ્તર ${v} ના ${d}% અંદર.`,
      near_52w_low: (v, x, d) => `52 અઠવાડિયાના નીચા સ્તર ${v} ના ${d}% અંદર.`,
    },
    normalDay: (p, today) => `સામાન્ય દિવસે આ શેર લગભગ ±${p}% ઉપર-નીચે ચાલે છે. આજે તે ${today} ચાલ્યો.`,
    history: (cases, up) => `અગાઉ આવા દિવસો (${cases} વખત) પછી આગલો દિવસ ${up}% વખત વધ્યો અને ${100 - up}% વખત ઘટ્યો. આ લગભગ સિક્કો ઉછાળવા જેવું છે, તેથી તેમાંથી વધુ ખબર પડતી નથી.`,
    resultsDue: (d) => `કંપનીના પરિણામ ${d} ના રોજ આવવાના છે.`,
    tipCheck: 'તેની ટીપ તપાસો', watch: 'તેને જુઓ', watching: 'જોઈ રહ્યા છો',
    alert: 'ભારે ટ્રેડિંગ ફરી થાય તો જણાવો', alertSet: (s) => `${s} માટે એલર્ટ મૂક્યું`,
    rulesTitle: 'અમે આ શેર કેવી રીતે પસંદ કરીએ છીએ',
    rulesIntro: 'દરેક શેર માટે, દરરોજ સમાન નિયમો. અમે હાથથી પસંદ કરતા નથી.',
    strictRules: ['સામાન્ય દૈનિક ચાલ કરતાં ઓછામાં ઓછી 2.5 ગણી ચાલ્યો (અને ઓછામાં ઓછી 2%)', 'સામાન્ય કરતાં 3 ગણા કે વધુ શેરનો કારોબાર', 'ગઈકાલના ભાવથી 3% કે વધુ દૂર ખૂલ્યો', '52 અઠવાડિયાના ઊંચાથી ઉપર અથવા નીચાથી નીચે ગયો'],
    milderRules: ['સામાન્ય દૈનિક ચાલ કરતાં 1.5 ગણી ચાલ્યો (અને ઓછામાં ઓછી 1.5%)', 'સામાન્ય કરતાં 2 ગણા કે વધુ શેરનો કારોબાર', 'ગઈકાલના ભાવથી 2% દૂર ખૂલ્યો', '52 અઠવાડિયાના ઊંચા કે નીચાના 1.5% અંદર'],
    strictLabel: 'સૌથી વધુ અલગ દેખાયા:', milderLabel: 'આ પણ જોવા જેવા:',
    foot: 'આ આગાહી કે સલાહ નથી. આવતીકાલે શેર કેવો ચાલશે તે કોઈ કહી શકતું નથી.',
    unavailable: 'અસામાન્ય પ્રવૃત્તિની તપાસ હાલ ઉપલબ્ધ નથી.',
    loading: 'બજાર સ્કેન થઈ રહ્યું છે…',
  },
};

const plain = (symbol) => symbol.replace(/\.(NS|BO)$/, '');
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`;

const UnusualActivity = ({ limit = 10 }) => {
  const { language, addToast, visitor, refreshVisitor } = useContext(UserContext);
  const watchlist = useWatchlist();
  const T = COPY[language] || COPY.en;
  const [state, setState] = useState({ status: 'loading', data: null });
  const [expanded, setExpanded] = useState({ unusual: false, notable: false });

  useEffect(() => {
    let alive = true;
    marketService.getUnusualActivity(limit)
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => { alive = false; };
  }, [limit]);

  const toggleWatch = async (symbol) => {
    try {
      if (watchlist.has(symbol)) await watchlist.remove(symbol);
      else await watchlist.add(symbol);
    } catch (err) {
      addToast(err.userMessage || 'Failed to update watchlist', 'error');
    }
  };

  const setVolumeAlert = async (symbol) => {
    try {
      await alertService.create({ type: 'VOLUME_SPIKE', symbol, threshold: 3 });
      if (!visitor) refreshVisitor().catch(() => {});
      addToast(T.alertSet(plain(symbol)), 'info');
    } catch (err) {
      addToast(err.userMessage || 'Could not create the alert', 'error');
    }
  };

  const { status, data } = state;
  const items = data?.items || [];
  const strongItems = items.filter((i) => (i.tier || 'unusual') === 'unusual');
  const notableItems = items.filter((i) => i.tier === 'notable');

  const renderCard = (item, idx) => {
    const up = (item.changePercent || 0) >= 0;
    const saved = watchlist.has(item.symbol);
    const triggers = item.triggers.slice().sort((a, b) => (b.intensity || 0) - (a.intensity || 0));
    return (
      <article key={item.symbol} className="unusual-card" style={{ '--i': idx }}>
        <div className="unusual-card-head">
          <div>
            <div className="stock-primary-name">{item.name}</div>
            <span className="stock-symbol-tag">{plain(item.symbol)}{item.industry ? ` · ${item.industry}` : ''}</span>
          </div>
          {item.changePercent !== null && item.changePercent !== undefined && (
            <div className={`stock-delta-pill ${up ? 'positive' : 'negative'}`}>
              {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{up ? '+' : ''}{Number(item.changePercent).toFixed(2)}%</span>
            </div>
          )}
        </div>

        <ul className="unusual-headlines">
          {triggers.slice(0, 2).map((tr) => <li key={tr.code}>{T.headline[tr.code]}</li>)}
        </ul>

        {item.thinStock && <p className="unusual-thin" role="note"><AlertTriangle size={13} aria-hidden="true" /> {T.thin}</p>}

        <details className="unusual-details">
          <summary>{T.numbers}</summary>
          <ul className="unusual-facts">
            {triggers.map((tr) => <li key={tr.code}>{T.facts[tr.code](tr.value, tr.times, tr.distance)}</li>)}
            {item.tomorrow?.typicalMovePercent ? <li>{T.normalDay(item.tomorrow.typicalMovePercent, signed(item.changePercent))}</li> : null}
            {item.history && item.history.cases >= 20 ? <li>{T.history(item.history.cases, item.history.upPercent)}</li> : null}
            {item.tomorrow?.nextResults ? <li>{T.resultsDue(item.tomorrow.nextResults)}</li> : null}
          </ul>
          <button type="button" className="editorial-chip-btn" onClick={() => setVolumeAlert(item.symbol)}><Bell size={12} /> {T.alert}</button>
        </details>

        <div className="unusual-actions">
          <Link className="editorial-chip-btn" to={`/tip-check?symbol=${encodeURIComponent(plain(item.symbol))}`}><ShieldCheck size={12} /> {T.tipCheck}</Link>
          <button type="button" className="editorial-chip-btn" onClick={() => toggleWatch(item.symbol)}>
            {saved ? <Check size={12} /> : <Eye size={12} />} {saved ? T.watching : T.watch}
          </button>
        </div>
      </article>
    );
  };

  const renderGroup = (tier, title, list, emptyText) => {
    const open = expanded[tier];
    const shown = open ? list : list.slice(0, SHOW_FIRST);
    return (
      <>
        <h4 className="unusual-group-title">{title}</h4>
        {list.length === 0 ? <p className="unusual-empty">{emptyText}</p> : (
          <>
            <div className="unusual-list">{shown.map(renderCard)}</div>
            {list.length > SHOW_FIRST && (
              <button type="button" className="unusual-more-btn" onClick={() => setExpanded((e) => ({ ...e, [tier]: !open }))}>
                {open ? T.fewer : T.more(list.length - SHOW_FIRST)}
              </button>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <section className="editorial-flow-section unusual-section" aria-label={T.title}>
      <div className="flow-section-header">
        <div>
          <span className="flow-kicker">{T.kicker}</span>
          <h3 className="flow-title">{T.title}</h3>
        </div>
      </div>

      {status === 'loading' && (
        <div className="unusual-radar" role="status" aria-label={T.loading}>
          <span className="unusual-radar-disc"><i /></span>
          <span>{T.loading}</span>
        </div>
      )}
      {status === 'error' && <p className="unusual-empty">{T.unavailable}</p>}

      {status === 'ready' && (
        <>
          <div className="unusual-intro">
            <strong>{T.howTitle}</strong>
            <ul>{T.how.map((line) => <li key={line}>{line}</li>)}</ul>
            <p>{T.summary(data.scanned, data.flagged, data.notableCount ?? 0, data.asOf)}</p>
          </div>

          {renderGroup('unusual', T.strongTitle, strongItems, T.noStrong)}
          {renderGroup('notable', T.notableTitle, notableItems, T.noNotable)}

          <details className="unusual-rules">
            <summary>{T.rulesTitle}</summary>
            <p>{T.rulesIntro}</p>
            <p><b>{T.strictLabel}</b></p>
            <ul>{T.strictRules.map((r) => <li key={r}>{r}</li>)}</ul>
            <p><b>{T.milderLabel}</b></p>
            <ul>{T.milderRules.map((r) => <li key={r}>{r}</li>)}</ul>
          </details>
          <p className="unusual-disclaimer">{T.foot}</p>
        </>
      )}
    </section>
  );
};

export default UnusualActivity;
