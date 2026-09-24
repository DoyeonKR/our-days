// 우리 섬 꾸미기 풍경 — 픽셀 배경 화가(순수·결정적). [2026-09-24]
//
// [사용자: "꾸미기 풍경 그래픽이야 너무 허접해 좀 퀄리티좀 올려야해"]
// 예전 풍경은 SVG 타원 셋(모래·잔디)과 벡터 구름이었다. 그 위에 24×24 도트 장식과 48×48 도트 펫이 서니
// **팬케이크 위에 스티커**처럼 보였다 — 하늘은 3색 띠, 섬은 평평한 원, 가장자리·그림자·질감이 하나도 없었다.
// 같은 앱의 펫 무대(village-autumn)와 홈 히어로는 촘촘한 도트 그림이라 차이가 더 컸다.
//
// 여기서는 배경 전체를 **도트로 그린다**(1 풍경 단위 = 1 도트). 한 장을 시간대 × 계절마다 한 번 굽고
// (IslandScene 이 data URL 로 캐시), 움직이는 것(구름·물빛·파도 거품·장식·펫)만 그 위에 얹는다.
//
//   하늘  — 홈 히어로와 같은 팔레트(scenetime.skyLook). 5-스톱을 9단 띠로 끊고, 경계만 Bayer 디더.
//   먼 섬 — 좌우 수평선에 섬 둘(오른쪽엔 등대). 대기 원근으로 하늘색에 녹는다.
//   바다  — 수평선에서 멀어질수록 짙어지는 띠 + 물결 대시 + 해·달 반사 기둥.
//   섬    — 얕은 물(청록) → 거품 → 젖은 모래 → 모래 → 흙 절벽 → 잔디 고원(질감·빛·가장자리 하이라이트).
//           뒤쪽 모서리에 계절 나무 · 덤불, 앞쪽에 바위, 오른쪽에 나무 선착장.
//
// ⚠ 좌표는 IslandScene 과 **한 곳**(여기 상수)에서만 정한다 — 장식 줄(scapeRows)이 잔디 밖으로 나가면
//   장식이 바다에 뜬다. islandscape.test 가 모든 칸이 잔디 위인지 잰다.
// ⚠ Math.random 금지 — 두 사람이 같은 섬을 본다. 무늬는 좌표 해시(hash01)로만.
// ⚠ 조명(lightK)은 장식·펫 스프라이트에도 **같은 값**으로 입힌다(litPalette). 배경만 밤이고 장식이 한낮이면
//   스티커처럼 뜬다.

import { hash01, hexToRgb } from "./pixel.ts";
import type { Season } from "./island.ts";
import type { SkyLook, SkyPhase } from "./scenetime.ts";

export type RGB = [number, number, number];
export type Buf = { w: number; h: number; data: Uint8ClampedArray };

/* ── 좌표(IslandScene 과 공유) ─────────────────────────────── */
export const SCAPE_W = 340;
export const SCAPE_H = 250;
export const SCAPE_HORIZON = 72;
/** 잔디 고원(윗면) 타원 */
export const LAWN = { cx: 170, cy: 146, rx: 154, ry: 60 };
/** 모래 해변 타원(고원 밑단을 감싼다) */
export const BEACH = { cx: 170, cy: 158, rx: 166, ry: 72 };
/** 펫이 서는 자리(발끝) — 앞 해변 한가운데 */
export const PET_SPOT = { x: 170, y: 226 };

/** 잔디 타원의 y 에서의 반너비. */
export const lawnHalfAt = (y: number): number => {
  const t = (y - LAWN.cy) / LAWN.ry;
  return t <= -1 || t >= 1 ? 0 : LAWN.rx * Math.sqrt(1 - t * t);
};
const ROW_TOP = 104;
const ROW_MARGIN = 20;
/** 장식 줄 n개: [지면 y, 반너비, 스케일]. 뒤(0)로 갈수록 작다. 반너비는 잔디 타원에서 **계산**한다.
 *  줄 수(4 → 5 → 6, 섬 확장)에 따라 **잔디 전체에 고르게** 편다. 고정 좌표로 두면 기본 4줄일 때
 *  장식이 뒤쪽에만 몰리고 앞 절반이 텅 빈다(1차 굽기에서 그랬다). 확장하면 줄 간격이 좁아질 뿐이다. */
export function scapeRows(n: number): [number, number, number][] {
  const count = Math.max(1, n);
  const bottom = Math.round(166 + count * 3.7);
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const y = Math.round(ROW_TOP + (bottom - ROW_TOP) * t);
    return [y, Math.round(lawnHalfAt(y) - ROW_MARGIN), +(0.84 + 0.35 * t).toFixed(2)];
  });
}

/** 해·달 위치(시간대별) — 해는 한낮에 높고 노을에 수평선 가까이. 달은 왼쪽 하늘. */
export function lightPosOf(phase: SkyPhase): { x: number; y: number; kind: "sun" | "moon" } {
  switch (phase) {
    case "sunrise":
      return { x: 64, y: 56, kind: "sun" };
    case "morning":
      return { x: 96, y: 30, kind: "sun" };
    case "day":
      return { x: 250, y: 20, kind: "sun" };
    case "golden":
      return { x: 272, y: 36, kind: "sun" };
    case "sunset":
      return { x: 268, y: 57, kind: "sun" };
    default:
      // 왼쪽 위 모서리(x < 72)는 평점 뱃지 자리 — 달이 뱃지 밑에 반쯤 깔렸었다
      return { x: 108, y: 22, kind: "moon" }; // night · blueHour · twilight
  }
}

/** 지면(섬·바다·장식·펫)에 입히는 조명 세기 — 홈 히어로의 근경 언덕과 같은 축. */
export const lightK = (look: SkyLook): number => +(look.hillTintNear * 0.85).toFixed(3);

/* ── 색 ─────────────────────────────────────────────────────── */
const H = (hex: string): RGB => hexToRgb(hex);
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
};
const hexOf = (c: RGB) => "#" + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");

/** 팔레트(#rrggbb)에 섬의 조명을 입힌다 — 장식·펫 스프라이트용. */
export function litPalette(pal: Record<string, string>, look: SkyLook): Record<string, string> {
  const k = lightK(look);
  const t = H(look.hillTint);
  const out: Record<string, string> = {};
  for (const [ch, hex] of Object.entries(pal)) out[ch] = /^#[0-9a-f]{6}$/i.test(hex) ? hexOf(mix(H(hex), t, k)) : hex;
  return out;
}

/* 계절 재료(한낮 기준 — 조명은 lit 으로 입힌다). 5톤 = 하이라이트·밝음·기본·그늘·깊은그늘 */
type Five = [string, string, string, string, string];
const GRASS: Record<Season, Five> = {
  spring: ["#c6f58a", "#98e063", "#72c64c", "#53a33d", "#3c7d33"],
  summer: ["#a6ea62", "#74cc46", "#52ad39", "#3c8c31", "#2b6c2b"],
  // 가을 잔디는 **누렇게 뜬 초록**이다 — 흙빛(올리브·카키)으로 가면 진흙밭으로 읽힌다(1차 굽기에서 그랬다)
  autumn: ["#eef08e", "#cdd766", "#a9bd4b", "#86993c", "#647330"],
  winter: ["#ffffff", "#f0f6fb", "#dbe8f1", "#bdd1de", "#9ab4c6"],
};
const SAND: Record<Season, [string, string, string, string]> = {
  spring: ["#fff0cc", "#f6ddab", "#e8c78f", "#caa574"],
  summer: ["#fff3cf", "#f8e0ad", "#ebca8f", "#cda872"],
  autumn: ["#f7e6c2", "#ecd3a3", "#dcbc88", "#bd9a6c"],
  winter: ["#f4f7f9", "#e3eaee", "#cfd9df", "#b3c1cb"],
};
const SOIL: [string, string, string, string] = ["#b3804f", "#94663f", "#76502f", "#583a22"];
const ROCK: [string, string, string, string] = ["#d9d3c7", "#b3ab9d", "#8a8377", "#645e56"];
const WOOD: [string, string, string, string] = ["#d19a60", "#a97646", "#7d5431", "#57391f"];
const SEA = { far: "#79c9ea", mid: "#48a6d6", deep: "#2c79b2", abyss: "#215f94", shallow: "#8fe3dc" };
const CANOPY: Record<Season, Five> = {
  spring: ["#fff0f6", "#ffcfe3", "#f8a9cb", "#de84ad", "#b76087"],
  summer: ["#b5ec72", "#7fd04e", "#4fa83b", "#35852f", "#245f27"],
  autumn: ["#ffd27a", "#f8a44d", "#e67a34", "#bf5527", "#8f3b1c"],
  winter: ["#8fb3a2", "#6c9684", "#4e7a69", "#3a5f52", "#284539"],
};
const TRUNK: [string, string, string] = ["#8e6440", "#6d4b2f", "#4a3220"];

/* ── 버퍼 ───────────────────────────────────────────────────── */
export function makeBuf(w: number, h: number): Buf {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}
function set(b: Buf, x: number, y: number, c: RGB, a = 255) {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  const i = (y * b.w + x) * 4;
  if (a >= 255) {
    b.data[i] = c[0];
    b.data[i + 1] = c[1];
    b.data[i + 2] = c[2];
    b.data[i + 3] = 255;
    return;
  }
  const k = a / 255;
  const ba = b.data[i + 3] / 255;
  const oa = k + ba * (1 - k);
  if (oa <= 0) return;
  for (let j = 0; j < 3; j++) b.data[i + j] = Math.round((c[j] * k + b.data[i + j] * ba * (1 - k)) / oa);
  b.data[i + 3] = Math.round(oa * 255);
}
function get(b: Buf, x: number, y: number): RGB {
  const i = (Math.max(0, Math.min(b.h - 1, y)) * b.w + Math.max(0, Math.min(b.w - 1, x))) * 4;
  return [b.data[i], b.data[i + 1], b.data[i + 2]];
}

/* ── 무늬 ───────────────────────────────────────────────────── */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const h2 = (x: number, y: number, seed: number) => hash01(((x * 73856093) ^ (y * 19349663)) | 0, seed);
const smooth = (t: number) => t * t * (3 - 2 * t);
/** 값 노이즈(0~1) — 격자 해시를 부드럽게 잇는다. */
function vnoise(x: number, y: number, s: number, seed: number): number {
  const gx = x / s;
  const gy = y / s;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = smooth(gx - x0);
  const fy = smooth(gy - y0);
  const a = h2(x0, y0, seed);
  const b = h2(x0 + 1, y0, seed);
  const c = h2(x0, y0 + 1, seed);
  const d = h2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** 0~1 값을 n 단계로 끊되, 경계 근처만 디더 — 픽셀 아트의 '띠 + 부드러운 이음'. */
function stepDither(v: number, n: number, x: number, y: number, soft = 2.4): number {
  const k = Math.max(0, Math.min(n - 1, v * (n - 1)));
  const k0 = Math.floor(k);
  if (k0 >= n - 1) return n - 1;
  const f = Math.max(0, Math.min(1, (k - k0 - 0.5) * soft + 0.5));
  return f > bayer(x, y) ? k0 + 1 : k0;
}

/* ── 모양 판정 ─────────────────────────────────────────────── */
/** 잔디 고원 안인가 — 가장자리에 ±1.5 도트 요철(완벽한 타원은 기계처럼 보인다). */
export function inLawn(x: number, y: number): boolean {
  const nx = (x - LAWN.cx) / LAWN.rx;
  const ny = (y - LAWN.cy) / LAWN.ry;
  const r = Math.sqrt(nx * nx + ny * ny);
  // 큰 굴곡(±3%) — 완벽한 타원은 기계처럼 보인다. 장식 줄은 가장자리에서 20도트 안쪽이라 안전하다.
  const lobe = (vnoise(x, y, 46, 5) - 0.5) * 0.06;
  const wob = ((vnoise(x, y, 7, 11) - 0.5) * 3) / LAWN.rx;
  return r < 1 + lobe + wob;
}
/** 그 x 에서 잔디가 끝나는 맨 아래 y(없으면 -1) — 절벽이 **실제** 가장자리에 붙게. */
export function lawnBottom(x: number): number {
  for (let y = LAWN.cy + LAWN.ry + 8; y >= LAWN.cy; y--) if (inLawn(x, y)) return y;
  return -1;
}
/** 절벽(흙 단면) 높이 — 정면 가운데가 가장 두껍고 옆으로 얇아진다. */
const cliffDepth = (x: number) => {
  const t = (x - LAWN.cx) / LAWN.rx;
  return t <= -1 || t >= 1 ? 0 : Math.round(3 + 7 * Math.sqrt(1 - t * t));
};
function beachR(x: number, y: number): number {
  const nx = (x - BEACH.cx) / BEACH.rx;
  const ny = (y - BEACH.cy) / BEACH.ry;
  return Math.sqrt(nx * nx + ny * ny) + (vnoise(x, y, 9, 23) - 0.5) * 0.02;
}

/* ── 그리기 ─────────────────────────────────────────────────── */
function paintSky(b: Buf, look: SkyLook) {
  const stops = [look.top, look.upper, look.mid, look.lower, look.bottom].map(H);
  const at = (t: number): RGB => {
    const k = Math.max(0, Math.min(3.9999, t * 4));
    const i = Math.floor(k);
    return mix(stops[i], stops[i + 1], k - i);
  };
  const BANDS = 10;
  const band = Array.from({ length: BANDS }, (_, i) => at(i / (BANDS - 1)));
  const haze = H(look.haze);
  for (let y = 0; y < SCAPE_HORIZON; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = y / (SCAPE_HORIZON - 1);
      let c = band[stepDither(t, BANDS, x, y)];
      // 수평선 바로 위는 대기 산란(헤이즈)으로 녹는다
      if (y > SCAPE_HORIZON - 9) c = mix(c, haze, ((y - (SCAPE_HORIZON - 9)) / 9) * 0.55 > bayer(x, y) * 0.55 ? 0.5 : 0.25);
      set(b, x, y, c);
    }
  }
  // 수평선 가까이 낮게 깔린 층운 — 하늘에 깊이를 준다(밤엔 거의 안 보인다)
  const lit = H(look.cloudLit);
  for (let s = 0; s < 5; s++) {
    const y = 46 + Math.round(h2(s, 1, 31) * 16);
    const x0 = Math.round(h2(s, 2, 31) * 300) - 20;
    const len = 30 + Math.round(h2(s, 3, 31) * 50);
    for (let x = x0; x < x0 + len; x++) {
      const edge = Math.min(x - x0, x0 + len - x);
      if (edge < 3 && bayer(x, y) > edge / 3) continue;
      set(b, x, y, mix(get(b, x, y), lit, 0.45));
      if (x > x0 + 4 && x < x0 + len - 6 && h2(x, s, 37) < 0.55) set(b, x, y - 1, mix(get(b, x, y - 1), lit, 0.25));
    }
  }
}

function paintStars(b: Buf, look: SkyLook, avoid: { x: number; y: number }) {
  if (look.starOpacity <= 0) return;
  const white: RGB = [255, 252, 236];
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash01(i, 71) * b.w);
    const y = Math.floor(hash01(i, 72) * (SCAPE_HORIZON - 12));
    if (Math.abs(x - avoid.x) < 16 && Math.abs(y - avoid.y) < 16) continue;
    const br = 0.45 + hash01(i, 73) * 0.55;
    const a = look.starOpacity * br;
    set(b, x, y, mix(get(b, x, y), white, a));
    if (i % 9 === 0) {
      // 큰 별 — 십자 반짝임
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(b, x + dx, y + dy, mix(get(b, x + dx, y + dy), white, a * 0.45));
    }
  }
}

function paintSunMoon(b: Buf, look: SkyLook, phase: SkyPhase) {
  const p = lightPosOf(phase);
  const glow = H(look.glow);
  const light = H(look.light);
  // 후광 — 블러가 아니라 계단 두 겹 + 디더
  for (let y = p.y - 20; y <= p.y + 20; y++) {
    for (let x = p.x - 20; x <= p.x + 20; x++) {
      if (y >= SCAPE_HORIZON) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      const base = get(b, x, y);
      if (d < 13) set(b, x, y, mix(base, glow, 0.34));
      else if (d < 18 && bayer(x, y) < 0.5) set(b, x, y, mix(base, glow, 0.2));
    }
  }
  if (p.kind === "sun") {
    const r = phase === "sunset" || phase === "sunrise" ? 10 : 8;
    for (let y = p.y - r; y <= p.y + r; y++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        if (y >= SCAPE_HORIZON) continue; // 노을 해는 수평선에 걸려 잘린다
        const d = Math.hypot(x - p.x + 0.5, y - p.y + 0.5);
        if (d > r) continue;
        const core = mix(light, [255, 255, 255], 0.5);
        const c = d > r - 1.2 ? mix(light, glow, 0.5) : d < r * 0.45 && x < p.x && y < p.y ? core : light;
        set(b, x, y, c);
      }
    }
  } else {
    const r = 7;
    const moon: RGB = [246, 240, 214];
    const shadow: RGB = [208, 201, 176];
    for (let y = p.y - r; y <= p.y + r; y++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        const d = Math.hypot(x - p.x + 0.5, y - p.y + 0.5);
        if (d > r) continue;
        // 오른쪽 아래가 살짝 그늘진 둥근 달 + 바다(크레이터) 셋
        let c = d > r - 1.1 && x > p.x ? shadow : moon;
        for (const [cx, cy, cr] of [[-2, -1, 1.6], [2, 2, 1.2], [1, -3, 0.9]] as const) {
          if (Math.hypot(x - (p.x + cx), y - (p.y + cy)) < cr) c = shadow;
        }
        set(b, x, y, c);
      }
    }
  }
}

function paintFarIslands(b: Buf, look: SkyLook, phase: SkyPhase) {
  const haze = H(look.haze);
  // 먼 땅은 **푸른 회색**이다(대기 원근). 계절색(가을 주황)을 그대로 쓰면 사막 언덕으로 읽혔다.
  const cool = mix([104, 138, 156], H(look.hillTint), look.hillTintFar);
  const far = mix(mix(H(look.hillFar), cool, 0.6), haze, 0.15);
  const mid = mix(mix(H(look.hillMid), cool, 0.45), haze, 0.1);
  const hills = [
    { x0: -24, x1: 92, peak: 22, px: 30, col: mix(far, haze, 0.35), seed: 3 },
    { x0: 104, x1: 150, peak: 6, px: 126, col: mix(far, haze, 0.55), seed: 5 },
    { x0: 230, x1: 364, peak: 15, px: 298, col: mix(mid, haze, 0.3), seed: 7 },
  ];
  for (const hl of hills) {
    for (let x = Math.max(0, hl.x0); x < Math.min(b.w, hl.x1); x++) {
      const t = (x - hl.px) / (x < hl.px ? hl.px - hl.x0 : hl.x1 - hl.px);
      const bell = Math.max(0, 1 - t * t);
      const top = SCAPE_HORIZON - Math.round(hl.peak * bell ** 0.8 + (vnoise(x, 0, 6, hl.seed) - 0.5) * 3 * bell);
      for (let y = top; y < SCAPE_HORIZON; y++) {
        // 광원 쪽(왼쪽 위) 능선은 밝게, 반대쪽 비탈은 어둡게 — 먼 섬도 입체가 된다
        const lightSide = x < hl.px;
        let c = hl.col;
        if (y === top) c = mix(c, haze, lightSide ? 0.35 : 0.1);
        else if (!lightSide && bayer(x, y) < 0.5) c = mix(c, [0, 0, 0], 0.08);
        // 수평선에 가까울수록 헤이즈에 녹는다
        if (y > SCAPE_HORIZON - 4) c = mix(c, haze, 0.25);
        set(b, x, y, c);
      }
    }
  }
  // 등대 — 오른쪽 섬 꼭대기. 흰 몸통 + 빨간 띠 + 등롱(밤엔 IslandScene 이 불빛을 얹는다)
  const lx = 298;
  const ly = SCAPE_HORIZON - 15;
  const white = mix([244, 240, 232], haze, 0.25);
  const red = mix([196, 70, 60], haze, 0.25);
  const dark = mix([60, 52, 64], haze, 0.3);
  for (let y = ly - 12; y < ly + 1; y++) {
    const w = y < ly - 9 ? 1 : 2;
    for (let x = lx - w; x <= lx + w - 1; x++) set(b, x, y, (y - (ly - 12)) % 4 === 1 ? red : x === lx + w - 1 ? mix(white, dark, 0.3) : white);
  }
  for (let x = lx - 2; x <= lx + 1; x++) set(b, x, ly - 13, dark);
  set(b, lx - 1, ly - 14, phase === "night" || phase === "twilight" || phase === "blueHour" ? [255, 226, 140] : dark);
  set(b, lx, ly - 14, dark);
  set(b, lx - 1, ly - 15, red);
}

function seaColors(look: SkyLook) {
  const k = lightK(look);
  const t = H(look.hillTint);
  const skyLow = H(look.bottom);
  const lit = (hex: string) => mix(H(hex), t, k);
  return {
    // 수평선 쪽은 하늘을 비춘다
    far: mix(lit(SEA.far), skyLow, 0.35),
    mid: lit(SEA.mid),
    deep: lit(SEA.deep),
    abyss: lit(SEA.abyss),
    shallow: lit(SEA.shallow),
    glint: mix(mix(lit(SEA.far), [255, 255, 255], 0.55), H(look.light), 0.25),
  };
}

function paintSea(b: Buf, look: SkyLook, phase: SkyPhase) {
  const sc = seaColors(look);
  const band = [sc.far, mix(sc.far, sc.mid, 0.5), sc.mid, mix(sc.mid, sc.deep, 0.5), sc.deep, sc.abyss];
  for (let y = SCAPE_HORIZON; y < b.h; y++) {
    // 원근 — 수평선 근처가 압축돼 띠가 촘촘하다
    const t = Math.pow((y - SCAPE_HORIZON) / (b.h - SCAPE_HORIZON), 0.62);
    for (let x = 0; x < b.w; x++) set(b, x, y, band[stepDither(t, band.length, x, y, 2)]);
  }
  // 수평선 한 줄 — 빛이 걸리는 경계
  for (let x = 0; x < b.w; x++) set(b, x, SCAPE_HORIZON, mix(get(b, x, SCAPE_HORIZON), H(look.haze), 0.6));
  // 물결 대시 — 가까울수록 길고 성기다
  for (let i = 0; i < 260; i++) {
    const t = hash01(i, 91) ** 1.35;
    const y = SCAPE_HORIZON + 2 + Math.round(t * (b.h - SCAPE_HORIZON - 3));
    const len = 2 + Math.round(t * 5);
    const x0 = Math.round(hash01(i, 92) * (b.w + 10)) - 5;
    const c = mix(get(b, x0, y), sc.glint, 0.55 - t * 0.2);
    for (let x = x0; x < x0 + len; x++) set(b, x, y, c);
    if (len > 4) set(b, x0 + 1, y - 1, mix(get(b, x0 + 1, y - 1), sc.glint, 0.3));
  }
  // 해·달 반사 기둥 — 광원 아래로 부서진 빛
  const p = lightPosOf(phase);
  const warm = H(look.light);
  const strong = phase === "sunset" || phase === "sunrise" || phase === "golden" || p.kind === "moon";
  for (let y = SCAPE_HORIZON + 1; y < b.h; y++) {
    const t = (y - SCAPE_HORIZON) / (b.h - SCAPE_HORIZON);
    const half = 4 + t * 26;
    for (let x = Math.round(p.x - half); x <= Math.round(p.x + half); x++) {
      const edge = 1 - Math.abs(x - p.x) / half;
      if (h2(x >> 1, y, 97) > edge * (strong ? 0.5 : 0.22) * (1 - t * 0.55)) continue;
      set(b, x, y, mix(get(b, x, y), warm, strong ? 0.62 : 0.4));
    }
  }
}

function paintIsland(b: Buf, look: SkyLook, season: Season) {
  const k = lightK(look);
  const tint = H(look.hillTint);
  const lit = (hex: string) => mix(H(hex), tint, k);
  const sc = seaColors(look);
  const sand = SAND[season].map(lit);
  const soil = SOIL.map(lit);
  const grass = GRASS[season].map(lit);
  const foam = mix([255, 255, 255], tint, k * 0.6);

  // 1) 얕은 물(청록 띠) · 섬 그림자(짙은 물) · 거품
  for (let y = SCAPE_HORIZON + 4; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const r = beachR(x, y);
      if (r > 1.16 || r < 1) continue;
      const base = get(b, x, y);
      if (r < 1.03) set(b, x, y, bayer(x, y) < 0.8 ? mix(base, foam, 0.75) : base); // 거품
      else if (r < 1.1) set(b, x, y, mix(base, sc.shallow, (1.1 - r) / 0.07 > bayer(x, y) ? 0.55 : 0.3));
      else if (bayer(x, y) < 0.35) set(b, x, y, mix(base, sc.abyss, 0.25)); // 물 밑 섬 그림자
    }
  }
  // 2) 모래 — 젖은 가장자리 · 알갱이 · 조개
  for (let y = SCAPE_HORIZON; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const r = beachR(x, y);
      if (r >= 1) continue;
      let c: RGB;
      if (r > 0.965) c = sand[3]; // 젖은 모래
      else if (r > 0.94) c = bayer(x, y) < 0.5 ? sand[3] : sand[2];
      else {
        const n = vnoise(x, y, 10, 41) * 0.7 + (1 - (y - BEACH.cy + BEACH.ry) / (2 * BEACH.ry)) * 0.3;
        c = sand[stepDither(n, 3, x, y)];
        const g = h2(x, y, 43);
        if (g < 0.035) c = sand[0];
        else if (g > 0.975) c = sand[3];
      }
      set(b, x, y, c);
    }
  }
  // 조개 · 불가사리(앞 해변에 드문드문)
  const shell = lit("#ffd9e4");
  const star = lit("#f39a6b");
  for (let i = 0; i < 9; i++) {
    const a = 0.2 + hash01(i, 51) * 0.6;
    const x = Math.round(BEACH.cx + Math.cos(Math.PI * a) * BEACH.rx * (0.82 + hash01(i, 52) * 0.08));
    const y = Math.round(BEACH.cy + Math.sin(Math.PI * a) * BEACH.ry * (0.9 + hash01(i, 53) * 0.05));
    if (Math.abs(x - PET_SPOT.x) < 24) continue;
    if (i % 3 === 0) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]]) set(b, x + dx, y + dy, star);
    } else {
      set(b, x, y, shell);
      set(b, x + 1, y, mix(shell, [150, 110, 120], 0.3));
    }
  }
  // 3) 흙 절벽 — 고원 앞 단면(층 · 돌 · 밑단 그림자). 잔디의 **실제** 밑단에서 시작한다.
  for (let x = 0; x < b.w; x++) {
    const bottom = lawnBottom(x);
    if (bottom < 0) continue;
    const d = cliffDepth(x);
    const y0 = bottom + 1;
    for (let j = 0; j <= d; j++) {
      const y = y0 + j;
      let c = soil[j < 2 ? 0 : j < d * 0.55 ? 1 : 2];
      if (j > 1 && (y + (x >> 3)) % 4 === 0 && bayer(x, y) < 0.5) c = soil[j < d * 0.55 ? 2 : 3]; // 지층 결
      if (h2(x, y, 61) < 0.05) c = lit(ROCK[1]); // 박힌 돌
      if (h2(x >> 1, y, 63) < 0.04 && j < 3) c = grass[3]; // 절벽 위로 늘어진 풀
      if (j === d) c = soil[3];
      set(b, x, y, c);
    }
    // 밑단 그림자가 모래에 떨어진다
    for (let j = 1; j <= 2; j++) if (bayer(x, y0 + d + j) < 0.5 / j) set(b, x, y0 + d + j, mix(get(b, x, y0 + d + j), soil[3], 0.35));
  }
  // 4) 잔디 고원 — 빛(왼쪽 위 밝게)의 큰 흐름 + 잔결. 큰 얼룩 노이즈는 쓰지 않는다
  //    (1차 굽기에서 위장무늬·진흙밭처럼 보였다). 질감은 작은 결과 풀잎이 맡는다.
  for (let y = LAWN.cy - LAWN.ry - 6; y <= LAWN.cy + LAWN.ry + 8; y++) {
    for (let x = LAWN.cx - LAWN.rx - 6; x <= LAWN.cx + LAWN.rx + 6; x++) {
      if (!inLawn(x, y)) continue;
      const nx = (x - LAWN.cx) / LAWN.rx;
      const ny = (y - LAWN.cy) / LAWN.ry;
      const light = 0.64 - nx * 0.22 - ny * 0.24;
      const v = light + (vnoise(x, y, 4, 83) - 0.5) * 0.26 + (vnoise(x, y, 26, 81) - 0.5) * 0.1;
      // 톤 0(그늘) · 1(기본) · 2(밝음)
      let c = grass[3 - stepDither(Math.max(0, Math.min(1, v)), 3, x, y, 3)];
      // 가장자리 — 뒤쪽 윗선은 빛을 받고, 앞쪽 끝선은 그늘
      if (!inLawn(x, y - 1)) c = grass[0];
      else if (!inLawn(x, y + 1)) c = grass[4];
      else if (!inLawn(x, y + 2)) c = grass[3];
      else if (!inLawn(x - 1, y) || !inLawn(x + 1, y)) c = grass[3];
      set(b, x, y, c);
    }
  }
  // 풀잎 결 — 성긴 격자에 1×2 잎(아래 그늘 · 위 밝음). 멀리서 보면 잔디의 '결'이 된다
  if (season !== "winter") {
    for (let gy = LAWN.cy - LAWN.ry; gy < LAWN.cy + LAWN.ry; gy += 3) {
      for (let gx = LAWN.cx - LAWN.rx; gx < LAWN.cx + LAWN.rx; gx += 4) {
        const x = gx + Math.floor(h2(gx, gy, 111) * 4);
        const y = gy + Math.floor(h2(gx, gy, 112) * 3);
        if (h2(gx, gy, 113) < 0.45) continue;
        if (!inLawn(x, y + 2) || !inLawn(x, y - 2) || !inLawn(x - 1, y) || !inLawn(x + 1, y)) continue;
        const shadeSide = (x - LAWN.cx) / LAWN.rx + (y - LAWN.cy) / LAWN.ry > 0.2;
        set(b, x, y, shadeSide ? grass[4] : grass[3]);
        set(b, x, y - 1, shadeSide ? grass[2] : grass[1]);
      }
    }
  }
  // 풀포기 · 꽃 · 낙엽 · 눈 반짝임 — 가운데(장식 자리)는 성기게, 가장자리는 촘촘하게
  const flowers: Record<Season, string[]> = {
    spring: ["#ffffff", "#ffd1e6", "#fff08a", "#c9b6ff"],
    summer: ["#ffffff", "#ffe066", "#ff9aa2"],
    autumn: ["#f08a3c", "#d9582b", "#f2c14e"],
    winter: ["#ffffff", "#e8f4ff"],
  };
  const fl = flowers[season].map(lit);
  for (let i = 0; i < 520; i++) {
    const x = Math.round(LAWN.cx + (hash01(i, 101) * 2 - 1) * LAWN.rx);
    const y = Math.round(LAWN.cy + (hash01(i, 102) * 2 - 1) * LAWN.ry);
    if (!inLawn(x, y) || !inLawn(x, y - 2) || !inLawn(x, y + 2)) continue;
    const nx = (x - LAWN.cx) / LAWN.rx;
    const ny = (y - LAWN.cy) / LAWN.ry;
    const rim = nx * nx + ny * ny; // 0 가운데 ~ 1 가장자리
    const r = hash01(i, 103);
    if (r > 0.25 + rim * 0.75) continue;
    const kind = hash01(i, 104);
    if (season === "winter") {
      if (kind < 0.3) {
        // 눈 사이로 삐져나온 풀끝
        set(b, x, y, lit("#7c9a86"));
        set(b, x + 1, y - 1, lit("#93b19c"));
      } else if (kind < 0.5) set(b, x, y, [255, 255, 255]);
      continue;
    }
    if (kind < 0.62) {
      // 풀포기 ʌʌ
      set(b, x, y, grass[4]);
      set(b, x + 1, y - 1, grass[3]);
      set(b, x + 2, y, grass[4]);
      set(b, x + 1, y - 2, grass[0]);
    } else if (kind < (season === "autumn" ? 0.97 : 0.9)) {
      const col = fl[Math.floor(hash01(i, 105) * fl.length)];
      set(b, x, y, col);
      if (season !== "autumn") {
        set(b, x, y + 1, grass[4]);
        if (hash01(i, 106) < 0.4) set(b, x + 1, y, col);
      } else set(b, x + 1, y, mix(col, [0, 0, 0], 0.15)); // 낙엽 두 칸
    }
  }
}

/** 나무 한 그루(뒤쪽 모서리) — 계절 수관 + 줄기 + 그늘. */
function paintTree(b: Buf, look: SkyLook, season: Season, bx: number, by: number, size: number, seed: number) {
  const k = lightK(look);
  const tint = H(look.hillTint);
  const lit = (hex: string) => mix(H(hex), tint, k);
  const can = CANOPY[season].map(lit);
  const trunk = TRUNK.map(lit);
  const snow = lit("#ffffff");
  // 발밑 그림자
  for (let x = bx - size; x <= bx + size; x++) {
    for (let y = by - 1; y <= by + 1; y++) {
      if (Math.abs(x - bx) / size + Math.abs(y - by) / 2 < 1 && bayer(x, y) < 0.6) set(b, x, y, mix(get(b, x, y), [0, 0, 0], 0.22));
    }
  }
  // 줄기
  for (let y = by - Math.round(size * 0.9); y <= by; y++) {
    for (let x = bx - 1; x <= bx + 1; x++) set(b, x, y, x === bx - 1 ? trunk[0] : x === bx + 1 ? trunk[2] : trunk[1]);
  }
  if (season === "winter") {
    // 눈 쌓인 전나무 — 삼각 층 셋
    for (let tier = 0; tier < 3; tier++) {
      const ty = by - Math.round(size * 0.6) - tier * Math.round(size * 0.45);
      const hw = Math.round(size * (0.95 - tier * 0.22));
      for (let dy = 0; dy < Math.round(size * 0.6); dy++) {
        const w = Math.round((hw * (dy + 1)) / Math.round(size * 0.6));
        for (let x = bx - w; x <= bx + w; x++) {
          const y = ty - Math.round(size * 0.6) + dy;
          const c = dy < 2 || (x < bx && dy < 3) ? snow : x > bx + w / 3 ? can[3] : x < bx - w / 2 ? can[1] : can[2];
          set(b, x, y, c);
        }
      }
    }
    return;
  }
  // 둥근 수관 — 원 다섯을 겹쳐 덩어리를 만들고, 왼쪽 위 광원으로 5톤 명암.
  //   외곽 아래·오른쪽은 가장 짙은 톤으로 감싸고(셀렉티브 아웃라인), 윗면엔 잎 뭉치 하이라이트.
  const blobs = [
    [0, -1.55, 0.78],
    [-0.7, -1.12, 0.66],
    [0.72, -1.05, 0.64],
    [-0.28, -0.7, 0.62],
    [0.36, -0.66, 0.6],
  ].map(([dx, dy, r]) => [bx + dx * size, by - size * 0.35 + dy * size, r * size] as const);
  const inside = (x: number, y: number) => blobs.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);
  const top = Math.floor(Math.min(...blobs.map(([, cy, r]) => cy - r)));
  const bot = Math.ceil(Math.max(...blobs.map(([, cy, r]) => cy + r)));
  for (let y = top; y <= bot; y++) {
    for (let x = bx - size * 2; x <= bx + size * 2; x++) {
      if (!inside(x, y)) continue;
      const lx = (x - bx) / size;
      const ly = (y - (by - size * 1.4)) / size;
      const shadeV = 0.62 - lx * 0.28 - ly * 0.32 + (vnoise(x, y, 3, seed) - 0.5) * 0.3;
      let c = can[3 - stepDither(Math.max(0, Math.min(1, shadeV)), 3, x, y)];
      // 잎 뭉치의 윗선(작은 호) — 수관이 한 덩어리 원이 아니라 잎 무더기로 읽힌다
      if (!inside(x, y - 1)) c = can[0];
      else if (inside(x, y - 1) && !inside(x, y - 2) && lx < 0.4) c = can[1];
      else if (!inside(x, y + 1) || !inside(x + 1, y)) c = can[4];
      else if (h2(x, y, seed + 7) < 0.07 && shadeV > 0.45) c = can[0];
      set(b, x, y, c);
    }
  }
  // 봄 꽃잎 / 가을 열매 점
  if (season === "spring" || season === "autumn") {
    for (let i = 0; i < 14; i++) {
      const x = Math.round(bx + (hash01(i, seed) * 2 - 1) * size * 1.2);
      const y = Math.round(by - size * (0.4 + hash01(i, seed + 1) * 1.6));
      if (inside(x, y)) set(b, x, y, season === "spring" ? lit("#ffffff") : lit("#c7352a"));
    }
  }
}

function paintBush(b: Buf, look: SkyLook, season: Season, bx: number, by: number, w: number, seed: number) {
  const k = lightK(look);
  const tint = H(look.hillTint);
  const g = (season === "autumn" ? CANOPY.autumn : season === "winter" ? GRASS.winter : GRASS[season]).map((h) => mix(H(h), tint, k));
  const hh = Math.round(w * 0.55);
  for (let y = by - hh; y <= by; y++) {
    for (let x = bx - w; x <= bx + w; x++) {
      const nx = (x - bx) / w;
      const ny = (y - by) / hh;
      const bump = (vnoise(x, 0, 4, seed) - 0.5) * 0.5;
      if (nx * nx + ny * ny > 1 + bump) continue;
      const v = 0.45 + nx * 0.25 - ny * -0.2 + (vnoise(x, y, 3, seed + 1) - 0.5) * 0.4;
      let c = g[1 + stepDither(Math.max(0, Math.min(1, v)), 3, x, y)];
      if (y === by - hh || (nx * nx + ((y - 1 - by) / hh) ** 2 > 1 + bump && y < by - 1)) c = g[0];
      set(b, x, y, c);
    }
  }
}

function paintRock(b: Buf, look: SkyLook, cx: number, cy: number, w: number) {
  const k = lightK(look);
  const tint = H(look.hillTint);
  const r = ROCK.map((h) => mix(H(h), tint, k));
  const hh = Math.round(w * 0.6);
  for (let y = cy - hh; y <= cy; y++) {
    for (let x = cx - w; x <= cx + w; x++) {
      const nx = (x - cx) / w;
      const ny = (y - cy) / hh;
      if (nx * nx + ny * ny > 1) continue;
      let c = r[1];
      if (nx < -0.2 && ny < -0.35) c = r[0];
      else if (nx > 0.35 || ny > -0.15) c = r[2];
      if (nx * nx + ny * ny > 0.8 && (nx > 0 || ny > -0.2)) c = r[3];
      set(b, x, y, c);
    }
  }
  // 물가 거품 한 줄
  for (let x = cx - w - 1; x <= cx + w + 1; x++) if (bayer(x, cy + 1) < 0.6) set(b, x, cy + 1, mix(get(b, x, cy + 1), [255, 255, 255], 0.6));
}

/** 나무 선착장 — 오른쪽 해변에서 바다로. 널빤지 결 · 기둥 · 물에 비친 그림자. */
function paintPier(b: Buf, look: SkyLook) {
  const k = lightK(look);
  const tint = H(look.hillTint);
  const w = WOOD.map((h) => mix(H(h), tint, k));
  const x0 = 272;
  const x1 = 346;
  const y0 = 214;
  for (let x = x0; x < x1; x++) {
    // 기둥(바다 쪽) — 물에 잠긴 부분은 어둡게
    if ((x - x0) % 12 === 10) for (let y = y0 + 5; y < y0 + 13; y++) set(b, x, y, y > y0 + 9 ? mix(w[3], get(b, x, y), 0.4) : w[3]);
    for (let y = y0; y < y0 + 5; y++) {
      let c = y === y0 ? w[0] : y === y0 + 4 ? w[3] : w[1];
      if ((x - x0) % 6 === 0 && y > y0) c = w[2]; // 널빤지 이음
      set(b, x, y, c);
    }
    // 물 그림자
    if (bayer(x, y0 + 6) < 0.5) set(b, x, y0 + 6, mix(get(b, x, y0 + 6), [0, 0, 0], 0.25));
  }
}

/** 배경 한 장 — 하늘 · 해/달 · 별 · 먼 섬 · 바다 · 섬(모래·절벽·잔디) · 나무 · 바위 · 선착장. */
export function paintIslandscape(look: SkyLook, phase: SkyPhase, season: Season): Buf {
  const b = makeBuf(SCAPE_W, SCAPE_H);
  paintSky(b, look);
  paintStars(b, look, lightPosOf(phase));
  paintSunMoon(b, look, phase);
  paintFarIslands(b, look, phase);
  paintSea(b, look, phase);
  paintIsland(b, look, season);
  // 뒤쪽 모서리 식생 — 장식 자리(가운데)는 비워 둔다
  paintBush(b, look, season, 54, 100, 16, 7);
  paintBush(b, look, season, 286, 101, 15, 9);
  paintBush(b, look, season, 22, 134, 10, 13);
  paintBush(b, look, season, 318, 136, 10, 17);
  paintTree(b, look, season, 36, 112, 12, 19);
  paintTree(b, look, season, 305, 114, 11, 23);
  paintRock(b, look, 34, 212, 7);
  paintRock(b, look, 46, 216, 4);
  paintRock(b, look, 250, 222, 5);
  paintPier(b, look);
  return b;
}

/* ── 움직이는 겹(IslandScene 이 번갈아 켠다) ─────────────────── */

/** 물빛 반짝임 두 겹(frame 0/1) — 투명 버퍼. 번갈아 켜면 바다가 반짝인다. */
export function paintGlints(look: SkyLook, phase: SkyPhase, frame: 0 | 1): Buf {
  const b = makeBuf(SCAPE_W, SCAPE_H);
  const p = lightPosOf(phase);
  const c = mix([255, 255, 255], H(look.light), 0.35);
  for (let i = 0; i < 60; i++) {
    const t = hash01(i, 131 + frame) ** 1.2;
    const y = SCAPE_HORIZON + 3 + Math.round(t * (SCAPE_H - SCAPE_HORIZON - 6));
    // 절반은 광원 반사 기둥 근처에 모인다
    const x = i % 2 ? Math.round(p.x + (hash01(i, 133 + frame) - 0.5) * (8 + t * 50)) : Math.round(hash01(i, 135 + frame) * SCAPE_W);
    if (beachR(x, y) < 1.02) continue; // 섬 위엔 없다
    set(b, x, y, c, 230);
    if (i % 5 === 0) {
      set(b, x - 1, y, c, 120);
      set(b, x + 1, y, c, 120);
    }
  }
  return b;
}

/** 파도 거품 두 겹 — 해변 둘레에서 한 칸씩 밀려왔다 빠진다. */
export function paintFoam(look: SkyLook, frame: 0 | 1): Buf {
  const b = makeBuf(SCAPE_W, SCAPE_H);
  const foam = mix([255, 255, 255], H(look.hillTint), lightK(look) * 0.6);
  for (let y = SCAPE_HORIZON + 4; y < SCAPE_H; y++) {
    for (let x = 0; x < SCAPE_W; x++) {
      const r = beachR(x, y);
      const lo = frame ? 1.035 : 1.05;
      if (r < lo || r > lo + 0.012) continue;
      if (h2(x >> 2, frame, 141) < 0.35) continue; // 끊긴 거품
      set(b, x, y, foam, 200);
    }
  }
  return b;
}

/** 뭉게구름 스프라이트 — 광원 쪽 윗면 밝게, 아랫면 그늘. w×h 투명 버퍼. */
export function paintCloud(look: SkyLook, variant: number): Buf {
  const sizes = [
    [56, 22],
    [40, 17],
    [28, 12],
  ];
  const [w, h] = sizes[variant % sizes.length];
  const b = makeBuf(w, h);
  const lit = H(look.cloudLit);
  const shade = H(look.cloudShade);
  const rim = mix(lit, [255, 255, 255], 0.55);
  const mid = mix(lit, shade, 0.45);
  const puffs = [
    [0.16, 0.68, 0.26],
    [0.33, 0.5, 0.36],
    [0.52, 0.4, 0.42],
    [0.7, 0.52, 0.34],
    [0.85, 0.68, 0.24],
    [0.46, 0.66, 0.36],
  ].map(([px, py, r]) => [px * w, py * h, r * h] as const);
  const flat = Math.round(h * 0.86);
  const inside = (x: number, y: number) => y <= flat && puffs.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);
  const alpha = look.night ? 150 : 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let c = lit;
      if (!inside(x, y - 1)) c = rim;
      else if (y > h * 0.66) c = shade;
      else if (y > h * 0.52) c = bayer(x, y) < 0.5 ? mid : lit;
      if (!inside(x, y + 1)) c = mix(shade, [40, 50, 80], 0.12);
      set(b, x, y, c, alpha);
    }
  }
  return b;
}

/** 장식·펫 발밑 그림자 — w×h 타원(가운데 진하게), 투명 버퍼. */
export function paintShadow(w: number, h: number): Buf {
  const b = makeBuf(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      set(b, x, y, [20, 24, 18], d < 0.45 ? 92 : bayer(x, y) < 0.6 ? 70 : 0);
    }
  }
  return b;
}

/** 배치 대기 칸 표시 — 흰 도트 타원 고리(안쪽은 아주 옅게). 빈 칸이 '여기 놓아요'로 숨쉰다. */
export function paintSlotRing(w: number, h: number): Buf {
  const b = makeBuf(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (d >= 0.55) set(b, x, y, [255, 255, 255], (x + y) % 3 === 0 ? 120 : 235);
      else set(b, x, y, [255, 255, 255], 46);
    }
  }
  return b;
}

/** 해변(모래) 위인가 — 잔디 고원 밖이면서 모래 타원 안. 펫 자리 검사용. */
export const onBeach = (x: number, y: number): boolean => beachR(x, y) < 1 && !inLawn(x, y);
