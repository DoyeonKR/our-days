import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../supabase/functions/daily-reminders/index.ts", import.meta.url),
  "utf8",
);

test("일정 알림 Edge: 이벤트별 알림일·월간 반복·사용자 시간대와 조용시간을 반영한다", () => {
  assert.match(source, /reminder_offsets/);
  assert.match(source, /recurrence === "monthly"/);
  assert.match(source, /timeZone: timezone/);
  assert.match(source, /inQuietHours\(hour/);
  // 게이트 키는 'dday'(기념일 알림) — 'remind'(오늘 남기기)로 되돌리면 자기 리마인더만
  // 끄려던 사용자가 주년 푸시까지 통째로 잃는다 [리뷰 2026-08-26]
  assert.match(source, /prefs\?\.dday === false/);
  assert.doesNotMatch(source, /prefs\?\.remind === false/);
});

test("일정 알림 Edge: 하루 2회 크론에도 같은 리마인더는 한 번만 나간다(reminder_log dedup)", () => {
  // 단일 크론(00:00 UTC)은 조용시간이 그 시각을 항상 덮는 시간대에서 기념일 푸시를 영영
  // 못 보냈다 — 2회 시도 + dedup 장부가 짝이다. 장부 없이 2회만 돌리면 이중 발송이 된다.
  assert.match(source, /from\("reminder_log"\)/);
  assert.match(source, /ignoreDuplicates: true/);
  assert.match(source, /if \(!claimed \|\| claimed\.length === 0\) continue/);
});

test("일정 알림 Edge: 만료 구독 404\/410을 정리한다", () => {
  assert.match(source, /code === 404 \|\| code === 410/);
  assert.match(source, /from\("push_subscriptions"\)[\s\S]*\.delete\(\)[\s\S]*\.eq\("endpoint"/);
});

test("일정 알림 Edge: 윤년 기념일을 말일로 clamp하고 DB 조회 실패를 성공 처리하지 않는다", () => {
  assert.match(source, /Math\.min\([\s\S]*start\.getUTCDate\(\)[\s\S]*daysInMonth/);
  for (const error of [
    "couplesError",
    "eventResult.error",
    "memberResult.error",
    "prefsError",
    "subscriptionsError",
  ]) {
    assert.match(source, new RegExp(`if \\(${error.replace(".", "\\.")}\\) throw`));
  }
  assert.match(source, /status: failedTotal \? 207 : 200/);
  assert.match(source, /status: 500/);
});
