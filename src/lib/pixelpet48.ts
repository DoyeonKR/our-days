// 48×48 펫 스프라이트 — "퀄리티가 낮아 보인다"에 대한 답.
//
// 32×32 판의 한계가 뭐였나: 몸통 대부분이 한 톤(b)의 **평평한 덩어리**였고, 종을 가르는 건
// 귀·꼬리뿐이라 8종이 '색만 다른 같은 인형'으로 보였다. 32칸 안에서는 털결·가슴 무늬·눈 광택
// 같은 걸 넣을 자리가 없다 — 해상도가 곧 표현력의 상한이었다.
//
// 48×48 은 픽셀 수가 **2.25배**다. 그 여유를 이렇게 쓴다:
//   1) **털결** — 실루엣 가장자리에 1~2도트 삐침을 넣어 매끈한 고무 인형 느낌을 없앤다.
//   2) **가슴/배 무늬** — 종마다 다른 무늬가 정면에서 바로 보인다.
//   3) **큰 눈 + 광택 2점** — 캐릭터 인상의 대부분은 눈에서 온다.
//   4) **볼·발바닥·귀 안쪽** 같은 작은 색 포인트.
//   5) 최종형은 **왕관 + 보석 + 오라 반짝임**으로 확실히 '화려하게'.
//
// 작은 자리(탭 아이콘·배지)는 downscale2() 로 24×24 를 자동 생성한다 — 정수배 축소라
// 격자가 안 깨지고, 별도 저작 없이 한 벌만 관리한다.
//
// 저작 규약은 32판과 동일: 행은 `row([x,"문자"])` 런으로만, paint() 가 길이 오류를 즉시 throw.
// 글자: o 외곽선 · H 하이라이트 · b 밝음 · B 기본 · d 그늘 · D 깊은그늘
//       c 배/가슴 · C 배 그늘 · i 귀안쪽 · e 눈동자 · L 눈 광택 · w 흰자
//       p 볼터치 · n 코 · m 입 · y 발바닥 · A 마킹 · a 마킹그늘 · q 부리 · Q 부리그늘
//       k 왕관 · K 왕관그늘 · s 반짝임 · g 보석

import { type Palette, type Sprite, ramp } from "./pixel.ts";

const W = 48;

/** 48칸 행 — [시작x, 문자들] 런으로만(점 세기 사고 방지). */
function row(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(W).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= W) throw new Error(`row48: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
}

type Patch = readonly (readonly [number, string])[];

function paint(base: readonly string[], patches: readonly (readonly [number, string])[]): string[] {
  const out = [...base];
  for (const [y, s] of patches) {
    if (s.length !== W) throw new Error(`paint48: ${y}행 길이 ${s.length} (48 이어야)`);
    if (y < 0 || y >= out.length) throw new Error(`paint48: y=${y} 범위 밖`);
    const r = out[y].split("");
    for (let x = 0; x < W; x++) if (s[x] !== ".") r[x] = s[x];
    out[y] = r.join("");
  }
  return out;
}

const EMPTY = row();

export type SpeciesPal = {
  body: readonly string[];
  belly: readonly string[];
  inner: readonly string[];
  eye?: string;
  mark?: readonly string[];
  beak?: readonly string[];
};

export function petPalette(sp: SpeciesPal): Palette {
  const B = ramp(sp.body);
  const C = ramp(sp.belly);
  const M = ramp(sp.mark ?? sp.body);
  const Q = ramp(sp.beak ?? ["#ffe08a", "#ffc93f", "#e0a02e"]);
  return {
    o: B.o, H: B.H, b: B.b, B: B.B, d: B.d, D: B.D,
    c: C.b, C: C.d,
    i: sp.inner[1],
    e: sp.eye ?? "#2b2440",
    w: "#fffdf7",
    L: "#ffffff",
    p: "#ff9fb8",
    n: B.D,
    m: B.o,
    y: C.d,
    A: M.B, a: M.D,
    q: Q.B, Q: Q.d,
    k: "#ffd75e", K: "#c8901c", g: "#8fe3ff",
    s: "#fff3b0",
  };
}

/* ── 공용 골격 48×48 ───────────────────────────────────────────
 * 큰 머리(r6~28) + 몸통(r28~42) + 다리(r42~47). 광원 좌상단.
 * 32판과 결정적으로 다른 점: 가장자리에 **털 삐침**을 넣고, 몸 안쪽 톤을 4단으로 굴린다. */
const BODY: readonly string[] = [
  EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
  row([16, "oooooooooooooooo"]),
  row([13, "oooHHHbbbbbbbbBBBBBooo"]),
  row([11, "ooHHHHbbbbbbbbbbBBBBBBddo"]),
  row([9, "ooHHHbbbbbbbbbbbbbbBBBBBBdddo"]),
  row([8, "oHHHbbbbbbbbbbbbbbbbBBBBBBBdddo"]),
  row([7, "oHHbbbbbbbbbbbbbbbbbbBBBBBBBBdddo"]),
  row([6, "oHHbbbbbbbbbbbbbbbbbbbbBBBBBBBBBddo"]),
  row([6, "oHbbbbbbbbbbbbbbbbbbbbbbBBBBBBBBBddo"]),
  row([6, "oHbbbbbbbbbbbbbbbbbbbbbbBBBBBBBBBddo"]),
  row([6, "obbbbooooobbbbbbbbbbbbooooobBBBBBddo"]), // 눈 윗선
  row([6, "obbboowwwoobbbbbbbbbboowwwooBBBBBddo"]),
  row([6, "obbbowLLwwobbbbbbbbbbowLLwwoBBBBBddo"]),
  row([6, "obbbowLeewobbbbbbbbbbowLeewoBBBBBddo"]),
  row([6, "obbbowweeeobbbbbbbbbbowweeeoBBBBBddo"]),
  row([6, "obbbboweeobbbbbbbbbbbboweeoBBBBBBddo"]),
  row([6, "obbbbbooobbbbbbbbbbbbbbooobBBBBBBddo"]),
  row([6, "oppbbbbbbbbbcccccccbbbbbbbBBBBBppddo"]), // 볼터치 + 주둥이
  row([6, "oppbbbbbbbbccccnnnccccbbbbBBBBBppddo"]),
  row([6, "obbbbbbbbbbcccnnnnnccccbbBBBBBBBBddo"]),
  row([7, "obbbbbbbbbcccmmmmmcccCbbBBBBBBBddo"]),
  row([8, "obbbbbbbbcccccmmmcccCCbBBBBBBBddo"]),
  row([9, "obbbbbbbccccccccccCCCBBBBBBBddo"]),
  row([11, "obbbbbbccccccccccCCBBBBBBddo"]),
  row([14, "obbbbbcccccccccCCBBBBBo"]),
  row([16, "obbbbcccccccCCBBBBo"]),
  row([13, "obbbbccccccccccccCCBBBBBBddo"]),
  row([11, "obbbbccccccccccccccccCCBBBBBBBddo"]),
  row([10, "obbbccccccccccccccccccCCBBBBBBBBddo"]),
  row([10, "obbbccccccccccccccccccCCBBBBBBBBddo"]),
  row([11, "obbccccccccccccccccccCCCBBBBBBBddo"]),
  row([12, "obbcccccccccccccccccCCCBBBBBBddo"]),
  row([13, "obbccccccccccccccccCCCBBBBBddo"]),
  row([14, "obbcccccccccccccccCCBBBBBddo"]),
  row([15, "obbccccccccccccCCBBBBBddo"]),
  row([16, "obbbccccccccCCBBBBddo"]),
  row([17, "oobbbbccccCCBBBBoo"]),
  EMPTY, EMPTY, EMPTY, EMPTY,
];

/** 다리 — 2프레임 교차. 48판에선 발가락 홈까지 들어간다. */
function feet(step: boolean, fur: string, pad: string): Patch {
  const L = step ? 15 : 13;
  const R = step ? 26 : 28;
  const gap = step ? ([22, "oooo"] as const) : ([20, "oooooooo"] as const);
  const leg = `o${fur.repeat(6)}o`;
  const sole = `o${pad}${pad}o${pad}${pad}o${pad}o`;
  return [
    [44, row([L, leg], gap, [R, leg])],
    [45, row([L, leg], [R, leg])],
    [46, row([L, sole], [R, sole])],
    [47, row([L + 1, "oooooo"], [R + 1, "oooooo"])],
  ];
}

/* ── 귀 ─────────────────────────────────────────────────────── */

const EAR_FOX: Patch = [
  [0, row([12, "oo"], [34, "oo"])],
  [1, row([11, "obbo"], [33, "oddo"])],
  [2, row([10, "obHbo"], [32, "odddo"])],
  [3, row([9, "obHiibo"], [31, "odiiddo"])],
  [4, row([9, "obHiiibo"], [30, "odiiiddo"])],
  [5, row([8, "obHiiiibbo"], [29, "oddiiiiDdo"])],
  [6, row([8, "obbiiiibbb"], [30, "dddiiiDDo"])],
  [7, row([8, "obbbiibbbb"], [30, "dddiiDDDo"])],
  [8, row([9, "obbbbbbb"], [31, "dddDDDo"])],
  [9, row([10, "obbbbb"], [33, "dDDDo"])],
];

const EAR_CAT: Patch = [
  [0, row([11, "o"], [36, "o"])],
  [1, row([10, "obo"], [35, "odo"])],
  [2, row([10, "obio"], [34, "oido"])],
  [3, row([9, "obHiio"], [33, "oiiddo"])],
  [4, row([9, "obHiiio"], [32, "oiiiddo"])],
  [5, row([8, "obbHiiibo"], [31, "obiiiddDo"])],
  [6, row([8, "obbbiiibb"], [31, "biiiddDDo"])],
  [7, row([8, "obbbbiibb"], [32, "biiddDDo"])],
  [8, row([9, "obbbbbbb"], [32, "bddDDDo"])],
  [9, row([10, "obbbbb"], [33, "dDDDo"])],
];

const EAR_ROUND: Patch = [
  [2, row([9, "ooooo"], [34, "ooooo"])],
  [3, row([8, "obHHbo"], [33, "odddDo"])],
  [4, row([7, "obHiiibo"], [32, "odiiiDDo"])],
  [5, row([7, "obHiiiibo"], [31, "odiiiiDDo"])],
  [6, row([7, "obbiiiibb"], [31, "obiiiiDDo"])],
  [7, row([7, "obbbiiibb"], [32, "biiiDDDo"])],
  [8, row([8, "obbbbbbb"], [33, "bDDDDo"])],
  [9, row([9, "ooobbb"], [34, "DDooo"])],
];

const EAR_ROUND_DARK: Patch = [
  [2, row([9, "ooooo"], [34, "ooooo"])],
  [3, row([8, "oAAAAo"], [33, "oaaaao"])],
  [4, row([7, "oAAAAAAo"], [32, "oaaaaaao"])],
  [5, row([7, "oAAAiiAo"], [31, "oAiiaaaao"])],
  [6, row([7, "oAAAiiAA"], [31, "oAiiaaaao"])],
  [7, row([7, "oAAAAAAA"], [32, "Aaaaaaao"])],
  [8, row([8, "oAAAAAAA"], [33, "aaaaao"])],
  [9, row([9, "oooAAA"], [34, "aaooo"])],
];

const EAR_TUFT: Patch = [
  [1, row([11, "o"], [36, "o"])],
  [2, row([10, "obo"], [35, "odo"])],
  [3, row([9, "obbo"], [34, "oddo"])],
  [4, row([9, "obbbo"], [33, "odddo"])],
  [5, row([8, "obbbbbo"], [32, "oddddDo"])],
  [6, row([8, "obbbbbbbo"], [30, "oddddddDo"])],
  [7, row([8, "obbbbbbbbb"], [30, "ddddddDDo"])],
  [8, row([9, "obbbbbbbb"], [31, "dddddDDo"])],
  [9, row([10, "obbbbbb"], [33, "dDDDo"])],
];

const EAR_NONE: Patch = [
  [1, row([23, "oo"])],
  [2, row([22, "obHo"])],
  [3, row([21, "obHbbo"])],
  [4, row([21, "obbbbo"])],
  [5, row([22, "oooo"])],
];

/* ── 종별 마킹 — 48판에서 진짜로 보이는 디테일 ─────────────── */

/** 여우 — 볼 털 뭉치 + 이마 삼각 무늬 + 흰 주둥이. */
const MARK_FOX: Patch = [
  [11, row([20, "AAAAAAAA"])],
  [12, row([21, "AAAAAA"])],
  [13, row([22, "AAAA"])],
  [24, row([4, "occ"], [41, "cco"])],
  [25, row([3, "occc"], [41, "ccco"])],
  [26, row([4, "occ"], [42, "cco"])],
  [28, row([16, "ccccccccccccccc"])],
];

/** 고양이 — 이마 줄무늬 3줄 + 수염 + 등 줄무늬. */
const MARK_CAT: Patch = [
  [9, row([16, "AA"], [22, "AA"], [28, "AA"])],
  [10, row([17, "AA"], [23, "AA"], [27, "AA"])],
  [11, row([18, "AA"], [23, "AA"], [26, "AA"])],
  [24, row([1, "wwww"], [43, "wwww"])],
  [26, row([1, "wwww"], [43, "wwww"])],
  [31, row([8, "AAA"], [37, "aaa"])],
  [34, row([8, "AAA"], [37, "aaa"])],
];

/** 곰 — 넓은 주둥이 + 큰 코. */
const MARK_BEAR: Patch = [
  [22, row([17, "cccccccccccccc"])],
  [23, row([16, "cccccnnnnnncccc"])],
  [24, row([16, "ccccnnnnnnnnccc"])],
  [25, row([17, "cccnnnnnnnccc"])],
  [26, row([18, "ccccmmmmmcccc"])],
];

/** 판다 — 눈두덩 + 검은 팔다리 + 검은 귀(위에서 이미 지정). */
const MARK_PANDA: Patch = [
  [13, row([9, "AAAAAAAA"], [31, "aaaaaaaa"])],
  [14, row([8, "AAAAAAAAAA"], [30, "aaaaaaaaaa"])],
  [15, row([8, "AAAAoooooA"], [30, "aoooooaaaa"])],
  [16, row([8, "AAAoowwwooA"], [29, "aoowwwooaaa"])],
  [17, row([8, "AAAowLLwwoA"], [29, "aowLLwwoaaa"])],
  [18, row([8, "AAAowLeewoA"], [29, "aowLeewoaaa"])],
  [19, row([8, "AAAowweeeoA"], [29, "aowweeeoaaa"])],
  [20, row([9, "AAAoweeoAA"], [30, "aoweeoaaaa"])],
  [21, row([10, "AAAoooAA"], [31, "aooooaaa"])],
  [22, row([11, "AAAAAA"], [32, "aaaaaa"])],
  [30, row([10, "AAAA"], [34, "aaaa"])],
  [31, row([10, "AAAA"], [34, "aaaa"])],
  [32, row([10, "AAAA"], [34, "aaaa"])],
  [33, row([10, "AAAA"], [34, "aaaa"])],
  [34, row([11, "AAA"], [34, "aaa"])],
];

/** 부엉이 — 얼굴 원반 + 부리 + 날개 깃. */
const MARK_OWL: Patch = [
  [14, row([9, "cccccccc"], [31, "cccccccc"])],
  [15, row([8, "ccbbooooobbc"], [28, "cbboooooBBcc"])],
  [22, row([21, "cccqqqqcc"])],
  [23, row([21, "ccqqqqqcc"])],
  [24, row([22, "cqqqqqc"])],
  [25, row([23, "cQQQQc"])],
  [26, row([24, "cQQc"])],
  [30, row([9, "dddd"], [35, "DDDD"])],
  [31, row([9, "dddd"], [35, "DDDD"])],
  [32, row([8, "ddddd"], [35, "DDDDD"])],
  [33, row([8, "ddddd"], [35, "DDDDD"])],
  [34, row([9, "dddd"], [35, "DDDD"])],
  [35, row([9, "dddd"], [35, "DDDD"])],
];

/** 늑대 — 가슴 갈기 + 이마 V + 등 그늘. */
const MARK_WOLF: Patch = [
  [10, row([19, "AAAAAAAAAA"])],
  [11, row([20, "AAAAAAAA"])],
  [12, row([21, "AAAAAA"])],
  [13, row([22, "AAAA"])],
  [29, row([15, "cc"], [20, "cccccc"], [30, "cc"])],
  [30, row([14, "cc"], [32, "cc"])],
  [33, row([9, "AAA"], [36, "aaa"])],
];

/** 병아리 — 부리 + 날개 + 볼. */
const MARK_CHICK: Patch = [
  [22, row([21, "ccqqqqcc"])],
  [23, row([21, "cqqqqqqc"])],
  [24, row([22, "cQQQQc"])],
  [30, row([10, "cccc"], [34, "cccc"])],
  [31, row([10, "cccc"], [34, "cccc"])],
  [32, row([10, "cccc"], [34, "cccc"])],
  [33, row([11, "ccc"], [34, "ccc"])],
];

/* ── 꼬리 ───────────────────────────────────────────────────── */

const TAIL_FOX: Patch = [
  [30, row([36, "oo"])],
  [31, row([35, "oBbo"])],
  [32, row([35, "BBbbo"])],
  [33, row([35, "BBbbco"])],
  [34, row([35, "BBbcco"])],
  [35, row([35, "BBbccco"])],
  [36, row([35, "dBbccco"])],
  [37, row([35, "ddbcccco"])],
  [38, row([35, "ddDccco"])],
  [39, row([35, "dDDcco"])],
  [40, row([36, "oDDo"])],
];

const TAIL_WOLF: Patch = [
  [30, row([36, "oo"])],
  [31, row([35, "oBbo"])],
  [32, row([35, "BBbdo"])],
  [33, row([35, "BBbddo"])],
  [34, row([35, "BBbddo"])],
  [35, row([35, "BBbdddo"])],
  [36, row([35, "dBbdddo"])],
  [37, row([35, "ddbddddo"])],
  [38, row([35, "ddDDDDo"])],
  [39, row([35, "dDDDDo"])],
  [40, row([36, "oDDo"])],
];

const TAIL_CAT: Patch = [
  [24, row([41, "oo"])],
  [25, row([40, "oBbo"])],
  [26, row([40, "oBdo"])],
  [27, row([39, "oBdo"])],
  [28, row([38, "oBdo"])],
  [29, row([38, "oAdo"])],
  [30, row([37, "oBdo"])],
  [31, row([37, "oAdo"])],
  [32, row([37, "oBdo"])],
  [33, row([37, "oddo"])],
  [34, row([38, "oo"])],
];

/* ── 조립 ───────────────────────────────────────────────────── */

export type PetKind = "fox" | "cat" | "bear" | "panda" | "owl" | "wolf" | "chick";

type Kind = { ear: Patch; mark: Patch; tail: Patch; fur?: string; pad?: string };
const KIND: Record<PetKind, Kind> = {
  fox: { ear: EAR_FOX, mark: MARK_FOX, tail: TAIL_FOX },
  cat: { ear: EAR_CAT, mark: MARK_CAT, tail: TAIL_CAT },
  bear: { ear: EAR_ROUND, mark: MARK_BEAR, tail: [] },
  panda: { ear: EAR_ROUND_DARK, mark: MARK_PANDA, tail: [], fur: "A", pad: "a" },
  owl: { ear: EAR_TUFT, mark: MARK_OWL, tail: [], fur: "q", pad: "Q" },
  wolf: { ear: EAR_FOX, mark: MARK_WOLF, tail: TAIL_WOLF },
  chick: { ear: EAR_NONE, mark: MARK_CHICK, tail: [], fur: "q", pad: "Q" },
};

export function petSprite48(sp: SpeciesPal, kind: PetKind): Sprite[] {
  const pal = petPalette(sp);
  const k = KIND[kind];
  const mk = (step: boolean): Sprite => ({
    w: W,
    h: 48,
    pal,
    rows: paint(BODY, [...k.tail, ...k.ear, ...feet(step, k.fur ?? "b", k.pad ?? "y"), ...k.mark]),
  });
  return [mk(true), mk(false)];
}

/** 최종형 — 왕관 + 보석 + 오라 반짝임. '화려하게'가 여기서 나온다. */
export function crowned(frames: Sprite[]): Sprite[] {
  const CROWN: Patch = [
    [3, row([16, "k"], [23, "k"], [30, "k"])],
    [4, row([15, "kKk"], [22, "kKk"], [29, "kKk"])],
    [5, row([15, "kkkkgkkkkgkkkk"])],
    [6, row([14, "okkkkkkkkkkkkkko"])],
    [7, row([14, "oKKKKKKKKKKKKKKo"])],
  ];
  // 오라 반짝임 — 프레임마다 위치를 바꿔 반짝인다(랜덤 아님: 프레임 인덱스로 결정).
  const AURA_A: Patch = [
    [7, row([3, "s"], [44, "s"])],
  ];
  const AURA_B: Patch = [
    [11, row([1, "s"], [46, "s"])],
  ];
  return frames.map((f, idx) => ({
    ...f,
    rows: paint(f.rows, [...CROWN, ...(idx === 0 ? AURA_A : AURA_B)]),
  }));
}

/** 알 — 매끈한 구체. 48판에선 얼룩 무늬까지 들어간다. */
export function eggSprite48(sp: SpeciesPal, tilt: boolean): Sprite {
  const pal = petPalette(sp);
  const rows = [
    EMPTY, EMPTY, EMPTY, EMPTY,
    row([19, "oooooooooo"]),
    row([16, "oooHHHbbbbbbooo"]),
    row([14, "ooHHHHbbbbbbbbBBoo"]),
    row([13, "oHHHHbbbbbbbbbbBBBo"]),
    row([12, "oHHHbbbbbbbbbbbbBBBBo"]),
    row([11, "oHHbbbbbbbbbbbbbbBBBBBo"]),
    row([10, "oHHbbbbbbbbbbbbbbbBBBBBBo"]),
    row([10, "oHbbbbbbbbbbbbbbbbBBBBBBBo"]),
    row([9, "oHbbbbbbbbbbbbbbbbbBBBBBBBdo"]),
    row([9, "oHbbbbbbbbbbbbbbbbbBBBBBBBdo"]),
    row([8, "oHbbbbbbbbbbbbbbbbbbBBBBBBBddo"]),
    row([8, "obbbbbbbccccbbbbbbbbBBBBBBBddo"]),
    row([8, "obbbbbbcccccbbbbbbbbBBBBBBBddo"]),
    row([8, "obbbbbbbcccbbbbbbbbbBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbbbbbbbbBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbbbbbbbbBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbccccbbbBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbcccccbbBBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbcccbbbBBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbbbbbbbBBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbbbbbbbBBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbbbbbbbBBBBBBBBddo"]),
    row([8, "obbbbbbbbbbbbbbbbbbBBBBBBBBddo"]),
    row([9, "obbbbbbbbbbbbbbbbBBBBBBBBddo"]),
    row([9, "obbbbbbbbbbbbbbbbBBBBBBBBddo"]),
    row([10, "obbbbbbbbbbbbbbBBBBBBBBddo"]),
    row([10, "obbbbbbbbbbbbbBBBBBBBBBddo"]),
    row([11, "obbbbbbbbbbbBBBBBBBBBddo"]),
    row([12, "obbbbbbbbbBBBBBBBBBddo"]),
    row([13, "oobbbbbbBBBBBBBBddoo"]),
    row([15, "ooBBBBBBBBBBddoo"]),
    row([18, "oooooooooooo"]),
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
  ];
  // 알도 바닥에 붙인다 — 아래 빈 행이 남으면 렌더러가 높이로 바닥을 맞출 때 그림자 위로 뜬다.
  const laid = tilt ? rows.map((r) => (/[^.]/.test(r) ? "." + r.slice(0, 47) : r)) : rows;
  return { w: W, h: 48, pal, rows: bottomAlign(laid) };
}

/** 아래로 붙인다 — 마지막 잉크 행이 47행에 오도록. 안 하면 그림자 위로 뜬다. */
function bottomAlign(rows: string[]): string[] {
  const body = [...rows];
  while (body.length && !/[^.]/.test(body[body.length - 1])) body.pop();
  if (body.length > 48) throw new Error(`sprite48: ${body.length}행 (48 초과)`);
  return [...Array<string>(48 - body.length).fill(EMPTY), ...body];
}

/** 웅크린 몸통 — 종 공통. */
const CURL: string[] = [
  row([14, "oooooooooooooooooo"]),
  row([11, "oooHHHbbbbbbbbBBBBBBddooo"]),
  row([9, "ooHHHbbbbbbbbbbbbBBBBBBBBddoo"]),
  row([8, "oHHbbbbbbbbbbbbbbbbBBBBBBBBBddo"]),
  row([7, "oHbbbbbbbbbbbbbbbbbbbBBBBBBBBBddo"]),
  row([7, "obbbbooobbbbbbbbbbbbooobBBBBBBBddo"]),
  row([7, "obbbbbbbbbbbbbbbbbbbbbbbBBBBBBBddo"]),
  row([7, "obbppbbbbbbbbbnnnbbbbbbbppBBBBBddo"]),
  row([7, "obbppbbbbbbbbbmmmbbbbbbbppBBBBBddo"]),
  row([6, "obbbbcccccccccccccccccccCCBBBBBBddo"]),
  row([6, "obbcccccccccccccccccccccCCCBBBBBddo"]),
  row([6, "obbcccccccccccccccccccccCCCBBBBBddo"]),
  row([7, "obbccccccccccccccccccccCCCBBBBddo"]),
  row([8, "obbbcccccccccccccccccCCCBBBBddo"]),
  row([10, "oobbbbccccccccccccCCCBBBddoo"]),
  row([13, "ooobbbbbbbBBBBBBBddooo"]),
  row([16, "oooooooooooooooo"]),
];

const SLEEP_EARS: Record<PetKind, string[]> = {
  fox: [row([12, "oo"], [31, "oo"]), row([11, "obbo"], [30, "oddo"]), row([10, "obHibo"], [29, "odiddo"]), row([10, "obbiib"], [29, "diidDo"]), row([11, "obbbb"], [30, "dddo"])],
  wolf: [row([12, "oo"], [31, "oo"]), row([11, "obbo"], [30, "oddo"]), row([10, "obHibo"], [29, "odiddo"]), row([10, "obbiib"], [29, "diidDo"]), row([11, "obbbb"], [30, "dddo"])],
  cat: [row([11, "o"], [33, "o"]), row([10, "obo"], [32, "odo"]), row([10, "obio"], [31, "oido"]), row([10, "obbio"], [30, "oiddo"]), row([11, "obbb"], [31, "ddo"])],
  bear: [row([10, "oooo"], [31, "oooo"]), row([9, "obHHbo"], [30, "odddDo"]), row([9, "obiibo"], [30, "obiiDo"]), row([9, "obbbbo"], [30, "oddDDo"]), row([10, "obbb"], [31, "ddo"])],
  panda: [row([10, "oooo"], [31, "oooo"]), row([9, "oAAAAo"], [30, "oaaaao"]), row([9, "oAiiAo"], [30, "oAiiao"]), row([9, "oAAAAo"], [30, "oaaaao"]), row([10, "oAAA"], [31, "aao"])],
  owl: [row([11, "o"], [33, "o"]), row([10, "obo"], [32, "odo"]), row([10, "obbo"], [31, "oddo"]), row([9, "obbbbo"], [30, "oddddo"]), row([10, "obbbb"], [31, "ddo"])],
  chick: [EMPTY, row([23, "oo"]), row([22, "obHo"]), row([22, "obbo"]), row([23, "oo"])],
};

export function sleepSprite48(sp: SpeciesPal, kind: PetKind = "chick"): Sprite {
  return {
    w: W,
    h: 48,
    pal: petPalette(sp),
    rows: bottomAlign([...SLEEP_EARS[kind], ...CURL]),
  };
}
