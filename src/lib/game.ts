// 게임 아케이드 순수 로직 — 채점·승패판정·전적/포인트·결정적 PRNG.
// ⚠ decideWinner 의 승패 방향은 supabase resolve_challenge RPC 와 동일 계약이어야 한다
//   (reaction=낮은 ms 승/15ms 무승부, memory=높은 점수 승/동점 무승부). 한쪽 바꾸면 둘 다.
export type GameKey = "reaction" | "memory" | "tap" | "order" | "timing";
export type GameResult = "a" | "b" | "draw"; // a=챌린저, b=상대

export const GAMES: {
  key: GameKey;
  label: string;
  emoji: string;
  desc: string;
}[] = [
  { key: "reaction", label: "반응속도", emoji: "⚡", desc: "초록으로 바뀌면 빠르게 탭!" },
  { key: "memory", label: "기억력 카드", emoji: "🃏", desc: "같은 그림을 빠르게 짝맞춰요" },
  { key: "tap", label: "연타 대결", emoji: "👏", desc: "5초 동안 최대한 많이 탭!" },
  { key: "order", label: "숫자 순서", emoji: "🔢", desc: "1부터 순서대로 빠르게 탭" },
  { key: "timing", label: "타이밍 바", emoji: "🎯", desc: "움직이는 바를 정중앙에 멈춰요" },
];

// 승패 방향 — "lower"=낮은 점수 승(시간/거리류), "higher"=높은 점수 승(횟수류).
// ⚠ supabase resolve_challenge RPC 와 반드시 동일해야 한다(한쪽 바꾸면 둘 다).
export const GAME_DIR: Record<GameKey, "lower" | "higher"> = {
  reaction: "lower",
  memory: "higher",
  tap: "higher",
  order: "lower",
  timing: "lower",
};

export const WIN_POINTS = 10;
export const DRAW_POINTS = 5;
// ⚠ 하루 1판 · 1판 = 3라운드(평균 기록). DAILY_MATCHES 는 서버 record_play 의 일일 캡과
//   반드시 동일해야 한다(한쪽 바꾸면 둘 다). 매치가 record_play 를 딱 1번 호출하므로
//   game_daily.plays 는 이제 '판 수'(라운드 수 아님)를 센다.
export const DAILY_MATCHES = 1; // 게임별 하루 1판(00시 KST 초기화)
export const ROUNDS_PER_MATCH = 3; // 1판을 구성하는 라운드 수 — 평균이 기록/승부 점수
// 순위판은 상위 N위만 노출/등록. TOP N 안에 들어야 축하 팝업으로 닉네임·한마디 등록 가능.
export const LEADERBOARD_TOP_N = 5;

/** 순위판 정렬 방향 — lower-better(시간/거리) 게임은 오름차순(작을수록 위). */
export function rankAscending(game: GameKey): boolean {
  return GAME_DIR[game] === "lower";
}

/** 한 판(matchSeed)의 라운드별 시드 — 결정적 파생이라 두 사람이 같은 3라운드를 받는다.
 *  챌린지엔 matchSeed 하나만 저장하고, 양쪽이 이 함수로 동일한 라운드 판을 재현한다. */
export function roundSeeds(
  matchSeed: number,
  rounds: number = ROUNDS_PER_MATCH,
): number[] {
  const rnd = mulberry32(matchSeed);
  return Array.from({ length: rounds }, () => Math.floor(rnd() * 2 ** 31));
}

/** 한 판 점수 = 라운드 점수들의 평균(반올림). 빈 배열은 0.
 *  reactionScore 등 라운드 점수가 이미 방향(높/낮)을 반영하므로 평균도 같은 방향이다. */
export function averageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
}

export type RoundInfo = { index: number; total: number }; // index 1-based

/** 게임 헤더 배지의 라운드 표기(" · 1/3"). round 없으면 빈 문자열. */
export function roundTag(round?: RoundInfo): string {
  return round ? ` · ${round.index}/${round.total}` : "";
}

/** 라운드 제출 버튼 라벨 — 마지막 라운드면 '결과 보기', 아니면 '다음 라운드'.
 *  round 미지정(구 단판 경로)이면 fallback 라벨 유지. */
export function roundSubmitLabel(round: RoundInfo | undefined, fallback: string): string {
  if (!round) return fallback;
  return round.index < round.total ? "다음 라운드 →" : "결과 보기 🏁";
}
export const REACTION_DRAW_MS = 15; // 이 이내 차이는 무승부
export const REACTION_FLOOR_MS = 80; // 사람 반응 하한 — 미만은 폴스스타트/봇 처리
export const MEMORY_PAIRS = 6; // 6쌍 = 12장
// 기억력: 시작 시 모든 카드를 이 시간만큼 공개(외우기) 후 뒤집고 시작. 점수 타이머는 공개가
// 끝나고부터 → 공개시간은 점수 무관. 고정값이라 커플 양쪽 동일(공정).
export const MEMORY_PREVIEW_MS = 3000;
export const TAP_SECONDS = 5; // 연타 제한시간
export const ORDER_N = 16; // 숫자 순서 4×4
export const TIMING_TARGET = 0.5; // 타이밍 바 목표(정중앙)

/** 새 챌린지 seed (32-bit 양수). 브라우저 런타임 전용(비순수) — 컴포넌트 밖 모듈에 둬서
 *  react-hooks/purity 규칙 대상에서 제외. */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** 고해상도 시각(ms). 컴포넌트 밖 모듈이라 react-hooks/purity 대상 아님(이벤트 핸들러 계측용). */
export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** 반응속도 대기시간(ms, 1.2~3.7s) — 매 시도 랜덤. 예전엔 seed 파생이라 두 사람 대기시간이
 *  같았는데, 그러면 (a) 폴스스타트 재시도 때 같은 대기가 반복돼 타이밍을 외우거나
 *  (b) 먼저 한 사람이 상대에게 대기시간을 알려 사전 타이밍 치팅이 가능했다(리뷰 2026-07-06).
 *  대기시간은 반응속도 우열과 무관하므로 랜덤이 오히려 공정하다. 모듈 스코프=purity 규칙 제외. */
export function reactionWaitMs(): number {
  return 1200 + Math.random() * 2500;
}

/** mulberry32 결정적 PRNG — 같은 seed면 두 사람이 같은 카드 배치를 받는다. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 반응속도 점수 = 반응 ms(낮을수록 좋음). 하한 미만/비정상은 최악값(부정). */
export function reactionScore(ms: number): number {
  if (!Number.isFinite(ms) || ms < REACTION_FLOOR_MS) return 9999;
  return Math.round(ms);
}

/** 기억력 점수 = 높을수록 좋음. 빠르고 실수 적을수록 높다(0 하한). */
export function memoryScore(elapsedMs: number, mistakes: number): number {
  const timePenalty = Math.floor(Math.max(0, elapsedMs) / 200); // 0.2초당 -1
  const missPenalty = Math.max(0, Math.floor(mistakes)) * 25;
  return Math.max(0, 1000 - timePenalty - missPenalty);
}

/** 연타 점수 = 5초간 탭 횟수(높을수록 좋음). */
export function tapScore(count: number): number {
  return Math.max(0, Math.floor(count));
}

/** 숫자 순서 점수 = 경과 ms + 오탭 페널티(낮을수록 좋음). */
export function orderScore(elapsedMs: number, mistakes: number): number {
  return Math.round(Math.max(0, elapsedMs)) + Math.max(0, Math.floor(mistakes)) * 2000;
}

/** 타이밍 바 점수 = 목표와의 거리(0~1000, 낮을수록 정확). pos·target 은 0~1. */
export function timingScore(pos: number, target: number): number {
  return Math.round(Math.min(1, Math.abs(pos - target)) * 1000);
}

/** 승패 방향 — 서버 resolve_challenge 와 동일 계약. a=챌린저 점수, b=상대 점수. */
export function decideWinner(game: GameKey, a: number, b: number): GameResult {
  if (game === "reaction" && Math.abs(a - b) <= REACTION_DRAW_MS) return "draw";
  if (a === b) return "draw";
  const aWins = GAME_DIR[game] === "lower" ? a < b : a > b;
  return aWins ? "a" : "b";
}

/** 기억력 카드 배치 — seed 로 결정적 셔플. pairs 쌍 → 2*pairs 카드(값 0..pairs-1 각 2장). */
export function memoryDeck(seed: number, pairs: number = MEMORY_PAIRS): number[] {
  const cards: number[] = [];
  for (let i = 0; i < pairs; i++) cards.push(i, i);
  const rnd = mulberry32(seed);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = cards[i];
    cards[i] = cards[j];
    cards[j] = tmp;
  }
  return cards;
}

/** 숫자 순서 배치 — seed 로 1..n 을 셔플(index=칸 위치, 값=그 칸의 숫자). 두 사람 동일. */
export function orderLayout(seed: number, n: number = ORDER_N): number[] {
  const nums = Array.from({ length: n }, (_, i) => i + 1);
  const rnd = mulberry32(seed);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = nums[i];
    nums[i] = nums[j];
    nums[j] = tmp;
  }
  return nums;
}

/** 타이밍 바 스윕 속도(cycles/sec) — seed 로 두 사람 동일하게 살짝 변주. */
export function timingSpeed(seed: number): number {
  return 1.0 + mulberry32(seed)() * 0.6;
}

export type ChallengeLite = {
  status: "open" | "resolved";
  winner: string | null;
  result: GameResult | null;
};

/** 내 전적/포인트 — resolved 챌린지 집계(커플 2명이라 resolved=양쪽 참여).
 *  포인트 = 승*WIN + 무*DRAW. (지출은 후속 '상점'에서 차감 — v1은 적립만.) */
export function gameRecord(challenges: ChallengeLite[], uid: string | null) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  if (uid) {
    for (const c of challenges) {
      if (c.status !== "resolved") continue;
      if (c.result === "draw") draws++;
      else if (c.winner === uid) wins++;
      else if (c.winner) losses++;
    }
  }
  return { wins, losses, draws, points: wins * WIN_POINTS + draws * DRAW_POINTS };
}
