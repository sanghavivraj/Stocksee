// Telegram allows ~30 messages/second per bot; stay safely below it.
const SEND_INTERVAL_MS = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send one message per recipient, throttled. One failure doesn't stop the rest.
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function deliverAll(sendMessage, items, label) {
  let sent = 0;
  let failed = 0;
  for (const { chatId, text } of items) {
    try {
      if (await sendMessage(chatId, text)) sent += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error(`[${label}] Failed to send to chat ${chatId}:`, err.message);
    }
    await sleep(SEND_INTERVAL_MS);
  }
  console.log(`[${label}] sent=${sent} failed=${failed}`);
  return { sent, failed };
}

module.exports = { deliverAll };
