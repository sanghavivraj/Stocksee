/**
 * StockSee: "The Investor's Journey" in 3D.
 * Same story as the 2D opening: the gold SS tile enters the market excited, is scared by the fall, stays calm and patient,
 * grows confident, then its face turns into the StockSee logo. This version is a real 3D scene (three.js) with a moving camera.
 * Everything is a pure function of time, so playback, scrubbing, still frames and video recording all use the same code.
 * The market numbers are an illustration, never real data, and the film says so.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export const TOTAL = 12000;
export type Lang = "en" | "hi" | "gu";

/* ---------- the story (same beats, captions and illustrative market as the 2D opening) ---------- */
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const seed = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const F = 0.94;
const KEYS: [number, number][] = [[0, 0], [1000, 6], [2000, 14], [2250, 14], [3000, -14], [3400, -18], [4200, -15], [4800, -17], [5400, -13], [6000, -15], [6400, -9], [6900, -10], [7300, -3], [7800, 6], [8300, 11]].map(([t, v]) => [t * F, v]);
const END = 8300 * F;
const wob = (t: number) => { const k = clamp((t - 3400 * F) / 500) * clamp((7400 * F - t) / 500); return k * (1.0 * Math.sin(t / 95) + 0.7 * Math.sin(t / 41 + 1)); };
function price(t: number) {
  t = clamp(t, 0, END);
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const [t0, v0] = KEYS[i], [t1, v1] = KEYS[i + 1];
  const s = clamp((t - t0) / (t1 - t0)); return lerp(v0, v1, (1 - Math.cos(Math.PI * s)) / 2) + wob(t);
}
const BEATS: [string, number][] = [["excited", 0], ["worried", 2250 * F], ["patient", 3600 * F], ["focused", 5200 * F], ["proud", 7000 * F]];
const idxAt = (t: number) => { let i = 0; BEATS.forEach((b, k) => { if (t >= b[1]) i = k; }); return i; };
const GLOW: Record<string, [number, number, number]> = { excited: [255, 200, 61], worried: [255, 80, 80], patient: [110, 150, 255], focused: [70, 200, 190], proud: [60, 215, 130] };
type Face = { open: number; pup: number; arc: number; browY: number; browTilt: number; smile: number; mouthOpen: number; sweat: number; blush: number; arm: number };
const FACE: Record<string, Face> = {
  excited: { open: 1, pup: 1.25, arc: 0, browY: -8, browTilt: 0.3, smile: 1, mouthOpen: 1, sweat: 0, blush: 0.3, arm: 2.6 },
  worried: { open: 0.95, pup: 0.6, arc: 0, browY: 0, browTilt: -1, smile: -0.7, mouthOpen: 0, sweat: 1, blush: 0, arm: -0.3 },
  patient: { open: 0.1, pup: 1, arc: 0, browY: 6, browTilt: 0, smile: 0.35, mouthOpen: 0, sweat: 0, blush: 0, arm: -0.6 },
  focused: { open: 0.62, pup: 0.9, arc: 0, browY: 2, browTilt: 0.1, smile: 0.15, mouthOpen: 0, sweat: 0, blush: 0, arm: -0.25 },
  proud: { open: 0, pup: 1, arc: 1, browY: -4, browTilt: 0.2, smile: 1, mouthOpen: 0.6, sweat: 0, blush: 0.6, arm: 2.2 },
};
const FKEYS = Object.keys(FACE.excited) as (keyof Face)[];

export const TEXT: Record<Lang, any> = {
  en: { caps: [["Excited. A new investor", "steps into the market."], ["The market falls.", "The portfolio turns red."], ["Pause. Breathe.", "Look at what you own."], ["Time passes.", "Markets keep moving."], ["Calm. Informed.", "Still here."]],
    end: ["Markets fluctuate. Understand what you own.", "Think long term."], tag: ["Markets in your language.", "Facts, not tips."],
    foot: "Illustration only. Patience does not guarantee profit.", port: "Portfolio · example", hint: "Tap or press any key to skip" },
  hi: { caps: [["उत्साह में नया निवेशक", "बाज़ार में कदम रखता है।"], ["बाज़ार गिरता है।", "पोर्टफ़ोलियो लाल हो जाता है।"], ["रुकिए। साँस लीजिए।", "देखिए आपके पास क्या है।"], ["समय बीतता है।", "बाज़ार चलता रहता है।"], ["शांत। समझदार।", "अब भी डटे हुए।"]],
    end: ["बाज़ार ऊपर-नीचे होता है। समझिए आपके पास क्या है।", "लंबे समय की सोचिए।"], tag: ["आपकी भाषा में बाज़ार।", "टिप्स नहीं, तथ्य।"],
    foot: "सिर्फ़ चित्रण। धैर्य से मुनाफ़े की गारंटी नहीं होती।", port: "पोर्टफ़ोलियो · उदाहरण", hint: "छोड़ने के लिए टैप करें या कोई भी कुंजी दबाएँ" },
  // Gujarati: the tagline is Gujarati; the story lines stay in English until a native reader has checked Gujarati ones
  gu: { caps: null, end: null, tag: ["તમારી ભાષામાં બજાર.", "ટિપ્સ નહીં, તથ્યો."], foot: null, port: null, hint: "છોડવા માટે ટૅપ કરો અથવા કોઈ પણ કી દબાવો" },
};
(Object.keys(TEXT.gu) as string[]).forEach((k) => { if (TEXT.gu[k] == null) TEXT.gu[k] = TEXT.en[k]; });
const graphemes = (s: string): string[] => { try { return Array.from(new (Intl as any).Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x: any) => x.segment); } catch { return Array.from(s); } };

/* ---------- 3D world ---------- */
const X0 = -13, X1 = 13;
const roadX = (t: number) => X0 + (X1 - X0) * clamp(t / END);
const roadY = (t: number) => price(t) * 0.15;

function tileState(t: number) {
  const tc = Math.min(t, END);
  const a = Math.max(0, tc - 60), b = Math.min(END, tc + 60);
  const slope = (roadY(b) - roadY(a)) / (roadX(b) - roadX(a) + 1e-6);
  let x = roadX(tc), y = roadY(tc) + 0.88, rz = Math.atan(slope) * 0.7, ry = 0, sc = 1;
  const bi = idxAt(t);
  if (bi === 0) { y += Math.abs(Math.sin(t / 190)) * 0.35; ry = Math.sin(t / 420) * 0.35; }
  if (bi === 1) { x += Math.sin(t / 36) * 0.045; rz += Math.sin(t / 52) * 0.05; ry = -0.25; }
  if (bi === 2) { sc = 1 + Math.sin(t / 650) * 0.02; ry = Math.sin(t / 1400) * 0.2; }
  if (bi === 3) { ry = Math.sin(t / 1100) * 0.3; y += Math.sin(t / 800) * 0.03; }
  if (bi === 4) { ry = Math.sin(t / 900) * 0.35; y += Math.abs(Math.sin(t / 260)) * 0.1; }
  const f = easeInOut(clamp((t - 7800) / 900));
  return { x: lerp(x, 0, f), y: lerp(y, 0.95, f) + Math.sin(f * Math.PI) * 1.2, rz: lerp(rz, 0, f), ry: lerp(ry, Math.PI * 2, f), s: lerp(1, 1.25, f) * sc, f };
}
// camera keyframes: [time, dx, dy, dz (from the tile), lookDx, lookDy, roll]
const KF: number[][] = [
  [0, -4.5, 2.6, 12, 1.4, 0.3, 0], [1900, -1.8, 2.0, 9.6, 0.8, 0.4, 0], [2400, 2.8, 0.3, 5.2, 0, 0.1, 0], [3000, 2.2, 0, 4.6, -0.2, 0, 0.07],
  [3700, 2.0, 0.1, 4.9, -0.1, 0, 0.05], [4900, 0, 2.0, 11, 1.0, 0.2, 0], [6300, -3.6, 1.0, 9, 1.4, 0.7, 0], [7500, 4.2, 1.4, 11, 1.4, 1.0, 0],
];
function camRel(t: number) {
  let i = 0; while (i < KF.length - 2 && t > KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1], k = easeInOut(clamp((t - a[0]) / (b[0] - a[0])));
  return a.slice(1).map((v, j) => lerp(v, b[j + 1], k));
}

export function createJourney3D(host: HTMLElement, startLang: Lang = "en") {
  let W = 1920, H = 1080;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14); scene.fog = new THREE.Fog(0x060a14, 16, 46);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0x7a8cc0, 0x0a0f1a, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d2, 1.5); key.position.set(4, 9, 9); scene.add(key);
  const rim = new THREE.PointLight(0xffc83d, 22, 14, 1.6); scene.add(rim);

  // the market: a glowing line on top of a glass slab
  const N = 420, pts: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) { const t = (i / (N - 1)) * END; pts.push(new THREE.Vector3(roadX(t), roadY(t), 0)); }
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.78, 0.24), emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.2, transparent: true });
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 900, 0.06, 10), lineMat); scene.add(line);
  const shape = new THREE.Shape(); shape.moveTo(X0, -4); pts.forEach((p) => shape.lineTo(p.x, p.y - 0.07)); shape.lineTo(X1, -4); shape.closePath();
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.7, bevelEnabled: false }); slabGeo.translate(0, 0, -0.85);
  const slabMat = new THREE.MeshPhysicalMaterial({ color: 0x12264a, roughness: 0.18, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.6 });
  const slab = new THREE.Mesh(slabGeo, slabMat); scene.add(slab);
  const entry = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(X0, 0, 0.9), new THREE.Vector3(X1, 0, 0.9)]), new THREE.LineDashedMaterial({ color: 0x6f7fa8, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.5 }));
  entry.computeLineDistances(); scene.add(entry);
  const grid = new THREE.GridHelper(90, 90, 0x233a6a, 0x101a33); grid.position.y = -4.02; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.7; scene.add(grid);
  const starPos = new Float32Array(900); for (let i = 0; i < 300; i++) { const r = 45 + seed(i, 1) * 20, th = seed(i, 2) * Math.PI * 2, ph = Math.acos(2 * seed(i, 3) - 1); starPos.set([r * Math.sin(ph) * Math.cos(th), Math.abs(r * Math.cos(ph)) * 0.6 + 2, -Math.abs(r * Math.sin(ph) * Math.sin(th)) - 8], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 0.12, transparent: true, opacity: 0.7 })));

  // the character
  const tile = new THREE.Group(); scene.add(tile);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.85, roughness: 0.27, envMapIntensity: 1.3 });
  tile.add(new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.6, 1.2, 8, 0.24), gold));
  const faceCv = document.createElement("canvas"); faceCv.width = faceCv.height = 512; const fctx = faceCv.getContext("2d")!;
  const faceTex = new THREE.CanvasTexture(faceCv); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, toneMapped: false }));
  face.position.z = 0.605; tile.add(face);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.92, 0.1, 0.1);
    const g = new THREE.CapsuleGeometry(0.11, 0.55, 6, 14); g.translate(0, -0.4, 0);
    pivot.add(new THREE.Mesh(g, gold)); tile.add(pivot); return { pivot, side };
  });

  // effects
  const dummy = new THREE.Object3D();
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd35a, metalness: 1, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.6 }), 38); scene.add(coins);
  const shardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.35, 0.35), transparent: true, opacity: 0.85 });
  const shards = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.6, 0.03), shardMat, 110); scene.add(shards);
  const moteN = 160, motePos = new Float32Array(moteN * 3); const moteG = new THREE.BufferGeometry(); moteG.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ color: 0xbcd0ff, size: 0.07, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); scene.add(new THREE.Points(moteG, moteMat));
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.22), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), 130); scene.add(conf);
  const confCols = [0xffd35a, 0xffffff, 0x4ade80, 0x6db3ff]; for (let i = 0; i < 130; i++) conf.setColorAt(i, new THREE.Color(confCols[i % 4]));

  // post: bloom for the glow
  const composer = new EffectComposer(renderer); composer.setSize(W, H);
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.3, 0.45, 0.96); composer.addPass(new RenderPass(scene, cam)); composer.addPass(bloom); composer.addPass(new OutputPass());

  // HUD (captions, numbers, wordmark) drawn in 2D and laid over the frame, so recorded video contains it
  const hudCv = document.createElement("canvas"); hudCv.width = W; hudCv.height = H; const hctx = hudCv.getContext("2d")!;
  const hudTex = new THREE.CanvasTexture(hudCv); hudTex.colorSpace = THREE.SRGBColorSpace;
  const hudScene = new THREE.Scene(); const hudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  hudScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false, toneMapped: false })));

  let lang: Lang = startLang, showHint = true;
  const FONT = "'Inter','Noto Sans Devanagari','Noto Sans Gujarati',system-ui,sans-serif";

  function faceParams(t: number) {
    const i = idxAt(t), cur = FACE[BEATS[i][0]], prev = FACE[BEATS[Math.max(0, i - 1)][0]];
    const k = i === 0 ? 1 : easeOut(clamp((t - BEATS[i][1]) / 260)); // every part changes inside 300 ms
    const p: any = {}; FKEYS.forEach((n) => { p[n] = lerp(prev[n], cur[n], k); });
    const gp = GLOW[BEATS[Math.max(0, i - 1)][0]], gc = GLOW[BEATS[i][0]]; p.glow = gp.map((v, j) => lerp(v, gc[j], k));
    return p as Face & { glow: number[] };
  }
  function drawFace(p: Face, t: number, fa: number, so: number) {
    const c = fctx; c.clearRect(0, 0, 512, 512); c.lineCap = "round"; c.lineJoin = "round";
    const ink = "#3a230c";
    if (fa > 0.01) {
      c.save(); c.globalAlpha = fa;
      const blink = (t % 2600) > 2460 ? 0.15 : 1; const open = p.open * (p.arc > 0.5 || p.open < 0.3 ? 1 : blink);
      if (p.blush > 0.02) { c.fillStyle = `rgba(255,110,90,${0.38 * p.blush})`; [[138, 300], [374, 300]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 34, 20, 0, 0, 7); c.fill(); }); }
      c.strokeStyle = ink; c.lineWidth = 14; const by = 138 + p.browY;
      [190, 322].forEach((cx) => { const d = cx < 256 ? 1 : -1; c.beginPath(); c.moveTo(cx - d * 32, by - p.browTilt * 6); c.lineTo(cx + d * 32, by + p.browTilt * 14); c.stroke(); });
      const gaze = Math.sin(t / 340) * 4 * (p.sweat > 0.5 ? 1.6 : 0.4), cy = 215;
      const wArc = p.arc, closedFrac = clamp((0.28 - open) / 0.28), wClosed = (1 - wArc) * closedFrac, wOpen = (1 - wArc) * (1 - closedFrac);
      [190, 322].forEach((cx) => {
        if (wOpen > 0.01) {
          c.globalAlpha = fa * wOpen; c.fillStyle = "#fff7e3"; c.beginPath(); c.ellipse(cx, cy, 40, 48 * Math.max(open, 0.15), 0, 0, 7); c.fill();
          c.fillStyle = "#2a1707"; const px = cx + gaze, py = cy + (p.sweat > 0.5 ? 6 : 0); c.beginPath(); c.arc(px, py, 19 * p.pup, 0, 7); c.fill();
          c.fillStyle = "#fff"; c.beginPath(); c.arc(px - 6, py - 7, 6, 0, 7); c.fill();
        }
        c.strokeStyle = ink; c.lineWidth = 13;
        if (wClosed > 0.01) { c.globalAlpha = fa * wClosed; c.beginPath(); c.arc(cx, cy - 14, 34, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
        if (wArc > 0.01) { c.globalAlpha = fa * wArc; c.beginPath(); c.arc(cx, cy + 18, 34, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); }
      });
      c.globalAlpha = fa; c.strokeStyle = ink; c.lineWidth = 13;
      const y0 = 338, x0 = 200, x1 = 312, wob2 = Math.sin(t / 60) * p.sweat * 3;
      if (p.mouthOpen > 0.05) {
        c.fillStyle = "#5a1f1a"; c.globalAlpha = fa * Math.min(1, p.mouthOpen * 1.4); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(256, y0 + 8, x1, y0);
        c.quadraticCurveTo(256, y0 + p.smile * 70 + p.mouthOpen * 50, x0, y0); c.fill(); c.globalAlpha = fa;
      }
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(256 + wob2, y0 + p.smile * 70, x1, y0); c.stroke();
      if (p.sweat > 0.02) { const dy = ((t / 9) % 46) * p.sweat; c.globalAlpha = fa * p.sweat; c.fillStyle = "rgba(150,205,255,.92)"; c.beginPath(); c.moveTo(398, 142 + dy); c.quadraticCurveTo(418, 176 + dy, 398, 184 + dy); c.quadraticCurveTo(378, 176 + dy, 398, 142 + dy); c.fill(); }
      c.restore();
    }
    if (so > 0.01) {
      c.save(); c.globalAlpha = so; c.textAlign = "center"; c.textBaseline = "middle"; c.font = `800 250px ${FONT}`;
      c.fillStyle = "rgba(255,238,170,.85)"; c.fillText("SS", 252, 258); c.fillStyle = ink; c.fillText("SS", 256, 262); c.restore();
    }
    faceTex.needsUpdate = true;
  }

  const kScale = () => clamp(Math.min(W / 1400, (H * 1.6) / 1400), 0.4, 1); // text shrinks on small and tall screens
  function drawHud(t: number) {
    const c = hctx, L = TEXT[lang], k = kScale(), px = (n: number) => Math.round(n * k), m = 84 * k; c.clearRect(0, 0, W, H); c.textBaseline = "alphabetic";
    // cinematic bars, gone when the logo arrives
    const bar = (W > H ? 64 : 0) * k * (1 - easeOut(clamp((t - 8200) / 700))); if (bar > 0.5) { c.fillStyle = "#000"; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar, W, bar); }
    const gl = faceParams(Math.min(t, 8300)).glow; const col = `rgb(${gl.map((v) => Math.round(v)).join(",")})`;
    const pa = clamp((8300 - t) / 400);
    if (pa > 0) { // portfolio number
      c.globalAlpha = pa; c.fillStyle = "rgba(255,255,255,.7)"; c.font = `500 ${px(26)}px ${FONT}`; c.textAlign = "left"; c.fillText(L.port, m, m + px(36));
      const v = price(t); c.fillStyle = col; c.font = `700 ${px(76)}px ${FONT}`; c.fillText((v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%", m - 2, m + px(112)); c.globalAlpha = 1;
    }
    // story captions
    const starts = BEATS.map((b2) => b2[1]), bi = idxAt(t);
    if (t < 7900) {
      const end = bi < 4 ? starts[bi + 1] : 7900, a2 = Math.min(clamp((t - starts[bi]) / 250), clamp((end - t) / 250)); const lines = L.caps[bi];
      c.globalAlpha = a2; c.textAlign = "center"; c.shadowColor = "rgba(0,0,0,.7)"; c.shadowBlur = 18;
      c.fillStyle = "#fff"; c.font = `700 ${px(50)}px ${FONT}`; c.fillText(lines[0], W / 2, H - px(175)); c.fillStyle = "rgba(255,255,255,.85)"; c.font = `500 ${px(42)}px ${FONT}`; c.fillText(lines[1], W / 2, H - px(112)); c.shadowBlur = 0; c.globalAlpha = 1;
    }
    // logo moment
    c.textAlign = "center";
    const wa = easeOut(clamp((t - 9400) / 450));
    if (wa > 0) { c.globalAlpha = wa; c.fillStyle = "#fff"; c.font = `800 ${px(118)}px ${FONT}`; c.fillText("StockSee", W / 2, H * 0.745 + 12 * (1 - wa)); c.globalAlpha = 1; }
    const g1 = graphemes(L.tag[0]), g2 = graphemes(L.tag[1]); const n = Math.floor(clamp((t - 9800) / 1500) * (g1.length + g2.length));
    c.fillStyle = "#f4d58a"; c.font = `500 ${px(40)}px ${FONT}`;
    if (n > 0) c.fillText(g1.slice(0, n).join(""), W / 2, H * 0.81); if (n > g1.length) c.fillText(g2.slice(0, n - g1.length).join(""), W / 2, H * 0.81 + px(48));
    const ea = easeOut(clamp((t - 11000) / 450)); if (ea > 0) { c.globalAlpha = ea; c.fillStyle = "rgba(255,255,255,.78)"; c.font = `500 ${px(28)}px ${FONT}`; c.fillText(L.end[0], W / 2, H * 0.915); c.fillText(L.end[1], W / 2, H * 0.915 + px(34)); c.globalAlpha = 1; }
    c.fillStyle = "rgba(255,255,255,.5)"; c.font = `400 ${px(22)}px ${FONT}`; c.textAlign = "left"; c.fillText(L.foot, m, H - px(22));
    if (showHint) { c.textAlign = "right"; c.fillText(L.hint, W - m, m + px(36)); }
    hudTex.needsUpdate = true;
  }

  const tmpV = new THREE.Vector3();
  function render(tIn: number) {
    const t = clamp(tIn, 0, TOTAL + 600), S = tileState(t), bi = idxAt(t);
    const p = faceParams(Math.min(t, 8400)); const so = easeOut(clamp((t - 8300) / 500)); const fa = 1 - so;
    tile.position.set(S.x, S.y, 0); tile.rotation.set(0, S.ry, S.rz); tile.scale.setScalar(S.s);
    const armFade = 1 - clamp((t - 8100) / 500);
    arms.forEach(({ pivot, side }, k) => { const flap = bi === 0 || bi === 4 ? Math.sin(t / 150 + k) * 0.25 : bi === 1 ? Math.sin(t / 45 + k * 2) * 0.08 : 0; pivot.rotation.z = -side * (p.arm + flap) * 1.0 + (side > 0 ? 0 : 0); pivot.scale.setScalar(Math.max(0.001, armFade)); });
    drawFace(p, t, fa, so);

    const gc = new THREE.Color(p.glow[0] / 255, p.glow[1] / 255, p.glow[2] / 255);
    rim.color.copy(gc); rim.position.set(S.x + 1.5, S.y + 1.2, 2.2);
    lineMat.emissive.copy(gc); const roadFade = 1 - easeInOut(clamp((t - 7900) / 1000));
    lineMat.opacity = roadFade; slabMat.opacity = 0.6 * roadFade; slab.visible = line.visible = roadFade > 0.01; (entry.material as THREE.Material).opacity = 0.5 * roadFade;

    // coins (excited)
    for (let i = 0; i < 38; i++) {
      const s0 = i * 52, age = (t - s0) / 1500, vis = s0 < 2300 && age > 0 && age < 1;
      if (vis) { const sec = age * 1.5, o = tileState(s0); dummy.position.set(o.x + (seed(i, 1) - 0.5) * 3 * sec, o.y + 0.6 + (3 + seed(i, 2) * 3) * sec - 4.5 * sec * sec, (seed(i, 3) - 0.5) * 1.2); dummy.rotation.set(sec * 9 * seed(i, 4), sec * 7, 0); dummy.scale.setScalar(1 - age * age); }
      else dummy.scale.setScalar(0.0001);
      dummy.updateMatrix(); coins.setMatrixAt(i, dummy.matrix);
    }
    coins.instanceMatrix.needsUpdate = true;
    // shards (the fall)
    for (let i = 0; i < 110; i++) {
      const s0 = 2250 * F + i * 8, age = (t - s0) / 850, vis = age > 0 && age < 1;
      if (vis) { const o = tileState(s0); dummy.position.set(o.x + (seed(i, 5) - 0.5) * 9, 6.5 - age * 10.5, (seed(i, 6) - 0.5) * 4); dummy.rotation.set(0, 0, (seed(i, 7) - 0.5) * 0.25); dummy.scale.set(1, 0.6 + seed(i, 8), 1); }
      else dummy.scale.setScalar(0.0001);
      dummy.updateMatrix(); shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    // dust (calm and patient)
    const dk = clamp((t - 3600 * F) / 400) * clamp((5400 * F - t) / 500); moteMat.opacity = 0.7 * dk;
    for (let i = 0; i < moteN; i++) motePos.set([S.x + (seed(i, 1) - 0.5) * 12 + Math.sin(t / 900 + i) * 0.3, -2 + seed(i, 2) * 6 + Math.sin(t / 1300 + i * 2) * 0.3, (seed(i, 3) - 0.5) * 5], i * 3);
    (moteG.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    // confetti (the finish)
    for (let i = 0; i < 130; i++) {
      const age = (t - 8900) / 1700, vis = age > 0 && age < 1;
      if (vis) { const sec = age * 1.7, a = seed(i, 1) * Math.PI * 2, e = (seed(i, 2) - 0.2) * 1.4, sp = 3 + seed(i, 3) * 4; dummy.position.set(Math.cos(a) * Math.cos(e) * sp * sec, 0.95 + Math.sin(e) * sp * sec - 2.2 * sec * sec, Math.sin(a) * Math.cos(e) * sp * sec * 0.6); dummy.rotation.set(sec * 8 * seed(i, 4), sec * 6, sec * 5); dummy.scale.setScalar(1 - age * age * 0.8); }
      else dummy.scale.setScalar(0.0001);
      dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix);
    }
    conf.instanceMatrix.needsUpdate = true;

    // camera: follows the tile, then settles on the logo
    const r = camRel(t), w = easeInOut(clamp((t - 7500) / 1200)), asp = W / H, cs = asp >= 1.3 ? 1 : clamp(Math.pow(1.78 / asp, 0.6), 1, 2.4);
    const px = lerp(S.x + r[0] * cs, 0, w), py = lerp(S.y + r[1] * cs, 1.3, w), pz = lerp(r[2] * cs, 9.2 * cs, w), lx = lerp(S.x + r[3], 0, w), ly = lerp(S.y + r[4], 0.45, w);
    cam.position.set(px, py, pz); cam.up.set(0, 1, 0); cam.lookAt(tmpV.set(lx, ly, 0)); cam.rotateZ(r[5] * (1 - w));

    composer.render(); renderer.autoClear = false; drawHud(t); renderer.render(hudScene, hudCam); renderer.autoClear = true;
  }

  function resize(w: number, h: number) {
    W = Math.max(2, Math.round(w)); H = Math.max(2, Math.round(h));
    renderer.setSize(W, H, false); composer.setSize(W, H); bloom.setSize(W, H); hudCv.width = W; hudCv.height = H; cam.aspect = W / H; cam.updateProjectionMatrix();
  }
  return {
    render, resize,
    setLang(l: Lang) { lang = l; }, setHint(v: boolean) { showHint = v; },
    dispose() { composer.dispose(); renderer.dispose(); renderer.forceContextLoss(); host.removeChild(renderer.domElement); },
  };
}
