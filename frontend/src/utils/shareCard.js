/**
 * A forwardable picture of a Tip Check result: the risk level, the main warning signs and the stock, but NOT the
 * original message (so nobody's chat is exposed). Drawn on a canvas in the browser, nothing is uploaded.
 */
const W = 1080;
const H = 1350;
const FONT = '"Inter", "Noto Sans Devanagari", "Noto Sans Gujarati", system-ui, sans-serif';
const COLORS = { HIGH: '#D03B3B', MEDIUM: '#B87400', LOW: '#1F8A3B' };

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

  ctx.fillStyle = '#FFF7EA';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2E1A47';
  ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = '#FFB938';
  ctx.fillRect(60, 45, 60, 60);
  ctx.fillStyle = '#2E1A47';
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText('SS', 74, 86);
  ctx.fillStyle = '#FFF7EA';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('StockSee', 140, 76);
  ctx.fillStyle = '#B8A8D0';
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
  ctx.fillStyle = '#2E1A47';
  ctx.font = `600 38px ${FONT}`;
  for (const line of wrapLines(result.summary, W - 120, measure).slice(0, 3)) { ctx.fillText(line, 60, y); y += 54; }

  if (result.instrument) {
    y += 14;
    ctx.fillStyle = '#6B5A85';
    ctx.font = `600 30px ${FONT}`;
    const stock = `${result.instrument.name} (${result.instrument.symbol})`;
    for (const line of wrapLines(stock, W - 120, measure).slice(0, 2)) { ctx.fillText(line, 60, y); y += 42; }
  }

  y += 40;
  ctx.fillStyle = '#2E1A47';
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
    ctx.fillStyle = '#2E1A47';
    for (const line of lines) { y += 42; ctx.fillText(line, 110, y - 6); }
  }
  if (reasons.length === 0) { y += 50; ctx.fillStyle = '#2E1A47'; ctx.fillText(labels.none, 60, y); }

  ctx.fillStyle = '#EFE3CC';
  ctx.fillRect(0, H - 200, W, 200);
  ctx.fillStyle = '#6B5A85';
  ctx.font = `500 25px ${FONT}`;
  let fy = H - 150;
  for (const line of wrapLines(labels.footer, W - 120, measure).slice(0, 3)) { ctx.fillText(line, 60, fy); fy += 36; }
  ctx.fillStyle = '#2E1A47';
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
