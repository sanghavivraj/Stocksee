/**
 * The 3D stage of a Samajh Money Card story: Meera (the guide) on the left, the scene on the right.
 * Every mood changes her eyes, mouth, arms, body motion, the glow behind her and the weather together (inside ~300 ms).
 * The scene (a jar, bars, lines, a pile of units or the card's own 3D symbol) is told what to show; it never makes up numbers.
 * The colours here are fixed on purpose: a story does not follow the app's accent colour.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Mood = "calm" | "happy" | "proud" | "wow" | "worried";
export type Bar = { key: string; label: string; value: number; tone: string; text: string };
export type Line = { key: string; label: string; points: number[]; tone: string };
export type Visual =
  | { kind: "cover"; card: string }
  | { kind: "jar"; level: number }
  | { kind: "bars"; bars: Bar[]; scale?: number; dots?: { total: number; filled: number } }
  | { kind: "lines"; lines: Line[]; reveal?: number; mark?: { at: number; text: string } | null }
  | { kind: "swp"; level: number; taken: number; drop: number; pot: string; tray: string; earn: string; take: string }
  | { kind: "pile"; units: number[]; n: number }
  | { kind: "none" };

const GLOW: Record<Mood, string> = { calm: "#5aa9ff", happy: "#ffc83d", proud: "#3cd77f", wow: "#4fd1ff", worried: "#ff5a5a" };
const TONE: Record<string, number> = { a: 0x4aa3ff, b: 0x36d1b5, pos: 0x4ade80, neg: 0xff6b6b, sel: 0xffc83d, dim: 0x6b7690 };
const UNIT_COLS = [0x4aa3ff, 0x36d1b5, 0xffc83d, 0xff7a8a, 0x9bd16b, 0xf0a0ff];
type FP = { smile: number; mouthOpen: number; mouthO: number; dark: number; arc: number; wowE: number; scared: number; browTilt: number; browY: number; tear: number; arm: number; blush: number };
const FACE: Record<Mood, FP> = {
  calm: { smile: 0.35, mouthOpen: 0, mouthO: 0, dark: 1, arc: 0, wowE: 0, scared: 0, browTilt: 0, browY: 0, tear: 0, arm: 0.15, blush: 0.35 },
  happy: { smile: 0.9, mouthOpen: 0.25, mouthO: 0, dark: 0, arc: 1, wowE: 0, scared: 0, browTilt: 0.2, browY: -8, tear: 0, arm: 1.1, blush: 0.55 },
  proud: { smile: 1, mouthOpen: 0.85, mouthO: 0, dark: 0, arc: 1, wowE: 0, scared: 0, browTilt: 0.1, browY: -10, tear: 0, arm: 2.3, blush: 0.6 },
  wow: { smile: 0, mouthOpen: 0, mouthO: 1, dark: 0, arc: 0, wowE: 1, scared: 0, browTilt: 0.4, browY: -16, tear: 0, arm: 1.7, blush: 0.4 },
  worried: { smile: -0.7, mouthOpen: 0, mouthO: 0, dark: 0, arc: 0, wowE: 0, scared: 1, browTilt: -1, browY: 0, tear: 1, arm: 0.35, blush: 0.15 },
};
const FK = Object.keys(FACE.calm) as (keyof FP)[];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seed = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export class Stage3D {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  private host: HTMLElement; private raf = 0; private ro: ResizeObserver; private last = 0; private time = 0; private disposed = false;
  private mood: Mood = "calm"; private fp: FP = { ...FACE.calm }; private moodAt = 0;
  private meera = new THREE.Group(); private head = new THREE.Group(); private armL = new THREE.Group(); private armR = new THREE.Group();
  private faceCv = document.createElement("canvas"); private faceTex: THREE.CanvasTexture; private glowCol = new THREE.Color(GLOW.calm);
  private glowSprite: THREE.Sprite; private rim: THREE.PointLight;
  private vis = new THREE.Group(); private visual: Visual = { kind: "none" }; private visKey = "";
  private ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  private coins: THREE.InstancedMesh; private rain: THREE.InstancedMesh; private motes: THREE.Points; private motePos = new Float32Array(60 * 3); private dummy = new THREE.Object3D();
    // scene-specific animated state
  private jarFill?: THREE.Mesh; private jarLevel = 0; private jarTarget = 0;
  private barItems: { mesh: THREE.Mesh; name: THREE.Sprite; val: THREE.Sprite; cur: number; tar: number; w: number }[] = []; private dotMeshes: THREE.Mesh[] = [];
  private lineItems: { tube: THREE.Mesh; wall: THREE.Mesh; cur: number[]; tar: number[]; color: number; z: number }[] = []; private lineMax = 1;
  private pile?: THREE.InstancedMesh; private pileBirth: number[] = [];
  private cover?: THREE.Group;
  private swp?: { fill: THREE.Mesh; stack: THREE.Mesh; potSp: THREE.Sprite; traySp: THREE.Sprite; earnSp: THREE.Sprite; takeSp: THREE.Sprite; coins: { m: THREE.Mesh; t: number }[]; arrows: THREE.Group[]; last: number; lv: number; lvT: number; tr: number; trT: number };
  private lineReveal = 1; private lineRevealCur = 1; private markG?: THREE.Group; private markKey = ""; private markAt = 0; private markN = 2;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y";
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x070b16); this.scene.fog = new THREE.Fog(0x070b16, 14, 34);
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0x8fa4d8, 0x10162a, 0.7));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.7); key.position.set(3, 8, 9); this.scene.add(key);
    this.rim = new THREE.PointLight(0xffc83d, 18, 14, 1.6); this.scene.add(this.rim);
    // floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c1428, roughness: 0.35, metalness: 0.6 })); floor.position.y = -1.62; this.scene.add(floor);
    const grid = new THREE.GridHelper(32, 16, 0x1d2c52, 0x121b36); grid.position.y = -1.6; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.22; this.scene.add(grid);
    // glow behind Meera
    const g = document.createElement("canvas"); g.width = g.height = 256; const gx = g.getContext("2d")!; const gr = gx.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); gx.fillStyle = gr; gx.fillRect(0, 0, 256, 256);
    this.glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(g), color: this.glowCol, transparent: true, opacity: 0.55, depthWrite: false })); this.glowSprite.scale.set(9, 9, 1); this.glowSprite.position.set(-3.3, 1.2, -2); this.scene.add(this.glowSprite);

    // Meera
    this.faceCv.width = this.faceCv.height = 512; this.faceTex = new THREE.CanvasTexture(this.faceCv); this.faceTex.colorSpace = THREE.SRGBColorSpace; this.faceTex.anisotropy = 8;
    this.buildMeera(); this.meera.position.set(-3.3, -1.6, 0); this.scene.add(this.meera);
    this.vis.position.set(2.2, 0, 0); this.scene.add(this.vis);

    // weather
    this.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd35a, metalness: 1, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.5 }), 36); this.scene.add(this.coins);
    this.rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.5, 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.65, 1.3), transparent: true, opacity: 0.8 }), 70); this.scene.add(this.rain);
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(this.motePos, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xbcd0ff, size: 0.07, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); this.scene.add(this.motes);

    host.addEventListener("pointermove", (e) => { const r = host.getBoundingClientRect(); this.ptr.tx = ((e.clientX - r.left) / r.width - 0.5) * 2; this.ptr.ty = ((e.clientY - r.top) / r.height - 0.5) * 2; });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.raf = requestAnimationFrame((n) => { this.last = n; this.loop(n); });
  }

  /* ---------- public ---------- */
  setMood(m: Mood) { if (m !== this.mood) { this.mood = m; this.moodAt = this.time; } }
  setVisual(v: Visual) {
    const key = v.kind === "cover" ? "cover:" + v.card : v.kind === "bars" ? "bars:" + v.bars.map((b) => b.key).join(",") : v.kind === "lines" ? "lines:" + v.lines.map((l) => l.key + l.points.length).join(",") : v.kind === "pile" ? "pile" : v.kind;
    if (key !== this.visKey) { this.visKey = key; this.rebuild(v); }
    this.visual = v; this.applyVisual(v);
  }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); }

  /* ---------- layout ---------- */
  private resize() {
    const w = this.host.clientWidth || 640, h = this.host.clientHeight || 360, a = w / h;
    this.renderer.setSize(w, h, false); this.cam.aspect = a; this.cam.updateProjectionMatrix();
    const wide = a >= 1.5; this.camZ = wide ? 11 : 11 * Math.min(1.9, 1.5 / a);
    this.meera.position.x = wide ? -3.4 : -2.6; this.vis.position.x = wide ? 2.3 : 1.5; this.glowSprite.position.x = this.meera.position.x;
    this.meera.scale.setScalar(wide ? 1 : 0.85);
  }
  private camZ = 11;

  /* ---------- Meera ---------- */
  private buildMeera() {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffb938, roughness: 0.5, metalness: 0.2 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.65 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x1b1230, roughness: 0.45, metalness: 0.1 });
    const prof = [[0, 0], [0.85, 0], [0.8, 0.25], [0.62, 0.9], [0.42, 1.5], [0.3, 1.62], [0, 1.62]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), gold); body.position.y = 0.1; this.meera.add(body);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 32).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc97a12, roughness: 0.4 })); collar.position.y = 1.7; this.meera.add(collar);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.3, 16), skin); neck.position.y = 1.85; this.meera.add(neck);
    this.head.position.y = 2.55; this.meera.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 40, 32), skin); skull.scale.set(1, 1.08, 0.96); this.head.add(skull);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.66, 32, 24), hair); back.scale.set(1, 1.1, 0.9); back.position.set(0, 0.04, -0.12); this.head.add(back);
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.655, 32, 16, 0, Math.PI * 2, 0, 1.0), hair); fringe.scale.set(1, 1.1, 0.98); fringe.rotation.x = -0.28; this.head.add(fringe);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), hair); bun.position.set(0, 0.78, -0.18); this.head.add(bun);
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffb938, metalness: 1, roughness: 0.25 })); e.position.set(s * 0.6, -0.12, 0.08); this.head.add(e); });
    // the face, curved around the front of the head
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.625, 40, 32, Math.PI / 2 - 0.78, 1.56, Math.PI / 2 - 0.62, 1.2), new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    patch.scale.set(1, 1.08, 0.96); this.head.add(patch);
    // arms (pivot at the shoulder)
    ([[this.armL, -1], [this.armR, 1]] as [THREE.Group, number][]).forEach(([pv, s]) => {
      pv.position.set(s * 0.62, 1.45, 0.05); const ag = new THREE.CapsuleGeometry(0.13, 0.62, 6, 14); ag.translate(0, -0.45, 0);
      pv.add(new THREE.Mesh(ag, gold)); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skin); hand.position.y = -0.98; pv.add(hand); this.meera.add(pv);
    });
  }
  private drawFace(p: FP, t: number) {
    const c = this.faceCv.getContext("2d")!; c.clearRect(0, 0, 512, 512); c.lineCap = "round"; c.lineJoin = "round";
    const ink = "#1b1230", blink = (t % 3.2) > 3.05 ? 0.15 : 1;
    c.fillStyle = `rgba(255,122,107,${0.5 * p.blush})`; [[112, 318], [400, 318]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 42, 24, 0, 0, 7); c.fill(); });
    c.strokeStyle = ink; c.lineWidth = 14; const by = 150 + p.browY;
    [172, 340].forEach((cx) => { const d = cx < 256 ? 1 : -1; c.beginPath(); c.moveTo(cx - d * 46, by - p.browTilt * 10); c.lineTo(cx + d * 46, by + p.browTilt * 22); c.stroke(); });
    const cy = 238;
    [172, 340].forEach((cx) => {
      if (p.dark > 0.01) { c.globalAlpha = p.dark; c.fillStyle = ink; c.beginPath(); c.ellipse(cx, cy, 30, 40 * blink, 0, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(cx + 8, cy - 14, 9, 0, 7); c.fill(); }
      if (p.wowE > 0.01) { c.globalAlpha = p.wowE; c.fillStyle = "#fff"; c.strokeStyle = ink; c.lineWidth = 8; c.beginPath(); c.ellipse(cx, cy - 4, 42, 52, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = ink; c.beginPath(); c.arc(cx, cy, 15, 0, 7); c.fill(); }
      if (p.scared > 0.01) { c.globalAlpha = p.scared; c.fillStyle = ink; c.beginPath(); c.arc(cx + Math.sin(t * 3) * 3, cy + 6, 25, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(cx + 8, cy - 4, 8, 0, 7); c.fill(); }
      if (p.arc > 0.01) { c.globalAlpha = p.arc; c.strokeStyle = ink; c.lineWidth = 15; c.beginPath(); c.arc(cx, cy + 22, 40, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); }
    });
    c.globalAlpha = 1; c.strokeStyle = "#5a1f1a"; c.lineWidth = 14; const my = 372, x0 = 205, x1 = 307;
    if (p.mouthO > 0.01) { c.globalAlpha = p.mouthO; c.fillStyle = "#5a1f1a"; c.beginPath(); c.ellipse(256, my + 8, 24, 32, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    if (p.mouthOpen > 0.05) { c.fillStyle = "#5a1f1a"; c.globalAlpha = clamp(p.mouthOpen * 1.3); c.beginPath(); c.moveTo(x0 - 6, my); c.quadraticCurveTo(256, my + 10, x1 + 6, my); c.quadraticCurveTo(256, my + p.smile * 80 + p.mouthOpen * 50, x0 - 6, my); c.fill(); c.globalAlpha = 1; }
    if (p.mouthO < 0.6) { c.globalAlpha = 1 - p.mouthO; c.beginPath(); c.moveTo(x0, my); c.quadraticCurveTo(256 + Math.sin(t * 40) * p.scared * 3, my + p.smile * 74, x1, my); c.stroke(); c.globalAlpha = 1; }
    if (p.tear > 0.02) { const dy = ((t * 70) % 60) * p.tear; c.fillStyle = `rgba(122,167,255,${0.9 * p.tear})`; c.beginPath(); c.moveTo(118, 292 + dy); c.quadraticCurveTo(138, 330 + dy, 118, 342 + dy); c.quadraticCurveTo(98, 330 + dy, 118, 292 + dy); c.fill(); }
    this.faceTex.needsUpdate = true;
  }

  /* ---------- scene visuals ---------- */
  private clearVis() { while (this.vis.children.length) { const o = this.vis.children[0]; this.vis.remove(o); o.traverse((x: any) => { x.geometry?.dispose?.(); }); } this.barItems = []; this.dotMeshes = []; this.lineItems = []; this.jarFill = undefined; this.pile = undefined; this.cover = undefined; this.swp = undefined; this.markG = undefined; this.markKey = ""; }
  private texCache = new Map<string, any>();
  private text(txt: string, o: { size?: number; color?: string; weight?: number; wrap?: boolean; top?: boolean } = {}) {
    const key = txt + "|" + (o.color || "") + (o.size || "") + (o.wrap ? "w" : ""); let e = this.texCache.get(key);
    if (!e) {
      let lines = [txt];
      if (o.wrap && txt.length > 12) { const mid = txt.length / 2; let at = -1; for (let i = 0; i < txt.length; i++) if (txt[i] === " " && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i; if (at > 0) lines = [txt.slice(0, at), txt.slice(at + 1)]; }
      const size = o.size || 0.36, cv = document.createElement("canvas"), c = cv.getContext("2d")!, f = `${o.weight || 700} 64px Inter,'Noto Sans Devanagari',system-ui,sans-serif`, H = 96 * lines.length;
      c.font = f; const w = Math.max(40, Math.ceil(Math.max(...lines.map((l) => c.measureText(l).width))) + 20); cv.width = w; cv.height = H; c.font = f; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = o.color || "#fff"; c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 10;
      lines.forEach((l, i) => c.fillText(l, w / 2, 50 + i * 80));
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; e = { tex, w, size, h: lines.length === 1 ? 96 : 96 + 80 * (lines.length - 1) } as any; (e as any).cvH = H; this.texCache.set(key, e as any);
    }
    const ee = e as any; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ee.tex, transparent: true, depthWrite: false, depthTest: !o.top })); if (o.top) s.renderOrder = 10; s.scale.set((ee.w / 96) * ee.size * 1.5, (ee.cvH / 96) * ee.size * 1.5, 1); return s;
  }
  private rebuild(v: Visual) {
    this.clearVis();
    if (v.kind === "cover") { this.cover = buildProp(v.card); this.vis.add(this.cover); }
    if (v.kind === "jar") {
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.05, 3.3, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
      glass.position.y = 0.05; this.vis.add(glass);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x2a3a66, metalness: 0.6, roughness: 0.3 })); base.position.y = -1.65; this.vis.add(base);
      const lid = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 10, 48).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9d6ff, metalness: 0.9, roughness: 0.25 })); lid.position.y = 1.7; this.vis.add(lid);
      const geo = new THREE.CylinderGeometry(1.0, 0.93, 1, 40); geo.translate(0, 0.5, 0);
      this.jarFill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xb07a00, emissiveIntensity: 0.55, metalness: 0.6, roughness: 0.3, transparent: true, opacity: 0.92 })); this.jarFill.position.y = -1.55; this.vis.add(this.jarFill);
      this.jarLevel = 0;
    }
    if (v.kind === "bars") {
      const n = v.bars.length, w = n > 4 ? 0.8 : 1.0;
      v.bars.forEach((b, i) => {
        const m = new THREE.Mesh(new RoundedBoxGeometry(w, 1, w, 4, 0.12), new THREE.MeshStandardMaterial({ color: TONE[b.tone] ?? 0x4aa3ff, roughness: 0.28, metalness: 0.35, emissive: TONE[b.tone] ?? 0x4aa3ff, emissiveIntensity: 0.12 }));
        const x = (i - (n - 1) / 2) * (n > 4 ? 1.25 : 1.6); m.position.x = x; m.position.z = 0; this.vis.add(m);
        const name = this.text(b.label, { size: 0.24, color: "#e3e9fb", weight: 600, wrap: true, top: true }); const mw = n > 4 ? 1.25 : 1.6; if (name.scale.x > mw) name.scale.multiplyScalar(mw / name.scale.x); name.position.set(x, -1.92, 1.1); this.vis.add(name);
        const val = this.text(b.text, { size: 0.26, wrap: true, top: true }); if (val.scale.x > 1.5) val.scale.multiplyScalar(1.5 / val.scale.x); val.position.set(x, 0, 0.2); this.vis.add(val);
        this.barItems.push({ mesh: m, name, val, cur: 0.001, tar: 1, w });
      });
      if (v.dots) for (let i = 0; i < v.dots.total; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), new THREE.MeshStandardMaterial({ color: 0x3a4666, roughness: 0.4 })); d.position.set((i - (v.dots.total - 1) / 2) * 0.5, 2.75, 0); this.vis.add(d); this.dotMeshes.push(d); }
    }
    if (v.kind === "lines") {
      for (let g = 0; g <= 3; g++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x2a3a66 })); gl.position.set(0, -1.5 + g * 1.25, -0.2); this.vis.add(gl); }
      v.lines.forEach((l, k) => {
        const color = TONE[l.tone] ?? 0x4aa3ff;
        const tube = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 }));
        const wall = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
        tube.position.z = wall.position.z = k * 0.35; this.vis.add(wall, tube); this.lineItems.push({ tube, wall, cur: l.points.map(() => 0), tar: l.points, color, z: k * 0.35 });
        const lab = this.text(l.label, { size: 0.2, color: "#" + color.toString(16).padStart(6, "0"), weight: 700 }); lab.position.set(-2.6 + k * 2.6, 2.95, 0.3); this.vis.add(lab);
      });
    }
    if (v.kind === "swp") {
      const jx = -1.5, tx = 1.9, gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, emissive: 0xb07a00, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3 });
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.05, 3.3, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); glass.position.set(jx, 0.05, 0); this.vis.add(glass);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x2a3a66, metalness: 0.6, roughness: 0.3 })); base.position.set(jx, -1.65, 0); this.vis.add(base);
      const geo = new THREE.CylinderGeometry(1.0, 0.93, 1, 40); geo.translate(0, 0.5, 0); const fill = new THREE.Mesh(geo, gold.clone()); fill.position.set(jx, -1.55, 0); this.vis.add(fill);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9d6ff, metalness: 0.9, roughness: 0.25 })); pipe.position.set(jx + 1.7, -0.95, 0); this.vis.add(pipe);
      const tray = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 1.4), new THREE.MeshStandardMaterial({ color: 0x2a3a66, metalness: 0.5, roughness: 0.4 })); tray.position.set(tx, -1.56, 0); this.vis.add(tray);
      const sg = new THREE.CylinderGeometry(0.62, 0.62, 1, 32); sg.translate(0, 0.5, 0); const stack = new THREE.Mesh(sg, gold.clone()); stack.position.set(tx, -1.5, 0); this.vis.add(stack);
      const arrow = (col: number, up: boolean, x: number, y: number, rz = 0) => { const gr = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 }); const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 12), m); const hd = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 16), m); sh.position.y = -0.1; hd.position.y = 0.3; gr.add(sh, hd); gr.rotation.z = (up ? 0 : Math.PI) + rz; gr.position.set(x, y, 0.4); this.vis.add(gr); return gr; };
      const ea = arrow(0x4ade80, true, jx - 1.6, 0.4); const ta = arrow(0xff6b6b, true, jx + 1.25, -0.5, -Math.PI / 2);
      const sp = (x: number, y: number, size: number, top = true) => { const t = this.text(" ", { size, top }); t.position.set(x, y, 0.5); this.vis.add(t); return t; };
      const coins = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd35a, metalness: 1, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.6 })); m.visible = false; this.vis.add(m); return { m, t: -1 }; });
      this.swp = { fill, stack, potSp: sp(jx, 2.2, 0.34), traySp: sp(tx, 0.4, 0.3), earnSp: sp(jx - 1.75, 1.15, 0.24), takeSp: sp(jx + 1.8, -0.05, 0.24), coins, last: 0, lv: 1, lvT: 1, tr: 0, trT: 0, arrows: [ea, ta] };
    }
    if (v.kind === "pile") {
      this.pile = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 18, 14), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.4 }), 220); this.pile.position.set(-1.9, -1.45, 0); this.vis.add(this.pile);
      this.pileBirth = new Array(220).fill(0);
    }
  }
  private applyVisual(v: Visual) {
    if (v.kind === "jar") this.jarTarget = clamp(v.level);
    if (v.kind === "bars") {
      const max = v.scale || Math.max(...v.bars.map((b) => b.value), 1);
      v.bars.forEach((b, i) => { const it = this.barItems[i]; if (!it) return; it.tar = Math.max(0.04, clamp(b.value / max, 0, 1.15) * 3.4); (it.mesh.material as THREE.MeshStandardMaterial).color.setHex(TONE[b.tone] ?? 0x4aa3ff); (it.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(TONE[b.tone] ?? 0x4aa3ff);
        const nv = this.text(b.text, { size: 0.26, wrap: true, top: true }); (it.val.material as THREE.SpriteMaterial).map = (nv.material as THREE.SpriteMaterial).map; it.val.scale.copy(nv.scale); if (it.val.scale.x > 1.5) it.val.scale.multiplyScalar(1.5 / it.val.scale.x); });
      if (v.dots) this.dotMeshes.forEach((d, i) => { const on = i < v.dots!.filled; (d.material as THREE.MeshStandardMaterial).color.setHex(on ? 0xffc83d : 0x3a4666); (d.material as THREE.MeshStandardMaterial).emissive.setHex(on ? 0xb07a00 : 0); (d.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.8 : 0; });
    }
    if (v.kind === "swp" && this.swp) {
      const w = this.swp; w.lvT = clamp(v.level); w.trT = clamp(v.taken); w.arrows.forEach((a) => (a.visible = !!v.earn));
      const set = (sp: THREE.Sprite, t: string, o: any) => { const n = this.text(t || " ", { ...o, top: true }); (sp.material as THREE.SpriteMaterial).map = (n.material as THREE.SpriteMaterial).map; sp.scale.copy(n.scale); };
      set(w.potSp, v.pot, { size: 0.34 }); set(w.traySp, v.tray, { size: 0.3, color: "#ffd866" }); set(w.earnSp, v.earn, { size: 0.22, color: "#8df0b0" }); set(w.takeSp, v.take, { size: 0.22, color: "#ff9a9a" });
      if (v.drop > w.last) { const c = w.coins.find((q) => q.t < 0); if (c) c.t = 0; } w.last = v.drop;
    }
    if (v.kind === "lines") {
      this.lineReveal = v.reveal ?? 1; if (v.reveal === undefined) this.lineRevealCur = 1;
      const key = v.mark ? v.mark.at + v.mark.text : "";
      if (key !== this.markKey) {
        if (this.markG) { this.vis.remove(this.markG); this.markG = undefined; } this.markKey = key;
        if (v.mark) { const n = v.lines[0].points.length; this.markN = n; this.markAt = v.mark.at; const x = -3.4 + (v.mark.at / Math.max(1, n - 1)) * 6.8, g = new THREE.Group();
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 3.6, 0.03), new THREE.MeshBasicMaterial({ color: 0xff6b6b })); bar.position.set(x, 0.3, 0.2); const lb = this.text(v.mark.text, { size: 0.26, color: "#ffb3b3", wrap: true, top: true }); lb.position.set(Math.max(-2.4, x - 1.3), 1.9, 0.4); g.add(bar, lb); g.visible = false; this.vis.add(g); this.markG = g; }
      }
      this.lineMax = Math.max(...v.lines.flatMap((l) => l.points), 1) * 1.05;
      v.lines.forEach((l, i) => { const it = this.lineItems[i]; if (!it) return; it.tar = l.points; if (it.cur.length !== l.points.length) it.cur = l.points.map(() => 0); });
    }
    if (v.kind === "pile" && this.pile) {
      let idx = 0; const cols = 11;
      v.units.slice(0, v.n).forEach((u, k) => {
        const cnt = Math.max(1, Math.round(u / 2.4)); const col = new THREE.Color(UNIT_COLS[k % 6]);
        for (let d = 0; d < cnt && idx < 220; d++, idx++) { if (!this.pileBirth[idx]) this.pileBirth[idx] = this.time; this.pile!.setColorAt(idx, col); (this.pile as any).userData[idx] = [idx % cols, Math.floor(idx / cols)]; }
      });
      (this.pile as any).userData.count = idx; if (this.pile.instanceColor) this.pile.instanceColor.needsUpdate = true;
      for (let i = idx; i < 220; i++) this.pileBirth[i] = 0;
    }
  }
  private updateLine(it: Stage3D["lineItems"][number], dt: number) {
    let moving = false; const n = it.tar.length;
    for (let i = 0; i < n; i++) { const d = it.tar[i] - it.cur[i]; if (Math.abs(d) > this.lineMax * 0.0015) moving = true; it.cur[i] += d * (1 - Math.exp(-dt * 7)); }
    const shown = Math.max(2, Math.min(n, Math.round(this.lineRevealCur * (n - 1)) + 1)), ud = it.tube.geometry.userData as any;
    if (!moving && ud.ok && ud.shown === shown) return;
    const pts = it.cur.slice(0, shown).map((v, i) => new THREE.Vector3(-3.4 + (i / Math.max(1, n - 1)) * 6.8, -1.5 + (v / this.lineMax) * 3.75, 0));
    if (pts.length < 2) return;
    it.tube.geometry.dispose(); it.tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.min(300, shown * 3), 0.055, 8); (it.tube.geometry.userData as any) = { ok: true, shown };
    const m = pts.length, pos = new Float32Array(m * 6), idx: number[] = [];
    pts.forEach((p, i) => { pos.set([p.x, p.y, 0, p.x, -1.5, 0], i * 6); if (i < m - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    it.wall.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); it.wall.geometry = g;
  }

  /* ---------- the loop ---------- */
  private loop = (now: number) => {
    if (this.disposed) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt; const t = this.time;
    // mood: every part moves together inside ~300 ms
    const tgt = FACE[this.mood], k = 1 - Math.exp(-dt * 12); FK.forEach((n) => { this.fp[n] += (tgt[n] - this.fp[n]) * k; });
    this.drawFace(this.fp, t);
    const m = this.mood, since = t - this.moodAt;
    let bob = Math.sin(t * 1.6) * 0.03, sway = 0, shake = 0, jump = 0;
    if (m === "happy") { bob = Math.abs(Math.sin(t * 5)) * 0.18; sway = Math.sin(t * 2.5) * 0.12; }
    if (m === "proud") { bob = Math.abs(Math.sin(t * 3)) * 0.1; sway = Math.sin(t * 1.4) * 0.18; }
    if (m === "wow") { jump = Math.max(0, 1 - since * 2.2) * 0.9; bob = Math.abs(Math.sin(t * 6)) * 0.06; }
    if (m === "worried") { shake = Math.sin(t * 40) * 0.025; bob = -0.04; }
    this.meera.position.y = -1.6 + bob + jump; this.meera.rotation.y = 0.18 + sway + this.ptr.x * 0.25 + shake; this.head.rotation.y = this.ptr.x * 0.35; this.head.rotation.x = this.ptr.y * 0.18 + (m === "worried" ? 0.12 : 0);
    const flap = m === "happy" || m === "proud" ? Math.sin(t * 7) * 0.18 : 0;
    this.armL.rotation.z = -(this.fp.arm + flap); this.armR.rotation.z = this.fp.arm + (m === "happy" ? Math.sin(t * 7 + 1) * 0.18 : flap);
    this.glowCol.lerp(new THREE.Color(GLOW[m]), k); (this.glowSprite.material as THREE.SpriteMaterial).color.copy(this.glowCol); (this.glowSprite.material as THREE.SpriteMaterial).opacity = 0.42 + Math.sin(t * 2) * 0.06;
    this.rim.color.copy(this.glowCol); this.rim.position.set(this.meera.position.x + 1.6, 2.4, 2.4);

    // weather
    const up = m === "happy" || m === "proud" || m === "wow", rainy = m === "worried";
    for (let i = 0; i < 36; i++) { const age = ((t * 0.5 + i / 36) % 1); this.dummy.position.set(this.meera.position.x + (seed(i, 1) - 0.5) * 3.2, -0.6 + age * 4.2, (seed(i, 2) - 0.2) * 1.2); this.dummy.rotation.set(t * 3 + i, t * 2, 0); this.dummy.scale.setScalar(up ? Math.sin(age * Math.PI) : 0.0001); this.dummy.updateMatrix(); this.coins.setMatrixAt(i, this.dummy.matrix); }
    this.coins.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 70; i++) { const age = ((t * 0.9 + seed(i, 3)) % 1); this.dummy.position.set(-7 + seed(i, 4) * 14, 5 - age * 7.5, (seed(i, 5) - 0.5) * 5); this.dummy.rotation.set(0, 0, 0.1); this.dummy.scale.setScalar(rainy ? 1 : 0.0001); this.dummy.updateMatrix(); this.rain.setMatrixAt(i, this.dummy.matrix); }
    this.rain.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 60; i++) this.motePos.set([-6 + seed(i, 6) * 12 + Math.sin(t * 0.4 + i) * 0.3, -1 + ((seed(i, 7) * 6 + t * 0.15) % 6), (seed(i, 8) - 0.5) * 6], i * 3);
    (this.motes.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (this.motes.material as THREE.PointsMaterial).opacity = m === "calm" ? 0.7 : 0.25;

    // scene
    if (this.jarFill) { this.jarLevel += (this.jarTarget - this.jarLevel) * (1 - Math.exp(-dt * 6)); this.jarFill.scale.y = Math.max(0.001, this.jarLevel * 3.15); }
    this.barItems.forEach((b) => { b.cur += (b.tar - b.cur) * (1 - Math.exp(-dt * 8)); b.mesh.scale.y = b.cur; b.mesh.position.y = -1.55 + b.cur / 2; b.val.position.y = -1.55 + b.cur + 0.32; });
    this.lineRevealCur += (this.lineReveal - this.lineRevealCur) * (1 - Math.exp(-dt * 8)); if (Math.abs(this.lineReveal - this.lineRevealCur) < 0.002) this.lineRevealCur = this.lineReveal;
    this.lineItems.forEach((l) => this.updateLine(l, dt));
    if (this.markG) this.markG.visible = this.lineRevealCur * (this.markN - 1) >= this.markAt - 0.02;
    if (this.swp) {
      const w = this.swp; w.lv += (w.lvT - w.lv) * (1 - Math.exp(-dt * 5)); w.tr += (w.trT - w.tr) * (1 - Math.exp(-dt * 5));
      w.fill.scale.y = Math.max(0.001, w.lv * 3.15); const h = w.tr * 1.7 + 0.03; w.stack.scale.y = h; w.traySp.position.y = -1.5 + h + 0.45;
      w.coins.forEach((c, i) => { if (c.t < 0) { c.m.visible = false; return; } c.t += dt; const q = c.t / 0.8; if (q >= 1) { c.t = -1; c.m.visible = false; return; } c.m.visible = true; c.m.position.set(0.85 + q * 1.05, -0.95 + Math.sin(q * Math.PI) * 0.5 - q * (0.5 + h), 0.1); c.m.rotation.y = q * 9; c.m.rotation.x = q * 3 + i; });
    }
    if (this.pile && (this.pile as any).userData.count) {
      const cnt = (this.pile as any).userData.count as number;
      for (let i = 0; i < 220; i++) {
        const ud = (this.pile as any).userData[i]; const age = this.pileBirth[i] ? clamp((t - this.pileBirth[i]) / 0.4) : 0;
        this.dummy.position.set(ud ? ud[0] * 0.36 : 0, ud ? ud[1] * 0.34 : 0, 0); this.dummy.scale.setScalar(i < cnt && ud ? 0.2 + 0.8 * (1 - Math.pow(1 - age, 3)) : 0.0001); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix(); this.pile.setMatrixAt(i, this.dummy.matrix);
      }
      this.pile.instanceMatrix.needsUpdate = true;
    }
    if (this.cover) { this.cover.rotation.y = t * 0.5; this.cover.position.y = Math.sin(t * 1.2) * 0.08; }

    // camera: looks at the middle of the stage, drifts a little with the pointer
    this.ptr.x += (this.ptr.tx - this.ptr.x) * 0.06; this.ptr.y += (this.ptr.ty - this.ptr.y) * 0.06;
    this.cam.position.set(0.3 + this.ptr.x * 0.8, 1.5 - this.ptr.y * 0.4, this.camZ); this.cam.lookAt(0.2, 0.6, 0);
    this.renderer.render(this.scene, this.cam); this.raf = requestAnimationFrame(this.loop);
  };
}

/* ---------- each Money Card's own 3D symbol ---------- */
function buildProp(id: string): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.9, roughness: 0.25 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xdfe6f7, roughness: 0.5, metalness: 0.1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.25, roughness: 0.05, clearcoat: 1 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  if (id === "fd") { add(new THREE.BoxGeometry(3.2, 0.25, 1.6), stone, 0, -1.2); for (let i = -1.2; i <= 1.3; i += 0.8) add(new THREE.CylinderGeometry(0.17, 0.17, 1.9, 16), stone, i, -0.1); add(new THREE.BoxGeometry(3.2, 0.2, 1.6), stone, 0, 0.95); add(new THREE.ConeGeometry(2.0, 0.9, 3).rotateY(Math.PI / 2), gold, 0, 1.5).scale.set(1, 1, 0.9); }
  else if (id === "sip") { for (let i = 0; i < 6; i++) for (let j = 0; j <= i; j++) add(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 24), gold, -2 + i * 0.8, -1.3 + j * 0.13, 0); }
  else if (id === "swp") { add(new THREE.CylinderGeometry(1.0, 0.95, 2.4, 32, 1, true), glass, 0, -0.1); const l = add(new THREE.CylinderGeometry(0.9, 0.86, 1.2, 32), gold, 0, -0.7); (l.material as THREE.MeshStandardMaterial).opacity = 1; for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20).rotateX(Math.PI / 2), gold, 1.6, -1.2 + i * 0.6, 0.2 * i); }
  else if (id === "stocks") { [[-1.5, 1.2, 0.9], [-0.5, 2.0, 1.4], [0.5, 1.4, 1.0], [1.5, 2.8, 1.8]].forEach(([x, h, w], i) => { const col = i % 2 ? 0xff6b6b : 0x4ade80; add(new THREE.BoxGeometry(0.55, h, 0.55), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.18, roughness: 0.3 }), x, -1.5 + h / 2); add(new THREE.CylinderGeometry(0.03, 0.03, h + w * 0.6, 8), stone, x, -1.5 + h / 2); }); }
  else if (id === "mutual-funds") { add(new THREE.BoxGeometry(3, 0.12, 2), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.7 }), 0, -1.2); [-1.5, 1.5].forEach((x) => add(new THREE.BoxGeometry(0.1, 1.1, 2), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.7 }), x, -0.65)); for (let i = 0; i < 9; i++) add(new THREE.SphereGeometry(0.3, 20, 16), new THREE.MeshStandardMaterial({ color: UNIT_COLS[i % 6], roughness: 0.3, metalness: 0.3 }), -1 + (i % 3) * 1, -0.8 + Math.floor(i / 3) * 0.55, -0.4 + (i % 2) * 0.7); }
  else if (id === "etf") { add(new THREE.BoxGeometry(3, 0.12, 2), new THREE.MeshStandardMaterial({ color: 0x6a7a9a, roughness: 0.5 }), 0, -1.2); for (let i = 0; i < 8; i++) add(new RoundedBoxGeometry(0.62, 0.62, 0.62, 3, 0.08), new THREE.MeshStandardMaterial({ color: UNIT_COLS[i % 6], roughness: 0.3, metalness: 0.4 }), -1 + (i % 3) * 0.95, -0.8 + Math.floor(i / 3) * 0.7, -0.4 + (i % 2) * 0.8); }
  else if (id === "gold") { for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - r; c++) add(new RoundedBoxGeometry(1.2, 0.5, 0.7, 3, 0.07), gold, (c - (2 - r) / 2) * 1.3, -1.3 + r * 0.55, 0); }
  else if (id === "ppf") { const pink = new THREE.MeshStandardMaterial({ color: 0xff9ab0, roughness: 0.4 }); const b = add(new THREE.SphereGeometry(1.2, 32, 24), pink, 0, -0.2); b.scale.set(1.2, 1, 1); add(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 20).rotateZ(Math.PI / 2), pink, 1.4, -0.1); add(new THREE.ConeGeometry(0.28, 0.4, 4), pink, 0.55, 1.0, 0.45); add(new THREE.ConeGeometry(0.28, 0.4, 4), pink, 0.55, 1.0, -0.45); [-0.6, 0.6].forEach((x) => [-0.5, 0.5].forEach((z) => add(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 12), pink, x, -1.3, z))); add(new THREE.BoxGeometry(0.7, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: 0x5a1f1a }), 0, 0.82); add(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 24).rotateX(Math.PI / 2), gold, 0, 1.4, 0); }
  else add(new THREE.IcosahedronGeometry(1.2, 1), gold);
  return g;
}
