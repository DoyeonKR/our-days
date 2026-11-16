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
 *   · 숫자 대신 **식재료**가 귀해진다 — 상추에서 시작해 11단계 **화이트 트러플**(전설)이 목표, 그 위로 천종산삼 · 불로초.
 *   · **황금 거름** 타일 — 가끔 생긴다. 어떤 작물과 부딪혀도 그 작물을 한 단계 키우고 사라진다(거름끼리는 안 합쳐진다).
 *   · 되돌리기는 없다 — 사용자 판단으로 뺐다(2026-10-31 "되돌리기 같은기능은 없애버려"). 한 수 한 수가 무르기 없이 간다.
 *   · 끝난 판의 점수는 **섬 하트**가 된다(하루 상한) · 커플 각자의 최고 기록이 섬에 남는다.
 *
 * ⚠ 순수 함수만 둔다 — 난수는 상태 안의 시드로 굴린다(이어하기가 같은 결과를 내게).
 * ⚠ island.ts 를 **값으로** import 하지 마라(타입만) — 게임 탭 첫 로드에 섬 엔진 전체가 실린다(firstload.test 와 같은 이유).
 */

import type { IslandState } from "./island.ts";
import { seasonAdd } from "./season.ts";

export const SIZE = 4;
/** 목표 단계(장르의 '2048' 자리) — 화이트 트러플. 넘어서 계속할 수 있다. */
export const GOAL_LV = 11;
/** 마지막 단계 — 4×4 판에서 이론상 닿을 수 있는 끝(2^17)까지 연다(2026-11-01 "불로초 다음").
 *  ⚠ 올리면 merge_runs.top_lv 의 check(0~17)와 submit_merge_run 의 clamp 도 같이 올린다(migration). */
export const MAX_LV = 17;
/** 황금 거름이 나오기 시작하는 이동 수 · 확률 */
export const FERT_FROM_MOVE = 20;
export const FERT_CHANCE = 0.04;
/** 섬 하트 — 점수 SCORE_PER_COIN 마다 1, 하루 DAILY_COIN_CAP 까지(KST) */
export const SCORE_PER_COIN = 50;
export const DAILY_COIN_CAP = 400;

export type Dir = "left" | "right" | "up" | "down";
/** stone: 주간 도전판의 돌 장애물 — 움직이지도 합쳐지지도 않는다(lv 0). 보통 판에는 없다. */
export type Tile = { id: number; lv: number; fert?: true; stone?: true };
export type Board = (Tile | null)[];

/** 단계별 식재료 — 단계가 오를수록 **귀하고 보기 힘든 것**. 화면은 이 key 로 MergeArt(벡터 그림)를 그린다.
 * [사용자 2026-10-31 "레벨이 높아질수록 더 멋있고 희귀해야 … 트러플이라던가"]
 * 흔한 채소 → 귀한 산물 → 진귀품 → 전설. rarity 는 칸 테두리 · 사다리 · 이름표의 등급 글자다.
 * ⚠ key 를 바꾸면 순위표의 top_lv 는 숫자라 그대로지만 MergeArt 의 그림 표(ART)도 같이 바꿔야 한다(merge.test). */
export type Rarity = "흔함" | "보통" | "귀함" | "희귀" | "진귀" | "전설" | "신화" | "선계" | "천계" | "태초";
/** 희귀도 순서 — 뒤로 갈수록 귀하다(사다리 · 테스트가 이 순서로 '내려가지 않음'을 본다) */
export const RARITY_ORDER: readonly Rarity[] = ["흔함", "보통", "귀함", "희귀", "진귀", "전설", "신화", "선계", "천계", "태초"];
export const CHAIN: readonly { key: string; name: string; rarity: Rarity }[] = [
  { key: "lettuce", name: "상추", rarity: "흔함" },
  { key: "carrot", name: "당근", rarity: "흔함" },
  { key: "strawberry", name: "딸기", rarity: "보통" },
  { key: "corn", name: "옥수수", rarity: "보통" },
  { key: "shiitake", name: "표고버섯", rarity: "귀함" },
  { key: "ginseng", name: "인삼", rarity: "귀함" },
  { key: "matsutake", name: "송이버섯", rarity: "희귀" },
  { key: "saffron", name: "사프란", rarity: "희귀" },
  { key: "black_truffle", name: "블랙 트러플", rarity: "진귀" },
  { key: "ruby_grape", name: "루비로망", rarity: "진귀" },
  { key: "white_truffle", name: "화이트 트러플", rarity: "전설" },
  // 무등산수박(2026-11-01 [사용자 "무등산 수박도 만들어줘"]) — 섬의 전설 작물. ⚠ 줄무늬 없는 진초록 · 큰 타원(실물 · README §14.5)
  { key: "watermelon", name: "무등산수박", rarity: "전설" },
  { key: "wild_ginseng", name: "천종산삼", rarity: "전설" },
  { key: "lingzhi", name: "불로초", rarity: "신화" },
  // ── 불로초 너머(2026-11-01) — 인간 세상의 재료가 끝나고 하늘 · 달 · 태초로 올라간다.
  //    4×4 판의 현실적인 끝이 17단계라(새 타일이 1 · 2단계) 무등산수박을 넣으며 '은하 별꿀'은 뺐다.
  { key: "peach_of_immortals", name: "천도복숭아", rarity: "선계" },
  { key: "moon_laurel", name: "월궁 계수열매", rarity: "천계" },
  { key: "world_seed", name: "세계수의 씨앗", rarity: "태초" },
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
  /** 연속 합치기 — 합친 수가 몇 번 이어졌나(합치지 못한 수에서 0). 옛 저장분엔 없다(0 으로 읽는다). */
  streak?: number;
  /** 이 판에서 콤보 · 연속으로 더 받은 점수(점수에 이미 들어 있다 — 결과 화면 설명용) */
  bonus?: number;
  /** 주간 도전판의 규칙(없으면 보통 판 — 장르 표준 그대로). WEEKLY_RULES 참고. */
  rule?: WeeklyRuleId;
};

/* ── 콤보 · 연속 보너스 (2026-11-01 [사용자: "콤보일경우 점수를 조금 더 … 연속으로 깰 경우도 점수를 더 … 밸런스 잘 맞춰서"]) ──
 * 기본 점수(만든 타일 값의 합)는 장르 그대로 두고, 그 위에 **비율 보너스**만 얹는다:
 *   · 콤보 — 한 수에 둘 이상 합치면 그 수의 점수 × 15% × (합친 수 − 1), 상한 +60%.
 *   · 연속 — 합친 수가 3번째 이어질 때부터 수마다 +2%p, 상한 +20%(합치지 못한 수에서 끊긴다).
 *   · 두 보너스는 더하고, 한 수의 보너스는 그 수 기본 점수의 80% 를 넘지 않는다.
 * 비율로 둔 이유: 큰 타일일수록 기본 점수가 커서 보너스도 같이 커지고(후반에 의미가 있다), 초반 작은 타일 콤보로 순위가 뒤집히지 않는다.
 * 실측(2026-11-01 · 판 300개씩): 아무렇게나 두는 쪽 평균 1,318점 중 보너스 12.7% · 모서리를 지키는 쪽 평균 4,058점 중 11.4%.
 *   보너스는 총점의 10~15% — '조금 더'다. 실력 서열(기본 점수)을 뒤집지 않는다(merge.test 가 상한을 잠근다). */
export const COMBO_STEP = 0.15;
export const COMBO_CAP = 0.6;
export const STREAK_FROM = 3;
export const STREAK_STEP = 0.02;
export const STREAK_CAP = 0.2;
export const BONUS_CAP = 0.8;

/** 한 수의 보너스 비율 — merges: 그 수에서 합친 수, streak: 이 수까지 이어진 연속 수 */
export function bonusRate(merges: number, streak: number): { combo: number; chain: number; total: number } {
  const combo = merges >= 2 ? Math.min(COMBO_CAP, (merges - 1) * COMBO_STEP) : 0;
  const chain = merges > 0 && streak >= STREAK_FROM ? Math.min(STREAK_CAP, (streak - STREAK_FROM + 1) * STREAK_STEP) : 0;
  return { combo, chain, total: Math.min(BONUS_CAP, combo + chain) };
}

/** mulberry32 — 상태 하나(32비트)로 굴리는 결정적 난수. [0,1) 과 다음 상태를 돌려준다. */
export function rand(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** 판 한 변의 칸 수 — 보통 판은 4, 주간 도전 '큰 판'은 5. 판 길이에서 읽는다(보통 판은 늘 SIZE). */
export const sideOf = (board: Board) => (board.length === 25 ? 5 : SIZE);

/** 미는 방향의 줄들 — 각 줄은 **미는 쪽 끝부터** 칸 번호를 늘어놓는다. n 은 판 한 변(기본 4). */
export function lines(dir: Dir, n: number = SIZE): number[][] {
  const out: number[][] = [];
  const idx = (r: number, c: number) => r * n + c;
  for (let k = 0; k < n; k++) {
    const line: number[] = [];
    for (let j = 0; j < n; j++) {
      if (dir === "left") line.push(idx(k, j));
      else if (dir === "right") line.push(idx(k, n - 1 - j));
      else if (dir === "up") line.push(idx(j, k));
      else line.push(idx(n - 1 - j, k));
    }
    out.push(line);
  }
  return out;
}

/** 두 타일이 합쳐지면 남는 단계(못 합치면 0). 순서 무관. */
export function mergeLv(a: Tile, b: Tile): number {
  if (a.stone || b.stone) return 0;
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

/** 밀기 — 새 타일은 안 만든다(spawn 은 따로).
 *  돌(stone)은 제자리에 남고 줄을 **토막**으로 나눈다 — 타일은 자기 토막 안에서만 미는 쪽 끝(또는 돌 바로 앞)까지 몰린다.
 *  돌이 없으면 줄 전체가 한 토막이라 장르 표준 그대로다(merge.test). */
export function slide(board: Board, dir: Dir): MoveResult {
  const n = sideOf(board);
  const next: Board = Array(n * n).fill(null);
  const slides: Slide[] = [];
  const merged: number[] = [];
  const vanished: Tile[] = [];
  let gained = 0;
  let moved = false;
  const segments: number[][] = [];
  for (const line of lines(dir, n)) {
    let seg: number[] = [];
    for (const i of line) {
      const t = board[i];
      if (t?.stone) {
        next[i] = t;
        slides.push({ id: t.id, to: i });
        segments.push(seg);
        seg = [];
      } else seg.push(i);
    }
    segments.push(seg);
  }
  for (const line of segments) {
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
export function spawn(g: Pick<Game, "board" | "rng" | "nextId" | "moves" | "rule">): { board: Board; rng: number; nextId: number; born: number | null } {
  const empty = g.board.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return { board: g.board, rng: g.rng, nextId: g.nextId, born: null };
  const rule = weeklyRule(g.rule);
  let [r, rng] = rand(g.rng);
  const at = empty[Math.floor(r * empty.length)];
  [r, rng] = rand(rng);
  // 난수 세 번의 순서는 보통 판과 같다(이어하기 · 테스트가 같은 판을 낸다) — 주간 규칙은 거름 문턱 · 확률만 바꾼다
  const fert = g.moves >= (rule?.fertFrom ?? FERT_FROM_MOVE) && r < (rule?.fertChance ?? FERT_CHANCE);
  [r, rng] = rand(rng);
  const tile: Tile = fert ? { id: g.nextId, lv: 0, fert: true } : { id: g.nextId, lv: r < 0.9 ? 1 : 2 };
  const board = g.board.slice();
  board[at] = tile;
  return { board, rng, nextId: g.nextId + 1, born: tile.id };
}

export function canMove(board: Board): boolean {
  const n = sideOf(board);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const t = board[r * n + c];
      if (!t) return true;
      const right = c + 1 < n ? board[r * n + c + 1] : null;
      const down = r + 1 < n ? board[(r + 1) * n + c] : null;
      if ((right && mergeLv(t, right)) || (down && mergeLv(t, down))) return true;
    }
  return false;
}

const topOf = (board: Board) => board.reduce((m, t) => (t && !t.fert && !t.stone ? Math.max(m, t.lv) : m), 0);

/** 새 판 — 타일 두 개로 시작한다(장르 표준). */
export function newGame(seed: number): Game {
  let g: Game = { board: Array(SIZE * SIZE).fill(null), score: 0, moves: 0, rng: seed >>> 0, nextId: 1, over: false, reachedGoal: false, top: 0 };
  for (let k = 0; k < 2; k++) {
    const s = spawn(g);
    g = { ...g, board: s.board, rng: s.rng, nextId: s.nextId };
  }
  return { ...g, top: topOf(g.board) };
}

export type Turn = {
  game: Game;
  result: MoveResult | null;
  born: number | null;
  goalNow: boolean;
  /** 이 수의 보너스 점수와 그 내역(화면 연출용) — 보너스가 없으면 0 */
  bonus?: number;
  combo?: number;
  streak?: number;
};

/** 한 수 — 움직였을 때만 새 타일·점수·기록. 못 움직이는 방향이면 그대로(result null). */
export function play(g: Game, dir: Dir): Turn {
  if (g.over) return { game: g, result: null, born: null, goalNow: false };
  const res = slide(g.board, dir);
  if (!res.moved) return { game: g, result: null, born: null, goalNow: false };
  const moves = g.moves + 1;
  const s = spawn({ board: res.board, rng: g.rng, nextId: g.nextId, moves, rule: g.rule });
  const top = Math.max(g.top, topOf(s.board));
  const goalNow = !g.reachedGoal && top >= GOAL_LV;
  const merges = res.merged.length;
  const streak = merges > 0 ? (g.streak ?? 0) + 1 : 0;
  const bonus = Math.round(res.gained * bonusRate(merges, streak).total);
  const limit = weeklyRule(g.rule)?.moveLimit ?? 0;
  const game: Game = {
    ...g,
    board: s.board,
    rng: s.rng,
    nextId: s.nextId,
    score: g.score + res.gained + bonus,
    moves,
    top,
    reachedGoal: g.reachedGoal || goalNow,
    over: !canMove(s.board) || (limit > 0 && moves >= limit),
    streak,
    bonus: (g.bonus ?? 0) + bonus,
  };
  return { game, result: res, born: s.born, goalNow, bonus, combo: merges, streak };
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
  /** 스킨 상점(lib/mergeskins) — 산 스킨 id · 사람마다 단계별로 낀 스킨. 옵셔널(무마이그레이션). */
  skins?: string[];
  wear?: Record<string, Record<string, string>>;
  /** 최근 정산한 판 id(SETTLED_KEEP 개) — 같은 판을 두 번 정산하지 않게(2026-11-11 리뷰: 저장 응답 전에 화면을 닫으면
   *  기기 기록에 '정산함'이 안 남아 다음에 열 때 하트 · 최고 기록을 또 줬다). 옵셔널 = 무마이그레이션. */
  settled?: number[];
  /** 주간 도전판 보상을 받은 주(월요일 'YYYY-MM-DD', 최근 WEEK_PAID_KEEP 개) — 커플마다 주에 한 번. 옵셔널 = 무마이그레이션. */
  weekPaid?: string[];
};
export const SETTLED_KEEP = 40;

export function mergeOf(s: IslandState): MergeRecord {
  const m: Partial<MergeRecord> | undefined = s.merge;
  // ⚠ 원본을 먼저 펼친다 — 새 앱이 더한 칸을 옛 앱이 판을 끝낼 때마다 지우지 않게(스킨 칸이 그렇게 사라질 뻔했다)
  return { ...(m ?? {}), best: { ...(m?.best ?? {}) }, top: { ...(m?.top ?? {}) }, day: m?.day ?? "", dayCoins: m?.dayCoins ?? 0,
    ...(m?.skins ? { skins: [...m.skins] } : {}), ...(m?.wear ? { wear: { ...m.wear } } : {}),
    ...(Array.isArray(m?.settled) ? { settled: m.settled.filter((x) => typeof x === "number") } : {}) };
}

/* ── 순위 점수의 상한 · 하한 (2026-11-06 게임 리뷰 — 서버 submit_merge_run 이 같은 식으로 거른다) ──
 * 끝난 판의 최고 단계가 L 일 때 낼 수 있는 점수의 증명된 범위:
 *   · 판 위의 타일 하나(단계 l)를 만들며 얻은 기본 점수 ≤ (l − 1) · 2^l.
 *     귀납: 새 타일(1 · 2단계)은 0 점. 같은 것 둘 → 2 · (l−2)·2^(l−1) + 2^l = (l−1)·2^l.
 *     거름 → (l−2)·2^(l−1) + 2^l = l·2^(l−1) ≤ (l−1)·2^l (l ≥ 2). 거름끼리는 안 합쳐진다.
 *   · 합쳐진 타일은 사라지지 않고 결과 타일에 들어가므로 판의 점수 = 마지막 판 위 타일들의 점수 합.
 *     칸은 16 개, 각 단계 ≤ L → 기본 점수 ≤ 16 · (L − 1) · 2^L.
 *   · 보너스는 한 수 기본의 80% 이하(BONUS_CAP) + 반올림 0.5(합친 수의 기본은 4 이상이라 12.5% 이하) → 총점 < 2 × 기본.
 *   그래서 상한 = 2 · 16 · (L − 1) · 2^L = (L − 1) · 2^(L + 5). 16칸을 다 L 로 채우는 판은 없으니 실제보다 훨씬 넉넉하다
 *   (11단계 실측 2만 점대 ↔ 상한 655,360). 하한: 3단계부터는 합쳐야만 생기므로 그 합치기 하나로 2^L 점 이상.
 * ⚠ 규칙(BONUS_CAP · 칸 수 · 새 타일 단계)을 바꾸면 이 식과 마이그레이션 20261106060000_games_guard.sql 을 같이 고친다(merge.test). */
export const RANK_SCORE_MAX = 10_000_000;
export function scoreCeiling(top: number): number {
  if (!Number.isInteger(top) || top < 1 || top > MAX_LV) return 0;
  return Math.min(RANK_SCORE_MAX, (top - 1) * 2 ** (top + 5));
}
export function scoreFloor(top: number): number {
  return top >= 3 ? 2 ** top : 1;
}

/* ── 순위판 닉네임 — 서버 submit_merge_run 과 같은 규칙(전체 공개라 링크 · 보이지 않는 글자를 막는다) ── */
export const NICK_MAX = 12;
/** 주소처럼 보이는 것 — ⚠ 마이그레이션의 같은 정규식과 글자 하나까지 같다(merge.test 가 맞춰 본다) */
export const NICK_URL_RE = "(https?://|www\\.|[a-z0-9-]+\\.(com|net|org|kr|io|me|ly|gg|xyz|co|app|dev|site|link|to|tv|shop|info|biz|top|club)([^a-z0-9]|$))";
const NICK_HIDDEN = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/;
export function normalizeNick(raw: string): { ok: true; nick: string } | { ok: false; reason: string } {
  const v = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!v) return { ok: false, reason: "닉네임을 적어 주세요" };
  if (NICK_HIDDEN.test(v)) return { ok: false, reason: "쓸 수 없는 글자가 있어요" };
  if (new RegExp(NICK_URL_RE, "i").test(v)) return { ok: false, reason: "주소(링크)는 닉네임으로 쓸 수 없어요" };
  return { ok: true, nick: [...v].slice(0, NICK_MAX).join("") };
}

/** 끝난 판 하나를 섬에 남긴다 — 하트(하루 상한) · 내 최고 기록. 순수.
 *  gameId 를 주면 섬 기록(settled)에 남기고, 이미 정산한 판이면 아무것도 안 바꾼다(dup — 같은 참조). */
export function settleGame(s: IslandState, who: string, score: number, top: number, today: string, gameId?: number): { state: IslandState; coins: number; newBest: boolean; dup?: boolean } {
  const m = mergeOf(s);
  if (gameId != null && m.settled?.includes(gameId)) return { state: s, coins: 0, newBest: false, dup: true };
  // 하루 상한은 오늘이 남긴 날보다 뒤일 때만 비운다 — 폰 날짜를 어제 · 오늘로 번갈아 바꿔 상한을 다시 여는 걸 막는다(2026-11-11 리뷰: 날짜 둘을 번갈아 800 → 2,000)
  const later = !!m.day && m.day > today;
  const used = m.day && m.day >= today ? m.dayCoins : 0;
  const coins = Math.max(0, Math.min(Math.floor(score / SCORE_PER_COIN), DAILY_COIN_CAP - used));
  const newBest = score > (m.best[who] ?? 0);
  const rec: MergeRecord = {
    ...m,
    best: { ...m.best, [who]: Math.max(score, m.best[who] ?? 0) },
    top: { ...m.top, [who]: Math.max(top, m.top[who] ?? 0) },
    day: later ? m.day : today,
    dayCoins: used + coins,
    ...(gameId != null ? { settled: [...(m.settled ?? []), gameId].slice(-SETTLED_KEEP) } : {}),
  };
  // 시즌 미션 — 끝낸 판 하나 · 이번 달 최고 점수 · 단계(같은 판을 두 번 정산하면 위의 dup 에서 멈춘다).
  // 0점 판은 판 수에 안 넣는다 — 판 중간의 '새 게임'으로 빈 판을 끝내 '5판'을 채우지 못하게
  const state = seasonAdd({ ...s, coins: s.coins + coins, merge: rec }, today, { mergeGames: score > 0 ? 1 : 0 }, { max: { mergeScore: score, mergeTop: top } });
  return { state, coins, newBest };
}

/** 기기에 남긴 판 기록(MergeGame 의 {game, finished, backlog} JSON)에서 그 판의 표시(settled · ranked)만 켠다 — 순수.
 *  2026-11-11 리뷰: 표시는 화면 상태 → effect 로만 기기에 남아서, 저장 응답 뒤 화면이 닫히면 안 남았고 다음에 열 때
 *  같은 판의 하트 · 순위를 또 남겼다. 이제 표시를 켜는 순간 이걸로 바로 쓴다(지금 판 · 다른 판은 건드리지 않는다). */
export function markStoredFinished(json: string | null, id: number, key: "settled" | "ranked"): string | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as { finished?: { id?: unknown } | null; backlog?: { id?: unknown }[] } | null;
    if (!v || typeof v !== "object") return null;
    let hit = false;
    const mark = <T extends { id?: unknown } | null | undefined>(f: T): T => {
      if (f && f.id === id) {
        hit = true;
        return { ...f, [key]: true };
      }
      return f;
    };
    const next = { ...v, finished: mark(v.finished), backlog: Array.isArray(v.backlog) ? v.backlog.map(mark) : v.backlog };
    return hit ? JSON.stringify(next) : null;
  } catch {
    return null;
  }
}

/* ── 주간 도전판 (2026-11-13) [사용자 승인: "합치기 주간 도전판"] ─────────────────────────
 * 주(KST 월요일 0시 ~ 다음 월요일 0시 전)마다 특별한 판 규칙 하나 — 주 일련번호로 정해져 모두가 같은 주에 같은 규칙을 한다.
 * 보통 판(위의 장르 표준)은 그대로다 — 규칙은 Game.rule 이 있을 때만 켜지는 **별도 옵션**이다(merge.test 가 보통 판을 잠근다).
 * 커플 점수 = 그 주 두 사람 각자의 최고 도전 점수의 합. 서버 표는 merge_weekly_runs(전체 순위 merge_runs 와 따로 —
 * README §14.4.5 '주간 도전판'). ⚠ 규칙 순서 · 상수를 바꾸면 migration 20261107100000_merge_weekly.sql 의 같은 식도 바꾼다(mergeweekly.test). */
export type WeeklyRuleId = "stones" | "moves" | "preset" | "fert" | "big";
export type WeeklyRule = {
  id: WeeklyRuleId;
  name: string;
  desc: string;
  /** 판 한 변 */
  size: number;
  /** 돌 장애물 수(시드로 2 ~ stones 개) */
  stones: number;
  /** 수 제한(0 = 없음) — 이 수만큼 밀면 판이 끝난다 */
  moveLimit: number;
  fertFrom: number;
  fertChance: number;
  /** 시작 재료(칸마다 단계, 0 = 빈 칸) — 있으면 무작위 첫 두 타일 대신 이 판으로 시작한다 */
  preset: readonly number[] | null;
};
/** 고정 시작판 — 모두 같은 판에서 출발한다. 가장 높은 재료는 PRESET_TOP(하한 계산이 이 값을 쓴다) */
export const PRESET_TOP = 4;
const PRESET_BOARD: readonly number[] = [
  1, 0, 0, 1,
  0, 2, 2, 0,
  0, 0, 0, 0,
  4, 3, 0, 3,
];
/** ⚠ 순서 = 서버 private.merge_week_rule 의 배열 순서(주 일련번호 mod 길이) */
export const WEEKLY_RULES: readonly WeeklyRule[] = [
  { id: "stones", name: "돌밭 정원", desc: "움직이지 않는 돌 2~3개가 판에 박혀 있어요. 돌은 밀리지도 합쳐지지도 않아요.", size: 4, stones: 3, moveLimit: 0, fertFrom: FERT_FROM_MOVE, fertChance: FERT_CHANCE, preset: null },
  { id: "moves", name: "60수 승부", desc: "딱 60번만 밀 수 있어요. 60번째 수에서 판이 끝나요. 황금 거름은 나오지 않아요.", size: 4, stones: 0, moveLimit: 60, fertFrom: 0, fertChance: 0, preset: null },
  { id: "preset", name: "같은 출발", desc: "모두 같은 재료 배치에서 시작해요. 첫 수부터 실력 차이가 나요.", size: 4, stones: 0, moveLimit: 0, fertFrom: FERT_FROM_MOVE, fertChance: FERT_CHANCE, preset: PRESET_BOARD },
  { id: "fert", name: "거름 풍년", desc: "황금 거름이 5수째부터 훨씬 자주(12%) 나와요.", size: 4, stones: 0, moveLimit: 0, fertFrom: 5, fertChance: 0.12, preset: null },
  { id: "big", name: "넓은 밭", desc: "5×5 큰 판이에요. 칸이 넓은 만큼 오래 버틸 수 있어요.", size: 5, stones: 0, moveLimit: 0, fertFrom: FERT_FROM_MOVE, fertChance: FERT_CHANCE, preset: null },
];
export function weeklyRule(id: string | null | undefined): WeeklyRule | null {
  return (id && WEEKLY_RULES.find((r) => r.id === id)) || null;
}

/** 주 일련번호 — 1970-01-05(월, KST 날짜 일련번호 4)부터 센 주. 서버 private.merge_week_start 와 같은 식(정수 계산뿐). */
const WEEK_EPOCH_DAY = 4;
export function weekSerialOf(now: number): number {
  return Math.floor((Math.floor((now + 9 * 3600_000) / 86400_000) - WEEK_EPOCH_DAY) / 7);
}
/** 그 주의 월요일(KST) 'YYYY-MM-DD' — 서버의 week(date) 칸과 같은 값 */
export function weekStartOf(serial: number): string {
  return new Date((WEEK_EPOCH_DAY + serial * 7) * 86400_000).toISOString().slice(0, 10);
}
/** 'YYYY-MM-DD'(월요일) → 일련번호. 월요일이 아니거나 못 읽으면 null */
export function weekSerialOfStart(week: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return null;
  const t = Date.parse(`${week}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const day = t / 86400_000 - WEEK_EPOCH_DAY;
  return day % 7 === 0 ? day / 7 : null;
}
export function weeklyRuleOfSerial(serial: number): WeeklyRule {
  const n = WEEKLY_RULES.length;
  return WEEKLY_RULES[((serial % n) + n) % n];
}
export type WeekInfo = { serial: number; week: string; rule: WeeklyRule; endsAt: number };
export function weekOf(now: number): WeekInfo {
  const serial = weekSerialOf(now);
  return { serial, week: weekStartOf(serial), rule: weeklyRuleOfSerial(serial), endsAt: (WEEK_EPOCH_DAY + (serial + 1) * 7) * 86400_000 - 9 * 3600_000 };
}

/** 주간 도전판 새 판 — 돌 · 시작 재료를 놓고(규칙에 따라) 무작위 두 타일로 시작한다(시작 재료가 있으면 그 판 그대로). */
export function newChallenge(seed: number, ruleId: WeeklyRuleId): Game {
  const rule = weeklyRule(ruleId) ?? WEEKLY_RULES[0];
  const n = rule.size;
  let g: Game = { board: Array(n * n).fill(null), score: 0, moves: 0, rng: seed >>> 0, nextId: 1, over: false, reachedGoal: false, top: 0, rule: rule.id };
  if (rule.preset) {
    const board = g.board.slice();
    let nextId = g.nextId;
    rule.preset.forEach((lv, i) => {
      if (lv > 0) board[i] = { id: nextId++, lv };
    });
    return { ...g, board, nextId, top: topOf(board) };
  }
  if (rule.stones > 0) {
    let r: number, rng = g.rng;
    [r, rng] = rand(rng);
    const count = 2 + Math.floor(r * (rule.stones - 1)); // 2 ~ stones 개
    const board = g.board.slice();
    let nextId = g.nextId;
    for (let k = 0; k < count; k++) {
      const empty = board.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
      [r, rng] = rand(rng);
      board[empty[Math.floor(r * empty.length)]] = { id: nextId++, lv: 0, stone: true };
    }
    g = { ...g, board, rng, nextId };
  }
  for (let k = 0; k < 2; k++) {
    const s = spawn(g);
    g = { ...g, board: s.board, rng: s.rng, nextId: s.nextId };
  }
  return { ...g, top: topOf(g.board) };
}

/** 저장분 검증(주간 도전판) — 규칙이 있고 판 크기가 그 규칙과 맞을 때만 */
export function isChallengeGame(v: unknown): v is Game {
  if (!v || typeof v !== "object") return false;
  const g = v as Game;
  const rule = weeklyRule(g.rule);
  return !!rule && Array.isArray(g.board) && g.board.length === rule.size * rule.size && typeof g.score === "number" && typeof g.rng === "number" && typeof g.nextId === "number";
}

/* 도전판 점수의 범위 — 위 scoreCeiling 의 증명을 규칙마다 다시 센다(서버 private.merge_weekly_plausible 이 같은 식):
 *   · 타일 하나 ≤ (l − 1)·2^l 은 그대로다 — 돌은 합쳐지지 않고(0 점), 시작 재료는 새 타일처럼 0 점으로 놓인다(≤ (l−1)·2^l).
 *     거름 확률은 증명에 안 들어간다(거름 합치기도 같은 식 이하).
 *   · 칸 수: 큰 판은 25, 나머지는 16(돌이 칸을 차지하면 더 적다 — 상한은 여전히 맞다). 상한 = 2 · 칸 · (L − 1) · 2^L.
 *   · 60수: 거름이 없으니 판 위 '질량'(Σ 2^l)은 늘지 않고 새 타일마다 4 이하로만 는다 → Σ 2^l ≤ 4 · (2 + 60) = 248.
 *     그래서 최고 단계 ≤ 7(2^8 = 256 > 248), 기본 점수 ≤ Σ (l − 1)·2^l ≤ (L − 1) · 248 → 총점 < 2 · (L − 1) · 248.
 *   · 하한: 새로 놓이는 것보다 높은 단계(보통 3, 같은 출발은 PRESET_TOP + 1 부터)는 합쳐야만 생기므로 2^L 점 이상. */
export const MOVES_MASS = 4 * (2 + 60);
export function weeklyTopMax(rule: WeeklyRuleId): number {
  return rule === "moves" ? Math.floor(Math.log2(MOVES_MASS)) : MAX_LV;
}
export function weeklyScoreCeiling(rule: WeeklyRuleId, top: number): number {
  const r = weeklyRule(rule);
  if (!r || !Number.isInteger(top) || top < 1 || top > weeklyTopMax(rule)) return 0;
  const cells = r.size * r.size;
  let c = Math.min(RANK_SCORE_MAX, 2 * cells * (top - 1) * 2 ** top);
  if (rule === "moves") c = Math.min(c, 2 * (top - 1) * MOVES_MASS);
  return c;
}
export function weeklyScoreFloor(rule: WeeklyRuleId, top: number): number {
  const born = rule === "preset" ? PRESET_TOP : 2;
  return top > born ? 2 ** top : 1;
}

/* ── 주간 보상 — 끝난 주의 커플 점수로 섬 하트(단계별 · 주당 상한 600 · 커플마다 주에 한 번) ──
 * ⚠ 앱이 섬 상태(s.merge.weekPaid)에 적는다 — 서버는 점수 · 순위 · 그 주가 끝났는지(ended)만 낸다(끝난 판 하트처럼 클라이언트가 쓰는 정산이다).
 *   커플 점수는 서버 merge_weekly_board 가 돌려준 값을 쓰고, 같은 주를 두 번 주지 않게 섬 쪽에 주 id 를 남긴다(버전 잠금 저장).
 *   '끝났나'는 서버 시각으로 본다(ended) — 기기 시계가 앞선 폰이 아직 안 끝난 주를 덜 찬 점수로 받아 가지 않게. */
export const WEEKLY_REWARD_CAP = 600;
/** [커플 점수 이상, 하트] — 높은 것부터 */
export const WEEKLY_REWARD_TIERS: readonly (readonly [number, number])[] = [
  [40_000, 600],
  [20_000, 500],
  [10_000, 400],
  [5_000, 300],
  [2_000, 200],
  [500, 100],
  [1, 50],
];
/** 규칙마다 점수 크기가 달라서(봇 200판 가운데값: 돌밭 558 · 60수 514 · 같은 출발 1,913 · 거름 풍년 2,108 · 넓은 밭 11,335)
 *  단계 표에 대기 전에 곱한다 — 어느 주든 보통으로 하면 비슷한 단계(커플 가운데값 → 200)에 닿게. 상한 600 은 그대로. */
export const WEEKLY_REWARD_SCALE: Readonly<Record<WeeklyRuleId, number>> = { stones: 3, moves: 4, preset: 1, fert: 1, big: 0.2 };
export function weeklyReward(coupleScore: number, rule: WeeklyRuleId): number {
  if (!Number.isFinite(coupleScore) || coupleScore <= 0) return 0;
  const scaled = Math.max(1, Math.floor(coupleScore * (WEEKLY_REWARD_SCALE[rule] ?? 1)));
  const hit = WEEKLY_REWARD_TIERS.find(([min]) => scaled >= min);
  return Math.min(WEEKLY_REWARD_CAP, hit ? hit[1] : 0);
}
export const WEEK_PAID_KEEP = 12;
/** 끝난 주의 보상을 섬에 — 이미 받은 주 · 아직 안 끝난 주 · 점수 없음이면 아무것도 안 바꾼다(같은 참조). 순수. */
export function settleWeekly(s: IslandState, week: string, coupleScore: number, currentWeek: string): { state: IslandState; coins: number; dup?: boolean } {
  const m = mergeOf(s);
  const paid = Array.isArray(m.weekPaid) ? m.weekPaid : [];
  if (paid.includes(week)) return { state: s, coins: 0, dup: true };
  const serial = weekSerialOfStart(week);
  if (serial == null || !(week < currentWeek)) return { state: s, coins: 0 };
  const coins = weeklyReward(coupleScore, weeklyRuleOfSerial(serial).id);
  if (coins <= 0) return { state: s, coins: 0 };
  const rec: MergeRecord = { ...m, weekPaid: [...paid, week].slice(-WEEK_PAID_KEEP) };
  return { state: { ...s, coins: s.coins + coins, merge: rec }, coins };
}
