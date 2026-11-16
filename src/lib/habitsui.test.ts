// 같이 하는 습관(2026-11-13, README §10.27) — migration · 계정 삭제 · 내보내기 · 화면 배치 · 저장소 계약 잠금.
// 동작(정책 · 트리거 · 계정 삭제)은 PGlite 로 따로 돌렸다(README §10.27 검증) — 여기는 그 모양이 흐트러지지 않게.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCOUNT_EXPORT_TABLES } from "./accountPolicy.ts";
import { HABIT_ICON_KEYS, HABIT_ICONS, ICON_PATHS, habitIconPath } from "./icons.ts";
import { HABIT_HEART, HABIT_HEART_DAY_CAP, HABIT_MAX, HABIT_NAME_MAX, WEEKLY_MAX } from "./habits.ts";
import { activityRoute } from "./activity.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const noComments = (s: string) => s.replace(/--[^\n]*/g, "");
const jsx = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const MIG = "supabase/migrations/20261114070000_habits.sql";
const mig = noComments(read(MIG));

test("migration — 두 표 · 서버 CHECK 가 앱 상수와 같다", () => {
  assert.match(mig, /create table if not exists public\.couple_habits/);
  assert.match(mig, /create table if not exists public\.habit_checkins/);
  assert.match(mig, /primary key \(habit_id, user_id, day\)/, "한 사람 · 한 습관 · 하루 한 줄");
  assert.match(mig, new RegExp(`char_length\\(btrim\\(name\\)\\) between 1 and ${HABIT_NAME_MAX}`));
  assert.match(mig, new RegExp(`target_count between 1 and ${WEEKLY_MAX}`));
  assert.match(mig, /mode in \('both', 'either'\)/);
  assert.match(mig, new RegExp(`>= ${HABIT_MAX} then\\s+raise exception 'too many habits' using errcode = 'PT422'`));
  assert.match(mig, /habit_id\s+uuid not null references public\.couple_habits\(id\) on delete cascade/);
});

test("migration — 체크는 내 줄 · 내 커플 · 그 습관의 커플 · KST 오늘과 어제만, 지우는 정책은 없다", () => {
  const stmts = mig.split(/;\s*\n/).map((s) => s.trim());
  const pol = (name: string) => stmts.find((s) => s.startsWith(`create policy ${name} `)) ?? "";
  for (const name of ["hc_insert", "hc_update"]) {
    const p = pol(name);
    assert.match(p, /user_id = \(select auth\.uid\(\)\)/, name);
    assert.match(p, /couple_id = \(select h\.couple_id from public\.couple_habits h where h\.id = habit_checkins\.habit_id\)/, `${name}: 남의 습관에 내 커플 id 로 체크`);
    assert.match(p, /day between \(select \(now\(\) at time zone 'Asia\/Seoul'\)::date - 1\) and \(select \(now\(\) at time zone 'Asia\/Seoul'\)::date\)/, name);
  }
  assert.equal(stmts.filter((s) => /^create policy \w+ on public\.habit_checkins for delete/.test(s)).length, 0, "되돌리기는 done=false — 지우기 정책을 열지 않는다");
  assert.match(mig, /create trigger habits_created_by_immutable before update on public\.couple_habits\s+for each row execute function public\.forbid_created_by_change\(\)/);
  for (const t of ["couple_habits", "habit_checkins"]) assert.match(mig, new RegExp(`alter publication supabase_realtime add table public\\.${t}`), `${t} 실시간`);
});

test("계정 삭제 — 같은 뜻(체크는 지우고 습관은 남은 멤버에게) · 나머지 본문은 그대로", () => {
  const fn = mig.slice(mig.indexOf("create or replace function public.purge_account_data"));
  assert.match(fn, /update public\.couple_habits set created_by = v_partner\s+where couple_id = v_membership\.couple_id and created_by = p_user/);
  assert.match(fn, /delete from public\.habit_checkins where user_id = p_user/);
  assert.match(fn, /delete from public\.couple_habits where created_by = p_user/);
  // 옛 본문(20260924000000)의 줄이 하나도 안 빠졌다
  const old = noComments(read("supabase/migrations/20260924000000_drop_old_game_tables.sql"));
  const at = old.indexOf("create or replace function public.purge_account_data");
  const oldFn = old.slice(at, old.indexOf("$$;", old.indexOf("as $$", at)) + 3);
  for (const line of oldFn.split("\n").map((l) => l.trim()).filter(Boolean)) {
    assert.ok(fn.includes(line), `계정 삭제에서 빠졌다: ${line}`);
  }
  assert.match(mig, /revoke all on function public\.purge_account_data\(uuid\) from public, anon, authenticated/);
  assert.match(mig, /grant execute on function public\.purge_account_data\(uuid\) to service_role/);
});

test("내보내기 · rls-verify 가 새 표를 안다", () => {
  for (const t of ["couple_habits", "habit_checkins"]) {
    assert.ok((ACCOUNT_EXPORT_TABLES as readonly string[]).includes(t), `내보내기에 ${t}`);
    assert.match(read("scripts/rls-verify.mjs"), new RegExp(`"${t}"`), `rls-verify 의 표 목록에 ${t}`);
  }
});

test("하트는 작고 상한이 있다 — 습관 하나 5 · 커플 하루 20", () => {
  assert.equal(HABIT_HEART, 5);
  assert.equal(HABIT_HEART_DAY_CAP, 20);
  const store = jsx(read("src/lib/habitstore.ts"));
  assert.match(store, /await habitCheckinsOn\(s\.coupleId, day\)/, "하트는 낙관적 화면이 아니라 서버에서 새로 읽은 줄로만");
  assert.match(store, /const now = today\(\);/);
  assert.match(store, /const today = \(\) => kstDate\(gameNow\(\)\);/, "오늘은 서버 시각의 KST");
  assert.match(store, /if \(saveErrorKind\(e\) !== "conflict"\) return;/, "충돌이면 다시 읽어 또, 그 밖엔 그만");
});

test("저장소 — 실시간은 다중화 채널 · 체크는 같은 열쇠 upsert · 길 위의 오류만 다시 보낸다", () => {
  const couple = read("src/lib/couple.ts");
  assert.match(couple, /muxOn\(coupleId, "habit_checkins", `couple_id=eq\.\$\{coupleId\}`/);
  assert.match(couple, /muxOn\(coupleId, "couple_habits", `couple_id=eq\.\$\{coupleId\}`/);
  assert.match(couple, /onConflict: "habit_id,user_id,day"/);
  assert.match(couple, /listHabitCheckins[\s\S]{0,400}fetchAllPages/, "1000행 상한 — 끝까지 받는다");
  const store = jsx(read("src/lib/habitstore.ts"));
  assert.match(store, /saveErrorKind\(e\) === "network"[\s\S]{0,120}scheduleRetry\(s\)/);
  assert.match(store, /localStorage\.setItem\(pendingKey\(s\)/, "보낼 줄은 기기에 남는다(앱을 닫았다 열어도)");
  assert.match(store, /window\.addEventListener\("online", onOnline\)/);
});

test("배치 — 홈 '오늘의 우리' 안의 카드(3개 진행과 따로) · 계획의 세 번째 칸(둘 다 마운트 규칙)", () => {
  const page = jsx(read("src/app/page.tsx"));
  const hub = jsx(read("src/components/TodayTogether.tsx"));
  const card = jsx(read("src/components/HabitTodayCard.tsx"));
  assert.match(card, /<div id="today-habit" className="home-chapter-entry/, "카드가 자기 자리를 그린다(숨을 땐 빈 여백도 없게)");
  assert.match(card, /if \(!myUserId \|\| snap\.missing\) return null;/);
  assert.ok(hub.indexOf('id="today-question"') < hub.indexOf("{habits}"), "질문 다음");
  assert.match(hub, /const STEPS: [^=]+= \[\s*\{ k: "log"[\s\S]*?\{ k: "question"[^\]]*\];/, "STEPS 는 셋 그대로");
  assert.doesNotMatch(hub.slice(hub.indexOf("const STEPS"), hub.indexOf("];", hub.indexOf("const STEPS"))), /habit/);
  assert.match(page, /\{ value: "habit", label: "습관", icon: "check" \}/);
  assert.match(page, /visitedPlan\.has\("habit"\) && \(\s*<div hidden=\{planView !== "habit"\}>\s*<HabitBoard/);
  assert.match(page, /onOpenHabits=\{\(\) => goPlan\("habit"\)\}/);
  // 경로 표: 계획 › 습관(goRoute 가 goPlan(route.sub) 로 연다). 활동 종류는 더하지 않았다 — 푸시 종류 · 엣지 함수가 따라 바뀐다.
  assert.match(read("src/lib/activity.ts"), /\{ view: "plan"; sub: "cal" \| "bucket" \| "habit"; focus\?: string \}/);
  assert.deepEqual(activityRoute("bucket"), { view: "plan", sub: "bucket" });
});

test("아이콘 — 고정 SVG 12개 · IconName 밖 · 모르는 키는 새싹 · 화면에 이모지 없음", () => {
  assert.ok(HABIT_ICON_KEYS.length >= 12);
  for (const k of HABIT_ICON_KEYS) {
    assert.match(k, /^[a-z]{1,16}$/, "서버 CHECK(icon_key)와 같은 모양");
    assert.match(HABIT_ICONS[k].path, /^<(path|circle|rect)/);
  }
  assert.ok(!("water" in ICON_PATHS), "IconName 에 넣지 않는다(pixelicon.test)");
  assert.equal(habitIconPath("???"), HABIT_ICONS.sprout.path);
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2764}]/u;
  for (const f of ["src/components/HabitBoard.tsx", "src/components/HabitTodayCard.tsx", "src/components/HabitIcon.tsx", "src/lib/habitstore.ts"]) {
    assert.doesNotMatch(jsx(read(f)), EMOJI, `${f}: UI 크롬에 이모지`);
  }
});

test("움직임 줄이기 — 습관 화면은 반복 애니메이션이 없고 전환은 motion-safe 만", () => {
  for (const f of ["src/components/HabitBoard.tsx", "src/components/HabitTodayCard.tsx"]) {
    const src = jsx(read(f));
    assert.doesNotMatch(src, /animate-(spin|pulse|bounce|ping)/, f);
    for (const m of src.matchAll(/(\S*)transition-all/g)) assert.equal(m[1], "motion-safe:", `${f}: ${m[0]}`);
  }
});
