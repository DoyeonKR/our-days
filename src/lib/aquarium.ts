/* 우리 수조 (2026-11-01) — [사용자: "수조 키우는 게임 … 등급을 엄청 다양화 … 치어를 하트를 주고 사서 키울 수 있는 … 오랜시간 잘 기르면 최종형태로 …
 * 최소 30가지 … 악세사리들을 배치 … 다 하트로 구매 … 이미지와 그래픽은 다른 세션에서"]
 * 순수 엔진(화면은 components/AquariumGame). 저장은 섬 상태의 옵셔널 칸 s.aquarium, 지갑은 섬 하트 s.coins — DB 변경 없음.
 *
 * 규칙의 뼈대:
 *  · 새끼(계열 16종)를 사서 새끼 → 어린 개체 → 최종 형태로 키운다. 기존 12계열은 넷씩, 해양 4계열은 같은 종으로 자라며 모두 52종 · 8등급.
 *  · 성장은 실제 시간이다(1일 ~ 21일). 배가 고프거나 물이 더러우면 성장이 멈춘다 — 죽지는 않는다.
 *  · 정성(cq) = 잘 돌본 시간의 비율. 정성이 높을수록 높은 형태까지 열린다.
 *    ⚠ 정성으로 종을 가르기만 하면 '대충 키워야 나오는 종'이 생긴다(README §14.5 펫 진화의 교훈). 그래서 **못 만난 형태가 먼저** 나온다 —
 *      잘 키우는 사람은 같은 계열을 네 번 키우면 넷을 다 만난다.
 *  · 계산은 지연 정산(syncAqua) — 꺼 둔 시간까지 한 번에 센다. 오래 비우면 48시간까지만 '못 돌본 시간'으로 친다(여행 다녀왔다고 벌받지 않게).
 *  · 결과가 양쪽 기기에서 같아야 하므로 뽑기는 물고기 id 로만 정한다(Math.random 금지).
 * ⚠ 섬 엔진은 타입만 부른다 — 값으로 부르면 이 파일을 쓰는 화면이 섬 엔진까지 싣는다. */
import type { IslandState } from "./island.ts";

export const GRADES = ["흔함", "보통", "고급", "희귀", "영웅", "전설", "신화", "태초"] as const;
export type Grade = (typeof GRADES)[number];

export type AquaSpecies = { key: string; name: string; grade: Grade };
export type AquaFamily = {
  key: string;
  name: string;
  /** 계열의 값어치 순서(치어 가게 시절의 값 — 2026-11-02 부터 사지 않는다) */
  price: number;
  /** 최종 형태까지 걸리는 성장 시간 — 잘 먹고 물이 깨끗한 시간만 센다 */
  hours: number;
  /** 이 계열을 살 수 있는 수조 단계 */
  minTank: number;
  /** 다 컸을 때 크기(수조 폭의 %) */
  size: number;
  /** 실존 해양 생물은 한 종으로 성장한다. 기존 관상어는 네 품종을 유지한다. */
  finals: readonly [AquaSpecies, ...AquaSpecies[]];
  youngName?: string;
};

const s = (key: string, name: string, grade: Grade): AquaSpecies => ({ key, name, grade });

export const FAMILIES: readonly AquaFamily[] = [
  { key: "guppy", name: "구피", price: 300, hours: 24, minTank: 1, size: 15, finals: [s("cobra_guppy", "코브라 구피", "흔함"), s("tuxedo_guppy", "턱시도 구피", "보통"), s("mosaic_guppy", "모자이크 구피", "고급"), s("fullred_guppy", "풀레드 구피", "희귀")] },
  { key: "tetra", name: "테트라", price: 500, hours: 30, minTank: 1, size: 14, finals: [s("neon_tetra", "네온 테트라", "흔함"), s("cardinal_tetra", "카디널 테트라", "보통"), s("glowlight_tetra", "글로라이트 테트라", "고급"), s("diamond_tetra", "다이아몬드 테트라", "희귀")] },
  { key: "goldfish", name: "금붕어", price: 800, hours: 48, minTank: 1, size: 20, finals: [s("comet_gold", "코멧 금붕어", "보통"), s("ryukin_gold", "류킨 금붕어", "고급"), s("oranda_gold", "오란다 금붕어", "희귀"), s("ranchu_gold", "란추 금붕어", "영웅")] },
  { key: "betta", name: "베타", price: 1500, hours: 60, minTank: 1, size: 19, finals: [s("veil_betta", "베일테일 베타", "보통"), s("crown_betta", "크라운테일 베타", "고급"), s("halfmoon_betta", "하프문 베타", "희귀"), s("koi_betta", "코이 베타", "영웅")] },
  { key: "angel", name: "엔젤피시", price: 3000, hours: 84, minTank: 2, size: 22, finals: [s("silver_angel", "실버 엔젤", "고급"), s("marble_angel", "마블 엔젤", "희귀"), s("platinum_angel", "플래티넘 엔젤", "영웅"), s("altum_angel", "알툼 엔젤", "전설")] },
  { key: "clown", name: "흰동가리", price: 5000, hours: 96, minTank: 2, size: 17, finals: [s("ocellaris_clown", "오셀라리스 흰동가리", "고급"), s("percula_clown", "퍼큘라 흰동가리", "희귀"), s("snowflake_clown", "스노우플레이크 흰동가리", "영웅"), s("blackice_clown", "블랙 아이스 흰동가리", "전설")] },
  { key: "discus", name: "디스커스", price: 9000, hours: 120, minTank: 3, size: 23, finals: [s("blue_discus", "블루 디스커스", "희귀"), s("pigeon_discus", "피전 블러드 디스커스", "영웅"), s("leopard_discus", "레오파드 디스커스", "영웅"), s("turquoise_discus", "터콰이즈 디스커스", "전설")] },
  { key: "koi", name: "비단잉어", price: 15000, hours: 168, minTank: 3, size: 27, finals: [s("kohaku_koi", "홍백 비단잉어", "희귀"), s("sanke_koi", "대정삼색 비단잉어", "영웅"), s("showa_koi", "소화삼색 비단잉어", "전설"), s("ogon_koi", "황금 비단잉어", "전설")] },
  { key: "ray", name: "민물가오리", price: 22000, hours: 200, minTank: 4, size: 28, finals: [s("motoro_ray", "모토로 가오리", "영웅"), s("polka_ray", "폴카닷 가오리", "전설"), s("black_ray", "블랙 다이아몬드 가오리", "전설"), s("pearl_ray", "펄 가오리", "신화")] },
  { key: "arowana", name: "아로와나", price: 32000, hours: 240, minTank: 4, size: 32, finals: [s("silver_arowana", "실버 아로와나", "영웅"), s("golden_arowana", "골든 아로와나", "전설"), s("red_arowana", "슈퍼 레드 아로와나", "전설"), s("platinum_arowana", "플래티넘 아로와나", "신화")] },
  { key: "bluefin", name: "참다랑어", price: 38000, hours: 264, minTank: 5, size: 36, finals: [s("bluefin_tuna", "참다랑어", "영웅")] },
  { key: "sea_turtle", name: "바다거북", price: 45000, hours: 288, minTank: 5, size: 32, youngName: "새끼", finals: [s("green_sea_turtle", "바다거북", "전설")] },
  { key: "whale_shark", name: "고래상어", price: 52000, hours: 312, minTank: 5, size: 45, youngName: "새끼", finals: [s("whale_shark", "고래상어", "전설")] },
  { key: "manta", name: "만타가오리", price: 56000, hours: 324, minTank: 5, size: 43, youngName: "새끼", finals: [s("oceanic_manta", "만타가오리", "전설")] },
  { key: "rising", name: "등용어", price: 60000, hours: 336, minTank: 5, size: 34, finals: [s("pearl_carp", "여의주 잉어", "전설"), s("imugi_fish", "이무기어", "신화"), s("azure_dragonfish", "청룡어", "신화"), s("golden_dragonfish", "황룡어", "태초")] },
  { key: "astral", name: "별무리어", price: 120000, hours: 504, minTank: 6, size: 34, finals: [s("moon_jelly", "달빛 해파리", "신화"), s("aurora_ray", "오로라 가오리", "신화"), s("galaxy_fish", "은하수어", "태초"), s("genesis_fish", "태초의 물고기", "태초")] },
];
export const ALL_SPECIES: readonly AquaSpecies[] = FAMILIES.flatMap((f) => [...f.finals]);
export const familyOf = (key: string): AquaFamily | undefined => FAMILIES.find((f) => f.key === key);
export const speciesOf = (key: string | undefined): AquaSpecies | undefined => ALL_SPECIES.find((x) => x.key === key);

export const TANKS: readonly { name: string; fish: number; decor: number; price: number }[] = [
  { name: "작은 어항", fish: 4, decor: 6, price: 0 },
  { name: "둥근 어항", fish: 6, decor: 10, price: 3000 },
  { name: "가정 수조", fish: 8, decor: 14, price: 8000 },
  { name: "대형 수조", fish: 12, decor: 20, price: 20000 },
  { name: "유리 수족관", fish: 16, decor: 26, price: 50000 },
  { name: "용궁 수조", fish: 20, decor: 32, price: 120000 },
];

export type DecorKind = "plant" | "rock" | "ornament" | "gear";
export type AquaDecor = { key: string; name: string; kind: DecorKind; price: number; effect?: { type: "clean" | "grow" | "feed"; amount: number } };
const d = (key: string, name: string, kind: DecorKind, price: number, effect?: AquaDecor["effect"]): AquaDecor => ({ key, name, kind, price, ...(effect ? { effect } : {}) });

export const DECOR: readonly AquaDecor[] = [
  // 장비 — 종류마다 가장 좋은 하나만 듣는다(쌓이지 않는다). 놓아야 듣는다.
  d("filter_1", "스펀지 여과기", "gear", 400, { type: "clean", amount: 0.25 }),
  d("filter_2", "외부 여과기", "gear", 3000, { type: "clean", amount: 0.5 }),
  d("filter_3", "생명의 샘 여과기", "gear", 20000, { type: "clean", amount: 1 }),
  d("heater_1", "작은 히터", "gear", 500, { type: "grow", amount: 0.05 }),
  d("heater_2", "정온 히터", "gear", 4000, { type: "grow", amount: 0.1 }),
  d("heater_3", "용암석 히터", "gear", 25000, { type: "grow", amount: 0.15 }),
  d("feeder_1", "타이머 급이기", "gear", 600, { type: "feed", amount: 0.25 }),
  d("feeder_2", "스마트 급이기", "gear", 5000, { type: "feed", amount: 0.5 }),
  d("feeder_3", "풍요의 조개 급이기", "gear", 30000, { type: "feed", amount: 1 }),
  // 수초
  d("moss_ball", "모스 볼", "plant", 120),
  d("vallisneria", "발리스네리아", "plant", 150),
  d("java_fern", "자바 펀", "plant", 200),
  d("anubias", "아누비아스", "plant", 300),
  d("red_rotala", "붉은 로탈라", "plant", 500),
  d("water_lily", "수련", "plant", 800),
  d("coral", "산호", "plant", 1500),
  d("glow_kelp", "빛나는 해초", "plant", 5000),
  // 돌 · 나무
  d("pebbles", "조약돌", "rock", 100),
  d("driftwood", "유목", "rock", 350),
  d("stone_arch", "돌 아치", "rock", 700),
  d("lava_rock", "용암석", "rock", 1200),
  d("crystal", "수정 군락", "rock", 4000),
  d("moon_stone", "달의 돌", "rock", 9000),
  // 장식
  d("mailbox", "수중 우체통", "ornament", 600),
  d("diver", "잠수부 인형", "ornament", 900),
  d("heart_bubbler", "하트 기포기", "ornament", 1200),
  d("sand_castle", "모래성", "ornament", 1500),
  d("windmill", "수중 풍차", "ornament", 1800),
  d("treasure", "보물상자", "ornament", 2000),
  d("pearl_clam", "진주 조개", "ornament", 3000),
  d("stone_pagoda", "석탑", "ornament", 3500),
  d("sunken_ship", "난파선", "ornament", 6000),
  d("hanok", "수중 한옥", "ornament", 8000),
  d("mermaid", "인어 동상", "ornament", 12000),
  d("turtle_ship", "거북선", "ornament", 18000),
  d("dragon_palace", "용궁", "ornament", 60000),
  d("star_gate", "별의 문", "ornament", 100000),
];
export const decorOf = (key: string): AquaDecor | undefined => DECOR.find((x) => x.key === key);
/** 값이 비쌀수록 아름답지만 값만큼 늘지는 않는다(제곱근) */
export const decorBeauty = (x: AquaDecor) => Math.round(Math.sqrt(x.price));

export type AquaFish = {
  id: number;
  family: string;
  /** 0 치어 · 1 어린 물고기 · 2 최종 */
  stage: 0 | 1 | 2;
  species?: string;
  growH: number;
  goodH: number;
  totalH: number;
};
export type PlacedDecor = { id: number; key: string; x: number; y: number };
export type AquaState = {
  tank: number;
  hunger: number;
  water: number;
  at: number;
  nextId: number;
  fish: AquaFish[];
  placed: PlacedDecor[];
  /** 옆으로 늘린 단계(0~3). 옵셔널 = 옛 저장분은 0 */
  wide?: number;
  /** 산 뒤 아직 안 놓은 악세사리(key → 개수) */
  bag: Record<string, number>;
  /** 만난 최종 형태 */
  dex: string[];
};

export const GROW_JUVENILE = 0.4;
export const HUNGER_HOURS = 24;
export const WATER_HOURS = 72;
/** 이 위면 '잘 돌보는 중' */
export const GOOD_HUNGER = 40;
export const GOOD_WATER = 50;
/** 물이 이 밑이면 성장이 멈춘다 */
export const MIN_WATER = 20;
/** 한 번에 비운 시간은 여기까지만 '못 돌본 시간'으로 친다 */
export const AWAY_CAP_H = 48;
export const BEAUTY_GROW_CAP = 0.15;
const HOUR = 3_600_000;

export function aquaOf(st: Pick<IslandState, "aquarium">, now = 0): AquaState {
  const a = st.aquarium;
  return {
    tank: Math.min(TANKS.length, Math.max(1, a?.tank ?? 1)),
    wide: Math.min(WIDE_STEPS.length, Math.max(0, a?.wide ?? 0)),
    hunger: a?.hunger ?? 100,
    water: a?.water ?? 100,
    at: a?.at ?? now,
    nextId: a?.nextId ?? 1,
    fish: (a?.fish ?? []).filter((f) => familyOf(f.family)),
    placed: (a?.placed ?? []).filter((p) => decorOf(p.key)),
    bag: { ...(a?.bag ?? {}) },
    dex: [...(a?.dex ?? [])],
  };
}

/** 지금 모습의 그림 열쇠 — 치어 fry_<계열> · 어린 물고기 juv_<계열> · 최종 <종> */
export const fishArtKey = (f: Pick<AquaFish, "family" | "stage" | "species">) =>
  f.stage === 2 && f.species ? f.species : `${f.stage === 0 ? "fry" : "juv"}_${f.family}`;
/** 지금 모습의 이름 */
export function fishName(f: Pick<AquaFish, "family" | "stage" | "species">): string {
  const fam = familyOf(f.family);
  if (f.stage === 2) return speciesOf(f.species)?.name ?? fam?.name ?? "물고기";
  return `${fam?.name ?? "물고기"} ${f.stage === 0 ? fam?.youngName ?? "치어" : fam?.youngName ? "어린 개체" : "어린 물고기"}`;
}
/** 어항을 옆으로 늘리는 값 [사용자: "재화를 주고 어항을 옆으로 늘릴 수 있도록"] — 넓어진 만큼 물고기 · 장식도 더 들어간다. 수조 단계와 따로 간다. */
export const WIDE_STEPS: readonly { price: number; fish: number; decor: number }[] = [
  { price: 12000, fish: 2, decor: 3 },
  { price: 30000, fish: 2, decor: 3 },
  { price: 70000, fish: 3, decor: 4 },
];
export const tankOf = (a: Pick<AquaState, "tank" | "wide">) => {
  const base = TANKS[a.tank - 1], done = WIDE_STEPS.slice(0, a.wide ?? 0);
  return { ...base, fish: base.fish + done.reduce((n, x) => n + x.fish, 0), decor: base.decor + done.reduce((n, x) => n + x.decor, 0) };
};

function gearBest(a: Pick<AquaState, "placed">, type: "clean" | "grow" | "feed"): number {
  let best = 0;
  for (const p of a.placed) {
    const e = decorOf(p.key)?.effect;
    if (e?.type === type && e.amount > best) best = e.amount;
  }
  return best;
}
export function tankBeauty(a: Pick<AquaState, "placed">): number {
  return a.placed.reduce((n, p) => {
    const x = decorOf(p.key);
    return n + (x ? decorBeauty(x) : 0);
  }, 0);
}
/** 지금 수조의 효과 — 화면과 정산이 같은 값을 본다 */
export function aquaEffects(a: Pick<AquaState, "placed" | "fish" | "tank">) {
  const load = a.fish.length / tankOf(a).fish;
  const beauty = tankBeauty(a);
  const beautyGrow = Math.min(BEAUTY_GROW_CAP, beauty / 2000);
  return {
    beauty,
    beautyGrow,
    growMult: 1 + gearBest(a, "grow") + beautyGrow,
    hungerHours: HUNGER_HOURS * (1 + gearBest(a, "feed")),
    waterHours: WATER_HOURS * (1 - 0.3 * Math.min(1, load)) * (1 + gearBest(a, "clean")),
  };
}

/** 정성 0~100 — 키운 시간 중 잘 돌본 비율 */
export const fishCare = (f: Pick<AquaFish, "goodH" | "totalH">) => (f.totalH <= 0 ? 100 : Math.round((Math.min(f.goodH, f.totalH) / f.totalH) * 100));
/** 정성에 따라 열리는 형태 수(아래부터) */
export const openFinals = (cq: number) => (cq >= 90 ? 4 : cq >= 75 ? 3 : cq >= 60 ? 2 : 1);
const WEIGHTS = [15, 20, 25, 40];

function hash(n: number, salt: string): number {
  let h = (2166136261 ^ n) >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** 최종 형태 고르기 — 정성이 연 형태 중 **못 만난 것 먼저**, 그 안에서 높은 형태일수록 잘 나온다. 결정적. */
export function pickFinal(fam: AquaFamily, cq: number, seen: readonly string[], seed: number): AquaSpecies {
  const open = fam.finals.map((sp, i) => ({ sp, w: WEIGHTS[i] })).slice(0, openFinals(cq));
  const fresh = open.filter((x) => !seen.includes(x.sp.key));
  const pool = fresh.length ? fresh : open;
  let r = hash(seed, fam.key) % pool.reduce((n, x) => n + x.w, 0);
  for (const x of pool) {
    if (r < x.w) return x.sp;
    r -= x.w;
  }
  return pool[pool.length - 1].sp;
}

export type AquaEvolved = { id: number; family: string; stage: 1 | 2; species?: string };

/** 지연 정산 — 지난 시간만큼 배고픔 · 물 · 성장 · 정성을 굴린다. 순수. */
export function tickAqua(input: AquaState, now: number): { a: AquaState; evolved: AquaEvolved[] } {
  const elapsed = Math.max(0, (now - input.at) / HOUR);
  if (elapsed <= 0) return { a: input, evolved: [] };
  const fx = aquaEffects(input);
  const hr = 100 / fx.hungerHours, wr = 100 / fx.waterHours;
  // 성장하는 시간: 배가 안 비고 물이 MIN_WATER 위인 동안
  const growWin = Math.max(0, Math.min(elapsed, input.hunger / hr, (input.water - MIN_WATER) / wr));
  // 잘 돌본 시간: 배 · 물 모두 '좋음' 위인 동안
  const goodWin = Math.max(0, Math.min(elapsed, (input.hunger - GOOD_HUNGER) / hr, (input.water - GOOD_WATER) / wr));
  const counted = Math.min(elapsed, Math.max(AWAY_CAP_H, goodWin));
  const evolved: AquaEvolved[] = [];
  const dex = [...input.dex];
  const fish = input.fish.map((f): AquaFish => {
    if (f.stage === 2) return f;
    const fam = familyOf(f.family);
    if (!fam) return f;
    const n: AquaFish = { ...f, growH: f.growH + growWin * fx.growMult, goodH: f.goodH + goodWin, totalH: f.totalH + counted };
    if (n.stage === 0 && n.growH >= fam.hours * GROW_JUVENILE) {
      n.stage = 1;
      evolved.push({ id: n.id, family: n.family, stage: 1 });
    }
    if (n.stage === 1 && n.growH >= fam.hours) {
      const sp = pickFinal(fam, fishCare(n), dex, n.id);
      n.stage = 2;
      n.species = sp.key;
      if (!dex.includes(sp.key)) dex.push(sp.key);
      const prev = evolved.find((e) => e.id === n.id);
      if (prev) { prev.stage = 2; prev.species = sp.key; } else evolved.push({ id: n.id, family: n.family, stage: 2, species: sp.key });
    }
    return n;
  });
  return {
    a: { ...input, at: now, hunger: Math.max(0, input.hunger - elapsed * hr), water: Math.max(0, input.water - elapsed * wr), fish, dex },
    evolved,
  };
}

/** 남은 성장 시간(지금 효과 기준, 잘 돌본다고 칠 때) */
export function hoursLeft(a: AquaState, f: AquaFish): number {
  const fam = familyOf(f.family);
  if (!fam || f.stage === 2) return 0;
  return Math.max(0, fam.hours - f.growH) / aquaEffects(a).growMult;
}
/** 자라는 중인가 — 멈췄으면 이유를 준다 */
export function growBlock(a: Pick<AquaState, "hunger" | "water">): string | null {
  if (a.hunger <= 0) return "배가 고파 성장이 멈췄어요";
  if (a.water <= MIN_WATER) return "물이 더러워 성장이 멈췄어요";
  return null;
}

export type AquaResult = { ok: true; state: IslandState; note?: string } | { ok: false; reason: string };
type Island = IslandState;

const put = (st: Island, a: AquaState, coins = st.coins, note?: string): AquaResult => ({ ok: true, state: { ...st, coins, aquarium: a }, ...(note ? { note } : {}) });

/** 정산만 — 성장한 물고기가 있으면 알려 준다 */
export function syncAqua(st: Island, now: number): { state: Island; a: AquaState; evolved: AquaEvolved[] } {
  const { a, evolved } = tickAqua(aquaOf(st, now), now);
  return { state: { ...st, aquarium: a }, a, evolved };
}

export const fryLockReason = (a: Pick<AquaState, "tank">, fam: AquaFamily): string | null =>
  a.tank < fam.minTank ? `${TANKS[fam.minTank - 1].name}부터 키울 수 있어요` : null;

/** 낚시로 잡은 물고기를 수조에 넣는다(2026-11-02 — [사용자: "낚시에 성공한 물고기들만 수조에 보관"]). 치어 가게는 없어졌다.
 *  자리 · 수조 크기 판정은 부르는 쪽(lib/fishing 의 storeBlock)이 먼저 한다. 어린 물고기는 그만큼 자란 채로, 다 큰 물고기는 도감에 바로 오른다. */
export function addFish(st: Island, key: string, stage: 0 | 1 | 2, species: string | undefined, now: number): Island {
  const fam = familyOf(key);
  if (!fam) return st;
  const a = tickAqua(aquaOf(st, now), now).a;
  const first = a.fish.length === 0;
  const growH = stage === 0 ? 0 : stage === 1 ? fam.hours * GROW_JUVENILE : fam.hours;
  return {
    ...st,
    aquarium: {
      ...a,
      // 빈 수조에 첫 물고기가 들어오면 새 물로 시작한다(비어 있던 동안 더러워진 물로 벌받지 않게)
      ...(first ? { hunger: 100, water: 100 } : {}),
      nextId: a.nextId + 1,
      dex: stage === 2 && species && !a.dex.includes(species) ? [...a.dex, species] : a.dex,
      fish: [...a.fish, { id: a.nextId, family: key, stage, ...(stage === 2 && species ? { species } : {}), growH, goodH: 0, totalH: 0 }],
    },
  };
}

export function feedFish(st: Island, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  if (!a.fish.length) return { ok: false, reason: "아직 물고기가 없어요" };
  if (a.hunger >= 90) return { ok: false, reason: "아직 배불러요" };
  return put(st, { ...a, hunger: 100 });
}

export function cleanWater(st: Island, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  if (a.water >= 90) return { ok: false, reason: "물이 아직 깨끗해요" };
  return put(st, { ...a, water: 100 });
}

export function upgradeTank(st: Island, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  const next = TANKS[a.tank];
  if (!next) return { ok: false, reason: "가장 큰 수조예요" };
  if (st.coins < next.price) return { ok: false, reason: `하트가 ${(next.price - st.coins).toLocaleString()}개 모자라요` };
  return put(st, { ...a, tank: a.tank + 1 }, st.coins - next.price, `수조를 넓혔어요 — ${next.name}`);
}

export function widenTank(st: Island, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  const next = WIDE_STEPS[a.wide ?? 0];
  if (!next) return { ok: false, reason: "더 늘릴 수 없어요" };
  if (st.coins < next.price) return { ok: false, reason: `하트가 ${(next.price - st.coins).toLocaleString()}개 모자라요` };
  return put(st, { ...a, wide: (a.wide ?? 0) + 1 }, st.coins - next.price, `어항을 옆으로 늘렸어요 — 물고기 +${next.fish} · 장식 +${next.decor}`);
}

export function buyDecor(st: Island, key: string, now: number): AquaResult {
  const x = decorOf(key);
  if (!x) return { ok: false, reason: "없는 악세사리예요" };
  if (st.coins < x.price) return { ok: false, reason: `하트가 ${(x.price - st.coins).toLocaleString()}개 모자라요` };
  const a = tickAqua(aquaOf(st, now), now).a;
  return put(st, { ...a, bag: { ...a.bag, [key]: (a.bag[key] ?? 0) + 1 } }, st.coins - x.price, `${x.name} — 보관함에 넣었어요`);
}

const clampX = (v: number) => Math.min(94, Math.max(6, Math.round(v * 10) / 10));
const clampY = (v: number) => Math.min(94, Math.max(14, Math.round(v * 10) / 10));

/** 보관함에서 꺼내 놓기. 정산을 먼저 해서 '놓기 전' 시간에 새 효과가 소급되지 않게 한다. */
export function placeDecor(st: Island, key: string, x: number, y: number, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  if ((a.bag[key] ?? 0) <= 0) return { ok: false, reason: "보관함에 없어요" };
  if (a.placed.length >= tankOf(a).decor) return { ok: false, reason: "더 놓을 자리가 없어요 — 수조를 넓혀 주세요" };
  const bag = { ...a.bag, [key]: a.bag[key] - 1 };
  if (bag[key] <= 0) delete bag[key];
  return put(st, { ...a, bag, nextId: a.nextId + 1, placed: [...a.placed, { id: a.nextId, key, x: clampX(x), y: clampY(y) }] });
}
export function moveDecor(st: Island, id: number, x: number, y: number, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  if (!a.placed.some((p) => p.id === id)) return { ok: false, reason: "이미 치운 악세사리예요" };
  return put(st, { ...a, placed: a.placed.map((p) => (p.id === id ? { ...p, x: clampX(x), y: clampY(y) } : p)) });
}
export function storeDecor(st: Island, id: number, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  const p = a.placed.find((q) => q.id === id);
  if (!p) return { ok: false, reason: "이미 치운 악세사리예요" };
  return put(st, { ...a, placed: a.placed.filter((q) => q.id !== id), bag: { ...a.bag, [p.key]: (a.bag[p.key] ?? 0) + 1 } });
}

/** 다 큰 물고기를 보내 주면 받는 하트 — 등급 기준. 물고기가 낚시로 공짜로 들어오므로 치어 값 비례로 주면 하트를 찍어 내는 길이 된다. */
export function releaseReward(f: Pick<AquaFish, "family" | "stage" | "species">): number {
  const sp = speciesOf(f.species);
  if (!familyOf(f.family) || f.stage !== 2 || !sp) return 0;
  return Math.round(24 * 1.7 ** GRADES.indexOf(sp.grade));
}
export function releaseFish(st: Island, id: number, now: number): AquaResult {
  const a = tickAqua(aquaOf(st, now), now).a;
  const f = a.fish.find((q) => q.id === id);
  if (!f) return { ok: false, reason: "이미 떠난 물고기예요" };
  const reward = releaseReward(f);
  return put(st, { ...a, fish: a.fish.filter((q) => q.id !== id) }, st.coins + reward);
}
