/** 보내 주면 그 낚시터의 주인이 빨리 나타난다(2026-11-18) [README '안 한 것: 보내 주면 그 낚시터 주인이 빨리 나타나기']
 *
 *  수조에서 다 키운 물고기를 바다로 보내 주면, 그 물고기가 온 낚시터의 주인이 쉬는 시간(잡은 뒤 BOSS_RETURN_DAYS 일)이 줄어든다.
 *  등급이 높을수록 많이 줄인다(BOSS_CALL_HOURS). 하트는 주지 않는다 — 주인을 더 자주 잡게 될 뿐이라 그 몫은 1년 모형(econbalance.test)이 잰다.
 *
 *  · 줄이는 양은 '시간'으로 모으고 24시간이 찰 때마다 주인 기록의 until(다시 나타나는 날, YYYY-MM-DD)을 하루 당긴다.
 *    until 은 옛 앱도 아는 칸이라 두 앱 · 모든 화면(bossBlock · bossGone · 게임 탭 칩)이 같은 날을 본다 — 출현 번호(caught)는 안 건드린다.
 *  · 모은 시간 · 오늘 쓴 시간은 섬 맨 위 칸 s.bossCall(옛 앱이 s.fishing 을 다시 지어 모르는 칸을 버린다 — fishplus.ts 머리말).
 *      bossCall = { day: 오늘 쓴 시간의 날(KST), h: 그날 쓴 시간, b: { 주인 key: { n: 출현 번호(caught), h: 이번 쉬는 동안 모은 시간, d: 당긴 날 수 } } }
 *  · 상한 둘: 하루에 모든 주인을 합쳐 BOSS_CALL_DAY_CAP 시간(섬 하나 — 커플이 같이 쓴다), 한 번 쉬는 동안 BOSS_CALL_MAX 시간(= 7일 → 6일까지만).
 *    하루 상한이 경제를 묶는다 — 1년에 당길 수 있는 날이 많아야 365 × 6 ÷ 24 ≈ 91 주인-일이다(econbalance.test 가 잰다).
 *    처음 안(하루 12시간 · 한 번에 48시간 · 등급마다 2~12시간)은 1년 모형에서 열심 커플 순수입 +4.1% 라 줄였다.
 *  · 날짜는 앞으로만 — 오늘 쓴 시간의 날은 laterDay 로 고른다(폰 날짜를 되돌려 하루 상한을 다시 여는 길을 막는다, §10.25).
 *  · 쉬지 않는 주인(지금 낚시터에 있다 · 아직 안 잡았다) · 각성한 주인은 효과가 없다 — 모아 두지도 않는다(확인창이 그렇게 말한다).
 *  ⚠ fishing.ts 가 이 파일을 부른다 — fishing.ts 값 import 금지(고리). 낚시터 찾기(어느 주인인가)는 fishing.ts 가 한다. */
import type { IslandState } from "./island.ts";
import { BOSS_RETURN_DAYS, addDays, bossOf, dayDiff, laterDay, type BossRecord } from "./fishingworld.ts";

/** 다 큰 물고기 등급(GRADES 번호 0 흔함 ~ 7 태초)마다 줄이는 시간 */
export const BOSS_CALL_HOURS: readonly number[] = [1, 1, 2, 2, 3, 4, 5, 6];
/** 하루(KST)에 모든 주인을 합쳐 줄일 수 있는 시간 */
export const BOSS_CALL_DAY_CAP = 6;
/** 한 번 쉬는 동안 줄일 수 있는 시간 — 7일 쉬는 주인이 빨라야 6일 */
export const BOSS_CALL_MAX = 24;

type CallRec = { n: number; h: number; d: number };
export type BossCallState = { day: string; h: number; b: Record<string, CallRec> };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Number(v))) : lo);

/** 저장값 읽기 — 모양을 검사하고 상한을 다시 건다 */
export function bossCallOf(st: Pick<IslandState, "bossCall">): BossCallState {
  const raw = st.bossCall;
  const out: BossCallState = { day: "", h: 0, b: {} };
  if (!isObj(raw)) return out;
  if (typeof raw.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)) { out.day = raw.day; out.h = num(raw.h, 0, BOSS_CALL_DAY_CAP); }
  if (isObj(raw.b)) for (const [k, v] of Object.entries(raw.b)) {
    if (!isObj(v) || !Number.isFinite(v.n)) continue;
    out.b[k] = { n: Math.floor(Number(v.n)), h: num(v.h, 0, BOSS_CALL_MAX), d: Math.floor(num(v.d, 0, Math.floor(BOSS_CALL_MAX / 24))) };
  }
  return out;
}

/** 오늘 남은 시간 — 저장된 날보다 오늘이 뒤일 때만 새 하루(날짜를 되돌려도 다시 안 열린다) */
export function bossCallDayLeft(st: Pick<IslandState, "bossCall">, today: string): number {
  const c = bossCallOf(st);
  return c.day && c.day >= today ? Math.max(0, BOSS_CALL_DAY_CAP - c.h) : BOSS_CALL_DAY_CAP;
}
/** 이번 쉬는 동안 이 주인에게 모은 시간(출현 번호가 바뀌었으면 0) */
export function bossCallHours(st: Pick<IslandState, "bossCall">, key: string, rec: BossRecord | undefined): number {
  const r = bossCallOf(st).b[key];
  return rec && r && r.n === rec.caught ? r.h : 0;
}
/** 지금 쉬는 중인가 — 다시 나타날 날이 오늘보다 뒤 */
export const bossResting = (rec: BossRecord | undefined, today: string): boolean => !!rec?.until && dayDiff(today, rec.until) > 0;

export type BossCallPlan = { key: string; name: string; add: number; total: number; /** 이번에 당겨지는 날 */ days: number; /** 다시 나타나기까지 남은 날(당긴 뒤) */ left: number }
  | { key: string; name: string; add: 0; why: string };
/** 한 마리를 보내면 어떻게 되나 — 확인창이 미리 보이고, 저장(applyBossCall)도 같은 계산을 쓴다 */
export function planBossCall(st: Pick<IslandState, "bossCall" | "fishing">, key: string, grade: number, today: string): BossCallPlan | null {
  const boss = bossOf(key);
  if (!boss) return null;
  const rec = st.fishing?.bosses?.[key];
  if (!rec || !bossResting(rec, today)) return { key, name: boss.name, add: 0, why: rec && rec.caught > 0 ? "지금 낚시터에 있어요" : "아직 잡은 적이 없어요" };
  const have = bossCallHours(st, key, rec);
  const room = Math.min(bossCallDayLeft(st, today), BOSS_CALL_MAX - have);
  const add = Math.max(0, Math.min(BOSS_CALL_HOURS[Math.max(0, Math.min(BOSS_CALL_HOURS.length - 1, grade))] ?? 0, room));
  if (add <= 0) return { key, name: boss.name, add: 0, why: have >= BOSS_CALL_MAX ? `이번엔 ${BOSS_CALL_MAX}시간을 다 당겼어요` : `오늘은 ${BOSS_CALL_DAY_CAP}시간을 다 썼어요` };
  const total = have + add, before = Math.floor(have / 24), after = Math.floor(total / 24);
  return { key, name: boss.name, add, total, days: after - before, left: Math.max(0, dayDiff(today, rec.until) - (after - before)) };
}

/** 보냈다 — 시간을 모으고, 24시간이 찰 때마다 until 을 하루 당긴다. 효과가 없으면 그대로 돌려준다 */
export function applyBossCall(st: IslandState, key: string, grade: number, today: string): { state: IslandState; plan: BossCallPlan | null } {
  const plan = planBossCall(st, key, grade, today);
  if (!plan || plan.add <= 0 || !("total" in plan)) return { state: st, plan };
  const rec = st.fishing!.bosses[key];
  const c = bossCallOf(st);
  const day = laterDay(c.day || undefined, today);
  const usedToday = c.day && c.day >= today ? c.h : 0;
  const prev = c.b[key] && c.b[key].n === rec.caught ? c.b[key] : { n: rec.caught, h: 0, d: 0 };
  const d = Math.floor(plan.total / 24);
  // 당길 날 — 이미 당긴 날(prev.d)을 빼고 더한다. 다시 나타나는 날은 잡은 날(at) + 7 − 2 보다 앞당기지 않는다(BOSS_CALL_MAX 와 같은 바닥 — 두 겹 안전)
  const floor = addDays(rec.at, BOSS_RETURN_DAYS - Math.floor(BOSS_CALL_MAX / 24));
  const pulled = addDays(rec.until, -(d - prev.d));
  const until = pulled < floor ? (rec.until < floor ? rec.until : floor) : pulled;
  const next: BossRecord = { ...rec, until };
  const fishing = { ...st.fishing!, bosses: { ...st.fishing!.bosses, [key]: next } };
  const bossCall = { day, h: usedToday + plan.add, b: { ...c.b, [key]: { n: rec.caught, h: plan.total, d } } };
  return { state: { ...st, fishing, bossCall }, plan };
}
