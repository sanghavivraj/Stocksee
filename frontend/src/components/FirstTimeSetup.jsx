import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { useWatchlist } from '../context/WatchlistContext';
import usePopular from '../hooks/usePopular';
import { pick } from '../utils/pickLanguage';

/**
 * 30-second first-time setup: language, 3 to 5 stocks, optional Telegram. No sign-up. Shown once per browser,
 * only to someone who has not saved anything yet.
 */
export const SETUP_KEY = 'stocksee_setup_done';
const MIN_PICK = 1;
const MAX_PICK = 5;

const COPY = {
  en: {
    kicker: 'WELCOME · 30 SECONDS', title: 'Set up your StockSee',
    s1: '1. Your language', s2: (n) => `2. Pick up to ${MAX_PICK} stocks to watch (${n} chosen)`,
    s3: '3. Telegram (optional)', s3text: 'Get the morning brief and alerts on Telegram. You can do this later in Settings.',
    s3btn: 'Connect Telegram', done: 'Save and start', skip: 'Skip for now', saving: 'Saving…',
    tooMany: `You can pick up to ${MAX_PICK} here. Add more later from the Watchlist page.`,
    note: 'No sign-up. Nothing is bought or sold here. Facts, not tips.',
    popularNote: 'The most traded companies right now (from the live Nifty 500 list).', noSuggestions: 'Suggestions are unavailable right now. You can search and add stocks from My Watchlist.',
  },
  hi: {
    kicker: 'स्वागत · 30 सेकंड', title: 'अपना StockSee सेट करें',
    s1: '1. आपकी भाषा', s2: (n) => `2. देखने के लिए ${MAX_PICK} तक शेयर चुनें (${n} चुने)`,
    s3: '3. टेलीग्राम (वैकल्पिक)', s3text: 'सुबह की ब्रीफ और अलर्ट टेलीग्राम पर पाएं। यह बाद में सेटिंग्स में भी कर सकते हैं।',
    s3btn: 'टेलीग्राम जोड़ें', done: 'सेव करें और शुरू करें', skip: 'अभी छोड़ें', saving: 'सेव हो रहा है…',
    tooMany: `यहाँ ${MAX_PICK} तक चुन सकते हैं। और बाद में वॉचलिस्ट पेज से जोड़ें।`,
    note: 'कोई साइन-अप नहीं। यहाँ कुछ खरीदा-बेचा नहीं जाता। तथ्य, टिप नहीं।',
    popularNote: 'अभी सबसे ज़्यादा कारोबार वाली कंपनियाँ (लाइव निफ्टी 500 सूची से)।', noSuggestions: 'सुझाव अभी उपलब्ध नहीं हैं। आप मेरी वॉचलिस्ट में खोजकर शेयर जोड़ सकते हैं।',
  },
  gu: {
    kicker: 'સ્વાગત · 30 સેકન્ડ', title: 'તમારું StockSee સેટ કરો',
    s1: '1. તમારી ભાષા', s2: (n) => `2. જોવા માટે ${MAX_PICK} સુધી શેર પસંદ કરો (${n} પસંદ કર્યા)`,
    s3: '3. ટેલિગ્રામ (વૈકલ્પિક)', s3text: 'સવારની બ્રીફ અને એલર્ટ ટેલિગ્રામ પર મેળવો. આ પછી સેટિંગ્સમાં પણ થઈ શકે.',
    s3btn: 'ટેલિગ્રામ જોડો', done: 'સેવ કરો અને શરૂ કરો', skip: 'હમણાં છોડો', saving: 'સેવ થઈ રહ્યું છે…',
    tooMany: `અહીં ${MAX_PICK} સુધી પસંદ કરી શકાય. વધુ પછી વૉચલિસ્ટ પેજ પરથી ઉમેરો.`,
    note: 'કોઈ સાઇન-અપ નથી. અહીં કંઈ ખરીદ-વેચાણ થતું નથી. તથ્યો, ટીપ નહીં.',
    popularNote: 'અત્યારે સૌથી વધુ ટ્રેડ થતી કંપનીઓ (લાઇવ નિફ્ટી 500 યાદીમાંથી).', noSuggestions: 'સૂચનો હાલ ઉપલબ્ધ નથી. તમે મારી વૉચલિસ્ટમાં શોધીને શેર ઉમેરી શકો છો.',
  },
};
const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['gu', 'ગુજરાતી']];

export const markSetupDone = () => { try { localStorage.setItem(SETUP_KEY, '1'); } catch { /* storage blocked */ } };
export const setupAlreadyDone = () => { try { return localStorage.getItem(SETUP_KEY) === '1'; } catch { return false; } };

const FirstTimeSetup = ({ onClose }) => {
  const { language, updateUserLanguage, addToast } = useContext(UserContext);
  const { replaceAll } = useWatchlist();
  const T = pick(COPY, language);
  const popular = usePopular(10);
  const [touched, setTouched] = useState(null); // null until the person changes the pre-selection
  // Pre-select the three most traded companies; the person can change that freely
  const picked = touched ?? popular.items.slice(0, 3).map((p) => p.symbol);
  const [saving, setSaving] = useState(false);

  const toggle = (sym) => {
    if (picked.includes(sym)) { setTouched(picked.filter((s) => s !== sym)); return; }
    if (picked.length >= MAX_PICK) { addToast(T.tooMany, 'info'); return; }
    setTouched([...picked, sym]);
  };

  const finish = async () => {
    if (picked.length < MIN_PICK || saving) return;
    setSaving(true);
    try {
      await replaceAll(picked);
      markSetupDone();
      onClose();
    } catch (err) {
      addToast(err.userMessage || 'Could not save your setup', 'error');
    } finally {
      setSaving(false);
    }
  };
  const skip = () => { markSetupDone(); onClose(); };

  return (
    <section className="setup-card" aria-label={T.title}>
      <span className="flow-kicker">{T.kicker}</span>
      <h3 className="flow-title">{T.title}</h3>

      <p className="setup-step">{T.s1}</p>
      <div className="setup-chips" role="group" aria-label={T.s1}>
        {LANGS.map(([code, label]) => (
          <button key={code} type="button" className={`setup-chip ${language === code ? 'on' : ''}`} aria-pressed={language === code} onClick={() => updateUserLanguage(code)}>{label}</button>
        ))}
      </div>

      <p className="setup-step">{T.s2(picked.length)}</p>
      <div className="setup-chips" role="group" aria-label={T.s2(picked.length)}>
        {/* Empty places of the same size while the list loads, so nothing below jumps */}
        {popular.loading && Array.from({ length: 10 }, (_, i) => <span key={i} className="setup-chip setup-chip-wait" aria-hidden="true">RELIANCE</span>)}
        {popular.items.map(({ symbol: sym, name }) => {
          const on = picked.includes(sym);
          return (
            <button key={sym} type="button" className={`setup-chip ${on ? 'on' : ''}`} aria-pressed={on} title={name} onClick={() => toggle(sym)}>
              {on && <Check size={12} aria-hidden="true" />} {sym.replace('.NS', '')}
            </button>
          );
        })}
      </div>
      <p className="briefing-muted">{popular.items.length || popular.loading ? T.popularNote : T.noSuggestions}</p>

      <p className="setup-step">{T.s3}</p>
      <p className="briefing-muted">{T.s3text} <Link to="/settings" onClick={markSetupDone}>{T.s3btn}</Link></p>

      <div className="setup-actions">
        <button type="button" className="btn-editorial btn-editorial-primary" disabled={picked.length < MIN_PICK || saving} onClick={finish}>{saving ? T.saving : T.done}</button>
        <button type="button" className="editorial-chip-btn" onClick={skip}>{T.skip}</button>
      </div>
      <p className="unusual-disclaimer">{T.note}</p>
    </section>
  );
};

export default FirstTimeSetup;
