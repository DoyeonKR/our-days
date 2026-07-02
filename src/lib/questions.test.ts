// 오늘의 질문 결정 로직 회귀 lock. 핵심 계약:
//  - 같은 '로컬 달력일'이면 항상 같은 질문(둘이 같은 질문을 봐야 답이 묶임).
//  - 하루 넘어가면 인덱스가 정확히 +1 (mod n) 로 진행(DST 무관 — Date.UTC 순수 산술).
//  - id('q{idx}') ↔ text 왕복이 일치.
import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, questionText, todaysQuestion } from "./questions.ts";

const n = QUESTIONS.length;

test("todaysQuestion: 같은 로컬 날짜면 시각 무관 동일 (둘이 같은 질문) [회귀 lock]", () => {
  const morning = new Date(2026, 0, 1, 1, 5); // 로컬 2026-01-01 01:05
  const night = new Date(2026, 0, 1, 23, 55); // 로컬 2026-01-01 23:55
  const a = todaysQuestion(morning);
  const b = todaysQuestion(night);
  assert.deepEqual(a, b, "같은 날인데 시각에 따라 질문이 달라짐");
});

test("todaysQuestion: id/text 정합 + 범위 안", () => {
  const q = todaysQuestion(new Date(2026, 5, 15));
  const m = /^q(\d+)$/.exec(q.id);
  assert.ok(m, `id 포맷 이상: ${q.id}`);
  const idx = Number(m![1]);
  assert.ok(idx >= 0 && idx < n, "idx 범위 벗어남");
  assert.equal(q.text, QUESTIONS[idx]);
});

test("todaysQuestion: 연속된 날은 +1 (mod n), 항상 유효 인덱스 — 랩어라운드 포함 [회귀 lock]", () => {
  // 컷오버(2026-07-03) 이후 구간에서 n+3 일 연속 → 최소 한 번 경계(n-1 → 0) 통과
  let prev: number | null = null;
  for (let i = 0; i < n + 3; i++) {
    const d = new Date(2026, 7, 1 + i); // 2026-08-01 부터 (풀 36 로테이션 구간)
    const q = todaysQuestion(d);
    const idx = Number(/^q(\d+)$/.exec(q.id)![1]);
    assert.ok(idx >= 0 && idx < n, `범위 이탈 day+${i}: ${idx}`);
    if (prev !== null) {
      assert.equal((idx - prev + n) % n, 1, `day+${i} 증분이 1이 아님`);
    }
    prev = idx;
  }
});

test("todaysQuestion: 풀 확장 컷오버 — 과거 날짜는 옛 풀(30) 유지, 컷오버부터 새 풀(36) [회귀 lock]", () => {
  // 컷오버 이전(2026-07-01, dayNum 20635): 30문항 로테이션 → 스파이시(q30~) 안 나옴
  const before = todaysQuestion(new Date(2026, 6, 1));
  const bIdx = Number(/^q(\d+)$/.exec(before.id)![1]);
  assert.ok(bIdx < 30, `컷오버 전인데 새 풀 인덱스: ${before.id}`);
  assert.equal(before.id, "q25"); // 20635 % 30
  // 과거 여러 날짜도 항상 옛 풀 범위(배포로 과거 질문이 안 바뀜)
  for (const d of [new Date(2026, 0, 15), new Date(2025, 11, 31), new Date(2026, 5, 30)]) {
    const idx = Number(/^q(\d+)$/.exec(todaysQuestion(d).id)![1]);
    assert.ok(idx < 30, `과거(${d.toDateString()})에 새 풀 인덱스 ${idx}`);
  }
  // 컷오버 당일(2026-07-03, dayNum 20637): 36문항 로테이션
  assert.equal(todaysQuestion(new Date(2026, 6, 3)).id, "q9"); // 20637 % 36
});

test("questionText: 왕복 일치 + 잘못된 id 는 '질문' 폴백", () => {
  const q = todaysQuestion(new Date(2026, 2, 3));
  assert.equal(questionText(q.id), q.text); // 왕복
  assert.equal(questionText("q0"), QUESTIONS[0]);
  assert.equal(questionText(`q${n - 1}`), QUESTIONS[n - 1]);
  assert.equal(questionText(`q${n}`), "질문"); // 범위 밖
  assert.equal(questionText("q9999"), "질문");
  assert.equal(questionText("qabc"), "질문");
  assert.equal(questionText(""), "질문");
  assert.equal(questionText("garbage"), "질문");
});

test("QUESTIONS: 중복/빈 문항 없음 (풀 품질) [회귀 lock]", () => {
  assert.ok(n >= 10, "질문 풀이 너무 적음");
  assert.equal(new Set(QUESTIONS).size, n, "중복 질문 존재");
  assert.ok(QUESTIONS.every((q) => q.trim().length > 0), "빈 질문 존재");
});
