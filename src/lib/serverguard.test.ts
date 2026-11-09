// 서버 지키기 lock (2026-11-09 서버 리뷰 "Fix all") — README §10.21.
// migration 20261107060000_review_guard 와 엣지 함수 넷(manage-account · daily-reminders · adventure-battle · send-poke-push)의
// 고친 줄을 소스에서 잠근다. 주석은 지우고 본다(설명문이 먼저 잡히지 않게 — README §10.5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FAMILIES } from "./aquarium.ts";
import { newSave } from "./adventure.ts";
import { botTeam, pickTeam, startDuel } from "./adventurepvp.ts";
import { duelInput, newArena, record, stepArena, think, type LogEntry } from "./arena.ts";

const root = join(import.meta.dirname, "..", "..");
const raw = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const sqlCode = (p: string) => raw(p).replace(/--[^\n]*/g, "");
const tsCode = (p: string) =>
  raw(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const MIG = "supabase/migrations/20261107060000_review_guard.sql";
const mig = sqlCode(MIG);
const migFiles = readdirSync(join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();

/** 이 migration 안의 함수 하나의 본문 */
function fnBody(name: string): string {
  const i = mig.indexOf(`create or replace function ${name}(`);
  assert.ok(i >= 0, `${name} 정의가 없다`);
  const j = mig.indexOf("$$;", i);
  return mig.slice(i, j);
}

/** 가장 최근 migration 의 정의가 이 파일인지 — 뒤 파일이 옛 정의로 덮으면 고친 것이 사라진다 */
function latestDefiner(name: string): string {
  const re = new RegExp(`create or replace function ${name.replace(".", "\\.")}\\s*\\(`, "i");
  const hits = migFiles.filter((f) => re.test(sqlCode(`supabase/migrations/${f}`)));
  return hits[hits.length - 1];
}

test("migration — 가장 큰 번호 · 한 트랜잭션 · 새 CHECK 는 전부 NOT VALID · 행을 지우지 않는다", () => {
  assert.equal(migFiles[migFiles.length - 1], "20261107060000_review_guard.sql");
  assert.match(mig, /^begin;$/m);
  assert.match(mig.trimEnd(), /commit;$/);
  const checks = [...mig.matchAll(/add constraint (\w+)[\s\S]*?;/g)];
  assert.ok(checks.length >= 4);
  for (const c of checks) assert.match(c[0], /\) not valid;$/, `${c[1]} — 이미 있는 행을 검사하면 운영 적용이 멈출 수 있다`);
  assert.doesNotMatch(mig, /\bdelete from\b|\btruncate\b|\bdrop table\b/i);
});

test("① 모험 저장 — 합친 결과의 크기도 300KB 까지(PT422) · 서명 · 권한 그대로", () => {
  assert.equal(latestDefiner("public.adventure_save"), "20261107060000_review_guard.sql");
  const f = fnBody("public.adventure_save");
  assert.match(f, /octet_length\(\(coalesce\(v_old, '\{\}'::jsonb\) \|\| p_state\)::text\) > 300000 then\s+raise exception 'bad state' using errcode = 'PT422'/);
  assert.ok(f.indexOf("for update") < f.indexOf("update public.adventure_saves"), "잠그고 잰 뒤에 쓴다");
  assert.match(f, /set state = adventure_saves\.state \|\| p_state/, "최상위 칸 합치기는 그대로(옛 번들이 모르는 칸을 못 지운다)");
  assert.match(mig, /grant execute on function public\.adventure_save\(jsonb, integer\) to authenticated;/);
});

test("② 미디어 경로 — 행의 경로는 그 행의 커플 폴더 아래만(CHECK) · 계정 삭제는 내가 올린 파일만 지운다", () => {
  assert.match(mig, /add constraint couple_photos_path_in_couple\s+check \(starts_with\(storage_path, couple_id::text \|\| '\/'\)/);
  assert.match(mig, /thumb_path is null or starts_with\(thumb_path, couple_id::text \|\| '\/'\)/);
  assert.match(mig, /video_path is null or starts_with\(video_path, couple_id::text \|\| '\/'\)/);
  assert.match(mig, /poster_path is null or starts_with\(poster_path, couple_id::text \|\| '\/'\)/);
  assert.match(mig, /public\.media_paths_in_couple\(photo_paths, couple_id\)\s+and public\.media_paths_in_couple\(thumb_paths, couple_id\)/);
  // 앱이 만드는 경로는 늘 '<커플 id>/…' — 바뀌면 CHECK 가 새 업로드를 거절한다
  const couple = tsCode("src/lib/couple.ts");
  for (const m of couple.matchAll(/const (?:path|thumbPath|p|tp) = `([^`]*)`/g)) {
    assert.match(m[1], /^\$\{coupleId\}\//, `업로드 경로가 커플 폴더 밖: ${m[1]}`);
  }
  // 소유자 조회 RPC — 서비스 롤만
  const owned = fnBody("public.account_owned_media");
  assert.match(owned, /o\.owner_id = p_user::text or o\.owner = p_user/);
  assert.match(mig, /revoke all on function public\.account_owned_media\(uuid, text\[\]\) from public, anon, authenticated;/);
  assert.match(mig, /grant execute on function public\.account_owned_media\(uuid, text\[\]\) to service_role;/);

  const edge = tsCode("supabase/functions/manage-account/index.ts");
  assert.match(edge, /admin\.rpc\("account_owned_media", \{/);
  assert.match(edge, /if \(ownedError\) \{\s*ownerLookupFailed = true;\s*ownedPaths\.clear\(\);/, "조회 실패면 행 경로는 하나도 지우지 않는다");
  assert.match(edge, /const allPaths = \[\.\.\.new Set\(\[\.\.\.folderPaths, \.\.\.ownedPaths\]\)\];/, "지우는 것은 빈 공간 폴더 + 내가 올린 파일뿐");
  assert.doesNotMatch(edge, /\bpaths\.add\(/, "행 경로를 그대로 지울 목록에 넣던 옛 길");
  assert.ok(edge.indexOf('admin.rpc("account_owned_media"') < edge.indexOf('admin.rpc("purge_account_data"'), "소유 조회는 행이 지워지기 전에");
});

test("② 90일 영상 정리 — 돌려주는 경로는 그 로그의 커플 폴더 아래 · 작성자가 올린 파일만(아니면 null 한 줄)", () => {
  assert.equal(latestDefiner("public.expire_log_videos"), "20261107060000_review_guard.sql");
  const f = fnBody("public.expire_log_videos");
  assert.match(f, /returns table \(log_id uuid, path text\)/, "서명 그대로 — 옛 daily-reminders 도 그대로 부른다");
  assert.match(f, /and not l\.keep/);
  assert.match(f, /least\(greatest\(coalesce\(p_limit, 0\), 0\), 500\)/);
  assert.match(f, /for update of l skip locked/);
  assert.match(f, /p_keep_days < 30/);
  assert.equal((f.match(/starts_with\(r\.expired_(path|poster), r\.expired_couple::text \|\| '\/'\)/g) ?? []).length, 2);
  assert.equal((f.match(/o\.owner_id = r\.expired_by::text or o\.owner = r\.expired_by/g) ?? []).length, 2);
  assert.match(f, /if not v_any then\s+log_id := r\.expired_id;\s+path := null;\s+return next;/, "편 수는 그대로 센다");
  // 함수는 null 경로를 건너뛴다
  assert.match(tsCode("supabase/functions/daily-reminders/index.ts"), /filter\(\(p\): p is string => typeof p === "string" && p\.length > 0\)/);
});

test("③ 예약 알림 — 한 번에 장부 · 한 사람 20개 · 커플마다 따로 잡기 · 시간 예산 뒤에도 영상 정리", () => {
  const fn = tsCode("supabase/functions/daily-reminders/index.ts");
  assert.match(fn, /const MAX_REMINDERS_PER_MEMBER = 20;/);
  assert.match(fn, /const REMINDER_BUDGET_MS = 18_000;/);
  const many = fn.slice(fn.indexOf("async function claimMany("), fn.indexOf("async function release("));
  assert.match(many, /\.upsert\(keys\.map\(\(rKey\) => \(\{ user_id: userId, sent_on: sentOn, r_key: rKey \}\)\), \{ onConflict: "user_id,sent_on,r_key", ignoreDuplicates: true \}\)/, "키 형식 · 장부는 옛 함수와 같다");
  assert.match(many, /if \(error\) throw error;/);
  assert.doesNotMatch(fn, /for \(const r of rems\) \{\s*if \(await claim\(/, "알림마다 왕복하던 옛 길");
  const loop = fn.slice(fn.indexOf("for (const c of couples ?? [])"), fn.indexOf("expireOldLogVideos(sb);\n    }"));
  assert.match(loop, /if \(Date\.now\(\) - started > REMINDER_BUDGET_MS\) \{\s*coupleSkipped\+\+;\s*continue;/);
  assert.match(loop, /try \{[\s\S]*\} catch \(err\) \{\s*coupleErrors\+\+;/, "한 커플 오류가 실행을 멈추지 않는다");
  assert.ok(fn.indexOf("REMINDER_BUDGET_MS) {") < fn.indexOf("videos = await expireOldLogVideos(sb)"), "영상 정리는 알림 뒤에 늘 돈다");
  assert.ok(18_000 + 8_000 < 30_000, "알림 예산 + 영상 정리 예산 < 크론 대기 30초");
});

/** adventure-battle 의 logTooDense 와 같은 식 — 아래 테스트가 소스에 이 식이 있는지 같이 본다 */
const SLACK = 300;
const tooDense = (log: readonly (readonly number[])[]) => log.length > new Set(log.map((e) => e[0])).size * 2 + SLACK;

test("④ 대전 입력 기록 — 한 틱에 몰린 기록은 거절 · 거절한 판엔 기록을 안 남긴다 · 표에 크기 상한", () => {
  const fn = tsCode("supabase/functions/adventure-battle/index.ts");
  assert.match(fn, /const LOG_BURST_SLACK = 300;/);
  assert.match(fn, /return log\.length > ticks\.size \* 2 \+ LOG_BURST_SLACK;/);
  assert.match(fn, /if \(!validLog\(body\.log\) \|\| logTooDense\(body\.log\)\) \{/);
  for (const reason of ["too slow", "bad log", "too fast"]) assert.match(fn, new RegExp(`rejectedLog\\("${reason}", body\\.log\\)`), reason);
  assert.doesNotMatch(fn, /validLog\(body\.log\) \? body\.log : null/, "늦은 판에 기록을 남기던 옛 길");
  assert.deepEqual(fn.match(/finish\(admin, m, [\w.]+, [\w.]+, body\.log\)/g), ["finish(admin, m, a.b, a.tick, body.log)"], "body.log 를 그대로 남기는 건 받아들인 판 하나뿐");
  // 엔진 복사본은 건드리지 않았다(지문이 바뀌면 배포된 함수와 갈린다)
  assert.doesNotMatch(raw("supabase/functions/_shared/adventure/arena.ts"), /logTooDense/);
  assert.match(mig, /add constraint adventure_matches_log_size\s+check \(log is null or octet_length\(log::text\) <= 200000\) not valid;/);

  // 공격 모양은 걸리고, 엔진으로 실제로 둔 판은 안 걸린다
  assert.ok(tooDense(Array.from({ length: 9000 }, () => [10, 1, 0, 0])), "9000칸이 한 틱");
  const save = newSave("conch_2", 3);
  const mine = pickTeam(save, [save.party[0].id]);
  for (const seed of [3, 11, 29]) {
    const a = newArena(startDuel(mine, botTeam(6, 0, "2026-11-08").team, seed, ["나", "상대"]), null);
    const rng = { s: seed };
    const log: LogEntry[] = [];
    let lastDir = 0;
    let guard = 0;
    while (!a.b.over && guard++ < 20_000) {
      const inp = duelInput(think(a, 0, rng, 1));
      lastDir = record(log, lastDir, a.tick, inp);
      stepArena(a, inp);
    }
    assert.ok(log.length > 0);
    assert.equal(tooDense(log), false, `정상 판(시드 ${seed})이 거절된다`);
    assert.ok(JSON.stringify(log).length < 200_000, "정상 기록은 표 상한 안");
  }
});

test("⑤ 섬 저장 — 객체 · 1,000,000 바이트까지(PT422) · 충돌은 그대로 PT409 · 권한 그대로", () => {
  assert.equal(latestDefiner("public.island_action"), "20261107060000_review_guard.sql");
  const f = fnBody("public.island_action");
  assert.match(f, /jsonb_typeof\(p_state\) <> 'object' or octet_length\(p_state::text\) > 1000000 then\s+raise exception 'bad state' using errcode = 'PT422'/);
  assert.match(f, /raise exception 'stale' using errcode = 'PT409'/);
  assert.match(mig, /revoke execute on function public\.island_action\(integer, jsonb\) from public, anon;/);
  assert.match(mig, /grant execute on function public\.island_action\(integer, jsonb\) to authenticated;/);
});

test("⑥ 낚시 순위 — 계열 목록이 aquarium.ts 의 FAMILIES 와 같다(새 계열 = 새 migration)", () => {
  const ok = fnBody("private.fish_family_ok");
  const list = [...ok.slice(ok.indexOf("array[")).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...list].sort(), FAMILIES.map((f) => f.key).sort(), "앱에 계열을 더했으면 이 목록을 새 migration 으로 더한다(README §10.21)");
  assert.equal(new Set(list).size, list.length);
});

test("⑥ 낚시 순위 — 닉네임 · 이름은 merge_clean_nick 규칙으로 · 모르는 계열은 크기 순위 없이 점수만", () => {
  assert.equal(latestDefiner("public.submit_fish_catch"), "20261107060000_review_guard.sql");
  assert.equal(latestDefiner("public.fish_size_board_all"), "20261107060000_review_guard.sql");
  assert.match(fnBody("private.clean_board_text"), /when public\.merge_clean_nick\(p_text\) is null then null/);
  const sub = fnBody("public.submit_fish_catch");
  assert.match(sub, /v_nick\s+text := coalesce\(private\.clean_board_text\(p_nickname, 20\), '이름 없음'\);/);
  assert.match(sub, /v_name\s+text := coalesce\(private\.clean_board_text\(p_name, 30\), ''\);/);
  assert.match(sub, /v_family text := case when private\.fish_family_ok\(btrim\(p_family\)\) then btrim\(p_family\) else null end;/);
  assert.match(sub, /or v_family is null or p_cm is null/, "모르는 계열은 길이도 안 받는다");
  assert.doesNotMatch(sub, /raise exception[^;]*family/i, "모르는 계열로 잡은 것 전체를 거절하지 않는다(옛 앱이 점수를 잃는다)");
  // 점수 공식 · 상한은 그대로
  for (const s of ["10 * power(1.8::double precision, v_grade)", "when 2 then 2 when 1 then 1.3", "1 + 0.5 * v_q", "v_pts := 2", ">= 300 then", "interval '2 seconds'"]) assert.ok(sub.includes(s), s);
  const board = fnBody("public.fish_size_board_all");
  assert.match(board, /and private\.fish_family_ok\(c\.family\)/);
  assert.match(board, /coalesce\(private\.clean_board_text\(n\.nickname, 20\), '이름 없음'\) as name/);
  assert.match(board, /coalesce\(private\.clean_board_text\(b\.catch_name, 30\), ''\) as catch_name/);
  assert.match(mig, /grant execute on function public\.submit_fish_catch\(text, text, integer, integer, double precision, boolean, boolean, boolean, text, double precision\) to authenticated;/);
  assert.match(mig, /grant execute on function public\.fish_size_board_all\(\) to authenticated;/);
  assert.match(mig, /revoke all on function private\.clean_board_text\(text, integer\) from public, anon, authenticated;/);
  assert.match(mig, /revoke all on function private\.fish_family_ok\(text\) from public, anon, authenticated;/);
});

test("⑦ 쿡 푸시 — 아는 종류만(모르면 poke) · 제목 60 · 본문 200 · 내부 오류 문구를 응답에 안 싣는다", () => {
  const fn = tsCode("supabase/functions/send-poke-push/index.ts");
  const m = /const PUSH_CATEGORIES = new Set\(\[([^\]]*)\]\)/.exec(fn);
  assert.ok(m);
  const allowed = [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]).sort();
  const notify = tsCode("src/lib/notify.ts");
  const union = notify.slice(notify.indexOf("export type NotifyCategory ="), notify.indexOf(";", notify.indexOf("export type NotifyCategory =")));
  const app = [...union.matchAll(/"([a-z]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(allowed, app, "앱이 보내는 종류와 함수가 받는 종류가 다르다");
  assert.match(fn, /const category = typeof rawCategory === "string" && PUSH_CATEGORIES\.has\(rawCategory\) \? rawCategory : "poke";/);
  assert.match(fn, /const TITLE_MAX = 60;/);
  assert.match(fn, /const BODY_MAX = 200;/);
  assert.match(fn, /const title = clip\(rawTitle, TITLE_MAX\);/);
  assert.match(fn, /const message = clip\(rawMessage, BODY_MAX\);/);
  assert.doesNotMatch(fn, /json\(\{ error: error\.message \}/);
  assert.doesNotMatch(fn, /error: [a-zA-Z]+\.message/);
});

test("⑧ 진단 로그 — 사람마다 1시간 300줄(PT429) · 서비스 롤 · 로그인 없음은 세지 않는다 · 앱은 오류를 삼킨다", () => {
  const f = fnBody("private.debug_logs_rate");
  assert.match(f, /security definer\s+set search_path = ''/);
  assert.match(f, /if v_uid is null or coalesce\(\(select auth\.role\(\)\)::text, ''\) = 'service_role' then\s+return new;/);
  assert.match(f, /d\.created_at > now\(\) - interval '1 hour'\s+limit 300/);
  assert.match(f, /if n >= 300 then\s+raise exception 'too many debug logs' using errcode = 'PT429';/);
  assert.match(mig, /create trigger debug_logs_rate before insert on public\.debug_logs\s+for each row execute function private\.debug_logs_rate\(\);/);
  assert.match(mig, /revoke all on function private\.debug_logs_rate\(\) from public, anon, authenticated;/);
  const debug = tsCode("src/lib/debug.ts");
  const log = debug.slice(debug.indexOf("export async function logDebug("), debug.indexOf("export async function getDebugLogs("));
  assert.match(log, /try \{[\s\S]*await sb\.from\("debug_logs"\)\.insert\(/);
  assert.match(log, /\} catch \{/);
  assert.doesNotMatch(log, /\.insert\([\s\S]*?\)\s*;?\s*if \(error\)/, "insert 오류를 화면으로 올리지 않는다");
});

test("README §10.21 — 다시 배포할 함수 넷 · 롤백", () => {
  const md = raw("README.md");
  const i = md.indexOf("## 10.21 서버 지키기 (2026-11-09)");
  const j = md.indexOf("## 11.", i);
  assert.ok(i > md.indexOf("## 10.20") && j > i, "§10.20 뒤 · §11 앞");
  const sec = md.slice(i, j);
  for (const f of ["manage-account", "daily-reminders", "send-poke-push", "adventure-battle"]) assert.ok(sec.includes(f), f);
  assert.match(sec, /\*\*롤백\*\*/);
  for (const s of ["couple_photos_path_in_couple", "adventure_matches_log_size", "debug_logs_rate", "account_owned_media"]) assert.ok(sec.includes(s), s);
});
