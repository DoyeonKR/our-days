// 옛 게임 표 정리 migration lock. [2026-09-24]
// 이 저장소에서 표를 지우는 유일한 migration 이다 — 되돌릴 수 없으니 무엇을 지우는지가 테스트로 고정돼야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { ACCOUNT_EXPORT_TABLES } from "./accountPolicy.ts";

const dir = new URL("../../supabase/migrations/", import.meta.url);
const FILE = "20260924000000_drop_old_game_tables.sql";
const migration = readFileSync(new URL(FILE, dir), "utf8").replace(/\r\n/g, "\n").trim();
const bootstrap = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const code = migration.replace(/--[^\n]*/g, "");

const OLD_GAME_TABLES = [
  "game_attempts",
  "game_challenges",
  "game_daily",
  "game_ranks",
  "game_profile",
  "board_results",
  "board_games",
  "tetris_results",
];

test("신규 bootstrap은 옛 게임 표 정리 migration 을 원문 그대로 포함한다", () => {
  assert.ok(bootstrap.includes(migration), "schema.sql 끝의 복사본이 migration 과 달라졌어요. 둘을 함께 갱신해 주세요.");
});

test("지우는 표는 옛 게임 표 여덟 개뿐이다 — 다른 표가 끼면 되돌릴 수 없는 사고다", () => {
  const dropped = [...code.matchAll(/drop\s+table\s+if\s+exists\s+public\.(\w+)/gi)].map((m) => m[1]);
  assert.deepEqual([...dropped].sort(), [...OLD_GAME_TABLES].sort());
  assert.doesNotMatch(code, /\bcascade\b/i, "cascade 는 모르는 의존까지 같이 지운다 — 멈추게 둔다");
  assert.doesNotMatch(code, /\btruncate\b/i);
  // 표를 지우는 migration 은 이것 하나 — 다른 migration 에 drop table 이 생기면 여기서 알아챈다
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql") && n !== FILE)) {
    const other = readFileSync(new URL(f, dir), "utf8").replace(/--[^\n]*/g, "");
    assert.doesNotMatch(other, /\bdrop\s+table\b/i, `${f} 가 표를 지운다`);
  }
});

test("한 트랜잭션이고, 계정 삭제 함수를 표보다 먼저 바꾼다", () => {
  assert.match(code, /^\s*begin;/);
  assert.match(code, /commit;\s*$/);
  const purge = code.indexOf("create or replace function public.purge_account_data");
  const firstDrop = code.search(/drop\s+table/i);
  assert.ok(purge >= 0 && purge < firstDrop, "표를 먼저 지우면 다음 계정 삭제가 relation does not exist 로 멈춘다");
  // 트리거·정책이 쓰는 함수는 표 다음에 지워야 의존 오류가 안 난다
  for (const fn of ["game_attempt_check", "game_i_played"]) {
    assert.ok(code.indexOf(`drop function if exists public.${fn}`) > code.lastIndexOf("drop table"), `${fn} 을 표보다 먼저 지운다`);
  }
});

test("새 계정 삭제 함수는 게임 표를 안 보고, 나머지 정리는 그대로다", () => {
  const at = code.indexOf("create or replace function public.purge_account_data");
  const fn = code.slice(at, code.indexOf("$$;", code.indexOf("as $$", at)) + 3);
  assert.ok(at >= 0 && fn.length > 500, "계정 삭제 함수 본문을 못 찾았다");
  assert.doesNotMatch(fn, /game_|board_|tetris/);
  for (const keep of [
    "delete from public.deco_entries where created_by = p_user",
    "delete from public.couple_logs where created_by = p_user",
    "delete from public.letters where from_user = p_user",
    "delete from public.activity_events where actor_user = p_user",
    "delete from public.couple_members where user_id = p_user",
    "delete from public.reminder_log where user_id = p_user",
    "set_config('ourdays.suppress_activity', 'on', true)",
  ]) {
    assert.ok(fn.includes(keep), `계정 삭제에서 빠졌다: ${keep}`);
  }
  assert.match(code, /revoke all on function public\.purge_account_data\(uuid\) from public, anon, authenticated/);
  assert.match(code, /grant execute on function public\.purge_account_data\(uuid\) to service_role/);
});

test("계정 내보내기 목록에 지운 표가 없다 — 남아 있으면 내보내기가 없는 표를 읽다 멈춘다", () => {
  for (const t of OLD_GAME_TABLES) {
    assert.ok(!(ACCOUNT_EXPORT_TABLES as readonly string[]).includes(t), `${t} 가 아직 내보내기 목록에 있다`);
  }
});
