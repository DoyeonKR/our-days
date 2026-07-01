// 커플 D-day 핵심 날짜 로직 (순수 함수 — UI/스토리지와 분리해 테스트 쉽게).
// 한국식 '며칠째' 규칙: 사귄 당일이 1일째다 (start == today → 1일).

export type EventCategory = "anniversary" | "plan";

export type CoupleEvent = {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  repeatYearly: boolean;
  emoji?: string;
  category?: EventCategory; // 'anniversary'=노란 기념일, 'plan'=작성자색 일정
  createdBy?: string; // 작성자 user id (커플 공유 시). 로컬 일정은 없음.
};

/**
 * 기념일(노란색) 여부. category 가 있으면 그걸 따르고, 없으면(구버전/로컬 데이터)
 * '매년 반복'을 기념일로 간주 — 예전엔 반복 체크가 곧 생일·기념일이었기 때문.
 */
export function isAnniversary(e: CoupleEvent): boolean {
  return e.category ? e.category === "anniversary" : !!e.repeatYearly;
}

const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' 를 로컬 자정 Date 로 파싱 (타임존 오프셋 버그 회피). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 해당 연/월(monthIndex 0~11)의 일수. 윤년 2월 등 정확. */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 오늘(로컬 자정). */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** a→b 까지의 온전한 일수 (b-a). 둘 다 로컬 자정으로 정규화. */
export function diffDays(a: Date, b: Date): number {
  const am = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bm = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bm - am) / MS_PER_DAY);
}

/** 사귄 날을 1일째로 세는 한국식 '며칠째'. start==today → 1. */
export function daysTogether(start: Date, ref: Date = today()): number {
  return diffDays(start, ref) + 1;
}

/** N일째가 되는 날짜 (N일째 = start + (N-1)일). */
export function dayCountToDate(start: Date, n: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + (n - 1));
  return d;
}

/**
 * 특정 연도의 '같은 월/일' 날짜. 2/29 처럼 그 해에 없는 날짜는 그 달 마지막 날로 clamp.
 * (평년의 2/29 → 2/28. JS 기본 동작인 '3/1 로 넘침'을 막는다.)
 */
function yearlyOn(year: number, base: Date): Date {
  const d = new Date(year, base.getMonth(), base.getDate());
  if (d.getMonth() !== base.getMonth()) d.setDate(0); // 달이 넘어갔으면 원래 달 마지막 날로
  return d;
}

/** k주년 날짜 (2/29 시작이면 평년엔 2/28 로 clamp). */
export function anniversaryDate(start: Date, k: number): Date {
  return yearlyOn(start.getFullYear() + k, start);
}

export type Milestone = {
  key: string;
  label: string; // '100일', '1주년'
  date: Date;
  kind: "day" | "year";
};

/**
 * start 기준 '주년' 기념일만 생성 (날짜순). 100일·200일 등 일수 기념일은 자동 생성하지 않음
 * (사용자 요청: 주년만). 100일 등이 필요하면 커스텀 기념일로 직접 추가.
 */
export function generateMilestones(
  start: Date,
  opts: { maxYears?: number } = {},
): Milestone[] {
  const maxYears = opts.maxYears ?? 50;
  const out: Milestone[] = [];
  for (let k = 1; k <= maxYears; k += 1) {
    out.push({
      key: `y${k}`,
      label: `${k}주년`,
      date: anniversaryDate(start, k),
      kind: "year",
    });
  }
  return out;
}

/** D-day 라벨: 오늘=D-DAY, 미래=D-n, 지난날=D+n. */
export function ddayLabel(target: Date, ref: Date = today()): string {
  const n = diffDays(ref, target);
  if (n === 0) return "D-DAY";
  if (n > 0) return `D-${n}`;
  return `D+${-n}`;
}

/** 다가오는 기념일 (오늘 포함) 상위 count개. */
export function upcomingMilestones(start: Date, count = 6, ref: Date = today()): Milestone[] {
  return generateMilestones(start)
    .filter((m) => diffDays(ref, m.date) >= 0)
    .slice(0, count);
}

/** 반복 이벤트의 다음 발생일 (올해 이미 지났으면 내년). 비반복은 원 날짜 그대로. */
export function nextOccurrence(ev: CoupleEvent, ref: Date = today()): Date {
  const base = parseDate(ev.date);
  if (!ev.repeatYearly) return base;
  // 각 연도마다 base 의 월/일로 새로 계산 (2/29 는 yearlyOn 이 해마다 알맞게 clamp)
  let cand = yearlyOn(ref.getFullYear(), base);
  if (diffDays(ref, cand) < 0) cand = yearlyOn(ref.getFullYear() + 1, base);
  return cand;
}
