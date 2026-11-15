const marketDataService = require('./marketDataService');

const MAX_SYMBOLS = 8;
const WINDOW_BARS = 3; // 3 x 5 minutes = 15 minutes

const round = (n, d = 2) => Number(n.toFixed(d));
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/**
 * Facts to mark on the replay line: the biggest 15-minute swing and the busiest 5 minutes by volume.
 * Descriptions of what already happened, nothing more.
 */
function findMoments(bars) {
  const moments = [];
  let best = null;
  for (let i = WINDOW_BARS; i < bars.length; i += 1) {
    const swing = bars[i].percent - bars[i - WINDOW_BARS].percent;
    if (!best || Math.abs(swing) > Math.abs(best.swing)) best = { swing, time: bars[i].time, from: bars[i - WINDOW_BARS].time };
  }
  if (best && Math.abs(best.swing) >= 0.5) {
    moments.push({ type: 'swing', time: best.time, from: best.from, value: round(best.swing) });
  }
  const typical = median(bars.map((b) => b.volume).filter((v) => v > 0));
  if (typical > 0) {
    const busiest = bars.reduce((a, b) => (b.volume > a.volume ? b : a), bars[0]);
    if (busiest.volume >= typical * 3) moments.push({ type: 'volume', time: busiest.time, value: round(busiest.volume / typical, 1) });
  }
  return moments;
}

/** The latest session, 5 minutes at a time, for NIFTY and the given stocks (all as % from the previous close). */
async function getReplay(symbols) {
  const unique = [...new Set(symbols)].slice(0, MAX_SYMBOLS);
  const [benchmark, ...rest] = await Promise.allSettled(
    ['^NSEI', ...unique].map((s) => marketDataService.getIntraday(s)),
  );
  if (benchmark.status !== 'fulfilled') {
    const err = new Error('Intraday data is unavailable right now');
    err.status = 503;
    throw err;
  }
  const series = [benchmark.value, ...rest.filter((r) => r.status === 'fulfilled').map((r) => r.value)]
    .filter((s) => s.date === benchmark.value.date)
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      isBenchmark: s.symbol === '^NSEI',
      previousClose: s.previousClose,
      bars: s.bars.map(({ time, percent, close }) => ({ time, percent, close })),
      moments: s.symbol === '^NSEI' ? [] : findMoments(s.bars),
    }));
  return {
    date: benchmark.value.date,
    times: benchmark.value.bars.map((b) => b.time),
    series,
    source: benchmark.value.source,
  };
}

module.exports = { getReplay, findMoments, MAX_SYMBOLS };
