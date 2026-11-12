/* 이달의 대회(2026-11-12) — [사용자: "달마다 물고기 한 종을 정해 크기를 겨루고, 1등에게 칭호와 한정 찌를 줍니다"]
 *
 * 순위는 서버(public.fish_month_contest — migrations/20261107080000_fish_month_contest.sql)가 낸다. 여기는 순수 규칙만:
 *   · 그 달의 어종(contestFamily) — 서버의 private.contest_family 와 글자 하나까지 같은 목록 · 공식이다.
 *     해시가 아니라 돌림(월 일련번호 mod 15)인 이유: 정수 계산만이라 서버 · 앱이 똑같이 낸다(hashtext 는 앱이 못 따라 한다),
 *     이웃한 두 달이 같은 어종이 안 되고, 15 는 12 의 약수가 아니라 해마다 같은 달의 어종이 바뀐다.
 *     ⚠ 목록의 순서 · 길이를 바꾸면 모든 달의 어종이 바뀐다 — 새 migration 과 이 파일을 같이, 달이 바뀔 때(fishcontest.test 가 두 목록을 견준다).
 *   · KST 달 경계 — 서버의 '(YYYY-MM-01)::timestamp at time zone Asia/Seoul' 과 같은 순간.
 *   · 1등 상품(칭호 · 한정 찌) 받기 — 지난달 결과에서 서버가 내 줄을 1등이라고 할 때만, 한 달에 한 번.
 *     ⚠ 상품은 앱이 섬 상태(s.fishPlus)에 적는다 — 섬 상태는 앱이 쓰는 값이라 위조를 막지 못한다. 그래서 모습뿐이다(능력치 · 하트 없음).
 *
 * 저장(섬 맨 위 칸 s.fishPlus — fishplus.ts 머리말):
 *   titles — [{ id: "contest:YYYY-MM", who, month, family, text, at }] — 섬은 커플이 같이 쓰므로 누가 받았는지(who) 적는다.
 *   looks.owned — 한정 찌(fishlooks 의 LIMITED_LOOKS) — 산 꾸미기처럼 커플이 같이 갖는다(끼는 건 각자).
 */
import type { IslandState } from "./island.ts";
import type { GearResult } from "./fishing.ts";
import { familyOf } from "./aquarium.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";
import { TROPHY_BOBBER } from "./fishlooks.ts";

/** 대회 어종 — 시작 미끼로 무는 '기본 계열'이고 Lv.12 안의 낚시터에서 나오는 것만(주인 · 깊은 바다 전용 · 미끼 1% 계열 제외).
 *  민물 · 바다 · 관상어가 번갈아 오게 늘어놓았다. 서버 private.contest_family 의 배열과 같은 순서. */
export const CONTEST_FAMILIES: readonly string[] = [
  "crucian", "mackerel", "guppy", "smelt", "flounder", "pale_chub", "tetra", "rockfish",
  "sweetfish", "goldfish", "black_seabream", "chinese_minnow", "betta", "rockfish_bollak", "bullhead",
];

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const isMonth = (m: unknown): m is string => typeof m === "string" && MONTH_RE.test(m);

/** 'YYYY-MM' → 그 달의 어종 key. 나쁜 값은 null(서버와 같다) */
export function contestFamily(month: string): string | null {
  const m = MONTH_RE.exec(month);
  if (!m) return null;
  const idx = (Number(m[1]) * 12 + Number(m[2]) - 1) % CONTEST_FAMILIES.length;
  return CONTEST_FAMILIES[idx];
}

const KST = 9 * 3600_000;
/** 지금(ms)의 KST 달 'YYYY-MM' */
export const kstMonthOf = (now: number) => new Date(now + KST).toISOString().slice(0, 7);
/** 달 더하기 — 'YYYY-MM' ± n */
export function shiftMonth(month: string, n: number): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const k = Number(m[1]) * 12 + Number(m[2]) - 1 + n;
  return `${String(Math.floor(k / 12)).padStart(4, "0")}-${String((k % 12) + 1).padStart(2, "0")}`;
}
/** 그 달의 KST 경계(ms) — [start, end). 서버의 t0 · t1 과 같은 순간 */
export function monthBounds(month: string): { start: number; end: number } {
  const m = MONTH_RE.exec(month);
  if (!m) return { start: NaN, end: NaN };
  const y = Number(m[1]), mo = Number(m[2]) - 1;
  return { start: Date.UTC(y, mo, 1) - KST, end: Date.UTC(y, mo + 1, 1) - KST };
}
/** 이번 달이 끝나기까지 남은 날 — 오늘도 하루로 센다(말일 = 1일 남음) */
export function daysLeft(now: number): number {
  const { end } = monthBounds(kstMonthOf(now));
  return Math.max(1, Math.ceil((end - now) / 86400_000));
}
/** 화면 · 칭호용 '2026.11' */
export const monthLabel = (month: string) => month.replace("-", ".");
export const contestFamilyName = (family: string) => familyOf(family)?.name ?? family;
/** 칭호 글 — "이달의 강태공 (2026.11 우럭)" */
export const titleText = (month: string, family: string) => `이달의 강태공 (${monthLabel(month)} ${contestFamilyName(family)})`;

/** 서버가 돌려주는 한 줄(public.fish_month_contest) */
export type ContestRow = { family: string; rank: number; name: string; cm: number; catch_name: string; caught_at: string; is_me: boolean };

export type ContestTitle = { id: string; who: string; month: string; family: string; text: string; at: number };
const titleId = (month: string) => `contest:${month}`;

/** 받은 칭호 — 모양이 틀린 것은 버린다(읽기만 거른다 — 쓰기는 저장된 그대로에 더한다) */
export function titlesOf(st: Pick<IslandState, "fishPlus">): ContestTitle[] {
  const raw = fishPlusOf(st).titles;
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is ContestTitle => !!t && typeof t === "object"
    && typeof (t as ContestTitle).id === "string" && typeof (t as ContestTitle).who === "string"
    && isMonth((t as ContestTitle).month) && typeof (t as ContestTitle).text === "string");
}
/** 이 사람의 칭호(최근 달 먼저) */
export const myTitles = (st: Pick<IslandState, "fishPlus">, who: string) =>
  titlesOf(st).filter((t) => t.who === who).sort((a, b) => (a.month < b.month ? 1 : -1));
export const claimedMonth = (st: Pick<IslandState, "fishPlus">, month: string) => titlesOf(st).some((t) => t.id === titleId(month));

/** 받을 수 있나 — 끝난 달 · 그 달의 어종 줄 · 서버가 내 줄을 1등이라 함 · 아직 안 받음. 화면은 이게 참일 때만 act 를 부른다
 *  (act 는 거절 사유를 화면에 띄우므로 거절될 걸 부르면 안 된다) */
export function canClaim(st: Pick<IslandState, "fishPlus">, month: string, rows: readonly ContestRow[], now: number): boolean {
  if (!isMonth(month) || month >= kstMonthOf(now)) return false;
  const fam = contestFamily(month);
  const top = rows.find((r) => r.rank === 1);
  return !!fam && !!top && top.is_me && top.family === fam && !claimedMonth(st, month);
}

/** 1등 상품 받기 — 칭호 한 줄 + 한정 찌. 순수. 같은 달을 두 번 받지 않는다(저장 충돌로 act 가 다시 돌려도).
 *  끝나지 않은 달 · 그 달의 어종이 아닌 것은 거절한다(화면 실수로 이번 달 1등을 미리 받지 않게). */
export function claimContest(st: IslandState, who: string, month: string, family: string, now: number): GearResult {
  if (!isMonth(month) || month >= kstMonthOf(now)) return { ok: false, reason: "아직 끝나지 않은 대회예요" };
  if (contestFamily(month) !== family) return { ok: false, reason: "대회 어종이 달라요" };
  if (claimedMonth(st, month)) return { ok: false, reason: "이미 받은 상품이에요" };
  const plus = fishPlusOf(st);
  // 저장된 그대로에 더한다 — 다음 버전이 더한 칸 · 이 번들이 모르는 칭호를 지우지 않게(fishlooks 의 writeLooks 와 같은 규칙)
  const titles = Array.isArray(plus.titles) ? [...plus.titles] : [];
  titles.push({ id: titleId(month), who, month, family, text: titleText(month, family), at: now } satisfies ContestTitle);
  const looks = plus.looks && typeof plus.looks === "object" && !Array.isArray(plus.looks) ? { ...(plus.looks as Record<string, unknown>) } : {};
  const owned = Array.isArray(looks.owned) ? [...looks.owned] : [];
  if (!owned.includes(TROPHY_BOBBER)) owned.push(TROPHY_BOBBER);
  return { ok: true, state: withFishPlus(st, { titles, looks: { ...looks, owned } }) };
}
