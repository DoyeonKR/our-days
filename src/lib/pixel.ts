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

/* ── 톤 램프 ────────────────────────────────────────────────────
 * 아마추어 픽셀 아트와 프로의 가장 큰 차이는 **명암 단계 수**다. 3톤은 평평해 보이고,
 * 5톤(하이라이트/밝음/기본/그늘/깊은그늘)이면 형태가 살아난다.
 * PAL 은 3톤만 주므로 여기서 양끝을 만들어 5톤으로 넓힌다.
 *
 * 또 하나: **외곽선을 검정으로 두지 않는다**(초보 티의 주범). 바탕색을 어둡고
 * 채도를 살짝 올린 색으로 감싸면 '셀렉티브 아웃라인'이 되어 훨씬 고급스럽다. */

/** HSL 보정 — 밝기(l)와 채도(s)를 곱해 같은 색상의 다른 톤을 만든다. */
export function shade(hex: string, lMul: number, sMul = 1): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const nl = Math.max(0, Math.min(1, l * lMul));
  const ns = Math.max(0, Math.min(1, sat * sMul));
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  if (ns === 0) return rgbToHex(nl * 255, nl * 255, nl * 255);
  const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns;
  const pp = 2 * nl - q;
  return rgbToHex(hue2rgb(pp, q, h + 1 / 3) * 255, hue2rgb(pp, q, h) * 255, hue2rgb(pp, q, h - 1 / 3) * 255);
}

/** 3톤 PAL → 5톤 램프 + 셀렉티브 아웃라인.
 *  H(하이라이트) · b(밝음) · B(기본) · d(그늘) · D(깊은그늘) · o(외곽선) */
export type Ramp = { H: string; b: string; B: string; d: string; D: string; o: string };
export function ramp(tri: readonly string[]): Ramp {
  const [light, base, dark] = tri;
  const H = shade(light, 1.16, 0.75); // 하이라이트 — 밝고 채도 낮게(빛)
  // ⚠ 이미 최대 밝기인 색(판다의 #ffffff)은 **더 밝아질 수 없어** H 가 b 와 같은 색이 된다.
  //    그러면 5톤을 쓴다고 적어놓고 실제로는 4톤만 칠해져 몸이 평평해진다(2026-08-03 적대
  //    검증에서 판다가 실제 3색으로 확정됨). 이 경우 밝은 톤을 한 단 내려 계단을 되살린다.
  const b = H.toLowerCase() === light.toLowerCase() ? shade(light, 0.94) : light;
  return {
    H,
    b,
    B: base,
    d: dark,
    D: shade(dark, 0.74, 1.12), // 깊은 그늘 — 어둡고 채도 살짝 높게
    o: shade(dark, 0.5, 1.25), // 외곽선 — 검정이 아니라 '그 색의 어두운 판'
  };
}

/* ── 2:1 축소 ────────────────────────────────────────────────────
 * 큰 판(48×48)으로 그린 스프라이트를 작은 자리(탭 아이콘·배지)에 쓰기 위한 유일한 안전한 방법.
 * 픽셀 아트는 1배율보다 작게 못 줄이므로, 48 짜리를 24 로 **다시 샘플링**한다.
 *
 * 2×2 블록에서 **가장 많이 나온 색**을 고른다(단순 평균이나 좌상단 픽킹은 외곽선이 끊긴다).
 * 동수면 좌상단 우선 — 결정적이어야 양쪽 클라가 같은 그림을 본다. */
export function downscale2(s: Sprite): Sprite {
  const w = Math.floor(s.w / 2);
  const h = Math.floor(s.h / 2);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const cells = [
        s.rows[y * 2]?.[x * 2],
        s.rows[y * 2]?.[x * 2 + 1],
        s.rows[y * 2 + 1]?.[x * 2],
        s.rows[y * 2 + 1]?.[x * 2 + 1],
      ].map((c) => (c === undefined ? "." : c));
      const count = new Map<string, number>();
      for (const c of cells) count.set(c, (count.get(c) ?? 0) + 1);
      let best = cells[0];
      let bestN = 0;
      for (const c of cells) {
        const n = count.get(c) ?? 0;
        if (n > bestN) {
          bestN = n;
          best = c;
        }
      }
      row += best;
    }
    rows.push(row);
  }
  return { w, h, pal: s.pal, rows };
}

/** 잘라내기 — 큰 판에서 얼굴만 떼어 작은 자리에 쓸 때. 범위 밖은 투명. */
export function cropSprite(s: Sprite, x0: number, y0: number, w: number, h: number): Sprite {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = "";
    for (let x = 0; x < w; x++) r += s.rows[y0 + y]?.[x0 + x] ?? ".";
    rows.push(r);
  }
  return { w, h, pal: s.pal, rows };
}
