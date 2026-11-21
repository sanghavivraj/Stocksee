import { useContext, useEffect, useMemo, useState } from 'react';
import { tr } from '../utils/uiStrings';
import { Link, useSearchParams } from 'react-router-dom';
import SymbolSearchInput from '../components/SymbolSearchInput';
import {
  Plus, Trash2, ArrowUpRight, ArrowDownRight, PauseCircle, PlayCircle, Bell,
  TrendingUp, BarChart3, ChevronsUp, ChevronsDown, History, Loader2,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { t } from '../utils/i18n';
import alertService from '../services/alertService';
import marketService from '../services/marketService';
import { normalizeSymbol } from '../context/WatchlistContext';
import { formatPrice, formatPercent, hasValue } from '../utils/formatPrice';

const ALERT_TYPES = [
  { type: 'PRICE_MOVE', icon: TrendingUp, title: 'Price move', desc: 'Day change crosses ± your %', unit: '%', needsDirection: true, defaultThreshold: '2' },
  { type: 'GAP', icon: ArrowUpRight, title: 'Opening gap', desc: 'Opens ± your % vs yesterday’s close', unit: '%', needsDirection: true, defaultThreshold: '1.5' },
  { type: 'VOLUME_SPIKE', icon: BarChart3, title: 'Volume spike', desc: 'Volume ≥ your × of the 20-day average', unit: '×', needsDirection: false, defaultThreshold: '3' },
  { type: 'NEW_52W_HIGH', icon: ChevronsUp, title: '52-week high', desc: 'Breaks above the previous 52-week high', unit: null },
  { type: 'NEW_52W_LOW', icon: ChevronsDown, title: '52-week low', desc: 'Falls below the previous 52-week low', unit: null },
];
const TYPE_BY_ID = Object.fromEntries(ALERT_TYPES.map((x) => [x.type, x]));

/** Human sentence for an alert rule. */
function describeRule(a) {
  switch (a.type) {
    case 'GAP': return `Opens with a gap ${a.direction === 'up' ? 'up' : 'down'} of ≥ ${a.threshold}%`;
    case 'VOLUME_SPIKE': return `Volume ≥ ${a.threshold}× its 20-day average`;
    case 'NEW_52W_HIGH': return 'Breaks above its previous 52-week high';
    case 'NEW_52W_LOW': return 'Falls below its previous 52-week low';
    default: return `${a.direction === 'up' ? 'Rises' : 'Falls'} ≥ ${a.threshold}% in a day`;
  }
}

const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

const Alerts = () => {
  const { visitor, refreshVisitor, language, addToast } = useContext(UserContext);
  const [alerts, setAlerts] = useState([]);
  const [marketQuotes, setMarketQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(() => {
    const type = TYPE_BY_ID[searchParams.get('type')] ? searchParams.get('type') : 'PRICE_MOVE';
    return { type, symbol: searchParams.get('symbol') || '', threshold: TYPE_BY_ID[type].defaultThreshold || '2', direction: 'up' };
  });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState({ status: 'idle', data: null });

  const meta = TYPE_BY_ID[form.type];

  /** The rule exactly as the API expects it (null while incomplete). */
  const rule = useMemo(() => {
    const symbol = normalizeSymbol(form.symbol);
    if (!symbol) return null;
    if (!meta.unit) return { type: form.type, symbol };
    const threshold = parseFloat(form.threshold);
    if (!(threshold > 0)) return null;
    return meta.needsDirection
      ? { type: form.type, symbol, threshold, direction: form.direction }
      : { type: form.type, symbol, threshold };
  }, [form, meta]);

  // Live backtest preview: "how often would this have fired in the last year?"
  useEffect(() => {
    if (!rule) { setPreview({ status: 'idle', data: null }); return undefined; }
    setPreview((p) => ({ ...p, status: 'loading' }));
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await alertService.backtest(rule);
        if (active) setPreview({ status: 'ready', data });
      } catch (err) {
        if (active) setPreview({ status: 'error', data: null, message: err.userMessage });
      }
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [rule]);

  const loadQuotes = async (list) => {
    const quotes = {};
    await Promise.all([...new Set(list.map((a) => a.symbol))].map(async (symbol) => {
      quotes[symbol] = await marketService.getMarketData(symbol).catch(() => null);
    }));
    setMarketQuotes((prev) => ({ ...prev, ...quotes }));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    alertService.list()
      .then((list) => { if (active) { setAlerts(list); loadQuotes(list); } })
      .catch((err) => addToast(err.userMessage || 'Could not load alerts', 'error'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(visitor)]);

  const chooseType = (type) => {
    const m = TYPE_BY_ID[type];
    setForm((f) => ({ ...f, type, threshold: m.defaultThreshold || f.threshold }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!rule || saving) return;
    setSaving(true);
    try {
      const created = await alertService.create(rule);
      setAlerts((prev) => [created, ...prev]);
      loadQuotes([created]);
      if (!visitor) refreshVisitor().catch(() => {});
      addToast(`Alert set: ${created.symbol} — ${describeRule(created)}`, 'info');
      setForm((f) => ({ ...f, symbol: '' }));
    } catch (err) {
      addToast(err.userMessage || 'Failed to create alert', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleState = async (alert) => {
    try {
      const updated = await alertService.setActive(alert.id, !alert.active);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      addToast(`Alert for ${alert.symbol} ${updated.active ? 'resumed' : 'paused'}`, 'info');
    } catch (err) {
      addToast(err.userMessage || 'Failed to update alert', 'error');
    }
  };

  const handleDelete = async (alert) => {
    if (!window.confirm(`Delete the alert for ${alert.symbol}?`)) return;
    try {
      await alertService.remove(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      addToast(`Alert for ${alert.symbol} deleted`, 'info');
    } catch (err) {
      addToast(err.userMessage || 'Failed to delete alert', 'error');
    }
  };

  const activeCount = alerts.filter((a) => a.active).length;
  const bt = preview.data;

  return (
    <div className="editorial-page-container">
      <header className="editorial-lead-header">
        <div className="lead-meta-row">
          <span className="editorial-kicker">{tr("SMART ALERTS", language)}</span>
          <span className="lead-date-stamp">{activeCount} {tr("active of", language)} {alerts.length}</span>
        </div>
        <h1 className="lead-headline">{t('alerts', language)}</h1>
        <p className="lead-description">
          {tr("Get a Telegram message when a stock does something unusual — checked every 2 minutes during market hours, at most once a day per alert.", language)}
          {!visitor?.telegram?.connected && (
            <>{' '}<Link to="/settings" style={{ fontWeight: 700 }}>{tr("Connect Telegram in Settings", language)}</Link> {tr("to receive them.", language)}</>
          )}
        </p>
      </header>

      <section className="editorial-flow-section" aria-label="Create an alert">
        <div className="flow-section-header">
          <div>
            <span className="flow-kicker">{tr("NEW ALERT", language)}</span>
            <h3 className="flow-title">{tr("What should we watch for?", language)}</h3>
          </div>
        </div>

        <form onSubmit={handleCreate} className="watchlist-search-card">
          <div className="type-grid" role="radiogroup" aria-label="Alert type">
            {ALERT_TYPES.map(({ type, icon: Icon, title, desc }) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={form.type === type}
                className={`type-card ${form.type === type ? 'active' : ''}`}
                onClick={() => chooseType(type)}
              >
                <span className="type-card-title"><Icon size={14} aria-hidden="true" /> {tr(title, language)}</span>
                <span className="type-card-desc">{tr(desc, language)}</span>
              </button>
            ))}
          </div>

          <div className="alerts-form-grid">
            <div className="form-field-group">
              <label className="form-field-label" htmlFor="alert-symbol">{tr("Stock or index", language)}</label>
              <SymbolSearchInput
                id="alert-symbol"
                placeholder="Type to search: RELIANCE, IOC, GOLD…"
                value={form.symbol}
                onChange={(v) => setForm((f) => ({ ...f, symbol: v }))}
                onSelect={(item) => setForm((f) => ({ ...f, symbol: item.symbol }))}
                required
              />
            </div>

            {meta.needsDirection && (
              <div className="form-field-group">
                <span className="form-field-label" id="alert-direction">{tr("Direction", language)}</span>
                <div className="seg-group" role="radiogroup" aria-labelledby="alert-direction">
                  {['up', 'down'].map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={form.direction === d}
                      className={`seg-btn ${form.direction === d ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, direction: d })}>
                      {d === 'up' ? '▲ Up' : '▼ Down'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {meta.unit && (
              <div className="form-field-group">
                <label className="form-field-label" htmlFor="alert-threshold">
                  {meta.unit === '%' ? 'By at least (%)' : 'At least (× average volume)'}
                </label>
                <input
                  id="alert-threshold"
                  type="number"
                  step={meta.unit === '%' ? '0.1' : '0.5'}
                  min={meta.unit === '%' ? '0.1' : '1.5'}
                  max="50"
                  className="editorial-input"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                  required
                />
              </div>
            )}
          </div>

          {/* Backtest preview */}
          {rule && (
            <div className="backtest-box" aria-live="polite">
              {preview.status === 'loading' && (
                <div className="backtest-headline"><Loader2 size={14} className="spinner" /> Checking the last 12 months of {rule.symbol}…</div>
              )}
              {preview.status === 'error' && (
                <div className="backtest-headline">History unavailable for {rule.symbol}: {preview.message || 'please check the symbol'}.</div>
              )}
              {preview.status === 'ready' && bt && (
                <>
                  <div className="backtest-headline">
                    <History size={15} aria-hidden="true" />
                    <span>{tr("In the last 12 months this alert would have fired", language)}</span>
                    <span className="backtest-number">{bt.fires}</span>
                    <span>{bt.fires === 1 ? 'time' : 'times'}</span>
                  </div>
                  <div className="backtest-note">
                    {bt.fires === 0
                      ? 'It never triggered — you may want a lower threshold.'
                      : bt.firesPerMonth >= 4
                        ? `About ${bt.firesPerMonth} times a month — quite noisy; consider a higher threshold.`
                        : `About ${bt.firesPerMonth} times a month.`}
                  </div>
                  {bt.lastFired?.length > 0 && (
                    <div className="backtest-dates" aria-label="Most recent days it would have fired">
                      {bt.lastFired.map((f) => (
                        <span key={f.date} className="backtest-date">
                          {fmtDate(f.date)}{f.value !== null && meta.unit ? ` · ${f.value}${meta.unit === '%' ? '%' : '×'}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="backtest-note">Based on {bt.sessions} trading days of real daily data ({bt.source}). Past behaviour is not a prediction.</div>
                </>
              )}
            </div>
          )}

          <button type="submit" className="btn-editorial btn-editorial-primary alerts-submit-btn" disabled={!rule || saving} style={{ marginTop: '1rem' }}>
            {saving ? <Loader2 size={15} className="spinner" /> : <Plus size={15} />}
            <span>{tr("Create alert", language)}</span>
          </button>
        </form>
      </section>

      <section className="editorial-flow-section" aria-label="Your alerts">
        <div className="flow-section-header">
          <div>
            <span className="flow-kicker">{tr("TELEGRAM", language)}</span>
            <h3 className="flow-title">{tr("Your Alerts", language)} ({activeCount} {tr("active", language)})</h3>
          </div>
        </div>

        {loading ? (
          <div className="feed-skeleton-wrap">
            <div className="skeleton feed-skeleton-item"></div>
            <div className="skeleton feed-skeleton-item"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="editorial-banner-box">
            <div className="banner-icon-wrap"><Bell size={22} /></div>
            <div className="banner-content">
              <h4 className="banner-headline">{tr("No alerts yet.", language)}</h4>
              <p className="banner-subtext">{tr("Pick a type above — the preview shows how often it would have fired before you save it.", language)}</p>
            </div>
          </div>
        ) : (
          <div className="editorial-stock-list">
            {alerts.map((alert) => {
              const quote = marketQuotes[alert.symbol];
              const move = quote?.changePercent;
              const TypeIcon = TYPE_BY_ID[alert.type]?.icon || TrendingUp;
              return (
                <div key={alert.id} className="editorial-stock-card" style={{ opacity: alert.active ? 1 : 0.7 }}>
                  <div className="stock-card-top">
                    <div className="stock-identity">
                      <div className="stock-primary-name">{alert.symbol}</div>
                      <div className="stock-sub-meta" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="alert-type-tag"><TypeIcon size={10} aria-hidden="true" /> {tr(TYPE_BY_ID[alert.type]?.title || 'Price move', language)}</span>
                        <span className="stock-condition-text">{describeRule(alert)}</span>
                      </div>
                      {alert.lastTriggeredAt && (
                        <div className="backtest-note">Last fired {new Date(alert.lastTriggeredAt).toLocaleString('en-IN')}</div>
                      )}
                    </div>

                    <div className="stock-valuation text-right">
                      <div className="stock-price mono-number">{formatPrice(quote?.price, quote?.currency)}</div>
                      {hasValue(move) ? (
                        <div className={`stock-delta-pill ${move >= 0 ? 'positive' : 'negative'}`}>
                          {move >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          <span>{formatPercent(move)}</span>
                        </div>
                      ) : <span className="stock-delta-none">—</span>}
                    </div>
                  </div>

                  <div className="stock-card-actions">
                    <div className="alert-status-pill">
                      <span className={`status-dot ${alert.active ? 'active' : 'paused'}`} />
                      <span>{alert.active ? 'ACTIVE' : 'PAUSED'}</span>
                    </div>
                    <div className="actions-right-group">
                      <button type="button" className="stock-action-pill-btn" onClick={() => handleToggleState(alert)}
                        aria-label={`${alert.active ? 'Pause' : 'Resume'} alert for ${alert.symbol}`}>
                        {alert.active ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                        <span>{alert.active ? 'Pause' : 'Resume'}</span>
                      </button>
                      <button type="button" className="stock-action-pill-btn danger" onClick={() => handleDelete(alert)}
                        aria-label={`Delete alert for ${alert.symbol}`}>
                        <Trash2 size={13} />
                        <span>{tr("Delete", language)}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Alerts;
