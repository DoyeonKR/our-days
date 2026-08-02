// 32×32 펫 스프라이트 — "디자이너가 그린 것"과 "초보가 찍은 것"의 차이를 구조로 강제한다.
//
// 1차 시도(해상도만 2배)가 실패한 이유를 먼저 적어둔다. 실제로 PNG 로 뽑아 보니:
//   · 8종이 **같은 둥근 덩어리 몸통** — 색과 귀만 달라 종이 구분되지 않았다.
//   · 귀가 머리에서 **떠 있었고**(곰/부엉이), 발이 몸에 붙지 않고 대롱거렸다.
//   · 주둥이·부리·눈두덩·꼬리 같은 **종의 정체성**이 아예 없었다.
// 즉 문제는 해상도가 아니라 **드로잉**이었다. 그래서 이 파일은 이렇게 짠다:
//
//   공용 골격(BODY: 머리+몸통+발) ── 정확한 실루엣과 5톤 셰이딩을 한 번만 제대로 그린다
//        └ 종별 오버레이(paint): 귀 · 마킹(눈두덩/부리/줄무늬) · 꼬리
//
// 오버레이는 base 위에 '.' 이 아닌 글자만 덮어쓴다 → 귀가 머리를 **파고들어** 붙는다(떠 있지 않음).
//
// ⚠ 저작 안전장치: 행을 점(.)으로 채워 손으로 세지 않는다. `row([x, "문자열"], …)` 런으로만
//    적는다. 예전에 dot 하나 빠져 아트가 통째로 1px 밀린 사고가 있었고, 눈으로는 못 잡는다.
//    row() 는 항상 32칸을 만들고, paint() 는 길이가 어긋난 패치를 즉시 throw 한다.
//
// 규약: 광원 **좌상단**(SVG 아트와 동일). 하이라이트 왼쪽 위, 깊은 그늘 오른쪽 아래.
// 글자: o 외곽선 · H 하이라이트 · b 밝음 · B 기본 · d 그늘 · D 깊은그늘
//       c 배/주둥이 · C 배 그늘 · i 귀안쪽 · e 눈동자 · L 눈 하이라이트 · w 수염/흰색
//       p 볼터치 · n 코 · m 입 · y 발바닥 · A 마킹 · a 마킹그늘 · q 부리 · Q 부리그늘
//       k 왕관 · K 왕관그늘 · s 반짝임 · '.' 투명

import { type Palette, type Sprite, ramp } from "./pixel";

/** 종 정의 — 몸 3톤 + 배 3톤 + 귀안쪽(+선택: 마킹·부리·눈색). PAL 값을 그대로 받는다. */
export type SpeciesPal = {
  body: readonly string[];
  belly: readonly string[];
  inner: readonly string[];
  eye?: string;
  mark?: readonly string[]; // 판다 눈두덩·귀 같은 대비 마킹
  beak?: readonly string[]; // 부엉이/병아리 부리
};

export function petPalette(sp: SpeciesPal): Palette {
  const B = ramp(sp.body);
  const C = ramp(sp.belly);
  const M = ramp(sp.mark ?? sp.body);
  const Q = ramp(sp.beak ?? ["#ffe08a", "#ffc93f", "#e0a02e"]);
  return {
    o: B.o,
    H: B.H,
    b: B.b,
    B: B.B,
    d: B.d,
    D: B.D,
    c: C.b,
    C: C.d,
    i: sp.inner[1],
    e: sp.eye ?? "#2b2440",
    w: "#fffdf7",
    L: "#ffffff",
    p: "#ff9fb8",
    n: B.D,
    m: B.o,
    y: C.d,
    A: M.B,
    a: M.D,
    q: Q.B,
    Q: Q.d,
    k: "#ffd75e",
    K: "#c8901c",
    s: "#fff3b0",
  };
}

/* ── 저작 도구 ─────────────────────────────────────────────────── */

/** 32칸 행 — [시작x, 문자들] 런으로만 적는다(점 세기 사고 방지). */
function row(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(32).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= 32) throw new Error(`row: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
}

type Patch = readonly (readonly [number, string])[];

/** base 위에 패치를 덮는다 — '.' 은 base 유지. 길이가 32 가 아니면 즉시 실패. */
function paint(base: readonly string[], patches: readonly (readonly [number, string])[]): string[] {
  const out = [...base];
  for (const [y, s] of patches) {
    if (s.length !== 32) throw new Error(`paint: ${y}행 길이 ${s.length} (32 이어야)`);
    if (y < 0 || y >= out.length) throw new Error(`paint: y=${y} 범위 밖`);
    const r = out[y].split("");
    for (let x = 0; x < 32; x++) if (s[x] !== ".") r[x] = s[x];
    out[y] = r.join("");
  }
  return out;
}

const EMPTY = row();

/* ── 공용 골격 ──────────────────────────────────────────────────
 * 치비 비율: 큰 머리(r5~19) + 좁은 몸통(r19~28) + 발(r29~30). 목은 없다.
 * 왼쪽 위가 밝고(H·b) 오른쪽 아래로 갈수록 어둡다(B·d·D). 배는 c/C 로 따로 셰이딩. */
const BODY: readonly string[] = [
  EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
  row([11, "oooooooooo"]),
  row([9, "oHHbbbbbBBBBdo"]),
  row([8, "oHHHbbbbbBBBBBdo"]),
  row([7, "oHHHbbbbbbBBBBBBdo"]),
  row([6, "oHHbbbbbbbBBBBBBBddo"]),
  row([6, "oHbbbbbbbbBBBBBBBddo"]),
  row([5, "obbboobbbbbbBBBBooBBdo"]), // 눈 윗선
  row([5, "obboLeobbbbbBBBoLeoBdo"]), // 눈: 하이라이트(L)는 광원 쪽 = 왼쪽 위
  row([5, "obboeeobbbbBBBBoeeoBdo"]),
  row([5, "oppboobbcccccCBBooBppo"]), // 볼터치 + 주둥이 시작
  row([6, "oppbbbccnnnccCBBBppo"]), // 코
  row([6, "obbbbcccmmmccCBBBBdo"]), // 입
  row([7, "obbbcccccccCCBBBdo"]),
  row([8, "obbbbcccccCBBBdo"]),
  row([10, "obbbbbBBBBBo"]), // 턱 = 몸통 시작(목 없음)
  row([9, "obbbccccccCBdo"]),
  row([8, "obbbcccccccCCBdo"]),
  row([7, "obbbccccccccCCBBdo"]),
  row([7, "obbbccccccccCCBBdo"]),
  row([7, "obbbccccccccCCBBdo"]),
  row([8, "obbcccccccCCBBdo"]),
  row([8, "obbcccccccCCBBdo"]),
  row([9, "obbcccccCCBBdo"]),
  row([10, "obbccccCBBdo"]),
  EMPTY, EMPTY, EMPTY,
];

/** 발 — 2행짜리 다리+발바닥. 1행 발은 실루엣에 묻혀 걷기 애니가 아예 안 보였다.
 *  fur/pad 를 종이 지정한다(판다=검은 발, 부엉이=발톱). step 이 발 위치를 1px 벌린다. */
function feet(step: boolean, fur: string, pad: string): Patch {
  const L = step ? 10 : 9;
  const R = step ? 17 : 18;
  const gap = step ? [15, "oo"] as const : [14, "oooo"] as const;
  const leg = `o${fur.repeat(3)}o`;
  const sole = `o${pad.repeat(3)}o`;
  return [
    [29, row([L, leg], gap, [R, leg])],
    [30, row([L, sole], [R, sole])],
    [31, row([L + 1, "ooo"], [R + 1, "ooo"])],
  ];
}

/* ── 귀 — 종을 한눈에 가르는 실루엣. 머리를 파고들어 붙는다. ───────── */

const EAR_FOX: Patch = [
  [0, row([8, "o"], [23, "o"])],
  [1, row([7, "obo"], [22, "odo"])],
  [2, row([6, "obHbo"], [21, "oddDo"])],
  [3, row([6, "obHibo"], [20, "odidDo"])],
  [4, row([5, "obHiibbo"], [19, "odiiddDDo"])],
  [5, row([5, "obbiibb"], [20, "diiddDDo"])],
  [6, row([5, "obbbbb"], [21, "ddDDo"])],
  [7, row([6, "obbb"], [23, "dDo"])],
];

const EAR_CAT: Patch = [
  [0, row([7, "o"], [24, "o"])],
  [1, row([6, "obo"], [23, "odo"])],
  [2, row([6, "obio"], [22, "oido"])],
  [3, row([5, "obHiio"], [21, "oiidDo"])],
  [4, row([5, "obbiibo"], [20, "oiiddDo"])],
  [5, row([5, "obbbibb"], [20, "diddDDo"])],
  [6, row([6, "obbbb"], [21, "ddDDo"])],
  [7, row([7, "obb"], [23, "dDo"])],
];

const EAR_ROUND: Patch = [
  [2, row([6, "ooo"], [23, "ooo"])],
  [3, row([5, "obHbo"], [22, "oddDo"])],
  [4, row([5, "obiibo"], [21, "oiidDo"])],
  [5, row([5, "obiibb"], [21, "iidDDo"])],
  [6, row([6, "obbbb"], [21, "ddDDo"])],
  [7, row([7, "obb"], [23, "dDo"])],
];

/** 판다용 — 같은 둥근 귀지만 **검은 귀**(마킹색). 판다의 정체성. */
const EAR_ROUND_DARK: Patch = [
  [2, row([6, "ooo"], [23, "ooo"])],
  [3, row([5, "oAAAo"], [22, "oAaao"])],
  [4, row([5, "oAAAAo"], [21, "oAAaao"])],
  [5, row([5, "oAAAAA"], [21, "AAaaao"])],
  [6, row([6, "oAAAA"], [21, "aaaao"])],
  [7, row([7, "oAA"], [23, "aao"])],
];

/** 부엉이 깃뿔 — 삼각이 아니라 깃털 다발. */
const EAR_TUFT: Patch = [
  [1, row([7, "o"], [24, "o"])],
  [2, row([6, "obo"], [23, "odo"])],
  [3, row([5, "obbo"], [23, "odDo"])],
  [4, row([5, "obbbo"], [22, "oddDo"])],
  [5, row([5, "obbbbbb"], [20, "ddddDDo"])],
  [6, row([6, "obbbb"], [21, "ddDDo"])],
  [7, row([7, "obb"], [23, "dDo"])],
];

/** 병아리 — 귀 대신 정수리 깃털 한 가닥. */
const EAR_NONE: Patch = [
  [1, row([15, "oo"])],
  [2, row([14, "oHbo"])],
  [3, row([14, "obbo"])],
  [4, row([15, "oo"])],
];

/* ── 종별 마킹 — 색이 아니라 **모양**으로 구분되게 ─────────────── */

/** 여우: 볼 털 뭉치(양 볼 밖으로 삐침) + 흰 주둥이는 골격의 c 가 담당. */
const MARK_FOX: Patch = [
  [16, row([4, "oc"], [26, "co"])],
  [17, row([5, "occ"], [25, "cco"])],
  [18, row([6, "oc"], [25, "co"])],
];

/** 고양이: 수염 + 이마 줄무늬. */
const MARK_CAT: Patch = [
  [9, row([11, "AA"], [15, "AA"], [19, "AA"])],
  [10, row([12, "A"], [16, "A"], [20, "A"])],
  [15, row([2, "www"], [27, "www"])],
  [17, row([2, "www"], [27, "www"])],
];

/** 곰: 넓은 주둥이 + 큰 코. 눈 사이가 멀어 순한 인상. */
const MARK_BEAR: Patch = [
  [14, row([12, "cccccc"])],
  [15, row([11, "ccnnnncc"])],
  [16, row([11, "ccnmmncc"])],
  [17, row([11, "cccmmccc"])],
];

/** 판다: 눈두덩(눈을 감싸는 검은 얼룩) + 검은 팔. 판다의 90%. */
const MARK_PANDA: Patch = [
  [10, row([7, "AAAA"], [21, "aaaa"])],
  [11, row([6, "AAAooAAA"], [18, "aaaooaaa"])],
  [12, row([6, "AAoLeoAA"], [18, "aaoLeoaa"])],
  [13, row([6, "AAoeeoAA"], [18, "aaoeeoaa"])],
  [14, row([7, "AAooAA"], [19, "aaooaa"])],
  [15, row([8, "AAA"], [21, "aaa"])],
  [21, row([8, "AAA"], [21, "aaa"])],
  [22, row([7, "AAAA"], [21, "aaaa"])],
  [23, row([7, "AAAA"], [21, "aaaa"])],
  [24, row([7, "AAAA"], [21, "aaaa"])],
  [25, row([8, "AAA"], [21, "aaa"])],
];

/** 부엉이: 얼굴 원반 + 부리 + 날개. 발은 발톱. */
const MARK_OWL: Patch = [
  [10, row([8, "cccc"], [20, "cccc"])],
  [11, row([7, "cbbooccbbBBBBooBBc"])],
  [14, row([13, "cqqqqc"])],
  [15, row([6, "oppbbcccqqqccCBBBppo"])],
  [16, row([13, "cQQc"])],
  [20, row([9, "dd"], [21, "DD"])],
  [21, row([8, "ddd"], [21, "DDD"])],
  [22, row([7, "dddd"], [21, "DDDD"])],
  [23, row([7, "dddd"], [21, "DDDD"])],
  [24, row([7, "dddd"], [21, "DDDD"])],
  [25, row([8, "ddd"], [21, "DDD"])],
];

/** 늑대: 가슴 갈기(뾰족한 털) + 이마 V. 여우와 같은 귀지만 인상이 다르다. */
const MARK_WOLF: Patch = [
  [9, row([13, "AAAAAA"])],
  [10, row([14, "AAAA"])],
  [20, row([10, "ccc"], [19, "ccc"])],
  [21, row([9, "cc"], [21, "cc"])],
];

/** 병아리: 부리 + 작은 날개. 코/입 대신 부리. */
const MARK_CHICK: Patch = [
  [15, row([6, "oppbbbccqqqccCBBBppo"])],
  [16, row([6, "obbbbcccQQQccCBBBBdo"])],
  [21, row([9, "cc"], [21, "cc"])],
  [22, row([8, "ccc"], [21, "ccc"])],
  [23, row([8, "ccc"], [21, "ccc"])],
];

/* ── 꼬리 — 몸통 오른쪽에서 이어 나온다(붙어 있어야 한다) ────────── */

/** 여우: 크고 풍성 + 흰 꼬리끝(여우의 표식). */
const TAIL_FOX: Patch = [
  [21, row([24, "oo"])],
  [22, row([23, "oBbo"])],
  [23, row([23, "BBbbo"])],
  [24, row([23, "BBbcco"])],
  [25, row([23, "BBbccco"])],
  [26, row([23, "dBbccco"])],
  [27, row([23, "ddDccDo"])],
  [28, row([24, "ooDDo"])],
];

/** 늑대: 여우와 같은 크기지만 끝까지 회색(흰 끝 없음) — 계보는 같고 표식이 다르다. */
const TAIL_WOLF: Patch = [
  [21, row([24, "oo"])],
  [22, row([23, "oBbo"])],
  [23, row([23, "BBbdo"])],
  [24, row([23, "BBbddo"])],
  [25, row([23, "BBbdddo"])],
  [26, row([23, "dBbdddo"])],
  [27, row([23, "ddDDDDo"])],
  [28, row([24, "ooDDo"])],
];

/** 고양이: 가늘고 위로 말린 꼬리. */
const TAIL_CAT: Patch = [
  [17, row([27, "oo"])],
  [18, row([26, "oBbo"])],
  [19, row([26, "oBdo"])],
  [20, row([25, "oBdo"])],
  [21, row([24, "oBdo"])],
  [22, row([24, "oBdo"])],
  [23, row([24, "oddo"])],
  [24, row([25, "oo"])],
];

/* ── 종 조립 ────────────────────────────────────────────────────── */

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

/** 종 스프라이트 2프레임(걷기 — 다리 교차, 상하 흔들림은 렌더러의 bob 담당). */
export function petSprite32(sp: SpeciesPal, kind: PetKind): Sprite[] {
  const pal = petPalette(sp);
  const k = KIND[kind];
  // 꼬리 → 귀 → 다리 → 마킹 순서. 마킹이 마지막이라 얼굴 특징이 절대 가려지지 않는다.
  const mk = (step: boolean): Sprite => ({
    w: 32,
    h: 32,
    pal,
    rows: paint(BODY, [...k.tail, ...k.ear, ...feet(step, k.fur ?? "b", k.pad ?? "y"), ...k.mark]),
  });
  return [mk(true), mk(false)];
}

/** 최종형 — 진짜 왕관(뾰족 3점 + 띠 + 보석 그늘). 옛 버전은 노란 점선이라 왕관으로 안 읽혔다. */
export function crowned(frames: Sprite[]): Sprite[] {
  const CROWN: Patch = [
    [2, row([11, "k"], [15, "k"], [19, "k"])],
    [3, row([11, "kKkkkkkKk"])],
    [4, row([10, "okkkkkkkkko"])],
    [5, row([10, "oKKKKKKKKKo"])],
  ];
  return frames.map((f, idx) => ({
    ...f,
    rows: paint(f.rows, [
      ...CROWN,
      ...(idx === 0 ? ([[1, row([7, "s"], [24, "s"])]] as Patch) : []),
    ]),
  }));
}

/** 알 — 매끈한 구체 셰이딩(램프가 가장 잘 드러나는 형태). */
export function eggSprite32(sp: SpeciesPal, tilt: boolean): Sprite {
  const pal = petPalette(sp);
  const rows = [
    EMPTY, EMPTY,
    row([12, "oooooo"]),
    row([10, "ooHHbbbboo"]),
    row([9, "oHHHbbbbbBBo"]),
    row([8, "oHHbbbbbbbBBBo"]),
    row([7, "oHHbbbbbbbbBBBBo"]),
    row([7, "oHbbbbbbbbbBBBBdo"]),
    row([6, "oHbbbbbbbbbbBBBBddo"]),
    row([6, "obbbbbbbbbbbBBBBddo"]),
    row([6, "obbbbbbbbbbbBBBBdddo"]),
    row([5, "obbbbbbbbbbbbBBBBdddo"]),
    row([5, "obbbbbbbbbbbbBBBBdddo"]),
    row([5, "obbbbbbbbbbbbBBBBdddo"]),
    row([5, "obbbbbbbbbbbbBBBBdddo"]),
    row([5, "obbbbbbbbbbbbBBBBdddo"]),
    row([5, "obbbbbbbbbbbbBBBBdddo"]),
    row([6, "obbbbbbbbbbBBBBBdddo"]),
    row([6, "obbbbbbbbbbBBBBBddo"]),
    row([6, "obbbbbbbbbBBBBBBddo"]),
    row([7, "obbbbbbbBBBBBBddo"]),
    row([7, "oobbbbbBBBBBdddo"]),
    row([8, "ooBBBBBBBdddoo"]),
    row([10, "oooooooooo"]),
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
  ];
  return {
    w: 32,
    h: 32,
    pal,
    rows: tilt ? rows.map((r) => (r.trim() === "" ? r : "." + r.slice(0, 31))) : rows,
  };
}

/** 잠자는 포즈 — 웅크리고 눈 감음(∪ 모양 감은 눈) + 귀.
 *  귀가 없으면 그냥 '식빵 덩어리'로 보인다(1차 시도의 실패 지점). */
export function sleepSprite32(sp: SpeciesPal): Sprite {
  return {
    w: 32,
    h: 32,
    pal: petPalette(sp),
    rows: [
      EMPTY, EMPTY, EMPTY, EMPTY,
      row([10, "oo"], [20, "oo"]),
      row([9, "obbo"], [19, "oddo"]),
      row([9, "obibo"], [18, "odido"]),
      row([9, "obbbb"], [18, "ddddo"]),
      row([10, "oooooooooooo"]),
      row([8, "ooHHbbbbbBBBBddoo"]),
      row([7, "oHHbbbbbbbbBBBBBddo"]),
      row([6, "oHbbbbbbbbbbbBBBBBddo"]),
      row([6, "obbbooobbbbboooBBBBddo"]),
      row([6, "obbbbbbbbbbbbbbbBBBddo"]),
      row([6, "obbppbbbbnnbbbppBBBddo"]),
      row([6, "obbbbbbbbmmbbbbbBBBddo"]),
      row([5, "obbbcccccccccccCBBBBddo"]),
      row([5, "obbccccccccccccCCBBBddo"]),
      row([5, "obbccccccccccccCCBBBddo"]),
      row([6, "obbcccccccccccCCBBddo"]),
      row([6, "oobbbcccccccCCCBBddo"]),
      row([8, "oobbbbbbBBBBBddoo"]),
      row([10, "oooooooooooo"]),
      EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    ],
  };
}
