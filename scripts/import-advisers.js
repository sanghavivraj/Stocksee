/**
 * Load the list of SEBI-registered investment advisers / research analysts from an official CSV.
 *   npm run advisers:import -- ~/Downloads/advisers.csv [YYYY-MM-DD]
 * Download the list yourself from SEBI's intermediary portal or BSE's IA/RA page (SEBI says adviser and analyst
 * registration is now handled by BSE). The CSV needs a "Registration No." column and a "Name" column; validity and
 * status columns are kept when present. Nothing is invented: until you run this, Tip Check says "not checked".
 */
const fs = require('fs');
const path = require('path');
const { parseRegistryCsv } = require('../src/services/adviserService');

const FILE = path.join(__dirname, '..', 'src', 'constants', 'registeredAdvisers.json');
const [, , csvPath, date] = process.argv;
if (!csvPath) {
  console.error('Usage: npm run advisers:import -- <file.csv> [YYYY-MM-DD]');
  process.exit(1);
}
try {
  const entries = parseRegistryCsv(fs.readFileSync(csvPath, 'utf8'));
  const updated = date || new Date().toISOString().slice(0, 10);
  fs.writeFileSync(FILE, `${JSON.stringify({ updated, entries }, null, 2)}\n`);
  console.log(`Saved ${entries.length} registered advisers / analysts (list date ${updated}).`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
