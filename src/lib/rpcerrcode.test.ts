// RPC 오류 코드 lock — 함수에서 40001 · 40P01 을 직접 내지 않는다. [2026-09-27 장애]
//
// PostgREST 14 는 40001(serialization_failure) · 40P01(deadlock) 을 '다시 하면 풀리는 충돌'로 보고 트랜잭션을
// **서버 안에서 스스로 재시도**한다. island_action 이 버전 충돌을 40001 로 냈더니, 같은 버전을 다시 보내는 재시도는
// 영영 안 맞아서 요청 하나가 끝나지 않는 고리가 됐다(게이트웨이엔 요청 하나 — DB 에만 'ERROR stale' 이 초당 수백 번).
// 고리가 쌓여 데이터 API 연결을 다 쥐자 CPU 가 가득 차고 API 전체가 503 이 됐다 → 앱엔 모든 기록이 사라진 것처럼 보였다.
// 앱이 되돌려 받아야 하는 충돌은 PT409(HTTP 409) 로 낸다. 참고: supabase 문제 해결 문서
// "high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const sql = (p: string) =>
  readFileSync(join(root, p), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/--[^\n]*/g, ""); // 주석 속 설명(이 사고의 기록)은 코드가 아니다
const RETRIED = /(errcode\s*=\s*'(40001|40P01)'|sqlstate\s+'(40001|40P01)')/i;

test("★ 새 설치(schema.sql)의 어떤 함수도 40001 · 40P01 을 직접 내지 않는다", () => {
  const hits = sql("supabase/schema.sql")
    .split("\n")
    .filter((l) => RETRIED.test(l));
  assert.deepEqual(hits, [], `PostgREST 가 끝없이 재시도할 오류 코드:\n${hits.join("\n")}`);
});

test("★ 섬 저장(island_action)의 가장 최근 정의는 충돌을 PT409 로 낸다", () => {
  const dir = "supabase/migrations";
  const files = readdirSync(join(root, dir)).filter((f) => f.endsWith(".sql")).sort();
  const defining = files.filter((f) => /create or replace function public\.island_action\s*\(/i.test(sql(`${dir}/${f}`)));
  assert.ok(defining.length > 0, "island_action 을 고치는 마이그레이션이 없다");
  const latest = sql(`${dir}/${defining[defining.length - 1]}`);
  assert.match(latest, /raise exception 'stale' using errcode = 'PT409'/);
  assert.ok(!RETRIED.test(latest), "가장 최근 island_action 이 아직 재시도 오류 코드를 쓴다");
  // 이 파일 뒤에 오는 마이그레이션도 재시도 코드를 다시 들이지 않는다
  const after = files.slice(files.indexOf(defining[defining.length - 1]) + 1);
  for (const f of after) assert.ok(!RETRIED.test(sql(`${dir}/${f}`)), `${f} 가 40001/40P01 을 다시 쓴다`);
  // 새 설치와 기존 프로젝트가 같은 규칙
  assert.match(sql("supabase/schema.sql"), /function public\.island_action[\s\S]*?raise exception 'stale' using errcode = 'PT409'/);
});
