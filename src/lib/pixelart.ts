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
// 저작 규약: 펫 32x32(고해상도), 소품 8~24px. 광원 좌상단, 5톤 램프 + 셀렉티브 아웃라인.
// 애니는 프레임 배열(실루엣이 1~2px 이상 튀지 않게).

import { type Sprite, ramp } from "./pixel.ts";
import { type PetKind, type SpeciesPal, eggSprite48, petSprite48, sleepSprite48, crowned } from "./pixelpet48.ts";
export { petPalette } from "./pixelpet48.ts";

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

/* ── 32×32 고해상도 펫 (pixelpet32) ──────────────────────────
 * 해상도만 올린 1차 시도는 실패했다 — 8종이 같은 덩어리라 종이 구분되지 않았다.
 * 지금은 공용 골격 위에 **종별 귀·마킹·꼬리**를 얹어 실루엣과 얼굴로 구분한다.
 * 색은 여전히 PAL 그대로(일러스트와 같은 세계). */
const SP = {
  egg: { body: PIXEL_PAL.cream, belly: PIXEL_PAL.white, inner: PIXEL_PAL.peach },
  chick: { body: PIXEL_PAL.gold, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.peach, beak: PIXEL_PAL.gold },
  fox: { body: PIXEL_PAL.fur, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.peach },
  cat: { body: PIXEL_PAL.gray, belly: PIXEL_PAL.white, inner: PIXEL_PAL.rose, mark: PIXEL_PAL.charcoal },
  bear: { body: PIXEL_PAL.brown, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.peach },
  panda: { body: PIXEL_PAL.white, belly: PIXEL_PAL.white, inner: PIXEL_PAL.rose, mark: PIXEL_PAL.charcoal },
  owl: { body: PIXEL_PAL.brown, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.gold, beak: PIXEL_PAL.gold },
  wolf: {
    body: PIXEL_PAL.charcoal, belly: PIXEL_PAL.gray, inner: PIXEL_PAL.gray,
    eye: "#9bdcf7", mark: PIXEL_PAL.night,
  },
} satisfies Record<string, SpeciesPal>;

export const EGG: Sprite[] = [eggSprite48(SP.egg, false), eggSprite48(SP.egg, true)];
export const CHICK: Sprite[] = petSprite48(SP.chick, "chick");
export const FOX: Sprite[] = petSprite48(SP.fox, "fox");
export const CAT: Sprite[] = petSprite48(SP.cat, "cat");
export const BEAR: Sprite[] = petSprite48(SP.bear, "bear");
export const PANDA: Sprite[] = petSprite48(SP.panda, "panda");
export const OWL: Sprite[] = petSprite48(SP.owl, "owl");
export const WOLF: Sprite[] = petSprite48(SP.wolf, "wolf");
export const SLEEP: Sprite = sleepSprite48(SP.chick);

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

/** 나무 — 24×24. 예전 버전은 잎이 **한 덩어리 초록 풍선**이라 밋밋했다.
 *  잎을 3개 뭉치로 나눠 뭉치마다 하이라이트/그늘을 줘야 부피가 생긴다(픽셀 아트 기본기). */
export const TREE: Sprite = (() => {
  const L = ramp(PIXEL_PAL.leaf);
  const T = ramp(PIXEL_PAL.brown);
  return {
    w: 24, h: 24,
    pal: { o: L.o, H: L.H, l: L.b, L: L.B, d: L.d, D: L.D, t: T.b, T: T.B, u: T.d, U: T.o },
    rows: [
      ".........oooo...........",
      ".......ooHHllooo........",
      "......oHHlllllLdo.......",
      ".....oHllllllLLLdo......",
      "...oooHlllllLLLLddoo....",
      "..ooHHlloolllLLdddDDo...",
      ".oHHlllloHlLLLddoDDDdo..",
      ".oHllllllHllLLdoolLLddo.",
      ".ollllllLLllLLLLllLLdDo.",
      ".oLllllLLLLLLLLLLLLdddo.",
      ".oLLllLLLLdLLLLdLLLddDo.",
      "..oLLLLLdddoLdddoLdddo..",
      "...ooLLdddo.ooddoodddo..",
      ".....oodo.tTu.oooddoo...",
      "..........tTu...........",
      "..........tTu...........",
      ".........ttTTu..........",
      ".........tTTUu..........",
      ".........tTTUu..........",
      "........ttTTTUu.........",
      ".......uttTTTUUu........",
      "......uuttTTTTUUUu......",
      ".....UUuuuuuuuUUUUUu....",
      "........................",
    ],
  };
})();

/** 꽃 — 9×9. 꽃잎 5장이 실제로 세어지게(예전 8×8 은 뭉개져 무슨 소품인지 안 읽혔다). */
export const FLOWER: Sprite = (() => {
  const R = ramp(PIXEL_PAL.rose);
  const G = ramp(PIXEL_PAL.leaf);
  return {
    w: 9, h: 9,
    pal: { o: R.o, H: R.H, p: R.b, P: R.B, D: R.d, y: PIXEL_PAL.gold[0], Y: PIXEL_PAL.gold[2], g: G.b, G: G.B, u: G.o },
    rows: [
      "..o...o..",
      ".oHpopPo.",
      "oHppyPPDo",
      ".oppyPPo.",
      "oHppPPPDo",
      ".oPPPPDo.",
      "..oPDo...",
      "...ug.G..",
      "...uGg...",
    ],
  };
})();

/** 하트 — 8×8, 좌상단 하이라이트. */
export const HEART: Sprite = (() => {
  const R = ramp(PIXEL_PAL.rose);
  return {
    w: 8, h: 8,
    pal: { o: R.o, H: R.H, r: R.b, R: R.B, D: R.d },
    rows: [".oo..oo.", "oHHroRRo", "oHrrrRDo", "orrrrRDo", ".oRrRDo.", "..oRDo..", "...oo...", "........"],
  };
})();

/** 별 — 9×9. 예전 8×8 은 팔이 끊겨 별로 안 보였다. 5각 실루엣을 이어 그린다. */
export const STAR: Sprite = (() => {
  const G = ramp(PIXEL_PAL.gold);
  return {
    w: 9, h: 9,
    pal: { o: G.o, H: G.H, y: G.b, Y: G.B, D: G.d },
    rows: [
      "....o....",
      "....y....",
      "...oHo...",
      "ooyHHYoo.",
      ".oyHHYDo.",
      "..oyYDo..",
      ".oyYoYDo.",
      "oyoo.ooDo",
      "oo.....oo",
    ],
  };
})();

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

/** 최종형 — 종 실루엣에 왕관을 얹는다(SVG 최종형이 왕관·오라를 더하는 규칙과 동일). */
export const finalOf = (base: Sprite[]): Sprite[] => crowned(base);

export function petSprites(form: string): Sprite[] {
  if (form === "egg") return EGG;
  if (form === "hatchling" || form === "sunny" || form === "cozy" || form === "moody") return CHICK;
  if (MID[form]) return MID[form];
  if (FINAL_SPECIES[form]) return finalOf(FINAL_SPECIES[form]);
  return EGG;
}

/** 폼 → 종(kind). 최종형은 자기 계보의 중간형과 같은 종이다. */
const KIND_OF: Record<string, PetKind> = {
  fox: "fox", cat: "cat", bear: "bear", panda: "panda", owl: "owl", wolf: "wolf",
  celestial_fox: "fox", starlight_fox: "fox",
  royal_cat: "cat", lucky_cat: "cat",
  guardian_bear: "bear", honey_bear: "bear",
  zen_panda: "panda", dream_panda: "panda",
  arcane_owl: "owl", sage_owl: "owl",
  lunar_wolf: "wolf", spirit_wolf: "wolf",
};

/** 폼별 수면 스프라이트 — 종 색 **과 귀**를 유지한 채 웅크린다.
 *  ⚠ 알은 자도 알이다. 예전엔 모든 비-중간형이 병아리 포즈로 떨어져 **알이 잠들면 병아리가
 *  됐다**(2026-08-03 적대 검증에서 확정). 알은 알 스프라이트를 그대로 쓴다. */
export function sleepSprite(form: string): Sprite {
  if (form === "egg") return eggSprite48(SP.egg, true);
  const kind = KIND_OF[form];
  if (kind) return sleepSprite48(SP[kind], kind);
  return sleepSprite48(SP.chick, "chick"); // 병아리 계열(hatchling/sunny/cozy/moody)
}

export const ALL_SPRITES: Record<string, Sprite | Sprite[]> = {
  EGG, CHICK, FOX, CAT, BEAR, PANDA, OWL, WOLF, SLEEP, GRASS, WATER, TREE, FLOWER, HEART, STAR,
  FINAL_FOX: finalOf(FOX),
};
