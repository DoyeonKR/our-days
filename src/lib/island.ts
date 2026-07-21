// "우리 섬" — 커플이 함께 키우는 지속형 공유 세계(정원 + 펫 + 꾸미기)의 순수 룰 엔진.
// ⚠ 순수 함수만: 상태를 받아 '새 상태'를 반환(입력 불변). 시간은 now(epoch ms)를 인자로 주입 →
//   결정적이라 유닛테스트 가능하고 서버 JSONB 상태와 정합. 커플 신뢰 모델(계산은 클라, 서버는
//   버전 낙관적 락만 강제). 코인·성장·펫감쇠·레벨 전부 여기서.

export const DAY_MS = 24 * 3600 * 1000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── 작물 ────────────────────────────────────────────────────────
export type CropKey = "tulip" | "carrot" | "tomato" | "strawberry" | "sunflower";
export type Crop = {
  key: CropKey;
  name: string;
  emoji: string;
  seed: number; // 씨앗 값(코인)
  yield: number; // 수확 코인
  xp: number; // 수확 시 섬 XP
  growMs: number; // 다 자라는 실시간
  minLevel: number; // 해금 섬 레벨
};
export const CROPS: Crop[] = [
  { key: "tulip", name: "튤립", emoji: "🌷", seed: 12, yield: 28, xp: 4, growMs: 2 * 3600_000, minLevel: 1 },
  { key: "carrot", name: "당근", emoji: "🥕", seed: 18, yield: 42, xp: 6, growMs: 3 * 3600_000, minLevel: 1 },
  { key: "tomato", name: "토마토", emoji: "🍅", seed: 30, yield: 72, xp: 10, growMs: 5 * 3600_000, minLevel: 2 },
  { key: "strawberry", name: "딸기", emoji: "🍓", seed: 50, yield: 125, xp: 16, growMs: 7 * 3600_000, minLevel: 3 },
  { key: "sunflower", name: "해바라기", emoji: "🌻", seed: 80, yield: 210, xp: 26, growMs: 10 * 3600_000, minLevel: 4 },
];
export const cropOf = (k: CropKey): Crop => CROPS.find((c) => c.key === k)!;
// 상대가 물을 주면 남은 성장의 이만큼(비율)을 즉시 앞당김. 한 사이클에 사람당 1번.
export const WATER_BOOST = 0.2;

// ── 펫 ──────────────────────────────────────────────────────────
export type PetKey = "chick" | "rabbit" | "cat" | "dog" | "hamster" | "penguin";
export const PETS: { key: PetKey; name: string; emoji: string }[] = [
  { key: "chick", name: "삐약이", emoji: "🐣" },
  { key: "rabbit", name: "토끼", emoji: "🐰" },
  { key: "cat", name: "고양이", emoji: "🐱" },
  { key: "dog", name: "강아지", emoji: "🐶" },
  { key: "hamster", name: "햄스터", emoji: "🐹" },
  { key: "penguin", name: "펭귄", emoji: "🐧" },
];
export const HUNGER_RATE = 45; // 하루에 배고픔 +45 (0=배부름 … 100=굶주림)
export const HAPPY_DECAY = 35; // 하루에 행복 -35
export const FOOD_COST = 15; // 먹이 값(코인)
export const FEED_HUNGER = 45; // 먹이 → 배고픔 감소
export const FEED_HAPPY = 8; // 먹이 → 행복 증가
export const FEED_XP = 5; // 먹이 → 섬 XP
export const PLAY_HAPPY = 22; // 놀아주기 → 행복
export const PLAY_XP = 4;
export const PLAY_COOLDOWN_MS = 90 * 60_000; // 놀아주기 쿨다운 90분
export const PET_MAX_LEVEL = 20;

export type Pet = {
  species: PetKey;
  name: string;
  level: number;
  xp: number; // 이번 레벨 진행 XP
  hunger: number; // 0..100
  happy: number; // 0..100
  lastTick: number; // 배고픔/행복 감쇠 기준 시각(epoch ms)
  lastPlay: number; // 마지막 놀아준 시각
};
/** 펫 레벨업에 필요한 XP(레벨별). */
export const petLevelXp = (level: number): number => 20 + level * 12;

// ── 꾸미기(데코) ─────────────────────────────────────────────────
export type DecorKey =
  | "tree"
  | "flower"
  | "bench"
  | "lamp"
  | "fountain"
  | "balloon"
  | "heart"
  | "statue";
export type Decor = { key: DecorKey; name: string; emoji: string; cost: number; minLevel: number };
export const DECORS: Decor[] = [
  { key: "flower", name: "꽃밭", emoji: "🌸", cost: 40, minLevel: 1 },
  { key: "tree", name: "나무", emoji: "🌳", cost: 70, minLevel: 1 },
  { key: "lamp", name: "등불", emoji: "🏮", cost: 110, minLevel: 2 },
  { key: "bench", name: "벤치", emoji: "🪑", cost: 150, minLevel: 2 },
  { key: "balloon", name: "풍선", emoji: "🎈", cost: 220, minLevel: 3 },
  { key: "heart", name: "하트조형", emoji: "💗", cost: 300, minLevel: 3 },
  { key: "fountain", name: "분수", emoji: "⛲", cost: 500, minLevel: 4 },
  { key: "statue", name: "기념비", emoji: "🗿", cost: 800, minLevel: 5 },
];
export const decorOf = (k: DecorKey): Decor => DECORS.find((d) => d.key === k)!;
export const DECOR_COLS = 6; // 꾸미기 배치 격자
export const DECOR_ROWS = 4;
export const DECOR_REFUND = 0.5; // 치울 때 환급 비율

// ── 상태 ────────────────────────────────────────────────────────
export type Plot = {
  crop: CropKey | null;
  plantedAt: number | null; // 심은 시각(epoch ms)
  waterers: string[]; // 이번 사이클에 물 준 uid (성장 가속, 사람당 1회)
};
export type PlacedDecor = { id: string; key: DecorKey; x: number; y: number };
export type IslandState = {
  v: number; // 버전(낙관적 락)
  coins: number; // 공유 하트코인
  level: number; // 섬 레벨
  xp: number; // 이번 레벨 진행 XP
  plots: Plot[]; // 정원 밭(길이 = MAX_PLOTS)
  pet: Pet;
  decor: PlacedDecor[]; // 배치된 장식
  daily: Record<string, string>; // uid → 마지막 출석보상 받은 KST 날짜(YYYY-MM-DD)
  togetherDate: string | null; // 마지막 '함께 보너스' 받은 KST 날짜
  log: string[]; // 최근 이벤트(최신 앞)
};

export const MAX_PLOTS = 9;
export const START_COINS = 120;
/** 섬 레벨에 따라 열린 밭 수(3 → 최대 9). */
export const plotsUnlocked = (level: number): number => Math.min(MAX_PLOTS, 2 + level);
/** 섬 레벨업에 필요한 XP. */
export const levelXp = (level: number): number => 40 + level * 30;
export const ISLAND_MAX_LEVEL = 12;
export const DAILY_VISIT_BONUS = 25; // 하루 첫 방문 코인
export const TOGETHER_BONUS = 60; // 둘 다 같은 날 방문 시 함께 보너스

const cloneState = (s: IslandState): IslandState => ({
  ...s,
  plots: s.plots.map((p) => ({ ...p, waterers: [...p.waterers] })),
  pet: { ...s.pet },
  decor: s.decor.map((d) => ({ ...d })),
  daily: { ...s.daily },
  log: [...s.log],
});
function pushLog(s: IslandState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 40);
}
/** KST 날짜 문자열(YYYY-MM-DD) — 출석/함께 보너스 기준. */
export function kstDate(now: number): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

// ── 생성 ────────────────────────────────────────────────────────
export function createIsland(species: PetKey, petName: string, now: number): IslandState {
  return {
    v: 1,
    coins: START_COINS,
    level: 1,
    xp: 0,
    plots: Array.from({ length: MAX_PLOTS }, () => ({ crop: null, plantedAt: null, waterers: [] })),
    pet: {
      species,
      name: petName || PETS.find((p) => p.key === species)?.name || "펫",
      level: 1,
      xp: 0,
      hunger: 20,
      happy: 80,
      lastTick: now,
      lastPlay: 0,
    },
    decor: [],
    daily: {},
    togetherDate: null,
    log: ["우리 섬이 생겼어요! 🏝️ 함께 가꿔봐요"],
  };
}

// ── 내부: 섬 XP/레벨업 ──────────────────────────────────────────
function addIslandXp(s: IslandState, n: number): void {
  s.xp += n;
  while (s.level < ISLAND_MAX_LEVEL && s.xp >= levelXp(s.level)) {
    s.xp -= levelXp(s.level);
    s.level += 1;
    pushLog(s, `섬이 Lv.${s.level}로 성장했어요! ✨`);
  }
  if (s.level >= ISLAND_MAX_LEVEL) s.xp = Math.min(s.xp, levelXp(s.level));
}

// ── 정원 ────────────────────────────────────────────────────────
/** 작물 성장 상태 — progress 0..1, ripe 여부, 남은 ms. 물 준 사람 수만큼 성장 단축. */
export function cropStage(
  plot: Plot,
  now: number,
): { planted: boolean; ripe: boolean; progress: number; remainingMs: number } {
  if (!plot.crop || plot.plantedAt == null)
    return { planted: false, ripe: false, progress: 0, remainingMs: 0 };
  const c = cropOf(plot.crop);
  // 물 준 사람 수만큼 총 성장시간을 (1 - WATER_BOOST*n) 로 단축
  const effGrow = c.growMs * Math.max(0.2, 1 - WATER_BOOST * plot.waterers.length);
  const elapsed = Math.max(0, now - plot.plantedAt);
  const progress = clamp(elapsed / effGrow, 0, 1);
  return {
    planted: true,
    ripe: progress >= 1,
    progress,
    remainingMs: Math.max(0, effGrow - elapsed),
  };
}

export function plant(s0: IslandState, plotId: number, crop: CropKey, now: number): IslandState {
  const s = cloneState(s0);
  const plot = s.plots[plotId];
  if (!plot || plotId >= plotsUnlocked(s.level)) return s0; // 잠긴 밭
  if (plot.crop) return s0; // 이미 심김
  const c = cropOf(crop);
  if (s.level < c.minLevel || s.coins < c.seed) return s0;
  s.coins -= c.seed;
  s.plots[plotId] = { crop, plantedAt: now, waterers: [] };
  pushLog(s, `${c.emoji} ${c.name} 씨앗을 심었어요`);
  return s;
}

/** 물주기 — 사람당 사이클 1회, 성장 가속. 상대가 준 물이 특히 의미(협동). */
export function water(s0: IslandState, plotId: number, uid: string, now: number): IslandState {
  const s = cloneState(s0);
  const plot = s.plots[plotId];
  if (!plot || !plot.crop) return s0;
  if (plot.waterers.includes(uid)) return s0; // 이미 줌
  if (cropStage(plot, now).ripe) return s0; // 다 자람
  plot.waterers.push(uid);
  pushLog(s, `${cropOf(plot.crop).emoji} 물을 줬어요 💧 (성장 가속)`);
  return s;
}

export function harvest(s0: IslandState, plotId: number, now: number): IslandState {
  const s = cloneState(s0);
  const plot = s.plots[plotId];
  if (!plot || !plot.crop) return s0;
  if (!cropStage(plot, now).ripe) return s0;
  const c = cropOf(plot.crop);
  s.coins += c.yield;
  s.plots[plotId] = { crop: null, plantedAt: null, waterers: [] };
  pushLog(s, `${c.emoji} ${c.name} 수확! +${c.yield}💗`);
  addIslandXp(s, c.xp);
  return s;
}

// ── 펫 ──────────────────────────────────────────────────────────
/** 펫의 배고픔/행복을 now 까지 감쇠 적용한 사본(순수). */
export function tickPet(pet: Pet, now: number): Pet {
  const days = Math.max(0, now - pet.lastTick) / DAY_MS;
  return {
    ...pet,
    hunger: clamp(pet.hunger + days * HUNGER_RATE, 0, 100),
    happy: clamp(pet.happy - days * HAPPY_DECAY, 0, 100),
    lastTick: now,
  };
}
/** 펫 기분 라벨(현재 상태 기준). */
export function petMood(pet: Pet, now: number): "happy" | "ok" | "sad" | "hungry" {
  const p = tickPet(pet, now);
  if (p.hunger >= 70) return "hungry";
  if (p.happy >= 65) return "happy";
  if (p.happy >= 35) return "ok";
  return "sad";
}
function addPetXp(pet: Pet, n: number): void {
  pet.xp += n;
  while (pet.level < PET_MAX_LEVEL && pet.xp >= petLevelXp(pet.level)) {
    pet.xp -= petLevelXp(pet.level);
    pet.level += 1;
  }
  if (pet.level >= PET_MAX_LEVEL) pet.xp = Math.min(pet.xp, petLevelXp(pet.level));
}

export function feedPet(s0: IslandState, now: number): IslandState {
  const s = cloneState(s0);
  if (s.coins < FOOD_COST) return s0;
  const pet = tickPet(s.pet, now);
  if (pet.hunger <= 0) return s0; // 이미 배부름 — 낭비 방지
  s.coins -= FOOD_COST;
  pet.hunger = clamp(pet.hunger - FEED_HUNGER, 0, 100);
  pet.happy = clamp(pet.happy + FEED_HAPPY, 0, 100);
  const lvl0 = pet.level;
  addPetXp(pet, FEED_XP);
  s.pet = pet;
  pushLog(s, `${petEmoji(pet.species)} 밥을 줬어요 🍚`);
  if (pet.level > lvl0) pushLog(s, `${pet.name} Lv.${pet.level} 성장! 🎉`);
  addIslandXp(s, 2);
  return s;
}

export function playPet(s0: IslandState, now: number): IslandState {
  const s = cloneState(s0);
  const pet = tickPet(s.pet, now);
  if (now - pet.lastPlay < PLAY_COOLDOWN_MS) return s0; // 쿨다운
  pet.happy = clamp(pet.happy + PLAY_HAPPY, 0, 100);
  pet.lastPlay = now;
  const lvl0 = pet.level;
  addPetXp(pet, PLAY_XP);
  s.pet = pet;
  pushLog(s, `${petEmoji(pet.species)} ${pet.name}와(과) 놀았어요 🎵`);
  if (pet.level > lvl0) pushLog(s, `${pet.name} Lv.${pet.level} 성장! 🎉`);
  addIslandXp(s, 2);
  return s;
}
export const petEmoji = (k: PetKey): string => PETS.find((p) => p.key === k)?.emoji ?? "🐣";

// ── 꾸미기 ──────────────────────────────────────────────────────
export function placeDecor(
  s0: IslandState,
  key: DecorKey,
  x: number,
  y: number,
  now: number,
): IslandState {
  const s = cloneState(s0);
  const d = decorOf(key);
  if (s.level < d.minLevel || s.coins < d.cost) return s0;
  if (x < 0 || x >= DECOR_COLS || y < 0 || y >= DECOR_ROWS) return s0;
  if (s.decor.some((it) => it.x === x && it.y === y)) return s0; // 칸 점유
  s.coins -= d.cost;
  s.decor.push({ id: `d${now}-${s.decor.length}`, key, x, y });
  pushLog(s, `${d.emoji} ${d.name} 배치 🌸`);
  addIslandXp(s, 5);
  return s;
}
export function removeDecor(s0: IslandState, id: string): IslandState {
  const s = cloneState(s0);
  const it = s.decor.find((d) => d.id === id);
  if (!it) return s0;
  const refund = Math.floor(decorOf(it.key).cost * DECOR_REFUND);
  s.decor = s.decor.filter((d) => d.id !== id);
  s.coins += refund;
  pushLog(s, `${decorOf(it.key).emoji} 치우고 +${refund}💗 환급`);
  return s;
}

// ── 코인: 출석·함께·외부활동 ────────────────────────────────────
/** 방문 시 호출 — 하루 첫 방문 보너스 + 둘 다 방문한 날 '함께' 보너스. */
export function claimVisit(s0: IslandState, uid: string, now: number): IslandState {
  const today = kstDate(now);
  let s = s0;
  if (s.daily[uid] !== today) {
    s = cloneState(s);
    s.daily[uid] = today;
    s.coins += DAILY_VISIT_BONUS;
    pushLog(s, `오늘 첫 출석 +${DAILY_VISIT_BONUS}💗`);
  }
  // 둘 다 오늘 방문 + 아직 함께 보너스 안 받음
  const both = Object.values(s.daily).filter((d) => d === today).length >= 2;
  if (both && s.togetherDate !== today) {
    if (s === s0) s = cloneState(s);
    s.togetherDate = today;
    s.coins += TOGETHER_BONUS;
    pushLog(s, `오늘 둘 다 왔어요! 함께 보너스 +${TOGETHER_BONUS}💗 🤝`);
  }
  return s;
}

/** 외부 활동(게임 승리·체크인 등)에서 코인 지급. reason 은 로그용. */
export function earnCoins(s0: IslandState, amount: number, reason: string): IslandState {
  if (amount <= 0) return s0;
  const s = cloneState(s0);
  s.coins += amount;
  pushLog(s, `${reason} +${amount}💗`);
  return s;
}

/** 총 자산가치(진척 표시용) — 코인 + 배치 데코 원가 + 펫/섬 레벨 가중. */
export function islandWorth(s: IslandState): number {
  const decorVal = s.decor.reduce((a, d) => a + decorOf(d.key).cost, 0);
  return s.coins + decorVal + s.level * 100 + s.pet.level * 50;
}
