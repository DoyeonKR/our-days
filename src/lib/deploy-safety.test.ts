import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../supabase/migrations/20260825000000_release_hardening.sql", import.meta.url),
  "utf8",
);
const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const setup = readFileSync(new URL("../../docs/SETUP.md", import.meta.url), "utf8");

test("bootstrap guard runs before every destructive core-table drop", () => {
  const guard = schema.indexOf("BOOTSTRAP_ONLY: existing schema detected");
  const firstDrop = schema.indexOf("drop table if exists public.push_subscriptions");
  assert.ok(guard >= 0, "schema.sql must identify itself as bootstrap-only");
  assert.ok(firstDrop > guard, "the existing-schema guard must run before DROP TABLE");
  for (const table of ["couples", "couple_members", "pokes", "couple_events", "couple_photos"]) {
    assert.match(schema.slice(0, firstDrop), new RegExp(`to_regclass\\('public\\.${table}'\\)`));
  }
});

test("existing-project migration is idempotent and data-preserving", () => {
  assert.doesNotMatch(migration, /\b(?:drop|truncate)\s+table\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.match(migration, /when duplicate_object then null/i);
  assert.match(migration, /add column if not exists hung_paths/i);
  assert.match(migration, /deco_photo_blocked/);
  assert.match(migration, /drop policy if exists ranks_select/);
});

test("operator docs never recommend rerunning bootstrap on an existing database", () => {
  const docs = `${readme}\n${setup}`;
  assert.doesNotMatch(docs, /schema\.sql[^\n]{0,40}(?:재실행 가능|전체 재실행)/);
  assert.match(docs, /supabase\/migrations/);
  assert.match(docs, /기존 프로젝트/);
});
