// 부루마블 룰북 + 전적 노출 회귀 lock. [2026-07-07]
// 사용자: "브루마블 승패 어디서 봐? 노출해줘 + 룰북 버튼 눌러 읽게 추가해줘".
// (1) 부루마블 전적(승/패/무)을 인트로 카드 + 게임 아케이드 카드에 노출(미니게임 전적과 구분),
// (2) '룰북' 버튼으로 여는 상세 규칙(RuleBook)을 추가했다. 이 노출/버튼이 사라지는 회귀를 막는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const board = readFileSync(join(here, "BoardGame.tsx"), "utf8");
const arcade = readFileSync(join(here, "GameArcade.tsx"), "utf8");

test("룰북: RuleBook 컴포넌트 + 버튼 + 상세 섹션 [회귀 lock]", () => {
  // 버튼으로 여는 룰북 오버레이
  assert.ok(board.includes("function RuleBook"), "RuleBook 오버레이 컴포넌트 존재");
  assert.ok(
    board.includes("setRulebook(true)"),
    "인트로에 룰북 여는 버튼(setRulebook) 존재",
  );
  assert.match(board, /자세한 룰북 보기|룰북/, "룰북 버튼 라벨 존재");
  assert.ok(
    board.includes("<RuleBook onClose"),
    "rulebook 상태에서 RuleBook 렌더",
  );
  // 상세 섹션 데이터 — 최소 10개 이상(요약 아닌 정독용)
  const sections = board.match(/RULEBOOK_SECTIONS/g) ?? [];
  assert.ok(sections.length >= 2, "RULEBOOK_SECTIONS 정의+사용");
  // 핵심 규칙 카테고리가 룰북에 포함(승패·통행료·무인도·관광세·월급)
  for (const kw of ["승패 판정", "통행료", "무인도", "관광세", "월급"]) {
    assert.ok(board.includes(kw), `룰북에 '${kw}' 섹션 존재`);
  }
  // 룰북은 fixed inset-0 오버레이 → ScrollLockManager 가 자동 스크롤락(관용 준수)
  assert.match(board, /function RuleBook[\s\S]*?fixed inset-0/, "룰북은 fixed inset-0 오버레이 관용");
});

test("전적 노출: 부루마블 전적을 인트로+아케이드 카드에 표시(미니게임과 구분) [회귀 lock]", () => {
  // 인트로: '부루마블 전적' 라벨 + 승/패/무 + 승률
  assert.ok(board.includes("부루마블 전적"), "인트로에 '부루마블 전적' 라벨");
  assert.ok(board.includes("승률"), "인트로 전적에 승률 표시");
  assert.ok(board.includes("record.wins") && board.includes("record.draws"), "승/무 표시");

  // 아케이드: 보드 전적을 별도 fetch 해 카드에 노출
  assert.ok(arcade.includes("getBoardResults"), "아케이드가 보드 결과 fetch");
  assert.ok(arcade.includes("boardRecord"), "boardRecord 로 전적 산출");
  assert.ok(arcade.includes("boardRec"), "boardRec 상태로 카드 노출");
  assert.match(arcade, /전적 \{boardRec\.wins\}승/, "부루마블 카드에 전적 표시");
  // 미니게임 전적과 혼동 방지 라벨
  assert.ok(arcade.includes("미니게임 전적"), "미니게임 전적 라벨로 보드 전적과 구분");
});
