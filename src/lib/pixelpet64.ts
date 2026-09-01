// 64×64 신수 스프라이트 — 사신(6) · 천수(7) · 황룡(8) 전용 고해상도 판.
// [사용자 요청 2026-09-01 "멋있고 화려하게 하지만 해상도는 높게"]
//
// **왜 64인가 (96이 아니라).** 섬 무대는 논리 192폭에 지면선 y=84 다. 48판 펫은 y37~84 를
// 쓰고, 64판은 y21~84 를 쓴다 — 하늘이 21행 남는다. 96판은 y-11 이라 **화면을 뚫는다**.
// 64 는 무대에 들어가는 최대 해상도이고 픽셀 수는 48판의 **1.78배**다.
// 덤: 신수가 일반 펫보다 실제로 커 보인다(계보상 맞는 그림이다).
//
// **왜 새 파일인가.** pixelpet48 에는 12형 + 신화 5형이 걸려 있고 GAIT·얼굴창·gearAnchors 가
// 48 기준으로 잠겨 있다. 렌더러(PixelPet·HuntStage)는 이미 sprite.w/h 로만 동작하므로
// 파일만 나누면 기존 17형을 건드리지 않는다.
//
// ⚠ **손으로 행을 적어 대칭을 맞추려다 실패했다(1차판).** 반폭만 적고 sym() 으로 거울을
//   붙였더니 런이 중심(x31)까지 안 닿아 **생물이 둘로 갈라져 보였다** — PNG 로 굽고 나서야
//   알았다. 지금은 행을 손으로 적지 않는다: `sweep()` 이 **행별 반폭**에서 실루엣을 만들어
//   중심이 구조적으로 맞고, `hilite()`·`edgeShade()` 가 광원(좌상단)을 자동으로 넣는다.
//   눈·부리·무늬처럼 **의도가 필요한 것만** sym() 패치로 얹는다.
//
// 글자: o 외곽선 · H 하이라이트 · b 밝음 · B 기본 · d 그늘 · D 깊은그늘
//       c 배/가슴 · C 배 그늘 · i 안쪽(귀/입) · e 눈동자 · L 눈 광택 · w 흰자
//       p 볼 · n 코 · m 입 · y 발바닥 · A 마킹 · a 마킹그늘 · q 부리/뿔 · Q 부리그늘
//       h 뿔 밝음 · f 갈기·깃 밝음 · F 갈기·깃 그늘 · S 비늘 광택 · G 후광 · s 반짝임

import { type Palette, type Sprite, ramp } from "./pixel.ts";

const W = 64;
const H = 64;
const CX = 32; // 중심 x. 대칭은 전부 여기를 기준으로 만든다.

/** 64칸 행 — [시작x, 문자들] 런으로만(점 세기 사고 방지). 범위를 넘으면 즉시 throw. */
function row(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(W).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= W) throw new Error(`row64: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
}

/** 좌우 대칭 행 — 왼쪽에 적은 런이 중심(CX) 기준 반대쪽에도 찍힌다.
 *  얼굴 부품(눈·볼·귀)처럼 **좌표가 의도인** 것에만 쓴다. 덩어리는 sweep() 이 만든다. */
function sym(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(W).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= W) throw new Error(`sym64: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
      a[W - 1 - x] = s[i];
    }
  }
  return a.join("");
}

type Patch = readonly (readonly [number, string])[];

function paint(base: readonly string[], patches: Patch): string[] {
  const out = [...base];
  for (const [y, s] of patches) {
    if (s.length !== W) throw new Error(`paint64: ${y}행 길이 ${s.length} (64 이어야)`);
    if (y < 0 || y >= out.length) throw new Error(`paint64: y=${y} 범위 밖`);
    const r = out[y].split("");
    for (let x = 0; x < W; x++) if (s[x] !== ".") r[x] = s[x];
    out[y] = r.join("");
  }
  return out;
}

const EMPTY = row();
const blank = (): string[] => Array.from({ length: H }, () => EMPTY);

/** 행별 **반폭**으로 만드는 대칭 덩어리. 가장자리 1칸은 외곽선.
 *  half(t) 의 t 는 0(위)~1(아래). 반폭이 1 미만이면 그 행은 건너뛴다. */
function sweep(y0: number, y1: number, half: (t: number) => number, fill: string): Patch {
  const out: (readonly [number, string])[] = [];
  const n = Math.max(1, y1 - y0);
  for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= H) continue;
    const hw = Math.round(half((y - y0) / n));
    if (hw < 1) continue;
    const w = hw * 2;
    const inner = Math.max(0, w - 2);
    out.push([y, row([CX - hw, `o${fill.repeat(inner)}o`])]);
  }
  return out;
}

/** 타원 반폭 — sweep 에 넣는 가장 흔한 모양(머리·몸통). */
const ell = (rx: number) => (t: number) => rx * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
/** 위가 넓고 아래로 좁아지는 몸통. */
const taper = (top: number, bottom: number) => (t: number) => top + (bottom - top) * t;

/** 좌상단 하이라이트 — 광원 규약을 손으로 칠하지 않고 넣는다. from 톤만 to 로 올린다. */
function hilite(rows: string[], cx: number, cy: number, r: number, from = "B", to = "H"): string[] {
  return rows.map((line, y) => {
    if (Math.abs(y - cy) > r) return line;
    const a = line.split("");
    for (let x = 0; x < W; x++) {
      if (a[x] !== from) continue;
      const dx = (x - cx) / r, dy = (y - cy) / r;
      if (dx * dx + dy * dy <= 1) a[x] = to;
    }
    return a.join("");
  });
}

const DARKER: Readonly<Record<string, string>> = { H: "b", b: "B", B: "d", c: "C", f: "F", A: "a" };
const LIGHTER: Readonly<Record<string, string>> = { d: "B", B: "b", b: "H", C: "c", F: "f", a: "A" };

/** 가장자리 음영 — **실루엣을 따라** 오른쪽 안쪽을 어둡게, 왼쪽 안쪽을 밝게.
 *
 *  ⚠ 1차판은 'x가 36 이상이면 한 단 어둡게'였다. 그러면 몸 한가운데에 **세로 이음매**가
 *    생겨 생물이 두 색으로 쪼개져 보인다(PNG 로 굽고 나서야 보였다). 경계는 화면 좌표가
 *    아니라 **그 행의 잉크 폭**을 따라가야 둥글게 읽힌다.
 *  ⚠ 눈(e/w/L)·후광(G)·반짝임(s)·외곽선(o)은 건드리지 않는다 — 양쪽 눈 밝기가 다르면
 *    사시로 보이고, 후광이 어두워지면 후광이 아니다. */
function edgeShade(rows: readonly string[]): string[] {
  const KEEP = new Set(["o", "e", "w", "L", "G", "s", "S", ".", "n", "m"]);
  return rows.map((r) => {
    const a = r.split("");
    let lo = -1, hi = -1;
    for (let x = 0; x < W; x++) if (a[x] !== ".") { if (lo < 0) lo = x; hi = x; }
    if (lo < 0 || hi - lo < 6) return a.join("");
    for (let k = 1; k <= 3; k++) {
      const x = hi - k;
      if (x > lo && !KEEP.has(a[x])) { const to = DARKER[a[x]]; if (to) a[x] = to; }
    }
    for (let k = 1; k <= 2; k++) {
      const x = lo + k;
      if (x < hi && !KEEP.has(a[x])) { const to = LIGHTER[a[x]]; if (to) a[x] = to; }
    }
    return a.join("");
  });
}

export type DivinePal = {
  body: readonly string[];
  belly: readonly string[];
  inner: readonly string[];
  /** 갈기·깃털. 없으면 body. */
  mane?: readonly string[];
  eye?: string;
  mark?: readonly string[];
  horn?: readonly string[];
  glow?: string;
};

export function divinePalette(sp: DivinePal): Palette {
  const B = ramp(sp.body);
  const C = ramp(sp.belly);
  const M = ramp(sp.mark ?? sp.body);
  const N = ramp(sp.mane ?? sp.body);
  const Hn = ramp(sp.horn ?? ["#fff0cf", "#e6cf9a", "#b99f66"]);
  return {
    o: B.o, H: B.H, b: B.b, B: B.B, d: B.d, D: B.D,
    c: C.b, C: C.d,
    i: sp.inner[1],
    e: sp.eye ?? "#241c3a",
    w: "#fffdf7",
    L: "#ffffff",
    p: "#ff9fb8",
    n: B.D, m: B.o, y: C.d,
    A: M.B, a: M.D,
    q: Hn.B, Q: Hn.d, h: Hn.H,
    S: "#ffffff",
    f: N.b, F: N.d,
    G: sp.glow ?? "#ffe9a8",
    s: "#fff8c9",
  };
}

/* ── 다리 6프레임 ───────────────────────────────────────────────
 * 몸통은 반드시 57행에서 끝난다 — 58행이 비면 몸과 다리 사이가 떠 보인다. */
const GAIT: readonly (readonly [number, number, boolean, boolean])[] = [
  [21, 33, false, false],
  [20, 34, false, true],
  [19, 35, false, true],
  [20, 34, true, false],
  [19, 35, true, false],
  [20, 34, false, false],
];
export const GAIT_FRAMES_64 = GAIT.length;

/** 들린 발은 발끝 행(63)을 빼서 1px 짧다 — '발을 뗐다'가 읽히는 가장 싼 방법. */
function feet(phase: number, fur: string, pad: string): Patch {
  const [L, R, lUp, rUp] = GAIT[((phase % GAIT.length) + GAIT.length) % GAIT.length];
  const leg = `o${fur.repeat(8)}o`;
  const sole = `o${pad.repeat(3)}o${pad.repeat(3)}oo`;
  const gap = [L + 10, "o".repeat(Math.max(0, R - L - 10))] as const;
  const toes: (readonly [number, string])[] = [];
  if (!lUp) toes.push([L + 1, "oooooooo"] as const);
  if (!rUp) toes.push([R + 1, "oooooooo"] as const);
  return [
    [58, row([L, leg], gap, [R, leg])],
    [59, row([L, leg], [R, leg])],
    [60, row([L, leg], [R, leg])],
    [61, row([L, leg], [R, leg])],
    [62, row([L, sole], [R, sole])],
    [63, row(...toes)],
  ];
}

/** 큰 눈 한 쌍 + 광택 — 캐릭터 인상의 대부분은 눈에서 온다(48판 주석과 같은 이유).
 *  64판은 눈에 8×7 을 쓸 수 있다. 1차판은 5×6 이라 4배 확대해도 '점 두 개'로 보였다.
 *  eyeY = 눈 윗행, ex = 눈 **바깥쪽** x(안쪽은 중심에서 멀어야 미간이 생긴다). */
function eyes(eyeY: number, ex = 18): Patch {
  /* ⚠ 1차판은 흰자(w)와 홍채(e)만 있고 **동공이 없었다** — 4배로 확대해도 '빈 흰 네모'로
     보였다. 눈은 흰자·홍채·**동공**·광택 넷이 다 있어야 눈으로 읽힌다.
     동공은 m(외곽선과 같은 가장 어두운 톤)을 쓴다 — 종이 밝든 어둡든 항상 대비가 선다. */
  return [
    [eyeY + 0, sym([ex + 1, "oooooo"])],
    [eyeY + 1, sym([ex, "owLLwwwo"])],
    [eyeY + 2, sym([ex, "owLLeeeo"])],
    [eyeY + 3, sym([ex, "oweemmmo"])],
    [eyeY + 4, sym([ex, "oweemmmo"])],
    [eyeY + 5, sym([ex, "oweeeeeo"])],
    [eyeY + 6, sym([ex + 1, "owwwwo"])],
    [eyeY + 7, sym([ex + 1, "oooooo"])],
  ];
}

/* ── 사신·천수·황룡 골격 ───────────────────────────────────────
 * 넷 다 sweep() 으로 실루엣을 만들고 그 위에 종의 표식을 얹는다.
 * **종은 실루엣이다** — 색만 바꾼 같은 몸은 이 저장소에서 이미 퇴짜를 맞았다. */

/** 청룡·황룡 — 가지뿔 · 긴 수염 · 갈기 · 비늘 배. 동아시아 용은 날개가 없다. */
function dragonBody(): string[] {
  let r = blank();
  // 목이 길다 — 용의 실루엣은 세로로 흐른다
  r = paint(r, sweep(36, 57, taper(10, 8), "B"));
  r = paint(r, sweep(12, 40, ell(15), "B"));
  r = hilite(r, 24, 20, 13);
  // 가지뿔 한 쌍
  r = paint(r, [
    [1, sym([22, "oo"], [27, "oo"])],
    [2, sym([21, "ohho"], [26, "ohho"])],
    [3, sym([21, "ohho"], [26, "ohho"])],
    [4, sym([22, "ohhho"])],
    [5, sym([23, "ohho"])],
    [6, sym([24, "ohho"])],
    [7, sym([24, "oqqo"])],
    [8, sym([25, "oqqo"])],
    [9, sym([25, "oQQo"])],
    [10, sym([26, "oQQo"])],
    [11, sym([26, "oQQo"])],
    [12, sym([27, "oQo"])],
  ]);
  // 갈기 — 머리 둘레 바깥으로 솟는 깃
  r = paint(r, [
    [14, sym([11, "off"])],
    [16, sym([9, "offo"])],
    [18, sym([8, "offo"])],
    [20, sym([7, "offo"])],
    [22, sym([7, "offo"])],
    [24, sym([8, "offo"])],
    [26, sym([9, "offo"])],
    [28, sym([10, "off"])],
  ]);
  // 얼굴
  r = paint(r, eyes(22));
  r = paint(r, [
    [31, sym([27, "onno"])],
    [32, sym([26, "onnno"])],
    [33, sym([27, "ommo"])],
    [34, sym([28, "omo"])],
  ]);
  // 긴 수염 — 용을 용으로 만드는 소품. 좌우로 흘러 나간다
  r = paint(r, [
    [33, sym([4, "oo"])],
    [34, sym([3, "off"], [10, "ff"])],
    [35, sym([2, "off"], [8, "fff"], [13, "ff"])],
    [36, sym([3, "of"], [7, "ff"])],
  ]);
  // 비늘 배 — 행마다 반폭이 1칸 오르내려 비늘 결이 생긴다(평평한 배는 뱀이 아니라 인형이다)
  const belly: (readonly [number, string])[] = [];
  for (let y = 41; y <= 55; y++) {
    const hw = y % 2 === 0 ? 6 : 5;
    belly.push([y, row([CX - hw, "c".repeat(hw * 2)])]);
  }
  r = paint(r, belly);
  // 비늘 광택 — 세 행마다 한 쌍
  const shine: (readonly [number, string])[] = [];
  for (let y = 42; y <= 54; y += 3) shine.push([y, sym([CX - 4, "S"])]);
  r = paint(r, shine);
  return r;
}

/** 주작·봉황 — 볏 · 부리 · 넓은 깃 몸통 · 아래로 늘어지는 꽁지깃. */
function birdBody(): string[] {
  let r = blank();
  // 깃 몸통이 넓다 — 용(세로)과 정면으로 갈리는 실루엣
  r = paint(r, sweep(28, 57, taper(13, 22), "f"));
  r = paint(r, sweep(8, 32, ell(14), "B"));
  r = hilite(r, 24, 16, 11);
  // 볏 — 세 갈래
  r = paint(r, [
    [1, sym([30, "oo"])],
    [2, sym([29, "offo"])],
    [3, sym([25, "oo"], [29, "offo"])],
    [4, sym([24, "offo"], [29, "offo"])],
    [5, sym([21, "oo"], [24, "offo"], [29, "offo"])],
    [6, sym([20, "offo"], [24, "offo"], [29, "off"])],
    [7, sym([20, "offo"], [24, "offfo"])],
    [8, sym([21, "offffffo"])],
  ]);
  r = paint(r, eyes(16));
  // 부리
  r = paint(r, [
    [24, sym([28, "oqqo"])],
    [25, sym([27, "oqqqo"])],
    [26, sym([28, "oQQo"])],
    [27, sym([29, "oQo"])],
  ]);
  // 가슴 — 밝은 배
  r = paint(r, sweep(34, 52, ell(11), "c"));
  // 꽁지깃 — 몸 아래로 길게. 봉황은 여기가 더 길다(MANE_PATCH 로 연장)
  r = paint(r, [
    [50, sym([26, "oFFo"])],
    [51, sym([25, "oFffFo"])],
    [52, sym([25, "oFffFo"])],
    [53, sym([26, "oFfFo"])],
    [54, sym([26, "oFfFo"])],
    [55, sym([27, "oFFo"])],
  ]);
  // 접은 날개 — 몸 양옆의 깃 결
  for (let y = 36; y <= 50; y += 3) r = paint(r, [[y, sym([13, "oFFo"])]]);
  return r;
}

/** 현무 — 등껍질이 실루엣의 주인공. 머리는 낮고 뱀꼬리가 옆으로 솟는다. */
function turtleBody(): string[] {
  let r = blank();
  // 등껍질 — 아주 넓다(폭 44). 이게 현무의 정체다
  r = paint(r, sweep(30, 54, ell(23), "A"));
  // 머리는 껍질 위로 조금만
  r = paint(r, sweep(4, 32, ell(14), "B"));
  r = hilite(r, 25, 15, 11);
  r = paint(r, eyes(13, 20));
  r = paint(r, [
    [25, sym([28, "onno"])],
    [26, sym([27, "ommmo"])],
  ]);
  // 껍질 무늬 — 육각 결. 가로줄 + 세로 이음
  for (let y = 34; y <= 50; y += 5) r = paint(r, [[y, row([12, "a".repeat(40)])]]);
  r = paint(r, [
    [33, sym([20, "a"], [26, "a"])],
    [38, sym([17, "a"], [24, "a"])],
    [43, sym([20, "a"], [26, "a"])],
  ]);
  // 껍질 광택
  r = paint(r, [[29, sym([18, "SS"])], [34, sym([15, "S"])]]);
  // 배딱지
  r = paint(r, sweep(52, 57, taper(12, 9), "c"));
  // 뱀꼬리 — 오른쪽으로 솟는다(비대칭이 이 종의 특징이라 sym 을 안 쓴다)
  r = paint(r, [
    [22, row([52, "ooo"])],
    [23, row([51, "oBBo"])],
    [24, row([51, "oBBo"])],
    [25, row([52, "oBBo"])],
    [26, row([53, "oBo"])],
  ]);
  return r;
}

/** 백호·해태 — 삼각귀 · 넓은 볼 · 줄무늬. 해태는 뿔·갈기를 얹어 갈린다(같은 종의 문법). */
function felineBody(): string[] {
  let r = blank();
  r = paint(r, sweep(36, 57, taper(13, 9), "B"));
  r = paint(r, sweep(6, 40, ell(21), "B"));
  r = hilite(r, 23, 18, 14);
  // 삼각귀
  r = paint(r, [
    [2, sym([16, "oo"])],
    [3, sym([15, "oio"])],
    [4, sym([14, "oiio"])],
    [5, sym([14, "oiiio"])],
    [6, sym([13, "oiiiio"])],
    [7, sym([13, "oBiiiio"])],
    [8, sym([13, "oBBiiio"])],
    [9, sym([14, "oBBio"])],
  ]);
  r = paint(r, eyes(20));
  // 주둥이 + 코
  r = paint(r, sweep(28, 36, ell(9), "c"));
  r = paint(r, [
    [29, sym([29, "onno"])],
    [30, sym([28, "onnno"])],
    [31, sym([29, "ommo"])],
    [32, sym([27, "om"], [31, "mo"])],
  ]);
  // 줄무늬 — 이마와 볼, 그리고 몸통
  r = paint(r, [
    [13, sym([20, "AA"], [25, "AA"])],
    [15, sym([19, "AA"], [24, "AA"])],
    [17, sym([18, "AA"])],
    [42, sym([16, "AAA"])],
    [45, sym([15, "AAA"])],
    [48, sym([16, "AAA"])],
    [51, sym([17, "AA"])],
  ]);
  // 가슴
  r = paint(r, sweep(40, 55, ell(8), "c"));
  return r;
}

export type DivineKind = "dragon" | "bird" | "turtle" | "feline";

function checked(name: string, body: string[]): string[] {
  if (body.length !== H) throw new Error(`${name}: ${body.length}행 (64 이어야)`);
  for (const [i, line] of body.entries()) {
    if (line.length !== W) throw new Error(`${name}: ${i}행 길이 ${line.length}`);
  }
  return body;
}

const BODIES: Record<DivineKind, string[]> = {
  dragon: checked("DRAGON", dragonBody()),
  bird: checked("BIRD", birdBody()),
  turtle: checked("TURTLE", turtleBody()),
  feline: checked("FELINE", felineBody()),
};

/** 종별 다리 색 — 배(c)로 딛는 종과 부리색 발(q)을 쓰는 새가 다르다. */
const LEGPAL: Record<DivineKind, readonly [string, string]> = {
  dragon: ["B", "c"],
  bird: ["f", "q"],
  turtle: ["B", "c"],
  feline: ["B", "c"],
};

/** 뿔 한 쌍 — 골격을 공유하는 종을 가르는 소품(해태). */
export const HORN_PATCH: Patch = [
  [0, sym([25, "oo"])],
  [1, sym([24, "ohho"])],
  [2, sym([24, "ohho"])],
  [3, sym([25, "ohho"])],
  [4, sym([25, "oqqo"])],
  [5, sym([26, "oqqo"])],
  [6, sym([26, "oqqo"])],
  [7, sym([27, "oqo"])],
];

/** 갈기·긴 꽁지 — 봉황·해태를 그 아래 종과 가른다. */
export const MANE_PATCH: Patch = [
  [30, sym([6, "off"])],
  [33, sym([5, "offo"])],
  [36, sym([5, "offo"])],
  [39, sym([6, "offo"])],
  [42, sym([7, "offo"])],
  [56, sym([27, "oFFo"])],
  [57, sym([28, "oFo"])],
];

/* ── 등급 오버레이 — 층마다 다른 축 ─────────────────────────────
 * ⚠ 프레임마다 **변하는** 것은 얼굴 창 밖(x<8 · x>55)에만 찍는다. 창 안에서 흔들리면
 *   얼굴 아이콘이 떨리고 gearAnchors 가 프레임마다 다시 계산돼 모자·무기가 튄다.
 *   **정적인** 오버레이(후광)는 창 안이어도 규약 위반이 아니다(48판 crowned 와 같다). */

/** stage 6 사신 — 방위색 오라가 좌우 여백에서 번갈아 반짝인다. */
export function divineGlow(frames: Sprite[]): Sprite[] {
  const A: Patch = [[10, row([2, "G"], [61, "G"])], [30, row([0, "G"])], [46, row([63, "G"])]];
  const B: Patch = [[18, row([1, "G"], [62, "G"])], [38, row([63, "G"])], [52, row([0, "G"])]];
  return frames.map((f, i) => ({ ...f, rows: paint(f.rows, i % 2 === 0 ? A : B) }));
}

/** stage 7 천수 — 머리 뒤 **정적** 후광 링(프레임마다 같다) + 여백 반짝임. */
export function celestialHalo(frames: Sprite[]): Sprite[] {
  const RING: Patch = [
    [3, sym([27, "GG"])],
    [4, sym([23, "GG"], [30, "GG"])],
    [6, sym([20, "GG"])],
    [9, sym([17, "G"])],
    [13, sym([15, "G"])],
    [17, sym([14, "G"])],
    [21, sym([14, "G"])],
    [25, sym([15, "G"])],
    [29, sym([17, "G"])],
  ];
  const A: Patch = [[34, row([2, "s"], [61, "s"])]];
  const B: Patch = [[40, row([1, "s"], [62, "s"])]];
  return frames.map((f, i) => ({
    ...f,
    rows: paint(f.rows, [...RING, ...(i % 2 === 0 ? A : B)]),
  }));
}

/** stage 8 황룡 — 발밑 구름대 + 금빛 반짝임. 실루엣을 안 키우고 바닥에서 존재감을 낸다. */
export function apexAura(frames: Sprite[]): Sprite[] {
  const CLOUD: Patch = [
    [60, row([4, "oGGo"], [11, "oGGGo"], [47, "oGGGo"], [56, "oGGo"])],
    [61, row([2, "oGGGGo"], [9, "oGGGGGo"], [45, "oGGGGGo"], [54, "oGGGGo"])],
    [62, row([3, "oGGGo"], [10, "oGGGo"], [46, "oGGGo"], [55, "oGGGo"])],
  ];
  const A: Patch = [[8, row([3, "s"], [60, "s"])], [28, row([0, "s"])]];
  const B: Patch = [[14, row([1, "s"], [62, "s"])], [44, row([63, "s"])]];
  return frames.map((f, i) => ({
    ...f,
    rows: paint(f.rows, [...CLOUD, ...(i % 2 === 0 ? A : B)]),
  }));
}

/** 신수 스프라이트 6프레임. extra 는 종을 가르는 소품(뿔·갈기)이다. */
export function divineSprite(sp: DivinePal, kind: DivineKind, extra: Patch = []): Sprite[] {
  const pal = divinePalette(sp);
  const [fur, pad] = LEGPAL[kind];
  const base = paint(BODIES[kind], extra);
  return Array.from({ length: GAIT_FRAMES_64 }, (_, i) => ({
    w: W,
    h: H,
    pal,
    // ⚠ 다리를 먼저 얹고 **그다음** 오른쪽 음영 — 뒤집으면 다리만 납작해진다.
    rows: edgeShade(paint(base, feet(i, fur, pad))),
  }));
}

/** 수면 — 웅크린 자세.
 *  ⚠ 도트를 **회전시키지 않는다**(격자가 깨진다). 서 있는 몸을 돌리는 게 아니라
 *    머리만 떼어 아래로 눌러 앉힌 전용 포즈다(48판 sleepSprite48 과 같은 방식). */
export function divineSleep(sp: DivinePal, kind: DivineKind): Sprite {
  const pal = divinePalette(sp);
  const head = BODIES[kind].slice(0, 40); // 종의 정체는 머리에 있다 — 자도 자기 종이다
  let rows = blank();
  for (let y = 0; y < 40; y++) rows[y + 12] = head[y];
  // 눌러 앉은 몸 — 넓고 낮은 덩어리
  rows = paint(rows, sweep(48, 57, ell(20), "c"));
  // 감은 눈 — 뜬 눈을 덮는다
  rows = paint(rows, [
    [34, sym([15, "ooooo"])],
    [35, sym([15, "ommmo"])],
    [36, sym([15, "ooooo"])],
  ]);
  const ZZZ: Patch = [
    [14, row([52, "sss"])],
    [16, row([54, "s"])],
    [18, row([50, "ss"])],
  ];
  return { w: W, h: H, pal, rows: paint(edgeShade(rows), ZZZ) };
}
