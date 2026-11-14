/**
 * StockSee - Telegram Bot Companion (Telegraf, long polling)
 * - Account linking via one-time deep-link tokens (see telegramLinkService)
 * - /price, /ask, /language, /unlink, /help
 * - sendMessage() used by the scheduled jobs (morning brief, weekly digest, price alerts)
 */
const { Telegraf, Markup } = require('telegraf');
const config = require('../config');
const telegramLinkService = require('./telegramLinkService');
const userService = require('./userService');

const LANGUAGES = { en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી' };
const DISCLAIMER = '_StockSee is not a SEBI-registered adviser. Information only, not investment advice._';

let bot = null;
let botUsername = null;

/**
 * Send a message to a chat. Tries Markdown first, falls back to plain text if Telegram rejects the formatting.
 * @returns {Promise<boolean>} whether the message was delivered
 */
// Telegram's (legacy) Markdown uses *bold*, not **bold**; convert so AI/template text renders correctly
const toTelegramMarkdown = (text) => String(text).replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^#{1,6}\s+/gm, '');

async function sendMessage(chatId, rawText) {
  const text = toTelegramMarkdown(rawText);
  if (!bot) {
    console.warn('[TelegramBot] Not configured; message not sent.');
    return false;
  }
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    return true;
  } catch (err) {
    if (err?.response?.error_code === 400) {
      await bot.telegram.sendMessage(chatId, text.replace(/[*_`]/g, ''), { disable_web_page_preview: true });
      return true;
    }
    throw err;
  }
}

async function replySafe(ctx, rawText, extra = {}) {
  const text = toTelegramMarkdown(rawText);
  try {
    return await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
  } catch {
    return ctx.reply(text.replace(/[*_`]/g, ''), extra);
  }
}

function registerHandlers(b) {
  b.catch((err, ctx) => {
    console.error(`[TelegramBot] Error handling "${ctx?.updateType}":`, err.message);
  });

  // /start [link_token]
  b.start(async (ctx) => {
    const token = ctx.payload?.trim();
    if (token) {
      const user = await telegramLinkService.consumeLinkToken(token, {
        chatId: ctx.chat.id,
        username: ctx.from?.username,
      });
      if (!user) {
        return replySafe(ctx, '⚠️ This link has expired or was already used.\nOpen *Settings → Connect Telegram* on the StockSee website to get a new one.');
      }
      return replySafe(ctx,
        `🎉 *Connected!* This chat is now linked to StockSee on your browser.\n\n` +
        'You will receive:\n' +
        '📊 Morning market brief (8:30 AM IST, weekdays)\n' +
        '⚡ Your price alerts\n' +
        '🗓 Weekly watchlist digest (Mondays)\n\n' +
        `Try /price RELIANCE or /ask How is NIFTY doing today?\n\n${DISCLAIMER}`);
    }

    return replySafe(ctx,
      '🇮🇳 *Welcome to StockSee* — market information in your language.\n\n' +
      'To get alerts and the morning brief, open the StockSee website → *Settings* → *Connect Telegram*.\n\n' +
      '*Commands*\n/price <symbol> — latest price\n/ask <question> — ask about markets\n/language — change language\n/help — all commands\n\n' +
      DISCLAIMER);
  });

  b.command('price', async (ctx) => {
    const symbol = ctx.payload?.trim().split(/\s+/)[0]?.toUpperCase();
    if (!symbol) return ctx.reply('Please give a symbol, e.g. /price RELIANCE');

    const marketDataService = require('./marketDataService');
    try {
      const data = await marketDataService.getMarketData(symbol);
      const cur = data.currency === 'USD' ? '$' : '₹';
      const arrow = (data.changePercent || 0) >= 0 ? '🟢 +' : '🔴 ';
      return replySafe(ctx,
        `📊 *${data.name || data.symbol}* (${data.symbol})\n` +
        `*Price:* ${cur}${Number(data.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${data.unit ? ` ${data.unit}` : ''}${data.stale ? ' _(last known, may be outdated)_' : ''}\n` +
        `*Change:* ${arrow}${data.changePercent}%\n` +
        `*Day range:* ${cur}${data.low} — ${cur}${data.high}\n` +
        (data.converted ? `_International USD price converted at ₹${data.usdInr}/$1. MCX and jeweller prices differ (duty, GST, premiums)._\n` : '') +
        `\n${DISCLAIMER}`);
    } catch {
      return ctx.reply(`Could not get a live price for "${symbol}". Please check the symbol and try again.`);
    }
  });

  b.command('ask', async (ctx) => {
    const question = ctx.payload?.trim();
    if (!question) return ctx.reply('Please add a question, e.g. /ask Why is NIFTY moving today?');

    const askService = require('./askService');
    const user = await telegramLinkService.findByChatId(ctx.chat.id);
    try {
      const res = await askService.askQuestion(question, user?.language || 'en');
      return replySafe(ctx, res.answer || 'No answer available right now.');
    } catch {
      return ctx.reply('Unable to answer right now. Please try again shortly.');
    }
  });

  b.command('language', async (ctx) => {
    const user = await telegramLinkService.findByChatId(ctx.chat.id);
    if (!user) return ctx.reply('Connect your StockSee account first (website → Settings → Connect Telegram).');
    return ctx.reply('Choose your language:', Markup.inlineKeyboard(
      Object.entries(LANGUAGES).map(([code, label]) => Markup.button.callback(label, `lang_${code}`)),
    ));
  });

  b.action(/^lang_(en|hi|gu)$/, async (ctx) => {
    const user = await telegramLinkService.findByChatId(ctx.chat.id);
    await ctx.answerCbQuery();
    if (!user) return ctx.reply('Connect your StockSee account first.');
    await userService.updateProfile(user.id, { language: ctx.match[1] });
    return ctx.reply(`Language set to ${LANGUAGES[ctx.match[1]]}.`);
  });

  b.command('unlink', async (ctx) => {
    const user = await telegramLinkService.findByChatId(ctx.chat.id);
    if (!user) return ctx.reply('This chat is not linked to a StockSee account.');
    await telegramLinkService.unlink(user.id);
    return ctx.reply('Disconnected. You will no longer receive StockSee messages here.');
  });

  // ---- Tip Check: /check <tip>, or forward any tip message to the bot
  const runTipCheck = async (ctx, text) => {
    const tipCheckService = require('./tipCheckService');
    const user = await telegramLinkService.findByChatId(ctx.chat.id);
    const r = await tipCheckService.check({ text, language: user?.language || 'en' });
    const icon = { HIGH: '🔴', MEDIUM: '🟠', LOW: '🟢' }[r.level];
    const lines = [
      `🛡️ *Tip Check* ${icon} *${r.level} risk*`,
      r.instrument ? `Stock: ${r.instrument.name} (${r.instrument.symbol})` : null,
      r.summary,
      '',
      ...r.reasons.slice(0, 6).map((x) => `• ${x.text}`),
      ...r.notes.map((n) => `_${n}_`),
      '',
      ...r.guidance.map((g) => `✅ ${g}`),
      '',
      DISCLAIMER,
    ].filter((l) => l !== null);
    return replySafe(ctx, lines.join('\n'));
  };

  b.command('check', async (ctx) => {
    const text = ctx.payload?.trim() || ctx.message?.reply_to_message?.text;
    if (!text) return ctx.reply('Send /check followed by the tip text, reply /check to a message, or just forward the tip to me.');
    return runTipCheck(ctx, text);
  });

  // Forwarded messages are checked automatically; other plain text gets a short hint
  b.on('message', async (ctx, next) => {
    const msg = ctx.message;
    const text = msg?.text || msg?.caption;
    if (!text || text.startsWith('/')) return next();
    if (msg.forward_origin || msg.forward_date) return runTipCheck(ctx, text);
    const { countRedFlags } = require('./tipCheckService');
    if (countRedFlags(text) >= 2) return runTipCheck(ctx, text);
    return ctx.reply('Ask me with /ask <question>, check a tip with /check <text> (or forward it), or get a price with /price <symbol>.');
  });

  b.command('help', (ctx) => ctx.reply(
    'StockSee commands:\n\n' +
    '/price <symbol> — latest price\n' +
    '/ask <question> — ask about markets\n' +
    '/check <tip> — check a stock tip for pump-and-dump warning signs (or just forward the tip)\n' +
    '/language — change language\n' +
    '/unlink — disconnect this chat\n' +
    '/help — this menu',
  ));
}

if (config.telegramToken) {
  bot = new Telegraf(config.telegramToken);
  registerHandlers(bot);
}

function isEnabled() {
  return Boolean(bot);
}

/** Bot username for t.me deep links (e.g. "StockSeeBot"). */
async function getBotUsername() {
  if (!bot) return null;
  if (!botUsername) {
    const me = await bot.telegram.getMe();
    botUsername = me.username;
  }
  return botUsername;
}

/** Start long polling. Never throws: a bot failure must not take the API down. */
async function launchTelegramBot() {
  if (!bot) {
    console.log('[TelegramBot] Skipped: TELEGRAM_BOT_TOKEN is not configured.');
    return;
  }
  try {
    // Webhooks and long polling conflict; clear any webhook left by another environment.
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    bot.launch({ dropPendingUpdates: true })
      .catch((err) => console.error('[TelegramBot] Launch error:', err.message));
    console.log('[TelegramBot] Long polling started');
  } catch (err) {
    console.error('[TelegramBot] Init error:', err.message);
  }
}

function stopTelegramBot(signal = 'SIGTERM') {
  try {
    bot?.stop(signal);
  } catch {
    // already stopped
  }
}

module.exports = {
  isEnabled,
  getBotUsername,
  sendMessage,
  launchTelegramBot,
  stopTelegramBot,
  registerHandlers, // exported for tests
};
