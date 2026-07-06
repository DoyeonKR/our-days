// 활동 리마인더 결정 로직 회귀 lock. [2026-07-03]
// Edge(activity-nudge)의 nudgeFor 미러가 이 계약을 지켜야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nudgeFor } from "./nudge.ts";
// notify.ts 는 "@/lib/supabase" alias 를 import 해서 node 테스트에서 직접 못 불러옴 → 소스로 확인

test("오전 점검: 오전 로그 없을 때만 알림", () => {
  // 오전 로그 있음 → 알림 없음
  assert.equal(nudgeFor(false, { didAm: true, didPm: false, didDiary: false }), null);
  // 오전 로그 없음 → 오전 알림 (오후/일기 상태는 무관)
  const m = nudgeFor(false, { didAm: false, didPm: true, didDiary: true });
  assert.ok(m && m.title.includes("오전"));
});

test("저녁 점검: 오후 로그·일기 조합별 메시지", () => {
  // 둘 다 있음 → 알림 없음
  assert.equal(nudgeFor(true, { didAm: false, didPm: true, didDiary: true }), null);
  // 오후만 없음
  const pm = nudgeFor(true, { didAm: true, didPm: false, didDiary: true });
  assert.ok(pm && pm.title.includes("오후") && !pm.title.includes("일기"));
  // 일기만 없음
  const d = nudgeFor(true, { didAm: true, didPm: true, didDiary: false });
  assert.ok(d && d.title.includes("일기") && !d.title.includes("오후"));
  // 둘 다 없음 → 통합 메시지
  const both = nudgeFor(true, { didAm: true, didPm: false, didDiary: false });
  assert.ok(both && both.title.includes("오후") && both.title.includes("일기"));
});

test("저녁 점검은 오전 로그 여부와 무관 (오전은 이미 닫힘)", () => {
  // didAm=false 여도 저녁엔 오전을 언급하지 않는다 (닫힌 슬롯을 재촉하지 않음)
  const m = nudgeFor(true, { didAm: false, didPm: true, didDiary: true });
  assert.equal(m, null);
});

test("notify: 'remind'(자기 리마인더) 카테고리가 설정 목록에 있다", () => {
  const notify = readFileSync(join(import.meta.dirname, "notify.ts"), "utf8");
  assert.ok(
    /key:\s*"remind"/.test(notify),
    "remind 카테고리가 NOTIFY_CATEGORIES 에 없음",
  );
  assert.ok(/\|\s*"remind"/.test(notify), "NotifyCategory 타입에 remind 없음");
});
