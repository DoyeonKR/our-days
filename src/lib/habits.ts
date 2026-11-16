// 같이 하는 습관(2026-11-13) — 순수 로직: 날짜 셈 · 연속 기록 · 이번 주 칸 · 오늘 요약 · 섬 하트 정산.
// README §10.27. 화면(HabitBoard · HabitTodayCard)과 저장소(habitstore)가 부르고 habits.test 가 바로 돌린다.
//
// ⚠ 날짜는 늘 KST 'YYYY-MM-DD' 문자열로 받고, 셈은 정수 일련번호(1970-01-01 = 0)로 한다. 기기 시간대의 Date 를 쓰면
//   서머타임 · 시간대가 다른 기기에서 하루가 23 · 25시간이 되어 주 경계가 어긋난다(정수 셈은 그런 날이 없다).
// ⚠ 이 파일은 상대 경로 import 만 쓴다(@/ 별칭 없음) — node --test 가 그대로 읽는다.
import type { IslandState } from "./island.ts";

export type HabitTarget = "daily" | "weekly";
export type HabitMode = "both" | "either";

export type Habit = {
  id: string;
  couple_id: string;
  name: string;
  icon: string;
  target_kind: HabitTarget;
  /** 매일이면 1, 주 N회면 N(1~6). */
  target_count: number;
  mode: HabitMode;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/** 한 사람 · 한 습관 · 하루 한 줄(unique habit_id, user_id, day). 되돌리기는 done=false 로 같은 줄을 고친다. */
export type HabitCheckin = {
  habit_id: string;
  user_id: string;
  day: string;
  done: boolean;
};

export const HABIT_NAME_MAX = 20;
/** 한 커플이 만들 수 있는 습관 수 — 서버 트리거(habits_cap)와 같은 값. */
export const HABIT_MAX = 30;
export const WEEKLY_MAX = 6;

/* ── 날짜 셈(정수 일련번호) ─────────────────────────────────────────────── */

/** 'YYYY-MM-DD' → 1970-01-01 부터 며칠째(UTC 자정 기준 — 시간대 · 서머타임과 무관). 못 읽으면 NaN. */
export function dayNum(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000);
}
export function isoOfDay(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}
export function shiftDay(iso: string, by: number): string {
  return isoOfDay(dayNum(iso) + by);
}
/** 그 날이 속한 주(월요일 시작)의 월요일 일련번호. 1970-01-01 은 목요일(월=0 이면 3). */
export function weekStartNum(n: number): number {
  return n - (((n % 7) + 7 + 3) % 7);
}
export function weekStartIso(iso: string): string {
  return isoOfDay(weekStartNum(dayNum(iso)));
}

/* ── 이름 · 목표 ──────────────────────────────────────────────────────────── */

const HIDDEN = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/;

/** 습관 이름 정리 — 공백을 하나로 · 앞뒤 공백 제거 · 20자(글자 단위). 서버 CHECK 와 같은 규칙. */
export function normalizeHabitName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const v = String(raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!v) return { ok: false, reason: "습관 이름을 적어 주세요" };
  if (HIDDEN.test(v)) return { ok: false, reason: "쓸 수 없는 글자가 있어요" };
  if ([...v].length > HABIT_NAME_MAX) return { ok: false, reason: `이름은 ${HABIT_NAME_MAX}자까지예요` };
  return { ok: true, name: v };
}

/** 목표 정리 — 매일은 1회, 주 N회는 1~6(7이면 매일과 같다). */
export function normalizeTarget(kind: HabitTarget, count: number): { target_kind: HabitTarget; target_count: number } {
  if (kind !== "weekly") return { target_kind: "daily", target_count: 1 };
  const n = Math.round(Number(count));
  return { target_kind: "weekly", target_count: Number.isFinite(n) ? Math.min(WEEKLY_MAX, Math.max(1, n)) : 1 };
}

export function targetLabel(h: Pick<Habit, "target_kind" | "target_count">): string {
  return h.target_kind === "weekly" ? `주 ${h.target_count}회` : "매일";
}
export function modeLabel(mode: HabitMode): string {
  return mode === "either" ? "한 명만 해도" : "둘 다 해야";
}

/* ── 하루 · 한 주가 채워졌나 ───────────────────────────────────────────────── */

/** 습관 하나의 날짜별 체크한 사람들(done 인 줄만). */
export function checksByDay(checkins: readonly HabitCheckin[], habitId: string): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const c of checkins) {
    if (c.habit_id !== habitId || !c.done) continue;
    const n = dayNum(c.day);
    if (!Number.isFinite(n)) continue;
    let s = out.get(n);
    if (!s) out.set(n, (s = new Set()));
    s.add(c.user_id);
  }
  return out;
}

/** 그 날이 습관의 하루 몫을 채웠나. 'both' 는 구성원 모두(혼자 쓰는 공간이면 나 하나), 'either' 는 누구든 한 명.
 *  members 가 비었으면(아직 모름) 누구든 한 명으로 본다. */
export function dayMet(mode: HabitMode, who: ReadonlySet<string> | undefined, members: readonly string[]): boolean {
  if (!who || who.size === 0) return false;
  if (mode === "either" || members.length === 0) return true;
  return members.every((m) => who.has(m));
}

function metDays(h: Pick<Habit, "id" | "mode">, checkins: readonly HabitCheckin[], members: readonly string[]): Set<number> {
  const out = new Set<number>();
  for (const [n, who] of checksByDay(checkins, h.id)) if (dayMet(h.mode, who, members)) out.add(n);
  return out;
}

/** 그 주(월요일 일련번호)에 채운 날 수. */
function weekCount(met: ReadonlySet<number>, monday: number): number {
  let k = 0;
  for (let i = 0; i < 7; i++) if (met.has(monday + i)) k++;
  return k;
}

export type HabitStreak = { count: number; unit: "day" | "week"; /** 지금 칸(오늘 · 이번 주)도 이미 채웠나 */ current: boolean };

/** 연속 기록 — 매일 습관은 이어서 채운 날, 주 N회는 이어서 채운 주.
 *  아직 끝나지 않은 오늘(또는 이번 주)이 비어 있어도 끊긴 게 아니다 — 어제(지난주)부터 센다(아침마다 0 이 되지 않게).
 *  창으로 자르지 않는다: 받은 기록 전부를 본다(README §10.12 의 '90일에서 멈춘 모닥불'과 같은 실수를 하지 않게). */
export function habitStreak(
  h: Pick<Habit, "id" | "mode" | "target_kind" | "target_count">,
  checkins: readonly HabitCheckin[],
  members: readonly string[],
  today: string,
): HabitStreak {
  const met = metDays(h, checkins, members);
  const t = dayNum(today);
  if (h.target_kind === "weekly") {
    const need = Math.max(1, h.target_count);
    const thisWeek = weekStartNum(t);
    const current = weekCount(met, thisWeek) >= need;
    let w = current ? thisWeek : thisWeek - 7;
    let count = 0;
    while (weekCount(met, w) >= need) {
      count++;
      w -= 7;
    }
    return { count, unit: "week", current };
  }
  const current = met.has(t);
  let d = current ? t : t - 1;
  let count = 0;
  while (met.has(d)) {
    count++;
    d--;
  }
  return { count, unit: "day", current };
}

export function streakLabel(s: HabitStreak): string {
  if (s.count === 0) return "새로 시작";
  return s.unit === "week" ? `${s.count}주 연속` : `${s.count}일 연속`;
}

export type WeekCell = { day: string; me: boolean; partner: boolean; met: boolean; today: boolean; future: boolean };

/** 이번 주(월~일) 칸 일곱 — 나 · 상대가 체크했는지(색은 보는 사람 기준: 나 분홍 · 상대 파랑). */
export function weekGrid(
  h: Pick<Habit, "id" | "mode">,
  checkins: readonly HabitCheckin[],
  me: string | null,
  partner: string | null,
  members: readonly string[],
  today: string,
): WeekCell[] {
  const by = checksByDay(checkins, h.id);
  const t = dayNum(today);
  const monday = weekStartNum(t);
  return Array.from({ length: 7 }, (_, i) => {
    const n = monday + i;
    const who = by.get(n);
    return {
      day: isoOfDay(n),
      me: !!me && !!who?.has(me),
      partner: !!partner && !!who?.has(partner),
      met: dayMet(h.mode, who, members),
      today: n === t,
      future: n > t,
    };
  });
}

/** 오늘 이 습관은 끝났나 — 매일은 오늘 몫, 주 N회는 이번 주 몫을 이미 채웠거나 오늘 몫을 채웠으면. */
export function doneToday(
  h: Pick<Habit, "id" | "mode" | "target_kind" | "target_count">,
  checkins: readonly HabitCheckin[],
  members: readonly string[],
  today: string,
): boolean {
  const met = metDays(h, checkins, members);
  const t = dayNum(today);
  if (met.has(t)) return true;
  return h.target_kind === "weekly" && weekCount(met, weekStartNum(t)) >= Math.max(1, h.target_count);
}

/** '오늘 N개 중 M개' — 둘을 합친 기준. */
export function todaySummary(
  habits: readonly Pick<Habit, "id" | "mode" | "target_kind" | "target_count">[],
  checkins: readonly HabitCheckin[],
  members: readonly string[],
  today: string,
): { total: number; done: number } {
  return { total: habits.length, done: habits.filter((h) => doneToday(h, checkins, members, today)).length };
}

/** 내가 오늘 이 습관을 체크했나. */
export function checkedBy(checkins: readonly HabitCheckin[], habitId: string, user: string | null, day: string): boolean {
  return !!user && checkins.some((c) => c.habit_id === habitId && c.user_id === user && c.day === day && c.done);
}

/** 서버에서 받은 줄 위에 아직 못 보낸 내 체크(낙관적 · 재시도 대기)를 얹는다 — 같은 열쇠면 보낼 값이 이긴다. */
export type PendingCheck = { habitId: string; day: string; done: boolean };
export function withPending(server: readonly HabitCheckin[], pending: readonly PendingCheck[], me: string | null): HabitCheckin[] {
  if (!me || pending.length === 0) return server as HabitCheckin[];
  const key = (h: string, d: string) => `${h}|${d}`;
  const over = new Map(pending.map((p) => [key(p.habitId, p.day), p]));
  const out = server.filter((c) => c.user_id !== me || !over.has(key(c.habit_id, c.day)));
  for (const p of over.values()) out.push({ habit_id: p.habitId, user_id: me, day: p.day, done: p.done });
  return out;
}

/** 실시간으로 받은 한 줄을 목록에 반영(같은 열쇠는 바꾼다). 순수. */
export function upsertCheckin(list: readonly HabitCheckin[], row: HabitCheckin): HabitCheckin[] {
  const rest = list.filter((c) => !(c.habit_id === row.habit_id && c.user_id === row.user_id && c.day === row.day));
  return row.done ? [...rest, row] : rest;
}

/* ── 섬 하트(작고 상한이 있다) ─────────────────────────────────────────────── */

/** 둘 다 그 날 체크한 습관 하나 = 하트 5개. 커플 하루 20개까지(습관 넷). */
export const HABIT_HEART = 5;
export const HABIT_HEART_DAY_CAP = 20;
/** 섬 상태 최상위 `habitPay` 에 남기는 정산 열쇠 수 — 하루 최대 4개라 60개면 2주 넘게 남는다. */
export const HABIT_PAY_KEEP = 60;

export const habitPayKey = (day: string, habitId: string) => `${day}|${habitId}`;

/** 섬 상태에서 정산 기록 읽기 — 옛 섬엔 없다(옵셔널 = 무마이그레이션). 이상한 값은 버린다. */
export function habitPayOf(s: Pick<IslandState, "habitPay">): string[] {
  const v = s.habitPay;
  return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && /^\d{4}-\d{2}-\d{2}\|/.test(k)) : [];
}

/** 둘이 그 날 함께 체크했나(하트의 조건 — 'either' 습관도 둘 다 해야 하트). 상대가 없으면(혼자 쓰는 공간) 하트 없음. */
export function bothChecked(checkins: readonly HabitCheckin[], habitId: string, day: string, me: string | null, partner: string | null): boolean {
  return !!me && !!partner && checkedBy(checkins, habitId, me, day) && checkedBy(checkins, habitId, partner, day);
}

/** 습관 하나 · 하루를 섬에 정산 — 순수. 이미 받았거나 · 오늘이 아니거나 · 상한이면 **같은 참조**를 돌려준다(저장할 것 없음).
 *  · 오늘(서버 시각의 KST)만 준다 — 늦게 올라온 지난 체크 · 링에서 밀려난 열쇠로 다시 받지 못하게.
 *  · 링에 오늘보다 뒤 날짜가 있으면(폰 날짜를 앞으로 돌렸다 되돌린 것) 주지 않는다 — 정원 합치기의 'later' 가드와 같은 뜻.
 *  · 되돌리기(체크 취소)로 하트를 거두지 않는다. 열쇠가 남아 있어 다시 체크해도 또 받지 않는다. */
export function settleHabitPay(
  s: IslandState,
  habitId: string,
  day: string,
  today: string,
  label?: string,
): { state: IslandState; coins: number; reason: "paid" | "dup" | "stale" | "cap" } {
  if (day !== today) return { state: s, coins: 0, reason: "stale" };
  const keys = habitPayOf(s);
  const key = habitPayKey(day, habitId);
  if (keys.includes(key)) return { state: s, coins: 0, reason: "dup" };
  if (keys.some((k) => k.slice(0, 10) > today)) return { state: s, coins: 0, reason: "stale" };
  const paid = keys.filter((k) => k.slice(0, 10) === today).length * HABIT_HEART;
  const coins = Math.max(0, Math.min(HABIT_HEART, HABIT_HEART_DAY_CAP - paid));
  if (coins <= 0) return { state: s, coins: 0, reason: "cap" };
  const line = label ? `같이 하는 습관 '${label}' 둘 다 해냈어요 +${coins} 하트` : `같이 하는 습관 둘 다 해냈어요 +${coins} 하트`;
  return {
    state: {
      ...s,
      coins: s.coins + coins,
      habitPay: [...keys, key].slice(-HABIT_PAY_KEEP),
      log: [line, ...(Array.isArray(s.log) ? s.log : [])].slice(0, 50),
    },
    coins,
    reason: "paid",
  };
}
