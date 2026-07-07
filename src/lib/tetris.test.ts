// 테트리스 엔진 회귀 lock — 결정론(같은 시드=같은 블록)/7-bag/SRS킥/클리어·B2B·콤보 점수/
// 공격 테이블·상쇄/쓰레기 유입/홀드/탑아웃/T-스핀(3코너)/퍼펙트 클리어/스냅샷 인코딩. [2026-07-07]
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATK_PC,
  GARBAGE_CELL,
  GARBAGE_PER_LOCK,
  LOCK_DELAY_MS,
  PENDING_CAP,
  SCORE_PC,
  T_COLS,
  T_HIDDEN,
  T_ROWS,
  T_TOTAL,
  ULTRA_SECONDS,
  type TetrisState,
  canFall,
  clearLabel,
  createTetris,
  decodeBoard,
  encodeBoard,
  ghostY,
  gravityMs,
  gravityStep,
  hardDrop,
  holdSwap,
  lockNow,
  moveX,
  queueGarbage,
  rotate,
  softDrop,
} from "./tetris.ts";

const at = (s: TetrisState, x: number, y: number) => s.board[y * T_COLS + x];

/** y행을 except 열만 빼고 쓰레기로 채움(시나리오 구성용). */
function fillRow(s: TetrisState, y: number, except: number[] = []): void {
  for (let x = 0; x < T_COLS; x++) {
    if (!except.includes(x)) s.board[y * T_COLS + x] = GARBAGE_CELL;
  }
}

/** 퍼펙트 클리어 방지용 잔여 블록 — 클리어 후에도 보드에 남아 PC 보너스가 안 붙게.
 *  (행을 완성하지 않는 위치·스폰 구역 밖: col 8,9 × 위쪽 한 행) */
function addStray(s: TetrisState): void {
  s.board[(T_TOTAL - 9) * T_COLS + 8] = GARBAGE_CELL;
  s.board[(T_TOTAL - 9) * T_COLS + 9] = GARBAGE_CELL;
}

test("결정론 — 같은 시드면 블록 순서 동일(점수 대결 공정성)", () => {
  const a = createTetris(12345);
  const b = createTetris(12345);
  assert.equal(a.kind, b.kind);
  assert.deepEqual(a.queue.slice(0, 10), b.queue.slice(0, 10));
});

test("7-bag — 첫 7개(현재+큐6)와 다음 7개가 각각 0..6 순열", () => {
  const s = createTetris(7);
  const bag1 = [s.kind, ...s.queue.slice(0, 6)].sort();
  const bag2 = s.queue.slice(6, 13).sort();
  assert.deepEqual(bag1, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(bag2, [0, 1, 2, 3, 4, 5, 6]);
});

test("이동 — 벽에 막히면 그대로(참조 동일 = 무변화)", () => {
  const s = createTetris(1);
  s.kind = 1; // O: 미노 x∈{1,2}
  s.x = -1; // 실제 열 0,1
  const blocked = moveX(s, -1);
  assert.equal(blocked, s); // 왼벽 밖 → 원본 그대로
  const ok = moveX(s, 1);
  assert.notEqual(ok, s);
  assert.equal(ok.x, 0);
});

test("SRS 킥 — 왼벽의 세로 I 가 킥으로 회전 성공", () => {
  const s = createTetris(2);
  s.kind = 0; // I
  s.rot = 1; // 세로(미노 x오프셋 2)
  s.x = -2; // 실제 열 0
  s.y = 6;
  const r = rotate(s, 1); // 1→2, 킥 (2,0) 필요
  assert.equal(r.rot, 2);
  assert.ok(r.x > s.x, "킥으로 오른쪽 이동");
});

test("하드드롭 — 착지+락+스폰, 낙하거리 ×2 점수", () => {
  const s = createTetris(3);
  const before = s.pieces;
  const gy = ghostY(s);
  const dist = gy - s.y;
  const r = hardDrop(s);
  assert.equal(r.pieces, before + 1);
  assert.ok(r.board.some((v) => v !== 0), "보드에 고정됨");
  assert.ok(r.score >= dist * 2);
  assert.ok(r.kind >= 0, "다음 조각 스폰");
});

test("테트리스(4줄) — 800점 + 공격 4 + B2B 자격 [회귀 lock]", () => {
  const s = createTetris(4);
  addStray(s); // PC 방지
  for (let y = T_TOTAL - 4; y < T_TOTAL; y++) fillRow(s, y, [0]);
  s.kind = 0; // I 세로를 0열에
  s.rot = 3; // 미노 x오프셋 1
  s.x = -1;
  s.y = 2;
  const r = hardDrop(s);
  assert.equal(r.last?.cleared, 4);
  assert.equal(r.last?.attack, 4);
  assert.equal(r.lines, 4);
  assert.equal(r.b2b, true);
  assert.ok(r.score >= 800, `테트리스 800점 이상(실제 ${r.score})`);
});

test("B2B 테트리스 — ×1.5 점수 + 공격 +1(=5) [회귀 lock]", () => {
  let s = createTetris(4);
  addStray(s); // PC 방지(첫 클리어 후 아래로 시프트되어 둘째 클리어에도 잔존)
  for (let y = T_TOTAL - 4; y < T_TOTAL; y++) fillRow(s, y, [0]);
  s.kind = 0;
  s.rot = 3;
  s.x = -1;
  s.y = 2;
  s = hardDrop(s); // 첫 테트리스 → b2b 대기
  const scoreAfterFirst = s.score;
  for (let y = T_TOTAL - 4; y < T_TOTAL; y++) fillRow(s, y, [0]);
  s.kind = 0;
  s.rot = 3;
  s.x = -1;
  s.y = 2;
  s = hardDrop(s);
  assert.equal(s.last?.b2b, true);
  assert.equal(s.last?.attack, 5); // 4 + B2B 1 (콤보1 보너스 0)
  // 두 번째 클리어 점수: floor(800×1.5)=1200 + 콤보 50 (하드드롭 제외해도 1250 이상)
  assert.ok(s.score - scoreAfterFirst >= 1250, `B2B 보너스 반영(${s.score - scoreAfterFirst})`);
});

test("콤보 — 연속 클리어 시 카운트/공격 보너스 증가", () => {
  let s = createTetris(5);
  // 3연속 싱글 클리어 구성
  for (let i = 0; i < 3; i++) {
    fillRow(s, T_TOTAL - 1, [0]); // 바닥 1줄, 0열만 빔
    s.kind = 0; // I 세로 → 0열 채움(1줄만 클리어, 나머지 3칸은 위에 쌓임)
    s.rot = 3;
    s.x = -1;
    s.y = 2;
    s = hardDrop(s);
    assert.equal(s.last?.cleared, 1, `${i + 1}번째 싱글`);
    assert.equal(s.last?.combo, i); // 0,1,2
  }
  // 콤보 2까지 왔음 — 다음 비클리어 락이면 콤보 리셋
  s.kind = 1;
  s.x = 3;
  s.y = 2;
  s = hardDrop(s);
  assert.equal(s.last?.cleared, 0);
  assert.equal(s.combo, -1);
});

test("공격 상쇄(캔슬) — 대기 3 + 테트리스 공격 4 → 실공격 1, 유입 0 [회귀 lock]", () => {
  let s = createTetris(4);
  addStray(s); // PC 방지
  s = queueGarbage(s, 3);
  for (let y = T_TOTAL - 4; y < T_TOTAL; y++) fillRow(s, y, [0]);
  s.kind = 0;
  s.rot = 3;
  s.x = -1;
  s.y = 2;
  s = hardDrop(s);
  assert.equal(s.pending, 0);
  assert.equal(s.last?.attack, 1); // 4-3
  assert.equal(s.last?.garbageIn, 0);
});

test("쓰레기 유입 — 비클리어 락 때 바닥에 구멍 1개 줄 삽입", () => {
  let s = createTetris(6);
  s = queueGarbage(s, 2);
  s = hardDrop(s); // 클리어 없음 → 2줄 유입
  assert.equal(s.last?.garbageIn, 2);
  // 바닥 2줄: 각 줄에 빈칸 정확히 1개, 나머지 GARBAGE_CELL, 두 줄 구멍 열 동일(같은 배치)
  const holes: number[] = [];
  for (const y of [T_TOTAL - 1, T_TOTAL - 2]) {
    const empties: number[] = [];
    for (let x = 0; x < T_COLS; x++) if (at(s, x, y) === 0) empties.push(x);
    assert.equal(empties.length, 1, `y=${y} 구멍 1개`);
    holes.push(empties[0]);
    for (let x = 0; x < T_COLS; x++) {
      if (x !== empties[0]) assert.equal(at(s, x, y), GARBAGE_CELL);
    }
  }
  assert.equal(holes[0], holes[1], "같은 배치는 같은 구멍");
});

test("쓰레기 상한 — 대기 캡 20, 락당 최대 8줄 유입", () => {
  let s = createTetris(6);
  s = queueGarbage(s, 50);
  assert.equal(s.pending, PENDING_CAP);
  s = hardDrop(s);
  assert.equal(s.last?.garbageIn, GARBAGE_PER_LOCK);
  assert.equal(s.pending, PENDING_CAP - GARBAGE_PER_LOCK);
});

test("홀드 — 락당 1회, 빈 홀드는 다음 조각 당김", () => {
  const s = createTetris(8);
  const cur = s.kind;
  const next = s.queue[0];
  const h1 = holdSwap(s);
  assert.equal(h1.hold, cur);
  assert.equal(h1.kind, next);
  assert.equal(h1.canHold, false);
  const h2 = holdSwap(h1); // 같은 락 사이클 재홀드 금지
  assert.equal(h2, h1);
  const afterLock = hardDrop(h1);
  assert.equal(afterLock.canHold, true); // 락 후 다시 가능
});

test("블록 아웃 — 스폰 위치 막히면 게임 오버", () => {
  const s = createTetris(9);
  // 스폰 영역(숨김 행 하단) 을 클리어 안 되게 막음(9열 비움)
  fillRow(s, T_HIDDEN - 2, [9]);
  fillRow(s, T_HIDDEN - 1, [9]);
  s.kind = 1; // 바닥의 O 를 그냥 락 → 스폰 시도 → 충돌
  s.x = 0;
  s.y = T_TOTAL - 2;
  const r = lockNow(s);
  assert.equal(r.over, true);
  assert.equal(r.kind, -1);
});

test("락 아웃 — 보이는 필드 위에서 전부 굳으면 게임 오버", () => {
  const s = createTetris(10);
  s.kind = 1; // O
  s.x = 3;
  s.y = 0; // 행 0,1 = 전부 숨김 구역
  const r = lockNow(s);
  assert.equal(r.over, true);
});

test("T-스핀 판정 — 3코너: front 2개 채움=full, 아니면 mini [회귀 lock]", () => {
  // rot=2(아래 포인팅), 중심 (5,5). 코너: (4,4)(6,4)(6,6)(4,6). front=[우하,좌하]
  const base = () => {
    const s = createTetris(11);
    s.kind = 2;
    s.rot = 2;
    s.x = 4;
    s.y = 4;
    s.lastRotated = true;
    s.lastKick = 0;
    return s;
  };
  // full: 좌하+우하(front) + 좌상 = 3코너
  let s = base();
  s.board[4 * T_COLS + 4] = 8; // 좌상
  s.board[6 * T_COLS + 4] = 8; // 좌하
  s.board[6 * T_COLS + 6] = 8; // 우하
  assert.equal(lockNow(s).last?.tspin, "full");
  // mini: front 하나만 (좌상+우상+좌하)
  s = base();
  s.board[4 * T_COLS + 4] = 8;
  s.board[4 * T_COLS + 6] = 8;
  s.board[6 * T_COLS + 4] = 8;
  assert.equal(lockNow(s).last?.tspin, "mini");
  // 마지막 조작이 회전이 아니면 none
  s = base();
  s.lastRotated = false;
  s.board[4 * T_COLS + 4] = 8;
  s.board[6 * T_COLS + 4] = 8;
  s.board[6 * T_COLS + 6] = 8;
  assert.equal(lockNow(s).last?.tspin, "none");
  // 2코너뿐이면 none
  s = base();
  s.board[4 * T_COLS + 4] = 8;
  s.board[6 * T_COLS + 6] = 8;
  assert.equal(lockNow(s).last?.tspin, "none");
});

test("T-스핀 더블 — 1200점 + 공격 4 [회귀 lock]", () => {
  const s = createTetris(12);
  addStray(s); // PC 방지
  // T rot=0 을 x=0,y=T_TOTAL-2 에 → 미노 (1,y)(0,y+1)(1,y+1)(2,y+1)
  const yTop = T_TOTAL - 2;
  fillRow(s, yTop, [1]); // 윗줄: T 머리 칸만 빔
  fillRow(s, T_TOTAL - 1, [0, 1, 2]); // 바닥: T 몸통 3칸만 빔
  s.kind = 2;
  s.rot = 0;
  s.x = 0;
  s.y = yTop;
  s.lastRotated = true;
  s.lastKick = 0;
  const scoreBefore = s.score;
  const r = lockNow(s);
  assert.equal(r.last?.cleared, 2);
  assert.equal(r.last?.tspin, "full");
  assert.equal(r.last?.attack, 4); // T-스핀 더블 = 4줄 공격
  assert.ok(r.score - scoreBefore >= 1200, `TSD 1200점(${r.score - scoreBefore})`);
});

test("퍼펙트 클리어 — +2000×레벨 + 공격 +6 [회귀 lock]", () => {
  const s = createTetris(13);
  fillRow(s, T_TOTAL - 1, [3, 4, 5, 6]); // 바닥줄, I 플랫 자리만 빔
  s.kind = 0;
  s.rot = 0; // 미노 y오프셋 1
  s.x = 3;
  s.y = T_TOTAL - 2;
  const r = lockNow(s);
  assert.equal(r.last?.cleared, 1);
  assert.equal(r.last?.pc, true);
  assert.equal(r.last?.attack, ATK_PC); // 싱글 0 + PC 6
  assert.ok(r.score >= SCORE_PC, "PC 보너스 반영");
  assert.ok(r.board.every((v) => v === 0), "보드 비움");
});

test("소프트드롭 +1점 · 중력 스텝 무점수 · 고스트/canFall", () => {
  const s = createTetris(14);
  const sd = softDrop(s);
  assert.equal(sd.score, s.score + 1);
  assert.equal(sd.y, s.y + 1);
  const gv = gravityStep(s);
  assert.equal(gv.score, s.score);
  assert.ok(canFall(s));
  assert.ok(ghostY(s) > s.y);
});

test("스냅샷 인코딩 — 200자 왕복 + 오염 입력 방어", () => {
  const s = createTetris(15);
  const enc = encodeBoard(s);
  assert.equal(enc.length, T_ROWS * T_COLS);
  const dec = decodeBoard(enc);
  assert.ok(dec);
  assert.equal(dec!.length, 200);
  assert.equal(decodeBoard("x".repeat(200)), null); // 숫자 아님
  assert.equal(decodeBoard(enc.slice(1)), null); // 길이 불일치
  assert.equal(decodeBoard(enc.replace(/./, "9")), null); // 범위 밖
});

test("중력 커브 — 레벨↑ 간격↓, 하한 70ms · 상수 계약", () => {
  assert.equal(gravityMs(1), 800);
  assert.ok(gravityMs(5) < gravityMs(2));
  assert.equal(gravityMs(99), 70);
  assert.equal(ULTRA_SECONDS, 120); // 점수 대결 = 2분 울트라
  assert.ok(LOCK_DELAY_MS >= 300 && LOCK_DELAY_MS <= 1000);
});

test("클리어 라벨 — 배너 문구", () => {
  const e = (o: object) =>
    ({ cleared: 0, attack: 0, tspin: "none", b2b: false, combo: -1, pc: false, rows: [], garbageIn: 0, ...o }) as never;
  assert.equal(clearLabel(e({ cleared: 4 })), "테트리스! 🎉");
  assert.equal(clearLabel(e({ cleared: 4, b2b: true })), "B2B 테트리스!! 🔥");
  assert.equal(clearLabel(e({ pc: true, cleared: 1 })), "퍼펙트 클리어! ✨");
  assert.equal(clearLabel(e({ cleared: 1 })), null); // 싱글은 배너 없음
});
