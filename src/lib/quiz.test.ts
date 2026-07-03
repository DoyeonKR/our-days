// quiz.ts 점수 로직 회귀 lock — 내 예측이 상대 실제와 맞은 개수.
import { test } from "node:test";
import assert from "node:assert/strict";
import { quizScore, quizChoiceLabel, QUIZ, type QuizResponseLite } from "./quiz.ts";

const r = (
  question_id: string,
  user_id: string,
  self_choice: "a" | "b",
  guess_choice: "a" | "b",
): QuizResponseLite => ({ question_id, user_id, self_choice, guess_choice });

test("quizScore: 둘 다 답한 문제만 채점, 예측 적중 카운트", () => {
  const resp = [
    r("qz0", "me", "a", "a"), // 내 예측 a
    r("qz0", "you", "a", "b"), // 상대 실제 a → 적중
    r("qz1", "me", "b", "a"), // 내 예측 a
    r("qz1", "you", "b", "a"), // 상대 실제 b → 빗나감
  ];
  assert.deepEqual(quizScore(resp, "me"), { correct: 1, total: 2 });
});

test("quizScore: 한쪽만 답한 문제는 total 에서 제외", () => {
  const resp = [
    r("qz0", "me", "a", "a"),
    r("qz0", "you", "a", "b"), // 둘 다 → 적중
    r("qz1", "me", "a", "b"), // 나만 답함 → 제외
  ];
  assert.deepEqual(quizScore(resp, "me"), { correct: 1, total: 1 });
});

test("quizScore: 활동 없음 → 0/0", () => {
  assert.deepEqual(quizScore([], "me"), { correct: 0, total: 0 });
});

test("quizScore: uid null 이면 모두 상대로 취급 → 0/0", () => {
  const resp = [r("qz0", "me", "a", "a"), r("qz0", "you", "a", "b")];
  assert.deepEqual(quizScore(resp, null), { correct: 0, total: 0 });
});

test("quizScore: 전부 적중", () => {
  const resp = [
    r("qz0", "me", "a", "b"),
    r("qz0", "you", "b", "a"), // 예측 b = 실제 b → 적중
    r("qz1", "me", "a", "a"),
    r("qz1", "you", "a", "a"), // 예측 a = 실제 a → 적중
  ];
  assert.deepEqual(quizScore(resp, "me"), { correct: 2, total: 2 });
});

test("quizChoiceLabel: id/choice → 라벨, 미지 id 는 choice 그대로", () => {
  assert.equal(quizChoiceLabel(QUIZ[0].id, "a"), QUIZ[0].a);
  assert.equal(quizChoiceLabel(QUIZ[0].id, "b"), QUIZ[0].b);
  assert.equal(quizChoiceLabel("nope", "a"), "a");
});
