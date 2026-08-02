// 픽셀 아트 스프라이트 — 손으로 찍은 도트. 한 글자 = 한 픽셀, '.'/공백 = 투명.
//
// ⚠ **일러스트(SVG) 아트와 같은 세계로 보여야 한다.** 그래서 두 가지를 강제한다:
//   1) 색은 `art/parts.tsx` 의 PAL 값을 **그대로** 복사해 쓴다(눈으로 맞추지 않는다).
//      여우=fur+cream · 고양이=gray+white · 곰=brown+cream · 판다=white+charcoal
//      부엉이=brown+cream · 늑대=charcoal+gray · 병아리=gold+cream
//   2) 실루엣은 종별 특징(귀 모양)을 유지한다 — SVG 의 foxBase/catBase/… 가
//      귀·주둥이로 종을 구분하듯, 도트도 삼각귀(여우/늑대)·둥근귀(곰/판다)·
//      뾰족귀(고양이)·깃뿔(부엉이)로 구분한다.
//   pixelart.test.ts 가 PAL 원본과 대조해 색이 어긋나면 실패시킨다.
//
// 저작 규약: 16x16 기본, 지면 y=15, 중심 x=7~8, 광원 좌상단(왼쪽/위가 밝음).
// 애니는 프레임 배열(실루엣이 1~2px 이상 튀지 않게).

import type { Sprite } from "./pixel";

/* ── PAL 복사본 — art/parts.tsx 의 값과 **반드시** 동일 ────────── */
export const PIXEL_PAL = {
  cream: ["#fff3d9", "#ffe1ad", "#e8bd7e"],
  peach: ["#ffd9c2", "#ffb894", "#e08a63"],
  fur: ["#ffcf9a", "#f0a862", "#c47c3c"],
  gray: ["#e6e9f2", "#c3c9da", "#949cb3"],
  charcoal: ["#5a6072", "#414657", "#2b2f3d"],
  white: ["#ffffff", "#f2f4fb", "#d5daea"],
  brown: ["#c99a6e", "#a3764f", "#775435"],
  rose: ["#ffb3cd", "#ff7fae", "#e05287"],
  gold: ["#ffe08a", "#ffc93f", "#e0a02e"],
  violet: ["#d9c2ff", "#b18cf5", "#8259cf"],
  mint: ["#b6f5df", "#6fe0bf", "#3bb191"],
  night: ["#3d3a68", "#2a2749", "#1a1830"],
  grass: ["#8ee36b", "#5cc447", "#3d9433"],
  leaf: ["#7fd96a", "#4fb84a", "#2f7f36"],
  water: ["#7fd8f0", "#46b6dd", "#2b87b3"],
  sand: ["#f7e2b0", "#eccf8e", "#cfae6a"],
} as const;

const INK = "#3a3350"; // 외곽선 — SVG 아트의 INK 톤(순수 검정 금지)
const EYE = "#2b2440";

type Tri = readonly [string, string, string];
/** 종별 팔레트 — 몸(b/B/d) + 배(c) + 귀속(i). SVG 의 fur/belly/inner 대응. */
const mk = (body: Tri, belly: Tri, inner: Tri) => ({
  o: INK,
  b: body[0],
  B: body[1],
  d: body[2],
  c: belly[0],
  C: belly[1],
  i: inner[1],
  w: "#fffdf7",
  W: "#fffdf7",
  e: EYE,
  p: PIXEL_PAL.rose[1],
  y: PIXEL_PAL.gold[1],
  h: "#ffffff",
});

const P = {
  egg: mk(PIXEL_PAL.cream, PIXEL_PAL.white, PIXEL_PAL.peach),
  chick: mk(PIXEL_PAL.gold, PIXEL_PAL.cream, PIXEL_PAL.peach),
  fox: mk(PIXEL_PAL.fur, PIXEL_PAL.cream, PIXEL_PAL.peach),
  cat: mk(PIXEL_PAL.gray, PIXEL_PAL.white, PIXEL_PAL.rose),
  bear: mk(PIXEL_PAL.brown, PIXEL_PAL.cream, PIXEL_PAL.peach),
  panda: mk(PIXEL_PAL.white, PIXEL_PAL.white, PIXEL_PAL.rose),
  owl: mk(PIXEL_PAL.brown, PIXEL_PAL.cream, PIXEL_PAL.gold),
  wolf: mk(PIXEL_PAL.charcoal, PIXEL_PAL.gray, PIXEL_PAL.gray),
  star: mk(PIXEL_PAL.violet, PIXEL_PAL.white, PIXEL_PAL.gold),
};

/* ── 알 (stage 0) ─────────────────────────────────────────────── */
const eggFrame = (tilt: boolean): Sprite => ({
  w: 16, h: 16, pal: P.egg,
  rows: tilt
    ? [
        "................", "................", "....oooooo......", "...obbbbBBo.....",
        "..obhbbbbBBo....", "..obbbbbbBBBo...", ".obbbbbbbbBBBo..", ".obbbbbbbbBBBo..",
        ".obbbbbbbbBBBo..", ".obbbbbbbbBBBo..", "..obbbbbbBBBo...", "..obbbbbbBBBo...",
        "...obbbbBBBo....", "....oooooooo....", "................", "................",
      ]
    : [
        "................", "................", ".....oooooo.....", "....obbbbBBo....",
        "...obhbbbbBBo...", "..obbbbbbbBBBo..", ".obbbbbbbbBBBBo.", ".obbbbbbbbBBBBo.",
        ".obbbbbbbbBBBBo.", ".obbbbbbbbBBBBo.", "..obbbbbbbBBBo..", "..obbbbbbbBBBo..",
        "...obbbbbBBBo...", "....oooooooo....", "................", "................",
      ],
});
export const EGG: Sprite[] = [eggFrame(false), eggFrame(true)];

/* ── 종별 몸통 팩토리 ──────────────────────────────────────────
 * 귀 2줄만 갈아끼우면 종이 바뀐다(SVG 의 *Base 함수와 같은 구조). */
type Ears = [string, string];
const EARS: Record<string, Ears> = {
  // 삼각 귀(여우·늑대)
  tri: ["..oo........oo..", ".obio......oibo."],
  // 뾰족 귀(고양이) — 더 좁고 높다
  sharp: ["...o..........o.", "..obo........obo"],
  // 둥근 귀(곰·판다)
  round: [".oo..........oo.", "obbo........obbo"],
  // 깃뿔(부엉이) — 안쪽으로 모임
  tuft: ["...oo......oo...", "..obbo....obbo.."],
  // 없음(병아리)
  none: ["................", ".......oo......."],
};

const bodyFrame = (
  pal: ReturnType<typeof mk>,
  ears: keyof typeof EARS,
  step: boolean,
  tail: boolean,
): Sprite => ({
  w: 16, h: 16, pal,
  rows: [
    EARS[ears][0],
    EARS[ears][1],
    "..oooooooooooo..",
    ".obbbbbbbbbbBBo.",
    ".obbbbbbbbbbBBo.",
    ".obweBbbbbBeWbo.", // 눈
    ".obbbbbbbbbbBBo.",
    "..obbbbyybbbBo..", // 코/부리
    "..obppbbbbppBo..", // 볼터치
    ".obcccbbbbcccBo.", // 배(밝은 색)
    tail ? ".obcccccccccBBod" : ".obcccccccccBBo.",
    tail ? "..obcccccccBBo.d" : "..obcccccccBBo..",
    "..obbbbbbbbbBo..",
    "...obbbbbbbBo...",
    "....oooooooo....",
    step ? "...yy......yy..." : "....yy....yy....",
  ],
});

const species = (pal: ReturnType<typeof mk>, ears: keyof typeof EARS, tail = false): Sprite[] => [
  bodyFrame(pal, ears, true, tail),
  bodyFrame(pal, ears, false, tail),
];

export const CHICK: Sprite[] = species(P.chick, "none");
export const FOX: Sprite[] = species(P.fox, "tri", true);
export const CAT: Sprite[] = species(P.cat, "sharp", true);
export const BEAR: Sprite[] = species(P.bear, "round");
export const PANDA: Sprite[] = species(P.panda, "round");
export const OWL: Sprite[] = species(P.owl, "tuft");
export const WOLF: Sprite[] = species(P.wolf, "tri", true);

/** 최종형 — 종 실루엣 + 왕관/반짝임(SVG 최종형이 왕관·오라를 덧붙이는 것과 같은 규칙). */
const finalFrame = (base: Sprite, sparkle: boolean): Sprite => ({
  ...base,
  pal: { ...base.pal, s: "#fff3b0", k: PIXEL_PAL.gold[1] },
  rows: base.rows.map((r, y) => {
    if (y === 0) return sparkle ? "..s..........s.." : "................";
    if (y === 1) return ".....kykyk......"; // 왕관
    return r;
  }),
});
export const finalOf = (base: Sprite[]): Sprite[] => [finalFrame(base[0], true), finalFrame(base[1], false)];

/** 잠자는 포즈 — 눈 감고 웅크림(종 무관 공통 실루엣). */
export const sleepOf = (pal: ReturnType<typeof mk>): Sprite => ({
  w: 16, h: 16,
  pal: { ...pal, "-": INK },
  rows: [
    "................", "................", "................", "................",
    ".....oooooooo...", "....obbbbbbbbo..", "...obb-----bbbo.", "...obbbbbbbbbbo.",
    "...obppbbbbppbo.", "...obcccccccbBo.", "...obcccccccbBo.", "....obbbbbbbBo..",
    ".....oooooooo...", "................", "................", "................",
  ],
});
export const SLEEP: Sprite = sleepOf(P.chick);

/* ── 풍경 타일/소품 — 섬 씬(SVG)과 같은 PAL 계열 ──────────────── */
export const GRASS: Sprite = {
  w: 8, h: 8,
  pal: { g: PIXEL_PAL.grass[1], G: PIXEL_PAL.grass[0], d: PIXEL_PAL.grass[2], l: PIXEL_PAL.leaf[0] },
  rows: ["gGgggGgg", "ggglgggG", "GggggGgg", "gglggggg", "ggGgggdg", "ggggglgg", "gdggGggg", "ggggggdg"],
};

export const WATER: Sprite[] = [
  {
    w: 8, h: 8,
    pal: { w: PIXEL_PAL.water[1], W: PIXEL_PAL.water[2], f: PIXEL_PAL.water[0] },
    rows: ["wwwwwwww", "wwffwwww", "wwwwwwww", "wwwwffww", "wwwwwwww", "ffwwwwww", "wwwwwwww", "wwwwwWww"],
  },
  {
    w: 8, h: 8,
    pal: { w: PIXEL_PAL.water[1], W: PIXEL_PAL.water[2], f: PIXEL_PAL.water[0] },
    rows: ["wwwwwwww", "wwwwffww", "wwwwwwww", "ffwwwwww", "wwwwwwww", "wwwwffww", "wwwwwwww", "wWwwwwww"],
  },
];

export const TREE: Sprite = {
  w: 16, h: 16,
  pal: { o: PIXEL_PAL.leaf[2], l: PIXEL_PAL.leaf[0], L: PIXEL_PAL.leaf[1], d: PIXEL_PAL.grass[2], t: PIXEL_PAL.brown[1], T: PIXEL_PAL.brown[2] },
  rows: [
    "................", ".....oooo.......", "....ollLLo......", "...ollllLLo.....",
    "..ollllllLLo....", "..olllllLLLo....", ".ollllllLLLLo...", ".olllllLLLdLo...",
    "..ollllLLLLo....", "...ollLLLLo.....", "....oottoo......", "......tT........",
    "......tT........", "......tT........", ".....ttTT.......", "................",
  ],
};

export const FLOWER: Sprite = {
  w: 4, h: 4,
  pal: { p: PIXEL_PAL.rose[0], P: PIXEL_PAL.rose[2], y: PIXEL_PAL.gold[1], g: PIXEL_PAL.leaf[1] },
  rows: [".p..", "pyP.", ".Pg.", "..g."],
};

export const HEART: Sprite = {
  w: 5, h: 5,
  pal: { r: PIXEL_PAL.rose[1], R: PIXEL_PAL.rose[2], h: PIXEL_PAL.rose[0] },
  rows: [".r.r.", "rhrrR", "rrrrR", ".RRR.", "..R.."],
};

export const STAR: Sprite = {
  w: 5, h: 5,
  pal: { y: PIXEL_PAL.gold[0], Y: PIXEL_PAL.gold[1], w: "#fffdf0" },
  rows: ["..y..", ".ywy.", "yYwYy", ".yYy.", "..y.."],
};

/* ── 폼 → 스프라이트 ──────────────────────────────────────────
 * SVG 의 28폼을 같은 종 계보로 매핑(색·귀가 SVG 와 일치하도록). */
const MID: Record<string, Sprite[]> = { fox: FOX, cat: CAT, bear: BEAR, panda: PANDA, owl: OWL, wolf: WOLF };
const FINAL_SPECIES: Record<string, Sprite[]> = {
  celestial_fox: FOX, starlight_fox: FOX,
  royal_cat: CAT, lucky_cat: CAT,
  guardian_bear: BEAR, honey_bear: BEAR,
  zen_panda: PANDA, dream_panda: PANDA,
  arcane_owl: OWL, sage_owl: OWL,
  lunar_wolf: WOLF, spirit_wolf: WOLF,
};

export function petSprites(form: string): Sprite[] {
  if (form === "egg") return EGG;
  if (form === "hatchling" || form === "sunny" || form === "cozy" || form === "moody") return CHICK;
  if (MID[form]) return MID[form];
  if (FINAL_SPECIES[form]) return finalOf(FINAL_SPECIES[form]);
  return EGG;
}

/** 폼별 수면 스프라이트 — 종 색을 유지한 채 웅크린다. */
export function sleepSprite(form: string): Sprite {
  const base = petSprites(form)[0];
  return { ...sleepOf(P.chick), pal: { ...base.pal, "-": INK } };
}

export const ALL_SPRITES: Record<string, Sprite | Sprite[]> = {
  EGG, CHICK, FOX, CAT, BEAR, PANDA, OWL, WOLF, SLEEP, GRASS, WATER, TREE, FLOWER, HEART, STAR,
  FINAL_FOX: finalOf(FOX),
};
