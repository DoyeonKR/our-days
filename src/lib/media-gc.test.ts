import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../supabase/functions/media-gc/index.ts", import.meta.url),
  "utf8",
);

test("미디어 GC: 비밀 헤더·24시간 보호·명시 confirm 없이는 dry-run만 허용한다", () => {
  assert.match(source, /x-cron-secret/);
  assert.match(source, /24 \* 60 \* 60 \* 1000/);
  assert.match(source, /input\?\.confirm === true/);
  assert.match(source, /if \(!confirm\)/);
  assert.match(source, /dry_run: true/);
});

test("미디어 GC: 모든 현재 미디어 참조를 모으고 삭제 직전 다시 확인한다", () => {
  for (const table of ["couple_photos", "deco_entries", "couple_logs", "couples"])
    assert.match(source, new RegExp(`allRows\\(\\"${table}\\"`));
  for (const column of ["storage_path", "thumb_path", "photo_paths", "video_path", "cover_path", "hung_paths"])
    assert.match(source, new RegExp(column));
  assert.ok((source.match(/await referencedPaths\(\)/g) ?? []).length >= 2);
  assert.match(source, /\.order\("id", \{ ascending: true \}\)/);
});

test("미디어 GC: 한 번의 삭제량을 제한하고 삭제 결과를 다시 조회한다", () => {
  assert.match(source, /const MAX_DELETE = 200/);
  assert.match(source, /slice\(0, MAX_DELETE\)/);
  assert.match(source, /await verifyAbsent\(paths\)/);
  assert.match(source, /storage deletion incomplete/);
});
