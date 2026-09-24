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
import { PIXEL_PAL } from "./pixelpal.ts";

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
    /* 2026-09-23 작물 16종 확장 — 과일나무 줄기·지지대(t/T), 흰 꽃(w), 노란 꽃(y/Y).
       ⚠ 줄기를 흙색(u/U)으로 칠하면 안 된다 — pixelcrop.test 의 '흙 띠 고정'이 u/U 가
         처음 나오는 행을 지면으로 보므로, 나무 줄기가 지면이 되어 버린다. */
    t: U.b, T: U.B, w: "#fffdf7", y: PIXEL_PAL.gold[1], Y: PIXEL_PAL.gold[2],
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

/* ── 작물 16종 확장(2026-09-23) ─────────────────────────────────
 * [사용자 요청 "더 많은 농작물"] 계절마다 네 종씩. 도형으로 초안을 뜨고 PNG 로 구워 보며
 * 다듬은 뒤 r() 런으로 옮겼다(펫 사신 아트와 같은 방법 — 고칠 땐 행을 통째로 갈아라). */

/** 감자 — 무성한 포기. (2) 흰 감자꽃 / (3) 흙 위로 굴러 나온 알감자 셋(알마다 외곽선이 닫혀야 '알'로 읽힌다). */
const POTATO: [string[], string[]] = [
  [
    r([11, "w"]),
    r([8, "w"], [10, "wsw"], [15, "w"]),
    r([8, "wswwgewsw"]),
    r([9, "wggggew"]),
    r([8, "eggggGGe"]),
    r([8, "egggGGGe"]),
    r([8, "egeegeke"]),
    r([7, "egGGegkkke"]),
    r([6, "egGGeegekKKe"]),
    r([5, "eeeee"], [11, "egeeeeee"]),
    r([4, "ehhggeeegeegggGe"]),
    r([5, "eeGkkKeggGGkee"]),
    r([7, "eeeeegeeee"]),
    r([11, "ege"]),
    r([11, "ege"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([11, "ee"]),
    r([9, "eehGee"]),
    r([8, "eGehGehe"]),
    r([7, "egGegkehge"]),
    r([7, "eGkegKegge"]),
    r([7, "eGe"], [11, "egeege"]),
    r([6, "eGkKeegegGke"]),
    r([5, "egGke"], [11, "egeeGkKe"]),
    r([6, "eeee"], [11, "egeeeee"]),
    r([5, "ehggGeegehggGe"]),
    r([5, "egGkKeegegGkKe"]),
    r([6, "eeee"], [11, "egeeeee"]),
    r([11, "ooooo"]),
    r([6, "oooooHfffFooooo"]),
    r([5, "oHffFofdFFDoHdFFo"]),
    r([5, "ofdFDofFFDDofFDDo"]),
    r([6, "oooo"], [11, "ooooo"], [17, "oooo"]),
    r([5, "uUuuuuuuuuuuuUu"]),
    r([5, "UuuuuuuuuuuuuuU"]),
  ],
];

/** 완두콩 — 지지대(t)를 감는 덩굴. (3) 비스듬히 매달린 꼬투리 속 콩(H)이 줄지어 보여야 완두다. */
const PEA: [string[], string[]] = [
  [
    r([12, "teee"]),
    r([11, "ethgge"]),
    r([10, "egteGkKe"]),
    r([8, "eeeegeeee"]),
    r([7, "eggGeggw"]),
    r([6, "egGke"], [12, "tge"]),
    r([7, "eee"], [11, "eggee"]),
    r([11, "eghgge"]),
    r([8, "wsegteGkKe"]),
    r([8, "eeeegeeee"]),
    r([7, "eggGegge"]),
    r([6, "egGke"], [12, "tgws"]),
    r([7, "eee"], [11, "egge"]),
    r([11, "ege"]),
    r([10, "egt"]),
    r([11, "et"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([12, "t"]),
    r([12, "te"]),
    r([12, "tge"], [17, "oo"]),
    r([11, "eggeoHfo"]),
    r([11, "egooHfFo"]),
    r([10, "egtoFDoo"]),
    r([11, "egeooKe"]),
    r([8, "eeeeggeee"]),
    r([7, "eggGetge"]),
    r([6, "egGkeegge"]),
    r([5, "ooeee"], [11, "egeee"]),
    r([4, "oHfoo"], [10, "egthgge"]),
    r([4, "ofHfHooegeGkKe"]),
    r([5, "oFFFHfoggeee"], [18, "oo"]),
    r([7, "ooFDotge"], [16, "ooHfo"]),
    r([6, "egGooeggooHfHFo"]),
    r([7, "eee"], [11, "egoHfHFFo"]),
    r([10, "egtoFDoo"]),
    r([11, "et"], [14, "oo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 상추 — 낮게 퍼진 로제트. 줄기 없이 잎이 곧 열매라 전부 열매 램프로 칠한다. */
const LETTUCE: [string[], string[]] = [
  [
    r([10, "ooooo"]),
    r([9, "offfffo"]),
    r([8, "offHHffFo"]),
    r([7, "offfffFFFFo"]),
    r([6, "ofFffFFFFFFdo"]),
    r([7, "offFFFFdddo"]),
    r([8, "oFFFddddo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([10, "ooooo"]),
    r([9, "offfffo"]),
    r([8, "offHHfffo"]),
    r([7, "offfffffFFo"]),
    r([6, "ofdFffffFdFFo"]),
    r([6, "offfdffdFFFFo"]),
    r([5, "offfffFFFFFFddo"]),
    r([4, "ofdFFfFFFFFFFdddo"]),
    r([5, "offfFFFFFFddddo"]),
    r([6, "ofFFFFFFddddo"]),
    r([5, "uUuuuuuuuuuuuUu"]),
    r([5, "UuuuuuuuuuuuuuU"]),
  ],
];

/** 녹차 — 둥근 차나무 덤불. (3) 가장자리 새순(연두 = 열매 램프)이 '딸 때'라는 신호. */
const TEA: [string[], string[]] = [
  [
    r([9, "eeeeeee"]),
    r([8, "ehgggggge"]),
    r([7, "ehkgggggGGe"]),
    r([6, "ehgggggGkGGGe"]),
    r([6, "egggggGGGGkke"]),
    r([6, "eggggkGGGkkke"]),
    r([7, "egGGGGGkkke"]),
    r([8, "eGGGkkkke"]),
    r([9, "eeeteee"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([10, "f"], [14, "f"]),
    r([10, "HF"], [14, "HF"]),
    r([6, "f"], [9, "eeeeeee"], [18, "f"]),
    r([6, "HFehggggggeeHF"]),
    r([6, "ehggggggggGGe"]),
    r([5, "ehgggggkggGfGGe"]),
    r([4, "egggfkgggGGGHFGGe"]),
    r([4, "egggHFggGGGGGGkke"]),
    r([4, "eggggggGGGGkGkkke"]),
    r([5, "egggGGGGGGkkkke"]),
    r([6, "egGGGGGGkkkke"]),
    r([7, "eeGGGkkkkee"]),
    r([9, "eetetee"]),
    r([11, "t"], [13, "t"]),
    r([11, "t"], [13, "t"]),
    r([11, "t"], [13, "t"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 고추 — (2) 풋고추(짙은 초록) / (3) 꼭지에서 휘어 가늘어지는 빨간 고추 셋(서로 떨어뜨려야 한 덩어리가 안 된다). */
const PEPPER: [string[], string[]] = [
  [
    r([11, "ee"]),
    r([10, "ehGe"]),
    r([10, "egKe"]),
    r([11, "ege"]),
    r([8, "eeeegeee"]),
    r([7, "eggGeghgge"]),
    r([6, "egGkeegeGkKe"]),
    r([7, "eee"], [11, "egeeee"]),
    r([8, "eeeegeee"]),
    r([6, "eehhggggggee"]),
    r([5, "egGGGeegekKKKe"]),
    r([6, "eeee"], [11, "egeeeee"]),
    r([9, "hKegehK"]),
    r([9, "gKegegK"]),
    r([10, "KegeK"]),
    r([11, "ege"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([11, "ee"]),
    r([10, "ehGe"]),
    r([10, "egKe"]),
    r([11, "ege"]),
    r([7, "eee"], [11, "egeeee"]),
    r([6, "eggGeegehgge"]),
    r([5, "egGke"], [11, "egeeGkKe"]),
    r([6, "eee"], [11, "ege"], [15, "eee"]),
    r([8, "eeeegeee"]),
    r([7, "eggGeghgge"]),
    r([6, "kkGkeegeGkkk"]),
    r([5, "oHfoe"], [11, "egeeoHfo"]),
    r([5, "ofFo"], [11, "kke"], [15, "ofFo"]),
    r([5, "ofFo"], [10, "oHfo"], [15, "ofFo"]),
    r([6, "oDo"], [10, "offo"], [15, "oDo"]),
    r([7, "oo"], [10, "ofFo"], [15, "oo"]),
    r([10, "ofDo"]),
    r([11, "oDo"]),
    r([11, "eoe"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 오이 — 사각 지지대 + 덩굴. (3) 잎보다 짙은 초록 몸 + 밝은 돌기(s). */
const CUCUMBER: [string[], string[]] = [
  [
    r([7, "t"], [17, "t"]),
    r([7, "ttttttttttt"]),
    r([7, "t"], [9, "ehGeggget"]),
    r([7, "t"], [9, "egKgeee"], [17, "t"]),
    r([7, "t"], [10, "eghgge"], [17, "t"]),
    r([7, "t"], [9, "yYygGkKet"]),
    r([7, "t"], [9, "eeeeege"], [17, "t"]),
    r([7, "teggGgge"], [17, "t"]),
    r([7, "tgGkgge"], [15, "y"], [17, "t"]),
    r([7, "teggee"], [14, "yYyt"]),
    r([7, "t"], [9, "ege"], [17, "t"]),
    r([7, "t"], [9, "egge"], [17, "t"]),
    r([7, "t"], [10, "ege"], [17, "t"]),
    r([7, "t"], [11, "ege"], [17, "t"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([5, "t"], [19, "t"]),
    r([5, "ttttttttttttttt"]),
    r([5, "t"], [8, "ee"], [12, "eege"], [19, "t"]),
    r([5, "t"], [7, "ehGeegge"], [19, "t"]),
    r([5, "t"], [7, "egKegge"], [17, "yYt"]),
    r([5, "t"], [8, "eegee"], [14, "eee"], [19, "t"]),
    r([5, "t"], [10, "egoohgge"], [19, "t"]),
    r([5, "t"], [7, "yY"], [11, "oHfoGkKet"]),
    r([5, "t"], [11, "ofsogee"], [19, "t"]),
    r([5, "t"], [7, "eee"], [11, "oFfoeoo"], [19, "t"]),
    r([5, "teggGeosFooHfot"]),
    r([5, "tgGkegoFDoosFot"]),
    r([5, "teeegeoDsooFfot"]),
    r([5, "t"], [9, "egeoo"], [15, "oFsot"]),
    r([5, "t"], [9, "egge"], [15, "oDDot"]),
    r([5, "t"], [10, "ege"], [16, "oo"], [19, "t"]),
    r([5, "t"], [11, "ege"], [19, "t"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 가지 — 아래가 불룩한 물방울꼴 보라 열매 둘. */
const EGGPLANT: [string[], string[]] = [
  [
    r([11, "ee"]),
    r([10, "ehGe"]),
    r([10, "egKe"]),
    r([7, "e"], [11, "ege"], [16, "e"]),
    r([6, "egee"], [11, "egeeege"]),
    r([5, "ehgGGeegehgGGe"]),
    r([5, "egGGkewgegGGke"]),
    r([6, "eekewsweeGee"]),
    r([7, "eeeeege"], [15, "e"]),
    r([6, "ehggGegkk"]),
    r([6, "egGkKegodo"]),
    r([7, "eeeeegddDo"]),
    r([11, "egdDDo"]),
    r([11, "egdDDo"]),
    r([11, "egooo"]),
    r([11, "ege"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([11, "ee"]),
    r([10, "ehGe"]),
    r([10, "ehGe"]),
    r([10, "egke"]),
    r([6, "ee"], [10, "egKe"], [16, "ee"]),
    r([5, "eggee"], [11, "egeeegge"]),
    r([4, "eggGGGeegehggGGe"]),
    r([3, "eggGGke"], [11, "egeegGGkke"]),
    r([4, "eeGke"], [11, "ege"], [15, "eGkee"]),
    r([6, "ee"], [11, "ege"], [16, "ee"]),
    r([8, "kkkegekkk"]),
    r([8, "ofoegeooo"]),
    r([7, "offFogoHffo"]),
    r([7, "oHfFogoffFo"]),
    r([6, "offFFdgoHfFo"]),
    r([6, "ofFFdDgffFFdo"]),
    r([7, "oFddogfFFdDo"]),
    r([8, "oooegoFddo"]),
    r([11, "egeooo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 블루베리 — 작은 관목(줄기 t). (3) 가장자리에 2×2 알 송이. */
const BLUEBERRY: [string[], string[]] = [
  [
    r([11, "eee"]),
    r([8, "eeegggeee"]),
    r([7, "ehggggggGGe"]),
    r([6, "ehgggggGGGGGe"]),
    r([6, "egggggGGGGkke"]),
    r([6, "eggggGGGGkkke"]),
    r([7, "egGGGGGkkke"]),
    r([8, "estGkkese"]),
    r([10, "sttes"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([12, "e"]),
    r([8, "eeeegeeee"]),
    r([6, "eeggggggggGee"]),
    r([5, "ehggggHFggHFGGe"]),
    r([5, "egggggFdGGFdGGe"]),
    r([4, "egggggggGGGGGGkke"]),
    r([5, "egggggGGGGGGkke"]),
    r([5, "eHFgGGGGGGkkHFe"]),
    r([6, "FdGGGGGGkkkFd"]),
    r([7, "FeHFektHFF"]),
    r([9, "Fdtt"], [14, "Fd"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([12, "t"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 벼 — (2) 가는 잎 다발(1px — 외곽선을 두르면 울타리가 된다) / (3) 고개 숙인 이삭.
   ⚠ 노란 램프의 어두운 톤(d/D/o)은 색상 이동 때문에 **진홍**이다(d=#e06d5a). 이삭을 그걸로
     두르면 불꽃·버섯처럼 보여서 짚색(t/T)으로 테두리를 둘렀다. */
const RICE: [string[], string[]] = [
  [
    r([12, "g"]),
    r([9, "g"], [12, "g"], [15, "g"]),
    r([9, "g"], [12, "h"], [15, "g"]),
    r([7, "g"], [9, "h"], [12, "g"], [15, "h"], [17, "g"]),
    r([7, "g"], [9, "g"], [12, "g"], [15, "g"], [17, "g"]),
    r([7, "gh"], [10, "g"], [12, "g"], [14, "g"], [16, "hg"]),
    r([8, "g"], [10, "g"], [12, "g"], [14, "g"], [16, "g"]),
    r([8, "G"], [10, "g"], [12, "g"], [14, "g"], [16, "G"]),
    r([8, "G"], [10, "g"], [12, "g"], [14, "g"], [16, "G"]),
    r([8, "gGg"], [12, "g"], [14, "gGg"]),
    r([9, "Gg"], [12, "g"], [14, "gG"]),
    r([9, "Gg"], [12, "g"], [14, "gG"]),
    r([9, "gG"], [12, "g"], [14, "Gg"]),
    r([9, "gGgggGg"]),
    r([9, "gGgggGg"]),
    r([10, "gGgGg"]),
    r([10, "gGgGg"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([8, "TTT"], [14, "TTT"]),
    r([7, "THfFT"], [13, "THfFT"]),
    r([5, "TTTfFFTGTFFTTT"]),
    r([4, "THfFTFtTGTFTHfFT"]),
    r([3, "THfFT"], [9, "TT"], [12, "G"], [14, "TTTfFFT"]),
    r([3, "TfFT"], [9, "G"], [12, "G"], [15, "G"], [17, "TFtT"]),
    r([3, "TFtTG"], [10, "G"], [12, "G"], [14, "G"], [17, "TFtT"]),
    r([4, "TT"], [7, "GG"], [10, "G"], [12, "G"], [14, "G"], [17, "GTT"]),
    r([8, "g"], [10, "G"], [12, "G"], [14, "G"], [16, "g"]),
    r([8, "ggG"], [12, "G"], [14, "Ggg"]),
    r([8, "GgG"], [12, "G"], [14, "GgG"]),
    r([9, "gg"], [12, "G"], [14, "gg"]),
    r([9, "GgGGGgG"]),
    r([10, "ggGggG"]),
    r([10, "GgGgG"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 고구마 — 땅을 덮는 하트 잎 + (3) 흙 위로 드러난 자주색 고구마 둘. */
const SWEETPOTATO: [string[], string[]] = [
  [
    r([11, "eee"]),
    r([10, "ehkge"]),
    r([9, "eggGGke"]),
    r([7, "eeeeGkkeeee"]),
    r([6, "egkgeegeehkge"]),
    r([4, "eeggGGGegehggggee"]),
    r([3, "egggGGGeegeegggGGGe"]),
    r([2, "eggGGGee"], [11, "ege"], [15, "eeGGkkke"]),
    r([3, "eGGGe"], [11, "ege"], [17, "ekkKe"]),
    r([4, "euUuuuuuuuuuuUuee"]),
    r([5, "UuuuuuuuuuuuuU"]),
  ],
  [
    r([12, "e"]),
    r([10, "eegee"]),
    r([9, "ehggGGe"]),
    r([7, "e"], [9, "eggkGke"], [17, "e"]),
    r([5, "eegeeggGkkeehee"]),
    r([4, "egggGGeekeehhggge"]),
    r([2, "eegggkGGeegeehgkggGee"]),
    r([1, "eggggGGGkeegeeggggGGGke"]),
    r([1, "egggGGGooooge"], [15, "oogGGGkke"]),
    r([1, "eggGGGHHHffgooffoGGkkKe"]),
    r([2, "eeGoffffffFFFFFddokee"]),
    r([4, "e"], [6, "oFFFFFodddDDDoe"]),
    r([4, "uUuuuuuuuuuuuuUu"]),
    r([4, "UuuuuuuuuuuuuuuU"]),
  ],
];

/** 사과 — 작은 과일나무(줄기 t/T). (2) 덜 익은 짙은 열매 / (3) 빨간 사과. */
const APPLE: [string[], string[]] = [
  [
    r([9, "eeeeeee"]),
    r([8, "ehgggggge"]),
    r([7, "ehgggggggGe"]),
    r([6, "ehgggggggGGGe"]),
    r([5, "egggggggGddGGGe"]),
    r([5, "eggggggGGGGGkke"]),
    r([5, "egggddGGGGGkkke"]),
    r([6, "egggGGGGGkkke"]),
    r([7, "eGGGGddkkke"]),
    r([8, "eGGGkkkke"]),
    r([9, "eeTteee"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([9, "eeeeeee"]),
    r([7, "eehggggggee"]),
    r([6, "ehgggggggggGe"]),
    r([5, "ehggggggggGGGGe"]),
    r([4, "ehggggggggGoHoGGe"]),
    r([4, "eggggggggGGfFDGke"]),
    r([4, "egggoHogGGGGGGkke"]),
    r([4, "egggfFDGGGGGGkkke"]),
    r([4, "egggggGGGGGGkkkke"]),
    r([5, "egggGGGoHokoHoe"]),
    r([6, "eoHoGGfFDkfFD"]),
    r([7, "fFDGGkkkkee"]),
    r([9, "eeTteee"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 밤 — 과일나무 + 가시송이(f). (3) 벌어진 송이 속 윤나는 밤(t/T). */
const CHESTNUT: [string[], string[]] = [
  [
    r([9, "eeeeeee"]),
    r([7, "eehggggggee"]),
    r([6, "ehhgggggggGGe"]),
    r([6, "ehgggggggGGGe"]),
    r([5, "egggggggGGfGfGe"]),
    r([5, "egggfgfGGGfFfke"]),
    r([5, "egggfFfGGGFkFke"]),
    r([6, "eggFGFGGGkkke"]),
    r([6, "egGGGGGGkkkke"]),
    r([7, "eeGGGkkkkee"]),
    r([9, "eeTteee"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([10, "eeeee"]),
    r([7, "eeegggggeee"]),
    r([6, "ehgggggggggGe"]),
    r([5, "ehggggggggGGGGe"]),
    r([4, "ehggggggggfGfGfGe"]),
    r([4, "eggggggggGfttTfke"]),
    r([4, "eggfgfgfGGGtTTkke"]),
    r([4, "eggfttTfGGfGFkfke"]),
    r([4, "egggtTTGGGGGkkkke"]),
    r([5, "egfgFGfGfGfkkke"]),
    r([6, "eGGGGfttTfkke"]),
    r([7, "eeeGGtTTeee"]),
    r([10, "eftFef"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 무 — 무성한 무청 + (3) 흙 위로 솟은 흰 무(어깨는 연두). */
const RADISH: [string[], string[]] = [
  [
    r([11, "ee"]),
    r([10, "ehGe"]),
    r([9, "eehGee"]),
    r([8, "eGegkehe"]),
    r([7, "ehGegKehGe"]),
    r([7, "egkeeeegke"]),
    r([7, "ege"], [11, "egeeKe"]),
    r([7, "eee"], [11, "egeeee"]),
    r([6, "eggGeegehgge"]),
    r([5, "egGke"], [11, "egeeGkKe"]),
    r([6, "eee"], [11, "ege"], [15, "eee"]),
    r([11, "ege"]),
    r([11, "ege"]),
    r([11, "Hfe"]),
    r([10, "oHFo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([11, "ee"]),
    r([10, "ehGe"]),
    r([8, "e"], [10, "ehGe"], [15, "e"]),
    r([7, "eGeegkeehe"]),
    r([6, "ehGeegKeehGe"]),
    r([6, "egke"], [11, "ee"], [14, "egke"]),
    r([6, "ege"], [11, "ege"], [15, "eKe"]),
    r([6, "eeGe"], [11, "egeehee"]),
    r([5, "egGGe"], [11, "egeehgGe"]),
    r([4, "egGGe"], [11, "ege"], [15, "eGGke"]),
    r([4, "egee"], [11, "ege"], [16, "eeKe"]),
    r([5, "e"], [11, "ege"], [18, "e"]),
    r([11, "ggg"]),
    r([9, "hhhGGGG"]),
    r([8, "offffFFdo"]),
    r([8, "offfFFddo"]),
    r([8, "offFFddDo"]),
    r([9, "oFFddDo"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 시금치 — 낮은 숟가락 잎 로제트 + 분홍 뿌리. */
const SPINACH: [string[], string[]] = [
  [
    r([11, "ee"]),
    r([10, "egge"]),
    r([10, "egge"]),
    r([8, "eeggGGee"]),
    r([7, "egggGGGGke"]),
    r([6, "eggGeeeekkKe"]),
    r([6, "egee"], [14, "eeKe"]),
    r([7, "e"], [16, "e"]),
    r([11, "DfD"]),
    r([12, "d"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([11, "ee"]),
    r([10, "egge"]),
    r([8, "eeggggee"]),
    r([7, "egggggggGe"]),
    r([6, "egggggggGGGe"]),
    r([6, "egggggkGGGGe"]),
    r([5, "eggggegGeGGGke"]),
    r([4, "eggggeeGGeeGkkke"]),
    r([4, "egggkeGGGGekkkke"]),
    r([4, "egggeeGGGGeekkKe"]),
    r([5, "eee"], [10, "eGGe"], [16, "eee"]),
    r([10, "eGke"]),
    r([10, "DffD"]),
    r([11, "dF"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 귤 — 반들한 잎의 작은 나무 + (3) 주황 열매 여섯. */
const TANGERINE: [string[], string[]] = [
  [
    r([9, "eeeeeee"]),
    r([8, "ehgggggge"]),
    r([7, "ehgggggggGe"]),
    r([6, "ehgggggggGGGe"]),
    r([5, "egggggggGgKGGGe"]),
    r([5, "eggggggGGGGGkke"]),
    r([5, "eggggKGGGGGkkke"]),
    r([6, "egggGGGGGgKke"]),
    r([7, "eGGGGGGkkke"]),
    r([8, "eGGGkkkke"]),
    r([9, "eeTteee"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([10, "eeeee"]),
    r([7, "eeegggggeee"]),
    r([6, "ehgggggggggGe"]),
    r([5, "ehggggHFggGGGGe"]),
    r([4, "ehgggggFDgGGGGGGe"]),
    r([4, "eggggggggGGGGGGke"]),
    r([4, "eggHFgggGGGHFGkke"]),
    r([4, "eggFDggGGGGFDkkke"]),
    r([4, "egggggGGGGGGkkkke"]),
    r([5, "egggHFGGGHFkkHF"]),
    r([6, "eGGFDGGGFDkkFD"]),
    r([7, "eeeGGkkkeee"]),
    r([10, "eTtee"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([11, "Tt"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
];

/** 밀 — 벼와 달리 **꼿꼿이 선** 이삭 + 위로 뻗은 수염(s). 줄기·이삭 모두 짚색 테두리(벼와 같은 이유). */
const WHEAT: [string[], string[]] = [
  [
    r([9, "e"], [12, "e"], [15, "e"]),
    r([8, "eheeheehe"]),
    r([8, "ehGehGehG"]),
    r([8, "egGegGegG"]),
    r([8, "eG"], [11, "eG"], [14, "eG"]),
    r([9, "G"], [12, "G"], [15, "G"]),
    r([9, "G"], [12, "G"], [15, "G"]),
    r([9, "G"], [12, "G"], [15, "G"]),
    r([9, "G"], [12, "G"], [15, "G"], [18, "g"]),
    r([6, "g"], [9, "G"], [12, "G"], [14, "hG"], [17, "gg"]),
    r([7, "g"], [9, "G"], [12, "GhhG"], [17, "g"]),
    r([7, "g"], [9, "Gh"], [12, "Gh"], [15, "Ggg"]),
    r([8, "gGhhG"], [15, "Gg"]),
    r([8, "gG"], [11, "hG"], [15, "G"]),
    r([9, "G"], [11, "hG"], [15, "G"]),
    r([9, "G"], [12, "G"], [15, "G"]),
    r([9, "G"], [12, "G"], [15, "G"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
  ],
  [
    r([10, "s"], [12, "ss"], [15, "s"]),
    r([11, "s"], [14, "s"]),
    r([7, "s"], [9, "s"], [11, "TT"], [14, "TTs"], [18, "s"]),
    r([8, "s"], [10, "THfTHfTs"]),
    r([8, "TTTfFTfFTTT"]),
    r([7, "THfTHfTHfTHfT"]),
    r([7, "TfFTfFTfFTfFT"]),
    r([7, "THfTHtTHtTHfT"]),
    r([7, "TfFTTT"], [14, "TTTfFT"]),
    r([7, "THtTt"], [14, "t"], [16, "THtT"]),
    r([8, "TT"], [11, "t"], [14, "t"], [17, "TT"]),
    r([8, "t"], [11, "t"], [14, "t"], [17, "tT"]),
    r([5, "TT"], [8, "t"], [11, "t"], [14, "t"], [16, "TttT"]),
    r([4, "TFtTt"], [11, "t"], [14, "t"], [16, "TtT"]),
    r([4, "TFT"], [8, "t"], [11, "t"], [14, "t"], [17, "t"]),
    r([5, "T"], [8, "t"], [11, "t"], [14, "t"], [17, "t"]),
    r([8, "t"], [11, "t"], [14, "t"], [17, "t"]),
    r([8, "t"], [11, "t"], [14, "t"], [17, "t"]),
    r([8, "t"], [11, "t"], [14, "t"], [17, "t"]),
    r([8, "t"], [11, "t"], [14, "t"], [17, "t"]),
    r([8, "uUuuuuuUu"]),
    r([8, "UuuuuuuuU"]),
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
  // ── 2026-09-23 확장 16종 ──
  potato: { fruit: ["#f5dca8", "#d9ae6a", "#a67a3c"], late: POTATO },
  pea: { fruit: ["#d6fbab", "#9ee066", "#5ea83a"], late: PEA },
  lettuce: { fruit: ["#dcfab0", "#a3e064", "#5fa83c"], late: LETTUCE },
  tea: { fruit: ["#e8ffa8", "#b8ec5c", "#76b83a"], leaf: ["#5fbf6a", "#2f8f4a", "#1c5f33"], late: TEA },
  pepper: { fruit: ["#ff9f8a", "#ec3b2c", "#a51b14"], late: PEPPER },
  cucumber: { fruit: ["#8fd66a", "#3a9a3f", "#1d5f26"], late: CUCUMBER },
  eggplant: { fruit: ["#caa6f5", "#7a42bf", "#46207e"], late: EGGPLANT },
  blueberry: { fruit: ["#b3cdff", "#4f6fe0", "#2b3a96"], late: BLUEBERRY },
  rice: { fruit: ["#ffe89e", "#f5cf5f", "#d6a441"], leaf: ["#b5e36b", "#7fbf47", "#4f8f33"], late: RICE },
  sweetpotato: { fruit: ["#f2a8cf", "#bd4a86", "#7a2452"], leaf: ["#8fe06a", "#56b84a", "#2f7f36"], late: SWEETPOTATO },
  apple: { fruit: ["#ff9f96", "#e43a44", "#9e1a26"], late: APPLE },
  chestnut: { fruit: ["#e9f59a", "#a9c93c", "#6a8a1c"], late: CHESTNUT },
  radish: { fruit: ["#ffffff", "#eef3e2", "#b9c9a6"], late: RADISH },
  spinach: { fruit: ["#ffb8c8", "#e8648a", "#a8385a"], leaf: ["#5fbf5a", "#2f8a3a", "#1a5a2a"], late: SPINACH },
  tangerine: { fruit: ["#ffc98a", "#ff8a1f", "#c4560c"], late: TANGERINE },
  wheat: { fruit: ["#ffe08a", "#f2bc4a", "#c98f2c"], leaf: ["#c9e07a", "#98b84a", "#657f2c"], late: WHEAT },
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
    ...DISH_ACCENT,
  };
};
/** 요리 공용 강조색(2026-09-23) — 비빔밥 나물·김밥 속재료·라따뚜이처럼 **여러 색이 한 그릇에** 담기는
 *  요리용. 램프 하나(내용물)로는 색색 토핑을 못 그린다. 요리마다 바뀌지 않는 고정색이다.
 *  a/A 초록 · r/R 빨강 · y/Y 노랑 · n 흰밥 · k/K 김·돌솥(검정) · b/B 갈색 */
const DISH_ACCENT = {
  a: "#7fd96a", A: "#2f7f36", r: "#ff5a4a", R: "#b8261c", y: "#ffd84d", Y: "#e0a02e",
  n: "#fffdf5", k: "#1f2029", K: "#3c3f4c", b: "#9a6a3e", B: "#5c3a1f",
} as const;

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

/* ── 요리 23종 확장(2026-09-23) ─────────────────────────────────
 * [사용자 요청 "더 많은 요리들"] 그릇 모양이 곧 요리의 이름이다 — 돌솥(비빔밥)·옹기(김치)·찻잔(녹차)·
 * 자루(밀가루)처럼 **실루엣으로** 갈리게 그렸다. 잼·주스·수프처럼 같은 계열은 기존 병·잔·그릇을 쓴다.
 * 도형 초안 → PNG 확인 → r() 런으로 옮겼다(고칠 땐 행을 통째로 갈아라). */

/** 밀가루 — 끈으로 묶은 천 자루 + 위로 보이는 흰 가루. */
const FLOUR: string[] = [
  r([10, "ssss"]),
  r([9, "sHffFs"]),
  r([8, "oHfffFDo"]),
  r([9, "ovVVVo"]),
  r([10, "obbo"]),
  r([9, "ovVVVo"]),
  r([8, "ovVVVVWo"]),
  r([7, "ovVVVVVVWo"]),
  r([6, "ovVVVVVVVVWo"]),
  r([6, "ovVVwwwVVVWo"]),
  r([6, "ovVwHffwVVWo"]),
  r([6, "ovVwffFwVVWo"]),
  r([6, "ovVVwwwVVVWo"]),
  r([6, "ovVVVVVVVWWo"]),
  r([7, "owVVVVVWWo"]),
  r([8, "oooooooo"]),
];

/** 가래떡 — 나무 도마 위 흰 떡 가래 셋. */
const RICECAKE: string[] = [
  r([6, "oooooooooo"]),
  r([5, "oHffffffffFo"]),
  r([6, "oooooooooo"]),
  r([4, "oooooooooo"]),
  r([3, "oHffffffffFo"]),
  r([4, "oooooooooooo"]),
  r([6, "oHffffffffFo"]),
  r([7, "oooooooooo"]),
  r([2, "oooooooooooooooooooo"]),
  r([1, "ovVVVVVVVVVVVVVVVVVWWo"]),
  r([1, "owWWWWWWWWWWWWWWWWWWWo"]),
  r([2, "oooooooooooooooooooo"]),
];

/** 고추장 — 뚜껑 달린 붉은 네모 통(라벨 y). */
const GOCHUJANG: string[] = [
  r([5, "oooooooooooooo"]),
  r([4, "ovVVVVVVVVVVVVWo"]),
  r([4, "owWWWWWWWWWWWWWo"]),
  r([4, "oooooooooooooooo"]),
  r([5, "oHfffffffffFDo"]),
  r([5, "offfsssssfFFDo"]),
  r([5, "offsyyyyysFFDo"]),
  r([5, "offsyYYYysFFDo"]),
  r([5, "offsssssssFFDo"]),
  r([5, "offfffffffFFDo"]),
  r([5, "oFFFFFFFFFFDDo"]),
  r([6, "oooooooooooo"]),
];

/** 김치 — 옹기(갈색 항아리) 위로 빨간 김치 + 배추 잎. */
const KIMCHI: string[] = [
  r([10, "aA"]),
  r([9, "aAAa"]),
  r([8, "oHfrfFo"]),
  r([7, "oHfRfrFDo"]),
  r([6, "ooooooooooo"]),
  r([5, "ovVVVVVVVVVWo"]),
  r([4, "ovVVVVVVVVVVWWo"]),
  r([4, "ovVVbbbbbbVVWWo"]),
  r([4, "ovVVVVVVVVVVWWo"]),
  r([4, "ovVVVVVVVVVVWWo"]),
  r([5, "owVVVVVVVVWWo"]),
  r([6, "owWWWWWWWWo"]),
  r([7, "oooooooooo"]),
];

/** 비빔밥 — 검은 돌솥(k/K) + 색색 나물 + 가운데 노른자. */
const BIBIMBAP: string[] = [
  r([7, "oooooooooo"]),
  r([5, "oonaaynrrnnoo"]),
  r([4, "onaAayYyrRrnbno"]),
  r([3, "onnaAnyyynrRnbBno"]),
  r([3, "onaaAnnnnnnrnbBno"]),
  r([3, "kkkkkkkkkkkkkkkkk"]),
  r([3, "kKKKKKKKKKKKKKKKk"]),
  r([4, "kKKKKKKKKKKKKKk"]),
  r([5, "kKKKKKKKKKKKk"]),
  r([6, "kkkkkkkkkkk"]),
  r([4, "kkk"], [16, "kkk"]),
];

/** 김밥 — 접시 위 세 알(김 k · 흰밥 n · 속재료 r/y/a). */
const GIMBAP: string[] = [
  r([4, "kkkkk"], [11, "kkkkk"]),
  r([3, "knnnnnkknnnnnk"]),
  r([3, "knnyrnkknaynnk"]),
  r([3, "knanynkknnrank"]),
  r([3, "knnnnnkknnnnnk"]),
  r([4, "kkkkkkkkkkkkkk"]),
  r([10, "knnnnnk"]),
  r([2, "oooooookknyarnkoooooo"]),
  r([1, "ovVVVVVVkknnnnnkVVVVWo"]),
  r([1, "owWWWWWWWWkkkkkWWWWWWo"]),
  r([2, "oooooooooooooooooooo"]),
];

/** 떡볶이 — 붉은 소스 접시 + 흰 떡(n) + 어묵(b). */
const TTEOKBOKKI: string[] = [
  r([6, "ooooooooooo"]),
  r([4, "ooHfsssfffssFoo"]),
  r([3, "oHffsHnsfbbfsnFDo"]),
  r([2, "oHfsnnnsffbBfssnFDo"]),
  r([2, "ofssnsfffsnnsfffFDo"]),
  r([2, "offfsffsnnnsffsnFDo"]),
  r([3, "oFFFFFFsssFFFFFDo"]),
  r([2, "oooooooooooooooooooo"]),
  r([1, "ovVVVVVVVVVVVVVVVVVWo"]),
  r([1, "owWWWWWWWWWWWWWWWWWWo"]),
  r([2, "oooooooooooooooooooo"]),
];

/** 호박죽 — 흰 그릇의 노란 죽 + 팥 한 점(b). */
const HOBAKJUK: string[] = [
  r([6, "osssssso"]),
  r([4, "oHfffffffFDo"]),
  r([3, "oHffffbffffFDo"]),
  r([3, "ovffffffffffVo"]),
  r([3, "ovVfffffffFVWo"]),
  r([4, "ovVVVVVVVVWo"]),
  r([5, "ovVVVVVVWWo"]),
  r([6, "owVVVWWo"]),
  r([7, "ooWWWoo"]),
  r([9, "oooo"]),
];

/** 감자전 — 노릇한 둥근 전 + 파(a). */
const GAMJAJEON: string[] = [
  r([6, "oooooooooo"]),
  r([4, "ooHffffaffFFoo"]),
  r([3, "oHffFfffffFfFFDo"]),
  r([3, "ofFfffaffFffffDo"]),
  r([3, "offffFffffffaFDo"]),
  r([4, "oFFfffFffFFFDo"]),
  r([2, "ooooooooooooooooooo"]),
  r([1, "ovVVVVVVVVVVVVVVVVWo"]),
  r([2, "ooooooooooooooooooo"]),
];

/** 뭇국 — 깊은 나무 국그릇 + 네모 무 조각(n). */
const MUGUK: string[] = [
  r([5, "oooooooooooo"]),
  r([4, "oHfffnnfffffFo"]),
  r([3, "ovffnnffffnnfFVo"]),
  r([3, "ovVfffffnnffFVWo"]),
  r([3, "ovVVffffffffVVWo"]),
  r([4, "ovVVVVVVVVVVWo"]),
  r([4, "ovVVVVVVVVVVWo"]),
  r([5, "ovVVVVVVVVWo"]),
  r([6, "oowWWWWWoo"]),
  r([8, "oooooo"]),
];

/** 쌈밥 — 상추 잎(a/A) 위에 밥 + 고추(r/R). */
const SSAMBAP: string[] = [
  r([9, "rR"]),
  r([6, "oonnrRo"]),
  r([5, "onnnnnRno"]),
  r([3, "aaAnnnnnnnaaA"]),
  r([2, "aHaaAAnnnaaAaaA"]),
  r([2, "aaAaaaAAAaaAaAA"]),
  r([3, "AAaaaAaaaAAAA"]),
  r([2, "oooooooooooooooooo"]),
  r([1, "ovVVVVVVVVVVVVVVVVWo"]),
  r([2, "oooooooooooooooooo"]),
];

/** 식혜 — 흰 사기 사발 + 동동 뜬 밥알(n). 뭇국(나무 그릇)과 갈리게 그릇색을 뒀다. */
const SIKHYE: string[] = [
  r([4, "oooooooooooooo"]),
  r([3, "oHfnffnfffnffFo"]),
  r([3, "ovffffnffnfffVo"]),
  r([3, "ovVffffffffFVWo"]),
  r([4, "ovVVVVVVVVVWo"]),
  r([5, "ovVVVVVVVWo"]),
  r([6, "oowWWWWoo"]),
  r([8, "oooo"]),
];

/** 막걸리 — 목이 짧은 흰 병 + 초록 라벨. */
const MAKGEOLLI: string[] = [
  r([10, "oooo"]),
  r([10, "oaAo"]),
  r([10, "oooo"]),
  r([9, "ovVWo"]),
  r([8, "ovVVWWo"]),
  r([7, "oHfffffFo"]),
  r([7, "ofsffffFo"]),
  r([7, "ofsffffFo"]),
  r([7, "oaaaaaaAo"]),
  r([7, "oaAyyAaAo"]),
  r([7, "oaaaaaaAo"]),
  r([7, "ofsffffFo"]),
  r([7, "offfffFFo"]),
  r([7, "oFFFFFFDo"]),
  r([8, "oooooo"]),
];

/** 군밤 — 종이 봉투 + 위로 소복한 밤(b/B). */
const GUNBAM: string[] = [
  r([8, "bb"], [11, "bb"]),
  r([7, "bHBbHBb"], [15, "bb"]),
  r([6, "bHBBbHBbHBb"]),
  r([6, "oooooooooooo"]),
  r([6, "ovVVVVVVVVWo"]),
  r([6, "ovVVVVVVVVWo"]),
  r([6, "ovVwwwwwVVWo"]),
  r([6, "ovVVVVVVVVWo"]),
  r([6, "ovVVVVVVVVWo"]),
  r([6, "ovVVVVVVVVWo"]),
  r([6, "owWWWWWWWWWo"]),
  r([6, "oooooooooooo"]),
];

/** 군고구마 — 은박지 사이로 보이는 노란 속. */
const GOGUMA: string[] = [
  r([8, "oooooooo"]),
  r([6, "ooHffffffFoo"]),
  r([5, "oHfffsfffffFDo"]),
  r([4, "ovvvvvvvvvvvvvWo"]),
  r([3, "ovVvVVvVVvVVVVWWo"]),
  r([3, "ovVVVVVVVVVVVVWWo"]),
  r([4, "owWWWWWWWWWWWWo"]),
  r([5, "oooooooooooooo"]),
];

/** 식빵 — 봉긋한 윗면(진한 크러스트 d/D) + 속살. */
const BREAD: string[] = [
  r([6, "oooo"], [12, "oooo"]),
  r([5, "oddDDooddDDo"]),
  r([4, "odHfffddHfffDo"]),
  r([4, "odffffffffffDo"]),
  r([4, "odfffffffffFDo"]),
  r([4, "odfffffffffFDo"]),
  r([4, "odffffffffFFDo"]),
  r([4, "odfffffffFFFDo"]),
  r([4, "odFFFFFFFFFFDo"]),
  r([4, "oddddddddddddo"]),
  r([5, "oooooooooooo"]),
];

/** 사과파이 — 삼각 조각(격자 크러스트 + 사과 속 r/R). 호박파이(원판)와 실루엣이 갈린다. */
const APPLEPIE: string[] = [
  r([18, "oo"]),
  r([15, "ooVWo"]),
  r([12, "oovVwVWo"]),
  r([9, "oovVwVVwVWo"]),
  r([6, "oovVwVVwVVwVWo"]),
  r([4, "ovVwVVwVVwVVwVWWo"]),
  r([3, "orfrfrRfrRfrfRfrRo"]),
  r([3, "ofFfFFfFFfFFfFFFDo"]),
  r([3, "owWWWWWWWWWWWWWWWo"]),
  r([4, "oooooooooooooooo"]),
];

/** 녹차 — 손잡이 없는 옥빛 찻잔 + 김(s). */
const GREENTEA: string[] = [
  r([9, "s"], [12, "s"]),
  r([8, "s"], [11, "s"]),
  r([9, "s"], [12, "s"]),
  BLANK,
  r([6, "oooooooooooo"]),
  r([5, "oHfffffffffFo"]),
  r([5, "ovffffffffFVo"]),
  r([5, "ovVVVVVVVVVWo"]),
  r([5, "ovVwwVVVVVVWo"]),
  r([6, "ovVVVVVVVWo"]),
  r([7, "owVVVVVWo"]),
  r([8, "oWWWWo"]),
  r([9, "oooo"]),
];

/** 라따뚜이 — 손잡이 달린 팬에 빙 둘러 놓은 채소 조각(r/y/a). */
const RATATOUILLE: string[] = [
  r([7, "oooooooooo"]),
  r([5, "oorRyYaArRyYoo"]),
  r([4, "orRfyYfaAfrRfyo"]),
  r([3, "oyYfrRfyYfaAfrRao"]),
  r([3, "oaAfyYfrRfyYfaAyo"]),
  r([4, "orRfaAfyYfrRfyo"]),
  r([5, "ooWWWWWWWWWWoooooo"]),
  r([6, "owWWWWWWWWWo"], [20, "ooo"]),
  r([7, "oooooooooo"]),
];

/* ── 생산 재료 3종 + 그 재료로 만드는 요리 9종(2026-09-23) ──────────
 * 꿀·달걀·우유는 제품이 아니라 **생산 장식(벌통·닭장·젖소)이 만드는 재료**다. 그림은 이 표에 같이
 * 둔다 — 창고·레시피에서 같은 진입점(ProductIcon)으로 그리기 위해서다. */

/** 꿀(생산 재료) — 꿀단지 + 꿀 뜨개. */
const P_HONEY: string[] = [
  r([15, "bb"]),
  r([14, "bB"]),
  r([13, "bB"]),
  r([7, "oooooooooo"]),
  r([6, "oHffffffFDo"]),
  r([6, "ovHfffFvVWo"]),
  r([6, "ovVfVVVVVWWo"]),
  r([5, "ovVVfVVVVVWWo"]),
  r([4, "ovVVVVVyyVVVWWo"]),
  r([4, "ovVVVVyYYyVVVWo"]),
  r([4, "ovVVVVVyyVVVVWo"]),
  r([4, "owVVVVVVVVVVWWo"]),
  r([5, "owWWWWWWWWWWo"]),
  r([6, "ooooooooooo"]),
];

/** 달걀(생산 재료) — 짚 바구니에 담긴 셋. */
const P_EGG: string[] = [
  r([10, "oooo"]),
  r([6, "oooooHffo"], [16, "oooo"]),
  r([5, "oHffoHfffFoHffo"]),
  r([5, "offFofffFFoffFo"]),
  r([5, "ofFFofFFFDofFDo"]),
  r([3, "vvwvvwvvwvvwvvwvvw"]),
  r([2, "vVwVVwVVwVVwVVwVVwVv"]),
  r([2, "owVVwVVwVVwVVwVVwVWo"]),
  r([2, "owWWWWWWWWWWWWWWWWo"]),
  r([4, "oooooooooooooooo"]),
];

/** 우유(생산 재료) — 뚜껑 달린 유리병 + 초록 라벨. */
const P_MILK: string[] = [
  r([10, "kkkk"]),
  r([9, "kKKKKk"]),
  r([9, "ovvvvo"]),
  r([9, "oHffFo"]),
  r([8, "oHffffFo"]),
  r([7, "oHffffffFo"]),
  r([7, "ofaaaaaaFo"]),
  r([7, "ofayyyyaFo"]),
  r([7, "ofaaaaaaFo"]),
  r([7, "offfffffFo"]),
  r([7, "offffffFFo"]),
  r([7, "oFFFFFFFDo"]),
  r([7, "oooooooooo"]),
];

/** 치즈 — 구멍 난 노란 쐐기. ⚠ 구멍을 D 로 찍으면 진홍(노란 램프의 색상 이동)이라 피자처럼 보인다 — v 로 찍었다. */
const P_CHEESE: string[] = [
  r([15, "oo"]),
  r([12, "ooHfo"]),
  r([9, "ooHffffo"]),
  r([6, "ooHfffvffFo"]),
  r([3, "ooHffffffffFFo"]),
  r([2, "oHffvfffffvfFFFo"]),
  r([2, "ofFFfffvvffffFFo"]),
  r([2, "offfffffffvfFFFo"]),
  r([2, "ofvfffvfffffFFFo"]),
  r([2, "oFFFFFFFFFFFFFFo"]),
  r([2, "oooooooooooooooo"]),
];

/** 팬케이크 — 세 겹 + 버터 + 시럽. */
const P_PANCAKE: string[] = [
  r([11, "yy"]),
  r([10, "yYYy"]),
  r([6, "oooooooooooo"]),
  r([5, "oHffbbffbfffFo"]),
  r([4, "ofFFbFFFFbFFFDo"]),
  r([4, "ooooooooooooooo"]),
  r([4, "oHffffbfffffffFo"]),
  r([3, "ofFFFFFFFFFFFFFDo"]),
  r([4, "oooooooooooooooo"]),
  r([2, "oHfffffffffffffffFo"]),
  r([2, "ofFFFFFFFFFFFFFFFDo"]),
  r([1, "ooooooooooooooooooooo"]),
  r([1, "ovVVVVVVVVVVVVVVVVVWo"]),
  r([1, "ooooooooooooooooooooo"]),
];

/** 딸기케이크 — 생크림 층 + 딸기 셋. */
const P_CAKE: string[] = [
  r([6, "rR"], [11, "rR"], [16, "rR"]),
  r([5, "rRRa"], [10, "rRRa"], [15, "rRRa"]),
  r([4, "oooooooooooooooo"]),
  r([3, "oHnnnnnnnnnnnnnnno"]),
  r([3, "onnnnnnnnnnnnnnnno"]),
  r([3, "orRrRrRrRrRrRrRrRo"]),
  r([3, "onnnnnnnnnnnnnnnno"]),
  r([3, "ofFFfFFfFFfFFfFFFo"]),
  r([3, "onnnnnnnnnnnnnnnno"]),
  r([3, "ofFFFFFFFFFFFFFFDo"]),
  r([2, "oooooooooooooooooooo"]),
  r([2, "ovVVVVVVVVVVVVVVVVWo"]),
  r([2, "oooooooooooooooooooo"]),
];

/** 푸딩 — 캐러멜 모자 + 커스터드. */
const P_PUDDING: string[] = [
  r([9, "oooooo"]),
  r([8, "oBBbbBBo"]),
  r([7, "oBbbbbbBBo"]),
  r([6, "oHffffffFFo"]),
  r([5, "oHfffffffFFDo"]),
  r([5, "offffffffFFFDo"]),
  r([4, "offffffffFFFFDo"]),
  r([4, "ofFFFFFFFFFFFFDo"]),
  r([2, "oooooooooooooooooooo"]),
  r([2, "ovVVVVVVVVVVVVVVVVWo"]),
  r([2, "oooooooooooooooooooo"]),
];

/** 녹차라떼 — 손잡이 머그 + 하트 거품. */
const P_LATTE: string[] = [
  r([8, "s"], [11, "s"]),
  r([9, "s"], [12, "s"]),
  r([6, "oooooooooooo"]),
  r([6, "oHffnnnnffFo"]),
  r([6, "ovHfnnnnfFVooo"]),
  r([6, "ovVVVVVVVVWooWo"]),
  r([6, "ovVVVVVVVVWoooWo"]),
  r([6, "ovVVwwVVVVWWWWo"]),
  r([6, "ovVVVVVVVVWooo"]),
  r([7, "ovVVVVVVWWo"]),
  r([8, "owWWWWWWo"]),
  r([9, "oooooooo"]),
];

/** 고구마맛탕 — 윤기 도는 조각 + 검은깨. */
const P_MATTANG: string[] = [
  r([6, "oooo"], [12, "ooooo"]),
  r([5, "oHffFooHfffFo"]),
  r([5, "offkFooffkfDo"]),
  r([5, "oFFooooFFFDDo"]),
  r([6, "ooHffkFFooo"]),
  r([7, "offfffDooHfo"]),
  r([7, "oFFFFDDooffo"]),
  r([3, "oooooooooooooooooo"]),
  r([2, "ovVVVVVVVVVVVVVVVWo"]),
  r([3, "oooooooooooooooooo"]),
];

/** 약밥 — 갈색 찰밥 네모 둘 + 밤·대추. */
const P_YAKBAP: string[] = [
  r([4, "oooooooo"], [13, "oooooooo"]),
  r([4, "oHffyfFo"], [13, "oHfrffFo"]),
  r([4, "offfffDo"], [13, "offffyDo"]),
  r([4, "ofrfffDo"], [13, "offfffDo"]),
  r([4, "oFFFFFDo"], [13, "oFFFFFDo"]),
  r([4, "oooooooo"], [13, "oooooooo"]),
  r([2, "oooooooooooooooooooo"]),
  r([2, "ovVVVVVVVVVVVVVVVVWo"]),
  r([2, "oooooooooooooooooooo"]),
];

/** 오므라이스 — 노란 오믈렛 돔 + 케첩. */
const P_OMURICE: string[] = [
  r([8, "oooooooo"]),
  r([6, "ooHffffffFoo"]),
  r([5, "oHffrrrrfffFDo"]),
  r([4, "oHfffrRRrrffFFDo"]),
  r([3, "offffffrRffffFFDo"]),
  r([3, "offffffffffffFFDDo"]),
  r([2, "oFFFFFFFFFFFFFFFDDo"]),
  r([1, "oooooooooooooooooooooo"]),
  r([1, "ovVVVVVVVVVVVVVVVVVVWo"]),
  r([1, "oooooooooooooooooooooo"]),
];

/** 피자 — 둥근 한 판(치즈·토마토·고추). */
const P_PIZZA: string[] = [
  r([7, "oooooooooo"]),
  r([5, "ooHffrffffFoo"]),
  r([4, "oHffffffaffffFo"]),
  r([3, "ofrfffffffffrffDo"]),
  r([3, "offffaffrffffffDo"]),
  r([3, "offffffffffaffFDo"]),
  r([3, "oFffrffffffffFFDo"]),
  r([3, "ovFFFFFFFFFFFFFVo"]),
  r([3, "ovVVVVVVVVVVVVVWo"]),
  r([4, "ooooooooooooooo"]),
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
  // ── 2026-09-23 확장 23종 ──
  flour: { rows: FLOUR, fill: ["#ffffff", "#f5f1e6", "#d8cfb8"], vessel: ["#f2dfb8", "#d9bd88", "#a8874f"] },
  ricecake: { rows: RICECAKE, fill: ["#ffffff", "#f7f4ec", "#d9d2c2"], vessel: ["#d9a46a", "#b37a45", "#7f5230"] },
  gochujang: { rows: GOCHUJANG, fill: ["#ff8a7a", "#d83a2c", "#8f1a14"], vessel: ["#ff9d8f", "#e0463a", "#a3261c"] },
  kimchi: { rows: KIMCHI, fill: ["#ff8f7a", "#e0452f", "#9e2016"], vessel: ["#b98556", "#8a5a33", "#5c3a1f"] },
  bibimbap: { rows: BIBIMBAP, fill: ["#ffe08a", "#ffc93f", "#e0a02e"], vessel: ["#5a6072", "#414657", "#2b2f3d"] },
  gimbap: { rows: GIMBAP, fill: ["#fffdf5", "#f3efe2", "#d6cfbd"], vessel: ["#f2f4fb", "#d5daea", "#a9b0c7"] },
  tteokbokki: { rows: TTEOKBOKKI, fill: ["#ff8a6a", "#e8452a", "#a8200f"], vessel: ["#f2f4fb", "#d5daea", "#a9b0c7"] },
  hobakjuk: { rows: HOBAKJUK, fill: ["#ffe38a", "#ffc23a", "#d9901c"], vessel: ["#ffffff", "#e8ebf4", "#c3c9da"] },
  gamjajeon: { rows: GAMJAJEON, fill: ["#ffe7a3", "#f2c45c", "#c98f2c"], vessel: ["#f2f4fb", "#d5daea", "#a9b0c7"] },
  muguk: { rows: MUGUK, fill: ["#fff6d8", "#f0dfa8", "#cdb574"], vessel: ["#8f6a4a", "#6e4c32", "#4a3020"] },
  ssambap: { rows: SSAMBAP, fill: ["#ffffff", "#f5f1e6", "#d8cfb8"], vessel: ["#e7c9a0", "#c9a06a", "#957040"] },
  sikhye: { rows: SIKHYE, fill: ["#fbeccb", "#efd9a6", "#cdb074"], vessel: ["#ffffff", "#e3e9f5", "#9fb3d6"] },
  makgeolli: { rows: MAKGEOLLI, fill: ["#ffffff", "#f2f0ea", "#cfcbc0"], vessel: ["#f2f4fb", "#d5daea", "#a9b0c7"] },
  gunbam: { rows: GUNBAM, fill: ["#c98f5a", "#8a5a33", "#5c3a1f"], vessel: ["#f2dfb8", "#d9bd88", "#a8874f"] },
  goguma: { rows: GOGUMA, fill: ["#ffe38a", "#ffc23a", "#d9901c"], vessel: ["#f2f4fb", "#c3c9da", "#8f96ad"] },
  bread: { rows: BREAD, fill: ["#fff0cf", "#f5d99a", "#d9a857"], vessel: ["#e8a55a", "#c47c34", "#8a5220"] },
  applepie: { rows: APPLEPIE, fill: ["#ffd9a0", "#f2b35c", "#c9812c"], vessel: ["#f5d29a", "#dcaa5f", "#a8773a"] },
  citrustea: { rows: jar(), fill: ["#ffc98a", "#ff8a1f", "#c4560c"], vessel: ["#f2f4fb", "#d5daea", "#a9b0c7"] },
  berryjam: { rows: jar(), fill: ["#a9b8ff", "#4f5fd0", "#2b3490"], vessel: ["#ffe08a", "#ffc93f", "#e0a02e"] },
  greentea: { rows: GREENTEA, fill: ["#d9f2a0", "#a6d45a", "#6a9a33"], vessel: ["#c8f0e2", "#79cfb4", "#35806a"] },
  applejuice: { rows: glass(), fill: ["#fff0b0", "#f5d765", "#d6a93a"], vessel: ["#7fd8f0", "#46b6dd", "#2b87b3"] },
  ratatouille: { rows: RATATOUILLE, fill: ["#ffb08a", "#e8703a", "#a8401c"], vessel: ["#5a6072", "#414657", "#2b2f3d"] },
  peasoup: { rows: bowl(), fill: ["#c8f59a", "#8fd65a", "#5a9e33"], vessel: ["#ffffff", "#e8ebf4", "#c3c9da"] },
  // ── 생산 재료 + 그 재료 요리(2026-09-23) ──
  honey: { rows: P_HONEY, fill: ["#ffe38a", "#ffc23a", "#d98f1c"], vessel: ["#f5d29a", "#dca35a", "#a8773a"] },
  egg: { rows: P_EGG, fill: ["#ffffff", "#fbf3e2", "#dcc9a6"], vessel: ["#f2dc9a", "#dcb55c", "#a8823a"] },
  milk: { rows: P_MILK, fill: ["#ffffff", "#f5f7fb", "#cfd6e6"], vessel: ["#e3f5ff", "#b3dcf2", "#7fb3d6"] },
  cheese: { rows: P_CHEESE, fill: ["#fff0a0", "#ffd84d", "#e0a82e"], vessel: ["#f5c46a", "#e0a03a", "#b8781c"] },
  pancake: { rows: P_PANCAKE, fill: ["#ffdca0", "#e8a85a", "#b8742c"], vessel: ["#ffffff", "#e8ebf4", "#c3c9da"] },
  cake: { rows: P_CAKE, fill: ["#fff0cf", "#f5d99a", "#d9a857"], vessel: ["#ffffff", "#e8ebf4", "#c3c9da"] },
  pudding: { rows: P_PUDDING, fill: ["#fff0a8", "#ffd35c", "#d9a02e"], vessel: ["#ffffff", "#e8ebf4", "#c3c9da"] },
  latte: { rows: P_LATTE, fill: ["#d9f2a0", "#a6d45a", "#6a9a33"], vessel: ["#fff3d9", "#ffe1ad", "#e8bd7e"] },
  mattang: { rows: P_MATTANG, fill: ["#ffd57a", "#f0a83a", "#c4701c"], vessel: ["#f2f4fb", "#d5daea", "#a9b0c7"] },
  yakbap: { rows: P_YAKBAP, fill: ["#c98f5a", "#8a5a33", "#5c3a1f"], vessel: ["#e7c9a0", "#c9a06a", "#957040"] },
  omurice: { rows: P_OMURICE, fill: ["#fff0a0", "#ffd35c", "#e0a02e"], vessel: ["#ffffff", "#e8ebf4", "#c3c9da"] },
  pizza: { rows: P_PIZZA, fill: ["#fff0b0", "#ffd86a", "#e0a83a"], vessel: ["#e8a55a", "#c47c34", "#8a5220"] },
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
