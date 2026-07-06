import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD,
  BG_TILES,
  BG_SALARY,
  BG_START_CASH,
  BG_TAX,
  BG_ISLAND_FEE,
  BG_ISLAND_IDX,
  BG_MAX_LAPS,
  createBoardState,
  applyRoll,
  buyTile,
  skipBuy,
  payToll,
  payTax,
  collectFund,
  drawChance,
  chooseSpace,
  payIsland,
  buildUp,
  endTurn,
  resign,
  tollOf,
  ownsGroup,
  netWorth,
  upgradableTiles,
  type BGState,
} from "./boardgame";

const fresh = () => createBoardState(42, ["나", "상대"]);

test("board integrity — 28칸, 모서리, 그룹 수", () => {
  assert.equal(BOARD.length, 28);
  assert.equal(BG_TILES, 28);
  assert.equal(BOARD[0].type, "start");
  assert.equal(BOARD[7].type, "island");
  assert.equal(BOARD[14].type, "space");
  assert.equal(BOARD[21].type, "fund");
  const cities = BOARD.filter((t) => t.type === "city");
  assert.equal(cities.length, 19);
  assert.equal(BOARD.filter((t) => t.type === "chance").length, 4);
  assert.equal(BOARD.filter((t) => t.type === "tax").length, 1);
  // 모든 도시엔 price/tolls/buildCost
  for (const c of cities) {
    assert.ok((c.price ?? 0) > 0 && c.tolls && c.tolls.length === 4 && (c.buildCost ?? 0) > 0);
  }
});

test("createBoardState 초기값", () => {
  const s = fresh();
  assert.equal(s.players.length, 2);
  assert.equal(s.players[0].cash, BG_START_CASH);
  assert.equal(s.players[1].cash, BG_START_CASH);
  assert.equal(s.turn, 0);
  assert.equal(s.phase, "roll");
  assert.equal(s.cells.length, 28);
  assert.ok(s.cells.every((c) => c.owner === null && c.level === 0));
});

test("굴림 → 도시 착지 → 매입 pending → 매입", () => {
  let s = fresh();
  s = applyRoll(s, 1, 2); // pos 3 영화관(A, 100)
  assert.equal(s.players[0].pos, 3);
  assert.equal(s.phase, "act");
  assert.deepEqual(s.pending, { kind: "buy", tile: 3 });
  s = buyTile(s);
  assert.equal(s.players[0].cash, BG_START_CASH - 100);
  assert.equal(s.cells[3].owner, 0);
  assert.equal(s.pending, null);
});

test("skipBuy — 매입 포기", () => {
  let s = fresh();
  s = applyRoll(s, 1, 2);
  s = skipBuy(s);
  assert.equal(s.pending, null);
  assert.equal(s.cells[3].owner, null);
  assert.equal(s.players[0].cash, BG_START_CASH);
});

test("통행료 지불 — 상대 도시", () => {
  let s = fresh();
  s.cells[3] = { owner: 1, level: 0 }; // 상대가 영화관 소유
  s = applyRoll(s, 1, 2); // 나 pos3
  assert.equal(s.pending?.kind, "toll");
  const toll = BOARD[3].tolls![0]; // 10
  s = payToll(s);
  assert.equal(s.players[0].cash, BG_START_CASH - toll);
  assert.equal(s.players[1].cash, BG_START_CASH + toll);
  assert.equal(s.pending, null);
});

test("그룹 독점 → 땅 통행료 ×2", () => {
  const s = fresh();
  s.cells[1] = { owner: 1, level: 0 }; // 카페(A)
  s.cells[3] = { owner: 1, level: 0 }; // 영화관(A) — A 독점
  assert.ok(ownsGroup(s.cells, 1, "A"));
  assert.equal(tollOf(s.cells, 3), BOARD[3].tolls![0] * 2);
  // 독점 아니면 배수 없음
  s.cells[1] = { owner: null, level: 0 };
  assert.ok(!ownsGroup(s.cells, 1, "A"));
  assert.equal(tollOf(s.cells, 3), BOARD[3].tolls![0]);
});

test("더블 → 같은 사람 한 번 더", () => {
  let s = fresh();
  s = applyRoll(s, 2, 2); // pos4 노래방, 더블
  assert.equal(s.rolledDoubles, true);
  s = skipBuy(s);
  s = endTurn(s);
  assert.equal(s.turn, 0); // 턴 유지
  assert.equal(s.phase, "roll");
});

test("일반 굴림 → 턴 교대", () => {
  let s = fresh();
  s = applyRoll(s, 1, 2); // 비더블
  s = skipBuy(s);
  s = endTurn(s);
  assert.equal(s.turn, 1);
  assert.equal(s.phase, "roll");
});

test("더블 3연속 → 무인도", () => {
  let s = fresh();
  s.doubles = 2;
  s = applyRoll(s, 3, 3); // 3연속 더블
  assert.equal(s.players[0].pos, BG_ISLAND_IDX);
  assert.ok(s.players[0].jail > 0);
  assert.equal(s.rolledDoubles, false);
  s = endTurn(s);
  assert.equal(s.turn, 1); // 감옥이라 추가턴 없음
});

test("무인도 — 더블로 탈출, 아니면 대기", () => {
  let s = fresh();
  s.players[0].pos = BG_ISLAND_IDX;
  s.players[0].jail = 2;
  // 비더블: 대기
  s = applyRoll(s, 1, 2);
  assert.equal(s.players[0].pos, BG_ISLAND_IDX);
  assert.equal(s.players[0].jail, 1);
  s = endTurn(s);
  assert.equal(s.turn, 1);
  // 내 턴 다시: 더블 탈출
  s.turn = 0;
  s.phase = "roll";
  s = applyRoll(s, 4, 4); // 탈출 후 8칸
  assert.equal(s.players[0].jail, 0);
  assert.equal(s.players[0].pos, (BG_ISLAND_IDX + 8) % 28);
});

test("무인도 — 벌금 내고 탈출", () => {
  let s = fresh();
  s.players[0].pos = BG_ISLAND_IDX;
  s.players[0].jail = 2;
  s = payIsland(s);
  assert.equal(s.players[0].jail, 0);
  assert.equal(s.players[0].cash, BG_START_CASH - BG_ISLAND_FEE);
  assert.equal(s.fund, BG_ISLAND_FEE);
  assert.equal(s.phase, "roll"); // 이제 정상 굴림 가능
});

test("세금칸 → 기금 적립", () => {
  let s = fresh();
  s.players[0].pos = 5;
  s = applyRoll(s, 4, 3); // pos12 세금
  assert.deepEqual(s.pending, { kind: "tax", amount: BG_TAX });
  s = payTax(s);
  assert.equal(s.players[0].cash, BG_START_CASH - BG_TAX);
  assert.equal(s.fund, BG_TAX);
});

test("사회복지기금 수령", () => {
  let s = fresh();
  s.fund = 250;
  s.players[0].pos = 14;
  s = applyRoll(s, 3, 4); // pos21 fund
  assert.deepEqual(s.pending, { kind: "fund", amount: 250 });
  s = collectFund(s);
  assert.equal(s.players[0].cash, BG_START_CASH + 250);
  assert.equal(s.fund, 0);
});

test("황금열쇠 — 보너스/증여/수령", () => {
  const land = (): BGState => {
    let s = fresh();
    s.players[0].pos = 6;
    s = applyRoll(s, 2, 1); // pos9 chance
    assert.equal(s.pending?.kind, "chance");
    return s;
  };
  // card0: +200
  let s = drawChance(land(), 0);
  assert.equal(s.players[0].cash, BG_START_CASH + 200);
  // card5: 상대에게 100
  s = drawChance(land(), 5);
  assert.equal(s.players[0].cash, BG_START_CASH - 100);
  assert.equal(s.players[1].cash, BG_START_CASH + 100);
  // card6: 상대에게서 100
  s = drawChance(land(), 6);
  assert.equal(s.players[0].cash, BG_START_CASH + 100);
  assert.equal(s.players[1].cash, BG_START_CASH - 100);
});

test("황금열쇠 — 출발로 이동(월급)", () => {
  let s = fresh();
  s.players[0].pos = 6;
  s = applyRoll(s, 2, 1); // pos9 chance
  s = drawChance(s, 2); // 출발로
  assert.equal(s.players[0].pos, 0);
  assert.equal(s.players[0].cash, BG_START_CASH + BG_SALARY);
});

test("황금열쇠 — 무인도로", () => {
  let s = fresh();
  s.players[0].pos = 6;
  s = applyRoll(s, 2, 1);
  s = drawChance(s, 3);
  assert.equal(s.players[0].pos, BG_ISLAND_IDX);
  assert.ok(s.players[0].jail > 0);
});

test("황금열쇠 — 우주여행 카드 → 목적지 선택", () => {
  let s = fresh();
  s.players[0].pos = 6;
  s = applyRoll(s, 2, 1);
  s = drawChance(s, 4); // 우주여행 → space pending
  assert.equal(s.pending?.kind, "space");
  s = chooseSpace(s, 23); // 파리
  assert.equal(s.players[0].pos, 23);
  assert.equal(s.pending?.kind, "buy"); // 파리 매입 pending
});

test("건설 — 레벨/비용/자산", () => {
  let s = fresh();
  s.cells[3] = { owner: 0, level: 0 }; // 영화관(A) buildCost 60
  s.phase = "act";
  s.pending = null;
  s.turn = 0;
  assert.deepEqual(upgradableTiles(s, 0), [3]);
  s = buildUp(s, 3);
  assert.equal(s.cells[3].level, 1);
  assert.equal(s.players[0].cash, BG_START_CASH - 60);
  // 자산 = 현금 + 가격 + 레벨×건설비
  assert.equal(netWorth(s, 0), BG_START_CASH - 60 + 100 + 1 * 60);
});

test("건설 상한/남의 땅 방어", () => {
  let s = fresh();
  s.cells[3] = { owner: 1, level: 0 }; // 상대 소유
  s.phase = "act";
  const before = s;
  s = buildUp(s, 3); // 내 땅 아님 → 무변화
  assert.equal(s, before);
});

test("파산 → 상대 승리", () => {
  let s = fresh();
  s.players[0].cash = 5;
  s.cells[3] = { owner: 1, level: 0 };
  s = applyRoll(s, 1, 2); // 통행료 10 발생
  s = payToll(s);
  assert.equal(s.players[0].bankrupt, true);
  assert.equal(s.winner, 1);
  assert.equal(s.over, "bankrupt");
  assert.equal(s.phase, "over");
  assert.equal(s.players[1].cash, BG_START_CASH + 5); // 남은 현금 이전
});

test("항복 → 상대 승리", () => {
  const s = resign(fresh(), 0);
  assert.equal(s.winner, 1);
  assert.equal(s.phase, "over");
});

test("바퀴 종료 → 자산 비교 승리", () => {
  let s = fresh();
  s.players[0].laps = BG_MAX_LAPS;
  s.players[1].laps = BG_MAX_LAPS;
  s.players[0].cash = 500;
  s.players[1].cash = 1000;
  s.phase = "act";
  s.pending = null;
  s = endTurn(s);
  assert.equal(s.over, "laps");
  assert.equal(s.winner, 1);
  assert.equal(s.phase, "over");
});

test("출발 통과 시 월급(advance wrap)", () => {
  let s = fresh();
  s.players[0].pos = 27;
  s = applyRoll(s, 1, 1); // (27+2)%28 = 1, 출발 통과
  assert.equal(s.players[0].pos, 1);
  assert.equal(s.players[0].cash, BG_START_CASH + BG_SALARY);
  assert.equal(s.players[0].laps, 1);
});

test("불변성 — 원본 상태 미변경", () => {
  const s0 = fresh();
  const snap = JSON.stringify(s0);
  applyRoll(s0, 1, 2);
  buyTile(applyRoll(s0, 1, 2));
  endTurn(s0);
  assert.equal(JSON.stringify(s0), snap);
});

test("pending 미해결이면 endTurn 불가", () => {
  let s = fresh();
  s = applyRoll(s, 1, 2); // buy pending
  const blocked = endTurn(s);
  assert.equal(blocked.phase, "act"); // 종료 안 됨
  assert.ok(blocked.pending);
});
