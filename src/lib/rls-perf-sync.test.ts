// RLS 집합 계산 lock — 정책이 '행마다 함수 호출'로 되돌아가지 않는다. [2026-09-29 DB 점검]
//
// 정책이 is_couple_member(couple_id) · can_view_entry(entry_id) 를 행마다 불러 일기 반응 634행을 읽는 데 84ms 가 걸렸다
// (SECURITY DEFINER 라 인라인이 안 된다). 같은 결과를 '내 커플 목록을 한 번 계산해 집합으로' 보면 1ms 였다 —
// private.my_couple_ids() + (select auth.uid()). 정책을 새로 쓸 때도 이 형태를 지킨다.
// 의미가 그대로인지는 운영을 건드리지 않고 로컬(PGlite)에서 옛 정책 대 새 정책을 사용자 · 표 · 쓰기 시도별로 견줘 확인했다
// (scripts/rls-verify.mjs — README §5 'RLS 규약').
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const FILE = "20260929000000_rls_setbased_and_grants.sql";
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const noComments = (s: string) => s.replace(/--[^\n]*/g, "");

const migration = read(`supabase/migrations/${FILE}`).trim();
const bootstrap = read("supabase/schema.sql");
const code = noComments(migration);
const statements = code.split(/;\s*\n/).map((s) => s.trim());
const policies = statements.filter((s) => /^create policy /.test(s));
const nameOf = (s: string) => /^create policy (\w+) on public\.(\w+)/.exec(s)!;

test("★ schema.sql 끝의 복사본이 migration 과 같다(신규 bootstrap = 운영)", () => {
  assert.ok(bootstrap.includes(migration), "schema.sql 끝의 복사본이 migration 과 달라졌어요. 둘을 함께 갱신해 주세요.");
});

test("★ 모든 정책이 to authenticated · (select auth.uid()) · 집합 조회다", () => {
  assert.ok(policies.length >= 61, `정책이 ${policies.length}개뿐이다`);
  for (const p of policies) {
    const [, name] = nameOf(p);
    assert.match(p, /\bto authenticated\b/, `${name}: 로그인 안 한 요청에는 적용할 이유가 없다`);
    assert.doesNotMatch(p, /is_couple_member\(/, `${name}: 행마다 함수를 부르면 다시 느려진다 — couple_id in (select private.my_couple_ids())`);
    assert.doesNotMatch(p.replaceAll("(select auth.uid())", ""), /auth\.uid\(\)/, `${name}: auth.uid() 는 (select auth.uid()) 로 감싸 한 번만 계산한다`);
  }
  const uses = policies.filter((p) => /in \(select private\.my_couple_ids\(\)\)/.test(p)).length;
  assert.ok(uses >= 45, `내 커플 집합을 쓰는 정책이 ${uses}개뿐이다`);
});

test("각 정책은 같은 이름의 drop policy if exists 와 짝이라 몇 번을 돌려도 같다", () => {
  for (const p of policies) {
    const [, name, table] = nameOf(p);
    assert.ok(code.includes(`drop policy if exists ${name} on public.${table};`), `${name}: drop policy if exists 가 없다`);
  }
});

test("★ schema.sql 이 만든 public 정책은 전부 이 migration 이 다시 정의한다(빠진 정책은 옛 느린 형태로 남는다)", () => {
  const before = noComments(bootstrap.slice(0, bootstrap.indexOf(migration)));
  const live = new Set<string>();
  // drop table 은 줄 머리의 것만 — 'alter publication … drop table public.x' 는 표를 지우는 게 아니다.
  const re = /(create policy|drop policy if exists) (\w+) on public\.(\w+)|^drop table (?:if exists )?public\.(\w+)/gm;
  for (const m of before.matchAll(re)) {
    if (m[4]) {
      for (const k of [...live]) if (k.endsWith(`|${m[4]}`)) live.delete(k);
    } else if (m[1] === "create policy") live.add(`${m[2]}|${m[3]}`);
    else live.delete(`${m[2]}|${m[3]}`);
  }
  const redefined = new Set(policies.map((p) => nameOf(p).slice(1, 3).join("|")));
  const missing = [...live].filter((k) => !redefined.has(k));
  assert.deepEqual(missing, [], `옛 형태로 남는 정책: ${missing.join(", ")}`);
  assert.ok(live.size >= 61, `schema.sql 의 정책이 ${live.size}개로 읽혔다(파서가 깨졌나?)`);
});

test("★ private.my_couple_ids — stable · security definer · search_path 고정 · authenticated 만 실행(노출 스키마 아님)", () => {
  assert.match(code, /create or replace function private\.my_couple_ids\(\)\s+returns setof uuid\s+language sql stable security definer set search_path = ''/);
  assert.match(code, /where m\.user_id = \(select auth\.uid\(\)\)/, "호출한 사용자의 것만 돌려줘야 한다");
  assert.match(code, /revoke all on function private\.my_couple_ids\(\) from public, anon;/);
  assert.match(code, /grant execute on function private\.my_couple_ids\(\) to authenticated;/, "정책은 질의한 사용자 권한으로 돈다 — 이걸 걷으면 모든 조회가 멈춘다");
  assert.doesNotMatch(code, /function public\.my_couple_ids/, "public 에 두면 /rest/v1/rpc 로 노출된다");
});

test("인덱스: couple_id 가 없던 세 곳과 couple_members.user_id", () => {
  assert.match(code, /create index if not exists couple_members_user_idx on public\.couple_members \(user_id\)/);
  assert.match(code, /create index if not exists entry_reactions_couple_idx on public\.entry_reactions \(couple_id\)/);
  assert.match(code, /create index if not exists entry_comments_couple_idx on public\.entry_comments \(couple_id, created_at\)/);
  assert.match(code, /create index if not exists log_comments_couple_idx on public\.log_comments \(couple_id, created_at\)/);
});

test("함수 권한: 트리거 전용은 아무도 못 부르고 · RPC 는 로그인한 사용자만 · 정책 도우미는 필요한 역할만", () => {
  for (const fn of ["capture_couple_activity", "forbid_created_by_change", "sync_event_recurrence", "touch_member_updated_at"]) {
    assert.match(code, new RegExp(`revoke execute on function public\\.${fn}\\(\\) from public, anon, authenticated;`), fn);
  }
  assert.match(code, /alter function public\.forbid_created_by_change\(\) set search_path = public;/);
  for (const sig of ["create_couple\\(text, date\\)", "join_couple\\(text, text\\)", "island_create\\(jsonb\\)", "island_action\\(integer, jsonb\\)", "rotate_invite_code\\(uuid\\)"]) {
    assert.match(code, new RegExp(`revoke execute on function public\\.${sig} from public, anon;`), sig);
    assert.match(code, new RegExp(`grant execute on function public\\.${sig} to authenticated;`), sig);
  }
  for (const sig of ["can_view_entry\\(uuid\\)", "qa_i_answered\\(uuid, text\\)", "quiz_i_answered\\(uuid, text\\)"]) {
    assert.match(code, new RegExp(`revoke execute on function public\\.${sig} from public, anon;`), sig);
  }
  // storage.objects 정책(모든 역할)이 부르므로 anon 이 남는다 — 걷으면 로그인 안 한 storage 요청이 권한 오류로 바뀐다.
  assert.match(code, /grant execute on function public\.is_couple_member\(uuid\) to anon, authenticated;/);
});

test("크론: 응답 대기만 30초로 늘리고 CRON_SECRET 은 건드리지도 적지도 않는다", () => {
  assert.match(code, /timeout_milliseconds := 30000/);
  assert.doesNotMatch(migration, /x-cron-secret/i, "비밀 헤더 이름을 적으면 그 옆에 값을 붙여 넣기 쉽다 — 명령 끝에 인자만 덧붙인다");
  assert.match(code, /command not like '%timeout_milliseconds%'/, "이미 있으면 다시 붙이지 않는다(멱등)");
  assert.match(code, /if to_regclass\('cron\.job'\) is null then\s+return;/, "크론이 없는 신규 bootstrap 에서는 아무 일도 안 한다");
});

test("이 migration 뒤에 오는 migration 은 옛 형태의 public 정책을 만들지 않는다", () => {
  const later = readdirSync(join(root, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f > FILE)
    .sort();
  for (const f of later) {
    const stmts = noComments(read(`supabase/migrations/${f}`)).split(/;\s*\n/).map((s) => s.trim());
    for (const s of stmts.filter((x) => /^create policy \w+ on public\./.test(x))) {
      assert.doesNotMatch(s, /is_couple_member\(/, `${f}: ${nameOf(s)[1]} — couple_id in (select private.my_couple_ids()) 로 쓴다`);
      assert.doesNotMatch(s.replaceAll("(select auth.uid())", ""), /auth\.uid\(\)/, `${f}: ${nameOf(s)[1]} — (select auth.uid()) 로 감싼다`);
    }
  }
});
