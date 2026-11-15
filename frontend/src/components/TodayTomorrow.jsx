import { useContext, useEffect, useState } from 'react';
import { CalendarDays, Gauge, Globe2, Info } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { useWatchlist } from '../context/WatchlistContext';
import marketService from '../services/marketService';
import { formatPercent, shortName } from '../utils/insightCopy';

/**
 * Today & Tomorrow briefing: only facts. A typical-move RANGE from India VIX (how big, never which way),
 * what happened overnight elsewhere, what is scheduled, and an honest history line. No prediction.
 */
const COPY = {
  en: {
    kicker: 'TODAY & TOMORROW',
    title: 'Briefing for the next trading day',
    next: (d) => `Next trading day: ${d}`,
    range: (p, vix) => `NIFTY usually moves about ±${p}% in a day (India VIX ${vix}).`,
    rangeNote: 'That is a size, not a direction.',
    overnight: 'Overnight and elsewhere',
    cues: { sp500: 'S&P 500', nikkei: 'Nikkei', hangseng: 'Hang Seng', crude: 'Crude', gold: 'Gold', usdinr: 'USD/INR' },
    scheduled: 'Scheduled',
    noEvents: 'No events listed in our calendar for the next 10 days.',
    results: (s, d) => `${s} results on ${d}`,
    history: (t, n, up) => `After a ${t} NIFTY day (${n} similar days), the next day was up ${up}% of the time. Close to a coin flip.`,
    holidays: 'Weekends are skipped. Exchange holidays are not included.',
    why: 'Why we do not predict direction: nobody can do it reliably, and calling it would be a tip.',
    unavailable: 'The briefing is unavailable right now.',
    loading: 'Preparing the briefing…',
  },
  hi: {
    kicker: 'आज और कल',
    title: 'अगले कारोबारी दिन की ब्रीफिंग',
    next: (d) => `अगला कारोबारी दिन: ${d}`,
    range: (p, vix) => `निफ्टी आम तौर पर एक दिन में लगभग ±${p}% चलता है (इंडिया VIX ${vix})।`,
    rangeNote: 'यह चाल का आकार है, दिशा नहीं।',
    overnight: 'रात भर और बाकी दुनिया',
    cues: { sp500: 'S&P 500', nikkei: 'निक्केई', hangseng: 'हैंग सेंग', crude: 'कच्चा तेल', gold: 'सोना', usdinr: 'USD/INR' },
    scheduled: 'निर्धारित',
    noEvents: 'हमारे कैलेंडर में अगले 10 दिनों के लिए कोई इवेंट सूचीबद्ध नहीं है।',
    results: (s, d) => `${s} के नतीजे ${d} को`,
    history: (t, n, up) => `निफ्टी के ${t} वाले दिन के बाद (${n} मिलते-जुलते दिन) अगला दिन ${up}% बार बढ़ा। लगभग सिक्का उछालने जैसा।`,
    holidays: 'सप्ताहांत छोड़े गए हैं। एक्सचेंज की छुट्टियाँ शामिल नहीं हैं।',
    why: 'हम दिशा की भविष्यवाणी क्यों नहीं करते: इसे कोई भरोसे से नहीं कर सकता, और बताना टिप देना होगा।',
    unavailable: 'ब्रीफिंग अभी उपलब्ध नहीं है।',
    loading: 'ब्रीफिंग तैयार हो रही है…',
  },
  gu: {
    kicker: 'આજ અને કાલ',
    title: 'આગામી ટ્રેડિંગ દિવસની બ્રીફિંગ',
    next: (d) => `આગામી ટ્રેડિંગ દિવસ: ${d}`,
    range: (p, vix) => `નિફ્ટી સામાન્ય રીતે એક દિવસમાં લગભગ ±${p}% ચાલે છે (ઇન્ડિયા VIX ${vix}).`,
    rangeNote: 'આ ચાલનું કદ છે, દિશા નહીં.',
    overnight: 'રાતોરાત અને બીજે ક્યાંક',
    cues: { sp500: 'S&P 500', nikkei: 'નિક્કી', hangseng: 'હેંગ સેંગ', crude: 'ક્રૂડ', gold: 'સોનું', usdinr: 'USD/INR' },
    scheduled: 'નિર્ધારિત',
    noEvents: 'અમારા કેલેન્ડરમાં આગામી 10 દિવસ માટે કોઈ ઇવેન્ટ નથી.',
    results: (s, d) => `${s} ના પરિણામ ${d} ના રોજ`,
    history: (t, n, up) => `નિફ્ટીના ${t} વાળા દિવસ પછી (${n} સમાન દિવસ) આગલો દિવસ ${up}% વખત વધ્યો. લગભગ સિક્કો ઉછાળવા જેવું.`,
    holidays: 'સપ્તાહાંત છોડ્યા છે. એક્સચેન્જની રજાઓ સામેલ નથી.',
    why: 'અમે દિશાની આગાહી કેમ નથી કરતા: તે કોઈ ભરોસાપાત્ર રીતે કરી શકતું નથી, અને કહેવું એ ટીપ આપવા બરાબર છે.',
    unavailable: 'બ્રીફિંગ હાલ ઉપલબ્ધ નથી.',
    loading: 'બ્રીફિંગ તૈયાર થઈ રહી છે…',
  },
};

const LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

const TodayTomorrow = () => {
  const { language } = useContext(UserContext);
  const { symbols } = useWatchlist();
  const T = COPY[language] || COPY.en;
  const [state, setState] = useState({ status: 'loading', data: null });
  const key = symbols.slice(0, 10).join(',');

  useEffect(() => {
    let alive = true;
    marketService.getBriefing(key ? key.split(',') : [])
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => { alive = false; };
  }, [key]);

  const { status, data } = state;
  const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOCALES[language] || 'en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <section className="editorial-flow-section briefing-section" aria-label={T.title}>
      <div className="flow-section-header">
        <div>
          <span className="flow-kicker">{T.kicker}</span>
          <h3 className="flow-title">{T.title}</h3>
        </div>
      </div>

      {status === 'loading' && <div className="skeleton feed-skeleton-item" aria-label={T.loading}></div>}
      {status === 'error' && <p className="unusual-empty">{T.unavailable}</p>}

      {status === 'ready' && (
        <div className="briefing-card">
          <p className="briefing-next"><CalendarDays size={14} aria-hidden="true" /> {T.next(fmtDate(data.nextSession))}</p>

          {data.range && (
            <div className="briefing-row">
              <Gauge size={15} aria-hidden="true" />
              <div>
                <p>{T.range(data.range.dailyPercent, data.range.vix)} <em>{T.rangeNote}</em></p>
              </div>
            </div>
          )}

          {Object.keys(data.cues).length > 0 && (
            <div className="briefing-row">
              <Globe2 size={15} aria-hidden="true" />
              <div>
                <p className="briefing-label">{T.overnight}</p>
                <ul className="briefing-cues">
                  {Object.entries(data.cues).map(([k, v]) => (
                    <li key={k}>
                      <span>{T.cues[k]}</span>
                      <strong className={v.changePercent > 0 ? 'cue-up' : v.changePercent < 0 ? 'cue-down' : ''}>{formatPercent(v.changePercent)}</strong>
                      {k === 'usdinr' && v.price && <small>₹{v.price}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="briefing-row">
            <CalendarDays size={15} aria-hidden="true" />
            <div>
              <p className="briefing-label">{T.scheduled}</p>
              {data.scheduled.length === 0 && data.results.length === 0 ? (
                <p className="briefing-muted">{T.noEvents}</p>
              ) : (
                <ul className="briefing-events">
                  {data.scheduled.map((e) => <li key={`${e.date}-${e.title}`}>{fmtDate(e.date)}: {e.title}</li>)}
                  {data.results.map((r) => <li key={`${r.symbol}-${r.date}`}>{T.results(shortName(r.symbol), fmtDate(r.date))}</li>)}
                </ul>
              )}
            </div>
          </div>

          {data.history && (
            <div className="briefing-row">
              <Info size={15} aria-hidden="true" />
              <p>{T.history(formatPercent(data.history.todayChangePercent), data.history.cases, data.history.upPercent)}</p>
            </div>
          )}

          <p className="briefing-foot">{T.why} <span>{T.holidays}</span></p>
        </div>
      )}
    </section>
  );
};

export default TodayTomorrow;
