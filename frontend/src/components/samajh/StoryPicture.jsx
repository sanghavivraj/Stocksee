/**
 * One small picture per Money Card, so every story has its own look: a tree (SIP, PPF), a bank vault (FD), a pot with a tap
 * (SWP), a price board (shares), a basket (mutual funds, ETF) and gold bars. The picture follows Meera's mood, so a mood
 * change also changes the scenery (healthy or bare tree, shining or dull gold, rising or falling board).
 */
const up = (m) => m === 'happy' || m === 'proud' || m === 'wow';

function Tree({ mood, big }) {
  const good = up(mood); const bad = mood === 'worried';
  const leaf = bad ? '#b08a4a' : '#2e9b5f';
  const r = bad ? 15 : good ? 24 : 20;
  return (
    <g>
      <rect x="57" y={big ? 70 : 74} width="8" height="40" rx="3" fill="#8a5a33" />
      <circle cx="61" cy="60" r={r} fill={leaf} /><circle cx="44" cy="70" r={r - 5} fill={leaf} /><circle cx="78" cy="70" r={r - 5} fill={leaf} />
      {good && [[50, 54], [70, 62], [60, 44], [80, 76]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.4" fill="#ffc83d" />)}
      {bad && <path d="M52 112q9-6 18 0" stroke="#8a5a33" strokeWidth="2" fill="none" />}
    </g>
  );
}
function Vault({ mood }) {
  const bad = mood === 'worried';
  return (
    <g>
      <path d="M22 50L61 24l39 26z" fill="#6f7f95" /><rect x="28" y="52" width="66" height="8" fill="#8895a8" />
      {[34, 50, 66, 82].map((x) => <rect key={x} x={x} y="60" width="8" height="38" fill="#a9b4c4" />)}
      <rect x="24" y="98" width="74" height="8" rx="2" fill="#6f7f95" />
      <circle cx="61" cy="80" r="11" fill={bad ? '#c84b4b' : '#ffb938'} stroke="#3b4658" strokeWidth="2.4" /><circle cx="61" cy="80" r="3.4" fill="#3b4658" />
    </g>
  );
}
function Pot({ mood }) {
  const bad = mood === 'worried';
  return (
    <g>
      <path d="M36 54h50l-4 52H40z" fill="#9fb4d4" stroke="#3b4658" strokeWidth="2.4" />
      <path d={bad ? 'M40 92h42l-1 14H41z' : 'M39 66h44l-2 40H41z'} fill="#3fa0e8" opacity=".85" />
      <rect x="86" y="62" width="22" height="7" rx="3" fill="#6f7f95" /><path d="M104 69v6" stroke="#6f7f95" strokeWidth="3" />
      <circle cx="104" cy="82" r="3" fill="#3fa0e8" /><circle cx="104" cy="94" r="3" fill="#3fa0e8" opacity=".6" />
    </g>
  );
}
function Board({ mood }) {
  const bad = mood === 'worried'; const c = bad ? '#e0524a' : '#1baf7a';
  const d = bad ? 'M16 40L40 52L60 46L82 74L106 86' : 'M16 90L40 78L60 84L82 56L106 38';
  return (
    <g>
      <rect x="10" y="22" width="102" height="84" rx="8" fill="#1d2433" />
      <path d="M18 50h86M18 72h86M18 94h86" stroke="#39445a" strokeWidth="1" />
      <path d={d} fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={bad ? 'M96 78l10 8l-4-12z' : 'M96 46l10-8l-12-2z'} fill={c} />
    </g>
  );
}
function Basket({ mood, etf }) {
  const cols = ['#2a78d6', '#1baf7a', '#eb6834', '#a65bd6', '#d6a21b'];
  const bad = mood === 'worried';
  return (
    <g>
      {cols.map((c, i) => <circle key={c} cx={34 + i * 14} cy={bad ? 66 + (i % 2) * 6 : 58 + (i % 2) * 8} r="9" fill={c} />)}
      <path d="M22 70h78l-8 36H30z" fill="#b8845a" stroke="#7a5230" strokeWidth="2.4" />
      <path d="M32 82h58M34 94h54" stroke="#7a5230" strokeWidth="1.6" />
      {etf && <g><rect x="44" y="26" width="34" height="16" rx="4" fill="#1d2433" /><text x="61" y="38" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffc83d">ETF</text></g>}
    </g>
  );
}
function Gold({ mood }) {
  const shine = up(mood); const f = shine ? '#ffc83d' : '#c9a23e';
  const bar = (x, y) => <g key={`${x}${y}`}><path d={`M${x} ${y}h40l8 14H${x - 8}z`} fill={f} stroke="#8a6a12" strokeWidth="1.6" /></g>;
  return (
    <g>
      {bar(32, 92)}{bar(72, 92)}{bar(52, 76)}
      {shine && [[28, 60], [96, 64], [62, 52]].map(([x, y]) => <path key={x} d={`M${x} ${y - 6}l2 4 4 2-4 2-2 4-2-4-4-2 4-2z`} fill="#fff3b0" />)}
    </g>
  );
}

const PICS = { sip: Tree, ppf: Tree, fd: Vault, swp: Pot, stocks: Board, 'mutual-funds': Basket, etf: (p) => <Basket {...p} etf />, gold: Gold };

export default function StoryPicture({ cardId, mood, big = false }) {
  const Pic = PICS[cardId] || Tree;
  return (
    <svg className={`spic spic-${cardId} ${big ? 'spic-big' : ''}`} data-mood={mood} viewBox="0 0 122 118" aria-hidden="true" focusable="false">
      <Pic mood={mood} big={big} />
    </svg>
  );
}
