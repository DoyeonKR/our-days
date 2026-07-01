// 일기장 타임라인/회상/검색 순수 로직 회귀 lock. [2026-07-02]
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  entryMonthKey,
  groupByMonth,
  matchesQuery,
  monthLabel,
  onThisDay,
  yearsAgo,
} from "./diary.ts";

const E = (entry_date: string, extra: Record<string, unknown> = {}) => ({
  entry_date,
  ...extra,
});

test("entryMonthKey / monthLabel", () => {
  assert.equal(entryMonthKey(E("2026-07-02")), "2026-07");
  assert.equal(monthLabel("2026-07"), "2026년 7월");
  assert.equal(monthLabel("2025-12"), "2025년 12월");
});

test("groupByMonth: 최신 월 먼저 + 그룹 내 순서 유지 [회귀 lock]", () => {
  const g = groupByMonth([
    E("2026-07-10"),
    E("2026-07-02"),
    E("2026-06-30"),
    E("2025-12-25"),
  ]);
  assert.deepEqual(
    g.map((x) => x.key),
    ["2026-07", "2026-06", "2025-12"],
  );
  assert.equal(g[0].items.length, 2);
  assert.equal(g[0].items[0].entry_date, "2026-07-10"); // 입력 순서 보존
});

test("onThisDay: 같은 월-일 + 이전 연도만 [회귀 lock]", () => {
  const entries = [
    E("2026-07-02"), // 오늘(제외 — 이전 연도 아님)
    E("2025-07-02"), // 작년 오늘 ✓
    E("2024-07-02"), // 재작년 오늘 ✓
    E("2025-07-03"), // 하루 차이(제외)
    E("2023-08-02"), // 다른 월(제외)
  ];
  const r = onThisDay(entries, "2026-07-02");
  assert.deepEqual(
    r.map((x) => x.entry_date),
    ["2025-07-02", "2024-07-02"],
  );
  assert.equal(yearsAgo("2025-07-02", "2026-07-02"), 1);
  assert.equal(yearsAgo("2024-07-02", "2026-07-02"), 2);
});

test("matchesQuery: 제목/본문/위치/해시태그 부분일치, 빈 질의 통과", () => {
  const e = {
    title: "제주 여행",
    body: "바다가 예뻤다",
    location: "협재해변",
    hashtags: ["여행", "커플"],
  };
  assert.ok(matchesQuery(e, ""));
  assert.ok(matchesQuery(e, "제주"));
  assert.ok(matchesQuery(e, "바다"));
  assert.ok(matchesQuery(e, "협재"));
  assert.ok(matchesQuery(e, "여행")); // 해시태그
  assert.ok(matchesQuery(e, "커플"));
  assert.ok(!matchesQuery(e, "서울"));
  // 널 필드 안전
  assert.ok(matchesQuery({ title: null, body: null, location: null }, ""));
  assert.ok(!matchesQuery({ title: null, body: null }, "abc"));
});
