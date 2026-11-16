// 같이 하는 습관(2026-11-13, README §10.27) — 연속 기록 · 주 경계 · both/either · KST · 하트 상한.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HABIT_HEART,
  HABIT_HEART_DAY_CAP,
  HABIT_PAY_KEEP,
  bothChecked,
  dayNum,
  doneToday,
  habitPayKey,
  habitPayOf,
  habitStreak,
  isoOfDay,
  normalizeHabitName,
  normalizeTarget,
  settleHabitPay,
  shiftDay,
  todaySummary,
  upsertCheckin,
  weekGrid,
  weekStartIso,
  withPending,
  type HabitCheckin,
} from "./habits.ts";
import { kstDate } from "./kst.ts";
import type { IslandState } from "./island.ts";

const ME = "me";
const YOU = "you";
const PAIR = [ME, YOU];
const daily = (mode: "both" | "either" = "both") => ({ id: "h1", mode, target_kind: "daily" as const, target_count: 1 });
const weekly = (n: number, mode: "both" | "either" = "both") => ({ id: "h1", mode, target_kind: "weekly" as const, target_count: n });
const ck = (day: string, user = ME, done = true, habit = "h1"): HabitCheckin => ({ habit_id: habit, user_id: user, day, done });
const both = (...days: string[]) => days.flatMap((d) => [ck(d), ck(d, YOU)]);

test("날짜 셈 — 정수 일련번호 · 월요일 시작 · 해 · 윤년 경계", () => {
  assert.equal(dayNum("1970-01-01"), 0);
  assert.equal(isoOfDay(dayNum("2024-02-29")), "2024-02-29");
  assert.equal(shiftDay("2024-03-01", -1), "2024-02-29");
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  assert.equal(weekStartIso("2026-11-13"), "2026-11-09"); // 금 → 월
  assert.equal(weekStartIso("2026-11-09"), "2026-11-09"); // 월
  assert.equal(weekStartIso("2026-11-15"), "2026-11-09"); // 일요일은 그 주의 끝
  assert.equal(weekStartIso("2026-11-16"), "2026-11-16");
  assert.equal(weekStartIso("2027-01-01"), "2026-12-28"); // 해를 넘는 주
  assert.ok(Number.isNaN(dayNum("2026-1-1")));
});

test("날짜 셈은 기기 시간대 · 서머타임과 무관하다(DST 가 있는 날도 하루는 하루)", () => {
  // 미국 서머타임 시작(2026-03-08) · 끝(2026-11-01), 유럽(2026-03-29) — 정수 셈이라 하루가 23 · 25시간이 되지 않는다
  for (const d of ["2026-03-08", "2026-11-01", "2026-03-29", "2026-10-25"]) {
    assert.equal(dayNum(shiftDay(d, 1)) - dayNum(d), 1, d);
    assert.equal(shiftDay(shiftDay(d, 1), -1), d);
  }
  // 1년 내내 주의 시작은 늘 월요일
  for (let n = dayNum("2026-01-01"); n < dayNum("2027-01-01"); n++) {
    assert.equal(new Date(`${weekStartIso(isoOfDay(n))}T00:00:00Z`).getUTCDay(), 1);
  }
});

test("KST 하루 — 밤 11시 59분(KST)과 자정 1분 뒤는 다른 날, 같은 UTC 날짜라도", () => {
  const before = Date.UTC(2026, 10, 12, 14, 59); // 2026-11-12 23:59 KST
  const after = Date.UTC(2026, 10, 12, 15, 1); //  2026-11-13 00:01 KST
  assert.equal(kstDate(before), "2026-11-12");
  assert.equal(kstDate(after), "2026-11-13");
  // 어제(KST) 체크하고 오늘 아직이면 연속은 이어진다(아침마다 0 이 되지 않게)
  const s = habitStreak(daily(), both("2026-11-11", "2026-11-12"), PAIR, kstDate(after));
  assert.deepEqual(s, { count: 2, unit: "day", current: false });
});

test("매일 · 둘 다 — 둘 다 체크한 날만 센다, 오늘이 비면 어제부터", () => {
  const rows = [...both("2026-11-10", "2026-11-11", "2026-11-12"), ck("2026-11-13")];
  assert.deepEqual(habitStreak(daily(), rows, PAIR, "2026-11-13"), { count: 3, unit: "day", current: false });
  assert.deepEqual(habitStreak(daily(), [...rows, ck("2026-11-13", YOU)], PAIR, "2026-11-13"), { count: 4, unit: "day", current: true });
  // 하루가 한 사람뿐이면 끊긴다
  const gap = [...both("2026-11-10"), ck("2026-11-11"), ...both("2026-11-12")];
  assert.equal(habitStreak(daily(), gap, PAIR, "2026-11-12").count, 1);
  // 이틀 비면 0
  assert.equal(habitStreak(daily(), both("2026-11-10"), PAIR, "2026-11-12").count, 0);
});

test("매일 · 한 명만 — 누구든 한 명이면 그 날은 채운다", () => {
  const rows = [ck("2026-11-10"), ck("2026-11-11", YOU), ck("2026-11-12")];
  assert.equal(habitStreak(daily("either"), rows, PAIR, "2026-11-12").count, 3);
  assert.equal(habitStreak(daily("both"), rows, PAIR, "2026-11-12").count, 0);
});

test("되돌린 줄(done=false)은 체크가 아니다", () => {
  const rows = [...both("2026-11-11", "2026-11-12"), ck("2026-11-12", YOU, false)];
  assert.equal(habitStreak(daily(), rows, PAIR, "2026-11-12").count, 2, "같은 열쇠 줄이 둘이면 목록이 이상한 것 — done 인 것만 센다");
  const undone = upsertCheckin(both("2026-11-11", "2026-11-12"), ck("2026-11-12", YOU, false));
  assert.equal(habitStreak(daily(), undone, PAIR, "2026-11-12").count, 1);
});

test("혼자 쓰는 공간 — 'both' 는 구성원 모두 = 나 하나", () => {
  assert.equal(habitStreak(daily("both"), [ck("2026-11-11"), ck("2026-11-12")], [ME], "2026-11-12").count, 2);
});

test("주 N회 — 주 경계(월요일)를 넘어 이어서 센다 · 이번 주가 덜 찼으면 지난주부터", () => {
  // 지난지난주(11/2~8) 3번 · 지난주(11/9~15) 3번 · 이번 주(11/16~) 1번
  const rows = both("2026-11-03", "2026-11-05", "2026-11-08", "2026-11-09", "2026-11-12", "2026-11-15", "2026-11-17");
  assert.deepEqual(habitStreak(weekly(3), rows, PAIR, "2026-11-18"), { count: 2, unit: "week", current: false });
  // 이번 주에 둘 더 채우면 3주
  const more = [...rows, ...both("2026-11-18", "2026-11-19")];
  assert.deepEqual(habitStreak(weekly(3), more, PAIR, "2026-11-19"), { count: 3, unit: "week", current: true });
  // 일요일(11/15)은 지난주에 든다 — 월요일 시작이 아니면 이 셈이 틀린다
  const sundayOnly = both("2026-11-13", "2026-11-14", "2026-11-15");
  assert.equal(habitStreak(weekly(3), sundayOnly, PAIR, "2026-11-16").count, 1);
  // 해를 넘는 주(2026-12-28 ~ 2027-01-03)
  const ny = both("2026-12-29", "2026-12-31", "2027-01-02");
  assert.deepEqual(habitStreak(weekly(3), ny, PAIR, "2027-01-03"), { count: 1, unit: "week", current: true });
});

test("주 N회 · both — 한 사람만 한 날은 세지 않는다", () => {
  const rows = [...both("2026-11-09", "2026-11-10"), ck("2026-11-11")];
  assert.equal(habitStreak(weekly(3), rows, PAIR, "2026-11-15").count, 0);
  assert.equal(habitStreak(weekly(3, "either"), rows, PAIR, "2026-11-15").count, 1);
});

test("창으로 자르지 않는다 — 400일 넘게 이어진 연속도 끝까지 센다", () => {
  const days = Array.from({ length: 420 }, (_, i) => shiftDay("2026-11-13", -i));
  assert.equal(habitStreak(daily(), both(...days), PAIR, "2026-11-13").count, 420);
});

test("이번 주 칸 — 월~일 일곱, 나 · 상대 따로, 미래 칸 표시", () => {
  const rows = [ck("2026-11-09"), ck("2026-11-10", YOU), ...both("2026-11-11")];
  const g = weekGrid(daily(), rows, ME, YOU, PAIR, "2026-11-12");
  assert.equal(g.length, 7);
  assert.equal(g[0].day, "2026-11-09");
  assert.equal(g[6].day, "2026-11-15");
  assert.deepEqual([g[0].me, g[0].partner, g[0].met], [true, false, false]);
  assert.deepEqual([g[1].me, g[1].partner], [false, true]);
  assert.deepEqual([g[2].me, g[2].partner, g[2].met], [true, true, true]);
  assert.ok(g[3].today && !g[3].future);
  assert.ok(g[4].future && g[6].future);
});

test("오늘 요약 — '오늘 N개 중 M개'는 둘을 합친 기준, 주 N회는 이번 주를 채웠으면 끝", () => {
  const habits = [daily(), { ...daily("either"), id: "h2" }, { ...weekly(2), id: "h3" }];
  const rows = [
    ...both("2026-11-13"),
    ck("2026-11-13", YOU, true, "h2"),
    ...both("2026-11-10", "2026-11-11").map((c) => ({ ...c, habit_id: "h3" })),
  ];
  assert.deepEqual(todaySummary(habits, rows, PAIR, "2026-11-13"), { total: 3, done: 3 });
  assert.equal(doneToday(habits[0], [ck("2026-11-13")], PAIR, "2026-11-13"), false, "both 인데 나만 했다");
  assert.deepEqual(todaySummary([], [], PAIR, "2026-11-13"), { total: 0, done: 0 });
});

test("낙관적 체크 — 못 보낸 내 값이 서버 줄을 이긴다, 상대 줄은 그대로", () => {
  const server = [ck("2026-11-13"), ck("2026-11-13", YOU)];
  const v = withPending(server, [{ habitId: "h1", day: "2026-11-13", done: false }], ME);
  assert.equal(v.filter((c) => c.user_id === ME && c.done).length, 0);
  assert.equal(v.filter((c) => c.user_id === YOU && c.done).length, 1);
  const added = withPending([], [{ habitId: "h1", day: "2026-11-13", done: true }], ME);
  assert.deepEqual(added, [ck("2026-11-13")]);
});

test("이름 · 목표 정리 — 20자(글자 단위) · 공백 · 숨은 글자 · 주 1~6회", () => {
  assert.deepEqual(normalizeHabitName("  물  마시기 "), { ok: true, name: "물 마시기" });
  assert.equal(normalizeHabitName("가".repeat(20)).ok, true);
  assert.equal(normalizeHabitName("가".repeat(21)).ok, false);
  assert.equal(normalizeHabitName("   ").ok, false);
  assert.equal(normalizeHabitName("물​마시기").ok, false);
  assert.deepEqual(normalizeTarget("daily", 5), { target_kind: "daily", target_count: 1 });
  assert.deepEqual(normalizeTarget("weekly", 9), { target_kind: "weekly", target_count: 6 });
  assert.deepEqual(normalizeTarget("weekly", 0), { target_kind: "weekly", target_count: 1 });
});

/* ── 하트 ─────────────────────────────────────────────────────────── */

const island = (over: Partial<IslandState> = {}) => ({ coins: 100, log: [], ...over }) as unknown as IslandState;

test("하트 — 둘 다 한 습관 하루 = +5, 같은 열쇠는 두 번 안 준다(같은 참조)", () => {
  const s0 = island();
  const r = settleHabitPay(s0, "h1", "2026-11-13", "2026-11-13", "물 마시기");
  assert.equal(r.reason, "paid");
  assert.equal(r.coins, HABIT_HEART);
  assert.equal(r.state.coins, 105);
  assert.deepEqual(r.state.habitPay, ["2026-11-13|h1"]);
  assert.match(r.state.log[0], /물 마시기/);
  const again = settleHabitPay(r.state, "h1", "2026-11-13", "2026-11-13");
  assert.equal(again.reason, "dup");
  assert.equal(again.state, r.state, "저장할 것이 없으면 같은 참조");
});

test("하트 — 커플 하루 20개까지(습관 넷), 다섯째는 0 · 다음 날은 다시", () => {
  let s = island();
  let total = 0;
  for (let i = 1; i <= 6; i++) {
    const r = settleHabitPay(s, `h${i}`, "2026-11-13", "2026-11-13");
    total += r.coins;
    if (i > 4) {
      assert.equal(r.reason, "cap");
      assert.equal(r.state, s);
    }
    s = r.state;
  }
  assert.equal(total, HABIT_HEART_DAY_CAP);
  assert.equal(s.coins, 100 + HABIT_HEART_DAY_CAP);
  const next = settleHabitPay(s, "h1", "2026-11-14", "2026-11-14");
  assert.equal(next.coins, HABIT_HEART);
});

test("하트 — 오늘이 아니면(늦게 올라온 지난 체크) 안 준다 · 링에 미래 날짜가 있으면(시계 되돌림) 안 준다", () => {
  const s = island();
  assert.equal(settleHabitPay(s, "h1", "2026-11-12", "2026-11-13").reason, "stale");
  const future = island({ habitPay: ["2026-11-20|h9"] });
  const r = settleHabitPay(future, "h1", "2026-11-13", "2026-11-13");
  assert.equal(r.reason, "stale");
  assert.equal(r.state, future);
});

test("하트 — 링은 60개로 묶인다(하루 4개라 오늘 열쇠는 늘 남는다) · 이상한 값은 버린다", () => {
  const old = Array.from({ length: 80 }, (_, i) => habitPayKey(shiftDay("2026-11-12", -Math.floor(i / 4)), `x${i}`)).reverse();
  const s = island({ habitPay: [...old, 42 as unknown as string, "junk"] });
  assert.equal(habitPayOf(s).length, 80);
  const r = settleHabitPay(s, "h1", "2026-11-13", "2026-11-13");
  assert.equal(r.state.habitPay!.length, HABIT_PAY_KEEP);
  assert.equal(r.state.habitPay!.at(-1), "2026-11-13|h1");
  // 링이 꽉 차도 오늘 상한은 오늘 열쇠로만 센다
  let t = r.state;
  for (const h of ["h2", "h3", "h4", "h5"]) t = settleHabitPay(t, h, "2026-11-13", "2026-11-13").state;
  assert.equal(t.coins - s.coins, HABIT_HEART_DAY_CAP);
});

test("하트 조건 — 둘 다 그 날 체크(either 습관도), 상대가 없으면 없음", () => {
  const rows = [ck("2026-11-13"), ck("2026-11-13", YOU)];
  assert.equal(bothChecked(rows, "h1", "2026-11-13", ME, YOU), true);
  assert.equal(bothChecked([ck("2026-11-13")], "h1", "2026-11-13", ME, YOU), false);
  assert.equal(bothChecked(rows, "h1", "2026-11-13", ME, null), false);
  assert.equal(bothChecked([ck("2026-11-13"), ck("2026-11-13", YOU, false)], "h1", "2026-11-13", ME, YOU), false);
});
