const { z } = require('zod');
const { parseSymbolList, clampInt } = require('../lib/symbols');

const symbol = z.string().trim().toUpperCase()
  .regex(/^[A-Z0-9^.=&_-]{1,20}$/, 'Invalid symbol');
const language = z.enum(['en', 'hi', 'gu']);
const symbolParam = z.object({ symbol });
const idParam = z.object({ id: z.coerce.number().int().positive() });

const direction = z.enum(['up', 'down']);
const percent = z.coerce.number().positive().max(50);

/**
 * A smart-alert rule. Old clients that send no `type` get a PRICE_MOVE alert.
 * Output always has { type, symbol, direction, threshold } (unused fields get fixed values).
 */
const alertRule = z.preprocess(
  (v) => ({ type: 'PRICE_MOVE', ...(v && typeof v === 'object' ? v : {}) }),
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('PRICE_MOVE'), symbol, direction, threshold: percent }),
    z.object({ type: z.literal('GAP'), symbol, direction, threshold: percent }),
    z.object({ type: z.literal('VOLUME_SPIKE'), symbol, threshold: z.coerce.number().min(1.5).max(50) }),
    z.object({ type: z.literal('NEW_52W_HIGH'), symbol }),
    z.object({ type: z.literal('NEW_52W_LOW'), symbol }),
  ]),
).transform((r) => {
  if (r.type === 'VOLUME_SPIKE') return { ...r, direction: 'up' };
  if (r.type === 'NEW_52W_HIGH') return { ...r, direction: 'up', threshold: 0 };
  if (r.type === 'NEW_52W_LOW') return { ...r, direction: 'down', threshold: 0 };
  return r;
});

// Market GET queries. Never reject: odd values are tidied (clamped / dropped) so older clients keep working.
const limitQuery = (fallback, max) => z.object({ limit: z.unknown().transform((v) => clampInt(v, { fallback, max })) });
const symbolsQuery = (max) => z.object({ symbols: z.unknown().transform((v) => parseSymbolList(v, max)) });

module.exports = {
  idParam,
  symbolParam,
  unusualQuery: limitQuery(3, 10),
  popularQuery: limitQuery(8, 30),
  insightsQuery: symbolsQuery(Infinity),
  briefingQuery: symbolsQuery(10),
  replayQuery: symbolsQuery(Infinity),
  updatePreferences: z.object({ language }),
  briefQuery: z.object({ language: language.default('en') }),
  watchlistAdd: z.object({ symbol }),
  watchlistImport: z.object({ symbols: z.array(symbol).max(50) }),
  alertRule,
  // Samajh / Hype Check: the browser has already calculated everything. We only ask the AI to explain it.
  samajhExplain: z.object({
    language: language.default('en'),
    claim: z.string().trim().min(3).max(500),
    kind: z.enum(['sip-target', 'sip-return', 'multiple-in-time', 'pct-in-time', 'fd-vs-stocks', 'swp-income', 'guaranteed-return', 'multiple-no-time', 'unverifiable']),
    verdictClass: z.enum(['mathematically_unrealistic', 'misleading', 'incomplete', 'unverifiable', 'possible']),
    facts: z.record(z.string().max(40), z.union([z.number().finite(), z.string().max(160)])).refine((o) => Object.keys(o).length <= 80, { message: 'Too many facts' }),
    shown: z.array(z.string().max(400)).max(40).default([]),
  }),
  alertUpdate: z.object({ active: z.boolean() }),
  // A message, a symbol, or both: a symbol alone checks only the stock's market patterns
  tipCheck: z.object({
    text: z.string().trim().max(2000).default(''),
    symbol: z.preprocess((v) => (v === '' ? undefined : v), symbol.optional()),
    language: language.default('en'),
  }).refine((v) => v.text.length >= 3 || v.symbol, {
    message: 'Paste the tip message or enter a stock symbol',
    path: ['text'],
  }),
  symbolSearch: z.object({
    q: z.string().trim().min(1).max(40),
    limit: z.coerce.number().int().min(1).max(15).default(8),
  }),
  ask: z.object({
    question: z.string().trim().min(1).max(500),
    language: language.default('en'),
    conversationHistory: z.array(z.object({
      role: z.string().max(20).optional(),
      text: z.string().max(2000).optional(),
      symbol: z.string().max(30).nullable().optional(),
      instrument: z.string().max(120).nullable().optional(),
    }).passthrough()).max(20).default([]),
  }),
};
