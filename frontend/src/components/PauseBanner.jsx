import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { PauseCircle } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { pick } from '../utils/pickLanguage';
import { formatPercent } from '../utils/formatPrice';

const COPY = {
  en: {
    title: 'Big move today. Pause and check first.',
    lead: (p) => `This moved ${p} today. Big moves are when people rush. These take a minute to look at:`,
    items: [
      'Why did it move? Look for a company announcement (results, an order, news) on the NSE or BSE site.',
      'Is the trading volume far above normal? A jump with no news is a warning sign.',
      'Did a message or a group tell you to buy it? Paste it in Tip Check.',
    ],
    tip: 'Run a Tip Check on this stock',
    learn: 'What to check before you act',
    note: 'Facts to look at, not advice to buy, sell or wait.',
  },
  hi: {
    title: 'आज बड़ी चाल। रुकिए और पहले जाँचिए।',
    lead: (p) => `आज यह ${p} चला। बड़ी चाल में लोग जल्दबाज़ी करते हैं। इन्हें देखने में एक मिनट लगता है:`,
    items: [
      'यह क्यों चला? NSE या BSE की साइट पर कंपनी की घोषणा (नतीजे, ऑर्डर, खबर) देखें।',
      'क्या ट्रेडिंग वॉल्यूम सामान्य से बहुत ज़्यादा है? बिना खबर के उछाल चेतावनी का संकेत है।',
      'क्या किसी संदेश या ग्रुप ने इसे खरीदने को कहा? उसे टिप जाँच में पेस्ट करें।',
    ],
    tip: 'इस शेयर पर टिप जाँच चलाएँ',
    learn: 'कुछ भी करने से पहले क्या जाँचें',
    note: 'देखने के तथ्य, खरीदने, बेचने या रुकने की सलाह नहीं।',
  },
  gu: {
    title: 'આજે મોટી ચાલ. અટકો અને પહેલાં ચકાસો.',
    lead: (p) => `આજે આ ${p} ચાલ્યો. મોટી ચાલમાં લોકો ઉતાવળ કરે છે. આ જોવામાં એક મિનિટ લાગે છે:`,
    items: [
      'આ કેમ ચાલ્યો? NSE કે BSE સાઇટ પર કંપનીની જાહેરાત (પરિણામ, ઓર્ડર, સમાચાર) જુઓ.',
      'શું ટ્રેડિંગ વોલ્યુમ સામાન્ય કરતા ઘણું વધારે છે? સમાચાર વગરનો ઉછાળો ચેતવણીનો સંકેત છે.',
      'શું કોઈ સંદેશ કે ગ્રુપે તેને ખરીદવા કહ્યું? તેને ટિપ ચકાસણીમાં પેસ્ટ કરો.',
    ],
    tip: 'આ શેર પર ટિપ ચકાસણી ચલાવો',
    learn: 'કંઈ પણ કરતા પહેલાં શું ચકાસવું',
    note: 'જોવા જેવા તથ્યો, ખરીદવા, વેચવા કે રાહ જોવાની સલાહ નથી.',
  },
};

/** Shown on a stock whose day move is 10% or more. `onNavigate` closes the window that holds it. */
export default function PauseBanner({ symbol, changePercent, onNavigate }) {
  const { language } = useContext(UserContext);
  const T = pick(COPY, language);
  return (
    <section className="pause-banner" aria-label={T.title}>
      <div className="pause-banner-head"><PauseCircle size={18} aria-hidden="true" /> <strong>{T.title}</strong></div>
      <p>{T.lead(formatPercent(changePercent))}</p>
      <ul>{T.items.map((t) => <li key={t}>{t}</li>)}</ul>
      <div className="pause-banner-actions">
        <Link className="btn-editorial btn-editorial-primary" to={`/tip-check?symbol=${encodeURIComponent(symbol)}`} onClick={onNavigate}>{T.tip}</Link>
        <Link className="btn-editorial" to="/samajh?check=stocks" onClick={onNavigate}>{T.learn}</Link>
      </div>
      <p className="risk-disclaimer">{T.note}</p>
    </section>
  );
}
