// 커플 D-day 핵심 날짜 로직 (순수 함수 — UI/스토리지와 분리해 테스트 쉽게).
// 한국식 '며칠째' 규칙: 사귄 당일이 1일째다 (start == today → 1일).

export type CoupleEvent = {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  repeatYearly: boolean;
  emoji?: string;
};

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

/** k주년 날짜. */
export function anniversaryDate(start: Date, k: number): Date {
  const d = new Date(start);
  d.setFullYear(d.getFullYear() + k);
  return d;
}

export type Milestone = {
  key: string;
  label: string; // '100일', '1주년'
  date: Date;
  kind: "day" | "year";
};

/**
 * start 기준 100일 단위 + 주년 기념일을 모두 만들어 날짜순 정렬.
 * (기본: 10000일까지 100일 단위, 30주년까지)
 */
export function generateMilestones(
  start: Date,
  opts: { maxDays?: number; maxYears?: number } = {},
): Milestone[] {
  const maxDays = opts.maxDays ?? 10_000;
  const maxYears = opts.maxYears ?? 30;
  const out: Milestone[] = [];
  for (let n = 100; n <= maxDays; n += 100) {
    out.push({ key: `d${n}`, label: `${n}일`, date: dayCountToDate(start, n), kind: "day" });
  }
  for (let k = 1; k <= maxYears; k += 1) {
    out.push({ key: `y${k}`, label: `${k}주년`, date: anniversaryDate(start, k), kind: "year" });
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
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
  const cand = new Date(ref.getFullYear(), base.getMonth(), base.getDate());
  if (diffDays(ref, cand) < 0) cand.setFullYear(cand.getFullYear() + 1);
  return cand;
}
