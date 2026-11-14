/**
 * Anonymous visitors — no sign-up, no email, no password.
 *
 * The first time a browser saves something (watchlist, alert, Telegram link, language) we create an
 * anonymous visitor row and give the browser a signed, httpOnly cookie. That cookie is the only way to
 * read or change that visitor's data, so nobody can see or delete anyone else's alerts by guessing IDs.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../lib/prisma');

const cookieOptions = () => ({
  httpOnly: true,       // page JavaScript can't read it (XSS can't steal it)
  sameSite: 'lax',      // not sent on cross-site POST/PATCH/DELETE (CSRF protection)
  secure: config.isProd,
  maxAge: config.visitorCookieDays * 24 * 60 * 60 * 1000,
  path: '/',
});

function setVisitorCookie(res, visitor) {
  const token = jwt.sign({ sub: String(visitor.id) }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.visitorCookieDays}d`,
  });
  res.cookie(config.visitorCookie, token, cookieOptions());
}

/** What the browser is allowed to know about its visitor record (never chat IDs or link tokens). */
function publicVisitor(v) {
  if (!v) return null;
  return {
    language: v.language,
    telegram: v.telegramChatId
      ? { connected: true, username: v.telegramUsername, linkedAt: v.telegramLinkedAt }
      : { connected: false },
  };
}

/** Sets req.visitor from the cookie, or null for a browser that hasn't saved anything yet. */
async function identifyVisitor(req, _res, next) {
  req.visitor = null;
  const token = req.cookies?.[config.visitorCookie];
  if (!token) return next();
  try {
    const { sub } = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.visitor = await prisma.user.findUnique({ where: { id: Number(sub) } });
  } catch {
    req.visitor = null; // invalid/forged/expired cookie: treat as a new browser
  }
  return next();
}

/** For routes that save data: create the anonymous visitor on first use, and refresh the cookie. */
async function ensureVisitor(req, res, next) {
  try {
    if (!req.visitor) {
      const language = ['en', 'hi', 'gu'].includes(req.body?.language) ? req.body.language : undefined;
      req.visitor = await prisma.user.create({ data: { language } });
    }
    setVisitorCookie(res, req.visitor); // rolling: stays valid while the visitor is active
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { identifyVisitor, ensureVisitor, publicVisitor };
