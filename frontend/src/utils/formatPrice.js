/**
 * Currency-aware price formatting. Returns '—' when there is no real value,
 * so the UI never shows a made-up number.
 */
export const currencySymbol = (currency) => (currency === 'USD' ? '$' : '₹');

export const hasValue = (v) => typeof v === 'number' && Number.isFinite(v);

export const formatPrice = (value, currency = 'INR', options = { minimumFractionDigits: 2, maximumFractionDigits: 2 }) =>
  hasValue(value) ? `${currencySymbol(currency)}${value.toLocaleString('en-IN', options)}` : '—';

export const formatPercent = (value) =>
  hasValue(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '—';
