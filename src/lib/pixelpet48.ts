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

/** 기존 몸을 덮지 않고 투명 칸에만 효과를 놓는다. 오라가 털 외곽선을 먹는 사고를 막는다. */
function paintEmpty(base: readonly string[], patches: readonly (readonly [number, string])[]): string[] {
  const out = [...base];
  for (const [y, s] of patches) {
    if (s.length !== W) throw new Error(`paintEmpty48: ${y}행 길이 ${s.length} (48 이어야)`);
    const r = out[y].split("");
    for (let x = 0; x < W; x++) if (s[x] !== "." && r[x] === ".") r[x] = s[x];
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

/* ── 프레임 저작 도구 ─────────────────────────────────────────
 * 프레임은 매번 `paint(BODY, …)` 로 **처음부터** 조립된다. 그래서 자세 차이를
 * '패치 자체를 바꾸는' 방식으로 낼 수 있다 — 이게 중요하다.
 * ⚠ paint() 는 '.' 을 "base 유지" 로 읽으므로 **덧칠로는 지울 수 없다**. 꼬리처럼
 *   몸 밖으로 나온 부분을 옮기려면 이전 자리가 남아 두 겹으로 찍힌다. 프레임마다
 *   패치를 통째로 갈아끼우는 지금 방식만 안전하다. */

/** 행 문자열을 dx 만큼 가로로 민다.
 *  ⚠ 잉크가 판 밖으로 나가면 즉시 throw — 조용히 잘리면 여섯 프레임 중 하나만
 *  꼬리 끝이 잘린 채로 배포되고, 그건 눈으로도 잘 안 보인다. */
function shiftRow(s: string, dx: number): string {
  if (dx === 0) return s;
  const lost = dx > 0 ? s.slice(W - dx) : s.slice(0, -dx);
  if (/[^.]/.test(lost)) throw new Error(`shiftRow: dx=${dx} 에서 잉크가 판 밖으로 나감`);
  return dx > 0 ? ".".repeat(dx) + s.slice(0, W - dx) : s.slice(-dx) + ".".repeat(-dx);
}

/** 패치에서 **끝부분 행만** 가로로 민다(꼬리 끝 흔들림·귀 끝 실룩임).
 *  뿌리까지 같이 밀면 몸에서 떨어져 나간다 — 흔들리는 건 언제나 끝이다. */
function sway(p: Patch, dx: number, pick: (y: number) => boolean): Patch {
  if (dx === 0) return p;
  return p.map(([y, s]) => [y, pick(y) ? shiftRow(s, dx) : s] as const);
}

/** 패치의 아래쪽 n행(= 아래로 늘어진 꼬리 끝).
 *  ⚠ 귀 끝(위쪽 n행)도 같은 방식으로 흔들 수 있지만 **일부러 안 한다** — 귀는
 *  얼굴 크롭 창(0~29행) 안이라, 흔들면 홈·쿡·도감의 얼굴 아이콘이 프레임마다 떨린다. */
function bottomRows(p: Patch, n: number): (y: number) => boolean {
  if (!p.length) return () => false;
  const bot = Math.max(...p.map(([y]) => y));
  return (y) => y > bot - n;
}

/** 걸음 6단계 — [왼다리x, 오른다리x, 왼발듦, 오른발듦].
 *
 * 앞모습이라 앞뒤로 내딛는 걸 그릴 수 없다. 대신 **벌어짐 + 한쪽 발 들기** 두 축으로
 * 무게 이동을 읽힌다. 2프레임 시절엔 벌어짐 하나뿐이라 '발만 바뀌는' 그림이었다.
 * ⚠ 여섯 자세가 서로 달라야 한다 — 같은 자세가 끼면 그 프레임은 없는 것과 같다
 *   (petframes.test.ts 가 중복을 막는다). */
const GAIT: readonly (readonly [number, number, boolean, boolean])[] = [
  [15, 26, false, false], // 모으고 둘 다 딛음
  [14, 27, false, true], //  벌리며 오른발이 뜬다
  [13, 28, false, true], //  최대로 벌린 채 오른발 듦
  [14, 27, true, false], //  좁히며 왼발이 뜬다
  [13, 28, true, false], //  최대로 벌린 채 왼발 듦
  [14, 27, false, false], // 다시 둘 다 딛음
];

export const GAIT_FRAMES = GAIT.length;

/** 다리 — 6프레임. 48판에선 발가락 홈까지 들어간다.
 *  들린 발은 **발끝 행(47)을 빼서** 1px 짧다. 앞모습에서 '발을 뗐다'를 읽히게 하는
 *  가장 싼 방법이고, 다리 top(44행)은 건드리지 않으니 몸과 다리 사이가 뜨지 않는다.
 *  ⚠ 44행을 1px 이라도 내리면 몸통이 43행에서 끝나므로 그 틈이 그대로 보인다. */
function feet(phase: number, fur: string, pad: string): Patch {
  const [L, R, lUp, rUp] = GAIT[((phase % GAIT.length) + GAIT.length) % GAIT.length];
  // 두 다리 사이 엉덩이 외곽선. 다리가 x..x+7 을 차지하므로 L+7 에서 R 까지가 빈 폭이다.
  // ⚠ 이 셋(L·R·gap)은 짝이다. 벌어짐만 바꾸고 gap 을 그대로 두면 사이가 붙거나 벌어진다.
  const gap = [L + 7, "o".repeat(Math.max(0, R - L - 7))] as const;
  const leg = `o${fur.repeat(6)}o`;
  const sole = `o${pad}${pad}o${pad}${pad}o${pad}o`;
  const toes: (readonly [number, string])[] = [];
  if (!lUp) toes.push([L + 1, "oooooo"] as const);
  if (!rUp) toes.push([R + 1, "oooooo"] as const);
  return [
    [44, row([L, leg], gap, [R, leg])],
    [45, row([L, leg], [R, leg])],
    [46, row([L, sole], [R, sole])],
    [47, row(...toes)],
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

/* ── 신화형 전용 골격 [사용자 피드백 2026-08-11 "생긴건 다 똑같고 눈동자하고 피부만
 * 다르잖아 — 프레임자체를 다시그려"] ──────────────────────────────
 *
 * 1차판은 공용 BODY 에 줄무늬·갈기를 **덧칠**했다 — 숫자로는 마킹이 다른데 화면에선
 * '같은 동물 리컬러'였다. 장비 1차판이 앵커만 맞고 떠 보였던 것과 같은 실수다.
 * 종은 실루엣이다 — 호랑이·사자도 기린처럼 몸통을 처음부터 그린다.
 *
 * 호랑이(뱅갈·무등산 공유): 머리가 몸보다 **넓고 낮다** + 구레나룻(볼털 삐침) +
 * 큰 주둥이(w) + 이마 줄무늬(민화 王) + 굵은 줄무늬 꼬리. 줄무늬는 A/a 라 팔레트만
 * 갈면 뱅갈(흰+먹)·무등산(은+수박초록)이 된다. */
const TIGER_BODY: readonly string[] = [
  EMPTY, EMPTY, EMPTY, EMPTY,
  row([8, "oooo"], [36, "oooo"]), // 둥근 귀 — 머리 모서리에 낮게
  row([7, "obHHbo"], [35, "obBddo"]),
  row([6, "obHiiibo"], [34, "obiiiddo"]),
  row([6, "obiiiibo"], [34, "obiiiddo"]),
  row([5, "oobbbboooooooooooooooooooooooobddddoo"]), // 머리 윗선 — 낮고 평평하다
  row([4, "obbbbbbbbAAbbbbbbbbbbbbbbbAAbbbBBBdddo"]), // 이마 줄무늬 시작
  row([3, "obbbbbbbbbAAbbbbAAAAbbbbbAAbbbbbBBBddddo"]), // 가운데 王 세로획
  row([3, "obbbbbbbbbbbbbbbAAAAbbbbbbbbbbbbBBBddddo"]),
  row([2, "obbAAbbbbbbbbbbbbbbbbbbbbbbbbbbbbBBddAAddo"]), // 관자 줄무늬
  row([2, "obbAAbbbooooobbbbbbbbbbbboooooBBBBBddAAddo"]), // 눈 윗선
  row([2, "obbbbbboowwwoobbbbbbbbbboowwwooBBBBBdddddo"]),
  row([2, "obbbbbbowLLwwobbbbbbbbbbowLLwwoBBBBBdddddo"]),
  row([1, "oAAbbbbowLeewobbbbbbbbbbowLeewoBBBBddddAAdo"]), // 볼 줄무늬
  row([1, "oAAbbbbowweeeobbbbbbbbbbowweeeoBBBBddddAAdo"]),
  row([2, "obbbbbboweeobbbbbbbbbbbbboweeoBBBBBdddddo"]),
  row([2, "obbbbbbbooobbwwwwwwwwbbbbbooobBBBBBdddddo"]),
  row([1, "obbbbbbbbbbwwwwwwwwwwwwbbbbbbBBBBBddddddo"]), // 주둥이 — 크고 희다
  row([1, "oAbbbbbbbbwwwwwnnnnwwwwwbbbbBBBBBddddddAo"], [44, "o"]), // 구레나룻 시작
  row([0, "ooAAbbbbbbwwwwnnnnnnwwwwbbbBBBBBdddddAAoo"], [43, "oo"]),
  row([0, "oAAAbbbbbbwwwwwmmmmwwwwwbbBBBBBBddddddAAAo"], [43, "oo"]), // 볼털 삐침
  row([1, "oAAbbbbbbbwwwwmmmmmmwwwwbBBBBBBdddddAAo"]),
  row([2, "obbbbbbbbbwwwwwmmwwwwwbBBBBBBBddddddo"]),
  row([3, "oobbbbbbbbbwwwwwwwwwbBBBBBBBddddddoo"]),
  row([5, "oobbbbbbbbbbbbbbbbBBBBBBBddddddoo"]), // 턱선 — 목 없이 몸으로
  row([7, "obbbbcccccccccccBBBBBBddddddo"]), // 몸 — 배(c)
  row([6, "obbbccccccccccccccBBBBBddddddo"], [37, "oo"]), // 꼬리 시작
  row([5, "obbbccccccccccccccccBBBBBdddddo"], [36, "obAAo"]), // 굵은 줄무늬 꼬리
  row([5, "obbccccccccccccccccccBBBBddddDo"], [36, "obbbo"]),
  row([4, "obbcccccccccccccccccccBBBBBddddDo"], [37, "obAAo"]),
  row([4, "obccccccccccccccccccccccBBBBdddDDo"], [37, "obbbo"]),
  row([4, "obccccccccccccccccccccccBBBBdddDDo"], [37, "oAAo"]),
  row([4, "obAAccccccccccccccccccccBBBddAAdDo"], [37, "oDDo"]), // 옆구리 줄무늬
  row([4, "obAAcccccccccccccccccccBBBBddAAdDo"], [38, "oo"]),
  row([5, "obcccccccccccccccccccBBBBddddDo"]),
  row([5, "obbAcccccccccccccccccBBBdAAddDo"]),
  row([6, "obbAcccccccccccccccBBBdAAddo"]),
  row([7, "obbcccccccccccccccBBBdddDo"]),
  row([8, "obbbccccccccccccBBBdddo"]),
  row([10, "oobbbbccccccBBBddoo"]),
  row([13, "oobbbbbbbdoo"]),
  EMPTY, EMPTY, EMPTY, EMPTY,
];

/* 사자: **갈기가 실루엣의 전부다.** 갈기 원판(스캘럽)이 판을 채우고 얼굴은 그 안의
 * 작은 원이다. 몸은 갈기보다 좁다 — 실제 사자 그림책 문법 그대로. 갈기 = A/a. */
const LION_BODY: readonly string[] = [
  EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
  row([13, "oo"], [20, "oo"], [27, "oo"], [33, "oo"]), // 갈기 첫 삐죽
  row([10, "ooAAoo"], [18, "oAAAAo"], [26, "oaaaao"], [33, "ooaaoo"]),
  row([8, "oAAAAAAoAAAAAAAAAoaaaaaaaaaoaaaaao"]),
  row([6, "oAAAAAAAAAAAAAAAAAAAaaaaaaaaaaaaaaaao"]),
  row([5, "oAAAAAAAAAAAAAAAAAAAAAaaaaaaaaaaaaaaaaao"]),
  row([4, "oAAAAAAAAAAAAAAAAAAAAAAaaaaaaaaaaaaaaaaaao"]),
  row([3, "oAAAAAAAoooooooooooooooooooooaaaaaaaaaaaaao"]), // 얼굴 원 윗선
  row([3, "oAAAAAobbbbbbbbbbbbbbbbbbbBBBooaaaaaaaaaao"]),
  row([2, "oAAAAAobbbbbbbbbbbbbbbbbbbbbBBBoaaaaaaaaaaao"]),
  row([2, "oAAAAobbbbooooobbbbbbbbbboooooBBBoaaaaaaaaao"]), // 눈 윗선
  row([1, "oAAAAAobbboowwwoobbbbbbbboowwwooBBoaaaaaaaaaao"]),
  row([1, "oAAAAAobHbowLLwwobbbbbbbbowLLwwoBBoaaaaaaaaaao"]),
  row([1, "oAAAAAobHbowLeewobbbbbbbbowLeewoBBoaaaaaaaaaao"]),
  row([1, "oAAAAAobbbowweeeobbbbbbbbowweeeoBBoaaaaaaaaaao"]),
  row([1, "oAAAAAobbbboweeobbbbbbbbbboweeoBBBoaaaaaaaaaao"]),
  row([2, "oAAAAobbbbbooobbwwwwwwbbbbooobBBoaaaaaaaaao"]),
  row([2, "oAAAAobbbbbbbwwwwwwwwwwbbbbbbBBBoaaaaaaaaao"]),
  row([2, "oAAAAobbbbbbwwwwnnnnwwwwbbbbBBBBoaaaaaaaaao"]), // 큰 코
  row([3, "oAAAobbbbbwwwwnnnnnnwwwwbbBBBBoaaaaaaaao"]),
  row([3, "oAAAobbbbbwwwwwmmmmwwwwwbBBBBBoaaaaaaaao"]),
  row([4, "oAAobbbbbbwwwwmmmmwwwwbBBBBBoaaaaaaao"]),
  row([4, "oAAAobbbbbbwwwwwwwwwwbBBBBoaaaaaaaao"]), // 턱수염 갈기로 이어짐
  row([5, "oAAAAooobbbbbbbbbbbBBoooaaaaaaaao"]),
  row([6, "oAAAAAAAoooooooooooooaaaaaaaaao"]), // 갈기 아랫단이 얼굴을 닫는다
  row([8, "oAAAAAAAAAAAaaaaaaaaaaaaaaao"]),
  row([10, "ooAAAAAAAAaaaaaaaaaaoo"], [36, "oo"]), // 갈기 끝 + 꼬리 시작
  row([12, "oobbcccccccccBBoo"], [35, "obo"]), // 몸 — 갈기보다 확 좁다
  row([11, "obbccccccccccccBBdo"], [35, "obo"]),
  row([10, "obbccccccccccccccBBddo"], [36, "obo"]),
  row([10, "obccccccccccccccccBddo"], [36, "obo"]),
  row([9, "obccccccccccccccccccBddo"], [37, "obo"]),
  row([9, "obccccccccccccccccccBddo"], [36, "oAAo"]), // 꼬리 술
  row([9, "obccccccccccccccccccBddo"], [36, "oAAao"]),
  row([9, "obbccccccccccccccccBdddo"], [37, "oaao"]),
  row([10, "obbccccccccccccccBdddo"], [38, "oo"]),
  row([10, "obbbccccccccccccBDddo"]),
  row([11, "obbbccccccccccBBddo"]),
  row([12, "oobbbccccccBDddoo"]),
  row([14, "oobbbbbDdoo"]),
  EMPTY, EMPTY, EMPTY, EMPTY,
];

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

export type PetKind =
  | "fox" | "cat" | "bear" | "panda" | "owl" | "wolf" | "chick"
  // 신화형(stage 5) — 호랑이(뱅갈·무등산은 같은 몸 다른 팔레트)·사자·기린
  | "tiger" | "lion" | "giraffe";

type Kind = { ear: Patch; mark: Patch; tail: Patch; fur?: string; pad?: string; tailSway?: boolean };
const KIND: Record<PetKind, Kind> = {
  // tailSway — 아래로 늘어진 꼬리만. 고양이는 꼬리가 위로 말려 얼굴 크롭 창을 침범한다.
  fox: { ear: EAR_FOX, mark: MARK_FOX, tail: TAIL_FOX, tailSway: true },
  cat: { ear: EAR_CAT, mark: MARK_CAT, tail: TAIL_CAT },
  bear: { ear: EAR_ROUND, mark: MARK_BEAR, tail: [] },
  panda: { ear: EAR_ROUND_DARK, mark: MARK_PANDA, tail: [], fur: "A", pad: "a" },
  owl: { ear: EAR_TUFT, mark: MARK_OWL, tail: [], fur: "q", pad: "Q" },
  wolf: { ear: EAR_FOX, mark: MARK_WOLF, tail: TAIL_WOLF, tailSway: true },
  chick: { ear: EAR_NONE, mark: MARK_CHICK, tail: [], fur: "q", pad: "Q" },
  // 신화형 — 호랑이 꼬리는 옆으로 뻗어(30~40행) 흔들면 줄무늬가 뭉개진다 → sway 없음
  // 호랑이·사자는 전용 골격(TIGER_BODY/LION_BODY)을 쓴다 — KIND 는 수면 귀·발색용.
  tiger: { ear: EAR_NONE, mark: [], tail: [] },
  lion: { ear: EAR_NONE, mark: [], tail: [] },
  // 기린은 공용 BODY 를 안 쓴다(paint 는 지우기가 안 돼 목을 못 만든다) — 전용 골격.
  // KIND 엔트리는 타입 완결용 + feet 색 지정.
  giraffe: { ear: EAR_NONE, mark: [], tail: [], fur: "b", pad: "A" },
};

/* ── 기린 전용 골격 — 작은 머리 + 목 + 몸. [사용자 요청 2026-08-11]
 * 공용 BODY(큰 머리가 판의 절반)로는 기린이 안 된다 — 기린은 목이 실루엣의 전부다.
 * 규약은 BODY 와 동일: 광원 좌상단, 5톤, 마지막 행 잉크(바닥 정렬), 다리는 feet() 공용. */
const GIRAFFE_BODY: readonly string[] = [
  EMPTY,
  row([19, "oo"], [27, "oo"]), // 뿔(오시콘) 끝
  row([18, "oAAo"], [26, "oAAo"]), // 혹
  row([19, "oo"], [27, "oo"]), // 대
  row([17, "oooooooooooooo"]), // 머리 윗선(x17~30)
  row([15, "ooHHbbbbbbbbBBdo"]),
  row([11, "ooo"], [14, "oHHbbbbbbbbbbBBddo"], [33, "ooo"]), // 귀 시작
  row([10, "obio"], [13, "oHHbbbbbbbbbbbBBdddo"], [33, "oido"]),
  row([10, "obio"], [13, "oHbbooobbbbooobBBddo"], [33, "oido"]), // 눈 윗선
  row([11, "ooo"], [13, "oHbowwwobboowwwoBddo"], [33, "ooo"]), // 눈(흰자)
  row([13, "obboLewwobboLewwoBddo"]), // 눈동자+하이라이트
  row([13, "obbowweeobbowweeoBddo"]),
  row([13, "obbboooccccoooBBBddo"]), // 눈 닫기 + 주둥이 시작
  row([14, "obbcccnncccCBBddo"]), // 콧구멍
  row([15, "obccccccccCCBdo"]),
  row([16, "ooocccccooooo"]), // 주둥이 아래 — 목으로 좁아진다
  row([19, "obbbBBdo"]), // 목 시작(8칸)
  row([19, "obbABBdo"]), // 목 반점(좌)
  row([19, "obbbBBdo"]),
  row([20, "obbBado"]), // 목 반점(우) — 목이 살짝 휜다
  row([20, "obbBBdo"]),
  row([20, "obAbBdo"]),
  row([21, "obbBdo"]),
  row([21, "obbBdo"]),
  row([21, "obABdo"]),
  row([21, "obbBdo"]),
  row([20, "obbbBdo"]), // 어깨로 벌어지기 시작
  row([19, "obbbBBddo"]),
  row([18, "obbbbBBdddo"]),
  row([16, "oobbbbbBBBdddoo"]),
  row([14, "oobbbbcccbBBBBdddoo"]), // 몸 시작 — 배(c)가 앞
  row([13, "obbbcccccccBBBBddddo"]),
  row([12, "obbccccccccccBBBBddddo"], [39, "oo"]), // 꼬리 시작
  row([12, "obccccccccccccBBBdddddo"], [38, "obo"]),
  row([11, "obccccccccccccccBBBddddDo"], [38, "obo"]),
  row([11, "obcccccccccccccccBBdddddDo"], [39, "obo"]),
  row([11, "obAccccccccccccccBBdddAdDo"], [39, "obo"]), // 몸 반점
  row([11, "obcccccccccccccccBBdddddDo"], [39, "oAAo"]), // 꼬리 술
  row([12, "obccccccccccccccBBddddDo"], [39, "oAao"]),
  row([12, "obbccccccccccccBBBdddDo"], [40, "oao"]),
  row([13, "obbccccccccccBBBdddDo"], [40, "oo"]),
  row([14, "obbbccccccccBBdddDo"]),
  row([15, "oobbbbccccBBddDoo"]),
  row([17, "oobbbbbbbdoo"]), // 43행 — 다리(44~47)는 feet() 가 채운다
  EMPTY, EMPTY, EMPTY, EMPTY,
];

/** 전용 골격 공통 — 6프레임, 걸음은 공용 feet()·GAIT(같은 박자로 걷는다). */
function bodyFrames(body: readonly string[], fur: string, pad: string): (pal: Palette) => Sprite[] {
  return (pal) =>
    Array.from({ length: GAIT_FRAMES }, (_, i) => ({
      w: W,
      h: 48,
      pal,
      rows: paint(body, feet(i, fur, pad)),
    }));
}
const giraffeFrames = bodyFrames(GIRAFFE_BODY, "b", "A");
const tigerFrames = (pal: Palette) => bodyFrames(TIGER_BODY, "b", "c")(pal);
const lionFrames = (pal: Palette) => bodyFrames(LION_BODY, "b", "c")(pal);

/** 꼬리 끝 흔들림 — 걸음과 같은 6박자. 뿌리는 고정, 끝 5행만 좌우 1px.
 *  ⚠ 여우·늑대만 흔든다. 고양이 꼬리는 24~34행이라 **얼굴 크롭 창(0~29행)** 을 침범해
 *    얼굴 아이콘이 프레임마다 떨린다. 곰·판다·부엉이·병아리는 꼬리가 없다. */
const TAIL_DX: readonly number[] = [0, 1, 1, 0, -1, -1];

export function petSprite48(sp: SpeciesPal, kind: PetKind): Sprite[] {
  const pal = petPalette(sp);
  // 신화형은 전용 골격 — 종은 실루엣이다(공용 BODY 리컬러는 사용자에게 퇴짜 맞았다)
  if (kind === "giraffe") return giraffeFrames(pal);
  if (kind === "tiger") return tigerFrames(pal);
  if (kind === "lion") return lionFrames(pal);
  const k = KIND[kind];
  const tipOf = k.tail.length ? bottomRows(k.tail, 5) : () => false;
  const mk = (phase: number): Sprite => {
    const tail = k.tailSway ? sway(k.tail, TAIL_DX[phase % TAIL_DX.length], tipOf) : k.tail;
    return {
      w: W,
      h: 48,
      pal,
      rows: paint(BODY, [...tail, ...k.ear, ...feet(phase, k.fur ?? "b", k.pad ?? "y"), ...k.mark]),
    };
  };
  // ⚠ phase 0 은 **서 있는 기준 자세**여야 한다. reduced-motion·비활성·점프 중·사냥 화면·
  //   꾸미기 풍경이 전부 0번 한 장만 쓴다 — 여기가 걷는 중간 자세면 앱 곳곳에서
  //   펫이 걷다 만 자세로 얼어붙는다.
  return Array.from({ length: GAIT_FRAMES }, (_, i) => mk(i));
}

/** 신화형 — 왕관 없이 **오라 반짝임만**. 왕관은 최종형의 문법이고, 신화형은 종 자체가
 *  보상이다(호랑이가 됐는데 왕관까지 씌우면 실루엣이 뭉갠다). 반짝임은 crowned 와 같은
 *  교대 문법 — 얼굴 크롭 창(x6~41) **바깥**에만 찍는다(프레임 간 얼굴 동일 lock). */
export type MythicAuraKind = "tiger" | "bengal" | "mudeung" | "lion" | "giraffe";

export function mythicAura(frames: Sprite[], kind: MythicAuraKind = "tiger"): Sprite[] {
  // 얼굴 크롭 창(x6~41)은 건드리지 않는다. 좌우 6px 에만 별자리 망토의 점·룬을 두어
  // 작은 아이콘은 깨끗하고, 큰 히어로에서는 신화 등급이 실루엣으로 보인다.
  const glyph: Record<MythicAuraKind, [string, string]> = {
    tiger: ["g", "p"],
    bengal: ["g", "s"],
    mudeung: ["k", "g"],
    lion: ["k", "p"],
    giraffe: ["p", "g"],
  };
  const [primary, accent] = glyph[kind];
  const STATIC: Patch = [
    [10, row([4, primary], [43, primary])],
    [11, row([3, primary + accent], [43, accent + primary])],
    [12, row([2, primary + primary + accent], [43, accent + primary + primary])],
    [16, row([1, accent + primary + primary + accent], [43, accent + primary + primary + accent])],
    [20, row([2, primary + accent + accent], [43, accent + accent + primary])],
    [24, row([1, primary + primary + accent + primary], [43, primary + accent + primary + primary])],
    [29, row([2, accent + primary + primary], [43, primary + primary + accent])],
    [34, row([3, primary + accent], [43, accent + primary])],
    [38, row([4, primary], [43, primary])],
  ];
  const A: Patch = [
    [6, row([2, "s"], [45, "s"])],
    [13, row([0, primary], [47, primary])],
    [27, row([3, accent], [44, accent])],
  ];
  const B: Patch = [
    [9, row([4, accent], [43, accent])],
    [20, row([1, "s"], [46, "s"])],
    [34, row([0, primary], [47, primary])],
  ];
  return frames.map((f, idx) => ({
    ...f,
    rows: paintEmpty(f.rows, [...STATIC, ...(idx % 2 === 0 ? A : B)]),
  }));
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
  // ⚠ `idx === 0` 이 아니라 `idx % 2` 다. 2프레임 시절엔 둘이 같은 말이었지만 6프레임에서
  //   전자는 1~5번이 전부 AURA_B 로 굳어 **반짝임이 아니라 가끔 한 번 튀는 점**이 된다.
  return frames.map((f, idx) => ({
    ...f,
    rows: paint(f.rows, [...CROWN, ...(idx % 2 === 0 ? AURA_A : AURA_B)]),
  }));
}

/** 최종형 전용 문장(紋章). 같은 왕관만 쓰던 12종에 각 이름의 상징을 더한다.
 * 얼굴 크롭 창 안쪽은 건드리지 않고 양 옆 여백에 배치해 작은 초상은 깨끗하게 유지한다. */
export function finalRegalia(frames: Sprite[], form: string): Sprite[] {
  const glyphs: Record<string, [string, string, string]> = {
    celestial_fox: ["k", "s", "k"], starlight_fox: ["p", "s", "p"],
    royal_cat: ["k", "g", "k"], lucky_cat: ["m", "g", "m"],
    guardian_bear: ["q", "k", "q"], honey_bear: ["y", "k", "y"],
    zen_panda: ["m", "w", "m"], dream_panda: ["p", "w", "p"],
    arcane_owl: ["p", "g", "p"], sage_owl: ["y", "w", "y"],
    lunar_wolf: ["p", "k", "p"], spirit_wolf: ["m", "s", "m"],
  };
  const [a, b, c] = glyphs[form] ?? ["k", "s", "k"];
  const STATIC: Patch = [
    [14, row([5, a], [42, a])],
    [18, row([4, a + b], [42, b + a])],
    [23, row([5, c], [42, c])],
    [29, row([4, b + a], [42, a + b])],
    [35, row([5, a], [42, a])],
  ];
  const TWINKLE: Patch[] = [
    [[9, row([5, "s"], [42, "s"])]],
    [[26, row([4, b], [43, b])]],
  ];
  return crowned(frames).map((f, idx) => ({
    ...f,
    rows: paintEmpty(f.rows, [...STATIC, ...TWINKLE[idx % 2]]),
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
  // 신화형 수면 — 호랑이=둥근 귀(곰과 동형), 사자=갈기 언덕, 기린=뿔이 빼꼼
  tiger: [row([10, "oooo"], [31, "oooo"]), row([9, "obHHbo"], [30, "odddDo"]), row([9, "obiibo"], [30, "obiiDo"]), row([9, "obbbbo"], [30, "oddDDo"]), row([10, "obbb"], [31, "ddo"])],
  lion: [row([11, "AAA"], [18, "AA"], [30, "aaa"]), row([9, "AAAAA"], [16, "AAAA"], [28, "aaaaa"]), row([8, "AAAAAAA"], [16, "AAAAA"], [27, "aaaaaaa"]), row([8, "AAAAAAAA"], [28, "aaaaaaaa"]), row([9, "AAAAAA"], [29, "aaaaaa"])],
  giraffe: [row([13, "oo"], [19, "oo"]), row([12, "oAAo"], [18, "oAAo"]), row([13, "oo"], [19, "oo"]), EMPTY, EMPTY],
};

export function sleepSprite48(sp: SpeciesPal, kind: PetKind = "chick"): Sprite {
  return {
    w: W,
    h: 48,
    pal: petPalette(sp),
    rows: bottomAlign([...SLEEP_EARS[kind], ...CURL]),
  };
}
