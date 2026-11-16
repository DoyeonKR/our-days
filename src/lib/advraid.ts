/** 모험 커플 레이드(2026-11-13) [사용자 승인: "모험 커플 레이드"] — README §14.6
 *
 *  한 주(KST, 월요일 시작)에 한 번 거대한 영물이 나타난다. 둘이 각자 자기 팀으로 지금의 실시간 전투(arena)에서 싸우고,
 *  깎은 양이 커플 몫으로 쌓인다. 다 깎으면 둘 다 토벌 — 사람마다 한 번 보상(한정 휘장 · 골드 · 공 · 약), 커플 하트는 한 번.
 *
 *  ⚠ 저장 자리
 *   · 커플이 같이 보는 기록(누가 · 언제 · 얼마나 깎았나)은 섬 맨 위 칸 `s.advRaid`(couple_island — 둘 다 읽는다).
 *     모험 저장(adventure_saves)은 사람마다 한 줄이고 RLS 가 자기 것만 보여 줘서 상대 몫을 읽을 수 없다.
 *   · 내 것(받은 주 · 휘장 · 달고 있는 휘장)은 모험 저장 맨 위 칸 `raid`. 혼자 하는 사람(커플 없음)은 같이 보는 기록도 여기(`raid.solo`).
 *   · AdvSave · Battle 타입에 칸을 더하지 않는다 — 엔진 파일(adventure.ts · arena.ts …)은 대전 지문(ENGINE_HASH)에 들어가
 *     글자 하나만 바뀌어도 adventure-battle 을 다시 배포해야 한다. 그래서 칸은 이 파일이 형 변환으로 읽고 쓴다(_fight · _w 와 같다).
 *
 *  ⚠ 동시에 싸우기 — 낚시 주인 레이드(README §10.24)와 같은 규칙
 *   · 남은 체력이 아니라 **깎은 양**을 도전 id 마다 한 줄로 남긴다(hits[id]). 합계는 늘 줄의 합 — 저장 순서와 무관하다.
 *     섬 저장은 버전 비교(island_action) — 부딪치면 새로 읽어 이 파일의 순수 함수를 다시 돌린다(같은 id 는 한 번만 친다).
 *   · 도전 id 는 판을 열 때 정한다(`who:day:n`). 하루 세 번이 줄의 개수로 정해진다 — 같은 사람 두 기기가 같이 열어도 n 이 갈린다.
 *   · 출현 번호 = 주(week). 연 주와 다른 주에 닿은 저장 · 이미 쓰러진 뒤에 닿은 저장은 버린다("상대가 먼저 쓰러뜨렸어요").
 *   · 쓰러뜨림(beaten)과 커플 하트는 같은 저장에서 한 번 — 둘이 같은 때 끝내도 나중 저장은 이미 쓰러진 기록을 보고 아무것도 안 준다.
 *   · 날짜를 되돌려도 지난 칸이 다시 열리지 않는다(laterDay — fishingworld 와 같은 규칙).
 *
 *  ⚠ 전투 엔진은 그대로다(대전 지문 그대로 · adventure-battle 재배포 없음). 영물은 데이터로만 만든다:
 *   · 판의 boss 칸을 채워 대장 패턴(예고 원이 깔리는 범위 공격 — 고리 · 십자 · 소나기 · 조여들기)을 쓴다.
 *   · 전투 체력의 최대치 = 커플 몫 전체, 지금 체력 = 남은 몫. 엔진의 '대장은 절반 아래에서 분노'가 곧 레이드 50% 분노다.
 *   · 25% 아래에서 연 판은 격노 — 공격 · 빠르기를 올린 채로 나온다(능력치 데이터).
 *   · 한 판 90초(newArena 의 limit). 깎은 양은 점수(몸 하나 = 100점)로 바꿔 남긴다 — 영물은 내 팀 레벨에 맞춰 나오므로
 *     Lv.15 팀과 Lv.50 팀이 같은 몫을 나눠 깎는다.
 *  모든 함수는 순수 — 시계 · 난수 없이 today · seed 를 받는다. */
import type { AdvSave, Battle, Fighter, Mon } from "./adventure.ts";
import { BALLS, ITEMS, LEGEND_KEYS, MAX_LEVEL, SPECIES, battleStats, healMon, makeMon, statsOf, type BallKey, type ItemKey } from "./adventure.ts";
import type { IslandState } from "./island.ts";

/* ───────── 수치 ───────── */

/** 하루 도전 — 사람마다 */
export const RAID_TRIES = 3;
/** 한 판 길이(초) */
export const RAID_SECONDS = 90;
/** 한 판 틱 — arena 의 TPS(30). 화면이 arena 를 정적으로 부르지 않게 숫자로 둔다(advraid.test 가 TPS 와 맞춰 본다) */
export const RAID_TICKS = RAID_SECONDS * 30;
/** 몸 하나 = 100점 — 영물 한 마리(그 레벨)의 체력 */
export const RAID_UNIT = 100;
/** 커플 몫(점) — 봇(adventurebalance 와 같은 손, 눈치 0.3~1)이 한 판에 낸 점수는 가운데 50~850 · 열에 아홉이 900(상한) 아래였다.
 *  사람은 패턴을 피하고 약 · 교체를 써서 더 낸다고 보고 한 판 250 안팎으로 잡으면 둘이 열일곱 판(사나흘), 혼자 열 판(사나흘 반). README §14.6 */
export const RAID_POOL_DUO = 4200;
export const RAID_POOL_SOLO = 2400;
/** 한 판에 남길 수 있는 가장 큰 점수 — 90초에 아무리 잘해도 넘지 않는 값(기록 조작을 조금 묶는다) */
export const RAID_TRY_MAX = 900;
/** 영물 레벨 = 내 팀 최고 레벨 + 이것(5~50). +3 · 공격 1.2배로 재면 봇 팀이 25초 안에 늘 전멸하고 한 판 가운데 30~90점이었다 */
export const RAID_LEVEL_UP = 0;
/** 영물 능력치 배율 — 보통 · 격노(25% 아래에서 연 판). 체력은 커플 몫 전체라 공격은 낮춰도 대장 패턴(범위 공격)으로 버티기 30~50초다 */
export const RAID_MUL = { atk: 0.6, def: 0.8, spd: 0.9 } as const;
export const RAID_FURY_MUL = { atk: 0.8, def: 0.8, spd: 1.05 } as const;
/** 보상 — 사람마다 한 번(모험 저장) */
export const RAID_GOLD = 1500;
export const RAID_BALLS: Partial<Record<BallKey, number>> = { great: 3, star: 1 };
export const RAID_ITEMS: Partial<Record<ItemKey, number>> = { bigpotion: 2 };
/** 커플 하트 — 주에 한 번(섬 coins). 하트 수도꼭지가 되지 않게 작게 고정 */
export const RAID_HEARTS = 300;
/** 기록에 남기는 것들의 끝 — 받은 주 · 최근 줄 */
export const RAID_CLAIMED_MAX = 8;
export const RAID_LOG_SHOW = 8;
/** 같은 주 줄 수의 끝 — 둘 × 하루 3 × 7일 = 42. 이 넘으면 이상한 기록이다(저장 크기를 묶는다) */
export const RAID_HITS_MAX = 64;

export const RAID_TAKEN = "상대가 먼저 쓰러뜨렸어요";
export const RAID_WEEK_GONE = "주가 바뀌어 이번 기록은 남지 않았어요";

/* ───────── 주 · 날짜 ───────── */

const DAY_MS = 86_400_000;
/** KST 날짜(YYYY-MM-DD)가 든 주의 월요일 — 출현 번호(spawn id) */
export function raidWeek(today: string): string {
  const t = Date.parse(`${today}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * DAY_MS).toISOString().slice(0, 10);
}
/** 둘 중 나중(글자 순서 = 날짜 순서). 빈 값은 늘 앞 */
export const later = (a: string | undefined, b: string): string => (a && a > b ? a : b);
/** 이번 주의 영물 — 1970-01-05(월)부터 센 주 번호 × 7 을 영물 수로 나눈 나머지. 정수라 기기마다 같고, 이웃한 두 주가 같은 영물이 아니다(7 과 24 는 서로소) */
export function raidBossOf(week: string): string {
  const n = Math.round((Date.parse(`${week}T00:00:00Z`) - Date.parse("1970-01-05T00:00:00Z")) / (7 * DAY_MS));
  const len = LEGEND_KEYS.length;
  return LEGEND_KEYS[(((n * 7) % len) + len) % len];
}
export const raidPoolOf = (size: 1 | 2) => (size === 2 ? RAID_POOL_DUO : RAID_POOL_SOLO);

/* ───────── 같이 보는 기록 ───────── */

/** 한 판 — d 는 깎은 점수(정수). fin 이 없으면 열었지만 아직 안 끝난 판(도전 한 번은 썼다) */
export type RaidHit = { who: string; day: string; n: number; d: number; fin?: boolean };
export type RaidDone = { by: string; day: string; id: string };
export type RaidLast = { week: string; boss: string; size: 1 | 2; dmg: Record<string, number>; beaten?: RaidDone };
export type RaidShared = {
  week: string;
  boss: string;
  size: 1 | 2;
  /** 마지막으로 판을 연 날 — 날짜를 되돌려도 지난 도전이 다시 열리지 않게 */
  day: string;
  hits: Record<string, RaidHit>;
  beaten?: RaidDone;
  /** 지난 주의 결과 — 주가 바뀐 뒤에도 보상을 받을 수 있게 하나만 */
  last?: RaidLast;
};

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const int = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);
const str = (x: unknown) => (typeof x === "string" ? x : "");
function readDone(x: unknown): RaidDone | undefined {
  return isObj(x) && str(x.by) && str(x.id) ? { by: str(x.by), day: str(x.day), id: str(x.id) } : undefined;
}
/** 저장된 값을 믿지 않고 읽는다 — 모르는 칸 · 깨진 줄은 버린다 */
export function readRaid(x: unknown): RaidShared | undefined {
  if (!isObj(x) || !/^\d{4}-\d{2}-\d{2}$/.test(str(x.week))) return undefined;
  const hits: Record<string, RaidHit> = {};
  if (isObj(x.hits)) {
    for (const [id, h] of Object.entries(x.hits)) {
      if (!isObj(h) || !str(h.who) || !str(h.day)) continue;
      hits[id] = { who: str(h.who), day: str(h.day), n: int(h.n), d: Math.min(RAID_TRY_MAX, int(h.d)), ...(h.fin ? { fin: true } : {}) };
    }
  }
  const boss = str(x.boss) in SPECIES ? str(x.boss) : raidBossOf(str(x.week));
  let last: RaidLast | undefined;
  if (isObj(x.last) && str(x.last.week)) {
    const dmg: Record<string, number> = {};
    if (isObj(x.last.dmg)) for (const [k, v] of Object.entries(x.last.dmg)) dmg[k] = int(v);
    last = { week: str(x.last.week), boss: str(x.last.boss) in SPECIES ? str(x.last.boss) : raidBossOf(str(x.last.week)), size: x.last.size === 1 ? 1 : 2, dmg, ...(readDone(x.last.beaten) ? { beaten: readDone(x.last.beaten) } : {}) };
  }
  const beaten = readDone(x.beaten);
  return { week: str(x.week), boss, size: x.size === 1 ? 1 : 2, day: str(x.day), hits, ...(beaten ? { beaten } : {}), ...(last ? { last } : {}) };
}

/** 사람마다 깎은 점수 */
export function raidDmg(r: Pick<RaidShared, "hits">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of Object.values(r.hits)) out[h.who] = (out[h.who] ?? 0) + h.d;
  return out;
}
export const raidTotal = (r: Pick<RaidShared, "hits">) => Object.values(r.hits).reduce((s, h) => s + h.d, 0);
export const raidLeft = (r: Pick<RaidShared, "hits" | "size" | "beaten">) => (r.beaten ? 0 : Math.max(0, raidPoolOf(r.size) - raidTotal(r)));
/** 기세 — 0 보통 · 1 분노(절반 아래) · 2 격노(4분의 1 아래) */
export function raidPhase(r: Pick<RaidShared, "hits" | "size" | "beaten">): 0 | 1 | 2 {
  if (r.beaten) return 0;
  const p = raidLeft(r) / raidPoolOf(r.size);
  return p <= 0.25 ? 2 : p <= 0.5 ? 1 : 0;
}
export const RAID_PHASE_NAME = ["", "분노", "격노"] as const;

/** 지금 주로 맞춘 기록 — 저장된 주가 지났으면 새 영물(지난 주는 last 로). 읽을 때 계산하고 저장은 판을 열 때만.
 *  저장된 주가 오늘보다 앞(날짜를 되돌린 기기)이면 저장된 주를 그대로 쓴다 */
export function raidNow(stored: RaidShared | undefined, today: string, size: 1 | 2): RaidShared {
  const week = raidWeek(later(stored?.day, today));
  if (stored && stored.week >= week) return stored;
  const last: RaidLast | undefined = stored && (Object.keys(stored.hits).length || stored.beaten)
    ? { week: stored.week, boss: stored.boss, size: stored.size, dmg: raidDmg(stored), ...(stored.beaten ? { beaten: stored.beaten } : {}) }
    : stored?.last;
  return { week, boss: raidBossOf(week), size, day: stored?.day ?? "", hits: {}, ...(last ? { last } : {}) };
}

/** 오늘(되돌린 날짜는 마지막 연 날) 남은 도전 */
export function raidTriesLeft(r: RaidShared, who: string, today: string): number {
  const day = later(r.day, today);
  return Math.max(0, RAID_TRIES - Object.values(r.hits).filter((h) => h.who === who && h.day === day).length);
}
/** 도전할 수 없는 이유 — 화면과 저장이 같은 판정을 쓴다 */
export function raidBlock(r: RaidShared, who: string, today: string): string | null {
  if (r.beaten) return "이번 주 영물은 쓰러뜨렸어요. 다음 주에 새 영물이 나타나요";
  if (raidTriesLeft(r, who, today) <= 0) return `오늘은 ${RAID_TRIES}번 다 싸웠어요. 내일 다시 와요`;
  if (Object.keys(r.hits).length >= RAID_HITS_MAX) return "이번 주 기록이 가득 찼어요";
  return null;
}

export type RaidOpen = { ok: true; raid: RaidShared; id: string; week: string } | { ok: false; reason: string };
/** 판을 연다 — 도전 한 번을 쓰고 id 를 정한다. 저장에 부딪치면 새 기록으로 다시 부른다(n 이 갈린다) */
export function raidOpen(stored: RaidShared | undefined, who: string, today: string, size: 1 | 2): RaidOpen {
  const r = raidNow(stored, today, size);
  const why = raidBlock(r, who, today);
  if (why) return { ok: false, reason: why };
  const day = later(r.day, today);
  const n = Object.values(r.hits).filter((h) => h.who === who && h.day === day).reduce((m, h) => Math.max(m, h.n), 0) + 1;
  const id = `${who}:${day}:${n}`;
  return { ok: true, id, week: r.week, raid: { ...r, day, hits: { ...r.hits, [id]: { who, day, n, d: 0 } } } };
}

export type RaidHitResult =
  | { ok: true; raid: RaidShared; /** 이 저장으로 쓰러졌다(하트는 이때 한 번) */ beatenNow: boolean; /** 실제로 남은 점수 */ dealt: number }
  | { ok: false; reason: string };
/** 판이 끝났다 — pts 는 이번 판에 깎은 점수. week 는 판을 열 때의 주(출현 번호).
 *  같은 id 를 다시 보내면(응답을 잃어 다시 저장) 아무것도 바꾸지 않고 성공 — 두 번 깎지 않는다. */
export function raidHit(stored: RaidShared | undefined, id: string, pts: number, who: string, today: string, week: string): RaidHitResult {
  if (!stored || stored.week !== week) {
    // 그 주의 기록이 지난 주(last)로 넘어갔다 — 이미 끝난 판이면 조용히 성공, 아니면 버린다
    return { ok: false, reason: RAID_WEEK_GONE };
  }
  const h = stored.hits[id];
  if (h?.fin) return { ok: true, raid: stored, beatenNow: false, dealt: h.d };
  if (stored.beaten) return stored.beaten.id === id ? { ok: true, raid: stored, beatenNow: false, dealt: h?.d ?? 0 } : { ok: false, reason: RAID_TAKEN };
  const day = h?.day ?? later(stored.day, today);
  const n = h?.n ?? 0;
  const left = raidLeft(stored);
  const d = Math.min(left, Math.min(RAID_TRY_MAX, Math.max(0, Math.floor(Number.isFinite(pts) ? pts : 0))));
  const hits = { ...stored.hits, [id]: { who, day, n, d, fin: true } };
  const next: RaidShared = { ...stored, hits };
  if (d > 0 && d >= left) return { ok: true, raid: { ...next, beaten: { by: who, day: later(stored.day, today), id } }, beatenNow: true, dealt: d };
  return { ok: true, raid: next, beatenNow: false, dealt: d };
}

/** 최근 줄 — 끝난 판만, 새 것부터 */
export function raidLog(r: Pick<RaidShared, "hits">, max = RAID_LOG_SHOW): (RaidHit & { id: string })[] {
  return Object.entries(r.hits)
    .filter(([, h]) => h.fin)
    .map(([id, h]) => ({ ...h, id }))
    .sort((a, b) => (a.day === b.day ? (a.n === b.n ? (a.who < b.who ? 1 : -1) : b.n - a.n) : a.day < b.day ? 1 : -1))
    .slice(0, max);
}

/* ───────── 섬(커플) ───────── */

export type RaidIslandResult = { ok: true; state: IslandState; raid: RaidShared; id?: string; week?: string; beatenNow?: boolean; dealt?: number } | { ok: false; reason: string };
export const raidOf = (st: Pick<IslandState, "advRaid">): RaidShared | undefined => readRaid(st.advRaid);
export function raidOpenIsland(st: IslandState, who: string, today: string): RaidIslandResult {
  const o = raidOpen(raidOf(st), who, today, 2);
  if (!o.ok) return o;
  return { ok: true, state: { ...st, advRaid: o.raid }, raid: o.raid, id: o.id, week: o.week };
}
/** 끝난 판을 섬에 — 이 저장으로 쓰러지면 커플 하트를 한 번 */
export function raidHitIsland(st: IslandState, id: string, pts: number, who: string, today: string, week: string): RaidIslandResult {
  const h = raidHit(raidOf(st), id, pts, who, today, week);
  if (!h.ok) return h;
  if (h.raid === raidOf(st) && !h.beatenNow) return { ok: true, state: st, raid: h.raid, beatenNow: false, dealt: h.dealt };
  return { ok: true, state: { ...st, advRaid: h.raid, coins: st.coins + (h.beatenNow ? RAID_HEARTS : 0) }, raid: h.raid, beatenNow: h.beatenNow, dealt: h.dealt };
}

/* ───────── 내 것(모험 저장) ───────── */

export type RaidMine = { claimed: string[]; crests: string[]; wear?: string; solo?: RaidShared };
export function raidMineOf(save: AdvSave): RaidMine {
  const x = (save as AdvSave & { raid?: unknown }).raid;
  if (!isObj(x)) return { claimed: [], crests: [] };
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
  const crests = list(x.crests).filter((k, i, a) => k in SPECIES && a.indexOf(k) === i);
  const solo = readRaid(x.solo);
  return { claimed: list(x.claimed).slice(-RAID_CLAIMED_MAX), crests, ...(str(x.wear) && crests.includes(str(x.wear)) ? { wear: str(x.wear) } : {}), ...(solo ? { solo } : {}) };
}
export const withRaidMine = (save: AdvSave, m: RaidMine): AdvSave => ({ ...save, raid: m }) as AdvSave;

/** 혼자 하는 사람 — 같이 보는 기록도 내 모험 저장에(하트 없음) */
export function raidOpenSolo(save: AdvSave, who: string, today: string): { ok: true; save: AdvSave; raid: RaidShared; id: string; week: string } | { ok: false; reason: string } {
  const m = raidMineOf(save);
  const o = raidOpen(m.solo, who, today, 1);
  if (!o.ok) return o;
  return { ok: true, save: withRaidMine(save, { ...m, solo: o.raid }), raid: o.raid, id: o.id, week: o.week };
}
export function raidHitSolo(save: AdvSave, id: string, pts: number, who: string, today: string, week: string): { ok: true; save: AdvSave; raid: RaidShared; beatenNow: boolean; dealt: number } | { ok: false; reason: string } {
  const m = raidMineOf(save);
  const h = raidHit(m.solo, id, pts, who, today, week);
  if (!h.ok) return h;
  return { ok: true, save: withRaidMine(save, { ...m, solo: h.raid }), raid: h.raid, beatenNow: h.beatenNow, dealt: h.dealt };
}

/** 받을 수 있는 토벌 — 이번 주에 쓰러뜨렸거나, 지난 주(last)에 쓰러뜨렸고 아직 안 받았으면 그 주 */
export function raidClaimable(r: RaidShared, save: AdvSave): { week: string; boss: string } | null {
  const got = raidMineOf(save).claimed;
  if (r.beaten && !got.includes(r.week)) return { week: r.week, boss: r.boss };
  if (r.last?.beaten && !got.includes(r.last.week)) return { week: r.last.week, boss: r.last.boss };
  return null;
}
/** 보상 받기 — 사람마다 그 주에 한 번(내 모험 저장의 claimed 로). 휘장은 그 주의 영물 — 다시 받아도 하나 */
export function raidClaim(save: AdvSave, r: RaidShared): { save: AdvSave; notes: string[] } | null {
  const c = raidClaimable(r, save);
  if (!c) return null;
  const m = raidMineOf(save);
  const balls = { ...save.balls };
  for (const [k, n] of Object.entries(RAID_BALLS) as [BallKey, number][]) balls[k] = (balls[k] ?? 0) + n;
  const items = { ...save.items };
  for (const [k, n] of Object.entries(RAID_ITEMS) as [ItemKey, number][]) items[k] = (items[k] ?? 0) + n;
  const fresh = !m.crests.includes(c.boss);
  const claimed = [...m.claimed.filter((w) => w !== c.week), c.week].sort().slice(-RAID_CLAIMED_MAX);
  const next = withRaidMine({ ...save, gold: save.gold + RAID_GOLD, balls, items }, { ...m, claimed, crests: fresh ? [...m.crests, c.boss] : m.crests, wear: m.wear ?? c.boss });
  const notes = [
    `골드 +${RAID_GOLD}`,
    (Object.entries(RAID_BALLS) as [BallKey, number][]).map(([k, n]) => `${BALLS[k].name} ×${n}`).join(" · "),
    (Object.entries(RAID_ITEMS) as [ItemKey, number][]).map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(" · "),
    fresh ? `한정 휘장 '${SPECIES[c.boss].name}'` : `휘장 '${SPECIES[c.boss].name}'은 이미 있어요`,
  ];
  return { save: next, notes };
}
/** 휘장 달기 · 떼기(꾸밈뿐 — 능력치와 무관) */
export function raidWear(save: AdvSave, boss: string | null): AdvSave {
  const m = raidMineOf(save);
  if (boss && !m.crests.includes(boss)) return save;
  const { wear: _old, ...rest } = m;
  void _old;
  return withRaidMine(save, boss ? { ...rest, wear: boss } : rest);
}

/* ───────── 전투 ───────── */

export const raidLevel = (save: Pick<AdvSave, "party">) => Math.max(5, Math.min(MAX_LEVEL, Math.max(1, ...save.party.map((m) => m.level)) + RAID_LEVEL_UP));
export type RaidFight = { battle: Battle; /** 몸 하나(100점)의 체력 */ unit: number; /** 판을 열 때 영물 체력 */ startHp: number; phase: 0 | 1 | 2 };
/** 레이드 판 — 내 팀은 다 회복한 사본(내 저장은 그대로), 영물은 한 마리. 판의 boss 칸을 채워 대장 패턴 · 분노를 쓴다.
 *  전투 체력 최대 = 커플 몫 전체, 지금 체력 = 남은 몫 → 엔진의 '절반 아래에서 분노'가 커플 몫의 절반이다 */
export function raidBattle(save: AdvSave, r: RaidShared, seed: number): RaidFight {
  const rng = { s: seed | 0 };
  const lv = raidLevel(save);
  const mon: Mon = makeMon(r.boss, lv, rng, "raid");
  const unit = statsOf(mon).hp;
  const pool = raidPoolOf(r.size);
  const left = Math.max(1, raidLeft(r));
  const phase = raidPhase(r);
  const mul = phase === 2 ? RAID_FURY_MUL : RAID_MUL;
  const base = battleStats(mon);
  const maxHp = Math.max(1, Math.round((pool * unit) / RAID_UNIT));
  const startHp = Math.max(1, Math.min(maxHp, Math.round((left * unit) / RAID_UNIT)));
  const boss: Fighter = {
    mon: { ...mon, hp: startHp },
    stats: { hp: maxHp, atk: Math.round(base.atk * mul.atk), def: Math.round(base.def * mul.def), spd: Math.round(base.spd * mul.spd) },
    stages: { atk: 0, def: 0, spd: 0 },
    sleep: 0,
  };
  const party = save.party.map(healMon);
  const mine: Fighter[] = party.map((m) => ({ mon: { ...m, moves: m.moves.map((x) => ({ ...x })) }, stats: battleStats(m), stages: { atk: 0, def: 0, spd: 0 }, sleep: 0 }));
  const battle: Battle = {
    seed: rng.s,
    sides: [
      { team: mine, active: 0, name: "나" },
      { team: [boss], active: 0, name: `거대 ${SPECIES[r.boss].name}` },
    ],
    wild: false, region: "temple", boss: "raid", turn: 0, runTries: 0, needSwap: false, over: null,
    joined: party.length ? [party[0].id] : [],
  };
  return { battle, unit, startHp, phase };
}
/** 판이 끝난 뒤 — 깎은 체력을 점수로(내림). 영물이 쓰러졌으면 남은 몫 전부 */
export function raidPoints(f: Pick<RaidFight, "unit" | "startHp">, endHp: number): number {
  if (endHp <= 0) return Math.min(RAID_TRY_MAX, Math.ceil((f.startHp * RAID_UNIT) / f.unit));
  return Math.max(0, Math.min(RAID_TRY_MAX, Math.floor(((f.startHp - endHp) * RAID_UNIT) / f.unit)));
}
/** 각성 게이지 보정 — 엔진은 '깎은 체력 ÷ 최대 체력'으로 채우는데 레이드 영물의 최대 체력은 커플 몫 전체라 거의 안 찬다.
 *  화면(BattleView raid)이 영물을 때릴 때마다 몸 하나 기준과의 차이를 더한다. 대전이 아니라 판정(서버)과 무관하다 */
export function raidCharge(dmg: number, unit: number, maxHp: number): number {
  if (dmg <= 0 || unit <= 0 || maxHp <= 0) return 0;
  return Math.max(0, (dmg / unit) * 105 - (dmg / maxHp) * 105);
}

/* ───────── 섬에 쓰기(버전 비교 · 다시 돌리기) ───────── */

/** 섬 행을 읽고 쓰는 길 — 화면은 couple.ts 의 loadIsland · saveIsland, 테스트는 가짜 서버(버전 비교)를 넘긴다 */
export type RaidRow = { state: IslandState; version: number };
export type RaidDeps = {
  load: () => Promise<RaidRow | null>;
  save: (version: number, state: IslandState, mark: string) => Promise<RaidRow>;
  mark: () => string;
};
/** 최신 섬에 make 를 돌려 저장한다. 버전 충돌(상대 · 내 다른 기기가 먼저 썼다)이면 새로 읽어 make 를 **다시** 돌린다 —
 *  깎은 기록은 도전 id 마다 한 줄이라 다시 돌려도 상대 줄이 남고 내 줄은 한 번만 들어간다.
 *  응답만 잃은 저장은 다시 읽은 섬에 내 표식(_saves)이 있으면 들어간 것으로 본다(낚시 act 와 같은 규칙, README §10.24) */
export async function raidCommit<R extends { ok: true; state: IslandState } | { ok: false; reason: string }>(deps: RaidDeps, make: (st: IslandState) => R, tries = 4): Promise<R | { ok: false; reason: string }> {
  let lost: { mark: string; res: R } | null = null;
  for (let i = 0; i < tries; i++) {
    let row: RaidRow | null;
    try {
      row = await deps.load();
    } catch {
      return { ok: false, reason: "섬을 불러오지 못했어요. 연결을 확인해 주세요" };
    }
    if (!row) return { ok: false, reason: "우리 섬을 먼저 열어 주세요" };
    if (lost) {
      const marks = (row.state as { _saves?: unknown })._saves;
      if (Array.isArray(marks) && marks.includes(lost.mark)) return lost.res;
      lost = null;
    }
    const res = make(row.state);
    if (!res.ok || res.state === row.state) return res;
    const mark = deps.mark();
    try {
      await deps.save(row.version, res.state, mark);
      return res;
    } catch {
      // 충돌 · 응답을 잃었다 — 다시 읽어 표식이 있으면 들어간 것, 없으면 새 섬에 다시 돌린다
      lost = { mark, res };
    }
  }
  if (lost) {
    try {
      const row = await deps.load();
      const marks = (row?.state as { _saves?: unknown } | undefined)?._saves;
      if (Array.isArray(marks) && marks.includes(lost.mark)) return lost.res;
    } catch {
      /* 아래 */
    }
  }
  return { ok: false, reason: "저장하지 못했어요. 잠시 후 다시 해 주세요" };
}
