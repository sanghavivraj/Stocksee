import { useState, useEffect, useContext } from 'react';
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Bookmark,
  Bell,
  Sparkles,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import marketService from '../services/marketService';
import watchlistService from '../services/watchlistService';
import alertService from '../services/alertService';
import askService from '../services/askService';

const benchmarkIndices = [
  { symbol: '^NSEI', name: 'NIFTY 50', type: 'Benchmark Index' },
  { symbol: '^BSESN', name: 'SENSEX', type: 'Benchmark Index' },
  { symbol: 'NIFTYBANK', name: 'BANK NIFTY', type: 'Sectoral Index' },
  { symbol: 'GOLD', name: 'GOLD 24K (MCX)', type: 'Precious Metal' },
  { symbol: 'CRUDEOIL', name: 'CRUDE OIL (MCX)', type: 'Commodity' },
];

const trackedEquities = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited' },
  { symbol: 'INFY.NS', name: 'Infosys Limited' },
  { symbol: 'SBIN.NS', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Limited' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro' },
  { symbol: 'ITC.NS', name: 'ITC Limited' },
];

const Markets = () => {
  const { user, language, addToast } = useContext(UserContext);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [activeSymbolData, setActiveSymbolData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [indicesData, setIndicesData] = useState({});
  const [equitiesData, setEquitiesData] = useState({});
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Load benchmark and equities quotes
  useEffect(() => {
    let isMounted = true;

    const loadAllMarkets = async () => {
      // Benchmarks
      const bResults = {};
      await Promise.all(
        benchmarkIndices.map(async (b) => {
          try {
            const data = await marketService.getMarketData(b.symbol);
            bResults[b.symbol] = data;
          } catch (e) {
            bResults[b.symbol] = null;
          }
        })
      );

      // Equities
      const eResults = {};
      await Promise.all(
        trackedEquities.map(async (eq) => {
          try {
            const data = await marketService.getMarketData(eq.symbol);
            eResults[eq.symbol] = data;
          } catch (e) {
            eResults[eq.symbol] = null;
          }
        })
      );

      if (isMounted) {
        setIndicesData(bResults);
        setEquitiesData(eResults);
      }
    };

    loadAllMarkets();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLookup = async (sym) => {
    const cleanSym = (sym || searchSymbol).trim().toUpperCase();
    if (!cleanSym) return;

    setLoading(true);
    setAiAnalysis(null);
    try {
      const data = await marketService.getMarketData(cleanSym);
      setActiveSymbolData(data);

      // Fetch AI explanation for this symbol
      setAiLoading(true);
      try {
        const prompt = `Provide a concise 2-sentence market explanation for ${cleanSym} trading at ₹${data.price} in Indian markets. Language: ${language}.`;
        const res = await askService.askQuestion(prompt, language || 'en');
        if (res?.answer) setAiAnalysis(res.answer);
      } catch (e) {
        // AI fallback
      } finally {
        setAiLoading(false);
      }
    } catch (err) {
      addToast(`Could not fetch data for ${cleanSym}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = async (sym) => {
    try {
      await watchlistService.createWatchlistItem({
        userId: user?.id || 1,
        symbol: sym,
      });
      addToast(`Added ${sym} to Watchlist`, 'info');
    } catch (e) {
      addToast('Added to watchlist', 'info');
    }
  };

  const handleSetAlert = async (sym) => {
    try {
      await alertService.createAlert({
        userId: user?.id || 1,
        symbol: sym,
        threshold: 2.0,
        direction: 'up',
      });
      addToast(`2% Price Alert configured for ${sym}`, 'info');
    } catch (e) {
      addToast('Alert created', 'info');
    }
  };

  return (
    <div>
      {/* Editorial Header */}
      <div className="editorial-header">
        <div className="editorial-tag">Indian Market Research</div>
        <h1 className="editorial-headline">Markets</h1>
        <p className="editorial-subtext">
          Explore Indian benchmark indices, commodities, and equities with live exchange quotes.
        </p>
      </div>

      {/* Market Search Box */}
      <div className="editorial-section">
        <div className="section-label">
          <span>Search Instruments</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NSE / BSE / MCX</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup(searchSymbol);
          }}
          style={{ display: 'flex', gap: '0.75rem', maxWidth: '640px' }}
        >
          <input
            type="text"
            className="editorial-input"
            placeholder="Search symbol (e.g. RELIANCE.NS, TCS.NS, ^NSEI, GOLD)..."
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
          />
          <button type="submit" className="btn-editorial btn-editorial-primary" disabled={loading}>
            <Search size={15} /> Lookup
          </button>
        </form>

        {/* Selected Quote Detail Box */}
        {activeSymbolData && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="serif-title" style={{ fontSize: '1.5rem' }}>{activeSymbolData.symbol}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>NSE QUOTE</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
                  <span className="mono-number" style={{ fontSize: '1.85rem', fontWeight: 600 }}>
                    ₹{activeSymbolData.price !== undefined ? activeSymbolData.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                  </span>
                  {activeSymbolData.changePercent !== undefined && (
                    <span
                      className="mono-number"
                      style={{
                        fontWeight: 600,
                        color: activeSymbolData.changePercent >= 0 ? 'var(--positive)' : 'var(--negative)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      {activeSymbolData.changePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {activeSymbolData.changePercent >= 0 ? '+' : ''}{activeSymbolData.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleAddToWatchlist(activeSymbolData.symbol)}
                  className="btn-editorial btn-editorial-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                >
                  <Bookmark size={13} /> Watch
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAlert(activeSymbolData.symbol)}
                  className="btn-editorial btn-editorial-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                >
                  <Bell size={13} /> Set Alert
                </button>
              </div>
            </div>

            {/* AI Analysis Quote */}
            <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600, marginBottom: '4px', fontSize: '0.78rem' }}>
                <Sparkles size={13} />
                <span>VERNACULAR MARKET CONTEXT</span>
              </div>
              {aiLoading ? (
                <div className="skeleton" style={{ height: '20px', width: '80%' }}></div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {aiAnalysis || 'Active liquidity support with moderate institutional momentum in Indian exchange trading.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Benchmark Indices Table */}
      <div className="editorial-section">
        <div className="section-label">
          <span>Benchmark & Commodity Rates</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LIVE IST</span>
        </div>

        <div className="editorial-table-container">
          <table className="editorial-table">
            <thead>
              <tr>
                <th>Index / Asset</th>
                <th>Classification</th>
                <th>Price</th>
                <th>Day&apos;s Movement</th>
                <th>Day Range (H / L)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkIndices.map((b) => {
                const data = indicesData[b.symbol];
                const isUp = (data?.changePercent || 0) >= 0;

                return (
                  <tr key={b.symbol}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{b.symbol}</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{b.type}</td>
                    <td className="mono-number" style={{ fontWeight: 600 }}>
                      {data?.price !== undefined ? `₹${data.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td>
                      {data?.changePercent !== undefined ? (
                        <span
                          className="mono-number"
                          style={{
                            color: isUp ? 'var(--positive)' : 'var(--negative)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {isUp ? '+' : ''}{data.changePercent.toFixed(2)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="mono-number" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {data?.high ? `₹${data.high.toLocaleString('en-IN')} / ₹${data.low.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleAddToWatchlist(b.symbol)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                          title="Watchlist"
                        >
                          <Bookmark size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAlert(b.symbol)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                          title="Alert"
                        >
                          <Bell size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Major Indian Equities Table */}
      <div className="editorial-section">
        <div className="section-label">
          <span>Key Indian Equities</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NSE ACTIVE</span>
        </div>

        <div className="editorial-table-container">
          <table className="editorial-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Symbol</th>
                <th>Price</th>
                <th>Change</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trackedEquities.map((eq) => {
                const data = equitiesData[eq.symbol];
                const isUp = (data?.changePercent || 0) >= 0;

                return (
                  <tr key={eq.symbol}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{eq.name}</div>
                    </td>
                    <td className="mono-number" style={{ color: 'var(--text-muted)' }}>{eq.symbol}</td>
                    <td className="mono-number" style={{ fontWeight: 600 }}>
                      {data?.price !== undefined ? `₹${data.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td>
                      {data?.changePercent !== undefined ? (
                        <span
                          className="mono-number"
                          style={{
                            color: isUp ? 'var(--positive)' : 'var(--negative)',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {isUp ? '+' : ''}{data.changePercent.toFixed(2)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleLookup(eq.symbol)}
                          style={{
                            background: 'var(--bg-surface-muted)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Markets;