import { ShieldAlert, ShieldCheck, ShieldQuestion, MessageSquareWarning, LineChart } from 'lucide-react';
import { formatPrice } from '../utils/formatPrice';

const ICONS = { HIGH: ShieldAlert, MEDIUM: ShieldQuestion, LOW: ShieldCheck };
const LABEL = { HIGH: 'High risk', MEDIUM: 'Medium risk', LOW: 'Low risk' };

/** Result of a Tip Check. `compact` is used inside the chat assistant. */
const TipCheckResult = ({ result, compact = false }) => {
  if (!result) return null;
  const Icon = ICONS[result.level] || ShieldQuestion;
  const fromMessage = result.reasons.filter((r) => r.kind === 'message');
  const fromMarket = result.reasons.filter((r) => r.kind === 'market');

  const ReasonList = ({ items }) => (
    <ul className="reason-list">
      {items.map((r) => (
        <li key={r.code} className="reason-item">
          <span className={`reason-dot ${r.weight >= 3 ? 'w3' : ''}`} aria-hidden="true" />
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className={`risk-card ${compact ? 'assistant-tip-card' : ''}`} aria-label={`Tip Check result: ${LABEL[result.level]}`}>
      <div className={`risk-card-head ${result.level}`}>
        <div>
          <div className={`risk-level ${result.level}`}>
            <Icon size={compact ? 18 : 22} aria-hidden="true" />
            {LABEL[result.level]}
          </div>
          <div className={`risk-meter ${result.level}`} aria-hidden="true"><span /><span /><span /></div>
        </div>
        <div className="risk-summary">
          {result.summary}
          {result.instrument && (
            <div className="risk-stock">
              {result.instrument.name} ({result.instrument.symbol})
              {result.instrument.price != null && ` • ${formatPrice(result.instrument.price, result.instrument.currency)}`}
              {result.instrument.asOf && ` • data as of ${result.instrument.asOf}`}
            </div>
          )}
        </div>
      </div>

      <div className="risk-body">
        {fromMessage.length > 0 && (
          <>
            <div className="risk-group-title"><MessageSquareWarning size={12} /> In the message</div>
            <ReasonList items={compact ? fromMessage.slice(0, 4) : fromMessage} />
          </>
        )}
        {fromMarket.length > 0 && (
          <>
            <div className="risk-group-title"><LineChart size={12} /> In the market data</div>
            <ReasonList items={compact ? fromMarket.slice(0, 3) : fromMarket} />
          </>
        )}
        {result.reasons.length === 0 && <p style={{ margin: 0, fontSize: '0.86rem' }}>No warning signs found by this check.</p>}
        {result.notes.map((n) => <p key={n} className="risk-disclaimer">{n}</p>)}

        {!compact && (
          <>
            <div className="risk-group-title">Before you do anything</div>
            <ul className="guidance-list">{result.guidance.map((g) => <li key={g}>{g}</li>)}</ul>
          </>
        )}
        <p className="risk-disclaimer">{result.disclaimer}</p>
      </div>
    </section>
  );
};

export default TipCheckResult;
