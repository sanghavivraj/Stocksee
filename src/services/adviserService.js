/**
 * "Is the sender a SEBI-registered adviser?" for Tip Check.
 *
 * What it does with facts only:
 *  - finds SEBI registration numbers quoted in the message (INA = investment adviser, INH = research analyst,
 *    INZ = stock broker; nine digits after the letters),
 *  - notices when the message says "SEBI registered" but quotes no number,
 *  - compares a number with a registry file the owner loaded from the official source
 *    (`npm run advisers:import`). With no file loaded it says "not checked" and never guesses.
 *
 * A real number can be copied by a fraudster, so a match only shows the registered NAME to compare with the sender.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'constants', 'registeredAdvisers.json');

// Official places to look a number up (SEBI's intermediary portal says adviser / analyst registration is now handled by BSE).
const VERIFY_LINKS = {
  sebi: 'https://siportal.sebi.gov.in/intermediary/index.html',
  bse: 'https://www.bseindia.com/static/iara/IA_enlistandpost.aspx',
};

const TYPE_BY_PREFIX = { INA: 'adviser', INH: 'analyst', INZ: 'broker' };
const REG_NUMBER = /\b(IN[A-Z])[\s-]?(\d{9})\b/gi;
const CLAIMS_REGISTERED = /\bsebi[\s-]*(registered|regd?\.?|reg\.?|approved|certified|authori[sz]ed|licen[sc]ed)\b|सेबी\s*(रजिस्टर्ड|पंजीकृत|मान्य)|સેબી\s*(રજિસ્ટર્ડ|નોંધાયેલ|માન્ય)/i;

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { updated: data.updated || null, entries: Array.isArray(data.entries) ? data.entries : [] };
  } catch {
    return { updated: null, entries: [] };
  }
}

const normalise = (n) => String(n || '').toUpperCase().replace(/[\s-]/g, '');

/** Registration numbers quoted in the text, e.g. [{ number: 'INH000012345', type: 'analyst' }]. */
function extractRegistrations(text = '') {
  const seen = new Set();
  const out = [];
  for (const m of String(text).matchAll(REG_NUMBER)) {
    const number = `${m[1].toUpperCase()}${m[2]}`;
    if (seen.has(number)) continue;
    seen.add(number);
    out.push({ number, type: TYPE_BY_PREFIX[m[1].toUpperCase()] || 'other' });
  }
  return out;
}

const claimsRegistered = (text = '') => CLAIMS_REGISTERED.test(String(text));

/**
 * @returns {{ listAvailable: boolean, listDate: string|null, claimsRegistered: boolean,
 *             numbers: Array<{number, type, listed: boolean|null, name?: string, status?: string|null, validTill?: string|null}>,
 *             links: typeof VERIFY_LINKS }}
 */
function check(text, registry = load()) {
  const listAvailable = registry.entries.length > 0;
  const numbers = extractRegistrations(text).map((reg) => {
    if (!listAvailable) return { ...reg, listed: null };
    const hit = registry.entries.find((e) => normalise(e.number) === reg.number);
    return hit
      ? { ...reg, listed: true, name: hit.name || null, status: hit.status || null, validTill: hit.validTill || null }
      : { ...reg, listed: false };
  });
  return { listAvailable, listDate: registry.updated, claimsRegistered: claimsRegistered(text), numbers, links: VERIFY_LINKS };
}

/** Warning signs from the sender check (same shape as the other Tip Check signals). */
function signals(adviser) {
  const out = [];
  if (adviser.claimsRegistered && adviser.numbers.length === 0) out.push({ code: 'sebi_claim_no_number', weight: 2, kind: 'message' });
  const wrongType = adviser.numbers.find((n) => n.type !== 'adviser' && n.type !== 'analyst');
  if (wrongType) out.push({ code: 'registration_wrong_type', weight: 2, value: wrongType.number.slice(0, 3), kind: 'message' });
  const notListed = adviser.numbers.find((n) => (n.type === 'adviser' || n.type === 'analyst') && n.listed === false);
  if (notListed) out.push({ code: 'registration_not_listed', weight: 3, value: notListed.number, kind: 'message' });
  return out;
}

// ---- Loading a registry from the official CSV ----

function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) { cells.push(cur.trim()); cur = ''; } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** Reads a CSV with a registration-number column and a name column (validity / status columns are kept when present). */
function parseRegistryCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  const headerIndex = lines.findIndex((l) => /regist/i.test(l) && /name/i.test(l));
  if (headerIndex < 0) throw new Error('Could not find a header row with a registration number column and a name column.');
  const header = splitCsvLine(lines[headerIndex]).map((h) => h.toLowerCase());
  const col = (re) => header.findIndex((h) => re.test(h));
  const numCol = col(/regist.*(no|num)/);
  const nameCol = col(/name/);
  const validCol = col(/valid|expiry|till|upto/);
  const statusCol = col(/status/);
  if (numCol < 0 || nameCol < 0) throw new Error('The file needs a "Registration No." column and a "Name" column.');
  const entries = lines.slice(headerIndex + 1).map(splitCsvLine)
    .map((row) => ({
      number: normalise(row[numCol]),
      name: row[nameCol] || null,
      validTill: validCol >= 0 && row[validCol] ? row[validCol] : null,
      status: statusCol >= 0 && row[statusCol] ? row[statusCol] : null,
    }))
    .filter((e) => /^IN[A-Z]\d{9}$/.test(e.number));
  return entries;
}

module.exports = { check, signals, load, extractRegistrations, claimsRegistered, parseRegistryCsv, VERIFY_LINKS };
