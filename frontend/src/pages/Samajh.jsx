import { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpenCheck, ListChecks } from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { loadCards, pick, hasLanguage } from '../samajh/content';
import CheckFirst from '../components/samajh/CheckFirst';
import MoneyCard from '../components/samajh/MoneyCard';
import ui from '../content/samajh/ui.json';

/**
 * Samajh (समझ): "No tips. Only understanding."
 * One page: the 8 Money Cards. Each card holds everything related to it (its story, Hype Check where it fits, real fund history
 * for SIP and mutual funds). Words live in content/samajh/*.json,
 * numbers are calculated in samajh/*.js. English and Hindi for now; other languages fall back to English.
 */
const Samajh = () => {
  const { language } = useContext(UserContext);
  const lang = hasLanguage(language) ? language : 'en';
  const U = ui[lang];
  const cards = useMemo(() => loadCards(), []);
  const [openId, setOpenId] = useState(null);
  const [checksOpen, setChecksOpen] = useState(false);
  const [checksId, setChecksId] = useState('fd');
  const showChecks = useCallback((id) => { setChecksId(id); setChecksOpen(true); }, []);
  const toggleChecks = useCallback(() => {
    setChecksOpen((v) => !v);
    if (openId) setChecksId(openId);
  }, [openId]);
  // /samajh?check=stocks opens "Check first" on that card (used by the big-move pause banner)
  const [searchParams] = useSearchParams();
  const wantedCheck = searchParams.get('check');
  useEffect(() => {
    if (wantedCheck && cards.some((c) => c.id === wantedCheck)) showChecks(wantedCheck);
  }, [wantedCheck, cards, showChecks]);
  const open = cards.find((c) => c.id === openId);
  return (
    <div className="editorial-page-container samajh-page">
      <header className="editorial-lead-header">
        <div className="lead-meta-row"><span className="editorial-kicker">{U.kicker}</span></div>
        <h1 className="lead-headline"><BookOpenCheck size={26} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />{U.title}</h1>
        <p className="lead-description samajh-tagline">{U.tagline}</p>
        <p className="samajh-top-disclaimer">{U.disclaimerTop}</p>
        {language === 'gu' && <p className="samajh-lang-note">Gujarati is coming soon. Showing English for now.</p>}
      </header>

      <section id="samajh-cards" className="editorial-flow-section" aria-labelledby="samajh-cards-title">
        <div className="flow-section-header"><div>
          <h2 id="samajh-cards-title" className="flow-title">{U.cards.title}</h2>
          <p className="unusual-sub">{U.cards.sub}</p>
        </div></div>

        {cards.length === 0 ? <p className="unusual-empty">{U.cards.empty}</p> : (
          <div className="samajh-tiles" role="list">
            {cards.map((c) => (
              <button key={c.id} type="button" role="listitem" className={`samajh-tile ${openId === c.id ? 'on' : ''}`} aria-pressed={openId === c.id} onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                <span className={`samajh-kind samajh-kind-${c.kind}`}>{U.cards.kind[c.kind]}</span>
                <strong>{pick(c.name, lang)}</strong>
                <small>{pick(c.tag, lang)}</small>
                {c.checks?.length > 0 && <span className="samajh-tile-checks"><ListChecks size={12} aria-hidden="true" /> {c.checks.length} {U.cards.checks.badge}</span>}
              </button>
            ))}
          </div>
        )}
        {!open && cards.length > 0 && <p className="samajh-hint">{U.cards.pickHint}</p>}
        {open && <MoneyCard key={`${open.id}-${lang}`} card={open} lang={lang} onClose={() => setOpenId(null)} onOpenChecks={showChecks} />}
      </section>

      <CheckFirst cards={cards} lang={lang} isOpen={checksOpen} selectedId={checksId} onSelect={setChecksId} onToggle={toggleChecks} />

      <footer className="samajh-footer" role="contentinfo">{U.footer}</footer>
    </div>
  );
};

export default Samajh;
