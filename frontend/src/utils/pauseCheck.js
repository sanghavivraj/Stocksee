/**
 * "Pause before you act": a stock that moved a lot in one day is when people rush, so we show what to check first.
 * Facts only: it names the move and the checks, never says to buy, sell or wait for a price.
 */
export const PAUSE_THRESHOLD_PERCENT = 10;

export function needsPause(dayChangePercent, threshold = PAUSE_THRESHOLD_PERCENT) {
  const n = Number(dayChangePercent);
  return dayChangePercent !== null && dayChangePercent !== undefined && Number.isFinite(n) && Math.abs(n) >= threshold;
}
