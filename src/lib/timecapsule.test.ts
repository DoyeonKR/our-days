// 타임캡슐 편지 lock (2026-11-13, README §10.26).
//
// 봉인은 서버가 한다 — 여는 날(KST) 전엔 받는 사람이 본문 · 사진 경로 · 사진 파일을 못 읽는다. 이 테스트는 그 규칙이
// migration 에서 빠지지 않게 글자로 잠그고(실제 동작은 scripts/rls-verify.mjs 의 capsuleChecks 가 PGlite 로 잰다),
// 날짜 계산(빠른 선택 · D-day · KST) · 활동함 경로 · 내보내기를 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPSULE_MAX_BODY,
  addYears,
  capsuleBodyError,
  capsuleDaysLeft,
  capsuleDdayLabel,
  capsuleKstDay,
  capsuleMaxDate,
  capsuleMinDate,
  capsulePhotoPath,
  capsuleQuickPicks,
  capsuleToday,
  formatCapsuleDate,
  isIsoDate,
  isSealed,
  nextAnniversary,
  nextHundredDay,
  splitCapsules,
  validOpenOn,
} from "./capsule.ts";
import { activityPresentation, activityRoute, goKindOf, pushUrlFor, withFocus } from "./activity.ts";
import { ACCOUNT_EXPORT_TABLES, collectExportCapsulePhotoPaths, collectExportMediaPaths } from "./accountPolicy.ts";
import { deletionImpact } from "./solospace.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const noComments = (s: string) => s.replace(/--[^\n]*/g, "");
const MIG = "supabase/migrations/20261107110000_time_capsule.sql";
const migration = read(MIG);
const code = noComments(migration);
const stmts = code.split(/;\s*\n/).map((s) => s.trim());
const UUID = "3f2a7c1e-9b4d-4e8f-a1c2-0d9e8f7a6b5c";

// ── migration ──────────────────────────────────────────────────────────────────

test("migration — 이름 · 한 트랜잭션 · schema.sql 끝에 원문 한 번 · 지우는 것 없음", () => {
  assert.match(code, /^begin;$/m);
  assert.match(code.trimEnd(), /commit;$/);
  const schema = read("supabase/schema.sql");
  assert.equal(schema.split(migration.trim()).length - 1, 1, "schema.sql 에 원문이 정확히 한 번");
  // 뒤에 오는 migration 이 그 뒤에 붙으므로 '끝'은 묻지 않는다 — 앞 migration(20261107090000)보다 뒤에 있으면 된다
  assert.ok(schema.indexOf(migration.trim()) > schema.indexOf("-- ── migrations/20261107090000_fish_families_54.sql ──"), "번호 순서대로 붙인다");
  assert.doesNotMatch(code, /\bdrop table\b|\btruncate\b/i);
  // 지우는 문장은 purge_account_data 본문 안(계정 삭제 때만)뿐이다
  const outside = code.slice(0, code.indexOf("create or replace function public.purge_account_data"));
  assert.doesNotMatch(outside, /\bdelete from\b/i, "migration 자체는 행을 지우지 않는다");
  assert.doesNotMatch(code, /errcode\s*=\s*'(40001|40P01)'/i);
});

test("★ 봉인 — SELECT 정책은 '내가 썼거나 여는 날(KST)이 지났을 때'만, 카드 RPC 는 본문을 안 돌려준다", () => {
  const sel = stmts.find((s) => /^create policy time_capsules_select on public\.time_capsules/.test(s));
  assert.ok(sel, "select 정책이 없다");
  assert.match(sel!, /for select to authenticated/);
  assert.match(sel!, /couple_id in \(select private\.my_couple_ids\(\)\)/);
  assert.match(sel!, /created_by = \(select auth\.uid\(\)\)\s*or open_on <= \(select \(now\(\) at time zone 'Asia\/Seoul'\)::date\)/);
  assert.doesNotMatch(sel!, /opened_at/, "봉인은 시각으로만 — 크론이 찍는 opened_at 에 기대면 크론이 먼저 돌 때 일찍 열린다");
  const cards = code.slice(code.indexOf("create or replace function public.time_capsule_cards"), code.indexOf("revoke all on function public.time_capsule_cards"));
  assert.match(cards, /security definer/);
  assert.match(cards, /set search_path = public/);
  assert.match(cards, /p_couple in \(select private\.my_couple_ids\(\)\)/, "남의 커플 카드는 0줄");
  const returns = /returns table \(([^)]*)\)/.exec(cards)![1];
  assert.doesNotMatch(returns, /\bbody\b|photo_path/, "카드에 본문 · 사진 경로를 싣지 않는다");
  assert.match(code, /revoke all on function public\.time_capsule_cards\(uuid\) from public, anon;\s*grant execute on function public\.time_capsule_cards\(uuid\) to authenticated;/);
});

test("쓰기 — 쓴 사람만 · 여는 날 전에만 · 내일 ~ 10년 · opened_at 은 앱이 못 쓴다", () => {
  for (const name of ["time_capsules_insert", "time_capsules_update", "time_capsules_delete"]) {
    const p = stmts.find((s) => s.startsWith(`create policy ${name} `))!;
    assert.ok(p, name);
    assert.match(p, /to authenticated/);
    assert.match(p, /created_by = \(select auth\.uid\(\)\)/, `${name}: 쓴 사람만`);
    assert.match(p, /open_on > \(select \(now\(\) at time zone 'Asia\/Seoul'\)::date\)/, `${name}: 여는 날 전에만`);
  }
  for (const name of ["time_capsules_insert", "time_capsules_update"]) {
    const p = stmts.find((s) => s.startsWith(`create policy ${name} `))!;
    assert.match(p, /open_on <= \(select \(\(now\(\) at time zone 'Asia\/Seoul'\)::date \+ interval '10 years'\)::date\)/);
  }
  assert.match(code, /revoke insert, update, delete on public\.time_capsules from authenticated/);
  const ins = /grant insert \(([^)]*)\) on public\.time_capsules to authenticated/.exec(code)![1];
  const upd = /grant update \(([^)]*)\) on public\.time_capsules to authenticated/.exec(code)![1];
  assert.doesNotMatch(ins, /opened_at/);
  assert.deepEqual(upd.split(",").map((s) => s.trim()).sort(), ["body", "open_on", "photo_path"]);
  assert.match(code, /char_length\(body\) <= 2000/);
  assert.equal(CAPSULE_MAX_BODY, 2000, "앱과 서버의 글자 수 상한이 같다");
  assert.match(code, /starts_with\(photo_path, couple_id::text \|\| '\/' \|\| created_by::text \|\| '\/'\)/, "사진은 그 커플 · 쓴 사람 폴더 아래만");
});

test("사진 — 따로 둔 비공개 버킷, 읽기는 내 폴더 또는 열린 편지만, 올리기 · 지우기는 내 폴더만", () => {
  assert.match(code, /values \('capsule-photos', 'capsule-photos', false\)/);
  const pol = (n: string) => stmts.find((s) => s.startsWith(`create policy ${n} on storage.objects`))!;
  for (const n of ["capsule_photos_obj_select", "capsule_photos_obj_insert", "capsule_photos_obj_delete"]) {
    assert.ok(pol(n), n);
    assert.match(pol(n), /to authenticated/);
    assert.match(pol(n), /bucket_id = 'capsule-photos'/);
    assert.doesNotMatch(pol(n), /couple-photos/, "사진첩 버킷 정책은 건드리지 않는다");
    assert.match(pol(n), /\(storage\.foldername\(name\)\)\[1\] in \(select \(private\.my_couple_ids\(\)\)::text\)/);
  }
  assert.match(pol("capsule_photos_obj_select"), /\(storage\.foldername\(name\)\)\[2\] = \(select auth\.uid\(\)\)::text\s*or name in \(select private\.my_open_capsule_photos\(\)\)/);
  assert.match(pol("capsule_photos_obj_insert"), /\(storage\.foldername\(name\)\)\[2\] = \(select auth\.uid\(\)\)::text/);
  const open = code.slice(code.indexOf("create or replace function private.my_open_capsule_photos"), code.indexOf("revoke all on function private.my_open_capsule_photos"));
  assert.match(open, /t\.open_on <= \(now\(\) at time zone 'Asia\/Seoul'\)::date/);
  assert.match(code, /grant execute on function private\.my_open_capsule_photos\(\) to authenticated/, "정책 식은 질의한 사용자 권한으로 돈다");
  // media-gc 는 couple-photos 만 훑는다 — 그래서 함수를 다시 배포하지 않아도 편지 사진을 고아로 보지 않는다
  assert.match(read("supabase/functions/media-gc/index.ts"), /const BUCKET = "couple-photos"/);
});

test("열기 — 크론(매시 · SQL 한 줄 · 비밀 없음) + 읽을 때, opened_at 빈 줄만이라 한 번만, 활동 줄에 본문 없음", () => {
  const fn = code.slice(code.indexOf("create or replace function private.open_due_capsules"), code.indexOf("revoke all on function private.open_due_capsules"));
  assert.match(fn, /where t\.opened_at is null/);
  assert.match(fn, /'capsule_open', o\.id::text, null,/, "summary 는 null — 본문을 activity_events 에 싣지 않는다");
  assert.doesNotMatch(fn, /\bbody\b/);
  assert.match(code, /revoke all on function private\.open_due_capsules\(uuid\) from public, anon, authenticated/);
  const lazy = code.slice(code.indexOf("create or replace function public.open_due_time_capsules"), code.indexOf("revoke all on function public.open_due_time_capsules"));
  assert.match(lazy, /p_couple in \(select private\.my_couple_ids\(\)\)/);
  assert.match(code, /capture_couple_activity\('capsule', ''\)/, "묻을 때 활동 — 둘째 인자가 빈 글자라 summary 가 null");
  const cron = code.slice(code.lastIndexOf("do $$"), code.indexOf("create or replace function public.purge_account_data"));
  assert.match(cron, /if to_regclass\('cron\.job'\) is null then\s+return;/);
  assert.match(cron, /cron\.schedule\('open-time-capsules-hourly', '1 \* \* \* \*', 'select private\.open_due_capsules\(\)'\)/);
  assert.doesNotMatch(migration, /x-cron-secret|net\.http_post|CRON_SECRET/i, "크론 명령에 비밀 · HTTP 가 없다");
});

test("계정 삭제 — 20260924 판 본문 그대로 + time_capsules 한 줄", () => {
  const old = read("supabase/migrations/20260924000000_drop_old_game_tables.sql");
  const block = (s: string) => {
    const a = s.indexOf("create or replace function public.purge_account_data");
    const b = s.indexOf("grant execute on function public.purge_account_data(uuid) to service_role;", a);
    return s.slice(a, b);
  };
  const line = "  delete from public.time_capsules where created_by = p_user; -- 타임캡슐 편지(쓴 것) [2026-11-13]\n";
  assert.ok(block(migration).includes(line));
  assert.equal(block(migration).replace(line, ""), block(old), "purge 본문이 옛 판과 한 글자라도 다르면 안 된다");
  assert.match(code, /created_by uuid not null default auth\.uid\(\) references auth\.users\(id\) on delete cascade/);
  // 뒤에 오는 migration 이 옛 본문으로 purge 를 다시 정의하면 이 줄이 조용히 빠진다 — schema.sql 의 '마지막' 정의를 본다
  const schema = read("supabase/schema.sql");
  const all = schema.split("create or replace function public.purge_account_data(p_user uuid)");
  const last = all[all.length - 1];
  assert.match(noComments(last.slice(0, last.indexOf("$$;"))), /delete from public\.time_capsules where created_by = p_user;/, "마지막 purge 정의가 타임캡슐을 안 지운다 — 새 purge 정의에 이 줄을 옮긴다");
  assert.ok(deletionImpact("pair", "민지").gone.some((g) => g.includes("타임캡슐 편지")), "계정 삭제 안내도 같이 말한다");
});

// ── 날짜 ────────────────────────────────────────────────────────────────────────

test("KST 오늘 — UTC 15:00 에 날짜가 넘어간다(두 사람이 같은 '오늘')", () => {
  assert.equal(capsuleToday(Date.UTC(2026, 10, 13, 14, 59)), "2026-11-13");
  assert.equal(capsuleToday(Date.UTC(2026, 10, 13, 15, 0)), "2026-11-14");
  assert.equal(capsuleKstDay("2026-11-12T16:30:00Z"), "2026-11-13", "0~9시(KST)에 묻은 편지가 하루 이르게 안 보인다");
  assert.equal(capsuleKstDay("bad"), "bad");
});

test("여는 날 범위 — 내일 ~ 10년 뒤(2/29 는 2/28, Postgres interval 과 같다)", () => {
  assert.equal(capsuleMinDate("2026-11-13"), "2026-11-14");
  assert.equal(capsuleMaxDate("2026-11-13"), "2036-11-13");
  assert.equal(capsuleMaxDate("2028-02-29"), "2038-02-28");
  assert.equal(addYears("2024-02-29", 1), "2025-02-28");
  assert.equal(addYears("2024-02-29", 4), "2028-02-29");
  assert.equal(addYears("2026-12-31", 1), "2027-12-31");
  assert.ok(!validOpenOn("2026-11-13", "2026-11-13"), "오늘은 안 된다");
  assert.ok(validOpenOn("2026-11-14", "2026-11-13"));
  assert.ok(validOpenOn("2036-11-13", "2026-11-13"));
  assert.ok(!validOpenOn("2036-11-14", "2026-11-13"));
  assert.ok(!validOpenOn("2026-02-30", "2026-01-01"), "없는 날");
  assert.ok(!isIsoDate("2026-1-5"));
  assert.ok(isIsoDate("2028-02-29") && !isIsoDate("2027-02-29"));
});

test("빠른 선택 — 다음 주년 · 다음 100일 단위(사귄 날 = 1일째) · 1년 뒤", () => {
  // 2025-03-01 시작 → 2026-11-13 은 623일째 → 다음은 700일 = 2027-01-29
  assert.deepEqual(nextHundredDay("2025-03-01", "2026-11-13"), { days: 700, date: "2027-01-29" });
  assert.deepEqual(nextHundredDay("2026-11-01", "2026-11-13"), { days: 100, date: "2027-02-08" });
  // 딱 100일째인 날이면 다음 100일
  assert.deepEqual(nextHundredDay("2026-08-06", "2026-11-13"), { days: 200, date: "2027-02-21" });
  assert.deepEqual(nextAnniversary("2025-03-01", "2026-11-13"), { years: 2, date: "2027-03-01" });
  assert.deepEqual(nextAnniversary("2025-11-13", "2026-11-13"), { years: 2, date: "2027-11-13" }, "오늘이 주년이면 다음 해");
  assert.deepEqual(nextAnniversary("2024-02-29", "2026-11-13"), { years: 3, date: "2027-02-28" });
  const picks = capsuleQuickPicks("2026-11-13", "2025-03-01");
  assert.deepEqual(picks.map((p) => p.key), ["anniversary", "hundred", "year"]);
  assert.deepEqual(picks.map((p) => p.label), ["2주년", "700일", "1년 뒤"]);
  assert.equal(picks[2].date, "2027-11-13");
  for (const p of picks) assert.ok(validOpenOn(p.date, "2026-11-13"), p.key);
  // 사귄 날을 모르거나 미래면 1년 뒤만 · 같은 날은 하나
  assert.deepEqual(capsuleQuickPicks("2026-11-13", null).map((p) => p.key), ["year"]);
  assert.deepEqual(capsuleQuickPicks("2026-11-13", "2027-01-01").map((p) => p.key), ["year"]);
  const same = capsuleQuickPicks("2026-11-13", "2025-11-13"); // 다음 주년 = 1년 뒤 = 2027-11-13
  assert.equal(same.filter((p) => p.date === "2027-11-13").length, 1);
});

test("D-day · 봉인 판정 · 정렬", () => {
  assert.equal(capsuleDaysLeft("2026-11-20", "2026-11-13"), 7);
  assert.equal(capsuleDdayLabel("2026-11-20", "2026-11-13"), "D-7");
  assert.equal(capsuleDdayLabel("2026-11-14", "2026-11-13"), "내일 열려요");
  assert.equal(capsuleDdayLabel("2026-11-13", "2026-11-13"), "열렸어요");
  assert.equal(capsuleDdayLabel("2029-11-13", "2026-11-13"), "D-1,096");
  assert.ok(isSealed("2026-11-14", "2026-11-13"));
  assert.ok(!isSealed("2026-11-13", "2026-11-13"), "여는 날 0시(KST)부터 열린다 — 서버 정책과 같은 기준");
  assert.equal(formatCapsuleDate("2027-03-02"), "2027년 3월 2일");
  const list = [
    { id: "a", openOn: "2027-01-01", createdAt: "2026-01-01T00:00:00Z" },
    { id: "b", openOn: "2026-12-01", createdAt: "2026-01-02T00:00:00Z" },
    { id: "c", openOn: "2026-10-01", createdAt: "2026-01-03T00:00:00Z" },
    { id: "d", openOn: "2026-11-13", createdAt: "2026-01-04T00:00:00Z" },
  ];
  const { sealed, opened } = splitCapsules(list, "2026-11-13");
  assert.deepEqual(sealed.map((c) => c.id), ["b", "a"], "곧 열릴 것부터");
  assert.deepEqual(opened.map((c) => c.id), ["d", "c"], "최근에 열린 것부터");
});

test("본문 · 사진 경로", () => {
  assert.equal(capsuleBodyError("   "), "편지 내용을 적어 주세요");
  assert.equal(capsuleBodyError("가".repeat(2000)), null);
  assert.match(capsuleBodyError("가".repeat(2001))!, /2,000자/);
  assert.equal(capsuleBodyError("😀".repeat(2000)), null, "글자 수는 코드 포인트로 — 서버 char_length 와 같다");
  const p = capsulePhotoPath("c-1", "u-1", "cap", "jpg", "ab12../cd");
  assert.ok(p.startsWith("c-1/u-1/"), p);
  assert.ok(!p.includes(".."), p);
  assert.ok(capsulePhotoPath("c", "u", "x", "exe", "n").endsWith(".webp"));
});

// ── 활동함 · 경로 ──────────────────────────────────────────────────────────────

test("활동함 → 추억의 그 편지 카드(lib/activity 의 never 검사가 새 종류를 강제한다)", () => {
  for (const kind of ["capsule", "capsule_open"] as const) {
    assert.deepEqual(activityRoute(kind, UUID), { view: "records", sub: "memories", focus: UUID });
    assert.deepEqual(activityRoute(kind), { view: "records", sub: "memories" });
    assert.deepEqual(activityRoute(kind, "<img onerror=x>"), { view: "records", sub: "memories" }, "uuid 가 아니면 싣지 않는다");
    assert.equal(goKindOf(new URL(pushUrlFor(kind), "https://x.test/our-days/").searchParams.get("go")), kind);
  }
  assert.deepEqual(withFocus({ view: "records", sub: "log" }, UUID), { view: "records", sub: "log" }, "로그엔 카드 focus 가 없다 — 그대로");
  const ev = { id: "e", couple_id: "c", actor_user: "p", kind: "capsule_open", entity_id: UUID, summary: null, metadata: {}, created_at: "2026-11-13T00:00:00Z" } as const;
  const members = [{ couple_id: "c", user_id: "p", nickname: "민지", joined_at: "" }];
  assert.equal(activityPresentation({ ...ev, metadata: {} }, members, "me").title, "민지님이 묻어 둔 타임캡슐 편지가 열렸어요");
  assert.equal(activityPresentation({ ...ev, metadata: {}, actor_user: "me" }, members, "me").title, "내가 묻어 둔 타임캡슐 편지가 열렸어요");
  assert.equal(activityPresentation({ ...ev, metadata: {}, kind: "capsule" }, members, "me").title, "민지님이 타임캡슐 편지를 묻었어요");
  assert.equal(activityPresentation({ ...ev, metadata: {} }, members, "me").detail, null, "활동함에 본문이 안 보인다");
});

test("page — 추억 칸에 편지함, 경로 focus 를 넘기고, 열림 알림은 푸시 구독과 상관없이 이 기기에서", () => {
  const page = read("src/app/page.tsx");
  assert.match(page, /const TimeCapsules = dynamic\(\(\) => import\("@\/components\/TimeCapsules"\)/, "추억을 열 때만 받는다");
  assert.match(page, /if \(route\.sub === "memories" && route\.focus\) setCapsuleFocus\(/);
  const memories = page.slice(page.indexOf('visitedRecords.has("memories")'));
  assert.ok(memories.indexOf("<TimeCapsules") >= 0 && memories.indexOf("<TimeCapsules") < memories.indexOf("<MemoriesRecap"), "추억 맨 위");
  const eff = page.slice(page.indexOf("타임캡슐 편지가 열리면 받는 사람 기기에 알림"), page.indexOf("[mounted, notif, inbox.events, myUserId, coupleMembers]"));
  assert.match(eff, /e\.kind === "capsule_open" && e\.actor_user !== myUserId/);
  assert.doesNotMatch(eff, /isPushSubscribed/, "서버가 같은 알림을 안 보내니 구독이 있어도 띄운다");
  assert.match(eff, /ourdays:capsule-notified/);
});

test("화면 — 움직임 줄이기면 봉투를 건너뛰고, 본문은 표(정책)에서만 · 카드는 RPC 에서", () => {
  const ui = read("src/components/TimeCapsules.tsx");
  assert.match(ui, /prefers-reduced-motion: reduce/);
  assert.match(ui, /animate && !reducedMotion\(\) \? "sealed" : "letter"/);
  assert.match(ui, /canReply=\{reading\.createdBy !== myUserId\}/, "답장은 받은 편지에만");
  const data = read("src/lib/capsuleData.ts");
  assert.match(data, /rpc\("time_capsule_cards"/);
  assert.match(data, /from\("time_capsules"\)\.select\("id,body,photo_path,updated_at"\)/);
  assert.match(data, /CAPSULE_BUCKET = "capsule-photos"/);
  assert.match(data, /preparePhoto\(/, "사진첩과 같은 준비(1280px · EXIF 없이 다시 그린다)");
  const css = read("src/app/globals.css");
  const block = css.slice(css.indexOf("/* 타임캡슐 편지(2026-11-13"), css.indexOf("/* 움직임 줄이기 안전망"));
  assert.match(block, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(block, /infinite/, "반복 연출 없음");
});

test("내보내기 — 표 · 편지 사진(다른 버킷이라 따로)", () => {
  assert.ok((ACCOUNT_EXPORT_TABLES as readonly string[]).includes("time_capsules"));
  const tables = { time_capsules: [{ photo_path: "c/u/a.webp" }, { photo_path: null }, { photo_path: "../x" }] };
  assert.deepEqual(collectExportCapsulePhotoPaths(tables), ["c/u/a.webp"]);
  assert.deepEqual(collectExportMediaPaths(tables), [], "사진첩 버킷 목록에 섞지 않는다");
  const src = read("src/lib/accountData.ts");
  assert.match(src, /signedCapsulePhotoUrls\(batch\)/);
  assert.match(src, /dir: "media\/capsule-photos"/);
});

test("rls-verify — 새 표는 옛/새 비교에서 빼고 capsuleChecks 로 봉인을 잰다", () => {
  const rv = read("scripts/rls-verify.mjs");
  assert.match(rv, /const NEW_TABLES = \["time_capsules"\]/);
  assert.match(rv, /async function capsuleChecks\(db\)/);
  assert.match(rv, /report\.capsule\?\.ok === false/, "봉인 검사가 실패하면 종료 코드 1");
  for (const must of ["u2 가 보는 편지", "u2 사진", "u2 가 A 고치기", "열기 2회차", "purge 뒤 남은 편지"]) assert.ok(rv.includes(must), must);
});
