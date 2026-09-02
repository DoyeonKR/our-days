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

/** 전설 반짝임 색(팔레트 키 `L`). 전용 키인 이유: `s` 는 이미 그릇 테두리·딸기 씨앗 하이라이트로
 *  쓰이고 있어서, 같은 글자로 반짝임을 찍으면 **원래 있던 하이라이트와 구분이 안 된다**
 *  (테스트가 '평범한 작물도 반짝인다'고 잡아냈다).
 *  ⚠ 색은 라이트(크림 카드)·다크 양쪽에서 보여야 한다. 순백은 크림 위에서 사라지고
 *    어두운 금색은 다크에서 때처럼 보인다 → 채도 있는 중간 금색으로 고른다. */
const LEGEND_SPARK = "#ffcc3d";
const LEGEND_CYAN = "#8fe3ff";
const LEGEND_VIOLET = "#c49bff";

/** 작물 팔레트 — 열매(f 계열) + 잎(g 계열) + 흙(u). 색은 PAL 그대로(일러스트와 같은 세계). */
function cropPal(fruit: readonly string[], leaf: readonly string[] = PIXEL_PAL.leaf): Palette {
  const F = ramp(fruit);
  const G = ramp(leaf);
  const U = ramp(PIXEL_PAL.brown);
  return {
    o: F.o, H: F.H, f: F.b, F: F.B, d: F.d, D: F.D,
    e: G.o, h: G.H, g: G.b, G: G.B, k: G.d, K: G.D,
    u: U.d, U: U.o, s: "#fff3b0", L: LEGEND_SPARK, M: LEGEND_CYAN, X: LEGEND_VIOLET,
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

/** 천도복숭아 — 2단계: 가지에 매달린 풋복숭아 / 3단계: 홈 파인 분홍 복숭아 + 광채. */
const HEAVENPEACH: [string[], string[]] = [
  [
    r([11, "eh"]),
    r([9, "ehgGe"], [14, "e"]),
    r([8, "eggGke"], [13, "ehge"]),
    r([9, "eGkke"], [13, "ggke"]),
    r([11, "gk"]),
    r([9, "ogggo"]),
    r([8, "oggGGko"]),
    r([8, "ogGGkko"]),
    r([9, "oGkko"]),
    r([7, "uUuuuuuuuUu"]),
    r([7, "UuuuuuuuuuU"]),
    BLANK, BLANK, BLANK,
  ],
  [
    r([11, "eh"], [17, "s"]),
    r([9, "ehgGe"], [14, "e"]),
    r([8, "eggGke"], [13, "ehge"], [4, "s"]),
    r([9, "eGkke"], [13, "ggke"]),
    r([11, "gk"]),
    r([8, "oHHffDo"]),
    r([6, "oHHffffFDDo"]),
    r([5, "oHHfffdfFFFDo"]),
    r([5, "oHffffdffFFDo"]),
    r([5, "offfffdffFFDo"]),
    r([5, "ofFfffdfFFFDo"]),
    r([6, "oFFFdFFFFDo"]),
    r([8, "oFFDDDo"]),
    r([6, "uUuuuuuuuUu"]),
    r([6, "UuuuuuuuuuU"]),
    BLANK, BLANK,
  ],
];

/** 불로초 — 2단계: 돋는 갓 / 3단계: 콩팥형 갓 + 밝은 테 + 굽은 대. */
const YEONGJI: [string[], string[]] = [
  [
    r([9, "oooooo"]),
    r([8, "oHfffDo"]),
    r([7, "oHffffFDo"]),
    r([6, "oHfffffFFDo"]),
    r([7, "ohhhhhhhho"]),
    r([8, "oooooooo"]),
    r([11, "oggo"]),
    r([11, "oggko"]),
    r([7, "uUuuuuuuuUu"]),
    r([7, "UuuuuuuuuuU"]),
    BLANK, BLANK, BLANK,
  ],
  [
    r([8, "s"], [17, "s"]),
    r([6, "ooooooooo"]),
    r([5, "oHHHffffDo"]),
    r([4, "oHHfffffFFDDo"]),
    r([3, "oHfffffFFFFDDDo"]),
    r([3, "offfFFFFFFDDDDo"]),
    r([4, "ohhhhhhhhhhhho"]),
    r([5, "oooooooooooo"]),
    r([12, "oggo"]),
    r([12, "oggko"]),
    r([11, "oggko"]),
    r([11, "ogko"]),
    r([6, "uUuuuuuuuUu"]),
    r([6, "UuuuuuuuuuU"]),
    BLANK, BLANK,
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
  // 천도복숭아(반도) — 설화 속 하늘 복숭아. 요즘 마트의 천도(넥타린)가 아니라 **홈이 파인
  // 분홍 복숭아**다(동방삭이 훔친 그 그림). 실존/설화 대상은 그리기 전에 찾아본다(수박 교훈).
  heavenpeach: { fruit: ["#ffc2cf", "#ff8fae", "#d95a86"], leaf: PIXEL_PAL.leaf, late: HEAVENPEACH },
  // 불로초(영지) — 옻칠한 듯한 적갈색 갓 + 밝은 테. 버섯(🍄)과 갈려면 **콩팥형 갓**이어야 한다.
  yeongji: { fruit: ["#e0863f", "#b4531f", "#6e300f"], leaf: PIXEL_PAL.cream, late: YEONGJI },
};

/** 전설 작물·요리 키 — 반짝임을 얹을 대상.
 *  ⚠ island.ts 의 legendXp/legendBond/legendHeal 과 **같은 목록이어야 한다.** 표가 둘이라
 *    어긋날 수 있어서 legendart.test.ts 가 두 곳을 대조한다(한쪽만 고치면 실패). */
export const LEGEND_ART_KEYS = new Set([
  "watermelon", "heavenpeach", "yeongji",
  "melonpunch", "peachwine", "elixir",
]);

/** 전설 반짝임 — 등급을 색이 아니라 **빛**으로 보여준다(펫의 mythicAura 와 같은 문법).
 *
 *  ⚠ **주제를 덮지 않는다.** 이미 그려진 칸은 건너뛰고 투명한 칸에만 찍는다 —
 *    과일·그릇 위에 흰 점을 얹으면 화려해지는 게 아니라 때가 탄 것처럼 보인다.
 *  ⚠ 좌표는 24×24 **모서리 쪽**만 쓴다. 가운데(주제가 앉는 자리)에 찍으면 실루엣이 흔들린다. */
function legendGlow(sp: Sprite, key: string): Sprite {
  const grid = sp.rows.map((row) => row.split(""));
  const free = (x: number, y: number) =>
    y >= 0 && y < grid.length && x >= 0 && x < W && grid[y][x] === ".";
  /** 십자 별 하나 — 가운데 + 팔 넷. 자리가 좁으면 그리지 않는다(반쪽 별은 먼지로 보인다). */
  const star = (x: number, y: number, ch = "L"): boolean => {
    const cells = [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const;
    if (!cells.every(([cx, cy]) => free(cx, cy))) return false;
    for (const [cx, cy] of cells) grid[cy][cx] = ch;
    return true;
  };

  /* ⚠ **고정 좌표를 쓰지 않는다.** 그림마다 실루엣이 달라서 자리를 박아 두면, 폭이 꽉 찬
     그림(무등산수박은 잉크가 x0~22 다)만 별을 못 받아 **제일 전설인 게 제일 안 화려한**
     거꾸로가 된다(1차판 실측: 수박 별 1개, 나머지 5개 — PNG 로 굽고 나서야 보였다).
     대신 모양에 상관없이 **들어갈 수 있는 자리를 전부 찾아** 잉크에 가까운 순으로 고른다. */
  const ink: [number, number][] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < W; x++) if (grid[y][x] !== ".") ink.push([x, y]);
  }
  if (ink.length === 0) return sp; // 빈 그림
  /** 잉크까지의 체비셰프 거리 — 작을수록 실루엣에 붙어 있다(멀면 먼지로 보인다). */
  const nearness = (x: number, y: number): number => {
    let best = 99;
    for (const [ix, iy] of ink) {
      const d = Math.max(Math.abs(ix - x), Math.abs(iy - y));
      if (d < best) best = d;
    }
    return best;
  };
  const cands: { x: number; y: number; d: number }[] = [];
  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const cells = [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const;
      if (!cells.every(([cx, cy]) => free(cx, cy))) continue;
      const d = nearness(x, y);
      if (d < 2 || d > 6) continue; // 너무 붙으면 실루엣을 갉고, 너무 멀면 먼지다
      cands.push({ x, y, d });
    }
  }
  // 잉크에 가까운 순 → 이미 놓은 별과 5칸 이상 떨어진 것만(뭉치면 얼룩이 된다)
  cands.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const put: { x: number; y: number }[] = [];
  for (const c of cands) {
    if (put.length >= 5) break;
    if (put.some((p) => Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y)) < 5)) continue;
    const accents: Record<string, readonly string[]> = {
      watermelon: ["L", "M"], melonpunch: ["M", "L"],
      heavenpeach: ["L", "X"], peachwine: ["X", "L"],
      yeongji: ["X", "M", "L"], elixir: ["M", "X", "L"],
    };
    const seq = accents[key] ?? ["L"];
    if (star(c.x, c.y, put.length === 0 ? "L" : seq[put.length % seq.length])) put.push(c);
  }
  // 별이 하나도 안 들어가는 그림이면 모서리 점으로라도 등급을 남긴다.
  if (put.length === 0) {
    for (const [px, py] of [[1, 1], [W - 2, 1], [1, grid.length - 3], [W - 2, grid.length - 3]] as const) {
      if (free(px, py)) grid[py][px] = "L";
    }
  }
  // 고유 궤도점 — 같은 노란 별 다섯 개가 아니라 재료별 색 리듬을 남긴다.
  const orbit: Record<string, readonly (readonly [number, number, string])[]> = {
    watermelon: [[2, 10, "M"], [21, 13, "M"]],
    heavenpeach: [[3, 8, "X"], [20, 7, "X"]],
    yeongji: [[4, 5, "X"], [19, 10, "M"]],
    melonpunch: [[2, 7, "M"], [21, 8, "L"]],
    peachwine: [[4, 3, "X"], [19, 5, "L"]],
    elixir: [[3, 4, "M"], [20, 4, "X"]],
  };
  for (const [x, y, ch] of orbit[key] ?? []) if (free(x, y)) grid[y][x] = ch;
  return { ...sp, rows: grid.map((row) => row.join("")) };
}

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
  const sp = mk(def.late[st - 2], pal);
  /* 반짝임은 **다 자란 단계(3)에만** 얹는다. 새싹까지 빛나면 밭에서 어느 게 다 됐는지
     한눈에 안 들어오고, '전설이 익었다'는 순간의 신호도 사라진다. */
  return st === 3 && LEGEND_ART_KEYS.has(key) ? legendGlow(sp, key) : sp;
}

/* ── 가공품 8종 — 그릇/병/잔 실루엣으로 구분 ───────────────────── */

const PROD_PAL = (fill: readonly string[], vessel: readonly string[]): Palette => {
  const F = ramp(fill);
  const V = ramp(vessel);
  return {
    o: V.o, H: F.H, f: F.b, F: F.B, d: F.d, D: F.D,
    v: V.b, V: V.B, w: V.d, W: V.D, s: "#fffdf0", L: LEGEND_SPARK, M: LEGEND_CYAN, X: LEGEND_VIOLET,
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

/** 전설 수박화채 — 낮은 사발이 아니라 보석 받침이 달린 넓은 성배. */
const LEGEND_PUNCH: string[] = [
  ...Array(5).fill(BLANK),
  r([5, "osssssssssssso"]),
  r([4, "ovHfHfHfHfHfFVo"]),
  r([3, "ovHffffffffffFVWo"]),
  r([3, "ovVfffffffffFVWWo"]),
  r([4, "ovVVFFFFFFFVWWo"]),
  r([5, "owVVVVVVVWWo"]),
  r([8, "ooVVVWWoo"]),
  r([10, "ovVWo"]),
  r([8, "oVVVVVWWo"]),
  r([7, "ooWWWWWWoo"]),
  ...Array(5).fill(BLANK),
];

/** 전설 천도주 — 어깨가 넓고 목이 긴 봉인 항아리. */
const LEGEND_PEACHWINE: string[] = [
  ...Array(2).fill(BLANK),
  r([9, "ooVVoo"]),
  r([8, "ovVVVWo"]),
  r([9, "owWWWo"]),
  r([9, "ovVVWo"]),
  r([7, "oovVVVWWoo"]),
  r([5, "oovHffffFVWWoo"]),
  r([4, "ovHfffffffFVWWo"]),
  r([4, "ovHffffffffFVWo"]),
  r([4, "ovfffffffffFVWo"]),
  r([4, "ovfffHffHffFVWo"]),
  r([4, "ovFFFFFFFFFVWWo"]),
  r([5, "owVVVVVVVWWWo"]),
  r([7, "ooWWWWWWoo"]),
  ...Array(4).fill(BLANK),
];

/** 불로장생탕 — 손잡이와 다리가 있는 옥빛 가마솥. */
const LEGEND_ELIXIR: string[] = [
  ...Array(4).fill(BLANK),
  r([8, "s"], [12, "s"], [16, "s"]),
  r([7, "s"], [11, "s"], [15, "s"]),
  r([3, "oo"], [6, "osssssssssso"], [19, "oo"]),
  r([2, "ovVoHfffffffFDovVo"]),
  r([3, "oWovHfffffFDowWo"]),
  r([5, "ovVffffffffFVWo"]),
  r([5, "ovVVFFFFFFFVWWo"]),
  r([6, "owVVVVVVVWWo"]),
  r([8, "ooWWWWWoo"]),
  r([8, "ovVoovVWo"]),
  r([7, "ooWo..oWoo"]),
  ...Array(5).fill(BLANK),
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
  /* 전설 요리 3종 — 재료의 색을 그대로 물려받는다(무엇으로 만든 요리인지 한눈에 읽혀야 한다).
     그릇 실루엣도 갈랐다: 화채=사발 · 천도주=병 · 불로장생탕=사발(옥빛).
     ⚠ 색만 갈면 어두운 창고 격자에서 구분이 안 된다 → 반짝임(legendGlow)이 등급을 맡는다. */
  // 수박화채 — 무등산 껍질의 암록 사발에 붉은 속살. 얼음은 그릇색(흰빛)이 대신한다.
  melonpunch: { rows: LEGEND_PUNCH, fill: ["#ff8f9e", "#e8455f", "#96182f"], vessel: ["#dff7e4", "#8fd6a1", "#3f8c58"] },
  // 천도주 — 반도의 분홍이 그대로 술이 된다. 병은 백자(흰빛).
  peachwine: { rows: LEGEND_PEACHWINE, fill: ["#ffc2cf", "#ff8fae", "#d95a86"], vessel: PIXEL_PAL.white },
  // 불로장생탕 — 영지의 적갈 탕약 + 옥빛 사발(약재의 왕이라 그릇도 귀하다).
  elixir: { rows: LEGEND_ELIXIR, fill: ["#e0a24f", "#a86a24", "#5e3510"], vessel: ["#c8f0e2", "#79cfb4", "#35806a"] },
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
  const sp = mk(p.rows, PROD_PAL(p.fill, p.vessel));
  return LEGEND_ART_KEYS.has(key) ? legendGlow(sp, key) : sp;
}

/** 테스트용 — 전 작물/가공품 스프라이트. */
export const ALL_CROP_SPRITES: Record<string, Sprite> = {
  ...Object.fromEntries(
    Object.keys(CROP).flatMap((k) => [0, 1, 2, 3].map((st) => [`${k}${st}`, cropSprite(k, st)])),
  ),
  ...Object.fromEntries(Object.keys(PRODUCT).map((k) => [k, productSprite(k)])),
};
