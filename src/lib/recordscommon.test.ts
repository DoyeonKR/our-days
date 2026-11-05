// 기록 공통 lock (2026-11-06) — 미디어 소유자 정책 · KST 오늘 · media-gc 주간 점검 · 혼자 시작하기 · 계정 삭제 안내.
//
// 1) storage.objects 가 for all 이라 같은 커플이면 상대가 올린 사진 · 일기 사진 · 로그 영상을 API 로 지우거나 덮어쓸 수 있었다.
//    보기는 커플, 올리기는 내 폴더 + 올린 사람이 나, 고치기/지우기는 올린 사람만(정책 의미는 PGlite 로 견줬다 — README 노트).
// 2) useDayTick 이 기기 날짜를 돌려줘 해외 기기에서 기록의 '오늘'이 저장 날짜(KST)와 하루 어긋났다.
// 3) 고아 파일 점검이 손으로만 돌았다 — 주 1회 dry-run 크론(삭제 없음 · 비밀은 DB 안에서 복사).
// 4) 상대가 없으면 기록 화면이 전부 막혀 있었다 — '혼자 시작하기'는 초대코드 만들기와 같은 1인 공간.
// 5) 계정 삭제가 상대 화면의 기록까지 지운다는 걸 말하지 않았다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kstDayKey, localDayKey, msUntilNextKstMidnight, msUntilNextLocalMidnight } from "./daytick.ts";
import { deletionImpact, isSoloSpace, SOLO_LEAVE_DETAIL } from "./solospace.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const sqlNoComments = (s: string) => s.replace(/--[^\n]*/g, "");
const tsNoComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1");
const jsxNoComments = (s: string) => tsNoComments(s).replace(/\{\s*\}/g, "");

const MIG_FILE = "supabase/migrations/20261106030000_records_common.sql";
const migration = read(MIG_FILE).trim();
const mig = sqlNoComments(migration);
const schema = read("supabase/schema.sql");

// ── 1) storage 정책 ────────────────────────────────────────────────────────────

test("★ schema.sql 끝의 복사본이 migration 과 같다(신규 bootstrap = 운영)", () => {
  assert.ok(schema.includes(migration), "schema.sql 에 records_common 복사본이 없거나 다르다 — 둘을 같이 고친다");
});

/** schema.sql 을 처음부터 끝까지 읽어, 마지막에 살아 있는 storage.objects 정책의 본문. */
function liveStoragePolicies(sql: string): Map<string, string> {
  const live = new Map<string, string>();
  for (const stmt of sqlNoComments(sql).split(/;\s*\n/)) {
    const s = stmt.trim();
    const drop = /^drop policy if exists (\w+) on storage\.objects$/.exec(s);
    if (drop) live.delete(drop[1]);
    const create = /^create policy (\w+) on storage\.objects ([\s\S]*)$/.exec(s);
    if (create) live.set(create[1], create[2]);
  }
  return live;
}

test("★ 최종 storage 정책 = 보기 · 올리기 · 고치기 · 지우기 넷, for all 없음, 전부 to authenticated", () => {
  const live = liveStoragePolicies(schema);
  assert.deepEqual(
    [...live.keys()].sort(),
    ["couple_photos_obj_delete", "couple_photos_obj_insert", "couple_photos_obj_select", "couple_photos_obj_update"],
  );
  for (const [name, body] of live) {
    assert.doesNotMatch(body, /\bfor all\b/, `${name}: for all 이면 상대 파일을 지울 수 있다`);
    assert.match(body, /\bto authenticated\b/, `${name}: 로그인 안 한 요청에 열 이유가 없다`);
    assert.doesNotMatch(body, /is_couple_member\(/, `${name}: 행마다 함수 — private.my_couple_ids() 집합으로`);
    assert.match(body, /\(storage\.foldername\(name\)\)\[1\] in \(select \(private\.my_couple_ids\(\)\)::text\)/, `${name}: 내 커플 폴더만`);
    assert.doesNotMatch(body.replaceAll("(select auth.uid())", ""), /auth\.uid\(\)/, `${name}: (select auth.uid()) 로 한 번만`);
    assert.match(body, /not private\.deco_photo_blocked\(name\)/, `${name}: 옛 비밀일기 사진 가드는 그대로 둔다`);
  }
  assert.match(live.get("couple_photos_obj_select")!, /^for select to authenticated/);
  assert.doesNotMatch(live.get("couple_photos_obj_select")!, /owner/, "보기는 커플 전체 — 상대 사진도 본다");
  const owner = /\(owner_id = \(select auth\.uid\(\)\)::text or owner = \(select auth\.uid\(\)\)\)/;
  for (const name of ["couple_photos_obj_insert", "couple_photos_obj_update", "couple_photos_obj_delete"]) {
    assert.match(live.get(name)!, owner, `${name}: 올린 사람만(owner_id · 옛 owner 둘 다 본다)`);
  }
  // update 는 using 과 with check 둘 다 소유자 — 고치면서 남의 것으로 바꾸지 못한다
  assert.equal((live.get("couple_photos_obj_update")!.match(new RegExp(owner.source, "g")) ?? []).length, 2);
});

test("migration 은 여러 번 돌려도 같다 — 정책마다 drop policy if exists 가 짝, 옛 couple_photos_obj_all 을 내린다", () => {
  assert.match(mig, /drop policy if exists couple_photos_obj_all on storage\.objects;/);
  for (const m of mig.matchAll(/create policy (\w+) on storage\.objects/g)) {
    assert.ok(mig.includes(`drop policy if exists ${m[1]} on storage.objects;`), `${m[1]}: drop 짝이 없다`);
  }
  assert.doesNotMatch(mig, /\b(delete from|truncate|drop table|alter table)\b/i, "행 · 표를 건드리지 않는다(비파괴)");
  assert.match(mig, /^begin;/m);
  assert.match(mig, /^commit;\s*$/m);
});

test("앱은 storage 파일을 덮어쓰지 않는다(upsert 없음) — 고치기가 올린 사람만이어도 흐름이 안 깨진다", () => {
  const couple = tsNoComments(read("src/lib/couple.ts"));
  assert.doesNotMatch(couple, /upsert:\s*true/, "upsert 업로드는 UPDATE 정책을 탄다 — 상대 파일이면 실패한다");
  assert.doesNotMatch(couple, /\.storage[\s\S]{0,40}\.(move|copy|update)\(/, "storage move/copy/update 는 소유자만 된다");
  // 상대 사진 삭제: 행은 지워지고 파일 remove 는 RLS 에 걸려 조용히 건너뛴다 → media-gc 가 수거. 실패가 화면 오류가 되면 안 된다.
  const del = couple.slice(couple.indexOf("export async function deletePhoto("), couple.indexOf("export async function signedPhotoUrl("));
  assert.match(del, /\.remove\(paths\)[\s\S]*?\.catch\(\(\) => \{\}\)/, "파일 삭제는 best-effort 여야 한다");
});

// ── 3) media-gc 주간 점검 ───────────────────────────────────────────────────────

test("★ media-gc 크론 — dry-run 본문만, 비밀은 쓰지 않고 DB 안에서 복사, 크론 없는 bootstrap 은 건너뜀", () => {
  assert.match(mig, /if to_regclass\('cron\.job'\) is null then\s+return;/);
  assert.doesNotMatch(migration, /x-cron-secret|CRON_SECRET|service_role|eyJ/i, "비밀(이름조차) 을 적지 않는다");
  assert.match(mig, /where jobname = 'daily-reminders'/, "기존 작업의 명령을 복사한다");
  assert.match(mig, /body := ''\{"dry_run": true\}''::jsonb/, "본문을 dry-run 으로 갈아 끼운다");
  assert.match(mig, /v_cmd ~\* 'confirm'/, "confirm 이 섞이면 걸지 않는다(삭제 금지)");
  assert.doesNotMatch(mig.replace(/v_cmd ~\* 'confirm'/, ""), /confirm/, "본문 어디에도 confirm 을 넣지 않는다");
  assert.ok(mig.indexOf("cron.unschedule") < mig.indexOf("cron.schedule("), "지우고 다시 건다(멱등)");
  assert.match(mig, /cron\.schedule\('media-gc-weekly-dryrun', '0 19 \* \* 6', \$1\)/, "일요일 04:00 KST(토 19:00 UTC)");
  for (const m of mig.matchAll(/raise notice '([^']*)'(.*);/g)) {
    assert.equal(m[2].trim(), "", "notice 에 명령 본문을 싣지 않는다(비밀이 로그에 남는다)");
  }
});

// ── 2) KST 오늘 ────────────────────────────────────────────────────────────────

test("★ 기록용 오늘 = KST — 해외 기기에서도 저장 날짜와 같다", () => {
  // LA 2026-11-05 18:00 (UTC 11-06 02:00) = KST 11-06 11:00
  const la = Date.UTC(2026, 10, 6, 2, 0, 0);
  assert.equal(kstDayKey(la), "2026-11-06");
  // KST 자정 직전 · 직후
  const kstMidnight = Date.UTC(2026, 10, 5, 15, 0, 0); // = KST 11-06 00:00
  assert.equal(kstDayKey(kstMidnight - 1), "2026-11-05");
  assert.equal(kstDayKey(kstMidnight), "2026-11-06");
});

test("KST 자정 타이머 — 다음 KST 자정 + 5초, 하루를 넘지 않는다", () => {
  const kstMidnight = Date.UTC(2026, 10, 5, 15, 0, 0);
  assert.equal(msUntilNextKstMidnight(kstMidnight - 1000), 1000 + 5000);
  assert.equal(msUntilNextKstMidnight(kstMidnight), 86_400_000 + 5000);
  for (let t = kstMidnight; t < kstMidnight + 86_400_000; t += 3_599_999) {
    const ms = msUntilNextKstMidnight(t);
    assert.ok(ms >= 1000 && ms <= 86_405_000);
    assert.notEqual(kstDayKey(t + ms), kstDayKey(t), "타이머가 울리면 날짜가 바뀌어 있다");
  }
});

test("기기 날짜 훅은 그대로 기기 자정 — D-day 전용", () => {
  const now = new Date(2026, 10, 5, 23, 59, 58).getTime();
  assert.equal(localDayKey(now), "2026-11-05");
  const ms = msUntilNextLocalMidnight(now);
  assert.equal(localDayKey(now + ms), "2026-11-06");
  assert.ok(ms <= 8000);
});

test("★ 호출부 — 기록 카드는 useDayTick(KST), 홈 D-day 만 useLocalDayTick", () => {
  const hook = tsNoComments(read("src/lib/useDayTick.ts"));
  assert.match(hook, /export function useDayTick\(\): string \{\s*return useDayKey\(kstDayKey, msUntilNextKstMidnight\);/);
  assert.match(hook, /export function useLocalDayTick\(\): string \{\s*return useDayKey\(localDayKey, msUntilNextLocalMidnight\);/);
  for (const f of ["MemoryTeaser", "MoodLine", "DecoBook", "DailyQuestion", "StreakChip", "MemoriesRecap"]) {
    const src = tsNoComments(read(`src/components/${f}.tsx`));
    assert.match(src, /= useDayTick\(\)/, `${f} 가 KST 오늘을 안 쓴다`);
    assert.doesNotMatch(src, /useLocalDayTick/, `${f} 는 기록 화면이다 — 기기 날짜를 쓰면 저장 날짜와 갈린다`);
  }
  const page = tsNoComments(read("src/app/page.tsx"));
  assert.match(page, /const dayKey = useLocalDayTick\(\)/, "홈 D-day 는 dday.ts(기기 날짜)와 같은 자정에 갱신해야 한다");
});

// ── 4) 혼자 시작하기 ───────────────────────────────────────────────────────────

test("★ 혼자 시작하기 = 초대코드 만들기와 같은 RPC · 만든 뒤 page · CoupleSync 가 다시 읽는다", () => {
  const couple = tsNoComments(read("src/lib/couple.ts"));
  const solo = couple.slice(couple.indexOf("export async function startSoloSpace("), couple.indexOf("export async function joinCouple("));
  assert.match(solo, /await createCouple\(nickname, startDate\)/, "새 RPC · 새 정책을 만들지 않는다 — 1인 공간은 create_couple 그대로");
  assert.match(solo, /notifyCoupleChanged\(\)/);
  assert.match(solo, /getMyCouple\(\)/, "이미 공간이 있으면 오류 대신 다시 읽는다");
  assert.doesNotMatch(couple, /rpc\("(start_solo|merge_couple|move_records)/, "병합 RPC 는 만들지 않았다(위험 — 경고로 대신)");
  const page = tsNoComments(read("src/app/page.tsx"));
  assert.match(page, /onCoupleChanged\(\(\) => void refresh\(\)/, "page 가 공간 변경을 다시 읽지 않는다");
  const sync = tsNoComments(read("src/components/CoupleSync.tsx"));
  assert.match(sync, /onCoupleChanged\(\(\) => \{/, "CoupleSync 가 공간 변경을 다시 읽지 않는다");
});

test("★ ConnectFirst — '혼자 시작하기'(백엔드 있을 때) + '커플 연결하기'", () => {
  const cf = jsxNoComments(read("src/components/ConnectFirst.tsx"));
  assert.ok(cf.includes("혼자 시작하기") && cf.includes("커플 연결하기"));
  assert.match(cf, /startSoloSpace\(/);
  assert.match(cf, /\{isSupabaseConfigured && \(\s*<button/, "로컬 모드(백엔드 없음)에서는 공간을 만들 곳이 없다");
  assert.match(cf, /disabled=\{busy\}/, "두 번 눌러 공간이 둘 생기면 안 된다");
});

test("★ 혼자 쓰던 공간을 떠날 때 — 내보내기 먼저 · 기록은 따라가지 않는다고 말한다", () => {
  assert.ok(isSoloSpace(1) && !isSoloSpace(2));
  assert.match(SOLO_LEAVE_DETAIL, /옮겨지지 않/);
  for (const word of ["일기", "사진", "3초 로그", "우리 섬"]) assert.ok(SOLO_LEAVE_DETAIL.includes(word), word);
  const sync = tsNoComments(read("src/components/CoupleSync.tsx"));
  const leave = sync.slice(sync.indexOf("async function handleLeave"), sync.indexOf("await leaveCouple("));
  assert.match(leave, /if \(solo && \(await confirmDialog\(\{ \.\.\.SOLO_EXPORT_FIRST \}\)\)\) \{\s*onOpenAccount\(\);\s*return;/);
  assert.match(leave, /solo\s*\?\s*SOLO_LEAVE_DETAIL/);
  assert.match(sync, /isSoloSpace\(members\.length\)\s*\?\s*SOLO_INVITE_CONFLICT/, "혼자 쓰는 중에 남의 초대 링크로 오면 기록이 안 따라간다고 말한다");
});

// ── 5) 계정 삭제 안내 ──────────────────────────────────────────────────────────

test("★ 계정 삭제 안내 = purge_account_data 가 실제로 지우는 것", () => {
  const all = schema.split("create or replace function public.purge_account_data(p_user uuid)");
  const purge = sqlNoComments(all[all.length - 1].slice(0, all[all.length - 1].indexOf("$$;")));
  for (const t of ["deco_entries", "couple_logs", "couple_photos", "qa_answers", "mood_checkins", "pokes", "activity_events"]) {
    assert.match(purge, new RegExp(`delete from public\\.${t} where`), `purge 가 ${t} 를 지우지 않으면 안내를 고친다`);
  }
  for (const t of ["couple_events", "couple_bucket", "couple_island"]) {
    assert.match(purge, new RegExp(`update public\\.${t}`), `purge 가 ${t} 를 상대에게 넘기지 않으면 안내를 고친다`);
  }
  const pair = deletionImpact("pair", "민지");
  assert.match(pair.lead, /민지님 화면에서도/);
  const gone = pair.gone.join(" ");
  for (const w of ["일기", "반응·댓글", "사진", "3초 로그", "질문", "기분", "쿡"]) assert.ok(gone.includes(w), w);
  assert.match(pair.kept.join(" "), /일정 · 버킷리스트 · 우리 섬/);
  assert.equal(deletionImpact("solo", null).kept.length, 0);
  assert.match(deletionImpact("solo", null).lead, /모두 함께 삭제/);
});

test("AccountSection — 삭제 칸에 상대가 잃는 것 목록 + '내보내기 먼저'", () => {
  const src = jsxNoComments(read("src/components/AccountSection.tsx"));
  const del = src.slice(src.indexOf('mode === "delete" && ('));
  assert.match(del, /deletionImpact\(space\?\.kind \?\? "pair"/, "모를 땐 상대가 있다고 보고 더 말한다");
  assert.match(del, /impact\.gone\.map/);
  assert.match(del, /onClick=\{\(\) => void runExport\("archive"\)\}[\s\S]*?내보내기 먼저/);
  assert.ok(del.indexOf("내보내기 먼저") < del.indexOf("계정 영구 삭제"), "내보내기가 삭제 버튼보다 먼저 보인다");
});
