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
/* 홈 히어로 전용(좁은 대역) — 히어로 무대는 화면 전폭이라 8~92% 로 걸으면 펫이 좌우 끝의
   월드 소품(우편함 x≤75px · 표지판 x≥285px) 위를 가로지른다. 가운데에만 머물게 한다. */
export const HERO_MIN_X = 34;
export const HERO_MAX_X = 66;

/** 다음 목적지 x(%) — 현재 위치에서 최소 minGap 이상 떨어진 곳으로. */
export function nextX(
  curX: number,
  r: number,
  minGap = 18,
  lo: number = YARD_MIN_X,
  hi: number = YARD_MAX_X,
): number {
  const gap = Math.min(minGap, (hi - lo) / 2); // 좁은 대역에선 minGap 이 범위를 넘을 수 있다
  let x = lo + r * (hi - lo);
  if (Math.abs(x - curX) < gap) {
    // 너무 가까우면 반대편으로 밀어 확실히 움직이게
    x = curX + (curX < (lo + hi) / 2 ? gap : -gap);
  }
  return Math.min(hi, Math.max(lo, x));
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

/* ── 유휴 연출(하품·기지개·두리번·꼬리흔들기·앉기) ──────────────
 * '아무것도 안 할 때도 뭔가 하고 있다'가 살아있다는 인상의 8할.
 * 카운터(n) 기반 결정적 순환 + 기분 가중 — 테스트 가능. */
export type PetIdle = "yawn" | "stretch" | "look" | "tailwag" | "sit";
export function idleFor(v: PetVibe, n: number): PetIdle {
  if (v === "sick") return "look"; // 아프면 힘없이 두리번만
  const pool: PetIdle[] =
    v === "sleepy"
      ? ["yawn", "sit", "yawn", "look"]
      : v === "happy"
        ? ["tailwag", "stretch", "look", "tailwag"]
        : v === "hungry"
          ? ["look", "yawn", "sit", "look"]
          : ["look", "stretch", "yawn", "tailwag", "sit"];
  return pool[((n % pool.length) + pool.length) % pool.length];
}
/** 유휴 애니 지속(ms) — CSS keyframe 길이와 일치시켜 종료 후 숨쉬기(bob)로 복귀. */
export const IDLE_MS: Record<PetIdle, number> = {
  yawn: 1500,
  stretch: 1200,
  look: 1800,
  tailwag: 1400,
  sit: 1600,
};

/* ── 홈 캐릭터 탭 반응(콤보) ────────────────────────────────────
 * [사용자 피드백 2026-08-04] "픽셀 캐릭터 터치했을 때 더 과격하고 다양한 이벤트"
 *
 * 예전 홈 탭은 어떤 상황에서도 **squish-1 + 깡총 + 하트 3개**로 항상 같았다. 반응이
 * 한 가지면 두 번째 탭부터는 눌러도 아무 일이 안 일어나는 것처럼 느껴진다.
 * → 연타를 누적(콤보)해 단계가 오르고, 단계마다 동작·파티클·진동·화면흔들림이 커진다.
 *
 * ⚠ 회전 금지 — 도트를 rotate 하면 픽셀 격자가 깨진다(README §14.5). 과격함은
 *   스쿼시(scale)·점프(translate)·파티클 수·흔들림으로만 만든다.
 */
export const TAP_COMBO_MS = 1150; // 손가락을 잠깐 떼도 리듬이 이어지게 — 최고 연출 진입 장벽 완화
export const TAP_COMBO_MAX = 12; // 그 이상은 같은 최고 단계(무한 인플레 방지)

export type TapReaction = {
  tier: 1 | 2 | 3 | 4;
  /** 펫에 걸 애니 클래스 접미사 — `animate-pet-${anim}` */
  anim: string;
  particle: string;
  count: number; // 파티클 개수
  spread: number; // 좌우 퍼짐(px)
  vibrate: number[]; // 진동 패턴
  shake: boolean; // 무대 흔들림
  ring: boolean; // 충격파 링
  cry: string | null; // 짧은 외침(무대 안쪽에 렌더)
};

/** 단계별 동작 풀 — 같은 단계에서도 매번 다른 게 나와야 '다양하다'가 된다. */
const TAP_ANIM: Record<1 | 2 | 3 | 4, readonly string[]> = {
  1: ["squish-1", "spring"],
  2: ["squish-2", "bounce", "wiggle", "skitter"],
  3: ["joy", "dash", "ricochet"],
  4: ["blast", "meteor", "hyper-hop"],
};
/** 단계가 오를수록 굵은 파티클 — 기분색(tapParticle)에 축포를 섞는다. */
const TAP_EXTRA: Record<1 | 2 | 3 | 4, readonly string[]> = {
  1: [],
  2: ["✨"],
  3: ["✨", "⭐"],
  4: ["🎉", "💥", "⭐"],
};
/** 연타에 대한 짧은 외침 — 대사(SPEECH)와 달리 한두 글자로 즉각적이다. */
const CRY: Record<PetVibe, readonly string[]> = {
  sick: ["으윽", "콜록"],
  sleepy: ["음냐", "졸려…"],
  hungry: ["밥!", "배고파!"],
  sad: ["흥!", "…뭐"],
  happy: ["와!", "헤헤", "또!", "꺄악"],
  ok: ["앗!", "히힛", "우와", "또?"],
};

/** 연타 수 → 단계. 1~2 / 3~4 / 5~7 / 8+ */
export function tapTier(combo: number): 1 | 2 | 3 | 4 {
  if (combo >= 8) return 4;
  if (combo >= 5) return 3;
  if (combo >= 3) return 2;
  return 1;
}

/**
 * 탭 반응 — (기분, 콤보, r) 의 순수 함수. r 은 0~1 결정적 선택자.
 * 같은 입력이면 같은 반응이라 테스트할 수 있다.
 */
/* ── 캔버스 무대의 점프(히어로만 움직인다) ──────────────────────
 * [사용자 피드백 2026-08-05]
 *   "히어로 터치하면 히어로만 움직이는게 아니고 네모 픽셀 자체가 움직여"
 *   "연속 터치한 횟수에 따라서 점프 강도가 더 올라갔으면"
 *
 * 왜 CSS 로 못 하나: 섬 무대는 하늘·잔디·나무·펫을 **한 장의 캔버스**에 찍는다.
 * 래퍼에 transform 을 걸면 그림 전체(=네모)가 통째로 움직인다. 히어로만 움직이려면
 * 캔버스 **안에서** 스프라이트 좌표를 옮겨야 한다 → 이 함수가 그 오프셋을 준다.
 *
 * ⚠ 반환값은 전부 **정수 논리 픽셀**이다. 도트가 반픽셀에 앉으면 뭉개진다(README §14.5).
 *   같은 이유로 회전·비정수 스케일은 쓰지 않는다. 세기는 **높이와 체공 시간**으로 낸다.
 */

/** 점프 높이 상한(논리 px). 펫 머리 위 여유(GROUND_Y 84 − 스프라이트 48 ≒ 36)를 넘지 않는다. */
export const TAP_HOP_MAX_PX = 34;
/** 착지 후 1px 가라앉아 있는 시간 — '쿵' 하는 무게감. */
export const TAP_LAND_MS = 90;

/** 연타 수 → 점프 높이(논리 px). 단계가 아니라 **연속**으로 오른다. */
export function hopHeight(combo: number): number {
  const n = Math.min(Math.max(Math.floor(combo) || 1, 1), TAP_COMBO_MAX);
  return Math.min(TAP_HOP_MAX_PX, 5 + Math.round((n - 1) * 2.7));
}

/** 점프 지속(ms) — 높이 뛸수록 오래 떠 있어야 무게가 맞는다. */
export function hopMs(combo: number): number {
  return 300 + hopHeight(combo) * 6;
}

/** 정수 픽셀로 반올림 + **-0 제거**.
 *  Math.round(-0.2) 는 -0 을 준다. -0 은 화면에선 0 과 같지만 Object.is(-0, 0) 이 false 라
 *  비교·테스트·스냅샷에서 조용히 새어나간다. 격자 좌표는 항상 0 으로 정규화한다. */
const px0 = (v: number): number => {
  const n = Math.round(v);
  return n === 0 ? 0 : n;
};

/** (콤보, 탭 후 경과ms) → 스프라이트 오프셋. 범위 밖이면 {0,0}. */
export function tapHop(combo: number, elapsed: number): { dx: number; dy: number } {
  const h = hopHeight(combo);
  const dur = hopMs(combo);
  if (!(elapsed >= 0) || elapsed > dur + TAP_LAND_MS) return { dx: 0, dy: 0 };
  if (elapsed > dur) return { dx: 0, dy: 1 }; // 착지 충격 — 1px 가라앉는다
  const p = elapsed / dur;
  const up = 4 * p * (1 - p); // 포물선 0 → 1 → 0
  // 콤보가 높으면 공중에서 좌우로 흔들린다(정수 px — 격자 유지)
  const swayAmp = combo >= 8 ? 3 : combo >= 5 ? 2 : 0;
  return {
    dx: swayAmp ? px0(Math.sin(p * Math.PI * 2) * swayAmp) : 0,
    dy: px0(-h * up),
  };
}

/* 홈(DOM 무대)의 점프 높이. 홈은 캔버스가 아니라 펫 엘리먼트만 감싼 span 이 움직이므로
 * 처음부터 '히어로만' 움직인다 — 문제는 높이가 **단계별 고정값**이라 연타해도 안 커진 것.
 * CSS 키프레임에 var(--pet-hop) 을 넣고 이 함수가 그 값을 준다.
 * ⚠ 상한 46px 은 임의값이 아니라 히어로 무대에서 실측된 여유다. 올리려면 무대부터 다시 재라. */
export const HOME_HOP_MIN = 10;
export const HOME_HOP_MAX = 46;
export function homeHopPx(combo: number): number {
  const n = Math.min(Math.max(Math.floor(combo) || 1, 1), TAP_COMBO_MAX);
  return Math.min(HOME_HOP_MAX, Math.round(HOME_HOP_MIN + (n - 1) * 3.4));
}

/** 공중에 뜬 정도 0~1 — 그림자를 좁히는 데 쓴다(발밑이 붙어 있으면 점프로 안 보인다). */
export function hopLift(combo: number, elapsed: number): number {
  const h = hopHeight(combo);
  return h > 0 ? Math.min(1, Math.max(0, -tapHop(combo, elapsed).dy / h)) : 0;
}

export function tapReaction(v: PetVibe, combo: number, r: number): TapReaction {
  const tier = tapTier(Math.min(combo, TAP_COMBO_MAX));
  const pool = TAP_ANIM[tier];
  const pick = <T,>(list: readonly T[]): T =>
    list[Math.min(list.length - 1, Math.max(0, Math.floor(r * list.length)))];
  const extras = TAP_EXTRA[tier];
  // 파티클은 기분색이 기본, 단계가 오르면 축포가 섞인다(단계가 눈으로 구분돼야 한다)
  const particle = extras.length && r > 0.45 ? pick(extras) : tapParticle(v);
  return {
    tier,
    anim: pick(pool),
    particle,
    count: [4, 8, 12, 18][tier - 1],
    spread: [20, 36, 54, 76][tier - 1],
    vibrate: [[10], [18], [14, 32, 20], [22, 34, 18, 34, 30]][tier - 1],
    shake: tier >= 3,
    ring: tier >= 3,
    cry: tier >= 2 ? pick(CRY[v]) : null,
  };
}
