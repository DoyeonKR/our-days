// "우리 섬" — 커플이 함께 키우는 지속형 공유 세계. 깊은 룰 엔진.
// ⚠ 순수 함수만: 상태→새 상태(입력 불변). 시간은 now(epoch ms) 주입 → 결정적·테스트가능·서버 JSONB 정합.
// 지연 시뮬레이션(lazy): 백그라운드 없음. 액션마다 tick(경과시간 감쇠/성장/가공/질병/스트릭)을 먼저 적용.
// 결정적 RNG: mulberry32(seed ^ rngCounter) — 두 사람이 같은 품질·질병·퀘스트 롤을 본다.
// 설계 근거: 타마고치 진화분기 · 스타듀/헤이데이 품질·계절·가공 · 동물의숲/네코아츠메 수집 · 유대 레이어.

export const DAY_MS = 86_400_000;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const HOUR = 3_600_000;

// ── 단일 튜닝 소스 ──────────────────────────────────────────────
export const TUNING = {
  startCoins: 150,
  pet: {
    decay: { hunger: 35, happy: 20, energy: 25, clean: 30 }, // 하루당 감소
    action: {
      feed: { hunger: 30, xp: 8, cdH: 4, cost: 12 },
      play: { happy: 25, energy: -15, xp: 12, cdH: 3 },
      clean: { clean: 35, xp: 6, cdH: 6 },
      hug: { happy: 15, xp: 5, cdH: 2 },
      rest: { energy: 40, xp: 3, cdH: 8, sleepH: 2 }, // 재우면 sleepH 시간 동안 실제로 잠(공유 상태)
      medicine: { health: 50, xp: 10, cost: 50 },
    },
    // 직접 키운 작물로 밥주기 — 코인 먹이보다 포만/행복이 크고 무료(작물의 존재 이유). ★ 높을수록 보너스.
    cropFeed: { hunger: 42, happyBase: 5, happyPerStar: 2, xpBonus: 4 },
    // 쓰다듬기 보상 — 캐릭터를 터치(게이지 충전)하면 애정+소액 코인. 하루 캡으로 경제 보호.
    petting: { capDay: 10, coins: 5, happy: 4, xp: 3, bond: 2 },
    // 함께 놀기 — base 보상 + 플레이 세션(하트 탭) 합산 점수 보너스.
    // scoreForMax: 두 사람 점수 합이 이 값이면 보너스 만점(1인 세션 실측 상한 ~15 → 합 24면 충분히 도전적)
    coop: { happy: 40, xp: 12, bondXp: 15, cdH: 6, bonusHappyMax: 10, bonusBondMax: 10, scoreForMax: 24 },
    sickChancePerDay: 0.15,
    cq: { start: 50, keep: 0.9, perfect: 10, routine: 6, neglect: 15 },
    evoLevel: { 1: 5, 2: 15, 3: 30, 4: 50 }, // 스테이지 진입 레벨
    // 케어XP 앵커(누적) → 레벨 파생(구간 선형)
    lvlAnchors: [
      [1, 0],
      [5, 200],
      [15, 1050],
      [30, 3300],
      [50, 8300],
    ] as [number, number][],
    branch: { stage2Sunny: 70, stage2Cozy: 40, s3SunnyHi: 75, s3Hi: 60, s3MoodyHi: 55, s3RadiantBond: 5, s4Hi: 80, s4MaxNeglect: 2 },
  },
  farm: {
    starMult: { 1: 1.0, 2: 1.6, 3: 2.5, 4: 4.0, 5: 7.0 } as Record<number, number>,
    starCut: [45, 70, 90, 110], // ★2/3/4/5 임계
    quality: {
      base: 20, perSkill: 3, watered: 25, inSeason: 15,
      fertGold: 40,
      fertStep: [18, 12, 8], // 비료 누적 1/2/3개째 품질 기여(체감보상 감소)
      rainbow: 12, // 무지개 날씨 수확 보너스
      rngMax: 12, // 운의 폭(20→12) — 플레이어 결정(비료)이 별을 지배하게
    },
    fertStackMax: 3, // 밭당 일반 비료 누적 한도
    fertSpeedPerStack: 0.08, // 비료 1단계당 성장 가속(막대가 눈앞에서 전진)
    goldSpeed: 0.2, // 골드비료 성장 가속
    speedCap: 0.36, // 성장 가속 상한
    luckyChance: 0.08, // 행운의 두둑(심기 시 슬롯머신)
    luckyScore: 18, // 행운의 두둑 품질 보너스
    waterSpeed: 1.5,
    offSeasonSpeed: 0.5,
    offSeasonYield: 0.6,
    skillMax: 20,
    star5MinSkill: 12,
    plotBatches: [200, 400, 800, 1500, 3000, 5000, 8000, 12000, 18000, 26000], // 확장 비용(각 +2칸, 4→24)
    startPlots: 4,
    sprinkler: 500,
    greenhouse: 2000,
    fertilizer: 25,
    goldFertilizer: 120,
  },
  island: {
    maxLevel: 40,
    ratingTiers: { bronze: 0, silver: 200, gold: 500, diamond: 1000, royal: 2000 },
    // 섬 분위기(꾸밀수록 상승) — 펫 행복 감쇠를 최대 ambienceMaxPerk 만큼 완화. 꾸미기의 실질 보상.
    ambienceRatingFull: 1200,
    ambienceMaxPerk: 0.35,
    decorJoy: 4, // 새 장식을 놓으면 펫이 좋아함(즉시 행복 +)
    // 오늘의 위시 장식 — 펫이 매일 다른 장식을 갖고 싶어함(꾸미기에 '오늘의 이유'를 만드는 장치)
    wish: { coins: 30, happy: 10, xp: 8 },
  },
  bond: {
    maxLevel: 20,
    xp: { coop: 15, gift: 10, bothLogin: 20, note: 8, dday: 100 },
    giftCapDay: 3,
  },
  streak: { graceH: 48, cycle: [20, 30, 40, 50, 80, 100, 150] },
  visit: { daily: 25, together: 60 },
  dday: { per100: 50 },
};
export const xpForIslandLevel = (n: number): number => Math.round(100 * n ** 1.6);
export const xpForBondLevel = (n: number): number => Math.round(150 * n ** 1.4);
export const skillXpFor = (n: number): number => Math.round(100 * n ** 1.5);

// ── 계절 ────────────────────────────────────────────────────────
export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
export const SEASON_LABEL: Record<Season, string> = {
  spring: "봄 🌸",
  summer: "여름 🎆",
  autumn: "가을 🍂",
  winter: "겨울 ❄️",
};
/** 실제 달(now, KST)로 계절 판정. */
export function seasonOf(now: number): Season {
  const m = new Date(now + 9 * HOUR).getUTCMonth(); // 0-11
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

// ── 작물 ────────────────────────────────────────────────────────
export type CropKey =
  | "strawberry" | "carrot" | "tomato" | "corn"
  | "pumpkin" | "grape" | "cabbage" | "mushroom";
export type Crop = {
  key: CropKey; name: string; emoji: string;
  growDays: number; seed: number; sell: number; season: Season;
};
export const CROPS: Crop[] = [
  { key: "strawberry", name: "딸기", emoji: "🍓", growDays: 1.0, seed: 10, sell: 18, season: "spring" },
  { key: "carrot", name: "당근", emoji: "🥕", growDays: 0.75, seed: 8, sell: 14, season: "spring" },
  { key: "tomato", name: "토마토", emoji: "🍅", growDays: 1.5, seed: 15, sell: 28, season: "summer" },
  { key: "corn", name: "옥수수", emoji: "🌽", growDays: 2.0, seed: 20, sell: 38, season: "summer" },
  { key: "pumpkin", name: "호박", emoji: "🎃", growDays: 2.5, seed: 30, sell: 60, season: "autumn" },
  { key: "grape", name: "포도", emoji: "🍇", growDays: 2.0, seed: 25, sell: 45, season: "autumn" },
  { key: "cabbage", name: "양배추", emoji: "🥬", growDays: 1.5, seed: 18, sell: 32, season: "winter" },
  { key: "mushroom", name: "버섯", emoji: "🍄", growDays: 1.0, seed: 12, sell: 22, season: "winter" },
];
export const cropOf = (k: CropKey): Crop => CROPS.find((c) => c.key === k)!;

// ── 가공품(워크숍) ──────────────────────────────────────────────
// 게이트는 **농사 스킬**(minSkill) — 섬 레벨은 꾸미기/펫에서 오르므로 농부의 노력이 공방을 연다.
// (구: minLevel 6~10 이 섬 Lv.3·농사 Lv.5 플레이어를 잠긴 빈 화면에 가뒀던 원인)
export type ProductKey = "jam" | "juice" | "pie" | "pickles" | "wine" | "popcorn" | "soup" | "salad";
export type Product = {
  key: ProductKey; name: string; emoji: string;
  recipe: Partial<Record<CropKey, number>>; days: number; sell: number; minSkill: number;
};
export const PRODUCTS: Product[] = [
  { key: "soup", name: "야채수프", emoji: "🍲", recipe: { carrot: 2, mushroom: 1 }, days: 0.25, sell: 70, minSkill: 2 },
  { key: "jam", name: "잼", emoji: "🍯", recipe: { strawberry: 2 }, days: 0.5, sell: 90, minSkill: 2 },
  { key: "popcorn", name: "팝콘", emoji: "🍿", recipe: { corn: 2 }, days: 0.25, sell: 100, minSkill: 2 },
  { key: "salad", name: "샐러드", emoji: "🥗", recipe: { tomato: 2, cabbage: 1, carrot: 1 }, days: 0.5, sell: 120, minSkill: 3 },
  { key: "juice", name: "주스", emoji: "🧃", recipe: { grape: 3 }, days: 0.5, sell: 110, minSkill: 4 },
  { key: "pickles", name: "피클", emoji: "🥫", recipe: { cabbage: 2 }, days: 0.75, sell: 130, minSkill: 4 },
  { key: "pie", name: "파이", emoji: "🥧", recipe: { pumpkin: 2 }, days: 1, sell: 220, minSkill: 6 },
  { key: "wine", name: "와인", emoji: "🍷", recipe: { grape: 4 }, days: 3, sell: 600, minSkill: 9 },
];
export const productOf = (k: ProductKey): Product => PRODUCTS.find((p) => p.key === k)!;

// ── 펫 진화 트리 ────────────────────────────────────────────────
export type PetForm = {
  key: string; stage: number; emoji: string; name: string;
};
// 최종 12형 + 중간형. key 로 참조.
export const PET_FORMS: Record<string, PetForm> = {
  egg: { key: "egg", stage: 0, emoji: "🥚", name: "알" },
  hatchling: { key: "hatchling", stage: 1, emoji: "🐣", name: "아기" },
  sunny: { key: "sunny", stage: 2, emoji: "🐥", name: "햇살이" },
  cozy: { key: "cozy", stage: 2, emoji: "🐤", name: "포근이" },
  moody: { key: "moody", stage: 2, emoji: "🐦‍⬛", name: "그늘이" },
  fox: { key: "fox", stage: 3, emoji: "🦊", name: "여우" },
  cat: { key: "cat", stage: 3, emoji: "🐱", name: "고양이" },
  bear: { key: "bear", stage: 3, emoji: "🐻", name: "곰" },
  panda: { key: "panda", stage: 3, emoji: "🐼", name: "판다" },
  owl: { key: "owl", stage: 3, emoji: "🦉", name: "부엉이" },
  wolf: { key: "wolf", stage: 3, emoji: "🐺", name: "늑대" },
  // Stage 4 최종형(각 stage3 → 하이/일반 2갈래 = 12)
  celestial_fox: { key: "celestial_fox", stage: 4, emoji: "🌟", name: "천상여우" },
  starlight_fox: { key: "starlight_fox", stage: 4, emoji: "✨", name: "별빛여우" },
  royal_cat: { key: "royal_cat", stage: 4, emoji: "👑", name: "왕고양이" },
  lucky_cat: { key: "lucky_cat", stage: 4, emoji: "🍀", name: "행운고양이" },
  guardian_bear: { key: "guardian_bear", stage: 4, emoji: "🛡️", name: "수호곰" },
  honey_bear: { key: "honey_bear", stage: 4, emoji: "🍯", name: "꿀곰" },
  zen_panda: { key: "zen_panda", stage: 4, emoji: "☯️", name: "선판다" },
  dream_panda: { key: "dream_panda", stage: 4, emoji: "💤", name: "꿈판다" },
  arcane_owl: { key: "arcane_owl", stage: 4, emoji: "🔮", name: "마도부엉이" },
  sage_owl: { key: "sage_owl", stage: 4, emoji: "📜", name: "현자부엉이" },
  lunar_wolf: { key: "lunar_wolf", stage: 4, emoji: "🌙", name: "달늑대" },
  spirit_wolf: { key: "spirit_wolf", stage: 4, emoji: "👻", name: "영혼늑대" },
};
export const petForm = (k: string): PetForm => PET_FORMS[k] ?? PET_FORMS.egg;

/** 다음 진화형 결정 — 현재 form + CQ + bondLv + neglect 로 분기. null=최종형. */
export function nextEvolution(
  form: string,
  cq: number,
  bondLv: number,
  neglect: number,
): string | null {
  const b = TUNING.pet.branch;
  switch (form) {
    case "egg":
      return "hatchling";
    case "hatchling":
      return cq >= b.stage2Sunny ? "sunny" : cq >= b.stage2Cozy ? "cozy" : "moody";
    case "sunny":
      return cq >= b.s3SunnyHi && bondLv >= b.s3RadiantBond ? "fox" : "cat";
    case "cozy":
      return cq >= b.s3Hi ? "bear" : "panda";
    case "moody":
      return cq >= b.s3MoodyHi ? "owl" : "wolf";
    case "fox":
      return cq >= b.s4Hi && neglect <= b.s4MaxNeglect ? "celestial_fox" : "starlight_fox";
    case "cat":
      return cq >= b.s4Hi && neglect <= b.s4MaxNeglect ? "royal_cat" : "lucky_cat";
    case "bear":
      return cq >= b.s4Hi && neglect <= b.s4MaxNeglect ? "guardian_bear" : "honey_bear";
    case "panda":
      return cq >= b.s4Hi && neglect <= b.s4MaxNeglect ? "zen_panda" : "dream_panda";
    case "owl":
      return cq >= b.s4Hi && neglect <= b.s4MaxNeglect ? "arcane_owl" : "sage_owl";
    case "wolf":
      return cq >= b.s4Hi && neglect <= b.s4MaxNeglect ? "lunar_wolf" : "spirit_wolf";
    default:
      return null; // 최종형
  }
}

// ── 데코 & 세트 ─────────────────────────────────────────────────
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY_RATING: Record<Rarity, number> = { common: 5, rare: 15, epic: 40, legendary: 100 };
export const RARITY_PRICE: Record<Rarity, number> = { common: 40, rare: 150, epic: 500, legendary: 1500 };
export type DecorDef = { key: string; emoji: string; name: string; set: string; rarity: Rarity; minLevel: number };
export const DECORS: DecorDef[] = [
  // 봄 정원
  { key: "tulip", emoji: "🌷", name: "튤립", set: "spring", rarity: "common", minLevel: 1 },
  { key: "rose", emoji: "🌹", name: "장미", set: "spring", rarity: "common", minLevel: 1 },
  { key: "sunflower", emoji: "🌻", name: "해바라기", set: "spring", rarity: "rare", minLevel: 2 },
  { key: "blossom", emoji: "🌼", name: "들꽃", set: "spring", rarity: "common", minLevel: 1 },
  { key: "butterfly", emoji: "🦋", name: "나비", set: "spring", rarity: "rare", minLevel: 3 },
  // 아늑한 집
  { key: "sofa", emoji: "🛋️", name: "소파", set: "cozy", rarity: "common", minLevel: 2 },
  { key: "chair", emoji: "🪑", name: "의자", set: "cozy", rarity: "common", minLevel: 2 },
  { key: "candle", emoji: "🕯️", name: "촛불", set: "cozy", rarity: "rare", minLevel: 3 },
  { key: "frame", emoji: "🖼️", name: "액자", set: "cozy", rarity: "rare", minLevel: 3 },
  { key: "books", emoji: "📚", name: "책장", set: "cozy", rarity: "common", minLevel: 2 },
  // 바다
  { key: "umbrella", emoji: "⛱️", name: "파라솔", set: "beach", rarity: "common", minLevel: 4 },
  { key: "shell", emoji: "🐚", name: "조개", set: "beach", rarity: "rare", minLevel: 4 },
  { key: "crab", emoji: "🦀", name: "게", set: "beach", rarity: "rare", minLevel: 5 },
  { key: "wave", emoji: "🌊", name: "파도", set: "beach", rarity: "epic", minLevel: 8 },
  // 커플 코너(유대 해금)
  { key: "hearts", emoji: "💕", name: "하트", set: "couple", rarity: "rare", minLevel: 3 },
  { key: "cheers", emoji: "🥂", name: "건배", set: "couple", rarity: "epic", minLevel: 5 },
  { key: "ferris", emoji: "🎡", name: "관람차", set: "couple", rarity: "epic", minLevel: 6 },
  { key: "ring", emoji: "💍", name: "반지", set: "couple", rarity: "legendary", minLevel: 8 },
  // 천상(레전드)
  { key: "moon", emoji: "🌙", name: "달", set: "celestial", rarity: "epic", minLevel: 10 },
  { key: "stars", emoji: "⭐", name: "별", set: "celestial", rarity: "rare", minLevel: 10 },
  { key: "comet", emoji: "🌠", name: "혜성", set: "celestial", rarity: "epic", minLevel: 12 },
  { key: "planet", emoji: "🪐", name: "행성", set: "celestial", rarity: "legendary", minLevel: 15 },
];
export const decorDef = (k: string): DecorDef => DECORS.find((d) => d.key === k)!;
export type DecorSet = { id: string; name: string; emoji: string; bonusRating: number; perk: string };
export const DECOR_SETS: DecorSet[] = [
  { id: "spring", name: "봄 정원", emoji: "🌸", bonusRating: 30, perk: "작물 품질 +5%" },
  { id: "cozy", name: "아늑한 집", emoji: "🏮", bonusRating: 25, perk: "펫 에너지 감쇠 -10%" },
  { id: "beach", name: "바다", emoji: "🏖️", bonusRating: 30, perk: "펫 행복 감쇠 -10%" },
  { id: "couple", name: "커플 코너", emoji: "💑", bonusRating: 50, perk: "유대 XP +10%" },
  { id: "celestial", name: "천상", emoji: "🌌", bonusRating: 80, perk: "모든 XP +2%" },
];
export const DECOR_COLS = 6;
export const DECOR_ROWS = 4;

// ── 상태 타입 ───────────────────────────────────────────────────
export type PetStats = { hunger: number; happy: number; energy: number; clean: number; health: number };
export type Pet = {
  form: string;
  name: string;
  careXp: number; // 누적
  stats: PetStats;
  cq: number;
  neglect: number;
  sick: boolean;
  cd: Record<string, number>; // 액션→마지막 실행 ms
  pendingEvolve: boolean;
  sleepUntil?: number; // 재우기 후 이 시각까지 잠(공유 — 상대 폰에서도 자는 모습). 탭으로 깨움
};
export type Plot = {
  crop: CropKey | null;
  plantedAt: number | null;
  wateredAt: number | null; // 마지막 물준 시각(하루 유효)
  fert: number; // 품질 보너스 합산 = fertQuality(fertStack, gold)
  // ↓ 신규 필드는 전부 옵셔널 + `?? 기본값` 읽기 — 저장된 구버전 JSONB 와 무마이그레이션 호환
  fertStack?: number; // 일반 비료 누적 단계 0~fertStackMax
  gold?: boolean; // 골드비료 적용 여부(밭당 1회)
  lucky?: boolean; // 행운의 두둑(심기 시 8% 롤 — 순수 상방)
};
export type CraftSlot = { product: ProductKey | null; startAt: number | null; star: number };
export type Barn = Record<string, { qty: number; star: number }>; // cropKey → 보관(수확물, 평균 star)
export type Placed = { id: string; key: string; x: number; y: number };
export type DailyQuest = { id: string; label: string; goal: number; prog: number; reward: number; xp: number; claimed: boolean };
export type IslandState = {
  v: number;
  seed: number;
  rng: number; // 결정적 RNG 카운터
  lastTick: number;
  coins: number;
  level: number;
  xp: number;
  pet: Pet;
  farm: {
    plots: Plot[];
    barn: Barn;
    skillXp: number;
    sprinkler: boolean;
    greenhouse: boolean;
    fert: number; // 일반 비료 보유
    gold: number; // 골드 비료 보유
    craft: CraftSlot[];
    rainDay?: string; // 비 오는 날 자동 급수를 하루 1회로 막는 가드(KST 날짜)
  };
  decor: Placed[];
  sets: string[]; // 완성 세트 id
  catalog: string[]; // 발견한 것들(작물/데코/펫형)
  bond: { level: number; xp: number };
  quest: { date: string; list: DailyQuest[]; chest: boolean };
  streak: { count: number; lastDay: string | null; rewardIdx: number };
  ddayDate: string | null;
  ddayClaimed: number[]; // 받은 마일스톤 일수
  daily: Record<string, string>; // uid → 오늘 출석 날짜
  togetherDate: string | null;
  giftDate: string | null; // 선물 일일캡 기준 날짜
  giftCount: number;
  petDate: string | null; // 쓰다듬기 보상 일일캡 기준 날짜(KST)
  petCount: number;
  wishDay?: string | null; // 오늘의 위시 장식 보상 수령 날짜(KST) — 하루 1회 가드
  pending: { type: string; by: string; at: number; score?: number }[]; // 함께 액션 대기(score=걸어둔 쪽 플레이 점수)
  achievements: string[];
  museum: string[]; // 은퇴한 최종 펫형
  log: string[];
};

// ── 유틸: RNG · 로그 · 복제 ─────────────────────────────────────
function rngNext(s: IslandState): number {
  s.rng = (s.rng + 1) | 0;
  let a = (s.seed ^ (s.rng * 0x9e3779b1)) >>> 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pushLog(s: IslandState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 50);
}
function discover(s: IslandState, key: string) {
  if (!s.catalog.includes(key)) s.catalog.push(key);
}
function clone(s: IslandState): IslandState {
  return {
    ...s,
    pet: { ...s.pet, stats: { ...s.pet.stats }, cd: { ...s.pet.cd } },
    farm: {
      ...s.farm,
      plots: s.farm.plots.map((p) => ({ ...p })),
      barn: Object.fromEntries(Object.entries(s.farm.barn).map(([k, v]) => [k, { ...v }])),
      craft: s.farm.craft.map((c) => ({ ...c })),
    },
    decor: s.decor.map((d) => ({ ...d })),
    sets: [...s.sets],
    catalog: [...s.catalog],
    bond: { ...s.bond },
    quest: { ...s.quest, list: s.quest.list.map((q) => ({ ...q })) },
    streak: { ...s.streak },
    ddayClaimed: [...s.ddayClaimed],
    daily: { ...s.daily },
    pending: s.pending.map((p) => ({ ...p })),
    achievements: [...s.achievements],
    museum: [...s.museum],
    log: [...s.log],
  };
}
export function kstDate(now: number): string {
  return new Date(now + 9 * HOUR).toISOString().slice(0, 10);
}

// ── 파생: 펫 레벨 · 스테이지 · 기분 ─────────────────────────────
/** 누적 케어XP → 레벨(앵커 구간 선형). */
export function petLevel(careXp: number): number {
  const a = TUNING.pet.lvlAnchors;
  if (careXp <= 0) return 1;
  for (let i = 0; i < a.length - 1; i++) {
    const [l0, x0] = a[i];
    const [l1, x1] = a[i + 1];
    if (careXp < x1) return Math.floor(l0 + ((careXp - x0) / (x1 - x0)) * (l1 - l0));
  }
  return a[a.length - 1][0];
}
export const petStage = (form: string): number => petForm(form).stage;

// ── 지연 tick: 감쇠 · 성장 · 가공 · 질병 · 진화대기 ─────────────
/** now 까지 경과분을 상태에 1회 적용(내부). s 는 이미 clone 된 것을 넣는다. */
function tick(s: IslandState, now: number): void {
  // 단조 증가 — 클라 시계가 뒤로 가도 감쇠 기준을 되돌리지 않음(양 기기 desync/이중감쇠 방지) [리뷰 fix]
  const nextTick = Math.max(s.lastTick, now);
  const days = (nextTick - s.lastTick) / DAY_MS;
  s.lastTick = nextTick;

  // ── 경과시간과 무관한 유지보수(멱등) — days=0 이어도 적용 ──
  // 비 오는 날(결정적 날씨) — 하루 1회 전체 밭 자동 급수. 벌이 아니라 선물(상방만).
  const rainDay = kstDate(nextTick);
  if (s.farm.rainDay !== rainDay && weatherOf(s, nextTick) === "rain") {
    s.farm.rainDay = rainDay;
    let anyWatered = false;
    for (const p of s.farm.plots)
      if (p.crop) {
        p.wateredAt = nextTick;
        anyWatered = true;
      }
    if (anyWatered) pushLog(s, "🌧️ 비가 내려 밭이 촉촉해졌어요");
  }
  // 농사 스킬로 공방 조리대 증설(파생) — 저장된 배열은 절대 truncate 하지 않고 패딩만
  while (s.farm.craft.length < craftSlots(s)) s.farm.craft.push({ product: null, startAt: null, star: 0 });

  if (days <= 0) return;

  // 펫 스탯 감쇠(세트 퍽 + 섬 분위기 반영)
  const energyPerk = s.sets.includes("cozy") ? 0.9 : 1;
  // 행복 감쇠 = 바다 세트 퍽 × 섬 분위기 퍽(꾸밀수록 펫이 더 오래 행복) [꾸미기 보상]
  const happyPerk = (s.sets.includes("beach") ? 0.9 : 1) * ambienceHappyPerk(s);
  const st = s.pet.stats;
  const before = { ...st };
  st.hunger = clamp(st.hunger - TUNING.pet.decay.hunger * days, 0, 100);
  st.happy = clamp(st.happy - TUNING.pet.decay.happy * happyPerk * days, 0, 100);
  st.energy = clamp(st.energy - TUNING.pet.decay.energy * energyPerk * days, 0, 100);
  st.clean = clamp(st.clean - TUNING.pet.decay.clean * days, 0, 100);
  // 배고픔 0 → 행복 추가 감소
  if (st.hunger <= 0) st.happy = clamp(st.happy - 20 * days, 0, 100);
  // 방치 카운트: 스탯이 새로 0에 닿음
  for (const k of ["hunger", "happy", "energy", "clean"] as const) {
    if (before[k] > 0 && st[k] <= 0) {
      s.pet.neglect += 1;
      s.pet.cq = clamp(s.pet.cq - TUNING.pet.cq.neglect, 0, 100);
    }
  }
  // 질병 판정(청결/건강 낮으면)
  if (!s.pet.sick && (st.clean < 20 || st.health < 30 || st.hunger <= 0)) {
    if (rngNext(s) < TUNING.pet.sickChancePerDay * Math.min(days, 3)) {
      s.pet.sick = true;
      st.health = Math.min(st.health, 40);
      pushLog(s, `${petForm(s.pet.form).emoji} 아파요… 약이 필요해요 💊`);
    }
  }
  // 비 오는 날 감기 — 방치하지 않아도 가끔 아프다(2026-07-28, "약은 먹을 필요도 없는데" 리포트).
  // 카운터플레이: 비 오는 날 에너지를 35 이상으로(재우기) 유지하면 안 걸림.
  if (!s.pet.sick && weatherOf(s, now) === "rain" && st.energy < 35) {
    if (rngNext(s) < 0.1 * Math.min(days, 2)) {
      s.pet.sick = true;
      st.health = Math.min(st.health, 55);
      pushLog(s, `${petForm(s.pet.form).emoji} 비를 맞았는지 감기 기운… 약이 필요해요 🤒`);
    }
  }
  // 건강 회복/악화
  if (st.clean > 60 && st.hunger > 50 && st.happy > 50 && !s.pet.sick)
    st.health = clamp(st.health + 5 * days, 0, 100);
  else if (st.hunger <= 0 || st.clean <= 0) st.health = clamp(st.health - 15 * days, 0, 100);

  // 작물 성장은 파생(cropStage)이라 tick 불필요. 가공 완료도 파생으로 판단.
  // 진화 대기 플래그
  refreshEvolveFlag(s);
}
function refreshEvolveFlag(s: IslandState): void {
  const lvl = petLevel(s.pet.careXp);
  const stage = petStage(s.pet.form);
  const need = TUNING.pet.evoLevel[(stage + 1) as 1 | 2 | 3 | 4];
  s.pet.pendingEvolve = stage < 4 && need != null && lvl >= need;
}

// ── 생성 ────────────────────────────────────────────────────────
export function createIsland(petName: string, ddayDate: string | null, now: number): IslandState {
  const s: IslandState = {
    v: 1,
    seed: (Math.floor((now % 2 ** 31) + (petName.length + 1) * 2654435761) & 0x7fffffff) || 12345,
    rng: 0,
    lastTick: now,
    coins: TUNING.startCoins,
    level: 1,
    xp: 0,
    pet: {
      form: "egg",
      name: petName || "우리 펫",
      careXp: 0,
      stats: { hunger: 70, happy: 80, energy: 80, clean: 80, health: 100 },
      cq: TUNING.pet.cq.start,
      neglect: 0,
      sick: false,
      cd: {},
      pendingEvolve: false,
    },
    farm: {
      plots: Array.from({ length: TUNING.farm.startPlots }, () => ({
        crop: null,
        plantedAt: null,
        wateredAt: null,
        fert: 0,
      })),
      barn: {},
      skillXp: 0,
      sprinkler: false,
      greenhouse: false,
      fert: 1,
      gold: 0,
      craft: [{ product: null, startAt: null, star: 0 }],
    },
    decor: [],
    sets: [],
    catalog: ["egg"],
    bond: { level: 1, xp: 0 },
    quest: { date: "", list: [], chest: false },
    streak: { count: 0, lastDay: null, rewardIdx: 0 },
    ddayDate,
    ddayClaimed: [],
    daily: {},
    togetherDate: null,
    giftDate: null,
    giftCount: 0,
    petDate: null,
    petCount: 0,
    pending: [],
    achievements: [],
    museum: [],
    log: ["우리 섬이 생겼어요! 🏝️ 알을 함께 돌봐요"],
  };
  return s;
}

// ── 현재 스탯 읽기(감쇠 반영, 비변형) ───────────────────────────
export function petNow(s: IslandState, now: number): { stats: PetStats; level: number; mood: string; stage: number } {
  const c = clone(s);
  tick(c, now);
  const level = petLevel(c.pet.careXp);
  const st = c.pet.stats;
  let mood = "😊";
  if (c.pet.sick) mood = "🤒";
  else if (st.hunger < 25) mood = "😣";
  else if (st.happy < 30) mood = "😢";
  else if (st.energy < 25) mood = "😴";
  else if (st.happy > 70) mood = "😻";
  return { stats: st, level, mood, stage: petStage(c.pet.form) };
}

// ── 내부: XP/레벨/유대/스킬 지급 ────────────────────────────────
function xpMult(s: IslandState): number {
  return s.sets.includes("celestial") ? 1.02 : 1;
}
function addIslandXp(s: IslandState, n: number): void {
  s.xp += Math.round(n * xpMult(s));
  while (s.level < TUNING.island.maxLevel && s.xp >= xpForIslandLevel(s.level + 1)) {
    s.xp -= xpForIslandLevel(s.level + 1);
    s.level += 1;
    pushLog(s, `섬 Lv.${s.level} 달성! 새로운 것이 열렸어요 ✨`);
  }
}
function addBondXp(s: IslandState, n: number): void {
  const m = s.sets.includes("couple") ? 1.1 : 1;
  s.bond.xp += Math.round(n * m * xpMult(s));
  while (s.bond.level < TUNING.bond.maxLevel && s.bond.xp >= xpForBondLevel(s.bond.level + 1)) {
    s.bond.xp -= xpForBondLevel(s.bond.level + 1);
    s.bond.level += 1;
    pushLog(s, `💞 유대 Lv.${s.bond.level}! 커플 전용 콘텐츠가 열렸어요`);
  }
}
export const farmSkill = (skillXp: number): number => {
  let lv = 1;
  while (lv < TUNING.farm.skillMax && skillXp >= skillXpFor(lv + 1)) lv += 1;
  return lv;
};
function addCareXp(s: IslandState, base: number): void {
  const mult = s.pet.sick ? 0.5 : 1;
  s.pet.careXp += Math.round(base * mult);
  addIslandXp(s, Math.round(base * 0.4));
  for (const q of s.quest.list) if (q.id === "care") q.prog = Math.min(q.goal, q.prog + 1);
  refreshEvolveFlag(s);
}
function bumpCQ(s: IslandState, quality: number): void {
  s.pet.cq = clamp(s.pet.cq * TUNING.pet.cq.keep + quality, 0, 100);
}
function cooldownOk(s: IslandState, key: string, cdH: number, now: number): boolean {
  return now - (s.pet.cd[key] ?? 0) >= cdH * HOUR;
}

// ── 펫 액션 ─────────────────────────────────────────────────────
export function feedPet(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.pet.action.feed;
  if (s.coins < a.cost || !cooldownOk(s, "feed", a.cdH, now)) return s0;
  const st = s.pet.stats;
  const perfect = st.hunger < 40;
  s.coins -= a.cost;
  st.hunger = clamp(st.hunger + a.hunger, 0, 100);
  s.pet.cd.feed = now;
  bumpCQ(s, perfect ? TUNING.pet.cq.perfect : TUNING.pet.cq.routine);
  addCareXp(s, a.xp);
  pushLog(s, `${petForm(s.pet.form).emoji} 밥을 줬어요 🍚`);
  return s;
}
/** 창고의 직접 키운 작물로 밥주기 — 무료, 포만/행복 크게 + ★보너스(작물의 존재 이유). feed 쿨다운 공유. */
export function feedPetWith(s0: IslandState, cropKey: string, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.pet.action.feed;
  const cf = TUNING.pet.cropFeed;
  const b = s.farm.barn[cropKey];
  if (!b || b.qty <= 0) return s0;
  if (!cooldownOk(s, "feed", a.cdH, now)) return s0;
  const st = s.pet.stats;
  const perfect = st.hunger < 40;
  const star = clamp(b.star, 1, 5);
  // 창고에서 1개 소비
  b.qty -= 1;
  if (b.qty <= 0) delete s.farm.barn[cropKey];
  else s.farm.barn[cropKey] = b;
  st.hunger = clamp(st.hunger + cf.hunger, 0, 100);
  st.happy = clamp(st.happy + cf.happyBase + cf.happyPerStar * star, 0, 100);
  s.pet.cd.feed = now;
  bumpCQ(s, perfect ? TUNING.pet.cq.perfect : TUNING.pet.cq.routine);
  addCareXp(s, a.xp + cf.xpBonus);
  const c = cropOf(cropKey as CropKey);
  pushLog(s, `${petForm(s.pet.form).emoji} 직접 키운 ${c.name}${c.emoji}을(를) 맛있게 먹었어요`);
  return s;
}
/** 쓰다듬기 보상 — 캐릭터 터치(게이지 충전) 시 애정 + 일일캡 코인/유대(캐릭터를 만질 이유). */
export function petPet(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const p = TUNING.pet.petting;
  const day = kstDate(now);
  if (s.petDate !== day) {
    s.petDate = day;
    s.petCount = 0;
  }
  const underCap = s.petCount < p.capDay;
  const st = s.pet.stats;
  // 캡을 넘고 행복도 이미 가득이면 완전 무의미 → 커밋 안 함(헛된 버전 증가 방지)
  if (!underCap && st.happy >= 100) return s0;
  st.happy = clamp(st.happy + p.happy, 0, 100);
  if (underCap) {
    s.petCount += 1;
    s.coins += p.coins;
    addCareXp(s, p.xp);
    addBondXp(s, p.bond);
    pushLog(s, `${petForm(s.pet.form).emoji} 쓰다듬어 줬어요 — +${p.coins}💗`);
  }
  return s;
}
/** UI: 지금 쓰다듬으면 받을 코인(일일캡 소진 시 0). */
export function pettingCoinsNext(s: IslandState, now: number): number {
  const count = s.petDate === kstDate(now) ? s.petCount : 0;
  return count < TUNING.pet.petting.capDay ? TUNING.pet.petting.coins : 0;
}
export function cleanPet(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.pet.action.clean;
  if (!cooldownOk(s, "clean", a.cdH, now)) return s0;
  const perfect = s.pet.stats.clean < 40;
  s.pet.stats.clean = clamp(s.pet.stats.clean + a.clean, 0, 100);
  s.pet.cd.clean = now;
  bumpCQ(s, perfect ? TUNING.pet.cq.perfect : TUNING.pet.cq.routine);
  addCareXp(s, a.xp);
  pushLog(s, `${petForm(s.pet.form).emoji} 깨끗이 씻겼어요 🛁`);
  return s;
}
export function playPet(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.pet.action.play;
  if (!cooldownOk(s, "play", a.cdH, now) || s.pet.stats.energy < 15) return s0;
  s.pet.stats.happy = clamp(s.pet.stats.happy + a.happy, 0, 100);
  s.pet.stats.energy = clamp(s.pet.stats.energy + a.energy, 0, 100);
  s.pet.cd.play = now;
  bumpCQ(s, TUNING.pet.cq.routine);
  addCareXp(s, a.xp);
  pushLog(s, `${petForm(s.pet.form).emoji} 신나게 놀았어요 🎾`);
  return s;
}
export function hugPet(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.pet.action.hug;
  if (!cooldownOk(s, "hug", a.cdH, now)) return s0;
  s.pet.stats.happy = clamp(s.pet.stats.happy + a.happy, 0, 100);
  s.pet.cd.hug = now;
  bumpCQ(s, TUNING.pet.cq.routine);
  addCareXp(s, a.xp);
  pushLog(s, `${petForm(s.pet.form).emoji} 꼭 안아줬어요 🤗`);
  return s;
}
export function restPet(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.pet.action.rest;
  if (!cooldownOk(s, "rest", a.cdH, now)) return s0;
  s.pet.stats.energy = clamp(s.pet.stats.energy + a.energy, 0, 100);
  s.pet.cd.rest = now;
  s.pet.sleepUntil = now + a.sleepH * HOUR; // 실제로 잠든다(상대 화면에서도 쿨쿨)
  addCareXp(s, a.xp);
  pushLog(s, `${petForm(s.pet.form).emoji} 쿨쿨 잠들었어요 💤`);
  return s;
}
/** 자는 중인지(파생 — sleepUntil 경과 시 자동 기상, 별도 tick 불필요). */
export const isAsleep = (s: IslandState, now: number): boolean => (s.pet.sleepUntil ?? 0) > now;
/** 자는 펫을 깨우기 — 벌 없음(놀라서 일어나는 모션은 UI 담당). */
export function wakePet(s0: IslandState, now: number): IslandState {
  if (!isAsleep(s0, now)) return s0;
  const s = clone(s0);
  tick(s, now);
  s.pet.sleepUntil = undefined; // JSON 직렬화에서 사라짐(마이그레이션 불필요)
  pushLog(s, `${petForm(s.pet.form).emoji} 화들짝! 기지개를 켜며 일어났어요 ⏰`);
  return s;
}
export function medicinePet(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.pet.action.medicine;
  if (s.coins < a.cost || (!s.pet.sick && s.pet.stats.health >= 100)) return s0;
  s.coins -= a.cost;
  s.pet.stats.health = clamp(s.pet.stats.health + a.health, 0, 100);
  s.pet.sick = false;
  bumpCQ(s, TUNING.pet.cq.perfect);
  addCareXp(s, a.xp);
  pushLog(s, `${petForm(s.pet.form).emoji} 약을 먹고 나았어요 💊`);
  return s;
}

/** 진화 확정(대기 상태일 때) — 축하 순간. 최종형은 박물관 은퇴+새 알(선택은 UI). */
export function evolve(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  if (!s.pet.pendingEvolve) return s0;
  const next = nextEvolution(s.pet.form, s.pet.cq, s.bond.level, s.pet.neglect);
  if (!next) return s0;
  const from = petForm(s.pet.form);
  s.pet.form = next;
  s.pet.pendingEvolve = false;
  discover(s, next);
  addIslandXp(s, 40);
  addBondXp(s, 10);
  const nf = petForm(next);
  pushLog(s, `${from.emoji}→${nf.emoji} ${nf.name}(으)로 진화했어요! 🎉`);
  if (nf.stage === 4) unlockAch(s, `pet_${next}`);
  refreshEvolveFlag(s);
  return s;
}
/** 최종형 펫을 박물관에 은퇴시키고 새 알로 시작(컬렉션 반복). */
export function retirePet(s0: IslandState, newName: string, now: number): IslandState {
  const s = clone(s0);
  if (petStage(s.pet.form) !== 4) return s0;
  if (!s.museum.includes(s.pet.form)) s.museum.push(s.pet.form);
  pushLog(s, `${petForm(s.pet.form).emoji} ${petForm(s.pet.form).name}가 박물관에 전시됐어요 🏛️`);
  s.pet = {
    form: "egg",
    name: newName || "새 친구",
    careXp: 0,
    stats: { hunger: 70, happy: 80, energy: 80, clean: 80, health: 100 },
    cq: TUNING.pet.cq.start,
    neglect: 0,
    sick: false,
    cd: {},
    pendingEvolve: false,
  };
  s.lastTick = now;
  return s;
}

// ── 함께(coop) 액션 — 두 사람 필요 ──────────────────────────────
// [2026-07-28 업그레이드] '터치 한 번'에서 → 양쪽이 각자 플레이 세션(하트 탭)을 하고
// 점수 합으로 보너스가 스케일되는 구조. 걸어둔 쪽 점수는 pending.score 에 저장.
// ⚠ 하위호환: score 인자/필드가 없으면 0 — 옛 클라이언트·옛 저장본 그대로 동작(보상 = 기존 base).
/** coop 놀이 시작(내가 걸어두면 상대가 확인). 이미 대기 있으면 무시. score=내 플레이 점수. */
export function coopStart(s0: IslandState, uid: string, now: number, score = 0): IslandState {
  const s = clone(s0);
  s.pending = s.pending.filter((p) => now - p.at < DAY_MS); // 만료 먼저 정리(stale coop 소프트락 방지) [리뷰 fix]
  if (s.pending.some((p) => p.type === "coop")) return s0;
  const sc = clamp(Math.round(score), 0, 99);
  s.pending.push({ type: "coop", by: uid, at: now, score: sc });
  pushLog(s, sc > 0 ? `💞 함께 놀기를 걸어뒀어요 — 마음 ${sc}💗 담김` : "💞 함께 놀기를 걸어뒀어요 — 상대가 오면 완성돼요");
  return s;
}
/** 상대가 coop 확인 → 완성. base 보상 + 두 사람 점수 합 비례 보너스(유대/행복, 상한 캡). */
export function coopConfirm(s0: IslandState, uid: string, now: number, score = 0): IslandState {
  const s = clone(s0);
  tick(s, now);
  const idx = s.pending.findIndex((p) => p.type === "coop" && p.by !== uid);
  if (idx < 0) return s0;
  const a = TUNING.pet.coop;
  const combined = clamp(Math.round((s.pending[idx].score ?? 0) + score), 0, 198);
  const ratio = Math.min(1, combined / a.scoreForMax);
  s.pending.splice(idx, 1);
  s.pet.stats.happy = clamp(s.pet.stats.happy + a.happy + Math.round(a.bonusHappyMax * ratio), 0, 100);
  bumpCQ(s, TUNING.pet.cq.perfect);
  addCareXp(s, a.xp * 2);
  addBondXp(s, a.bondXp + Math.round(a.bonusBondMax * ratio));
  pushLog(
    s,
    combined > 0 ? `💞 함께 놀았어요! 둘의 호흡 ${combined}💗 — 유대가 깊어졌어요` : `💞 함께 놀았어요! 유대가 깊어졌어요`,
  );
  return s;
}

// ── 정원 ────────────────────────────────────────────────────────
export const plotsUnlocked = (s: IslandState): number => s.farm.plots.length;
/** 작물 성장 상태(파생). 물/계절/온실 반영. */
/** 비료 품질 합산 — 일반 누적(체감보상 18/12/8) + 골드(+40). plot.fert 의 단일 정의. */
export const fertQuality = (stack: number, gold: boolean): number =>
  TUNING.farm.quality.fertStep.slice(0, Math.max(0, stack)).reduce((a, b) => a + b, 0) +
  (gold ? TUNING.farm.quality.fertGold : 0);

/** 공방 조리대 수 — 농사 스킬 파생(1 / Lv.8+ 2 / Lv.14+ 3). */
export const craftSlots = (s: IslandState): number => {
  const sk = farmSkill(s.farm.skillXp);
  return 1 + (sk >= 8 ? 1 : 0) + (sk >= 14 ? 1 : 0);
};

/* ── 날씨(결정적) ─────────────────────────────────────────────
 * seed+KST날짜 순수 해시 — 렌더에서 몇 번을 불러도, 어느 쪽이 먼저 커밋해도 같은 값.
 * ⚠ rngNext 금지: 카운터를 증가시켜 커밋 순서에 따라 양 클라가 갈린다. */
export function dayHash(seed: number, day: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
export type Weather = "clear" | "rain" | "wind" | "rainbow";
/** 오늘의 섬 날씨 — 비 22%(전 밭 자동급수) · 바람 14%(시각) · 무지개 5%(수확 품질 +12). */
export function weatherOf(s: IslandState, now: number): Weather {
  const r = dayHash(s.seed, kstDate(now)) % 100;
  return r < 22 ? "rain" : r < 36 ? "wind" : r < 41 ? "rainbow" : "clear";
}
export const WEATHER_LABEL: Record<Weather, string | null> = {
  clear: null,
  rain: "🌧️ 오늘은 비 — 물주기가 공짜예요",
  wind: "🍃 바람 부는 날 — 작물이 살랑살랑",
  rainbow: "🌈 무지개 뜬 날 — 오늘 수확 품질 +12",
};

/* ── 품질 점수(단일 소스) ─────────────────────────────────────
 * 미리보기(UI)와 harvest 가 **같은 함수**를 쓴다 — 구조적으로 갈라질 수 없다. */
export type ScorePart = { key: string; label: string; val: number };
export function scoreParts(s: IslandState, plot: Plot, now: number): ScorePart[] {
  if (!plot.crop) return [];
  const c = cropOf(plot.crop);
  const q = TUNING.farm.quality;
  const inSeason = s.farm.greenhouse || c.season === seasonOf(now);
  const watered = s.farm.sprinkler || (plot.wateredAt != null && now - plot.wateredAt < DAY_MS);
  const skill = farmSkill(s.farm.skillXp);
  return [
    { key: "base", label: "기본", val: q.base },
    { key: "skill", label: `농사 Lv.${skill}`, val: skill * q.perSkill },
    { key: "water", label: "물", val: watered ? q.watered : 0 },
    { key: "season", label: "제철", val: inSeason ? q.inSeason : 0 },
    { key: "fert", label: "비료", val: plot.fert ?? 0 },
    { key: "lucky", label: "행운의 두둑", val: (plot.lucky ?? false) ? TUNING.farm.luckyScore : 0 },
    { key: "rainbow", label: "무지개", val: weatherOf(s, now) === "rainbow" ? q.rainbow : 0 },
  ].filter((p) => p.val !== 0 || p.key === "fert"); // 비료 0 은 '여기를 채워라'로 항상 노출
}
/** 점수 → ★ 등급(임계 [45,70,90,110]). */
export function starOf(score: number): number {
  const cut = TUNING.farm.starCut;
  let st = 1;
  for (let i = 0; i < cut.length; i++) if (score >= cut[i]) st = i + 2;
  return st;
}
/** ★ 예상 밴드 — **rng 를 굴리지 않는다**(렌더 경로·양 클라 동일값 필수). null=빈 밭. */
export function qualityPreview(
  s: IslandState,
  plotId: number,
  now: number,
): {
  parts: ScorePart[];
  score: number;
  starMin: number;
  starMax: number;
  nextCut: number | null; // 다음 ★ 임계(없으면 최고 구간)
  gap: number; // 다음 임계까지 부족 점수
  fertGain: number; // 다음 비료 1개의 기여(코치 문구용)
  star5Locked: boolean; // ★5 게이트(스킬12/골드/비료3) 미충족
} | null {
  const plot = s.farm.plots[plotId];
  if (!plot || !plot.crop) return null;
  const parts = scoreParts(s, plot, now);
  const score = parts.reduce((a, p) => a + p.val, 0);
  const q = TUNING.farm.quality;
  const stack = plot.fertStack ?? 0;
  const nextCut = TUNING.farm.starCut.find((c) => c > score) ?? null;
  const skill = farmSkill(s.farm.skillXp);
  return {
    parts,
    score,
    starMin: starOf(score),
    starMax: starOf(score + q.rngMax - 1),
    nextCut,
    gap: nextCut != null ? nextCut - score : 0,
    fertGain: stack < TUNING.farm.fertStackMax ? (q.fertStep[stack] ?? 0) : 0,
    star5Locked:
      skill < TUNING.farm.star5MinSkill && !(plot.gold ?? false) && stack < TUNING.farm.fertStackMax,
  };
}

export function cropStage(
  s: IslandState,
  plot: Plot,
  now: number,
): { planted: boolean; ripe: boolean; progress: number } {
  if (!plot.crop || plot.plantedAt == null) return { planted: false, ripe: false, progress: 0 };
  const c = cropOf(plot.crop);
  const season = seasonOf(now);
  const inSeason = s.farm.greenhouse || c.season === season;
  const skill = farmSkill(s.farm.skillXp);
  const skillSpeed = skill >= 15 ? 0.85 : 1;
  let base = c.growDays * DAY_MS * skillSpeed * (inSeason ? 1 : 1 / TUNING.farm.offSeasonSpeed);
  // 물주기: 마지막 물이 24h 내면 성장 가속(스프링클러는 항상)
  const watered = s.farm.sprinkler || (plot.wateredAt != null && now - plot.wateredAt < DAY_MS);
  if (watered) base /= TUNING.farm.waterSpeed;
  // 비료 성장 가속 — 누르는 순간 진행 막대가 눈앞에서 전진(보이는 보상)
  const boost = (plot.gold ?? false)
    ? TUNING.farm.goldSpeed
    : Math.min(TUNING.farm.speedCap, (plot.fertStack ?? 0) * TUNING.farm.fertSpeedPerStack);
  if (boost > 0) base *= 1 - boost;
  const progress = clamp((now - plot.plantedAt) / base, 0, 1);
  return { planted: true, ripe: progress >= 1, progress };
}
export function plant(s0: IslandState, plotId: number, crop: CropKey, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const plot = s.farm.plots[plotId];
  if (!plot || plot.crop) return s0;
  const c = cropOf(crop);
  if (s.coins < c.seed) return s0;
  s.coins -= c.seed;
  // 행운의 두둑(8%) — 롤은 **코인 차감 뒤**: 거부된 심기가 공유 rng 카운터를 소비하면 양 클라가 어긋난다
  const lucky = rngNext(s) < TUNING.farm.luckyChance;
  s.farm.plots[plotId] = {
    crop,
    plantedAt: now,
    wateredAt: now,
    // 미리 갈아둔 비료는 보존(구: fert 0 리셋 — '빈 밭 갈아두기'를 파괴하던 버그)
    fert: plot.fert ?? 0,
    fertStack: plot.fertStack ?? 0,
    gold: plot.gold ?? false,
    lucky,
  };
  discover(s, `crop_${crop}`);
  pushLog(s, lucky ? `${c.emoji} 행운의 두둑! 뭔가 특별한 게 자랄 것 같아요 🍀` : `${c.emoji} ${c.name} 심었어요`);
  questProgress(s, "plant", 1);
  return s;
}
export function waterPlot(s0: IslandState, plotId: number, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const plot = s.farm.plots[plotId];
  if (!plot || !plot.crop) return s0;
  plot.wateredAt = now;
  questProgress(s, "water", 1);
  return s;
}
/** 비료 — 누적(1~3단계, 체감보상 18/12/8) + 성장 가속. 빈 밭에도 미리 갈아둘 수 있다.
 *  골드비료는 밭당 1회(+40, 가속 20%). ★5 게이트는 harvest 에서 '비료 3단계'로도 열린다. */
export function fertilize(s0: IslandState, plotId: number, gold: boolean, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const plot = s.farm.plots[plotId];
  if (!plot) return s0;
  if (gold) {
    if (s.farm.gold <= 0 || (plot.gold ?? false)) return s0;
    s.farm.gold -= 1;
    plot.gold = true;
  } else {
    if (s.farm.fert <= 0 || (plot.fertStack ?? 0) >= TUNING.farm.fertStackMax) return s0;
    s.farm.fert -= 1;
    plot.fertStack = (plot.fertStack ?? 0) + 1;
  }
  plot.fert = fertQuality(plot.fertStack ?? 0, plot.gold ?? false);
  questProgress(s, "fert", 1);
  const n = plot.fertStack ?? 0;
  pushLog(
    s,
    gold
      ? `✨ 골드비료! 품질 +${TUNING.farm.quality.fertGold} · 성장 ${Math.round(TUNING.farm.goldSpeed * 100)}% 가속`
      : `💩 비료 ${n}단계 · 품질 +${plot.fert} · 성장 ${Math.round(Math.min(TUNING.farm.speedCap, n * TUNING.farm.fertSpeedPerStack) * 100)}% 가속`,
  );
  return s;
}
/** 수확 — 품질 롤(★1~5) → 창고 보관 + 코인 + 스킬/섬 XP. */
export function harvest(s0: IslandState, plotId: number, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const plot = s.farm.plots[plotId];
  if (!plot || !plot.crop || !cropStage(s, plot, now).ripe) return s0;
  const c = cropOf(plot.crop);
  const season = seasonOf(now);
  const inSeason = s.farm.greenhouse || c.season === season;
  const skill = farmSkill(s.farm.skillXp);
  const q = TUNING.farm.quality;
  // 품질 = 단일 소스(scoreParts — 미리보기와 동일 함수) + 운(rngMax)
  const score = scoreParts(s, plot, now).reduce((a, p) => a + p.val, 0) + Math.floor(rngNext(s) * q.rngMax);
  let star = starOf(score);
  // ★5 게이트 — 스킬 12 **또는** 골드비료/비료 3단계의 정성으로도 열린다
  const star5Ok =
    skill >= TUNING.farm.star5MinSkill || (plot.gold ?? false) || (plot.fertStack ?? 0) >= TUNING.farm.fertStackMax;
  if (star >= 5 && !star5Ok) star = 4;
  const mult = TUNING.farm.starMult[star];
  const coins = Math.round(c.sell * mult * (inSeason ? 1 : TUNING.farm.offSeasonYield));
  s.coins += coins;
  // 창고 보관(가공용) — 평균 star
  const b = s.farm.barn[c.key] ?? { qty: 0, star: 0 };
  b.star = Math.round((b.star * b.qty + star) / (b.qty + 1));
  b.qty += 1;
  s.farm.barn[c.key] = b;
  // 밭 리셋 — 비료는 작물이 아니라 **땅에 대한 투자**: 1단계만 소모, 나머지는 잔존
  const carry = Math.max(0, (plot.fertStack ?? 0) - 1);
  s.farm.plots[plotId] = {
    crop: null,
    plantedAt: null,
    wateredAt: null,
    fert: fertQuality(carry, false),
    fertStack: carry,
    gold: false,
    lucky: false,
  };
  s.farm.skillXp += c.sell * star;
  addIslandXp(s, 4 + star);
  discover(s, `star${star}_${c.key}`);
  const stars = "⭐".repeat(star);
  pushLog(s, `${c.emoji} ${c.name} 수확! ${stars} +${coins}💗`);
  questProgress(s, "harvest", 1);
  if (star >= 5) unlockAch(s, "star5");
  return s;
}
/** 밭 확장(+2칸). */
export function expandPlots(s0: IslandState): IslandState {
  const s = clone(s0);
  const batch = Math.floor((s.farm.plots.length - TUNING.farm.startPlots) / 2);
  const cost = TUNING.farm.plotBatches[batch];
  if (cost == null || s.farm.plots.length >= 24 || s.coins < cost) return s0;
  s.coins -= cost;
  s.farm.plots.push({ crop: null, plantedAt: null, wateredAt: null, fert: 0 }, { crop: null, plantedAt: null, wateredAt: null, fert: 0 });
  pushLog(s, `밭을 넓혔어요 (${s.farm.plots.length}칸) 🌱`);
  return s;
}

// ── 워크숍(가공) ────────────────────────────────────────────────
export function craftReady(slot: CraftSlot, now: number): boolean {
  if (!slot.product || slot.startAt == null) return false;
  return now - slot.startAt >= productOf(slot.product).days * DAY_MS;
}
export function startCraft(s0: IslandState, slotId: number, product: ProductKey, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const slot = s.farm.craft[slotId];
  const p = productOf(product);
  // 게이트 = 농사 스킬(farmSkill) — 밭을 일군 노력이 곧 공방 자격. (collectCraft 엔 게이트 없음 유지)
  if (!slot || slot.product || farmSkill(s.farm.skillXp) < p.minSkill) return s0;
  // 재료 확인/차감
  let starSum = 0;
  let starN = 0;
  for (const [ck, need] of Object.entries(p.recipe)) {
    const b = s.farm.barn[ck];
    if (!b || b.qty < (need as number)) return s0;
  }
  for (const [ck, need] of Object.entries(p.recipe)) {
    const b = s.farm.barn[ck]!;
    b.qty -= need as number;
    starSum += b.star * (need as number);
    starN += need as number;
    if (b.qty <= 0) delete s.farm.barn[ck];
  }
  s.farm.craft[slotId] = { product, startAt: now, star: Math.max(1, Math.round(starSum / Math.max(1, starN))) };
  pushLog(s, `${p.emoji} ${p.name} 만들기 시작 (${p.days < 1 ? Math.round(p.days * 24) + "시간" : p.days + "일"})`);
  return s;
}
export function collectCraft(s0: IslandState, slotId: number, now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const slot = s.farm.craft[slotId];
  if (!slot || !craftReady(slot, now)) return s0;
  const p = productOf(slot.product!);
  const mult = TUNING.farm.starMult[clamp(slot.star, 1, 5)];
  const coins = Math.round(p.sell * (0.6 + 0.4 * mult) / 1.0);
  s.coins += coins;
  s.farm.craft[slotId] = { product: null, startAt: null, star: 0 };
  addIslandXp(s, 8);
  discover(s, `product_${p.key}`);
  pushLog(s, `${p.emoji} ${p.name} 완성! +${coins}💗`);
  questProgress(s, "craft", 1);
  return s;
}

// ── 도구 구매 ───────────────────────────────────────────────────
export function buyTool(s0: IslandState, tool: "sprinkler" | "greenhouse", now: number): IslandState {
  const s = clone(s0);
  tick(s, now);
  const cost = tool === "sprinkler" ? TUNING.farm.sprinkler : TUNING.farm.greenhouse;
  if (s.farm[tool] || s.coins < cost) return s0;
  s.coins -= cost;
  s.farm[tool] = true;
  pushLog(s, `${tool === "sprinkler" ? "💧 스프링클러" : "🏡 온실"} 설치! 편해졌어요`);
  return s;
}
export function buyFertilizer(s0: IslandState, gold: boolean): IslandState {
  const s = clone(s0);
  const cost = gold ? TUNING.farm.goldFertilizer : TUNING.farm.fertilizer;
  if (s.coins < cost) return s0;
  s.coins -= cost;
  if (gold) s.farm.gold += 1;
  else s.farm.fert += 1;
  return s;
}

// ── 꾸미기 ──────────────────────────────────────────────────────
export function placeDecor(s0: IslandState, key: string, x: number, y: number, now: number): IslandState {
  const s = clone(s0);
  const d = decorDef(key);
  if (!d || s.level < d.minLevel) return s0;
  if (d.set === "couple" && s.bond.level < 3) return s0; // 커플셋은 유대 게이트
  const price = RARITY_PRICE[d.rarity];
  if (s.coins < price) return s0;
  if (x < 0 || x >= DECOR_COLS || y < 0 || y >= DECOR_ROWS) return s0;
  if (s.decor.some((it) => it.x === x && it.y === y)) return s0;
  tick(s, now); // 배치 직전까지 감쇠 반영(즉시 행복 보너스가 정확한 시점에 얹히도록)
  s.coins -= price;
  s.decor.push({ id: `d${now}-${s.decor.length}`, key, x, y });
  discover(s, `decor_${key}`);
  addIslandXp(s, 5);
  recomputeSets(s);
  // 펫이 새 장식을 좋아해요 — 꾸미기에 즉각적인 보람 [꾸미기 재미]
  s.pet.stats.happy = clamp(s.pet.stats.happy + TUNING.island.decorJoy, 0, 100);
  pushLog(s, `${d.emoji} ${d.name} 배치 🌸 (펫이 좋아해요!)`);
  return s;
}
// ── 오늘의 위시 장식 — 펫이 매일 다른 장식을 갖고 싶어한다 [2026-07-28 꾸미기 재미] ──
// dayHash 결정적(양 클라 동일·재렌더 무관). 후보는 지금 배치 가능한 장식만(레벨/유대 게이트 통과)
// — 레벨업으로 후보가 넓어지면 그날 위시가 바뀔 수 있는데, '새 소원'으로 자연스럽다.
export function decorWishKey(s: IslandState, now: number): string {
  const pool = DECORS.filter(
    (d) => s.level >= d.minLevel && !(d.set === "couple" && s.bond.level < 3),
  );
  if (pool.length === 0) return DECORS[0].key;
  return pool[dayHash(s.seed, `${kstDate(now)}|wish`) % pool.length].key;
}
/** 오늘 위시 보상을 받을 수 있나 — 위시 장식이 섬에 배치돼 있고 오늘 아직 안 받음. */
export function decorWishClaimable(s: IslandState, now: number): boolean {
  return s.decor.some((d) => d.key === decorWishKey(s, now)) && s.wishDay !== kstDate(now);
}
/** 위시 성취 — 코인+행복+XP(하루 1회). 배치 안 돼 있으면 no-op. */
export function claimDecorWish(s0: IslandState, now: number): IslandState {
  if (!decorWishClaimable(s0, now)) return s0;
  const s = clone(s0);
  tick(s, now);
  const a = TUNING.island.wish;
  const d = decorDef(decorWishKey(s, now));
  s.wishDay = kstDate(now);
  s.coins += a.coins;
  s.pet.stats.happy = clamp(s.pet.stats.happy + a.happy, 0, 100);
  addCareXp(s, a.xp);
  pushLog(s, `${d.emoji} 오늘의 위시 '${d.name}' 성취! ${petForm(s.pet.form).emoji} 가 폴짝폴짝 🎁 +${a.coins}💗`);
  return s;
}

/** 데코 재배치 — 비용 없음(꾸미기 실험을 부담 없게). 대상 칸이 차 있으면 no-op. */
export function moveDecor(s0: IslandState, id: string, x: number, y: number): IslandState {
  const s = clone(s0);
  const it = s.decor.find((d) => d.id === id);
  if (!it) return s0;
  if (x < 0 || x >= DECOR_COLS || y < 0 || y >= DECOR_ROWS) return s0;
  if (it.x === x && it.y === y) return s0;
  if (s.decor.some((d) => d.x === x && d.y === y)) return s0;
  it.x = x;
  it.y = y;
  pushLog(s, `${decorDef(it.key).emoji} ${decorDef(it.key).name} 위치를 옮겼어요 ↔`);
  return s;
}
export function removeDecor(s0: IslandState, id: string): IslandState {
  const s = clone(s0);
  const it = s.decor.find((d) => d.id === id);
  if (!it) return s0;
  s.coins += Math.floor(RARITY_PRICE[decorDef(it.key).rarity] * 0.5);
  s.decor = s.decor.filter((d) => d.id !== id);
  recomputeSets(s);
  return s;
}
function recomputeSets(s: IslandState): void {
  for (const set of DECOR_SETS) {
    const needed = DECORS.filter((d) => d.set === set.id).map((d) => d.key);
    const have = new Set(s.decor.map((d) => d.key));
    const complete = needed.every((k) => have.has(k));
    if (complete && !s.sets.includes(set.id)) {
      s.sets.push(set.id);
      pushLog(s, `${set.emoji} '${set.name}' 세트 완성! ${set.perk} 🎁`);
      unlockAch(s, `set_${set.id}`);
    } else if (!complete && s.sets.includes(set.id)) {
      s.sets = s.sets.filter((x) => x !== set.id);
    }
  }
}
/** 섬 평점 = 데코 rating + 세트 보너스 + 펫 스테이지 + 박물관. */
export function islandRating(s: IslandState): number {
  let r = 0;
  for (const it of s.decor) r += RARITY_RATING[decorDef(it.key).rarity];
  for (const setId of s.sets) r += DECOR_SETS.find((x) => x.id === setId)?.bonusRating ?? 0;
  r += petStage(s.pet.form) * 20;
  r += s.museum.length * 15;
  return r;
}
/** 섬 분위기 0~1 — 평점이 ambienceRatingFull 에 가까울수록 1. 꾸미기의 실질 효과 원천. */
export function ambience(s: IslandState): number {
  return clamp(islandRating(s) / TUNING.island.ambienceRatingFull, 0, 1);
}
/** 분위기가 좋을수록 펫 행복 감쇠를 완화하는 계수(≤1). */
function ambienceHappyPerk(s: IslandState): number {
  return 1 - ambience(s) * TUNING.island.ambienceMaxPerk;
}
/** 분위기로 줄어든 행복 감쇠 비율(%) — UI 표시용. */
export function ambienceHappyBonusPct(s: IslandState): number {
  return Math.round(ambience(s) * TUNING.island.ambienceMaxPerk * 100);
}
export function ratingTier(r: number): { key: string; label: string; emoji: string } {
  const t = TUNING.island.ratingTiers;
  if (r >= t.royal) return { key: "royal", label: "로열", emoji: "👑" };
  if (r >= t.diamond) return { key: "diamond", label: "다이아", emoji: "💎" };
  if (r >= t.gold) return { key: "gold", label: "골드", emoji: "🥇" };
  if (r >= t.silver) return { key: "silver", label: "실버", emoji: "🥈" };
  return { key: "bronze", label: "브론즈", emoji: "🥉" };
}

// ── 코인: 출석·함께·D-day·외부 ──────────────────────────────────
export function claimVisit(
  s0: IslandState,
  uid: string,
  now: number,
  ddayDate?: string | null,
): IslandState {
  let s = clone(s0);
  tick(s, now);
  // 기념일(D-day)을 라이브 커플 start_date 로 재동기화(생성 후 설정/변경 반영) [리뷰 fix]
  if (ddayDate && s.ddayDate !== ddayDate) s.ddayDate = ddayDate;
  const today = kstDate(now);
  // 출석
  if (s.daily[uid] !== today) {
    s.daily[uid] = today;
    s.coins += TUNING.visit.daily;
    // 로그인 스트릭
    if (s.streak.lastDay) {
      const gapH = (now - Date.parse(s.streak.lastDay + "T00:00:00+09:00")) / HOUR;
      if (gapH <= TUNING.streak.graceH + 24 && s.streak.lastDay !== today) s.streak.count += 1;
      else if (gapH > TUNING.streak.graceH + 24) s.streak.count = 1;
    } else s.streak.count = 1;
    if (s.streak.lastDay !== today) {
      s.streak.lastDay = today;
      const reward = TUNING.streak.cycle[(s.streak.count - 1) % TUNING.streak.cycle.length];
      s.coins += reward;
      pushLog(s, `출석 ${s.streak.count}일차 +${TUNING.visit.daily + reward}💗 🔥`);
    }
  }
  // 함께 보너스
  const both = Object.values(s.daily).filter((d) => d === today).length >= 2;
  if (both && s.togetherDate !== today) {
    s.togetherDate = today;
    s.coins += TUNING.visit.together;
    addBondXp(s, TUNING.bond.xp.bothLogin);
    pushLog(s, `오늘 둘 다 왔어요! +${TUNING.visit.together}💗 💞`);
  }
  // D-day 마일스톤
  s = applyDday(s, now);
  // 오늘 퀘스트 갱신
  ensureQuests(s, now);
  return s;
}
function applyDday(s: IslandState, now: number): IslandState {
  if (!s.ddayDate) return s;
  const days = Math.floor((now - Date.parse(s.ddayDate + "T00:00:00+09:00")) / DAY_MS) + 1;
  for (let d = 100; d <= days; d += 100) {
    if (!s.ddayClaimed.includes(d)) {
      s.ddayClaimed.push(d);
      s.coins += TUNING.dday.per100;
      addBondXp(s, TUNING.bond.xp.dday);
      pushLog(s, `💗 함께한 지 ${d}일! 기념 +${TUNING.dday.per100}💗 & 유대 보너스`);
      if (d === 365) unlockAch(s, "dday_year");
    }
  }
  return s;
}
export function earnCoins(s0: IslandState, amount: number, reason: string): IslandState {
  if (amount <= 0) return s0;
  const s = clone(s0);
  s.coins += amount;
  addIslandXp(s, Math.round(amount * 0.2));
  pushLog(s, `${reason} +${amount}💗`);
  return s;
}

// ── 선물(gift) — 상대에게 코인 선물, 유대 XP ────────────────────
export function giftPartner(s0: IslandState, now: number): IslandState {
  const s = clone(s0);
  const today = kstDate(now);
  if (s.giftDate !== today) {
    s.giftDate = today;
    s.giftCount = 0;
  }
  if (s.giftCount >= TUNING.bond.giftCapDay) return s0; // 하루 캡 [리뷰 fix]
  s.giftCount += 1;
  // 공유 지갑이라 코인 이동은 없고 유대 XP + 로그(마음 표현)
  addBondXp(s, TUNING.bond.xp.gift);
  discover(s, "gift");
  pushLog(s, `🎁 상대에게 마음을 전했어요 (유대 +${TUNING.bond.xp.gift})`);
  return s;
}

// ── 일일 퀘스트 ─────────────────────────────────────────────────
const QUEST_POOL: { id: string; label: string; goal: number; reward: number; xp: number }[] = [
  { id: "harvest", label: "작물 3개 수확", goal: 3, reward: 40, xp: 30 },
  { id: "plant", label: "씨앗 3개 심기", goal: 3, reward: 30, xp: 20 },
  { id: "water", label: "밭에 물 4번 주기", goal: 4, reward: 30, xp: 20 },
  { id: "care", label: "펫 돌보기 3번", goal: 3, reward: 35, xp: 25 },
  { id: "craft", label: "가공품 1개 만들기", goal: 1, reward: 50, xp: 30 },
  { id: "fert", label: "밭에 비료 2번 주기", goal: 2, reward: 35, xp: 25 }, // 숨어있던 비료를 퀘스트가 가르친다
];
function ensureQuests(s: IslandState, now: number): void {
  const today = kstDate(now);
  if (s.quest.date === today && s.quest.list.length) return;
  // 날짜+seed 결정적으로 3개 선택
  const idx = (Date.parse(today) / DAY_MS + s.seed) >>> 0;
  const pool = [...QUEST_POOL];
  const pick: typeof QUEST_POOL = [];
  let r = idx;
  while (pick.length < 3 && pool.length) {
    r = (r * 1103515245 + 12345) >>> 0;
    pick.push(pool.splice(r % pool.length, 1)[0]);
  }
  s.quest = {
    date: today,
    chest: false,
    list: pick.map((q) => ({ id: q.id, label: q.label, goal: q.goal, prog: 0, reward: q.reward, xp: q.xp, claimed: false })),
  };
}
function questProgress(s: IslandState, id: string, n: number): void {
  for (const q of s.quest.list) if (q.id === id) q.prog = Math.min(q.goal, q.prog + n);
}
export function claimQuest(s0: IslandState, questId: string, now: number): IslandState {
  const s = clone(s0);
  ensureQuests(s, now);
  const q = s.quest.list.find((x) => x.id === questId);
  if (!q || q.claimed || q.prog < q.goal) return s0;
  q.claimed = true;
  s.coins += q.reward;
  addIslandXp(s, q.xp);
  pushLog(s, `퀘스트 완료! +${q.reward}💗`);
  if (s.quest.list.every((x) => x.claimed) && !s.quest.chest) {
    s.quest.chest = true;
    s.coins += 50;
    s.farm.fert += 1;
    pushLog(s, `오늘 퀘스트 전부 완료! 상자 +50💗 & 비료 🎁`);
    unlockAch(s, "daily_all");
  }
  return s;
}
// ── 업적 ────────────────────────────────────────────────────────
export type Achievement = { key: string; name: string; emoji: string; reward: number };
export const ACHIEVEMENTS: Achievement[] = [
  { key: "star5", name: "★5 작물", emoji: "🌟", reward: 100 },
  { key: "daily_all", name: "하루 완주", emoji: "✅", reward: 50 },
  { key: "set_spring", name: "봄 정원 완성", emoji: "🌸", reward: 80 },
  { key: "set_cozy", name: "아늑한 집 완성", emoji: "🏮", reward: 80 },
  { key: "set_beach", name: "바다 완성", emoji: "🏖️", reward: 100 },
  { key: "set_couple", name: "커플 코너 완성", emoji: "💑", reward: 150 },
  { key: "set_celestial", name: "천상 완성", emoji: "🌌", reward: 300 },
  { key: "dday_year", name: "1주년", emoji: "💍", reward: 365 },
  // 최종 진화형 12종(컬렉션)
  ...Object.values(PET_FORMS)
    .filter((f) => f.stage === 4)
    .map((f) => ({ key: `pet_${f.key}`, name: `${f.name} 달성`, emoji: f.emoji, reward: 200 })),
];
function unlockAch(s: IslandState, key: string): void {
  if (s.achievements.includes(key)) return;
  const a = ACHIEVEMENTS.find((x) => x.key === key);
  if (!a) return; // 정의된 업적만 기록(도감 카운트 오염 방지) [리뷰 fix]
  s.achievements.push(key);
  s.coins += a.reward;
  pushLog(s, `🏆 업적 '${a.name}' 달성! +${a.reward}💗`);
}

// ── 진행 요약(UI 헤더용) ────────────────────────────────────────
export function islandSummary(s: IslandState, now: number) {
  const pet = petNow(s, now);
  return {
    coins: s.coins,
    level: s.level,
    xp: s.xp,
    xpNext: xpForIslandLevel(s.level + 1),
    rating: islandRating(s),
    ratingTier: ratingTier(islandRating(s)),
    bondLevel: s.bond.level,
    season: seasonOf(now),
    pet,
    petForm: petForm(s.pet.form),
    skill: farmSkill(s.farm.skillXp),
    streak: s.streak.count,
  };
}

// ── 진화 미리보기 + 일괄 수확 (2026-07-27 UX 개선) ───────────────
/** 진화 미리보기 — "다음 진화까지 얼마나, 어떤 모습으로"를 UI 에 보여주기 위한 순수 조회.
 *  (tick 없음 — 렌더 중 호출 안전. 진화 실행은 여전히 evolve 만.)
 *  hint 는 지금 조건이 하위 분기일 때 "무엇을 올리면 상위 분기인지" 안내(이미 상위면 null). */
export function evolutionPreview(s: IslandState): {
  stage: number;
  level: number;
  needLevel: number | null;
  pct: number; // 다음 스테이지 진입까지 레벨 진행(0~100)
  target: string | null; // 지금 조건대로면 진화할 폼
  hint: string | null;
} {
  const stage = petStage(s.pet.form);
  const level = petLevel(s.pet.careXp);
  const need = stage < 4 ? (TUNING.pet.evoLevel[(stage + 1) as 1 | 2 | 3 | 4] ?? null) : null;
  const target = nextEvolution(s.pet.form, s.pet.cq, s.bond.level, s.pet.neglect);
  const pct = need == null ? 100 : Math.max(0, Math.min(100, (level / need) * 100));
  const b = TUNING.pet.branch;
  let hint: string | null = null;
  switch (target) {
    case "moody":
      hint = `정성 ${b.stage2Cozy}+ 면 포근이, ${b.stage2Sunny}+ 면 햇살이`;
      break;
    case "cozy":
      hint = `정성 ${b.stage2Sunny}+ 면 햇살이`;
      break;
    case "cat":
      hint = `정성 ${b.s3SunnyHi}+ · 유대 ${b.s3RadiantBond}+ 면 여우`;
      break;
    case "panda":
      hint = `정성 ${b.s3Hi}+ 면 곰`;
      break;
    case "wolf":
      hint = `정성 ${b.s3MoodyHi}+ 면 부엉이`;
      break;
    case "starlight_fox":
    case "lucky_cat":
    case "honey_bear":
    case "dream_panda":
    case "sage_owl":
    case "spirit_wolf":
      hint = `정성 ${b.s4Hi}+ · 자주 돌보면 특별한 모습으로`;
      break;
    default:
      hint = null; // 상위 분기이거나 알/최종형
  }
  return { stage, level, needLevel: need, pct, target, hint };
}

/** 다 자란 작물 전부 수확(한 번의 커밋) — 밭이 넓어진 후반의 편의. 없으면 원본 그대로. */
export function harvestAllReady(s0: IslandState, now: number): IslandState {
  let s = s0;
  for (let i = 0; i < s0.farm.plots.length; i++) {
    const p = s.farm.plots[i];
    if (p.crop && cropStage(s, p, now).ripe) s = harvest(s, i, now);
  }
  return s;
}
