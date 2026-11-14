import { useEffect, useRef, useState, useContext } from 'react';
import { createChart, createSeriesMarkers, CandlestickSeries, ColorType } from 'lightweight-charts';
import { UserContext } from '../context/UserContext';
import { currencySymbol } from '../utils/formatPrice';

const THEME_COLORS = {
  dark: {
    background: '#171C26',
    textColor: '#9CA3AF',
    gridLines: 'rgba(255, 255, 255, 0.06)',
    candleUp: '#10B981',
    candleDown: '#F87171',
    crosshair: 'rgba(255, 255, 255, 0.25)',
    border: '#27272a',
    title: '#FFFFFF',
  },
  light: {
    background: '#FFFFFF',
    textColor: '#5E4A78',
    gridLines: 'rgba(46, 26, 71, 0.06)',
    candleUp: '#1E8A4F',
    candleDown: '#C73535',
    crosshair: 'rgba(46, 26, 71, 0.25)',
    border: '#E8D9BF',
    title: '#2E1A47',
  },
};

/** How each kind of event is drawn on the chart and described below it. */
export const EVENT_STYLES = {
  dividend: { label: 'Dividend', short: 'D', color: '#2563EB', shape: 'circle', position: 'aboveBar' },
  split: { label: 'Stock split', short: 'S', color: '#7C3AED', shape: 'square', position: 'aboveBar' },
  results: { label: 'Results', short: 'R', color: '#B45309', shape: 'square', position: 'aboveBar' },
  big_move: { label: 'Unusual move', short: '!', color: '#64748B', shape: 'arrowUp', position: 'belowBar' },
  volume_spike: { label: 'Volume spike', short: 'V', color: '#0D9488', shape: 'circle', position: 'belowBar' },
};

export function describeEvent(e, cur) {
  switch (e.type) {
    case 'dividend': return `Dividend of ${cur}${e.value} per share (ex-date)`;
    case 'split': return `Stock split ${e.value}`;
    case 'results': return 'Quarterly results announced';
    case 'big_move': return `Unusually large move: ${e.value >= 0 ? '+' : ''}${e.value}% in one day`;
    case 'volume_spike': return `Volume ${e.value}× its 20-day average`;
    default: return e.type;
  }
}

/**
 * TradingView Lightweight Charts candlestick chart.
 * Renders ONLY real candles passed in `candles`; shows a clear message otherwise.
 * It never generates synthetic price history.
 */
const NO_ITEMS = [];

const StockChart = ({ candles = NO_ITEMS, markers = NO_ITEMS, currency = 'INR', height = 300, symbol = '', loading = false, source }) => {
  const chartContainerRef = useRef(null);
  const { theme } = useContext(UserContext);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  const colors = theme === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;
  const cur = currencySymbol(currency);
  const hasData = Array.isArray(candles) && candles.length > 0;

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || !hasData) return undefined;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.textColor,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: { vertLines: { color: colors.gridLines }, horzLines: { color: colors.gridLines } },
      width: container.clientWidth || 550,
      height,
      timeScale: { borderVisible: false, timeVisible: false },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
      crosshair: {
        vertLine: { color: colors.crosshair, width: 1, style: 3 },
        horzLine: { color: colors.crosshair, width: 1, style: 3 },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      borderUpColor: colors.candleUp,
      borderDownColor: colors.candleDown,
      wickUpColor: colors.candleUp,
      wickDownColor: colors.candleDown,
    });

    series.setData([...candles].sort((a, b) => (a.time > b.time ? 1 : -1)));

    // Event markers (only on days that have a candle)
    const days = new Set(candles.map((c) => c.time));
    createSeriesMarkers(series, markers
      .filter((m) => days.has(m.date) && EVENT_STYLES[m.type])
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((m) => {
        const st = EVENT_STYLES[m.type];
        if (m.type === 'big_move') {
          const up = m.value >= 0;
          return { time: m.date, position: up ? 'belowBar' : 'aboveBar', shape: up ? 'arrowUp' : 'arrowDown', color: up ? colors.candleUp : colors.candleDown, text: `${up ? '+' : ''}${m.value}%` };
        }
        return { time: m.date, position: st.position, shape: st.shape, color: st.color, text: st.short };
      }));
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      const data = param?.time && param.seriesData ? param.seriesData.get(series) : null;
      setHoveredCandle(data ? { time: param.time, ...data } : null);
    });

    const resizeObserver = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles, markers, hasData, height, colors]);

  const hoveredChange = hoveredCandle
    ? ((hoveredCandle.close - hoveredCandle.open) / hoveredCandle.open) * 100
    : null;
  const hoveredUp = (hoveredChange ?? 0) >= 0;
  const hoveredEvents = hoveredCandle ? markers.filter((m) => m.date === hoveredCandle.time) : [];
  const presentTypes = [...new Set(markers.map((m) => m.type))].filter((ty) => EVENT_STYLES[ty]);
  const recent = [...markers].sort((a, b) => (a.date < b.date ? 1 : -1));

  const frameStyle = {
    position: 'relative',
    backgroundColor: colors.background,
    borderRadius: '8px',
    padding: '0.75rem',
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  };

  if (loading || !hasData) {
    return (
      <div style={{ ...frameStyle, height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: colors.textColor, fontSize: '0.85rem' }}>
          {loading ? 'Loading price history…' : 'Price history is unavailable for this instrument right now.'}
        </span>
      </div>
    );
  }

  return (
    <div className="stocksee-tradingview-chart-wrap" style={frameStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono, monospace)',
          color: colors.textColor,
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: colors.title }}>{symbol} • Daily Candles</span>
          {hoveredCandle ? (
            <span style={{ color: hoveredUp ? colors.candleUp : colors.candleDown, fontWeight: 600 }}>
              {hoveredCandle.time} O: {cur}{hoveredCandle.open} H: {cur}{hoveredCandle.high} L: {cur}{hoveredCandle.low} C: {cur}{hoveredCandle.close} ({hoveredUp ? '+' : ''}{hoveredChange.toFixed(2)}%)
            </span>
          ) : (
            <span>Hover candles for OHLC</span>
          )}
        </div>
        {source && <span style={{ fontSize: '0.7rem' }}>Source: {source}</span>}
      </div>

      <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px`, position: 'relative' }} />

      {hoveredEvents.length > 0 && (
        <div style={{ marginTop: '6px', fontSize: '0.78rem', color: colors.title }}>
          {hoveredEvents.map((e) => <div key={e.type + e.date}>● {describeEvent(e, cur)}</div>)}
        </div>
      )}

      {presentTypes.length > 0 && (
        <div className="chart-legend" aria-label="Chart markers">
          {presentTypes.map((ty) => (
            <span key={ty} className="chart-legend-item">
              <span className="legend-swatch" style={{ background: EVENT_STYLES[ty].color }} aria-hidden="true">{EVENT_STYLES[ty].short}</span>
              {EVENT_STYLES[ty].label}
            </span>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="event-list" aria-label="Events in this period">
          {recent.map((e) => (
            <div key={e.type + e.date} className="event-row">
              <span className="event-date">{e.date}</span>
              <span>{describeEvent(e, cur)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StockChart;
