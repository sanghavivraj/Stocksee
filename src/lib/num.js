/** Round to `digits` decimals. Missing or non-numeric input (null, undefined, NaN) gives null, never NaN. */
function round(n, digits = 2) {
  return n === null || n === undefined || Number.isNaN(n) ? null : Number(n.toFixed(digits));
}

module.exports = { round };
