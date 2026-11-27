/* 홈 감성 이정표 · 시간대 분위기 헬퍼 — 무거운 모듈을 부르지 않는 순수 함수(firstload.test 준수).
 * Don Norman 의 Reflective Level(서사적 정체성)과 Goal-Gradient Effect(다음 100일 이정표 진행률)를
 * 추가 네트워크 요청 없이 이미 있는 nDays · KST 시각만으로 계산한다. */

export type HomeMilestone = {
  /** 직전 기준일(예: 200) */
  prev: number;
  /** 다음 100일 이정표(예: 300) */
  target: number;
  /** 남은 일수(당일이면 0) */
  left: number;
  /** 구간 진행률(0~100 정수) */
  pct: number;
  /** 오늘이 정확히 100일 단위 기념일인가 */
  isToday: boolean;
  /** 화면에 보여 줄 짧은 한 줄 */
  label: string;
};

/** nDays(1일부터 시작) 기준으로 다음 100일 이정표와 진행률을 계산한다. */
export function nextMilestoneOf(nDays: number): HomeMilestone {
  const days = Math.max(1, Math.floor(Number.isFinite(nDays) ? nDays : 1));
  if (days >= 100 && days % 100 === 0) {
    return {
      prev: days - 100,
      target: days,
      left: 0,
      pct: 100,
      isToday: true,
      label: `오늘은 ${days.toLocaleString()}일!`,
    };
  }
  const prev = Math.floor(days / 100) * 100;
  const target = prev + 100;
  const left = target - days;
  const pct = Math.max(2, Math.min(99, Math.round(((days - prev) / 100) * 100)));
  return {
    prev,
    target,
    left,
    pct,
    isToday: false,
    label: `${target.toLocaleString()}일까지 ${left}일`,
  };
}

export type AmbientMood = {
  /** 짧은 시간대 분위기 이름 */
  badge: string;
  /** 시간대 CSS 데이터 키 */
  tone: "dawn" | "morning" | "day" | "golden" | "night";
};

/** KST 시각(0~24) → 홈 상단 앰비언트 분위기(Ambient Awareness — Calm Technology). */
export function ambientMoodOf(kstHour: number): AmbientMood {
  const h = ((Number.isFinite(kstHour) ? kstHour : 12) % 24 + 24) % 24;
  if (h >= 5 && h < 7) return { badge: "여명이 밝아오는 새벽", tone: "dawn" };
  if (h >= 7 && h < 11) return { badge: "햇살 좋은 아침", tone: "morning" };
  if (h >= 11 && h < 16.5) return { badge: "포근한 오후", tone: "day" };
  if (h >= 16.5 && h < 19.5) return { badge: "노을 지는 저녁", tone: "golden" };
  return { badge: "고요한 별빛 밤", tone: "night" };
}
