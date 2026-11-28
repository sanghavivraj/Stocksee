import { lazy, Suspense, useState, useEffect, useContext, useCallback } from 'react';
import { tr } from '../utils/uiStrings';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Eye,
  Bell,
  SlidersHorizontal,
  ShieldAlert,
  Radar,
  BookOpenCheck,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { t } from '../utils/i18n';
import marketService from '../services/marketService';
import AskAssistant from './AskAssistant';
import InvestorJourneySplash from './InvestorJourneySplash';
import { canPlay3D } from '../utils/webgl';
import Safe3D from './Safe3D';
import ThemeIcon from './ThemeIcon';

// The 3D opening film carries the 3D library, so it downloads only when it is going to play.
const InvestorJourney3D = lazy(() => import('./InvestorJourney3D'));
import { formatPrice, formatPercent, hasValue } from '../utils/formatPrice';

const benchmarkKeys = [
  { symbol: '^NSEI', label: 'NIFTY 50' },
  { symbol: '^BSESN', label: 'SENSEX' },
  { symbol: 'NIFTYBANK', label: 'BANK NIFTY' },
  { symbol: 'GOLD', label: 'GOLD (COMEX)' },
  { symbol: 'CRUDEOIL', label: 'CRUDE (WTI)' },
];

const INTRO_KEY = 'stocksee_intro_seen';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [splash, setSplash] = useState(false);
  const closeSplash = useCallback(() => setSplash(false), []);
  // Intro plays once per browser session; clicking the logo replays it on purpose
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(INTRO_KEY)) {
        sessionStorage.setItem(INTRO_KEY, '1');
        setSplash(true);
      }
    } catch { /* storage blocked (private mode): just skip the intro */ }
  }, []);
  const onLogoClick = (e) => {
    e.preventDefault();
    navigate('/');
    setSplash(true);
  };
  const { theme, toggleTheme, language, updateUserLanguage } = useContext(UserContext);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [pulseData, setPulseData] = useState([]);
  const [pulseLoading, setPulseLoading] = useState(true);

  const [assistantPrompt, setAssistantPrompt] = useState(null);

  // How many stocks tripped the unusual-activity rules (shown on the top-bar button). Not essential, so it
  // waits a moment and stays quiet if the data is unavailable.
  const [unusualCount, setUnusualCount] = useState(null);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      marketService.getUnusualActivity(1)
        .then((d) => alive && setUnusualCount(d.flagged))
        .catch(() => {});
    }, 1500);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  // Any page can open the assistant with a ready question: dispatch 'open-stocksee-assistant' with { prompt }
  useEffect(() => {
    const handleOpen = (e) => {
      setAssistantPrompt(e.detail?.prompt ? { text: e.detail.prompt, id: Date.now() } : null);
      setAssistantOpen(true);
    };
    window.addEventListener('open-stocksee-assistant', handleOpen);
    return () => window.removeEventListener('open-stocksee-assistant', handleOpen);
  }, []);

  // Fetch real market pulse data
  useEffect(() => {
    let isMounted = true;
    const fetchPulse = async () => {
      try {
        const results = await Promise.all(
          benchmarkKeys.map(async (item) => {
            try {
              const res = await marketService.getMarketData(item.symbol);
              return {
                symbol: item.label,
                price: formatPrice(res?.price, res?.currency) + (res?.unit ? ` ${res.unit.replace('per ', '/')}` : ''),
                change: hasValue(res?.changePercent) ? formatPercent(res.changePercent) : '—',
                isUp: (res?.changePercent || 0) >= 0,
              };
            } catch (err) {
              return {
                symbol: item.label,
                price: '—',
                change: '—',
                isUp: true,
              };
            }
          })
        );
        if (isMounted) {
          setPulseData(results);
          setPulseLoading(false);
        }
      } catch (e) {
        if (isMounted) setPulseLoading(false);
      }
    };

    fetchPulse();
    // Refresh every minute, but not while the tab is hidden (saves battery and API calls)
    const interval = setInterval(() => { if (!document.hidden) fetchPulse(); }, 60000);
    const onVisible = () => { if (!document.hidden) fetchPulse(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // 4 Core Navigation Items (Watchlist replaces Portfolio, no auth required)
  const navItems = [
    { path: '/', label: t('dashboard', language), icon: LayoutDashboard },
    { path: '/watchlist', label: language === 'en' ? 'My Watchlist' : t('watchlist', language), shortLabel: language === 'hi' ? 'वॉचलिस्ट' : language === 'gu' ? 'વૉચલિસ્ટ' : 'Watchlist', icon: Eye },
    { path: '/alerts', label: t('alerts', language), icon: Bell },
    { path: '/tip-check', label: t('tipCheck', language), icon: ShieldAlert },
    { path: '/samajh', label: language === 'hi' ? 'समझ' : 'Samajh', icon: BookOpenCheck },
    { path: '/settings', label: t('settings', language), icon: SlidersHorizontal },
  ];

  return (
    <div className="app-shell">
      {splash && (canPlay3D()
        ? (
          <Safe3D fallback={<InvestorJourneySplash language={language} onDone={closeSplash} />}>
            <Suspense fallback={<div className="jny is-in" aria-hidden="true" onPointerDown={closeSplash} />}><InvestorJourney3D language={language} onDone={closeSplash} /></Suspense>
          </Safe3D>
        )
        : <InvestorJourneySplash language={language} onDone={closeSplash} />)}
      {/* Lets keyboard and screen-reader users jump past the menu */}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => { e.preventDefault(); const m = document.getElementById('main-content'); m?.focus(); m?.scrollIntoView(); }}
      >
        {tr('Skip to main content', language)}
      </a>
      {/* Top Header */}
      <header className="top-navbar">
        <div className="navbar-container">
          {/* Brand Logo & Stamp */}
          <Link to="/" className="navbar-brand-wrap" aria-label="StockSee Home. Press the SS symbol to play the story" onClick={onLogoClick}>
            <div className="brand-stamp">SS</div>
            <div className="brand-info">
              <span className="brand-title">StockSee</span>
              <span className="brand-subtitle">{tr("Market Intelligence", language)}</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="desktop-navbar-links" aria-label="Desktop Navigation">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`desktop-nav-item ${isActive ? 'active' : ''}`}
                  title={item.label}
                  aria-label={item.label}
                >
                  <item.icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Quick Header Controls (Language & Theme) */}
          <div className="navbar-controls">
            {/* Unusual activity: its own page, with a gentle pulse so it is easy to notice */}
            <Link
              to="/unusual"
              className={`unusual-nav-btn ${location.pathname === '/unusual' ? 'active' : ''}`}
              title={language === 'hi' ? 'आज असामान्य व्यवहार वाले शेयर' : language === 'gu' ? 'આજે અસામાન્ય વર્તન કરતા શેર' : 'Stocks behaving unusually today'}
            >
              <span className="unusual-nav-icon"><Radar size={15} /></span>
              <span className="unusual-nav-text">{language === 'hi' ? 'असामान्य' : language === 'gu' ? 'અસામાન્ય' : 'Unusual'}</span>
              {unusualCount > 0 && <span className="unusual-nav-count" aria-label={`${unusualCount}`}>{unusualCount}</span>}
            </Link>

            {/* Language Selector */}
            <div className="lang-button-group" role="group" aria-label="Select Language">
              <button
                type="button"
                className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                onClick={() => updateUserLanguage('en')}
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-btn ${language === 'hi' ? 'active' : ''}`}
                onClick={() => updateUserLanguage('hi')}
                title="हिन्दी"
              >
                हिन्दी
              </button>
              <button
                type="button"
                className={`lang-btn ${language === 'gu' ? 'active' : ''}`}
                onClick={() => updateUserLanguage('gu')}
                title="ગુજરાતી"
              >
                ગુજરાતી
              </button>
            </div>

            {/* Theme Toggle Button */}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              <ThemeIcon dark={theme === 'dark'} />
            </button>
          </div>
        </div>
      </header>

      {/* Market Pulse Ribbon (Real Benchmark Tape) */}
      <div className="market-pulse-ribbon" aria-label="Market Pulse">
        <div className="pulse-inner">
          <div className="pulse-header">
            <span className="pulse-dot"></span>
            <span>{tr("Market Pulse", language)}</span>
          </div>

          <div className="pulse-items-track">
            {pulseLoading ? (
              <span className="pulse-loading-text">{tr("Loading exchange benchmarks...", language)}</span>
            ) : (
              pulseData.map((item) => (
                <div key={item.symbol} className="pulse-item">
                  <span className="pulse-symbol">{item.symbol}</span>
                  <span className="pulse-price">{item.price}</span>
                  {item.change !== '—' && (
                    <span className={`pulse-change ${item.isUp ? 'up' : 'down'}`}>
                      {item.change}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Page Viewport */}
      <main className="main-content" id="main-content" tabIndex={-1}>
        {children}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const IconComponent = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-tab ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="tab-icon-wrap">
                <IconComponent size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              </div>
              <span className="tab-label">{item.shortLabel || item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Floating Ask StockSee Assistant & Mobile Bottom Sheet */}
      <AskAssistant
        isOpen={assistantOpen}
        initialPrompt={assistantPrompt}
        onToggle={() => setAssistantOpen((prev) => !prev)}
      />
    </div>
  );
};

export default Layout;