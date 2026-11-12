/* 낚시 연출 — 찌 · 줄 · 낚싯대 · 물보라 · 물고기 그림자 · 빛줄기를 캔버스 한 장에 직접 그린다.
 * 규칙은 lib/fishing(순수) 몫이고 여기엔 판정이 없다 — 화면이 view 와 사건(cast · hook · surge …)을 넘겨 주면 그리기만 한다.
 * 낚싯대는 산 낚싯대의 그림(public/fishing/rod_*.webp)을 띠로 잘라 휜 곡선을 따라 붙인다 — 그림이 그대로 보이면서 장력만큼 휜다(FX_ROD_ART). 그림이 오기 전엔 직접 그린 낚싯대.
 * 줄이 떨리고 물고기가 꼬리를 치는 건 그림 한 장으로 안 되니 나머지는 전부 직접 그린다.
 * ⚠ shadowBlur · ctx.filter 금지 — 폰에서 프레임이 무너지고 filter 는 사파리에 없다. 부드러움은 겹쳐 그리기와 그라디언트로 낸다.
 * ⚠ 시간은 frame(ms) 로만 받는다 — 시계를 직접 읽으면 테스트가 프레임을 못 돌린다(fishingfx.test 가 전 사건을 돌린다). */
import { DRAW_MS, frameGate } from "./advframe.ts";

import { RODS_WITH_DRAWN_LINE, stripThinStrokes } from "./rodstrip.ts";
export type FxPhase = "ready" | "charge" | "wait" | "bite" | "lure" | "aim" | "lift" | "fight" | "fever" | "reveal" | "landed" | "scoop" | "result" | "lost";
export type FxLost = "early" | "late" | "snapped" | "slack" | "escaped";
type FxMethod = "float" | "lure" | "scoop" | "deep";
type FxView = { phase: FxPhase; charge: number; tension: number; dist: number; holding: boolean; rod: string; bait?: string; spot: string; method: FxMethod;
  /** 루어: 다음 박자까지(1→0) · 칠 때인가 · 관심(0~1) · 남은 줄(0~1) */ beat: number; beatHot: boolean; interest: number; line: number;
  /** 루어 힘겨루기: 낚싯대 · 물고기 좌우(-1~1) */ rodX: number; fishX: number;
  /** 심해: 초당 바퀴 */ spin: number;
  /** 던지기 전 돌린 각도 — 찌가 낚싯대 끝에서 이만큼 돈다 */ castAng: number };
type FxShoalFish = { id: number; x: number; y: number; h: number; z: number; reach: boolean; size: number; grade: number; junk: boolean };

/** 낚시터의 날씨 — 비 · 눈만 그린다(맑음은 그림 그대로) */
type FxWeather = "rain" | "snow" | null;
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

/** 구운 낚싯대 캔버스를 비운다 — 버린 FishFx 의 그림이 GC 를 기다리며 캔버스 메모리를 붙잡지 않게 */
function releaseRod(sp: RodSprite) {
  const el = sp.src as { width?: number; height?: number };
  if (typeof el.width === "number") el.width = 0;
  if (typeof el.height === "number") el.height = 0;
}

/** 그림을 세로로 세워 한 번만 굽는다 — 매 프레임 회전 계산을 안 하려고. 릴이 낚싯대 아래로 오게 필요하면 거울로 뒤집는다. */
/** 원화에 그려진 줄을 지운 사본(lib/rodstrip) — 진짜 줄 옆에 줄이 하나 더 보이지 않게. 실패하면 원화 그대로 */
function withoutDrawnLine(img: CanvasImageSource): CanvasImageSource {
  try {
    const el = document.createElement("canvas");
    el.width = 512;
    el.height = 512;
    const c = el.getContext("2d", { willReadFrequently: true });
    if (!c) return img;
    c.drawImage(img, 0, 0, 512, 512);
    const d = c.getImageData(0, 0, 512, 512);
    stripThinStrokes(d.data, 512, 512);
    c.putImageData(d, 0, 0);
    return el;
  } catch {
    return img;
  }
}

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
  c.drawImage(RODS_WITH_DRAWN_LINE.has(key) ? withoutDrawnLine(img) : img, 0, 0, 512, 512);
  const rx = a.reel[0] - a.butt[0], ry = a.reel[1] - a.butt[1];
  const along = (rx * dx + ry * dy) / len;
  const across = (rx * dy - ry * dx) / len;
  return { src: el, w, h, reelX: -Math.abs(across), reelK: along / len };
}

/** 장비 꾸미기(2026-11-12, lib/fishlooks) — 연출이 받는 모습. 능력치와는 상관없다.
 *  bobber: 찌 모양 id(FX_BOBBERS) · line: 줄 색 #rrggbb(mix 가 이 꼴만 읽는다) · rodTint: 낚싯대에 입힐 색(빈 값 = 그림 그대로) */
export type FxLook = { bobber: string; line: string; rodTint: string };
export const FX_LOOK_DEFAULT: Readonly<FxLook> = { bobber: "bob_red", line: "#ffffff", rodTint: "" };
/** 찌 모양 — 상점의 꾸미기 id 와 같아야 한다(fishlooks.test 가 맞춰 본다). 모르는 id 는 기본 빨강으로 그린다 */
export const FX_BOBBERS = ["bob_red", "bob_star", "bob_heart", "bob_duck", "bob_moon", "bob_gold"] as const;

type BobberPal = { hi: string; mid: string; lo: string; band: string | null; edge: string };
const BOBBER_PAL: Readonly<Record<string, BobberPal>> = {
  bob_red: { hi: "#ff6b5e", mid: "#e6242d", lo: "#8e0f1d", band: "#fffdf5", edge: "rgba(60,8,16,.55)" },
  bob_star: { hi: "#fff27a", mid: "#facc15", lo: "#b45309", band: "#fffdf5", edge: "rgba(90,50,4,.55)" },
  bob_heart: { hi: "#ffc2dd", mid: "#f472b6", lo: "#9d174d", band: null, edge: "rgba(90,10,50,.55)" },
  bob_duck: { hi: "#fff7a8", mid: "#fde047", lo: "#ca8a04", band: null, edge: "rgba(90,60,4,.55)" },
  bob_moon: { hi: "#4b5ea8", mid: "#1e2a5a", lo: "#0b1233", band: null, edge: "rgba(4,8,30,.7)" },
  bob_gold: { hi: "#fff3b0", mid: "#e5b84a", lo: "#8a5a12", band: "#fff8dc", edge: "rgba(80,50,6,.6)" },
};

/** 별 하나(다섯 뿔) — 찌 무늬 · 반짝임에 쓴다 */
function starPath(c: CanvasRenderingContext2D, x: number, y: number, r: number, inner = 0.45) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * inner : r;
    if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

/** 찌 한 개를 그린다 — 연출(FishFx)과 상점 미리보기가 같은 함수를 쓴다(상점에서 본 찌가 낚시터의 찌다).
 *  ⚠ 모양은 기존 찌의 자리 안(가로 ±8s · 위 −18s ~ 아래 +5s)에만 그린다 — 다 잠겼는지 판정 · 수면 위 자르기 · 입질의 잠김이 이 자리를 가정한다.
 *  grad 는 그라디언트 캐시(같은 열쇠면 다시 안 만든다) — 열쇠에 찌 id 를 넣어 찌를 바꾸면 옛 색이 남지 않게 한다. */
export function paintBobber(c: CanvasRenderingContext2D, skin: string, x: number, y: number, s: number, grad: (key: string, make: () => CanvasGradient) => CanvasGradient) {
  const id = BOBBER_PAL[skin] ? skin : "bob_red";
  const p = BOBBER_PAL[id];
  // 막대 끝(찌톱) — 입질 때 이 끝이 까딱이는 게 신호라 모든 찌에 남긴다
  c.fillStyle = "#3b2a1a";
  c.fillRect(x - 0.9 * s, y - 15 * s, 1.8 * s, 6 * s);
  c.fillStyle = id === "bob_moon" ? "#fde68a" : "#fff36b";
  c.fillRect(x - 1.5 * s, y - 18 * s, 3 * s, 3.4 * s);
  const body = () => {
    c.beginPath();
    if (id === "bob_heart") {
      // 하트 — 아래 끝이 물에 잠기는 쪽(y+5), 위 두 봉우리는 −10 안쪽
      c.moveTo(0, 5);
      c.bezierCurveTo(-9, -1, -7.5, -10, -3.6, -10);
      c.bezierCurveTo(-1.6, -10, -0.4, -8.6, 0, -7);
      c.bezierCurveTo(0.4, -8.6, 1.6, -10, 3.6, -10);
      c.bezierCurveTo(7.5, -10, 9, -1, 0, 5);
      c.closePath();
    } else {
      c.ellipse(0, -3, 7, 8, 0, 0, 6.29);
    }
  };
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = grad(`float:${id}`, () => {
    const g = c.createLinearGradient(-7, 0, 7, 0);
    g.addColorStop(0, p.hi);
    g.addColorStop(0.55, p.mid);
    g.addColorStop(1, p.lo);
    return g;
  });
  body();
  c.fill();
  if (p.band) {
    // 가운데 띠(기본 찌의 흰 띠) — 몸 안으로만
    c.save();
    body();
    c.clip();
    c.fillStyle = p.band;
    c.fillRect(-8, -2.8, 16, 5);
    c.fillStyle = "rgba(30,30,60,.2)";
    c.fillRect(2.4, -2.8, 6, 5);
    c.restore();
  }
  // 무늬
  if (id === "bob_star") {
    starPath(c, 0, -7, 3.4);
    c.fillStyle = "#f97316";
    c.fill();
  } else if (id === "bob_duck") {
    // 오리 머리 · 부리 · 눈 — 몸 위쪽에 앉힌다(찌톱은 머리 뒤로 솟는다)
    c.fillStyle = "#fde047";
    c.beginPath();
    c.arc(1.6, -10.6, 3.6, 0, 6.29);
    c.fill();
    c.fillStyle = "#f97316";
    c.beginPath();
    c.moveTo(4.6, -11.4);
    c.lineTo(7.6, -10.4);
    c.lineTo(4.6, -9.2);
    c.closePath();
    c.fill();
    c.fillStyle = "#1f2937";
    c.beginPath();
    c.arc(2.6, -11.4, 0.75, 0, 6.29);
    c.fill();
    // 날개 한 줄
    c.strokeStyle = "rgba(161,98,7,.7)";
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(-4.6, -3.4);
    c.quadraticCurveTo(-1, -1.2, 2.6, -3.6);
    c.stroke();
  } else if (id === "bob_moon") {
    // 초승달 — 밝은 원 위에 몸 색 원을 비켜 겹친다
    c.fillStyle = "#fde68a";
    c.beginPath();
    c.arc(-0.8, -5, 3.8, 0, 6.29);
    c.fill();
    c.fillStyle = p.mid;
    c.beginPath();
    c.arc(0.9, -6.1, 3.3, 0, 6.29);
    c.fill();
    c.fillStyle = "#e0e7ff";
    c.fillRect(3.2, -1.2, 1, 1);
    c.fillRect(-4.6, 0.8, 0.9, 0.9);
  } else if (id === "bob_gold") {
    c.fillStyle = "#ffffff";
    starPath(c, 3.2, -7.6, 2.2, 0.3);
    c.fill();
  }
  // 하이라이트 · 테두리
  c.fillStyle = "rgba(255,255,255,.75)";
  c.beginPath();
  c.ellipse(-2.5, -7, 1.6, 2.4, 0, 0, 6.29);
  c.fill();
  c.strokeStyle = p.edge;
  c.lineWidth = 0.8;
  body();
  c.stroke();
  c.restore();
}

/** 구운 낚싯대에 색을 입힌 사본 — 꾸미기 '낚싯대 색'. 한 번만 굽는다(⚠ 그릴 때 ctx.filter 금지 — 사파리에 없다).
 *  'color' 섞기(그림의 밝기는 두고 색만 바꾼다)를 먼저 해 보고, 그 섞기를 모르는 브라우저면 source-atop 으로 옅게 덮는다.
 *  마지막 destination-in 이 원래 그림의 투명한 곳을 되살린다(색 섞기는 빈 곳에도 칠한다). */
function tintRod(sp: RodSprite, color: string): RodSprite | null {
  if (typeof document === "undefined" || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  try {
    const el = document.createElement("canvas");
    el.width = sp.w;
    el.height = sp.h;
    const c = el.getContext("2d");
    if (!c) return null;
    c.drawImage(sp.src, 0, 0);
    c.globalCompositeOperation = "color";
    const blend = c.globalCompositeOperation === "color";
    if (!blend) c.globalCompositeOperation = "source-atop";
    c.globalAlpha = blend ? 0.8 : 0.45;
    c.fillStyle = color;
    c.fillRect(0, 0, sp.w, sp.h);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "destination-in";
    c.drawImage(sp.src, 0, 0);
    return { ...sp, src: el };
  } catch {
    return null;
  }
}

/** 등급(0~7)별 빛 — 물고기를 끌어올릴 때의 빛줄기 · 귀한 놈의 그림자 기운 · 축포 */
export const FX_GRADE_LIGHT: readonly string[] = ["#bfe6ff", "#a7f3d0", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fcd34d", "#fb923c", "#f0abfc"];

/** 찌가 떨어지는 자리(화면 비율) — 멀리 던질수록 수평선 쪽으로 간다 */
export function landingPoint(bonus: number, r: number): { x: number; y: number } {
  // 낚싯대 끝(화면 높이 약 0.38)보다 멀리 — 예전엔 0.43~0.72 라 13m 를 던져도 찌가 낚싯대 끝 바로 아래에 떨어졌다(2026-11-10)
  return { x: 0.22 + r * 0.2, y: 0.56 - Math.max(0, Math.min(1, bonus)) * 0.18 };
}

type Drop = { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; r: number; floor: number; color: string; kind: "drop" | "spark" | "paper"; spin: number };
type Ring = { x: number; y: number; r: number; vr: number; life: number; max: number; delay: number; lw: number; color: string };
type Foam = { x: number; y: number; r: number; life: number; max: number };
type Leap = { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; h: number };

/** NaN 은 아래끝으로 — 그대로 흘리면 위치가 영영 NaN 이 되고 캔버스는 조용히 안 그린다 */
const clamp = (v: number, a: number, b: number) => (v !== v ? a : v < a ? a : v > b ? b : v);
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
  /** 꾸미기 — 고른 찌 · 줄 색 · 낚싯대 색(setLook). 색을 입힌 낚싯대는 지금 낚싯대 + 색 한 벌만 둔다(바꾸면 옛 사본을 비운다) */
  private skin: FxLook = { ...FX_LOOK_DEFAULT };
  private rodTinted: { key: string; sp: RodSprite | null } | null = null;
  private netArt: { key: string; img: CanvasImageSource } | null = null;
  private netKey = "";
  private shoal: FxShoalFish[] = [];
  private net: { t0: number; dur: number; x: number; y: number; r: number; hit: boolean | null } | null = null;
  /** 뜰채 2막 — 건진 그물을 들어 올리는 중. h 0~1 · tilt -1~1 · kick 몸부림 중 */
  private lift: { x: number; y: number; r: number; h: number; tilt: number; kick: boolean; grade: number; end: { t0: number; ok: boolean } | null } | null = null;
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
  /** 결과 카드(끌어올린 뒤 · 담기 · 결과) 동안 낚싯대를 걷는다 — 카드의 물고기 그림 위로 낚싯대가 겹쳤다(2026-11-11) */
  private rodShow = 1;
  private rodShowAt = 0;
  private bend = 0;
  private reelAng = 0;
  private hang = { x: 0, y: 0, vx: 0, vy: 0, init: false };

  private bob = { on: false, x: 0, y: 0, sink: 0.25, sinkTo: 0.25, dip: 0, home: { x: 0, y: 0 } };
  /** 나는 찌 — curve(-1~1) 는 휘는 힘, kick(0~1) 은 바나나킥 세기(|curve| × 던진 힘 — 꼬리 · 불똥 · 물보라가 따른다), spark 는 불똥 쌓임 */
  private fly: { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; size: number; arc: number; side: number; nx: number; ny: number; curve: number; kick: number; spark: number } | null = null;
  private fish = { on: false, x: 0, y: 0, vx: 0, vy: 0, h: 0, wag: 0, fade: 1, mode: "none" as "none" | "circle" | "bite" | "fight" | "flee", ang: 0, t0: 0, waitS: 3, size: 0.4, grade: 0, darts: 0 };
  private leap: Leap | null = null;
  private surgeOn = 0;
  private surgeCount = 0;
  private surgeDir = 1;
  private nextThrash = 0;
  private nextBiteRipple = 0;
  private biteClock: { t0: number; dur: number } | null = null;

  private shake = 0;
  /** 주인과의 판 — 그림자 둘레에 붉은 기운 · 화날수록 짙게 */
  private bossOn = false;
  private bossRage = 0;
  private rageAt = -9;
  private stopT = 0;
  private flash = { a: 0, color: "#ffffff" };
  private rays = { a: 0, to: 0, color: "#bfe6ff" };
  private snap: { t0: number; x0: number; y0: number; x1: number; y1: number } | null = null;
  private raf = 0;
  private paused = false;
  /** stop() 뒤 — 다시 그리지 않는다. 멈춘 채 화면이 통째로 내려가면 stop 다음에 resume 이 불려 rAF 가 되살아났다 */
  private dead = false;
  private dppx: { mq: MediaQueryList; on: () => void } | null = null;
  /** 단위 공간(원점 · 반지름 1)에 한 번 만든 그라디언트 — 그릴 때 translate · scale 로 옮긴다. 매 프레임 새로 만들면 폰에서 GC 끊김이 생긴다 */
  private grads = new Map<string, CanvasGradient>();
  private grad(c: CanvasRenderingContext2D, key: string, make: () => CanvasGradient): CanvasGradient {
    let g = this.grads.get(key);
    if (!g) {
      if (this.grads.size > 200) this.grads.clear(); // 키는 몇십 개뿐이다 — 혹시 모를 누수의 바닥
      g = make();
      this.grads.set(key, g);
    }
    return g;
  }
  /** 가운데가 col, 바깥이 투명한 단위 빛 — 세기는 globalAlpha 로 준다 */
  private glow(c: CanvasRenderingContext2D, col: string) {
    return this.grad(c, `glow:${col}`, () => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, alpha(col, 1));
      g.addColorStop(1, alpha(col, 0));
      return g;
    });
  }
  private dim = 0;
  private trail: { x: number; y: number }[] = [];
  private last = 0;
  /** 그리기 박자(advframe) — 120Hz 폰에서도 초당 60장까지만. prev 는 지난 rAF, drawAcc 는 지난 그림 뒤 쌓인 시간 */
  private prev = 0;
  private drawAcc = DRAW_MS;
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
    const bw = Math.round(w * d), bh = Math.round(h * d);
    // 같은 크기면 아무것도 안 한다 — 백버퍼를 다시 잡으면 그림이 지워지고, 연달아 오는 관찰 알림마다 입자 · 찌가 튀었다
    if (w === this.W && h === this.H && bw === this.canvas.width && bh === this.canvas.height) return;
    const wide = w !== this.W;
    this.W = w;
    this.H = h;
    this.u = w / 360;
    this.canvas.width = bw;
    this.canvas.height = bh;
    this.ctx?.setTransform(d, 0, 0, d, 0, 0);
    if (wide) this.lookKey = ""; // 장식은 폭으로 뿌린다(seedLook 의 키) — 높이만 바뀌면 그대로 둔다
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
    this.watchDppx(measure);
    this.last = this.prev = performance.now();
    this.drawAcc = DRAW_MS;
    this.frame(16); // 첫 프레임은 동기로 — rAF 가 밀려도 빈 화면이 되지 않게
    this.raf = requestAnimationFrame(this.loop);
  }

  /** 화면 배율이 바뀌면(창을 다른 모니터로 · 확대) 크기는 같아도 백버퍼를 다시 잡는다 — ResizeObserver 는 이걸 알려 주지 않는다 */
  private watchDppx(measure: () => void) {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    this.dppx?.mq.removeEventListener?.("change", this.dppx.on);
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const on = () => {
      measure();
      if (!this.dead) this.watchDppx(measure);
    };
    mq.addEventListener?.("change", on);
    this.dppx = { mq, on };
  }

  private loop = (now: number) => {
    if (this.dead) return;
    // 거른 박자엔 그리지 않는다 — frame 에는 마지막으로 그린 뒤의 시간을 넘겨 움직임 속도는 그대로다(battlefx 와 같은 틀)
    const gate = frameGate(this.drawAcc, now - this.prev);
    this.prev = now;
    this.drawAcc = gate.acc;
    if (gate.draw) {
      this.frame(now - this.last);
      this.last = now;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** 낚시터가 가려진 동안 멈춘다 — 3D 수조가 위에 열리면 폰이 전체 화면 렌더를 둘 돌리게 된다 */
  pause() {
    cancelAnimationFrame(this.raf);
    this.paused = true;
    if (this.host) this.host.style.translate = ""; // 흔들리던 중이면 밀린 채로 멈춘다
  }

  resume() {
    if (!this.paused || this.dead) return;
    this.paused = false;
    this.last = this.prev = performance.now(); // 멈춰 있던 시간을 한 프레임으로 몰지 않게
    this.drawAcc = DRAW_MS;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.dead = true;
    this.paused = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    this.dppx?.mq.removeEventListener?.("change", this.dppx.on);
    this.dppx = null;
    if (this.host) this.host.style.translate = "";
    // 캔버스 메모리를 바로 돌려준다 — iOS 는 페이지의 캔버스 총량에 한도가 있어 탭을 오갈 때마다 옛 백버퍼가 쌓이면 닿는다
    this.canvas.width = 0;
    this.canvas.height = 0;
    for (const sp of Object.values(this.rodArt)) if (typeof sp === "object") releaseRod(sp);
    this.rodArt = {};
    this.dropTinted();
    this.baitArt = null;
    this.netArt = null;
    this.grads.clear();
  }

  set(v: Partial<FxView>) {
    this.view = { ...this.view, ...v };
    if (v.phase === "fight" && this.fish.mode !== "fight" && this.fish.on) this.fish.mode = "fight";
    if (v.rod) this.loadRod(v.rod);
    if (v.bait) this.loadBait(v.bait);
  }

  /** 장비 꾸미기 — 찌 모양 · 줄 색 · 낚싯대 색. 모르는 찌 · 잘못된 색은 기본으로(그리다 NaN · 빈 색이 나오지 않게) */
  setLook(v: Partial<FxLook>) {
    const hex = (x: string | undefined, d: string) => (x !== undefined && /^#[0-9a-f]{6}$/i.test(x) ? x : d);
    const next: FxLook = {
      bobber: v.bobber !== undefined ? ((FX_BOBBERS as readonly string[]).includes(v.bobber) ? v.bobber : FX_LOOK_DEFAULT.bobber) : this.skin.bobber,
      line: v.line !== undefined ? hex(v.line, FX_LOOK_DEFAULT.line) : this.skin.line,
      rodTint: v.rodTint !== undefined ? hex(v.rodTint, "") : this.skin.rodTint,
    };
    if (next.rodTint !== this.skin.rodTint) this.dropTinted();
    this.skin = next;
  }
  /** 지금 모습(테스트 · 디버그용) */
  lookNow(): FxLook {
    return { ...this.skin };
  }
  private dropTinted() {
    if (this.rodTinted?.sp) releaseRod(this.rodTinted.sp);
    this.rodTinted = null;
  }
  /** 그릴 낚싯대 그림 — 색을 골랐으면 한 번 구운 사본(못 구우면 원래 그림) */
  private rodSprite(sp: RodSprite): RodSprite {
    const tint = this.skin.rodTint;
    if (!tint) return sp;
    const key = `${this.view.rod}|${tint}`;
    if (this.rodTinted?.key !== key) {
      this.dropTinted();
      this.rodTinted = { key, sp: tintRod(sp, tint) };
    }
    return this.rodTinted.sp ?? sp;
  }

  /** 미끼 그림 — 찌 밑에 실제로 달려 있는 모습 */
  private baitArt: { key: string; img: HTMLImageElement } | null = null;
  /** 물 밑 그림자의 실루엣(2026-11-11) — 물렸을 물고기 그림의 윤곽을 어둡게 칠한 것. 꽝도 진짜 물고기의 모습(...real)이라 공개 전까지 모른다.
   *  그림이 오기 전 · 없으면 직접 그린 물고기 모양(fishPath). 그림은 머리가 오른쪽. */
  private shapeArt: { key: string; dark: HTMLCanvasElement; rim: HTMLCanvasElement } | null = null;
  private shapeWant = "";
  /** 이번 물고기의 실루엣을 받는다 — 같은 열쇠면 다시 받지 않는다 */
  shape(key: string | null, url: string | null) {
    if (!key || !url) { this.shapeWant = ""; this.shapeArt = null; return; }
    if (this.shapeWant === key) return;
    this.shapeWant = key;
    if (this.shapeArt?.key !== key) this.shapeArt = null;
    if (typeof Image === "undefined" || typeof document === "undefined") return;
    const img = new Image();
    img.onload = () => {
      if (this.dead || this.shapeWant !== key) return;
      const tint = (color: string) => {
        const el = document.createElement("canvas");
        el.width = img.naturalWidth || 192;
        el.height = img.naturalHeight || 192;
        const c = el.getContext("2d");
        if (!c) return null;
        c.drawImage(img, 0, 0, el.width, el.height);
        c.globalCompositeOperation = "source-in";
        c.fillStyle = color;
        c.fillRect(0, 0, el.width, el.height);
        return el;
      };
      const dark = tint("#001226"), rim = tint("#ffffff");
      if (dark && rim) this.shapeArt = { key, dark, rim };
    };
    img.src = url;
  }
  /** 받는 중 · 못 받은 미끼 — 저장할 때마다 art() 가 다시 불려도 같은 그림을 또 요청하지 않는다(오프라인이면 끝없이 요청했다) */
  private baitTried = new Set<string>();
  private loadBait(key: string) {
    if (this.baitArt?.key === key || this.baitTried.has(key) || !this.artUrl || typeof Image === "undefined") return;
    const src = this.artUrl(key);
    if (!src) return;
    this.baitTried.add(key);
    const img = new Image();
    img.onload = () => {
      this.baitTried.delete(key);
      if (!this.dead && this.view.bait === key) this.baitArt = { key, img };
    };
    img.onerror = () => {
      img.onload = null; // 한 번 실패한 그림은 이번 화면에선 다시 안 받는다 — 벡터 대신 그림 없이 그린다
    };
    img.src = src;
  }
  private drawBait(c: CanvasRenderingContext2D, x: number, y: number) {
    const a = this.baitArt, s = 24 * this.u;
    if (!a || a.key !== this.view.bait || !(s > 0)) return;
    // 찌에서 미끼까지 낚싯줄 — 없으면 미끼가 허공에 떠 보인다(고른 줄 색)
    c.strokeStyle = alpha(this.skin.line, 0.8);
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
      this.netArt = null; // 새 뜰채 그림이 오기 전엔 옛 뜰채를 그리지 않는다
      const src = url(netKey);
      if (src) {
        const img = new Image();
        img.onload = () => {
          if (!this.dead && this.netKey === netKey) this.netArt = { key: netKey, img }; // 늦게 온 옛 그림이 새 뜰채를 덮지 않게
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
      if (this.dead) return;
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
    if (this.rodTinted?.key.startsWith(`${key}|`)) this.dropTinted(); // 바탕 그림이 바뀌면 색 사본도 다시 굽는다
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
    this.lift = null;
    this.lureHop = 0;
  }

  /** 던진다 — power(0~1)만큼 멀리 · 높이 · 오래 날고, curve(-1~1)만큼 돌린 쪽으로 휘어 들어간다(바나나킥).
   *  나는 시간(ms)을 돌려준다 — 입질 · 간 보기는 찌가 내려앉은 뒤부터 센다(날아가는 찌가 입질하지 않게) */
  cast(land: { x: number; y: number }, waitMs: number, size: number, grade: number, power: number, curve = 0) {
    const swing = this.trail;
    this.reset();
    this.trail = swing;
    this.rodKick = 0.3 + power * 0.3; // 앞으로 휘두른다
    this.rodVel -= 1 + power * 1.6;
    const x1 = land.x * this.W, y1 = land.y * this.H;
    const bend = clamp(curve, -1, 1), kick = Math.abs(bend) * clamp(power, 0, 1);
    // 휘는 쪽은 늘 트인 물 쪽이다 — 낚싯대가 오른쪽 아래에 있어 오른쪽으로 밀면 화면 밖으로 잘려 곧게 날거나 낚싯대를 가로질렀다.
    // 돌린 방향이 모양을 고른다: 한쪽은 던지는 선에 수직인 하늘 쪽 높은 호, 다른 쪽은 왼쪽 물 위로 넓게 돌아 들어오는 호.
    // 가장 크게 휜 자리(시간 2/3 · 앞으로 약 85%, 포물선 높이 포함)가 화면 안에 남게 줄인다
    const dx = x1 - this.hang.x, dy = y1 - this.hang.y, len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (ny > 0) { nx = -nx; ny = -ny; } // 하늘 쪽 수직
    if (bend < 0) { nx = -0.99; ny = 0.14; } // 왼쪽 물 위로
    const arc = 0.08 + power * 0.16;
    let side = Math.abs(bend) * (0.12 + power * 0.28) * this.W;
    const bx = lerp(this.hang.x, x1, 0.845), by = lerp(this.hang.y, y1, 0.845) - 0.69 * arc * this.H;
    for (let i = 0; i < 10 && side > 1; i++) {
      const px = bx + nx * side, py = by + ny * side;
      if (px >= this.W * 0.06 && px <= this.W * 0.94 && py >= this.H * 0.05 && py <= this.H * 0.94) break;
      side *= 0.85;
    }
    // 크게 휘는 공은 조금 더 오래 난다 — 휘어 들어가는 끝을 눈이 따라갈 시간
    const dur = 0.5 + power * 0.3 + kick * 0.14;
    this.fly = { t0: this.t, dur, x0: this.hang.x, y0: this.hang.y, x1, y1, size: 0.45 + power * 0.25, arc, side, nx, ny, curve: bend, kick, spark: 0 };
    Object.assign(this.bob, { on: true, x: this.hang.x, y: this.hang.y, sink: 0, sinkTo: 0.25, dip: 0, home: { x: x1, y: y1 } });
    Object.assign(this.fish, { on: true, mode: "circle", size, grade, t0: this.t, waitS: Math.max(0.6, (Number.isFinite(waitMs) ? waitMs : 3000) / 1000) + dur, ang: this.rnd() * 6.28, fade: 0, x: x1 + this.W * 0.3, y: y1 + this.H * 0.06, vx: 0, vy: 0, darts: 0 });
    if (power >= 0.6) this.sparkBurst(this.hang.x, this.hang.y, Math.round(power * 16), "#fde68a", 120 + power * 120);
    if (kick >= 0.6) this.ring(this.hang.x, this.hang.y, 4, 150, 0.4, 2.2, "#fde68a"); // 휙 — 감아 찬 순간
    return Math.round(dur * 1000);
  }

  /** 바나나킥 길 — 앞으로는 공기에 걸려 점점 느려지고(q), 옆으로는 날수록 크게 휜다(p²(1-p), 시간 2/3 에서 가장 크다).
   *  그래서 처음엔 곧게 뻗다가 끝에서 옆으로 확 꺾여 들어간다. 높이는 둘의 가운데로 — 꼭대기가 너무 늦지 않게 */
  private flyAt(p: number): { x: number; y: number; q: number } {
    const f = this.fly!;
    const q = 1 - Math.pow(1 - p, 1.7), g = 6.75 * p * p * (1 - p) * f.side;
    return { x: lerp(f.x0, f.x1, q) + g * f.nx, y: lerp(f.y0, f.y1, q) + g * f.ny - Math.sin(((p + q) / 2) * Math.PI) * this.H * f.arc, q };
  }

  /** 나는 찌의 기울기(라디안) — 휘는 쪽으로 몸을 눕히고, 세게 감아 찰수록 빠르게 떤다 */
  private flyTilt(p: number): number {
    const f = this.fly!;
    const wob = this.reduced ? 0 : Math.sin(this.t * 31) * 0.2 * f.kick;
    // 옆으로 움직이는 빠르기(p²(1-p) 의 기울기)만큼 눕는다 — 휘어 나갈 땐 바깥으로, 꺾여 들어올 땐 안쪽으로
    return clamp(Math.sign(f.side * f.nx) * Math.min(1, Math.abs(f.side * f.nx) / (this.W * 0.12)) * p * (2 - 3 * p) * 1.1 + wob, -0.75, 0.75);
  }

  /** 주인 판인지(던질 때) · 지금 기세(0~2) */
  boss(on: boolean, phase = 0) {
    this.bossOn = on;
    this.bossRage = phase;
  }
  /** 주인이 화났다 — 물이 크게 뒤집히고 화면이 흔들린다 */
  rage(phase: number) {
    this.bossRage = phase;
    this.rageAt = this.t;
    const f = this.fish;
    if (!this.reduced) this.shake = Math.max(this.shake, 9 + phase * 3);
    this.ring(f.x, f.y, 10, 260, 0.8, 6, "#ff4d4d");
    this.ring(f.x, f.y, 10, 180, 0.9, 3, "#ffd27a", 0.12);
    this.splash(f.x, f.y, 40, 1.4);
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

  /** 건진 그물을 그 자리에서 들어 올리기 시작한다 — 내리친 그물(net)의 자리를 이어받는다 */
  liftStart(grade: number) {
    const n = this.net;
    const x = n?.x ?? this.W * 0.5, y = n?.y ?? this.H * 0.66, r = n?.r ?? this.W * 0.08;
    this.net = null;
    this.lift = { x, y, r, h: 0, tilt: 0, kick: false, grade, end: null };
  }
  liftSet(h: number, tilt: number, kick: boolean) {
    const l = this.lift;
    if (!l || l.end) return;
    // 몸부림이 시작되는 순간 물이 튄다
    if (kick && !l.kick) this.splash(l.x + tilt * l.r, l.y - h * this.H * 0.22, 10, 0.7);
    l.h = h;
    l.tilt = tilt;
    l.kick = kick;
  }
  /** 다 올렸다(ok) · 그물에서 튀어 나갔다 */
  liftEnd(ok: boolean) {
    const l = this.lift;
    if (!l) return;
    l.end = { t0: this.t, ok };
    const y = l.y - l.h * this.H * 0.22;
    if (ok) this.ring(l.x, y, l.r / this.u, 120, 0.6, 4, FX_GRADE_LIGHT[clamp(l.grade, 0, 7)]);
    else {
      this.splash(l.x + Math.sign(l.tilt || 1) * l.r * 1.2, y + l.r * 0.4, 30, 1.2);
      this.shake = Math.max(this.shake, 8);
    }
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

  /** 휘어 들어간 찌의 물보라 — 마지막에 옆으로 꺾여 들어갔으니 물도 그쪽으로 튀고, 물수제비처럼 작은 고리가 이어진다 */
  private hookSplash(f: { x1: number; y1: number; side: number; nx: number; kick: number; size: number }) {
    const u = this.u * this.persp(f.y1), dir = f.side * f.nx > 0 ? -1 : 1; // 끝에선 휜 쪽의 반대(원래 줄 쪽)로 움직인다
    const n = Math.round(10 + 16 * f.kick);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + dir * (0.5 + this.rnd() * 0.8);
      const sp = (90 + this.rnd() * 200) * (0.6 + f.kick * 0.5) * u;
      const life = 0.35 + this.rnd() * 0.45;
      this.pushDrop({ x: f.x1, y: f.y1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 620 * u, life, max: life, r: (0.8 + this.rnd() * this.rnd() * 3) * u, floor: f.y1 + (this.rnd() - 0.5) * 10 * u, color: this.rnd() < 0.3 ? "#d7f1ff" : "#ffffff", kind: "drop", spin: 0 });
    }
    const skips = f.kick >= 0.7 ? 3 : 2;
    for (let i = 1; i <= skips; i++) this.ring(f.x1 + dir * i * 16 * u, f.y1 + i * 2 * u, 3, 54 - i * 8, 0.6, 1.6, "#ffffff", i * 0.09);
    if (f.kick >= 0.7) {
      this.ring(f.x1, f.y1, 8, 170, 0.75, 2.6, "#fde68a", 0.05);
      // 작은 불똥이 넓게 — sparkBurst 의 큰 별은 물보라를 덮는 금빛 덩어리로 보였다
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + this.rnd() * 0.4, sp = (150 + this.rnd() * 140) * u, life = 0.4 + this.rnd() * 0.35;
        this.pushDrop({ x: f.x1, y: f.y1 - 6 * u, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, g: 90 * u, life, max: life, r: (1 + this.rnd() * 1.8) * u, floor: Infinity, color: i % 3 === 0 ? "#fb923c" : "#fde68a", kind: "spark", spin: 0 });
      }
    }
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

  /** 앞쪽은 적게, 먼 쪽은 많이 — 코앞 입자가 많으면 화면이 줄무늬로 덮인다. into 가 있으면 그 입자를 다시 쓴다(초당 수백 개를 새로 만들지 않게) */
  private newFall(y: number, into?: { x: number; y: number; z: number; end: number; p: number }) {
    const z = this.rnd() ** 1.45;
    const hz = this.look().horizon * this.H;
    const f = into ?? { x: 0, y: 0, z: 0, end: 0, p: 0 };
    f.x = this.rnd() * this.W * 1.3 - this.W * 0.15;
    f.y = y;
    f.z = z;
    f.end = hz + (this.H - hz) * Math.min(1, z * 1.1 + this.rnd() * 0.08);
    f.p = this.rnd() * 6.28;
    return f;
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
          this.newFall(-this.rnd() * this.H * 0.25, f);
        }
      } else {
        const vy = (20 + 58 * f.z) * this.u;
        f.y += vy * real;
        f.x += (Math.sin(this.t * (0.5 + f.z * 0.5) + f.p) * (7 + 20 * f.z) + gust * (8 + 16 * f.z)) * this.u * real;
        if (f.y >= f.end) this.newFall(-this.rnd() * this.H * 0.12, f);
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].life -= real * 2.4;
      if (this.ripples[i].life <= 0) this.ripples.splice(i, 1);
    }
  }

  /** 낚시찌 · 낚싯대 뒤의 먼 입자와 수면 파문 */
  private drawWeatherBack(c: CanvasRenderingContext2D) {
    if (!this.wx || this.reduced) return; // 움직임 줄이기면 입자는 멈춘 채 긁힌 자국으로 남는다 — 하늘 막(.fish-sky)만 남긴다
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
    if (!this.wx || this.reduced) return;
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

  /** 돌리기 · 던지기 궤적 — 최근 26점만 */
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
    const kick = this.fly?.kick ?? 0;
    // 가늘고 끝만 밝게(2026-11-10) — 예전엔 굵은 선이 겹쳐 빠르게 던지면 노란 쐐기처럼 번졌다.
    // 바나나킥은 혜성 꼬리 — 길고, 아래에 넓고 옅은 빛 띠 한 겹, 꼬리는 주황 · 머리는 흰 금빛(shadowBlur 없이)
    const from = Math.max(1, n - (this.fly ? 14 + Math.round(kick * 10) : 22));
    for (let pass = kick >= 0.35 ? 0 : 1; pass < 2; pass++) {
      for (let i = from; i < n; i++) {
        const k = (i - from + 1) / (n - from);
        if (pass === 0) {
          c.globalAlpha = k * 0.22 * kick;
          c.strokeStyle = "#fb923c";
          c.lineWidth = (2 + k * 9 * kick) * this.u;
        } else {
          c.globalAlpha = k * k * (0.75 + 0.2 * kick);
          if (kick >= 0.35) c.strokeStyle = mix("#fb923c", "#fff7d6", k);
          c.lineWidth = (0.6 + k * (1.6 + 2.4 * kick)) * this.u;
        }
        c.beginPath();
        c.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        c.lineTo(this.trail[i].x, this.trail[i].y);
        c.stroke();
      }
    }
    c.restore();
  }

  private stepBubbles(dt: number) {
    const v = this.view;
    if (v.method !== "deep" || v.phase !== "fight" || this.reduced) {
      if (this.bubbles.length) this.bubbles = [];
      return;
    }
    // 심해일 때만 — 어두운 물속에서 올라오는 공기 방울
    if (this.bubbles.length < 26 && this.rnd() < dt * 16) {
      this.bubbles.push({ x: this.rnd() * this.W, y: this.H + 6, r: (1.5 + this.rnd() * 4) * this.u, v: (50 + this.rnd() * 90) * this.u, p: this.rnd() * 6.28 });
    }
    const top = this.look().horizon * this.H;
    // 제자리에서 정리한다 — 프레임마다 새 배열을 만들지 않게
    let k = 0;
    for (const b of this.bubbles) {
      b.y -= b.v * dt;
      if (b.y > top) this.bubbles[k++] = b;
    }
    this.bubbles.length = k;
  }

  private stepBob(dt: number) {
    const b = this.bob;
    if (this.fly) {
      const f = this.fly, p = clamp((this.t - f.t0) / f.dur, 0, 1);
      const at = this.flyAt(p);
      b.x = at.x;
      b.y = at.y;
      this.pushTrail(b.x, b.y);
      // 세게 감아 찬 공은 불똥을 흘린다 — 휘는 힘만큼, 움직임 줄이기면 없다
      if (!this.reduced && f.kick >= 0.45 && p < 1) {
        f.spark += dt * 70 * f.kick;
        const u = this.u;
        while (f.spark >= 1) {
          f.spark -= 1;
          const life = 0.3 + this.rnd() * 0.35;
          const hot = this.rnd();
          this.pushDrop({ x: b.x + (this.rnd() - 0.5) * 6 * u, y: b.y + (this.rnd() - 0.5) * 6 * u, vx: (this.rnd() - 0.5) * 50 * u, vy: (this.rnd() - 0.2) * 40 * u, g: 70 * u, life, max: life, r: (1 + this.rnd() * 2.2) * u, floor: Infinity, color: hot < 0.45 ? "#fde68a" : hot < 0.8 ? "#fb923c" : "#fda4af", kind: "spark", spin: 0 });
        }
      }
      if (p >= 1) {
        this.fly = null;
        b.sink = 0.8; // 툭 잠겼다가 떠오른다
        this.splash(f.x1, f.y1, Math.round(26 * f.size), 0.9 * f.size + 0.2);
        this.ring(f.x1, f.y1, 6, 120, 0.7, 3, "#ffffff");
        this.ring(f.x1, f.y1, 6, 74, 0.95, 2, "#ffffff", 0.18);
        if (f.kick >= 0.35) this.hookSplash(f);
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
    this.drawStrain(c);
    this.drawOverlay(c);
  }

  /** 줄이 끊어지기 직전 — 화면 가장자리가 붉게 맥동하고 낚싯대 끝이 떨린다(2026-11-10). 장력 0.8 부터 짙어진다 */
  private drawStrain(c: CanvasRenderingContext2D) {
    const v = this.view;
    if (v.phase !== "fight") return;
    const k = clamp((v.tension - 0.8) / 0.2, 0, 1);
    if (k <= 0) return;
    const pulse = this.reduced ? 0.7 : 0.55 + 0.45 * Math.sin(this.t * (10 + k * 14));
    const g = c.createRadialGradient(this.W / 2, this.H * 0.5, Math.min(this.W, this.H) * 0.38, this.W / 2, this.H * 0.5, Math.max(this.W, this.H) * 0.75);
    g.addColorStop(0, "rgba(255,40,40,0)");
    g.addColorStop(1, alpha("#ff2a3a", 0.5 * k * pulse));
    c.save();
    c.fillStyle = g;
    c.fillRect(0, 0, this.W, this.H);
    c.restore();
    if (!this.reduced && k > 0.5) this.shake = Math.max(this.shake, (k - 0.5) * 5);
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
      const g = this.grad(c, "lantern", () => {
        const l = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        l.addColorStop(0, "rgba(255,214,140,.95)");
        l.addColorStop(0.35, "rgba(255,160,90,.42)");
        l.addColorStop(1, "rgba(255,120,80,0)");
        return l;
      });
      c.fillStyle = g;
      for (const a of this.air) {
        const r = 7 * a.s * (1 + Math.sin(this.t * 2 + a.p) * 0.12);
        c.save();
        c.translate(a.x, a.y);
        c.scale(r, r);
        c.beginPath();
        c.arc(0, 0, 1, 0, 6.29);
        c.fill();
        c.restore();
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
    // 힘겨루기 땐 몸집을 키우고 밝은 테두리를 둘러 무엇과 싸우는지 보이게(2026-11-10 — 예전엔 작고 검은 얼룩이었다)
    const fighting = f.mode === "fight" || f.mode === "bite";
    const L = this.fishLen(f.y) * (fighting ? 1.35 : 1);
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
      c.scale(r, r * 0.5);
      c.globalAlpha *= clamp(0.5 * f.fade, 0, 1);
      c.fillStyle = this.glow(c, col);
      c.beginPath();
      c.arc(0, 0, 1, 0, 6.29);
      c.fill();
      c.restore();
    }
    // 주인 — 물 밑의 거대한 그림자 둘레로 검붉은 기운이 맴돈다(화날수록 짙고 빠르게)
    if (this.bossOn && f.mode !== "flee") {
      const k = 0.35 + this.bossRage * 0.25 + (this.t - this.rageAt < 1.2 ? (1 - (this.t - this.rageAt) / 1.2) * 0.6 : 0);
      const r = L * (1.25 + Math.sin(this.t * (2.4 + this.bossRage * 1.6)) * 0.12);
      c.save();
      c.translate(f.x, f.y);
      c.scale(r, r * 0.5);
      c.globalAlpha *= clamp(k * f.fade, 0, 1);
      const g = this.grad(c, "boss-aura", () => {
        const gg = c.createRadialGradient(0, 0, 0.35, 0, 0, 1);
        gg.addColorStop(0, "rgba(120,0,20,0.55)");
        gg.addColorStop(0.7, "rgba(255,60,60,0.22)");
        gg.addColorStop(1, "rgba(255,60,60,0)");
        return gg;
      });
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 1, 0, 6.29);
      c.fill();
      c.restore();
    }
    // 물결 자국 — 빠르게 헤엄칠수록 길고 짙다(수면에 뜬 흰 V)
    const sp = Math.hypot(f.vx, f.vy) / this.u;
    if (sp > 40 && f.mode !== "flee") {
      const k = clamp((sp - 40) / 220, 0, 1);
      const back = f.h + Math.PI;
      c.save();
      c.translate(f.x, f.y);
      c.scale(1, 0.56);
      c.strokeStyle = "#ffffff";
      c.lineCap = "round";
      for (const side of [-1, 1]) {
        c.globalAlpha = 0.32 * k * f.fade;
        c.lineWidth = (1.4 + k * 1.6) * this.u;
        const a1 = back + side * 0.42;
        const len = L * (1.4 + k * 1.6);
        c.beginPath();
        c.moveTo(Math.cos(f.h) * L * 0.45, Math.sin(f.h) * L * 0.45);
        c.quadraticCurveTo(Math.cos(back + side * 0.2) * len * 0.5, Math.sin(back + side * 0.2) * len * 0.5, Math.cos(a1) * len, Math.sin(a1) * len);
        c.stroke();
      }
      c.restore();
    }
    c.translate(f.x, f.y);
    c.scale(1, 0.56);
    c.rotate(f.h);
    const dark = f.mode === "bite" || f.mode === "fight" ? 0.62 : 0.46;
    const sh = this.shapeArt;
    if (sh) {
      // 그림은 둘레에 10% 여백 — 몸길이 L 이 그림 폭의 80%. 꼬리 흔들림은 살짝 눌렀다 폈다로
      const W = L * 1.25, wob = 1 + Math.sin(f.wag) * 0.04;
      // 머리가 왼쪽을 볼 땐 뒤집어 배가 아래로
      const flipY = Math.cos(f.h) < 0 ? -1 : 1;
      c.scale(wob, flipY);
      c.globalAlpha = dark * 0.34 * f.fade;
      c.drawImage(sh.dark, -W * 0.57, -W * 0.57, W * 1.14, W * 1.14);
      if (fighting) {
        c.globalAlpha = 0.28 * f.fade;
        c.drawImage(sh.rim, -W * 0.52, -W * 0.52, W * 1.04, W * 1.04);
      }
      c.globalAlpha = dark * f.fade;
      c.drawImage(sh.dark, -W / 2, -W / 2, W, W);
      c.restore();
      return;
    }
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
    if (fighting) {
      // 물속에서 비치는 몸 윤곽 — 등급 빛을 살짝
      c.globalAlpha = 0.5 * f.fade;
      c.strokeStyle = alpha(FX_GRADE_LIGHT[clamp(f.grade, 0, 7)], 0.9);
      c.lineWidth = 1.4 * this.u;
      this.fishPath(c, L, f.wag);
      c.stroke();
    }
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
    // 심해엔 찌가 없다 — 줄이 수면에 꽂혀 곧장 물속으로 내려간다
    if (this.view.method === "deep" && !this.fly) return { x: b.x, y: b.y, on: true };
    return { x: b.x, y: b.y - (10 - b.sink * 8) * s, on: true };
  }

  /** 심해 — 찌 대신 추(2026-11-11). 수면엔 줄이 꽂힌 자리의 물결, 물속으론 깊이 내려가며 옅어지는 줄과 미끼의 빛.
   *  입질(dip · sink)이 오면 줄이 떨고 꽂힌 자리가 번쩍인다 — 찌가 떠 있는 찌낚시와 다르게 보여야 한다 */
  private drawSinker(c: CanvasRenderingContext2D) {
    const v = this.view, b = this.bob, u = this.u;
    const weight = (x: number, y: number, s: number) => {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = "#5b6472";
      c.beginPath();
      c.moveTo(0, -6);
      c.quadraticCurveTo(5, 2, 0, 7);
      c.quadraticCurveTo(-5, 2, 0, -6);
      c.fill();
      c.fillStyle = "rgba(255,255,255,.55)";
      c.beginPath();
      c.ellipse(-1.4, 0, 1.1, 2.6, 0, 0, 6.29);
      c.fill();
      c.restore();
    };
    if (!b.on && !this.fly) {
      if (v.phase === "ready" || v.phase === "charge") {
        weight(this.hang.x, this.hang.y + 2 * u, 1.5 * u);
        this.drawBait(c, this.hang.x, this.hang.y + 14 * u);
      }
      return;
    }
    if (this.fly) {
      const k = clamp((this.t - this.fly.t0) / this.fly.dur, 0, 1);
      weight(b.x, b.y, lerp(1.1, this.persp(this.fly.y1), k) * u);
      return;
    }
    const s = this.persp(b.y) * u;
    const pull = clamp(b.dip + b.sink * 0.6, 0, 1.4);
    // 물속으로 내려가는 줄 — 아래로 갈수록 옅고, 입질이면 떤다
    const depth = (95 + pull * 35) * s;
    const shake = this.reduced ? 0 : Math.sin(this.t * 48) * pull * 3 * s;
    c.save();
    c.lineCap = "round";
    const g = c.createLinearGradient(b.x, b.y, b.x, b.y + depth);
    g.addColorStop(0, "rgba(255,255,255,.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.strokeStyle = g;
    c.lineWidth = Math.max(1, 1.6 * s);
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.quadraticCurveTo(b.x + shake + Math.sin(this.t * 0.8) * 4 * s, b.y + depth * 0.5, b.x + Math.sin(this.t * 0.6) * 6 * s, b.y + depth);
    c.stroke();
    // 저 아래 미끼의 빛 — 깊이 내려가 희미하게
    const gy = b.y + depth * 0.92, gl = (0.18 + pull * 0.35) * (0.8 + Math.sin(this.t * 3) * 0.2);
    c.globalCompositeOperation = "lighter";
    c.fillStyle = this.glow(c, "#9be7ff");
    c.globalAlpha = clamp(gl, 0, 1);
    c.translate(b.x + Math.sin(this.t * 0.6) * 6 * s, gy);
    c.scale(14 * s, 14 * s);
    c.beginPath();
    c.arc(0, 0, 1, 0, 6.29);
    c.fill();
    c.restore();
    // 꽂힌 자리의 물결 — 천천히 퍼지는 고리 둘, 입질이면 빠르고 밝게
    c.save();
    for (let i = 0; i < 2; i++) {
      const ph = ((this.t * (0.55 + pull * 1.4)) + i * 0.5) % 1;
      c.globalAlpha = (1 - ph) * (0.45 + pull * 0.4);
      c.strokeStyle = "#ffffff";
      c.lineWidth = Math.max(0.7, 1.1 * s);
      c.beginPath();
      c.ellipse(b.x, b.y, (4 + ph * 16) * s, (1.4 + ph * 5) * s, 0, 0, 6.29);
      c.stroke();
    }
    c.restore();
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
    const N = 28;
    // 팽팽할 때의 떨림은 줄에 수직으로, 매끈한 현의 떨림(기본 · 2배음) — 예전 짧은 물결(k*30)은 22점으로 그려져 지그재그로 보였다(2026-11-11)
    const ll = Math.hypot(end.x - tip.x, end.y - tip.y) || 1, nx = -(end.y - tip.y) / ll, ny = (end.x - tip.x) / ll;
    const vib1 = this.reduced ? 0 : Math.sin(this.t * 62), vib2 = this.reduced ? 0 : Math.sin(this.t * 97 + 1.3);
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const w = Math.sin(k * Math.PI);
      const off = amp * 0.55 * (w * vib1 + Math.sin(k * Math.PI * 2) * 0.45 * vib2);
      pts.push({
        x: lerp(tip.x, end.x, k) + nx * off,
        y: lerp(tip.y, end.y, k) + sag * w * (fight || v.phase === "bite" ? 1 : 0.9) + ny * off,
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
    // 고른 줄 색에서 빨강으로 — 팽팽하면 붉어지는 경고는 어떤 줄 색이든 같다(그래서 상점에 붉은 줄이 없다)
    c.strokeStyle = mix(this.skin.line, "#ff3b4e", hot * (0.55 + pulse * 0.45));
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
    if (!b.on || this.fly || this.view.method === "deep") return;
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

  /** 찌 — 모양은 paintBobber 한 곳(상점 미리보기와 같다). 고른 찌는 setLook 으로 받는다 */
  private bobberBody(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    paintBobber(c, this.skin.bobber, x, y, s, (key, make) => this.grad(c, key, make));
  }

  /** 루어 — 작은 물고기 모양 + 바늘. 튈 때마다 몸이 기운다 */
  private lureBody(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
    c.save();
    c.translate(x, y);
    c.rotate(-0.25 + this.lureHop * -0.55 + Math.sin(this.t * 7) * 0.08);
    c.fillStyle = this.grad(c, `lure:${s.toFixed(3)}`, () => {
      const g = c.createLinearGradient(0, -5 * s, 0, 5 * s);
      g.addColorStop(0, "#22d3ee");
      g.addColorStop(0.55, "#f8fafc");
      g.addColorStop(1, "#f59e0b");
      return g;
    });
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
    if (v.method === "deep") { this.drawSinker(c); return; }
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
      const f = this.fly, p = clamp((this.t - f.t0) / f.dur, 0, 1), s = lerp(0.95, this.persp(f.y1), p) * this.u;
      c.save();
      c.translate(b.x, b.y + 8 * this.u);
      c.rotate(this.flyTilt(p));
      this.bobberBody(c, 0, 0, s);
      c.restore();
      // 감아 찬 회전 — 찌 둘레를 도는 빛 두 줄기(찌는 줄에 매달려 있어 통째로 돌리지 않는다)
      if (f.kick >= 0.45 && p < 0.97) {
        const a0 = this.reduced ? 0 : this.t * 17 * (f.curve > 0 ? 1 : -1), r = 13 * s;
        c.save();
        c.lineCap = "round";
        c.strokeStyle = "#fde68a";
        c.lineWidth = 1.6 * s;
        c.globalAlpha = 0.35 + 0.45 * f.kick;
        for (const off of [0, Math.PI]) {
          c.beginPath();
          c.ellipse(b.x, b.y + 5 * this.u, r, r * 0.55, 0, a0 + off, a0 + off + 1.4);
          c.stroke();
        }
        c.restore();
      }
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
    const glowCol = FX_GRADE_LIGHT[clamp(this.fish.grade, 0, 7)];
    // 잔상 — 지나온 자리에 옅게 두 장
    if (!this.reduced) {
      for (let g = 2; g >= 1; g--) {
        const q = clamp(p - g * 0.045, 0, 1);
        const gx = lerp(l.x0, l.x1, q);
        const gy = lerp(l.y0, l.y1, q) - Math.sin(q * Math.PI) * l.h;
        const gang = Math.atan2(-Math.cos(q * Math.PI) * l.h * 3, (l.x1 - l.x0) || 1);
        c.save();
        c.translate(gx, gy);
        c.rotate(gang);
        if (dirX < 0) c.scale(1, -1);
        c.globalAlpha = 0.16 / g;
        c.fillStyle = glowCol;
        this.fishPath(c, L, this.t * 26 - g);
        c.fill();
        c.restore();
      }
    }
    // 물을 박차고 오를 때 몸이 늘어나고, 떨어질 때 움츠린다
    const stretch = 1 + Math.cos(p * Math.PI) * 0.08;
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    if (dirX < 0) c.scale(1, -1);
    c.scale(stretch, 1 / stretch);
    const body = c.createLinearGradient(0, -L * 0.3, 0, L * 0.3);
    body.addColorStop(0, "#0b2440");
    body.addColorStop(0.55, mix("#163a5e", glowCol, 0.35));
    body.addColorStop(1, mix("#d8ecff", glowCol, 0.4));
    c.fillStyle = body;
    this.fishPath(c, L, this.t * 26);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.75)";
    c.lineWidth = 1.2 * this.u;
    this.fishPath(c, L, this.t * 26);
    c.stroke();
    // 등 쪽 반짝임 — 물기 어린 비늘
    c.globalCompositeOperation = "lighter";
    c.strokeStyle = alpha("#ffffff", 0.55);
    c.lineWidth = 2 * this.u;
    c.beginPath();
    c.moveTo(-L * 0.25, -L * 0.13);
    c.quadraticCurveTo(L * 0.05, -L * 0.2, L * 0.3, -L * 0.1);
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
    c.strokeStyle = mix("#ff3b4e", this.skin.line, p);
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
      // 그림의 가로(reelX)는 낚싯대 축에 수직이다 — 휘거나 기울면 화면 x 로만 옮겨서는 릴에서 벗어난다
      const q = at(Math.min(1, sp.reelK + 0.02)), th = Math.atan2(q.y - r.y, q.x - r.x);
      const off = sp.reelX * scale;
      c.save();
      c.translate(r.x - Math.sin(th) * off, r.y + Math.cos(th) * off);
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
    const ph = this.view.phase, hide = ph === "landed" || ph === "scoop" || ph === "result";
    const dt = clamp(this.t - this.rodShowAt, 0, 0.1);
    this.rodShowAt = this.t;
    this.rodShow = this.reduced ? (hide ? 0 : 1) : clamp(this.rodShow + (hide ? -dt * 4 : dt * 5), 0, 1);
    if (this.rodShow <= 0.01) return;
    if (this.rodShow < 1) {
      c.save();
      c.globalAlpha *= this.rodShow;
      c.translate(0, (1 - this.rodShow) * 40 * this.u);
      this.drawRodInner(c);
      c.restore();
      return;
    }
    this.drawRodInner(c);
  }
  private drawRodInner(c: CanvasRenderingContext2D) {
    const base = FX_RODS[this.view.rod] ?? FX_RODS.rod_bamboo, tint = this.skin.rodTint;
    // 그림이 오기 전(직접 그린 낚싯대)에도 고른 색이 보이게 — 몸 · 실 색만 섞는다(손잡이 · 릴은 그대로)
    const look = tint ? { ...base, butt: mix(base.butt, tint, 0.55), tip: mix(base.tip, tint, 0.55), wrap: mix(base.wrap, tint, 0.4) } : base;
    const b = this.rodBase(), tip = this.rodTip(), L = this.rodLen(), u = this.u;
    const straight = { x: b.x - Math.sin(this.rodAng) * L, y: b.y - Math.cos(this.rodAng) * L };
    const ctrl = { x: lerp(b.x, straight.x, 0.62), y: lerp(b.y, straight.y, 0.62) };
    const at = (k: number) => {
      const m = 1 - k;
      return { x: m * m * b.x + 2 * m * k * ctrl.x + k * k * tip.x, y: m * m * b.y + 2 * m * k * ctrl.y + k * k * tip.y };
    };
    // 뜰채 낚시는 낚싯대 대신 뜰채를 든다 — 물을 가리지 않게 구석에, 내리칠 땐 손에서 떠난다
    if (this.view.method === "scoop") {
      if (!this.net && !this.lift && this.view.phase !== "landed" && this.view.phase !== "scoop" && this.view.phase !== "result") {
        const size = this.W * 0.42;
        this.netPic(c, this.W * 0.93 + Math.sin(this.t * 1.2) * 2 * u, this.H * 0.93 + Math.cos(this.t * 0.9) * 2 * u, size, 0, 1);
      }
      return;
    }
    const sprite = this.rodArt[this.view.rod];
    if (sprite && sprite !== "loading") {
      this.drawRodArt(c, this.rodSprite(sprite), at, L);
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
    c.save();
    c.translate(r.x, r.y);
    c.scale(R, R);
    c.fillStyle = this.grad(c, `reel:${look.reel}:${R.toFixed(2)}`, () => {
      const g = c.createRadialGradient(-0.35, -0.35, 1 / R, 0, 0, 1);
      g.addColorStop(0, mix(look.reel, "#ffffff", 0.45));
      g.addColorStop(1, mix(look.reel, "#000000", 0.35));
      return g;
    });
    c.beginPath();
    c.arc(0, 0, 1, 0, 6.29);
    c.fill();
    c.restore();
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
    const dq = Math.round(depth * 50) / 50; // 50단계로 묶어 같은 그라디언트를 다시 쓴다(눈으로는 차이가 없다)
    c.fillStyle = this.grad(c, `deep:${top.toFixed(1)}:${this.H}:${dq}`, () => {
      const g = c.createLinearGradient(0, top, 0, this.H);
      g.addColorStop(0, `rgba(2,12,34,${(0.16 + dq * 0.28).toFixed(3)})`);
      g.addColorStop(1, `rgba(1,6,22,${(0.3 + dq * 0.56).toFixed(3)})`);
      return g;
    });
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
        c.scale(r, r * 0.55);
        c.globalAlpha *= clamp(0.15 + f.z * 0.5, 0, 1);
        c.fillStyle = this.glow(c, col);
        c.beginPath();
        c.arc(0, 0, 1, 0, 6.29);
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
    const l = this.lift;
    if (l) {
      // 들어 올리는 그물 — 올라갈수록 위로, 기운 만큼 돌아간다. 몸부림치면 떨린다. 끝나면 위로 빠지거나(ok) 아래로 떨어진다
      const e = l.end ? clamp((this.t - l.end.t0) / 0.6, 0, 1) : 0;
      if (e >= 1) {
        this.lift = null;
        return;
      }
      const jit = l.kick && !this.reduced ? Math.sin(this.t * 48) * 0.05 : 0;
      const y = l.y - l.h * this.H * 0.22 - (l.end?.ok ? e * this.H * 0.1 : -e * 18 * this.u);
      // 그물 속 물고기 그림자 — 기운 쪽으로 쏠린다
      c.save();
      c.globalAlpha = 0.55 * (1 - e);
      c.fillStyle = "rgba(4,18,32,.8)";
      c.beginPath();
      c.ellipse(l.x + l.tilt * l.r * 0.35, y + l.r * 0.15, l.r * 0.55, l.r * 0.22, l.tilt * 0.45 + jit * 3, 0, 6.29);
      c.fill();
      c.restore();
      this.netPic(c, l.x, y, l.r * 2.5, l.tilt * 0.45 + jit, 1 - e * e);
      return;
    }
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
      c.save();
      c.globalAlpha = clamp(danger * 0.62, 0, 1);
      c.fillStyle = this.grad(c, `danger:${this.W}:${this.H}`, () => {
        const g = c.createRadialGradient(this.W / 2, this.H / 2, R * 0.45, this.W / 2, this.H / 2, R);
        g.addColorStop(0, "rgba(255,30,50,0)");
        g.addColorStop(1, "rgba(255,30,50,1)");
        return g;
      });
      c.fillRect(0, 0, this.W, this.H);
      c.restore();
    }
    if (v.phase === "bite") {
      const R = Math.hypot(this.W, this.H) * 0.62;
      c.save();
      c.translate(this.bob.x, this.bob.y); // 찌를 따라 움직이므로 원점에 한 번 만들고 옮긴다
      c.fillStyle = this.grad(c, `bite:${R.toFixed(1)}`, () => {
        const g = c.createRadialGradient(0, 0, R * 0.3, 0, 0, R);
        g.addColorStop(0, "rgba(0,10,26,0)");
        g.addColorStop(1, "rgba(0,10,26,.5)");
        return g;
      });
      c.fillRect(-this.bob.x, -this.bob.y, this.W, this.H);
      c.restore();
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
    return { drops: this.drops.length, rings: this.rings.length, foam: this.foam.length, bobOn: this.bob.on, fishOn: this.fish.on, flying: !!this.fly, leaping: !!this.leap, rays: this.rays.to, bobX: this.bob.x, bobY: this.bob.y };
  }
}
