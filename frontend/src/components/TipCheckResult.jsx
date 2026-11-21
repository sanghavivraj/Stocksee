import { useContext, useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldQuestion, MessageSquareWarning, LineChart, Scale, Share2, UserCheck } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { formatPrice } from '../utils/formatPrice';
import { buildRiskCard, shareOrDownload } from '../utils/shareCard';
import { pick } from '../utils/pickLanguage';

const ICONS = { HIGH: ShieldAlert, MEDIUM: ShieldQuestion, LOW: ShieldCheck };

const COPY = {
  en: {
    level: { HIGH: 'High risk', MEDIUM: 'Medium risk', LOW: 'Low risk' },
    message: 'In the message', market: 'In the market data', claims: 'Claim reality check',
    claimsNote: 'What this stock really did in the past, next to the numbers the message promises.',
    before: 'Before you do anything', none: 'No warning signs found by this check.',
    asOf: 'data as of', share: 'Share this result', sharing: 'Preparing…', shared: 'Shared', downloaded: 'Picture saved',
    shareNote: 'The picture shows the risk level and warning signs only. The original message is not included.',
    card: { tagline: 'Tip Check · Markets in your language', signs: 'Warning signs', none: 'No warning signs found.',
      footer: 'Automated risk check from public market data. Not advice. The original message is not shown.', motto: 'Facts, not tips.' },
    sender: { title: 'Who sent it?', none: 'The message shows no SEBI registration number. Real advisers and analysts can quote one.',
      listed: (n, name) => `${n} is registered under the name “${name}”. Make sure that is really the person who messaged you. Numbers can be copied.`,
      notListed: (n, d) => `${n} is not in the list StockSee has (dated ${d}). Look it up yourself before trusting it.`,
      unchecked: (n) => `The message quotes ${n}. StockSee has no adviser list loaded, so it could not check it. Look it up yourself.`,
      links: 'Look up a registration number:', sebi: 'SEBI intermediary portal', bse: 'BSE adviser / analyst list' },
    promise: 'The promise',
    surveillance: (s) => `NSE surveillance list checked (list dated ${s.listDate}): ${s.listed ? `on the ${s.list} list.` : 'this stock is not on it.'}`,
  },
  hi: {
    level: { HIGH: 'ज़्यादा जोखिम', MEDIUM: 'मध्यम जोखिम', LOW: 'कम जोखिम' },
    message: 'संदेश में', market: 'बाज़ार डेटा में', claims: 'दावों की जाँच',
    claimsNote: 'संदेश में किए गए आंकड़ों के बगल में यह शेयर अतीत में असल में क्या कर चुका है।',
    before: 'कुछ भी करने से पहले', none: 'इस जाँच में कोई चेतावनी संकेत नहीं मिला।',
    asOf: 'डेटा की तारीख', share: 'यह नतीजा शेयर करें', sharing: 'तैयार हो रहा है…', shared: 'शेयर हो गया', downloaded: 'तस्वीर सेव हुई',
    shareNote: 'तस्वीर में सिर्फ जोखिम स्तर और चेतावनी संकेत हैं। मूल संदेश शामिल नहीं है।',
    card: { tagline: 'टिप चेक · आपकी भाषा में बाज़ार', signs: 'चेतावनी संकेत', none: 'कोई चेतावनी संकेत नहीं मिला।',
      footer: 'सार्वजनिक बाज़ार डेटा से स्वचालित जोखिम जाँच। सलाह नहीं। मूल संदेश नहीं दिखाया गया।', motto: 'तथ्य, टिप नहीं।' },
    sender: { title: 'किसने भेजा?', none: 'संदेश में कोई SEBI रजिस्ट्रेशन नंबर नहीं है। असली सलाहकार और एनालिस्ट नंबर बता सकते हैं।',
      listed: (n, name) => `${n} “${name}” के नाम से रजिस्टर्ड है। देख लें कि संदेश भेजने वाला सच में वही है। नंबर कॉपी किए जा सकते हैं।`,
      notListed: (n, d) => `${n} StockSee की सूची (तारीख ${d}) में नहीं है। भरोसा करने से पहले खुद जाँचें।`,
      unchecked: (n) => `संदेश में ${n} लिखा है। StockSee में सलाहकार सूची लोड नहीं है, इसलिए जाँच नहीं हो सकी। खुद जाँचें।`,
      links: 'रजिस्ट्रेशन नंबर यहाँ खोजें:', sebi: 'SEBI इंटरमीडियरी पोर्टल', bse: 'BSE सलाहकार / एनालिस्ट सूची' },
    promise: 'वादा',
    surveillance: (s) => `NSE निगरानी सूची जाँची गई (सूची की तारीख ${s.listDate}): ${s.listed ? `${s.list} सूची में है।` : 'यह शेयर उसमें नहीं है।'}`,
  },
  gu: {
    level: { HIGH: 'વધુ જોખમ', MEDIUM: 'મધ્યમ જોખમ', LOW: 'ઓછું જોખમ' },
    message: 'સંદેશમાં', market: 'બજાર ડેટામાં', claims: 'દાવાઓની તપાસ',
    claimsNote: 'સંદેશમાં આપેલા આંકડાની બાજુમાં આ શેરે ભૂતકાળમાં ખરેખર શું કર્યું છે.',
    before: 'કંઈ પણ કરતા પહેલાં', none: 'આ તપાસમાં કોઈ ચેતવણી સંકેત મળ્યો નથી.',
    asOf: 'ડેટાની તારીખ', share: 'આ પરિણામ શેર કરો', sharing: 'તૈયાર થઈ રહ્યું છે…', shared: 'શેર થયું', downloaded: 'તસવીર સેવ થઈ',
    shareNote: 'તસવીરમાં ફક્ત જોખમ સ્તર અને ચેતવણી સંકેતો છે. મૂળ સંદેશ સામેલ નથી.',
    card: { tagline: 'ટીપ ચેક · તમારી ભાષામાં બજાર', signs: 'ચેતવણી સંકેતો', none: 'કોઈ ચેતવણી સંકેત મળ્યો નથી.',
      footer: 'જાહેર બજાર ડેટા પરથી સ્વચાલિત જોખમ તપાસ. સલાહ નથી. મૂળ સંદેશ બતાવ્યો નથી.', motto: 'તથ્યો, ટીપ નહીં.' },
    sender: { title: 'કોણે મોકલ્યું?', none: 'સંદેશમાં કોઈ SEBI રજિસ્ટ્રેશન નંબર નથી. સાચા સલાહકાર અને એનાલિસ્ટ નંબર આપી શકે છે.',
      listed: (n, name) => `${n} “${name}” નામે રજિસ્ટર્ડ છે. ખાતરી કરો કે સંદેશ મોકલનાર ખરેખર એ જ છે. નંબર કોપી થઈ શકે છે.`,
      notListed: (n, d) => `${n} StockSee ની યાદી (તારીખ ${d}) માં નથી. વિશ્વાસ કરતા પહેલાં જાતે ચકાસો.`,
      unchecked: (n) => `સંદેશમાં ${n} લખ્યો છે. StockSee માં સલાહકાર યાદી લોડ નથી, તેથી ચકાસણી થઈ નથી. જાતે ચકાસો.`,
      links: 'રજિસ્ટ્રેશન નંબર અહીં શોધો:', sebi: 'SEBI ઇન્ટરમીડિયરી પોર્ટલ', bse: 'BSE સલાહકાર / એનાલિસ્ટ યાદી' },
    promise: 'વચન',
    surveillance: (s) => `NSE દેખરેખ યાદી તપાસી (યાદીની તારીખ ${s.listDate}): ${s.listed ? `${s.list} યાદીમાં છે.` : 'આ શેર તેમાં નથી.'}`,
  },
};

/** Result of a Tip Check. `compact` is used inside the chat assistant. */
const TipCheckResult = ({ result, compact = false }) => {
  const { language, addToast } = useContext(UserContext);
  const [busy, setBusy] = useState(false);
  if (!result) return null;
  const T = pick(COPY, language);
  const Icon = ICONS[result.level] || ShieldQuestion;
  const fromMessage = result.reasons.filter((r) => r.kind === 'message');
  const fromMarket = result.reasons.filter((r) => r.kind === 'market');
  const levelLabel = T.level[result.level] || result.level;
  // The claim shown in the "promise" box is not repeated in the list below
  const boxed = !compact && result.promise ? result.claims?.find((c) => c.checked && c.achieved === 0) : null;
  const listedClaims = (result.claims || []).filter((c) => c !== boxed);

  const share = async () => {
    setBusy(true);
    try {
      const blob = await buildRiskCard(result, { ...T.card, level: levelLabel });
      const outcome = await shareOrDownload(blob, 'stocksee-tip-check.png', `${levelLabel}: ${result.summary}`);
      if (outcome === 'shared') addToast(T.shared, 'info');
      else if (outcome === 'downloaded') addToast(T.downloaded, 'info');
    } catch {
      addToast('Could not prepare the picture', 'error');
    } finally {
      setBusy(false);
    }
  };

  const ReasonList = ({ items }) => (
    <ul className="reason-list">
      {items.map((r) => (
        <li key={r.code} className="reason-item">
          <span className={`reason-dot ${r.weight >= 3 ? 'w3' : ''}`} aria-hidden="true" />
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className={`risk-card ${compact ? 'assistant-tip-card' : ''}`} aria-label={`Tip Check: ${levelLabel}`}>
      <div className={`risk-card-head ${result.level}`}>
        <div>
          <div className={`risk-level ${result.level}`}>
            <Icon size={compact ? 18 : 22} aria-hidden="true" />
            {levelLabel}
          </div>
          <div className={`risk-meter ${result.level}`} aria-hidden="true"><span /><span /><span /></div>
        </div>
        <div className="risk-summary">
          {result.summary}
          {result.instrument && (
            <div className="risk-stock">
              {result.instrument.name} ({result.instrument.symbol})
              {result.instrument.price != null && ` • ${formatPrice(result.instrument.price, result.instrument.currency)}`}
              {result.instrument.asOf && ` • ${T.asOf} ${result.instrument.asOf}`}
            </div>
          )}
        </div>
      </div>

      <div className="risk-body">
        {!compact && result.promise && (() => {
          const claim = result.claims?.find((c) => c.checked && c.achieved === 0);
          return claim ? (
            <div className="promise-box" role="note">
              <div className="promise-box-title">{T.promise}</div>
              <p>{claim.text}</p>
            </div>
          ) : null;
        })()}
        {fromMessage.length > 0 && (
          <>
            <div className="risk-group-title"><MessageSquareWarning size={12} /> {T.message}</div>
            <ReasonList items={compact ? fromMessage.slice(0, 4) : fromMessage} />
          </>
        )}
        {fromMarket.length > 0 && (
          <>
            <div className="risk-group-title"><LineChart size={12} /> {T.market}</div>
            <ReasonList items={compact ? fromMarket.slice(0, 3) : fromMarket} />
          </>
        )}
        {!compact && listedClaims.length > 0 && (
          <>
            <div className="risk-group-title"><Scale size={12} /> {T.claims}</div>
            <p className="risk-disclaimer">{T.claimsNote}</p>
            <ul className="reason-list">
              {listedClaims.map((c, i) => (
                <li key={`${c.kind}-${i}`} className="reason-item claim-item">
                  <span className={`reason-dot ${c.checked && c.achievedPercent < 5 ? 'w3' : ''}`} aria-hidden="true" />
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {!compact && result.adviser && (
          <>
            <div className="risk-group-title"><UserCheck size={12} /> {T.sender.title}</div>
            {result.adviser.numbers.length === 0 && <p className="risk-disclaimer">{T.sender.none}</p>}
            {result.adviser.numbers.map((n) => (
              <p key={n.number} className="risk-disclaimer">
                {n.listed === true && T.sender.listed(n.number, n.name || '—')}
                {n.listed === false && T.sender.notListed(n.number, result.adviser.listDate || '—')}
                {n.listed === null && T.sender.unchecked(n.number)}
              </p>
            ))}
            <p className="risk-disclaimer">
              {T.sender.links}{' '}
              <a href={result.adviser.links.sebi} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{T.sender.sebi}</a>
              {' · '}
              <a href={result.adviser.links.bse} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{T.sender.bse}</a>
            </p>
          </>
        )}
        {result.reasons.length === 0 && <p style={{ margin: 0, fontSize: '0.86rem' }}>{T.none}</p>}
        {!compact && result.surveillance?.available && <p className="risk-disclaimer">{T.surveillance(result.surveillance)}</p>}
        {result.notes.map((n) => <p key={n} className="risk-disclaimer">{n}</p>)}

        {!compact && (
          <>
            <div className="risk-group-title">{T.before}</div>
            <ul className="guidance-list">{result.guidance.map((g) => <li key={g}>{g}</li>)}</ul>
            <div className="share-row">
              <button type="button" className="btn-editorial btn-editorial-primary" onClick={share} disabled={busy}>
                <Share2 size={14} /> {busy ? T.sharing : T.share}
              </button>
              <span className="risk-disclaimer">{T.shareNote}</span>
            </div>
          </>
        )}
        <p className="risk-disclaimer">{result.disclaimer}</p>
      </div>
    </section>
  );
};

export default TipCheckResult;
