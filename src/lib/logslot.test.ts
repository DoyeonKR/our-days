// 오늘의 로그 2슬롯 규칙 회귀 lock. [2026-07-02]
// ⚠ 픽스처는 반드시 절대 인스턴트("+09:00" ISO)로 — new Date(y,m,d,h) 는 실행 TZ 의
// 로컬시간이라, 하네스가 TZ=Asia/Seoul 이면 'KST 고정' 계약이 로컬시간으로 회귀해도
// 전부 통과해 버린다. npm test 가 TZ=UTC 로도 이 파일을 돌려 TZ 독립성을 강제한다. [2026-07-02]
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canWriteSlot,
  logDateIso,
  shiftDateIso,
  slotLabel,
  slotOf,
} from "./logslot.ts";

/** KST 벽시계 → 절대 인스턴트 (실행 TZ 무관). */
const kst = (iso: string) => new Date(`${iso}+09:00`);

test("slotOf: KST 00~11시=am, 12~23시=pm [회귀 lock, TZ 독립]", () => {
  assert.equal(slotOf(kst("2026-07-02T00:00:00")), "am"); // KST 00:00
  assert.equal(slotOf(kst("2026-07-02T11:59:00")), "am");
  assert.equal(slotOf(kst("2026-07-02T12:00:00")), "pm"); // KST 12:00 정각부터 오후
  assert.equal(slotOf(kst("2026-07-02T23:59:00")), "pm");
});

test("slotLabel / logDateIso", () => {
  assert.equal(slotLabel("am"), "오전");
  assert.equal(slotLabel("pm"), "오후");
  assert.equal(logDateIso(kst("2026-01-05T09:00:00")), "2026-01-05");
  // KST 자정 직후 = UTC 는 전날 15시 — 로컬시간 회귀 시 여기서 날짜가 하루 밀린다
  assert.equal(logDateIso(kst("2026-01-05T00:30:00")), "2026-01-05");
  // KST 23시 = UTC 14시 — UTC 기준으로도 같은 날이지만 반대 방향 확인
  assert.equal(logDateIso(kst("2026-01-05T23:00:00")), "2026-01-05");
});

test("shiftDateIso: ±1일/±13일 정확 이동 — day 자리 오타로 12일 밀리던 회귀 lock", () => {
  assert.equal(shiftDateIso("2026-07-02", -1), "2026-07-01");
  assert.equal(shiftDateIso("2026-07-02", 1), "2026-07-03");
  assert.equal(shiftDateIso("2026-07-02", -13), "2026-06-19"); // KEEP_DAYS-1 조회 시작점
  assert.equal(shiftDateIso("2026-01-01", -1), "2025-12-31"); // 연 경계
  assert.equal(shiftDateIso("2026-03-01", -1), "2026-02-28"); // 월 경계(평년)
});

test("canWriteSlot: 오늘(KST)의 현재 슬롯만 열림 [회귀 lock, TZ 독립]", () => {
  const morning = kst("2026-07-02T09:30:00"); // KST 오전
  assert.equal(canWriteSlot("2026-07-02", "am", morning), true);
  assert.equal(canWriteSlot("2026-07-02", "pm", morning), false); // 미래 슬롯 잠김
  const evening = kst("2026-07-02T20:00:00"); // KST 오후
  assert.equal(canWriteSlot("2026-07-02", "pm", evening), true);
  assert.equal(canWriteSlot("2026-07-02", "am", evening), false); // 지난 슬롯 잠김
  assert.equal(canWriteSlot("2026-07-01", "pm", evening), false); // 지난 날짜 잠김
  assert.equal(canWriteSlot("2026-07-03", "am", evening), false); // 미래 날짜 잠김
  // KST 자정 직후(UTC 전날 15시) — 로컬시간 회귀 시 '어제 pm' 이 열려버린다
  const justAfterMidnight = kst("2026-07-02T00:10:00");
  assert.equal(canWriteSlot("2026-07-02", "am", justAfterMidnight), true);
  assert.equal(canWriteSlot("2026-07-01", "pm", justAfterMidnight), false);
});
