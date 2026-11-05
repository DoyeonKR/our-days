// 기념일 · 일정 예약 알림의 순수 로직 — daily-reminders(엣지 함수)와 앱(로컬 알림)이 같이 쓴다.
// ⚠ supabase/functions/_shared/reminders.ts 는 이 파일의 글자 하나까지 같은 복사본이다(엣지 함수는 src/ 를 못 불러온다).
//   이 파일을 고치면 복사본도 고치고 daily-reminders 를 다시 배포한다(reminders.test 가 두 파일을 비교한다).
// ⚠ import 를 두지 않는다 — Deno 와 node:test 양쪽에서 그대로 돌아야 한다.
// 날짜는 전부 UTC 자정 Date 로 다룬다(함수는 사용자 시간대의 '오늘'을 UTC 자정으로 만들어 넘긴다).

const MS = 86_400_000;
export const DEFAULT_THRESHOLDS = [0, 1, 3, 7];
/** 여러 날 일정의 최대 길이(시작일 뒤로 며칠) — 화면 · 알림이 같은 상한을 쓴다. */
export const MAX_EVENT_SPAN_DAYS = 90;

export type ReminderEventRow = {
  id?: string | null;
  title: string;
  event_date: string;
  repeat_yearly: boolean;
  recurrence?: "none" | "monthly" | "yearly" | string | null;
  reminder_offsets?: number[] | null;
  category?: string | null;
  event_time?: string | null;
  /** 이번만 건너뛴 회차의 시작일('YYYY-MM-DD'). 옛 행에는 없다. */
  skip_dates?: string[] | null;
  end_date?: string | null;
};

export type Reminder = {
  /** reminder_log 의 r_key — 옛 형식(라벨:일수) 그대로라 배포 당일에도 같은 알림이 두 번 안 나간다. */
  key: string;
  label: string;
  days: number;
  /** 주년 · 기념일이면 true, 일반 일정이면 false — 문구가 다르다("오늘은 1주년!" / "오늘 치과 일정이 있어요"). */
  anniversary: boolean;
  eventId?: string;
  time?: string;
};

export function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function diffDaysUtc(a: Date, b: Date): number {
  return Math.round((utcDate(b).getTime() - utcDate(a).getTime()) / MS);
}
function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}
function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS);
}

function recurrenceOf(e: ReminderEventRow): "none" | "monthly" | "yearly" {
  if (e.recurrence === "monthly" || e.recurrence === "yearly" || e.recurrence === "none") return e.recurrence;
  return e.repeat_yearly ? "yearly" : "none";
}

/** 건너뛰기를 모르는 다음 회차(오늘 포함). 반복 시작일보다 앞서면 시작일. */
function rawOccurrence(e: ReminderEventRow, from: Date): Date {
  const base = new Date(e.event_date + "T00:00:00Z");
  const recurrence = recurrenceOf(e);
  if (recurrence === "none") return base;
  if (recurrence === "monthly") {
    const make = (year: number, month: number) =>
      new Date(Date.UTC(year, month, Math.min(base.getUTCDate(), daysInMonthUtc(year, month))));
    let next = make(from.getUTCFullYear(), from.getUTCMonth());
    if (diffDaysUtc(from, next) < 0) {
      const month = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
      next = make(month.getUTCFullYear(), month.getUTCMonth());
    }
    return next.getTime() < base.getTime() ? base : next;
  }
  const yearly = (year: number) =>
    new Date(Date.UTC(year, base.getUTCMonth(), Math.min(base.getUTCDate(), daysInMonthUtc(year, base.getUTCMonth()))));
  let next = yearly(from.getUTCFullYear());
  if (diffDaysUtc(from, next) < 0) next = yearly(from.getUTCFullYear() + 1);
  return next.getTime() < base.getTime() ? base : next;
}

/** 다음 회차 — '이번만 건너뛰기'한 회차는 건너뛴다(그 회차의 D-7 · D-1 알림도 안 나간다). */
export function occurrence(e: ReminderEventRow, today: Date): Date {
  const skips = new Set(e.skip_dates ?? []);
  let from = utcDate(today);
  let occ = rawOccurrence(e, from);
  if (!skips.size || recurrenceOf(e) === "none") return occ;
  for (let i = 0; i < 400 && skips.has(isoOf(occ)); i += 1) {
    from = addDays(occ, 1);
    occ = rawOccurrence(e, from);
  }
  return occ;
}

function normalizeTime(t: string | null | undefined): string | undefined {
  return t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : undefined;
}
/** "오후 7:30" — 앱의 eventTimeLabel 과 같은 표기(reminders.test 가 맞춰 본다). */
export function reminderTimeLabel(t: string | null | undefined): string {
  const v = normalizeTime(t);
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
}

/** 기념일 여부 — 앱의 isAnniversary 와 같은 규칙(category 가 없으면 '매년 반복'을 기념일로 본다). */
export function rowIsAnniversary(e: ReminderEventRow): boolean {
  return e.category ? e.category === "anniversary" : !!e.repeat_yearly;
}

/** 오늘(사용자 시간대의 날짜를 UTC 자정으로) 보낼 알림들 — 주년(D-7/3/1/당일) + 일정별 알림일. */
export function coupleReminders(startDate: string | null, events: ReminderEventRow[], today: Date): Reminder[] {
  const out: Reminder[] = [];
  const seen = new Set<string>();
  const push = (r: Omit<Reminder, "key">) => {
    const key = r.label + ":" + r.days;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, ...r });
  };
  const day = utcDate(today);
  if (startDate) {
    const start = new Date(startDate + "T00:00:00Z");
    // 주년만 (일수 기념일 100·200일 등은 제외 — 사용자 요청)
    for (let k = 1; k <= 50; k++) {
      const year = start.getUTCFullYear() + k;
      const anniv = new Date(Date.UTC(year, start.getUTCMonth(), Math.min(start.getUTCDate(), daysInMonthUtc(year, start.getUTCMonth()))));
      const du = diffDaysUtc(day, anniv);
      if (DEFAULT_THRESHOLDS.includes(du)) push({ label: `${k}주년`, days: du, anniversary: true });
      if (du > 8) break;
    }
  }
  for (const e of events) {
    const du = diffDaysUtc(day, occurrence(e, day));
    if (!(e.reminder_offsets ?? DEFAULT_THRESHOLDS).includes(du)) continue;
    push({
      label: e.title,
      days: du,
      anniversary: rowIsAnniversary(e),
      ...(e.id ? { eventId: e.id } : {}),
      ...(normalizeTime(e.event_time) ? { time: normalizeTime(e.event_time) } : {}),
    });
  }
  return out.sort((a, b) => a.days - b.days);
}

/** 알림 하나일 때의 문구. 일정은 축하하지 않는다 — 예전엔 치과 예약도 "오늘은 치과! 🎉" 였다. */
export function reminderPhrase(r: Pick<Reminder, "label" | "days" | "anniversary" | "time">): string {
  if (r.anniversary) {
    if (r.days === 0) return `오늘은 ${r.label}! 🎉`;
    if (r.days === 1) return `내일 ${r.label}이에요 💗`;
    return `${r.label} ${r.days}일 전이에요 ✨`;
  }
  const at = reminderTimeLabel(r.time);
  const tail = at ? ` (${at})` : "";
  if (r.days === 0) return `오늘 ${r.label} 일정이 있어요${tail}`;
  if (r.days === 1) return `내일 ${r.label} 일정이 있어요${tail}`;
  return `${r.label} 일정이 ${r.days}일 남았어요`;
}

/** 여러 개를 한 줄로 묶을 때의 짧은 조각 — "오늘은 1주년 · 내일 저녁 예약". */
export function reminderShort(r: Pick<Reminder, "label" | "days" | "anniversary">): string {
  if (r.days === 0) return r.anniversary ? `오늘은 ${r.label}` : `오늘 ${r.label}`;
  if (r.days === 1) return `내일 ${r.label}`;
  return `${r.label} D-${r.days}`;
}

/** 묶음 본문. 하나면 온전한 문장, 여럿이면 가까운 순으로 셋까지 + "외 N개". */
export function reminderBody(rems: readonly Pick<Reminder, "label" | "days" | "anniversary" | "time">[]): string {
  if (rems.length === 0) return "";
  if (rems.length === 1) return reminderPhrase(rems[0]);
  const sorted = [...rems].sort((a, b) => a.days - b.days);
  const shown = sorted.slice(0, 3).map(reminderShort).join(" · ");
  return sorted.length > 3 ? `${shown} 외 ${sorted.length - 3}개` : shown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 누르면 갈 곳 — 계획 › 일정 달력, 가장 가까운 일정이 있는 날로(&f=일정 id). 옛 앱은 f 를 모르고 달력만 연다. */
export function reminderUrl(rems: readonly Pick<Reminder, "days" | "eventId">[]): string {
  const first = [...rems].sort((a, b) => a.days - b.days).find((r) => r.eventId && UUID.test(r.eventId));
  return first ? `./?go=event&f=${first.eventId!.toLowerCase()}` : "./?go=event";
}

/** 저녁 질문 알림 — 상대가 먼저 답했고 나는 아직일 때 한 번. */
export function questionNudgeBody(partnerName: string | null | undefined): string {
  const name = (partnerName ?? "").trim() || "상대";
  return `${name}님이 오늘의 질문에 답했어요. 내 답을 남기면 서로의 답이 열려요`;
}
