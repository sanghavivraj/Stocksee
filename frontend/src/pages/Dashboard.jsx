import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
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
import TodayTomorrow from '../components/TodayTomorrow';
import MarketReplay from '../components/MarketReplay';
import FirstTimeSetup, { setupAlreadyDone } from '../components/FirstTimeSetup';
import useInsights from '../hooks/useInsights';
import usePopular from '../hooks/usePopular';
import MarketBreadth from '../components/MarketBreadth';
import YourStocksToday from '../components/YourStocksToday';
import { daySentence, insightLabels } from '../utils/insightCopy';
import { formatPrice } from '../utils/formatPrice';
import { useWatchlist } from '../context/WatchlistContext';

// The stock window carries the chart library, so it loads the first time someone opens a stock.
const StockDetailModal = lazy(() => import('../components/StockDetailModal'));

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

const OVERVIEW_ROWS = 5; // the rest sits behind "Show more" so the page stays calm

const Dashboard = () => {
  const { visitor, refreshVisitor, language, addToast } = useContext(UserContext);
  const watchlist = useWatchlist();
  const [marketSnapshot, setMarketSnapshot] = useState([]);
  const [marketBrief, setMarketBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  // First-time setup. It is there from the first paint (adding it later pushed the whole page down), then checked once:
  // if the server already knows this visitor it is removed, otherwise it stays until finished.
  const [showSetup, setShowSetup] = useState(() => !setupAlreadyDone());
  const setupChecked = useRef(false);
  useEffect(() => {
    if (setupChecked.current || watchlist.loading) return;
    setupChecked.current = true;
    if (visitor) setShowSetup(false);
  }, [watchlist.loading, visitor]);
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

      <div className="dash-layout">
        <div className="dash-col">
          {/* Your stocks today: what a returning visitor opens the app for */}
          <section className="editorial-flow-section" aria-label="My Watchlist Snapshot">
            <div className="flow-section-header">
              <div>
                <span className="flow-kicker">{tr("TODAY", language)}</span>
                <h3 className="flow-title">{tr("Your stocks today", language)}</h3>
              </div>
              <Link to="/watchlist" className="flow-action-link">
                <span>{tr("View Watchlist", language)}</span>
                <ArrowRight size={14} />
              </Link>
        </div>

        {daySummary && (
          <p className="day-line"><b>{insightLabels(language).day}</b>{daySummary}</p>
        )}

        {watchlist.loading || (watchlist.symbols.length > 0 && insights.loading) ? (
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
          <YourStocksToday items={insights.items} language={language} onOpen={setSelectedStock} />
        )}
      </section>

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
          <>
          <div className="editorial-stock-list">
            {(overviewOpen ? marketSnapshot : marketSnapshot.slice(0, OVERVIEW_ROWS)).map((item) => {
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
                      {hasPrice && item.unit && <small style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg-text-muted)', marginLeft: '4px' }}>{item.unit}</small>}
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
          {marketSnapshot.length > OVERVIEW_ROWS && (
            <button type="button" className="unusual-more-btn" aria-expanded={overviewOpen} onClick={() => setOverviewOpen((v) => !v)}>
              {overviewOpen ? tr('Show less', language) : `${tr('Show more', language)} (${marketSnapshot.length - OVERVIEW_ROWS})`}
            </button>
          )}
          </>
        )}
      </section>

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
          {tr("Today's market in simple words", language)}
        </h2>

        {briefLoading ? (
          <div className="skeleton-brief-wrap">
            <div className="skeleton brief-line-1"></div>
            <div className="skeleton brief-line-2"></div>
          </div>
        ) : marketBrief ? (
          <>
            <div className={`story-prose ${briefOpen ? '' : 'collapsed'}`}>
              {renderMarkdown(marketBrief)}
            </div>
            <button type="button" className="story-toggle" aria-expanded={briefOpen} onClick={() => setBriefOpen((v) => !v)}>
              {briefOpen ? tr('Show less', language) : tr('Read more', language)}
            </button>
          </>
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

        </div>
        <div className="dash-col">
          {/* Today & Tomorrow: facts only (typical-move range, overnight cues, schedule, history) */}
          <TodayTomorrow />

          {/* Replay today's session for NIFTY and the watchlist */}
          <MarketReplay />

          {/* Section 4: how the whole market did today (live, worked out from the Nifty 500 list) */}
          <MarketBreadth />

        </div>
      </div>

      {/* Educational compliance footnote */}
      <footer className="editorial-footer-footnote">
        <ShieldCheck size={13} className="footnote-shield" />
        <span>{t('educationalDisclaimer', language)}</span>
      </footer>

      {/* Interactive Stock Detail Modal (real chart, price snapshot) */}
      {selectedStock && (
        <Suspense fallback={null}>
          <StockDetailModal
            instrument={selectedStock}
            onClose={() => setSelectedStock(null)}
            onOpenAssistant={triggerAssistant}
            onAddToWatchlist={(inst) => handleQuickWatchlist({ stopPropagation: () => {} }, inst.symbol)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Dashboard;