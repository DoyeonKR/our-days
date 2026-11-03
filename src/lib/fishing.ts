/* 낚시 (2026-11-02) — [사용자: "낚시 게임 레퍼런스 확인하고 낚시 게임을 만들어 … 낚시에 성공한 물고기들만 수조에 보관 …
 * 낚시에 성공했다고 다 가능한것도 아니고 내 능력치 … 포획 능력치 같은거에 따라서 확률로 보관 … 낚시 게임을 메인으로"]
 * 순수 엔진(화면은 components/FishingGame). 저장은 섬 상태의 옵셔널 칸 s.fishing, 물고기는 s.aquarium — DB 변경 없음.
 *
 * 흐름(장르의 표준 세 박자 + 우리 규칙):
 *  1. 던지기 — 그냥 누르면 던져진다. 손가락을 돌리다 휙 튕기면 더 멀리 간다[사용자: "화면을 빙글빙글빙글 돌렸다가 휙 던지면 … 몇미터 던져졌다고 표기 … 멀리던질 수록 잘 던진거" → "빙글빙글 돌려서 던지라고 강요하지말고"]. 멀리 갈수록 귀한 물고기가 문다(castScore). 돌리기는 보너스다 — 탭만으로도 낚시는 제대로 된다.
 *  2. 입질 — 찌가 살짝 흔들리는 건 간 보기. 크게 잠길 때 눌러야 걸린다(일찍 누르면 달아난다, 늦으면 뱉는다).
 *  3. 힘겨루기 — 누르면 감기고 줄이 팽팽해진다. 끊어지기 전에 놓고, 너무 오래 놓으면 바늘이 빠진다. 물고기는 수시로 차고 나간다.
 *  4. 보관 판정 — 끌어올려도 **포획 확률**을 넘어야 수조에 들어간다. 놓치면 하트 절반. 수조에 안 넣고 팔면 하트 전부.
 *  · 물고기는 대개 치어 · 어린 물고기로 잡혀서 수조에서 키운다. 다 큰 놈이 잡히는 건 드문 대박이다.
 *  · 힘겨루기는 stepFight 한 곳 — 화면은 매 프레임 이걸 부르기만 한다. fishing.test 의 자동 플레이가 난이도를 잠근다.
 *  · 하트 벌이는 하루 상한이 있다. 낚시는 공짜로 무한히 할 수 있어서, 상한이 없으면 하트 경제가 끝난다.
 *  · 미끼 [사용자: "미끼가 낚시 할 수 있는 횟수도 높은 미끼일수록 높은 등급의 물고기가 잡힐 수 있게"] — 던질 때마다 줄어든다. 미끼 등급이 곧 물 수 있는
 *    물고기의 상한이고, 비싼 미끼일수록 한 묶음의 횟수도 많다. 지렁이는 매일 채워져서 하트가 없어도 낚시는 끊기지 않는다.
 *  · 방식 4가지(METHODS) — 손이 하는 일이 전부 다르다. 찌(누르고 떼기) · 루어(박자 + 좌우 끌기) · 뜰채(겨눠서 건지기) · 심해(릴 돌리기). 새 셋의 규칙은 fishingmodes.ts.
 *  · 꽝 [사용자: "일정 확률로 바다 쓰레기(꽝)도 낚을 수 있는 재미 포인트 … 쓰레기의 종류는 여러개"] — 끌어올리기 전까진 물고기와 똑같다. 낚시터마다 다른 쓰레기가 있고 수집함에 남는다.
 *  · ⚠ 섬 엔진은 타입만 부른다. 뽑기는 호출자가 넘긴 seed 로만(같은 입력 = 같은 결과, 테스트 가능). */
import type { IslandState } from "./island.ts";
import { josa } from "./josa.ts";
import { FAMILIES, GRADES, addFish, aquaOf, familyOf, fishArtKey, fishName, fryLockReason, releaseFish, speciesOf, tankOf, type AquaFamily, type Grade } from "./aquarium.ts";
import { claimGoal, fishDay } from "./fishinggoals.ts";
import { TIMED_CHANCE, bossBeaten, bossBlock, bossHurt, bossOf, bossReward, bossStarted, expedAdd, finalAllowed, kgOf, newExpedition, noteSize, rollCm, timedAt, weekOf, type BossRecord, type ExpedKey, type Expedition, type FishBoss, type FishMoment, type SizeBook, type SizeNote } from "./fishingworld.ts";

export type FishStat = "catch" | "power" | "line" | "luck";
export const STAT_INFO: Record<FishStat, { name: string; desc: string }> = {
  catch: { name: "포획", desc: "끌어올린 물고기를 수조에 담을 확률" },
  power: { name: "힘", desc: "줄을 감는 속도 · 물고기가 덜 차고 나감" },
  line: { name: "줄 다루기", desc: "줄이 덜 팽팽해지고 잘 안 끊어짐" },
  luck: { name: "행운", desc: "귀한 물고기와 다 큰 물고기가 잘 잡히고 쓰레기가 덜 걸림" },
};
export const STAT_KEYS = Object.keys(STAT_INFO) as FishStat[];
export const STAT_CAP = 40;
export const MAX_LEVEL = 50;
export const POINTS_PER_LEVEL = 2;
export const DAILY_FISH_COINS = 1500;
/** 지렁이는 매일 이만큼까지 채워진다 — 하트가 바닥나도 낚시가 막히지 않게 */
export const FREE_WORMS = 20;

export type FishSpot = { key: string; name: string; minLevel: number; pool: readonly (readonly [string, number])[] };
export const SPOTS: readonly FishSpot[] = [
  { key: "brook", name: "동네 개울", minLevel: 1, pool: [["guppy", 60], ["tetra", 40]] },
  { key: "pond", name: "연꽃 연못", minLevel: 3, pool: [["goldfish", 50], ["betta", 35], ["koi", 15]] },
  { key: "jungle", name: "열대 강", minLevel: 7, pool: [["angel", 40], ["discus", 30], ["ray", 20], ["arowana", 10]] },
  { key: "harbor", name: "남해 항구", minLevel: 9, pool: [["flounder", 45], ["rockfish", 35], ["sea_bream", 25], ["sea_bass", 20], ["salmon", 15], ["croaker", 10], ["yellowtail", 8], ["striped_jack", 5]] },
  { key: "reef", name: "산호초 바다", minLevel: 12, pool: [["clown", 55], ["nurse_shark", 15], ["leopard_shark", 15], ["sea_turtle", 30], ["manta", 15]] },
  { key: "ocean", name: "먼 바다", minLevel: 18, pool: [["bluefin", 60], ["blue_shark", 40], ["manta", 25], ["hammerhead", 15], ["great_white", 10], ["whale_shark", 15]] },
  { key: "palace", name: "용궁 앞바다", minLevel: 25, pool: [["rising", 80], ["megamouth", 15], ["whale_shark", 20]] },
  { key: "starsea", name: "별의 바다", minLevel: 32, pool: [["astral", 70], ["rising", 30]] },
];
export const spotOf = (key: string) => SPOTS.find((x) => x.key === key);
/** 지금 낚시터 — 고른 곳, 없으면 미끼가 있는 곳 중 가장 깊은 곳. 배경과 연출이 이 한 함수를 본다(둘이 갈리면 수평선이 어긋난다). */
export function currentSpot(f: Pick<FishingState, "level" | "baits" | "wormDay">, pick: string | null, today: string): FishSpot {
  const open = SPOTS.filter((x) => x.minLevel <= f.level);
  const stocked = open.filter((x) => BAITS.some((b) => poolFor(x, b.maxGrade).length > 0 && baitStock(f, b.key, today) > 0));
  return open.find((x) => x.key === pick) ?? stocked[stocked.length - 1] ?? open[0];
}

export const RODS: readonly { key: string; name: string; price: number; power: number; line: number }[] = [
  { key: "rod_bamboo", name: "대나무 낚싯대", price: 0, power: 0, line: 0 },
  { key: "rod_glass", name: "유리섬유 낚싯대", price: 1500, power: 3, line: 3 },
  { key: "rod_carbon", name: "카본 낚싯대", price: 6000, power: 7, line: 7 },
  { key: "rod_titan", name: "티타늄 낚싯대", price: 18000, power: 12, line: 12 },
  { key: "rod_dragon", name: "용골 낚싯대", price: 36000, power: 18, line: 18 },
  { key: "rod_star", name: "별빛 낚싯대", price: 80000, power: 25, line: 25 },
];
export const NETS: readonly { key: string; name: string; price: number; catch: number }[] = [
  { key: "net_bug", name: "잠자리채", price: 0, catch: 0 },
  { key: "net_cotton", name: "면 뜰채", price: 1000, catch: 4 },
  { key: "net_rubber", name: "고무 뜰채", price: 5000, catch: 9 },
  { key: "net_silver", name: "은실 뜰채", price: 15000, catch: 15 },
  { key: "net_gold", name: "황금 뜰채", price: 28000, catch: 22 },
  { key: "net_moon", name: "달빛 뜰채", price: 70000, catch: 30 },
];

export type FishBait = { key: string; name: string; maxGrade: number; uses: number; price: number; desc: string };
/** 미끼 — maxGrade 가 물 수 있는 등급의 상한(GRADES 번호), uses 는 한 묶음으로 던질 수 있는 횟수. 높을수록 둘 다 크다. */
export const BAITS: readonly FishBait[] = [
  { key: "bait_worm", name: "지렁이", maxGrade: 1, uses: 10, price: 60, desc: `매일 ${FREE_WORMS}회까지 채워져요` },
  { key: "bait_shrimp", name: "민물새우", maxGrade: 2, uses: 15, price: 180, desc: "엔젤피시 · 흰동가리가 물어요" },
  { key: "bait_squid", name: "오징어살", maxGrade: 3, uses: 20, price: 480, desc: "디스커스 · 비단잉어가 물어요" },
  { key: "bait_paste", name: "황금 떡밥", maxGrade: 4, uses: 25, price: 1200, desc: "참다랑어 · 아로와나가 물어요" },
  { key: "bait_glow", name: "심해 발광 미끼", maxGrade: 5, uses: 30, price: 2400, desc: "고래상어 · 등용어가 물어요" },
  { key: "bait_pearl", name: "용궁 진주 미끼", maxGrade: 6, uses: 35, price: 4200, desc: "별무리어가 물어요" },
  { key: "bait_star", name: "별가루 미끼", maxGrade: 7, uses: 40, price: 6400, desc: "태초 등급까지 물어요" },
];
export const baitIndex = (key: string) => BAITS.findIndex((x) => x.key === key);

export type MethodKey = "float" | "lure" | "scoop" | "deep";
export type FishMethod = { key: MethodKey; name: string; minLevel: number; baitCost: number; adult: number; lift: number; capture: number; junk: number; how: string; good: string };
/** 낚시 방식 — 같은 낚시터도 방식에 따라 다른 물고기가 다른 비율로 온다 */
export const METHODS: readonly FishMethod[] = [
  { key: "float", name: "찌낚시", minLevel: 1, baitCost: 1, adult: 1, lift: 0, capture: 0, junk: 1, how: "입질에 챔질하고, 누르고 떼며 줄을 감아요", good: "기본" },
  { key: "lure", name: "루어", minLevel: 2, baitCost: 1, adult: 2.4, lift: 0, capture: 0, junk: 0.6, how: "박자 맞춰 유인하고, 물고기 반대쪽으로 끌어요", good: "다 큰 물고기가 잘 와요" },
  { key: "scoop", name: "뜰채", minLevel: 3, baitCost: 1, adult: 0, lift: 0, capture: 0.12, junk: 1, how: "그림자를 겨눠 건져요. 움직임을 앞서 노리세요", good: "고를 수 있고 잘 담겨요" },
  { key: "deep", name: "심해", minLevel: 5, baitCost: 2, adult: 1.4, lift: 0.9, capture: -0.04, junk: 1.5, how: "릴을 빙글빙글 돌려 끌어올려요. 미끼를 2개 써요", good: "귀한 물고기가 와요" },
];
export const methodOf = (key: MethodKey) => METHODS.find((x) => x.key === key) ?? METHODS[0];

export type FishJunk = { key: string; name: string; line: string; coins: number; spot?: string };
/** 꽝 — 흔한 쓰레기 + 낚시터마다 거기서만 나오는 것. 하트는 분리수거 값만큼 조금. line 은 건져 올렸을 때의 한 줄. */
export const JUNKS: readonly FishJunk[] = [
  { key: "junk_can", name: "찌그러진 깡통", line: "한 모금 남아 있어요. 마시지는 마세요", coins: 2 },
  { key: "junk_boot", name: "장화 한 짝", line: "나머지 한 짝은 어디 있을까요", coins: 2 },
  { key: "junk_bottle", name: "페트병", line: "라벨을 떼면 분리수거 끝!", coins: 2 },
  { key: "junk_bag", name: "비닐봉지", line: "해파리인 줄 알았어요", coins: 1 },
  { key: "junk_sock", name: "구멍 난 양말", line: "주인이 찾고 있진 않겠죠", coins: 1 },
  { key: "junk_tire", name: "낡은 타이어", line: "어쩐지 묵직하더라니", coins: 4 },
  { key: "junk_umbrella", name: "살이 부러진 우산", line: "물속에선 비를 안 맞아요", coins: 2 },
  { key: "junk_duck", name: "고무 오리", line: "어쩐지 눈이 마주친 것 같아요", coins: 5 },
  { key: "junk_slipper", name: "삼선 슬리퍼", line: "개울을 건너다 잃어버린 걸까요", coins: 2, spot: "brook" },
  { key: "junk_coin", name: "소원 동전", line: "누군가의 소원을 건져 버렸어요", coins: 8, spot: "pond" },
  { key: "junk_hat", name: "탐험가 모자", line: "주인은 무사히 돌아갔길", coins: 4, spot: "jungle" },
  { key: "junk_glasses", name: "깨진 선글라스", line: "산호도 이걸 쓰기엔 눈이 부셔요", coins: 3, spot: "reef" },
  { key: "junk_letter", name: "유리병 편지", line: "\"이걸 읽는다면 답장 주세요\"", coins: 20, spot: "ocean" },
  { key: "junk_bill", name: "용왕의 고지서", line: "납부 기한이 삼백 년 지났어요", coins: 12, spot: "palace" },
  { key: "junk_satellite", name: "인공위성 조각", line: "별인 줄 알았는데 고철이었어요", coins: 15, spot: "starsea" },
];
export const junkOf = (key: string | undefined) => JUNKS.find((x) => x.key === key);
const JUNK_SEED = 0x2f6e2b1;

export type FishingState = {
  level: number;
  xp: number;
  points: number;
  stats: Record<FishStat, number>;
  rod: number;
  net: number;
  day: string;
  dayCoins: number;
  landed: number;
  stored: number;
  /** 미끼별 남은 횟수 · 지렁이를 마지막으로 채운 날 */
  baits: Record<string, number>;
  wormDay: string;
  /** 건져 올린 쓰레기 수집함 — key 별 개수 */
  junk: Record<string, number>;
  /** 끌어올려 본 물고기 그림 key — 처음 만난 물고기(NEW) 판정 */
  seen: string[];
  /** 가장 멀리 던진 거리(m) */
  bestCast: number;
  /** 받은 목표 id · 낚아 본 가장 높은 등급(-1 = 아직) */
  goals: string[];
  topGrade: number;
  /** 오늘 — day 가 바뀌면 fishDay 가 비운다 */
  dayLanded: number;
  dayStored: number;
  dayCast: number;
  dayClaimed: string[];
  /** 계열별 · 사람별 최고 길이(cm) · 낚시터 주인 · 이번 주 원정 */
  sizes: SizeBook;
  bosses: Record<string, BossRecord>;
  exped: Expedition | null;
};

export function fishingOf(st: Pick<IslandState, "fishing">): FishingState {
  const f = st.fishing;
  return {
    level: f?.level ?? 1,
    xp: f?.xp ?? 0,
    points: f?.points ?? 0,
    stats: { catch: f?.stats?.catch ?? 1, power: f?.stats?.power ?? 1, line: f?.stats?.line ?? 1, luck: f?.stats?.luck ?? 1 },
    rod: Math.min(RODS.length - 1, Math.max(0, f?.rod ?? 0)),
    net: Math.min(NETS.length - 1, Math.max(0, f?.net ?? 0)),
    day: f?.day ?? "",
    dayCoins: f?.dayCoins ?? 0,
    landed: f?.landed ?? 0,
    stored: f?.stored ?? 0,
    baits: { ...f?.baits },
    wormDay: f?.wormDay ?? "",
    junk: { ...f?.junk },
    seen: [...(f?.seen ?? [])],
    bestCast: f?.bestCast ?? 0,
    goals: [...(f?.goals ?? [])],
    // 이 칸이 생기기 전 기록은 만나 본 물고기에서 되짚는다
    topGrade: f?.topGrade ?? (f?.seen ?? []).reduce((n, k) => { const g = speciesOf(k)?.grade; return g ? Math.max(n, GRADES.indexOf(g)) : n; }, -1),
    dayLanded: f?.dayLanded ?? 0,
    dayStored: f?.dayStored ?? 0,
    dayCast: f?.dayCast ?? 0,
    dayClaimed: [...(f?.dayClaimed ?? [])],
    sizes: { ...f?.sizes },
    bosses: { ...f?.bosses },
    exped: f?.exped ?? null,
  };
}

/** 지금 능력치 — 올린 능력치 + 장비 */
export function effectiveStats(f: Pick<FishingState, "stats" | "rod" | "net">): Record<FishStat, number> {
  return {
    catch: f.stats.catch + NETS[f.net].catch,
    power: f.stats.power + RODS[f.rod].power,
    line: f.stats.line + RODS[f.rod].line,
    luck: f.stats.luck,
  };
}

/** 요리 · 훈련의 기세(도시락 힘)까지 더한 능력치 — 줄을 감는 힘이 오른다 */
export function buffedStats(st: Pick<IslandState, "buffs">, f: Pick<FishingState, "stats" | "rod" | "net">, now: number): Record<FishStat, number> {
  const e = effectiveStats(f), b = st.buffs?.hunt;
  return b && b.until > now ? { ...e, power: Math.round(e.power * (1 + b.amount / 100)) } : e;
}

/** 다음 레벨까지 필요한 경험치 */
export const xpNeed = (level: number) => 30 + level * level * 6;

/* ── 물고기 뽑기 ─────────────────────────────────────── */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(items: readonly (readonly [T, number])[], r: number): T {
  const total = items.reduce((n, x) => n + x[1], 0);
  let v = r * total;
  for (const [it, w] of items) {
    if (v < w) return it;
    v -= w;
  }
  return items[items.length - 1][0];
}

/** junk 가 있으면 물고기가 아니라 쓰레기다 — 끌어올리기 전까지 화면은 모른다 */
export type FishCatch = { family: string; stage: 0 | 1 | 2; species?: string; grade: Grade; difficulty: number; junk?: string; cm?: number; boss?: string };

/** 난이도 — 등급(0~7) + 클수록 조금 더 */
function difficultyOf(fam: AquaFamily, stage: 0 | 1 | 2, species?: string): { grade: Grade; difficulty: number } {
  const grade = speciesOf(species)?.grade ?? fam.finals[0].grade;
  return { grade, difficulty: GRADES.indexOf(grade) + stage * 0.5 };
}

const gradeNo = (g: Grade) => GRADES.indexOf(g);
/** 이 미끼로 무는 계열 — 어린 물고기의 등급은 그 계열의 첫 형태 등급이다 */
export const poolFor = (spot: FishSpot, maxGrade: number) => spot.pool.filter(([k]) => {
  const f = familyOf(k);
  return !!f && gradeNo(f.finals[0].grade) <= maxGrade;
});
/** 이 계열이 물기 시작하는 미끼 단계 */
export const familyBaitTier = (key: string) => {
  const g = gradeNo(familyOf(key)?.finals[0].grade ?? GRADES[0]);
  return Math.max(0, BAITS.findIndex((b) => b.maxGrade >= g));
};
const baitTierOf = (pool: readonly (readonly [string, number])[]) => Math.min(...pool.map(([k]) => familyBaitTier(k)));
/** 미끼 한 단계의 값 — 보통의 행운 · 거리(배율 1.3)에서 한 단계 약 1% */
export const BAIT_STEP = 0.008;

/** 이 낚시터에서 무언가 물기 시작하는 가장 싼 미끼 */
export const spotMinBait = (spot: FishSpot) => {
  const i = BAITS.findIndex((b) => poolFor(spot, b.maxGrade).length > 0);
  return BAITS[i < 0 ? BAITS.length - 1 : i];
};

/** 쓰레기가 걸릴 확률 — 행운이 줄이고, 깊이 내릴수록 많다. 6%~. */
export const junkChance = (luck: number, method: MethodKey = "float") => Math.max(0.06, (0.12 - luck * 0.0012) * methodOf(method).junk);
/** 이 낚시터에서 나오는 쓰레기 — 흔한 것 + 거기서만 나오는 것(무게를 더 준다) */
export const junksAt = (spotKey: string) => JUNKS.filter((x) => !x.spot || x.spot === spotKey);

export type CatchOpts = { bait?: number; method?: MethodKey; junk?: boolean; when?: FishMoment };
const TIMED_SEED = 0x51ed27f;
const SIZE_SEED = 0x1b873593;
/** 길이는 별도 뽑기 — 길이를 더해도 물고기 뽑기 순서는 그대로다 */
function sizedCatch<T extends FishCatch>(c: T, luck: number, cast: number, seed: number): T {
  const r = rng((seed ^ SIZE_SEED) >>> 0);
  return { ...c, cm: rollCm(c.family, c.stage, luck, cast, r(), r()) };
}
/** 무엇이 무는가 — 행운 · 캐스팅 · 미끼 · 방식이 다 큰 물고기와 귀한 쪽으로 기울인다. 미끼 등급을 넘는 물고기는 물지 않는다. 순수.
 *  junk: true 면 일정 확률로 쓰레기(별도 뽑기 — 쓰레기를 켜도 물고기 뽑기 순서는 그대로다). */
export function rollCatch(spot: FishSpot, luck: number, cast: number, seed: number, opts: CatchOpts = {}): FishCatch {
  const r = rng(seed);
  // 때 손님 — 이 시간 · 이 날씨에 이 낚시터에만 다 큰 모습으로 문다. 별도 뽑기라 다른 뽑기 순서는 그대로다.
  if (opts.when) {
    const capNow = opts.bait === undefined ? GRADES.length - 1 : BAITS[Math.min(BAITS.length - 1, opts.bait)].maxGrade;
    const guests = timedAt(spot.key, opts.when).filter((t) => gradeNo(speciesOf(t.species)?.grade ?? "태초") <= capNow);
    const t = rng((seed ^ TIMED_SEED) >>> 0);
    if (guests.length && t() < TIMED_CHANCE) {
      const pick = guests[Math.floor(t() * guests.length) % guests.length];
      const fam = FAMILIES.find((f) => f.finals.some((x) => x.key === pick.species));
      if (fam) {
        // 은어 · 메기 · 해파리처럼 이때만 오는 물고기는 다른 물고기처럼 대개 어리게 잡혀 수조에서 큰다. 나머지는 이때만 만나는 다 큰 모습이다.
        const v = t();
        const stage: 0 | 1 | 2 = spot.pool.some(([k]) => k === fam.key) ? 2 : v < 0.6 ? 0 : v < 0.88 ? 1 : 2;
        return sizedCatch({ family: fam.key, stage, ...(stage === 2 ? { species: pick.species } : {}), ...difficultyOf(fam, stage, stage === 2 ? pick.species : undefined) }, luck, cast, seed);
      }
    }
  }
  const tier = opts.bait ?? 0;
  const cap = opts.bait === undefined ? GRADES.length - 1 : BAITS[Math.min(BAITS.length - 1, tier)].maxGrade;
  const how = methodOf(opts.method ?? "float");
  const lift = luck * 0.012 + cast * 0.6 + how.lift;
  const pool = poolFor(spot, cap);
  const usable = pool.length ? pool : spot.pool.slice(0, 1);
  // 미끼는 '열리는 것'이지 '쏟아지는 것'이 아니다 — 이 낚시터의 시작 미끼보다 높은 미끼가 필요한 계열은 미끼가 한 단계 오를 때마다 약 1% 씩만 는다
  // [사용자 2026-11-03: "미끼가 좋을수록 좋은 물고기 확률이 너무 큰 것 같아 … 단계별로 1%정도 차이로만"]. 미끼를 안 주면(옛 호출) 전부 기본 계열이다.
  const baseTier = opts.bait === undefined ? 0 : baitTierOf(usable);
  const needOf = (k: string) => (opts.bait === undefined ? 0 : familyBaitTier(k));
  const v0 = r();
  let cum = 0, family = "";
  for (const [k] of usable) {
    const need = needOf(k);
    if (need <= baseTier) continue;
    cum += BAIT_STEP * (1 + lift) * (tier - need + 1);
    if (v0 < cum) { family = k; break; }
  }
  if (!family) {
    const base = usable.filter(([k]) => needOf(k) <= baseTier);
    // 기본 계열끼리는 뒤쪽일수록 무게를 더 받는다
    family = pickWeighted((base.length ? base : usable).map(([k, w]) => [k, w * (1 + lift * spot.pool.findIndex((x) => x[0] === k))] as const), Math.min(0.999999, (v0 - cum) / Math.max(0.0001, 1 - cum)));
  }
  const fam = familyOf(family);
  if (!fam) throw new Error(`없는 계열: ${family}`);
  const finals = fam.finals.filter((x) => gradeNo(x.grade) <= cap && finalAllowed(x.key, spot.key, opts.when));
  const adult = finals.length ? (0.02 + luck * 0.0015 + cast * 0.035 + tier * 0.01) * how.adult : 0;
  const juv = 0.2 + luck * 0.003 + (how.key === "lure" ? 0.15 : 0);
  const v = r();
  const stage: 0 | 1 | 2 = v < adult ? 2 : v < adult + juv ? 1 : 0;
  const species = stage === 2
    ? pickWeighted(finals.map((x) => [x.key, [60, 25, 12, 3][fam.finals.indexOf(x)] * (1 + lift * fam.finals.indexOf(x) * 2)] as const), r())
    : undefined;
  const real: FishCatch = sizedCatch({ family, stage, ...(species ? { species } : {}), ...difficultyOf(fam, stage, species) }, luck, cast, seed);
  if (opts.junk) {
    const j = rng((seed ^ JUNK_SEED) >>> 0);
    if (j() < junkChance(luck, how.key)) {
      const at = junksAt(spot.key);
      // 물고기 흉내 — 그림자 크기 · 난이도는 물고기 그대로라 끌어올리기 전엔 모른다. 낚시터 전용 쓰레기는 무게 4
      return { ...real, cm: undefined, junk: pickWeighted(at.map((x) => [x.key, x.spot ? 4 : 1] as const), j()) };
    }
  }
  return real;
}

export const catchArt = (c: Pick<FishCatch, "family" | "stage" | "species">) => fishArtKey(c);
export const catchName = (c: Pick<FishCatch, "family" | "stage" | "species" | "boss">) => {
  const b = bossOf(c.boss);
  return b ? `${b.name} · ${fishName(c)}` : fishName(c);
};

/** 물고기 크기(그림자) — 0~1. 물기 전까지 물고기는 그림자로만 보인다. */
export const shadowSize = (c: Pick<FishCatch, "family" | "stage" | "boss">) => {
  if (c.boss) return 1;
  const size = familyOf(c.family)?.size ?? 16;
  return Math.min(1, (size / 45) * (c.stage === 2 ? 1 : c.stage === 1 ? 0.75 : 0.5));
};

/* ── 미끼 ───────────────────────────────────────────── */

/** 지금 남은 횟수 — 지렁이는 날이 바뀌면 FREE_WORMS 까지 채워진 셈이다(저장은 던질 때 한다) */
export function baitStock(f: Pick<FishingState, "baits" | "wormDay">, key: string, today: string): number {
  const have = f.baits[key] ?? 0;
  return key === BAITS[0].key && f.wormDay !== today ? Math.max(have, FREE_WORMS) : have;
}

/** 못 던지는 이유 — 화면과 저장이 같은 판정을 쓴다 */
export function castBlock(f: Pick<FishingState, "baits" | "wormDay" | "level">, spot: FishSpot, method: MethodKey, baitKey: string, today: string): string | null {
  const how = methodOf(method);
  const bait = BAITS[baitIndex(baitKey)];
  if (!bait) return "미끼를 골라 주세요";
  if (f.level < how.minLevel) return `${josa(how.name, "은/는")} 낚시 Lv.${how.minLevel}부터 할 수 있어요`;
  if (!poolFor(spot, bait.maxGrade).length) return `${josa(spot.name, "은/는")} ${spotMinBait(spot).name}부터 물어요`;
  const have = baitStock(f, baitKey, today);
  if (have < how.baitCost) return have > 0 ? `${josa(how.name, "은/는")} 미끼가 ${how.baitCost}개 필요해요` : `${josa(bait.name, "이/가")} 다 떨어졌어요`;
  return null;
}

/** 던질 때 미끼를 쓴다. 놓쳐도 돌아오지 않는다 — 그게 놓치는 값이다. 던진 거리가 기록을 넘으면 함께 남긴다. */
export function spendBait(st: IslandState, spot: FishSpot, method: MethodKey, baitKey: string, today: string, castM = 0): GearResult {
  const f = fishingOf(st);
  const why = castBlock(f, spot, method, baitKey, today);
  if (why) return { ok: false, reason: why };
  const worm = BAITS[0].key;
  const baits = { ...f.baits, [worm]: baitStock(f, worm, today) };
  baits[baitKey] = (baits[baitKey] ?? 0) - methodOf(method).baitCost;
  const d = fishDay(f, today);
  return { ok: true, state: { ...st, fishing: { ...d, day: today, baits, wormDay: today, bestCast: Math.max(f.bestCast, castM), dayCast: Math.max(d.dayCast, castM) } } };
}

export function buyBait(st: IslandState, baitKey: string, today: string): GearResult {
  const bait = BAITS[baitIndex(baitKey)];
  if (!bait) return { ok: false, reason: "없는 미끼예요" };
  if (st.coins < bait.price) return { ok: false, reason: `하트가 ${(bait.price - st.coins).toLocaleString()}개 모자라요` };
  const f = fishingOf(st);
  const worm = BAITS[0].key;
  const baits = { ...f.baits, [worm]: baitStock(f, worm, today) };
  baits[baitKey] = (baits[baitKey] ?? 0) + bait.uses;
  return { ok: true, state: { ...st, coins: st.coins - bait.price, fishing: { ...f, baits, wormDay: today } } };
}

/* ── 던지기 ─────────────────────────────────────────── */

/** 돌리기 상태 — energy 는 쌓인 힘(0~1), rate 는 초당 바퀴(부호 = 돌리는 방향) */
export type CastSpin = { energy: number; rate: number; turns: number; dir: 1 | -1 };
export const startSpin = (): CastSpin => ({ energy: 0, rate: 0, turns: 0, dir: 1 });
/** 두 움직임 사이에 방향이 꺾인 각도(-π~π) — 손가락이 도는 원의 크기 · 자리와 상관없이 잰다 */
export function headingDelta(ax: number, ay: number, bx: number, by: number): number {
  let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
/** 돌리는 속도의 맛 — 느리면 힘이 안 붙고, 초당 2~3.6바퀴가 최고, 너무 빨리 막 돌리면 도로 떨어진다 */
export function spinGain(rps: number): number {
  const v = Math.abs(rps);
  if (v < 0.4) return 0;
  if (v < 2) return (v - 0.4) / 1.6;
  if (v <= 3.6) return 1;
  return Math.max(0.3, 1 - (v - 3.6) * 0.5);
}
/** 한 칸 진행 — angle 은 이번 칸에 돈 각도(라디안, 방향 포함). 순수. */
export function stepSpin(s: CastSpin, angle: number, dt: number): CastSpin {
  if (dt <= 0) return s;
  const rate = s.rate + (angle / (Math.PI * 2) / dt - s.rate) * Math.min(1, dt * 8);
  const gain = spinGain(rate);
  const dir: 1 | -1 = Math.abs(rate) > 0.3 ? (rate > 0 ? 1 : -1) : s.dir;
  // 방향을 뒤집으면 쌓은 힘이 줄고, 멈추면 빠진다
  let energy = (dir !== s.dir ? s.energy * 0.7 : s.energy) + gain * 0.55 * dt;
  if (gain < 0.15) energy -= 0.35 * dt;
  return { energy: Math.max(0, Math.min(1, energy)), rate, turns: s.turns + Math.abs(angle) / (Math.PI * 2), dir };
}
/** 이 속도(px/ms)로 튕기면 튕김 만점 */
export const FLICK_FULL = 1.6;
/** 그냥 눌러 던지면 이만큼 — 돌리기를 강요하지 않는다. 물고기 뽑기에서도 평범한 값이다 */
export const CAST_BASE = 0.4;
/** 잘 던진 정도 0~1 = 기본 + 쌓은 힘(놓을 때 속도 반영) + 튕김. 끝까지 보내려면 돌리고 튕겨야 한다. */
export function castScore(s: Pick<CastSpin, "energy" | "rate">, flick: number): number {
  const f = Math.max(0, Math.min(1, flick / FLICK_FULL));
  const bonus = s.energy * (0.55 + 0.15 * spinGain(s.rate)) + f * (0.2 + 0.1 * s.energy);
  return Math.max(0, Math.min(1, CAST_BASE + (1 - CAST_BASE) * bonus));
}
/** 끝까지 나가는 거리(m) — 낚싯대가 7m 씩(대나무 25 ~ 별빛 60), 올린 힘 1점마다 0.3m(최대 +12) */
export const castRange = (rodTier: number, power: number) => 25 + rodTier * 7 + power * 0.3;
/** 비거리(m, 소수 한 자리) — 살짝 던져도 어딘가엔 떨어진다 */
export const castMeters = (score: number, range: number) => Math.round(range * (0.12 + 0.88 * score) * 10) / 10;
/** 한마디 — 바나나킥은 제대로 돌려서 멀리 보냈을 때만 */
export function castRating(score: number, turns: number): string {
  if (score >= 0.85 && turns >= 2) return "바나나킥!";
  if (score >= 0.6) return "쭉 뻗었어요!";
  if (score >= 0.45) return "괜찮아요";
  return "던졌어요";
}

/* ── 입질 ───────────────────────────────────────────── */

/** 물었을 때 눌러야 하는 시간(ms) — 큰 놈일수록 짧다 */
export const hookWindowMs = (difficulty: number, line: number) => Math.round(Math.max(380, 1050 - difficulty * 85 + line * 4));
/** 이 비율 안에 누르면 '완벽한 챔질' */
export const PERFECT_HOOK = 0.45;
/** 입질까지 기다리는 시간(ms) · 간 보기 횟수 */
export function waitPlan(seed: number): { waitMs: number; nibbles: number[] } {
  const r = rng(seed ^ 0x5bd1e995);
  const waitMs = 1800 + Math.round(r() * 3800);
  const n = Math.floor(r() * 3);
  const nibbles = Array.from({ length: n }, (_, i) => Math.round(waitMs * ((i + 1) / (n + 1)) + (r() - 0.5) * 300));
  return { waitMs, nibbles };
}

/* ── 힘겨루기 ────────────────────────────────────────── */

/* ⚠ 힘겨루기 수치는 처음 판(2026-11-02)으로 되돌렸다 [사용자: "물고기 잡는 방식이 너무 어려워졌어 잡는 방식만 예전으로 돌려줘 그 방식을 기준으로 잡고 거기서 조금만 변형"].
 * 달라진 건 둘뿐이다: 차고 나가기 전에 예고가 뜨고(쉬워졌다), 가끔 물고기가 뛰어오르는데 그때 감으면 더 빨리 들어온다(보너스 — 떼도 놓치지 않는다). */
export const GREEN_LOW = 0.35;
export const GREEN_HIGH = 0.75;
export const SLACK_LIMIT_S = 2.5;
export const FIGHT_LIMIT_S = 90;

/** 뛰어오르기 좋아하는 정도 — 물고기마다 싸우는 버릇이 다르다(없으면 0.3) */
const JUMPY: Readonly<Record<string, number>> = { arowana: 0.65, bluefin: 0.45, manta: 0.5, rising: 0.55, astral: 0.5, betta: 0.4, koi: 0.15, ray: 0.1, sea_turtle: 0.05, whale_shark: 0.05, goldfish: 0.2 };

export type FightTune = { reel: number; tensionUp: number; tensionDown: number; surgeEvery: number; surgeLen: number; surgePull: number; run: number; drift: number; warn: number; jumpRate: number };
export type FightStatus = "on" | "landed" | "snapped" | "slack" | "escaped";
export type FightEvent = "surge" | "jump";
export type Fight = {
  /** 1 = 멀리, 0 = 끌어올림 */
  dist: number;
  tension: number;
  t: number;
  slack: number;
  /** 다음 사건이 곧 온다는 예고(초) · 그 사건 */
  warnLeft: number;
  event: FightEvent;
  surgeLeft: number;
  nextSurge: number;
  good: number;
  rngState: number;
  status: FightStatus;
};

export function fightTune(difficulty: number, eff: Pick<Record<FishStat, number>, "power" | "line">, family?: string): FightTune {
  const d = difficulty;
  return {
    reel: (0.15 * (1 + eff.power * 0.035)) / (1 + d * 0.22),
    tensionUp: (0.42 * (1 + d * 0.12)) / (1 + eff.line * 0.03),
    tensionDown: 0.55,
    surgeEvery: Math.max(1.6, 4.5 - d * 0.3),
    surgeLen: 0.9 + d * 0.1,
    surgePull: (0.8 * (1 + d * 0.1)) / (1 + eff.line * 0.03),
    run: (0.1 * (1 + d * 0.1)) / (1 + eff.power * 0.02),
    drift: 0.012,
    warn: Math.max(0.26, 0.5 - d * 0.03),
    jumpRate: family ? JUMPY[family] ?? 0.3 : 0.3,
  };
}

export function startFight(seed: number, tune: FightTune): Fight {
  const r = rng(seed);
  return { dist: 1, tension: 0.35, t: 0, slack: 0, warnLeft: 0, event: "surge", surgeLeft: 0, nextSurge: tune.surgeEvery * (0.6 + r() * 0.6), good: 0, rngState: (seed * 31 + 7) >>> 0, status: "on" };
}

/** 한 칸 진행 — hold 면 감는다. 순수. dt 는 초(화면이 잘라서 넘긴다).
 *  차고 나가면(surge) 손을 뗀다. 뛰어오르면(jump) 줄이 잠깐 느슨해져서 감으면 더 빨리 들어온다 — 안 감아도 놓치지는 않는다. 잠깐의 예고(warnLeft) 동안 무엇이 올지 보여 준다. */
export function stepFight(f: Fight, dt: number, hold: boolean, tune: FightTune): Fight {
  if (f.status !== "on") return f;
  const n: Fight = { ...f, t: f.t + dt };
  const jumping = n.surgeLeft > 0 && n.event === "jump";
  const surging = n.surgeLeft > 0 && n.event === "surge";
  if (n.surgeLeft > 0) {
    n.surgeLeft = Math.max(0, n.surgeLeft - dt);
    if (surging) {
      n.tension += tune.surgePull * (hold ? 1 : 0.22) * dt;
      n.dist += tune.run * dt;
    } else {
      n.tension -= 0.4 * dt;
    }
  } else if (n.warnLeft > 0) {
    n.warnLeft = Math.max(0, n.warnLeft - dt);
    if (n.warnLeft <= 0) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 11) >>> 0;
      n.surgeLeft = (n.event === "jump" ? 0.8 : tune.surgeLen) * (0.75 + r() * 0.5);
      n.nextSurge = tune.surgeEvery * (0.75 + r() * 0.6);
    }
  } else {
    n.nextSurge -= dt;
    if (n.nextSurge <= 0) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 13) >>> 0;
      n.event = r() < tune.jumpRate ? "jump" : "surge";
      n.warnLeft = tune.warn;
    }
  }
  if (hold) {
    n.tension += tune.tensionUp * dt;
    // 좋은 구간에서 잘 감기고, 팽팽할수록 빠르지만 위험하다
    const eff = n.tension < GREEN_LOW ? 0.6 : n.tension > GREEN_HIGH ? 1.25 : 1;
    n.dist -= tune.reel * eff * (surging ? 0.35 : jumping ? 1.5 : 1) * dt;
  } else {
    n.tension -= tune.tensionDown * dt;
    n.dist += tune.drift * dt;
  }
  n.tension = Math.max(0, n.tension);
  n.slack = n.tension < 0.05 ? n.slack + dt : 0;
  if (n.tension >= GREEN_LOW && n.tension <= GREEN_HIGH) n.good += dt;
  if (n.tension >= 1) n.status = "snapped";
  else if (n.dist <= 0) n.status = "landed";
  else if (n.slack >= SLACK_LIMIT_S) n.status = "slack";
  else if (n.dist >= 1.3 || n.t >= FIGHT_LIMIT_S) n.status = "escaped";
  return n;
}

/** 힘겨루기 솜씨 0~1 — 좋은 구간에 머문 비율 */
export const fightQuality = (f: Pick<Fight, "good" | "t">) => (f.t <= 0 ? 0 : Math.min(1, f.good / f.t));

/* ── 보관 판정 ────────────────────────────────────────── */

/** 판매가 — 흔한 치어도 미끼값(지렁이 한 번 6하트)의 두 배 넘게 받는다 [사용자: "그냥 팔아도 적정량의 하트는 받을 수 있도록"] */
export const coinValue = (difficulty: number) => Math.round(15 * 1.6 ** difficulty);
/** 내 기록을 넘긴 크기의 혜택 — 하트(낚시 하루 한도 밖)와 경험치 1.5배 [사용자: "같은 물고기 잡더라도 최대 크기라고 그거에대한 베네핏도"] */
export const recordCoins = (difficulty: number) => Math.max(20, coinValue(difficulty) * 2);
export const xpValue = (difficulty: number) => Math.round(10 * 1.5 ** difficulty);

/** 포획 확률 — 포획 능력치가 등급을 얼마나 넘느냐 + 힘겨루기 솜씨 + 정확한 챔질 + 방식. 5~95%. */
export function captureChance(catchStat: number, difficulty: number, quality: number, perfectHook: boolean, method: MethodKey = "float"): number {
  const p = 0.55 + (catchStat - difficulty * 9) * 0.02 + quality * 0.1 + (perfectHook ? 0.05 : 0) + methodOf(method).capture;
  return Math.round(Math.max(0.05, Math.min(0.95, p)) * 100) / 100;
}

/** 수조에 담을 수 없는 이유 — 있으면 확률 판정 없이 팔기만 된다 */
export const TANK_FULL = "수조가 가득 찼어요";
export function storeBlock(st: Pick<IslandState, "aquarium">, c: Pick<FishCatch, "family" | "boss">): string | null {
  const a = aquaOf(st);
  const fam = familyOf(c.family);
  if (!fam) return "없는 물고기예요";
  const lock = c.boss ? null : fryLockReason(a, fam); // 주인은 며칠을 싸워 잡았다 — 수조가 작다고 못 담으면 안 된다
  if (lock) return lock;
  if (a.fish.length >= tankOf(a).fish) return TANK_FULL;
  return null;
}

export type FishResult = { ok: true; state: IslandState; outcome: "stored" | "slipped" | "sold" | "junk"; coins: number; levelUp: number; firstJunk?: boolean; sizeNote?: SizeNote; sizeCoins?: number; exped?: ExpedKey[]; expedCoins?: number } | { ok: false; reason: string };
/** 누가 낚았나 — 크기 기록 · 원정 기여. 빠지면 '나'(혼자 하는 섬 · 옛 호출) */
export type CatchWho = { who: string; couple: boolean };
const NOBODY: CatchWho = { who: "me", couple: false };

/** 이 낚시터에서 한 마리 평균 무게 — 원정 목표를 정하는 값(치어가 대부분이다) */
function spotAvgKg(spot: FishSpot): number {
  // 귀한 계열은 미끼 한 단계에 1% 안팎이라 평균에 넣으면 목표가 터무니없이 높아진다 — 시작 미끼로 무는 계열로 어림한다
  const pool = poolFor(spot, spotMinBait(spot).maxGrade);
  const total = pool.reduce((n, [, w]) => n + w, 0);
  // 치어 7 : 어린 2.5 : 다 큰 0.5 쯤 — 보통 크기로 어림한다
  const one = (k: string) => 0.7 * kgOf(rollCm(k, 0, 0, 0, 0.5, 0.5)) + 0.25 * kgOf(rollCm(k, 1, 0, 0, 0.5, 0.5)) + 0.05 * kgOf(rollCm(k, 2, 0, 0, 0.5, 0.5));
  return pool.reduce((n, [k, w]) => n + (w / total) * one(k), 0);
}
/** 이번 주 원정 — 주가 바뀌었으면 새로 시작한다 */
export function expedFor(f: Pick<FishingState, "level" | "exped">, today: string, couple: boolean): Expedition {
  const week = weekOf(today);
  if (f.exped?.week === week) return f.exped;
  // 막 열린 낚시터는 미끼가 없을 수 있다 — 그 앞 낚시터로 어림해야 지금 다니는 곳에서 채울 수 있다
  const open = SPOTS.filter((x) => x.minLevel <= f.level);
  const spot = open[Math.max(0, open.length - 2)];
  return newExpedition(week, f.level, couple, spotAvgKg(spot));
}

function gain(f0: FishingState, xpGain: number, wantCoins: number, today: string, artKey?: string, grade = -1, c?: FishCatch, by: CatchWho = NOBODY) {
  const f = fishDay(f0, today);
  const used = f.dayCoins;
  const coins = Math.max(0, Math.min(wantCoins, DAILY_FISH_COINS - used));
  // 크기 기록은 모습별로 센다(치어끼리 · 다 큰 놈끼리) — 치어가 다 큰 기록을 넘을 수는 없으니 계열로 묶으면 혜택이 처음 몇 번으로 끝난다. 주인은 길이가 정해져 있어 기록이 아니다.
  let sizes = f.sizes, sizeNote: SizeNote = null;
  if (c?.cm && !c.boss && !c.junk) ({ book: sizes, note: sizeNote } = noteSize(sizes, catchArt(c), by.who, c.cm));
  const sizeCoins = sizeNote && c ? recordCoins(c.difficulty) : 0;
  let { level, xp, points } = f;
  xp += sizeNote ? Math.round(xpGain * 1.5) : xpGain;
  let levelUp = 0;
  while (level < MAX_LEVEL && xp >= xpNeed(level)) {
    xp -= xpNeed(level);
    level++;
    levelUp++;
    points += POINTS_PER_LEVEL;
  }
  const seen = artKey && !f.seen.includes(artKey) ? [...f.seen, artKey] : f.seen;
  let exped = f.exped, expedDone: ExpedKey[] = [], expedCoins = sizeCoins;
  if (c && !c.junk) {
    const add = expedAdd(expedFor(f, today, by.couple), by.who, kgOf(c.cm ?? 0), artKey ?? catchArt(c));
    exped = add.e;
    expedDone = add.newly;
    expedCoins += add.coins;
  }
  return { f: { ...f, level, xp, points, seen, sizes, exped, day: today, dayCoins: used + coins, landed: f.landed + 1, dayLanded: f.dayLanded + 1, topGrade: Math.max(f.topGrade, grade) }, coins, levelUp, sizeNote, sizeCoins, expedDone, expedCoins };
}
/** 결과에 얹는 소식 — 원정 · 크기 기록 하트는 낚시 하루 한도 밖이라 따로 더한다(expedCoins 는 둘의 합) */
const newsOf = (g: ReturnType<typeof gain>) => ({ sizeNote: g.sizeNote, sizeCoins: g.sizeCoins, exped: g.expedDone, expedCoins: g.expedCoins - g.sizeCoins });

/** 수조에 담아 보기 — roll(0~1) 이 확률 밑이면 수조로, 아니면 빠져나간다(하트 절반). */
export function tryStore(st: IslandState, c: FishCatch, chance: number, roll: number, now: number, today: string, by: CatchWho = NOBODY): FishResult {
  if (c.junk) return { ok: false, reason: "쓰레기는 수조에 넣을 수 없어요" };
  const block = storeBlock(st, c);
  if (block) return { ok: false, reason: block };
  const win = roll < chance;
  const g = gain(fishingOf(st), xpValue(c.difficulty), win ? 0 : Math.round(coinValue(c.difficulty) / 2), today, catchArt(c), gradeNo(c.grade), c, by);
  if (!win) return { ok: true, state: { ...st, coins: st.coins + g.coins + g.expedCoins, fishing: g.f }, outcome: "slipped", coins: g.coins, levelUp: g.levelUp, ...newsOf(g) };
  const added = addFish(st, c.family, c.stage, c.species, now, bossOf(c.boss)?.name);
  return { ok: true, state: { ...added, coins: added.coins + g.expedCoins, fishing: { ...g.f, stored: g.f.stored + 1, dayStored: g.f.dayStored + 1 } }, outcome: "stored", coins: 0, levelUp: g.levelUp, ...newsOf(g) };
}

/** 수조가 찼을 때 — 한 마리를 보내고 담는다. 담기에 실패하면 보내지 않는다(빈손으로 둘 다 잃으면 안 된다). */
export function tryStoreSwap(st: IslandState, c: FishCatch, releaseId: number, chance: number, roll: number, now: number, today: string, by: CatchWho = NOBODY): FishResult {
  if (roll >= chance) {
    const g = gain(fishingOf(st), xpValue(c.difficulty), Math.round(coinValue(c.difficulty) / 2), today, catchArt(c), gradeNo(c.grade), c, by);
    return { ok: true, state: { ...st, coins: st.coins + g.coins + g.expedCoins, fishing: g.f }, outcome: "slipped", coins: g.coins, levelUp: g.levelUp, ...newsOf(g) };
  }
  const freed = releaseFish(st, releaseId, now);
  if (!freed.ok) return { ok: false, reason: freed.reason };
  return tryStore(freed.state, c, 1, 0, now, today, by);
}

/** 목표 보상 받기 */
export function claimFishGoal(st: IslandState, id: string, today: string): GearResult {
  const got = claimGoal(fishingOf(st), id, today);
  if (!got) return { ok: false, reason: "아직 받을 수 없어요" };
  return { ok: true, state: { ...st, coins: st.coins + got.coins, fishing: got.f } };
}

/** 수조에 안 담고 팔기 — 하트 전부 */
export function sellCatch(st: IslandState, c: FishCatch, today: string, by: CatchWho = NOBODY): FishResult {
  if (c.junk) return { ok: false, reason: "쓰레기는 팔 수 없어요" };
  const g = gain(fishingOf(st), xpValue(c.difficulty), coinValue(c.difficulty), today, catchArt(c), gradeNo(c.grade), c, by);
  return { ok: true, state: { ...st, coins: st.coins + g.coins + g.expedCoins, fishing: g.f }, outcome: "sold", coins: g.coins, levelUp: g.levelUp, ...newsOf(g) };
}

/** 쓰레기를 치운다 — 수집함에 하나 더, 분리수거 값 약간, 경험치 약간 */
export function haulJunk(st: IslandState, c: FishCatch, today: string): FishResult {
  const j = junkOf(c.junk);
  if (!j) return { ok: false, reason: "쓰레기가 아니에요" };
  const g = gain(fishingOf(st), 3, j.coins, today);
  const before = g.f.junk[j.key] ?? 0;
  return { ok: true, state: { ...st, coins: st.coins + g.coins, fishing: { ...g.f, junk: { ...g.f.junk, [j.key]: before + 1 } } }, outcome: "junk", coins: g.coins, levelUp: g.levelUp, firstJunk: before === 0 };
}

/* ── 낚시터의 주인 ──────────────────────────────────── */

/** 주인을 건 판 — 뽑기 없이 정해져 있다 */
export function bossCatch(boss: FishBoss): FishCatch {
  const fam = familyOf(boss.family);
  if (!fam) throw new Error(`없는 계열: ${boss.family}`);
  return { family: boss.family, stage: 2, species: boss.species, grade: difficultyOf(fam, 2, boss.species).grade, difficulty: boss.difficulty, cm: boss.cm, boss: boss.key };
}
/** 주인과의 힘겨루기 — 규칙은 똑같다. 다른 건 한 판을 다 끌어와도 체력이 조금만 깎인다는 것(bossLeft). */
export const bossTune = (boss: FishBoss, eff: Pick<Record<FishStat, number>, "power" | "line">): FightTune => fightTune(boss.difficulty, eff, boss.family);
export const bossBlockOf = (f: Pick<FishingState, "bosses" | "level">, boss: FishBoss, who: string, today: string) => bossBlock(boss, f.bosses[boss.key], f.level, who, today);
export function bossOpen(st: IslandState, key: string, who: string, today: string): GearResult {
  const boss = bossOf(key), f = fishingOf(st);
  if (!boss) return { ok: false, reason: "없는 주인이에요" };
  const why = bossBlockOf(f, boss, who, today);
  if (why) return { ok: false, reason: why };
  return { ok: true, state: { ...st, fishing: { ...f, bosses: { ...f.bosses, [key]: bossStarted(f.bosses[key], who, today) } } } };
}
export function bossLost(st: IslandState, key: string, left: number, today: string): GearResult {
  const f = fishingOf(st), r = f.bosses[key];
  if (!r) return { ok: false, reason: "아직 싸운 적이 없어요" };
  return { ok: true, state: { ...st, fishing: { ...f, bosses: { ...f.bosses, [key]: bossHurt(r, left, today) } } } };
}
/** 끌어올렸다 — 수조에 담기 전에 먼저 남긴다(창을 닫아도 잡은 건 잡은 것이다). 보상은 낚시 하루 한도 밖이다. */
export function bossWon(st: IslandState, key: string, who: string, today: string): GearResult {
  const boss = bossOf(key), f = fishingOf(st), r = f.bosses[key];
  if (!boss || !r) return { ok: false, reason: "없는 주인이에요" };
  return { ok: true, state: { ...st, coins: st.coins + bossReward(boss, r.caught), fishing: { ...f, bosses: { ...f.bosses, [key]: bossBeaten(r, who, today) } } } };
}

/* ── 점수 ──────────────────────────────────────────── */

/** 한 마리 점수 — 서버(submit_fish_catch)가 같은 공식으로 계산해 저장한다. 고치면 migration 도 같이(fishingscore.test).
 *  등급이 지배하고(귀한 미끼 · 좋은 장비의 보상), 솜씨 · 챔질 · 수조가 곱해진다. 끌어올려야 점수다. */
export function catchPoints(c: Pick<FishCatch, "grade" | "stage" | "junk">, quality: number, perfect: boolean, stored: boolean): number {
  if (c.junk) return 2;
  const q = Math.max(0, Math.min(1, quality));
  return Math.floor(10 * 1.8 ** GRADES.indexOf(c.grade) * [1, 1.3, 2][c.stage] * (1 + 0.5 * q) * (perfect ? 1.1 : 1) * (stored ? 1.25 : 1) + 0.5);
}

/* ── 공개 · 순위 한 줄 ─────────────────────────────── */

/** 끌어올린 뒤 실루엣으로 뜸 들이는 시간(ms) — 귀할수록 길다. 매 판 보는 흔함은 짧아야 안 질린다. */
export const revealMs = (grade: number, reduced: boolean) => (reduced ? 300 : 450 + grade * 220);

/** 내 이번 달 순위 — 서버 fish_standing */
export type FishStanding = { rank: number | null; score: number; total: number; gap_up: number | null; partner_name: string | null; partner_score: number };

/** 결과 카드의 한 줄. 상대를 막 제친 게 가장 큰 소식이다. 순위가 없으면(로컬 · 실패) 아무것도 안 띄운다. */
export function rankLine(prev: FishStanding | null, now: FishStanding): string | null {
  if (now.rank === null) return null;
  if (prev && now.partner_name && prev.score <= prev.partner_score && now.score > now.partner_score) return `${now.partner_name} 님을 제쳤어요!`;
  if (!prev) return `이번 달 ${now.rank}위`;
  if (prev.rank === null) return `이번 달 ${now.rank}위로 올랐어요`;
  if (now.rank < prev.rank) return `이번 달 ${prev.rank}위 → ${now.rank}위`;
  if (now.rank === 1) return "이번 달 1위를 지키고 있어요";
  return now.gap_up === null ? `이번 달 ${now.rank}위` : `이번 달 ${now.rank}위 · ${now.rank - 1}위까지 ${now.gap_up.toLocaleString()}점`;
}

/* ── 키우기 ──────────────────────────────────────────── */

export type GearResult = { ok: true; state: IslandState } | { ok: false; reason: string };

export function spendPoint(st: IslandState, stat: FishStat): GearResult {
  const f = fishingOf(st);
  if (f.points <= 0) return { ok: false, reason: "쓸 수 있는 점수가 없어요" };
  if (f.stats[stat] >= STAT_CAP) return { ok: false, reason: "이 능력치는 가득 찼어요" };
  return { ok: true, state: { ...st, fishing: { ...f, points: f.points - 1, stats: { ...f.stats, [stat]: f.stats[stat] + 1 } } } };
}

function buyTier(st: IslandState, kind: "rod" | "net"): GearResult {
  const f = fishingOf(st);
  const list = kind === "rod" ? RODS : NETS;
  const next = list[f[kind] + 1];
  if (!next) return { ok: false, reason: "가장 좋은 장비예요" };
  if (st.coins < next.price) return { ok: false, reason: `하트가 ${(next.price - st.coins).toLocaleString()}개 모자라요` };
  return { ok: true, state: { ...st, coins: st.coins - next.price, fishing: { ...f, [kind]: f[kind] + 1 } } };
}
export const buyRod = (st: IslandState) => buyTier(st, "rod");
export const buyNet = (st: IslandState) => buyTier(st, "net");
