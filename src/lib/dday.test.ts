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
  diffDays,
  generateMilestones,
  isAnniversary,
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

test("toISODate: 월/일 zero-pad + parseDate 왕복 [회귀 lock]", () => {
  assert.equal(toISODate(new Date(2026, 0, 5)), "2026-01-05"); // 1월 5일 → 0 패딩
  assert.equal(toISODate(new Date(2026, 11, 31)), "2026-12-31");
  // 문자열 → Date → 문자열 왕복 불변 (타임존 오프셋으로 하루 밀리면 안 됨)
  for (const s of ["2026-01-01", "2026-02-28", "2024-02-29", "2026-12-31"]) {
    assert.equal(toISODate(parseDate(s)), s, `왕복 깨짐: ${s}`);
  }
});

test("diffDays: 같은날 0, 월/연 경계, 역순 음수", () => {
  assert.equal(diffDays(D("2026-06-08"), D("2026-06-08")), 0);
  assert.equal(diffDays(D("2025-12-31"), D("2026-01-01")), 1); // 연 경계
  assert.equal(diffDays(D("2026-01-31"), D("2026-02-01")), 1); // 월 경계
  assert.equal(diffDays(D("2026-06-10"), D("2026-06-08")), -2); // 역순
});

test("daysTogether: ref 가 start 이전이면 1 미만(음수 포함)", () => {
  // 미래 시작일을 기준으로 과거를 보면 당일=1 규칙상 0 이하가 될 수 있다
  assert.equal(daysTogether(D("2026-03-10"), D("2026-03-09")), 0);
  assert.equal(daysTogether(D("2026-03-10"), D("2026-03-05")), -4);
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

test("generateMilestones: 주년만 (일수 기념일 제거) + 날짜 오름차순", () => {
  const ms = generateMilestones(D("2024-03-01"));
  for (let i = 1; i < ms.length; i++) {
    assert.ok(ms[i - 1].date.getTime() <= ms[i].date.getTime(), "정렬 깨짐");
  }
  // 100일·200일 등 일수 기념일은 자동 생성되지 않음 (회귀 lock)
  assert.ok(!ms.some((m) => m.kind === "day"));
  assert.ok(!ms.some((m) => m.label === "100일"));
  assert.ok(ms.some((m) => m.label === "1주년"));
  assert.equal(toISODate(ms[0].date), "2025-03-01"); // 첫 마일스톤 = 1주년
});

test("isAnniversary: category 우선, 없으면 repeatYearly 폴백 [회귀 lock]", () => {
  // category 가 있으면 그 값이 색(기념일/일정)을 결정 — repeatYearly 와 독립
  assert.equal(
    isAnniversary({ id: "1", title: "생일", date: "2024-01-01", repeatYearly: false, category: "anniversary" }),
    true,
  );
  assert.equal(
    isAnniversary({ id: "2", title: "매년 일정", date: "2024-01-01", repeatYearly: true, category: "plan" }),
    false,
  );
  // 구버전/로컬 데이터(category 없음): '매년 반복'을 기념일로 간주
  assert.equal(isAnniversary({ id: "3", title: "x", date: "2024-01-01", repeatYearly: true }), true);
  assert.equal(isAnniversary({ id: "4", title: "y", date: "2024-01-01", repeatYearly: false }), false);
});

test("upcomingMilestones: 다가오는 주년만", () => {
  const up = upcomingMilestones(D("2024-03-01"), 3, D("2025-02-01"));
  assert.equal(up[0].label, "1주년");
  assert.equal(toISODate(up[0].date), "2025-03-01");
  assert.ok(up.every((m) => m.kind === "year"));
});
