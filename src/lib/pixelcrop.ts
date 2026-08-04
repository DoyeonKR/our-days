// 작물·가공품 픽셀 스프라이트 — 24×24.
//
// 왜 24×24 인가: 밭 한 칸/창고 셀에서 실제로 쓰이는 크기가 32~48 CSS px 다. 32×32 로 그리면
// 1배율에서 스프라이트가 셀보다 커지고, 2배율은 셀을 넘긴다. 24 면 1배율 24px·2배율 48px 로
// 두 자리에 정확히 맞는다(정수배 = 도트가 뭉개지지 않는 유일한 조건).
//
// 성장 4단계 설계: 0~1 단계는 어느 작물이든 **흙에서 올라온 새싹**이라 형태가 같다(농사 게임의
// 관례이기도 하다). 그래서 0·1 은 잎색만 갈아끼운 공용 스프라이트를 쓰고, 2·3 만 작물별로
// 그린다. 32장을 다 손으로 찍는 대신 18장만 그리고도 단계가 또렷하게 구분된다.
//
// ⚠ 행은 `r([x, "문자열"])` 런으로만 적는다 — 점(.)을 손으로 세면 하나 빠져도 눈에 안 보이는
//    채로 아트가 통째로 밀린다(펫 아트에서 실제로 겪음). r() 은 항상 24칸을 만든다.

import { type Palette, type Sprite, ramp } from "./pixel.ts";
import { PIXEL_PAL } from "./pixelart.ts";

const W = 24;

/** 24칸 행 — [시작x, 문자들] 런으로만. */
function r(...runs: readonly (readonly [number, string])[]): string {
  const a = new Array<string>(W).fill(".");
  for (const [x0, s] of runs) {
    for (let i = 0; i < s.length; i++) {
      const x = x0 + i;
      if (x < 0 || x >= W) throw new Error(`crop row: x=${x} 범위 밖 ("${s}")`);
      a[x] = s[i];
    }
  }
  return a.join("");
}

const BLANK = r();

/** 작물 팔레트 — 열매(f 계열) + 잎(g 계열) + 흙(u). 색은 PAL 그대로(일러스트와 같은 세계). */
function cropPal(fruit: readonly string[], leaf: readonly string[] = PIXEL_PAL.leaf): Palette {
  const F = ramp(fruit);
  const G = ramp(leaf);
  const U = ramp(PIXEL_PAL.brown);
  return {
    o: F.o, H: F.H, f: F.b, F: F.B, d: F.d, D: F.D,
    e: G.o, h: G.H, g: G.b, G: G.B, k: G.d, K: G.D,
    u: U.d, U: U.o, s: "#fff3b0",
  };
}

/* ── 공용 초기 성장 ────────────────────────────────────────────
 * 0 = 갓 심은 씨앗(흙 두둑 + 떡잎 한 장), 1 = 자란 새싹(잎 두 장 + 줄기). */
const SPROUT0: string[] = [
  ...Array(15).fill(BLANK),
  r([11, "eh"]),
  r([10, "egGe"]),
  r([10, "eGke"]),
  r([11, "gk"]),
  r([11, "gk"]),
  r([8, "uUuuuuuUu"]),
  r([8, "UuuuuuuuU"]),
  BLANK,
  BLANK,
];

const SPROUT1: string[] = [
  ...Array(8).fill(BLANK),
  // 봉오리 — 작물 색 힌트. 이게 없으면 8종의 1단계가 전부 똑같아 뭘 심었는지 알 수 없다.
  r([11, "oo"]),
  r([11, "fF"]),
  // 잎은 한 쌍만 — 1단계는 아직 어리다. 여기가 무성하면 2단계보다 잎이 많아져
  // "자랄수록 커진다"가 깨진다(pixelcrop.test.ts 가 잉크량으로 감시).
  r([9, "eh"], [14, "he"]),
  r([8, "ehgGe"], [13, "eGghe"]),
  r([9, "eGke"], [13, "ekGe"]),
  r([11, "gk"]),
  r([11, "gk"]),
  r([11, "gk"]),
  r([10, "egke"]),
  r([8, "uUuuuuuUu"]),
  r([8, "UuuuuuuuU"]),
  BLANK,
  BLANK,
];

/* ── 작물별 성숙 단계(2 = 열매 맺힘, 3 = 수확 가능) ────────────
 * 2 단계는 열매를 작게/덜 익은 톤(d)으로, 3 단계는 크고 하이라이트(H)까지 넣어
 * "지금 수확해야 한다"가 한눈에 보이게 한다. */

/** 딸기 — 아래로 매달린 하트형 열매 + 씨앗 점. */
const STRAWBERRY: [string[], string[]] = [
  [
    ...Array(8).fill(BLANK),
    r([8, "eh"], [15, "he"]),
    r([6, "ehgGe"], [14, "eGghe"]),
    r([5, "eggGke"], [14, "ekGgge"]),
    r([7, "eGke"], [14, "ekGe"]),
    r([10, "egk"], [13, "kge"]),
    r([11, "gk"]),
    r([10, "odDo"]),
    r([10, "dDDd"]),
    r([11, "dD"]),
    r([11, "gk"]),
    r([10, "egke"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK,
  ],
  [
    ...Array(6).fill(BLANK),
    r([8, "eh"], [15, "he"]),
    r([6, "ehgGe"], [14, "eGghe"]),
    r([5, "eggGke"], [14, "ekGgge"]),
    r([7, "eGke"], [14, "ekGe"]),
    r([9, "egk"], [13, "kge"]),
    r([9, "ekgGke"]),
    r([8, "oHffFDo"]),
    r([7, "oHfsffFDo"]),
    r([7, "ofsfffsFo"]),
    r([7, "offsfFFDo"]),
    r([8, "ofFsFDo"]),
    r([9, "oFDDo"]),
    r([10, "oDo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK,
  ],
];

/** 당근 — 흙 위로 어깨만 보이는 뿌리채소(잎 다발이 크다). */
const CARROT: [string[], string[]] = [
  [
    ...Array(6).fill(BLANK),
    r([7, "e"], [11, "e"], [15, "e"]),
    r([6, "ehe"], [10, "ehe"], [14, "ehe"]),
    r([6, "ghGk"], [10, "ghGk"], [14, "ghGk"]),
    r([6, "egGkke"], [12, "eGkke"], [17, "e"]),
    r([8, "egGkke"], [14, "kke"]),
    r([10, "egGke"]),
    r([11, "gGk"]),
    r([11, "gGk"]),
    r([10, "egGke"]),
    r([10, "odDo"]),
    r([8, "uUuudDuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK, BLANK,
  ],
  [
    ...Array(5).fill(BLANK),
    r([7, "e"], [11, "e"], [16, "e"]),
    r([6, "ehe"], [10, "ehe"], [15, "ehe"]),
    r([6, "ghGk"], [10, "ghGk"], [15, "gGkk"]),
    r([7, "gGk"], [11, "gGk"], [14, "gGk"]),
    r([8, "egGke"], [13, "egGke"]),
    r([10, "egGke"]),
    r([11, "gGk"]),
    r([9, "oHffFDo"]),
    r([9, "oHffFDo"]),
    r([9, "offfFDo"]),
    // ⚠ 뿌리를 흙 아래로 더 내리지 않는다 — 스프라이트가 흙보다 아래에서 끝나면 mk() 의
    //    바닥 정렬 때문에 **이 작물만 흙 띠가 위로 밀려** 성장 단계에서 지면이 튄다
    //    (2026-08-03 적대 검증: 당근 3단계에서 4px 점프 확정). 흙 띠가 항상 마지막이다.
    r([9, "ofFFDo"]),
    r([8, "uUuoFDoUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK, BLANK, BLANK,
  ],
];

/** 토마토 — 지지대 줄기에 둥근 열매 두 개. */
const TOMATO: [string[], string[]] = [
  [
    ...Array(6).fill(BLANK),
    r([11, "eh"]),
    r([9, "ehgGe"], [14, "e"]),
    r([8, "eggGke"], [13, "ehge"]),
    r([9, "eGke"], [13, "gGke"]),
    r([11, "gk"]),
    r([9, "odDo"]),
    r([9, "dDDd"]),
    r([10, "dD"]),
    r([11, "gk"]),
    r([10, "egke"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK, BLANK, BLANK,
  ],
  [
    ...Array(4).fill(BLANK),
    r([11, "eh"]),
    r([9, "ehgGe"], [15, "e"]),
    r([8, "eggGke"], [14, "ehge"]),
    r([9, "eGke"], [14, "gGke"]),
    r([11, "gk"], [15, "ek"]),
    r([6, "oHffFDo"], [14, "ogke"]),
    r([5, "oHfffFFDo"], [13, "oHfFDo"]),
    r([5, "offfffFDo"], [12, "oHffFDo"]),
    r([5, "offffFFDo"], [12, "offFFDo"]),
    r([6, "ofFFDDo"], [13, "ofFDo"]),
    r([7, "oDDo"], [14, "oDo"]),
    r([11, "gk"]),
    r([10, "egke"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK, BLANK,
  ],
];

/** 옥수수 — 길쭉한 대 + 알갱이 이삭. */
const CORN: [string[], string[]] = [
  [
    ...Array(6).fill(BLANK),
    r([11, "ehe"]),
    r([9, "ehggGe"]),
    r([8, "eggGkke"], [15, "e"]),
    r([9, "egGke"], [14, "ehe"]),
    r([10, "egGke"], [14, "gke"]),
    r([11, "gGk"]),
    r([11, "gGk"]),
    r([11, "gGk"]),
    r([10, "egGke"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK, BLANK, BLANK,
  ],
  [
    ...Array(3).fill(BLANK),
    r([11, "ehe"]),
    r([9, "ehggGe"]),
    r([7, "eggGkke"], [16, "e"]),
    r([8, "egGke"], [15, "ehe"]),
    r([6, "ekge"], [10, "oHFo"], [15, "gke"]),
    r([6, "egk"], [9, "oHffFo"], [15, "ek"]),
    r([7, "gk"], [9, "ofHffFo"], [16, "e"]),
    r([8, "e"], [9, "offfffo"]),
    r([9, "oHfffFo"]),
    r([9, "offffFo"]),
    r([9, "ofFfFDo"]),
    r([9, "oFFFDo"], [15, "e"]),
    r([10, "oFDDo"], [14, "ehe"]),
    r([10, "oDDo"], [14, "gke"]),
    r([11, "gGk"]),
    r([10, "egGke"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK,
  ],
];

/** 호박 — 땅에 앉은 큰 열매 + 골. */
const PUMPKIN: [string[], string[]] = [
  [
    ...Array(9).fill(BLANK),
    r([11, "eh"]),
    r([9, "ehgGe"], [14, "e"]),
    r([8, "eggGke"], [13, "ehge"]),
    r([9, "eGkke"], [13, "ggke"]),
    r([11, "gk"]),
    r([9, "oddDo"]),
    r([8, "odDDDdo"]),
    r([9, "oddDo"]),
    r([7, "uUuuuuuuuUu"]),
    r([7, "UuuuuuuuuuU"]),
    BLANK, BLANK, BLANK,
  ],
  [
    ...Array(6).fill(BLANK),
    r([11, "eh"]),
    r([9, "ehgGe"], [14, "e"]),
    r([8, "eggGke"], [13, "ehge"]),
    r([9, "eGkke"], [13, "ggke"]),
    r([11, "gk"]),
    r([7, "ooHffFDoo"]),
    r([5, "oHffdffdFFDo"]),
    r([4, "oHfffdffdFFFDo"]),
    r([4, "offffdffdFFFDo"]),
    r([4, "offffdffdFFFDo"]),
    r([4, "ofFFFdFFdFFDDo"]),
    r([5, "oFFFdFFdFFDo"]),
    r([7, "ooDDDDDoo"]),
    r([6, "uUuuuuuuuUu"]),
    r([6, "UuuuuuuuuuU"]),
    BLANK, BLANK,
  ],
];

/** 포도 — 덩굴에 매달린 송이(알갱이 계단). */
const GRAPE: [string[], string[]] = [
  [
    ...Array(5).fill(BLANK),
    r([6, "eeh"], [14, "hee"]),
    r([5, "ehggGe"], [13, "eGgghe"]),
    r([6, "eGkke"], [14, "ekkGe"]),
    r([11, "gk"]),
    r([10, "oddo"]),
    r([10, "dDDd"]),
    r([11, "dd"]),
    r([11, "gk"]),
    r([10, "egke"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK, BLANK, BLANK, BLANK,
  ],
  [
    ...Array(4).fill(BLANK),
    r([5, "eeh"], [15, "hee"]),
    r([4, "ehggGe"], [14, "eGgghe"]),
    r([5, "eGkke"], [15, "ekkGe"]),
    r([11, "gk"]),
    r([8, "oHfoFDo"]),
    r([7, "oHffoFFDo"]),
    r([7, "ofoffoFDo"]),
    r([8, "oHffoFDo"]),
    r([8, "ofoffFDo"]),
    r([9, "oHfFDo"]),
    r([9, "ofFDDo"]),
    r([10, "oFDo"]),
    r([11, "oo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK,
  ],
];

/** 양배추 — 겹겹이 말린 잎 공. */
const CABBAGE: [string[], string[]] = [
  [
    ...Array(10).fill(BLANK),
    r([9, "eh"], [14, "he"]),
    r([7, "ehgGe"], [13, "eGghe"]),
    r([7, "eGkke"], [13, "ekkGe"]),
    r([9, "oddDo"]),
    r([8, "odDDDdo"]),
    r([9, "oddDo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK, BLANK, BLANK,
  ],
  [
    ...Array(6).fill(BLANK),
    r([8, "eeh"], [14, "hee"]),
    r([6, "ehggGe"], [13, "eGgghe"]),
    r([6, "ekkGe"], [15, "eGkke"]),
    r([8, "ooHffFDoo"]),
    r([6, "oHfffFFFDDo"]),
    r([5, "oHffoffoFFDo"]),
    r([5, "offfoffoFFDo"]),
    r([5, "offffffFFFDo"]),
    r([6, "ofFFoFFoFDo"]),
    r([6, "oFFFFFFFDDo"]),
    r([8, "ooDDDDoo"]),
    r([7, "uUuuuuuuuUu"]),
    r([7, "UuuuuuuuuuU"]),
    BLANK, BLANK, BLANK,
  ],
];

/** 버섯 — 갓 + 대. 잎 대신 흙 위 무리. */
const MUSHROOM: [string[], string[]] = [
  [
    ...Array(10).fill(BLANK),
    r([9, "oddddo"]),
    r([8, "odDDDDdo"]),
    r([8, "oddDDDdo"], [17, "oo"]),
    r([10, "ohho"], [16, "oddo"]),
    r([10, "ohho"], [16, "ohho"]),
    r([10, "ohho"], [16, "ohho"]),
    r([9, "eghhke"], [15, "eghke"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
    BLANK, BLANK,
  ],
  [
    ...Array(7).fill(BLANK),
    r([8, "ooHffFoo"]),
    r([6, "oHfsffFFDo"]),
    r([5, "oHffffsfFFDo"]),
    r([5, "offsffffFFDo"]),
    r([6, "oFFFFFFDDo"], [16, "oo"]),
    r([8, "ohhhho"], [15, "odDo"]),
    r([8, "ohhhho"], [15, "ohho"]),
    r([8, "ohhhho"], [15, "ohho"]),
    r([8, "eghhke"], [14, "eghke"]),
    r([7, "uUuuuuuuuUu"]),
    r([7, "UuuuuuuuuuU"]),
    BLANK, BLANK, BLANK,
  ],
];

/** 무등산수박(푸랭이) — **무늬 없는 진초록 타원**. 줄무늬를 그리면 그냥 흔한 수박이 된다.
 *  일반 수박의 2~3배(10~30kg)라 3단계는 밭 칸을 21×13 칸으로 꽉 채운다 — 크기가 곧 이 품종의 자랑.
 *  한 행의 톤은 왼→오 단조 증가(H→f→F→d→D)로만 간다. 이게 구면감을 만들고, 동시에
 *  '밝은 면 사이에 어두운 열이 끼어드는' 줄무늬가 되살아나는 걸 구조적으로 막는다. */
const WATERMELON: [string[], string[]] = [
  // 2단계 — 덩굴에 달린 애호박만 한 크기. 이때부터 이미 무늬가 없다.
  [
    r([11, "eh"]),
    r([9, "ehgGe"], [14, "e"], [19, "s"]),
    r([8, "eggGke"], [13, "ehge"]),
    r([9, "eGkke"], [13, "ggke"]),
    r([11, "gk"]),
    r([9, "oHHffFo"]),
    r([7, "oHHfffFFFdo"]),
    r([6, "oHffffFFFFdDo"]),
    r([6, "offffFFFFddDo"]),
    r([6, "offfFFFFddDDo"]),
    r([7, "ofFFFFddDDo"]),
    r([8, "oFFddDDDo"]),
    r([10, "oDDDo"]),
    r([6, "uUuuuuuuuuuUu"]),
    r([6, "UuuuuuuuuuuuU"]),
  ],
  // 3단계 — 21칸 폭의 큰 타원. 밑면은 제 무게로 살짝 눌려 아래가 더 둔하다.
  [
    r([11, "eh"]),
    r([9, "ehgGe"], [14, "e"], [20, "s"]),
    r([8, "eggGke"], [13, "ehge"]),
    r([9, "eGkke"], [13, "ggke"], [2, "s"]),
    r([11, "gk"]),
    r([7, "oHHfffFFFdo"]),
    r([5, "oHHHffffFFFFddo"]),
    r([4, "oHHffffffFFFFFddo"]),
    r([3, "oHfffffffFFFFFFddDo"]),
    r([2, "oHffffffffFFFFFFFddDo"]),
    r([2, "offffffffFFFFFFFFddDo"]),
    r([2, "offfffffFFFFFFFFddDDo"]),
    r([2, "offfffFFFFFFFFFdddDDo"]),
    r([3, "offfFFFFFFFFdddDDDo"]),
    r([3, "offFFFFFFFdddDDDDDo"]),
    r([4, "ofFFFFFFdddDDDDDo"]),
    r([6, "oFFFdddDDDDDo"]),
    r([8, "ooDDDDDoo"]),
    r([2, "uUuuuuuuuuuuuuuuuuuUu"]),
    r([2, "UuuuuuuuuuuuuuuuuuuuU"]),
  ],
];

/* ── 작물 레지스트리 ──────────────────────────────────────────── */

type CropDef = { fruit: readonly string[]; leaf?: readonly string[]; late: [string[], string[]] };

const CROP: Record<string, CropDef> = {
  strawberry: { fruit: PIXEL_PAL.rose, late: STRAWBERRY },
  carrot: { fruit: ["#ffbe7a", "#f5943a", "#c96a1c"], late: CARROT },
  tomato: { fruit: ["#ff9a8a", "#ef5b48", "#b93326"], late: TOMATO },
  corn: { fruit: PIXEL_PAL.gold, late: CORN },
  pumpkin: { fruit: ["#ffc06a", "#ef8f2c", "#b85f14"], late: PUMPKIN },
  grape: { fruit: PIXEL_PAL.violet, late: GRAPE },
  cabbage: { fruit: ["#b9ef8f", "#7fce5c", "#4d963a"], leaf: PIXEL_PAL.grass, late: CABBAGE },
  mushroom: { fruit: ["#ffb3a0", "#e56a5a", "#a83f36"], leaf: PIXEL_PAL.cream, late: MUSHROOM },
  // 푸랭이의 '암록색' — 잎(grass)보다 두 단 진하게. 같은 색이면 덩굴에 묻혀 열매가 안 보인다.
  watermelon: { fruit: ["#5fbd63", "#1f7233", "#0a3016"], leaf: PIXEL_PAL.grass, late: WATERMELON },
};

const isBlank = (s: string) => !/[^.]/.test(s);

/** 행 배열 → 24행 스프라이트. **바닥 정렬**(빈 행은 위에 채운다).
 *  왜 바닥 정렬인가: 성장 0→3 단계에서 지면선이 항상 같은 높이에 있어야 작물이 위로 자라 보인다.
 *  아래쪽 여백을 남기면 단계마다 흙이 위아래로 튄다. 손으로 행을 세다 틀리는 사고도 여기서 막힌다. */
const mk = (rows: string[], pal: Palette): Sprite => {
  const body = [...rows];
  while (body.length && isBlank(body[body.length - 1])) body.pop();
  if (body.length > 24) throw new Error(`crop sprite: ${body.length}행 (24 초과)`);
  const out = [...Array<string>(24 - body.length).fill(BLANK), ...body];
  return { w: W, h: 24, pal, rows: out };
};

/** 작물 스프라이트 — stage 0~3. 0·1 은 공용 새싹(잎색만 작물 것), 2·3 은 작물별. */
/** 스프라이트 캐시 — **객체 identity 를 안정시키기 위해서**다.
 *  PixelSprite 의 effect deps 가 [sprite, size] 인데 호출부가 JSX 안에서 매번 새 객체를 만들면,
 *  화면이 1픽셀도 안 바뀌어도 3초 틱마다 캔버스 수십 개가 통째로 재할당·재도색된다
 *  (2026-08-03 적대 검증: 모아보기 38개 확정). React Compiler 는 이 저장소에 **꺼져 있어**
 *  자동 메모가 없다 — 캐시는 여기서 직접 만든다. 스프라이트는 불변이라 안전하다. */
const cropCache = new Map<string, Sprite>();

export function cropSprite(key: string, stage: number): Sprite {
  const ck = key + ":" + Math.max(0, Math.min(3, Math.round(stage)));
  const hit = cropCache.get(ck);
  if (hit) return hit;
  const made = buildCrop(key, stage);
  cropCache.set(ck, made);
  return made;
}

function buildCrop(key: string, stage: number): Sprite {
  const def = CROP[key] ?? CROP.carrot;
  const pal = cropPal(def.fruit, def.leaf);
  const st = Math.max(0, Math.min(3, Math.round(stage)));
  if (st === 0) return mk(SPROUT0, pal);
  if (st === 1) return mk(SPROUT1, pal);
  return mk(def.late[st - 2], pal);
}

/* ── 가공품 8종 — 그릇/병/잔 실루엣으로 구분 ───────────────────── */

const PROD_PAL = (fill: readonly string[], vessel: readonly string[]): Palette => {
  const F = ramp(fill);
  const V = ramp(vessel);
  return {
    o: V.o, H: F.H, f: F.b, F: F.B, d: F.d, D: F.D,
    v: V.b, V: V.B, w: V.d, W: V.D, s: "#fffdf0",
  };
};

/** 그릇류(수프/샐러드) — 넓은 볼. */
const bowl = (): string[] => [
  ...Array(7).fill(BLANK),
  r([6, "osssssso"]),
  r([4, "oHffffffFDo"], [16, "s"]),
  r([3, "oHfffffffFFDo"]),
  r([3, "ovffffffffFVo"]),
  r([3, "ovVffffffFVWo"]),
  r([4, "ovVVVVVVVWo"]),
  r([5, "ovVVVVVWWo"]),
  r([6, "owVVVWWo"]),
  r([7, "ooWWWoo"]),
  r([9, "oooo"]),
  ...Array(6).fill(BLANK),
];

/** 병류(잼/피클) — 뚜껑 + 몸통. */
const jar = (): string[] => [
  ...Array(3).fill(BLANK),
  r([7, "oooooooo"]),
  r([7, "ovVVVVWo"]),
  r([7, "owWWWWWo"]),
  r([8, "oVVVVo"]),
  r([6, "oHffffFDo"]),
  r([5, "oHfffffFDo"]),
  r([5, "offfffFFDo"]),
  r([5, "offfffFFDo"]),
  r([5, "offfffFFDo"]),
  r([5, "ofFFFFFDDo"]),
  r([5, "ofFFFFFDDo"]),
  r([6, "oFFFDDDo"]),
  r([6, "oooooooo"]),
  ...Array(4).fill(BLANK),
];

/** 잔류(주스/와인) — 다리 달린 잔. */
const glass = (): string[] => [
  ...Array(2).fill(BLANK),
  r([6, "oooooooo"]),
  r([6, "ovffffVo"]),
  r([6, "ovffffVo"]),
  r([6, "ovfffFVo"]),
  r([6, "ovffFFVo"]),
  r([6, "ovFFFFVo"]),
  r([7, "ovFFFVo"]),
  r([7, "ovVVVo"]),
  r([8, "ovVVo"]),
  r([9, "ovVo"]),
  r([9, "ovVo"]),
  r([9, "ovVo"]),
  r([8, "oVVVo"]),
  r([6, "ooWWWWWoo"]),
  r([6, "ooooooooo"]),
  ...Array(4).fill(BLANK),
];

/** 봉지류(팝콘) — 세로 줄무늬 통 + 넘치는 알맹이. */
const BAG: string[] = [
  ...Array(3).fill(BLANK),
  r([8, "oHfo"], [14, "ofo"]),
  r([6, "ofHfo"], [12, "oHffo"], [17, "o"]),
  r([5, "oHffo"], [11, "offo"], [15, "oHfo"]),
  r([5, "ooooooooooooooo"]),
  r([5, "ovVwVwVwVwVwVWo"]),
  r([5, "ovVwVwVwVwVwVWo"]),
  r([6, "ovVwVwVwVwVWo"]),
  r([6, "ovVwVwVwVwVWo"]),
  r([6, "ovVwVwVwVwVWo"]),
  r([7, "ovVwVwVwVWo"]),
  r([7, "ovVwVwVwVWo"]),
  r([7, "oooooooooo"]),
  ...Array(6).fill(BLANK),
];

/** 파이 — 격자 크러스트 원판. */
const PIE: string[] = [
  ...Array(8).fill(BLANK),
  r([6, "oooooooo"]),
  r([4, "oHvfvfvfvVDo"]),
  r([3, "oHvffvffvfvVDo"]),
  r([3, "ovfvffvffvfvVo"]),
  r([3, "ovffvffvffvVWo"]),
  r([3, "ovfvffvffvfVWo"]),
  r([4, "oVVVVVVVVWWo"]),
  r([5, "owWWWWWWWo"]),
  r([6, "oooooooo"]),
  ...Array(6).fill(BLANK),
];

const PRODUCT: Record<string, { rows: string[]; fill: readonly string[]; vessel: readonly string[] }> = {
  soup: { rows: bowl(), fill: ["#ffcf8a", "#f0a343", "#c07320"], vessel: PIXEL_PAL.white },
  salad: { rows: bowl(), fill: PIXEL_PAL.leaf, vessel: PIXEL_PAL.white },
  jam: { rows: jar(), fill: PIXEL_PAL.rose, vessel: PIXEL_PAL.gold },
  pickles: { rows: jar(), fill: PIXEL_PAL.grass, vessel: PIXEL_PAL.gray },
  juice: { rows: glass(), fill: PIXEL_PAL.violet, vessel: PIXEL_PAL.water },
  wine: { rows: glass(), fill: ["#e0607f", "#a52846", "#6e132b"], vessel: PIXEL_PAL.water },
  popcorn: { rows: BAG, fill: PIXEL_PAL.cream, vessel: PIXEL_PAL.rose },
  pie: { rows: PIE, fill: PIXEL_PAL.gold, vessel: PIXEL_PAL.brown },
};

/** 스프라이트 캐시 — 객체 identity 안정화(이유는 pixelcrop.ts 의 cropCache 주석 참조).
 *  호출부가 JSX 안에서 매번 새 객체를 만들면 캔버스가 통째로 재할당·재도색된다.
 *  스프라이트는 불변이라 공유해도 안전하다. */
const productCache = new Map<string, Sprite>();

export function productSprite(key: string): Sprite {
  const hit = productCache.get(key);
  if (hit) return hit;
  const made = build_productSprite(key);
  productCache.set(key, made);
  return made;
}

function build_productSprite(key: string): Sprite {
  const p = PRODUCT[key] ?? PRODUCT.soup;
  return mk(p.rows, PROD_PAL(p.fill, p.vessel));
}

/** 테스트용 — 전 작물/가공품 스프라이트. */
export const ALL_CROP_SPRITES: Record<string, Sprite> = {
  ...Object.fromEntries(
    Object.keys(CROP).flatMap((k) => [0, 1, 2, 3].map((st) => [`${k}${st}`, cropSprite(k, st)])),
  ),
  ...Object.fromEntries(Object.keys(PRODUCT).map((k) => [k, productSprite(k)])),
};
