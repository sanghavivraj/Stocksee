import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UserContext } from './UserContext';
import watchlistService from '../services/watchlistService';

const STORAGE_KEY = 'stocksee_my_watchlist';
const LEGACY_KEY = 'finguru_my_watchlist';
const DEFAULT_SYMBOLS = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS'];

const readLocal = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || 'null');
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
const clearLocal = () => {
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
};

/** Normalise user input: "reliance" -> "RELIANCE.NS"; indices/commodities kept as-is. */
export const normalizeSymbol = (raw) => {
  const clean = String(raw || '').trim().toUpperCase();
  if (!clean) return '';
  if (clean.endsWith('.NS') || clean.endsWith('.BO') || clean.startsWith('^') || clean.includes('=')) return clean;
  if (['GOLD', 'CRUDEOIL', 'NIFTYBANK', 'SILVER'].includes(clean)) return clean;
  return `${clean}.NS`;
};

const WatchlistContext = createContext(null);

/**
 * One watchlist for the whole app, saved for "this browser" (no sign-up).
 * - Before the first save it is just the defaults / whatever was stored locally.
 * - The first add/remove saves the whole list to the server (which creates the anonymous visitor cookie),
 *   so the Telegram morning brief and weekly digest can include it.
 */
export function WatchlistProvider({ children }) {
  const { visitor, loading: visitorLoading, refreshVisitor, addToast } = useContext(UserContext);
  const [items, setItems] = useState([]); // [{ id?, symbol }]
  const [loading, setLoading] = useState(true);
  const hasVisitor = Boolean(visitor);
  // What this browser was showing before it had a visitor. If the visitor gets created by something else
  // (an alert, Telegram, language), this list is saved so the watchlist doesn't suddenly turn empty.
  const anonSymbolsRef = useRef(null);

  useEffect(() => {
    if (visitorLoading) return undefined;
    let active = true;

    if (!hasVisitor) {
      const shown = readLocal() || DEFAULT_SYMBOLS;
      anonSymbolsRef.current = shown;
      setItems(shown.map((symbol) => ({ symbol })));
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    (async () => {
      try {
        // A list saved in the browser by an older version is moved to the server once
        const local = readLocal();
        const carryOver = local?.length ? local : anonSymbolsRef.current;
        anonSymbolsRef.current = null;
        const list = carryOver?.length ? await watchlistService.import(carryOver) : await watchlistService.list();
        if (local) clearLocal();
        if (active) setItems(list);
      } catch (err) {
        if (active) addToast(err.userMessage || 'Could not load your watchlist', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [hasVisitor, visitorLoading, addToast]);

  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  const has = useCallback((symbol) => symbols.includes(normalizeSymbol(symbol)), [symbols]);

  /** First save from this browser: store the whole list on the server (creates the visitor). */
  const saveFirstTime = useCallback(async (nextSymbols) => {
    anonSymbolsRef.current = null; // this save already defines the list
    const saved = await watchlistService.import(nextSymbols);
    clearLocal();
    setItems(saved);
    await refreshVisitor();
  }, [refreshVisitor]);

  const add = useCallback(async (raw) => {
    const symbol = normalizeSymbol(raw);
    if (!symbol || symbols.includes(symbol)) return false;
    if (hasVisitor) {
      const created = await watchlistService.add(symbol);
      setItems((prev) => [created, ...prev]);
    } else {
      await saveFirstTime([symbol, ...symbols]);
    }
    return true;
  }, [hasVisitor, symbols, saveFirstTime]);

  const remove = useCallback(async (raw) => {
    const symbol = normalizeSymbol(raw);
    const item = items.find((i) => i.symbol === symbol);
    if (!item) return;
    if (hasVisitor) {
      await watchlistService.remove(item.id);
      setItems((prev) => prev.filter((i) => i.symbol !== symbol));
    } else {
      await saveFirstTime(symbols.filter((s) => s !== symbol));
    }
  }, [hasVisitor, items, symbols, saveFirstTime]);

  const value = useMemo(() => ({ symbols, loading, has, add, remove }), [symbols, loading, has, add, remove]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used inside <WatchlistProvider>');
  return ctx;
};
