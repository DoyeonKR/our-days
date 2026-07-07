// 테트리스 진입/모드 회귀 lock. [2026-07-07]
// 사용자: "테트리스 퀄리티 높게 + 대결(점수, 기존 하루 룰)/실시간(무제한 공격전) 2모드 +
// 입장 버튼과 룰북은 부루마블 시작 버튼 하단에". 이 배치/모드 분리가 깨지는 회귀를 막는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GAMES, GAME_DIR } from "../lib/game.ts";

const here = dirname(fileURLToPath(import.meta.url));
const arcade = readFileSync(join(here, "GameArcade.tsx"), "utf8");
const versus = readFileSync(join(here, "TetrisVersus.tsx"), "utf8");
const schema = readFileSync(join(here, "../../supabase/schema.sql"), "utf8");

test("아케이드 — 테트리스 카드는 부루마블 카드 '하단' + 입장/룰북 버튼 [회귀 lock]", () => {
  const boardIdx = arcade.indexOf("부루마블 · 실시간 대결");
  const tetrisIdx = arcade.indexOf("테트리스 · 클래식 대결");
  assert.ok(boardIdx > 0 && tetrisIdx > 0, "두 카드 존재");
  assert.ok(tetrisIdx > boardIdx, "테트리스 카드가 부루마블 카드 아래(사용자 지정 위치)");
  assert.ok(arcade.includes("입장"), "입장 버튼");
  assert.ok(arcade.includes("룰북 보기"), "룰북 버튼");
  assert.ok(arcade.includes("setShowTetrisHub(true)"), "입장 → 모드 선택 허브");
  assert.ok(arcade.includes("<TetrisRuleBook"), "룰북 오버레이 마운트");
});

test("모드 분리 — 점수 대결=기존 하루 캡 플로우, 실시간=무제한 [회귀 lock]", () => {
  // 점수 대결: 기존 매치 플로우(startNew) + 일일 캡(remaining) 재사용
  assert.ok(arcade.includes('startNew("tetris")'), "점수 대결은 기존 챌린지 플로우");
  assert.ok(arcade.includes('remaining("tetris")'), "점수 대결 하루 캡 표시");
  assert.ok(arcade.includes('game === "tetris"') && arcade.includes("TetrisBattle"), "라운드 렌더 스위치");
  // 실시간: 일일 캡 소모(recordPlay)·챌린지 생성 금지 — 무제한 모드
  assert.ok(!versus.includes("recordPlay"), "실시간 대결은 recordPlay(일일 캡) 미사용");
  assert.ok(!versus.includes("createGameChallenge"), "실시간 대결은 챌린지 미생성");
  assert.ok(versus.includes("joinTetrisChannel"), "실시간 채널 사용");
  assert.ok(versus.includes("recordTetrisResult"), "승패는 tetris_results 기록");
  assert.ok(versus.includes("addGarbage"), "공격 수신 → 쓰레기 주입");
});

test("게임 등록 — GAMES/GAME_DIR/서버 스키마 계약 [회귀 lock]", () => {
  const t = GAMES.find((g) => g.key === "tetris");
  assert.ok(t, "GAMES 에 tetris");
  assert.equal(GAME_DIR.tetris, "higher", "높은 점수 승(서버 resolve_challenge 와 동일)");
  // 서버 미러(schema.sql): CHECK 3곳 + plausible + 방향 + 전적 테이블
  const checks = schema.match(/'reaction','memory','tap','order','timing','tetris'/g) ?? [];
  assert.ok(checks.length >= 4, `game 키 목록에 tetris(${checks.length}곳 — CHECK 3 + record_play)`);
  assert.ok(schema.includes("when 'tetris'"), "plausible 에 tetris 범위");
  assert.ok(schema.includes("in ('memory','tap','tetris')"), "resolve/record 방향에 tetris");
  assert.ok(schema.includes("create table if not exists public.tetris_results"), "실시간 전적 테이블");
});
