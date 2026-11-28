/**
 * A forwardable picture of a Tip Check result: the risk level, the main warning signs and the stock, but NOT the
 * original message (so nobody's chat is exposed). Drawn on a canvas in the browser, nothing is uploaded.
 */
const W = 1080;
const H = 1350;
const FONT = '"Inter", "Noto Sans Devanagari", "Noto Sans Gujarati", system-ui, sans-serif';
const COLORS = { HIGH: '#AA2A24', MEDIUM: '#B7791F', LOW: '#0E7A43' };

/** Split text into lines that fit `maxWidth` using the given measuring function. Words are never cut in half. */
export function wrapLines(text, maxWidth, measure) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (measure(test) <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export function buildRiskCard(result, labels) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const measure = (t) => ctx.measureText(t).width;
  const color = COLORS[result.level] || COLORS.MEDIUM;

  ctx.fillStyle = '#FBFAF7';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#16181D';
  ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = '#1D6FD6';
  ctx.fillRect(60, 45, 60, 60);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText('SS', 74, 86);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('StockSee', 140, 76);
  ctx.fillStyle = '#A3A9B5';
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(labels.tagline, 140, 108);

  let y = 250;
  ctx.fillStyle = color;
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(labels.level, 60, y);
  y += 30;
  ctx.fillStyle = color;
  ctx.fillRect(60, y, 220, 10);

  y += 70;
  ctx.fillStyle = '#16181D';
  ctx.font = `600 38px ${FONT}`;
  for (const line of wrapLines(result.summary, W - 120, measure).slice(0, 3)) { ctx.fillText(line, 60, y); y += 54; }

  if (result.instrument) {
    y += 14;
    ctx.fillStyle = '#5F6168';
    ctx.font = `600 30px ${FONT}`;
    const stock = `${result.instrument.name} (${result.instrument.symbol})`;
    for (const line of wrapLines(stock, W - 120, measure).slice(0, 2)) { ctx.fillText(line, 60, y); y += 42; }
  }

  y += 40;
  ctx.fillStyle = '#16181D';
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(labels.signs, 60, y);
  y += 20;

  ctx.font = `500 31px ${FONT}`;
  const reasons = result.reasons.slice(0, 4);
  for (const r of reasons) {
    y += 22;
    const lines = wrapLines(r.text, W - 170, measure).slice(0, 3);
    if (y + lines.length * 42 > H - 230) break;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(76, y + 24, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16181D';
    for (const line of lines) { y += 42; ctx.fillText(line, 110, y - 6); }
  }
  if (reasons.length === 0) { y += 50; ctx.fillStyle = '#16181D'; ctx.fillText(labels.none, 60, y); }

  ctx.fillStyle = '#E7E4DC';
  ctx.fillRect(0, H - 200, W, 200);
  ctx.fillStyle = '#5F6168';
  ctx.font = `500 25px ${FONT}`;
  let fy = H - 150;
  for (const line of wrapLines(labels.footer, W - 120, measure).slice(0, 3)) { ctx.fillText(line, 60, fy); fy += 36; }
  ctx.fillStyle = '#16181D';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(labels.motto, 60, H - 30);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/** Share the picture with the phone's share sheet when possible, otherwise download it. Returns what happened. */
export async function shareOrDownload(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
