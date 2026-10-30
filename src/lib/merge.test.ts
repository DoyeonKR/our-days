// 정원 합치기 엔진 lock. [사용자 2026-10-31 "2048 … 정확히 룰을 찾아보고 만들어"]
// 장르 표준 동작을 정확히: 끝까지 몰기 · 한 번 밀 때 한 타일은 한 번만 합치기 · 미는 쪽 끝이 먼저 ·
// 움직였을 때만 새 타일 · 막히면 끝 · 점수 = 만든 타일 값. + 우리 섬 규칙(황금 거름 · 하트 상한 · 되돌리기 없음).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHAIN, DAILY_COIN_CAP, GOAL_LV, MAX_LV, SIZE,
  canMove, mergeOf, newGame, play, settleGame, slide, spawn, tileValue,
  type Board, type Dir, type Game, type Tile,
} from "./merge.ts";
import type { IslandState } from "./island.ts";

let nid = 1000;
/** 한 줄(왼쪽부터)을 판 첫 줄로 — 0 은 빈 칸, -1 은 황금 거름 */
const row = (cells: number[]): Board => {
  const b: Board = Array(SIZE * SIZE).fill(null);
  cells.forEach((v, i) => { if (v) b[i] = v < 0 ? { id: nid++, lv: 0, fert: true } : { id: nid++, lv: v }; });
  return b;
};
const lvs = (b: Board, from = 0) => b.slice(from, from + SIZE).map((t) => (t ? (t.fert ? -1 : t.lv) : 0));

test("끝까지 몰고, 같은 것 둘이 하나로", () => {
  assert.deepEqual(lvs(slide(row([0, 0, 0, 1]), "left").board), [1, 0, 0, 0]);
  assert.deepEqual(lvs(slide(row([1, 0, 1, 0]), "left").board), [2, 0, 0, 0]);
  assert.deepEqual(lvs(slide(row([1, 2, 0, 0]), "right").board), [0, 0, 1, 2]);
});

test("한 번 밀 때 한 타일은 한 번만 합친다", () => {
  assert.deepEqual(lvs(slide(row([1, 1, 1, 1]), "left").board), [2, 2, 0, 0]);
  assert.deepEqual(lvs(slide(row([2, 1, 1, 0]), "left").board), [2, 2, 0, 0], "새로 생긴 2 가 옆의 2 와 또 합쳐지면 안 된다");
  assert.deepEqual(lvs(slide(row([3, 3, 2, 2]), "left").board), [4, 3, 0, 0]);
});

test("셋이 줄지으면 미는 쪽 끝의 둘이 먼저", () => {
  assert.deepEqual(lvs(slide(row([1, 1, 1, 0]), "left").board), [2, 1, 0, 0]);
  assert.deepEqual(lvs(slide(row([1, 1, 1, 0]), "right").board), [0, 0, 1, 2]);
});

test("세로 방향도 같은 규칙", () => {
  const b: Board = Array(16).fill(null);
  b[0] = { id: 1, lv: 1 }; b[4] = { id: 2, lv: 1 }; b[8] = { id: 3, lv: 1 };
  const up = slide(b, "up").board;
  assert.equal(up[0]?.lv, 2); assert.equal(up[4]?.lv, 1); assert.equal(up[8], null);
  const down = slide(b, "down").board;
  assert.equal(down[12]?.lv, 2); assert.equal(down[8]?.lv, 1); assert.equal(down[0], null);
});

test("점수 = 합쳐서 만든 타일 값의 합", () => {
  assert.equal(slide(row([1, 1, 2, 2]), "left").gained, tileValue(2) + tileValue(3));
  assert.equal(slide(row([1, 2, 3, 4]), "left").gained, 0);
});

test("안 움직이는 방향은 수가 아니다 — 새 타일도 점수도 없다", () => {
  const g: Game = { ...newGame(7), board: row([1, 2, 3, 4]) };
  const t = play(g, "left");
  assert.equal(t.result, null);
  assert.equal(t.game, g);
});

test("움직이면 빈 칸에 새 타일 하나(1단계 아니면 2단계)", () => {
  const g: Game = { ...newGame(7), board: row([0, 0, 0, 1]) };
  const t = play(g, "left");
  assert.ok(t.result);
  const tiles = t.game.board.filter(Boolean) as Tile[];
  assert.equal(tiles.length, 2);
  assert.ok(t.born !== null && tiles.some((x) => x.id === t.born && (x.lv === 1 || x.lv === 2)));
  assert.equal(t.game.moves, 1);
});

test("새 타일 비율 — 1단계 약 90%", () => {
  let one = 0, two = 0, rng = 12345;
  for (let i = 0; i < 4000; i++) {
    const s = spawn({ board: Array(16).fill(null), rng, nextId: 1, moves: 0 });
    rng = s.rng;
    const t = s.board.find(Boolean)!;
    if (t.lv === 1) one++; else two++;
  }
  const p = one / (one + two);
  assert.ok(p > 0.87 && p < 0.93, `1단계 비율 ${p}`);
});

test("새 판은 타일 두 개로 시작하고, 같은 시드면 같은 판", () => {
  const a = newGame(42), b = newGame(42);
  assert.equal(a.board.filter(Boolean).length, 2);
  assert.deepEqual(a.board, b.board);
});

test("막히면 끝 — 빈 칸도 합칠 이웃도 없을 때만", () => {
  const full = (vals: number[]): Board => vals.map((v, i) => ({ id: i + 1, lv: v }));
  assert.equal(canMove(full([1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1])), false);
  assert.equal(canMove(full([1, 1, 2, 3, 2, 3, 4, 5, 3, 4, 5, 6, 4, 5, 6, 7])), true, "가로로 같은 이웃");
  assert.equal(canMove(full([1, 2, 3, 4, 1, 3, 4, 5, 2, 4, 5, 6, 3, 5, 6, 7])), true, "세로로 같은 이웃");
});

test("황금 거름 — 어떤 작물이든 한 단계 키우고, 거름끼리는 안 합쳐진다", () => {
  assert.deepEqual(lvs(slide(row([-1, 5, 0, 0]), "left").board), [6, 0, 0, 0]);
  assert.deepEqual(lvs(slide(row([3, -1, 0, 0]), "left").board), [4, 0, 0, 0]);
  assert.deepEqual(lvs(slide(row([-1, -1, 0, 0]), "left").board), [-1, -1, 0, 0]);
  const b: Board = Array(16).fill(null).map((_, i) => ({ id: i + 1, lv: 0, fert: true as const }));
  assert.equal(canMove(b), false, "거름만 꽉 차면 끝");
});

test("최고 단계는 더 합쳐지지 않는다", () => {
  assert.deepEqual(lvs(slide(row([MAX_LV, MAX_LV, 0, 0]), "left").board), [MAX_LV, MAX_LV, 0, 0]);
});

test("되돌리기는 없다 — 사용자 판단으로 뺐다(2026-10-31)", () => {
  const src = readFileSync(join(import.meta.dirname, "merge.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/export function undo|history|UNDO_PER_GAME/.test(src), "엔진에 되돌리기가 돌아왔다");
  const ui = readFileSync(join(import.meta.dirname, "..", "components", "MergeGame.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert.ok(!ui.includes("되돌리기"), "화면에 되돌리기 버튼이 돌아왔다");
  const g0: Game = { ...newGame(9), board: row([1, 1, 0, 0]) };
  assert.deepEqual(play(g0, "left").game.board, play(g0, "left").game.board, "같은 판 같은 수 = 같은 결과(이어하기)");
});

test("목표(화이트 트러플)에 처음 닿으면 한 번만 알린다", () => {
  const g: Game = { ...newGame(3), board: row([GOAL_LV - 1, GOAL_LV - 1, 0, 0]) };
  const t = play(g, "left");
  assert.equal(t.goalNow, true);
  assert.equal(CHAIN[GOAL_LV - 1].key, "white_truffle");
  // 그림 표와 단계 표가 맞아야 한다(빠지면 상추로 그려진다) · 단계가 오를수록 희귀도는 내려가지 않는다
  const art = readFileSync(join(import.meta.dirname, "..", "components", "MergeArt.tsx"), "utf8");
  for (const c of CHAIN) assert.match(art, new RegExp(`^  ${c.key}: \\(p\\) =>`, "m"), `${c.key} 그림이 없다`);
  const order = ["흔함", "보통", "귀함", "희귀", "진귀", "전설", "신화"];
  CHAIN.forEach((c, i) => i && assert.ok(order.indexOf(c.rarity) >= order.indexOf(CHAIN[i - 1].rarity), `${c.name} 희귀도가 앞 단계보다 낮다`));
  assert.equal(new Set(CHAIN.map((c) => c.name)).size, CHAIN.length);
  assert.equal(CHAIN.length, MAX_LV);
});

test("섬 보상 — 점수만큼 하트, 하루 상한, 사람별 최고 기록", () => {
  const s = { coins: 100 } as IslandState;
  const a = settleGame(s, "u1", 5000, 7, "2026-10-31");
  assert.equal(a.coins, 100);
  assert.equal(a.state.coins, 200);
  assert.equal(mergeOf(a.state).best.u1, 5000);
  const b = settleGame(a.state, "u1", 100000, 9, "2026-10-31");
  assert.equal(b.coins, DAILY_COIN_CAP - 100, "하루 상한");
  const c = settleGame(b.state, "u2", 300, 3, "2026-10-31");
  assert.equal(c.coins, 0, "상한은 섬(커플) 단위");
  assert.equal(mergeOf(c.state).best.u1, 100000);
  assert.equal(mergeOf(c.state).best.u2, 300);
  const d = settleGame(c.state, "u2", 300, 3, "2026-11-01");
  assert.equal(d.coins, 6, "날이 바뀌면 다시");
  assert.equal(settleGame(d.state, "u1", 10, 1, "2026-11-01").newBest, false);
});

test("엔진은 섬 엔진을 값으로 불러오지 않는다(게임 탭 첫 로드)", () => {
  const src = readFileSync(join(import.meta.dirname, "merge.ts"), "utf8");
  assert.ok(!/^import \{[^}]*\} from "\.\/island\.ts"/m.test(src));
  const dirs: Dir[] = ["left", "right", "up", "down"];
  assert.equal(dirs.length, 4);
});

test("전체 순위 — 판이 끝나면 판마다 한 줄 등록(중복 허용) · 이번 판 순위 · 1~10등 [소스 스캔]", () => {
  // [사용자 2026-11-01 "게임 끝나면 … 랭킹판이 나와서 자기 랭킹이 보이는 시스템이고 중복으로도 입력되는 구조"]
  const root = join(import.meta.dirname, "..", "..");
  const schema = readFileSync(join(root, "supabase", "schema.sql"), "utf8").replace(/\r\n/g, "\n");
  for (const m of ["20261031000000_merge_leaderboard.sql", "20261101000000_merge_runs.sql"]) {
    const sql = readFileSync(join(root, "supabase", "migrations", m), "utf8").replace(/\r\n/g, "\n");
    assert.ok(schema.includes(sql.trim()), `${m}: schema.sql 끝의 복사본이 migration 과 달라졌어요`);
  }
  const runs = readFileSync(join(root, "supabase", "migrations", "20261101000000_merge_runs.sql"), "utf8").replace(/\r\n/g, "\n");
  assert.match(runs, /insert into public\.merge_runs \(user_id, nickname, score, top_lv\)\n  values/, "판마다 새 줄(upsert 로 덮으면 중복 입력이 안 된다)");
  assert.doesNotMatch(runs, /on conflict/, "판 표에 on conflict 가 생기면 같은 사람의 여러 판이 한 줄로 합쳐진다");
  assert.match(runs, /where k\.rank <= 10 or k\.id = p_run/, "1~10등 + 10등 밖이면 이번 판");
  assert.match(runs, /using \(user_id = \(select auth\.uid\(\)\)\)/, "표는 본인 행만 직접 읽는다(남의 user_id 비공개)");
  const ui = readFileSync(join(import.meta.dirname, "..", "components", "MergeGame.tsx"), "utf8");
  assert.match(ui, /const pendingRank = done && !done\.ranked \? done\.game : null/, "끝난 판은 순위에 저절로 올라가야 한다(실패하면 다음에 다시)");
  assert.match(ui, /finishGame\(t\.game\)/, "판이 끝나면 결과 연출 · 순위판으로");
  assert.match(ui, /game: newGame\(freshSeed\(\)\) \}/, "판이 끝나면 저절로 새 판");
  assert.match(ui, /phase: "board"/, "판이 사라진 뒤 순위판이 뜬다");
  assert.doesNotMatch(ui, /merge-over/, "판 위에 덮던 옛 끝 화면이 돌아왔다");
});

test("그림 파일이 있다고 적힌 단계는 파일이 실제로 있다", () => {
  const root = join(import.meta.dirname, "..", "..");
  const src = readFileSync(join(import.meta.dirname, "mergeimages.ts"), "utf8");
  const listed = [...(src.match(/new Set<string>\(\[([^\]]*)\]\)/)?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  for (const k of listed) {
    assert.ok(CHAIN.some((c) => c.key === k), `${k}: CHAIN 에 없는 key`);
    assert.ok(existsSync(join(root, "public", "merge", `${k}.webp`)), `public/merge/${k}.webp 가 없다`);
  }
});
