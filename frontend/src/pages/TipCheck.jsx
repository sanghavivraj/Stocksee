import { useContext, useEffect, useRef, useState } from 'react';
import { tr } from '../utils/uiStrings';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldAlert, Loader2, Send } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import tipCheckService from '../services/tipCheckService';
import TipCheckResult from '../components/TipCheckResult';
import SymbolSearchInput from '../components/SymbolSearchInput';

const EXAMPLES = [
  { label: 'English hype tip', text: '🚀 JACKPOT ALERT! Operator buying SUZLON, guaranteed 50% return in 10 days. Buy now before upper circuit! Join our VIP Telegram group.' },
  { label: 'हिन्दी टिप', text: 'भाई ये शेयर पक्का डबल होगा, अंदर की खबर है, जल्दी खरीदो - IRFC' },
  { label: 'ગુજરાતી ટિપ', text: 'ઓપરેટરની અંદરની ખબર છે, ગેરંટી સાથે જેકપોટ, તરત લઈ લો - YESBANK' },
  { label: 'Normal question', text: 'Has TCS announced its quarterly results date?' },
];

const COPY = {
  en: {
    title: 'Tip Check',
    lead: 'Got a stock tip on WhatsApp or Telegram? Paste it here. StockSee checks the wording for classic pump-and-dump tricks and the stock\'s real market data for unusual patterns.',
    placeholder: 'Paste the message you received…',
    symbolLabel: 'Stock (optional with a message — or use it alone to check a stock\'s market data)',
    button: 'Check this tip',
    checking: 'Checking…',
    privacy: 'The message is only used for this check and is not saved.',
    tryOne: 'Try an example:',
    telegram: 'Tip: forward any message to the StockSee Telegram bot to check it there.',
  },
  hi: {
    title: 'टिप जाँच',
    lead: 'WhatsApp या Telegram पर कोई शेयर टिप मिली? यहाँ पेस्ट करें। StockSee शब्दों में पंप-एंड-डंप के तरीके और शेयर के असली बाज़ार डेटा में असामान्य पैटर्न जाँचता है।',
    placeholder: 'मिला हुआ संदेश यहाँ पेस्ट करें…',
    symbolLabel: 'शेयर सिंबल (वैकल्पिक — हम संदेश में खोजने की कोशिश करते हैं)',
    button: 'यह टिप जाँचें',
    checking: 'जाँच हो रही है…',
    privacy: 'संदेश केवल इस जाँच के लिए उपयोग होता है और सेव नहीं होता।',
    tryOne: 'उदाहरण आज़माएँ:',
    telegram: 'सुझाव: StockSee Telegram बॉट को कोई भी संदेश फ़ॉरवर्ड करके वहीं जाँचें।',
  },
  gu: {
    title: 'ટિપ ચકાસણી',
    lead: 'WhatsApp કે Telegram પર શેર ટિપ મળી? અહીં પેસ્ટ કરો. StockSee શબ્દોમાં પંપ-એન્ડ-ડમ્પની યુક્તિઓ અને શેરના સાચા બજાર ડેટામાં અસામાન્ય પેટર્ન ચકાસે છે.',
    placeholder: 'મળેલો સંદેશ અહીં પેસ્ટ કરો…',
    symbolLabel: 'શેર સિમ્બોલ (વૈકલ્પિક — અમે સંદેશમાં શોધવાનો પ્રયાસ કરીએ છીએ)',
    button: 'આ ટિપ ચકાસો',
    checking: 'ચકાસણી થઈ રહી છે…',
    privacy: 'સંદેશ માત્ર આ ચકાસણી માટે વપરાય છે અને સેવ થતો નથી.',
    tryOne: 'ઉદાહરણ અજમાવો:',
    telegram: 'ટિપ: StockSee Telegram બોટને કોઈ પણ સંદેશ ફોરવર્ડ કરીને ત્યાં ચકાસો.',
  },
};

const TipCheck = () => {
  const { language, addToast } = useContext(UserContext);
  const T = COPY[language] || COPY.en;
  const [searchParams] = useSearchParams();
  const [text, setText] = useState(() => (searchParams.get('text') || '').slice(0, 2000));
  const [symbol, setSymbol] = useState(() => (searchParams.get('symbol') || '').toUpperCase().slice(0, 20));
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const resultRef = useRef(null);

  const runCheck = async (e) => {
    e?.preventDefault();
    if ((text.trim().length < 3 && !symbol.trim()) || checking) return;
    setChecking(true);
    try {
      const r = await tipCheckService.check({ text: text.trim(), symbol: symbol.trim().toUpperCase(), language });
      setResult(r);
      setTimeout(() => resultRef.current?.focus(), 50); // move focus to the result for keyboard/screen-reader users
    } catch (err) {
      addToast(err.userMessage || 'Could not check this tip right now', 'error');
    } finally {
      setChecking(false);
    }
  };

  // A shared link (/tip-check?text=... or ?symbol=...) checks straight away
  useEffect(() => {
    if (searchParams.get('text') || searchParams.get('symbol')) runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="editorial-page-container">
      <header className="editorial-lead-header">
        <div className="lead-meta-row">
          <span className="editorial-kicker">{tr("INVESTOR PROTECTION", language)}</span>
          <span className="lead-date-stamp">{tr("Pump-and-dump warning signs", language)}</span>
        </div>
        <h1 className="lead-headline" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={30} aria-hidden="true" /> {T.title}
        </h1>
        <p className="lead-description">{T.lead}</p>
      </header>

      <section className="editorial-flow-section" aria-label="Paste a tip">
        <form className="settings-card" onSubmit={runCheck}>
          <label htmlFor="tip-text" className="sr-only">{T.placeholder}</label>
          <textarea
            id="tip-text"
            className="editorial-input tip-textarea"
            placeholder={T.placeholder}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runCheck(e); }}
          />

          <div className="tip-examples" role="group" aria-label={T.tryOne}>
            <span style={{ fontSize: '0.78rem', color: 'var(--fg-text-muted)', alignSelf: 'center' }}>{T.tryOne}</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} type="button" className="tip-example-btn" onClick={() => { setText(ex.text); setResult(null); }}>
                {ex.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span className="form-field-label">{T.symbolLabel}</span>
              <SymbolSearchInput id="tip-symbol" value={symbol} onChange={setSymbol} onSelect={(item) => setSymbol(item.symbol)} placeholder="Type to search, e.g. SUZLON" />
            </label>
            <button type="submit" className="btn-editorial btn-editorial-primary" disabled={checking || (text.trim().length < 3 && !symbol.trim())}>
              {checking ? <Loader2 size={15} className="spinner" /> : <Send size={15} />}
              <span>{checking ? T.checking : T.button}</span>
            </button>
          </div>
          <p className="risk-disclaimer">{T.privacy} {T.telegram} <Link to="/settings">{tr("Telegram →", language)}</Link></p>
        </form>
      </section>

      {result && (
        <section className="editorial-flow-section" aria-live="polite" ref={resultRef} tabIndex={-1} style={{ outline: 'none' }}>
          <TipCheckResult result={result} />
        </section>
      )}
    </div>
  );
};

export default TipCheck;
