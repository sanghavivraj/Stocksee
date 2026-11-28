import { ShieldCheck, AlertTriangle, BarChart2 } from 'lucide-react';
import { formatPrice, formatPercent, hasValue } from '../utils/formatPrice';

/**
 * Educational price snapshot. Shows ONLY real market facts + risk notes + SEBI disclaimer.
 * No buy/sell/hold ratings, analyst counts, target prices or grades.
 */
const StockScorecard = ({ scorecard }) => {
  if (!scorecard || scorecard.type !== 'PRICE_SNAPSHOT') return null;

  const {
    instrumentName, symbol, sector, currency, unit, currentPrice, returns = {},
    dayRange, fiftyTwoWeekRange, riskFactors = [], source, asOf, stale, disclaimer,
  } = scorecard;

  const tone = (v) => (hasValue(v) ? (v >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)') : 'var(--fg-text-muted)');

  const rows = [
    { label: 'Today', value: returns.day },
    { label: '1 Week', value: returns.week },
    { label: '1 Month', value: returns.month },
  ];

  return (
    <div className="scorecard-container" style={{
      backgroundColor: 'var(--fg-surface)',
      border: '1px solid var(--fg-border)',
      borderRadius: '12px',
      padding: '1.25rem',
      margin: '0.85rem 0',
      color: 'var(--fg-text)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--fg-text-muted)' }}>
            <BarChart2 size={13} /> PRICE SNAPSHOT
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '4px' }}>{instrumentName}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-text-muted)' }}>
            {symbol}{sector ? ` • ${sector}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono-number" style={{ fontWeight: 800, fontSize: '1.25rem' }}>{formatPrice(currentPrice, currency)}</div>
          {unit && <div style={{ fontSize: '0.75rem', color: 'var(--fg-text-muted)' }}>{unit}</div>}
          {stale && <div style={{ fontSize: '0.75rem', color: 'var(--fg-negative)' }}>Last known price — may be outdated</div>}
        </div>
      </div>

      {/* Returns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1rem' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ border: '1px solid var(--fg-border)', borderRadius: '8px', padding: '8px 10px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-text-muted)' }}>{r.label}</div>
            <div className="mono-number" style={{ fontWeight: 700, color: tone(r.value) }}>{formatPercent(r.value)}</div>
          </div>
        ))}
      </div>

      {/* Ranges */}
      {(dayRange || fiftyTwoWeekRange) && (
        <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
          {dayRange && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: 'var(--fg-text-muted)' }}>Day range: </span>
              <span className="mono-number">{formatPrice(dayRange.low, currency)} — {formatPrice(dayRange.high, currency)}</span>
            </div>
          )}
          {fiftyTwoWeekRange && (
            <>
              <div style={{ marginBottom: '6px' }}>
                <span style={{ color: 'var(--fg-text-muted)' }}>52-week range: </span>
                <span className="mono-number">{formatPrice(fiftyTwoWeekRange.low, currency)} — {formatPrice(fiftyTwoWeekRange.high, currency)}</span>
              </div>
              <div
                role="img"
                aria-label={`Price is at ${fiftyTwoWeekRange.positionPercent}% of its 52-week range`}
                style={{ height: '6px', borderRadius: '3px', background: 'var(--fg-border)', position: 'relative' }}
              >
                <div style={{
                  position: 'absolute', top: '-3px', width: '12px', height: '12px', borderRadius: '50%',
                  background: 'var(--fg-accent)',
                  left: `calc(${Math.min(100, Math.max(0, fiftyTwoWeekRange.positionPercent))}% - 6px)`,
                }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-text-muted)', marginTop: '6px' }}>
                {fiftyTwoWeekRange.belowHighPercent}% below 52-week high • {fiftyTwoWeekRange.aboveLowPercent}% above 52-week low
              </div>
            </>
          )}
        </div>
      )}

      {/* Risks */}
      {riskFactors.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
            <AlertTriangle size={14} color="var(--fg-negative)" /> Risks to research
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--fg-text-secondary)', lineHeight: 1.5 }}>
            {riskFactors.map((risk) => <li key={risk}>{risk}</li>)}
          </ul>
        </div>
      )}

      {/* Disclaimer + source */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px', borderRadius: '8px', background: 'var(--fg-border-subtle)', fontSize: '0.75rem', lineHeight: 1.45 }}>
        <ShieldCheck size={16} style={{ flexShrink: 0 }} />
        <div>
          <div>{disclaimer}</div>
          {(source || asOf) && (
            <div style={{ marginTop: '4px', color: 'var(--fg-text-muted)' }}>
              Source: {source || '—'}{asOf ? ` • as of ${new Date(asOf).toLocaleString('en-IN')}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockScorecard;
