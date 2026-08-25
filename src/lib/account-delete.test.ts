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

test("계정 삭제: service role 전용 DB 함수와 Storage→DB→Auth 실행 순서를 잠근다", () => {
  assert.match(migration, /grant execute on function public\.purge_account_data\(uuid\) to service_role/i);
  assert.match(migration, /revoke all on function public\.purge_account_data\(uuid\) from public, anon, authenticated/i);
  const storage = edge.indexOf(".storage.from(BUCKET).remove");
  const database = edge.indexOf('admin.rpc("purge_account_data"');
  const auth = edge.indexOf("admin.auth.admin.deleteUser");
  assert.ok(storage >= 0 && storage < database && database < auth);
});

test("계정 삭제: 호출 JWT를 서버에서 검증하고 미디어 실패 시 삭제를 계속하지 않는다", () => {
  assert.match(edge, /admin\.auth\.getUser\(jwt\)/);
  assert.match(edge, /if \(error\) throw new Error\(`storage cleanup failed:/);
  assert.match(edge, /if \(authError \|\| !authData\.user\).*401/);
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
