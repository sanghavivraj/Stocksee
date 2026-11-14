const { ZodError } = require('zod');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validate req[part] with a zod schema and replace it with the parsed (typed, trimmed) value. */
const validate = (schema, part = 'body') => (req, _res, next) => {
  req[part] = schema.parse(req[part]);
  next();
};

const notFound = (req, _res, next) => next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Invalid request',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  // Prisma: record not found / unique constraint
  if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' });
  if (err.code === 'P2002') return res.status(409).json({ error: 'Already exists' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });

  // Errors with an explicit status were thrown on purpose and carry a user-safe message.
  // Anything else is unexpected: log it, and never leak internal details to clients.
  if (!err.status) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  return res.status(err.status).json({ error: err.message });
}

/**
 * Reject symbols that are not real listed instruments. `pick(req)` returns the symbol(s) to check.
 * Runs before anything is saved (and before an anonymous visitor is created).
 */
const requireKnownSymbols = (pick, isValid = (s) => require('../services/symbolSearchService').isValidSymbol(s)) =>
  asyncHandler(async (req, _res, next) => {
    const symbols = [].concat(pick(req) || []);
    const results = await Promise.all(symbols.map((s) => isValid(s)));
    const bad = symbols.filter((_, i) => !results[i]);
    if (bad.length) {
      throw new HttpError(400, `"${bad[0]}" is not a listed stock. Please pick a stock from the suggestions.`);
    }
    next();
  });

/** Bulk variant: silently drop unknown symbols (e.g. junk saved by an older version) and keep the real ones. */
const keepKnownSymbols = (isValid = (s) => require('../services/symbolSearchService').isValidSymbol(s)) =>
  asyncHandler(async (req, _res, next) => {
    const symbols = req.body.symbols;
    const ok = await Promise.all(symbols.map((s) => isValid(s)));
    req.body.symbols = symbols.filter((_, i) => ok[i]);
    next();
  });

module.exports = { HttpError, asyncHandler, validate, notFound, errorHandler, requireKnownSymbols, keepKnownSymbols };
