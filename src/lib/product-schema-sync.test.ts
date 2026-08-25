import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260825010000_product_trust_and_ia.sql", import.meta.url),
  "utf8",
).trim();
const bootstrap = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

test("신규 bootstrap은 제품 신뢰 migration과 같은 최종 스키마를 포함한다", () => {
  assert.ok(
    bootstrap.includes(migration),
    "schema.sql 끝의 bootstrap 복사본이 migration과 달라졌어요. 둘을 함께 갱신해 주세요.",
  );
});

test("이번 제품 신뢰 migration은 미래 편지 스키마를 변경하지 않는다", () => {
  assert.doesNotMatch(migration, /\bletters\b/i);
  assert.doesNotMatch(migration, /future.?letter/i);
});
