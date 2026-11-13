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
 *  · 하트 벌이에 하루 상한은 없다 [사용자 2026-11-04: "물고기 낚은 후 하루 하트 얻는 제한도 없애"]. 낚은 만큼 받는다.
 *  · 미끼 [사용자: "미끼가 낚시 할 수 있는 횟수도 높은 미끼일수록 높은 등급의 물고기가 잡힐 수 있게"] — 던질 때마다 줄어든다. 미끼 등급이 곧 물 수 있는
 *    물고기의 상한이고, 비싼 미끼일수록 한 묶음의 횟수도 많다. 지렁이는 매일 채워져서 하트가 없어도 낚시는 끊기지 않는다.
 *  · 방식 5가지(METHODS) — 손이 하는 일이 전부 다르다. 찌(누르고 떼기) · 루어(박자 + 좌우 끌기) · 뜰채(겨눠서 건지기) · 심해(릴 돌리기) · 집어등(밤바다 — 불빛 밝기를 지켜 모았다가 터지는 순간 채기).
 *    루어 · 뜰채 · 심해의 규칙은 fishingmodes.ts, 집어등은 fishinglight.ts.
 *  · 꽝 [사용자: "일정 확률로 바다 쓰레기(꽝)도 낚을 수 있는 재미 포인트 … 쓰레기의 종류는 여러개"] — 끌어올리기 전까진 물고기와 똑같다. 낚시터마다 다른 쓰레기가 있고 수집함에 남는다.
 *  · ⚠ 섬 엔진은 타입만 부른다. 뽑기는 호출자가 넘긴 seed 로만(같은 입력 = 같은 결과, 테스트 가능). */
import type { IslandState } from "./island.ts";
import type { SpecialCard } from "./fishplus.ts";
import { josa } from "./josa.ts";
import { FAMILIES, GRADES, TANK_FULL_REASON, seenForms, addFish, adultDifficulty, aquaLuck, aquaOf, familyOf, fishArtKey, fishName, keepInNet, raisedShare, releaseFish, saleValue, seeNews, speciesOf, storeReason, syncAqua, unseenNews, type AquaFamily, type AquaNews, type Grade } from "./aquarium.ts";
import { claimGoal, fishDay } from "./fishinggoals.ts";
import { awakeBlock, bossRecOf, isAwakeKey, masterySaleBonus, noteMastery, withAwakeRec } from "./fishmastery.ts";
import { tideEffect } from "./fishtide.ts";
import { BOSS_TAKEN, TIMED_CHANCE, TIMED_SIDE_CHANCE, bossBeaten, bossBlock, bossGone, bossHurt, bossOf, bossReward, bossStarted, expedAdd, finalAllowed, kgOf, laterDay, newExpedition, noteSize, rollCm, timedAt, weekOf, type BossRecord, type ExpedKey, type Expedition, type FishBoss, type FishMoment, type SizeBook, type SizeNote } from "./fishingworld.ts";

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
/** 지렁이는 매일 이만큼까지 채워진다 — 하트가 바닥나도 낚시가 막히지 않게 */
export const FREE_WORMS = 20;

/** 민물 · 바다 — 강과 늪엔 민물고기만, 바다엔 바닷물고기만 산다[사용자: "강이나 특정 습지 이런대는 민물고기만 나오도록하고 바다에는 바닷물고기 … 꼭 한국의 특정지역"]. */
export type FishWater = "river" | "lake" | "valley" | "wetland" | "hall" | "sea";
export const WATER_NAME: Readonly<Record<FishWater, string>> = { river: "강", lake: "호수", valley: "계곡", wetland: "늪", hall: "열대관", sea: "바다" };
export const FRESH_FAMILIES: ReadonlySet<string> = new Set(["guppy", "tetra", "sweetfish", "goldfish", "betta", "catfish", "angel", "discus", "koi", "ray", "arowana", "salmon", "crucian", "pale_chub", "chinese_minnow", "smelt", "bullhead", "common_carp", "masu_salmon", "snakehead", "mandarin_fish", "perch_kkeokji", "eel", "lenok", "bitterling", "shiri", "sturgeon", "loach", "dark_chub", "sleeper", "gudgeon", "skygazer", "rainbow_trout", "grass_carp", "bluegill", "largemouth_bass", "char", "ricefish", "arapaima", "oscar", "molly", "platy", "zebra_danio", "pleco", "corydoras", "gourami", "redtail_catfish", "piranha", "electric_eel"]);
/** 관상어 — 한국 강 · 늪에 사는 물고기가 아니다. 어울리는 곳(청계천 관상어 거리 · 국립생태원 열대관)에만 둔다[사용자: "관상어는 빼고 … 맞지 않다면 적절한 곳에 배치해"]. */
export const ORNAMENTAL_FAMILIES: ReadonlySet<string> = new Set(["guppy", "tetra", "goldfish", "betta", "angel", "discus", "ray", "arowana", "arapaima", "oscar", "molly", "platy", "zebra_danio", "pleco", "corydoras", "gourami", "redtail_catfish", "piranha", "electric_eel"]);
/** common — 이 낚시터에서 '흔한 물고기'로 치는 미끼 단계(없으면 이 낚시터의 가장 싼 미끼 단계). 미끼 1% 규칙은 이 단계 위의 계열에만 걸린다.
 *  열대관처럼 그 낚시터의 대표 물고기(엔젤피시)가 한 단계 위 미끼부터 무는 곳에만 쓴다. */
export type FishSpot = { key: string; name: string; water: FishWater; minLevel: number; pool: readonly (readonly [string, number])[]; art?: string; common?: number; push?: number };
/** 그림 파일 key — 새 낚시터는 자기 그림이 올 때까지 art 로 비슷한 그림을 빌린다 */
export const spotArtKey = (s: Pick<FishSpot, "key" | "art">) => s.art ?? `spot_${s.key}`;
/** 낚시터는 전부 실제 한국 지역이다. key 는 저장값 · 그림 파일 이름이라 옛 그대로 둔다.
 *  ⚠ pool 순서가 무게다 — rollCatch 는 흔한 계열에 (1 + lift × pool 안 자리)를 곱한다. 새 흔한 계열은 **원래 흔한 계열 바로 뒤(귀한 계열 앞)에 작은 무게로** 넣는다.
 *  2026-11-13 4차 54계열을 귀한 계열 뒤(끝)에 붙였더니 가장 큰 덤을 받아 대표 물고기를 밀어냈다(우포늪 붕어 37% → 13%, 생태원 테트라 · 베타 · 구피 26% → 8%).
 *  원래 흔한 계열은 4차 전 자리 그대로고 새 계열 몫은 합쳐 10~15%(행운 5) — fishingbatch4.test 가 4차 전 몫의 80% 를 잠근다. 귀한 계열의 자리는 확률과 무관하다(1% 띠는 계열마다 따로 쌓인다). */
export const SPOTS: readonly FishSpot[] = [
  { key: "brook", name: "서울 청계천", water: "river", minLevel: 1, push: 0, pool: [["guppy", 50], ["tetra", 40], ["goldfish", 15], ["betta", 10]] },
  { key: "dumulmeori", name: "양평 두물머리", water: "river", minLevel: 2, push: 0.5, pool: [["pale_chub", 40], ["crucian", 34], ["bullhead", 24], ["bitterling", 4.5], ["gudgeon", 4], ["common_carp", 10], ["grass_carp", 10]] },
  { key: "pond", name: "창녕 우포늪", water: "wetland", minLevel: 3, push: 1, pool: [["crucian", 40], ["pale_chub", 26], ["bullhead", 22], ["bitterling", 2.5], ["loach", 2], ["ricefish", 2], ["bluegill", 1.5], ["catfish", 40], ["common_carp", 20], ["koi", 15], ["snakehead", 12]] },
  { key: "soyang", name: "춘천 소양호", water: "lake", minLevel: 4, push: 1.25, pool: [["smelt", 42], ["crucian", 30], ["pale_chub", 24], ["bluegill", 7], ["common_carp", 15], ["mandarin_fish", 10], ["skygazer", 10], ["largemouth_bass", 10], ["char", 8]] },
  { key: "seomjin", name: "하동 섬진강", water: "river", minLevel: 5, push: 1, pool: [["sweetfish", 42], ["pale_chub", 28], ["bullhead", 22], ["dark_chub", 3], ["gudgeon", 2.5], ["sleeper", 2.5], ["salmon", 15], ["mandarin_fish", 10], ["eel", 8], ["shiri", 10]], art: "spot_seomjin" },
  { key: "bonghwa", name: "봉화 계곡", water: "valley", minLevel: 6, push: 1.75, pool: [["chinese_minnow", 42], ["pale_chub", 30], ["bullhead", 20], ["dark_chub", 6.5], ["masu_salmon", 15], ["perch_kkeokji", 20], ["lenok", 6], ["shiri", 10], ["rainbow_trout", 10]] },
  { key: "jungle", name: "서천 국립생태원", water: "hall", minLevel: 7, push: 1.75, common: 1, pool: [["angel", 36], ["tetra", 30], ["betta", 24], ["guppy", 20], ["molly", 1.5], ["platy", 1], ["zebra_danio", 1], ["corydoras", 1], ["gourami", 1], ["pleco", 0.8], ["discus", 30], ["ray", 20], ["arowana", 10], ["oscar", 10], ["piranha", 10], ["redtail_catfish", 8]] },
  { key: "hwacheon", name: "화천 화천천", water: "river", minLevel: 8, push: 2.25, pool: [["smelt", 40], ["chinese_minnow", 30], ["pale_chub", 24], ["masu_salmon", 60], ["lenok", 4], ["rainbow_trout", 12], ["char", 8]] },
  { key: "harbor", name: "통영 항구", water: "sea", minLevel: 9, push: 1.75, common: 1, pool: [["mackerel", 40], ["rockfish_bollak", 30], ["flounder", 40], ["rockfish", 30], ["black_seabream", 20], ["sea_bream", 20], ["starfish", 15], ["anchovy", 1.5], ["scorpionfish", 1.5], ["filefish", 4], ["spanish_mackerel", 3.5], ["sea_bass", 18], ["squid", 10], ["croaker", 10], ["yellowtail", 8], ["octopus", 6], ["striped_jack", 5], ["puffer", 3]] },
  { key: "sanriver", name: "단양 남한강", water: "river", minLevel: 10, push: 2.75, pool: [["bullhead", 36], ["pale_chub", 30], ["crucian", 26], ["sleeper", 7], ["common_carp", 35], ["mandarin_fish", 30], ["snakehead", 12], ["perch_kkeokji", 8], ["eel", 6], ["skygazer", 10], ["sturgeon", 6]] },
  { key: "reef", name: "서귀포 문섬", water: "sea", minLevel: 12, push: 1.75, pool: [["clown", 40], ["black_seabream", 30], ["starfish", 24], ["hairtail", 15], ["nurse_shark", 15], ["leopard_shark", 15], ["sea_turtle", 30], ["barred_knifejaw", 10], ["octopus", 8], ["manta", 15], ["parrotfish", 10], ["moray", 8], ["seahorse", 8]] },
  { key: "ocean", name: "울릉도 앞바다", water: "sea", minLevel: 18, push: 3, pool: [["sailfin_sandfish", 40], ["rockfish", 30], ["flounder", 24], ["cod", 4], ["spanish_mackerel", 3.5], ["cutlassfish_pollock", 20], ["squid", 18], ["bluefin", 60], ["blue_shark", 40], ["manta", 25], ["hammerhead", 15], ["great_white", 10], ["whale_shark", 15], ["skate", 10]] },
  { key: "palace", name: "기장 용궁사 앞바다", water: "sea", minLevel: 25, push: 1.25, pool: [["rising", 40], ["striped_jack", 32], ["oarfish", 26], ["marlin", 4.5], ["swordfish", 4], ["megamouth", 15], ["whale_shark", 20]] },
  { key: "starsea", name: "고성 거진항", water: "sea", minLevel: 32, push: 1.5, pool: [["rising", 38], ["anglerfish", 32], ["hammerhead", 26], ["astral", 70]] },
  // 심해는 맨 끝 낚시터인데 기본 계열이 영웅(떡밥)이라 한 번당 용궁사(전설 · 발광 미끼)보다 덜 벌었다(33 대 50).
  // 2026-11-11 떡밥 값을 내려 시작 미끼로 57. 물고기 구성은 그대로 — 미끼 1% 규칙(사용자 결정)을 지킨다.
  { key: "abyss", name: "울릉분지 심해", water: "sea", minLevel: 36, push: 2.9, pool: [["gulper_eel", 40], ["octopus", 32], ["blue_shark", 26], ["viperfish", 7], ["anglerfish", 30], ["oarfish", 20], ["coelacanth", 12], ["giant_squid", 10], ["kraken", 3], ["frilled_shark", 8]] },
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
/** 미끼 — maxGrade 가 물 수 있는 등급의 상한(GRADES 번호), uses 는 한 묶음으로 던질 수 있는 횟수. 높을수록 둘 다 크다.
 *  값(2026-11-11 경제 리뷰): 미끼 1% 규칙 때문에 한 단계 올린 미끼가 더 버는 건 몇 하트뿐인데, 한 번 값은 두 배씩 올라
 *  오징어살 · 떡밥 · 별가루는 쓰라고 만든 낚시터에서도 손해였다(행운 10 · 판매 기준 한 번당 오징어살 우포늪 −7 · 떡밥 울릉도 −14 · 별가루 용궁사 −21).
 *  오징어살 480 → 320 · 떡밥 1,200 → 600 · 별가루 6,400 → 5,200 — 그 낚시터에서 본전 이상(별가루는 행운 25 부터 심해도). 순서는 그대로. */
export const BAITS: readonly FishBait[] = [
  { key: "bait_worm", name: "지렁이", maxGrade: 1, uses: 10, price: 60, desc: `매일 ${FREE_WORMS}회까지 채워져요` },
  { key: "bait_shrimp", name: "민물새우", maxGrade: 2, uses: 15, price: 180, desc: "엔젤피시 · 흰동가리가 물어요" },
  { key: "bait_squid", name: "오징어살", maxGrade: 3, uses: 20, price: 320, desc: "디스커스 · 비단잉어가 물어요" },
  { key: "bait_paste", name: "황금 떡밥", maxGrade: 4, uses: 25, price: 600, desc: "참다랑어 · 아로와나가 물어요" },
  { key: "bait_glow", name: "심해 발광 미끼", maxGrade: 5, uses: 30, price: 2400, desc: "고래상어 · 등용어가 물어요" },
  { key: "bait_pearl", name: "용궁 진주 미끼", maxGrade: 6, uses: 35, price: 4200, desc: "별무리어가 물어요" },
  { key: "bait_star", name: "별가루 미끼", maxGrade: 7, uses: 40, price: 5200, desc: "태초 등급까지 물어요" },
];
export const baitIndex = (key: string) => BAITS.findIndex((x) => x.key === key);

export type MethodKey = "float" | "lure" | "scoop" | "deep" | "light";
/** night — 밤바다에서만 켤 수 있는 방식(castBlock 이 막는다). 시각은 호출자가 넘긴다(엔진은 시계를 읽지 않는다) */
export type FishMethod = { key: MethodKey; name: string; minLevel: number; baitCost: number; adult: number; lift: number; capture: number; junk: number; how: string; good: string; night?: boolean };
/** 낚시 방식 — 같은 낚시터도 방식에 따라 다른 물고기가 다른 비율로 온다 */
export const METHODS: readonly FishMethod[] = [
  { key: "float", name: "찌낚시", minLevel: 1, baitCost: 1, adult: 1, lift: 0, capture: 0, junk: 1, how: "입질에 챔질하고, 누르고 떼며 줄을 감아요", good: "기본" },
  { key: "lure", name: "루어", minLevel: 2, baitCost: 1, adult: 2.4, lift: 0, capture: 0, junk: 0.6, how: "박자 맞춰 유인하고, 물고기 반대쪽으로 끌어요", good: "다 큰 물고기가 잘 와요" },
  { key: "scoop", name: "뜰채", minLevel: 3, baitCost: 1, adult: 0, lift: 0, capture: 0.12, junk: 1, how: "떠오른 그림자를 앞서 겨눠 건지고, 기울지 않게 들어 올려요", good: "고를 수 있고 잘 담겨요" },
  { key: "deep", name: "심해", minLevel: 5, baitCost: 2, adult: 1.4, lift: 0.9, capture: -0.04, junk: 1.5, how: "릴을 빙글빙글 돌려 끌어올려요. 미끼를 2개 써요", good: "귀한 물고기가 와요" },
  // 집어등(2026-11-12) [사용자 승인: "밤에만 열리는 다섯 번째 방식입니다. 불빛으로 물고기를 모았다가 터지는 순간 낚아 올립니다"].
  // lift · adult 는 찌와 같다 — 귀한 등급을 더 부르지 않는다(미끼 1% 규칙). 밤 물고기 쪽으로 기우는 건 같은 단계 안에서만(rollCatch 의 lightRepick).
  // 쓰레기는 덜 걸린다 — 불빛에 모이는 건 살아 있는 것뿐이라. Lv.12 — 바다 낚시터 둘(통영 · 문섬)이 열린 뒤
  { key: "light", name: "집어등", minLevel: 12, baitCost: 1, adult: 1, lift: 0, capture: 0, junk: 0.5, how: "불빛을 초록 칸에 맞춰 물고기를 모으고, 무리가 터지는 순간 위로 채요. 밤바다에서만 켤 수 있어요", good: "밤 물고기가 모여요", night: true },
];
export const methodOf = (key: MethodKey) => METHODS.find((x) => x.key === key) ?? METHODS[0];
/** 저장해 둔 방식(기기 prefs) 읽기 — 모르는 값은 찌로. 집어등은 method 칸이 아니라 lamp 칸에 둔다:
 *  옛 번들은 method 를 COACH[method] 로 바로 찾아서, "light" 가 그 칸에 있으면 되돌린 앱의 안내 창이 깨진다(steps 가 없다). */
export type MethodPrefs = { method?: unknown; lamp?: unknown };
export function prefMethod(p: MethodPrefs): MethodKey {
  if (p.lamp === true) return "light";
  return METHODS.some((m) => m.key === p.method && !m.night) ? (p.method as MethodKey) : "float";
}
/** prefMethod 의 짝 — 집어등이면 method 칸은 건드리지 않고(옛 값 그대로) lamp 만 켠다 */
export const prefMethodWrite = (m: MethodKey): { method?: MethodKey; lamp: boolean } => (methodOf(m).night ? { lamp: true } : { method: m, lamp: false });

/** 집어등에 모이는 밤 물고기 — 한국 밤바다 집어등 낚시의 대상(오징어 · 갈치 · 고등어 · 볼락 · 전갱이)과 불빛을 단 초롱아귀.
 *  새 계열은 만들지 않는다(그림 · 3D · 서버 목록이 같이 필요하다) — 한치는 FAMILIES 에 없어 빠졌다.
 *  2026-11-13 4차 — 멸치(불빛으로 모으는 멸치잡이 불배)와 삼치(불빛에 모인 멸치 · 전어 떼를 쫓아 온다)를 더했다. 같은 미끼 단계 안에서만 기운다(lightRepick) —
 *  찌로는 울릉도 · 통영에서 5% 안팎인 삼치가 집어등이면 같은 단계의 25% 남짓으로 오른다(대표 물고기 몫이 아니라 집어등의 맛이다). */
export const NIGHT_FAMILIES: ReadonlySet<string> = new Set(["squid", "hairtail", "mackerel", "rockfish_bollak", "striped_jack", "giant_squid", "anglerfish", "anchovy", "spanish_mackerel"]);
/** 같은 미끼 단계 안에서 밤 물고기가 받는 무게 배율 */
export const LIGHT_NIGHT_WEIGHT = 6;
const LIGHT_SEED = 0x3c6ef372;

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
  { key: "junk_buoy", name: "스티로폼 부표", line: "항구 어딘가에서 이걸 찾고 있을 거예요", coins: 3, spot: "harbor" },
  { key: "junk_basket", name: "재첩 바구니", line: "안에 재첩 한 알이 남아 있어요", coins: 4, spot: "seomjin" },
  { key: "junk_oar", name: "부러진 나룻배 노", line: "두 강이 만나는 곳에서 놓친 모양이에요", coins: 3, spot: "dumulmeori" },
  { key: "junk_ring", name: "유람선 구명환", line: "소양호 유람선 이름이 반쯤 지워졌어요", coins: 5, spot: "soyang" },
  { key: "junk_pole", name: "등산 스틱", line: "계곡 바위에 걸려 있던 걸까요", coins: 3, spot: "bonghwa" },
  { key: "junk_stool", name: "얼음낚시 의자", line: "주인은 추워서 먼저 들어갔나 봐요", coins: 4, spot: "hwacheon" },
  { key: "junk_helmet", name: "패러글라이딩 헬멧", line: "하늘에서 떨어졌나 봐요. 주인은 무사해요", coins: 6, spot: "sanriver" },
  { key: "junk_probe", name: "심해 탐사선 부품", line: "깊이 2천 미터의 물건치고는 멀쩡해요", coins: 20, spot: "abyss" },
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

/** 요리 · 훈련의 기세(도시락 힘)까지 더한 능력치 — 줄을 감는 힘이 오른다.
 *  수조의 다 큰 계열 하나에 행운 +1(다섯까지, aquaLuck) — 키운 보람이 낚시로 돌아온다. 밸런스 테스트는 맨 능력치(effectiveStats)로 재므로 이 덤은 작게 둔다. */
export function buffedStats(st: Pick<IslandState, "buffs"> & { aquarium?: IslandState["aquarium"] }, f: Pick<FishingState, "stats" | "rod" | "net">, now: number): Record<FishStat, number> {
  const e0 = effectiveStats(f), b = st.buffs?.hunt;
  const e = { ...e0, luck: e0.luck + aquaLuck(aquaOf(st)) };
  return b && b.until > now ? { ...e, power: Math.round(e.power * (1 + b.amount / 100)) } : e;
}

/** 다음 레벨까지 필요한 경험치 — 낚시터마다 머무는 던지기 수가 고르게 늘도록 세 토막으로 잡았다(2026-11-05 밸런스 검토).
 *  예전(30 + 6L²)은 레벨 10까지 160번 만에 지나가 첫 낚시터들을 4~40번만 보고 넘어갔고, 레벨 18 → 25(울릉도)는 한 곳에서 900번을 넘게 던졌다.
 *  · 1~11: 낚시터 하나에 20~90번 · 12~24: 한 레벨 50~70번(문섬 · 울릉도의 물고기는 경험치가 낮다) · 25~: 예전 곡선의 약 70%(깊은 바다는 한 마리 경험치가 크고, 힘겨루기가 세져 덜 끌어올린다)
 *  해금 레벨(SPOTS.minLevel)은 그대로 둔다 — 옮기면 이미 연 낚시터가 다시 잠긴다. fishingbalance.test 가 머무는 던지기 수를 잠근다. */
export const xpNeed = (level: number) => (level <= 11 ? 160 + 52 * level : level <= 24 ? 900 + 25 * (level - 12) : Math.round(30 + level * level * 4.2));

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

/** 품종 순서별 기본 무게 — 5번째 품종이 생겨도 NaN 이 되지 않게 표 밖은 마지막 값의 절반씩 줄인다 */
const SPECIES_WEIGHT = [50, 28, 16, 6] as const;
export const speciesWeight = (i: number) => (i < SPECIES_WEIGHT.length ? SPECIES_WEIGHT[i] : SPECIES_WEIGHT[SPECIES_WEIGHT.length - 1] / 2 ** (i - SPECIES_WEIGHT.length + 1));

/** junk 가 있으면 물고기가 아니라 쓰레기다 — 끌어올리기 전까지 화면은 모른다 */
/** push — 낚시터가 깊을수록 같은 등급도 더 세게 버틴다(힘겨루기에만 쓴다 — 판매가 · 경험치 · 포획 확률은 difficulty 그대로) */
export type FishCatch = { family: string; stage: 0 | 1 | 2; species?: string; grade: Grade; difficulty: number; junk?: string; cm?: number; boss?: string; push?: number;
  /** 물고기 · 꽝이 아닌 특별한 것(유리병 편지 · 보물 — fishplus.ts). 꽝 수집함 · 피버 · 순위판에 안 들어간다 */
  special?: { kind: "bottle" | "treasure"; id: string; title: string };
  /** 어느 낚시터에서 물었나(spot key, rollCatch 가 찍는다) — 낚시터 숙련도(fishmastery.ts)가 센다. 주인 · 특별한 것 · 옛 물고기엔 없다 */
  at?: string };
/** 낚시터마다 더해지는 힘(FishSpot.push) — 그 낚시터에 머무는 레벨의 보통 능력치로 끌어올림이 75~85%(첫 낚시터는 95%)가 되게
 *  사람 흉내 봇으로 잰 값이다(fishingbalance.test). 깊은 곳일수록 크지만 곧게 늘지 않는다 — 기본 물고기 등급이 낚시터마다 다르다. */
export const spotPush = (spot: Pick<FishSpot, "push">) => spot.push ?? 0;
/** 힘겨루기 · 챔질 · 유인에 쓰는 세기 */
export const fightLevel = (c: Pick<FishCatch, "difficulty" | "push">) => c.difficulty + (c.push ?? 0);

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

/** avoid — 방금 같은 계열이 연달아 나왔으면 그 계열을 흔한 물고기 뽑기에서 한 번 뺀다(50번에 같은 물고기만 이어지지 않게) */
/** size — 대물 뽑기 문턱에 더하는 값(만든 '빛 미끼' — fishcraft.ts). 길이 뽑기는 별도 주사위라 계열 · 등급 · 단계 뽑기는 그대로다. 없으면 0 */
export type CatchOpts = { bait?: number; method?: MethodKey; junk?: boolean; when?: FishMoment; avoid?: string; size?: number };
/** 같은 계열이 이만큼 연달아 나오면 다음 한 번은 다른 계열이 나온다 */
export const STREAK_MAX = 5;
const TIMED_SEED = 0x51ed27f;
const SIZE_SEED = 0x1b873593;
/** 길이는 별도 뽑기 — 길이를 더해도 물고기 뽑기 순서는 그대로다.
 *  trophy — 대물 문턱 덤: 물때(사리, fishtide.tideEffect) + 만든 '빛 미끼'(fishcraft.ts). 대물의 길이 범위는 그대로 */
function sizedCatch<T extends FishCatch>(c: T, luck: number, cast: number, seed: number, trophy = 0): T {
  const r = rng((seed ^ SIZE_SEED) >>> 0);
  return { ...c, cm: rollCm(c.family, c.stage, luck, cast, r(), r(), trophy) };
}
/** 무엇이 무는가 — 행운 · 캐스팅 · 미끼 · 방식이 다 큰 물고기와 귀한 쪽으로 기울인다. 미끼 등급을 넘는 물고기는 물지 않는다. 순수.
 *  junk: true 면 일정 확률로 쓰레기(별도 뽑기 — 쓰레기를 켜도 물고기 뽑기 순서는 그대로다). */
export function rollCatch(spot: FishSpot, luck: number, cast: number, seed: number, opts: CatchOpts = {}): FishCatch {
  const r = rng(seed);
  const how = methodOf(opts.method ?? "float");
  // 물때(2026-11-12) — 바다에서 사리면 대물이 조금 더. 길이 뽑기에만 닿는다(등급 · 계열 · 미끼 1% 규칙은 그대로 — luck 으로 넘기지 않는 이유)
  const trophy = tideEffect(spot.water, opts.when?.moon).trophy;
  // 때 손님 — 이 시간 · 이 날씨에 이 낚시터에만 다 큰 모습으로 문다. 별도 뽑기라 다른 뽑기 순서는 그대로다.
  if (opts.when) {
    const capNow = opts.bait === undefined ? GRADES.length - 1 : BAITS[Math.min(BAITS.length - 1, opts.bait)].maxGrade;
    const guests = timedAt(spot.key, opts.when).filter((t) => gradeNo(speciesOf(t.species)?.grade ?? "태초") <= capNow);
    const t = rng((seed ^ TIMED_SEED) >>> 0);
    // 원래 손님은 [0, TIMED_CHANCE) 띠, 4차 곁 칸 손님(side)은 바로 뒤 TIMED_SIDE_CHANCE 띠 — 같은 주사위라 원래 손님의 몫 · 결과가 4차 이전 그대로다
    const main = guests.filter((g) => !g.side), side = guests.filter((g) => g.side);
    const g0 = t();
    const from = main.length && g0 < TIMED_CHANCE ? main : side.length && g0 >= TIMED_CHANCE && g0 < TIMED_CHANCE + TIMED_SIDE_CHANCE ? side : null;
    if (from) {
      const pick = from[Math.floor(t() * from.length) % from.length];
      const fam = FAMILIES.find((f) => f.finals.some((x) => x.key === pick.species));
      if (fam) {
        // 은어 · 메기 · 해파리처럼 이때만 오는 물고기는 다른 물고기처럼 대개 어리게 잡혀 수조에서 큰다. 나머지는 이때만 만나는 다 큰 모습이다.
        const v = t();
        // 뜰채는 다 큰 놈을 못 건진다(METHODS.scoop.adult = 0) — 때 손님도 같은 규칙이라 어린 모습으로 온다
        const young: 0 | 1 = v < 0.6 ? 0 : 1;
        const stage: 0 | 1 | 2 = how.adult <= 0 ? young : spot.pool.some(([k]) => k === fam.key) ? 2 : v < 0.88 ? young : 2;
        return sizedCatch({ family: fam.key, stage, ...(stage === 2 ? { species: pick.species } : {}), ...difficultyOf(fam, stage, stage === 2 ? pick.species : undefined), push: spotPush(spot), at: spot.key }, luck, cast, seed, trophy + (opts.size ?? 0));
      }
    }
  }
  const tier = opts.bait ?? 0;
  const cap = opts.bait === undefined ? GRADES.length - 1 : BAITS[Math.min(BAITS.length - 1, tier)].maxGrade;
  const lift = luck * 0.012 + cast * 0.6 + how.lift;
  const pool = poolFor(spot, cap);
  const usable = pool.length ? pool : spot.pool.slice(0, 1);
  // 미끼는 '열리는 것'이지 '쏟아지는 것'이 아니다 — 이 낚시터의 시작 미끼보다 높은 미끼가 필요한 계열은 미끼가 한 단계 오를 때마다 약 1% 씩만 는다
  // [사용자 2026-11-03: "미끼가 좋을수록 좋은 물고기 확률이 너무 큰 것 같아 … 단계별로 1%정도 차이로만"]. 미끼를 안 주면(옛 호출) 전부 기본 계열이다.
  const baseTier = opts.bait === undefined ? 0 : Math.max(baitTierOf(usable), Math.min(tier, spot.common ?? -1));
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
    const base0 = usable.filter(([k]) => needOf(k) <= baseTier);
    const base1 = base0.length ? base0 : usable;
    const base = opts.avoid && base1.length > 1 ? base1.filter(([k]) => k !== opts.avoid) : base1;
    // 기본 계열끼리는 뒤쪽일수록 무게를 더 받는다
    family = pickWeighted(base.map(([k, w]) => [k, w * (1 + lift * spot.pool.findIndex((x) => x[0] === k))] as const), Math.min(0.999999, (v0 - cum) / Math.max(0.0001, 1 - cum)));
    if (how.night) family = lightRepick(family, base, needOf, lift, spot, seed);
  } else if (how.night) {
    family = lightRepick(family, usable.filter(([k]) => needOf(k) > baseTier), needOf, lift, spot, seed);
  }
  const fam = familyOf(family);
  if (!fam) throw new Error(`없는 계열: ${family}`);
  const finals = fam.finals.filter((x) => gradeNo(x.grade) <= cap && finalAllowed(x.key, spot.key, opts.when));
  const adult = finals.length ? (0.06 + luck * 0.0015 + cast * 0.035 + tier * 0.01) * how.adult : 0;
  const juv = 0.25 + luck * 0.003 + (how.key === "lure" ? 0.15 : 0);
  const v = r();
  const stage: 0 | 1 | 2 = v < adult ? 2 : v < adult + juv ? 1 : 0;
  const species = stage === 2
    ? pickWeighted(finals.map((x) => [x.key, speciesWeight(fam.finals.indexOf(x)) * (1 + lift * fam.finals.indexOf(x) * 2)] as const), r())
    : undefined;
  const real: FishCatch = sizedCatch({ family, stage, ...(species ? { species } : {}), ...difficultyOf(fam, stage, species), push: spotPush(spot), at: spot.key }, luck, cast, seed, trophy + (opts.size ?? 0));
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

/** 집어등 — 이미 뽑힌 계열과 **같은 미끼 단계**의 계열 사이에서만 밤 물고기 쪽으로 다시 고른다.
 *  단계(= 미끼 1% 규칙이 정하는 몫)는 찌와 한 판도 다르지 않다 — 같은 seed 면 찌와 단계가 같다(fishinglight.test 가 잠근다).
 *  뽑기 줄은 따로(LIGHT_SEED) — 다른 방식의 r() 순서는 그대로다. */
function lightRepick(picked: string, from: readonly (readonly [string, number])[], needOf: (k: string) => number, lift: number, spot: FishSpot, seed: number): string {
  const tier = needOf(picked);
  const same = from.filter(([k]) => needOf(k) === tier);
  if (same.length < 2) return picked;
  const r = rng((seed ^ LIGHT_SEED) >>> 0);
  return pickWeighted(same.map(([k, w]) => [k, w * (1 + lift * Math.max(0, spot.pool.findIndex((x) => x[0] === k))) * (NIGHT_FAMILIES.has(k) ? LIGHT_NIGHT_WEIGHT : 1)] as const), r());
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

/** 지금 남은 횟수 — 지렁이는 날이 바뀌면(오늘이 채운 날보다 뒤) FREE_WORMS 까지 채워진 셈이다(저장은 던질 때 한다).
 *  날짜를 되돌린 날은 채우지 않는다 — 예전엔 '같은 날인가'만 봐서 날짜를 번갈아 바꾸면 날마다 공짜 지렁이가 다시 찼다. */
export function baitStock(f: Pick<FishingState, "baits" | "wormDay">, key: string, today: string): number {
  const have = f.baits[key] ?? 0;
  return key === BAITS[0].key && today > f.wormDay ? Math.max(have, FREE_WORMS) : have;
}

/** 지금 쓸 미끼 — 고른 미끼가 이 낚시터에서 안 물면 물기 시작하는 미끼로, 떨어졌으면 남은 것 중 가장 싼 것으로 넘어간다. 글자판과 낚시터 그림이 같은 답을 본다. */
export function currentBait(f: Pick<FishingState, "baits" | "wormDay">, spot: FishSpot, pick: string | null, cost: number, today: string): { shown: FishBait; bait: FishBait } {
  const i = pick ? baitIndex(pick) : -1;
  const fitting = BAITS.filter((b) => poolFor(spot, b.maxGrade).length > 0);
  const shown = i >= 0 && fitting.includes(BAITS[i]) ? BAITS[i] : spotMinBait(spot);
  return { shown, bait: baitStock(f, shown.key, today) >= cost ? shown : fitting.find((b) => baitStock(f, b.key, today) >= cost) ?? shown };
}

/** 집어등을 못 켜는 이유 — 앞머리는 늘 같고 뒤에 무엇이 모자란지 붙인다 */
export const LIGHT_BLOCK = "집어등은 밤바다에서만 켤 수 있어요";
/** 못 던지는 이유 — 화면과 저장이 같은 판정을 쓴다.
 *  night — 지금이 집어등 밤인가(fishingworld.lightNight(gameNow()), 화면이 계산해 넘긴다). 안 넘기면 밤이 아닌 것으로 친다(모르면 막는다). */
export function castBlock(f: Pick<FishingState, "baits" | "wormDay" | "level">, spot: FishSpot, method: MethodKey, baitKey: string, today: string, night = false): string | null {
  const how = methodOf(method);
  const bait = BAITS[baitIndex(baitKey)];
  if (!bait) return "미끼를 골라 주세요";
  if (f.level < how.minLevel) return `${josa(how.name, "은/는")} 낚시 Lv.${how.minLevel}부터 할 수 있어요`;
  if (how.night && spot.water !== "sea") return `${LIGHT_BLOCK} · 바다 낚시터를 골라 주세요`;
  if (how.night && !night) return `${LIGHT_BLOCK} · 저녁 7시부터 새벽 5시까지`;
  if (!poolFor(spot, bait.maxGrade).length) return `${josa(spot.name, "은/는")} ${spotMinBait(spot).name}부터 물어요`;
  const have = baitStock(f, baitKey, today);
  if (have < how.baitCost) return have > 0 ? `${josa(how.name, "은/는")} 미끼가 ${how.baitCost}개 필요해요` : `${josa(bait.name, "이/가")} 다 떨어졌어요`;
  return null;
}

/** 던질 때 미끼를 쓴다. 놓쳐도 돌아오지 않는다 — 그게 놓치는 값이다. 던진 거리가 기록을 넘으면 함께 남긴다. */
export function spendBait(st: IslandState, spot: FishSpot, method: MethodKey, baitKey: string, today: string, castM = 0, night = false): GearResult {
  const f = fishingOf(st);
  const why = castBlock(f, spot, method, baitKey, today, night);
  if (why) return { ok: false, reason: why };
  const worm = BAITS[0].key;
  const baits = { ...f.baits, [worm]: baitStock(f, worm, today) };
  baits[baitKey] = (baits[baitKey] ?? 0) - methodOf(method).baitCost;
  const d = fishDay(f, today);
  return { ok: true, state: { ...st, fishing: { ...d, day: laterDay(d.day, today), baits, wormDay: laterDay(f.wormDay, today), bestCast: Math.max(f.bestCast, castM), dayCast: Math.max(d.dayCast, castM) } } };
}

export function buyBait(st: IslandState, baitKey: string, today: string): GearResult {
  const bait = BAITS[baitIndex(baitKey)];
  if (!bait) return { ok: false, reason: "없는 미끼예요" };
  if (st.coins < bait.price) return { ok: false, reason: `하트가 ${(bait.price - st.coins).toLocaleString()}개 모자라요` };
  const f = fishingOf(st);
  const worm = BAITS[0].key;
  const baits = { ...f.baits, [worm]: baitStock(f, worm, today) };
  baits[baitKey] = (baits[baitKey] ?? 0) + bait.uses;
  return { ok: true, state: { ...st, coins: st.coins - bait.price, fishing: { ...f, baits, wormDay: laterDay(f.wormDay, today) } } };
}

/* ── 던지기 ─────────────────────────────────────────── */

/** 돌리기 상태 — energy 는 쌓인 힘(0~1), rate 는 초당 바퀴(부호 = 돌리는 방향).
 *  heat — 힘이 가득 찬 채 버틴 시간(OVERHEAT_S 를 넘기면 과열로 힘이 확 빠진다) · jitter — 돌리는 빠르기가 들쭉날쭉한 정도 · burns — 과열 횟수 */
export type CastSpin = { energy: number; rate: number; turns: number; dir: 1 | -1; heat?: number; jitter?: number; burns?: number };
export const startSpin = (): CastSpin => ({ energy: 0, rate: 0, turns: 0, dir: 1, heat: 0, jitter: 0, burns: 0 });
/** 힘이 차는 빠르기 띠(초당 바퀴) — 이 안에서 고르게 돌려야 찬다. 밖으로 나가면 빠진다(2026-11-12 [사용자: "너무 쉬워 돌리기만 하면 미터가 늘어나잖아 … 줄어드는 로직도"]) */
export const SPIN_LO = 2, SPIN_HI = 3.2;
/** 가득 찬 채 이만큼(초) 더 돌리면 과열 — 힘이 OVERHEAT_TO 로 떨어진다. 가득 찬 순간에 놓아야 한다 */
export const OVERHEAT_S = 0.45, OVERHEAT_TO = 0.3; // 2026-11-12 0.8 → 0.45 [사용자: "아직 너무 쉬워 과열 시간 더 짧게"]
/** 두 움직임 사이에 방향이 꺾인 각도(-π~π) — 손가락이 도는 원의 크기 · 자리와 상관없이 잰다 */
export function headingDelta(ax: number, ay: number, bx: number, by: number): number {
  let d = Math.atan2(by, bx) - Math.atan2(ay, ax);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
/** 돌리는 속도의 맛 — 느리면 힘이 안 붙고, 초당 2~3.2바퀴(SPIN_LO~SPIN_HI)가 최고, 그보다 빠르면 빠를수록 덜 붙는다(stepSpin 이 거꾸로 빼기까지 한다) */
export function spinGain(rps: number): number {
  const v = Math.abs(rps);
  if (v < 0.6) return 0;
  if (v < SPIN_LO) return (v - 0.6) / (SPIN_LO - 0.6);
  if (v <= SPIN_HI) return 1;
  return Math.max(0, 1 - (v - SPIN_HI) * 0.6);
}
/** 한 칸 진행 — angle 은 이번 칸에 돈 각도(라디안, 방향 포함). 순수. */
export function stepSpin(s: CastSpin, angle: number, dt: number): CastSpin {
  if (dt <= 0) return s;
  const inst = angle / (Math.PI * 2) / dt;
  const rate = s.rate + (inst - s.rate) * Math.min(1, dt * 8);
  // 고르게 — 이번 칸 빠르기가 평균에서 크게 벗어나면(들쭉날쭉) 덜 찬다
  const jitter = (s.jitter ?? 0) + (Math.min(2, Math.abs(inst - rate) / Math.max(1, Math.abs(rate))) - (s.jitter ?? 0)) * Math.min(1, dt * 6);
  const steady = Math.max(0.25, Math.min(1, 1.15 - jitter * 1.1));
  const gain = spinGain(rate) * steady;
  const dir: 1 | -1 = Math.abs(rate) > 0.3 ? (rate > 0 ? 1 : -1) : s.dir;
  // 방향을 뒤집으면 쌓은 힘이 줄고, 늘 조금씩 새고(그냥 오래 돌린다고 쌓이지 않는다), 너무 빠르면 빠지고, 멈추면 더 빨리 빠진다
  let energy = (dir !== s.dir ? s.energy * 0.7 : s.energy) + gain * 0.62 * dt - 0.08 * dt;
  const v = Math.abs(rate);
  if (v > SPIN_HI) energy -= (v - SPIN_HI) * 0.3 * dt;
  if (gain < 0.15) energy -= 0.35 * dt;
  energy = Math.max(0, Math.min(1, energy));
  // 과열 — 가득 찬 채 계속 돌리면 OVERHEAT_S 뒤 힘이 확 빠진다
  let heat = s.heat ?? 0, burns = s.burns ?? 0;
  if (energy >= 0.995) heat += dt; else heat = Math.max(0, heat - dt * 2);
  if (heat > OVERHEAT_S) { energy = OVERHEAT_TO; heat = 0; burns += 1; }
  return { energy, rate, turns: s.turns + Math.abs(angle) / (Math.PI * 2), dir, heat, jitter, burns };
}
/** 놓는 때 — 가득 찬 순간에 가까울수록 1(과열 직전은 0). 덜 찼으면 0 */
export function castTiming(s: Pick<CastSpin, "energy" | "heat">): number {
  if (s.energy < 0.97) return 0;
  return Math.max(0, 1 - (s.heat ?? 0) / OVERHEAT_S);
}
/** 더 멀리 — 가득 찬 순간에 알맞은 빠르기로 돌리다 세게 튕기면 낚싯대 끝 거리보다 최대 25% 더 날아간다(바나나킥의 보상). 1 = 보통 */
export const CAST_BOOST_MAX = 0.25;
export function castBoost(s: Pick<CastSpin, "energy" | "heat" | "rate">, flick: number): number {
  const f = Math.max(0, Math.min(1, flick / FLICK_FULL));
  const snap = f >= 0.7 ? (f - 0.7) / 0.3 : 0;
  return 1 + CAST_BOOST_MAX * castTiming(s) * snap * spinGain(s.rate);
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
export const castMeters = (score: number, range: number, boost = 1) => Math.round(range * (0.12 + 0.88 * score) * boost * 10) / 10;
/** 휘는 힘(-1~1, 부호 = 돌린 방향) — 그냥 눌러 던지면 0(곧게). 돌렸다면 0.55 바닥 위로, 고른 빠르기로 오래 돌릴수록 1 까지 커진다.
 *  예전엔 돌린 방향(±1)만 넘겨서 한 바퀴만 돌려도 끝까지 돌린 것과 똑같이 휘었다. 바닥은 예전의 보통 던지기만큼은 휘게 두려는 것이다
 *  (바닥 없이 솜씨로만 키웠더니 0.5초 돌리기가 예전의 4분의 1만 휘었다). 연출 전용이다 — 거리 · 뽑기는 castScore 그대로 */
export function castCurve(s: CastSpin): number {
  if (s.turns < 0.5 || s.energy < 0.05) return 0;
  const turns = Math.max(0, Math.min(1, (s.turns - 0.5) / 2.5));
  const q = Math.max(0, Math.min(1, s.energy * (0.6 + 0.4 * spinGain(s.rate)) * (0.35 + 0.65 * turns) * 1.25));
  return s.dir * Math.round((0.55 + 0.45 * q) * 100) / 100;
}
/** 한마디 — 바나나킥은 제대로 돌려서 멀리 보냈을 때만, 가득 찬 순간에 세게 튕겨 더 멀리(boost) 보내면 슈퍼 · 퍼펙트 */
export function castRating(score: number, turns: number, boost = 1): string {
  if (boost >= 1 + CAST_BOOST_MAX * 0.8 && turns >= 2) return "퍼펙트 바나나킥!";
  if (score >= 0.95 && boost >= 1.08 && turns >= 2) return "슈퍼 바나나킥!";
  if (score >= 0.85 && turns >= 2) return "바나나킥!";
  if (score >= 0.6) return "쭉 뻗었어요!";
  if (score >= 0.45) return "괜찮아요";
  return "던졌어요";
}
/** 이 낚싯대 · 힘으로 갈 수 있는 진짜 끝(m) — 가득 찬 순간에 세게 튕긴 퍼펙트(castBoost 최대)까지 친다. 장비 시트 · 목록이 이 값을 보여 준다(castRange 만 보여 주면 기록이 '최대'를 넘었다) */
export const castMaxMeters = (rodTier: number, power: number) => castMeters(1, castRange(rodTier, power), 1 + CAST_BOOST_MAX);

/* ── 던지기 입력(손가락 → 돌리기 · 튕김) ─────────────────
 * 2026-11-13 — 놓기 직전 위로 튕긴 손가락도 '돌리기'로 셌다. 원을 그리다 곧게 튕기는 순간 한 칸이 방향을 뒤집은 것(힘 ×0.7 · 휘는 쪽 뒤집힘)이나
 * 빠르기가 튄 것으로 읽혀, 같은 솜씨로 던져도 원의 어느 자리에서 튕겼느냐에 따라 퍼펙트 89.7m 와 57.9m 로 갈렸다.
 * 이제 칸마다 돌리기 상태를 짧게 남겨 두고, 손가락으로 놓았으면 튕김 창(FLICK_WINDOW_MS) 앞의 상태로 점수 · 더 멀리 · 휘는 힘을 잰다 —
 * 튕김 창 안의 방향 변화는 돌리기에 들어가지 않는다. 과열(heat)도 그 순간(튕기기 시작할 때)에 재니 금빛을 보고 튕기면 퍼펙트에 닿는다.
 * 키보드는 튕김이 없으니 놓는 순간의 상태 그대로다. 순수(입력 버퍼만 고친다) — 화면과 fishingcast.test 의 시뮬레이션이 같은 함수를 쓴다. */

/** 놓기 직전 이만큼(ms)의 움직임이 '휙'(튕김)이다 — 돌리기는 그 앞에서 잰다 */
export const FLICK_WINDOW_MS = 90;
/** 키보드로 놓기 — 일부러 누른 키는 끝까지 튕긴 것으로 친다(예전 0.9 배는 퍼펙트 문턱 1.2 에 영영 못 닿았다). 미리 보기 거리도 같은 값 */
export const KEY_FLICK = FLICK_FULL;
/** 손가락이 이만큼(px) 움직여야 방향을 잰다 — 떨림을 돌리기로 세지 않게 */
export const CAST_MIN_MOVE_PX = 4;
/** 진행 한 칸의 최대 길이(초) — 프레임이 밀려도 한 번에 이만큼만 센다 */
export const SPIN_STEP_MAX_S = 0.1;
const SPIN_MARKS_MS = 400;
type Pt = { x: number; y: number; t: number };
export type CastTrace = { pts: Pt[]; last: { x: number; y: number } | null; vec: { x: number; y: number } | null; pending: number; marks: { t: number; s: CastSpin }[] };
/** 누른 순간 — 돌리기 상태의 첫 기록은 '아직 안 돌렸다' */
export const startTrace = (t: number): CastTrace => ({ pts: [], last: null, vec: null, pending: 0, marks: [{ t, s: startSpin() }] });
/** 손가락이 움직였다 — 꺾인 각도를 다음 칸까지 모은다. 돌린 각도(라디안)를 돌려준다(낚싯대 끝 궤적 그림용) */
export function traceMove(tr: CastTrace, x: number, y: number, t: number): number {
  tr.pts.push({ x, y, t });
  // 튕김 앞을 찾을 만큼(FLICK_LOOKBACK_MAX_MS + 여유) 남긴다 — 120Hz 손가락이면 예전 24개(0.2초)로는 모자랐다
  while (tr.pts.length > 96 || (tr.pts.length > 2 && t - tr.pts[0].t > FLICK_LOOKBACK_MAX_MS + 150)) tr.pts.shift();
  const last = tr.last;
  if (!last) {
    tr.last = { x, y };
    return 0;
  }
  const vx = x - last.x, vy = y - last.y;
  if (Math.hypot(vx, vy) < CAST_MIN_MOVE_PX) return 0;
  tr.last = { x, y };
  let d = 0;
  if (tr.vec) {
    d = headingDelta(tr.vec.x, tr.vec.y, vx, vy);
    tr.pending += d;
  }
  tr.vec = { x: vx, y: vy };
  return d;
}
/** 한 칸 진행 — elapsed 는 지난 칸부터 흐른 실제 초. 0.1초 넘게 밀렸으면(프레임 멈춤) 모인 각도도 같은 비율로 줄여 센다 —
 *  예전엔 시간만 0.1초로 자르고 0.2초 동안 모인 각도는 그대로 넣어 빠르기가 두 배(초당 약 5.2바퀴)로 읽혀 힘 · 때를 잃었다 */
export function stepSpinFrame(s: CastSpin, angle: number, elapsed: number): CastSpin {
  const dt = Math.min(SPIN_STEP_MAX_S, elapsed);
  return stepSpin(s, elapsed > dt ? angle * (dt / elapsed) : angle, dt);
}
/** 칸 진행 + 기록 — 모인 손가락 각도(키보드면 keyAngle)로 한 칸 돌리고 그 상태를 시각과 함께 남긴다 */
export function traceTick(tr: CastTrace, s: CastSpin, elapsed: number, t: number, keyAngle?: number): CastSpin {
  const angle = keyAngle ?? tr.pending;
  tr.pending = 0;
  const next = stepSpinFrame(s, angle, elapsed);
  const keep = tr.marks.filter((m) => t - m.t <= SPIN_MARKS_MS);
  // 오래된 기록을 다 버리면 짧은 멈춤 뒤 '튕김 앞' 상태가 사라진다 — 가장 최근의 오래된 것 하나는 남긴다
  const older = tr.marks.filter((m) => t - m.t > SPIN_MARKS_MS);
  tr.marks = [...(older.length ? [older[older.length - 1]] : []), ...keep, { t, s: next }];
  return next;
}
/** 곧게 뻗은 마지막 손짓이 시작된 시각 — 끝에서 거꾸로 훑으며 방향이 꺾인 양을 더해 STRAIGHT_TURN 을 넘는 곳(원을 그리다 튕기기로 꺾인 꼭짓점)에서 멈춘다.
 *  튕김이 FLICK_WINDOW_MS 보다 길면(사람 손은 0.1~0.15초도 흔하다) 고정 창만으로는 꺾인 칸이 '튕김 앞' 상태에 들어가 같은 문제가 되살아났다 */
export const STRAIGHT_TURN = 0.3;
/** 튕김 앞을 찾아 거슬러 올라가는 최대 길이(ms) — 오래 곧게 끌었으면 그 앞까지 가지 않는다 */
export const FLICK_LOOKBACK_MAX_MS = 250;
export function flickStart(tr: CastTrace): number {
  const pts = tr.pts;
  if (!pts.length) return -Infinity;
  let cur = pts[pts.length - 1], prev: { x: number; y: number } | null = null, turn = 0;
  for (let i = pts.length - 2; i >= 0; i--) {
    const p = pts[i], vx = cur.x - p.x, vy = cur.y - p.y;
    if (Math.hypot(vx, vy) < CAST_MIN_MOVE_PX) continue;
    if (prev) {
      turn += Math.abs(headingDelta(vx, vy, prev.x, prev.y));
      if (turn > STRAIGHT_TURN) return cur.t;
    }
    prev = { x: vx, y: vy };
    cur = p;
  }
  return cur.t;
}
/** 튕김 앞의 돌리기 상태 — 곧게 뻗은 튕김이 시작되기 전(그리고 놓기 FLICK_WINDOW_MS 이상 앞)의 마지막 기록. 그보다 짧게 눌렀으면 첫 기록(안 돌림) */
export function spinBeforeFlick(tr: CastTrace, releaseT: number): CastSpin {
  const cut = Math.min(releaseT - FLICK_WINDOW_MS, Math.max(flickStart(tr), releaseT - FLICK_LOOKBACK_MAX_MS));
  let pick = tr.marks[0].s;
  for (const m of tr.marks) if (m.t <= cut) pick = m.s;
  return pick;
}
/** 튕긴 빠르기(px/ms) — 마지막 FLICK_WINDOW_MS 동안 위로 간 거리(옆으로는 0.35 만 친다). 곧게 뻗은 손짓이 그보다 짧으면(45ms 이상일 때) 그 손짓만 잰다 —
 *  창 앞쪽에 원을 그리던 몫이 섞여 같은 튕김이 원의 어느 자리였느냐에 따라 세기가 달랐다 */
export function traceFlick(tr: CastTrace): number {
  const pts = tr.pts, end = pts[pts.length - 1];
  if (!end) return 0;
  const run = flickStart(tr);
  const since = end.t - run >= 45 ? Math.max(run, end.t - FLICK_WINDOW_MS) : end.t - FLICK_WINDOW_MS;
  const from = pts.find((p) => p.t >= since) ?? end;
  const ms = end.t - from.t;
  return ms > 0 ? (Math.max(0, from.y - end.y) + Math.abs(end.x - from.x) * 0.35) / ms : 0;
}
/** 놓았다 — 던질 때 쓸 돌리기 상태와 튕김. 손가락은 튕김 창 앞의 상태 · 키보드는 놓는 순간의 상태(live)와 KEY_FLICK */
export function traceRelease(tr: CastTrace, live: CastSpin, releaseT: number, key: boolean): { spin: CastSpin; flick: number } {
  if (key) return { spin: live, flick: KEY_FLICK };
  return { spin: spinBeforeFlick(tr, releaseT), flick: traceFlick(tr) };
}

/* ── 입질 ───────────────────────────────────────────── */

/** 물었을 때 눌러야 하는 시간(ms) — 큰 놈일수록 짧다 */
export const hookWindowMs = (difficulty: number, line: number) => Math.round(Math.max(380, 1050 - difficulty * 85 + line * 4));
/** 이 비율 안에 누르면 '완벽한 챔질' */
export const PERFECT_HOOK = 0.45;
/** 입질까지 기다리는 시간(ms) · 간 보기 횟수. scale — 물때 배율(바다의 사리 0.85 · 조금 1.1, fishtide.tideEffect) ×
 *  만든 '향 미끼'(fishcraft.ts) 배율. 기본 1 = 예전 그대로. 뽑기 순서는 그대로고 간 보기는 줄어든 기다림 안에 같은 비율로 놓인다. */
export function waitPlan(seed: number, scale = 1): { waitMs: number; nibbles: number[] } {
  const r = rng(seed ^ 0x5bd1e995);
  const waitMs = Math.round((1800 + Math.round(r() * 3800)) * scale);
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

/** 장비 · 능력치는 갈수록 덜 붙는다(2026-11-10 [사용자: "밸런스도 난이도도 조금씩 상향"]) — 예전엔 끝없이 붙어서 최고 장비면 태초도 12초 · 100% 였다 */
export const softStat = (x: number) => x / (1 + Math.max(0, x) / 110);

export function fightTune(difficulty: number, eff: Pick<Record<FishStat, number>, "power" | "line">, family?: string): FightTune {
  const d = difficulty;
  const power = softStat(eff.power);
  const line = softStat(eff.line);
  return {
    reel: (0.15 * (1 + power * 0.035)) / (1 + d * 0.22),
    tensionUp: (0.435 * (1 + d * 0.12)) / (1 + line * 0.03),
    tensionDown: 0.55,
    surgeEvery: Math.max(1.55, 4.4 - d * 0.3),
    surgeLen: 0.9 + d * 0.1,
    surgePull: (0.82 * (1 + d * 0.1)) / (1 + line * 0.03),
    run: (0.1 * (1 + d * 0.1)) / (1 + power * 0.02),
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
export const coinValue = saleValue;
/** 내 기록을 넘긴 크기의 혜택 — 하트와 경험치 1.5배 [사용자: "같은 물고기 잡더라도 최대 크기라고 그거에대한 베네핏도"] */
export const recordCoins = (difficulty: number) => Math.max(20, coinValue(difficulty) * 2);
export const xpValue = (difficulty: number) => Math.round(10 * 1.5 ** difficulty);

/** 포획 확률 — 포획 능력치가 등급을 얼마나 넘느냐 + 힘겨루기 솜씨 + 정확한 챔질 + 방식. 5~95%.
 *  bonus — 만든 '끈끈 미끼'의 덤(fishcraft.ts). 같은 5~95% 자르기 안에서 더하므로 상한은 그대로다. 기본 0 */
export function captureChance(catchStat: number, difficulty: number, quality: number, perfectHook: boolean, method: MethodKey = "float", bonus = 0): number {
  const p = 0.55 + (catchStat - difficulty * 9) * 0.02 + quality * 0.1 + (perfectHook ? 0.05 : 0) + methodOf(method).capture + bonus;
  return Math.round(Math.max(0.05, Math.min(0.95, p)) * 100) / 100;
}

/** 수조에 담을 수 없는 이유 — 있으면 확률 판정 없이 팔기만 된다 */
export const TANK_FULL = TANK_FULL_REASON;
/** 주인은 며칠을 싸워 잡았고 전설 위는 드물다 — 수조가 작다고 못 담으면 안 된다(storeReason). 자리는 이 번들이 모르는 물고기도 센다. */
export function storeBlock(st: Pick<IslandState, "aquarium">, c: Pick<FishCatch, "family" | "boss"> & { grade?: Grade }): string | null {
  return storeReason(aquaOf(st), c.family, { grade: c.grade, crown: !!c.boss });
}

export type FishResult = { ok: true; state: IslandState; outcome: "stored" | "slipped" | "sold" | "junk" | "netted" | "special"; coins: number; levelUp: number; firstJunk?: boolean; special?: SpecialCard; sizeNote?: SizeNote; sizeCoins?: number; exped?: ExpedKey[]; expedCoins?: number; grown?: AquaNews[] } | { ok: false; reason: string };
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
  // 지난주로 되돌린 날은 새 원정을 열지 않는다(남긴 주의 원정에 센다) — 주가 바뀐 때만 새로
  if (f.exped && f.exped.week >= week) return f.exped;
  // 막 열린 낚시터는 미끼가 없을 수 있다 — 그 앞 낚시터로 어림해야 지금 다니는 곳에서 채울 수 있다
  const open = SPOTS.filter((x) => x.minLevel <= f.level);
  const spot = open[Math.max(0, open.length - 2)];
  return newExpedition(week, f.level, couple, spotAvgKg(spot));
}

function gain(f0: FishingState, xpGain: number, wantCoins: number, today: string, artKey?: string, grade = -1, c?: FishCatch, by: CatchWho = NOBODY) {
  const f = fishDay(f0, today);
  const coins = Math.max(0, wantCoins);
  // 크기 기록은 모습별로 센다(치어끼리 · 다 큰 놈끼리) — 치어가 다 큰 기록을 넘을 수는 없으니 계열로 묶으면 혜택이 처음 몇 번으로 끝난다. 주인은 길이가 정해져 있어 기록이 아니다.
  let sizes = f.sizes, sizeNote: SizeNote = null;
  if (c?.cm && !c.boss && !c.junk) ({ book: sizes, note: sizeNote } = noteSize(sizes, catchArt(c), by.who, c.cm));
  const sizeCoins = sizeNote && c ? recordCoins(c.difficulty) : 0;
  const { level, xp, points, levelUp } = addXp(f, sizeNote ? Math.round(xpGain * 1.5) : xpGain);
  const seen = artKey && !f.seen.includes(artKey) ? [...f.seen, artKey] : f.seen;
  let exped = f.exped, expedDone: ExpedKey[] = [], expedCoins = sizeCoins;
  if (c && !c.junk) {
    const add = expedAdd(expedFor(f, today, by.couple), by.who, kgOf(c.cm ?? 0), artKey ?? catchArt(c));
    exped = add.e;
    expedDone = add.newly;
    expedCoins += add.coins;
  }
  return { f: { ...f, level, xp, points, seen, sizes, exped, day: laterDay(f.day, today), dayCoins: f.dayCoins + coins, landed: f.landed + 1, dayLanded: f.dayLanded + 1, topGrade: Math.max(f.topGrade, grade) }, coins, levelUp, sizeNote, sizeCoins, expedDone, expedCoins };
}
/** 경험치를 더하고 레벨을 올린다 — 낚시 · 보내 주기가 같이 쓴다 */
function addXp(f: Pick<FishingState, "level" | "xp" | "points">, gainXp: number) {
  let { level, xp, points } = f;
  xp += Math.max(0, gainXp);
  let levelUp = 0;
  while (level < MAX_LEVEL && xp >= xpNeed(level)) {
    xp -= xpNeed(level);
    level++;
    levelUp++;
    points += POINTS_PER_LEVEL;
  }
  return { level, xp, points, levelUp };
}
/** 결과에 얹는 소식 — 원정 · 크기 기록 하트는 판매 하트와 따로 더한다(expedCoins 는 둘의 합) */
const newsOf = (g: ReturnType<typeof gain>) => ({ sizeNote: g.sizeNote, sizeCoins: g.sizeCoins, exped: g.expedDone, expedCoins: g.expedCoins - g.sizeCoins });

/** 자란 소식을 결과에 얹고 이 사람은 본 것으로 남긴다 — 낚시하는 동안 수조에서 자란 물고기를 결과 카드에서 알려 주려고(예전엔 버려졌다) */
function withGrown(r: FishResult, who: string, now: number): FishResult {
  if (!r.ok) return r;
  const grown = unseenNews(aquaOf(r.state), who);
  if (!grown.length) return r;
  const seen = seeNews(r.state, who, grown[grown.length - 1].n, now);
  return seen.ok ? { ...r, state: seen.state, grown } : r;
}

/** 끌어올린 물고기를 그 낚시터 숙련도에 센다 — 담기 · 그물 · 빠져나감 · 팔기 모두(f.landed 와 같은 기준). 결과의 state 에만 얹는다(다른 값은 그대로) */
const mastered = (r: FishResult, c: FishCatch): FishResult => (r.ok ? { ...r, state: noteMastery(r.state, c) } : r);

/** 수조에 담아 보기 — roll(0~1) 이 확률 밑이면 수조로, 아니면 빠져나간다(하트 절반). 담으면 잡을 때 값(판매가)을 물고기에 남긴다 — 보내 주기의 기준. */
export function tryStore(st: IslandState, c: FishCatch, chance: number, roll: number, now: number, today: string, by: CatchWho = NOBODY): FishResult {
  if (c.junk) return { ok: false, reason: "쓰레기는 수조에 넣을 수 없어요" };
  const block = storeBlock(st, c);
  if (block) return { ok: false, reason: block };
  const win = roll < chance;
  const g = gain(fishingOf(st), xpValue(c.difficulty), win ? 0 : Math.round(coinValue(c.difficulty) / 2), today, catchArt(c), gradeNo(c.grade), c, by);
  if (!win) return mastered(withGrown({ ok: true, state: { ...st, coins: st.coins + g.coins + g.expedCoins, fishing: g.f }, outcome: "slipped", coins: g.coins, levelUp: g.levelUp, ...newsOf(g) }, by.who, now), c);
  const added = addFish(st, c.family, c.stage, c.species, now, bossOf(c.boss)?.name, c.cm, coinValue(c.difficulty));
  return mastered(withGrown({ ok: true, state: { ...added, coins: added.coins + g.expedCoins, fishing: { ...g.f, stored: g.f.stored + 1, dayStored: g.f.dayStored + 1 } }, outcome: "stored", coins: 0, levelUp: g.levelUp, ...newsOf(g) }, by.who, now), c);
}

/** 대기 그물에 두기 — 수조가 찼을 때만. 담기와 같은 확률 판정을 거치고, 잡을 때 값을 그물에 남긴다(24시간 뒤엔 그 값에 저절로 팔린다). */
export function tryNet(st: IslandState, c: FishCatch, chance: number, roll: number, now: number, today: string, by: CatchWho = NOBODY): FishResult {
  if (c.junk) return { ok: false, reason: "쓰레기는 그물에 둘 수 없어요" };
  if (storeBlock(st, c) !== TANK_FULL) return { ok: false, reason: "수조가 가득 찼을 때만 그물에 둬요" };
  const win = roll < chance;
  const g = gain(fishingOf(st), xpValue(c.difficulty), win ? 0 : Math.round(coinValue(c.difficulty) / 2), today, catchArt(c), gradeNo(c.grade), c, by);
  if (!win) return mastered(withGrown({ ok: true, state: { ...st, coins: st.coins + g.coins + g.expedCoins, fishing: g.f }, outcome: "slipped", coins: g.coins, levelUp: g.levelUp, ...newsOf(g) }, by.who, now), c);
  const kept = keepInNet(st, { family: c.family, stage: c.stage, ...(c.species ? { species: c.species } : {}), difficulty: c.difficulty, value: coinValue(c.difficulty), ...(c.cm ? { cm: c.cm } : {}), ...(c.boss ? { crown: bossOf(c.boss)?.name } : {}) }, now);
  if (!kept.ok) return { ok: false, reason: kept.reason };
  return mastered(withGrown({ ok: true, state: { ...kept.state, coins: kept.state.coins + g.expedCoins, fishing: g.f }, outcome: "netted", coins: 0, levelUp: g.levelUp, ...newsOf(g) }, by.who, now), c);
}

/** 보내 주기 + 낚시 경험치 — 수조에서 자란 몫만큼(바로 보내면 0 — 잡아서 담고 보내며 경험치를 두 번 받는 길을 막는다) */
export const releaseXp = (f: Parameters<typeof raisedShare>[0] & { species?: string }) => Math.round(xpValue(adultDifficulty(f)) * 0.5 * raisedShare(f));
export function releaseToSea(st: IslandState, id: number, now: number): { ok: true; state: IslandState; note?: string; xp: number; levelUp: number } | { ok: false; reason: string } {
  const f = syncAqua(st, now).a.fish.find((q) => q.id === id);
  const r = releaseFish(st, id, now);
  if (!r.ok || !f) return r.ok ? { ok: false, reason: "이미 떠난 물고기예요" } : r;
  const xp = releaseXp(f);
  if (xp <= 0) return { ...r, xp: 0, levelUp: 0 };
  const fs = fishingOf(r.state), up = addXp(fs, xp);
  return { ok: true, state: { ...r.state, fishing: { ...fs, level: up.level, xp: up.xp, points: up.points } }, note: `${r.note ?? "보내 줬어요"} · 낚시 경험치 +${xp}`, xp, levelUp: up.levelUp };
}

/** 수조가 찼을 때 — 한 마리를 보내고 담는다. 담기에 실패하면 보내지 않는다(빈손으로 둘 다 잃으면 안 된다). */
export function tryStoreSwap(st: IslandState, c: FishCatch, releaseId: number, chance: number, roll: number, now: number, today: string, by: CatchWho = NOBODY): FishResult {
  if (roll >= chance) {
    const g = gain(fishingOf(st), xpValue(c.difficulty), Math.round(coinValue(c.difficulty) / 2), today, catchArt(c), gradeNo(c.grade), c, by);
    // 담기에 성공하는 길은 아래 tryStore 가 센다 — 여기(빠져나감)만 따로 센다(두 번 세지 않게)
    return mastered(withGrown({ ok: true, state: { ...st, coins: st.coins + g.coins + g.expedCoins, fishing: g.f }, outcome: "slipped", coins: g.coins, levelUp: g.levelUp, ...newsOf(g) }, by.who, now), c);
  }
  const freed = releaseToSea(st, releaseId, now);
  if (!freed.ok) return { ok: false, reason: freed.reason };
  const r = tryStore(freed.state, c, 1, 0, now, today, by);
  return r.ok ? { ...r, levelUp: r.levelUp + freed.levelUp } : r;
}

/** 목표 보상 받기 */
export function claimFishGoal(st: IslandState, id: string, today: string): GearResult {
  const got = claimGoal(fishingOf(st), id, today);
  if (!got) return { ok: false, reason: "아직 받을 수 없어요" };
  return { ok: true, state: { ...st, coins: st.coins + got.coins, fishing: got.f } };
}

/** 팔 때 받는 하트 — 그 낚시터 숙련도 ★4 면 +5%. 화면의 '팔기' 값도 이걸 본다(둘이 갈리면 버튼과 받은 하트가 다르다) */
export const sellPrice = (st: Pick<IslandState, "fishPlus">, c: Pick<FishCatch, "difficulty" | "at">) => Math.round(coinValue(c.difficulty) * (1 + masterySaleBonus(st, c.at)));
/** 수조에 안 담고 팔기 — 하트 전부 */
export function sellCatch(st: IslandState, c: FishCatch, today: string, by: CatchWho = NOBODY): FishResult {
  if (c.junk) return { ok: false, reason: "쓰레기는 팔 수 없어요" };
  const g = gain(fishingOf(st), xpValue(c.difficulty), sellPrice(st, c), today, catchArt(c), gradeNo(c.grade), c, by);
  return mastered({ ok: true, state: { ...st, coins: st.coins + g.coins + g.expedCoins, fishing: g.f }, outcome: "sold", coins: g.coins, levelUp: g.levelUp, ...newsOf(g) }, c);
}

/** 쓰레기를 치운다 — 수집함에 하나 더, 분리수거 값 약간, 경험치 약간 */
export function haulJunk(st: IslandState, c: FishCatch, today: string): FishResult {
  const j = junkOf(c.junk);
  if (!j) return { ok: false, reason: "쓰레기가 아니에요" };
  const g = gain(fishingOf(st), 3, j.coins, today);
  const before = g.f.junk[j.key] ?? 0;
  return { ok: true, state: { ...st, coins: st.coins + g.coins, fishing: { ...g.f, junk: { ...g.f.junk, [j.key]: before + 1 } } }, outcome: "junk", coins: g.coins, levelUp: g.levelUp, firstJunk: before === 0 };
}

/** 만난 모습 — 커플이 함께 쓰는 섬 기록이라 둘이 같은 도감을 본다. 수조 조건과 같은 수를 보도록 aquarium.ts 의 seenForms 한곳에서 센다 */
export function formsSeen(st: Pick<IslandState, "fishing" | "aquarium">): Set<string> {
  return seenForms(st, aquaOf(st));
}

/** 지금 이 낚시터 · 미끼 · 방식 · 때에 잡히는 물고기 — 실제 뽑기를 돌려 세므로 규칙을 고쳐도 표가 따라온다. 쓰레기는 뺀 값이다. */
export type CatchRow = { family: string; chance: number; forms: string[] };
export function catchTable(spot: FishSpot, luck: number, bait: number, method: MethodKey, when: FishMoment | undefined, n = 3000): CatchRow[] {
  const rows = new Map<string, { hits: number; forms: Set<string> }>();
  for (let i = 0; i < n; i++) {
    const c = rollCatch(spot, luck, CAST_BASE, (Math.imul(i + 1, 2654435761) + 11) >>> 0, { bait, method, when });
    const r = rows.get(c.family) ?? { hits: 0, forms: new Set<string>() };
    r.hits++;
    r.forms.add(catchArt(c));
    rows.set(c.family, r);
  }
  return [...rows].map(([family, r]) => ({ family, chance: r.hits / n, forms: [...r.forms] })).sort((a, b) => b.chance - a.chance);
}
/** 이 미끼 · 때에 물 수 있는 계열 수 — 버튼의 숫자 */
export function catchableCount(spot: FishSpot, bait: number, when: FishMoment | undefined): number {
  const cap = BAITS[Math.min(BAITS.length - 1, bait)].maxGrade;
  const keys = new Set(poolFor(spot, cap).map(([k]) => k));
  for (const t of when ? timedAt(spot.key, when) : []) {
    const f = FAMILIES.find((x) => x.finals.some((y) => y.key === t.species));
    if (f && gradeNo(speciesOf(t.species)?.grade ?? "태초") <= cap) keys.add(f.key);
  }
  return keys.size;
}

/* ── 낚시터의 주인 ──────────────────────────────────── */

/** 주인을 건 판 — 뽑기 없이 정해져 있다 */
export function bossCatch(boss: FishBoss): FishCatch {
  const fam = familyOf(boss.family);
  if (!fam) throw new Error(`없는 계열: ${boss.family}`);
  return { family: boss.family, stage: 2, species: boss.species, grade: difficultyOf(fam, 2, boss.species).grade, difficulty: boss.difficulty, cm: boss.cm, boss: boss.key };
}
/** 주인과의 힘겨루기 — 규칙은 똑같다. 다른 건 한 판을 다 끌어와도 체력이 조금만 깎인다는 것(bossLeft). */
export const bossTune = (boss: FishBoss, eff: Pick<Record<FishStat, number>, "power" | "line">, hp = 1): FightTune => {
  const t = fightTune(boss.difficulty, eff, boss.family);
  const p = bossPhase(hp);
  if (!p) return t;
  // 화가 나면 더 자주 · 더 세게 차고 나간다. 예고(warn)는 그대로 — 대처할 틈은 남긴다.
  return { ...t, surgeEvery: Math.max(1.3, t.surgeEvery / (1 + 0.12 * p)), surgePull: t.surgePull * (1 + 0.07 * p), jumpRate: t.jumpRate * (1 + 0.2 * p) };
};
/** 주인의 기세 — 체력이 3분의 2 · 3분의 1 밑으로 내려가면 화가 난다(2026-11-10). 체력은 며칠에 걸쳐 남으므로 한 번 화나면 잡힐 때까지 그대로다. */
export const bossPhase = (hp: number): 0 | 1 | 2 => (hp > 0.66 ? 0 : hp > 0.33 ? 1 : 2);
export const BOSS_PHASE_NAME = ["", "화났다", "격노"] as const;
export const bossBlockOf = (f: Pick<FishingState, "bosses" | "level">, boss: FishBoss, who: string, today: string) => bossBlock(boss, f.bosses[boss.key], f.level, who, today);
/** 주인 기록을 넣은 섬 — 각성한 주인(key 끝 _awake, 숙련도 ★5)은 fishPlus.awake 에, 나머지는 s.fishing.bosses 에.
 *  각성한 주인을 s.fishing 에 두지 않는 이유는 fishmastery.ts 머리 주석. 레이드 화면은 key 만 넘기므로 이 갈래 하나로 둘 다 탄다 */
function withBossRec(st: IslandState, f: FishingState, key: string, rec: BossRecord): IslandState {
  return isAwakeKey(key) ? withAwakeRec(st, key, rec) : { ...st, fishing: { ...f, bosses: { ...f.bosses, [key]: rec } } };
}
/** 도전할 수 없는 이유(섬 상태로) — 각성한 주인은 ★5 · 그 낚시터 주인 토벌까지 본다 */
export function bossWhy(st: IslandState, boss: FishBoss, who: string, today: string): string | null {
  const f = fishingOf(st);
  return isAwakeKey(boss.key) ? awakeBlock(st, boss, f.level, who, today) : bossBlockOf(f, boss, who, today);
}
export { bossRecOf };
export function bossOpen(st: IslandState, key: string, who: string, today: string): GearResult {
  const boss = bossOf(key), f = fishingOf(st);
  if (!boss) return { ok: false, reason: "없는 주인이에요" };
  const why = bossWhy(st, boss, who, today);
  if (why) return { ok: false, reason: why };
  return { ok: true, state: withBossRec(st, f, key, bossStarted(bossRecOf(st, key), who, today)) };
}
/** 놓쳤다 · 레이드가 끝났다 — dealt 는 이번 판에 깎은 양(남은 체력이 아니다). seen 은 판을 열 때 본 출현 번호(caught).
 *  그 사이 상대가 잡았으면(출현 번호가 바뀌었거나 쉬는 중) 쉬는 주인 · 다음 주인에 얹지 않는다. */
export function bossLost(st: IslandState, key: string, dealt: number, today: string, who?: string, seen?: number, id?: number): GearResult {
  const f = fishingOf(st), r = bossRecOf(st, key);
  if (!r) return { ok: false, reason: "아직 싸운 적이 없어요" };
  if (bossGone(r, today, seen)) return { ok: false, reason: BOSS_TAKEN };
  const next = bossHurt(r, dealt, today, who, id);
  if (next === r) return { ok: true, state: st }; // 이 판은 이미 저장됐다
  return { ok: true, state: withBossRec(st, f, key, next) };
}
/** 끌어올렸다 — 수조에 담기 전에 먼저 남긴다(창을 닫아도 잡은 건 잡은 것이다). seen 은 판을 열 때 본 출현 번호.
 *  둘이 같은 때 잡으면 먼저 저장한 쪽만 — 나중 쪽은 BOSS_TAKEN(보상 · caught 가 두 번 오르지 않는다).
 *  이미 저장된 내 토벌을 다시 부르면(응답을 못 받아 다시 저장) 아무것도 바꾸지 않고 성공으로 돌려준다 — 두 번 주지 않는다. */
export function bossWon(st: IslandState, key: string, who: string, today: string, seen?: number): GearResult {
  const boss = bossOf(key), f = fishingOf(st), r = bossRecOf(st, key);
  if (!boss || !r) return { ok: false, reason: "없는 주인이에요" };
  if (bossGone(r, today, seen)) {
    if (seen !== undefined && r.caught === seen + 1 && r.last?.by === who) return { ok: true, state: st };
    return { ok: false, reason: BOSS_TAKEN };
  }
  const won = withBossRec(st, f, key, bossBeaten(r, who, today));
  return { ok: true, state: { ...won, coins: won.coins + bossReward(boss, r.caught) } };
}
/** 레이드 안내 화면에서 나갔다 — 연 순간 쓴 도전 한 번을 돌려준다(아직 한 번도 겨루지 않았다). 오늘 쓴 것만 */
export function bossRefund(st: IslandState, key: string, who: string, today: string): GearResult {
  const f = fishingOf(st), r = bossRecOf(st, key), t = r?.tries[who];
  if (!r || !t || t.day < today || t.n <= 0) return { ok: false, reason: "돌려줄 도전이 없어요" };
  return { ok: true, state: withBossRec(st, f, key, { ...r, tries: { ...r.tries, [who]: { day: t.day, n: t.n - 1 } } }) };
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
