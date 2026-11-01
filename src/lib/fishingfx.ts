/* 낚시 연출 — 찌 · 줄 · 낚싯대 · 물보라 · 물고기 그림자 · 빛줄기를 캔버스 한 장에 직접 그린다.
 * 규칙은 lib/fishing(순수) 몫이고 여기엔 판정이 없다 — 화면이 view 와 사건(cast · hook · surge …)을 넘겨 주면 그리기만 한다.
 * 이미지 파일을 쓰지 않는 이유: 낚싯대가 장력만큼 휘고, 줄이 떨리고, 물고기가 꼬리를 치는 건 그림 한 장으로 안 된다.
 * ⚠ shadowBlur · ctx.filter 금지 — 폰에서 프레임이 무너지고 filter 는 사파리에 없다. 부드러움은 겹쳐 그리기와 그라디언트로 낸다.
 * ⚠ 시간은 frame(ms) 로만 받는다 — 시계를 직접 읽으면 테스트가 프레임을 못 돌린다(fishingfx.test 가 전 사건을 돌린다). */

export type FxPhase = "ready" | "charge" | "wait" | "bite" | "fight" | "landed" | "scoop" | "result" | "lost";
export type FxLost = "early" | "late" | "snapped" | "slack" | "escaped";
export type FxView = { phase: FxPhase; charge: number; tension: number; dist: number; holding: boolean; rod: string; spot: string };

type SpotLook = { horizon: number; glint: string; air: "petal" | "mote" | "lantern" | "star" | "bird" };
/** 수평선(그림마다 재서 적었다) · 물빛 반짝임 색 · 공중에 떠다니는 것 */
export const FX_SPOTS: Readonly<Record<string, SpotLook>> = {
  brook: { horizon: 0.29, glint: "#ffffff", air: "petal" },
  pond: { horizon: 0.28, glint: "#ffe3a8", air: "petal" },
  jungle: { horizon: 0.29, glint: "#fff6c8", air: "mote" },
  reef: { horizon: 0.24, glint: "#ffffff", air: "bird" },
  ocean: { horizon: 0.33, glint: "#fff1d0", air: "bird" },
  palace: { horizon: 0.26, glint: "#ffd28a", air: "lantern" },
  starsea: { horizon: 0.37, glint: "#cfe0ff", air: "star" },
};

type RodLook = { butt: string; tip: string; wrap: string; grip: string; reel: string; spark?: string };
/** 장비 그림과 같은 색 — 산 낚싯대가 낚시터에서 그대로 보이게 */
export const FX_RODS: Readonly<Record<string, RodLook>> = {
  rod_bamboo: { butt: "#a9742f", tip: "#d8b06a", wrap: "#6f431a", grip: "#6b3f17", reel: "#8a5a2b" },
  rod_glass: { butt: "#6fb0d8", tip: "#d6eefb", wrap: "#eef7ff", grip: "#2b3138", reel: "#c4ccd4" },
  rod_carbon: { butt: "#1d2025", tip: "#4a4f58", wrap: "#c8312f", grip: "#121417", reel: "#8d1f1f" },
  rod_titan: { butt: "#7f848c", tip: "#d5d9de", wrap: "#d4a843", grip: "#26231d", reel: "#c9a13f" },
  rod_dragon: { butt: "#dcd0ac", tip: "#f7f0db", wrap: "#2fa36b", grip: "#8c7a4d", reel: "#2fbf7f" },
  rod_star: { butt: "#1b1b56", tip: "#5252c4", wrap: "#bcd2ff", grip: "#131338", reel: "#9fc0ff", spark: "#e6eeff" },
};

/** 등급(0~7)별 빛 — 물고기를 끌어올릴 때의 빛줄기 · 귀한 놈의 그림자 기운 · 축포 */
export const FX_GRADE_LIGHT: readonly string[] = ["#bfe6ff", "#a7f3d0", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fcd34d", "#fb923c", "#f0abfc"];

/** 찌가 떨어지는 자리(화면 비율) — 잘 던질수록 멀리 간다 */
export function landingPoint(bonus: number, r: number): { x: number; y: number } {
  const far = bonus >= 1 ? 1 : bonus <= 0 ? 0.25 : 0.65;
  return { x: 0.32 + r * 0.2, y: 0.66 - far * 0.2 };
}

type Drop = { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; r: number; floor: number; color: string; kind: "drop" | "spark" | "paper"; spin: number };
type Ring = { x: number; y: number; r: number; vr: number; life: number; max: number; delay: number; lw: number; color: string };
type Foam = { x: number; y: number; r: number; life: number; max: number };
type Leap = { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; h: number };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const MAX_DROPS = 240;
const MAX_RINGS = 40;
const MAX_FOAM = 70;

/** #rrggbb 두 색 사이 */
function mix(a: string, b: string, k: number): string {
  const n = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const c = (i: number) => Math.round(lerp(n(a, i), n(b, i), k)).toString(16).padStart(2, "0");
  return `#${c(1)}${c(3)}${c(5)}`;
}
function alpha(hex: string, a: number): string {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `rgba(${n(1)},${n(3)},${n(5)},${clamp(a, 0, 1)})`;
}

export type FxCanvas = { width: number; height: number; getContext(k: "2d"): CanvasRenderingContext2D | null };

export class FishFx {
  private ctx: CanvasRenderingContext2D | null;
  private canvas: FxCanvas;
  private host: { style: { translate: string } } | null;
  private W = 360;
  private H = 450;
  private u = 1;
  private t = 0;
  private seed = 1234567;
  private view: FxView = { phase: "ready", charge: 0, tension: 0.3, dist: 1, holding: false, rod: "rod_bamboo", spot: "brook" };
  private reduced = false;

  private drops: Drop[] = [];
  private rings: Ring[] = [];
  private foam: Foam[] = [];
  private spec: { x: number; y: number; f: number; p: number; s: number }[] = [];
  private streaks: { x: number; y: number; w: number; v: number; p: number }[] = [];
  private air: { x: number; y: number; vx: number; vy: number; p: number; s: number }[] = [];
  private lookKey = "";

  private rodAng = 0.5;
  private rodVel = 0;
  private rodKick = 0;
  private bend = 0;
  private reelAng = 0;
  private hang = { x: 0, y: 0, vx: 0, vy: 0, init: false };

  private bob = { on: false, x: 0, y: 0, sink: 0.25, sinkTo: 0.25, dip: 0, home: { x: 0, y: 0 } };
  private fly: { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; size: number } | null = null;
  private fish = { on: false, x: 0, y: 0, vx: 0, vy: 0, h: 0, wag: 0, fade: 1, mode: "none" as "none" | "circle" | "bite" | "fight" | "flee", ang: 0, t0: 0, waitS: 3, size: 0.4, grade: 0, darts: 0 };
  private leap: Leap | null = null;
  private surgeOn = 0;
  private surgeCount = 0;
  private surgeDir = 1;
  private nextThrash = 0;
  private nextBiteRipple = 0;
  private biteClock: { t0: number; dur: number } | null = null;

  private shake = 0;
  private stopT = 0;
  private flash = { a: 0, color: "#ffffff" };
  private rays = { a: 0, to: 0, color: "#bfe6ff" };
  private snap: { t0: number; x0: number; y0: number; x1: number; y1: number } | null = null;
  private raf = 0;
  private last = 0;
  private ro: { disconnect(): void } | null = null;

  constructor(canvas: FxCanvas, host: { style: { translate: string } } | null = null, reduced = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.host = host;
    this.reduced = reduced;
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 2 ** 32;
  }

  /** 그릴 크기(CSS px) — 흐릿하지 않게 화면 배율을 곱하되 2배까지만(3배 폰에서 프레임을 지킨다) */
  resize(w: number, h: number, dpr: number) {
    if (w <= 0 || h <= 0) return;
    const d = Math.min(2, dpr || 1);
    this.W = w;
    this.H = h;
    this.u = w / 360;
    this.canvas.width = Math.round(w * d);
    this.canvas.height = Math.round(h * d);
    this.ctx?.setTransform(d, 0, 0, d, 0, 0);
    this.lookKey = "";
    this.hang.init = false;
  }

  start(el: HTMLElement) {
    const measure = () => this.resize(el.clientWidth, el.clientHeight, window.devicePixelRatio);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      this.ro = ro;
    }
    this.last = performance.now();
    const loop = (now: number) => {
      this.frame(now - this.last);
      this.last = now;
      this.raf = requestAnimationFrame(loop);
    };
    this.frame(16); // 첫 프레임은 동기로 — rAF 가 밀려도 빈 화면이 되지 않게
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    if (this.host) this.host.style.translate = "";
  }

  set(v: Partial<FxView>) {
    this.view = { ...this.view, ...v };
    if (v.phase === "fight" && this.fish.mode !== "fight" && this.fish.on) this.fish.mode = "fight";
  }

  /* ---------- 사건 ---------- */

  reset() {
    this.bob.on = false;
    this.fish.on = false;
    this.fish.mode = "none";
    this.fly = null;
    this.leap = null;
    this.snap = null;
    this.biteClock = null;
    this.rays.to = 0;
    this.surgeOn = 0;
    this.surgeCount = 0;
    this.hang.init = false;
  }

  cast(land: { x: number; y: number }, waitMs: number, size: number, grade: number, power: number) {
    this.reset();
    this.rodKick = 0.42; // 앞으로 휘두른다
    this.rodVel -= 1.5;
    const x1 = land.x * this.W, y1 = land.y * this.H;
    this.fly = { t0: this.t, dur: 0.62, x0: this.hang.x, y0: this.hang.y, x1, y1, size: 0.45 + power * 0.25 };
    Object.assign(this.bob, { on: true, x: this.hang.x, y: this.hang.y, sink: 0, sinkTo: 0.25, dip: 0, home: { x: x1, y: y1 } });
    Object.assign(this.fish, { on: true, mode: "circle", size, grade, t0: this.t, waitS: Math.max(0.6, waitMs / 1000), ang: this.rnd() * 6.28, fade: 0, x: x1 + this.W * 0.3, y: y1 + this.H * 0.06, vx: 0, vy: 0, darts: 0 });
    if (power >= 1) this.sparkBurst(this.hang.x, this.hang.y, 10, "#fde68a", 170);
  }

  nibble() {
    this.bob.dip = 1;
    this.fish.darts = 0.35;
    this.ring(this.bob.x, this.bob.y, 8, 62, 0.55, 2, "#ffffff");
    this.splash(this.bob.x, this.bob.y, 5, 0.45);
  }

  bite(windowMs: number) {
    this.bob.sinkTo = 1.25;
    this.fish.mode = "bite";
    this.biteClock = { t0: this.t, dur: windowMs / 1000 };
    this.nextBiteRipple = this.t;
    this.splash(this.bob.x, this.bob.y, 22, 1);
    this.ring(this.bob.x, this.bob.y, 10, 150, 0.6, 3.5, "#ffffff");
    this.flash = { a: 0.28, color: "#ffffff" };
    this.shake = Math.max(this.shake, 5);
  }

  hook(perfect: boolean) {
    const k = 1 + this.fish.size * 0.8;
    this.biteClock = null;
    this.bob.sinkTo = 0.55;
    this.fish.mode = "fight";
    this.rodKick = -0.55; // 힘껏 들어 올린다
    this.rodVel += 2.6;
    this.stopT = this.reduced ? 0 : 0.13; // 맞는 순간 시간이 멎어야 '걸렸다'가 손에 온다
    this.flash = { a: perfect ? 0.85 : 0.6, color: perfect ? "#fff4c2" : "#ffffff" };
    this.shake = 11 * k;
    this.splash(this.bob.x, this.bob.y, Math.round(46 * k), 1.5 * k);
    this.ring(this.bob.x, this.bob.y, 6, 230, 0.55, 5, perfect ? "#fde68a" : "#ffffff");
    this.ring(this.bob.x, this.bob.y, 6, 150, 0.7, 3, "#ffffff", 0.08);
    if (perfect) this.sparkBurst(this.bob.x, this.bob.y - 10 * this.u, 22, "#fde68a", 280);
    this.addFoam(this.bob.x, this.bob.y, 34, 8);
  }

  /** 차고 나간다 — 번갈아 수면 위로 튀어 오르고, 아니면 물을 두드린다(매번 뛰면 금방 질린다) */
  surge() {
    const k = 1 + this.fish.size;
    this.surgeOn = 1;
    this.surgeDir = this.fish.x > this.W * 0.42 ? -1 : 1;
    this.surgeCount += 1;
    this.shake = Math.max(this.shake, 7 * k);
    this.splash(this.fish.x, this.fish.y, Math.round(26 * k), 1.15 * k);
    this.ring(this.fish.x, this.fish.y, 6, 120, 0.55, 3, "#ffffff");
    if (this.surgeCount % 2 === 1 && !this.leap) {
      const reach = this.W * (0.14 + this.fish.size * 0.08) * this.surgeDir;
      this.leap = { t0: this.t, dur: 0.72 + this.fish.size * 0.3, x0: this.fish.x, y0: this.fish.y, x1: this.fish.x + reach, y1: this.fish.y + this.H * 0.01, h: this.H * (0.13 + this.fish.size * 0.1) };
    }
  }

  surgeEnd() {
    this.surgeOn = 0;
  }

  lost(kind: FxLost) {
    this.biteClock = null;
    this.fish.mode = "flee";
    this.fish.vx = (this.fish.x < this.W / 2 ? -1 : 1) * this.W * 0.5;
    this.fish.vy = -this.H * 0.28;
    this.bob.sinkTo = 0.25;
    if (kind === "snapped") {
      const tip = this.rodTip();
      this.snap = { t0: this.t, x0: tip.x, y0: tip.y, x1: this.bob.x, y1: this.bob.y };
      this.flash = { a: 0.55, color: "#fb7185" };
      this.shake = 16;
      this.stopT = this.reduced ? 0 : 0.08;
      this.rodKick = -0.3;
      this.rodVel += 3.4; // 팽팽하던 낚싯대가 튕겨 오른다
      this.bend = 0;
      this.sparkBurst(tip.x, tip.y, 12, "#ffffff", 200);
      this.splash(this.bob.x, this.bob.y, 12, 0.7);
      this.bob.on = false;
    } else if (kind === "slack") {
      this.splash(this.bob.x, this.bob.y, 10, 0.6);
      this.ring(this.bob.x, this.bob.y, 6, 80, 0.8, 2, "#ffffff");
    } else if (kind === "early") {
      this.splash(this.fish.x, this.fish.y, 18, 0.9);
      this.ring(this.bob.x, this.bob.y, 6, 110, 0.6, 3, "#ffffff");
      this.rodKick = -0.2;
    } else if (kind === "late") {
      this.splash(this.bob.x, this.bob.y, 10, 0.55);
      this.ring(this.bob.x, this.bob.y, 6, 90, 0.7, 2.5, "#ffffff");
    } else {
      this.splash(this.fish.x, this.fish.y, 20, 1);
    }
  }

  /** 끌어올렸다 — 물기둥과 등급 빛. 물고기 그림은 화면(DOM)이 띄운다 */
  land(grade: number) {
    const x = this.W * 0.5, y = this.H * 0.8;
    const k = 1 + grade * 0.14;
    this.bob.on = false;
    this.fish.on = false;
    this.fish.mode = "none";
    this.leap = null;
    this.rodKick = -0.35;
    this.rodVel += 2;
    this.shake = 12 * k;
    this.flash = { a: 0.6, color: "#ffffff" };
    this.column(x, y, Math.round(70 * k));
    this.ring(x, y, 10, 320, 0.8, 6, "#ffffff");
    this.ring(x, y, 10, 220, 0.9, 4, "#ffffff", 0.1);
    this.addFoam(x, y, 70, 14);
    this.rays = { a: 0, to: 0.5 + grade * 0.06, color: FX_GRADE_LIGHT[clamp(grade, 0, 7)] };
  }

  stored(grade: number) {
    const c = FX_GRADE_LIGHT[clamp(grade, 0, 7)];
    this.flash = { a: 0.7, color: "#ffffff" };
    this.shake = 7;
    this.sparkBurst(this.W * 0.5, this.H * 0.26, 34 + grade * 6, c, 340);
    this.confetti(50 + grade * 10, c);
    this.rays.to = 0.85;
  }

  slipped() {
    const x = this.W * 0.72, y = this.H * 0.62;
    this.rays.to = 0;
    this.shake = 6;
    this.column(x, y, 34);
    this.ring(x, y, 8, 150, 0.7, 4, "#ffffff");
  }

  sold() {
    this.rays.to = 0.25;
    this.sparkBurst(this.W * 0.5, this.H * 0.26, 18, "#fde68a", 240);
  }

  /* ---------- 입자 ---------- */

  private pushDrop(d: Drop) {
    if (this.drops.length >= MAX_DROPS) this.drops.shift();
    this.drops.push(d);
  }

  private ring(x: number, y: number, r: number, vr: number, life: number, lw: number, color: string, delay = 0) {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    const p = this.persp(y);
    this.rings.push({ x, y, r: r * p * this.u, vr: vr * p * this.u, life, max: life, delay, lw: lw * this.u, color });
  }

  private addFoam(x: number, y: number, spread: number, n: number) {
    const u = this.u * this.persp(y);
    for (let i = 0; i < n; i++) {
      if (this.foam.length >= MAX_FOAM) this.foam.shift();
      const life = 0.5 + this.rnd() * 0.7;
      this.foam.push({ x: x + (this.rnd() - 0.5) * spread * u * 2, y: y + (this.rnd() - 0.5) * spread * u * 0.5, r: (5 + this.rnd() * 12) * u, life, max: life });
    }
  }

  /** 왕관 모양 물보라 — 빨리 뜨는 큰 방울 몇 + 잘게 흩어지는 방울 여럿 */
  private splash(x: number, y: number, n: number, power: number) {
    const u = this.u * this.persp(y);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (this.rnd() - 0.5) * 1.9;
      const sp = (60 + this.rnd() * 210) * power * u;
      const life = 0.35 + this.rnd() * 0.5;
      this.pushDrop({ x: x + (this.rnd() - 0.5) * 8 * u, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 620 * u, life, max: life, r: (0.8 + this.rnd() * this.rnd() * 3.4) * u, floor: y + (this.rnd() - 0.5) * 12 * u, color: this.rnd() < 0.3 ? "#d7f1ff" : "#ffffff", kind: "drop", spin: 0 });
    }
    this.addFoam(x, y, 12 * power, Math.round(3 + 4 * power));
  }

  /** 곧게 솟는 물기둥 — 끌어올릴 때 */
  private column(x: number, y: number, n: number) {
    const u = this.u;
    for (let i = 0; i < n; i++) {
      const sp = (220 + this.rnd() * 460) * u;
      const a = -Math.PI / 2 + (this.rnd() - 0.5) * 0.85;
      const life = 0.6 + this.rnd() * 0.7;
      this.pushDrop({ x: x + (this.rnd() - 0.5) * 56 * u, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 640 * u, life, max: life, r: (1 + this.rnd() * this.rnd() * 5) * u, floor: y + 30 * u, color: this.rnd() < 0.35 ? "#cdeeff" : "#ffffff", kind: "drop", spin: 0 });
    }
  }

  private sparkBurst(x: number, y: number, n: number, color: string, speed: number) {
    const u = this.u;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rnd() * 0.5;
      const sp = speed * (0.45 + this.rnd() * 0.6) * u;
      const life = 0.45 + this.rnd() * 0.5;
      this.pushDrop({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 110 * u, life, max: life, r: (2.2 + this.rnd() * 4.2) * u, floor: Infinity, color, kind: "spark", spin: 0 });
    }
  }

  private confetti(n: number, c: string) {
    const u = this.u;
    const colors = [c, "#ffffff", "#fde68a", "#7dd3fc", "#f9a8d4"];
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      const a = (left ? -0.95 : -2.19) + (this.rnd() - 0.5) * 0.7;
      const sp = (260 + this.rnd() * 340) * u;
      const life = 1.1 + this.rnd() * 0.9;
      this.pushDrop({ x: left ? 0 : this.W, y: this.H * 0.55, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 330 * u, life, max: life, r: (3 + this.rnd() * 3) * u, floor: Infinity, color: colors[Math.floor(this.rnd() * colors.length)], kind: "paper", spin: this.rnd() * 6 });
    }
  }

  /* ---------- 진행 ---------- */

  private look(): SpotLook {
    return FX_SPOTS[this.view.spot] ?? FX_SPOTS.brook;
  }

  /** 멀수록 작게 — 수평선에서 0.22, 발밑에서 1.2 */
  private persp(y: number): number {
    const hz = this.look().horizon;
    return clamp(0.22 + ((y / this.H - hz) / (1 - hz)) * 1, 0.2, 1.25);
  }

  private rodBase() {
    return { x: this.W * 1.03, y: this.H * 1.05 };
  }

  private rodLen() {
    return this.H * 0.8;
  }

  private rodTip() {
    const b = this.rodBase(), L = this.rodLen();
    const pull = this.linePull();
    return { x: b.x - Math.sin(this.rodAng) * L + pull.x, y: b.y - Math.cos(this.rodAng) * L + pull.y };
  }

  /** 장력만큼 낚싯대 끝이 물고기 쪽으로 끌려간다 */
  private linePull() {
    if (this.bend <= 0.001 || !this.bob.on) return { x: 0, y: 0 };
    const b = this.rodBase(), L = this.rodLen();
    const dx = this.bob.x - (b.x - Math.sin(this.rodAng) * L);
    const dy = this.bob.y - (b.y - Math.cos(this.rodAng) * L);
    const d = Math.max(1, Math.hypot(dx, dy));
    const k = this.bend * L * 0.2;
    return { x: (dx / d) * k, y: (dy / d) * k };
  }

  private seedLook() {
    const key = `${this.view.spot}:${this.W}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    const hz = this.look().horizon * this.H;
    this.spec = Array.from({ length: 30 }, () => {
      const k = this.rnd() ** 1.6;
      return { x: this.rnd() * this.W, y: hz + 4 + k * (this.H - hz - 4), f: 0.7 + this.rnd() * 1.8, p: this.rnd() * 6.28, s: 1 + this.rnd() * 2 };
    });
    this.streaks = Array.from({ length: 16 }, () => {
      const k = this.rnd() ** 1.3;
      return { x: this.rnd() * this.W, y: hz + 3 + k * (this.H - hz - 3), w: (16 + this.rnd() * 46) * this.u, v: (3 + this.rnd() * 6) * this.u, p: this.rnd() * 6.28 };
    });
    const air = this.look().air;
    const n = air === "star" ? 44 : air === "bird" ? 3 : air === "lantern" ? 9 : air === "mote" ? 18 : 11;
    this.air = Array.from({ length: n }, () => ({
      x: this.rnd() * this.W,
      y: air === "petal" || air === "mote" ? this.rnd() * this.H : this.rnd() * hz * 0.92,
      vx: (air === "bird" ? 14 + this.rnd() * 10 : air === "petal" ? 10 + this.rnd() * 14 : (this.rnd() - 0.5) * 8) * this.u,
      vy: (air === "petal" ? 10 + this.rnd() * 12 : air === "lantern" ? -3 - this.rnd() * 3 : air === "mote" ? -3 - this.rnd() * 5 : 0) * this.u,
      p: this.rnd() * 6.28,
      s: (0.6 + this.rnd()) * this.u,
    }));
  }

  frame(ms: number) {
    const real = clamp(ms / 1000, 0, 0.05);
    let dt = real;
    if (this.stopT > 0) {
      this.stopT -= real;
      dt = real * 0.06;
    }
    this.t += dt;
    this.seedLook();
    this.step(dt, real);
    this.draw();
    if (this.host) {
      const s = this.reduced ? 0 : this.shake;
      this.host.style.translate = s > 0.3 ? `${((this.rnd() - 0.5) * s).toFixed(1)}px ${((this.rnd() - 0.5) * s).toFixed(1)}px` : "";
    }
  }

  private step(dt: number, real: number) {
    const v = this.view;
    this.shake = Math.max(0, this.shake - real * 34);
    this.flash.a = Math.max(0, this.flash.a - real * 3.2);
    this.rays.a += (this.rays.to - this.rays.a) * Math.min(1, real * 5);
    this.rodKick *= Math.max(0, 1 - dt * 6);

    // 낚싯대 — 스프링이라 휘두른 뒤 낭창낭창 되돌아온다
    let to = 0.47 + Math.sin(this.t * 0.8) * 0.008;
    if (v.phase === "charge") to = 0.47 - v.charge * 0.82;
    if (v.phase === "fight") to = 0.5 + (v.holding ? -0.05 : 0.03);
    to += this.rodKick;
    this.rodVel += ((to - this.rodAng) * 150 - this.rodVel * 13) * dt;
    this.rodAng += this.rodVel * dt;
    const bendTo = v.phase === "fight" ? clamp(v.tension, 0, 1.05) : v.phase === "bite" ? 0.42 : 0;
    this.bend += (bendTo - this.bend) * Math.min(1, dt * 14);
    if (v.phase === "fight" && v.holding) this.reelAng += dt * 22;

    // 찌가 줄 끝에 대롱대롱 — 낚싯대를 따라 늦게 움직인다
    const tip = this.rodTip();
    const hy = tip.y + 44 * this.u;
    if (!this.hang.init) Object.assign(this.hang, { x: tip.x, y: hy, vx: 0, vy: 0, init: true });
    this.hang.vx += ((tip.x - this.hang.x) * 60 - this.hang.vx * 4) * dt;
    this.hang.vy += ((hy - this.hang.y) * 80 - this.hang.vy * 7) * dt;
    this.hang.x += this.hang.vx * dt;
    this.hang.y += this.hang.vy * dt;

    this.stepBob(dt);
    this.stepFish(dt);
    this.stepParticles(dt);

    for (const a of this.air) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x > this.W + 20) a.x = -20;
      if (a.x < -20) a.x = this.W + 20;
      if (a.y > this.H + 10) a.y = -10;
      if (a.y < -10) a.y = this.look().air === "mote" ? this.H : this.look().horizon * this.H * 0.92;
    }
    for (const s of this.streaks) {
      s.x += s.v * dt;
      if (s.x - s.w > this.W) s.x = -s.w;
    }
  }

  private stepBob(dt: number) {
    const b = this.bob;
    if (this.fly) {
      const f = this.fly, p = clamp((this.t - f.t0) / f.dur, 0, 1);
      b.x = lerp(f.x0, f.x1, p);
      b.y = lerp(f.y0, f.y1, p) - Math.sin(p * Math.PI) * this.H * 0.13;
      if (p >= 1) {
        this.fly = null;
        b.sink = 0.8; // 툭 잠겼다가 떠오른다
        this.splash(f.x1, f.y1, Math.round(26 * f.size), 0.9 * f.size + 0.2);
        this.ring(f.x1, f.y1, 6, 120, 0.7, 3, "#ffffff");
        this.ring(f.x1, f.y1, 6, 74, 0.95, 2, "#ffffff", 0.18);
      }
      return;
    }
    if (!b.on) return;
    b.dip = Math.max(0, b.dip - dt * 3.4);
    b.sink += (b.sinkTo - b.sink) * Math.min(1, dt * (b.sinkTo > 1 ? 16 : 5));
    if (this.view.phase === "wait" && Math.floor(this.t / 1.25) !== Math.floor((this.t - dt) / 1.25)) this.ring(b.x, b.y, 5, 46, 1.25, 1.4, "#ffffff");
    if (this.view.phase === "bite" && this.t >= this.nextBiteRipple) {
      this.nextBiteRipple = this.t + 0.17;
      this.ring(b.x, b.y, 7, 96, 0.5, 2.4, "#ffffff");
      this.splash(b.x, b.y, 7, 0.75);
    }
    if (this.fish.mode === "fight") {
      b.x += (this.fish.x - b.x) * Math.min(1, dt * 9);
      b.y += (this.fish.y - b.y) * Math.min(1, dt * 9);
    }
  }

  private stepFish(dt: number) {
    const f = this.fish;
    if (!f.on) return;
    const bob = this.bob, v = this.view, u = this.u;
    let tx = bob.x, ty = bob.y + 4 * u, k = 10, d = 4.6;
    f.fade = Math.min(1, f.fade + dt * 0.9);
    f.darts = Math.max(0, f.darts - dt);

    if (f.mode === "circle") {
      const prog = clamp((this.t - f.t0) / f.waitS, 0, 1);
      const r = (lerp(92, 26, prog) - (f.darts > 0 ? 18 : 0)) * u * this.persp(bob.y) * 1.4;
      f.ang += dt * (0.9 + prog * 0.9);
      tx = bob.x + Math.cos(f.ang) * r;
      ty = bob.y + Math.sin(f.ang) * r * 0.42 + 6 * u;
      k = f.darts > 0 ? 30 : 8;
    } else if (f.mode === "bite") {
      k = 42;
      d = 8;
    } else if (f.mode === "fight") {
      const home = bob.home.y, hz = this.look().horizon * this.H;
      const dist = clamp(v.dist, 0, 1.3);
      ty = dist <= 1 ? lerp(this.H * 0.86, home, dist) : lerp(home, hz + (home - hz) * 0.35, (dist - 1) / 0.3);
      tx = this.W * (0.44 + Math.sin(this.t * 0.9) * 0.13 + Math.sin(this.t * 2.3 + 1) * 0.05) + this.surgeOn * this.surgeDir * this.W * 0.14;
      k = this.surgeOn ? 26 : 12;
      d = 5;
      if (this.t >= this.nextThrash) {
        this.nextThrash = this.t + (this.surgeOn ? 0.1 : 0.3 - v.tension * 0.14);
        this.splash(f.x, f.y, this.surgeOn ? 8 : 3 + Math.round(f.size * 4), 0.42 + f.size * 0.3 + (this.surgeOn ? 0.45 : 0));
      }
    } else if (f.mode === "flee") {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.fade = Math.max(0, f.fade - dt * 1.9);
      f.wag += dt * 34;
      f.h += (Math.atan2(f.vy, f.vx) - f.h) * Math.min(1, dt * 10);
      if (f.fade <= 0) {
        f.on = false;
        f.mode = "none";
      }
      return;
    }

    f.vx += ((tx - f.x) * k - f.vx * d) * dt;
    f.vy += ((ty - f.y) * k - f.vy * d) * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const speed = Math.hypot(f.vx, f.vy);
    if (speed > 6 * u) {
      let delta = Math.atan2(f.vy, f.vx) - f.h;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      f.h += delta * Math.min(1, dt * 7);
    }
    f.wag += dt * (5 + speed / (6 * u));
    if (f.mode === "fight" && speed > 34 * u && this.rnd() < dt * 18) this.addFoam(f.x, f.y, 10, 1);

    if (this.leap) {
      const l = this.leap;
      if (this.t - l.t0 >= l.dur) {
        this.column(l.x1, l.y1, 26);
        this.ring(l.x1, l.y1, 8, 160, 0.65, 4, "#ffffff");
        this.ring(l.x1, l.y1, 8, 96, 0.85, 2.5, "#ffffff", 0.1);
        this.addFoam(l.x1, l.y1, 26, 7);
        this.shake = Math.max(this.shake, 6 + f.size * 7);
        f.x = l.x1;
        f.y = l.y1;
        f.vx = f.vy = 0;
        this.leap = null;
      }
    }
  }

  private stepParticles(dt: number) {
    const drops = this.drops;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life -= dt;
      d.vy += d.g * dt;
      if (d.kind === "paper") {
        d.vx *= Math.max(0, 1 - dt * 1.6);
        d.vy *= Math.max(0, 1 - dt * 1.3);
        d.spin += dt * 9;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.kind === "drop" && d.vy > 0 && d.y >= d.floor) {
        if (d.r > 2 * this.u) this.ring(d.x, d.floor, 2, 34, 0.32, 1, "#ffffff");
        d.life = 0;
      }
      if (d.life <= 0) drops.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      if (r.delay > 0) {
        r.delay -= dt;
        continue;
      }
      r.life -= dt;
      r.r += r.vr * dt;
      r.vr *= Math.max(0, 1 - dt * 1.4);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.foam.length - 1; i >= 0; i--) {
      this.foam[i].life -= dt;
      if (this.foam[i].life <= 0) this.foam.splice(i, 1);
    }
  }

  /* ---------- 그리기 ---------- */

  private draw() {
    const c = this.ctx;
    if (!c) return;
    c.clearRect(0, 0, this.W, this.H);
    if (!this.reduced) this.drawAir(c);
    this.drawWater(c);
    this.drawRings(c);
    this.drawFoam(c);
    this.drawFishShadow(c);
    this.drawBobberUnder(c);
    this.drawRays(c);
    this.drawLine(c);
    this.drawBobber(c);
    this.drawLeap(c);
    this.drawSnap(c);
    this.drawBiteClock(c);
    this.drawRod(c);
    this.drawDrops(c);
    this.drawOverlay(c);
  }

  private star4(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    const q = r * 0.2;
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x + q, y - q, x + r, y);
    c.quadraticCurveTo(x + q, y + q, x, y + r);
    c.quadraticCurveTo(x - q, y + q, x - r, y);
    c.quadraticCurveTo(x - q, y - q, x, y - r);
    c.fill();
  }

  private drawAir(c: CanvasRenderingContext2D) {
    const kind = this.look().air;
    c.save();
    if (kind === "star") {
      c.fillStyle = "#ffffff";
      for (const a of this.air) {
        c.globalAlpha = 0.25 + 0.75 * Math.max(0, Math.sin(this.t * 1.6 + a.p)) ** 2;
        this.star4(c, a.x, a.y, 2.4 * a.s);
      }
    } else if (kind === "lantern") {
      c.globalCompositeOperation = "lighter";
      for (const a of this.air) {
        const r = 7 * a.s * (1 + Math.sin(this.t * 2 + a.p) * 0.12);
        const g = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
        g.addColorStop(0, "rgba(255,214,140,.95)");
        g.addColorStop(0.35, "rgba(255,160,90,.42)");
        g.addColorStop(1, "rgba(255,120,80,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(a.x, a.y, r, 0, 6.29);
        c.fill();
      }
    } else if (kind === "mote") {
      c.globalCompositeOperation = "lighter";
      for (const a of this.air) {
        c.globalAlpha = 0.25 + 0.55 * Math.max(0, Math.sin(this.t * 1.3 + a.p));
        const x = a.x + Math.sin(this.t * 0.7 + a.p) * 8 * this.u;
        c.fillStyle = "#fff4b0";
        c.beginPath();
        c.arc(x, a.y, 1.6 * a.s, 0, 6.29);
        c.fill();
      }
    } else if (kind === "petal") {
      for (const a of this.air) {
        const x = a.x + Math.sin(this.t * 0.9 + a.p) * 11 * this.u;
        c.save();
        c.translate(x, a.y);
        c.rotate(this.t * 0.9 + a.p);
        c.scale(1, 0.45 + Math.abs(Math.sin(this.t * 1.7 + a.p)) * 0.55);
        c.fillStyle = this.view.spot === "pond" ? "rgba(255,190,205,.9)" : "rgba(255,240,240,.85)";
        c.beginPath();
        c.ellipse(0, 0, 3.4 * a.s, 2 * a.s, 0, 0, 6.29);
        c.fill();
        c.restore();
      }
    } else {
      c.strokeStyle = "rgba(20,32,52,.72)";
      c.lineWidth = 1.3 * this.u;
      c.lineCap = "round";
      for (const a of this.air) {
        const f = Math.sin(this.t * 7 + a.p) * 2.4 * a.s;
        const w = 5.5 * a.s;
        c.beginPath();
        c.moveTo(a.x - w, a.y - f);
        c.quadraticCurveTo(a.x - w * 0.4, a.y - 1.6 * a.s, a.x, a.y);
        c.quadraticCurveTo(a.x + w * 0.4, a.y - 1.6 * a.s, a.x + w, a.y - f);
        c.stroke();
      }
    }
    c.restore();
  }

  /** 그림은 멈춰 있으니 물결 자국과 반짝임이 물을 움직이게 한다 */
  private drawWater(c: CanvasRenderingContext2D) {
    const glint = this.look().glint;
    c.save();
    c.lineCap = "round";
    for (const s of this.streaks) {
      const p = this.persp(s.y);
      c.strokeStyle = glint;
      c.globalAlpha = 0.09 + 0.1 * Math.max(0, Math.sin(this.t * 0.8 + s.p));
      c.lineWidth = Math.max(0.8, 1.9 * p * this.u);
      const y = s.y + Math.sin(this.t * 0.9 + s.p) * 1.4 * p;
      c.beginPath();
      c.moveTo(s.x - s.w * p, y);
      c.quadraticCurveTo(s.x, y - 1.8 * p, s.x + s.w * p, y);
      c.stroke();
    }
    c.globalCompositeOperation = "lighter";
    c.fillStyle = glint;
    for (const g of this.spec) {
      const a = Math.max(0, Math.sin(this.t * g.f + g.p)) ** 6;
      if (a < 0.02) continue;
      c.globalAlpha = a * 0.9;
      this.star4(c, g.x, g.y, (2 + g.s * 3.2) * this.persp(g.y) * this.u);
    }
    c.restore();
  }

  private drawRings(c: CanvasRenderingContext2D) {
    c.save();
    for (const r of this.rings) {
      if (r.delay > 0) continue;
      const k = r.life / r.max;
      c.strokeStyle = r.color;
      c.globalAlpha = k * 0.85;
      c.lineWidth = Math.max(0.5, r.lw * (0.35 + k * 0.65));
      c.beginPath();
      c.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, 6.29);
      c.stroke();
    }
    c.restore();
  }

  private drawFoam(c: CanvasRenderingContext2D) {
    c.save();
    c.fillStyle = "#ffffff";
    for (const f of this.foam) {
      const k = f.life / f.max;
      c.globalAlpha = k * 0.55;
      c.beginPath();
      c.ellipse(f.x, f.y, f.r * (1.3 - k * 0.3), f.r * 0.34, 0, 0, 6.29);
      c.fill();
    }
    c.restore();
  }

  private fishPath(c: CanvasRenderingContext2D, L: number, wag: number) {
    const tail = Math.sin(wag) * L * 0.13;
    const mid = Math.sin(wag - 1) * L * 0.035;
    c.beginPath();
    c.moveTo(L * 0.5, 0);
    c.quadraticCurveTo(L * 0.28, -L * 0.2, L * 0.02, -L * 0.2 + mid);
    c.quadraticCurveTo(-L * 0.2, -L * 0.15, -L * 0.33, tail * 0.45 - L * 0.04);
    c.lineTo(-L * 0.56, tail - L * 0.2);
    c.quadraticCurveTo(-L * 0.47, tail, -L * 0.56, tail + L * 0.2);
    c.lineTo(-L * 0.33, tail * 0.45 + L * 0.04);
    c.quadraticCurveTo(-L * 0.2, L * 0.15, L * 0.02, L * 0.2 + mid);
    c.quadraticCurveTo(L * 0.28, L * 0.2, L * 0.5, 0);
    c.closePath();
    c.moveTo(L * 0.14, L * 0.15);
    c.lineTo(-L * 0.04, L * 0.34);
    c.lineTo(-L * 0.08, L * 0.16);
    c.moveTo(L * 0.14, -L * 0.15);
    c.lineTo(-L * 0.04, -L * 0.34);
    c.lineTo(-L * 0.08, -L * 0.16);
  }

  private fishLen(y: number) {
    return (38 + this.fish.size * 96) * this.u * this.persp(y);
  }

  private drawFishShadow(c: CanvasRenderingContext2D) {
    const f = this.fish;
    if (!f.on || this.leap) return;
    const L = this.fishLen(f.y);
    c.save();
    // 귀한 놈은 물 밑에서 빛이 샌다 — 끌어올리기 전의 두근거림
    if (f.grade >= 4 && f.mode !== "flee") {
      const col = FX_GRADE_LIGHT[clamp(f.grade, 0, 7)];
      const r = L * (0.9 + Math.sin(this.t * 3) * 0.1);
      c.save();
      c.globalCompositeOperation = "lighter";
      c.translate(f.x, f.y);
      c.scale(1, 0.5);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, alpha(col, 0.5 * f.fade));
      g.addColorStop(1, alpha(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, r, 0, 6.29);
      c.fill();
      c.restore();
    }
    c.translate(f.x, f.y);
    c.scale(1, 0.56);
    c.rotate(f.h);
    const dark = f.mode === "bite" || f.mode === "fight" ? 0.62 : 0.46;
    c.fillStyle = "#001226";
    c.globalAlpha = dark * 0.34 * f.fade;
    c.save();
    c.scale(1.14, 1.2);
    this.fishPath(c, L, f.wag);
    c.fill();
    c.restore();
    c.globalAlpha = dark * f.fade;
    this.fishPath(c, L, f.wag);
    c.fill();
    c.restore();
  }

  private drawRays(c: CanvasRenderingContext2D) {
    const a = this.rays.a;
    if (a < 0.01) return;
    const cx = this.W * 0.5, cy = this.H * 0.25, R = this.W * 0.95;
    c.save();
    c.globalCompositeOperation = "lighter";
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, alpha(this.rays.color, a * 0.85));
    g.addColorStop(0.55, alpha(this.rays.color, a * 0.26));
    g.addColorStop(1, alpha(this.rays.color, 0));
    c.fillStyle = g;
    const spin = this.reduced ? 0 : this.t * 0.32;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const m = spin + (i * Math.PI) / 6;
      const w = 0.085 + (i % 2) * 0.055;
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(m - w) * R, cy + Math.sin(m - w) * R);
      c.lineTo(cx + Math.cos(m + w) * R, cy + Math.sin(m + w) * R);
      c.closePath();
    }
    c.fill();
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42);
    core.addColorStop(0, alpha("#ffffff", a * 0.75));
    core.addColorStop(1, alpha(this.rays.color, 0));
    c.fillStyle = core;
    c.beginPath();
    c.arc(cx, cy, R * 0.42, 0, 6.29);
    c.fill();
    c.restore();
  }

  private lineEnd() {
    const b = this.bob;
    if (!b.on && !this.fly) {
      return this.view.phase === "ready" || this.view.phase === "charge" ? { x: this.hang.x, y: this.hang.y - 9 * this.u, on: true } : { x: 0, y: 0, on: false };
    }
    const s = this.persp(b.y) * this.u;
    return { x: b.x, y: b.y - (10 - b.sink * 8) * s, on: true };
  }

  private drawLine(c: CanvasRenderingContext2D) {
    const end = this.lineEnd();
    if (!end.on) return;
    const v = this.view, tip = this.rodTip(), u = this.u;
    const fight = v.phase === "fight";
    const taut = fight ? clamp(v.tension, 0, 1) : v.phase === "bite" ? 0.75 : 0.12;
    const sag = (1 - taut) ** 1.5 * Math.hypot(end.x - tip.x, end.y - tip.y) * 0.3;
    const amp = taut > 0.55 ? (taut - 0.55) * 7 * u : 0;
    const pts: { x: number; y: number }[] = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const w = Math.sin(k * Math.PI);
      pts.push({
        x: lerp(tip.x, end.x, k) + Math.sin(this.t * 74 + k * 30) * amp * w,
        y: lerp(tip.y, end.y, k) + sag * w * (fight || v.phase === "bite" ? 1 : 0.9) + Math.cos(this.t * 66 + k * 26) * amp * w,
      });
    }
    const path = () => {
      c.beginPath();
      pts.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
    };
    c.save();
    c.lineCap = "round";
    c.lineJoin = "round";
    path();
    c.strokeStyle = "rgba(0,18,38,.32)";
    c.lineWidth = 2.6 * u;
    c.stroke();
    const hot = clamp((taut - 0.72) / 0.24, 0, 1);
    const pulse = hot > 0 ? 0.5 + 0.5 * Math.sin(this.t * 30) : 0;
    path();
    c.strokeStyle = mix("#ffffff", "#ff3b4e", hot * (0.55 + pulse * 0.45));
    c.lineWidth = (1.15 + hot * 0.9) * u;
    c.stroke();
    // 감을 때 빛 점이 낚싯대 쪽으로 달려간다 — 지금 줄이 들어오고 있다는 표시
    if (fight && v.holding && !this.reduced) {
      path();
      c.setLineDash([2.5 * u, 13 * u]);
      c.lineDashOffset = this.t * 150 * u;
      c.strokeStyle = "rgba(255,255,255,.95)";
      c.lineWidth = 2 * u;
      c.stroke();
    }
    c.restore();
  }

  /** 물속에 잠긴 찌 몸통 — 위쪽과 따로 그려야 수면에 떠 있는 것처럼 보인다 */
  private drawBobberUnder(c: CanvasRenderingContext2D) {
    const b = this.bob;
    if (!b.on || this.fly) return;
    const s = this.persp(b.y) * this.u;
    const dip = b.dip * 7 * s;
    const y = b.y + Math.sin(this.t * 2.1) * 1.3 * s + dip + b.sink * 13 * s;
    c.save();
    c.globalAlpha = 0.34;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.ellipse(b.x, Math.max(y, b.y + 1), 4.8 * s, 5.5 * s, 0, 0, 6.29);
    c.fill();
    c.restore();
    c.save();
    c.strokeStyle = "rgba(255,255,255,.75)";
    c.lineWidth = Math.max(0.7, 1.2 * s);
    c.beginPath();
    c.ellipse(b.x, b.y + 1, (8.5 + Math.sin(this.t * 2.1) * 0.8) * s, 2.6 * s, 0, 0, 6.29);
    c.stroke();
    c.restore();
  }

  private bobberBody(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    // 막대 끝
    c.fillStyle = "#3b2a1a";
    c.fillRect(x - 0.9 * s, y - 15 * s, 1.8 * s, 6 * s);
    c.fillStyle = "#fff36b";
    c.fillRect(x - 1.5 * s, y - 18 * s, 3 * s, 3.4 * s);
    // 몸통: 위 빨강 · 가운데 흰 띠 · 아래 빨강
    const g = c.createLinearGradient(x - 7 * s, y, x + 7 * s, y);
    g.addColorStop(0, "#ff6b5e");
    g.addColorStop(0.55, "#e6242d");
    g.addColorStop(1, "#8e0f1d");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y - 3 * s, 7 * s, 8 * s, 0, 0, 6.29);
    c.fill();
    c.save();
    c.beginPath();
    c.ellipse(x, y - 3 * s, 7 * s, 8 * s, 0, 0, 6.29);
    c.clip();
    c.fillStyle = "#fffdf5";
    c.fillRect(x - 8 * s, y - 2.8 * s, 16 * s, 5 * s);
    c.fillStyle = "rgba(30,30,60,.2)";
    c.fillRect(x + 2.4 * s, y - 2.8 * s, 6 * s, 5 * s);
    c.restore();
    c.fillStyle = "rgba(255,255,255,.75)";
    c.beginPath();
    c.ellipse(x - 2.5 * s, y - 7 * s, 1.6 * s, 2.4 * s, 0, 0, 6.29);
    c.fill();
    c.strokeStyle = "rgba(60,8,16,.55)";
    c.lineWidth = Math.max(0.6, 0.8 * s);
    c.beginPath();
    c.ellipse(x, y - 3 * s, 7 * s, 8 * s, 0, 0, 6.29);
    c.stroke();
  }

  private drawBobber(c: CanvasRenderingContext2D) {
    const v = this.view, b = this.bob;
    if (!b.on && !this.fly) {
      if (v.phase === "ready" || v.phase === "charge") this.bobberBody(c, this.hang.x, this.hang.y + 8 * this.u, 0.95 * this.u);
      return;
    }
    if (this.fly) {
      this.bobberBody(c, b.x, b.y + 8 * this.u, lerp(0.95, this.persp(this.fly.y1), clamp((this.t - this.fly.t0) / this.fly.dur, 0, 1)) * this.u);
      return;
    }
    const s = this.persp(b.y) * this.u;
    const dip = b.dip * 7 * s;
    const y = b.y + Math.sin(this.t * 2.1) * 1.3 * s + dip + b.sink * 13 * s;
    if (y - 18 * s > b.y) return; // 다 잠겼다
    c.save();
    c.beginPath();
    c.rect(b.x - 30 * s, b.y - 60 * s, 60 * s, 60 * s + 1); // 수면 위만
    c.clip();
    this.bobberBody(c, b.x, y, s);
    c.restore();
  }

  private drawLeap(c: CanvasRenderingContext2D) {
    const l = this.leap;
    if (!l) return;
    const p = clamp((this.t - l.t0) / l.dur, 0, 1);
    const x = lerp(l.x0, l.x1, p);
    const y = lerp(l.y0, l.y1, p) - Math.sin(p * Math.PI) * l.h;
    const px = Math.cos(p * Math.PI);
    const dirX = l.x1 >= l.x0 ? 1 : -1;
    const ang = Math.atan2(-px * l.h * 3, (l.x1 - l.x0) || 1);
    const L = this.fishLen(l.y0) * 1.12;
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    if (dirX < 0) c.scale(1, -1);
    c.fillStyle = "#07192e";
    this.fishPath(c, L, this.t * 26);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.72)";
    c.lineWidth = 1.2 * this.u;
    this.fishPath(c, L, this.t * 26);
    c.stroke();
    c.restore();
    // 몸에서 떨어지는 물방울
    if (this.rnd() < 0.55) {
      const u = this.u;
      const life = 0.4 + this.rnd() * 0.3;
      this.pushDrop({ x: x - dirX * L * 0.2 + (this.rnd() - 0.5) * L * 0.5, y, vx: (this.rnd() - 0.5) * 50 * u, vy: 10 * u, g: 620 * u, life, max: life, r: (0.8 + this.rnd() * 2) * u, floor: l.y0, color: "#ffffff", kind: "drop", spin: 0 });
    }
  }

  private drawSnap(c: CanvasRenderingContext2D) {
    const s = this.snap;
    if (!s) return;
    const p = (this.t - s.t0) / 0.75;
    if (p >= 1) {
      this.snap = null;
      return;
    }
    const tip = this.rodTip();
    const u = this.u;
    c.save();
    c.lineCap = "round";
    // 끊어진 윗줄이 낚싯대 쪽으로 말려 들어간다
    c.strokeStyle = mix("#ff3b4e", "#ffffff", p);
    c.globalAlpha = 1 - p * 0.5;
    c.lineWidth = 1.5 * u;
    c.beginPath();
    const len = lerp(1, 0.2, Math.min(1, p * 2.4));
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const x = lerp(tip.x, s.x1, k * len * 0.55) + Math.sin(k * 15 - p * 10) * 20 * k * p * 2.2 * u;
      const y = lerp(tip.y, s.y1, k * len * 0.55) + Math.cos(k * 13 - p * 11) * 16 * k * p * 2.2 * u + p * p * 70 * k * u;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    // 아랫줄은 찌와 함께 물로 떨어진다
    c.globalAlpha = 1 - p;
    c.beginPath();
    c.moveTo(s.x1, s.y1);
    for (let i = 1; i <= 12; i++) {
      const k = i / 12;
      c.lineTo(s.x1 + (tip.x - s.x1) * k * 0.32 * (1 - p) + Math.sin(k * 9 + p * 8) * 8 * u, s.y1 + (tip.y - s.y1) * k * 0.32 * (1 - p) + p * 40 * u * (1 - k));
    }
    c.stroke();
    c.restore();
  }

  /** 챔질 타이밍 — 찌를 조이며 줄어드는 고리. 초록일 때 누르면 '정확한 챔질' */
  private drawBiteClock(c: CanvasRenderingContext2D) {
    const k = this.biteClock;
    if (!k || !this.bob.on) return;
    const p = clamp((this.t - k.t0) / k.dur, 0, 1);
    const s = this.persp(this.bob.y) * this.u;
    const R = lerp(70, 13, p) * Math.max(s, 0.5 * this.u);
    const color = p <= 0.45 ? "#4ade80" : p < 0.75 ? "#fde047" : "#fb7185";
    c.save();
    c.strokeStyle = "rgba(0,18,38,.45)";
    c.lineWidth = 6 * this.u;
    c.beginPath();
    c.ellipse(this.bob.x, this.bob.y, R, R * 0.62, 0, 0, 6.29);
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = 3.4 * this.u;
    c.stroke();
    c.restore();
  }

  private drawRod(c: CanvasRenderingContext2D) {
    const look = FX_RODS[this.view.rod] ?? FX_RODS.rod_bamboo;
    const b = this.rodBase(), tip = this.rodTip(), L = this.rodLen(), u = this.u;
    const straight = { x: b.x - Math.sin(this.rodAng) * L, y: b.y - Math.cos(this.rodAng) * L };
    const ctrl = { x: lerp(b.x, straight.x, 0.62), y: lerp(b.y, straight.y, 0.62) };
    const at = (k: number) => {
      const m = 1 - k;
      return { x: m * m * b.x + 2 * m * k * ctrl.x + k * k * tip.x, y: m * m * b.y + 2 * m * k * ctrl.y + k * k * tip.y };
    };
    c.save();
    c.lineCap = "round";
    const N = 26;
    // 그림자 한 번, 몸 한 번 — 밝은 물 위에서도 낚싯대가 읽히게
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) {
        const k0 = i / N, k1 = (i + 1) / N;
        const p0 = at(k0), p1 = at(k1);
        const w = lerp(9.5, 1.7, k0) * u;
        c.beginPath();
        c.moveTo(p0.x, p0.y);
        c.lineTo(p1.x, p1.y);
        if (pass === 0) {
          c.strokeStyle = "rgba(0,14,30,.4)";
          c.lineWidth = w + 2.2 * u;
        } else {
          c.strokeStyle = k0 < 0.2 ? look.grip : mix(look.butt, look.tip, (k0 - 0.2) / 0.8);
          c.lineWidth = w;
        }
        c.stroke();
      }
    }
    // 하이라이트 — 왼쪽 위에서 빛이 온다
    c.strokeStyle = "rgba(255,255,255,.3)";
    c.lineWidth = 1.2 * u;
    c.beginPath();
    for (let i = 4; i <= N; i++) {
      const p = at(i / N);
      const w = lerp(9.5, 1.7, i / N) * u * 0.26;
      if (i === 4) c.moveTo(p.x - w, p.y - w * 0.5);
      else c.lineTo(p.x - w, p.y - w * 0.5);
    }
    c.stroke();
    // 감은 실 · 가이드 링
    for (const k of [0.34, 0.5, 0.65, 0.78, 0.89, 0.97]) {
      const p = at(k), q = at(k + 0.012);
      const w = lerp(9.5, 1.7, k) * u;
      c.strokeStyle = look.wrap;
      c.lineWidth = Math.max(1.6 * u, 3 * u * (1 - k) + 1);
      const nx = -(q.y - p.y), ny = q.x - p.x;
      const d = Math.max(0.001, Math.hypot(nx, ny));
      c.beginPath();
      c.moveTo(p.x + (nx / d) * w * 0.62, p.y + (ny / d) * w * 0.62);
      c.lineTo(p.x - (nx / d) * w * 0.62, p.y - (ny / d) * w * 0.62);
      c.stroke();
      c.strokeStyle = "rgba(235,240,245,.92)";
      c.lineWidth = Math.max(0.8, 1.1 * u);
      c.beginPath();
      c.arc(p.x - (nx / d) * (w * 0.6 + 2.2 * u), p.y - (ny / d) * (w * 0.6 + 2.2 * u), lerp(3.2, 1.3, k) * u, 0, 6.29);
      c.stroke();
    }
    if (look.spark) {
      c.fillStyle = look.spark;
      for (let i = 0; i < 8; i++) {
        const p = at(0.28 + i * 0.09);
        c.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(this.t * 3 + i * 1.7));
        this.star4(c, p.x, p.y, 3 * u);
      }
      c.globalAlpha = 1;
    }
    // 릴 — 감으면 도는 게 보인다
    const r = at(0.17);
    const R = 14 * u;
    c.fillStyle = "rgba(0,14,30,.42)";
    c.beginPath();
    c.arc(r.x - 2 * u, r.y + 2 * u, R + 2 * u, 0, 6.29);
    c.fill();
    const g = c.createRadialGradient(r.x - R * 0.35, r.y - R * 0.35, 1, r.x, r.y, R);
    g.addColorStop(0, mix(look.reel, "#ffffff", 0.45));
    g.addColorStop(1, mix(look.reel, "#000000", 0.35));
    c.fillStyle = g;
    c.beginPath();
    c.arc(r.x, r.y, R, 0, 6.29);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.45)";
    c.lineWidth = 1.1 * u;
    for (let i = 0; i < 3; i++) {
      const a = this.reelAng + (i * Math.PI * 2) / 3;
      c.beginPath();
      c.moveTo(r.x, r.y);
      c.lineTo(r.x + Math.cos(a) * R * 0.78, r.y + Math.sin(a) * R * 0.78);
      c.stroke();
    }
    const ha = this.reelAng;
    c.strokeStyle = mix(look.reel, "#000000", 0.45);
    c.lineWidth = 2.6 * u;
    c.beginPath();
    c.moveTo(r.x, r.y);
    c.lineTo(r.x + Math.cos(ha) * R * 1.35, r.y + Math.sin(ha) * R * 1.35);
    c.stroke();
    c.fillStyle = "#f4efe4";
    c.beginPath();
    c.arc(r.x + Math.cos(ha) * R * 1.35, r.y + Math.sin(ha) * R * 1.35, 3.1 * u, 0, 6.29);
    c.fill();
    c.fillStyle = mix(look.reel, "#ffffff", 0.6);
    c.beginPath();
    c.arc(r.x, r.y, 2.7 * u, 0, 6.29);
    c.fill();
    c.restore();
  }

  private drawDrops(c: CanvasRenderingContext2D) {
    c.save();
    for (const d of this.drops) {
      const k = clamp(d.life / d.max, 0, 1);
      if (d.kind === "drop") {
        c.fillStyle = d.color;
        c.globalAlpha = Math.min(1, k * 2);
        const sp = Math.hypot(d.vx, d.vy);
        const stretch = clamp(1 + sp / (420 * this.u), 1, 2.5);
        c.save();
        c.translate(d.x, d.y);
        c.rotate(Math.atan2(d.vy, d.vx));
        c.beginPath();
        c.ellipse(0, 0, d.r * stretch, d.r, 0, 0, 6.29);
        c.fill();
        c.restore();
      } else if (d.kind === "spark") {
        c.fillStyle = d.color;
        c.globalAlpha = Math.min(1, k * 1.6);
        this.star4(c, d.x, d.y, d.r * (0.5 + k));
      } else {
        c.fillStyle = d.color;
        c.globalAlpha = Math.min(1, k * 3);
        c.save();
        c.translate(d.x, d.y);
        c.rotate(d.spin * 0.6);
        c.scale(1, Math.abs(Math.cos(d.spin)) * 0.85 + 0.15);
        c.fillRect(-d.r, -d.r * 0.55, d.r * 2, d.r * 1.1);
        c.restore();
      }
    }
    c.restore();
  }

  private drawOverlay(c: CanvasRenderingContext2D) {
    const v = this.view;
    const hot = v.phase === "fight" ? clamp((v.tension - 0.8) / 0.2, 0, 1) : 0;
    const danger = hot > 0 ? hot * (0.55 + 0.45 * Math.sin(this.t * 18)) : 0;
    if (danger > 0.01) {
      const R = Math.hypot(this.W, this.H) * 0.62;
      const g = c.createRadialGradient(this.W / 2, this.H / 2, R * 0.45, this.W / 2, this.H / 2, R);
      g.addColorStop(0, "rgba(255,40,60,0)");
      g.addColorStop(1, `rgba(255,30,50,${(danger * 0.62).toFixed(3)})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.W, this.H);
    }
    if (v.phase === "bite") {
      const R = Math.hypot(this.W, this.H) * 0.62;
      const g = c.createRadialGradient(this.bob.x, this.bob.y, R * 0.3, this.bob.x, this.bob.y, R);
      g.addColorStop(0, "rgba(0,10,26,0)");
      g.addColorStop(1, "rgba(0,10,26,.5)");
      c.fillStyle = g;
      c.fillRect(0, 0, this.W, this.H);
    }
    if (this.flash.a > 0.005) {
      c.fillStyle = alpha(this.flash.color, this.flash.a);
      c.fillRect(0, 0, this.W, this.H);
    }
  }

  /** 테스트용 — 지금 그리는 것의 개수 */
  counts() {
    return { drops: this.drops.length, rings: this.rings.length, foam: this.foam.length, bobOn: this.bob.on, fishOn: this.fish.on, flying: !!this.fly, leaping: !!this.leap, rays: this.rays.to };
  }
}
