import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./useforecast.ts", import.meta.url), "utf8");

test("도시 전환 시 이전 예보 요청을 취소하고 늦은 응답을 무시한다", () => {
  assert.match(source, /flight\.current\.controller\?\.abort\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /if \(seq !== flight\.current\.seq\) return/);
});

test("취소된 이전 요청은 현재 로딩·실패 상태를 덮지 않는다", () => {
  assert.match(source, /seq === flight\.current\.seq[\s\S]*AbortError/);
  assert.match(source, /if \(seq === flight\.current\.seq\) \{\s*flight\.current\.controller = null;\s*setBusy\(false\)/);
});
