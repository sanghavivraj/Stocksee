/**
 * Weather for the story stage, driven by Meera's mood: rain and a flash of lightning when she is worried, coins and
 * sparkles floating up when she is happy, proud or amazed. Purely decorative (hidden from screen readers, off for people
 * who ask for less motion in the system settings).
 */
const DROPS = Array.from({ length: 14 }, (_, i) => ({ left: `${4 + i * 7}%`, delay: `${(i % 5) * 0.18}s`, dur: `${0.7 + (i % 3) * 0.15}s` }));
const COINS = Array.from({ length: 8 }, (_, i) => ({ left: `${8 + i * 11}%`, delay: `${(i % 4) * 0.22}s`, dur: `${1.8 + (i % 3) * 0.3}s` }));

export default function StoryFx({ mood }) {
  if (mood === 'worried') {
    return (
      <div className="sfx sfx-rain" aria-hidden="true">
        <i className="sfx-flash" />
        {DROPS.map((d, i) => <i key={i} className="sfx-drop" style={{ left: d.left, animationDelay: d.delay, animationDuration: d.dur }} />)}
      </div>
    );
  }
  if (mood === 'happy' || mood === 'proud' || mood === 'wow') {
    return (
      <div className={`sfx sfx-coins ${mood === 'wow' ? 'sfx-wow' : ''}`} aria-hidden="true">
        {COINS.map((c, i) => <i key={i} className="sfx-coin" style={{ left: c.left, animationDelay: c.delay, animationDuration: c.dur }}>₹</i>)}
      </div>
    );
  }
  return null;
}
