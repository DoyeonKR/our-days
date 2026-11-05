// 커플 D-day 핵심 날짜 로직 (순수 함수 — UI/스토리지와 분리해 테스트 쉽게).
// 한국식 '며칠째' 규칙: 사귄 당일이 1일째다 (start == today → 1일).

export type EventCategory = "anniversary" | "plan";
export type EventRecurrence = "none" | "monthly" | "yearly";

export type CoupleEvent = {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  repeatYearly: boolean;
  recurrence?: EventRecurrence;
  emoji?: string;
  category?: EventCategory; // 'anniversary'=노란 기념일, 'plan'=작성자색 일정
  createdBy?: string; // 작성자 user id (커플 공유 시). 로컬 일정은 없음.
  note?: string;
  reminderOffsets?: number[];
  /** 'HH:MM'(24시간). 없으면 종일 — 옛 저장분 · 옛 앱이 만든 일정은 전부 종일이다(2026-10-30). */
  time?: string;
  /** 여러 날 일정의 끝나는 날('YYYY-MM-DD', 시작일 다음 날 이후). 없으면 하루짜리 — 옛 행 · 옛 앱(2026-11-05). */
  endDate?: string;
  /** '이번만 건너뛰기'한 회차의 시작일들. 반복 일정에만 뜻이 있다(2026-11-05). */
  skipDates?: string[];
  /** 서버 행의 updated_at — 편집 저장 때 이 값이 그대로일 때만 덮는다(상대가 그사이 바꿨으면 충돌). 로컬 일정엔 없다. */
  updatedAt?: string;
};

/** 여러 날 일정의 최대 길이(시작일 뒤로 며칠) — 알림 함수(reminders.ts)와 같은 값. */
export const MAX_EVENT_SPAN_DAYS = 90;

/** 'HH:MM' 만 받아 준다(입력·서버 값 정규화). 그 밖은 종일(undefined). */
export function normalizeEventTime(t: string | null | undefined): string | undefined {
  return t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : undefined;
}

/** "오후 7:30" — 화면 표기. */
export function eventTimeLabel(t: string | undefined): string {
  const v = normalizeEventTime(t);
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
}

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

/** 특정 연월의 같은 일자. 31일처럼 없는 날은 그 달 마지막 날로 clamp. */
function monthlyOn(year: number, monthIndex: number, base: Date): Date {
  return new Date(year, monthIndex, Math.min(base.getDate(), daysInMonth(year, monthIndex)));
}

export function eventRecurrence(ev: CoupleEvent): EventRecurrence {
  return ev.recurrence ?? (ev.repeatYearly ? "yearly" : "none");
}

/** 시작일 뒤로 며칠 더 이어지나(0 = 하루짜리). 끝나는 날이 시작일 이전이거나 형식이 틀리면 0, 상한은 MAX_EVENT_SPAN_DAYS. */
export function eventSpanDays(ev: Pick<CoupleEvent, "date" | "endDate">): number {
  if (!ev.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(ev.endDate)) return 0;
  const n = diffDays(parseDate(ev.date), parseDate(ev.endDate));
  return n > 0 ? Math.min(n, MAX_EVENT_SPAN_DAYS) : 0;
}

/** 저장 뒤 서버 행이 사용자가 편집한 모든 필드를 보존했는지 확인한다. */
export function eventContentMatches(actual: CoupleEvent, expected: CoupleEvent): boolean {
  const offsets = (event: CoupleEvent) =>
    [...(event.reminderOffsets ?? [0, 1, 3, 7])].sort((a, b) => a - b).join(",");
  return (
    actual.title === expected.title &&
    actual.date === expected.date &&
    eventRecurrence(actual) === eventRecurrence(expected) &&
    (actual.emoji ?? "") === (expected.emoji ?? "") &&
    (actual.category ?? "plan") === (expected.category ?? "plan") &&
    (actual.note ?? "").trim() === (expected.note ?? "").trim() &&
    offsets(actual) === offsets(expected) &&
    (normalizeEventTime(actual.time) ?? "") === (normalizeEventTime(expected.time) ?? "") &&
    eventSpanDays(actual) === eventSpanDays(expected) &&
    [...(actual.skipDates ?? [])].sort().join(",") === [...(expected.skipDates ?? [])].sort().join(",")
  );
}

/** 복원한 편집 초안을 써도 되나 — 초안을 만든 뒤 서버 행이 바뀌었으면(상대가 고쳤으면) 버린다.
 *  새 일정 · 로컬 일정(updatedAt 없음)은 쓰는 사람이 하나라 그대로 쓴다. 옛 초안(base 없음)은 비교할 수 없어 버린다. */
export function editDraftFresh(draftBase: string | undefined, serverUpdatedAt: string | undefined): boolean {
  if (serverUpdatedAt === undefined) return true;
  return draftBase === serverUpdatedAt;
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

/** 반복 이벤트의 다음 발생일 (올해 이미 지났으면 내년). 비반복은 원 날짜 그대로.
 *  '이번만 건너뛰기'한 회차는 건너뛴다 — 건너뛴 날은 목록 · 홈 · 알림 어디에도 안 뜬다. */
export function nextOccurrence(ev: CoupleEvent, ref: Date = today()): Date {
  const skips = ev.skipDates?.length && eventRecurrence(ev) !== "none" ? new Set(ev.skipDates) : null;
  let occ = rawNextOccurrence(ev, ref);
  for (let i = 0; skips && i < 400 && skips.has(toISODate(occ)); i += 1) {
    occ = rawNextOccurrence(ev, new Date(occ.getFullYear(), occ.getMonth(), occ.getDate() + 1));
  }
  return occ;
}

/** 여러 날 일정이 오늘 이어지는 중이면(시작일은 지났고 끝나는 날은 아직) 그 회차의 시작일, 아니면 null. */
export function ongoingOccurrence(ev: CoupleEvent, ref: Date = today()): Date | null {
  const span = eventSpanDays(ev);
  if (!span) return null;
  const from = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - span);
  const start = nextOccurrence(ev, from);
  const d = diffDays(start, ref);
  return d > 0 && d <= span ? start : null;
}

/** 이 달에 일정이 걸린 날들 — 여러 날 일정은 이어지는 날마다, 건너뛴 회차는 빼고.
 *  start = 그 회차의 시작일(건너뛰기 · 편집이 회차를 가리킬 때 쓴다), first = 시작일 칸인가. */
export function eventDaysInMonth(
  ev: CoupleEvent,
  year: number,
  monthIndex: number,
): { day: number; start: string; first: boolean }[] {
  const base = parseDate(ev.date);
  const recurrence = eventRecurrence(ev);
  const span = eventSpanDays(ev);
  const skips = new Set(recurrence === "none" ? [] : ev.skipDates ?? []);
  const starts: Date[] = [];
  if (recurrence === "none") starts.push(base);
  else if (recurrence === "yearly") for (const y of [year - 1, year]) starts.push(yearlyOn(y, base));
  else {
    const back = Math.ceil(span / 28) + 1; // 길게 이어지는 매월 일정은 지난달 회차가 이 달까지 닿는다
    for (let k = back; k >= 0; k -= 1) {
      const m = new Date(year, monthIndex - k, 1);
      starts.push(monthlyOn(m.getFullYear(), m.getMonth(), base));
    }
  }
  const out: { day: number; start: string; first: boolean }[] = [];
  const seen = new Set<number>();
  for (const s of starts) {
    if (diffDays(base, s) < 0) continue;
    const iso = toISODate(s);
    if (skips.has(iso)) continue;
    for (let d = 0; d <= span; d += 1) {
      const day = new Date(s.getFullYear(), s.getMonth(), s.getDate() + d);
      if (day.getFullYear() !== year || day.getMonth() !== monthIndex || seen.has(day.getDate())) continue;
      seen.add(day.getDate());
      out.push({ day: day.getDate(), start: iso, first: d === 0 });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}

function rawNextOccurrence(ev: CoupleEvent, ref: Date): Date {
  const base = parseDate(ev.date);
  const recurrence = eventRecurrence(ev);
  if (recurrence === "none") return base;
  if (recurrence === "monthly") {
    let cand = monthlyOn(ref.getFullYear(), ref.getMonth(), base);
    if (diffDays(ref, cand) < 0) {
      const nextMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      cand = monthlyOn(nextMonth.getFullYear(), nextMonth.getMonth(), base);
    }
    // 반복 시작일보다 앞선 기준일이어도 첫 발생은 원래 입력일이다.
    return diffDays(base, cand) < 0 ? base : cand;
  }
  // 각 연도마다 base 의 월/일로 새로 계산 (2/29 는 yearlyOn 이 해마다 알맞게 clamp)
  let cand = yearlyOn(ref.getFullYear(), base);
  if (diffDays(ref, cand) < 0) cand = yearlyOn(ref.getFullYear() + 1, base);
  return diffDays(base, cand) < 0 ? base : cand;
}

/** 캘린더의 특정 월에 이 이벤트가 발생하면 날짜, 아니면 null. */
export function eventOccurrenceInMonth(
  ev: CoupleEvent,
  year: number,
  monthIndex: number,
): Date | null {
  const base = parseDate(ev.date);
  const recurrence = eventRecurrence(ev);
  let occurrence: Date;
  if (recurrence === "yearly") occurrence = yearlyOn(year, base);
  else if (recurrence === "monthly") occurrence = monthlyOn(year, monthIndex, base);
  else occurrence = base;
  if (diffDays(base, occurrence) < 0) return null;
  return occurrence.getFullYear() === year && occurrence.getMonth() === monthIndex
    ? occurrence
    : null;
}
