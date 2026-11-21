import { useState, useEffect, useContext, useRef } from 'react';
import { tr } from '../utils/uiStrings';
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  BookmarkPlus,
  Bell,
  Sparkles,
  Check,
  Plus,
  Loader2,
  BarChart3,
  Newspaper,
  CalendarClock,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import marketService from '../services/marketService';
import askService from '../services/askService';
import { renderMarkdown } from '../utils/formatMarkdown';
import StockScorecard from './StockScorecard';
import StockChart from './StockChart';
import PauseBanner from './PauseBanner';
import { needsPause } from '../utils/pauseCheck';
import { useWatchlist } from '../context/WatchlistContext';
import { useNavigate } from 'react-router-dom';
import { formatPrice, formatPercent, hasValue } from '../utils/formatPrice';

const TIMEFRAMES = [
  { label: '1M', range: '1mo' },
  { label: '3M', range: '3mo' },
  { label: '1Y', range: '1y' },
];

const StockDetailModal = ({ instrument, onClose, onOpenAssistant, onAddToWatchlist, onAddToPortfolio }) => {
  const { language, addToast } = useContext(UserContext);
  const watchlist = useWatchlist();
  const navigate = useNavigate();
  const [activeTimeframe, setActiveTimeframe] = useState('1mo');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [quoteData, setQuoteData] = useState(null);
  const [analysisText, setAnalysisText] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(() => watchlist.has(instrument?.symbol));
  const [scorecard, setScorecard] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      if (!instrument?.symbol) return;
      setAnalysisLoading(true);

      try {
        // 1. Fetch live quote and factual price snapshot in parallel
        const [marketQuote, sc] = await Promise.all([
          marketService.getMarketData(instrument.symbol).catch(() => ({})),
          marketService.getScorecard(instrument.symbol).catch(() => null),
        ]);
        if (isMounted) {
          setQuoteData({
            ...instrument,
            ...marketQuote,
          });
          if (sc) setScorecard(sc);
        }

        // 2. Fetch deep market analysis and news context from askService
        // Neutral, factual question: no outlook, levels or bullish/bearish calls (not SEBI-registered advice)
        const prompt = `How has ${instrument.name || instrument.symbol} (${instrument.symbol}) performed today, this week and this month?`;

        const res = await askService.askQuestion(prompt, language || 'en');
        if (isMounted) {
          if (res?.quote) {
            setQuoteData((prev) => ({
              ...prev,
              ...res.quote,
              price: res.quote.currentPrice || prev?.price,
              changePercent: res.quote.dayChangePercent !== undefined ? res.quote.dayChangePercent : prev?.changePercent,
              high: res.quote.dayHigh || prev?.high,
              low: res.quote.dayLow || prev?.low,
            }));
          }
          setAnalysisText(res?.answer || null);
          if (res?.scorecard) setScorecard(res.scorecard);
          setAnalysisLoading(false);
        }
      } catch (e) {
        if (isMounted) {
          setAnalysisLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [instrument, language]);

  // Real daily candles for the selected timeframe
  useEffect(() => {
    if (!instrument?.symbol) return undefined;
    let isMounted = true;
    setHistoryLoading(true);
    marketService
      .getHistory(instrument.symbol, activeTimeframe)
      .then((data) => isMounted && setHistory(data))
      .catch(() => isMounted && setHistory(null))
      .finally(() => isMounted && setHistoryLoading(false));
    return () => {
      isMounted = false;
    };
  }, [instrument?.symbol, activeTimeframe]);

  // Accessibility: Esc closes, focus moves into the dialog, background doesn't scroll, focus returns on close
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isOpen = Boolean(instrument);
  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!instrument) return null;

  // Only real values from the API; anything missing is shown as '—' (never estimated)
  const pick = (...vals) => vals.find(hasValue);
  const currency = quoteData?.currency || history?.currency || 'INR';
  const currentPrice = pick(quoteData?.price, quoteData?.currentPrice, instrument.price);
  const changePercent = pick(quoteData?.changePercent, quoteData?.dayChangePercent, instrument.changePercent);
  const changeVal = pick(quoteData?.change, quoteData?.dayChange);
  const isPos = (changePercent ?? 0) >= 0;
  const dayHigh = pick(quoteData?.high, quoteData?.dayHigh);
  const dayLow = pick(quoteData?.low, quoteData?.dayLow);
  const weekChange = pick(quoteData?.weekChangePercent);
  const monthChange = pick(quoteData?.monthChangePercent);
  const changeColor = (v) => (hasValue(v) ? (v >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)') : undefined);

  const handleWatchlist = async () => {
    try {
      if (watchlist.has(instrument.symbol)) {
        addToast(`${instrument.symbol} is already in your watchlist`, 'info');
      } else {
        await watchlist.add(instrument.symbol);
        addToast(`Added ${instrument.symbol} to your watchlist`, 'info');
      }
      setIsSaved(true);
    } catch (err) {
      addToast(err.userMessage || 'Could not update watchlist', 'error');
    }
  };

  // Open the smart-alert builder for this stock (with the "how often would it fire" preview)
  const handleAlert = () => {
    onClose();
    navigate(`/alerts?symbol=${encodeURIComponent(instrument.symbol)}`);
  };

  return (
    <div className="editorial-modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="stock-detail-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${instrument.name} details`}
      >
        {/* Mobile Drag Indicator */}
        <div className="sheet-drag-handle" />

        {/* Modal Header */}
        <div className="detail-modal-header">
          <div className="detail-header-identity">
            <div className="detail-tag-row">
              <span className="detail-symbol-badge">{instrument.symbol}</span>
              <span className="detail-category-badge">{instrument.category || 'Equity / Benchmark'}</span>
            </div>
            <h2 className="serif-title detail-instrument-title">
              {instrument.name || instrument.symbol}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="detail-close-btn"
            aria-label="Close detail modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="detail-modal-body">
          {/* Price & Intraday Valuation Banner */}
          <div className="detail-price-banner">
            <div className="detail-price-left">
              <span className="detail-price-number mono-number">
                {hasValue(currentPrice) ? formatPrice(currentPrice, currency) : 'Price unavailable'}
                {hasValue(currentPrice) && quoteData?.unit && <small style={{ fontSize: '0.8rem', fontWeight: 600, marginLeft: '6px', color: 'var(--fg-text-muted)' }}>{quoteData.unit}</small>}
              </span>
              {hasValue(changePercent) && (
                <div className={`stock-delta-pill ${isPos ? 'positive' : 'negative'} large`}>
                  {isPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  <span>
                    {hasValue(changeVal) ? `${isPos ? '+' : '-'}${formatPrice(Math.abs(changeVal), currency)} ` : ''}
                    ({formatPercent(changePercent)})
                  </span>
                </div>
              )}
              {quoteData?.stale && <span className="analysis-source-tag">{tr("Last known price — may be outdated", language)}</span>}
            </div>
          </div>

          {needsPause(changePercent) && <PauseBanner symbol={instrument.symbol} changePercent={changePercent} onNavigate={onClose} />}

          {/* TradingView Lightweight Candlestick Chart */}
          <div className="detail-chart-section" style={{ padding: '0', background: 'transparent', border: 'none' }}>
            <div className="detail-chart-header" style={{ marginBottom: '8px' }}>
              <div className="chart-title-wrap">
                <BarChart3 size={14} className="chart-icon" />
                <span className="chart-title">{tr("Price chart & events", language)}</span>
              </div>
              <div className="timeframe-pill-group">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.range}
                    type="button"
                    className={`timeframe-btn ${activeTimeframe === tf.range ? 'active' : ''}`}
                    onClick={() => setActiveTimeframe(tf.range)}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {quoteData?.converted && (
              <p className="risk-disclaimer" style={{ margin: '0 0 8px' }}>
                Price shown in rupees {quoteData.unit}: the international (USD) price converted at ₹{quoteData.usdInr} per $1. MCX and jeweller prices in India differ because of import duty, GST and premiums. The chart below is the original international price in USD per troy ounce (gold) / per barrel (crude).
              </p>
            )}
            <StockChart
              symbol={instrument.symbol}
              candles={history?.candles}
              markers={history?.markers}
              currency={history?.currency || currency}
              source={history?.source}
              loading={historyLoading}
              height={260}
            />
            {history?.upcoming?.length > 0 && (
              <div className="upcoming-banner">
                <CalendarClock size={14} aria-hidden="true" />
                <span>Upcoming results: {history.upcoming.map((u) => new Date(`${u.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Key Statistics Matrix */}
          <div className="detail-stats-grid">
            <div className="stat-card">
              <span className="stat-label">{tr("Day Range (L — H)", language)}</span>
              <span className="stat-val mono-number">
                {hasValue(dayLow) && hasValue(dayHigh) ? `${formatPrice(dayLow, currency)} — ${formatPrice(dayHigh, currency)}` : '—'}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">1-Week Change</span>
              <span className="stat-val mono-number" style={{ color: changeColor(weekChange) }}>
                {formatPercent(weekChange)}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">1-Month Change</span>
              <span className="stat-val mono-number" style={{ color: changeColor(monthChange) }}>
                {formatPercent(monthChange)}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">{tr("Volume", language)}</span>
              <span className="stat-val mono-number">{quoteData?.volume || '—'}</span>
            </div>
          </div>

          {/* Educational price snapshot (facts only, no recommendations) */}
          {scorecard && (
            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <StockScorecard scorecard={scorecard} />
            </div>
          )}

          {/* Market Intelligence, News & Analysis */}
          <div className="detail-analysis-card">
            <div className="analysis-header-row">
              <div className="analysis-badge">
                <Newspaper size={13} />
                <span>{tr("PRICE MOVEMENT SUMMARY", language)}</span>
              </div>
              <span className="analysis-source-tag">{tr("StockSee AI Synthesis", language)}</span>
            </div>

            {analysisLoading ? (
              <div className="analysis-loading-wrap">
                <Loader2 size={16} className="spinner" />
                <span>Summarising recent price movement for {instrument.name || instrument.symbol}...</span>
              </div>
            ) : analysisText ? (
              <div className="analysis-prose">
                {renderMarkdown(analysisText)}
              </div>
            ) : (
              <p className="analysis-fallback">
                {tr("Market summary is unavailable right now. Please try again shortly.", language)}
              </p>
            )}
          </div>

          {/* StockSee Inquire Chip */}
          <div className="detail-inquire-strip">
            <div className="inquire-prompt-text">
              <Sparkles size={14} className="inquire-star" />
              <span>Have a specific question about {instrument.name || instrument.symbol}?</span>
            </div>
            <button
              type="button"
              className="btn-editorial btn-editorial-secondary inquire-btn"
              onClick={() => {
                onClose();
                onOpenAssistant?.(`How has ${instrument.symbol} performed this month?`);
              }}
            >
              <span>{tr("Ask StockSee Assistant →", language)}</span>
            </button>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="detail-modal-footer">
          <button
            type="button"
            onClick={handleWatchlist}
            className={`btn-editorial ${isSaved ? 'btn-editorial-secondary' : 'btn-editorial-primary'} detail-footer-btn`}
          >
            {isSaved ? <Check size={14} /> : <BookmarkPlus size={14} />}
            <span>{isSaved ? 'Saved in Watchlist' : 'Add to Watchlist'}</span>
          </button>

          <button
            type="button"
            onClick={handleAlert}
            className="btn-editorial btn-editorial-secondary detail-footer-btn"
          >
            <Bell size={14} />
            <span>{tr("Set an alert", language)}</span>
          </button>

          {(onAddToWatchlist || onAddToPortfolio) && (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onAddToWatchlist) onAddToWatchlist(instrument);
                else if (onAddToPortfolio) onAddToPortfolio(instrument);
              }}
              className="btn-editorial btn-editorial-secondary detail-footer-btn"
            >
              <Plus size={14} />
              <span>{tr("Add to Watchlist", language)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockDetailModal;
