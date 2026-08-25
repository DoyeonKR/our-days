import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260825010000_product_trust_and_ia.sql", import.meta.url),
  "utf8",
);
const edge = readFileSync(
  new URL("../../supabase/functions/manage-account/index.ts", import.meta.url),
  "utf8",
);

test("계정 삭제: service role 전용 DB 함수와 DB purge→Storage→Auth 실행 순서를 잠근다", () => {
  assert.match(migration, /grant execute on function public\.purge_account_data\(uuid\) to service_role/i);
  assert.match(migration, /revoke all on function public\.purge_account_data\(uuid\) from public, anon, authenticated/i);
  /* 순서 교정 [리뷰 2026-08-26]: Storage 파기를 먼저 하면(옛 순서) 뒤의 RPC/Auth 실패 시
     '미디어만 영구 소실 + 계정·행은 그대로'가 된다(함수 선배포·마이그레이션 미적용 스큐에서
     확정 재현). DB purge 를 먼저 하면 실패 잔여물이 고아 파일이라 media-gc 가 수거한다.
     단, 경로 **수집**은 여전히 purge 전이어야 한다(행이 지워지면 못 찾는다). */
  const collect = edge.indexOf('from("couple_photos")');
  const database = edge.indexOf('admin.rpc("purge_account_data"');
  const storage = edge.indexOf(".storage.from(BUCKET).remove");
  const auth = edge.indexOf("admin.auth.admin.deleteUser");
  assert.ok(collect >= 0 && collect < database, "경로 수집이 purge 뒤로 밀렸다 — 수집 불가");
  assert.ok(database >= 0 && database < storage && storage < auth, "실행 순서가 DB→Storage→Auth 가 아니다");
});

test("계정 삭제: 호출 JWT와 현재 비밀번호를 서버에서 검증하고, Storage 실패는 비치명이다", () => {
  assert.match(edge, /admin\.auth\.getUser\(jwt\)/);
  assert.match(edge, /if \(authError \|\| !authData\.user\).*401/);
  // 비밀번호 재확인은 **서버가** 강제 — 클라 확인만으론 탈취 세션의 직접 호출을 못 막는다
  assert.match(edge, /signInWithPassword\(/);
  assert.match(edge, /password mismatch/);
  // Storage 실패는 세며 계속 간다(고아 파일은 media-gc 수거) — throw 로 계정 파기를 막지 않는다
  assert.match(edge, /mediaFailed/);
  assert.doesNotMatch(edge, /throw new Error\(`storage cleanup failed:/);
});

test("계정 삭제: 멤버 수 조회 실패를 1인 커플로 오인해 상대 미디어까지 지우지 않는다", () => {
  const guard = edge.indexOf("if (others.error) throw others.error");
  const folderDelete = edge.indexOf("if ((others.count ?? 0) === 0)");
  assert.ok(guard >= 0 && guard < folderDelete);
  assert.match(edge, /\.neq\("user_id", userId\)/);
});

test("계정 삭제: 연결 해제 뒤 남은 작성 데이터와 미디어도 계정 ID로 전역 추적한다", () => {
  assert.match(edge, /from\("couple_photos"\)[\s\S]*eq\("created_by", userId\)/);
  assert.match(edge, /from\("deco_entries"\)[\s\S]*eq\("created_by", userId\)/);
  assert.match(edge, /from\("couple_logs"\)[\s\S]*eq\("created_by", userId\)/);
  assert.match(migration, /delete from public\.deco_entries where created_by = p_user/i);
  assert.match(migration, /delete from public\.game_attempts where user_id = p_user/i);
  assert.match(migration, /delete from public\.activity_events where actor_user = p_user/i);
  assert.match(migration, /delete from public\.couple_members where user_id = p_user/i);
});

test("계정 삭제: 소유권 이전은 상대의 새 활동으로 위장 기록되지 않는다", () => {
  assert.match(migration, /set_config\('ourdays\.suppress_activity', 'on', true\)/i);
  assert.match(migration, /current_setting\('ourdays\.suppress_activity', true\) = 'on'/i);
});
