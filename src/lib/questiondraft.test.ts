// 오늘의 질문 — 자정을 넘긴 초안 회귀 lock (2026-11-11).
// 자정 전에 쓰던 답이 오늘 질문 아래 보이면서 어제 질문에 저장되던 것, 다시 열면 말없이 지워지던 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTION_GRACE_MS, pickStaleQuestionDraft, questionDraftState } from "./questiondraft.ts";

// KST = UTC+9 → 2026-11-11 00:00 KST = 2026-11-10T15:00Z
const kst = (iso: string) => Date.parse(iso + "+09:00");

test("초안이 어느 질문 것인가 — 오늘 · 어제(유예) · 유예 지남", () => {
  const today = "q12@2026-11-11";
  const yday = "q40@2026-11-10";
  assert.equal(questionDraftState(null, today, kst("2026-11-11T10:00:00")), "today");
  assert.equal(questionDraftState(today, today, kst("2026-11-11T10:00:00")), "today");
  assert.equal(questionDraftState(yday, today, kst("2026-11-11T00:05:00")), "grace", "자정 직후엔 어제 질문에 낼 수 있다");
  assert.equal(questionDraftState(yday, today, kst("2026-11-11T02:59:00")), "grace");
  assert.equal(questionDraftState(yday, today, kst("2026-11-11T03:01:00")), "expired", "유예는 몇 시간뿐");
  assert.equal(questionDraftState("q40@2026-11-09", today, kst("2026-11-11T00:05:00")), "expired", "그제 질문");
  assert.equal(questionDraftState("q40", today, kst("2026-11-11T00:05:00")), "expired", "날짜 없는 옛 id 는 언제 것인지 모른다");
  assert.ok(QUESTION_GRACE_MS > 0 && QUESTION_GRACE_MS <= 6 * 3_600_000);
});

test("지난 질문 초안 — 글이 있는 가장 최근 것 하나를 한 번 보여 주고, 말없이 지우지 않는다", () => {
  const p = "ourdays:draft:question:c:";
  const r = pickStaleQuestionDraft([
    { key: p + "q1@2026-11-09", value: { body: "그제 답", questionId: "q1@2026-11-09" } },
    { key: p + "q2@2026-11-10", value: { body: "어제 답", questionId: "q2@2026-11-10" } },
    { key: p + "q3@2026-11-08", value: { body: "  ", questionId: "q3@2026-11-08" } },
  ]);
  assert.equal(r.offer?.key, p + "q2@2026-11-10", "가장 최근의 글 있는 초안");
  assert.deepEqual(r.remove.sort(), [p + "q1@2026-11-09", p + "q3@2026-11-08"]);
  const again = pickStaleQuestionDraft([{ key: p + "q2@2026-11-10", value: { body: "어제 답", questionId: "q2@2026-11-10", offered: true } }]);
  assert.equal(again.offer, null, "한 번 보여 준 초안은 다시 꺼내지 않는다");
  assert.deepEqual(again.remove, [p + "q2@2026-11-10"]);
  assert.deepEqual(pickStaleQuestionDraft([]), { offer: null, remove: [] });
});
