import { useEffect } from 'react';
import { ListChecks, X } from 'lucide-react';
import { pick } from '../../samajh/content';
import ui from '../../content/samajh/ui.json';

/**
 * "Check first": a small floating button (next to the StockSee AI button) that opens a small window.
 * The window lists, for one Money Card, what to check before acting and why. Facts to look at, never advice.
 */
export default function CheckFirst({ cards, lang, isOpen, selectedId, onSelect, onToggle }) {
  const U = ui[lang].cards;
  const card = cards.find((c) => c.id === selectedId) || cards[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onToggle(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onToggle]);

  if (!card) return null;
  return (
    <>
      <button type="button" className={`checkfirst-btn ${isOpen ? 'active' : ''}`} onClick={onToggle} aria-expanded={isOpen} aria-label={U.checks.title} title={U.checks.title}>
        <ListChecks size={14} aria-hidden="true" />
        <span>{U.checks.button}</span>
      </button>

      {isOpen && (
        <>
          <div className="assistant-sheet-backdrop" onClick={onToggle} />
          <aside className="floating-assistant-panel checkfirst-panel" aria-label={U.checks.title}>
            <div className="sheet-drag-handle" />
            <div className="assistant-panel-header">
              <div className="assistant-panel-title">
                <span className="assistant-dot"></span>
                <span className="serif-title assistant-heading-title">{U.checks.title}</span>
              </div>
              <button type="button" className="assistant-close-btn" onClick={onToggle} aria-label={U.close}><X size={18} /></button>
            </div>

            <div className="checkfirst-chips" role="tablist" aria-label={U.title}>
              {cards.map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={c.id === card.id} className={`checkfirst-chip ${c.id === card.id ? 'on' : ''}`} onClick={() => onSelect(c.id)}>
                  {pick(c.name, lang).replace(/\s*\(.*\)\s*$/, '')}
                </button>
              ))}
            </div>

            <div className="assistant-panel-body checkfirst-body">
              <h4 className="checkfirst-card-name">{pick(card.name, lang)}</h4>
              <ul className="samajh-check-list">
                {card.checks.map((c) => (
                  <li key={c.what.en}>
                    <strong>{pick(c.what, lang)}</strong>
                    <span>{pick(c.why, lang)}</span>
                    <span className="checkfirst-story"><em>{U.checks.story}:</em> {pick(c.story, lang)}</span>
                  </li>
                ))}
              </ul>
              <p className="samajh-check-note">{U.checksNote}</p>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
