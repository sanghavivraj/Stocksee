import { useCallback, useEffect, useRef, useState } from 'react';
import { pickVoice, plainForSpeech, speechLangFor } from '../utils/speech';

const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

/** Speak a question instead of typing it. `onText` gets the words; `onError` gets a short reason code. */
export function useVoiceInput(language, onText, onError) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const supported = Boolean(Recognition);

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = speechLangFor(language);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) onText(text.trim());
    };
    rec.onerror = (e) => onError?.(e.error || 'error');
    rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [language, onText, onError]);

  useEffect(() => () => recRef.current?.abort?.(), []);
  return { supported, listening, start, stop };
}

/** Read an answer aloud, only when this device has a voice for the language. */
export function useSpeakAnswer(language) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const [voice, setVoice] = useState(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!synth) return undefined;
    const update = () => setVoice(pickVoice(synth.getVoices(), language));
    update();
    synth.addEventListener?.('voiceschanged', update);
    return () => synth.removeEventListener?.('voiceschanged', update);
  }, [synth, language]);

  useEffect(() => () => synth?.cancel(), [synth]);

  const stop = useCallback(() => { synth?.cancel(); setSpeaking(false); }, [synth]);
  const speak = useCallback((text) => {
    if (!synth || !voice) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(plainForSpeech(text));
    u.voice = voice;
    u.lang = voice.lang;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }, [synth, voice]);

  return { available: Boolean(synth && voice), speaking, speak, stop };
}
