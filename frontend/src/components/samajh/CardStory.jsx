import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StoryCharacter from './StoryCharacter';
import { Buy, Lab, Run } from './StoryWidgets';
import RealSip from './RealSip';
import StoryPicture from './StoryPicture';
import StoryFx from './StoryFx';
import { computeCard } from '../../samajh/cardMath';
import { fill, formatInr } from '../../samajh/format';
import { pick } from '../../samajh/content';
import { SCENES } from '../../samajh/storyScenes';
import { createStoryAudio, STYLES } from '../../samajh/storyAudio';
import stories from '../../content/samajh/stories.json';
import frames from '../../content/samajh/storyFrames.json';
import ui from '../../content/samajh/ui.json';

/**
 * The story of one Money Card: Meera guides you through scenes that are about THIS card's topic.
 * Each scene lets you do something (press Play, tap, drag a slider) and Meera reacts. Every mood changes her eyes,
 * mouth, body and the glow behind her, and the numbers on the scene change with it. All numbers come from the
 * card's own maths with its example inputs; all words are in content/samajh/stories.json.
 */
export default function CardStory({ card, lang }) {
  const T = ui[lang]?.story || ui.en.story;
  const scenes = SCENES[card.id];
  const texts = stories[card.id];
  const calc = useMemo(() => computeCard(card.id, card.inputs, lang, formatInr), [card.id, card.inputs, lang]);
  const ctx = useMemo(() => ({ inp: card.inputs, vars: calc.vars, lang, formatInr, T, f: { inr: (v) => formatInr(v, lang) } }), [card.inputs, calc.vars, lang, T]);

  const frame = frames[card.id];
  const [step, setStep] = useState(0); // 0 = opening, 1..n = the scenes, n + 1 = the ending
  const total = scenes.length;
  const opening = step === 0; const ending = step === total + 1;
  const s = Math.min(Math.max(step - 1, 0), total - 1);
  const [mood, setMood] = useState('calm');
  const [line, setLine] = useState('');
  const [sound, setSound] = useState('off');
  const [soundErr, setSoundErr] = useState(false);
  const audio = useRef(null);
  if (!audio.current) audio.current = createStoryAudio();

  const scene = scenes[s];
  const text = texts[scene.id];

  const say = useCallback((l, extra) => {
    if (!l) return;
    setLine(fill(pick(l, lang), { ...calc.vars, ...(extra || {}) }, lang));
    setMood(l.mood);
  }, [calc.vars, lang]);
  const onSay = useCallback((key, extra) => { const l = text.says[key]; if (l) say(l, extra); }, [text, say]);
  const onMood = useCallback((m) => setMood(m), []);

  // a new scene: Meera introduces it
  useEffect(() => {
    if (opening) say({ mood: 'happy', ...frame.open });
    else if (ending) say({ mood: 'proud', en: ui.en.story.endingSay, hi: ui.hi.story.endingSay });
    else say(text.intro);
  }, [text, say, opening, ending, frame]);

  // the music follows the mood
  useEffect(() => {
    const a = audio.current;
    a.setMood(mood);
    if (mood === 'happy' || mood === 'proud') a.cue('rise');
    else if (mood === 'worried') a.cue('sad');
    else if (mood === 'wow') a.cue('pop');
    if (mood === 'happy' || mood === 'proud') a.cue('coin');
    else if (mood === 'worried') a.cue('thunder');
    else if (mood === 'wow') a.cue('cheer');
  }, [mood]);
  // the story was opened with a tap, so the browser lets the music start: begin with the calm style (one tap on Off silences it)
  useEffect(() => {
    const ok = audio.current.setStyle('calm');
    if (ok) setSound('calm');
    return () => audio.current.stop();
  }, []);

  const chooseSound = (style) => {
    const ok = audio.current.setStyle(style);
    setSoundErr(!ok && style !== 'off');
    setSound(ok ? style : 'off');
  };

  const props = { scene, text, ctx, onMood, onSay };
  let body;
  if (opening || ending) body = null;
  else if (scene.type === 'lab') body = <Lab key={scene.id} {...props} />;
  else if (scene.type === 'run') body = <Run key={scene.id} {...props} />;
  else if (scene.type === 'buy') body = <Buy key={scene.id} {...props} />;
  else body = <RealSip key={scene.id} lang={lang} />;

  return (
    <section className="sstory" aria-label={T.title}>
      <div className="sstory-head">
        <span className="sstory-kicker">{opening ? T.opening : ending ? T.ending : fill(T.scene, { n: s + 1, total }, lang)}</span>
        <h5 className="sstory-title">{opening || ending ? pick(card.name, lang) : pick(text.title, lang)}</h5>
      </div>
      <div className="sstory-stage" data-mood={mood}>
        <StoryFx mood={mood} key={`fx-${step}-${mood}`} />
        {opening && <div className="sstory-cover"><StoryPicture cardId={card.id} mood={mood} big /></div>}
        {ending && (
          <div className="sstory-cover">
            <StoryPicture cardId={card.id} mood={mood} big />
            <ul className="sstory-points" aria-label={T.remember}>{frame.end.map((l) => <li key={l.en}>{pick(l, lang)}</li>)}</ul>
          </div>
        )}
        {body && <div className="sstory-scenebody"><StoryPicture cardId={card.id} mood={mood} />{body}</div>}
      </div>
      <div className="sstory-dock" data-mood={mood}>
        <div className="sstory-char"><StoryCharacter mood={mood} label={T.character} /></div>
        <p className="sstory-bubble" aria-live="polite" key={line}>{line}</p>
      </div>
      <div className="sstory-bar-row">
        <button type="button" className="sstory-btn" onClick={() => setStep((n) => n - 1)} disabled={step === 0} aria-label={T.prev}><ChevronLeft size={18} aria-hidden="true" /> {T.prev}</button>
        <div className="sstory-dots" aria-hidden="true">{Array.from({ length: total + 2 }, (_, k) => <span key={k} className={k === step ? 'on' : k < step ? 'done' : ''} />)}</div>
        <button type="button" className="sstory-btn sstory-main" onClick={() => setStep((n) => (ending ? 0 : n + 1))} aria-label={ending ? T.again : opening ? T.start : T.next}>{ending ? T.again : opening ? T.start : T.next} <ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="sstory-sound" role="group" aria-label={T.sound}>
        <span>{T.sound}:</span>
        {STYLES.map((st) => (
          <button key={st} type="button" className={`samajh-seg-btn ${sound === st ? 'on' : ''}`} aria-pressed={sound === st} onClick={() => chooseSound(st)}>{T[st]}</button>
        ))}
      </div>
      {soundErr && <p className="sstory-note" role="status">{T.soundUnavailable}</p>}
      <p className="sstory-note">{T.note}</p>
    </section>
  );
}
