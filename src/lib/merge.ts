/* 정원 합치기 — 밀어서 합치는 퍼즐(순수 엔진). [사용자 2026-10-31 "2048 … 완벽하게 +@ 로"]
 *
 * 특정 게임을 베끼지 않고 **장르의 표준 동작**만 정확히 지킨다(4×4 판):
 *   · 한 방향으로 밀면 모든 타일이 그쪽 끝까지 몰린다.
 *   · 같은 타일 두 개가 만나면 한 단계 위 타일 하나가 된다 — **한 번 밀 때 한 타일은 한 번만** 합쳐진다
 *     ([1,1,1,1] → [2,2], [2,2] 가 다시 [3] 이 되지 않는다).
 *   · 셋이 줄지으면 **미는 쪽 끝**의 둘이 먼저 합쳐진다([1,1,1,_] 왼쪽 → [2,1]).
 *   · 실제로 움직였을 때만 빈 칸 하나에 새 타일이 생긴다(1단계 90% · 2단계 10%).
 *   · 빈 칸도 없고 이웃끼리 합칠 것도 없으면 끝.
 *   · 점수 = 합쳐서 만든 타일의 값(2^단계)의 합.
 *
 * 우리 섬 +@ (이 게임만의 것):
 *   · 숫자 대신 **섬 작물**이 자란다 — 상추에서 시작해 11단계 **무등산수박**(전설)이 목표, 그 위로 천도복숭아·불로초.
 *   · **황금 거름** 타일 — 가끔 생긴다. 어떤 작물과 부딪혀도 그 작물을 한 단계 키우고 사라진다(거름끼리는 안 합쳐진다).
 *   · 되돌리기는 없다 — 사용자 판단으로 뺐다(2026-10-31 "되돌리기 같은기능은 없애버려"). 한 수 한 수가 무르기 없이 간다.
 *   · 끝난 판의 점수는 **섬 하트**가 된다(하루 상한) · 커플 각자의 최고 기록이 섬에 남는다.
 *
 * ⚠ 순수 함수만 둔다 — 난수는 상태 안의 시드로 굴린다(이어하기가 같은 결과를 내게).
 * ⚠ island.ts 를 **값으로** import 하지 마라(타입만) — 게임 탭 첫 로드에 섬 엔진 전체가 실린다(firstload.test 와 같은 이유).
 */

import type { IslandState } from "./island.ts";

export const SIZE = 4;
/** 목표 단계(장르의 '2048' 자리) — 무등산수박. 넘어서 계속할 수 있다. */
export const GOAL_LV = 11;
export const MAX_LV = 13;
/** 황금 거름이 나오기 시작하는 이동 수 · 확률 */
export const FERT_FROM_MOVE = 20;
export const FERT_CHANCE = 0.04;
/** 섬 하트 — 점수 SCORE_PER_COIN 마다 1, 하루 DAILY_COIN_CAP 까지(KST) */
export const SCORE_PER_COIN = 50;
export const DAILY_COIN_CAP = 400;

export type Dir = "left" | "right" | "up" | "down";
export type Tile = { id: number; lv: number; fert?: true };
export type Board = (Tile | null)[];

/** 단계별 작물 — 화면은 이 키로 CropIcon 을 그린다(다 자란 모습). 이웃 단계끼리 색이 겹치지 않게 골랐다
 *  (딸기 다음 토마토는 둘 다 빨간 열매라 판에서 구분이 안 됐다). 다 자라면 나무 · 덤불로
 *  그려지는 작물(사과 · 밤 · 블루베리 · 귤 …)은 열매가 안 보여 뺐다. */
export const CHAIN: readonly { key: string; name: string }[] = [
  { key: "lettuce", name: "상추" },
  { key: "carrot", name: "당근" },
  { key: "strawberry", name: "딸기" },
  { key: "corn", name: "옥수수" },
  { key: "eggplant", name: "가지" },
  { key: "radish", name: "무" },
  { key: "mushroom", name: "버섯" },
  { key: "sweetpotato", name: "고구마" },
  { key: "pumpkin", name: "호박" },
  { key: "grape", name: "포도" },
  { key: "watermelon", name: "무등산수박" },
  { key: "heavenpeach", name: "천도복숭아" },
  { key: "yeongji", name: "불로초" },
];
export const chainOf = (lv: number) => CHAIN[Math.max(1, Math.min(MAX_LV, lv)) - 1];
export const tileValue = (lv: number) => 2 ** lv;

export type Game = {
  board: Board;
  score: number;
  moves: number;
  rng: number;
  nextId: number;
  over: boolean;
  /** 목표 단계에 처음 닿았을 때 한 번 축하하고 이어서 할 수 있게 */
  reachedGoal: boolean;
  top: number;
};

/** mulberry32 — 상태 하나(32비트)로 굴리는 결정적 난수. [0,1) 과 다음 상태를 돌려준다. */
export function rand(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

const idx = (r: number, c: number) => r * SIZE + c;

/** 미는 방향의 줄들 — 각 줄은 **미는 쪽 끝부터** 칸 번호를 늘어놓는다. */
export function lines(dir: Dir): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < SIZE; k++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === "left") line.push(idx(k, j));
      else if (dir === "right") line.push(idx(k, SIZE - 1 - j));
      else if (dir === "up") line.push(idx(j, k));
      else line.push(idx(SIZE - 1 - j, k));
    }
    out.push(line);
  }
  return out;
}

/** 두 타일이 합쳐지면 남는 단계(못 합치면 0). 순서 무관. */
export function mergeLv(a: Tile, b: Tile): number {
  if (a.fert && b.fert) return 0;
  if (a.fert || b.fert) {
    const crop = a.fert ? b : a;
    return crop.lv < MAX_LV ? crop.lv + 1 : 0;
  }
  return a.lv === b.lv && a.lv < MAX_LV ? a.lv + 1 : 0;
}

export type Slide = { id: number; to: number };
export type MoveResult = {
  board: Board;
  moved: boolean;
  gained: number;
  /** 화면 연출용: 모든 타일이 간 칸(합쳐져 사라지는 타일 포함) · 합쳐진 결과 타일 id */
  slides: Slide[];
  merged: number[];
  vanished: Tile[];
};

/** 밀기 — 새 타일은 안 만든다(spawn 은 따로). */
export function slide(board: Board, dir: Dir): MoveResult {
  const next: Board = Array(SIZE * SIZE).fill(null);
  const slides: Slide[] = [];
  const merged: number[] = [];
  const vanished: Tile[] = [];
  let gained = 0;
  let moved = false;
  for (const line of lines(dir)) {
    const tiles = line.map((i) => board[i]).filter((t): t is Tile => !!t);
    let w = 0;
    for (let i = 0; i < tiles.length; i++) {
      const a = tiles[i];
      const b = tiles[i + 1];
      const lv = b ? mergeLv(a, b) : 0;
      const target = line[w];
      if (lv) {
        // 남는 쪽 = 작물(거름과 만나면 작물이 남는다), 둘 다 작물이면 미는 쪽 끝의 것
        const keep = a.fert ? b : a;
        const gone = keep === a ? b : a;
        next[target] = { id: keep.id, lv };
        slides.push({ id: keep.id, to: target }, { id: gone.id, to: target });
        merged.push(keep.id);
        vanished.push(gone);
        gained += tileValue(lv);
        moved = true;
        i++;
      } else {
        next[target] = a;
        slides.push({ id: a.id, to: target });
        if (board[target]?.id !== a.id) moved = true;
      }
      w++;
    }
  }
  return { board: next, moved, gained, slides, merged, vanished };
}

/** 빈 칸 하나에 새 타일 — 칸·종류 모두 시드로. 빈 칸이 없으면 그대로. */
export function spawn(g: Pick<Game, "board" | "rng" | "nextId" | "moves">): { board: Board; rng: number; nextId: number; born: number | null } {
  const empty = g.board.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return { board: g.board, rng: g.rng, nextId: g.nextId, born: null };
  let [r, rng] = rand(g.rng);
  const at = empty[Math.floor(r * empty.length)];
  [r, rng] = rand(rng);
  const fert = g.moves >= FERT_FROM_MOVE && r < FERT_CHANCE;
  [r, rng] = rand(rng);
  const tile: Tile = fert ? { id: g.nextId, lv: 0, fert: true } : { id: g.nextId, lv: r < 0.9 ? 1 : 2 };
  const board = g.board.slice();
  board[at] = tile;
  return { board, rng, nextId: g.nextId + 1, born: tile.id };
}

export function canMove(board: Board): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const t = board[idx(r, c)];
      if (!t) return true;
      const right = c + 1 < SIZE ? board[idx(r, c + 1)] : null;
      const down = r + 1 < SIZE ? board[idx(r + 1, c)] : null;
      if ((right && mergeLv(t, right)) || (down && mergeLv(t, down))) return true;
    }
  return false;
}

const topOf = (board: Board) => board.reduce((m, t) => (t && !t.fert ? Math.max(m, t.lv) : m), 0);

/** 새 판 — 타일 두 개로 시작한다(장르 표준). */
export function newGame(seed: number): Game {
  let g: Game = { board: Array(SIZE * SIZE).fill(null), score: 0, moves: 0, rng: seed >>> 0, nextId: 1, over: false, reachedGoal: false, top: 0 };
  for (let k = 0; k < 2; k++) {
    const s = spawn(g);
    g = { ...g, board: s.board, rng: s.rng, nextId: s.nextId };
  }
  return { ...g, top: topOf(g.board) };
}

export type Turn = { game: Game; result: MoveResult | null; born: number | null; goalNow: boolean };

/** 한 수 — 움직였을 때만 새 타일·점수·기록. 못 움직이는 방향이면 그대로(result null). */
export function play(g: Game, dir: Dir): Turn {
  if (g.over) return { game: g, result: null, born: null, goalNow: false };
  const res = slide(g.board, dir);
  if (!res.moved) return { game: g, result: null, born: null, goalNow: false };
  const moves = g.moves + 1;
  const s = spawn({ board: res.board, rng: g.rng, nextId: g.nextId, moves });
  const top = Math.max(g.top, topOf(s.board));
  const goalNow = !g.reachedGoal && top >= GOAL_LV;
  const game: Game = {
    ...g,
    board: s.board,
    rng: s.rng,
    nextId: s.nextId,
    score: g.score + res.gained,
    moves,
    top,
    reachedGoal: g.reachedGoal || goalNow,
    over: !canMove(s.board),
  };
  return { game, result: res, born: s.born, goalNow };
}

/** 저장분 검증 — 깨진 localStorage 값으로 화면이 죽지 않게. */
export function isGame(v: unknown): v is Game {
  if (!v || typeof v !== "object") return false;
  const g = v as Game;
  return Array.isArray(g.board) && g.board.length === SIZE * SIZE && typeof g.score === "number" && typeof g.rng === "number" && typeof g.nextId === "number";
}

/* ── 섬 기록 · 보상 ─────────────────────────────────────────── */

export type MergeRecord = {
  /** 사람마다 최고 점수 · 가장 높이 키운 단계(uid → 값). 솔로는 "me". */
  best: Record<string, number>;
  top: Record<string, number>;
  /** 하트 하루 상한 — KST 날짜와 그날 받은 하트 */
  day: string;
  dayCoins: number;
};

export function mergeOf(s: IslandState): MergeRecord {
  const m: Partial<MergeRecord> | undefined = s.merge;
  return { best: { ...(m?.best ?? {}) }, top: { ...(m?.top ?? {}) }, day: m?.day ?? "", dayCoins: m?.dayCoins ?? 0 };
}

/** 끝난 판 하나를 섬에 남긴다 — 하트(하루 상한) · 내 최고 기록. 순수. */
export function settleGame(s: IslandState, who: string, score: number, top: number, today: string): { state: IslandState; coins: number; newBest: boolean } {
  const m = mergeOf(s);
  const used = m.day === today ? m.dayCoins : 0;
  const coins = Math.max(0, Math.min(Math.floor(score / SCORE_PER_COIN), DAILY_COIN_CAP - used));
  const newBest = score > (m.best[who] ?? 0);
  const rec: MergeRecord = {
    best: { ...m.best, [who]: Math.max(score, m.best[who] ?? 0) },
    top: { ...m.top, [who]: Math.max(top, m.top[who] ?? 0) },
    day: today,
    dayCoins: used + coins,
  };
  return { state: { ...s, coins: s.coins + coins, merge: rec }, coins, newBest };
}
