// 타임캡슐 편지 — 날짜 · 봉인 판정(순수). README §10.26
//
// 날짜는 전부 KST 'YYYY-MM-DD' 문자열이다. 여는 날(open_on)의 KST 0시에 열린다 — 서버 정책
// (time_capsules_select 의 open_on <= KST 오늘)과 같은 기준이라 화면이 '열렸다'고 하면 서버도 본문을 준다.
// 고를 수 있는 날은 내일 ~ 10년 뒤(서버 with check 와 같은 식: today + interval '10 years' — 2/29 는 2/28 로).
// ⚠ 이 파일은 node --test 가 바로 읽는다 — '@/' import · Supabase 를 들이지 않는다.
import { kstDate } from "./kst.ts";

export const CAPSULE_MAX_BODY = 2000;
export const CAPSULE_MAX_YEARS = 10;

const DAY = 86400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function dayNum(iso: string): number {
  const m = ISO.exec(iso)!;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
}
function isoOf(n: number): string {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

/** KST 오늘 — 두 사람이 같은 '오늘'을 본다(기기 시간대와 무관). */
export function capsuleToday(now = Date.now()): string {
  return kstDate(now);
}

export function addDays(iso: string, n: number): string {
  return isoOf(dayNum(iso) + n);
}

/** b - a (일). */
export function daysBetween(a: string, b: string): number {
  return dayNum(b) - dayNum(a);
}

/** 같은 월 · 일의 n년 뒤. 그 해에 없는 날(2/29)은 그 달 마지막 날 — Postgres 의 date + interval 'n years' 와 같다. */
export function addYears(iso: string, years: number): string {
  const m = ISO.exec(iso)!;
  const y = +m[1] + years;
  const mo = +m[2] - 1;
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return isoOf(Math.round(Date.UTC(y, mo, Math.min(+m[3], last)) / DAY));
}

export function capsuleMinDate(today: string): string {
  return addDays(today, 1);
}
export function capsuleMaxDate(today: string): string {
  return addYears(today, CAPSULE_MAX_YEARS);
}

/** 여는 날로 고를 수 있나(내일 ~ 10년 뒤). */
export function validOpenOn(openOn: string, today: string): boolean {
  return isIsoDate(openOn) && openOn >= capsuleMinDate(today) && openOn <= capsuleMaxDate(today);
}

/** 봉인 중인가 — 여는 날의 KST 0시 전. */
export function isSealed(openOn: string, today: string): boolean {
  return openOn > today;
}

/** 다음 주년(사귄 날의 같은 월 · 일, 1주년부터). 오늘이 주년이면 다음 해. */
export function nextAnniversary(start: string, today: string): { years: number; date: string } | null {
  if (!isIsoDate(start)) return null;
  for (let k = 1; k <= 200; k++) {
    const date = addYears(start, k);
    if (date > today) return { years: k, date };
  }
  return null;
}

/** 다음 100일 단위(한국식 — 사귄 날이 1일째). 오늘이 딱 그날이면 다음 100일. */
export function nextHundredDay(start: string, today: string): { days: number; date: string } | null {
  if (!isIsoDate(start)) return null;
  const count = daysBetween(start, today) + 1; // 오늘이 며칠째
  const n = count < 100 ? 100 : (Math.floor(count / 100) + 1) * 100;
  return { days: n, date: addDays(start, n - 1) };
}

export type CapsuleQuickPick = { key: "anniversary" | "hundred" | "year"; label: string; date: string };

/** 빠른 선택 — 다음 주년 · 다음 100일 · 1년 뒤(고를 수 있는 범위 안만, 같은 날은 하나). 사귄 날을 모르면 1년 뒤만. */
export function capsuleQuickPicks(today: string, start: string | null): CapsuleQuickPick[] {
  const out: CapsuleQuickPick[] = [];
  if (start && isIsoDate(start) && start <= today) {
    const a = nextAnniversary(start, today);
    if (a) out.push({ key: "anniversary", label: `${a.years}주년`, date: a.date });
    const h = nextHundredDay(start, today);
    if (h) out.push({ key: "hundred", label: `${h.days.toLocaleString("ko-KR")}일`, date: h.date });
  }
  out.push({ key: "year", label: "1년 뒤", date: addYears(today, 1) });
  const seen = new Set<string>();
  return out.filter((p) => {
    if (!validOpenOn(p.date, today) || seen.has(p.date)) return false;
    seen.add(p.date);
    return true;
  });
}

/** 열릴 때까지 남은 날(오늘 열리면 0, 지났으면 음수). */
export function capsuleDaysLeft(openOn: string, today: string): number {
  return daysBetween(today, openOn);
}

/** 봉인 카드의 D-day 글자. */
export function capsuleDdayLabel(openOn: string, today: string): string {
  const n = capsuleDaysLeft(openOn, today);
  if (n <= 0) return "열렸어요";
  if (n === 1) return "내일 열려요";
  return `D-${n.toLocaleString("ko-KR")}`;
}

/** 서버 시각(ISO)의 KST 날짜 — 0~9시(KST)에 묻은 편지가 하루 이르게 보이지 않게. 못 읽으면 앞 10글자. */
export function capsuleKstDay(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? kstDate(t) : iso.slice(0, 10);
}

/** '2027년 3월 2일' */
export function formatCapsuleDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  const m = ISO.exec(iso)!;
  return `${+m[1]}년 ${+m[2]}월 ${+m[3]}일`;
}

/** 봉인 / 열림 두 묶음 — 봉인은 곧 열릴 것부터, 열림은 최근에 열린 것부터. */
export function splitCapsules<T extends { openOn: string; createdAt: string }>(list: readonly T[], today: string): { sealed: T[]; opened: T[] } {
  const sealed = list.filter((c) => isSealed(c.openOn, today)).sort((a, b) => (a.openOn === b.openOn ? a.createdAt.localeCompare(b.createdAt) : a.openOn < b.openOn ? -1 : 1));
  const opened = list.filter((c) => !isSealed(c.openOn, today)).sort((a, b) => (a.openOn === b.openOn ? b.createdAt.localeCompare(a.createdAt) : a.openOn > b.openOn ? -1 : 1));
  return { sealed, opened };
}

/** 사진 경로 — '{커플}/{쓴 사람}/{편지 id}-{조각}.{확장자}'. 서버 CHECK · 저장소 정책이 앞 두 칸을 본다. */
export function capsulePhotoPath(coupleId: string, userId: string, capsuleId: string, ext: string, nonce: string): string {
  const safeExt = /^(webp|jpg|jpeg|png|gif)$/.test(ext) ? ext : "webp";
  return `${coupleId}/${userId}/${capsuleId}-${nonce.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "p"}.${safeExt}`;
}

/** 본문 검사 — 빈 글 · 2000자 넘는 글은 서버도 거절한다(time_capsules_body_len). */
export function capsuleBodyError(body: string): string | null {
  if (!body.trim()) return "편지 내용을 적어 주세요";
  if ([...body].length > CAPSULE_MAX_BODY) return `편지는 ${CAPSULE_MAX_BODY.toLocaleString("ko-KR")}자까지 쓸 수 있어요`;
  return null;
}
