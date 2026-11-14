const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const userService = require('../services/userService');
const marketDataService = require('../services/marketDataService');
const sharedNarrativeService = require('../services/sharedNarrativeService');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'dummy_token');

// Persistent storage path for linked users
const DATA_DIR = path.join(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'telegram_users.json');

// In-memory registry of linked user tokens
const linkedTokens = new Map();

function loadTelegramUsers() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf8');
      const data = JSON.parse(content || '{}');
      for (const [k, v] of Object.entries(data)) {
        linkedTokens.set(k, v);
      }
    }
  } catch (err) {
    console.warn('Could not load telegram_users.json:', err.message);
  }
}

function saveTelegramUser(token, userData) {
  linkedTokens.set(token, userData);
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj = {};
    for (const [k, v] of linkedTokens.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist telegram_users.json:', err.message);
  }
}

// Initial load
loadTelegramUsers();

// Start command with Deep Link Token support (/start FINUSER_XXXX)
bot.command('start', async (ctx) => {
  const telegramId = ctx.chat?.id ? ctx.chat.id.toString() : ctx.from.id.toString();
  const username = ctx.from?.username || ctx.from?.first_name || 'User';

  // Check for deep link payload (e.g., /start FINUSER_A1B2C3D)
  let token = ctx.startPayload;
  if (!token && ctx.message?.text) {
    const parts = ctx.message.text.split(' ');
    if (parts.length > 1 && parts[1].startsWith('FINUSER_')) {
      token = parts[1].trim();
    }
  }

  if (token) {
    const record = {
      token,
      chatId: telegramId,
      username,
      firstName: ctx.from?.first_name || '',
      connectedAt: new Date().toISOString(),
    };
    saveTelegramUser(token, record);

    ctx.reply(
      `🎉 *StockSee Companion Connected!*\n\n` +
      `Your Telegram account is now synced with your web session (Token: \`${token}\`).\n\n` +
      `You will receive:\n` +
      `• Morning Market Opening Briefings (8:30 AM IST)\n` +
      `• Real-time Watchlist Price Breakouts & Volatility Alerts\n` +
      `• SEBI-compliant educational market context\n\n` +
      `_Type /price <symbol> or /ask <question> anytime._`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let user = await userService.getUserByTelegramId(telegramId);
  if (!user) {
    user = await userService.createUser(telegramId, 'en');
  }

  ctx.reply('Welcome to StockSee! Please select your preferred language:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'English', callback_data: 'language_en' },
          { text: 'Hindi', callback_data: 'language_hi' },
          { text: 'Gujarati', callback_data: 'language_gu' },
        ],
      ],
    },
  });
});

// Language selection handler
bot.action(/language_(.+)/, async (ctx) => {
  const language = ctx.match[1];
  const telegramId = ctx.from.id.toString();

  await userService.updateUserLanguage(telegramId, language);
  ctx.reply(`Language set to ${language}.`);
});

// Price command
bot.command('price', async (ctx) => {
  const symbol = ctx.message.text.split(' ')[1];
  if (!symbol) {
    ctx.reply('Please provide an Indian symbol, e.g. /price RELIANCE or /price CCCL');
    return;
  }

  try {
    const marketData = await marketDataService.getMarketData(symbol);
    const sym = marketData.currency === 'USD' ? '$' : '₹';
    ctx.reply(
      `📊 *${marketData.symbol}*\n` +
      `Price: ${sym}${marketData.price}\n` +
      `Change: ${marketData.change >= 0 ? '+' : ''}${marketData.changePercent}%\n` +
      `Day Range: ${sym}${marketData.low} — ${sym}${marketData.high}\n\n` +
      `_Note: For institutional scorecards & 4-pillar health ratings, ask in the web app._`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    ctx.reply(`Could not retrieve quote for ${symbol}. Please verify the symbol.`);
  }
});

// Ask command
bot.command('ask', async (ctx) => {
  const question = ctx.message.text.split(' ').slice(1).join(' ');
  if (!question) {
    ctx.reply('Please provide a question, e.g. /ask Why is NIFTY moving today?');
    return;
  }

  try {
    const telegramId = ctx.from.id.toString();
    const user = await userService.getUserByTelegramId(telegramId);
    const lang = user?.language || 'en';
    const askService = require('../services/askService');
    const res = await askService.askQuestion(question, lang);
    ctx.reply(res.answer || 'Market data synthesis complete.', { parse_mode: 'Markdown' });
  } catch (error) {
    ctx.reply('Unable to process query right now. Please try again shortly.');
  }
});

function getTelegramUserByToken(token) {
  if (linkedTokens.has(token)) return linkedTokens.get(token);
  loadTelegramUsers();
  return linkedTokens.get(token) || null;
}

function getAllTelegramUsers() {
  loadTelegramUsers();
  return Array.from(linkedTokens.values());
}

module.exports = bot;
module.exports.getTelegramUserByToken = getTelegramUserByToken;
module.exports.getAllTelegramUsers = getAllTelegramUsers;