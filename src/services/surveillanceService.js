const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'constants', 'surveillanceLists.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { updated: data.updated || null, asm: data.asm || [], gsm: data.gsm || [] };
  } catch {
    return { updated: null, asm: [], gsm: [] };
  }
}

const plain = (symbol) => String(symbol || '').toUpperCase().replace(/\.(NS|BO)$/, '');

/**
 * Is the stock on an NSE surveillance list? These are the exchange's own lists of stocks it is watching closely.
 * @returns {{ available: boolean, listDate: string|null, listed: boolean, list?: 'ASM'|'GSM', stage?: string|null }}
 */
function check(symbol, lists = load()) {
  const available = lists.asm.length + lists.gsm.length > 0;
  const base = { available, listDate: lists.updated, listed: false };
  if (!available) return base;
  const s = plain(symbol);
  const gsm = lists.gsm.find((e) => plain(e.symbol) === s);
  if (gsm) return { ...base, listed: true, list: 'GSM', stage: gsm.stage ?? null };
  const asm = lists.asm.find((e) => plain(e.symbol) === s);
  if (asm) return { ...base, listed: true, list: 'ASM', stage: asm.stage ?? null };
  return base;
}

module.exports = { check, load, plain };
