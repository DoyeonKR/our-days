/* 낚시의 바깥 세계 (2026-11-03) — [사용자: 주인 물고기 · 둘이 하는 주간 원정 · 크기 기록 · 시간대와 날씨 "이거 추가하자"]
 * 순수 표와 계산만 둔다. 저장은 fishing.ts 가 섬 상태 s.fishing 의 옵셔널 칸에 한다(DB 변경 없음).
 *  · 크기 — 같은 물고기도 길이가 다르다. 사람별 · 계열별 최고 기록이 남아 상대와 겨룬다. 랭킹 점수엔 안 넣는다(서버 공식 · 옛 앱이 같이 바뀐다).
 *  · 때 손님 — 이 시간 · 이 날씨에만 무는 물고기. 해파리는 이때가 아니면 아예 안 오고(낚시터 pool 에 없다, 치어부터 잡힌다), 나머지는 다 큰 모습만 이때 온다. 새 종은 그림 · 모델이 먼저다(design/FISHING-TIMED-ART.md).
 *  · 주인 — 낚시터마다 하나. 줄이 끊겨도 깎인 체력이 남아 며칠에 걸쳐 잡는다. 둘이 같이 깎는다.
 *  · 원정 — 한 주의 목표를 둘이 합쳐 채운다. 다 채운 순간 하트가 들어온다(받기 버튼을 놓쳐 잃는 일이 없게).
 *  ⚠ fishing.ts 와 물리는 값은 타입으로만 부른다 — 이 파일이 fishing.ts 를 값으로 부르면 순환이다. */
import { FISH_BASE_CM, FISH_STAGE_SIZE, familyOf, speciesOf, type Grade } from "./aquarium.ts";

/* ── 크기 ───────────────────────────────────────────── */


/** 길이 뽑기 — 대개 보통 크기 근처, 드물게 대물. r 은 0~1 두 개. 행운 · 멀리 던지기가 대물 쪽으로 조금 기울인다.
 *  bonus — 대물 문턱에 더하는 값(바다의 사리 +0.02 — fishtide.ts, 만든 '빛 미끼' — fishcraft.ts). 대물의 길이 폭(1.3~1.7배)은 그대로라 최대 크기는 안 바뀐다. */
export function rollCm(family: string, stage: 0 | 1 | 2, luck: number, cast: number, r1: number, r2: number, bonus = 0): number {
  const base = (FISH_BASE_CM[family] ?? 20) * FISH_STAGE_SIZE[stage];
  const trophy = r1 < 0.04 + luck * 0.001 + cast * 0.03 + Math.max(0, bonus);
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
/** 달(2026-11-12 물때 · 달 — fishtide.ts 가 만든다). tide — 오늘의 물때 1~15, full — 보름달이 뜬 KST 밤 */
export type FishMoon = { tide: number; full: boolean };
/** moon 은 옵셔널 — 옛 호출 · 테스트의 { time, wx } 는 물때 효과도 보름달 손님도 없는 것으로 친다 */
export type FishMoment = { time: FishTime; wx: FishWx; moon?: FishMoon };
export const TIME_NAME: Readonly<Record<FishTime, string>> = { dawn: "새벽", day: "낮", dusk: "해질녘", night: "밤" };
export const WX_NAME: Readonly<Record<NonNullable<FishWx>, string>> = { rain: "비", snow: "눈", clear: "맑음" };
/** 낚시 화면 위 칩은 글자 대신 그림으로 [사용자: "밤이면 텍스트로 쓰지말고 이모지로"] */
export const TIME_ICON: Readonly<Record<FishTime, string>> = { dawn: "🌅", day: "☀️", dusk: "🌇", night: "🌙" };
export const WX_ICON: Readonly<Record<NonNullable<FishWx>, string>> = { rain: "🌧️", snow: "❄️", clear: "☀️" };
/** KST 시각으로 나눈다 — 기기 시간대와 상관없이 둘이 같은 때를 본다 */
export function fishTimeOf(now: number): FishTime {
  const h = new Date(now + 9 * 3_600_000).getUTCHours();
  return h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night";
}
/** 집어등이 켜지는 밤(KST 19시 ~ 새벽 5시) — fishTimeOf 의 '밤'(20시~)보다 한 시간 넓다. 해질녘 마지막 한 시간도 불을 켜는 때라
 *  [사용자 승인: "밤에만 열리는 다섯 번째 방식"]. 때 손님과 같은 시각(호출자가 gameNow 를 넘긴다)을 봐서 둘이 같은 밤을 본다.
 *  여기(fishingworld)에 두는 이유 — fishing.ts 의 castBlock 이 부르는데 fishinglight.ts 는 fishing.ts 를 부르므로 거기 두면 고리가 생긴다. */
export const LIGHT_NIGHT = { from: 19, to: 5 } as const;
export function lightNight(now: number): boolean {
  const h = new Date(now + 9 * 3_600_000).getUTCHours();
  return h >= LIGHT_NIGHT.from || h < LIGHT_NIGHT.to;
}
/** 날씨 그림 종류 → 낚시의 날씨. 구름 · 안개는 특별한 날씨가 아니다. */
export function fishWxOf(icon: string | null | undefined): FishWx {
  if (icon === "rain" || icon === "drizzle" || icon === "thunder") return "rain";
  if (icon === "snow") return "snow";
  return icon === "sun" ? "clear" : null;
}

/** side — 곁 칸 손님(2026-11-13 4차 열여덟). 원래 손님의 10% 칸(TIMED_CHANCE)과 따로 TIMED_SIDE_CHANCE 칸을 저희끼리 나눈다 — 같은 칸을 나눠 쓰면
 *  원래 손님(고래상어 · 해파리 …)이 새 손님 수만큼 묽어졌다(울릉도 맑은 새벽 고래상어 10% → 3.3%, 문섬 비 오는 밤 해파리 5% → 3.3%). */
export type TimedFish = { species: string; spot: string; time?: FishTime; wx?: NonNullable<FishWx>; moon?: "full"; side?: true };
/** 때 손님 — species 는 그 낚시터 계열의 품종이어야 한다(fishingworld.test). 이때가 아니면 낚시로는 다 큰 모습이 안 온다. */
/** 이때만 오는 물고기 — 그 낚시터 pool 에 없는 계열(해파리 · 2026-11-13 4차의 열여덟). 시작 미끼보다 싸서 pool 에 넣으면 기본 무리가 1% 띠로 밀리거나,
 *  귀한 계열이 이미 많아 미끼 1% 규칙이 넘치는 낚시터에 둔 것들이다. 대개 어리게 잡혀 수조에서 큰다(rollCatch). */
export const TIMED_ONLY: ReadonlySet<string> = new Set(["jellyfish", "lionfish", "blue_tang", "grouper", "sunfish", "butterflyfish", "boxfish", "barracuda", "dolphinfish", "goosefish", "saury", "mudskipper", "goby", "halfbeak", "hatchetfish", "lanternfish", "blobfish", "arapaima", "electric_eel"]);
export const TIMED_FISH: readonly TimedFish[] = [
  { species: "sweetfish", spot: "seomjin", time: "dawn" },
  { species: "crucian", spot: "dumulmeori", time: "dawn" },
  { species: "smelt", spot: "soyang", time: "dawn" },
  { species: "perch_kkeokji", spot: "bonghwa", time: "night" },
  { species: "masu_salmon", spot: "hwacheon", wx: "snow" },
  { species: "mandarin_fish", spot: "sanriver", time: "night" },
  { species: "anglerfish", spot: "abyss", time: "night" },
  { species: "catfish", spot: "pond", wx: "rain" },
  { species: "jellyfish", spot: "reef", time: "night" },
  { species: "diamond_tetra", spot: "brook", time: "dawn" },
  { species: "tuxedo_guppy", spot: "brook", wx: "rain" },
  { species: "koi_betta", spot: "brook", wx: "snow" },
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
  // 4차(2026-11-13) — 그 낚시터의 시작 미끼보다 싸거나(넣으면 기본 무리가 1% 띠로 밀린다) 귀한 계열이 넘치는 곳(미끼 1% 규칙)엔 때 손님으로.
  // 곁 칸(side)이라 원래 손님의 몫을 줄이지 않는다(TIMED_SIDE_CHANCE)
  { species: "lionfish", spot: "reef", wx: "rain", side: true },
  { species: "blue_tang", spot: "reef", time: "day", side: true },
  { species: "grouper", spot: "ocean", time: "dusk", side: true },
  { species: "sunfish", spot: "starsea", time: "day", side: true },
  { species: "butterflyfish", spot: "reef", time: "dawn", side: true },
  { species: "boxfish", spot: "reef", wx: "clear", side: true },
  { species: "barracuda", spot: "reef", time: "dusk", side: true },
  { species: "dolphinfish", spot: "ocean", time: "dawn", side: true },
  { species: "goosefish", spot: "ocean", wx: "rain", side: true },
  { species: "saury", spot: "ocean", time: "dawn", side: true },
  { species: "mudskipper", spot: "harbor", time: "dawn", side: true },
  { species: "goby", spot: "harbor", time: "dusk", side: true },
  { species: "halfbeak", spot: "harbor", wx: "clear", side: true },
  { species: "hatchetfish", spot: "abyss", time: "dusk", side: true },
  { species: "lanternfish", spot: "abyss", time: "night", side: true },
  { species: "blobfish", spot: "abyss", time: "dawn", side: true },
  { species: "arapaima", spot: "jungle", time: "dusk", side: true },
  { species: "electric_eel", spot: "jungle", time: "night", side: true },
];
/** 보름달 손님(2026-11-12 물때 · 달) [사용자: "보름달에만 오는 손님도 둡니다"] — 보름달이 뜬 밤에만 그 바다에 오는 이미 있는 품종.
 *  세 계열 다 그 낚시터 pool 에 없다 — 그래서 '보름달에만' 이 참말이다(해파리 · 별무리어처럼 대개 어리게 잡혀 수조에서 큰다).
 *  ⚠ TIMED_FISH 와 따로 둔다 — TIMED_KEYS 에 들면 finalAllowed 가 그 품종의 다 큰 모습을 다른 낚시터에서까지 막는다
 *  (산갈치는 용궁사 · 심해 pool 에서 늘 다 큰 모습으로 온다 — 넣으면 한 달에 밤 넷 말고는 안 온다).
 *  보름달물해파리(통영 항구 · 희귀) — 이름이 곧 보름달 · 산갈치(울릉도 · 전설) — 달밤에 수면으로 오른다는 은빛 띠 · 달빛 해파리(용궁사 · 신화) — 별무리어의 달.
 *  낮은 낚시터에 높은 등급을 두지 않았다(미끼 상한도 그대로 걸린다). 같은 10% 칸(TIMED_CHANCE)을 때 손님과 나눠 쓴다 — 바다 낚시터엔 다 밤 손님이 있어 손님 몫 전체는 늘지 않는다. */
export const MOON_FISH: readonly TimedFish[] = [
  { species: "jellyfish", spot: "harbor", time: "night", moon: "full" },
  { species: "oarfish", spot: "ocean", time: "night", moon: "full" },
  { species: "moon_jelly", spot: "palace", time: "night", moon: "full" },
];
const TIMED_KEYS = new Set(TIMED_FISH.map((x) => x.species));
export const isTimedSpecies = (key: string) => TIMED_KEYS.has(key);
/** 조건을 다 만족해야 한다. 날씨를 모르면(오프라인) 날씨 손님은 안 온다. 달을 모르면(옛 호출) 보름달 손님도 안 온다. */
export const timedMatches = (t: Pick<TimedFish, "time" | "wx" | "moon">, m: FishMoment) => (!t.time || t.time === m.time) && (!t.wx || t.wx === m.wx) && (!t.moon || !!m.moon?.full);
/** 지금 이 낚시터에 오는 손님 — 때 손님 뒤에 보름달 손님을 붙인다(보름달이 아니면 목록 · 뽑기가 예전과 같다) */
export const timedAt = (spot: string, m: FishMoment) => [...TIMED_FISH, ...(m.moon?.full ? MOON_FISH : [])].filter((x) => x.spot === spot && timedMatches(x, m));
export const timedLabel = (t: Pick<TimedFish, "time" | "wx" | "moon">) => [t.moon ? "보름달 밤" : t.time && TIME_NAME[t.time], t.wx && (t.wx === "clear" ? "맑은 날" : `${WX_NAME[t.wx]} 오는 날`)].filter(Boolean).join(" · ");
/** 때가 맞을 때 때 손님이 물 확률 — 이 맛에 그때 다시 오는 정도. 다 큰 물고기라 너무 높으면 수조가 금방 찬다 */
export const TIMED_CHANCE = 0.1;
/** 곁 칸 손님(side)이 물 확률 — 원래 칸 바로 뒤의 띠라(같은 주사위) 원래 손님의 몫 · 뽑기 결과는 4차 이전과 같다. 둘을 합쳐도 15% 를 넘지 않는다.
 *  곁 칸 손님은 그 낚시터 pool 에 없는 계열이라 대개 어리게 와서(rollCatch) 수조가 금방 차지 않는다 */
export const TIMED_SIDE_CHANCE = 0.05;
/** 이 품종이 다 큰 모습으로 낚시에 오는가 */
export const finalAllowed = (species: string, spot: string, m: FishMoment | undefined) => {
  if (!m || !TIMED_KEYS.has(species)) return true;
  return timedAt(spot, m).some((t) => t.species === species);
};

/* ── 주인 ───────────────────────────────────────────── */

/** repeat — 다시 잡을 때 보상 비율(없으면 BOSS_REPEAT_SHARE). 각성한 주인(숙련도 ★5)만 0 을 쓴다 */
export type FishBoss = { key: string; spot: string; name: string; family: string; species: string; level: number; difficulty: number; chunk: number; cm: number; coins: number; story: string; repeat?: number };
/** 낚시터의 주인 — 레벨은 그 낚시터를 좀 다닌 뒤 열리게 잡았다. chunk 는 한 판을 끝까지 끌어왔을 때 깎이는 체력이다 — 그래서 끝까지 끌어와도 대개 한 판엔 안 잡힌다.
 * ⚠ 감기는 속도를 줄여 오래 걸리게 하면 안 된다 — 물고기가 차고 나가는 힘에 밀려 어느 값부터 아예 못 잡는 절벽이 된다(실측: 0.6배 평균 30판, 0.4배 80판 넘게도 못 잡음). */
export const BOSSES: readonly FishBoss[] = [
  { key: "dolsoe", spot: "brook", name: "돌쇠", family: "guppy", species: "fullred_guppy", level: 2, difficulty: 1.2, chunk: 0.2, cm: 19.5, coins: 800, story: "청계천 징검다리 밑에 산다는 터줏대감. 누가 풀어 줬는지 아무도 모른다. 몸집보다 고집이 크다." },
  { key: "neuti", spot: "dumulmeori", name: "느티나무 잉어", family: "common_carp", species: "common_carp", level: 4, difficulty: 1.6, chunk: 0.19, cm: 130, coins: 1200, story: "두물머리 느티나무 그늘 밑에 산다는 큰 잉어. 강이 만나는 곳은 제 집이라는 듯 움직이지 않는다." },
  { key: "hongryeon", spot: "pond", name: "홍련 할멈", family: "koi", species: "showa_koi", level: 5, difficulty: 2, chunk: 0.18, cm: 120, coins: 2000, story: "가시연 밑에서 백 년을 살았다는 우포늪의 큰 잉어. 미끼 맛을 다 안다." },
  { key: "dammit", spot: "soyang", name: "댐 밑의 쏘가리", family: "mandarin_fish", species: "mandarin_fish", level: 6, difficulty: 2.2, chunk: 0.18, cm: 70, coins: 2400, story: "소양호 깊은 바위틈의 쏘가리. 표범 무늬가 보였다면 이미 줄이 끊긴 뒤다." },
  { key: "gwihyang", spot: "seomjin", name: "돌아온 은빛", family: "salmon", species: "salmon", level: 6, difficulty: 2.5, chunk: 0.17, cm: 150, coins: 3000, story: "먼 바다를 돌고 섬진강으로 돌아온 연어. 거슬러 오르는 힘을 아무도 못 당한다." },
  { key: "eunjasa", spot: "bonghwa", name: "계곡의 은둔자", family: "lenok", species: "lenok", level: 8, difficulty: 2.8, chunk: 0.165, cm: 90, coins: 3500, story: "찬물 끝까지 거슬러 올라가 사는 열목어. 사람 소리를 들으면 바위 밑으로 사라진다." },
  { key: "geurimja", spot: "jungle", name: "밀림의 그림자", family: "angel", species: "altum_angel", level: 9, difficulty: 3, chunk: 0.16, cm: 72, coins: 4000, story: "열대관 물이 흐려지면 나타난다. 본 사람마다 크기를 다르게 말한다." },
  { key: "eoreum", spot: "hwacheon", name: "얼음 밑 산천어", family: "masu_salmon", species: "masu_salmon", level: 10, difficulty: 3.2, chunk: 0.16, cm: 60, coins: 4500, story: "화천천 얼음 구멍 밑을 천천히 지나가는 그림자. 겨울마다 조금씩 더 커진다고 한다." },
  { key: "baetmeori", spot: "harbor", name: "뱃머리 영감", family: "striped_jack", species: "striped_jack", level: 11, difficulty: 3.4, chunk: 0.155, cm: 190, coins: 5000, story: "통영 방파제 밑을 수십 년 지킨 줄전갱이. 낚싯줄 냄새를 어부보다 잘 맡는다." },
  { key: "dodam", spot: "sanriver", name: "도담 가물치", family: "snakehead", species: "snakehead", level: 12, difficulty: 3.6, chunk: 0.15, cm: 130, coins: 6000, story: "남한강 물풀 밑에서 숨을 쉬러 올라온다. 입을 열면 찌가 통째로 사라진다." },
  { key: "sanho", spot: "reef", name: "산호 여왕", family: "sea_turtle", species: "green_sea_turtle", level: 14, difficulty: 3.8, chunk: 0.15, cm: 240, coins: 7000, story: "등딱지에 산호가 자라는 늙은 거북. 산호초의 길을 전부 기억한다." },
  { key: "geomeun", spot: "ocean", name: "검은 파도", family: "bluefin", species: "bluefin_tuna", level: 20, difficulty: 4.6, chunk: 0.14, cm: 460, coins: 12000, story: "지나가면 배가 흔들린다는 거대한 다랑어. 줄을 끊은 어부가 셀 수 없다." },
  { key: "munji", spot: "palace", name: "용궁 문지기", family: "rising", species: "golden_dragonfish", level: 27, difficulty: 5.6, chunk: 0.13, cm: 620, coins: 20000, story: "용궁 대문을 천 년 지켰다. 지나가려면 먼저 이겨야 한다." },
  { key: "byeol", spot: "starsea", name: "별을 삼킨 자", family: "astral", species: "genesis_fish", level: 34, difficulty: 6.6, chunk: 0.12, cm: 900, coins: 40000, story: "밤하늘의 별 하나가 사라진 날, 이 물고기가 처음 보였다." },
  { key: "simyeon", spot: "abyss", name: "심연의 크라켄", family: "kraken", species: "kraken", level: 38, difficulty: 7.2, chunk: 0.11, cm: 1800, coins: 60000, story: "울릉분지 바닥에 산다는 전설. 줄이 내려간 만큼 무언가 끌어당긴다." },
];
/** 각성한 주인(2026-11-12 낚시터 숙련도 ★5 — fishmastery.ts) — 그 낚시터 주인의 2단계. key 끝이 _awake, 기록은 fishPlus.awake(옛 앱은 모른다).
 *  더 세게(등급 +1 — 레이드 박자 · 필요한 타수가 같이 오른다) · 한 판에 덜 깎이게(조각 0.75배 — 토벌까지 판이 4분의 1 남짓 더) ·
 *  처음 잡으면 1.5배. 다시 잡기 보상은 없다(0) — §10.25 에서 주인 다시 잡기가 대충 하는 커플 수입의 43% 라 4분의 1 로 내렸는데,
 *  각성한 주인까지 일주일마다 돈을 주면 같은 문제가 낚시터마다 하나씩 다시 열린다. 다시 잡으면 왕관 물고기만 남는다. */
export const AWAKE_SUFFIX = "_awake";
export const AWAKE_PREFIX = "각성한 ";
export const awakenedBoss = (b: FishBoss): FishBoss => ({ ...b, key: b.key + AWAKE_SUFFIX, name: AWAKE_PREFIX + b.name, difficulty: Math.round((b.difficulty + 1) * 10) / 10, chunk: Math.round(b.chunk * 0.75 * 1000) / 1000, coins: Math.round(b.coins * 1.5), repeat: 0, story: `${b.story} 한 번 진 뒤로 눈빛이 달라졌다.` });
export const bossOf = (key: string | null | undefined): FishBoss | undefined => {
  if (key && key.endsWith(AWAKE_SUFFIX)) {
    const base = BOSSES.find((x) => x.key === key.slice(0, -AWAKE_SUFFIX.length));
    return base && awakenedBoss(base);
  }
  return BOSSES.find((x) => x.key === key);
};
export const bossAt = (spot: string) => BOSSES.find((x) => x.spot === spot);
/** 한 사람이 한 주인에게 하루에 걸 수 있는 횟수 — 며칠에 걸쳐 잡는 이유 */
export const BOSS_TRIES = 3;
/** 잡은 뒤 다시 나타나기까지(일) */
export const BOSS_RETURN_DAYS = 7;
/** 쉬는 날마다 되찾는 체력 — 너무 오래 비우면 조금 회복하지만 처음으로 돌아가지는 않는다 */
const BOSS_REGEN_PER_DAY = 0.04;
/** 체력이 이 밑으로는 줄이 끊겨도 안 내려간다 — 마지막은 끌어올려야 한다 */
const BOSS_MIN_HP = 0.03;

export type BossRecord = { hp: number; at: string; tries: Record<string, { day: string; n: number }>; caught: number; until: string; bestBy?: string;
  /** 커플 레이드(2026-11-10) — 이번에 나타난 뒤 사람마다 깎은 체력(합이 1 을 넘지 않는다) · 최근 기록 8줄 · 지난 토벌의 몫. 전부 옵셔널(옛 저장분 그대로) */
  dmg?: Record<string, number>; log?: BossHit[]; last?: { day: string; by: string; dmg: Record<string, number> } };
/** id — 그 판의 번호(레이드 시드 등). 같은 판을 두 번 저장해도(응답을 못 받아 다시) 한 번만 깎는다 */
export type BossHit = { who: string; d: number; day: string; fin?: boolean; id?: number };
/** 협공 — 오늘 상대도 이 주인과 겨뤘으면, 그날 판마다 1.5배를 깎는다. 같이 들어와야 빨리 잡힌다(혼자 하는 섬은 상대가 없어 늘 1배) */
export const BOSS_DUO = 1.5;
export const bossDuo = (r: BossRecord | undefined, who: string, today: string) => !!r && Object.entries(r.tries).some(([k, v]) => k !== who && v.day === today && v.n > 0);
export const bossChunk = (boss: FishBoss, r: BossRecord | undefined, who: string, today: string) => boss.chunk * (bossDuo(r, who, today) ? BOSS_DUO : 1);
const pushHit = (log: BossHit[] | undefined, hit: BossHit) => [...(log ?? []), hit].slice(-8);
/** 둘 중 나중 날(YYYY-MM-DD 는 글자 순서 = 날짜 순서). 빈 값은 늘 앞이다.
 *  ⚠ 하루 · 한 주 칸은 '오늘이 남긴 날보다 뒤'일 때만 비우고, 남기는 날도 이걸로 고른다(2026-11-11 리뷰).
 *  예전엔 '같은 날인가'만 봐서 폰 날짜를 어제 · 오늘로 번갈아 바꾸면 하루 도전 · 미끼 · 목표가 날마다 새로 열렸다
 *  (실측: 날짜 둘을 번갈아 주인 도전 15번 — 정상 6번 · 합성 하트 2,000 — 정상 800). 되돌린 날은 비우지도 세지도 않는다. */
export const laterDay = (stored: string | undefined, today: string): string => (stored && stored > today ? stored : today);
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
  return Math.max(0, BOSS_TRIES - (t && t.day >= today ? t.n : 0));
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
  const t = base.tries[who], same = !!t && t.day >= today;
  return { ...base, hp: bossHp(base, today), at: laterDay(base.at, today), tries: { ...base.tries, [who]: { day: same ? t.day : today, n: (same ? t.n : 0) + 1 } } };
}
/** 이번 싸움에서 깎은 양 — 끌어온 만큼. 멀어져도(거리 1 넘김) 깎은 걸 되찾지 않는다. */
export const bossDealt = (chunk: number, dist: number) => chunk * (1 - Math.min(1, Math.max(0, dist)));
/** 이번 싸움에서 남은 체력 — 화면에 보이는 값(시작 체력 − 깎은 양). 저장은 깎은 양(bossHurt)으로 한다 */
export const bossLeft = (hp: number, chunk: number, dist: number) => Math.max(0, hp - bossDealt(chunk, dist));
/** 상대가 먼저 잡았다 — 판을 열 때 본 출현 번호(caught)가 바뀌었거나, 지금 쉬는 중이다(until 이 앞날).
 *  그 판의 결과(깎기 · 토벌)를 다음 출현 · 쉬는 주인에 얹지 않는다 */
export const BOSS_TAKEN = "상대가 먼저 잡았어요";
export const bossGone = (r: BossRecord, today: string, seen?: number) => (seen !== undefined && r.caught !== seen) || (!!r.until && dayDiff(today, r.until) > 0);
/** 싸움이 끝났다(놓쳤다) — d 는 이번 판에 깎은 양. 저장할 때의(가장 새) 체력에서 뺀다.
 *  ⚠ '시작 체력 − 깎은 양'(남은 체력)을 저장하면 둘이 같은 때 싸울 때 먼저 저장한 쪽의 몫이 사라졌다(2026-11-11).
 *  BOSS_MIN_HP 밑으로는 안 내려간다(마지막은 끌어올려야 한다) — 몫(dmg · log)은 실제로 깎인 만큼만 남는다. 체력이 다시 차지는 않는다.
 *  id 를 주면 같은 사람 · 같은 판이 이미 기록에 있을 때 그대로 돌려준다(저장은 됐는데 응답만 잃어 다시 저장해도 두 번 안 깎는다). */
export function bossHurt(r: BossRecord, dealt: number, today: string, who?: string, id?: number): BossRecord {
  if (who && id !== undefined && r.log?.some((h) => h.who === who && h.id === id)) return r;
  const before = bossHp(r, today), hp = before <= BOSS_MIN_HP ? before : Math.max(BOSS_MIN_HP, before - Math.max(0, dealt)), d = Math.round((before - hp) * 1000) / 1000;
  const at = laterDay(r.at, today);
  if (!who || d <= 0) return { ...r, hp, at };
  return { ...r, hp, at, dmg: { ...r.dmg, [who]: Math.round(((r.dmg?.[who] ?? 0) + d) * 1000) / 1000 }, log: pushHit(r.log, id === undefined ? { who, d, day: today } : { who, d, day: today, id }) };
}
/** 잡았다 — 마지막 일격이 남은 체력을 가져가고, 이번 토벌의 몫을 last 에 남긴 뒤 다음 출현을 위해 비운다 */
export function bossBeaten(r: BossRecord, who: string, today: string): BossRecord {
  const d = Math.round(bossHp(r, today) * 1000) / 1000;
  const dmg = { ...r.dmg, [who]: Math.round(((r.dmg?.[who] ?? 0) + d) * 1000) / 1000 };
  // 되돌린 날에 잡아도 다시 나타나는 날이 당겨지지 않는다 — 마지막으로 싸운 날(at)보다 앞으로는 안 센다
  const at = laterDay(r.at, today);
  return { ...r, hp: 1, at, caught: r.caught + 1, until: addDays(at, BOSS_RETURN_DAYS), bestBy: who, dmg: {}, log: pushHit(r.log, { who, d, day: today, fin: true }), last: { day: today, by: who, dmg } };
}
/** 다시 잡을 때의 보상은 4분의 1 — 처음 잡은 것이 사건이다.
 *  2026-11-11 경제 리뷰: 절반(BOSS_REPEAT_SHARE 0.5)일 땐 7일마다 돌아오는 주인 15마리의 다시 잡기만으로
 *  대충 하는 커플도 하루 약 7,500 하트(전체 수입의 43%)를 받았다 — 손으로 하는 일과 무관한 고정 수입이 경제를 덮었다.
 *  처음 잡을 때(171,400 합)는 그대로다. */
export const BOSS_REPEAT_SHARE = 0.25;
export const bossReward = (boss: FishBoss, caught: number) => (caught > 0 ? Math.round(boss.coins * (boss.repeat ?? BOSS_REPEAT_SHARE)) : boss.coins);

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
