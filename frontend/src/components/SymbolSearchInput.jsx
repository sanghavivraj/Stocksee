import { useEffect, useId, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import searchService from '../services/searchService';

export const DEBOUNCE_MS = 250;

/** Bold the part of `text` that matches what the user typed (case-insensitive). */
export const Highlight = ({ text, query }) => {
  const q = (query || '').trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="symbol-search-mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
};

/**
 * Typeahead stock search (combobox).
 *
 * The component only SUGGESTS. It never decides what gets saved:
 *  - picking a suggestion calls onSelect(item)
 *  - typing calls onChange(text) (the parent must treat typed text as "nothing selected yet")
 *  - Enter with a highlighted suggestion picks it; with nothing highlighted it calls onEnterWithoutPick() if given
 *    (the parent validates; it must never add the raw text), otherwise the form submits as usual
 *
 * Keyboard: ArrowUp/Down move, Enter picks, Esc closes, Tab closes.
 */
const SymbolSearchInput = ({
  value,
  onChange,
  onSelect,
  onResults,
  onEnterWithoutPick,
  invalidMessage = '',
  placeholder = 'Search a company or symbol…',
  inputClassName = 'editorial-input',
  id,
  withIcon = false,
  autoFocus = false,
  required = false,
}) => {
  const uid = useId();
  const listId = `${uid}-list`;
  const msgId = `${uid}-msg`;
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);
  const wrapRef = useRef(null);
  const skipNext = useRef(false); // don't search again right after a pick
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  useEffect(() => {
    const q = value.trim();
    if (skipNext.current) { skipNext.current = false; return undefined; }
    if (!q) {
      setResults([]); setOpen(false); setSearched(false); setFailed(false); setLoading(false);
      onResultsRef.current?.([]);
      return undefined;
    }

    const controller = new AbortController(); // fast typing: only the latest request may update the list
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const items = await searchService.search(q, { signal: controller.signal, limit: 8 });
        if (controller.signal.aborted) return;
        setResults(items); setFailed(false); setSearched(true); setActive(-1); setOpen(true);
        onResultsRef.current?.(items);
      } catch (err) {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return;
        setResults([]); setFailed(true); setSearched(true); setOpen(true);
        onResultsRef.current?.([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value]);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (item) => {
    skipNext.current = true;
    setOpen(false);
    setResults([]);
    setActive(-1);
    onChange(item.code);
    onSelect?.(item);
  };

  const onKeyDown = (e) => {
    const hasList = open && results.length > 0;
    if (e.key === 'ArrowDown') {
      if (!hasList) { if (results.length) setOpen(true); return; }
      e.preventDefault(); setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      if (!hasList) return;
      e.preventDefault(); setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (hasList && active >= 0) { e.preventDefault(); pick(results[active]); } else if (onEnterWithoutPick) {
        e.preventDefault(); // the parent validates; raw text is never submitted from here
        onEnterWithoutPick();
      }
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false); }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const q = value.trim();
  const status = loading
    ? 'Searching…'
    : failed
      ? 'Suggestions are unavailable right now.'
      : searched ? `${results.length} suggestion${results.length === 1 ? '' : 's'} available` : '';

  return (
    <div className="symbol-search" ref={wrapRef}>
      {withIcon && <Search size={16} className="search-icon-adornment" aria-hidden="true" />}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalidMessage ? 'true' : undefined}
        aria-describedby={invalidMessage ? msgId : undefined}
        className={`${inputClassName} ${invalidMessage ? 'is-invalid' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true); }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        required={required}
        maxLength={40}
      />
      {loading && <Loader2 size={14} className="spinner symbol-search-spinner" aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{status}</span>

      {open && (
        <ul className="symbol-search-list" role="listbox" id={listId} aria-label="Matching stocks">
          {results.map((r, i) => (
            <li
              key={r.symbol}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`symbol-search-item ${i === active ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="symbol-search-code"><Highlight text={r.code} query={q} /></span>
              <span className="symbol-search-name"><Highlight text={r.name} query={q} /></span>
              <span className={`symbol-search-badge ${r.exchange}`}>{r.exchange}</span>
            </li>
          ))}
          {failed && (
            <li className="symbol-search-empty is-error" role="alert">
              Couldn&apos;t load suggestions. Check your connection (or that the StockSee server is running) and try again.
            </li>
          )}
          {!failed && searched && results.length === 0 && (
            <li className="symbol-search-empty" role="status">No matching stock found</li>
          )}
        </ul>
      )}

      {invalidMessage && <p className="symbol-search-error" id={msgId} role="alert">{invalidMessage}</p>}
    </div>
  );
};

export default SymbolSearchInput;
