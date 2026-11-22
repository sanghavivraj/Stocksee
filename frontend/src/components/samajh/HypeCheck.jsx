import { useMemo, useState } from 'react';
import { Calculator, Eye, EyeOff, Flag, Gavel, Scale, Sparkles } from 'lucide-react';
import { analyseClaim, presets, hypeUi } from '../../samajh/analyse';
import { MAX_LENGTH } from '../../samajh/parseClaim';
import { TIMINGS } from '../../samajh/finance';
import samajhService from '../../services/samajhService';
import { LineChartSvg } from './SvgCharts';

const SECTION_ICONS = { math: Calculator, hidden: EyeOff, missing: Eye, realistic: Scale, flags: Flag, verdict: Gavel };

/** Hype Check: paste a claim, see the math the reel skipped. Everything below the AI button works with no network. */
export default function HypeCheck({ lang, presetIds }) {
  const U = hypeUi[lang] || hypeUi.en;
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(null); // null until the first check
  const [opts, setOpts] = useState({});
  const [ai, setAi] = useState({ status: 'idle' });

  const result = useMemo(() => (submitted === null ? null : analyseClaim(submitted, opts, lang)), [submitted, opts, lang]);

  const run = (value = text) => {
    setSubmitted(value);
    setOpts({});
    setAi({ status: 'idle' });
  };
  const choose = (preset) => {
    const value = preset.text[lang] || preset.text.en;
    setText(value);
    run(value);
  };
  const clear = () => { setText(''); setSubmitted(null); setOpts({}); setAi({ status: 'idle' }); };
  const change = (patch) => { setOpts((o) => ({ ...o, ...patch })); setAi({ status: 'idle' }); };

  const askAi = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setAi({ status: 'offline' }); return; }
    setAi({ status: 'loading' });
    try {
      const shown = [
        ...result.math.lines.map((l) => `${l.label}: ${l.value}`),
        result.realistic.normal, result.realistic.bad, ...result.verdict.lines,
      ];
      const out = await samajhService.explain({ language: lang, claim: submitted, kind: result.kind, verdictClass: result.cls, facts: result.facts, shown });
      setAi(out.status === 'ok' ? { status: 'ok', text: out.text } : out.status === 'refused' ? { status: 'refused', message: out.message } : { status: 'unavailable' });
    } catch {
      setAi({ status: 'error' });
    }
  };

  const Section = ({ id, title, children, className = '' }) => {
    const Icon = SECTION_ICONS[id];
    return (
      <section className={`hype-section hype-${id} ${className}`}>
        <h5><Icon size={14} aria-hidden="true" /> {title}</h5>
        {children}
      </section>
    );
  };

  const effective = result?.effective || {};
  return (
    <div className="hype">
      <form className="hype-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label htmlFor="hype-input" className="hype-label">{U.claimHeading}</label>
        <textarea
          id="hype-input" className="hype-input" rows={3} maxLength={MAX_LENGTH} value={text} placeholder={U.placeholder}
          onChange={(e) => setText(e.target.value)} aria-describedby="hype-count"
        />
        <div className="hype-row">
          <span id="hype-count" className="hype-count">{text.length}/{MAX_LENGTH} {U.counter}</span>
          <div className="hype-buttons">
            {(text || submitted !== null) && <button type="button" className="editorial-chip-btn" onClick={clear}>{U.clear}</button>}
            <button type="submit" className="btn-editorial btn-editorial-primary">{U.analyse}</button>
          </div>
        </div>
      </form>

      <div className="hype-presets" aria-label={U.presetsTitle}>
        <span className="hype-presets-title">{U.presetsTitle}:</span>
        {(presetIds ? presets.filter((p) => presetIds.includes(p.id)) : presets).map((p) => (
          <button key={p.id} type="button" className="hype-chip" onClick={() => choose(p)}>{p.text[lang] || p.text.en}</button>
        ))}
      </div>

      {result === null && <p className="hype-empty">{U.empty}</p>}

      {result?.status === 'invalid' && <p className="hype-invalid" role="alert">{result.message}</p>}

      {result?.status === 'refused' && (
        <div className="hype-refusal" role="alert">
          <strong>{result.message}</strong>
          <p>{result.note}</p>
        </div>
      )}

      {result?.status === 'ok' && (
        <article className="hype-result" aria-live="polite">
          <header className="hype-result-head">
            <blockquote className="hype-quote">“{submitted}”</blockquote>
            <h4>{result.title}</h4>
            <span className={`hype-verdict-chip hype-cls-${result.cls}`}>{result.verdict.label}</span>
          </header>

          {result.controls.length > 0 && (
            <details className="hype-adjust" open>
              <summary>{U.adjust}</summary>
              <div className="samajh-controls">
                {result.controls.includes('timing') && (
                  <fieldset className="samajh-field">
                    <legend>{U.timing}</legend>
                    <div className="samajh-seg">
                      {TIMINGS.map((t) => (
                        <button key={t} type="button" aria-pressed={effective.timing === t} className={`samajh-seg-btn ${effective.timing === t ? 'on' : ''}`} onClick={() => change({ timing: t })}>{U.timings[t]}</button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {result.controls.includes('years') && (
                  <label className="samajh-field">
                    <span>{U.years}: <strong>{effective.years}</strong></span>
                    <input type="range" min="1" max="40" step="1" value={effective.years} onChange={(e) => change({ years: Number(e.target.value) })} />
                  </label>
                )}
                {result.controls.includes('rate') && (
                  <label className="samajh-field">
                    <span>{U.rate}: <strong>{effective.rate}%</strong></span>
                    <input type="range" min="0" max={result.kind === 'swp-income' ? 14 : 30} step="0.5" value={effective.rate} onChange={(e) => change({ rate: Number(e.target.value) })} />
                  </label>
                )}
              </div>
            </details>
          )}
          {result.notes.map((n) => <p key={n} className="hype-note">{n}</p>)}

          <Section id="math" title={U.sections.math}>
            <p className="hype-formula"><strong>{U.formula}:</strong> {result.math.formula}</p>
            {result.math.lines.length > 0 && (
              <ul className="hype-lines">
                {result.math.lines.map((l) => (
                  <li key={l.label}>
                    <span className={`hype-badge hype-badge-${l.kind}`}>{l.kind === 'calculated' ? U.calculated : U.estimate}</span>
                    <span className="hype-line-label">{l.label}</span>
                    <strong className="hype-line-value">{l.value}</strong>
                  </li>
                ))}
              </ul>
            )}
            {result.math.chart && <LineChartSvg series={result.math.chart.series} lang={lang} xLabel={lang === 'hi' ? 'साल' : 'Year'} ariaLabel={result.title} />}
            <details className="samajh-table-wrap">
              <summary>{U.assumptionsTitle}</summary>
              <ul className="hype-assume">{result.math.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            </details>
          </Section>

          <Section id="hidden" title={U.sections.hidden}><ul className="hype-list">{result.hidden.map((t) => <li key={t}>{t}</li>)}</ul></Section>
          <Section id="missing" title={U.sections.missing}><ul className="hype-list">{result.missing.map((t) => <li key={t}>{t}</li>)}</ul></Section>

          <Section id="realistic" title={U.sections.realistic}>
            <div className="hype-two">
              <div className="hype-case hype-case-normal"><h6>{U.normal}</h6><p>{result.realistic.normal}</p></div>
              <div className="hype-case hype-case-bad"><h6>{U.bad}</h6><p>{result.realistic.bad}</p></div>
            </div>
          </Section>

          <Section id="flags" title={U.sections.flags}>
            {result.redFlags.length === 0 ? <p className="hype-noflags">{U.noFlags}</p> : (
              <ul className="hype-list hype-flags">{result.redFlags.map((f) => <li key={f.code}>{f.text}</li>)}</ul>
            )}
          </Section>

          <Section id="verdict" title={U.sections.verdict} className={`hype-cls-${result.cls}`}>
            <p className="hype-verdict-1">{result.verdict.lines[0]}</p>
            <p className="hype-verdict-2">{result.verdict.lines[1]}</p>
          </Section>

          <section className="hype-ai">
            <button type="button" className="editorial-chip-btn" onClick={askAi} disabled={ai.status === 'loading'}>
              <Sparkles size={13} aria-hidden="true" /> {ai.status === 'loading' ? U.ai.loading : U.ai.button}
            </button>
            {ai.status === 'ok' && (
              <div className="hype-ai-box">
                <h6>{U.ai.title}</h6>
                <p>{ai.text}</p>
                <small>{U.ai.note}</small>
              </div>
            )}
            {ai.status === 'refused' && <p className="hype-ai-msg" role="status">{ai.message}</p>}
            {ai.status === 'unavailable' && <p className="hype-ai-msg" role="status">{U.ai.unavailable}</p>}
            {ai.status === 'offline' && <p className="hype-ai-msg" role="status">{U.ai.offline}</p>}
            {ai.status === 'error' && <p className="hype-ai-msg" role="status">{U.ai.error}</p>}
          </section>
          <p className="hype-footnote">{U.footnote}</p>
        </article>
      )}
    </div>
  );
}
