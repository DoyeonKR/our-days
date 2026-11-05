// 마이그레이션 공통 규칙 lock (2026-11-05 앱 공통 리뷰 — README §7 · §10.13).
//
// migration 은 main 에 push 하는 순간 운영 DB 에 돈다(Supabase GitHub 연동). 그래서 파일 하나의 실수가 곧 운영 사고다.
// 2026-11-05 에 20261106000000~030000 네 개가 **하루 앞 날짜**로 커밋돼 그대로 운영에 적용됐다 — 이름은 이미 원격 기록에
// 박혀 바꿀 수 없다(바꾸면 연동이 '원격에만 있는 버전'으로 전부 거부한다, §7). 앞으로 쓸 새 파일은 **가장 마지막 파일보다 큰 번호**로.
// 이 테스트는 파일마다 따로 걸던 규칙을 모든 파일에 한 번에 건다:
//   ① 버전은 14자리 · 겹치지 않고 이름순 = 번호순 ② 각 migration 이 schema.sql 에 글자 그대로 정확히 한 번(신규 bootstrap = 운영)
//   ③ 어떤 migration 도 errcode 40001 · 40P01 을 내지 않는다(README §11 장애) ④ 2026-11-06 번호부터 새 정책은 to authenticated
//   ⑤ 2026-11-06 번호부터 begin; … commit; 한 트랜잭션.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const dir = join(root, "supabase/migrations");
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const noComments = (s: string) => s.replace(/--[^\n]*/g, "");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const schema = read(join(root, "supabase/schema.sql"));

/** schema.sql 에 원문이 없는 옛 파일 — 늘리지 않는다(새 파일은 반드시 schema.sql 끝에 붙인다).
 *  · 날씨 5개: 다른 앱이 운영에 직접 적용한 버전의 자리표시(SQL 은 주석뿐, §7)
 *  · release_hardening · island_stale_no_retry: schema.sql 본문에 같은 정의를 녹여 넣어 원문 그대로는 없다 */
const LEGACY_NOT_IN_SCHEMA = new Set([
  "20260825000000_release_hardening.sql",
  "20260927000000_island_stale_no_retry.sql",
  "20260928130336_weather_rain_alert_and_events.sql",
  "20260928223400_weather_push_test_column.sql",
  "20260928223926_weather_events_summary.sql",
  "20261101144520_weather_push_persona_and_alerts.sql",
  "20261101145042_weather_push_persona_community.sql",
]);
const STRICT_FROM = "20261106";

test("① 버전은 14자리 · 겹치지 않고 · 이름순이 곧 번호순이다", () => {
  const versions = files.map((f) => {
    const m = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(f);
    assert.ok(m, `${f}: 이름은 <14자리 번호>_<소문자 이름>.sql`);
    return m[1];
  });
  assert.equal(new Set(versions).size, versions.length, "같은 버전이 두 파일에 있다 — 연동이 하나만 적용한다");
  for (let i = 1; i < versions.length; i++) assert.ok(versions[i] > versions[i - 1], `${files[i]}: 번호가 앞 파일보다 크지 않다`);
});

test("② 각 migration 은 schema.sql 에 글자 그대로 정확히 한 번 있다(신규 bootstrap = 운영)", () => {
  for (const f of files) {
    const body = read(join(dir, f)).trim();
    const n = schema.split(body).length - 1;
    if (LEGACY_NOT_IN_SCHEMA.has(f)) {
      assert.equal(n, 0, `${f}: 이제 schema.sql 에 원문이 있다 — 예외 목록에서 빼 주세요`);
      continue;
    }
    assert.equal(n, 1, `${f}: schema.sql 에 원문이 ${n}번 — 정확히 한 번, 끝에 붙인다`);
  }
  for (const f of LEGACY_NOT_IN_SCHEMA) assert.ok(files.includes(f), `${f}: 예외 목록에 없는 파일`);
});

test("③ 어떤 migration 도 40001 · 40P01 을 내지 않는다(PostgREST 무한 재시도 — README §11)", () => {
  const RETRIED = /(errcode\s*=\s*'(40001|40P01)'|sqlstate\s+'(40001|40P01)')/i;
  for (const f of files) assert.doesNotMatch(noComments(read(join(dir, f))), RETRIED, f);
});

test("④ 2026-11-06 번호부터 새 정책은 to authenticated(로그인 안 한 요청에 열 이유가 없다)", () => {
  for (const f of files.filter((x) => x >= STRICT_FROM)) {
    const stmts = noComments(read(join(dir, f))).split(/;\s*\n/).map((s) => s.trim());
    for (const s of stmts.filter((x) => /^create policy /i.test(x))) {
      assert.match(s, /\bto authenticated\b/, `${f}: ${s.slice(0, 60)}`);
    }
  }
});

test("⑤ 2026-11-06 번호부터 한 트랜잭션(begin; … commit;) — 중간에 실패하면 통째로 되돌아간다", () => {
  for (const f of files.filter((x) => x >= STRICT_FROM)) {
    const code = noComments(read(join(dir, f)));
    assert.match(code, /^begin;$/m, `${f}: begin; 이 없다`);
    assert.match(code.trimEnd(), /commit;$/, `${f}: commit; 으로 끝나지 않는다`);
  }
});

test("security definer 함수는 search_path 를 고정한다(2026-11-06 번호부터)", () => {
  for (const f of files.filter((x) => x >= STRICT_FROM)) {
    const code = noComments(read(join(dir, f)));
    for (const m of code.matchAll(/create or replace function ([\w.]+)\([^)]*\)[\s\S]*?\bas \$\$/gi)) {
      if (!/security definer/i.test(m[0])) continue;
      assert.match(m[0], /set search_path\s*=/i, `${f}: ${m[1]} — search_path 고정이 없다`);
    }
  }
});
