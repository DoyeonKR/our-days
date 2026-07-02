// 오늘의 로그 2슬롯 규칙 회귀 lock. [2026-07-02]
import { test } from "node:test";
import assert from "node:assert/strict";
import { canWriteSlot, logDateIso, slotLabel, slotOf } from "./logslot.ts";

test("slotOf: 00~11시=am, 12~23시=pm [회귀 lock]", () => {
  assert.equal(slotOf(new Date(2026, 6, 2, 0, 0)), "am"); // 00:00
  assert.equal(slotOf(new Date(2026, 6, 2, 11, 59)), "am");
  assert.equal(slotOf(new Date(2026, 6, 2, 12, 0)), "pm"); // 12:00 정각부터 오후
  assert.equal(slotOf(new Date(2026, 6, 2, 23, 59)), "pm");
});

test("slotLabel / logDateIso", () => {
  assert.equal(slotLabel("am"), "오전");
  assert.equal(slotLabel("pm"), "오후");
  assert.equal(logDateIso(new Date(2026, 0, 5, 9)), "2026-01-05");
});

test("canWriteSlot: 오늘의 현재 슬롯만 열림 [회귀 lock]", () => {
  const morning = new Date(2026, 6, 2, 9, 30); // 오늘 오전
  assert.equal(canWriteSlot("2026-07-02", "am", morning), true);
  assert.equal(canWriteSlot("2026-07-02", "pm", morning), false); // 미래 슬롯 잠김
  const evening = new Date(2026, 6, 2, 20, 0); // 오늘 오후
  assert.equal(canWriteSlot("2026-07-02", "pm", evening), true);
  assert.equal(canWriteSlot("2026-07-02", "am", evening), false); // 지난 슬롯 잠김
  assert.equal(canWriteSlot("2026-07-01", "pm", evening), false); // 지난 날짜 잠김
  assert.equal(canWriteSlot("2026-07-03", "am", evening), false); // 미래 날짜 잠김
});
