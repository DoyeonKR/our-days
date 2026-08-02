// src/lib 의 상대 import 는 반드시 `.ts` 확장자를 붙인다. [회귀 lock 2026-08-03]
//
// 왜: CI 는 `node --test`(Node 22, TypeScript 타입 스트리핑)로 돈다. 타입 스트리핑은 **타입만
// 지우고 모듈 해석은 Node 의 ESM 규칙을 그대로 쓴다** → 확장자 없는 상대 경로는 해석되지 않는다.
//
//   import { ramp } from "./pixel";     // ❌ CI: ERR_MODULE_NOT_FOUND
//   import { ramp } from "./pixel.ts";  // ✅
//
// 이게 특히 위험한 이유: **로컬은 멀쩡하다**. 로컬 개발/테스트는 tsx(esbuild 해석)라 확장자가
// 없어도 잘 돌고, Next 빌드도 webpack 해석이라 통과한다. 오직 CI 의 node --test 에서만 터진다.
// 또 `import type { X } from "./y"` 는 통째로 지워져 아무 일도 안 일어나므로, 같은 파일에
// **값 import 를 하나 추가하는 순간** 갑자기 깨진다(실제로 이렇게 배포 3연속 실패).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

test("src/lib 의 상대 import/export 는 .ts 확장자를 붙인다", () => {
  const dir = import.meta.dirname;
  const bad: string[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    const src = readFileSync(join(dir, f), "utf8");
    // ⚠ 정규식을 조립하지 않는다 — 이스케이프 사고로 검사가 조용히 죽는다(실제로 겪음).
    for (const line of src.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("import ") && !t.startsWith("export ")) continue;
      const m = /from\s+["'](\.[^"']*)["']/.exec(t);
      if (!m) continue;
      if (!m[1].endsWith(".ts")) bad.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], `확장자 없는 상대 경로(= CI 에서 ERR_MODULE_NOT_FOUND):\n${bad.join("\n")}`);
});
