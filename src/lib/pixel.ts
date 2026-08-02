// 픽셀 아트 스프라이트 — 텍스트로 저작하고 캔버스로 렌더하는 최소 포맷.
//
// 왜 이 형식인가: 이 저장소의 아트는 전부 "사람이 읽고 고칠 수 있는 텍스트"여야 한다
// (바이너리/GUI 저작 도구는 이 프로젝트에서 유지보수가 불가능하다). 그래서 스프라이트를
// **팔레트 + 행 문자열**로 적는다. 한 글자가 한 픽셀이고, 공백/'.' 은 투명이다.
//
//   const CAT = { w: 8, h: 8, pal: { a: "#ffcf9a", b: "#c47c3c" }, rows: [
//     "..aaaa..",
//     ".aabbaa.",
//     ...
//   ]}
//
// 렌더는 순수 계산(여기)과 캔버스 그리기(pixelcanvas.ts)를 분리해 테스트 가능하게 둔다.
// ⚠ 랜덤 금지 — 흔들림/반짝임은 프레임 인덱스와 결정적 해시로만 만든다(양 클라 동일).

/** 팔레트: 한 글자 → 색(#rrggbb). 공백과 '.' 은 항상 투명(예약). */
export type Palette = Record<string, string>;

export type Sprite = {
  w: number;
  h: number;
  pal: Palette;
  rows: string[];
};

export const TRANSPARENT = new Set([" ", "."]);

/** 스프라이트 정합성 — 행 수/행 길이/미정의 글자를 잡는다(아트 오타 방지). */
export function validateSprite(s: Sprite, name = "sprite"): string[] {
  const errs: string[] = [];
  if (s.rows.length !== s.h) errs.push(`${name}: 행 수 ${s.rows.length} ≠ h ${s.h}`);
  s.rows.forEach((r, y) => {
    if (r.length !== s.w) errs.push(`${name}: ${y}행 길이 ${r.length} ≠ w ${s.w}`);
    for (const ch of r) if (!TRANSPARENT.has(ch) && !s.pal[ch]) errs.push(`${name}: ${y}행 미정의 색 '${ch}'`);
  });
  return errs;
}

/** (x,y) 픽셀 색 — 투명이면 null. 렌더러와 테스트가 공유하는 단일 정의. */
export function pixelAt(s: Sprite, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return null;
  const ch = s.rows[y][x];
  if (TRANSPARENT.has(ch)) return null;
  return s.pal[ch] ?? null;
}

/** 좌우 반전 스프라이트(걸을 때 방향 전환) — rows 를 뒤집는다. */
export function flipX(s: Sprite): Sprite {
  return { ...s, rows: s.rows.map((r) => [...r].reverse().join("")) };
}

/* ── 팔레트 스왑 ────────────────────────────────────────────────
 * 픽셀 아트의 고전 기법: 같은 스프라이트에 팔레트만 갈아끼워 시간대/기분을 표현한다.
 * 스프라이트를 다시 그리지 않고 60여 종을 한 번에 재조명할 수 있다. */

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** #rrggbb → [r,g,b]. 잘못된 값은 검정으로(렌더가 죽지 않게). */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((n) => clamp255(n).toString(16).padStart(2, "0")).join("");
}

/** 색을 조명색 쪽으로 t 만큼 물들이고 밝기를 mul 배 — 시간대 조명의 단일 정의. */
export function tintColor(hex: string, lightHex: string, t: number, mul: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [lr, lg, lb] = hexToRgb(lightHex);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(
    (r * (1 - k) + lr * k) * mul,
    (g * (1 - k) + lg * k) * mul,
    (b * (1 - k) + lb * k) * mul,
  );
}

/** 팔레트 전체에 조명 적용 — 스프라이트는 그대로, 색만 갈아끼운다. */
export function tintPalette(pal: Palette, lightHex: string, t: number, mul: number): Palette {
  const out: Palette = {};
  for (const k of Object.keys(pal)) out[k] = tintColor(pal[k], lightHex, t, mul);
  return out;
}

/* ── 결정적 흔들림 ─────────────────────────────────────────────
 * 파티클/반짝임에 Math.random 을 쓰지 않는다(양 클라가 다른 화면을 보게 됨).
 * 인덱스+시드 해시로 0~1 을 뽑는다. */
export function hash01(i: number, seed = 1): number {
  let h = (i * 374761393 + seed * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 프레임 순환 인덱스 — now(ms)와 프레임당 지속시간으로 결정. */
export const frameAt = (now: number, frames: number, msPerFrame: number): number =>
  frames <= 1 ? 0 : Math.floor(now / Math.max(1, msPerFrame)) % frames;
