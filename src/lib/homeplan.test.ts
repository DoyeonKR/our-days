// 홈 · 계획 리뷰 lock (2026-11-05, README §10.12) [사용자: "Fix all"]
// 잠그는 것: 예약 알림 묶음 · 일정 문구 · 장부 되돌리기 · 저녁 질문 알림 · 스트릭 창 · 모닥불 갱신 · 기념일 당일 판정 ·
// 일정 편집 충돌 · 사귄 날 동기화 · 계획 탭 마운트 · 다가오는 목록 · 달력 줄 · 삭제 실패 · 구독 누수 · 질문 회차 조회 ·
// 알림 → 달력 · 이번만 건너뛰기 · 여러 날 일정 · 버킷 이룬 날.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  coupleReminders,
  occurrence,
  questionNudgeBody,
  reminderBody,
  reminderPhrase,
  reminderTimeLabel,
  reminderUrl,
  MAX_EVENT_SPAN_DAYS as SHARED_SPAN,
  type ReminderEventRow,
} from "./reminders.ts";
import { computeStreak, streakAcrossWindows } from "./streak.ts";
import { anniversaryToday, occasionOf } from "./occasion.ts";
import {
  editDraftFresh,
  eventContentMatches,
  eventDaysInMonth,
  eventSpanDays,
  eventTimeLabel,
  MAX_EVENT_SPAN_DAYS,
  nextOccurrence,
  ongoingOccurrence,
  parseDate,
  toISODate,
  type CoupleEvent,
} from "./dday.ts";
import { activityRoute, withFocus } from "./activity.ts";

const root = join(import.meta.dirname, "..", "..");
const raw = (...p: string[]) => readFileSync(join(root, ...p), "utf8").replace(/\r\n/g, "\n");
/** 주석을 지운 소스(README §10.5 — 설명문이 먼저 잡힌다). */
const code = (...p: string[]) =>
  raw(...p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const page = code("src", "app", "page.tsx");
const couple = code("src", "lib", "couple.ts");
const cal = code("src", "components", "Calendar.tsx");
const fn = code("supabase", "functions", "daily-reminders", "index.ts");
const between = (src: string, a: string, b: string) => {
  const i = src.indexOf(a);
  const j = src.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, `구조를 못 찾았다: ${a} → ${b}`);
  return src.slice(i, j);
};
const utc = (iso: string) => new Date(iso + "T00:00:00Z");
const UUID = "0c6b6f3e-8d1a-4b8e-9b55-2f0e8b1c9a11";
const row = (o: Partial<ReminderEventRow>): ReminderEventRow => ({ title: "일정", event_date: "2026-11-05", repeat_yearly: false, recurrence: "none", ...o });

/* ── 1 · 예약 알림: 묶음 · 문구 · 장부 ─────────────────────────────── */

test("#1 같은 날 알림이 여럿이면 전부 — 한 푸시에 가까운 순으로 묶는다", () => {
  const today = utc("2026-11-05");
  const rems = coupleReminders(
    "2025-11-05",
    [row({ id: UUID, title: "저녁 예약", event_date: "2026-11-06" }), row({ title: "치과", event_date: "2026-11-08" })],
    today,
  );
  assert.deepEqual(rems.map((r) => `${r.label}:${r.days}`), ["1주년:0", "저녁 예약:1", "치과:3"], "첫 하나만 남기지 않는다");
  assert.equal(reminderBody(rems), "오늘은 1주년 · 내일 저녁 예약 · 치과 D-3");
  const many = [...rems, { key: "a:7", label: "a", days: 7, anniversary: false }];
  assert.equal(reminderBody(many), "오늘은 1주년 · 내일 저녁 예약 · 치과 D-3 외 1개");
  // 장부 키는 옛 형식(라벨:일수) — 배포 당일 아침(옛 함수) · 저녁(새 함수)이 같은 알림을 두 번 안 보낸다
  assert.deepEqual(rems.map((r) => r.key), ["1주년:0", "저녁 예약:1", "치과:3"]);
});

test("#1 일정은 축하하지 않는다 — '오늘은 치과! 🎉' 대신 일정 문구, 기념일은 그대로", () => {
  assert.equal(reminderPhrase({ label: "치과", days: 0, anniversary: false }), "오늘 치과 일정이 있어요");
  assert.equal(reminderPhrase({ label: "치과", days: 0, anniversary: false, time: "19:30" }), "오늘 치과 일정이 있어요 (오후 7:30)");
  assert.equal(reminderPhrase({ label: "치과", days: 1, anniversary: false }), "내일 치과 일정이 있어요");
  assert.equal(reminderPhrase({ label: "치과", days: 3, anniversary: false }), "치과 일정이 3일 남았어요");
  assert.equal(reminderPhrase({ label: "1주년", days: 0, anniversary: true }), "오늘은 1주년! 🎉");
  assert.doesNotMatch(reminderBody([{ label: "치과", days: 0, anniversary: false }]), /🎉|!/);
  // 기념일 판정은 앱(isAnniversary)과 같은 규칙 — category 가 없으면 '매년 반복'
  const [a, b, c] = [
    row({ title: "생일", category: "anniversary", event_date: "2026-11-05" }),
    row({ title: "옛 생일", category: null, repeat_yearly: true, recurrence: "yearly", event_date: "2020-11-05" }),
    row({ title: "회의", category: "plan", event_date: "2026-11-05" }),
  ];
  assert.deepEqual(coupleReminders(null, [a, b, c], utc("2026-11-05")).map((r) => r.anniversary), [true, true, false]);
  for (const t of ["00:05", "09:00", "12:00", "19:30", "23:59", undefined, "bad"]) assert.equal(reminderTimeLabel(t), eventTimeLabel(t), String(t));
});

test("#1 알림 함수 — 그날 것을 하나씩 장부에 올리고, 일시 오류로 하나도 못 가면 장부를 되돌린다", () => {
  const block = between(fn, "const rems = coupleReminders(", "const q = todaysQuestion(today);");
  assert.doesNotMatch(block, /rems\[0\]/, "첫 하나만 보내던 길이 돌아왔다");
  assert.match(block, /for \(const r of rems\) \{\s*if \(await claim\(sb, typed\.user_id, sentOn, r\.key\)\) claimed\.push\(r\);/);
  assert.match(block, /body: reminderBody\(claimed\)/);
  assert.match(block, /url: reminderUrl\(claimed\)/);
  const deliver = between(fn, "async function deliver(", "async function sendTo(");
  assert.ok(deliver.indexOf("sendTo(") > 0, "장부(claim)는 보내기 전에, 보내기는 deliver 안에서");
  assert.match(deliver, /if \(res\.sent === 0 && res\.transient > 0\) await release\(/, "모든 기기가 일시 오류면 되돌린다");
  assert.match(deliver, /catch \(err\) \{\s*await release\(/, "보내다 던져도 되돌린다");
  assert.match(fn, /from\("reminder_log"\)\.delete\(\)\.eq\("user_id", userId\)\.eq\("sent_on", sentOn\)\.in\("r_key", rKeys\)/);
  assert.match(between(fn, "async function sendTo(", "async function loadEvents("), /\} else \{\s*transient\+\+;/, "만료(404/410)는 일시 오류가 아니다");
  // 앱 로컬 알림도 첫 항목 하나가 아니라 오늘 시작하는 것 전부(이미 알린 key 는 마커로 거른다)
  const local = between(page, "const due = upcoming.filter(", "}, [mounted, notif, upcoming, dayKey, coupleId]);");
  assert.doesNotMatch(page, /upcoming\.find\(\(u\) => u\.days === 0\)/);
  assert.match(local, /reminderBody\(fresh\.map\(/);
});

test("#1 복사본 — 알림 함수의 reminders.ts 는 앱의 것과 글자 하나까지 같다(src/ 를 못 불러온다)", () => {
  assert.equal(raw("supabase", "functions", "_shared", "reminders.ts"), raw("src", "lib", "reminders.ts"));
  assert.doesNotMatch(code("src", "lib", "reminders.ts"), /^\s*import /m, "Deno · node 양쪽에서 돌아야 한다 — import 금지");
  assert.match(fn, /from "\.\.\/_shared\/reminders\.ts"/);
  assert.equal(SHARED_SPAN, MAX_EVENT_SPAN_DAYS, "여러 날 상한이 화면과 알림에서 같다");
});

/* ── 13 · 저녁 질문 알림 ─────────────────────────────────────────── */

test("#13 상대가 먼저 답했고 나는 아직이면 저녁에 한 번 — 설정 · 조용시간 · 장부를 지난다", () => {
  const block = between(fn, "if (hour >= 17", "expireOldLogVideos(sb)");
  assert.match(block, /hour >= 17 && hour < 23 && pref\?\.prefs\?\.question !== false/, "같은 '질문 알림' 설정으로 끈다");
  assert.match(block, /await claim\(sb, typed\.user_id, sentOn, `qnudge:\$\{q\.id\}`\)/, "질문마다 한 번");
  assert.match(block, /url: "\.\/\?go=answer"/);
  assert.match(block, /!mineDone && partnerAnswer/);
  assert.match(block, /QNUDGE_AFTER_MS/, "상대가 막 답했으면(앱이 이미 알렸다) 보내지 않는다");
  assert.match(block, /if \(nudgeError\) throw/);
  // 조용시간 검사가 이 블록보다 먼저(같은 사람 반복 안에서)
  const loop = between(fn, "for (const member of members ?? [])", "if (hour >= 17");
  assert.match(loop, /if \(inQuietHours\(hour, pref\?\.quiet_start, pref\?\.quiet_end\)\) continue;/);
  assert.equal(questionNudgeBody("유진"), "유진님이 오늘의 질문에 답했어요. 내 답을 남기면 서로의 답이 열려요");
  assert.match(questionNudgeBody(null), /^상대님이/);
});

/* ── 2 · 3 · 스트릭 ────────────────────────────────────────────── */

const runOf = (endIso: string, n: number) => {
  const out: string[] = [];
  const d = parseDate(endIso);
  for (let i = 0; i < n; i += 1) {
    out.push(toISODate(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
};
const fakeFetch = (all: string[]) => {
  const calls: [string, string | null][] = [];
  const fetch = async (since: string, before: string | null) => {
    calls.push([since, before]);
    return all.filter((d) => d >= since && (before === null || d < before));
  };
  return { fetch, calls };
};

test("#2 150일 이어진 모닥불은 150 — 90일 창 끝에 닿으면 앞 창을 이어 받는다", async () => {
  const today = "2026-11-05";
  const { fetch, calls } = fakeFetch(runOf(today, 150));
  assert.equal((await streakAcrossWindows(fetch, today, 90)).count, 150);
  assert.equal(calls.length, 2, "창 둘이면 충분하다");
  assert.equal(calls[1][1], calls[0][0], "두 번째 창은 첫 창의 시작 전날까지(겹치지 않게)");
  const long = fakeFetch(runOf(today, 400));
  assert.equal((await streakAcrossWindows(long.fetch, today, 90)).count, 400);
  // 어제까지 이어진 경우도(오늘 아직)
  const y = fakeFetch(runOf("2026-11-04", 120));
  assert.deepEqual(await streakAcrossWindows(y.fetch, today, 90), { count: 120, activeToday: false });
  // 짧으면 한 번만 받는다 · 예전 방식(창 하나)은 91 에서 멈췄다
  const short = fakeFetch(runOf(today, 12));
  assert.equal((await streakAcrossWindows(short.fetch, today, 90)).count, 12);
  assert.equal(short.calls.length, 1);
  assert.ok(computeStreak(runOf(today, 150).filter((d) => d >= "2026-08-07"), today).count < 150, "대조군: 창 하나로는 150 을 못 센다");
});

test("#2 · #3 StreakChip — 창을 이어 세고, 오늘의 우리 진행이 바뀌면 다시 센다", () => {
  const chip = code("src", "components", "StreakChip.tsx");
  assert.match(chip, /streakAcrossWindows\(\(since, before\) => activeDaysSince\(coupleId, since, before\)/);
  assert.match(chip, /\}, \[coupleId, tick, refreshKey\]\);/);
  const hub = code("src", "components", "TodayTogether.tsx");
  assert.match(hub, /const streakKey = `\$\{\+done\.log\}\$\{\+done\.mood\}\$\{\+done\.question\}`;/);
  assert.match(hub, /<StreakChip coupleId=\{coupleId\} refreshKey=\{streakKey\}\/>/);
  const days = between(couple, "export async function activeDaysSince(", "export async function listOnThisDaySnapshot(");
  assert.match(days, /lt\("entry_date", beforeIso\)/);
  assert.match(days, /if \(d\.error\) throw/, "조회 실패를 '기록 없음'으로 삼키지 않는다");
});

/* ── 4 · 기념일 당일 ───────────────────────────────────────────── */

test("#4 하늘의 '오늘이 그날이에요'는 주년 · 기념일만 — 일정 D-DAY 는 아니고 100일 축하를 가리지 않는다", () => {
  const now = Date.UTC(2026, 10, 5, 3);
  assert.equal(anniversaryToday([{ days: 0, anniversary: false }]), false, "치과 예약은 기념일이 아니다");
  assert.equal(anniversaryToday([{ days: 0, anniversary: false }, { days: 0, anniversary: true }]), true, "순서와 상관없이");
  assert.equal(anniversaryToday([{ days: 1, anniversary: true }]), false);
  assert.equal(anniversaryToday([{ days: 0, anniversary: true, ongoing: true }]), false, "여러 날 기념일의 이어지는 날은 그날이 아니다");
  assert.equal(occasionOf(200, anniversaryToday([{ days: 0, anniversary: false }]), now)?.id, "d200", "일정이 있어도 100일 단위 축하가 뜬다");
  assert.equal(occasionOf(200, anniversaryToday([{ days: 0, anniversary: true }]), now)?.id, "dday", "기념일 당일이 100일 단위를 이긴다");
  assert.match(page, /annivToday=\{anniversaryToday\(upcoming\)\}/);
  const world = code("src", "components", "HomeWorld.tsx");
  assert.match(world, /occasionOf\(nDays, annivToday, now\)/);
  assert.doesNotMatch(world, /dday === "D-DAY"/);
  assert.match(between(page, "const ms: Upcoming[] = upcomingMilestones(", "const ev: Upcoming[]"), /anniversary: true/, "주년은 기념일");
});

/* ── 5 · 편집 충돌 ─────────────────────────────────────────────── */

test("#5 일정 편집은 시트를 연 때의 updated_at 이 그대로일 때만 덮는다 — 0행이면 충돌", () => {
  const upd = between(couple, "export async function updateCoupleEvent(", "export async function deleteCoupleEvent(");
  assert.match(upd, /if \(ev\.updatedAt\) q = q\.eq\("updated_at", ev\.updatedAt\);/);
  assert.match(upd, /throw new EventConflictError\(fresh\)/);
  assert.match(couple, /"상대가 방금 이 일정을 바꿨어요\./);
  assert.match(between(couple, "function rowToEvent(", "function eventExtras("), /updatedAt: r\.updated_at/);
  // 화면: 충돌이면 목록을 다시 읽고 시트를 서버 값으로 다시 연다(key 가 updated_at 으로 바뀐다)
  const save = between(page, "async function saveEvent(", "async function skipOccurrence(");
  assert.match(save, /if \(reason instanceof EventConflictError\) \{[\s\S]*setEditingEvent\(reason\.fresh\);/);
  assert.match(page, /key=\{editingEvent \? `\$\{editingEvent\.id\}:\$\{editingEvent\.updatedAt \?\? ""\}` : "new"\}/);
  const add = between(page, "function AddEvent(", "function Settings(");
  assert.match(add, /updatedAt: existing\?\.updatedAt,/, "저장 때 기준 updated_at 을 보낸다");
  // 복원한 편집 초안은 그 뒤 서버가 바뀌었으면 버린다
  assert.match(add, /!editDraftFresh\(loaded\.base, existing\.updatedAt\)/);
  assert.match(add, /base: existing\?\.updatedAt,/);
  assert.equal(editDraftFresh("t1", "t1"), true);
  assert.equal(editDraftFresh("t1", "t2"), false, "상대가 바꿨다");
  assert.equal(editDraftFresh(undefined, "t2"), false, "옛 초안은 비교할 수 없어 버린다");
  assert.equal(editDraftFresh(undefined, undefined), true, "로컬 일정은 쓰는 사람이 하나");
});

test("#5 마이그레이션 — couple_events 에 updated_at 과 갱신 트리거가 이미 있다(새로 만들지 않는다)", () => {
  const schema = raw("supabase", "schema.sql");
  assert.match(schema, /alter table public\.couple_events\s+add column if not exists updated_at timestamptz not null default now\(\);/);
  assert.match(between(schema, "create or replace function public.sync_event_recurrence()", "$$;"), /new\.updated_at := now\(\);/);
  assert.doesNotMatch(schema, /grant (update|insert) \([^)]*\) on (table )?public\.couple_events/i, "컬럼 단위 grant 가 생기면 새 칸을 다시 grant 해야 한다");
});

/* ── 6 · 사귄 날 ──────────────────────────────────────────────── */

test("#6 상대가 바꾼 사귄 날이 열린 앱에 온다 — 커플 행 구독의 재조회가 start_date 도 읽는다", () => {
  const refresh = between(page, "const refresh = () => {\n      getCoupleCover(coupleId)", "const unsub = subscribeCouple(coupleId, refresh);");
  assert.match(refresh, /getCoupleStartDate\(coupleId\)/);
  assert.match(refresh, /safeSet\(LS\.start, iso\);/);
  assert.match(couple, /select\("start_date"\)\.eq\("id", coupleId\)/);
});

/* ── 7 · 8 · 9 · 10 · 11 · 계획 탭 ─────────────────────────────── */

test("#7 일정 ↔ 버킷리스트를 오가도 둘 다 마운트(숨김) — 달력의 달이 그대로", () => {
  const plan = between(page, 'visited.has("plan")', 'visited.has("game")');
  assert.doesNotMatch(plan, /planView === "cal" \?/, "삼항식이 숨긴 쪽을 지운다");
  assert.match(plan, /<div hidden=\{planView !== "cal"\}>/);
  assert.match(plan, /visitedPlan\.has\("bucket"\) && \(\s*<div hidden=\{planView !== "bucket"\}>/);
});

test("#8 다가오는 목록은 개수로 자르지 않는다 — 홈은 맨 앞 하나, 계획은 '더 보기'로 전부", () => {
  const memo = between(page, "const upcoming: Upcoming[] = useMemo(", "}, [start, events, dayKey]);");
  assert.doesNotMatch(memo, /\.slice\(0, 10\)/);
  assert.match(page, /upcoming\.slice\(0, upcomingShown\)/);
  assert.match(page, /setUpcomingShown\(\(n\) => \(n >= upcoming\.length \? 3 : n \+ 10\)\)/);
});

test("#9 달력 줄 — 휴지통 없이 줄을 누르면 편집 시트, 일기 줄은 그 일기 카드로", () => {
  assert.doesNotMatch(cal, /name="trash"/);
  assert.doesNotMatch(cal, /confirmDialog|onDelete/);
  assert.match(cal, /\(\) => onEdit\(it\.event!, it\.occurrence\)/);
  assert.match(cal, /\(\) => onOpenDiary\(it\.diaryId!\)/);
  assert.match(cal, /diaryId: dm\.id,/);
  assert.match(page, /onOpenDiary=\{\(id\) => goRoute\(\{ view: "diary", focus: id \}\)\}/, "page 의 diaryFocus 경로를 쓴다");
});

test("#10 삭제가 실패하면 편집 시트를 닫지 않는다", () => {
  assert.match(page, /async function removeEvent\(id: string\): Promise<boolean>/);
  const rm = between(page, "async function removeEvent(", "function openAddEvent(");
  assert.match(rm, /return true;\s*\} catch/);
  assert.match(rm, /return false;/);
  assert.match(between(page, "<AddEvent", "onClose={() => {"), /return removeEvent\(ev\.id\);/);
});

test("#11 일정 구독은 정리(cleanup) 뒤에 붙지 않는다", () => {
  const eff = between(page, "const local: CoupleEvent[] = loadEvents();", "function saveEvents(");
  assert.match(eff, /if \(cancelled\) return;\s*unsub = subscribeCoupleEvents\(/);
});

/* ── 12 · 오늘의 질문 ──────────────────────────────────────────── */

test("#12 질문 카드 — 보관함 버튼은 펼침 상태를 알리고, '지난번엔'은 그 질문의 회차만 서버에서 받는다", () => {
  const dq = code("src", "components", "DailyQuestion.tsx");
  assert.match(dq, /aria-expanded=\{histOpen\}/);
  const past = between(dq, "const [past, setPast]", "const lastRound");
  assert.match(past, /listQuestionRounds\(coupleId, q\.index\)/);
  assert.doesNotMatch(past, /listAllAnswers\(/);
  assert.match(couple, /\.or\(`question_id\.eq\.q\$\{index\},question_id\.like\.q\$\{index\}@\*`\)/);
});

/* ── 14 · 알림 → 달력 ──────────────────────────────────────────── */

test("#14 일정 · 기념일 알림을 누르면 그 일정이 있는 날의 달력", () => {
  assert.deepEqual(activityRoute("event", UUID), { view: "plan", sub: "cal", focus: UUID });
  assert.deepEqual(activityRoute("event"), { view: "plan", sub: "cal" }, "옛 모양 그대로");
  assert.deepEqual(withFocus({ view: "plan", sub: "cal" }, "<x>"), { view: "plan", sub: "cal" }, "uuid 가 아니면 무시");
  assert.equal(reminderUrl([{ days: 0 }, { days: 1, eventId: UUID }]), `./?go=event&f=${UUID}`);
  assert.equal(reminderUrl([{ days: 0 }]), "./?go=event", "주년만이면 달력");
  assert.match(page, /if \(route\.sub === "cal" && route\.focus\) setPlanFocus\(\{ id: route\.focus, ts: Date\.now\(\) \}\);/);
  assert.match(page, /focusEvent=\{planFocus\}/);
  assert.match(cal, /const at = ongoingOccurrence\(ev, ref\) \?\? nextOccurrence\(ev, ref\);\s*setYm\(\{ y: at\.getFullYear\(\), m: at\.getMonth\(\) \}\);\s*setSel\(at\.getDate\(\)\);/);
  // 새 일정 푸시도 그 일정으로
  assert.match(page, /sendEventPush\(coupleId, "event", "📅 새 일정", eventPushMessage\(ev\), "event", saved\.id\)/);
});

/* ── 15 · 이번만 건너뛰기 · 여러 날 ───────────────────────────────── */

const ev = (o: Partial<CoupleEvent>): CoupleEvent => ({ id: "e", title: "t", date: "2026-01-15", repeatYearly: false, recurrence: "monthly", ...o });

test("#15 이번만 건너뛰기 — 그 회차만 목록 · 달력 · 알림에서 빠진다", () => {
  const m = ev({ skipDates: ["2026-11-15"] });
  assert.equal(toISODate(nextOccurrence(m, parseDate("2026-11-05"))), "2026-12-15");
  assert.equal(toISODate(nextOccurrence(ev({}), parseDate("2026-11-05"))), "2026-11-15");
  assert.deepEqual(eventDaysInMonth(m, 2026, 10), [], "건너뛴 달엔 칸이 없다");
  assert.deepEqual(eventDaysInMonth(m, 2026, 11).map((d) => d.day), [15]);
  // 한 번뿐인 일정엔 건너뛰기가 뜻이 없다
  assert.equal(toISODate(nextOccurrence(ev({ recurrence: "none", date: "2026-11-15", skipDates: ["2026-11-15"] }), parseDate("2026-11-05"))), "2026-11-15");
  // 알림도 같은 규칙(D-3 이 건너뛴 회차면 안 나간다)
  const r = row({ title: "월세", event_date: "2026-01-15", recurrence: "monthly", skip_dates: ["2026-11-15"], reminder_offsets: [0, 3] });
  assert.equal(coupleReminders(null, [r], utc("2026-11-12")).length, 0);
  assert.equal(occurrence(r, utc("2026-11-12")).toISOString().slice(0, 10), "2026-12-15");
  assert.equal(coupleReminders(null, [{ ...r, skip_dates: [] }], utc("2026-11-12")).length, 1);
  // 저장 확인이 건너뛴 날 · 끝나는 날까지 본다
  assert.ok(!eventContentMatches(ev({}), ev({ skipDates: ["2026-11-15"] })));
  assert.ok(!eventContentMatches(ev({}), ev({ endDate: "2026-01-17" })));
  assert.ok(eventContentMatches(ev({ skipDates: ["b", "a"] }), ev({ skipDates: ["a", "b"] })));
});

test("#15 여러 날 일정 — 이어지는 날마다 칸, 달을 넘어도, 진행 중이면 그 회차", () => {
  const trip = ev({ recurrence: "none", date: "2026-11-29", endDate: "2026-12-02" });
  assert.equal(eventSpanDays(trip), 3);
  assert.deepEqual(eventDaysInMonth(trip, 2026, 10), [{ day: 29, start: "2026-11-29", first: true }, { day: 30, start: "2026-11-29", first: false }]);
  assert.deepEqual(eventDaysInMonth(trip, 2026, 11).map((d) => [d.day, d.first]), [[1, false], [2, false]]);
  assert.equal(ongoingOccurrence(trip, parseDate("2026-12-01"))?.getDate(), 29);
  assert.equal(ongoingOccurrence(trip, parseDate("2026-11-29")), null, "시작일은 '진행 중'이 아니라 당일");
  assert.equal(ongoingOccurrence(trip, parseDate("2026-12-03")), null);
  assert.equal(eventSpanDays(ev({ endDate: "2026-01-10" })), 0, "끝나는 날이 앞이면 하루짜리");
  assert.equal(eventSpanDays(ev({ date: "2026-01-01", endDate: "2027-01-01" })), MAX_EVENT_SPAN_DAYS, "상한");
  // 매년 반복 여행이 해를 넘겨도(12/30 ~ 1/2) 새해 달력에 이어진다
  const yearly = ev({ recurrence: "yearly", repeatYearly: true, date: "2024-12-30", endDate: "2025-01-02" });
  assert.deepEqual(eventDaysInMonth(yearly, 2026, 0).map((d) => d.day), [1, 2]);
  // 알림은 시작일 기준(끝나는 날을 몰라도 같다)
  const r = row({ title: "여행", event_date: "2026-11-29", end_date: "2026-12-02", reminder_offsets: [0, 1] });
  assert.deepEqual(coupleReminders(null, [r], utc("2026-11-28")).map((x) => x.days), [1]);
  assert.equal(coupleReminders(null, [r], utc("2026-11-30")).length, 0);
});

test("#15 데이터 · 화면 · 마이그레이션 — 새 칸은 선택 칸이고 옛 DB · 옛 앱과 맞는다", () => {
  const mig = raw("supabase", "migrations", "20261106050000_home_plan.sql");
  assert.ok(raw("supabase", "schema.sql").trimEnd().endsWith(mig.trimEnd()), "schema.sql 끝의 복사본이 migration 과 달라졌어요");
  assert.equal(raw("supabase", "schema.sql").split(mig.trim()).length - 1, 1, "schema.sql 에 한 번만");
  const sql = mig.replace(/--[^\n]*/g, "");
  assert.match(sql, /^\s*begin;[\s\S]*commit;\s*$/);
  assert.match(sql, /add column if not exists skip_dates date\[\] not null default '\{\}'/);
  assert.match(sql, /add column if not exists end_date date;/);
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|\bdrop\s+column\b/i);
  assert.doesNotMatch(sql, /add constraint/i, "옛 앱이 시작일만 옮길 때 거부되지 않게 check 대신 트리거로 고친다");
  assert.match(sql, /set search_path = public/);
  assert.match(sql, /revoke execute on function public\.normalize_event_span\(\) from public, anon, authenticated;/);
  assert.match(sql, /drop trigger if exists couple_events_normalize_span/);
  assert.doesNotMatch(sql, /40001|40P01/);
  // 데이터 계층: 비어 있으면 새 칸을 안 보내고(옛 DB), 없는 칸 오류엔 값이 비었을 때만 다시 쓴다
  const add = between(couple, "export async function addCoupleEvent(", "const EVENT_UPDATING");
  assert.match(add, /insert\(extrasEmpty\(extras\) \? row : \{ \.\.\.row, \.\.\.extras \}\)/);
  const upd = between(couple, "export async function updateCoupleEvent(", "export async function deleteCoupleEvent(");
  assert.match(upd, /if \(error && missingColumn\(error\)\) \{\s*if \(!extrasEmpty\(extras\)\) throw new Error\(EVENT_UPDATING\);/);
  assert.match(fn, /if \(first\.error && missingColumn\(first\.error\)\) return await sb\.from\("couple_events"\)\.select\(EVENT_COLS_OLD\)/);
  // 시트
  const sheet = between(page, "function AddEvent(", "function Settings(");
  assert.match(sheet, /<Field label="끝나는 날 \(선택\)">/);
  assert.match(sheet, /이번만 건너뛰기/);
  assert.match(sheet, /eventRecurrence\(existing\) !== "none"/, "반복 일정에만");
  assert.match(sheet, /disabled=\{!title\.trim\(\) \|\| !date \|\| busy \|\| !!endError\}/);
  assert.match(page, /const running = ongoingOccurrence\(e, t\);/, "진행 중인 여행이 목록에서 빠지지 않는다");
});

test("버킷 — 이룬 날(done_at)을 보여 준다", () => {
  const bucket = code("src", "components", "BucketList.tsx");
  assert.match(bucket, /b\.done && b\.done_at && <span className="block text-xs text-muted">\{doneDayLabel\(b\.done_at\)\} 이룸<\/span>/);
  assert.match(bucket, /done_at: x\.done \? null : new Date\(\)\.toISOString\(\)/, "낙관적 토글도 이룬 날을 채운다");
});
