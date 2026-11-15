import { useMemo, useState } from 'react';
import { Link2, ListChecks, SlidersHorizontal, X } from 'lucide-react';
import { computeCard } from '../../samajh/cardMath';
import { fill, formatInr, formatNum, formatDec } from '../../samajh/format';
import { LEVELS, pick } from '../../samajh/content';
import { TIMINGS } from '../../samajh/finance';
import { LineChartSvg, BarChartSvg } from './SvgCharts';
import ui from '../../content/samajh/ui.json';

const BLOCK_ORDER = ['explain', 'example', 'steps', 'positive', 'negative', 'wrong', 'influencers', 'takeaway'];
const CELL = { n: formatNum, inr: (v, lang) => formatInr(v, lang), d2: (v) => formatDec(v, 2) };

/** One opened Money Card: level switch, the 8 teaching blocks, a chart, and "try it yourself" controls. */
export default function MoneyCard({ card, lang, onClose, onOpenChecks }) {
  const T = ui[lang]?.cards || ui.en.cards;
  const other = lang === 'hi' ? 'en' : 'hi';
  const [level, setLevel] = useState('basic');
  const [inputs, setInputs] = useState(card.inputs);

  const calc = useMemo(() => computeCard(card.id, inputs, lang, formatInr), [card.id, inputs, lang]);
  const f = (text) => fill(text, calc.vars, lang);
  const fOther = (text) => fill(text, computeCard(card.id, inputs, other, formatInr).vars, other);
  const content = card.levels[level];
  const hasControls = card.controls.length > 0;

  const setInput = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));

  const renderBlock = (block) => {
    const value = pick(content[block], lang);
    const label = T.blocks[block];
    if (Array.isArray(value)) {
      const Tag = block === 'steps' ? 'ol' : 'ul';
      return (
        <section key={block} className={`samajh-block samajh-block-${block}`}>
          <h5>{label}</h5>
          <Tag className="samajh-list">{value.map((line) => <li key={line}>{f(line)}</li>)}</Tag>
        </section>
      );
    }
    return (
      <section key={block} className={`samajh-block samajh-block-${block}`}>
        <h5>{label}</h5>
        <p>{f(value)}</p>
        {block === 'explain' && (
          <p className="samajh-other" lang={other}><em>{T.otherLanguage}:</em> {fOther(content.explain[other])}</p>
        )}
      </section>
    );
  };

  const units = calc.units;
  return (
    <article className="samajh-panel" aria-label={pick(card.name, lang)}>
      <header className="samajh-panel-head">
        <div>
          <span className={`samajh-kind samajh-kind-${card.kind}`}>{T.kind[card.kind]}</span>
          <h4>{pick(card.name, lang)}</h4>
          <p className="samajh-tag">{pick(card.tag, lang)}</p>
        </div>
        <div className="samajh-head-actions">
          {card.checks?.length > 0 && (
            <button type="button" className="samajh-close samajh-checks-mini" onClick={() => onOpenChecks(card.id)} aria-label={T.checks.title} title={T.checks.title}><ListChecks size={16} /></button>
          )}
          <button type="button" className="samajh-close" onClick={onClose} aria-label={T.close}><X size={18} /></button>
        </div>
      </header>

      {card.methodNote && <p className="samajh-method" role="note"><Link2 size={14} aria-hidden="true" /> {pick(card.methodNote, lang)}</p>}

      <div className="samajh-levels" role="tablist" aria-label="Level">
        {LEVELS.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={level === l} className={`samajh-level ${level === l ? 'on' : ''}`} onClick={() => setLevel(l)}>{T.level[l]}</button>
        ))}
      </div>

      {BLOCK_ORDER.slice(0, 3).map(renderBlock)}


      {calc.chart && (
        <div className="samajh-visual">
          {calc.chart.type === 'lines'
            ? <LineChartSvg series={calc.chart.series} lang={lang} xLabel={T.chart.year} ariaLabel={`${pick(card.name, lang)}: ${T.chart.tableOf}`} />
            : <BarChartSvg bars={calc.chart.bars} lang={lang} ariaLabel={pick(card.name, lang)} />}
          {calc.table && (
            <details className="samajh-table-wrap">
              <summary>{T.seeNumbers}</summary>
              <div className="samajh-scroll">
                <table className="samajh-table">
                  <thead><tr>{pick(calc.table.head, lang).map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                  <tbody>{calc.table.rows.map((row) => (
                    <tr key={row[0]}>{row.map((cell, i) => <td key={i}>{CELL[calc.table.formats[i]](cell, lang)}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      {level === 'medium' && units && (
        <section className="samajh-block">
          <h5>{T.unitsTitle}</h5>
          <div className="samajh-scroll">
            <table className="samajh-table">
              <thead><tr>{pick(units.head, lang).map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{units.rows.map((r) => <tr key={r.month}><td>{r.month}</td><td>₹{formatNum(r.nav)}</td><td>{formatDec(r.units, 2)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {BLOCK_ORDER.slice(3).map(renderBlock)}



      {level === 'medium' && hasControls && (
        <section className="samajh-block samajh-try">
          <h5><SlidersHorizontal size={14} aria-hidden="true" /> {T.tryIt}</h5>
          <div className="samajh-controls">
            {card.controls.map((c) => (c.type === 'timing' ? (
              <fieldset key={c.key} className="samajh-field">
                <legend>{pick(c.label, lang)}</legend>
                <div className="samajh-seg">
                  {TIMINGS.map((t) => (
                    <button key={t} type="button" aria-pressed={inputs.timing === t} className={`samajh-seg-btn ${inputs.timing === t ? 'on' : ''}`} onClick={() => setInput('timing', t)}>{T.timing[t]}</button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <label key={c.key} className="samajh-field">
                <span>{pick(c.label, lang)}: <strong>{c.unit === '₹' ? formatInr(inputs[c.key], lang) : `${inputs[c.key]}${c.unit}`}</strong></span>
                <input type="range" min={c.min} max={c.max} step={c.step} value={inputs[c.key]} onChange={(e) => setInput(c.key, Number(e.target.value))} />
              </label>
            )))}
          </div>
          <button type="button" className="samajh-reset" onClick={() => setInputs(card.inputs)}>↺ {lang === 'hi' ? 'शुरुआती मान' : 'Reset'}</button>
        </section>
      )}

      <section className="samajh-assume">
        <h5>{T.assumptions}</h5>
        <ul>{pick(card.assumptions, lang).map((a) => <li key={a}>{f(a)}</li>)}</ul>
        <p className="samajh-hypo">{T.hypothetical}</p>
        <p className="samajh-sources"><strong>{T.sources}:</strong> {card.sources.map((s, i) => (
          <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></span>
        ))}</p>
      </section>
    </article>
  );
}
