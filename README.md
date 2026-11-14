# StockSee — Vernacular Market Intelligence & Watchlist

## Overview

StockSee is a mobile-first financial companion for Indian retail investors that turns market noise around Gold, Crude, Stocks, and relevant Indian market context into simple, personalized, native-language insights.

## Architecture

- **Runtime**: Node.js LTS
- **Backend**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Telegram**: Telegraf
- **AI**: Google Gemini (with Groq fallback)
- **Market Data**: yahoo-finance2 (development), Upstox/Angel One (production)
- **Scheduling**: node-cron
- **Caching**: Redis
- **Monitoring**: Sentry

## Setup

1. Install dependencies:

```bash
npm install
cd frontend && npm install && cd ..
```

2. Start PostgreSQL (e.g. Postgres.app) and create two databases: `stocksee` and `stocksee_test`.

3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `TEST_DATABASE_URL` and `JWT_SECRET`.

4. Create the tables:

```bash
npm run db:migrate      # development (creates/applies migrations)
npm run db:deploy       # production (applies committed migrations only)
```

5. Run the API and the web app:

```bash
npm run dev                  # API on http://localhost:3000
cd frontend && npm run dev   # web app on http://localhost:5173 (proxies /api to :3000)
```

## Features

- **Tip Check** (`/tip-check`, Telegram `/check` or just forward a message): scores a forwarded stock tip for pump-and-dump
  warning signs — red-flag wording in English / Hindi / Gujarati / Hinglish plus real market patterns (volume spike vs
  20-day average, 1-month run-up, repeated ~5% days, penny / micro-cap). Gives LOW / MEDIUM / HIGH with reasons and SEBI resources.
- **Chart events**: real daily candles with markers for dividends, splits, results dates (when available), unusually large
  moves (vs the stock's own volatility) and volume spikes, plus an event list.
- **Smart alerts**: price move, opening gap, volume spike, new 52-week high / low. Before saving, a **backtest** shows how
  often the same rule would have fired over the last 12 months. Live alerts and backtests share one rule engine
  (`src/analytics/indicators.js`).
- **Grounded AI answers**: Gemini → Groq → template. Every AI answer is checked before it is shown: all numbers must come
  from the live data, no buy/sell/target language, correct language script; otherwise the verified template answer is used.
  "Why is X moving?" answers compare with NIFTY, today's volume and recent events.

## No sign-up (watch-only)

StockSee is for watching markets only: there is no sign-up, no login, and no buying/selling or portfolio tracking.
The first time a browser saves something (watchlist, alert, Telegram, language), the server creates an anonymous
"visitor" and gives that browser a random, httpOnly cookie. That cookie is the only way to read or change that
browser's watchlist and alerts, so nobody can see or delete anyone else's data. Clearing cookies starts fresh.

## Telegram Bot

1. Create a bot with [@BotFather](https://t.me/BotFather) and put its token in `TELEGRAM_BOT_TOKEN`.
2. In the web app: **Settings → Connect Telegram**. This opens the bot with a one-time link (valid 15 minutes); tap **Start**.

Commands: `/price <symbol>`, `/ask <question>`, `/language`, `/unlink`, `/help`.

Scheduled messages (Asia/Kolkata time), sent only to users who connected Telegram:

- Morning brief: 8:30 AM, Monday–Friday (market overview + your watchlist)
- Weekly digest: 9:00 AM Monday (your watchlist's 1-week change)
- Price alerts: checked every 2 minutes, 9:00–15:59 Monday–Friday; each alert fires at most once per day

> Run the scheduled jobs on a single server instance; with several instances every instance would send them.

## AI Configuration

Configure the AI providers by setting the appropriate environment variables for Google Gemini and Groq.

## Market Data Configuration

For development, the application uses yahoo-finance2. For production, configure Upstox or Angel One SmartAPI.

## Supported Languages

- English
- Hindi
- Gujarati

## Compliance

StockSee is informational/educational and is not a SEBI-registered investment adviser or research analyst. It never shows buy/sell/hold ratings, analyst targets or invented prices; when real data is unavailable it says so.

## Testing

Tests run against the `TEST_DATABASE_URL` database (Postgres must be running):

```bash
npm test
```

Run a scheduled Telegram job right now (preview with `--dry-run`, no bot token needed):

```bash
npm run job morning -- --dry-run
npm run job alerts  -- --dry-run
npm run job weekly  -- --dry-run
```

## Linting

```bash
cd frontend && npm run lint
```