import { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import visitorService from '../services/visitorService';
import { detectLanguage, browserLanguages } from '../utils/detectLanguage';

/**
 * App-wide state for "this browser". There are no accounts: the server recognises the browser by an
 * anonymous cookie that it creates the first time something is saved (watchlist, alert, Telegram, language).
 */
const UserContext = createContext(null);

const storage = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

const UserProvider = ({ children }) => {
  const [visitor, setVisitor] = useState(null); // null until this browser has saved something
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => storage.get('stocksee_theme') || 'light');
  const [language, setLanguage] = useState(() => storage.get('stocksee_lang') || detectLanguage(browserLanguages()));
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const languageRef = useRef(language);
  languageRef.current = language;

  // Tell the browser which language the page is in (correct fonts, spelling tools, screen readers)
  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storage.set('stocksee_theme', theme);
  }, [theme]);

  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  /** A short message. Pass `action: { label, onClick }` for a button (e.g. Undo); such a toast stays a little longer. */
  const addToast = useCallback((message, type = 'info', action = null) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => dismissToast(id), action ? 7000 : 4000);
  }, [dismissToast]);

  useEffect(() => {
    visitorService.me()
      .then((v) => {
        setVisitor(v);
        if (v?.language && !storage.get('stocksee_lang')) setLanguage(v.language);
      })
      .catch(() => setVisitor(null))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Call after any save. The first save creates the anonymous visitor on the server;
   * make sure it uses the language chosen in this browser (used for Telegram messages).
   */
  const refreshVisitor = useCallback(async () => {
    let v = await visitorService.me();
    if (v && v.language !== languageRef.current) {
      v = await visitorService.updatePreferences({ language: languageRef.current });
    }
    setVisitor(v);
    return v;
  }, []);

  const updateUserLanguage = useCallback(async (newLanguage) => {
    setLanguage(newLanguage);
    storage.set('stocksee_lang', newLanguage);
    if (visitor) {
      try {
        setVisitor(await visitorService.updatePreferences({ language: newLanguage }));
      } catch (err) {
        addToast(err.userMessage || 'Could not save your language', 'error');
      }
    }
  }, [visitor, addToast]);

  const toggleTheme = useCallback(() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')), []);

  const value = useMemo(() => ({
    visitor, loading, refreshVisitor,
    theme, toggleTheme, language, updateUserLanguage, addToast,
  }), [visitor, loading, refreshVisitor, theme, toggleTheme, language, updateUserLanguage, addToast]);

  return (
    <UserContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        style={{ position: 'fixed', bottom: '80px', right: '16px', left: '16px', alignItems: 'flex-end', zIndex: 9999, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              maxWidth: '100%',
              backgroundColor: 'var(--fg-surface)',
              color: 'var(--fg-text)',
              border: '1px solid var(--fg-border)',
              borderLeft: `4px solid ${toast.type === 'error' ? 'var(--fg-negative)' : 'var(--fg-accent)'}`,
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-md)',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            {toast.message}
            {toast.action && (
              <button type="button" className="toast-undo" onClick={() => { toast.action.onClick(); dismissToast(toast.id); }}>
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </UserContext.Provider>
  );
};

export { UserContext, UserProvider };
