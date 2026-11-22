/**
 * Meera, the story guide. One drawing, five moods. Every mood changes ALL of: the eyes, the mouth (and brows),
 * the body (arms and a small dance or shake), the glow behind her (on the stage), and the chart beside her (CardStory).
 * The look of each mood is in samajh.css (.sc-*); this file only picks the mouth and brows.
 */
const FACES = {
  calm: { m: 'M44 63Q50 66 56 63', l: 'M35 44q5-2 10 0', r: 'M55 44q5-2 10 0' },
  happy: { m: 'M43 62Q50 69 57 62', l: 'M35 43q5-3 10 0', r: 'M55 43q5-3 10 0' },
  proud: { m: 'M42 61Q50 71 58 61Z', l: 'M35 42q5-4 10-1', r: 'M55 41q5-1 10 1' },
  wow: { m: 'M46.5 63a3.5 4 0 1 0 7 0a3.5 4 0 1 0-7 0', l: 'M35 40q5-4 10-1', r: 'M55 39q5-1 10 1' },
  worried: { m: 'M43 66Q50 60 57 66', l: 'M35 44q5-1 10-4', r: 'M55 40q5 3 10 4' },
};

export default function StoryCharacter({ mood = 'calm', label }) {
  const f = FACES[mood] || FACES.calm;
  return (
    <svg className={`sc sc-${mood}`} viewBox="0 0 120 150" role="img" aria-label={label}>
      {/* arms first, so the body sits over their top */}
      <g className="sc-arm sc-armL"><rect x="25" y="108" width="11" height="32" rx="5.5" fill="#ffb938" /><circle cx="30.5" cy="142" r="6.5" fill="#c98a5e" /></g>
      <g className="sc-arm sc-armR"><rect x="84" y="108" width="11" height="32" rx="5.5" fill="#ffb938" /><circle cx="89.5" cy="142" r="6.5" fill="#c98a5e" /></g>
      <path d="M22 150C22 60 98 60 98 150Z" fill="#ffb938" />
      <path d="M52 84l8 9 8-9" fill="none" stroke="#c97a12" strokeWidth="2" />
      <g transform="translate(10 -4)">
        <path d="M24 56C18 24 82 24 76 56L78 80C68 72 32 72 22 80Z" fill="#1b1230" />
        <circle cx="50" cy="17" r="10" fill="#1b1230" />
        <rect x="44" y="70" width="12" height="14" rx="4" fill="#b8754c" />
        <ellipse cx="50" cy="52" rx="22" ry="24" fill="#c98a5e" />
        <path d="M28 48C30 26 70 26 72 48C64 38 46 34 28 48Z" fill="#1b1230" />
        <circle cx="28.5" cy="58" r="2.2" fill="#ffb938" /><circle cx="71.5" cy="58" r="2.2" fill="#ffb938" />
        <g fill="none" stroke="#1b1230" strokeWidth="2.4" strokeLinecap="round"><path d={f.l} /><path d={f.r} /></g>
        <g className="sc-eyes sc-eO"><ellipse cx="40.5" cy="51" rx="3.4" ry="4.2" fill="#1b1230" /><ellipse cx="59.5" cy="51" rx="3.4" ry="4.2" fill="#1b1230" /><circle cx="41.7" cy="49.4" r="1.2" fill="#fff" /><circle cx="60.7" cy="49.4" r="1.2" fill="#fff" /></g>
        <g className="sc-eH" fill="none" stroke="#1b1230" strokeWidth="2.8" strokeLinecap="round"><path d="M35.5 53q5-8 10 0" /><path d="M54.5 53q5-8 10 0" /></g>
        <g className="sc-eW"><ellipse cx="40.5" cy="50" rx="5" ry="6.2" fill="#fff" stroke="#1b1230" strokeWidth="1.4" /><ellipse cx="59.5" cy="50" rx="5" ry="6.2" fill="#fff" stroke="#1b1230" strokeWidth="1.4" /><circle cx="40.5" cy="50.5" r="2.4" fill="#1b1230" /><circle cx="59.5" cy="50.5" r="2.4" fill="#1b1230" /></g>
        <g className="sc-eS"><ellipse cx="40.5" cy="52" rx="3.8" ry="3.8" fill="#1b1230" /><ellipse cx="59.5" cy="52" rx="3.8" ry="3.8" fill="#1b1230" /><circle cx="41.8" cy="50.6" r="1.7" fill="#fff" /><circle cx="60.8" cy="50.6" r="1.7" fill="#fff" /></g>
        <path className="sc-tear" d="M34.5 57q-3 5 0 8q3-3 0-8z" fill="#7aa7ff" />
        <ellipse cx="34" cy="60" rx="4.5" ry="2.4" fill="#ff7a6b" opacity=".45" /><ellipse cx="66" cy="60" rx="4.5" ry="2.4" fill="#ff7a6b" opacity=".45" />
        <path d={f.m} fill={mood === 'wow' || mood === 'proud' ? '#5a1f1a' : 'none'} stroke="#5a1f1a" strokeWidth="2.4" strokeLinecap="round" />
        <g className="sc-spk" fill="#ffe3a6"><path d="M82 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M18 30l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" /></g>
      </g>
    </svg>
  );
}
