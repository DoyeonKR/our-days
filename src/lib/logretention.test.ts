// 3초 로그 영상 보관 기간 lock. [2026-09-24]
// 사용자 데이터를 지우는 일이라 '무엇을 · 언제 · 어떤 순서로'가 코드 한 줄에 흔들리면 안 된다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOG_VIDEO_KEEP_DAYS, logVideoExpired } from "./logretention.ts";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const migration = read("supabase/migrations/20260924010000_log_video_retention.sql").trim();
const sqlCode = migration.replace(/--[^\n]*/g, "");
const fn = read("supabase/functions/daily-reminders/index.ts");

test("신규 bootstrap은 영상 보관 migration 을 원문 그대로 포함한다", () => {
  assert.ok(read("supabase/schema.sql").includes(migration), "schema.sql 끝의 복사본이 migration 과 달라졌어요");
});

test("migration 은 표·행을 지우지 않는다 — 열 하나 · 제약 완화 · 함수 하나", () => {
  assert.doesNotMatch(sqlCode, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.match(sqlCode, /add column if not exists video_expired_at timestamptz/);
  // 영상만 있던 로그에서 영상을 떼도 제약에 안 걸려야 한다 — 정리된 로그만 예외
  assert.match(sqlCode, /video_path is not null\s+or video_expired_at is not null\s+or \(body is not null and length\(trim\(body\)\) > 0\)/);
});

test("정리 함수 — 서비스롤 전용 · 30일 바닥 · KST log_date 기준 · 회당 상한", () => {
  assert.match(sqlCode, /auth\.role\(\)::text, ''\) <> 'service_role'/);
  assert.match(sqlCode, /p_keep_days < 30/, "0·7 같은 값으로 최근 영상이 날아갈 수 있다");
  assert.match(sqlCode, /log_date < \(now\(\) at time zone 'Asia\/Seoul'\)::date - p_keep_days/);
  assert.match(sqlCode, /least\(greatest\(coalesce\(p_limit, 0\), 0\), 500\)/);
  assert.match(sqlCode, /for update of l skip locked/, "같이 도는 호출이 같은 행을 두 번 집는다");
  assert.match(sqlCode, /set video_path = null, video_expired_at = now\(\)/);
  assert.match(sqlCode, /revoke all on function public\.expire_log_videos\(int, int\) from public, anon, authenticated/);
  assert.match(sqlCode, /grant execute on function public\.expire_log_videos\(int, int\) to service_role/);
});

test("서버와 화면이 같은 보관 기간을 말한다", () => {
  const m = /const LOG_VIDEO_KEEP_DAYS = (\d+);/.exec(fn);
  assert.ok(m, "daily-reminders 에 보관 기간 상수가 없다");
  assert.equal(Number(m![1]), LOG_VIDEO_KEEP_DAYS, "서버가 지우는 날과 화면 안내가 다르다");
  assert.ok(LOG_VIDEO_KEEP_DAYS >= 30, "DB 함수의 바닥(30일)보다 짧으면 정리가 매번 실패한다");
});

test("정리 순서 — DB 에서 먼저 떼고 파일은 그다음(실패 잔여물은 고아 파일)", () => {
  const code = noComments(fn);
  const rpc = code.indexOf('sb.rpc("expire_log_videos"');
  const remove = code.indexOf(".storage.from(MEDIA_BUCKET).remove(");
  assert.ok(rpc >= 0 && remove > rpc, "파일을 먼저 지우면 깨진 영상이 남는다");
  assert.match(code, /error\.code === "PGRST202"/, "migration 을 안 돌린 상태에서 매번 오류로 떠든다");
  // 정리 실패가 알림 응답을 500 으로 만들면 안 된다 — 따로 잡는다
  const step = code.slice(code.indexOf("videos = await expireOldLogVideos(sb)") - 120);
  assert.match(step, /try \{\s*videos = await expireOldLogVideos\(sb\);\s*\} catch/);
});

test("logVideoExpired — 영상도 글도 없으면 정리된 로그다", () => {
  assert.equal(logVideoExpired({ video_path: null, body: null }), true);
  assert.equal(logVideoExpired({ video_path: null, body: "   " }), true, "공백 글은 글이 아니다(DB 제약과 같은 기준)");
  assert.equal(logVideoExpired({ video_path: "c/log-1.webm", body: null }), false);
  assert.equal(logVideoExpired({ video_path: null, body: "산책" }), false, "글 로그는 그냥 글 로그다");
});

test("화면 — 정리된 로그에 이유를 말하고, 찍는 화면에서 미리 알린다", () => {
  const log = noComments(read("src/components/TodayLog.tsx"));
  assert.equal((log.match(/logVideoExpired\(log\) && expiredNote/g) ?? []).length, 2, "내 칸·상대 칸 둘 다");
  const cap = noComments(read("src/components/LogCapture.tsx"));
  assert.match(cap, /\{LOG_VIDEO_KEEP_DAYS\}일 동안 보관돼요/);
});
