const config = require('../config');

/** Headers for an API that only returns JSON: nothing here should ever be framed, sniffed or scripted. */
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  });
  if (config.isProd) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

/** CORS: only our own frontend origin(s), with cookies. */
function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

module.exports = { securityHeaders, cors };
