// node --test 가 실제로 로드하는 파일의 import 규칙 lock. [회귀 lock 2026-08-03]
//
// 왜: CI 는 `node --test`(Node 22, TypeScript 타입 스트리핑)로 돈다. 타입 스트리핑은 **타입만
// 지우고 모듈 해석은 Node 규칙을 그대로** 쓴다. 그래서 두 가지가 CI 에서만 터진다:
//
//   import { ramp } from "./pixel";      // ❌ 확장자 없음 → ERR_MODULE_NOT_FOUND
//   import { x } from "@/lib/pixel.ts";  // ❌ tsconfig paths 는 번들러 기능 — node 는 못 푼다
//   import { ramp } from "./pixel.ts";   // ✅
//
// 함정이 두 겹이다:
//  1) **로컬은 멀쩡하다.** 개발/테스트는 tsx(esbuild 해석), Next 빌드는 webpack 해석이라 둘 다
//     통과한다. 오직 CI 의 node --test 에서만 깨진다(배포 3연속 실패로 실측).
//  2) `import type { X } from "./y"` 는 통째로 지워져 아무 일도 없다가, 같은 경로에서 **값**을
//     하나 가져오는 순간 갑자기 깨진다.
//
// ⚠ 범위: `src/lib/**` 전체가 아니라 **테스트에서 도달 가능한 파일**만 본다. 테스트가 로드하지
//   않는 파일(auth.ts·couple.ts 등)은 번들러만 거치므로 별칭을 써도 문제가 없고, 거기까지
//   금지하면 멀쩡한 코드를 이유 없이 흔들게 된다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** 한 파일이 선언한 import/export 원본 경로들. */
function specifiers(src: string): string[] {
  const out: string[] = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("import ") && !t.startsWith("export ")) continue;
    // ⚠ 정규식을 조립하지 않는다 — 이스케이프 사고로 검사가 조용히 죽는다(실제로 겪음).
    const m = /from\s+["']([^"']+)["']/.exec(t);
    if (m) out.push(m[1]);
  }
  return out;
}

test("node --test 가 로드하는 파일은 상대 경로 + .ts 확장자만 쓴다", () => {
  const libDir = import.meta.dirname;
  const srcDir = resolve(libDir, "..");

  // 1) 시작점 = src 아래 모든 테스트 파일
  const seeds: string[] = [];
  const collect = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) collect(p);
      else if (p.endsWith(".test.ts")) seeds.push(p);
    }
  };
  collect(srcDir);
  assert.ok(seeds.length > 0, "테스트 파일을 하나도 못 찾음 — 스캔 경로가 틀렸다");

  // 2) 상대 import 를 따라 전이적으로 도달 가능한 파일을 모으며 규칙 위반을 수집
  const bad: string[] = [];
  const seen = new Set<string>();
  const queue = [...seeds];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    const rel = file.slice(srcDir.length + 1).replace(/\\/g, "/");
    for (const spec of specifiers(src)) {
      if (spec.startsWith("@/")) {
        bad.push(`${rel}: ${spec} — 별칭은 node 가 못 푼다(상대 경로 + .ts 로)`);
        continue;
      }
      if (!spec.startsWith(".")) continue; // node:*, 패키지 → 정상
      // node 가 해석할 수 있는 **명시적 확장자**면 된다(.ts 뿐 아니라 .mjs/.js 도 정상).
      // 규칙의 취지는 "확장자 생략 금지"이지 ".ts 만 허용"이 아니다.
      if (!/\.(ts|mjs|js|cjs)$/.test(spec)) {
        bad.push(`${rel}: ${spec} — 확장자 없음(CI 에서 ERR_MODULE_NOT_FOUND)`);
        continue;
      }
      const next = resolve(dirname(file), spec);
      if (existsSync(next)) queue.push(next);
    }
  }

  assert.deepEqual(bad, [], `node --test 가 못 푸는 import:\n${bad.join("\n")}`);
});
