// 새 일정 푸시 lock. [사용자 2026-10-30 "일정 추가한것도 알람이 가게 해줘 푸쉬 알람"]
// 잠그는 것: 설정 토글('일정')이 있다 · 누르면 계획 › 일정으로 · 새 일정 저장 때만(편집은 안 보낸다) 보낸다 · 본문 형식.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eventPushMessage } from "./eventpush.ts";
import { activityRoute } from "./activity.ts";

test("설정에 '일정' 토글이 있고, 알림을 누르면 계획 › 일정으로 간다", () => {
  // notify.ts 는 @/ 경로를 써서 node --test 가 못 읽는다 — 소스로 본다
  const notify = readFileSync(join(import.meta.dirname, "notify.ts"), "utf8");
  assert.ok(notify.includes(`{ key: "event", label: "일정"`), "알림 설정에 일정 토글이 없다");
  assert.match(notify, /^\s+event: "event",/m, "일정 알림을 누르면 갈 곳이 없다");
  assert.deepEqual(activityRoute("event"), { view: "plan", sub: "cal" });
});

test("본문 — 이모지 · 제목 · 날짜 · 반복", () => {
  assert.equal(eventPushMessage({ title: "영화 보기", date: "2026-11-03" }), "영화 보기 · 11월 3일");
  assert.equal(eventPushMessage({ title: "커피", date: "2026-11-03", emoji: "☕", recurrence: "monthly" }), "☕ 커피 · 11월 3일 · 매달");
  assert.equal(eventPushMessage({ title: " ", date: "2026-01-09", repeatYearly: true }), "새 일정 · 1월 9일 · 매년");
});

test("새 일정 저장 때만 상대에게 보낸다 — 편집에는 안 보낸다 [소스 스캔]", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "app", "page.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const body = src.slice(src.indexOf("async function saveEvent"), src.indexOf("async function removeEvent"));
  assert.match(body, /if \(!exists\) void sendEventPush\(coupleId, "event"/, "새 일정 저장에서 푸시를 안 보낸다");
  assert.ok(body.indexOf("sendEventPush") > body.indexOf("eventContentMatches"), "서버 저장을 확인한 뒤에 보내야 한다");
});
