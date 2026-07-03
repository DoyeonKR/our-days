// streak.ts 회귀 lock — 연속 활동일 계산 경계.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, streakMilestone } from "./streak.ts";

const TODAY = "2026-07-03";

test("computeStreak: 오늘 포함 연속 3일", () => {
  const s = computeStreak(["2026-07-01", "2026-07-02", "2026-07-03"], TODAY);
  assert.deepEqual(s, { count: 3, activeToday: true });
});

test("computeStreak: 오늘 없고 어제까지 연속 → 살아있음(activeToday=false)", () => {
  const s = computeStreak(["2026-07-01", "2026-07-02"], TODAY); // 어제=7/2
  assert.deepEqual(s, { count: 2, activeToday: false });
});

test("computeStreak: 오늘·어제 모두 없으면 0 (끊김)", () => {
  const s = computeStreak(["2026-06-30"], TODAY);
  assert.deepEqual(s, { count: 0, activeToday: false });
});

test("computeStreak: 중간에 빠진 날 있으면 오늘부터 끊긴 지점까지만", () => {
  // 6/29, 7/1, 7/2, 7/3 → 오늘부터 역순: 7/3,7/2,7/1 연속(6/30 없음에서 멈춤) = 3
  const s = computeStreak(["2026-06-29", "2026-07-01", "2026-07-02", "2026-07-03"], TODAY);
  assert.deepEqual(s, { count: 3, activeToday: true });
});

test("computeStreak: 활동 없음 → 0", () => {
  assert.deepEqual(computeStreak([], TODAY), { count: 0, activeToday: false });
});

test("computeStreak: 오늘만 활동 → 1", () => {
  assert.deepEqual(computeStreak([TODAY], TODAY), { count: 1, activeToday: true });
});

test("computeStreak: 중복 날짜/Set 입력 모두 처리", () => {
  const s = computeStreak(new Set(["2026-07-03", "2026-07-03", "2026-07-02"]), TODAY);
  assert.deepEqual(s, { count: 2, activeToday: true });
});

test("computeStreak: 월 경계 역순", () => {
  // 오늘 7/3 없음, 어제 7/2 없음 → 하지만 6월 말 연속은 무관(끊김)
  assert.equal(computeStreak(["2026-06-30", "2026-06-29"], TODAY).count, 0);
  // 오늘 3/1, 이전 2/28,2/27 연속(2026 평년)
  assert.deepEqual(
    computeStreak(["2026-02-27", "2026-02-28", "2026-03-01"], "2026-03-01"),
    { count: 3, activeToday: true },
  );
});

test("streakMilestone: 정확히 마일스톤일 때만 값", () => {
  assert.equal(streakMilestone(7), 7);
  assert.equal(streakMilestone(100), 100);
  assert.equal(streakMilestone(6), null);
  assert.equal(streakMilestone(8), null);
  assert.equal(streakMilestone(0), null);
});
