// 게임 아케이드 순수 로직 — 채점·승패판정·전적/포인트·결정적 PRNG.
// ⚠ decideWinner 의 승패 방향은 supabase resolve_challenge RPC 와 동일 계약이어야 한다
//   (reaction=낮은 ms 승/15ms 무승부, memory=높은 점수 승/동점 무승부). 한쪽 바꾸면 둘 다.
export type GameKey = "reaction" | "memory";
export type GameResult = "a" | "b" | "draw"; // a=챌린저, b=상대

export const GAMES: {
  key: GameKey;
  label: string;
  emoji: string;
  desc: string;
}[] = [
  { key: "reaction", label: "반응속도", emoji: "⚡", desc: "초록으로 바뀌면 빠르게 탭!" },
  { key: "memory", label: "기억력 카드", emoji: "🃏", desc: "같은 그림을 빠르게 짝맞춰요" },
];

export const WIN_POINTS = 10;
export const DRAW_POINTS = 5;
export const REACTION_DRAW_MS = 15; // 이 이내 차이는 무승부
export const REACTION_FLOOR_MS = 80; // 사람 반응 하한 — 미만은 폴스스타트/봇 처리
export const MEMORY_PAIRS = 6; // 6쌍 = 12장

/** 새 챌린지 seed (32-bit 양수). 브라우저 런타임 전용(비순수) — 컴포넌트 밖 모듈에 둬서
 *  react-hooks/purity 규칙 대상에서 제외. */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
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

/** 승패 방향 — 서버 resolve_challenge 와 동일. a=챌린저 점수, b=상대 점수. */
export function decideWinner(game: GameKey, a: number, b: number): GameResult {
  if (game === "reaction") {
    if (Math.abs(a - b) <= REACTION_DRAW_MS) return "draw";
    return a < b ? "a" : "b"; // 낮은 ms 승
  }
  if (a === b) return "draw";
  return a > b ? "a" : "b"; // 높은 점수 승
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
