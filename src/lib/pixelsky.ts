// 홈 하늘의 소품을 도트로 — 구름 · 새 · 해/달.
//
// [사용자 요청 2026-08-07 "홈화면 배경 픽셀들 개선"]
//
// 예전엔 구름이 SVG **타원 8개**, 새가 **곡선 stroke**, 해·달이 **원 + 반투명 크레이터**였다.
// 전부 도트 세계에 없는 것들이다 — 매끈한 가장자리와 알파 블렌딩은 픽셀 문법이 아니다.
// 그 위에 1px 격자 펫이 서 있으니 둘이 겉돌았다.
//
// ⚠ 색은 씬(scenetime)이 시각마다 주는 값을 그대로 쓴다. 여기서는 **모양만** 정한다 —
//   하늘색이 시시각각 바뀌는데 소품 색을 박아 두면 새벽에 구름만 대낮이 된다.

import { type Palette, type Sprite } from "./pixel.ts";

/** 폭 w 행을 런으로 적는다(점을 손으로 세지 않는다 — 하나 빠져도 눈에 안 보인다). */
const mkRow = (w: number) => (...runs: readonly (readonly [number, string])[]): string => {
  const a = new Array<string>(w).fill(".");
  for (const [x0, s] of runs)
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= w) throw new Error(`sky row: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  return a.join("");
};

/* ── 구름 ────────────────────────────────────────────────────────
 * 픽셀 구름의 규칙: 윗면은 광원색 한 덩어리, 아랫배만 그늘색 한 줄.
 * 톤을 더 넣으면 작은 크기에서 지저분해지기만 한다.
 *   L = 윗면(밝음) · S = 아랫배(그늘)
 */
const r28 = mkRow(28);
const CLOUD_L_ROWS = [
  r28([10, "LLLLLL"]),
  r28([7, "LLLLLLLLLLL"]),
  r28([4, "LLLLLLLLLLLLLLLL"]),
  r28([2, "LLLLLLLLLLLLLLLLLLLL"]),
  r28([1, "LLLLLLLLLLLLLLLLLLLLLLLL"]),
  r28([1, "SLLLLLLLLLLLLLLLLLLLLLLS"]),
  r28([2, "SSLLLLLLLLLLLLLLLLLLSS"]),
  r28([4, "SSSSSSSSSSSSSSSS"]),
];
const r20 = mkRow(20);
const CLOUD_M_ROWS = [
  r20([7, "LLLLL"]),
  r20([4, "LLLLLLLLLL"]),
  r20([2, "LLLLLLLLLLLLLL"]),
  r20([1, "LLLLLLLLLLLLLLLL"]),
  r20([1, "SLLLLLLLLLLLLLLS"]),
  r20([3, "SSSSSSSSSSSS"]),
];
const r14 = mkRow(14);
const CLOUD_S_ROWS = [
  r14([5, "LLLL"]),
  r14([2, "LLLLLLLL"]),
  r14([1, "LLLLLLLLLLL"]),
  r14([1, "SLLLLLLLLLS"]),
  r14([3, "SSSSSSS"]),
];

export type CloudSize = "s" | "m" | "l";
const CLOUD_ROWS: Record<CloudSize, string[]> = { s: CLOUD_S_ROWS, m: CLOUD_M_ROWS, l: CLOUD_L_ROWS };
const CLOUD_W: Record<CloudSize, number> = { s: 14, m: 20, l: 28 };

/** 구름 스프라이트. 색은 씬이 준 광원색·그늘색을 넣는다. */
export function cloudSprite(size: CloudSize, lit: string, shade: string): Sprite {
  const pal: Palette = { L: lit, S: shade };
  return { w: CLOUD_W[size], h: CLOUD_ROWS[size].length, pal, rows: CLOUD_ROWS[size] };
}

/* ── 새 ──────────────────────────────────────────────────────────
 * 곡선 stroke 로 그리면 아무리 얇아도 도트가 아니다. V 자 두 마리를 점으로 찍는다.
 * 두 프레임(날개 위/아래)이 있어야 '난다'로 읽힌다 — 한 장이면 매달린 것처럼 보인다.
 */
const r11 = mkRow(11);
const BIRD_ROWS: string[][] = [
  [r11([0, "B"], [4, "B"], [6, "B"], [10, "B"]), r11([1, "BB"], [5, "B"], [8, "BB"]), r11([3, "B"], [7, "B"])],
  [r11([1, "BB"], [8, "BB"]), r11([0, "B"], [3, "BB"], [6, "BB"], [10, "B"]), r11()],
];

export function birdSprite(frame: number, tint: string): Sprite {
  const rows = BIRD_ROWS[((frame % BIRD_ROWS.length) + BIRD_ROWS.length) % BIRD_ROWS.length];
  return { w: 11, h: rows.length, pal: { B: tint }, rows };
}

/* ── 해·달 ───────────────────────────────────────────────────────
 * 원을 <circle> 로 그리면 가장자리가 안티에일리어싱된다. 픽셀에서 원은 **계단**이다.
 * 격자 u 에 맞춘 다각형 경로를 만들어 SVG 에 그대로 넣는다(shapeRendering=crispEdges 와 짝).
 */
export function discPath(cx: number, cy: number, r: number, u = 2): string {
  const q = (v: number) => Math.round(v / u) * u;
  const seg: [number, number][] = []; // [y, 반너비] — 위에서 아래로
  for (let y = q(cy - r); y <= q(cy + r); y += u) {
    const dy = y + u / 2 - cy;
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (half <= 0) continue;
    seg.push([y, q(half)]);
  }
  if (seg.length === 0) return "";
  // 오른쪽 변을 위→아래로, 왼쪽 변을 아래→위로 돌아 닫는다(계단이 그대로 남는다)
  const right: string[] = [];
  const left: string[] = [];
  for (const [y, half] of seg) {
    right.push(`L${cx + half} ${y}`, `L${cx + half} ${y + u}`);
    left.unshift(`L${cx - half} ${y + u}`, `L${cx - half} ${y}`);
  }
  return `M${cx} ${seg[0][0]} ${right.join(" ")} ${left.join(" ")} Z`;
}

/** 달의 밝은 쪽 — 위상 0~1. 종결선도 계단으로 만든다(반투명 클립 대신). */
export function moonLitPath(cx: number, cy: number, r: number, phase: number, u = 2): string {
  const p = ((phase % 1) + 1) % 1;
  // -1(왼쪽 초승) ~ 0(보름) ~ 1(오른쪽 초승)
  const k = Math.cos(p * Math.PI * 2);
  const q = (v: number) => Math.round(v / u) * u;
  const parts: string[] = [];
  for (let y = q(cy - r); y <= q(cy + r); y += u) {
    const dy = y + u / 2 - cy;
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    if (half <= 0) continue;
    const term = q(half * k); // 종결선 x 오프셋
    const [x0, x1] = p < 0.5 ? [q(-half), term] : [term, q(half)];
    if (x1 <= x0) continue;
    parts.push(`M${cx + x0} ${y} H${cx + x1} V${y + u} H${cx + x0} Z`);
  }
  return parts.join(" ");
}
