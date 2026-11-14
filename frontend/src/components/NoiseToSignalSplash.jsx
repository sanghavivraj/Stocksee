import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/splash.css';

/**
 * "Noise to Signal" intro.
 *
 * Story: chaotic chart lines + hype "tips" (the noise of WhatsApp/Telegram markets) -> a gold scan line
 * sweeps across and clears them -> one calm line remains (the signal) -> it folds into the SS logo ->
 * the tagline types out in the user's language.
 *
 * Tech: one <canvas> drawn with requestAnimationFrame (noise, scan beam, signal line); everything else is
 * CSS animating only transform/opacity, so it stays on the GPU compositor and smooth on phones.
 */

// ---- Tweak timing here (milliseconds from start) ----
export const TIMING = {
  fadeIn: 350, // overlay fades in
  scanStart: 700, // gold scan line starts sweeping
  scanEnd: 2700, // ...and reaches the right edge (2 s: slow enough to follow the noise being cleared)
  morphEnd: 3500, // signal line has shrunk to the logo's width
  stampDur: 550, // thin line grows into the SS square
  nameAt: 3900, // "StockSee" fades in
  typeStart: 4300, // tagline starts typing
  typeEnd: 6000, // ...and is fully typed (about 25 letters per second: readable)
  exitStart: 7600, // tagline stays fully visible for ~1.6 s, then the overlay fades into the dashboard
  total: 8200, // overlay removed
  skipFade: 220, // quick fade when the user skips
};

// ---- Tweak colours here ----
export const COLORS = {
  gold: '#D4AF37',
  bgInner: '#2B1650',
  bgOuter: '#120826',
  noise: ['rgba(196, 170, 255, 0.30)', 'rgba(248, 113, 113, 0.26)', 'rgba(52, 211, 153, 0.24)'],
};

const TAGLINE = {
  en: ['Markets in your language.', 'Facts, not tips.'],
  hi: ['आपकी भाषा में बाज़ार।', 'टिप्स नहीं, तथ्य।'],
  gu: ['તમારી ભાષામાં બજાર.', 'ટિપ્સ નહીં, તથ્યો.'],
};

const SKIP_HINT = { en: 'Tap or press any key to skip', hi: 'छोड़ने के लिए टैप करें या कोई भी कुंजी दबाएँ', gu: 'છોડવા માટે ટૅપ કરો અથવા કોઈ પણ કી દબાવો' };

const TIP_WORDS = ['HOT TIP', 'BUY NOW', '100% SURE', 'UPPER CIRCUIT', 'पक्का डबल', 'JACKPOT', 'ગેરંટી', 'VIP GROUP', '10X IN 7 DAYS', 'अंदर की खबर'];

const VIRAMA_END = /[्્]$/; // Devanagari / Gujarati halant

/**
 * Split text into user-perceived characters so typing never shows a broken half-letter:
 * "क्षे" stays one unit instead of क + ् + ष + े. Works for Latin, Devanagari and Gujarati.
 */
export function splitGraphemes(text, lang = 'en') {
  let parts;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    parts = Array.from(new Intl.Segmenter(lang, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  } else {
    parts = [];
    for (const ch of Array.from(text)) {
      if (parts.length && /\p{M}/u.test(ch)) parts[parts.length - 1] += ch;
      else parts.push(ch);
    }
  }
  // Older engines end a cluster at the halant: glue it to the next consonant (conjuncts like क्ष, ત્ર)
  const out = [];
  for (const p of parts) {
    if (out.length && VIRAMA_END.test(out[out.length - 1])) out[out.length - 1] += p;
    else out.push(p);
  }
  return out;
}

/** Small seeded random generator so the layout is stable for one run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const easeOut = (p) => 1 - (1 - p) ** 3;
const lerp = (a, b, p) => a + (b - a) * p;

const NoiseToSignalSplash = ({ language = 'en', onDone }) => {
  const lang = TAGLINE[language] ? language : 'en';
  const [line1, line2] = TAGLINE[lang];
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  const g1 = useMemo(() => splitGraphemes(line1, lang), [line1, lang]);
  const g2 = useMemo(() => splitGraphemes(line2, lang), [line2, lang]);
  const totalChars = g1.length + g2.length;
  const [typed, setTyped] = useState(reduced ? totalChars : 0);

  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const stampRef = useRef(null);
  const tipRefs = useRef([]);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Hype words: one per slot (columns x upper/lower band) so they never overlap, and the centre stays free for the logo
  const tips = useMemo(() => {
    const r = rng(Date.now());
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const cols = vw < 520 ? 2 : vw < 1000 ? 3 : 5;
    const slots = [];
    for (const band of [[8, 26], [64, 24]]) {
      for (let c = 0; c < cols; c += 1) slots.push({ c, top: band[0] + r() * band[1] });
    }
    const colW = 92 / cols;
    return slots
      .sort(() => r() - 0.5)
      .slice(0, Math.min(TIP_WORDS.length, slots.length))
      .map((slot, i) => ({
        word: TIP_WORDS[i],
        left: 3 + slot.c * colW + r() * Math.min(4, colW * 0.15),
        top: slot.top,
        delay: Math.round(r() * 260),
        tilt: (r() - 0.5) * 6,
      }));
  }, []);

  // Finish: fade out quickly (skip) or normally, then unmount
  const finish = (fadeMs) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const root = rootRef.current;
    if (root) {
      root.style.setProperty('--n2s-exit', `${fadeMs}ms`);
      root.classList.add('is-leaving');
    }
    setTimeout(() => onDoneRef.current?.(), fadeMs);
  };

  // Skip on any key or click/tap
  useEffect(() => {
    const skip = () => finish(TIMING.skipFade);
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reduced motion: a static card that fades in and out (no movement, no canvas)
  useEffect(() => {
    if (!reduced) return undefined;
    const root = rootRef.current;
    const raf = requestAnimationFrame(() => root?.classList.add('is-in'));
    const timer = setTimeout(() => finish(300), 1600);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Full animation: one requestAnimationFrame loop drives the canvas and the timeline
  useEffect(() => {
    if (reduced) return undefined;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const r = rng(42);
    let W = 0; let H = 0; let cx = 0; let cy = 0; let stampW = 84;
    let lines = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap for phone GPUs
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const box = stampRef.current.getBoundingClientRect(); // transform-origin is the centre, so this is stable
      cx = box.left + box.width / 2; cy = box.top + box.height / 2; stampW = box.width;
      const n = W < 520 ? 6 : 9;
      lines = Array.from({ length: n }, (_, i) => ({
        base: (i + 0.5) / n,
        amp: 10 + r() * 26,
        freq: 0.008 + r() * 0.02,
        speed: 0.6 + r() * 1.4,
        seed: r() * 1000,
        color: COLORS.noise[i % COLORS.noise.length],
        width: 1 + r() * 1.2,
      }));
    };
    resize();
    window.addEventListener('resize', resize);

    // Deterministic per-point jitter that changes ~11x per second (position only, never brightness)
    const jitter = (k, step) => {
      const x = Math.sin(k * 127.1 + step * 311.7) * 43758.5453;
      return x - Math.floor(x) - 0.5;
    };

    const drawNoise = (t, fromX, alpha) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(fromX, 0, W - fromX, H);
      ctx.clip();
      ctx.globalAlpha = alpha;
      const step = Math.floor(t / 90);
      for (const ln of lines) {
        ctx.beginPath();
        ctx.strokeStyle = ln.color;
        ctx.lineWidth = ln.width;
        for (let x = -10, k = 0; x <= W + 24; x += 24, k += 1) {
          const y = ln.base * H
            + Math.sin(x * ln.freq + t * 0.004 * ln.speed + ln.seed) * ln.amp
            + Math.sin(x * ln.freq * 2.7 - t * 0.006 + ln.seed) * ln.amp * 0.45
            + jitter(k + ln.seed, step) * 10;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawSignal = (t, left, right, amp, width, alpha) => {
      if (right - left < 1) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let x = left; x <= right; x += 6) {
        const y = cy + Math.sin(x * 0.012 + t * 0.002) * amp;
        if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(right, cy + Math.sin(right * 0.012 + t * 0.002) * amp);
      ctx.stroke();
      ctx.restore();
    };

    const drawBeam = (x) => {
      const grad = ctx.createLinearGradient(x - 60, 0, x + 18, 0);
      grad.addColorStop(0, 'rgba(212, 175, 55, 0)');
      grad.addColorStop(0.8, 'rgba(212, 175, 55, 0.22)');
      grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 60, 0, 78, H);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(x - 1, 0, 2, H);
    };

    let start = 0;
    let raf = 0;
    let lastTyped = -1;
    let leavingStarted = false;
    const cleared = new Set();

    const frame = (now) => {
      if (!start) { start = now; root.classList.add('is-in'); }
      const t = now - start;
      ctx.clearRect(0, 0, W, H);

      const scanP = easeInOut(clamp01((t - TIMING.scanStart) / (TIMING.scanEnd - TIMING.scanStart)));
      const scanX = t < TIMING.scanStart ? 0 : scanP * W;

      // 1. Noise to the right of the scan line
      if (scanX < W) drawNoise(t, scanX, clamp01(t / TIMING.fadeIn));

      // 2. Hype words dissolve as the beam passes them
      tips.forEach((tip, i) => {
        if (!cleared.has(i) && scanX >= (tip.left / 100) * W) {
          cleared.add(i);
          tipRefs.current[i]?.classList.add('is-cleared');
        }
      });

      // 3. The signal: calm gold line behind the beam, then it folds to the logo's width
      if (t < TIMING.scanEnd) {
        drawSignal(t, 0, scanX, 7, 2.5, 1);
      } else if (t < TIMING.morphEnd + 160) {
        const m = easeOut(clamp01((t - TIMING.scanEnd) / (TIMING.morphEnd - TIMING.scanEnd)));
        const fade = 1 - clamp01((t - TIMING.morphEnd) / 160); // the CSS logo takes over
        drawSignal(t, lerp(0, cx - stampW / 2, m), lerp(W, cx + stampW / 2, m), 7 * (1 - m), lerp(2.5, 4, m), fade);
      }

      // 4. Scan beam
      if (t >= TIMING.scanStart && scanP < 1) drawBeam(scanX);

      // 5. Tagline typing (by whole letters, incl. Hindi/Gujarati clusters)
      const n = Math.round(clamp01((t - TIMING.typeStart) / (TIMING.typeEnd - TIMING.typeStart)) * totalChars);
      if (n !== lastTyped) { lastTyped = n; setTyped(n); }

      // 6. Exit into the dashboard
      if (!leavingStarted && t >= TIMING.exitStart) {
        leavingStarted = true;
        finish(TIMING.total - TIMING.exitStart);
      }
      if (t < TIMING.total) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, tips, totalChars]);

  const typed1 = Math.min(typed, g1.length);
  const typed2 = Math.max(0, typed - g1.length);
  const caretOn1 = typed < g1.length;
  const typingDone = typed >= totalChars;

  const cssVars = {
    '--n2s-gold': COLORS.gold,
    '--n2s-bg-inner': COLORS.bgInner,
    '--n2s-bg-outer': COLORS.bgOuter,
    '--n2s-fade-in': `${TIMING.fadeIn}ms`,
    '--n2s-stamp-at': `${TIMING.morphEnd - 40}ms`,
    '--n2s-stamp-dur': `${TIMING.stampDur}ms`,
    '--n2s-name-at': `${TIMING.nameAt}ms`,
    '--n2s-exit': `${TIMING.total - TIMING.exitStart}ms`,
  };

  return (
    <div
      ref={rootRef}
      className={`n2s ${reduced ? 'is-reduced' : ''}`}
      style={cssVars}
      role="img"
      aria-label={`StockSee. ${line1} ${line2}`}
      onPointerDown={() => finish(TIMING.skipFade)}
    >
      {!reduced && <canvas ref={canvasRef} className="n2s-canvas" aria-hidden="true" />}

      {!reduced && (
        <div className="n2s-tips" aria-hidden="true">
          {tips.map((tip, i) => (
            <span
              key={tip.word}
              ref={(el) => { tipRefs.current[i] = el; }}
              className="n2s-tip"
              style={{ left: `${tip.left}%`, top: `${tip.top}%`, '--d': `${tip.delay}ms`, '--tilt': `${tip.tilt}deg` }}
            >
              <span className="n2s-tip-inner">{tip.word}</span>
            </span>
          ))}
        </div>
      )}

      <div className="n2s-center" aria-hidden="true">
        <div ref={stampRef} className="n2s-stamp"><span>SS</span></div>
        <div className="n2s-name">StockSee</div>
        <p className="n2s-tagline" lang={lang}>
          <span className="n2s-line">
            {g1.slice(0, typed1).join('')}
            {caretOn1 && <span className="n2s-caret" />}
            <span className="n2s-ghost">{g1.slice(typed1).join('')}</span>
          </span>
          <span className="n2s-line n2s-accent">
            {g2.slice(0, typed2).join('')}
            {!caretOn1 && <span className={`n2s-caret ${typingDone ? 'is-done' : ''}`} />}
            <span className="n2s-ghost">{g2.slice(typed2).join('')}</span>
          </span>
        </p>
      </div>

      <div className="n2s-hint" aria-hidden="true">{SKIP_HINT[lang]}</div>
    </div>
  );
};

export default NoiseToSignalSplash;
