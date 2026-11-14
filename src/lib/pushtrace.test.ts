// 알림 전달 결과 기록(2026-11-14 [사용자: "일기 작성하면 알람이 안와 알람 부분 제대로 검토해"]).
// 함수는 200 인데 알림이 안 오는 경우, 예전엔 애플 · 구글 푸시 서버의 거절을 어디에도 남기지 않아 원인을 볼 길이 없었다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fn = readFileSync("supabase/functions/send-poke-push/index.ts", "utf8");
const notify = readFileSync("src/lib/notify.ts", "utf8");

test("send-poke-push 는 발송마다 전달 결과(웹 푸시 실패 상태 · FCM)를 debug_logs 'push_out' 에 남긴다", () => {
  assert.match(fn, /tag: "push_out"/);
  assert.match(fn, /webFails\.push\(\{ host, status/);
  assert.match(fn, /reason: "muted"/);
  assert.match(fn, /fails: webFails/);
  // endpoint · 키는 기록하지 않는다(host 만)
  assert.doesNotMatch(fn, /trace\([^)]*endpoint/);
});

test("웹 푸시는 높은 우선순위(urgency high)로 — 안드로이드 절전 중에도 바로 깨운다", () => {
  assert.match(fn, /sendNotification\([^)]*urgency: "high"/);
});

test("앱이 보내기를 두 번 다 실패하면 진단 기록(push_send_fail)을 남긴다", () => {
  assert.match(notify, /logDebug\("push_send_fail"/);
});
