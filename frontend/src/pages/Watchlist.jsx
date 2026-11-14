import { useContext, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  LineChart,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { t } from '../utils/i18n';
import marketService from '../services/marketService';
import StockDetailModal from '../components/StockDetailModal';
import SymbolSearchInput from '../components/SymbolSearchInput';
import { formatPrice, hasValue } from '../utils/formatPrice';
import { useWatchlist, normalizeSymbol } from '../context/WatchlistContext';
import { resolveStockChoice, validationMessage } from '../utils/stockChoice';
import { Link } from 'react-router-dom';

const quickTrackPills = [
  'RELIANCE.NS',
  'TCS.NS',
  'HDFCBANK.NS',
  'INFY.NS',
  'SUZLON.NS',
  'SBIN.NS',
  'GOLD',
  'CRUDEOIL',
];

const Watchlist = () => {
  const { addToast } = useContext(UserContext);
  const { symbols, add, remove } = useWatchlist();

  const [stockQuotes, setStockQuotes] = useState({});
  const [symbolInput, setSymbolInput] = useState('');
  const [selected, setSelected] = useState(null); // the suggestion the user picked (null = nothing valid chosen yet)
  const [suggestions, setSuggestions] = useState([]);
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);

  // Fetch real-time quotes for all symbols in the watchlist
  const fetchAllQuotes = async (symbolsToFetch = symbols) => {
    if (!symbolsToFetch || symbolsToFetch.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const results = {};
      await Promise.all(
        symbolsToFetch.map(async (sym) => {
          try {
            const data = await marketService.getMarketData(sym);
            results[sym] = data;
          } catch (err) {
            // No real quote available: keep it empty so the card shows "Unavailable" (never a made-up price)
            results[sym] = null;
          }
        })
      );
      setStockQuotes(results);
    } catch (e) {
      console.error('Error fetching watchlist quotes:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAllQuotes(symbols);
    // Poll every 60s
    const interval = setInterval(() => fetchAllQuotes(symbols), 60000);
    return () => clearInterval(interval);
  }, [symbols]);

  const resolveChoice = () => resolveStockChoice({ selected, typed: symbolInput, suggestions });

  /** Add one real instrument (from a suggestion or the popular chips). */
  const addInstrument = async (symbol) => {
    const clean = normalizeSymbol(symbol);
    if (symbols.includes(clean)) {
      addToast(`${clean.replace(/\.(NS|BO)$/, '')} is already in your watchlist`, 'info');
      setSymbolInput(''); setSelected(null); setFormError('');
      return;
    }
    setAdding(true);
    try {
      await add(clean);
      addToast(`Added ${clean.replace(/\.(NS|BO)$/, '')} to your watchlist`, 'info');
      setSymbolInput(''); setSelected(null); setSuggestions([]); setFormError('');
    } catch (err) {
      const msg = err.userMessage || `Could not add ${clean}`;
      setFormError(msg);
      addToast(msg, 'error');
    } finally {
      setAdding(false);
    }
  };

  const submitChoice = () => {
    if (adding) return;
    const choice = resolveChoice();
    if (!choice) {
      setFormError(validationMessage(symbolInput));
      return;
    }
    addInstrument(choice.symbol);
  };

  const handleRemoveSymbol = async (e, symToRemove) => {
    e.stopPropagation();
    try {
      await remove(symToRemove);
      addToast(`Removed ${symToRemove} from your watchlist`, 'info');
    } catch (err) {
      addToast(err.userMessage || `Could not remove ${symToRemove}`, 'error');
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchAllQuotes(symbols);
  };

  const triggerAssistant = (promptText) => {
    window.dispatchEvent(new CustomEvent('open-stocksee-assistant', { detail: { prompt: promptText } }));
  };

  return (
    <div className="editorial-page-container">
      {/* Page Editorial Header */}
      <header className="editorial-lead-header">
        <div className="lead-meta-row">
          <span className="editorial-kicker">PERSONAL MONITORING & INTELLIGENCE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="lead-date-stamp">{symbols.length} Monitored Equities</span>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="refresh-btn"
              title="Refresh Watchlist Quotes"
              style={{
                background: 'transparent',
                border: '1px solid var(--fg-border)',
                borderRadius: '6px',
                padding: '3px 8px',
                color: 'var(--fg-text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
              }}
            >
              <RefreshCw size={11} className={refreshing ? 'spinner' : ''} />
              <span>Sync</span>
            </button>
          </div>
        </div>
        <h1 className="lead-headline">My Watchlist</h1>
        <p className="lead-description">
          Monitor Indian stocks across NSE and BSE. No sign-up needed: your list is saved for this browser. <Link to="/settings" style={{ fontWeight: 700 }}>Connect Telegram</Link> to get it in your morning brief.
        </p>
      </header>

      {/* Add Symbol Bar */}
      <section className="editorial-flow-section" aria-label="Add Stock">
        <div className="watchlist-search-card">
          <form
            onSubmit={(e) => { e.preventDefault(); submitChoice(); }}
            className="watchlist-search-form"
            noValidate
          >
            <div className="watchlist-search-input-wrap">
              <SymbolSearchInput
                id="watchlist-search"
                withIcon
                inputClassName="watchlist-search-input"
                placeholder="Type a letter or name: D, DECN, Reliance, TCS…"
                value={symbolInput}
                onChange={(v) => { setSymbolInput(v); setSelected(null); setFormError(''); }}
                onSelect={(item) => { setSelected(item); setFormError(''); }}
                onResults={setSuggestions}
                onEnterWithoutPick={submitChoice}
                invalidMessage={formError}
              />
            </div>
            <button
              type="submit"
              className="btn-editorial btn-editorial-primary search-submit-btn"
              disabled={!resolveChoice() || adding}
              title={resolveChoice() ? undefined : 'Pick a stock from the suggestions first'}
            >
              <Plus size={15} />
              <span>{adding ? 'Adding…' : selected ? `Add ${selected.code} to Watchlist` : 'Add to Watchlist'}</span>
            </button>
          </form>

          {/* Quick Suggestions Chips */}
          <div className="quick-suggestions-wrap">
            <span className="quick-suggestions-label">Popular Indian scrips:</span>
            <div className="quick-chips-list">
              {quickTrackPills.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => addInstrument(pill)}
                  className="quick-chip-btn"
                >
                  + {pill.replace(/\.(NS|BO)$/, '')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Watched Stocks Grid */}
      <section className="editorial-flow-section" aria-label="Watched Stocks Grid">
        <div className="flow-section-header">
          <div>
            <span className="flow-kicker">MONITORED SCRIPS</span>
            <h3 className="flow-title">Watched Equities ({symbols.length})</h3>
          </div>
          <div className="flow-action-link" style={{ cursor: 'default', color: 'var(--fg-text-muted)' }}>
            <span>Live NSE/BSE Pricing • Instant Chart Access</span>
          </div>
        </div>

        {loading ? (
          <div className="feed-skeleton-wrap">
            <div className="skeleton feed-skeleton-item"></div>
            <div className="skeleton feed-skeleton-item"></div>
            <div className="skeleton feed-skeleton-item"></div>
          </div>
        ) : symbols.length === 0 ? (
          <div className="editorial-banner-box">
            <div className="banner-content">
              <h4 className="banner-headline">Your watchlist is currently empty.</h4>
              <p className="banner-subtext">
                Add stocks using the input bar above or select from popular Indian assets.
              </p>
              <div className="quick-chips-list" style={{ marginTop: '0.75rem' }}>
                {quickTrackPills.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addInstrument(s)}
                    className="btn-editorial btn-editorial-secondary"
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    <Plus size={12} /> Add {s.replace(/\.(NS|BO)$/, '')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: '1rem',
            }}
          >
            {symbols.map((sym) => {
              const quote = stockQuotes[sym];
              const price = quote?.price;
              const hasPrice = price !== undefined && price !== null;
              const changePercent = quote?.changePercent;
              const isUp = (changePercent || 0) >= 0;
              const exchange = sym.endsWith('.BO') ? 'BSE' : sym.endsWith('.NS') ? 'NSE' : 'COMMODITY';
              const companyName = quote?.name || sym.replace(/\.(NS|BO)$/, '');

              return (
                <div
                  key={sym}
                  className="editorial-stock-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.15rem',
                    borderRadius: '12px',
                    border: '1px solid var(--fg-border)',
                    backgroundColor: 'var(--fg-surface)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {/* Card Header: Symbol, Exchange & Remove button */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '1rem',
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            color: 'var(--fg-text)',
                          }}
                        >
                          {sym.replace(/\.(NS|BO)$/, '')}
                        </span>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: exchange === 'BSE' ? 'rgba(234, 88, 12, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: exchange === 'BSE' ? '#EA580C' : 'var(--fg-accent, #3B82F6)',
                          }}
                        >
                          {exchange}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleRemoveSymbol(e, sym)}
                        title={`Remove ${sym} from Watchlist`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--fg-text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg-negative)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-text-muted)')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Company Name */}
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--fg-text-secondary)',
                        marginBottom: '1rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={companyName}
                    >
                      {companyName}
                    </div>

                    {/* Price & Change Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                        {hasPrice ? formatPrice(price, quote?.currency) : 'Unavailable'}
                        {hasPrice && quote?.unit && <small style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--fg-text-muted)', marginLeft: '4px' }}>{quote.unit}</small>}
                      </div>

                      {hasValue(changePercent) && (() => {
                        const effectiveChange = changePercent;
                        const effectiveUp = effectiveChange >= 0;
                        return (
                          <div
                            className={`stock-delta-pill ${effectiveUp ? 'positive' : 'negative'}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              color: effectiveUp ? 'var(--fg-positive)' : 'var(--fg-negative)',
                              backgroundColor: effectiveUp ? 'var(--fg-positive-bg)' : 'var(--fg-negative-bg)',
                            }}
                          >
                            {effectiveUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                            <span>{effectiveUp ? '+' : ''}{Number(effectiveChange).toFixed(2)}%</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Card Actions: View Chart Button */}
                  <div style={{ borderTop: '1px solid var(--fg-border-subtle)', paddingTop: '0.85rem' }}>
                    <button
                      type="button"
                      className="btn-editorial btn-editorial-primary"
                      onClick={() =>
                        setSelectedStock({
                          symbol: sym,
                          name: companyName,
                          price,
                          changePercent,
                          high: quote?.high,
                          low: quote?.low,
                        })
                      }
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '0.55rem 1rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      <LineChart size={14} />
                      <span>View Chart</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Prominent SEBI Disclaimer Banner (Mandatory) */}
      <section className="editorial-flow-section" aria-label="Regulatory Disclaimer" style={{ marginTop: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backgroundColor: 'var(--fg-surface)',
            border: '1px solid var(--fg-border)',
            borderLeft: '4px solid var(--fg-accent)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <ShieldCheck size={20} color="var(--fg-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.84rem', color: 'var(--fg-text-secondary)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--fg-text)' }}>SEBI Regulatory Notice:</strong> This is a monitoring tool. Past performance is not indicative of future results. Information aggregated from public market sources is provided strictly for educational and self-directed awareness. Securities investments are subject to market risks.
          </div>
        </div>
      </section>

      {/* Interactive Stock Detail Modal (with TradingView Chart) */}
      {selectedStock && (
        <StockDetailModal
          instrument={selectedStock}
          onClose={() => setSelectedStock(null)}
          onOpenAssistant={triggerAssistant}
        />
      )}
    </div>
  );
};

export default Watchlist;