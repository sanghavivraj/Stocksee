import { useEffect, useRef } from 'react';
import { createJourney3D, TEXT, TOTAL } from '../story3d/journey3d';
import '../styles/journey.css';

/**
 * StockSee's opening film, "The Investor's Journey", in 3D (see story3d/journey3d.ts for the story). It plays once per visit,
 * in the language the person already chose, and fades into the app. The only control is skipping: tap, click or press any key.
 * The 2D version (InvestorJourneySplash) is used on devices that cannot draw 3D and for people who asked for less motion.
 */
const HOLD_MS = 400; // the finished logo stays a moment before the fade
const EXIT_MS = 500; // normal fade into the app
const SKIP_MS = 220; // quick fade when the person skips
const MAX_SIDE = 1920; // never draw more pixels than a full-HD screen needs

const InvestorJourney3D = ({ language = 'en', onDone }) => {
  const lang = TEXT[language] ? language : 'en';
  const rootRef = useRef(null);
  const hostRef = useRef(null);
  const skipRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    const journey = createJourney3D(host, lang);
    const fit = () => {
      const w = host.clientWidth || window.innerWidth; const h = host.clientHeight || window.innerHeight;
      const k = Math.min(1, MAX_SIDE / Math.max(w, h));
      journey.resize(w * k, h * k);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(host);
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
    const frame = (now) => {
      if (!last) last = now;
      t += Math.min(now - last, 80); // a hidden tab must not make the story jump ahead
      last = now;
      journey.render(t);
      if (t >= TOTAL + HOLD_MS) finish(EXIT_MS); else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const skip = () => finish(SKIP_MS);
    skipRef.current = skip;
    window.addEventListener('keydown', skip);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(show); clearTimeout(timer); ro.disconnect();
      window.removeEventListener('keydown', skip);
      journey.dispose();
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
      <div ref={hostRef} className="jny-host" aria-hidden="true" />
    </div>
  );
};

export default InvestorJourney3D;
