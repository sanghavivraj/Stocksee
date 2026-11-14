#!/usr/bin/env node
/**
 * Refresh the bundled list of NSE-listed companies used by the search/autocomplete.
 * Source: NSE's public "Securities available for equity segment" file (EQUITY_L.csv).
 *
 *   npm run symbols:update            # download from NSE
 *   npm run symbols:update -- file.csv  # or convert a CSV you downloaded yourself
 */
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const OUT = path.join(__dirname, '..', 'src', 'constants', 'nseEquities.json');

/** Minimal CSV line parser (handles quoted fields with commas). */
function parseLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

async function main() {
  const file = process.argv[2];
  const csv = file
    ? fs.readFileSync(file, 'utf8')
    : await (await fetch(SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' }, signal: AbortSignal.timeout(20000) })).text();

  const [header, ...lines] = csv.trim().split(/\r?\n/);
  if (!/^SYMBOL,NAME OF COMPANY/i.test(header)) throw new Error('Unexpected file format (did NSE block the download?)');

  const rows = lines
    .map(parseLine)
    .filter(([symbol, name]) => symbol && name)
    .map(([symbol, name]) => [symbol.toUpperCase(), name.replace(/\s+/g, ' ')])
    .sort((a, b) => a[0].localeCompare(b[0]));

  fs.writeFileSync(OUT, JSON.stringify({ source: 'NSE EQUITY_L.csv', updated: new Date().toISOString().slice(0, 10), rows }));
  console.log(`Saved ${rows.length} NSE companies to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error('Could not update the symbol list:', err.message);
  process.exit(1);
});
