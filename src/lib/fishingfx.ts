/* 낚시 연출 — 찌 · 줄 · 낚싯대 · 물보라 · 물고기 그림자 · 빛줄기를 캔버스 한 장에 직접 그린다.
 * 규칙은 lib/fishing(순수) 몫이고 여기엔 판정이 없다 — 화면이 view 와 사건(cast · hook · surge …)을 넘겨 주면 그리기만 한다.
 * 낚싯대는 산 낚싯대의 그림(public/fishing/rod_*.webp)을 띠로 잘라 휜 곡선을 따라 붙인다 — 그림이 그대로 보이면서 장력만큼 휜다(FX_ROD_ART). 그림이 오기 전엔 직접 그린 낚싯대.
 * 줄이 떨리고 물고기가 꼬리를 치는 건 그림 한 장으로 안 되니 나머지는 전부 직접 그린다.
 * ⚠ shadowBlur · ctx.filter 금지 — 폰에서 프레임이 무너지고 filter 는 사파리에 없다. 부드러움은 겹쳐 그리기와 그라디언트로 낸다.
 * ⚠ 시간은 frame(ms) 로만 받는다 — 시계를 직접 읽으면 테스트가 프레임을 못 돌린다(fishingfx.test 가 전 사건을 돌린다). */

export type FxPhase = "ready" | "charge" | "wait" | "bite" | "lure" | "aim" | "fight" | "fever" | "reveal" | "landed" | "scoop" | "result" | "lost";
export type FxLost = "early" | "late" | "snapped" | "slack" | "escaped";
export type FxMethod = "float" | "lure" | "scoop" | "deep";
export type FxView = { phase: FxPhase; charge: number; tension: number; dist: number; holding: boolean; rod: string; bait?: string; spot: string; method: FxMethod;
  /** 루어: 다음 박자까지(1→0) · 칠 때인가 · 관심(0~1) · 남은 줄(0~1) */ beat: number; beatHot: boolean; interest: number; line: number;
  /** 루어 힘겨루기: 낚싯대 · 물고기 좌우(-1~1) */ rodX: number; fishX: number;
  /** 심해: 초당 바퀴 */ spin: number;
  /** 던지기 전 돌린 각도 — 찌가 낚싯대 끝에서 이만큼 돈다 */ castAng: number };
export type FxShoalFish = { id: number; x: number; y: number; h: number; z: number; reach: boolean; size: number; grade: number; junk: boolean };

/** 낚시터의 날씨 — 비 · 눈만 그린다(맑음은 그림 그대로) */
export type FxWeather = "rain" | "snow" | null;
/** 한 화면의 입자 수 — 폰 프레임을 지키는 상한(테스트가 잠근다) */
export const FX_WEATHER_MAX = { rain: 190, snow: 150, splash: 54 } as const;

type SpotLook = { horizon: number; glint: string; air: "petal" | "mote" | "lantern" | "star" | "bird" };
/** 수평선(그림마다 재서 적었다) · 물빛 반짝임 색 · 공중에 떠다니는 것 */
export const FX_SPOTS: Readonly<Record<string, SpotLook>> = {
  dumulmeori: { horizon: 0.29, glint: "#fff1d0", air: "petal" },
  soyang: { horizon: 0.28, glint: "#ddecff", air: "mote" },
  hwacheon: { horizon: 0.26, glint: "#ddecff", air: "mote" },
  bonghwa: { horizon: 0.30, glint: "#ffffff", air: "petal" },
  sanriver: { horizon: 0.29, glint: "#ffffff", air: "bird" },
  brook: { horizon: 0.29, glint: "#ffffff", air: "petal" },
  pond: { horizon: 0.25, glint: "#ffe3a8", air: "petal" },
  jungle: { horizon: 0.29, glint: "#fff6c8", air: "mote" },
  seomjin: { horizon: 0.28, glint: "#ffffff", air: "petal" },
  harbor: { horizon: 0.26, glint: "#fff1d0", air: "bird" },
  reef: { horizon: 0.24, glint: "#ffffff", air: "bird" },
  ocean: { horizon: 0.30, glint: "#fff1d0", air: "bird" },
  palace: { horizon: 0.31, glint: "#ffd28a", air: "lantern" },
  starsea: { horizon: 0.28, glint: "#cfe0ff", air: "star" },
  abyss: { horizon: 0.27, glint: "#97e8ef", air: "star" },
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

/** 낚싯대 그림에서 잰 자리(512px 기준) — 손잡이 끝 · 낚싯대 끝 · 릴. 그림을 바꾸면 다시 잰다(fishingfx.test 가 표를 확인한다). */
export const FX_ROD_ART: Readonly<Record<string, { butt: readonly [number, number]; tip: readonly [number, number]; reel: readonly [number, number] }>> = {
  rod_bamboo: { butt: [450, 450], tip: [62, 54], reel: [316, 339] },
  rod_glass: { butt: [62, 448], tip: [454, 58], reel: [294, 339] },
  rod_carbon: { butt: [54, 444], tip: [458, 58], reel: [301, 316] },
  rod_titan: { butt: [60, 446], tip: [458, 60], reel: [324, 301] },
  rod_dragon: { butt: [68, 452], tip: [446, 54], reel: [263, 324] },
  rod_star: { butt: [58, 458], tip: [442, 64], reel: [248, 339] },
};
/** 그림을 낚싯대가 위로 서고 릴이 왼쪽(화면에선 아래쪽)에 오게 돌렸을 때의 치수 */
type RodSprite = { src: CanvasImageSource; w: number; h: number; reelX: number; reelK: number };

/** 그림을 세로로 세워 한 번만 굽는다 — 매 프레임 회전 계산을 안 하려고. 릴이 낚싯대 아래로 오게 필요하면 거울로 뒤집는다. */
function bakeRod(img: CanvasImageSource, key: string): RodSprite | null {
  const a = FX_ROD_ART[key];
  if (!a || typeof document === "undefined") return null;
  const dx = a.tip[0] - a.butt[0], dy = a.tip[1] - a.butt[1];
  const len = Math.hypot(dx, dy);
  const w = 300, h = Math.round(len + 24);
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const c = el.getContext("2d");
  if (!c) return null;
  // 낚싯대 축을 세로로: 끝이 위, 손잡이가 아래
  const ang = -Math.PI / 2 - Math.atan2(dy, dx);
  const flip = dx > 0 ? -1 : 1; // 끝이 오른쪽을 보는 그림은 뒤집어서 릴을 아래쪽으로
  c.translate(w / 2, h - 12);
  c.scale(flip, 1);
  c.rotate(ang);
  c.translate(-a.butt[0], -a.butt[1]);
  c.drawImage(img, 0, 0, 512, 512);
  const rx = a.reel[0] - a.butt[0], ry = a.reel[1] - a.butt[1];
  const along = (rx * dx + ry * dy) / len;
  const across = (rx * dy - ry * dx) / len;
  return { src: el, w, h, reelX: -Math.abs(across), reelK: along / len };
}

/** 등급(0~7)별 빛 — 물고기를 끌어올릴 때의 빛줄기 · 귀한 놈의 그림자 기운 · 축포 */
export const FX_GRADE_LIGHT: readonly string[] = ["#bfe6ff", "#a7f3d0", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fcd34d", "#fb923c", "#f0abfc"];

/** 찌가 떨어지는 자리(화면 비율) — 멀리 던질수록 수평선 쪽으로 간다 */
export function landingPoint(bonus: number, r: number): { x: number; y: number } {
  return { x: 0.32 + r * 0.2, y: 0.72 - Math.max(0, Math.min(1, bonus)) * 0.29 };
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
  private view: FxView = { phase: "ready", charge: 0, tension: 0.3, dist: 1, holding: false, rod: "rod_bamboo", spot: "brook", method: "float", beat: 1, beatHot: false, interest: 0, line: 1, rodX: 0, fishX: 0, spin: 0, castAng: 0 };
  /** 그림 파일 주소 — 화면이 넘긴다(여긴 basePath 를 모른다). 없으면(테스트) 직접 그린 낚싯대 */
  private artUrl: ((key: string) => string | null) | null = null;
  private rodArt: Record<string, RodSprite | "loading"> = {};
  private netArt: { key: string; img: CanvasImageSource } | null = null;
  private netKey = "";
  private shoal: FxShoalFish[] = [];
  private net: { t0: number; dur: number; x: number; y: number; r: number; hit: boolean | null } | null = null;
  private lureHop = 0;
  private bubbles: { x: number; y: number; r: number; v: number; p: number }[] = [];
  private reduced = false;

  private drops: Drop[] = [];
  private rings: Ring[] = [];
  private foam: Foam[] = [];
  private spec: { x: number; y: number; f: number; p: number; s: number }[] = [];
  private streaks: { x: number; y: number; w: number; v: number; p: number }[] = [];
  private air: { x: number; y: number; vx: number; vy: number; p: number; s: number }[] = [];
  private lookKey = "";
  private wx: FxWeather = null;
  /** z = 깊이(0 먼 쪽 ~ 1 코앞). 먼 빗방울일수록 작고 흐리고 수평선 가까이에 떨어진다 */
  private fall: { x: number; y: number; z: number; end: number; p: number }[] = [];
  private ripples: { x: number; y: number; life: number; k: number }[] = [];

  private rodAng = 0.5;
  private rodVel = 0;
  private rodKick = 0;
  private bend = 0;
  private reelAng = 0;
  private hang = { x: 0, y: 0, vx: 0, vy: 0, init: false };

  private bob = { on: false, x: 0, y: 0, sink: 0.25, sinkTo: 0.25, dip: 0, home: { x: 0, y: 0 } };
  private fly: { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; size: number; arc: number; side: number } | null = null;
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
  private paused = false;
  private dim = 0;
  private trail: { x: number; y: number }[] = [];
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
    this.frame(16); // 첫 프레임은 동기로 — rAF 가 밀려도 빈 화면이 되지 않게
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    this.frame(now - this.last);
    this.last = now;
    this.raf = requestAnimationFrame(this.loop);
  };

  /** 낚시터가 가려진 동안 멈춘다 — 3D 수조가 위에 열리면 폰이 전체 화면 렌더를 둘 돌리게 된다 */
  pause() {
    cancelAnimationFrame(this.raf);
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.last = performance.now(); // 멈춰 있던 시간을 한 프레임으로 몰지 않게
    this.raf = requestAnimationFrame(this.loop);
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
    if (v.rod) this.loadRod(v.rod);
    if (v.bait) this.loadBait(v.bait);
  }

  /** 미끼 그림 — 찌 밑에 실제로 달려 있는 모습 */
  private baitArt: { key: string; img: HTMLImageElement } | null = null;
  private loadBait(key: string) {
    if (this.baitArt?.key === key || !this.artUrl || typeof Image === "undefined") return;
    const src = this.artUrl(key);
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      if (this.view.bait === key) this.baitArt = { key, img };
    };
    img.src = src;
  }
  private drawBait(c: CanvasRenderingContext2D, x: number, y: number) {
    const a = this.baitArt, s = 24 * this.u;
    if (!a || a.key !== this.view.bait || !(s > 0)) return;
    // 찌에서 미끼까지 낚싯줄 — 없으면 미끼가 허공에 떠 보인다
    c.strokeStyle = "rgba(255,255,255,.8)";
    c.lineWidth = Math.max(1, this.u * 0.7);
    c.beginPath();
    c.moveTo(x, y - 8 * this.u);
    c.lineTo(x, y + s * 0.2);
    c.stroke();
    c.drawImage(a.img, x - s / 2, y, s, s);
  }

  /** 그림 주소 찾는 법 · 뜰채 — 화면이 처음 한 번 넘긴다 */
  art(url: (key: string) => string | null, netKey: string) {
    this.artUrl = url;
    this.loadRod(this.view.rod);
    if (this.view.bait) this.loadBait(this.view.bait);
    if (netKey !== this.netKey && typeof Image !== "undefined") {
      this.netKey = netKey;
      const src = url(netKey);
      if (src) {
        const img = new Image();
        img.onload = () => {
          this.netArt = { key: netKey, img };
        };
        img.src = src;
      }
    }
  }

  private loadRod(key: string) {
    if (this.rodArt[key] || !this.artUrl || typeof Image === "undefined") return;
    const src = this.artUrl(key);
    if (!src) return;
    this.rodArt[key] = "loading";
    const img = new Image();
    img.onload = () => {
      const sp = bakeRod(img, key);
      if (sp) this.rodArt[key] = sp;
      else delete this.rodArt[key];
    };
    img.onerror = () => {
      delete this.rodArt[key];
    };
    img.src = src;
  }

  /** 테스트용 — 구운 그림을 바로 넣는다 */
  useRodSprite(key: string, sp: RodSprite) {
    this.rodArt[key] = sp;
  }
  rodDrawnFromArt() {
    return typeof this.rodArt[this.view.rod] === "object";
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
    this.shoal = [];
    this.trail = [];
    this.net = null;
    this.lureHop = 0;
  }

  /** 던진다 — power(0~1)만큼 멀리 · 높이 · 오래 날고, curve(-1~1)만큼 돌린 쪽으로 휘어 들어간다(바나나킥) */
  cast(land: { x: number; y: number }, waitMs: number, size: number, grade: number, power: number, curve = 0) {
    const swing = this.trail;
    this.reset();
    this.trail = swing;
    this.rodKick = 0.3 + power * 0.3; // 앞으로 휘두른다
    this.rodVel -= 1 + power * 1.6;
    const x1 = land.x * this.W, y1 = land.y * this.H;
    this.fly = { t0: this.t, dur: 0.5 + power * 0.3, x0: this.hang.x, y0: this.hang.y, x1, y1, size: 0.45 + power * 0.25, arc: 0.08 + power * 0.16, side: curve * power * 0.34 };
    Object.assign(this.bob, { on: true, x: this.hang.x, y: this.hang.y, sink: 0, sinkTo: 0.25, dip: 0, home: { x: x1, y: y1 } });
    Object.assign(this.fish, { on: true, mode: "circle", size, grade, t0: this.t, waitS: Math.max(0.6, waitMs / 1000), ang: this.rnd() * 6.28, fade: 0, x: x1 + this.W * 0.3, y: y1 + this.H * 0.06, vx: 0, vy: 0, darts: 0 });
    if (power >= 0.6) this.sparkBurst(this.hang.x, this.hang.y, Math.round(power * 16), "#fde68a", 120 + power * 120);
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

  /** 사건 예고 — 물고기 둘레가 번쩍인다. 차고 나갈 땐 빨강, 뛰어오를 땐 노랑, 파고들 땐 파랑(화면 글자와 같은 색) */
  warn(kind: "surge" | "jump" | "dive") {
    const col = kind === "surge" ? "#fb7185" : kind === "jump" ? "#fde047" : "#7dd3fc";
    this.ring(this.fish.x, this.fish.y, 8, 170, 0.5, 4.5, col);
    this.ring(this.fish.x, this.fish.y, 8, 110, 0.6, 2.5, col, 0.1);
    this.splash(this.fish.x, this.fish.y, 7, 0.55);
    this.shake = Math.max(this.shake, 3);
  }

  /** 차고 나가면 물을 두드리고, 뛰어오르면 수면 위로 솟는다 — 눈으로 보고 대처가 갈려야 한다 */
  surge(kind: "surge" | "jump" = "surge") {
    const k = 1 + this.fish.size;
    this.surgeOn = kind === "surge" ? 1 : 0;
    this.surgeDir = this.fish.x > this.W * 0.42 ? -1 : 1;
    this.surgeCount += 1;
    this.shake = Math.max(this.shake, 7 * k);
    this.splash(this.fish.x, this.fish.y, Math.round(26 * k), 1.15 * k);
    this.ring(this.fish.x, this.fish.y, 6, 120, 0.55, 3, "#ffffff");
    if (kind === "jump" && !this.leap) {
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

  /** 끌어올렸다 — 물기둥과 등급 빛. 물고기 그림은 화면(DOM)이 띄운다. hold 면 빛은 공개(reveal) 때까지 아껴 둔다 */
  land(grade: number, hold = false) {
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
    this.rays = { a: 0, to: hold ? 0 : 0.5 + grade * 0.06, color: FX_GRADE_LIGHT[clamp(grade, 0, 7)] };
  }

  /** 등급 공개 — 흔함은 가볍게, 귀할수록 멈칫 · 번쩍 · 축포가 커진다 */
  reveal(grade: number) {
    const g = clamp(grade, 0, 7), c = FX_GRADE_LIGHT[g];
    this.stopT = this.reduced ? 0 : 0.05 + g * 0.03;
    this.flash = { a: 0.3 + g * 0.08, color: g >= 5 ? c : "#ffffff" };
    this.shake = Math.max(this.shake, 4 + g * 2.4);
    this.rays = { a: this.rays.a, to: 0.28 + g * 0.1, color: c };
    this.sparkBurst(this.W * 0.5, this.H * 0.2, 12 + g * 8, c, 220 + g * 34);
    if (g >= 4) this.confetti(g * 9, c);
  }

  /** 루어: 박자에 맞춰 톡 — 잘 칠수록 크게 튀고 물고기가 달려든다 */
  twitch(grade: "great" | "good" | "miss") {
    const b = this.bob;
    this.lureHop = grade === "miss" ? 0.4 : 1;
    this.rodKick = -0.12;
    this.rodVel += 1;
    if (grade === "miss") {
      this.splash(b.x, b.y, 8, 0.6);
      this.ring(b.x, b.y, 6, 90, 0.5, 2.5, "#fb7185");
      return;
    }
    this.fish.darts = 0.3;
    this.splash(b.x, b.y, grade === "great" ? 16 : 9, grade === "great" ? 0.85 : 0.6);
    this.ring(b.x, b.y, 6, grade === "great" ? 130 : 86, 0.5, 3, grade === "great" ? "#fde68a" : "#ffffff");
    if (grade === "great") this.sparkBurst(b.x, b.y - 6 * this.u, 9, "#fde68a", 170);
  }

  /** 루어: 물고기가 덮쳤다 */
  strike() {
    this.hook(true);
  }

  /** 뜰채: 수면의 물고기들 — 화면이 프레임마다 넘긴다 */
  setShoal(list: FxShoalFish[]) {
    this.shoal = list;
  }

  /** 뜰채를 내리친다 — 물에 닿기까지 dur 초. 맞았는지는 닿을 때 netLand 로 알려 준다 */
  plunge(x: number, y: number, r: number, dur: number) {
    this.net = { t0: this.t, dur, x: x * this.W, y: y * this.H, r: r * this.W, hit: null };
    this.rodKick = 0.1;
  }

  netLand(hit: boolean, grade: number) {
    const n = this.net;
    if (!n) return;
    n.hit = hit;
    n.t0 = this.t;
    n.dur = hit ? 0.9 : 0.55;
    const k = hit ? 1.3 : 0.9;
    this.splash(n.x, n.y, Math.round(34 * k), 1.15 * k);
    this.ring(n.x, n.y, n.r / this.u, 120, 0.6, 4, hit ? FX_GRADE_LIGHT[clamp(grade, 0, 7)] : "#ffffff");
    this.ring(n.x, n.y, 8, 200, 0.7, 2.5, "#ffffff", 0.06);
    this.addFoam(n.x, n.y, 30, 10);
    this.shake = Math.max(this.shake, hit ? 11 : 6);
    if (hit) {
      this.stopT = this.reduced ? 0 : 0.1;
      this.flash = { a: 0.45, color: "#ffffff" };
    }
  }

  /** 꽝 — 빛줄기 대신 시커먼 물과 먼지. 기대가 꺼지는 쪽이 재미다 */
  junked() {
    const x = this.W * 0.5, y = this.H * 0.8;
    this.rays.to = 0;
    this.rays.a = 0;
    this.shake = Math.max(this.shake, 8);
    this.flash = { a: 0.35, color: "#475569" };
    this.column(x, y, 24);
    for (let i = 0; i < 16; i++) {
      const a = this.rnd() * 6.28, sp = (40 + this.rnd() * 140) * this.u, life = 0.7 + this.rnd() * 0.6;
      this.pushDrop({ x, y: this.H * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * this.u, g: 190 * this.u, life, max: life, r: (3 + this.rnd() * 5) * this.u, floor: Infinity, color: this.rnd() < 0.5 ? "#64748b" : "#94a3b8", kind: "paper", spin: this.rnd() * 6 });
    }
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

  /** 장면이 길어져도(한 화면 레이아웃) 낚싯대가 폭을 따라간다 — 높이만 따라가면 릴이 물을 가린다 */
  private rodLen() {
    return Math.min(this.H * 0.8, this.W * 1.2);
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

  /** 날씨를 바꾼다 — 바뀔 때만 입자를 새로 뿌린다 */
  weather(wx: FxWeather) {
    if (wx === this.wx) return;
    this.wx = wx;
    this.seedWeather();
  }

  private seedWeather() {
    this.ripples = [];
    if (!this.wx) {
      this.fall = [];
      return;
    }
    const n = FX_WEATHER_MAX[this.wx];
    this.fall = Array.from({ length: n }, () => this.newFall(this.rnd() * this.H * 1.2 - this.H * 0.2));
  }

  /** 앞쪽은 적게, 먼 쪽은 많이 — 코앞 입자가 많으면 화면이 줄무늬로 덮인다 */
  private newFall(y: number) {
    const z = this.rnd() ** 1.45;
    const hz = this.look().horizon * this.H;
    return { x: this.rnd() * this.W * 1.3 - this.W * 0.15, y, z, end: hz + (this.H - hz) * Math.min(1, z * 1.1 + this.rnd() * 0.08), p: this.rnd() * 6.28 };
  }

  private stepWeather(real: number) {
    if (!this.wx || this.reduced) return;
    const gust = Math.sin(this.t * 0.31) * 0.5 + Math.sin(this.t * 0.83 + 1.3) * 0.3;
    const icy = this.view.spot === "hwacheon";
    for (let i = 0; i < this.fall.length; i++) {
      const f = this.fall[i];
      if (this.wx === "rain") {
        const vy = (720 + 760 * f.z) * this.u;
        f.y += vy * real;
        f.x += vy * (-0.14 + gust * 0.05) * real;
        if (f.y >= f.end) {
          if (!icy && this.ripples.length < FX_WEATHER_MAX.splash && (f.z > 0.12 || this.rnd() < 0.3)) this.ripples.push({ x: f.x, y: f.end, life: 1, k: 0.3 + f.z * 0.9 });
          this.fall[i] = this.newFall(-this.rnd() * this.H * 0.25);
        }
      } else {
        const vy = (20 + 58 * f.z) * this.u;
        f.y += vy * real;
        f.x += (Math.sin(this.t * (0.5 + f.z * 0.5) + f.p) * (7 + 20 * f.z) + gust * (8 + 16 * f.z)) * this.u * real;
        if (f.y >= f.end) this.fall[i] = this.newFall(-this.rnd() * this.H * 0.12);
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].life -= real * 2.4;
      if (this.ripples[i].life <= 0) this.ripples.splice(i, 1);
    }
  }

  /** 낚시찌 · 낚싯대 뒤의 먼 입자와 수면 파문 */
  private drawWeatherBack(c: CanvasRenderingContext2D) {
    if (!this.wx) return;
    c.save();
    c.lineCap = "round";
    if (this.wx === "rain") {
      // 파문 — 수면에 눕도록 납작한 타원. 첫 순간엔 튀어 오른 물방울이 위에 있다
      c.strokeStyle = "#e4f0ff";
      for (const p of this.ripples) {
        const g = 1 - p.life, rx = (2 + 16 * g) * p.k * this.u;
        c.globalAlpha = p.life * 0.62;
        c.lineWidth = Math.max(0.5, 1.1 * p.k * p.life);
        c.beginPath();
        c.ellipse(p.x, p.y, rx, rx * 0.3, 0, 0, Math.PI * 2);
        c.stroke();
        if (g < 0.35 && p.k > 0.6) {
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x + 1.2 * this.u, p.y - (2 + 16 * g) * p.k * this.u);
          c.stroke();
        }
      }
      this.strokeRain(c, 0, 0.42, 0.3, 0.7);
    } else {
      this.fillSnow(c, 0, 0.5, 0.75);
    }
    c.restore();
  }

  /** 낚싯대 앞을 지나가는 가까운 입자 */
  private drawWeatherFront(c: CanvasRenderingContext2D) {
    if (!this.wx) return;
    c.save();
    c.lineCap = "round";
    if (this.wx === "rain") {
      this.strokeRain(c, 0.42, 0.78, 0.36, 1);
      this.strokeRain(c, 0.78, 1.01, 0.3, 1.8);
    } else {
      this.fillSnow(c, 0.5, 1.01, 0.92);
    }
    c.restore();
  }

  /** 한 깊이 층을 경로 하나로 — 입자마다 stroke 를 부르면 폰에서 프레임이 떨어진다 */
  private strokeRain(c: CanvasRenderingContext2D, lo: number, hi: number, alpha: number, width: number) {
    const gust = Math.sin(this.t * 0.31) * 0.5 + Math.sin(this.t * 0.83 + 1.3) * 0.3, slant = -0.14 + gust * 0.05;
    c.strokeStyle = "#dfeaff";
    c.globalAlpha = alpha;
    c.lineWidth = width * Math.max(0.8, this.u);
    for (const part of [1, 0.45]) {
      c.globalAlpha = part === 1 ? alpha * 0.55 : alpha;
      c.beginPath();
      for (const f of this.fall) {
        if (f.z < lo || f.z >= hi) continue;
        const len = (14 + 62 * f.z) * this.u * part;
        c.moveTo(f.x, f.y);
        c.lineTo(f.x - slant * len, f.y - len);
      }
      c.stroke();
    }
  }

  /** 눈송이 = 옅은 원 세 겹이라 shadowBlur 없이 가장자리가 부드럽다. 코앞(z > 0.82)은 초점이 나간 큰 송이로 심만 뺀다 */
  private fillSnow(c: CanvasRenderingContext2D, lo: number, hi: number, alpha: number) {
    c.fillStyle = "#ffffff";
    for (const [scale, a, far] of [[2.6, 0.07, 1], [1.7, 0.16, 1], [1, 0.8, 0.82]] as const) {
      c.globalAlpha = alpha * a;
      c.beginPath();
      for (const f of this.fall) {
        if (f.z < lo || f.z >= hi || f.z >= far) continue;
        // 송이마다 크기가 조금씩 다르다(같은 크기면 점박이 무늬로 읽힌다)
        const r = (0.55 + 2.1 * f.z + (f.z > 0.82 ? 2.2 : 0)) * (0.75 + 0.25 * Math.sin(f.p * 7)) * this.u * scale;
        // 땅에 닿을 무렵 스러진다 — 수면에서 뚝 끊기지 않게
        const q = r * Math.min(1, Math.max(0.25, (f.end - f.y) / (24 * this.u)));
        c.moveTo(f.x + q, f.y);
        c.arc(f.x, f.y, q, 0, Math.PI * 2);
      }
      c.fill();
    }
  }

  private seedLook() {
    const key = `${this.view.spot}:${this.W}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    const hz = this.look().horizon * this.H;
    this.seedWeather();
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
    this.stepWeather(real);
    this.draw();
    if (this.host) {
      const s = this.reduced ? 0 : this.shake;
      this.host.style.translate = s > 0.3 ? `${((this.rnd() - 0.5) * s).toFixed(1)}px ${((this.rnd() - 0.5) * s).toFixed(1)}px` : "";
    }
  }

  private step(dt: number, real: number) {
    const v = this.view;
    this.shake = Math.max(0, this.shake - real * 34);
    this.dim += ((v.phase === "reveal" ? 0.55 : 0) - this.dim) * Math.min(1, real * 7);
    this.flash.a = Math.max(0, this.flash.a - real * 3.2);
    this.rays.a += (this.rays.to - this.rays.a) * Math.min(1, real * 5);
    this.rodKick *= Math.max(0, 1 - dt * 6);

    // 낚싯대 — 스프링이라 휘두른 뒤 낭창낭창 되돌아온다
    let to = 0.47 + Math.sin(this.t * 0.8) * 0.008;
    if (v.phase === "charge") to = 0.47 - v.charge * 0.2 + Math.sin(v.castAng) * (0.02 + v.charge * 0.06);
    if (v.phase === "fight") to = v.method === "lure" ? 0.5 - clamp(v.rodX, -1, 1) * 0.3 : 0.5 + (v.holding ? -0.05 : 0.03);
    to += this.rodKick;
    this.rodVel += ((to - this.rodAng) * 150 - this.rodVel * 13) * dt;
    this.rodAng += this.rodVel * dt;
    const bendTo = v.phase === "fight" ? clamp(v.tension, 0, 1.05) : v.phase === "bite" ? 0.42 : 0;
    this.bend += (bendTo - this.bend) * Math.min(1, dt * 14);
    if (v.method === "deep" && v.phase === "fight") this.reelAng += dt * v.spin * 6.28;
    else if (v.phase === "fight" && v.holding) this.reelAng += dt * 22;
    if (v.phase === "lure") this.reelAng += dt * (this.lureHop > 0 ? 14 : 2);
    this.stepBubbles(dt);

    // 찌가 줄 끝에 대롱대롱 — 낚싯대를 따라 늦게 움직인다
    const tip = this.rodTip();
    const whirl = v.phase === "charge" ? (22 + v.charge * 62) * this.u : 0;
    const hx = tip.x + Math.cos(v.castAng) * whirl;
    const hy = tip.y + 44 * this.u + Math.sin(v.castAng) * whirl * 0.7;
    if (!this.hang.init) Object.assign(this.hang, { x: tip.x, y: hy, vx: 0, vy: 0, init: true });
    const stiff = whirl > 0 ? 4 : 1; // 돌릴 땐 손을 바짝 따라온다
    this.hang.vx += ((hx - this.hang.x) * 60 * stiff - this.hang.vx * 4 * Math.sqrt(stiff)) * dt;
    this.hang.vy += ((hy - this.hang.y) * 80 * stiff - this.hang.vy * 7 * Math.sqrt(stiff)) * dt;
    this.hang.x += this.hang.vx * dt;
    this.hang.y += this.hang.vy * dt;

    if (v.phase === "charge") this.pushTrail(this.hang.x, this.hang.y);
    else if (!this.fly && this.trail.length) this.trail.shift();
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

  /** 심해일 때만 — 어두운 물속에서 올라오는 공기 방울 */
  private pushTrail(x: number, y: number) {
    this.trail.push({ x, y });
    if (this.trail.length > 26) this.trail.shift();
  }

  /** 찌가 그린 궤적 — 돌릴 땐 고리, 던지면 휘어 나가는 선. 힘이 쌓일수록 뜨거운 색 */
  private drawTrail(c: CanvasRenderingContext2D) {
    const n = this.trail.length;
    if (n < 3) return;
    const col = mix("#ffffff", "#fb923c", clamp(this.view.charge * 1.2, 0, 1));
    c.save();
    c.lineCap = "round";
    c.strokeStyle = this.fly ? "#fde68a" : col;
    for (let i = 1; i < n; i++) {
      const k = i / n;
      c.globalAlpha = k * 0.8;
      c.lineWidth = (0.8 + k * 3.4) * this.u;
      c.beginPath();
      c.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      c.lineTo(this.trail[i].x, this.trail[i].y);
      c.stroke();
    }
    c.restore();
  }

  private stepBubbles(dt: number) {
    const v = this.view;
    if (v.method !== "deep" || v.phase !== "fight" || this.reduced) {
      if (this.bubbles.length) this.bubbles = [];
      return;
    }
    if (this.bubbles.length < 26 && this.rnd() < dt * 16) {
      const hz = this.look().horizon * this.H;
      this.bubbles.push({ x: this.rnd() * this.W, y: this.H + 6, r: (1.5 + this.rnd() * 4) * this.u, v: (50 + this.rnd() * 90) * this.u, p: this.rnd() * 6.28 });
      if (hz < 0) this.bubbles.pop();
    }
    const top = this.look().horizon * this.H;
    this.bubbles = this.bubbles.filter((b) => {
      b.y -= b.v * dt;
      return b.y > top;
    });
  }

  private stepBob(dt: number) {
    const b = this.bob;
    if (this.fly) {
      const f = this.fly, p = clamp((this.t - f.t0) / f.dur, 0, 1);
      b.x = lerp(f.x0, f.x1, p) + Math.sin(p * Math.PI) * f.side * this.W;
      b.y = lerp(f.y0, f.y1, p) - Math.sin(p * Math.PI) * this.H * f.arc;
      this.pushTrail(b.x, b.y);
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
    if (this.view.phase === "lure") {
      // 칠 때마다 루어가 조금씩 내 쪽으로 온다
      const k = 1 - clamp(this.view.line, 0, 1);
      const tx = lerp(b.home.x, this.W * 0.56, k), ty = lerp(b.home.y, this.H * 0.87, k);
      b.x += (tx - b.x) * Math.min(1, dt * 7);
      b.y += (ty - b.y) * Math.min(1, dt * 7);
      this.lureHop = Math.max(0, this.lureHop - dt * 3.2);
    }
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

    if (f.mode === "circle" && v.phase === "lure") {
      // 루어를 쫓는다 — 관심이 오를수록 바짝, 식으면 멀어진다
      const gap = lerp(120, 22, clamp(v.interest, 0, 1)) * u * this.persp(bob.y) * 1.4;
      f.ang += dt * 1.4;
      tx = bob.x + Math.cos(f.ang) * gap * 0.5;
      ty = bob.y - gap * 0.55 + Math.sin(f.ang * 1.3) * gap * 0.16;
      k = f.darts > 0 ? 34 : 9;
    } else if (f.mode === "circle") {
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
      tx = v.method === "lure"
        ? this.W * (0.5 + clamp(v.fishX, -1, 1) * 0.36)
        : this.W * (0.44 + Math.sin(this.t * 0.9) * 0.13 + Math.sin(this.t * 2.3 + 1) * 0.05) + this.surgeOn * this.surgeDir * this.W * 0.14;
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
    if (!this.reduced && !this.wx) this.drawAir(c);
    this.drawWater(c);
    this.drawWeatherBack(c);
    this.drawRings(c);
    this.drawFoam(c);
    this.drawDeep(c);
    this.drawShoal(c);
    this.drawFishShadow(c);
    this.drawBobberUnder(c);
    this.drawRays(c);
    this.drawLine(c);
    this.drawBobber(c);
    this.drawLeap(c);
    this.drawSnap(c);
    this.drawTrail(c);
    this.drawBiteClock(c);
    this.drawBeatRing(c);
    this.drawRod(c);
    this.drawNet(c);
    this.drawDrops(c);
    this.drawWeatherFront(c);
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
    for (const g of this.wx ? [] : this.spec) { // 비 · 눈 오는 날 수면에 햇빛이 반짝이면 어색하다
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
    // 심해에선 끌어올릴수록 어둠에서 드러난다
    if (this.view.method === "deep" && this.view.phase === "fight") c.globalAlpha = lerp(1, 0.35, clamp(this.view.dist, 0, 1));
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
    if (this.view.method === "scoop") return { x: 0, y: 0, on: false }; // 뜰채엔 줄이 없다
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

  /** 루어 — 작은 물고기 모양 + 바늘. 튈 때마다 몸이 기운다 */
  private lureBody(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    c.save();
    c.translate(x, y);
    c.rotate(-0.25 + this.lureHop * -0.55 + Math.sin(this.t * 7) * 0.08);
    const g = c.createLinearGradient(0, -5 * s, 0, 5 * s);
    g.addColorStop(0, "#22d3ee");
    g.addColorStop(0.55, "#f8fafc");
    g.addColorStop(1, "#f59e0b");
    c.fillStyle = g;
    c.strokeStyle = "rgba(2,16,28,.7)";
    c.lineWidth = Math.max(0.7, 1 * s);
    c.beginPath();
    c.moveTo(11 * s, 0);
    c.quadraticCurveTo(3 * s, -6 * s, -6 * s, -2 * s);
    c.lineTo(-11 * s, -5 * s);
    c.lineTo(-10 * s, 5 * s);
    c.lineTo(-6 * s, 2 * s);
    c.quadraticCurveTo(3 * s, 6 * s, 11 * s, 0);
    c.fill();
    c.stroke();
    c.fillStyle = "#0f172a";
    c.beginPath();
    c.arc(6 * s, -1 * s, 1.3 * s, 0, 6.29);
    c.fill();
    c.strokeStyle = "#e2e8f0";
    c.lineWidth = Math.max(0.6, 0.9 * s);
    c.beginPath();
    c.moveTo(0, 4 * s);
    c.lineTo(0, 8 * s);
    c.arc(-2 * s, 8 * s, 2 * s, 0, 3.4);
    c.stroke();
    c.restore();
  }

  private drawBobber(c: CanvasRenderingContext2D) {
    const v = this.view, b = this.bob;
    if (v.method === "scoop") return;
    if (v.method === "lure") {
      if (!b.on && !this.fly) {
        if (v.phase === "ready" || v.phase === "charge") {
          this.lureBody(c, this.hang.x, this.hang.y + 6 * this.u, 1.1 * this.u);
          this.drawBait(c, this.hang.x, this.hang.y + 20 * this.u);
        }
        return;
      }
      const s = (this.fly ? 0.9 : Math.max(0.6, this.persp(b.y))) * this.u * 1.15;
      this.lureBody(c, b.x, b.y - (this.lureHop * 12 + 2) * s, s);
      return;
    }
    if (!b.on && !this.fly) {
      if (v.phase === "ready" || v.phase === "charge") {
        this.bobberBody(c, this.hang.x, this.hang.y + 8 * this.u, 0.95 * this.u);
        this.drawBait(c, this.hang.x, this.hang.y + 24 * this.u);
      }
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

  /** 산 낚싯대의 그림을 띠로 잘라 곡선을 따라 붙인다 — 그림이 보이면서 휜다. 위쪽만 휘므로 릴은 찌그러지지 않는다. */
  private drawRodArt(c: CanvasRenderingContext2D, sp: RodSprite, at: (k: number) => { x: number; y: number }, L: number) {
    const N = 28;
    const scale = L / (sp.h - 24);
    const dw = sp.w * scale;
    for (let i = 0; i < N; i++) {
      const k0 = i / N, k1 = (i + 1) / N;
      const p0 = at(k0), p1 = at(k1);
      const seg = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const sy = (1 - k1) * (sp.h - 24) + 12;
      const sh = (k1 - k0) * (sp.h - 24);
      c.save();
      c.translate(p0.x, p0.y);
      c.rotate(Math.atan2(p1.y - p0.y, p1.x - p0.x) + Math.PI / 2);
      c.drawImage(sp.src, 0, sy, sp.w, sh + 0.8, -dw / 2, -seg - 0.6, dw, seg + 1.2);
      c.restore();
    }
    // 릴이 도는 게 보이게 — 그림 위에 빛 한 줄이 돈다
    const r = at(sp.reelK);
    const R = 15 * this.u;
    if (this.view.phase === "fight" || this.view.phase === "lure") {
      c.save();
      c.translate(r.x + sp.reelX * scale, r.y);
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = "rgba(255,255,255,.75)";
      c.lineWidth = 2 * this.u;
      c.lineCap = "round";
      for (let i = 0; i < 2; i++) {
        const a = this.reelAng + i * Math.PI;
        c.beginPath();
        c.moveTo(Math.cos(a) * R * 0.25, Math.sin(a) * R * 0.25);
        c.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        c.stroke();
      }
      c.restore();
    }
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
    // 뜰채 낚시는 낚싯대 대신 뜰채를 든다 — 물을 가리지 않게 구석에, 내리칠 땐 손에서 떠난다
    if (this.view.method === "scoop") {
      if (!this.net && this.view.phase !== "landed" && this.view.phase !== "scoop" && this.view.phase !== "result") {
        const size = this.W * 0.42;
        this.netPic(c, this.W * 0.93 + Math.sin(this.t * 1.2) * 2 * u, this.H * 0.93 + Math.cos(this.t * 0.9) * 2 * u, size, 0, 1);
      }
      return;
    }
    const sprite = this.rodArt[this.view.rod];
    if (sprite && sprite !== "loading") {
      this.drawRodArt(c, sprite, at, L);
      return;
    }
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

  /** 심해 — 물만 어두워진다. 끌어올릴수록 밝아져서 '올라오고 있다'가 보인다 */
  private drawDeep(c: CanvasRenderingContext2D) {
    const v = this.view;
    if (v.method !== "deep" || (v.phase !== "fight" && v.phase !== "bite" && v.phase !== "wait")) return;
    const top = this.look().horizon * this.H;
    const depth = v.phase === "fight" ? clamp(v.dist, 0, 1.2) : 1;
    const g = c.createLinearGradient(0, top, 0, this.H);
    g.addColorStop(0, `rgba(2,12,34,${(0.16 + depth * 0.28).toFixed(3)})`);
    g.addColorStop(1, `rgba(1,6,22,${(0.3 + depth * 0.56).toFixed(3)})`);
    c.fillStyle = g;
    c.fillRect(0, top, this.W, this.H - top);
    c.save();
    c.strokeStyle = "rgba(190,230,255,.6)";
    c.lineWidth = Math.max(0.7, 1 * this.u);
    for (const b of this.bubbles) {
      c.globalAlpha = 0.65;
      c.beginPath();
      c.arc(b.x + Math.sin(this.t * 2.4 + b.p) * 4 * this.u, b.y, b.r, 0, 6.29);
      c.stroke();
    }
    c.restore();
  }

  /** 뜰채 — 헤엄치는 그림자들. 빛의 색이 등급이고, 깊이 들어가면 흐려져서 못 건진다. 쓰레기는 빛이 없다. */
  private drawShoal(c: CanvasRenderingContext2D) {
    for (const f of this.shoal) {
      const x = f.x * this.W, y = f.y * this.H;
      const L = (46 + f.size * 92) * this.u * Math.max(0.62, this.persp(y));
      const a = f.reach ? 0.5 + f.z * 0.42 : 0.14;
      c.save();
      if (!f.junk && f.reach) {
        const col = FX_GRADE_LIGHT[clamp(f.grade, 0, 7)];
        const r = L * (0.72 + Math.sin(this.t * 3 + f.id) * 0.07);
        c.save();
        c.globalCompositeOperation = "lighter";
        c.translate(x, y);
        c.scale(1, 0.55);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, alpha(col, 0.15 + f.z * 0.5));
        g.addColorStop(1, alpha(col, 0));
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, r, 0, 6.29);
        c.fill();
        c.restore();
        // 밝은 물에선 빛이 안 보이니 등급 색 고리를 같이 — 무엇을 노릴지 고를 수 있어야 한다
        c.save();
        c.strokeStyle = "rgba(2,16,28,.45)";
        c.lineWidth = 4.4 * this.u;
        c.globalAlpha = 0.5 + f.z * 0.5;
        c.beginPath();
        c.ellipse(x, y, L * 0.66, L * 0.36, 0, 0, 6.29);
        c.stroke();
        c.strokeStyle = col;
        c.lineWidth = 2.4 * this.u;
        c.stroke();
        c.restore();
      }
      c.translate(x, y);
      c.scale(1, 0.56);
      c.rotate(f.h);
      c.fillStyle = "#001226";
      c.globalAlpha = a;
      this.fishPath(c, L, this.t * 9 + f.id);
      c.fill();
      c.restore();
    }
  }

  /** 루어 박자 — 루어를 향해 조여드는 고리. 안쪽 고리와 겹칠 때 친다 */
  private drawBeatRing(c: CanvasRenderingContext2D) {
    const v = this.view, b = this.bob;
    if (v.phase !== "lure" || !b.on || this.fly) return;
    const s = Math.max(0.62, this.persp(b.y)) * this.u;
    const R0 = 18 * s;
    const R = R0 + clamp(v.beat, 0, 1) * 70 * s;
    c.save();
    c.lineWidth = 2.4 * this.u;
    c.strokeStyle = "rgba(255,255,255,.95)";
    c.beginPath();
    c.ellipse(b.x, b.y, R0, R0 * 0.62, 0, 0, 6.29);
    c.stroke();
    c.strokeStyle = "rgba(0,18,38,.5)";
    c.lineWidth = 6 * this.u;
    c.beginPath();
    c.ellipse(b.x, b.y, R, R * 0.62, 0, 0, 6.29);
    c.stroke();
    c.strokeStyle = v.beatHot ? "#4ade80" : "#fde047";
    c.lineWidth = 3.6 * this.u;
    c.stroke();
    c.restore();
  }

  /** 뜰채 내리치기 — 조준 원 + 뜰채 그림이 날아와 꽂힌다 */
  private drawNet(c: CanvasRenderingContext2D) {
    const n = this.net;
    if (!n) return;
    const p = clamp((this.t - n.t0) / n.dur, 0, 1);
    if (n.hit === null) {
      const k = p * p;
      c.save();
      c.strokeStyle = "rgba(255,255,255,.95)";
      c.setLineDash([6 * this.u, 5 * this.u]);
      c.lineWidth = 2.2 * this.u;
      c.beginPath();
      c.arc(n.x, n.y, n.r, 0, 6.29);
      c.stroke();
      c.restore();
      this.netPic(c, lerp(this.W * 1.05, n.x, k), lerp(this.H * 1.1, n.y, k), n.r * lerp(3.2, 2.5, k), lerp(0.7, 0, k), 1);
      return;
    }
    if (p >= 1) {
      this.net = null;
      return;
    }
    // 건져 올린다(맞았을 때) · 그냥 빠진다(헛손질)
    const y = n.hit ? n.y - p * this.H * 0.12 : n.y + p * 24 * this.u;
    this.netPic(c, n.x, y, n.r * 2.5, n.hit ? -0.14 * p : 0.1 * p, 1 - p * p);
  }

  private netPic(c: CanvasRenderingContext2D, x: number, y: number, size: number, ang: number, a: number) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.globalAlpha = a;
    if (this.netArt) {
      c.drawImage(this.netArt.img, -size * 0.5, -size * 0.5, size, size);
    } else {
      c.strokeStyle = "#f8fafc";
      c.lineWidth = 3 * this.u;
      c.beginPath();
      c.ellipse(0, 0, size * 0.3, size * 0.24, 0, 0, 6.29);
      c.moveTo(size * 0.24, size * 0.16);
      c.lineTo(size * 0.6, size * 0.5);
      c.stroke();
    }
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
    if (this.dim > 0.01) {
      c.fillStyle = `rgba(0,8,22,${this.dim.toFixed(3)})`;
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
