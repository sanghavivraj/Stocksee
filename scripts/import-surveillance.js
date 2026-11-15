/**
 * Load an NSE surveillance list from the official CSV you downloaded from nseindia.com.
 *   npm run surveillance:import -- asm  ~/Downloads/asm.csv [YYYY-MM-DD]
 *   npm run surveillance:import -- gsm  ~/Downloads/gsm.csv [YYYY-MM-DD]
 * The CSV needs a "Symbol" column; an optional "Stage" column (or a column containing "stage") is kept.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'src', 'constants', 'surveillanceLists.json');
const [, , kind, csvPath, date] = process.argv;

if (!['asm', 'gsm'].includes(kind) || !csvPath) {
  console.error('Usage: npm run surveillance:import -- <asm|gsm> <file.csv> [YYYY-MM-DD]');
  process.exit(1);
}

const split = (line) => line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
const headerIndex = lines.findIndex((l) => /symbol/i.test(l));
if (headerIndex < 0) { console.error('Could not find a "Symbol" column in that file.'); process.exit(1); }
const header = split(lines[headerIndex]).map((h) => h.toLowerCase());
const symCol = header.findIndex((h) => h === 'symbol' || h.includes('symbol'));
const stageCol = header.findIndex((h) => h.includes('stage'));

const entries = lines.slice(headerIndex + 1).map(split)
  .filter((row) => row[symCol] && /^[A-Z0-9&-]{1,20}$/i.test(row[symCol]))
  .map((row) => ({ symbol: row[symCol].toUpperCase(), stage: stageCol >= 0 && row[stageCol] ? row[stageCol] : null }));

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
data[kind] = entries;
data.updated = date || new Date().toISOString().slice(0, 10);
fs.writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Saved ${entries.length} ${kind.toUpperCase()} stocks (list date ${data.updated}).`);
