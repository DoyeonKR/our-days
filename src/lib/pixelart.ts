// 픽셀 아트 스프라이트 — 손으로 찍은 도트. 한 글자 = 한 픽셀, '.'/공백 = 투명.
//
// 저작 규약(pixel.ts 포맷):
//  · 팔레트 글자는 의미로 고른다: o=외곽선 b=바디밝음 B=바디기본 d=바디그림자
//    w=흰자 e=눈동자 p=볼터치 y=포인트(부리/발) h=하이라이트
//  · 16x16 이 기본 캔버스. 지면은 y=15, 중심 x=7~8 (SVG 아트의 "지면 y=92·중심 x=50"과 같은 정신)
//  · 광원은 **좌상단** — 왼쪽/위가 밝고(b) 오른쪽/아래가 그늘(d). 전 스프라이트 공통.
//  · 애니는 프레임 배열. 프레임 간 실루엣이 크게 튀지 않게(1~2px) 그린다.
//
// ⚠ 색은 팔레트에만 두고 rows 엔 글자만 → 시간대 조명(tintPalette)이 전 스프라이트에 한 번에 먹는다.

import type { Sprite } from "./pixel";

/* ── 공용 팔레트 ─────────────────────────────────────────────── */
const OUT = "#3a2e4a"; // 외곽선(순수 검정 대신 보라빛 — 픽셀 아트 정석)
const EYE = "#2b2440";
const WHT = "#fffdf7";
const BLUSH = "#ff9fb8";

/** 펫 종류별 몸 색(밝음/기본/그늘) — 진화 계보가 색으로 이어진다. */
const BODY = {
  egg: ["#fff6e2", "#ffe9c4", "#e8c99a"],
  chick: ["#ffe9a3", "#ffd54a", "#e0a81f"], // 아기/햇살이
  cozy: ["#ffd9c2", "#ffb894", "#e08a63"], // 포근이
  fox: ["#ffcf9a", "#f0a862", "#c47c3c"], // 여우 계열
  cat: ["#e6e9f2", "#c3c9da", "#949cb3"], // 고양이 계열
  star: ["#e2d4ff", "#b18cf5", "#8259cf"], // 최종형(천상)
} as const;

const petPal = (k: keyof typeof BODY) => ({
  o: OUT,
  b: BODY[k][0],
  B: BODY[k][1],
  d: BODY[k][2],
  w: WHT,
  W: WHT, // 오른쪽 눈 흰자(좌우 대칭 표기용 — 같은 색, 도트를 읽기 쉽게)
  e: EYE,
  p: BLUSH,
  y: "#ffb02e",
  h: "#ffffff",
});

/* ── 알 (stage 0) — 살짝 갸웃거리는 2프레임 ───────────────────── */
export const EGG: Sprite[] = [
  {
    w: 16, h: 16, pal: petPal("egg"),
    rows: [
      "................",
      "................",
      ".....oooooo.....",
      "....obbbbBBo....",
      "...obbbbbBBBo...",
      "..obbbbbbBBBBo..",
      "..obhbbbbBBBBo..",
      ".obbbbbbbbBBBBo.",
      ".obbbbbbbbBBBBo.",
      ".obbbbbbbbBBBBo.",
      ".obbbbbbbbBBBBo.",
      "..obbbbbbBBBBo..",
      "..obbbbbbBBBBo..",
      "...obbbbBBBBo...",
      "....oooooooo....",
      "................",
    ],
  },
  {
    w: 16, h: 16, pal: petPal("egg"),
    rows: [
      "................",
      "................",
      "....oooooo......",
      "...obbbbBBo.....",
      "..obbbbbBBBo....",
      "..obbbbbbBBBo...",
      ".obhbbbbbBBBBo..",
      ".obbbbbbbbBBBo..",
      ".obbbbbbbbBBBBo.",
      ".obbbbbbbbBBBBo.",
      "..obbbbbbBBBBo..",
      "..obbbbbbBBBBo..",
      "...obbbbBBBBo...",
      "...obbbbBBBBo...",
      "....oooooooo....",
      "................",
    ],
  },
];

/** 병아리(아기/햇살이) — 걷기 2프레임(발 교대). */
const chickFrame = (footL: boolean): Sprite => ({
  w: 16, h: 16, pal: petPal("chick"),
  rows: [
    "................",
    ".......oo.......",
    "......obbo......",
    ".....obbbbo.....",
    "....obbbbbbo....",
    "...obwebbewbo...",
    "...obweBbeWbo...",
    "...obbbyybbbo...",
    "..obbppbbppbbo..",
    "..obbbbbbbBBBo..",
    "..obbbbbbbBBBo..",
    "..obbbbbbbBBBo..",
    "...obbbbbBBBo...",
    "....oooooooo....",
    footL ? "....yy....yy...." : "...yy......yy...",
    "................",
  ],
});
export const CHICK: Sprite[] = [chickFrame(true), chickFrame(false)];

/** 여우(3단계) — 뾰족 귀 + 꼬리. 걷기 2프레임. */
const foxFrame = (tailUp: boolean): Sprite => ({
  w: 16, h: 16, pal: petPal("fox"),
  rows: [
    "................",
    "..oo........oo..",
    ".obbo......obbo.",
    ".obBbo....obBbo.",
    "..obbboooobbbo..",
    "...obbbbbbbbbo..",
    "..obwebbbbewbo..",
    "..obweBbbBeWbo..",
    "..obbbbyybbbbo..",
    "..obbppbbppbbo..",
    tailUp ? ".obbbbbbbbBBBod." : "..obbbbbbbBBBo..",
    tailUp ? "..obbbbbbbBBBo.d" : "..obbbbbbbBBBodd",
    "..obbbbbbbBBBo..",
    "...obbbbbBBBo...",
    "....oooooooo....",
    "....yy....yy....",
  ],
});
export const FOX: Sprite[] = [foxFrame(true), foxFrame(false)];

/** 최종형(천상) — 왕관 + 오라 점. 반짝 2프레임. */
const starFrame = (sparkle: boolean): Sprite => ({
  w: 16, h: 16, pal: { ...petPal("star"), s: "#fff3b0" },
  rows: [
    sparkle ? "..s..........s.." : "................",
    ".....ysysy......",
    "......yyy.......",
    ".....oooooo.....",
    "....obbbbbbo....",
    "...obwebbewbo...",
    "...obweBbBeWbo..",
    "...obbbyybbbo...",
    "..obbppbbppbbo..",
    "..obbbbbbbBBBo..",
    ".obbbbbbbbBBBBo.",
    ".obbbbbbbbBBBBo.",
    "..obbbbbbbBBBo..",
    "...obbbbbBBBo...",
    "....oooooooo....",
    sparkle ? "...yy.s..yy....." : "...yy....yy.....",
  ],
});
export const STARPET: Sprite[] = [starFrame(true), starFrame(false)];

/** 잠자는 포즈(공통) — 눈 감고 옆으로. */
export const SLEEP: Sprite = {
  w: 16, h: 16, pal: petPal("chick"),
  rows: [
    "................",
    "................",
    "................",
    "................",
    "......oooooo....",
    ".....obbbbbbo...",
    "....obb----bbo..",
    "....obbbbbbbbo..",
    "...obbppbbppbo..",
    "...obbbbbbbBBo..",
    "...obbbbbbbBBo..",
    "....obbbbbBBo...",
    ".....oooooooo...",
    "................",
    "................",
    "................",
  ],
};
// '-' = 감은 눈(외곽선 색)
SLEEP.pal["-"] = OUT;

/* ── 풍경 타일/소품 ──────────────────────────────────────────── */

/** 잔디 타일 8x8 — 타일링해서 지면을 만든다. */
export const GRASS: Sprite = {
  w: 8, h: 8,
  pal: { g: "#6fbf47", G: "#57a637", d: "#3f8a2b", l: "#8ad95f" },
  rows: [
    "gGgggGgg",
    "ggglgggG",
    "GggggGgg",
    "gglggggg",
    "ggGgggdg",
    "ggggglgg",
    "gdggGggg",
    "ggggggdg",
  ],
};

/** 물 타일 8x8 — 2프레임으로 물결. */
export const WATER: Sprite[] = [
  {
    w: 8, h: 8,
    pal: { w: "#4fb8dd", W: "#2f92b8", f: "#a8e6f5" },
    rows: ["wwwwwwww", "wwffwwww", "wwwwwwww", "wwwwffww", "wwwwwwww", "ffwwwwww", "wwwwwwww", "wwwwwWww"],
  },
  {
    w: 8, h: 8,
    pal: { w: "#4fb8dd", W: "#2f92b8", f: "#a8e6f5" },
    rows: ["wwwwwwww", "wwwwffww", "wwwwwwww", "ffwwwwww", "wwwwwwww", "wwwwffww", "wwwwwwww", "wWwwwwww"],
  },
];

/** 나무 — 섬 실루엣용. */
export const TREE: Sprite = {
  w: 16, h: 16,
  pal: { o: "#2f5f28", l: "#7fd96a", L: "#4fb84a", d: "#2f7f36", t: "#8a5a37", T: "#633f26" },
  rows: [
    "................",
    ".....oooo.......",
    "....ollLLo......",
    "...ollllLLo.....",
    "..ollllllLLo....",
    "..olllllLLLo....",
    ".ollllllLLLLo...",
    ".olllllLLLdLo...",
    "..ollllLLLLo....",
    "...ollLLLLo.....",
    "....oottoo......",
    "......tT........",
    "......tT........",
    "......tT........",
    ".....ttTT.......",
    "................",
  ],
};

/** 꽃 — 데코/파티클용 4x4. */
export const FLOWER: Sprite = {
  w: 4, h: 4,
  pal: { p: "#ff8fb0", P: "#e05287", y: "#ffd24a", g: "#4fb84a" },
  rows: [".p..", "pyP.", ".Pg.", "..g."],
};

/** 하트 — 파티클용 5x5. */
export const HEART: Sprite = {
  w: 5, h: 5,
  pal: { r: "#ff6f9c", R: "#e0407a", h: "#ffc2d5" },
  rows: [".r.r.", "rhrrR", "rrrrR", ".RRR.", "..R.."],
};

/** 별 — 파티클용 5x5. */
export const STAR: Sprite = {
  w: 5, h: 5,
  pal: { y: "#ffe08a", Y: "#ffc93f", w: "#fffdf0" },
  rows: ["..y..", ".ywy.", "yYwYy", ".yYy.", "..y.."],
};

/* ── 펫 폼 → 스프라이트 매핑 ──────────────────────────────────
 * island.ts 의 PET_FORMS(28종)를 픽셀 4계보로 접는다. 없는 key 는 알로 폴백. */
export function petSprites(form: string): Sprite[] {
  if (form === "egg") return EGG;
  if (form === "hatchling" || form === "sunny" || form === "cozy" || form === "moody") return CHICK;
  const stage4 = /^(celestial|starlight|royal|lucky|guardian|honey|zen|dream|arcane|sage|lunar|spirit)_/.test(form);
  if (stage4) return STARPET;
  return FOX; // stage 3(여우/고양이/곰/판다/부엉이/늑대)
}

/** 전체 스프라이트 목록 — 정합성 테스트가 훑는다. */
export const ALL_SPRITES: Record<string, Sprite | Sprite[]> = {
  EGG, CHICK, FOX, STARPET, SLEEP, GRASS, WATER, TREE, FLOWER, HEART, STAR,
};
