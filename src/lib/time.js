const config = require('../config');

/** Calendar date (YYYY-MM-DD) in India time, e.g. for "once per trading day" logic. */
function istDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(date);
}

module.exports = { istDate };
