/**
 * StockSee - Price Snapshot (educational)
 *
 * Builds a factual summary from REAL market data only: price, returns, 52-week range position
 * and qualitative risk notes. It deliberately contains NO buy/sell/hold ratings, analyst counts,
 * target prices or grades: StockSee is not a SEBI-registered Research Analyst or Investment Adviser,
 * and showing such calls (or inventing them) would be regulated advice / misleading.
 */
const STOCK_RISK_NOTES = require('../constants/stockRiskNotes');

const GENERIC_RISKS = [
  'Broad market volatility and interest-rate cycles can affect all listed companies.',
  'Sector-specific regulation, input costs or demand changes can affect earnings.',
  'Past price movement does not indicate future returns.',
];

const DISCLAIMER =
  'StockSee is a market information and education platform, not a SEBI-registered investment adviser or research analyst. ' +
  'Nothing here is a recommendation to buy, sell or hold any security. Investments in securities are subject to market risks; ' +
  'consult a SEBI-registered investment adviser before making investment decisions.';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

class ScorecardService {
  /**
   * Generate an educational price snapshot from real market data.
   * @param {Object} marketData - Trend data from marketDataService.getTrendData
   * @returns {Object|null} Snapshot payload, or null when there is no real price
   */
  generateScorecard(marketData) {
    if (!marketData || !marketData.symbol || !isNum(marketData.currentPrice)) return null;

    const { currentPrice, fiftyTwoWeekHigh: high52, fiftyTwoWeekLow: low52 } = marketData;
    const notes = STOCK_RISK_NOTES[marketData.symbol.toUpperCase()];

    // Where today's price sits inside the real 52-week range (0% = at the low, 100% = at the high)
    let fiftyTwoWeekRange = null;
    if (isNum(high52) && isNum(low52) && high52 > low52) {
      fiftyTwoWeekRange = {
        high: high52,
        low: low52,
        positionPercent: Math.round(((currentPrice - low52) / (high52 - low52)) * 100),
        belowHighPercent: Number((((high52 - currentPrice) / high52) * 100).toFixed(2)),
        aboveLowPercent: Number((((currentPrice - low52) / low52) * 100).toFixed(2)),
      };
    }

    return {
      type: 'PRICE_SNAPSHOT',
      symbol: marketData.symbol,
      instrumentName: marketData.instrument || marketData.name || marketData.symbol,
      sector: notes?.sector || null,
      currency: marketData.currency || 'INR',
      unit: marketData.unit || null,
      conversionNote: marketData.converted ? `${marketData.conversionNote} (₹${marketData.usdInr} per $1)` : null,
      currentPrice,
      returns: {
        day: marketData.dayChangePercent ?? null,
        week: marketData.weekChangePercent ?? null,
        month: marketData.monthChangePercent ?? null,
      },
      dayRange: isNum(marketData.dayLow) && isNum(marketData.dayHigh)
        ? { low: marketData.dayLow, high: marketData.dayHigh }
        : null,
      fiftyTwoWeekRange,
      riskFactors: notes?.risks || GENERIC_RISKS,
      source: marketData.source || 'Market data provider',
      asOf: marketData.lastUpdated || null,
      stale: Boolean(marketData.stale),
      disclaimer: DISCLAIMER,
    };
  }
}

module.exports = new ScorecardService();
module.exports.DISCLAIMER = DISCLAIMER;
