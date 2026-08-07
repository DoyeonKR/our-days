/* 보글보글 전용 16×16 도트.
 *
 * [사용자 리포트 2026-08-07 "더 캐릭터있게 만들어줘 너무 선명하지않아,,
 *  너 보글보글 모르니? 이미지 확인하고 좀더 퀄리티있게 만들어줘"]
 *
 * 처음엔 섬의 펫(48×48)과 사냥 몬스터(32×32)를 줄여 썼다. 그게 문제였다 —
 * 48을 16으로 줄이면 눈·입·귀가 한두 칸으로 뭉개져 **실루엣만 남고 표정이 사라진다.**
 * 작은 판은 작은 판에 맞게 처음부터 다시 그려야 한다. 그래서 이 파일이 있다.
 *
 * ── 원작을 보고 맞춘 것 (Taito, 1986) ─────────────────────────────
 *  · 주인공 Bub/Bob 은 **등에 돌기가 난 둥근 공룡**이다. 큰 머리, 큰 눈,
 *    크림색 배, 작은 발. 초기 기획이 "등에 능선이 있는 공룡"이었다고 남아 있다.
 *  · 적은 **거품에서 빠져나오거나 시간이 지나면 분홍색으로 변하고 빨라진다.**
 *    → angryPal() 이 그 규칙이다. 예전엔 머리 위에 빨간 점을 찍었는데, 그건 원작이 아니다.
 *  · 적 생김새도 원작을 따랐다:
 *      Zen-Chan  원통형 태엽 인형, 위는 회색(투구) 아래는 진한 파랑
 *      Monsta    둥근 보라색 고래, 지느러미 둘 + 꼬리, 빨간 눈에 큰 입
 *      Banebou   주황 몸통 아래 **용수철**, 빨간 권투 장갑
 *      Pulpul    살구색 몸에 **보라색 프로펠러**, 팔다리 끝이 노란 공
 *      Hidegons  보라회색 털, 분홍 팔, 노란 삼발가락
 *  · 배경은 **검정**이다. 이게 이 게임이 선명해 보이는 가장 큰 이유다 —
 *    밝은 캐릭터가 검정 위에 놓이면 대비가 최대가 된다. 하늘색 그라데이션 위에
 *    올리면 아무리 잘 그려도 흐리멍텅해진다(그게 첫 판의 실패였다).
 *
 * 팔레트 글자 규약: o 외곽선 · D 진한 몸 · B 몸 · H 하이라이트 · W 흰/크림 ·
 *   p 눈동자(검정) · y 발/부리 · m 입 · a 강조색
 */

import { type Palette, type Sprite, flipX, ramp, validateSprite } from "./pixel.ts";

/* 도트를 문자열로 적고 규격을 바로 검사한다. 16칸이 아닌 줄은 여기서 걸린다 —
   손으로 찍은 도트에서 가장 흔한 실수가 '한 칸 모자란 줄'이고, 눈으로는 절대 못 찾는다. */
function mk(name: string, pal: Palette, rows: string[]): Sprite {
  const s: Sprite = { w: 16, h: 16, pal, rows };
  const errs = validateSprite(s, name);
  if (errs.length) throw new Error(`${name}: ${errs.join(" / ")}`);
  return s;
}

// ── 주인공: 거품 용 ────────────────────────────────────────────────────────
/* 원작 Bub 의 뼈대 그대로 — 큰 머리 + 큰 눈 + 크림색 배 + 작은 발, 등에 돌기.
   몸 색만 우리 펫의 종에 따라 갈아 끼운다. 그래야 "우리 히어로"로 남는다. */

/* 첫 판은 "통통한 새"로 읽혔다 — 입이 없고 등 돌기도 안 보였기 때문이다.
   원작 Bub 을 캐릭터로 만드는 건 결국 셋이다: **큰 눈 · 벌린 입 · 등 돌기**.
   16칸 안에서 이 셋에 자리를 몰아주고 나머지는 과감히 뭉갰다. */
const HERO_ROWS: string[][] = [
  [
    "......oooo......",
    "....ooBBBBoo....",
    "..ooBHHBBBBBoo..",
    "aaoBHHBBBBBBBBo.",
    ".aoBHBBBoWWWWBo.",
    "aaoBBBBBoWppWBo.",
    ".aoBBBBBoWppWBo.",
    "aaoBBBBBoWWWWBo.",
    ".aoBBBBBBBBBBBo.",
    "..oBBBBBBommmoo.",
    "..oBBBBBBBBBBo..",
    ".oBWWWWWWWWWBo..",
    "oBWWWWWWWWWWWBo.",
    "oBWWWWWWWWWWWBo.",
    ".ooWWWWWWWWWoo..",
    "..oyyo...oyyo...",
  ],
  [
    "......oooo......",
    "....ooBBBBoo....",
    "..ooBHHBBBBBoo..",
    "aaoBHHBBBBBBBBo.",
    ".aoBHBBBoWWWWBo.",
    "aaoBBBBBoWppWBo.",
    ".aoBBBBBoWppWBo.",
    "aaoBBBBBoWWWWBo.",
    ".aoBBBBBBBBBBBo.",
    "..oBBBBBBommmoo.",
    "..oBBBBBBBBBBo..",
    ".oBWWWWWWWWWBo..",
    "oBWWWWWWWWWWWBo.",
    "oBWWWWWWWWWWWBo.",
    ".ooWWWWWWWWWoo..",
    "...oyyyyo.oyyo..",
  ],
  [
    "......oooo......",
    "....ooBBBBoo....",
    "..ooBHHBBBBBoo..",
    "aaoBHHBBBBBBBBo.",
    ".aoBHBBBoWWWWBo.",
    "aaoBBBBBoWppWBo.",
    ".aoBBBBBoWppWBo.",
    "aaoBBBBBoWWWWBo.",
    ".aoBBBBBBBBBBBo.",
    "..oBBBBBoommmmoo",
    "..oBBBBBoommmmo.",
    ".oBWWWWWWWWWBo..",
    "oBWWWWWWWWWWWBo.",
    "oBWWWWWWWWWWWBo.",
    ".ooWWWWWWWWWoo..",
    "....oyyyyyo.....",
  ],
];

/** 종별 몸 색 — 섬의 펫 계보를 그대로 따른다(우리 히어로라는 게 색으로 남아야 한다). */
const SPECIES_TRI: Record<string, readonly [string, string, string]> = {
  fox: ["#ffb46b", "#f28b3d", "#a8511b"],
  cat: ["#ffd9b0", "#f0b184", "#a06a48"],
  bear: ["#c99a6a", "#a5764a", "#6b4526"],
  panda: ["#ffffff", "#dfe3ea", "#8a90a0"],
  owl: ["#c3aef5", "#9b83e0", "#5f4aa0"],
  wolf: ["#b9c8de", "#8fa2bd", "#556479"],
  // 알·아기 시절은 원작 Bub 그대로 초록
  egg: ["#8ee87a", "#4fc23a", "#237a16"],
};

/** form → 종. 섬의 매핑(pixelart.ts)과 같은 규칙이다. */
function speciesOf(form: string): string {
  for (const k of ["fox", "cat", "bear", "panda", "owl", "wolf"])
    if (form.includes(k)) return k;
  return "egg";
}

function heroPal(form: string): Palette {
  const r = ramp(SPECIES_TRI[speciesOf(form)] ?? SPECIES_TRI.egg);
  return {
    o: r.o,
    D: r.D,
    B: r.B,
    H: r.H,
    W: "#fff3d6", // 크림색 배 — 원작 Bub 의 배가 이 색이다
    p: "#141018", // 눈동자
    m: "#e0577a", // 입
    y: "#ffd166", // 발
    a: r.b, // 등 돌기 — **밝은** 톤. 어두우면 검정 배경에 묻혀 그냥 사라진다
  };
}

const heroCache = new Map<string, Sprite[]>();

/** 오른쪽을 보는 3프레임. [0]=서기 [1]=걷기 [2]=점프·발사 */
export function heroSprites(form: string): Sprite[] {
  const key = speciesOf(form);
  const hit = heroCache.get(key);
  if (hit) return hit;
  const pal = heroPal(form);
  const made = HERO_ROWS.map((rows, i) => mk(`hero_${key}_${i}`, pal, rows));
  heroCache.set(key, made);
  return made;
}

// ── 몬스터 5종 ────────────────────────────────────────────────────────────

type MonDef = { pal: Palette; rows: string[] };

const MONS: Record<string, MonDef> = {
  /* Zen-Chan — 원통형 태엽 인형. 위는 회색 투구, 아래는 진한 파랑. */
  zen: {
    pal: { o: "#1b2340", D: "#2c4a8a", B: "#3f6fd0", H: "#7aa6f5", W: "#c9d4e6", p: "#141018", y: "#ffd166", a: "#8d9bb5" },
    rows: [
      "................",
      "................",
      "....oooooo......",
      "...oWWWWWWo.....",
      "..oWaaaaaaWo....",
      "..oWaaaaaaWo....",
      "..oooooooooo....",
      "..oBBBBBBBBo....",
      ".oBBWpBBWpBBo...",
      ".oBBWpBBWpBBo...",
      ".oBBBBBBBBBBo...",
      ".oBDBBBBBBDBo...",
      ".oBBBBBBBBBBo...",
      "..oBBBBBBBBo....",
      "..oooooooooo....",
      "..oyyo..oyyo....",
    ],
  },
  /* Monsta — 둥근 보라색 고래. 지느러미 둘, 꼬리, 빨간 눈, 큰 입. */
  monsta: {
    pal: { o: "#2a1140", D: "#5a2a8a", B: "#8b46c8", H: "#c58ef0", W: "#f4e6ff", p: "#ff4d5e", y: "#c58ef0", a: "#5a2a8a" },
    rows: [
      "................",
      "................",
      ".....oooooo.....",
      "...ooBHHHHBoo...",
      "..oBBHHHHHHBBo..",
      ".oBBHHBBBBHHBBo.",
      "yyoBBBBBBBBBBoyy",
      "yyoBWWpBBWWpBoyy",
      ".yoBWWpBBWWpBoy.",
      "..oBBBBBBBBBBo..",
      "..oBoooooooBBo..",
      "..oBWWWWWWWBBo..",
      "..oBoooooooBBo..",
      "...oBBBBBBBBo...",
      "....oBBBBBBo....",
      ".....oooooo.....",
    ],
  },
  /* Banebou — 주황 몸통 + 아래 용수철 + 빨간 권투 장갑. */
  banebou: {
    pal: { o: "#5a2410", D: "#b8531c", B: "#f2842f", H: "#ffbf6e", W: "#fff3d6", p: "#141018", y: "#e03b3b", a: "#9aa5b5" },
    rows: [
      "....oooooo......",
      "..ooBHHHHBoo....",
      ".oBBHHHHHHBBo...",
      ".oBHHBBBBHHBo...",
      "yyoBBBBBBBBBoyy.",
      "yyoBWWpBWWpBoyy.",
      "yyoBWWpBWWpBoyy.",
      ".ooBBBBBBBBBoo..",
      "..oBBooooBBBo...",
      "..oBBWWWWBBBo...",
      "...oBBBBBBBo....",
      "....oooooo......",
      "....oaaao.......",
      ".....oaaao......",
      "....oaaao.......",
      "...oaaaaao......",
    ],
  },
  /* Pulpul — 살구색 몸, 머리에 보라색 프로펠러, 팔다리 끝이 노란 공. */
  pulpul: {
    pal: { o: "#5a2a3a", D: "#c97a6a", B: "#f7b39a", H: "#ffd9c6", W: "#fff3d6", p: "#141018", y: "#ffd83d", a: "#8b46c8" },
    rows: [
      "................",
      "...aaaoaaao.....",
      "....oaaaaao.....",
      "......oao.......",
      "....oooooo......",
      "..ooBHHHHBoo....",
      ".oBBHHHHHHBBo...",
      "yyoBWpBBWpBBoyy.",
      "yyoBWpBBWpBBoyy.",
      ".oBBBBBBBBBBo...",
      ".oBBBooooBBBo...",
      ".oBBBWWWWBBBo...",
      "..oBBBBBBBBo....",
      "...oooooooo.....",
      "..yyo....oyy....",
      "..yyo....oyy....",
    ],
  },
  /* Hidegons — 보라회색 털, 분홍 팔, 노란 삼발가락. */
  hidegons: {
    pal: { o: "#241c33", D: "#4b4160", B: "#7a6f95", H: "#a99fc4", W: "#fff3d6", p: "#141018", y: "#ffd83d", a: "#f78fb0" },
    rows: [
      "................",
      "....oooooo......",
      "...oBHHHHBo.....",
      "..oBHHBBHHBo....",
      "..oBHBBBBHBo....",
      ".oBBBBBBBBBBo...",
      ".oBWpBBBBWpBo...",
      ".oBWpBBBBWpBo...",
      "aaoBBBBBBBBoaa..",
      "aaoBBoooooBoaa..",
      "aaoBBWWWWWBoaa..",
      ".aoBBBBBBBBoa...",
      "..oBDBBBBDBo....",
      "..oBBBBBBBBo....",
      "..oooooooooo....",
      ".yyyo....oyyy...",
    ],
  },
};

const monCache = new Map<string, Sprite>();

export function bubbleMonster(kind: string): Sprite {
  const hit = monCache.get(kind);
  if (hit) return hit;
  const def = MONS[kind] ?? MONS.zen;
  const made = mk(`mon_${kind}`, def.pal, def.rows);
  monCache.set(kind, made);
  return made;
}

/** 왼쪽을 보는 판(좌우 반전은 격자 손실이 없다). */
export function bubbleMonsterL(kind: string): Sprite {
  return flipX(bubbleMonster(kind));
}

/** 화난 몬스터 — 원작 그대로 **분홍으로 변한다**.
 *  머리 위에 표식을 얹는 것보다 이게 훨씬 잘 읽힌다: 색이 바뀌면 멀리서도 보인다. */
export function angryPal(pal: Palette): Palette {
  return {
    ...pal,
    o: "#5c0f2a",
    D: "#b02255",
    B: "#f0508a",
    H: "#ff9dc0",
    a: "#ff9dc0",
  };
}

// ── 열매(잡으면 떨어지는 것) ──────────────────────────────────────────────
/* 원작에서 적은 죽으면 과일로 바뀐다. 8×8 이면 충분하고, 종류가 여럿이어야
   "또 같은 걸 먹는다"는 느낌이 안 든다. 값이 큰 것일수록 화려한 걸 쓴다. */
const FRUIT_PAL: Palette = {
  r: "#ff4d5e", o: "#7a1020", g: "#4fc23a", y: "#ffd83d",
  p: "#c56cf0", w: "#fff3d6", b: "#4aa8ff",
};
const FRUITS: string[][] = [
  // 체리
  ["...gg...", "..g..g..", ".g...g..", "orro.rro", "rrrrorrr", "orroorro", "..oo.oo.", "........"],
  // 바나나
  ["....yy..", "...yyo..", "..yyo...", ".yyo....", "yyo.....", "yyo.....", ".yyoo...", "..yyyo.."],
  // 포도
  ["...gg...", "..oppo..", ".pppppo.", "opppppo.", ".oppppo.", "..oppo..", "...oo...", "........"],
  // 수박 조각
  ["........", "..oooo..", ".oggggo.", "orrrrrro", "orrororo", ".orrrro.", "..oooo..", "........"],
  // 별사탕(가장 비쌈)
  ["...y....", "..yyy...", "yyywyyy.", ".ywwwy..", "..ywy...", ".yy.yy..", "y.....y.", "........"],
];

const fruitCache = new Map<number, Sprite>();

/** 열매 — 값에 따라 종류가 달라진다(연쇄로 크게 터뜨리면 화려한 게 나온다). */
export function fruitSprite(value: number): Sprite {
  const i = value >= 40 ? 4 : value >= 26 ? 3 : value >= 18 ? 2 : value >= 12 ? 1 : 0;
  const hit = fruitCache.get(i);
  if (hit) return hit;
  const made: Sprite = { w: 8, h: 8, pal: FRUIT_PAL, rows: FRUITS[i] };
  const errs = validateSprite(made, `fruit_${i}`);
  if (errs.length) throw new Error(`fruit_${i}: ${errs.join(" / ")}`);
  fruitCache.set(i, made);
  return made;
}

/** 검사·미리보기용 — 모든 스프라이트를 한 번에 만든다(테스트가 이걸로 규격을 훑는다). */
export const ALL_BUBBLE_SPRITES = (): Record<string, Sprite> => {
  const out: Record<string, Sprite> = {};
  for (const sp of ["fox", "cat", "bear", "panda", "owl", "wolf", "egg"])
    heroSprites(sp).forEach((s, i) => (out[`hero_${sp}_${i}`] = s));
  for (const k of Object.keys(MONS)) out[`mon_${k}`] = bubbleMonster(k);
  for (const v of [6, 14, 20, 30, 50]) out[`fruit_${v}`] = fruitSprite(v);
  return out;
};

export const BUBBLE_MON_KINDS = Object.keys(MONS);

// ── 원작 장치들의 그림 ────────────────────────────────────────────────────
/* 특수 거품·아이템·EXTEND 글자·해골. 전부 작아서 **한눈에 뭔지 알아야** 쓸모가 있다 —
   8×8 안에서는 실루엣과 색 둘로만 구분된다. 그래서 색을 서로 멀리 벌려 놨다. */

const ITEM_PAL: Palette = {
  o: "#2a1a3a", w: "#fff3d6", y: "#ffd83d", r: "#ff4d5e",
  c: "#7fe3ff", b: "#3f6fd0", p: "#c56cf0", g: "#4fc23a",
};

/** 아이템 8×8 — gem 점수 · candy 연사 · shoes 이동속도 · lantern 화면정리 */
const ITEMS: Record<string, string[]> = {
  gem: ["..oo....", ".occo...", "occcco..", "occcco..", ".occco..", "..occo..", "...oo...", "........"],
  candy: ["..oooo..", ".oyyyyo.", "oyywyyyo", "oyyyyyyo", "oyywyyyo", ".oyyyyo.", "..oooo..", "........"],
  shoes: ["........", "..oo....", ".occo...", ".occo...", "occccooo", "occccccо".replace("о", "o"), "oooooooo", "........"],
  lantern: ["...oo...", "..oppo..", ".opppppo", "opppwppo", "opppppo.", ".oppppo.", "..oooo..", "...oo..."],
};

const itemCache = new Map<string, Sprite>();
export function itemSprite(kind: string): Sprite {
  const hit = itemCache.get(kind);
  if (hit) return hit;
  const rows = ITEMS[kind] ?? ITEMS.gem;
  const made: Sprite = { w: 8, h: 8, pal: ITEM_PAL, rows };
  const errs = validateSprite(made, `item_${kind}`);
  if (errs.length) throw new Error(`item_${kind}: ${errs.join(" / ")}`);
  itemCache.set(kind, made);
  return made;
}

/* EXTEND 글자 5×7. 폰트를 쓰면 캔버스 텍스트라 도트 격자가 깨진다 — 직접 찍는다. */
const GLYPHS: Record<string, string[]> = {
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
};
const LETTER_PAL: Palette = { "#": "#ffd83d" };
const letterCache = new Map<number, Sprite>();

/** idx 0~5 → E X T E N D */
export function letterSprite(idx: number): Sprite {
  const hit = letterCache.get(idx);
  if (hit) return hit;
  const ch = ["E", "X", "T", "E", "N", "D"][((idx % 6) + 6) % 6];
  const made: Sprite = { w: 5, h: 7, pal: LETTER_PAL, rows: GLYPHS[ch] };
  letterCache.set(idx, made);
  return made;
}

/* 해골 — HURRY UP! 뒤에 나타나 벽을 뚫고 쫓아온다. 가둘 수 없다.
   흰 뼈 + 검은 눈구멍이라 어떤 배경에서도 '위험'으로 읽힌다. */
const SKEL_ROWS = [
  "................",
  "................",
  ".....oooooo.....",
  "...ooWWWWWWoo...",
  "..oWWWWWWWWWWo..",
  ".oWWWWWWWWWWWWo.",
  ".oWWppWWWWppWWo.",
  ".oWWppWWWWppWWo.",
  ".oWWWWWWWWWWWWo.",
  "..oWWWWppWWWWo..",
  "..oWWpWWWWpWWo..",
  "...oWWWWWWWWo...",
  "....oooooooo....",
  "...o.o.o.o.o....",
  "..o...o...o.....",
  "................",
];
let skelCache: Sprite | null = null;
export function skelSprite(): Sprite {
  if (skelCache) return skelCache;
  skelCache = mk("skel", { o: "#2a2438", W: "#f2f0ff", p: "#141018" }, SKEL_ROWS);
  return skelCache;
}

/** 특수 거품 안에 그려 넣을 아이콘(번개·불·물). 거품 자체는 캔버스에서 원으로 그린다. */
const SPECIAL_ICONS: Record<string, { pal: Palette; rows: string[] }> = {
  lightning: {
    pal: { y: "#ffe14d", o: "#8a5a00", w: "#fffbe0" },
    rows: ["..oyy...", ".oyyy...", "oyyyo...", "oywyoo..", ".oyyyyy.", "..oyyyo.", "...oyo..", "....o..."],
  },
  fire: {
    pal: { r: "#ff5a2a", y: "#ffd83d", o: "#8a2000", w: "#fff3d6" },
    rows: ["...oo...", "..orro..", ".orrrro.", "orryyrro", "orryyrro", "orywyro.", ".orryro.", "..oooo.."],
  },
  water: {
    pal: { b: "#3fa8ff", c: "#a8e6ff", o: "#10406e", w: "#ffffff" },
    rows: ["...oo...", "...obo..", "..obbbo.", ".obbbbbo", "obbcbbbo", "obcwcbbo", ".obbbbo.", "..oooo.."],
  },
};
const specialCache = new Map<string, Sprite>();
export function specialIcon(kind: string): Sprite {
  const hit = specialCache.get(kind);
  if (hit) return hit;
  const def = SPECIAL_ICONS[kind] ?? SPECIAL_ICONS.lightning;
  const made: Sprite = { w: 8, h: 8, pal: def.pal, rows: def.rows };
  const errs = validateSprite(made, `special_${kind}`);
  if (errs.length) throw new Error(`special_${kind}: ${errs.join(" / ")}`);
  specialCache.set(kind, made);
  return made;
}

/* ── 무기별 거품 ───────────────────────────────────────────────────────────
 * [사용자 요구 2026-08-07 "히어로는 무기에 따라 버블 모양이 색다르게 변할 것"]
 *
 * 무기는 이미 사거리·재장전을 바꾸지만 그건 숫자라 손에만 남는다. **눈에도 남아야**
 * 산 보람이 있다. 그래서 무기마다 거품의 모양·색·터질 때 파편이 달라진다.
 * ⚠ 수박 거품에 줄무늬를 그리지 마라 — 무등산수박(푸랭이)은 무늬가 없다(README §14.5).
 */
export type BubbleSkin = {
  key: "plain" | "star" | "melon";
  /** 테두리 */
  rim: string;
  /** 가둔 상태의 테두리 */
  rimHeld: string;
  /** 안쪽 채움 */
  fill: string;
  /** 터질 때 파편 색 */
  spark: string;
  /** 꼭짓점 수. 0 이면 원, 5 면 별. */
  points: number;
};

const SKINS: Record<string, BubbleSkin> = {
  plain: { key: "plain", rim: "#cbf3ff", rimHeld: "#7fe6ff", fill: "rgba(190,240,255,0.13)", spark: "#e8fbff", points: 0 },
  star: { key: "star", rim: "#ffe98a", rimHeld: "#ffd83d", fill: "rgba(255,225,120,0.16)", spark: "#fff3b0", points: 5 },
  melon: { key: "melon", rim: "#7fe07a", rimHeld: "#3fbf46", fill: "rgba(70,200,90,0.20)", spark: "#ff8fa0", points: 0 },
};

/** 장착 무기 → 거품 모양. 맨손·나무막대는 기본 물방울. */
export function bubbleSkin(weapon: string | null | undefined): BubbleSkin {
  if (weapon === "melonsword") return SKINS.melon;
  if (weapon === "wand") return SKINS.star;
  return SKINS.plain;
}

export const BUBBLE_SKIN_KEYS = Object.keys(SKINS);
