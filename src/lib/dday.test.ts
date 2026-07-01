// dday 핵심 로직 회귀 테스트 (zero-dep, node:test + 타입 스트리핑).
//   npm test   (= node --test)
// 리뷰에서 확인된 2/29 윤년 오버플로 버그를 lock 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anniversaryDate,
  dayCountToDate,
  daysTogether,
  ddayLabel,
  generateMilestones,
  nextOccurrence,
  parseDate,
  toISODate,
  upcomingMilestones,
} from "./dday.ts";

const D = (iso: string) => parseDate(iso);

test("daysTogether: 사귄 당일이 1일째 (한국식)", () => {
  assert.equal(daysTogether(D("2024-03-01"), D("2024-03-01")), 1);
  assert.equal(daysTogether(D("2024-03-01"), D("2024-03-10")), 10);
});

test("dayCountToDate: N일째 = start + (N-1)일", () => {
  assert.equal(toISODate(dayCountToDate(D("2024-03-01"), 1)), "2024-03-01");
  assert.equal(toISODate(dayCountToDate(D("2024-03-01"), 100)), "2024-06-08");
});

test("anniversaryDate: 일반 + 2/29 윤년 clamp", () => {
  assert.equal(toISODate(anniversaryDate(D("2024-03-01"), 1)), "2025-03-01");
  // 2/29 시작 → 평년엔 2/28 로 clamp (3/1 로 넘치지 않음) [회귀 lock]
  assert.equal(toISODate(anniversaryDate(D("2024-02-29"), 1)), "2025-02-28");
  assert.equal(toISODate(anniversaryDate(D("2024-02-29"), 2)), "2026-02-28");
  // 다음 윤년(4주년)엔 다시 2/29
  assert.equal(toISODate(anniversaryDate(D("2024-02-29"), 4)), "2028-02-29");
});

test("ddayLabel: 오늘=D-DAY, 미래=D-n, 과거=D+n", () => {
  assert.equal(ddayLabel(D("2024-06-08"), D("2024-06-08")), "D-DAY");
  assert.equal(ddayLabel(D("2024-06-11"), D("2024-06-08")), "D-3");
  assert.equal(ddayLabel(D("2024-06-06"), D("2024-06-08")), "D+2");
});

test("nextOccurrence: 비반복은 원 날짜, 반복은 지났으면 내년", () => {
  const once = { id: "a", title: "x", date: "2024-01-15", repeatYearly: false };
  assert.equal(toISODate(nextOccurrence(once, D("2024-06-08"))), "2024-01-15");
  const yearly = { id: "b", title: "생일", date: "2024-01-15", repeatYearly: true };
  assert.equal(toISODate(nextOccurrence(yearly, D("2024-06-08"))), "2025-01-15");
  assert.equal(toISODate(nextOccurrence(yearly, D("2024-01-01"))), "2024-01-15");
});

test("nextOccurrence: 2/29 반복 이벤트는 평년 2/28, 윤년 2/29 [회귀 lock]", () => {
  const feb29 = { id: "c", title: "기념", date: "2024-02-29", repeatYearly: true };
  // 평년(2025) 기준 → 2/28 로 clamp (3/1 아님)
  assert.equal(toISODate(nextOccurrence(feb29, D("2025-01-01"))), "2025-02-28");
  // 윤년(2028) 기준 → 그대로 2/29
  assert.equal(toISODate(nextOccurrence(feb29, D("2028-01-01"))), "2028-02-29");
});

test("generateMilestones: 날짜 오름차순 + 100일/1주년 포함", () => {
  const ms = generateMilestones(D("2024-03-01"));
  for (let i = 1; i < ms.length; i++) {
    assert.ok(ms[i - 1].date.getTime() <= ms[i].date.getTime(), "정렬 깨짐");
  }
  assert.ok(ms.some((m) => m.label === "100일"));
  assert.ok(ms.some((m) => m.label === "1주년"));
});

test("upcomingMilestones: 오늘 이후(포함)만, 오늘 정확히 걸린 것 포함", () => {
  const up = upcomingMilestones(D("2024-03-01"), 3, D("2024-06-08")); // 6/8 = 100일
  assert.equal(up[0].label, "100일");
  assert.equal(toISODate(up[0].date), "2024-06-08");
  assert.equal(up.length, 3);
});
