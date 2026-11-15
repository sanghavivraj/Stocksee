import { useState } from 'react';
import { ArrowRight, Clock3, ShieldAlert } from 'lucide-react';
import guide from '../../content/samajh/time-guide.json';
import { loadCards, pick } from '../../samajh/content';

/** Money-Time Guide: one question, then the general principle for that time, with the reasons and links to the Money Cards. */
export default function MoneyTimeGuide({ lang, onOpenCard }) {
  const U = guide.ui[lang] || guide.ui.en;
  const [picked, setPicked] = useState(null);
  const names = Object.fromEntries(loadCards().map((c) => [c.id, pick(c.name, lang)]));
  const h = guide.horizons.find((x) => x.id === picked);

  const TypeList = ({ items }) => (
    <ul className="guide-types">
      {items.map((t) => (
        <li key={pick(t.name, 'en')}>
          <strong>{pick(t.name, lang)}</strong>
          <p>{pick(t.why, lang)}</p>
          {t.cards.length > 0 && (
            <span className="guide-links">
              {t.cards.map((id) => (
                <button key={id} type="button" className="guide-link" onClick={() => onOpenCard(id)}>
                  {U.openCard}: {names[id]} <ArrowRight size={12} aria-hidden="true" />
                </button>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="guide">
      <p className="guide-principle" role="note"><ShieldAlert size={15} aria-hidden="true" /> <strong>{U.principle}</strong> {U.broad}</p>

      <fieldset className="guide-question">
        <legend><Clock3 size={15} aria-hidden="true" /> {U.question}</legend>
        <div className="guide-options" role="radiogroup" aria-label={U.legend}>
          {guide.horizons.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={picked === x.id} className={`guide-option ${picked === x.id ? 'on' : ''}`} onClick={() => setPicked(x.id)}>
              {pick(x.label, lang)}
            </button>
          ))}
        </div>
      </fieldset>

      {!h && <p className="hype-empty">{U.pick}</p>}

      {h && (
        <article className="guide-result" aria-live="polite">
          <h4>{pick(h.label, lang)}: {pick(h.headline, lang)}</h4>

          <section>
            <h5>{U.whatMatters}</h5>
            <ul className="hype-list">{pick(h.matters, lang).map((m) => <li key={m}>{m}</li>)}</ul>
          </section>

          <section>
            <h5>{U.four}</h5>
            <dl className="guide-factors">
              {Object.keys(U.factors).map((k) => (
                <div key={k}><dt>{U.factors[k]}</dt><dd>{pick(h.factors[k], lang)}</dd></div>
              ))}
            </dl>
          </section>

          <section>
            <h5>{U.associated}</h5>
            <TypeList items={h.types} />
          </section>

          <section>
            <h5>{U.lessSuited}</h5>
            <TypeList items={h.lessSuited} />
          </section>

          <p className="guide-caution">{U.caution}</p>
          <p className="guide-principle-foot"><strong>{U.principle}</strong></p>
        </article>
      )}
    </div>
  );
}
