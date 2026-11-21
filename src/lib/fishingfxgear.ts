/* 낚시 연출의 장비 그림(2026-11-21 리뷰 ⑪ — fishingfx.ts 3,375줄에서 떼어 냈다) — 낚싯대 색 · 원화 자리 · 굽기 · 색 입히기, 뜰채 테 자리, 찌 그리기.
 * 판정 없음 · 캔버스만. fishingfx.ts 가 다시 내보내서 바깥 import 는 그대로다. */
import { RODS_WITH_DRAWN_LINE, stripThinStrokes } from "./rodstrip.ts";

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
export type RodSprite = { src: CanvasImageSource; w: number; h: number; reelX: number; reelK: number };

/** 구운 낚싯대 캔버스를 비운다 — 버린 FishFx 의 그림이 GC 를 기다리며 캔버스 메모리를 붙잡지 않게 */
/** 뜰채 그림 속 테(그물 입구)의 자리 — 그림 칸(가로세로 1, 가운데 원점)에 대한 비율: [가운데 x, y, 반지름 rx, ry, 기울기(rad), 자루 끝 x, y].
 *  그림을 10% 격자에 놓고 눈으로 잰 값이다(2026-11-13). 들어 올리는 물고기를 이 타원 안에 그린다 — 새 뜰채 그림을 넣으면 같이 잰다(fishingvisual.test 가 NETS 와 맞춰 본다) */
export const FX_NET_HOOP: Readonly<Record<string, readonly [number, number, number, number, number, number, number]>> = {
  net_bug: [-0.07, -0.21, 0.23, 0.12, 0.74, -0.23, 0.22],
  net_cotton: [-0.15, -0.21, 0.25, 0.15, 0.52, -0.23, 0.25],
  net_rubber: [-0.14, -0.21, 0.25, 0.14, 0.53, -0.13, 0.12],
  net_silver: [-0.13, -0.2, 0.26, 0.14, 0.63, -0.27, 0.23],
  net_gold: [-0.16, -0.18, 0.25, 0.15, 0.65, 0, 0.25],
  net_moon: [0.2, -0.18, 0.17, 0.12, 0.25, 0.27, 0.18],
};

export function releaseRod(sp: RodSprite) {
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

export function bakeRod(img: CanvasImageSource, key: string): RodSprite | null {
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
export const FX_BOBBERS = ["bob_red", "bob_star", "bob_heart", "bob_duck", "bob_moon", "bob_gold", "bob_trophy", "bob_season"] as const;

type BobberPal = { hi: string; mid: string; lo: string; band: string | null; edge: string };
const BOBBER_PAL: Readonly<Record<string, BobberPal>> = {
  bob_red: { hi: "#ff6b5e", mid: "#e6242d", lo: "#8e0f1d", band: "#fffdf5", edge: "rgba(60,8,16,.55)" },
  bob_star: { hi: "#fff27a", mid: "#facc15", lo: "#b45309", band: "#fffdf5", edge: "rgba(90,50,4,.55)" },
  bob_heart: { hi: "#ffc2dd", mid: "#f472b6", lo: "#9d174d", band: null, edge: "rgba(90,10,50,.55)" },
  bob_duck: { hi: "#fff7a8", mid: "#fde047", lo: "#ca8a04", band: null, edge: "rgba(90,60,4,.55)" },
  bob_moon: { hi: "#4b5ea8", mid: "#1e2a5a", lo: "#0b1233", band: null, edge: "rgba(4,8,30,.7)" },
  bob_gold: { hi: "#fff3b0", mid: "#e5b84a", lo: "#8a5a12", band: "#fff8dc", edge: "rgba(80,50,6,.6)" },
  // 강태공 찌(이달의 대회 1등 한정 — fishlooks 의 LIMITED_LOOKS) — 금빛 찌와 가려지게 띠를 남색으로, 몸에 작은 우승컵
  bob_trophy: { hi: "#fff1a8", mid: "#f5c542", lo: "#9a6410", band: "#1e3a8a", edge: "rgba(70,40,4,.65)" },
  // 시즌 찌(시즌 미션 8개 보상 — fishlooks 의 LIMITED_LOOKS) — 청록 몸 · 흰 띠, 몸에 작은 잎
  bob_season: { hi: "#9df0dc", mid: "#2fb39a", lo: "#0f5e52", band: "#fffdf5", edge: "rgba(4,40,34,.65)" },
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
  } else if (id === "bob_trophy") {
    // 우승컵 — 띠(−2.8 ~ 2.2) 위, 몸 안(가로 ±4)에만. 잔 · 손잡이 · 받침
    c.fillStyle = "#fffbeb";
    c.beginPath();
    c.moveTo(-3, -9.6);
    c.lineTo(3, -9.6);
    c.quadraticCurveTo(2.8, -5.6, 0.7, -5);
    c.lineTo(0.7, -4.2);
    c.lineTo(1.8, -3.4);
    c.lineTo(-1.8, -3.4);
    c.lineTo(-0.7, -4.2);
    c.lineTo(-0.7, -5);
    c.quadraticCurveTo(-2.8, -5.6, -3, -9.6);
    c.closePath();
    c.fill();
    c.strokeStyle = "#fffbeb";
    c.lineWidth = 0.7;
    c.beginPath();
    c.arc(-3.1, -8.2, 1.1, Math.PI * 0.5, Math.PI * 1.5);
    c.moveTo(3.1, -9.3);
    c.arc(3.1, -8.2, 1.1, -Math.PI * 0.5, Math.PI * 0.5);
    c.stroke();
  } else if (id === "bob_season") {
    // 잎 한 장 — 띠 위, 몸 안(가로 ±4)에만. 잎맥 한 줄
    c.fillStyle = "#f2fff9";
    c.beginPath();
    c.moveTo(-2.6, -4.2);
    c.quadraticCurveTo(-3, -9, 2.6, -9.6);
    c.quadraticCurveTo(2.4, -4.6, -2.6, -4.2);
    c.closePath();
    c.fill();
    c.strokeStyle = "#2fb39a";
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(-2.2, -4.6);
    c.quadraticCurveTo(0, -6.4, 2.2, -9.2);
    c.stroke();
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
export function tintRod(sp: RodSprite, color: string): RodSprite | null {
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

