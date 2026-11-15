import { useContext, useEffect, useState } from 'react';
import { tr } from '../utils/uiStrings';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Sparkles,
  Eye,
  BookmarkPlus,
  Bell,
  Check,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { t } from '../utils/i18n';
import marketService from '../services/marketService';
import alertService from '../services/alertService';
import { renderMarkdown } from '../utils/formatMarkdown';
import StockDetailModal from '../components/StockDetailModal';
import TodayTomorrow from '../components/TodayTomorrow';
import MarketReplay from '../components/MarketReplay';
import FirstTimeSetup, { setupAlreadyDone } from '../components/FirstTimeSetup';
import useInsights from '../hooks/useInsights';
import usePopular from '../hooks/usePopular';
import MarketBreadth from '../components/MarketBreadth';
import { daySentence, insightLabels } from '../utils/insightCopy';
import { formatPrice } from '../utils/formatPrice';
import { useWatchlist } from '../context/WatchlistContext';

// Indices and commodities are fixed instruments (settings). The stocks shown are the most traded ones right now, worked out live.
const indexRows = [
  { symbol: '^NSEI', name: 'NIFTY 50', category: 'Benchmark Index' },
  { symbol: '^BSESN', name: 'SENSEX', category: 'Benchmark Index' },
  { symbol: 'NIFTYBANK', name: 'BANK NIFTY', category: 'Sectoral Banking' },
];
const commodityRows = [
  { symbol: 'GOLD', name: 'Gold (COMEX, USD)', category: 'Precious Metal' },
  { symbol: 'CRUDEOIL', name: 'Crude Oil (WTI, USD)', category: 'Commodity' },
];

const Dashboard = () => {
  const { visitor, refreshVisitor, language, addToast } = useContext(UserContext);
  const watchlist = useWatchlist();
  const [marketSnapshot, setMarketSnapshot] = useState([]);
  const [marketBrief, setMarketBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  // First-time setup: decided once, when we know this browser has saved nothing yet (then it stays until finished)
  const [showSetup, setShowSetup] = useState(null);
  useEffect(() => {
    if (showSetup === null && !watchlist.loading) setShowSetup(!visitor && !setupAlreadyDone());
  }, [showSetup, watchlist.loading, visitor]);
  const insights = useInsights(watchlist.symbols);
  const popular = usePopular(4);
  const daySummary = daySentence(insights.items, language);

  const getGreeting = () => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    if (hour >= 17) timeGreeting = 'Good evening';

    if (language === 'hi') {
      timeGreeting = hour < 12 ? 'सुप्रभात' : hour < 17 ? 'शुभ दोपहर' : 'शुभ संध्या';
    } else if (language === 'gu') {
      timeGreeting = hour < 12 ? 'સુપ્રભાત' : hour < 17 ? 'શુભ બપોર' : 'શુભ સાંજ';
    }

    return timeGreeting;
  };

  const getFormattedDate = () => {
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return new Date().toLocaleDateString(language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN', options);
  };

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      try {
        // Fetch real market data for major Indian indices, equities, and commodities
        const stockRows = popular.items.map((p) => ({ symbol: p.symbol, name: p.name, category: p.industry || 'Equity' }));
        const quotes = await Promise.all(
          [...indexRows, ...stockRows, ...commodityRows].map(async (item) => {
            try {
              const res = await marketService.getMarketData(item.symbol);
              return {
                ...item,
                price: res?.price,
                change: res?.change,
                changePercent: res?.changePercent,
                high: res?.high,
                low: res?.low,
                currency: res?.currency,
                unit: res?.unit,
              };
            } catch (e) {
              return {
                ...item,
                price: undefined,
                change: undefined,
                changePercent: undefined,
              };
            }
          })
        );

        if (isMounted) {
          setMarketSnapshot(quotes);
          setDataLoading(false);
        }
      } catch (e) {
        if (isMounted) setDataLoading(false);
      }
    };

    const fetchMarketBrief = async () => {
      setBriefLoading(true);
      try {
        const brief = await marketService.getBrief(language || 'en');
        if (isMounted) setMarketBrief(brief || null);
      } catch (e) {
        if (isMounted) setMarketBrief(null);
      } finally {
        if (isMounted) setBriefLoading(false);
      }
    };

    if (!popular.loading) loadDashboardData();
    fetchMarketBrief();

    return () => {
      isMounted = false;
    };
  }, [language, popular.loading, popular.items]);

  const handleQuickWatchlist = async (e, sym) => {
    e.stopPropagation();
    try {
      if (watchlist.has(sym)) {
        await watchlist.remove(sym);
        addToast(`Removed ${sym} from your watchlist`, 'info');
      } else {
        await watchlist.add(sym);
        addToast(`Added ${sym} to your watchlist`, 'info');
      }
    } catch (err) {
      addToast(err.userMessage || 'Failed to update watchlist', 'error');
    }
  };

  const handleQuickAlert = async (e, sym) => {
    e.stopPropagation();
    try {
      await alertService.create({ symbol: sym, threshold: 2.0, direction: 'up' });
      if (!visitor) refreshVisitor().catch(() => {});
      addToast(`Alert set: ${sym} up 2% in a day`, 'info');
    } catch (err) {
      addToast(err.userMessage || `Could not create alert for ${sym}`, 'error');
    }
  };

  const triggerAssistant = (promptText = '') => {
    window.dispatchEvent(new CustomEvent('open-stocksee-assistant', { detail: { prompt: promptText } }));
  };

  return (
    <div className="editorial-page-container">
      {/* Editorial Header */}
      <header className="editorial-lead-header">
        <div className="lead-meta-row">
          <span className="editorial-kicker">{tr("INDIAN MARKET INTELLIGENCE", language)}</span>
          <span className="lead-date-stamp">{getFormattedDate()}</span>
        </div>
        <h1 className="lead-headline">{getGreeting()}</h1>
        <p className="lead-description">
          {language === 'hi'
            ? 'यहाँ आज के भारतीय शेयर बाजारों, मुख्य कमोडिटी और आपकी वॉचलिस्ट का स्पष्ट विश्लेषण है।'
            : language === 'gu'
            ? 'અહીં આજના ભારતીય શેરબજારો, મુખ્ય કોમોડિટી અને આપની વૉચલિસ્ટનું સ્પષ્ટ વિશ્લેષણ છે।'
            : 'Essential market context, live exchange overview, and watchlist tracking for Indian retail investors.'}
        </p>
      </header>

      {showSetup && <FirstTimeSetup onClose={() => setShowSetup(false)} />}

      {/* Section 1: Lead Editorial Market Brief */}
      <section className="editorial-lead-story" aria-label="Today's Market Briefing">
        <div className="story-meta-bar">
          <div className="story-tag-pill">
            <span className="story-live-dot"></span>
            <span>{tr("MORNING MARKET BRIEF", language)}</span>
          </div>
          <div className="story-time-stamp">{tr('LIVE MARKET DATA', language)} • {getFormattedDate()}</div>
        </div>

        <h2 className="story-headline">
          {language === 'hi' ? 'भारतीय बाजार और व्यापक आर्थिक संकेत' : language === 'gu' ? 'ભારતીય બજારો અને આર્થિક સંકેતો' : 'Indian Equities & Macroeconomic Indicators'}
        </h2>

        {briefLoading ? (
          <div className="skeleton-brief-wrap">
            <div className="skeleton brief-line-1"></div>
            <div className="skeleton brief-line-2"></div>
          </div>
        ) : marketBrief ? (
          <div className="story-prose">
            {renderMarkdown(marketBrief)}
          </div>
        ) : (
          <p className="story-prose-fallback">
            {tr("Market intelligence feeds are currently synthesizing live opening data. Check back shortly.", language)}
          </p>
        )}

        <div className="story-footer-action">
          <button
            type="button"
            className="editorial-chip-btn"
            onClick={() => triggerAssistant("Explain today's Indian market momentum")}
          >
            <Sparkles size={13} />
            <span>{tr("Ask StockSee about this brief →", language)}</span>
          </button>
        </div>
      </section>

      {/* Today & Tomorrow: facts only (typical-move range, overnight cues, schedule, history) */}
      <TodayTomorrow />

      {/* Section 2: Indian Market Snapshot (Indices, Bluechips, Commodities) */}
      <section className="editorial-flow-section" aria-label="Indian Market Snapshot">
        <div className="flow-section-header">
          <div>
            <span className="flow-kicker">{tr("EXCHANGE OVERVIEW", language)}</span>
            <h3 className="flow-title">{t('marketOverview', language)}</h3>
          </div>
          <div className="flow-action-link" style={{ cursor: 'default', color: 'var(--fg-text-muted)' }}>
            <span>{tr("Click any asset for chart & analysis", language)}</span>
          </div>
        </div>

        {dataLoading ? (
          <div className="feed-skeleton-wrap">
            <div className="skeleton feed-skeleton-item"></div>
            <div className="skeleton feed-skeleton-item"></div>
            <div className="skeleton feed-skeleton-item"></div>
          </div>
        ) : (
          <div className="editorial-stock-list">
            {marketSnapshot.map((item) => {
              const isUp = (item.changePercent || 0) >= 0;
              const hasPrice = item.price !== undefined && item.price !== null;
              const isSaved = watchlist.has(item.symbol);

              return (
                <div
                  key={item.symbol}
                  className="market-overview-row clickable"
                  onClick={() => setSelectedStock(item)}
                  title={`Click to view chart, technicals & analysis for ${item.name}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedStock(item);
                    }
                  }}
                >
                  {/* Left: Identity & Classification */}
                  <div className="market-row-identity">
                    <div className="stock-primary-name">{item.name}</div>
                    <div className="stock-sub-meta">
                      <span className="stock-symbol-tag">{item.symbol}</span>
                      <span className="stock-cat-tag">• {tr(item.category, language)}</span>
                    </div>
                  </div>

                  {/* Middle: Intraday Range with Generous Gap & Labels */}
                  <div className="market-row-range">
                    {item.high && item.low ? (
                      <div className="intraday-range-wrap">
                        <div className="range-labels mono-number">
                          <span className="range-lbl-left">L: {formatPrice(item.low, item.currency, { maximumFractionDigits: 1 })}</span>
                          <span className="range-lbl-right">H: {formatPrice(item.high, item.currency, { maximumFractionDigits: 1 })}</span>
                        </div>
                        <div className="range-bar-track">
                          <div
                            className="range-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(4, ((item.price - item.low) / (item.high - item.low || 1)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="range-unavailable-text">{tr("Active Session", language)}</span>
                    )}
                  </div>

                  {/* Right: Tabular Price & Delta Badge */}
                  <div className="market-row-valuation">
                    <div className="stock-price mono-number">
                      {hasPrice ? formatPrice(item.price, item.currency) : '—'}
                      {hasPrice && item.unit && <small style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--fg-text-muted)', marginLeft: '4px' }}>{item.unit}</small>}
                    </div>
                    {item.changePercent !== undefined && item.changePercent !== null ? (
                      <div className={`stock-delta-pill ${isUp ? 'positive' : 'negative'}`}>
                        {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        <span>
                          {item.change !== undefined && item.change !== null && Math.abs(item.change) > 0 ? (
                            <span className="point-delta-text">
                              {isUp ? '+' : ''}{Number(item.change).toFixed(1)}{' '}
                            </span>
                          ) : null}
                          ({isUp ? '+' : ''}{Number(item.changePercent).toFixed(2)}%)
                        </span>
                      </div>
                    ) : (
                      <span className="stock-delta-none">—</span>
                    )}
                  </div>

                  {/* Quick Standard Financial Actions (+ Watchlist, + Alert) */}
                  <div className="market-row-quick-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleQuickWatchlist(e, item.symbol)}
                      className={`standard-action-icon-btn ${isSaved ? 'saved' : ''}`}
                      title={isSaved ? 'In Watchlist' : 'Add to Watchlist'}
                      aria-label="Add to Watchlist"
                    >
                      {isSaved ? <Check size={14} /> : <BookmarkPlus size={14} />}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleQuickAlert(e, item.symbol)}
                      className="standard-action-icon-btn"
                      title="Set 2.0% Price Alert"
                      aria-label="Set Price Alert"
                    >
                      <Bell size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Replay today's session for NIFTY and the watchlist */}
      <MarketReplay />

      {/* Section 3: My Watchlist Preview */}
      <section className="editorial-flow-section" aria-label="My Watchlist Snapshot">
        <div className="flow-section-header">
          <div>
            <span className="flow-kicker">{tr("MY WATCHLIST", language)}</span>
            <h3 className="flow-title">{language === 'en' ? 'My Watchlist' : t('watchlist', language)}</h3>
          </div>
          <Link to="/watchlist" className="flow-action-link">
            <span>{tr("View Watchlist", language)}</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {daySummary && (
          <p className="day-line"><b>{insightLabels(language).day}</b>{daySummary}</p>
        )}

        {dataLoading ? (
          <div className="portfolio-skeleton-row">
            <div className="skeleton portfolio-skeleton-card"></div>
            <div className="skeleton portfolio-skeleton-card"></div>
          </div>
        ) : watchlist.symbols.length === 0 ? (
          <div className="editorial-banner-box">
            <div className="banner-icon-wrap">
              <Eye size={20} />
            </div>
            <div className="banner-content">
              <h4 className="banner-headline">{tr("Your watchlist is ready for your first scrip.", language)}</h4>
              <p className="banner-subtext">
                {tr("Add Indian equities or indices to monitor real-time prices, percentage shifts, and TradingView charts without login.", language)}
              </p>
            </div>
            <Link to="/watchlist" className="btn-editorial btn-editorial-primary banner-action-btn">
              <Plus size={14} />
              <span>{tr("Add Scrips", language)}</span>
            </Link>
          </div>
        ) : (
          <div className="portfolio-metrics-strip">
            <div className="portfolio-metric-col">
              <span className="metric-col-label">{tr("Watched Scrips", language)}</span>
              <span className="metric-col-val mono-number">
                {watchlist.symbols.length} Active
              </span>
              <span className="metric-col-sub">{tr("Persistent in local browser", language)}</span>
            </div>

            <div className="portfolio-metric-divider" />

            <div className="portfolio-metric-col">
              <span className="metric-col-label">{tr("Market Coverage", language)}</span>
              <span className="metric-col-val" style={{ color: 'var(--fg-accent)', fontSize: '1.25rem' }}>
                {tr("NSE & BSE Equities", language)}
              </span>
              <span className="metric-col-sub">{tr("Live quote & trend analysis", language)}</span>
            </div>

            <div className="portfolio-metric-divider" />

            <div className="portfolio-metric-col">
              <span className="metric-col-label">{tr("SEBI Guardrail", language)}</span>
              <span className="metric-col-val" style={{ color: 'var(--fg-positive)', fontSize: '1.25rem' }}>
                {tr("Pure Monitoring", language)}
              </span>
              <span className="metric-col-sub">{tr("Zero advice / No login needed", language)}</span>
            </div>
          </div>
        )}
      </section>

      {/* Section 4: how the whole market did today (live, worked out from the Nifty 500 list) */}
      <MarketBreadth />

      {/* Section 5: Educational Compliance Footnote */}
      <footer className="editorial-footer-footnote">
        <ShieldCheck size={13} className="footnote-shield" />
        <span>{t('educationalDisclaimer', language)}</span>
      </footer>

      {/* Interactive Stock Detail Modal (real chart, price snapshot) */}
      {selectedStock && (
        <StockDetailModal
          instrument={selectedStock}
          onClose={() => setSelectedStock(null)}
          onOpenAssistant={triggerAssistant}
          onAddToWatchlist={(inst) => handleQuickWatchlist({ stopPropagation: () => {} }, inst.symbol)}
        />
      )}
    </div>
  );
};

export default Dashboard;