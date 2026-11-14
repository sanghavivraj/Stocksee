import { useContext, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { t } from '../utils/i18n';
import holdingService from '../services/holdingService';
import portfolioService from '../services/portfolioService';
import marketService from '../services/marketService';
import alertService from '../services/alertService';

const popularStockPills = [
  { symbol: 'RELIANCE.NS', defaultPrice: 2980.5 },
  { symbol: 'TCS.NS', defaultPrice: 4210.0 },
  { symbol: 'HDFCBANK.NS', defaultPrice: 1720.8 },
  { symbol: 'INFY.NS', defaultPrice: 1890.3 },
  { symbol: 'TATAMOTORS.NS', defaultPrice: 985.4 },
  { symbol: 'SBIN.NS', defaultPrice: 830.2 },
];

const Portfolio = () => {
  const { user, language, addToast } = useContext(UserContext);
  const [holdings, setHoldings] = useState([]);
  const [marketPrices, setMarketPrices] = useState({});
  const [portfolioDelta, setPortfolioDelta] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ symbol: '', quantity: '', averagePrice: '' });

  const loadPortfolioData = async () => {
    setLoading(true);
    const userId = user?.id || 1;
    try {
      const [hList, , dRes] = await Promise.all([
        holdingService.getHoldings(userId).catch(() => []),
        portfolioService.getPortfolioValue(userId).catch(() => ({ portfolioValue: 0 })),
        portfolioService.getPortfolioDelta(userId).catch(() => ({ portfolioDelta: 0 })),
      ]);

      const validHoldings = hList || [];
      setHoldings(validHoldings);
      setPortfolioDelta(dRes?.portfolioDelta || 0);

      // Fetch live market quotes for all holdings
      const prices = {};
      await Promise.all(
        validHoldings.map(async (h) => {
          try {
            const data = await marketService.getMarketData(h.symbol);
            prices[h.symbol] = data;
          } catch (e) {
            prices[h.symbol] = { price: h.averagePrice, change: 0, changePercent: 0 };
          }
        })
      );
      setMarketPrices(prices);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAddHolding = async (e) => {
    e.preventDefault();
    if (!form.symbol || !form.quantity || !form.averagePrice) return;
    try {
      await holdingService.createHolding({
        userId: user?.id || 1,
        symbol: form.symbol.toUpperCase().trim(),
        quantity: parseFloat(form.quantity),
        averagePrice: parseFloat(form.averagePrice),
      });
      addToast(`Added ${form.symbol.toUpperCase()} to your portfolio`, 'info');
      setForm({ symbol: '', quantity: '', averagePrice: '' });
      setIsModalOpen(false);
      loadPortfolioData();
    } catch (err) {
      addToast('Failed to add holding', 'error');
    }
  };

  const handleDeleteHolding = async (id, symbol) => {
    try {
      await holdingService.deleteHolding(id);
      addToast(`Removed ${symbol} from portfolio`, 'info');
      loadPortfolioData();
    } catch (err) {
      addToast('Failed to delete holding', 'error');
    }
  };

  const handleQuickAlert = async (symbol) => {
    try {
      await alertService.createAlert({
        userId: user?.id || 1,
        symbol,
        threshold: 2.0,
        direction: 'up',
      });
      addToast(`2.0% Price Alert created for ${symbol}`, 'info');
    } catch (e) {
      addToast('Alert already exists for this symbol', 'info');
    }
  };

  const triggerAssistant = (promptText) => {
    window.dispatchEvent(new CustomEvent('open-finguru-assistant', { detail: { prompt: promptText } }));
  };

  // Calculations
  const totalInvested = holdings.reduce((acc, h) => acc + h.quantity * h.averagePrice, 0);
  const totalCurrentValue = holdings.reduce((acc, h) => {
    const quote = marketPrices[h.symbol]?.price || h.averagePrice;
    return acc + h.quantity * quote;
  }, 0);
  const unrealizedPnL = totalCurrentValue - totalInvested;
  const unrealizedPnLPercent = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

  return (
    <div className="editorial-page-container">
      {/* Page Header */}
      <header className="editorial-lead-header">
        <div className="header-flex-row">
          <div>
            <div className="lead-meta-row">
              <span className="editorial-kicker">ASSET ALLOCATION & PERFORMANCE</span>
              <span className="lead-date-stamp">{holdings.length} Active Holdings</span>
            </div>
            <h1 className="lead-headline">{t('portfolio', language)}</h1>
            <p className="lead-description">
              Monitor your total invested capital, unrealized capital gains, and real-time equity valuations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn-editorial btn-editorial-primary header-action-btn"
          >
            <Plus size={15} />
            <span>{t('addHolding', language)}</span>
          </button>
        </div>
      </header>

      {/* Portfolio Summary Metrics */}
      <section className="editorial-flow-section" aria-label="Portfolio Summary">
        <div className="portfolio-metrics-strip">
          <div className="portfolio-metric-col">
            <span className="metric-col-label">{t('totalValue', language)}</span>
            <span className="metric-col-val mono-number">
              ₹{totalCurrentValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="metric-col-sub">
              Invested: ₹{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="portfolio-metric-divider" />

          <div className="portfolio-metric-col">
            <span className="metric-col-label">Unrealized P&L</span>
            <span
              className="metric-col-val mono-number"
              style={{ color: unrealizedPnL >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)' }}
            >
              {unrealizedPnL >= 0 ? '+' : ''}₹{unrealizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span
              className="metric-col-sub"
              style={{ color: unrealizedPnL >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)', fontWeight: 600 }}
            >
              {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}% total return
            </span>
          </div>

          <div className="portfolio-metric-divider" />

          <div className="portfolio-metric-col">
            <span className="metric-col-label">{t('todayDelta', language)}</span>
            <span
              className="metric-col-val mono-number"
              style={{ color: portfolioDelta >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)' }}
            >
              {portfolioDelta >= 0 ? '+' : ''}₹{Number(portfolioDelta).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="metric-col-sub">Day&apos;s intraday shift</span>
          </div>
        </div>
      </section>

      {/* Holdings Section */}
      <section className="editorial-flow-section" aria-label="Holdings Breakdown">
        <div className="flow-section-header">
          <div>
            <span className="flow-kicker">EQUITY POSITIONS</span>
            <h3 className="flow-title">Your Holdings ({holdings.length})</h3>
          </div>
        </div>

        {loading ? (
          <div className="feed-skeleton-wrap">
            <div className="skeleton feed-skeleton-item"></div>
            <div className="skeleton feed-skeleton-item"></div>
          </div>
        ) : holdings.length === 0 ? (
          <div className="editorial-banner-box">
            <div className="banner-icon-wrap">
              <Briefcase size={22} />
            </div>
            <div className="banner-content">
              <h4 className="banner-headline">No positions in your portfolio yet.</h4>
              <p className="banner-subtext">
                Add your Indian stocks to track live profit/loss and gain personalized AI insights.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="btn-editorial btn-editorial-primary"
                style={{ marginTop: '0.85rem' }}
              >
                <Plus size={14} />
                <span>Add First Position</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="editorial-stock-list">
            {holdings.map((h) => {
              const m = marketPrices[h.symbol] || { price: h.averagePrice, change: 0, changePercent: 0 };
              const holdingValue = h.quantity * m.price;
              const holdingCost = h.quantity * h.averagePrice;
              const pnl = holdingValue - holdingCost;
              const pnlPercent = holdingCost > 0 ? (pnl / holdingCost) * 100 : 0;
              const isProfit = pnl >= 0;

              return (
                <div key={h.id} className="editorial-stock-card">
                  <div className="stock-card-top">
                    <div className="stock-identity">
                      <div className="stock-primary-name">{h.symbol}</div>
                      <div className="stock-sub-meta">
                        <span className="mono-number">{h.quantity} shares</span>
                        <span>• Avg: ₹{Number(h.averagePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="stock-valuation text-right">
                      <div className="stock-price mono-number">
                        ₹{Number(holdingValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className={`stock-delta-pill ${isProfit ? 'positive' : 'negative'}`}>
                        {isProfit ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        <span>{isProfit ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({pnlPercent.toFixed(2)}%)</span>
                      </div>
                    </div>
                  </div>

                  <div className="stock-card-metrics-row">
                    <div className="card-submetric-item">
                      <span className="submetric-lbl">Current Price</span>
                      <span className="submetric-val mono-number">
                        ₹{Number(m.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="card-submetric-item">
                      <span className="submetric-lbl">Day Change</span>
                      <span
                        className="submetric-val mono-number"
                        style={{ color: (m.changePercent || 0) >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)' }}
                      >
                        {(m.changePercent || 0) >= 0 ? '+' : ''}{(m.changePercent || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="card-submetric-item">
                      <span className="submetric-lbl">Invested Cost</span>
                      <span className="submetric-val mono-number">
                        ₹{Number(holdingCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="stock-card-actions">
                    <button
                      type="button"
                      className="stock-action-pill-btn"
                      onClick={() => triggerAssistant(`Analyze my holding in ${h.symbol}: bought at ₹${h.averagePrice}, current price ₹${m.price}`)}
                    >
                      <TrendingUp size={12} />
                      <span>Inquire StockSee</span>
                    </button>

                    <button
                      type="button"
                      className="stock-action-pill-btn"
                      onClick={() => handleQuickAlert(h.symbol)}
                      title="Set 2% Price Alert"
                    >
                      <Bell size={12} />
                      <span>Set Alert</span>
                    </button>

                    <button
                      type="button"
                      className="stock-action-pill-btn danger"
                      onClick={() => handleDeleteHolding(h.id, h.symbol)}
                      title="Delete Holding"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Holding Modal Dialog */}
      {isModalOpen && (
        <div className="editorial-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="editorial-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3 className="serif-title modal-headline">Add Asset to Portfolio</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick suggestions */}
            <div className="modal-quick-selection">
              <span className="modal-section-label">Quick Selection:</span>
              <div className="quick-chips-list">
                {popularStockPills.map((p) => (
                  <button
                    key={p.symbol}
                    type="button"
                    onClick={() => setForm({ ...form, symbol: p.symbol, averagePrice: p.defaultPrice.toString() })}
                    className={`quick-chip-btn ${form.symbol === p.symbol ? 'selected' : ''}`}
                  >
                    {p.symbol.replace('.NS', '')}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddHolding} className="modal-form">
              <div className="form-field-group">
                <label className="form-field-label">
                  {t('symbol', language)} (NSE / BSE Symbol)
                </label>
                <input
                  type="text"
                  placeholder="e.g. RELIANCE.NS, TCS.NS"
                  className="editorial-input"
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  required
                />
              </div>

              <div className="form-fields-grid-2">
                <div className="form-field-group">
                  <label className="form-field-label">{t('qty', language)}</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 10"
                    className="editorial-input"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">{t('avgBuyPrice', language)} (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 2500"
                    className="editorial-input"
                    value={form.averagePrice}
                    onChange={(e) => setForm({ ...form, averagePrice: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-editorial btn-editorial-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-editorial btn-editorial-primary">
                  <Plus size={15} />
                  <span>Save Holding</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;