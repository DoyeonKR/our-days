// 테트리스 순수 룰 엔진 — 렌더/타이머 없는 결정적 로직(boardgame.ts 관례).
// 모든 함수는 (state) => 새 state (불변). 랜덤은 전부 state.rng(시드) 경유 →
// 같은 시드면 두 사람이 같은 블록 순서/쓰레기 구멍을 받는다(점수 대결 공정성).
//
// 표준 준수 사항(퀄리티 기준):
// - 7-bag 랜덤라이저(7개 한 묶음 셔플 — 같은 조각 가뭄/폭주 방지)
// - SRS 회전 + 월킥(JLSTZ/I 별도 킥 테이블, 보드 좌표계 y↓ 로 부호 변환)
// - 홀드(락당 1회), 고스트, 하드/소프트 드롭 점수
// - 점수: 싱글100/더블300/트리플500/테트리스800 ×레벨, B2B ×1.5, 콤보 +50×콤보×레벨,
//   퍼펙트 클리어 +2000×레벨, T-스핀(3코너 규칙, mini/full)
// - 대결 공격: 더블1/트리플2/테트리스4, T-스핀 풀 2/4/6, B2B +1, 콤보 보너스, 상쇄(캔슬)
// - 쓰레기줄: 배치당 같은 구멍(시드 결정), 락 시점에 올라옴, 1회 최대 8줄

export const T_COLS = 10;
export const T_ROWS = 20; // 보이는 행
export const T_HIDDEN = 4; // 스폰/킥 여유용 숨김 행(위)
export const T_TOTAL = T_ROWS + T_HIDDEN; // 24
export const PENDING_CAP = 20; // 대기 쓰레기 상한
export const GARBAGE_PER_LOCK = 8; // 한 번에 올라오는 쓰레기 상한

// 조각: 0=I 1=O 2=T 3=S 4=Z 5=J 6=L. 셀 값 = kind+1 (1..7), 8=쓰레기.
export const KINDS = 7;
export const GARBAGE_CELL = 8;

// SRS 스폰 방향 미노 좌표(회전상태 4개 × 미노 4개 × [dx,dy]). I=4×4 박스, 나머지 3×3.
// 보드 좌표계: x→오른쪽, y→아래.
const MINOS: number[][][][] = [
  // I
  [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  // O (회전 불변)
  [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  // T
  [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  // S
  [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  // Z
  [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  // J
  [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  // L
  [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
];

// SRS 킥 테이블(표준은 y↑ 기준이라 dy 부호를 뒤집어 보드 좌표계로 저장).
// key = `${from}${to}`.
const KICKS_JLSTZ: Record<string, number[][]> = {
  "01": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "10": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "12": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "21": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "23": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "32": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "30": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "03": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const KICKS_I: Record<string, number[][]> = {
  "01": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "10": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "12": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  "21": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "23": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  "32": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  "30": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  "03": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export type TSpin = "none" | "mini" | "full";

export interface ClearEvent {
  cleared: number;
  attack: number; // 상쇄(캔슬) 후 실제 나가는 공격 줄 수
  tspin: TSpin;
  b2b: boolean; // 이번 클리어에 B2B 보너스가 적용됐는지
  combo: number; // 이번 클리어의 콤보 카운트(0=콤보 시작)
  pc: boolean; // 퍼펙트 클리어
  rows: number[]; // 지워진 행 인덱스(전체 보드 기준) — UI 플래시용
  garbageIn: number; // 이번 락에서 올라온 쓰레기 줄 수 — UI 흔들림용
}

export interface TetrisState {
  board: number[]; // T_TOTAL×T_COLS 평탄 배열(row-major), 0=빈칸
  kind: number; // 현재 조각(0..6), over 후엔 -1
  rot: 0 | 1 | 2 | 3;
  x: number;
  y: number;
  hold: number; // -1 = 없음
  canHold: boolean;
  queue: number[]; // 다음 조각들(7-bag 리필)
  rng: number; // PRNG 내부 상태
  score: number;
  lines: number;
  level: number;
  combo: number; // -1 = 콤보 없음
  b2b: boolean; // 직전 클리어가 B2B 자격(테트리스/T-스핀)이었는지
  pending: number; // 수신 대기 쓰레기 줄
  over: boolean;
  lastRotated: boolean; // T-스핀: 마지막 성공 조작이 회전인지
  lastKick: number; // 마지막 회전에 쓰인 킥 인덱스(4번 킥=TST성 풀 판정)
  last: ClearEvent | null; // 직전 락 이벤트(UI 이펙트/공격 전송용)
  pieces: number; // 놓은 조각 수(통계)
}

/* ---------- PRNG (mulberry32 1-step, 순수) ---------- */

function rngNext(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/* ---------- 내부 유틸 ---------- */

const idx = (x: number, y: number) => y * T_COLS + x;

function clone(s: TetrisState): TetrisState {
  return { ...s, board: s.board.slice(), queue: s.queue.slice() };
}

function collides(board: number[], kind: number, rot: number, x: number, y: number): boolean {
  for (const [dx, dy] of MINOS[kind][rot]) {
    const px = x + dx;
    const py = y + dy;
    if (px < 0 || px >= T_COLS || py >= T_TOTAL) return true;
    if (py >= 0 && board[idx(px, py)] !== 0) return true;
  }
  return false;
}

/** 큐가 짧으면 7-bag 을 셔플해 보충(항상 7개 이상 유지). */
function refill(s: TetrisState): void {
  while (s.queue.length < 8) {
    const bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = bag.length - 1; i > 0; i--) {
      const [r, next] = rngNext(s.rng);
      s.rng = next;
      const j = Math.floor(r * (i + 1));
      const t = bag[i];
      bag[i] = bag[j];
      bag[j] = t;
    }
    s.queue.push(...bag);
  }
}

/** 다음 조각 스폰. 스폰 위치가 막혀 있으면 over(블록 아웃). */
function spawn(s: TetrisState): void {
  refill(s);
  s.kind = s.queue.shift()!;
  s.rot = 0;
  s.x = 3;
  s.y = T_HIDDEN - 2; // 미노가 숨김 행 하단에 걸치게(즉시 보이기 직전)
  s.lastRotated = false;
  s.lastKick = -1;
  if (collides(s.board, s.kind, s.rot, s.x, s.y)) {
    s.over = true;
    s.kind = -1;
  }
}

/* ---------- 생성 ---------- */

export function createTetris(seed: number): TetrisState {
  const s: TetrisState = {
    board: new Array(T_TOTAL * T_COLS).fill(0),
    kind: -1,
    rot: 0,
    x: 3,
    y: 0,
    hold: -1,
    canHold: true,
    queue: [],
    rng: seed >>> 0,
    score: 0,
    lines: 0,
    level: 1,
    combo: -1,
    b2b: false,
    pending: 0,
    over: false,
    lastRotated: false,
    lastKick: -1,
    last: null,
    pieces: 0,
  };
  spawn(s);
  return s;
}

/* ---------- 조작 (모두 순수: 새 state 반환) ---------- */

export function moveX(s0: TetrisState, dx: -1 | 1): TetrisState {
  if (s0.over) return s0;
  if (collides(s0.board, s0.kind, s0.rot, s0.x + dx, s0.y)) return s0;
  const s = clone(s0);
  s.x += dx;
  s.lastRotated = false;
  return s;
}

/** SRS 회전(+킥). dir=1 시계, -1 반시계. 실패하면 원본 그대로. */
export function rotate(s0: TetrisState, dir: 1 | -1): TetrisState {
  if (s0.over || s0.kind === 1) return s0; // O 는 회전 무의미
  const to = (((s0.rot + dir) % 4) + 4) % 4;
  const table = s0.kind === 0 ? KICKS_I : KICKS_JLSTZ;
  const kicks = table[`${s0.rot}${to}`];
  for (let i = 0; i < kicks.length; i++) {
    const [kx, ky] = kicks[i];
    if (!collides(s0.board, s0.kind, to, s0.x + kx, s0.y + ky)) {
      const s = clone(s0);
      s.rot = to as 0 | 1 | 2 | 3;
      s.x += kx;
      s.y += ky;
      s.lastRotated = true;
      s.lastKick = i;
      return s;
    }
  }
  return s0;
}

/** 한 칸 낙하 가능 여부(락 딜레이 판단용). */
export function canFall(s: TetrisState): boolean {
  return !s.over && !collides(s.board, s.kind, s.rot, s.x, s.y + 1);
}

/** 중력 1칸(자연 낙하) — 점수 없음. 바닥이면 그대로(락은 호출측 타이밍). */
export function gravityStep(s0: TetrisState): TetrisState {
  if (!canFall(s0)) return s0;
  const s = clone(s0);
  s.y += 1;
  s.lastRotated = false;
  return s;
}

/** 소프트 드롭 1칸(+1점). */
export function softDrop(s0: TetrisState): TetrisState {
  if (!canFall(s0)) return s0;
  const s = clone(s0);
  s.y += 1;
  s.score += 1;
  s.lastRotated = false;
  return s;
}

/** 고스트(하드드롭 착지) y. */
export function ghostY(s: TetrisState): number {
  if (s.over) return s.y;
  let y = s.y;
  while (!collides(s.board, s.kind, s.rot, s.x, y + 1)) y++;
  return y;
}

/** 하드 드롭: 즉시 착지(+2점/칸) 후 락. */
export function hardDrop(s0: TetrisState): TetrisState {
  if (s0.over) return s0;
  const s = clone(s0);
  const gy = ghostY(s);
  const dist = gy - s.y;
  if (dist > 0) {
    s.y = gy;
    s.score += dist * 2;
    s.lastRotated = false; // 실제로 떨어졌으면 마지막 조작=이동
  }
  return lockInto(s);
}

/** 홀드: 현재 조각을 보관(락당 1회). 보관 조각이 있으면 교체, 없으면 다음 조각. */
export function holdSwap(s0: TetrisState): TetrisState {
  if (s0.over || !s0.canHold) return s0;
  const s = clone(s0);
  const cur = s.kind;
  if (s.hold >= 0) {
    s.kind = s.hold;
    s.hold = cur;
    s.rot = 0;
    s.x = 3;
    s.y = T_HIDDEN - 2;
    if (collides(s.board, s.kind, s.rot, s.x, s.y)) {
      s.over = true;
      s.kind = -1;
      return s;
    }
  } else {
    s.hold = cur;
    spawn(s);
  }
  s.canHold = false;
  s.lastRotated = false;
  return s;
}

/** 상대 공격 수신 — 대기열에 쌓였다가 다음 락 때 올라온다(상쇄 가능). */
export function queueGarbage(s0: TetrisState, n: number): TetrisState {
  if (s0.over || n <= 0) return s0;
  const s = clone(s0);
  s.pending = Math.min(PENDING_CAP, s.pending + Math.floor(n));
  return s;
}

/** 현재 조각을 지금 위치에 고정(락 딜레이 만료 시 호출측이 사용). */
export function lockNow(s0: TetrisState): TetrisState {
  if (s0.over) return s0;
  return lockInto(clone(s0));
}

/* ---------- 락/클리어/공격 (핵심) ---------- */

// 공격 테이블(줄 수 → 공격). 일반 클리어 / T-스핀 풀.
const ATK_NORMAL = [0, 0, 1, 2, 4];
const ATK_TSPIN = [0, 2, 4, 6];
// 콤보 보너스(index=콤보 카운트, 0부터). 표준 근사.
const ATK_COMBO = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4];
// 점수 테이블 ×레벨.
const SCORE_CLEAR = [0, 100, 300, 500, 800];
const SCORE_TSPIN = [400, 800, 1200, 1600];
const SCORE_TSPIN_MINI = [100, 200, 400, 400];
export const SCORE_PC = 2000; // 퍼펙트 클리어 ×레벨
export const ATK_PC = 6;

/** T-스핀 판정(3코너 규칙): T 중심의 대각 4코너 중 3개 이상이 벽/블록.
 *  front(포인팅 방향 쪽 2코너) 모두 막힘 → full, 아니면 mini(단 5번째 킥(TST)은 full). */
function detectTSpin(s: TetrisState): TSpin {
  if (s.kind !== 2 || !s.lastRotated) return "none";
  const cx = s.x + 1;
  const cy = s.y + 1;
  const filled = (px: number, py: number): boolean =>
    px < 0 || px >= T_COLS || py >= T_TOTAL || (py >= 0 && s.board[idx(px, py)] !== 0);
  // 코너: [좌상, 우상, 우하, 좌하]
  const c = [
    filled(cx - 1, cy - 1),
    filled(cx + 1, cy - 1),
    filled(cx + 1, cy + 1),
    filled(cx - 1, cy + 1),
  ];
  const count = c.filter(Boolean).length;
  if (count < 3) return "none";
  // rot별 '앞쪽'(T 가 가리키는 방향) 코너 쌍: 0=위(좌상+우상) 1=오른쪽(우상+우하) 2=아래(우하+좌하) 3=왼쪽(좌하+좌상)
  const FRONT: number[][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ];
  const [f1, f2] = FRONT[s.rot];
  if (c[f1] && c[f2]) return "full";
  return s.lastKick === 4 ? "full" : "mini"; // 마지막(5번째) 킥 = TST 성 회전은 full 취급
}

/** 락 본체: T-스핀 → 라인 클리어 → 점수/B2B/콤보/PC → 공격 산출·상쇄 → 쓰레기 유입 → 스폰. */
function lockInto(s: TetrisState): TetrisState {
  const tspin = detectTSpin(s);

  // 미노 고정
  let minYLocked = T_TOTAL;
  for (const [dx, dy] of MINOS[s.kind][s.rot]) {
    const px = s.x + dx;
    const py = s.y + dy;
    if (py >= 0) s.board[idx(px, py)] = s.kind + 1;
    if (py < minYLocked) minYLocked = py;
  }
  s.pieces += 1;

  // 라인 클리어
  const rows: number[] = [];
  for (let y = 0; y < T_TOTAL; y++) {
    let full = true;
    for (let x = 0; x < T_COLS; x++) {
      if (s.board[idx(x, y)] === 0) {
        full = false;
        break;
      }
    }
    if (full) rows.push(y);
  }
  for (const y of rows) {
    s.board.copyWithin(T_COLS, 0, y * T_COLS); // y 위 전체를 한 칸 아래로
    s.board.fill(0, 0, T_COLS);
  }
  const cleared = rows.length;

  // 락 아웃: 전부 숨김 행 위에서 굳었고 클리어도 없으면 종료
  const lockOut = minYLocked < T_HIDDEN && cleared === 0 &&
    MINOS[s.kind][s.rot].every(([, dy]) => s.y + dy < T_HIDDEN);

  // 점수/콤보/B2B
  const qualifiesB2B = cleared === 4 || (tspin !== "none" && cleared > 0);
  let gained = 0;
  let b2bApplied = false;
  if (tspin === "full") gained = SCORE_TSPIN[cleared] * s.level;
  else if (tspin === "mini") gained = SCORE_TSPIN_MINI[cleared] * s.level;
  else gained = SCORE_CLEAR[cleared] * s.level;
  if (cleared > 0) {
    if (qualifiesB2B && s.b2b) {
      gained = Math.floor(gained * 1.5);
      b2bApplied = true;
    }
    s.combo += 1;
    gained += 50 * Math.max(0, s.combo) * s.level;
    s.b2b = qualifiesB2B;
  } else {
    s.combo = -1;
    if (tspin !== "none") gained = (tspin === "full" ? 400 : 100) * s.level; // 클리어 없는 T-스핀도 소액
  }

  // 퍼펙트 클리어
  const pc = cleared > 0 && s.board.every((v) => v === 0);
  if (pc) gained += SCORE_PC * s.level;
  s.score += gained;
  s.lines += cleared;
  s.level = 1 + Math.floor(s.lines / 10);

  // 공격 산출 → 대기 쓰레기 상쇄(캔슬) → 실제 공격
  let attack = 0;
  if (cleared > 0) {
    attack = tspin === "full" ? ATK_TSPIN[cleared] : tspin === "mini" ? 0 : ATK_NORMAL[cleared];
    if (b2bApplied) attack += 1;
    attack += ATK_COMBO[Math.min(Math.max(s.combo, 0), ATK_COMBO.length - 1)];
    if (pc) attack += ATK_PC;
  }
  const cancel = Math.min(s.pending, attack);
  s.pending -= cancel;
  attack -= cancel;

  // 남은 대기 쓰레기 유입(한 번에 GARBAGE_PER_LOCK 줄까지, 배치당 같은 구멍)
  let garbageIn = 0;
  if (s.pending > 0) {
    garbageIn = Math.min(s.pending, GARBAGE_PER_LOCK);
    s.pending -= garbageIn;
    const [r, next] = rngNext(s.rng);
    s.rng = next;
    const hole = Math.floor(r * T_COLS);
    // 보드를 garbageIn 줄 위로 밀고 바닥에 쓰레기 줄 삽입
    s.board.copyWithin(0, garbageIn * T_COLS);
    for (let gy = T_TOTAL - garbageIn; gy < T_TOTAL; gy++) {
      for (let x = 0; x < T_COLS; x++) s.board[idx(x, gy)] = x === hole ? 0 : GARBAGE_CELL;
    }
  }

  s.last = {
    cleared,
    attack,
    tspin,
    b2b: b2bApplied,
    combo: cleared > 0 ? s.combo : -1,
    pc,
    rows,
    garbageIn,
  };

  if (lockOut) {
    s.over = true;
    s.kind = -1;
    return s;
  }
  s.canHold = true;
  spawn(s); // 스폰 막히면 over(블록 아웃)
  return s;
}

/* ---------- 파생/헬퍼 ---------- */

/** 레벨별 중력 간격(ms) — 부드러운 지수 감소, 하한 70ms. */
export function gravityMs(level: number): number {
  return Math.max(70, Math.round(800 * Math.pow(0.82, level - 1)));
}

export const LOCK_DELAY_MS = 500; // 접지 후 고정 유예
export const LOCK_RESETS_MAX = 15; // 이동/회전으로 유예 리셋 가능 횟수(무한 스톨 방지)

/** 보이는 20행(렌더/전송용) — 숨김 행 제외. */
export function visibleBoard(s: TetrisState): number[] {
  return s.board.slice(T_HIDDEN * T_COLS);
}

/** 실시간 대결 스냅샷 인코딩: 보이는 200칸을 '0'~'8' 문자열로. */
export function encodeBoard(s: TetrisState): string {
  let out = "";
  const v = visibleBoard(s);
  for (let i = 0; i < v.length; i++) out += v[i];
  return out;
}

/** 스냅샷 디코딩(길이/문자 검증 — 채널 수신값이라 방어적). 실패 시 null. */
export function decodeBoard(str: string): number[] | null {
  if (typeof str !== "string" || str.length !== T_ROWS * T_COLS) return null;
  const out = new Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i) - 48;
    if (c < 0 || c > 8) return null;
    out[i] = c;
  }
  return out;
}

/** 울트라(점수 대결) 제한시간. */
export const ULTRA_SECONDS = 120;

/** 조각 미노 좌표(렌더/미리보기용 읽기 전용). rot 기본 0(스폰 방향). */
export function minosOf(kind: number, rot: 0 | 1 | 2 | 3 = 0): ReadonlyArray<readonly number[]> {
  return MINOS[kind][rot];
}

/** 이벤트 라벨(이펙트 배너용). */
export function clearLabel(e: ClearEvent): string | null {
  if (e.pc) return "퍼펙트 클리어! ✨";
  if (e.tspin === "full") return ["", "T-스핀 싱글!", "T-스핀 더블!!", "T-스핀 트리플!!!"][e.cleared] || null;
  if (e.tspin === "mini" && e.cleared > 0) return "T-스핀 미니";
  if (e.cleared === 4) return e.b2b ? "B2B 테트리스!! 🔥" : "테트리스! 🎉";
  if (e.cleared === 3) return "트리플!";
  if (e.cleared === 2) return "더블!";
  return null;
}
