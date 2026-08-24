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
  /* ── 색상 이동(hue shifting) — 2026-08-07, 사용자 결정 "A안"(채도 높고 대비 강한 쪽)
   *
   * 여기까지의 램프는 **색상(H)을 그대로 두고 밝기만** 바꿨다(실측 전체 편차 7.5도).
   * 그래서 음영이 입체가 아니라 밝기 슬라이더처럼 보였다. 현대 픽셀 아트의 1번 기법은
   * 그림자를 차갑게(청보라), 하이라이트를 따뜻하게(노랑) 굴리는 것이다.
   *
   * ⚠ 회전량을 일괄로 주면 **원래 차가운 색이 오히려 흐려진다.** 1차 시안에서 여우는
   *   확 살았는데 늑대가 희멀게졌다 — 이미 파란 몸을 더 파랗게 밀면 보라로 떠서
   *   대비가 죽는다. 그래서 그림자 회전은 **원색이 얼마나 따뜻한지에 비례**해서만 준다.
   * ⚠ 명도 순서(H>b>B>d>D>o)는 건드리지 않는다. 뒤집히면 도트가 통째로 깨지고,
   *   수박 줄무늬를 막는 톤 단조성 테스트도 함께 무너진다. */
  const turn = (hex: string, target: number, deg: number, satMul: number, lMul = 1): string => {
    const [h, sat] = hueSat(hex);
    if (sat === 0) return lMul === 1 ? hex : shade(hex, lMul);
    // 원색이 이미 차가우면 적게 돈다(늑대가 희멀게지던 이유)
    const away = Math.abs((((h - COOL_HUE + 540) % 360) - 180));
    const warmth = Math.min(1, away / 140);
    const amount = target === COOL_HUE ? deg * warmth : deg;
    return shade(withHue(hex, rotateHue(h, target, amount)), lMul, satMul);
  };
  return {
    H: turn(H, WARM_HUE, 22, 0.9),
    b: turn(b, WARM_HUE, 12, 0.94),
    B: base, // 중간 톤은 그대로 — 여기가 흔들리면 캐릭터 색 자체가 바뀐다
    d: turn(dark, COOL_HUE, 34, 1.06),
    D: turn(shade(dark, 0.74, 1.12), COOL_HUE, 52, 1.06, 0.96),
    o: turn(shade(dark, 0.5, 1.25), COOL_HUE, 66, 1.06, 0.94),
  };
}

/** 빛이 닿는 쪽이 향하는 색상(노랑). */
const WARM_HUE = 48;
/** 그늘이 향하는 색상(청보라). */
const COOL_HUE = 265;

/** hex → [색상(도), 채도] */
function hueSat(hex: string): [number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d === 0) return [0, 0];
  const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, sat];
}

/** 짧은 호를 따라 target 쪽으로 deg 만큼(넘어가지 않게) 돌린다. */
function rotateHue(h: number, target: number, deg: number): number {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), deg);
}

/** 채도·명도는 유지하고 색상만 갈아 끼운다. */
function withHue(hex: string, hue: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d === 0) return hex;
  const sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hh = (((hue % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const p = 2 * l - q;
  const f = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return rgbToHex(f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255);
}

/* ── 2:1 축소 ────────────────────────────────────────────────────
 * 큰 판(48×48)으로 그린 스프라이트를 작은 자리(탭 아이콘·배지)에 쓰기 위한 유일한 안전한 방법.
 * 픽셀 아트는 1배율보다 작게 못 줄이므로, 48 짜리를 24 로 **다시 샘플링**한다.
 *
 * 2×2 블록에서 **가장 많이 나온 색**을 고른다(단순 평균이나 좌상단 픽킹은 외곽선이 끊긴다).
 * 동수면 좌상단 우선 — 결정적이어야 양쪽 클라가 같은 그림을 본다. */
export function downscale2(s: Sprite): Sprite {
  return downscaleBy(s, 2);
}

/** n:1 축소. 48→16 처럼 2의 거듭제곱이 아닌 배수도 **정수배면** 격자가 안 깨진다.
 *  (보글보글 무대는 48×48 펫을 16×16 으로 써야 해서 3배 축소가 필요했다.)
 *  n×n 블록의 최빈색을 고르는 규칙은 downscale2 와 같다 — 동수면 좌상단 우선. */
export function downscaleBy(s: Sprite, n: number): Sprite {
  if (n < 2) return s;
  const w = Math.floor(s.w / n);
  const h = Math.floor(s.h / n);
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const cells: string[] = [];
      for (let dy = 0; dy < n; dy++)
        for (let dx = 0; dx < n; dx++) {
          const c = s.rows[y * n + dy]?.[x * n + dx];
          cells.push(c === undefined ? "." : c);
        }
      const count = new Map<string, number>();
      for (const c of cells) count.set(c, (count.get(c) ?? 0) + 1);
      let best = cells[0];
      let bestN = 0;
      for (const c of cells) {
        const cnt = count.get(c) ?? 0;
        if (cnt > bestN) {
          bestN = cnt;
          best = c;
        }
      }
      row += best;
    }
    rows.push(row);
  }
  return { w, h, pal: s.pal, rows };
}

/** 잉크 둘레의 빈 여백을 잘라낸다.
 *
 * 몬스터 스프라이트는 32×32 판 **아래쪽 11px 에만** 그림이 있다(바닥에 세우려고 그렇게 그렸다).
 * 그 판째로 작은 무대에 쓰면 실제 몸집보다 세 배쯤 큰 자리를 차지해 충돌 판정이 엉킨다.
 * 잘라내면 스프라이트 크기 = 실제 몸집이 된다. 잉크가 없으면 원본을 그대로 돌려준다. */
export function trimSprite(s: Sprite): Sprite {
  let x0 = s.w;
  let x1 = -1;
  let y0 = s.h;
  let y1 = -1;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      if (!pixelAt(s, x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  if (x1 < 0) return s;
  return cropSprite(s, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
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

/* ── 장비 앵커 ────────────────────────────────────────────────
 * [사용자 리포트 2026-08-07 "직접 착용한 장비들이 너무 애매해.
 *  칼은 들고있지도 않고 모자도 쓰고있는게 아니고"]
 *
 * 1차판은 **잉크 바운딩박스 바깥**에 붙였다 — 모자는 박스 위, 무기는 박스 오른쪽.
 * 그래서 여우는 모자가 y=-4(스프라이트 밖, 귀보다 위)에 떠 있고 칼은 몸 끝에 1px 만 걸쳐
 * '옆에 세워둔 것'처럼 보였다. **착용은 겹쳐야 착용이다.**
 *
 * 고친 방식 — 박스가 아니라 **몸의 해부학적 지점**을 찾는다:
 *   · 정수리: 위에서 내려오며 잉크 폭이 최대폭의 45% 를 처음 넘는 행. 귀·뿔·꼬리 끝은
 *     폭이 좁아 걸러지고, 두개골이 시작되는 줄이 잡힌다.
 *   · 손: 몸 높이의 62% 지점(앞발 높이)에서의 **오른쪽 잉크 끝**.
 * 두 값 모두 어떤 폼(알·병아리·여우·올빼미…)에서도 손보정 없이 나온다.
 */
export type GearAnchors = {
  /** 모자 **밑동**이 앉을 자리(정수리). 모자는 여기서 위로 그린다. */
  head: { x: number; y: number };
  /** 무기 **손잡이**가 잡힐 자리(앞발 높이의 몸 바깥선). */
  hand: { x: number; y: number };
  /** 망토 **윗단** 중앙(어깨). */
  back: { x: number; y: number };
  /** 잉크가 아예 없으면 false — 호출부가 장비를 건너뛴다. */
  ok: boolean;
};

/** 행별 잉크 구간 [x0,x1] (없으면 null). */
function rowSpan(s: Sprite, y: number): [number, number] | null {
  let a = -1;
  let b = -1;
  for (let x = 0; x < s.w; x++) {
    if (!pixelAt(s, x, y)) continue;
    if (a < 0) a = x;
    b = x;
  }
  return a < 0 ? null : [a, b];
}

/** 행에서 **끊기지 않고 이어진** 잉크의 최대 길이.
 *  ⚠ 정수리를 span(양끝 거리)으로 재면 **귀 두 개의 바깥 거리**를 두개골 폭으로 착각한다
 *    — 여우·고양이·늑대 10종에서 모자가 귀 위 허공에 떴다(2026-08-07 실측 겹침 0칸).
 *    귀는 각각 3칸짜리 조각이고 두개골은 20칸 넘는 한 덩어리라, 연속 길이로 재면 갈린다. */
function rowRun(s: Sprite, y: number): number {
  let best = 0;
  let cur = 0;
  for (let x = 0; x < s.w; x++) {
    if (pixelAt(s, x, y)) cur += 1;
    else cur = 0;
    if (cur > best) best = cur;
  }
  return best;
}

export function gearAnchors(s: Sprite): GearAnchors {
  const spans: ([number, number] | null)[] = [];
  const runs: number[] = [];
  let maxRun = 0;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < s.h; y++) {
    const sp = rowSpan(s, y);
    spans.push(sp);
    runs.push(rowRun(s, y));
    if (!sp) continue;
    if (top < 0) top = y;
    bottom = y;
    maxRun = Math.max(maxRun, runs[y]);
  }
  if (top < 0) return { head: { x: 0, y: 0 }, hand: { x: 0, y: 0 }, back: { x: 0, y: 0 }, ok: false };

  // 정수리 — **연속 잉크**가 최대치의 45% 를 처음 넘는 행. 귀·뿔은 조각이라 안 걸린다.
  let crown = top;
  for (let y = top; y <= bottom; y++) {
    if (runs[y] >= maxRun * 0.45) {
      crown = y;
      break;
    }
  }
  const cs = spans[crown]!;
  // 모자는 정수리보다 **2px 아래**에 밑동을 둔다 — 살짝 눌러써야 얹힌 게 아니라 쓴 게 된다
  const head = { x: Math.round((cs[0] + cs[1]) / 2), y: crown + 2 };

  // 손 — 몸 높이 62% 지점(앞발 높이)의 오른쪽 끝. 그 행이 비면 위아래로 가장 가까운 행을 쓴다
  const handY = Math.min(bottom, Math.round(top + (bottom - top) * 0.62));
  let hs = spans[handY];
  for (let d = 1; !hs && d < s.h; d++) hs = spans[handY - d] ?? spans[handY + d] ?? null;
  const hand = { x: hs ? hs[1] - 2 : Math.round(s.w / 2), y: handY };

  const bs = spans[Math.round(top + (bottom - top) * 0.3)] ?? cs;
  const back = { x: Math.round((bs[0] + bs[1]) / 2), y: top + Math.round((bottom - top) * 0.32) };

  return { head, hand, back, ok: true };
}

/* ── 캔버스 렌더 공용부(2026-08-25 중복 통합) ───────────────────────────
 * 같은 셋업/블릿 루프가 무대 5곳(PixelPet/PetPixel/HuntStage/BubbleStage/PixelSprite)에
 * 복사돼 있었다. **배율을 고르는 정책**(컨테이너 폭 기준 floor+상한 / 요청 크기 기준 round)은
 * 화면마다 다른 게 맞아 호출부에 남기고, 기계적인 부분(dpr 클램프·크기·스무딩 off·블릿)만 모은다. */

/** 캔버스를 논리 w×h·정수배 scale 로 세팅하고 논리 1도트의 실제 픽셀 수(px)를 돌려준다.
 *  styleWidth=false 면 CSS 폭은 레이아웃(w-full 등)에 맡긴다(무대 캔버스들). */
export function setupPixelCanvas(
  c: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
  opts?: { styleWidth?: boolean },
): number {
  const dpr = Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
  c.width = w * scale * dpr;
  c.height = h * scale * dpr;
  if (opts?.styleWidth !== false) c.style.width = `${w * scale}px`;
  c.style.height = `${h * scale}px`;
  ctx.imageSmoothingEnabled = false;
  return scale * dpr;
}

/** 스프라이트를 (ox,oy) 논리 좌표에 px 배율로 찍는다.
 *  flip=좌우 반전(격자 무손실), wrapW=가로 순환 무대(가장자리에 걸치면 반대편에도). */
export function blitSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  ox: number,
  oy: number,
  px: number,
  opts?: { flip?: boolean; wrapW?: number },
): void {
  const wrap = opts?.wrapW;
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const col = pixelAt(s, x, y);
      if (!col) continue;
      ctx.fillStyle = col;
      let dx = opts?.flip ? ox + (s.w - 1 - x) : ox + x;
      if (wrap) dx = ((dx % wrap) + wrap) % wrap;
      ctx.fillRect(dx * px, (oy + y) * px, px, px);
    }
  }
}

/** 시계방향 90° 회전. **격자를 전혀 안 깬다** — 전치는 픽셀을 새 칸에 1:1 로 옮길 뿐이라
 *  보간이 없다. (금지된 건 임의 각도 rotate 다. 90° 는 손실이 0 이라 안전하다.)
 *  칼을 '치켜든 자세'에서 '휘두른 자세'로 바꾸는 데 쓴다 — 프레임을 따로 안 그려도 된다. */
export function rot90(s: Sprite): Sprite {
  const rows: string[] = [];
  for (let x = 0; x < s.w; x++) {
    let row = "";
    for (let y = s.h - 1; y >= 0; y--) row += s.rows[y][x] ?? ".";
    rows.push(row);
  }
  return { w: s.h, h: s.w, pal: s.pal, rows };
}
