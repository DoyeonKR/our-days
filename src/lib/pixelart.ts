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
import { type PetKind, type SpeciesPal, eggSprite48, petSprite48, sleepSprite48, crowned, finalRegalia, mythicAura } from "./pixelpet48.ts";
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
  /* 신화형(stage 5) [사용자 요청 2026-08-11]. 뱅갈·무등산은 호랑이와 **같은 몸, 다른 팔레트** —
     최종형이 같은 종 실루엣에 색·소품으로 갈리는 문법 그대로다. */
  tiger: { body: PIXEL_PAL.fur, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.peach, mark: PIXEL_PAL.charcoal },
  // 뱅갈(백호 컨셉) — 흰 몸 + 먹 줄무늬 + 얼음눈
  bengal: { body: PIXEL_PAL.white, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.rose, eye: "#9bdcf7", mark: PIXEL_PAL.charcoal },
  /* 무등산호랑이 — 은빛 몸 + **진초록 줄무늬**(무등산수박 껍질색). 이 앱의 무등산 세계관
     (수박·수박검)과 같은 축이라 줄무늬 색 하나로 정체가 읽힌다. 눈은 금색. */
  // 줄무늬는 leaf 톤 — 1차판의 어두운 초록은 은빛 몸 위에서 이끼 점으로 읽혔다.
  // 밝은 수박껍질색이어야 '무등산' 이 한 눈에 선다.
  mudeung: { body: PIXEL_PAL.gray, belly: PIXEL_PAL.white, inner: PIXEL_PAL.mint, eye: "#ffc93f", mark: PIXEL_PAL.leaf },
  lion: { body: PIXEL_PAL.gold, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.peach, mark: PIXEL_PAL.brown },
  giraffe: { body: PIXEL_PAL.gold, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.peach, mark: PIXEL_PAL.brown },
} satisfies Record<string, SpeciesPal>;

/* 종·신화 프레임은 **lazy** — 예전엔 모듈 로드가 ~80장(종 8×6프레임 + 신화 5×6)을 즉시
 * 구웠고, pixelart 는 홈(HomePet)이 끌어와서 그 비용이 **앱 부팅**에 얹혔다.
 * 스프라이트는 순수 생성이라 처음 쓰일 때 구워 기억해도 결과가 같다(petSprites 의
 * FRAME_CACHE 와 이중 캐시지만, 여기 캐시는 finalOf/ALL 재사용 공유용). */
const lazy = <T,>(make: () => T): (() => T) => {
  let v: T | null = null;
  return () => (v ??= make());
};
const EGG = lazy<Sprite[]>(() => [eggSprite48(SP.egg, false), eggSprite48(SP.egg, true)]);
const CHICK = lazy(() => petSprite48(SP.chick, "chick"));
const HATCHLING = lazy(() => petSprite48({ ...SP.chick, body: PIXEL_PAL.cream }, "chick"));
const SUNNY = lazy(() => petSprite48({ ...SP.chick, body: PIXEL_PAL.gold, eye: "#e0a02e" }, "chick"));
const COZY = lazy(() => petSprite48({ ...SP.chick, body: PIXEL_PAL.rose, belly: PIXEL_PAL.cream }, "chick"));
const MOODY = lazy(() => petSprite48({ ...SP.chick, body: PIXEL_PAL.charcoal, belly: PIXEL_PAL.gray, inner: PIXEL_PAL.violet, eye: "#9bdcf7" }, "chick"));
const FOX = lazy(() => petSprite48(SP.fox, "fox"));
const CAT = lazy(() => petSprite48(SP.cat, "cat"));
const BEAR = lazy(() => petSprite48(SP.bear, "bear"));
const PANDA = lazy(() => petSprite48(SP.panda, "panda"));
const OWL = lazy(() => petSprite48(SP.owl, "owl"));
const WOLF = lazy(() => petSprite48(SP.wolf, "wolf"));
const SLEEP = lazy(() => sleepSprite48(SP.chick));
// 신화형 — 오라 반짝임을 얹는다(왕관은 최종형의 것)
const TIGER = lazy(() => mythicAura(petSprite48(SP.tiger, "tiger"), "tiger"));
const BENGAL = lazy(() => mythicAura(petSprite48(SP.bengal, "tiger"), "bengal"));
const MUDEUNG = lazy(() => mythicAura(petSprite48(SP.mudeung, "tiger"), "mudeung"));
const LION = lazy(() => mythicAura(petSprite48(SP.lion, "lion"), "lion"));
const GIRAFFE = lazy(() => mythicAura(petSprite48(SP.giraffe, "giraffe"), "giraffe"));

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
const MID: Record<string, () => Sprite[]> = { fox: FOX, cat: CAT, bear: BEAR, panda: PANDA, owl: OWL, wolf: WOLF };
const FINAL_SPECIES: Record<string, () => Sprite[]> = {
  celestial_fox: FOX, starlight_fox: FOX,
  royal_cat: CAT, lucky_cat: CAT,
  guardian_bear: BEAR, honey_bear: BEAR,
  zen_panda: PANDA, dream_panda: PANDA,
  arcane_owl: OWL, sage_owl: OWL,
  lunar_wolf: WOLF, spirit_wolf: WOLF,
};

/** 최종형 — 종 실루엣에 왕관을 얹는다(SVG 최종형이 왕관·오라를 더하는 규칙과 동일). */
export const finalOf = (base: Sprite[]): Sprite[] => crowned(base);

/** 폼별 프레임 캐시 — 최종형은 호출할 때마다 crowned() 가 프레임 수만큼 paint 를 다시 돌린다.
 *  2프레임일 땐 넘어갈 만했지만 6프레임이면 3배다. 도감처럼 아이콘이 수십 개 깔리는 화면에서
 *  마운트가 그만큼 무거워진다. 스프라이트는 불변(순수 생성)이라 캐시가 안전하다. */
const FRAME_CACHE = new Map<string, Sprite[]>();

export function petSprites(form: string): Sprite[] {
  const hit = FRAME_CACHE.get(form);
  if (hit) return hit;
  const made = buildPetSprites(form);
  FRAME_CACHE.set(form, made);
  return made;
}

/* ── 최종형 폼별 팔레트 [사용자 리포트 2026-08-12 "행운냥이랑 그냥 고양이랑 생긴게
 * 똑같잖아"] ──────────────────────────────────────────────────
 * 예전엔 FINAL_SPECIES 가 계보 스프라이트를 **그대로** 왕관만 씌웠다 — 왕고양이와
 * 행운고양이가 픽셀이 완전히 동일했고, 그냥 고양이와는 왕관 하나 차이였다.
 * 최종형은 이름값을 해야 한다: 같은 계보(귀·꼬리·실루엣)라도 **털색·마킹·눈**이 갈린다.
 * SVG 일러스트가 이미 그렇게 갈라져 있으니(마네키네코 삼색이 등) 그 색을 따른다. */
const FINAL_PAL: Record<string, SpeciesPal> = {
  celestial_fox: { body: PIXEL_PAL.white, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.gold, eye: "#e0a02e" }, // 천상 = 흰 여우 + 금눈
  starlight_fox: { body: PIXEL_PAL.violet, belly: PIXEL_PAL.white, inner: PIXEL_PAL.rose, eye: "#9bdcf7" }, // 별빛 = 보라 여우
  royal_cat: { body: PIXEL_PAL.white, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.rose, mark: PIXEL_PAL.gold, eye: "#2a2749" }, // 귀족 흰 고양이 + 금 줄무늬
  lucky_cat: { body: PIXEL_PAL.cream, belly: PIXEL_PAL.white, inner: PIXEL_PAL.rose, mark: PIXEL_PAL.fur, eye: "#3d9433" }, // 마네키네코 삼색이(주황 얼룩)
  guardian_bear: { body: PIXEL_PAL.gray, belly: PIXEL_PAL.white, inner: PIXEL_PAL.peach, eye: "#2a2749" }, // 강철빛 수호곰
  honey_bear: { body: PIXEL_PAL.gold, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.peach }, // 꿀에 절은 금곰
  zen_panda: { body: PIXEL_PAL.white, belly: PIXEL_PAL.white, inner: PIXEL_PAL.mint, mark: PIXEL_PAL.night, eye: "#e0a02e" }, // 먹빛 마킹 + 금눈
  dream_panda: { body: PIXEL_PAL.white, belly: PIXEL_PAL.white, inner: PIXEL_PAL.rose, mark: PIXEL_PAL.violet, eye: "#8259cf" }, // 보랏빛 꿈 마킹
  arcane_owl: { body: PIXEL_PAL.violet, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.gold, beak: PIXEL_PAL.gold, eye: "#ffc93f" }, // 마도 보라 부엉이
  sage_owl: { body: PIXEL_PAL.sand, belly: PIXEL_PAL.cream, inner: PIXEL_PAL.gold, beak: PIXEL_PAL.gold }, // 두루마리빛 현자
  lunar_wolf: { body: PIXEL_PAL.night, belly: PIXEL_PAL.gray, inner: PIXEL_PAL.gray, mark: PIXEL_PAL.charcoal, eye: "#ffc93f" }, // 밤하늘 늑대 + 달눈
  spirit_wolf: { body: PIXEL_PAL.mint, belly: PIXEL_PAL.white, inner: PIXEL_PAL.white, mark: PIXEL_PAL.gray, eye: "#9bdcf7" }, // 혼령 민트 늑대
} satisfies Record<string, SpeciesPal>;

/** 신화형(stage 5) — 폼 → {프레임, 팔레트 키, kind}. 뱅갈·무등산은 호랑이 kind 를 공유하므로
 *  수면 팔레트를 폼별로 따로 물어야 한다(kind 로만 찾으면 뱅갈이 주황 호랑이로 잔다). */
const MYTHICS: Record<string, { frames: () => Sprite[]; sp: keyof typeof SP; kind: PetKind }> = {
  tiger: { frames: TIGER, sp: "tiger", kind: "tiger" },
  bengal_tiger: { frames: BENGAL, sp: "bengal", kind: "tiger" },
  mudeung_tiger: { frames: MUDEUNG, sp: "mudeung", kind: "tiger" },
  lion: { frames: LION, sp: "lion", kind: "lion" },
  giraffe: { frames: GIRAFFE, sp: "giraffe", kind: "giraffe" },
};

function buildPetSprites(form: string): Sprite[] {
  if (form === "egg") return EGG();
  if (form === "hatchling") return HATCHLING();
  if (form === "sunny") return SUNNY();
  if (form === "cozy") return COZY();
  if (form === "moody") return MOODY();
  if (MID[form]) return MID[form]();
  // 최종형 = 계보 골격(귀·꼬리) + **폼별 팔레트** + 왕관. 계보 스프라이트 재탕이 아니다.
  if (FINAL_PAL[form]) return finalRegalia(petSprite48(FINAL_PAL[form], KIND_OF[form]), form);
  if (FINAL_SPECIES[form]) return finalOf(FINAL_SPECIES[form]()); // 안전망(목록 밖 최종형)
  if (MYTHICS[form]) return MYTHICS[form].frames();
  return EGG();
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
  const m = MYTHICS[form];
  if (m) return sleepSprite48(SP[m.sp], m.kind);
  const kind = KIND_OF[form];
  // 최종형은 잘 때도 자기 색이다 — 흰 왕고양이가 회색으로 자면 다른 고양이다
  if (kind && FINAL_PAL[form]) return sleepSprite48(FINAL_PAL[form], kind);
  if (kind) return sleepSprite48(SP[kind], kind);
  return sleepSprite48(SP.chick, "chick"); // 병아리 계열(hatchling/sunny/cozy/moody)
}

/** 전 스프라이트 열람(테스트 검증용) — lazy 라 **함수**다. 앱 코드에서 부르면 전량을 굽는다. */
export function allSprites(): Record<string, Sprite | Sprite[]> {
  return {
    EGG: EGG(), CHICK: CHICK(), FOX: FOX(), CAT: CAT(), BEAR: BEAR(), PANDA: PANDA(),
    OWL: OWL(), WOLF: WOLF(), SLEEP: SLEEP(), GRASS, WATER, TREE, FLOWER, HEART, STAR,
    FINAL_FOX: finalOf(FOX()),
    // 신화형 — 등록해야 포맷·프레임 크기 검사가 자동으로 돈다
    TIGER: TIGER(), BENGAL: BENGAL(), MUDEUNG: MUDEUNG(), LION: LION(), GIRAFFE: GIRAFFE(),
  };
}
