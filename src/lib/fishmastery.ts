/** 낚시터 숙련도(2026-11-12) [사용자: "낚시터마다 잡은 수 · 종류로 별 1~5개를 받고, 별마다 그 낚시터 전용 보상 … 귀한 물고기 확률이 조금 오르고,
 *  배경이 밤 · 노을로 바뀌고, 별 5개면 주인의 각성(2단계)이 열립니다"]
 *
 *  저장은 섬 맨 위 칸 s.fishPlus 의 mastery(낚시터별 끌어올린 수 · 만난 모습) · spotLook(고른 배경) · awake(각성한 주인 기록).
 *  ⚠ s.fishing 에 두면 안 된다 — fishingOf 는 아는 칸만 다시 만들어 저장해서(옛 앱도) 상대가 옛 앱으로 한 번만 낚아도 별이 사라진다.
 *
 *  · 센다 — 끌어올린 진짜 물고기만(담기 · 팔기 · 빠져나감 모두. f.landed 와 같은 기준). 꽝 · 특별한 것 · 주인은 안 센다
 *    (꽝은 수집함이 따로 있고, 주인은 낚시터마다 하나라 '그 낚시터를 다닌 정도'가 아니다).
 *    어느 낚시터인지는 물고기가 안다(FishCatch.at — rollCatch 가 찍는다). 그래서 찌 · 루어 · 뜰채 · 심해 · 피버가 전부 같은 길로 센다.
 *  · 별 — 수와 종류(모습: 치어 · 어린 · 다 큰 품종) 둘 다 넘어야 한다. 수만 보면 흔한 물고기만 천 번 낚아도 되고, 종류만 보면 몇 번 만에 끝난다.
 *  · 보상은 그 낚시터에서만 — 별마다 행운 +0.5(귀한 물고기 확률이 조금) · ★2 노을 · ★3 밤 배경 · ★4 그 낚시터 팔기 하트 +5% · ★5 각성한 주인.
 *  ⚠ 미끼 1% 규칙(사용자 결정 — 귀한 계열은 미끼 한 단계에 약 1% 씩만 다르다)을 깨면 안 된다. 그래서 확률을 직접 얹지 않고 행운으로 준다:
 *    행운 1 은 귀한 계열 하나 · 미끼 한 단계에 BAIT_STEP × 0.012 ≈ 0.01%p — ★5(행운 +2.5)는 한 단계에 약 0.03%p, 가장 좋은 미끼에서도 귀한 계열 합 1%p 안(fishmastery.test 가 잰다). */
import type { IslandState } from "./island.ts";
import type { FishCatch, GearResult } from "./fishing.ts";
import { fishArtKey } from "./aquarium.ts";
import { AWAKE_SUFFIX, awakenedBoss, bossAt, bossBlock, type BossRecord, type FishBoss } from "./fishingworld.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";

export type SpotMastery = { n: number; kinds: string[] };
export type MasteryBook = Record<string, SpotMastery>;
export type SpotLook = "dusk" | "night";

/** 별마다 넘어야 하는 끌어올린 수 · 종류(2026-11-12 실측 — 낮 · 맑지 않은 날, 행운 10, 낚시터 시작 미끼 ~ 두 단계 위)
 *  · 종류 — 두물머리가 가장 적다(낮에 만날 수 있는 모습 11가지 · 새벽 붕어는 그때만). 그래서 ★5 도 10 가지. 시작 미끼로는 대개 8~9가지에서 막혀
 *    ★4 · ★5 는 한두 단계 위 미끼를 써 봐야 열린다(중앙값 두물머리 · 화천천 200번 남짓, 거진항 380번).
 *  · 수 — 진행 시뮬레이션(README §14.4.7 — 하루 60번 · 끌어올림 76~91%)에서 낚시터 하나에 머무는 던지기가 24 ~ 489번이라
 *    ★3(150)은 지나가며 받고, ★4(400) · ★5(1,000)는 마음먹고 다시 와야 받는다. 열심히 하는 커플(하루 약 48마리)도 한 곳만 3주. */
export const STAR_NEED: readonly { n: number; kinds: number }[] = [
  { n: 10, kinds: 3 },
  { n: 50, kinds: 5 },
  { n: 150, kinds: 7 },
  { n: 400, kinds: 9 },
  { n: 1000, kinds: 10 },
];
export const MAX_STARS = STAR_NEED.length;
/** 만난 모습은 이만큼만 남긴다 — 가장 많은 낚시터(통영 항구 · 열대관)도 40가지 남짓. 별은 10가지면 다 받는다 */
export const MASTERY_KINDS_CAP = 48;
/** 별마다 그 낚시터에서 행운 +0.5 — 처음 +1(수조의 다 큰 계열 aquaLuck 과 같은 크기)이었는데, 가장 좋은 미끼로 귀한 계열 합이 +1.9%p 까지 올라
 *  '미끼 한 단계에 1% 남짓'(사용자 결정)보다 컸다 → 절반(별 5개면 +2.5, 모든 미끼에서 합 1%p 안) */
export const MASTERY_LUCK_PER_STAR = 0.5;
/** ★4 — 그 낚시터에서 낚은 물고기를 팔 때 하트 +5%(sellCatch). 빠져나간 절반 · 그물 자동 판매에는 안 붙는다 */
export const MASTERY_SALE_STAR = 4;
export const MASTERY_SALE_BONUS = 0.05;
/** 배경 — 고른 하늘색만 바꾼다. 때 손님 · 물고기 뽑기의 '지금 시간'(moment)은 그대로다(꾸미기일 뿐이다) */
export const LOOK_STAR: Readonly<Record<SpotLook, number>> = { dusk: 2, night: 3 };
export const LOOK_NAME: Readonly<Record<SpotLook, string>> = { dusk: "노을", night: "밤" };
export const AWAKE_STAR = 5;

const clean = (v: unknown): SpotMastery | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as { n?: unknown; kinds?: unknown };
  const n = typeof o.n === "number" && Number.isFinite(o.n) ? Math.max(0, Math.floor(o.n)) : 0;
  const kinds = Array.isArray(o.kinds) ? o.kinds.filter((k): k is string => typeof k === "string").slice(0, MASTERY_KINDS_CAP) : [];
  return { n, kinds };
};
/** 낚시터별 기록 — 망가진 값은 0 으로 읽는다(옛 저장 · 다른 갈래가 같은 이름을 쓴 경우에도 화면이 깨지지 않게) */
export function masteryOf(st: Pick<IslandState, "fishPlus">): MasteryBook {
  const raw = fishPlusOf(st).mastery;
  const out: MasteryBook = {};
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Record<string, unknown>)) { const m = clean(v); if (m) out[k] = m; }
  return out;
}
export const spotMastery = (st: Pick<IslandState, "fishPlus">, spot: string): SpotMastery => masteryOf(st)[spot] ?? { n: 0, kinds: [] };
export function starsFor(m: Pick<SpotMastery, "n" | "kinds">): number {
  let s = 0;
  for (const need of STAR_NEED) {
    if (m.n < need.n || m.kinds.length < need.kinds) break;
    s++;
  }
  return s;
}
export const spotStars = (st: Pick<IslandState, "fishPlus">, spot: string) => starsFor(spotMastery(st, spot));
/** 다음 별까지 — 다 받았으면 null */
export const nextNeed = (m: Pick<SpotMastery, "n" | "kinds">) => STAR_NEED[starsFor(m)] ?? null;

/** 끌어올렸다 — 그 낚시터에 한 마리 · 처음 만난 모습이면 종류 하나. 안 세는 것(꽝 · 특별한 것 · 주인 · 어디서 문 줄 모르는 옛 물고기)이면
 *  같은 st 를 그대로 돌려준다(저장 모양 · 기존 테스트의 기대가 그대로다). 순수. */
export function noteMastery(st: IslandState, c: Pick<FishCatch, "family" | "stage" | "species" | "junk" | "boss" | "special" | "at">): IslandState {
  if (!c.at || c.junk || c.boss || c.special) return st;
  const book = masteryOf(st), cur = book[c.at] ?? { n: 0, kinds: [] };
  const art = fishArtKey(c);
  const kinds = cur.kinds.includes(art) || cur.kinds.length >= MASTERY_KINDS_CAP ? cur.kinds : [...cur.kinds, art];
  return withFishPlus(st, { mastery: { ...book, [c.at]: { n: cur.n + 1, kinds } } });
}

/** 그 낚시터에서 받는 행운 덤 */
export const masteryLuck = (st: Pick<IslandState, "fishPlus">, spot: string) => spotStars(st, spot) * MASTERY_LUCK_PER_STAR;
/** 팔기 하트 배수의 덤(0 또는 0.05) */
export const masterySaleBonus = (st: Pick<IslandState, "fishPlus">, spot: string | undefined) => (spot && spotStars(st, spot) >= MASTERY_SALE_STAR ? MASTERY_SALE_BONUS : 0);
/** 행운 덤을 얹은 능력치 — 화면이 이 한 값을 뽑기 · 뜰채 · 피버 · 물고기 표에 같이 넘긴다(넷이 갈리면 표와 실제가 어긋난다) */
export function withMasteryLuck<T extends { luck: number }>(eff: T, st: Pick<IslandState, "fishPlus">, spot: string): T {
  const add = masteryLuck(st, spot);
  return add ? { ...eff, luck: eff.luck + add } : eff;
}

/* ── 배경 ───────────────────────────────────────────── */

export const looksOpen = (stars: number): SpotLook[] => (Object.keys(LOOK_STAR) as SpotLook[]).filter((k) => stars >= LOOK_STAR[k]);
/** 고른 배경 — 별이 모자라면(망가진 저장) 없는 셈이다 */
export function spotLookOf(st: Pick<IslandState, "fishPlus">, spot: string): SpotLook | null {
  const raw = fishPlusOf(st).spotLook as Record<string, unknown> | undefined;
  const v = raw && typeof raw === "object" ? raw[spot] : undefined;
  return (v === "dusk" || v === "night") && spotStars(st, spot) >= LOOK_STAR[v] ? v : null;
}
/** 배경 고르기 — null 이면 기본(지금 시간의 하늘) */
export function setSpotLook(st: IslandState, spot: string, look: SpotLook | null): GearResult {
  if (look && spotStars(st, spot) < LOOK_STAR[look]) return { ok: false, reason: `${LOOK_NAME[look]} 배경은 숙련도 ★${LOOK_STAR[look]}부터예요` };
  const raw = fishPlusOf(st).spotLook;
  const cur: Record<string, SpotLook> = raw && typeof raw === "object" ? { ...(raw as Record<string, SpotLook>) } : {};
  if (look) cur[spot] = look;
  else delete cur[spot];
  return { ok: true, state: withFishPlus(st, { spotLook: cur }) };
}

/* ── 각성한 주인(★5) ─────────────────────────────────── */

/** 각성한 주인의 기록 — fishPlus.awake[`${주인}_awake`]. 모양은 BossRecord 그대로라 fishingworld 의 계산(체력 · 도전 · 협공 · 토벌)을 같이 쓴다.
 *  ⚠ s.fishing.bosses 에 두지 않는다 — fishingOf 는 bosses 를 통째로 옮기지만, 옛 앱은 bossOf 가 모르는 key 를 만나 이름 없이 그리거나 '없는 주인'으로 본다.
 *  fishing.ts 의 bossOpen · bossLost · bossWon · bossRefund 가 key 로 갈라(withBossRec) 여기에 쓴다 — 레이드 화면은 key 만 넘기면 된다 */
export const isAwakeKey = (key: string | null | undefined): key is string => !!key && key.endsWith(AWAKE_SUFFIX);
export function awakeRecords(st: Pick<IslandState, "fishPlus">): Record<string, BossRecord> {
  const raw = fishPlusOf(st).awake;
  return raw && typeof raw === "object" ? { ...(raw as Record<string, BossRecord>) } : {};
}
/** 주인 기록 한 곳 — 각성한 주인은 fishPlus, 나머지는 s.fishing.bosses */
export const bossRecOf = (st: Pick<IslandState, "fishing" | "fishPlus">, key: string): BossRecord | undefined => (isAwakeKey(key) ? awakeRecords(st)[key] : st.fishing?.bosses?.[key]);
/** 각성한 주인을 넣은 섬 — 넘긴 기록만 바꾼다 */
export const withAwakeRec = (st: IslandState, key: string, rec: BossRecord): IslandState => withFishPlus(st, { awake: { ...awakeRecords(st), [key]: rec } });

/** 이 낚시터의 각성한 주인이 열렸나 — ★5 이고 그 낚시터의 주인을 한 번은 잡았어야 한다(처음 보는 주인이 각성부터 나오면 순서가 꼬인다) */
export function awakeBossAt(st: Pick<IslandState, "fishing" | "fishPlus">, spot: string): FishBoss | null {
  const base = bossAt(spot);
  if (!base || spotStars(st, spot) < AWAKE_STAR) return null;
  return (st.fishing?.bosses?.[base.key]?.caught ?? 0) > 0 ? awakenedBoss(base) : null;
}
/** 각성한 주인에게 도전할 수 없는 이유 — 화면과 저장이 같은 판정 */
export function awakeBlock(st: Pick<IslandState, "fishing" | "fishPlus">, boss: FishBoss, level: number, who: string, today: string): string | null {
  if (!awakeBossAt(st, boss.spot)) return `숙련도 ★${AWAKE_STAR} · 이 낚시터의 주인을 한 번 잡으면 열려요`;
  return bossBlock(boss, bossRecOf(st, boss.key), level, who, today);
}
