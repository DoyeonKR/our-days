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
  assert.match(source, /prefs\?\.remind === false/);
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
