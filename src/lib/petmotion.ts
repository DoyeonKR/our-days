// 펫 모션/반응 순수 로직 — 기분 판정·거동 파라미터·대사·이동 목적지·쓰다듬기 게이지.
// UI 와 분리해 결정적으로 테스트한다(랜덤은 호출부가 r:0~1 을 주입).
// ⚠ 여기엔 DOM/React 의존이 없어야 한다(다른 순수 모듈과 동일 규칙).

export type PetVibe = "sick" | "sleepy" | "hungry" | "sad" | "happy" | "ok";

export type PetStatsLike = {
  hunger: number;
  happy: number;
  energy: number;
  clean: number;
  health: number;
};

/** 현재 스탯 → 거동을 결정하는 '기분'. 우선순위: 아픔 > 졸림 > 배고픔 > 슬픔 > 행복 > 보통. */
export function vibeOf(stats: PetStatsLike, sick: boolean): PetVibe {
  if (sick) return "sick";
  if (stats.energy < 25) return "sleepy";
  if (stats.hunger < 25) return "hungry";
  if (stats.happy < 30) return "sad";
  if (stats.happy >= 70) return "happy";
  return "ok";
}

export type Motion = {
  wander: boolean; // 돌아다니는지
  walkMs: number; // 한 구간 이동에 걸리는 시간(느릴수록 축 처짐)
  pauseMin: number; // 멈춰 있는 최소/최대 시간
  pauseMax: number;
  bobMs: number; // 숨쉬기(까딱) 주기 — 짧을수록 활발
  hopChance: number; // 멈출 때 깡총 뛸 확률 0~1
  jitter: boolean; // 떨림(아플 때)
  emote: string | null; // 상시 표시 이모트
};

/** 기분별 거동 파라미터. */
export function motionFor(v: PetVibe): Motion {
  switch (v) {
    case "sick":
      return { wander: false, walkMs: 5200, pauseMin: 2600, pauseMax: 4200, bobMs: 3400, hopChance: 0, jitter: true, emote: "💦" };
    case "sleepy":
      return { wander: false, walkMs: 4800, pauseMin: 3000, pauseMax: 5200, bobMs: 3800, hopChance: 0, jitter: false, emote: "💤" };
    case "hungry":
      return { wander: true, walkMs: 4200, pauseMin: 1800, pauseMax: 3200, bobMs: 2600, hopChance: 0.1, jitter: false, emote: "🍽️" };
    case "sad":
      return { wander: true, walkMs: 4000, pauseMin: 2000, pauseMax: 3400, bobMs: 3000, hopChance: 0.05, jitter: false, emote: null };
    case "happy":
      return { wander: true, walkMs: 2200, pauseMin: 700, pauseMax: 1600, bobMs: 1500, hopChance: 0.55, jitter: false, emote: null };
    default:
      return { wander: true, walkMs: 3000, pauseMin: 1200, pauseMax: 2400, bobMs: 2100, hopChance: 0.25, jitter: false, emote: null };
  }
}

/** 기분별 말풍선 대사 풀. */
export const SPEECH: Record<PetVibe, string[]> = {
  sick: ["끙…", "몸이 안 좋아…", "약 주라…"],
  sleepy: ["졸려…", "조금만 잘게…", "하암…"],
  hungry: ["배고파!", "밥 주라…", "꼬르륵…"],
  sad: ["같이 놀아줘…", "심심해…", "안아줘…"],
  happy: ["헤헷!", "좋아좋아!", "오늘 최고야!", "히히"],
  ok: ["안녕!", "뭐해?", "반가워!", "히힛"],
};

/** 기분에 맞는 대사 하나(r: 0~1 결정적 선택). */
export function speechFor(v: PetVibe, r: number): string {
  const pool = SPEECH[v];
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(r * pool.length)));
  return pool[i];
}

export const YARD_MIN_X = 8; // 무대 좌우 여백(%)
export const YARD_MAX_X = 92;

/** 다음 목적지 x(%) — 현재 위치에서 최소 minGap 이상 떨어진 곳으로. */
export function nextX(curX: number, r: number, minGap = 18): number {
  const span = YARD_MAX_X - YARD_MIN_X;
  let x = YARD_MIN_X + r * span;
  if (Math.abs(x - curX) < minGap) {
    // 너무 가까우면 반대편으로 밀어 확실히 움직이게
    x = curX + (curX < (YARD_MIN_X + YARD_MAX_X) / 2 ? minGap : -minGap);
  }
  return Math.min(YARD_MAX_X, Math.max(YARD_MIN_X, x));
}

/** 쓰다듬기 — 이 횟수를 채우면 실제 '안아주기' 1회가 나간다. */
export const PET_TAPS_FOR_HUG = 5;

/** 탭 누적 → {count, full}. full 이면 호출부가 안아주기를 실행하고 카운트를 리셋한다. */
export function pettingAfterTap(count: number): { count: number; full: boolean } {
  const n = count + 1;
  return n >= PET_TAPS_FOR_HUG ? { count: 0, full: true } : { count: n, full: false };
}

/** 탭 시 튀어나올 파티클 이모지(기분별). */
export function tapParticle(v: PetVibe): string {
  if (v === "sick") return "💦";
  if (v === "sleepy") return "💤";
  if (v === "hungry") return "🍖";
  if (v === "sad") return "💗";
  return "💖";
}
