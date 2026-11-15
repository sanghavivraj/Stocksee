/**
 * Thrown when no real market data can be obtained.
 * We never invent prices: callers must show "unavailable" instead.
 */
class MarketDataUnavailableError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'MarketDataUnavailableError';
    this.status = status;
  }
}

module.exports = { MarketDataUnavailableError };
