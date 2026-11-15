import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../context/UserContext';
import marketService from '../services/marketService';
import { formatPercent } from '../utils/insightCopy';

/**
 * Market breadth: how the whole live Nifty 500 list did today. Worked out from market data, not written by hand.
 * It describes today and says nothing about tomorrow.
 */
const COPY = {
  en: {
    kicker: 'MARKET BREADTH', title: 'The market today, across the whole list',
    head: (n) => `Across ${n} stocks of the Nifty 500`,
    moves: (up, down, flat) => `${up} rose, ${down} fell, ${flat} unchanged.`,
    near: (h, l) => `${h} are within 2% of their 52-week high and ${l} within 2% of their 52-week low.`,
    volume: (v) => `${v} traded at 2× their usual volume or more.`,
    strong: 'Strongest industries today', weak: 'Weakest industries today', stocks: 'stocks',
    note: 'The average move of each industry’s stocks, equally weighted. A description of today, not a forecast.',
    unavailable: 'Market breadth is unavailable right now.', loading: 'Looking at the whole market…',
  },
  hi: {
    kicker: 'बाज़ार का दायरा', title: 'आज पूरे बाज़ार का हाल',
    head: (n) => `निफ्टी 500 के ${n} शेयरों में`,
    moves: (up, down, flat) => `${up} बढ़े, ${down} गिरे, ${flat} स्थिर।`,
    near: (h, l) => `${h} अपने 52 हफ्ते के उच्च के 2% के भीतर और ${l} निम्न के 2% के भीतर हैं।`,
    volume: (v) => `${v} में सामान्य वॉल्यूम का 2 गुना या अधिक कारोबार हुआ।`,
    strong: 'आज सबसे मज़बूत उद्योग', weak: 'आज सबसे कमज़ोर उद्योग', stocks: 'शेयर',
    note: 'हर उद्योग के शेयरों की औसत चाल, बराबर भार के साथ। यह आज का वर्णन है, पूर्वानुमान नहीं।',
    unavailable: 'बाज़ार का दायरा अभी उपलब्ध नहीं है।', loading: 'पूरे बाज़ार को देखा जा रहा है…',
  },
  gu: {
    kicker: 'બજારનો વ્યાપ', title: 'આજે આખા બજારની હાલત',
    head: (n) => `નિફ્ટી 500 ના ${n} શેરોમાં`,
    moves: (up, down, flat) => `${up} વધ્યા, ${down} ઘટ્યા, ${flat} સ્થિર.`,
    near: (h, l) => `${h} પોતાના 52 અઠવાડિયાના ઊંચાના 2% અંદર અને ${l} નીચાના 2% અંદર છે.`,
    volume: (v) => `${v} માં સામાન્ય વોલ્યુમ કરતાં 2 ગણું કે વધુ કારોબાર થયો.`,
    strong: 'આજે સૌથી મજબૂત ઉદ્યોગો', weak: 'આજે સૌથી નબળા ઉદ્યોગો', stocks: 'શેર',
    note: 'દરેક ઉદ્યોગના શેરોની સરેરાશ ચાલ, સમાન ભાર સાથે. આ આજનું વર્ણન છે, આગાહી નથી.',
    unavailable: 'બજારનો વ્યાપ હાલ ઉપલબ્ધ નથી.', loading: 'આખું બજાર જોવાઈ રહ્યું છે…',
  },
};

const IndustryList = ({ rows, stocksWord }) => (
  <ul className="breadth-industries">
    {rows.map((r) => (
      <li key={r.name}>
        <span>{r.name} <small>({r.count} {stocksWord})</small></span>
        <strong className={r.avgChangePercent > 0 ? 'cue-up' : r.avgChangePercent < 0 ? 'cue-down' : ''}>{formatPercent(r.avgChangePercent)}</strong>
      </li>
    ))}
  </ul>
);

const MarketBreadth = () => {
  const { language } = useContext(UserContext);
  const T = COPY[language] || COPY.en;
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let alive = true;
    marketService.getBreadth()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => { alive = false; };
  }, []);

  const { status, data } = state;
  return (
    <section className="editorial-flow-section" aria-label={T.title}>
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
          <p className="briefing-next">{T.head(data.quoted)} · {data.asOf ? new Date(data.asOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</p>
          <p className="breadth-line">{T.moves(data.advancers, data.decliners, data.unchanged)}</p>
          <p className="breadth-line">{T.near(data.nearHigh, data.nearLow)} {T.volume(data.highVolume)}</p>
          <div className="breadth-columns">
            <div>
              <p className="briefing-label">{T.strong}</p>
              <IndustryList rows={data.strongestIndustries} stocksWord={T.stocks} />
            </div>
            <div>
              <p className="briefing-label">{T.weak}</p>
              <IndustryList rows={data.weakestIndustries} stocksWord={T.stocks} />
            </div>
          </div>
          <p className="briefing-foot">{T.note}</p>
        </div>
      )}
    </section>
  );
};

export default MarketBreadth;
