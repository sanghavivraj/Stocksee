/**
 * The StockSee opening animation: "The Investor's Journey".
 * The gold SS tile is the character. It enters the market excited, gets scared when the market falls, stays calm and patient,
 * grows confident, then its face blinks away and it becomes the StockSee logo. Every mood change moves the eyes, mouth, body,
 * glow and the chart together (inside 300 ms). The market numbers are an illustration, never real data, and the animation says
 * so: patience does not guarantee profit.
 *
 * createJourney(host, lang) draws into the SVG that journeyMarkup.js put in `host` and returns { render(ms) }.
 * render() is a pure function of time, so the same code serves playback, skipping and the reduced-motion still frame.
 */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const backOut = (p) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const F = 0.94;

export const TOTAL = 12000;

export const TEXT = {
    en: { caps: [['Excited. A new investor', 'steps into the market.'], ['The market falls.', 'The portfolio turns red.'], ['Pause. Breathe.', 'Look at what you own.'], ['Time passes.', 'Markets keep moving.'], ['Calm. Informed.', 'Still here.']],
      end: ['Markets fluctuate. Understand what you own.', 'Think long term.'], tag: ['Markets in your language.', 'Facts, not tips.'],
      foot: 'Illustration only. Patience does not guarantee profit.', entry: 'entry', port: 'Portfolio · example', hint: 'Tap or press any key to skip' },
    hi: { caps: [['उत्साह में नया निवेशक', 'बाज़ार में कदम रखता है।'], ['बाज़ार गिरता है।', 'पोर्टफ़ोलियो लाल हो जाता है।'], ['रुकिए। साँस लीजिए।', 'देखिए आपके पास क्या है।'], ['समय बीतता है।', 'बाज़ार चलता रहता है।'], ['शांत। समझदार।', 'अब भी डटे हुए।']],
      end: ['बाज़ार ऊपर-नीचे होता है। समझिए आपके पास क्या है।', 'लंबे समय की सोचिए।'], tag: ['आपकी भाषा में बाज़ार।', 'टिप्स नहीं, तथ्य।'],
      foot: 'सिर्फ़ चित्रण। धैर्य से मुनाफ़े की गारंटी नहीं होती।', entry: 'शुरुआत', port: 'पोर्टफ़ोलियो · उदाहरण', hint: 'छोड़ने के लिए टैप करें या कोई भी कुंजी दबाएँ' },
  // Gujarati: the tagline is Gujarati; the story lines stay in English until a native reader has checked Gujarati ones
  gu: { caps: null, end: null, tag: ['તમારી ભાષામાં બજાર.', 'ટિપ્સ નહીં, તથ્યો.'], foot: null, entry: null, port: null, hint: 'છોડવા માટે ટૅપ કરો અથવા કોઈ પણ કી દબાવો' },
};
TEXT.gu = Object.fromEntries(Object.entries(TEXT.gu).map(([k, v]) => [k, v ?? TEXT.en[k]]));

  // ---- the market (illustrative % from entry) ----
  const KEYS = [[0, 0], [1000, 6], [2000, 14], [2250, 14], [3000, -14], [3400, -18], [4200, -15], [4800, -17], [5400, -13], [6000, -15], [6400, -9], [6900, -10], [7300, -3], [7800, 6], [8300, 11]].map(([t, v]) => [t * F, v]);
  const END = 8300 * F;
  const wob = (t) => { const k = clamp((t - 3400 * F) / 500) * clamp((7400 * F - t) / 500); return k * (1.0 * Math.sin(t / 95) + 0.7 * Math.sin(t / 41 + 1)); };
  function price(t) {
    t = clamp(t, 0, END);
    let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
    const [t0, v0] = KEYS[i], [t1, v1] = KEYS[i + 1];
    const s = clamp((t - t0) / (t1 - t0)); return lerp(v0, v1, (1 - Math.cos(Math.PI * s)) / 2) + wob(t);
  }
  const WX = (t) => 20 + (clamp(t, 0, END) / END) * 700, WY = (t) => 330 - price(t) * 7.5;

  // camera: zoom follows the story (in for the fall, out for the finish)
  const ZK = [[0, 1], [1900 * F, 1], [2500 * F, 1.3], [3700 * F, 1.3], [4600 * F, 1.12], [7000 * F, 1.08], [8300 * F, 0.92]];
  function zoom(t) { let i = 0; while (i < ZK.length - 2 && t > ZK[i + 1][0]) i++; const [a, za] = ZK[i], [b, zb] = ZK[i + 1]; return lerp(za, zb, easeInOut(clamp((t - a) / (b - a)))); }

  // ---- moods ----
  const MOODS = {
    excited: { arm: [150, -150], eW: 1, eS: 0, eH: 0, eC: 0, eO: 0, sweat: 0, tint: 0, spk: 1, g: [255, 200, 61], mouth: 'M-9 -29Q0 -14 9 -29Z', fill: 1, bl: 'M-18 -57q7-5 14-1', br: 'M4 -58q7-4 14 1' },
    worried: { arm: [-18, 18], eW: 0, eS: 1, eH: 0, eC: 0, eO: 0, sweat: 1, tint: 0.35, spk: 0, g: [255, 80, 80], mouth: 'M-8 -22Q0 -31 8 -22', fill: 0, bl: 'M-18 -52q7-1 13-7', br: 'M5 -59q7 6 13 7' },
    patient: { arm: [-34, 34], eW: 0, eS: 0, eH: 0, eC: 1, eO: 0, sweat: 0, tint: 0, spk: 0, g: [110, 150, 255], mouth: 'M-7 -26Q0 -22 7 -26', fill: 0, bl: 'M-18 -53q7-2 13 0', br: 'M5 -53q7-2 13 0' },
    focused: { arm: [-14, 14], eW: 0, eS: 0, eH: 0, eC: 0, eO: 1, sweat: 0, tint: 0, spk: 0, g: [70, 200, 190], mouth: 'M-6 -26Q0 -22.5 6 -26', fill: 0, bl: 'M-18 -54q7-3 13-1', br: 'M5 -55q7-2 13 1' },
    proud: { arm: [125, -125], eW: 0, eS: 0, eH: 1, eC: 0, eO: 0, sweat: 0, tint: 0, spk: 1, g: [60, 215, 130], mouth: 'M-10 -29Q0 -13 10 -29Z', fill: 1, bl: 'M-18 -55q7-4 14-1', br: 'M4 -56q7-3 14 1' },
  };
  const BEATS = [['excited', 0], ['worried', 2250 * F], ['patient', 3600 * F], ['focused', 5200 * F], ['proud', 7000 * F]];
  const idxAt = (t) => { let i = 0; BEATS.forEach((b, k) => { if (t >= b[1]) i = k; }); return i; };
  const KEYSN = ['eW', 'eS', 'eH', 'eC', 'eO', 'sweat', 'tint', 'spk'];


export { price, zoom, idxAt, BEATS, MOODS };

export function createJourney(host, lang = 'en') {
  const cache = new Map();
  const $ = (id) => { let el = cache.get(id); if (!el) { el = host.querySelector(`[data-j="${id}"]`); cache.set(id, el); } return el; };
  const root = host;
  function setFace(t) {
    const i = idxAt(t), cur = MOODS[BEATS[i][0]], prev = MOODS[BEATS[Math.max(0, i - 1)][0]];
    const k = i === 0 ? 1 : easeOut(clamp((t - BEATS[i][1]) / 260)); // all five layers change inside 300 ms
    KEYSN.forEach((n) => { const v = lerp(prev[n], cur[n], k); $(n === 'sweat' || n === 'tint' || n === 'spk' ? n : n).setAttribute('opacity', v.toFixed(2)); });
    $('tint').setAttribute('opacity', (lerp(prev.tint, cur.tint, k) * 1).toFixed(2));
    $('armL').setAttribute('transform', `rotate(${lerp(prev.arm[0], cur.arm[0], k).toFixed(1)} -26 -42)`);
    $('armR').setAttribute('transform', `rotate(${lerp(prev.arm[1], cur.arm[1], k).toFixed(1)} 26 -42)`);
    const M = k < 0.5 && i > 0 ? prev : cur;
    $('mouth').setAttribute('d', M.mouth); $('mouth').setAttribute('fill', M.fill ? '#5a1f1a' : 'none'); $('bl').setAttribute('d', M.bl); $('br').setAttribute('d', M.br);
    const g = [0, 1, 2].map((j) => lerp(prev.g[j], cur.g[j], k) | 0); const rgb = `rgb(${g})`;
    $('rg0').setAttribute('stop-color', rgb); $('rg1').setAttribute('stop-color', rgb);
    return { mood: BEATS[i][0], rgb };
  }

  // ---- scenery ----
  (function () {
    let a = 11; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    let h = ''; for (let i = 0; i < 40; i++) h += `<circle data-st="1" cx="${(r() * 360).toFixed(1)}" cy="${(r() * 560).toFixed(1)}" r="${(0.6 + r() * 1.1).toFixed(1)}" fill="#fff" data-p="${(r() * 6).toFixed(2)}" opacity=".3"/>`;
    $('stars').innerHTML = h;
    $('shards').innerHTML = Array.from({ length: 16 }, () => '<path d="M0 0l5 12-7 3z" fill="#ff6b6b"/>').join('');
    $('dust').innerHTML = Array.from({ length: 16 }, () => '<circle r="2" fill="#bcd0ff"/>').join('');
    $('conf').innerHTML = Array.from({ length: 30 }, (_, i) => `<rect width="6" height="10" rx="1.5" fill="${['#ffd54a', '#fff', '#3ee6a8', '#ffb938'][i % 4]}"/>`).join('');
    $('dots').innerHTML = [0, 1, 2, 3, 4].map((i) => `<circle cx="${156 + i * 12}" cy="580" r="3.4" fill="#fff" opacity=".3"/>`).join('');
  })();
  const stars = Array.from(root.querySelectorAll('[data-st]')), shards = Array.from($('shards').children), dust = Array.from($('dust').children), conf = Array.from($('conf').children), dots = Array.from($('dots').children);
  const seed = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

  function graphemes(s) { return typeof Intl !== 'undefined' && Intl.Segmenter ? Array.from(new Intl.Segmenter(lang, { granularity: 'grapheme' }).segment(s), (x) => x.segment) : Array.from(s); }
  let lastCap = '';

  function render(t) {
    t = clamp(t, 0, TOTAL);
    const { mood } = setFace(t);
    const LP0 = 7900, lp = easeInOut(clamp((t - LP0) / 800));

    // camera
    const z = zoom(t), lag = Math.max(0, t - 350);
    const camX = 150 - WX(lag) * z, camY = 392 - WY(lag) * z;
    const sh = clamp(1 - (t - 2250 * F) / 600) * (t >= 2250 * F ? 1 : 0);
    const sx = Math.sin(t / 15) * 3.2 * sh, sy = Math.cos(t / 21) * 2.6 * sh;
    $('root').setAttribute('transform', `translate(${sx.toFixed(2)} ${sy.toFixed(2)})`);
    $('world').setAttribute('transform', `translate(${camX.toFixed(1)} ${camY.toFixed(1)}) scale(${z.toFixed(3)})`);
    $('world').setAttribute('opacity', (1 - lp).toFixed(2));
    $('flash').setAttribute('opacity', (0.16 * sh).toFixed(3));
    $('vig').setAttribute('opacity', (clamp((t - 2250 * F) / 300) * clamp((5000 * F - t) / 1400) * 0.9).toFixed(2));

    // the line
    const tt = Math.min(t, END); const pts = [];
    for (let u = 0; u <= tt; u += 25) pts.push([WX(u), WY(u)]);
    pts.push([WX(tt), WY(tt)]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    $('line').setAttribute('d', d); $('lineGlow').setAttribute('d', d);
    $('area').setAttribute('d', `${d}L${pts[pts.length - 1][0].toFixed(1)} 330L${pts[0][0].toFixed(1)} 330Z`);
    $('line').setAttribute('stroke-width', (4 / z).toFixed(2)); $('lineGlow').setAttribute('stroke-width', (13 / z).toFixed(2));

    // readout
    const v = price(tt), up = v >= 0;
    $('num').textContent = `${up ? '+' : '−'}${Math.abs(v).toFixed(1)}%`; $('num').setAttribute('fill', up ? '#3ee6a8' : '#ff6b6b');
    const hudA = 1 - clamp((t - 7700) / 400); $('num').setAttribute('opacity', hudA.toFixed(2)); $('portL').setAttribute('opacity', (0.9 * hudA).toFixed(2));
    const bi = idxAt(t); dots.forEach((c, i) => c.setAttribute('opacity', (hudA * (i === bi ? 1 : 0.3)).toFixed(2))); dots.forEach((c, i) => c.setAttribute('fill', i === bi ? '#D4AF37' : '#fff'));

    // sunrise (time passing) and stars
    const rise = easeInOut(clamp((t - 3400 * F) / (4600 * F)));
    $('sun').setAttribute('cy', (770 - rise * 250 - lp * 20).toFixed(1)); $('sun').setAttribute('r', (110 + rise * 40 + lp * 60).toFixed(1));
    $('sun').setAttribute('opacity', (0.38 * rise * (1 - 0.6 * clamp((t - 8800) / 600))).toFixed(2));
    stars.forEach((s) => s.setAttribute('opacity', ((0.25 + 0.25 * Math.sin(t / 700 + +s.getAttribute('data-p'))) * (1 - 0.7 * rise)).toFixed(2)));

    // character pose
    const ang = Math.atan2(WY(t + 120) - WY(t - 120), (240 / END) * 700 * 1);
    const slope = (mood === 'patient' || mood === 'focused' ? 0.35 : 1) * clamp(ang, -0.62, 0.62);
    const entering = 1 - easeOut(clamp(t / 900));
    const cs = (0.9 + 0.1 * z) * (1 + 0.0 * lp);
    let cx = WX(t) * z + camX - entering * 170, cy = WY(t) * z + camY;
    let rot = slope, scale = cs;
    // movement style
    let hop = 0, tremble = 0, breathe = 1, sway = 0, legSwing = 0;
    if (t < 900) { hop = -Math.abs(Math.sin(t / 85)) * 7; legSwing = Math.sin(t / 85); }
    else if (mood === 'excited') { hop = -Math.abs(Math.sin(t / 105)) * 12; legSwing = Math.sin(t / 105); }
    else if (mood === 'worried') { tremble = Math.sin(t / 19) * 2.2; legSwing = Math.sin(t / 30) * 0.35; }
    else if (mood === 'patient') { breathe = 1 + 0.03 * Math.sin(t / 480); }
    else if (mood === 'focused') { sway = Math.sin(t / 650) * 0.05; legSwing = Math.sin(t / 260) * 0.35; }
    else { hop = -Math.abs(Math.sin(t / 170)) * 7; legSwing = Math.sin(t / 170) * 0.8; }
    // to the logo
    const px = lerp(cx + tremble, 180, lp), py = lerp(cy + hop, 296, lp); // tile centre at (180,250): feet 46 below
    rot = lerp(rot + sway, 0, lp); scale = lerp(scale, 2.0, lp);
    $('who').setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(rot * 57.3).toFixed(2)}) scale(${(scale * lerp(breathe, 1, lp)).toFixed(3)})`);
    $('legL').setAttribute('transform', `rotate(${(legSwing * 25).toFixed(1)} -9.5 -16)`); $('legR').setAttribute('transform', `rotate(${(-legSwing * 25).toFixed(1)} 9.5 -16)`);
    $('legs').setAttribute('opacity', (1 - lp).toFixed(2)); $('armL').parentNode; $('shadow').setAttribute('opacity', (0.3 * (1 - lp)).toFixed(2));
    $('look').setAttribute('transform', `translate(${(Math.sin(t / 420) * 3.2).toFixed(2)} 0)`);
    // glow follows
    const gx = lerp(cx, 180, lp), gy = lerp(cy - 40 * cs, 250, lp);
    $('glow').setAttribute('cx', gx.toFixed(1)); $('glow').setAttribute('cy', gy.toFixed(1)); $('glow').setAttribute('r', (150 + lp * 40).toFixed(0));
    $('glow').setAttribute('opacity', ((0.5 + 0.12 * Math.sin(t / 280)) * (t > 9000 ? 0.8 : 1)).toFixed(2));
    if (t > 8700) { $('rg0').setAttribute('stop-color', '#ffd54a'); $('rg1').setAttribute('stop-color', '#ffd54a'); }

    // face -> SS
    const fOp = 1 - clamp((t - 8900) / 280), sOp = clamp((t - 9150) / 300);
    $('face').setAttribute('opacity', fOp.toFixed(2)); $('spk').setAttribute('opacity', Math.min(+$('spk').getAttribute('opacity'), fOp).toFixed(2));
    $('ss').setAttribute('opacity', sOp.toFixed(2)); $('ss').setAttribute('transform', `translate(0 -40) scale(${(0.7 + 0.3 * backOut(sOp)).toFixed(3)}) translate(0 40)`);
    const arm = 1 - clamp((t - 8100) / 500); $('armL').parentNode; $('armL').setAttribute('opacity', arm.toFixed(2)); $('armR').setAttribute('opacity', arm.toFixed(2));
    const sh2 = clamp((t - 9500) / 700); $('shine').setAttribute('opacity', (sh2 > 0 && sh2 < 1 ? 0.55 : 0).toFixed(2)); $('shine').setAttribute('x', (-60 + sh2 * 130).toFixed(1));

    // particles
    shards.forEach((p, i) => { const s = clamp((t - 2250 * F - i * 40) / 1100), x = 30 + seed(i, 1) * 300, y = -20 + s * 520; p.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(s * 360 * (seed(i, 2) + 0.5)).toFixed(0)})`); p.setAttribute('opacity', (s > 0 && s < 1 ? 0.8 * (1 - s * 0.5) : 0).toFixed(2)); });
    const dk = clamp((t - 3600 * F) / 300) * clamp((5200 * F - t) / 400);
    dust.forEach((p, i) => { const x = 20 + seed(i, 3) * 320 + Math.sin(t / 900 + i) * 12, y = 200 + seed(i, 4) * 300 - ((t / 40 + i * 20) % 120); p.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); p.setAttribute('opacity', (0.5 * dk * (0.4 + 0.6 * Math.abs(Math.sin(t / 500 + i)))).toFixed(2)); });
    conf.forEach((p, i) => { const s = clamp((t - 8900) / 1500), a = (i / conf.length) * Math.PI * 2 + seed(i, 5), r = easeOut(s) * (110 + seed(i, 6) * 110), x = 180 + Math.cos(a) * r, y = 250 + Math.sin(a) * r + s * s * 70; p.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(s * 540 * (seed(i, 7) + 0.4)).toFixed(0)})`); p.setAttribute('opacity', (s > 0 && s < 1 ? 1 - s * s : 0).toFixed(2)); });

    // captions
    const L = TEXT[lang], starts = [0, 2250 * F, 3600 * F, 5200 * F, 7000 * F];
    let lines = null, a = 0;
    if (t < 7900) { lines = L.caps[bi]; const end = bi < 4 ? starts[bi + 1] : 7900; a = Math.min(clamp((t - starts[bi]) / 250), clamp((end - t) / 250)); }
    const key = (lines || []).join('|'); if (key !== lastCap) { $('cap1').textContent = lines ? lines[0] : ''; $('cap2').textContent = lines ? lines[1] : ''; lastCap = key; }
    $('cap1').setAttribute('opacity', a.toFixed(2)); $('cap2').setAttribute('opacity', a.toFixed(2));

    // logo text
    $('logoText').setAttribute('opacity', 1);
    const wa = easeOut(clamp((t - 9400) / 450)); $('word').setAttribute('opacity', wa.toFixed(2)); $('word').setAttribute('transform', `translate(0 ${(12 * (1 - wa)).toFixed(1)})`);
    const g1 = graphemes(L.tag[0]), g2 = graphemes(L.tag[1]);
    const n = Math.floor(clamp((t - 9800) / 1500) * (g1.length + g2.length));
    $('tag1').textContent = g1.slice(0, n).join(''); $('tag2').textContent = g2.slice(0, Math.max(0, n - g1.length)).join('');
    const ea = easeOut(clamp((t - 11000) / 450)); $('end1').textContent = L.end[0]; $('end2').textContent = L.end[1]; $('end1').setAttribute('opacity', ea.toFixed(2)); $('end2').setAttribute('opacity', ea.toFixed(2));
    
  }


  const BASEF = (330 - 200) / 280; $('gA').setAttribute('offset', BASEF); $('gB').setAttribute('offset', BASEF); $('base').setAttribute('y1', 330);
  const L0 = TEXT[lang] || TEXT.en;
  $('foot').textContent = L0.foot; $('entry').textContent = L0.entry; $('portL').textContent = L0.port; $('hint').textContent = L0.hint;
  return { render };
}
