import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260826000000_review_round3.sql", import.meta.url),
  "utf8",
).trim();
const bootstrap = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

// product-schema-sync 와 같은 계약: 신규 bootstrap(schema.sql)은 운영 migration 을
// 원문 그대로 포함해, 새 프로젝트와 기존 운영 DB 가 같은 최종 스키마에 도달한다.
test("신규 bootstrap은 3차 리뷰 migration과 같은 최종 스키마를 포함한다", () => {
  assert.ok(
    bootstrap.includes(migration),
    "schema.sql 끝의 3차 리뷰 복사본이 migration과 달라졌어요. 둘을 함께 갱신해 주세요.",
  );
});

// 이 migration 이 지키는 핵심: 가드 함수는 API 비노출(private) + deco 경로 한정이어야 하고,
// migration 순서상 마지막이라 release_hardening 의 public 재생성도 여기서 되돌려진다.
test("비밀일기 가드는 private 스키마 + deco 경로 한정으로 끝난다", () => {
  assert.match(migration, /create or replace function private\.deco_photo_blocked/);
  assert.match(migration, /p_name like '%\/deco-%'/);
  assert.match(migration, /drop function if exists public\.deco_photo_blocked/);
});
