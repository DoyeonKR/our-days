/* 낚시의 바깥 세계 (2026-11-03) — [사용자: 주인 물고기 · 둘이 하는 주간 원정 · 크기 기록 · 시간대와 날씨 "이거 추가하자"]
 * 순수 표와 계산만 둔다. 저장은 fishing.ts 가 섬 상태 s.fishing 의 옵셔널 칸에 한다(DB 변경 없음).
 *  · 크기 — 같은 물고기도 길이가 다르다. 사람별 · 계열별 최고 기록이 남아 상대와 겨룬다. 랭킹 점수엔 안 넣는다(서버 공식 · 옛 앱이 같이 바뀐다).
 *  · 때 손님 — 이 시간 · 이 날씨에만 무는 물고기. 은어 · 메기 · 해파리는 이때가 아니면 아예 안 오고(낚시터 pool 에 없다, 치어부터 잡힌다), 나머지는 다 큰 모습만 이때 온다. 새 종은 그림 · 모델이 먼저다(design/FISHING-TIMED-ART.md).
 *  · 주인 — 낚시터마다 하나. 줄이 끊겨도 깎인 체력이 남아 며칠에 걸쳐 잡는다. 둘이 같이 깎는다.
 *  · 원정 — 한 주의 목표를 둘이 합쳐 채운다. 다 채운 순간 하트가 들어온다(받기 버튼을 놓쳐 잃는 일이 없게).
 *  ⚠ fishing.ts 와 물리는 값은 타입으로만 부른다 — 이 파일이 fishing.ts 를 값으로 부르면 순환이다. */
import { FISH_BASE_CM, FISH_STAGE_SIZE, familyOf, speciesOf, type Grade } from "./aquarium.ts";

/* ── 크기 ───────────────────────────────────────────── */


/** 길이 뽑기 — 대개 보통 크기 근처, 드물게 대물. r 은 0~1 두 개. 행운 · 멀리 던지기가 대물 쪽으로 조금 기울인다. */
export function rollCm(family: string, stage: 0 | 1 | 2, luck: number, cast: number, r1: number, r2: number): number {
  const base = (FISH_BASE_CM[family] ?? 20) * FISH_STAGE_SIZE[stage];
  const trophy = r1 < 0.04 + luck * 0.001 + cast * 0.03;
  const k = trophy ? 1.3 + r2 * 0.4 : 0.75 + (r2 + r1) * 0.25;
  return Math.max(0.5, Math.round(base * k * 10) / 10);
}
/** 무게(kg) — 길이에서 파생. 그래서 따로 저장하지 않는다. */
export const kgOf = (cm: number) => 0.00012 * cm ** 2.4;
export const fmtCm = (cm: number) => (cm >= 100 ? `${(cm / 100).toFixed(cm >= 1000 ? 1 : 2)}m` : `${cm.toFixed(1)}cm`);
export const fmtKg = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : kg >= 1 ? `${kg >= 100 ? Math.round(kg) : kg.toFixed(1)}kg` : `${kg > 0 ? Math.max(1, Math.round(kg * 1000)) : 0}g`);

export type SizeBook = Record<string, Record<string, number>>;
export type SizeNote = "top" | "mine" | null;
/** 기록 남기기 — '상대를 넘었다'가 가장 큰 소식이다. 첫 기록은 소식이 아니다(무엇을 잡아도 뜨면 의미가 없다). */
export function noteSize(book: SizeBook, family: string, who: string, cm: number): { book: SizeBook; note: SizeNote } {
  const row = book[family] ?? {};
  const mine = row[who] ?? 0;
  if (cm <= mine) return { book, note: null };
  const others = Object.entries(row).filter(([k]) => k !== who).map(([, v]) => v);
  const top = others.length ? Math.max(...others) : 0;
  const note: SizeNote = top > 0 && cm > top && mine <= top ? "top" : mine > 0 ? "mine" : null;
  return { book: { ...book, [family]: { ...row, [who]: cm } }, note };
}

/* ── 때 · 날씨 ───────────────────────────────────────── */

export type FishTime = "dawn" | "day" | "dusk" | "night";
export type FishWx = "rain" | "snow" | "clear" | null;
export type FishMoment = { time: FishTime; wx: FishWx };
export const TIME_NAME: Readonly<Record<FishTime, string>> = { dawn: "새벽", day: "낮", dusk: "해질녘", night: "밤" };
export const WX_NAME: Readonly<Record<NonNullable<FishWx>, string>> = { rain: "비", snow: "눈", clear: "맑음" };
/** KST 시각으로 나눈다 — 기기 시간대와 상관없이 둘이 같은 때를 본다 */
export function fishTimeOf(now: number): FishTime {
  const h = new Date(now + 9 * 3_600_000).getUTCHours();
  return h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night";
}
/** 날씨 그림 종류 → 낚시의 날씨. 구름 · 안개는 특별한 날씨가 아니다. */
export function fishWxOf(icon: string | null | undefined): FishWx {
  if (icon === "rain" || icon === "drizzle" || icon === "thunder") return "rain";
  if (icon === "snow") return "snow";
  return icon === "sun" ? "clear" : null;
}

export type TimedFish = { species: string; spot: string; time?: FishTime; wx?: NonNullable<FishWx> };
/** 때 손님 — species 는 그 낚시터 계열의 품종이어야 한다(fishingworld.test). 이때가 아니면 낚시로는 다 큰 모습이 안 온다. */
export const TIMED_FISH: readonly TimedFish[] = [
  { species: "sweetfish", spot: "brook", time: "dawn" },
  { species: "catfish", spot: "pond", wx: "rain" },
  { species: "jellyfish", spot: "reef", time: "night" },
  { species: "diamond_tetra", spot: "brook", time: "dawn" },
  { species: "tuxedo_guppy", spot: "brook", wx: "rain" },
  { species: "koi_betta", spot: "pond", wx: "rain" },
  { species: "ogon_koi", spot: "pond", wx: "snow" },
  { species: "platinum_angel", spot: "jungle", time: "dusk" },
  { species: "black_ray", spot: "jungle", time: "night" },
  { species: "sea_bass", spot: "harbor", time: "night" },
  { species: "croaker", spot: "harbor", wx: "rain" },
  { species: "blackice_clown", spot: "reef", time: "night" },
  { species: "snowflake_clown", spot: "reef", wx: "snow" },
  { species: "whale_shark", spot: "ocean", wx: "clear" },
  { species: "oceanic_manta", spot: "ocean", time: "night" },
  { species: "azure_dragonfish", spot: "palace", wx: "rain" },
  { species: "imugi_fish", spot: "palace", time: "night" },
  { species: "moon_jelly", spot: "starsea", time: "night" },
  { species: "aurora_ray", spot: "starsea", time: "dawn" },
];
const TIMED_KEYS = new Set(TIMED_FISH.map((x) => x.species));
export const isTimedSpecies = (key: string) => TIMED_KEYS.has(key);
/** 조건을 다 만족해야 한다. 날씨를 모르면(오프라인) 날씨 손님은 안 온다. */
export const timedMatches = (t: Pick<TimedFish, "time" | "wx">, m: FishMoment) => (!t.time || t.time === m.time) && (!t.wx || t.wx === m.wx);
export const timedAt = (spot: string, m: FishMoment) => TIMED_FISH.filter((x) => x.spot === spot && timedMatches(x, m));
export const timedLabel = (t: Pick<TimedFish, "time" | "wx">) => [t.time && TIME_NAME[t.time], t.wx && (t.wx === "clear" ? "맑은 날" : `${WX_NAME[t.wx]} 오는 날`)].filter(Boolean).join(" · ");
/** 때가 맞을 때 때 손님이 물 확률 — 이 맛에 그때 다시 오는 정도. 다 큰 물고기라 너무 높으면 수조가 금방 찬다 */
export const TIMED_CHANCE = 0.1;
/** 이 품종이 다 큰 모습으로 낚시에 오는가 */
export const finalAllowed = (species: string, spot: string, m: FishMoment | undefined) => {
  if (!m || !TIMED_KEYS.has(species)) return true;
  return TIMED_FISH.some((t) => t.species === species && t.spot === spot && timedMatches(t, m));
};

/* ── 주인 ───────────────────────────────────────────── */

export type FishBoss = { key: string; spot: string; name: string; family: string; species: string; level: number; difficulty: number; chunk: number; cm: number; coins: number; story: string };
/** 낚시터의 주인 — 레벨은 그 낚시터를 좀 다닌 뒤 열리게 잡았다. chunk 는 한 판을 끝까지 끌어왔을 때 깎이는 체력이다 — 그래서 끝까지 끌어와도 대개 한 판엔 안 잡힌다.
 * ⚠ 감기는 속도를 줄여 오래 걸리게 하면 안 된다 — 물고기가 차고 나가는 힘에 밀려 어느 값부터 아예 못 잡는 절벽이 된다(실측: 0.6배 평균 30판, 0.4배 80판 넘게도 못 잡음). */
export const BOSSES: readonly FishBoss[] = [
  { key: "dolsoe", spot: "brook", name: "돌쇠", family: "guppy", species: "fullred_guppy", level: 2, difficulty: 1.2, chunk: 0.2, cm: 19.5, coins: 800, story: "돌다리 밑에 산다는 동네 개울의 터줏대감. 몸집보다 고집이 크다." },
  { key: "hongryeon", spot: "pond", name: "홍련 할멈", family: "goldfish", species: "ranchu_gold", level: 5, difficulty: 2, chunk: 0.18, cm: 58, coins: 2000, story: "연꽃 밑에서 백 년을 살았다는 소문이 있다. 미끼 맛을 다 안다." },
  { key: "geurimja", spot: "jungle", name: "밀림의 그림자", family: "angel", species: "altum_angel", level: 9, difficulty: 3, chunk: 0.16, cm: 72, coins: 4000, story: "강물이 흐려지면 나타난다. 본 사람마다 크기를 다르게 말한다." },
  { key: "baetmeori", spot: "harbor", name: "뱃머리 영감", family: "striped_jack", species: "striped_jack", level: 11, difficulty: 3.4, chunk: 0.155, cm: 190, coins: 5000, story: "항구 방파제 밑을 수십 년 지킨 줄전갱이. 낚싯줄 냄새를 어부보다 잘 맡는다." },
  { key: "sanho", spot: "reef", name: "산호 여왕", family: "sea_turtle", species: "green_sea_turtle", level: 14, difficulty: 3.8, chunk: 0.15, cm: 240, coins: 7000, story: "등딱지에 산호가 자라는 늙은 거북. 산호초의 길을 전부 기억한다." },
  { key: "geomeun", spot: "ocean", name: "검은 파도", family: "bluefin", species: "bluefin_tuna", level: 20, difficulty: 4.6, chunk: 0.14, cm: 460, coins: 12000, story: "지나가면 배가 흔들린다는 거대한 다랑어. 줄을 끊은 어부가 셀 수 없다." },
  { key: "munji", spot: "palace", name: "용궁 문지기", family: "rising", species: "golden_dragonfish", level: 27, difficulty: 5.6, chunk: 0.13, cm: 620, coins: 20000, story: "용궁 대문을 천 년 지켰다. 지나가려면 먼저 이겨야 한다." },
  { key: "byeol", spot: "starsea", name: "별을 삼킨 자", family: "astral", species: "genesis_fish", level: 34, difficulty: 6.6, chunk: 0.12, cm: 900, coins: 40000, story: "밤하늘의 별 하나가 사라진 날, 이 물고기가 처음 보였다." },
];
export const bossOf = (key: string | null | undefined) => BOSSES.find((x) => x.key === key);
export const bossAt = (spot: string) => BOSSES.find((x) => x.spot === spot);
/** 한 사람이 한 주인에게 하루에 걸 수 있는 횟수 — 며칠에 걸쳐 잡는 이유 */
export const BOSS_TRIES = 3;
/** 잡은 뒤 다시 나타나기까지(일) */
export const BOSS_RETURN_DAYS = 7;
/** 쉬는 날마다 되찾는 체력 — 너무 오래 비우면 조금 회복하지만 처음으로 돌아가지는 않는다 */
const BOSS_REGEN_PER_DAY = 0.04;
/** 체력이 이 밑으로는 줄이 끊겨도 안 내려간다 — 마지막은 끌어올려야 한다 */
const BOSS_MIN_HP = 0.03;

export type BossRecord = { hp: number; at: string; tries: Record<string, { day: string; n: number }>; caught: number; until: string; bestBy?: string };
export const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
/** 오늘의 체력 — 쉰 날만큼 조금 되찾는다(읽을 때 계산한다. 저장은 싸울 때만). */
export function bossHp(r: BossRecord | undefined, today: string): number {
  if (!r) return 1;
  const days = r.at ? Math.max(0, dayDiff(r.at, today)) : 0;
  return Math.min(1, r.hp + days * BOSS_REGEN_PER_DAY);
}
export const bossTriesLeft = (r: BossRecord | undefined, who: string, today: string) => {
  const t = r?.tries[who];
  return Math.max(0, BOSS_TRIES - (t && t.day === today ? t.n : 0));
};
/** 지금 도전할 수 없는 이유 — 화면과 저장이 같은 판정을 쓴다 */
export function bossBlock(boss: FishBoss, r: BossRecord | undefined, level: number, who: string, today: string): string | null {
  if (level < boss.level) return `낚시 Lv.${boss.level}부터 도전할 수 있어요`;
  if (r?.until && dayDiff(today, r.until) > 0) return `${dayDiff(today, r.until)}일 뒤에 다시 나타나요`;
  if (bossTriesLeft(r, who, today) <= 0) return `오늘은 ${BOSS_TRIES}번 다 싸웠어요. 내일 다시 와요`;
  return null;
}
/** 싸움을 시작한다(챔질 성공 = 한 번 쓴 것) */
export function bossStarted(r: BossRecord | undefined, who: string, today: string): BossRecord {
  const base: BossRecord = r ?? { hp: 1, at: today, tries: {}, caught: 0, until: "" };
  const t = base.tries[who];
  return { ...base, hp: bossHp(base, today), at: today, tries: { ...base.tries, [who]: { day: today, n: (t && t.day === today ? t.n : 0) + 1 } } };
}
/** 이번 싸움에서 남은 체력 — 시작 체력에서 끌어온 만큼. 멀어져도(거리 1 넘김) 깎은 걸 되찾지 않는다. */
export const bossLeft = (hp: number, chunk: number, dist: number) => Math.max(0, hp - chunk * (1 - Math.min(1, Math.max(0, dist))));
/** 싸움이 끝났다(놓쳤다) — 깎인 체력이 남는다. 체력이 다시 차지는 않는다. */
export function bossHurt(r: BossRecord, left: number, today: string): BossRecord {
  return { ...r, hp: Math.max(BOSS_MIN_HP, Math.min(bossHp(r, today), left)), at: today };
}
export const bossBeaten = (r: BossRecord, who: string, today: string): BossRecord => ({ ...r, hp: 1, at: today, caught: r.caught + 1, until: addDays(today, BOSS_RETURN_DAYS), bestBy: who });
/** 다시 잡을 때의 보상은 절반 — 처음 잡은 것이 사건이다 */
export const bossReward = (boss: FishBoss, caught: number) => (caught > 0 ? Math.round(boss.coins / 2) : boss.coins);

/* ── 주간 원정 ───────────────────────────────────────── */

export type ExpedKey = "count" | "kg" | "kinds";
export type Expedition = {
  week: string;
  couple: boolean;
  need: Record<ExpedKey, number>;
  coins: Record<ExpedKey, number>;
  count: number;
  kg: number;
  kinds: string[];
  /** 사람별 마릿수 */
  by: Record<string, number>;
  done: ExpedKey[];
};
/** 이번 주(월요일 날짜) */
export function weekOf(today: string): string {
  const t = Date.parse(`${today}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 86_400_000).toISOString().slice(0, 10);
}
export const EXPED_NAME: Readonly<Record<ExpedKey, string>> = { count: "물고기", kg: "무게 합계", kinds: "서로 다른 물고기" };
export const expedValue = (e: Expedition, k: ExpedKey) => (k === "kinds" ? e.kinds.length : k === "count" ? e.count : e.kg);
export const expedText = (k: ExpedKey, v: number) => (k === "kg" ? fmtKg(v) : k === "count" ? `${v}마리` : `${v}종`);
const niceKg = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 0.001)));
  return Math.max(0.01, Math.round((v / p) * 2) / 2 * p);
};
/** 주가 시작될 때 목표를 정해 저장한다 — 주 중간에 레벨이 올라도 목표가 도망가지 않는다. avgKg 는 지금 낚시터에서 한 마리 평균. */
export function newExpedition(week: string, level: number, couple: boolean, avgKg: number): Expedition {
  const count = couple ? 50 : 30;
  const pay = 250 + level * 12;
  return {
    week, couple, count: 0, kg: 0, kinds: [], by: {}, done: [],
    need: { count, kg: niceKg(avgKg * count * 0.25), kinds: couple ? 6 : 4 },
    coins: { count: pay, kg: pay, kinds: pay },
  };
}
/** 다 채웠을 때 더 받는 하트 — 둘 다 5마리 이상 낚았으면 1.5배. 혼자 다 낚아도 원정은 깨지지만 같이 간 맛을 값으로 준다. */
export const EXPED_TOGETHER = 5;
export function expedAllBonus(e: Expedition): number {
  const base = e.coins.count;
  const both = e.couple && Object.values(e.by).filter((n) => n >= EXPED_TOGETHER).length >= 2;
  return Math.round(base * (both ? 1.5 : 1));
}
/** 한 마리를 원정에 올린다 → 새 상태와 이번에 다 채운 목표들 · 받을 하트 */
export function expedAdd(e: Expedition, who: string, kg: number, kind: string): { e: Expedition; newly: ExpedKey[]; coins: number } {
  const n: Expedition = {
    ...e,
    count: e.count + 1,
    kg: Math.round((e.kg + kg) * 1000) / 1000,
    kinds: e.kinds.includes(kind) ? e.kinds : [...e.kinds, kind],
    by: { ...e.by, [who]: (e.by[who] ?? 0) + 1 },
  };
  const newly = (["count", "kg", "kinds"] as const).filter((k) => !n.done.includes(k) && expedValue(n, k) >= n.need[k]);
  let coins = newly.reduce((s, k) => s + n.coins[k], 0);
  const done = [...n.done, ...newly];
  if (newly.length && done.length === 3) coins += expedAllBonus(n);
  return { e: { ...n, done }, newly, coins };
}

/** 품종 이름 — 패널용 */
export const speciesName = (key: string) => speciesOf(key)?.name ?? key;
export const speciesGrade = (key: string): Grade | undefined => speciesOf(key)?.grade;
export const familyName = (key: string) => familyOf(key)?.name ?? key;
/** 크기 기록의 열쇠(그림 key) → 이름. 표에 없는 옛 열쇠는 null */
export function artName(key: string): string | null {
  if (speciesOf(key)) return speciesOf(key)!.name;
  const m = /^(fry|juv)_(.+)$/.exec(key), fam = m && familyOf(m[2]);
  return fam ? `${fam.name} ${m![1] === "fry" ? fam.youngName ?? "치어" : fam.youngName ? "어린 개체" : "어린 물고기"}` : null;
}
