const marketDataService = require('./marketDataService');
const { dayChangePct } = require('../analytics/indicators');

const round = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n) ? null : Number(n.toFixed(d)));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stddev = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

/** % change over the last n sessions (null when there is not enough history). */
const returnOver = (c, n) => (c.length > n ? round(((c[c.length - 1].close / c[c.length - 1 - n].close) - 1) * 100) : null);

function maxDrawdown(c) {
  let peak = -Infinity;
  let worst = 0;
  for (const { close } of c) {
    peak = Math.max(peak, close);
    worst = Math.min(worst, (close / peak - 1) * 100);
  }
  return round(worst);
}

/** Plain facts about one stock's last year. No scores, no ranking, nothing about the future. */
function describeStock(history) {
  const c = history.candles;
  const changes = c.slice(1).map((_, i) => dayChangePct(c, i + 1)).filter((x) => x !== null);
  const last = c[c.length - 1];
  const high = Math.max(...c.map((x) => x.high));
  const low = Math.min(...c.map((x) => x.low));
  const days = c.slice(1).map((x, i) => ({ date: x.time, change: dayChangePct(c, i + 1) })).filter((d) => d.change !== null);
  const best = days.reduce((a, b) => (b.change > a.change ? b : a));
  const worst = days.reduce((a, b) => (b.change < a.change ? b : a));
  const recent = c.slice(-20).map((x) => x.volume).filter((v) => v > 0);
  const avgVolume = recent.length ? mean(recent) : null;
  const dailyMove = stddev(changes);
  return {
    symbol: history.symbol,
    name: history.name,
    currency: history.currency,
    price: round(last.close),
    asOf: last.time,
    returns: { week: returnOver(c, 5), month: returnOver(c, 21), threeMonths: returnOver(c, 63), sixMonths: returnOver(c, 126), year: returnOver(c, c.length - 1) },
    typicalDailyMovePercent: round(dailyMove, 1),
    yearlySwingPercent: dailyMove === null ? null : round(dailyMove * Math.sqrt(252), 1),
    high52: round(high),
    low52: round(low),
    positionInRangePercent: high > low ? round(((last.close - low) / (high - low)) * 100, 0) : null,
    maxDrawdownPercent: maxDrawdown(c),
    bestDay: { date: best.date, percent: round(best.change) },
    worstDay: { date: worst.date, percent: round(worst.change) },
    avgTradedValueCrore: avgVolume ? round((avgVolume * last.close) / 1e7, 1) : null,
    sessions: c.length,
  };
}

/** How closely two stocks moved day by day (-100 to 100), using the dates both traded. */
function correlation(a, b) {
  const byDate = new Map(b.map((x, i) => [x.time, i]));
  const xs = [];
  const ys = [];
  a.forEach((x, i) => {
    const j = byDate.get(x.time);
    if (i > 0 && j > 0) {
      const ra = dayChangePct(a, i);
      const rb = dayChangePct(b, j);
      if (ra !== null && rb !== null) { xs.push(ra); ys.push(rb); }
    }
  });
  if (xs.length < 30) return null;
  const mx = mean(xs); const my = mean(ys);
  const cov = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0);
  const vx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  const vy = ys.reduce((sum, y) => sum + (y - my) ** 2, 0);
  return vx && vy ? Math.round((cov / Math.sqrt(vx * vy)) * 100) : null;
}

/** Both prices rebased to 100 at the start, one point a week, so the two lines can be drawn together. */
function rebased(c) {
  const step = 5;
  const pts = [];
  for (let i = 0; i < c.length; i += step) pts.push({ date: c[i].time, value: round((c[i].close / c[0].close) * 100, 1) });
  if (pts[pts.length - 1].date !== c[c.length - 1].time) pts.push({ date: c[c.length - 1].time, value: round((c[c.length - 1].close / c[0].close) * 100, 1) });
  return pts;
}

async function compare(symbolA, symbolB) {
  const [ha, hb] = await Promise.all([marketDataService.getHistory(symbolA, '1y'), marketDataService.getHistory(symbolB, '1y')]);
  if (ha.candles.length < 30 || hb.candles.length < 30) {
    const err = new Error('Not enough price history to compare these two');
    err.status = 503;
    throw err;
  }
  return {
    a: { ...describeStock(ha), series: rebased(ha.candles) },
    b: { ...describeStock(hb), series: rebased(hb.candles) },
    movedTogetherPercent: correlation(ha.candles, hb.candles),
    note: 'Facts about the last year only. This is not a ranking and does not say which is better.',
    source: ha.source,
  };
}

module.exports = { compare, describeStock, correlation, maxDrawdown, returnOver };
