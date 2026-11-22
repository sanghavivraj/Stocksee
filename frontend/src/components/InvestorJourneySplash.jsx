import { useEffect, useRef } from 'react';
import markup from './journey/journeyMarkup';
import { createJourney, TEXT, TOTAL } from './journey/journeyEngine';
import '../styles/journey.css';

/**
 * StockSee's opening animation, "The Investor's Journey" (see journey/journeyEngine.js for the story).
 * It plays once by itself, in the language the person already chose, and fades into the app. The only control is
 * skipping: tap, click or press any key. People who ask their device for less motion get one still frame instead.
 */
const HOLD_MS = 400; // the finished logo stays a moment before the fade
const EXIT_MS = 500; // normal fade into the app
const SKIP_MS = 220; // quick fade when the person skips

const InvestorJourneySplash = ({ language = 'en', onDone }) => {
  const lang = TEXT[language] ? language : 'en';
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const skipRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const root = rootRef.current;
    const journey = createJourney(hostRef.current, lang);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; let timer = 0; let leaving = false; let t = 0; let last = 0;

    const finish = (ms) => {
      if (leaving) return;
      leaving = true;
      cancelAnimationFrame(raf);
      root.style.setProperty('--jny-exit', `${ms}ms`);
      root.classList.add('is-leaving');
      timer = setTimeout(() => onDoneRef.current?.(), ms);
    };

    const show = requestAnimationFrame(() => root.classList.add('is-in'));
    if (reduced) {
      journey.render(TOTAL); // one calm still frame: the finished logo
      timer = setTimeout(() => finish(300), 1600);
    } else {
      const frame = (now) => {
        if (!last) last = now;
        t += Math.min(now - last, 80); // a hidden tab must not make the story jump ahead
        last = now;
        journey.render(t);
        if (t >= TOTAL + HOLD_MS) finish(EXIT_MS); else raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    const skip = () => finish(SKIP_MS);
    skipRef.current = skip;
    window.addEventListener('keydown', skip);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(show); clearTimeout(timer);
      window.removeEventListener('keydown', skip);
    };
  }, [lang]);

  const L = TEXT[lang];
  return (
    <div
      ref={rootRef}
      className="jny"
      role="img"
      aria-label={`StockSee. ${L.tag[0]} ${L.tag[1]}`}
      onPointerDown={() => skipRef.current?.()}
    >
      {/* static drawing from journeyMarkup.js (no user data is ever put in it) */}
      <div ref={hostRef} className="jny-host" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
    </div>
  );
};

export default InvestorJourneySplash;
