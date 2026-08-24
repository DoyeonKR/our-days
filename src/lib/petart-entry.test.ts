// petArt() 단일 진입점 lock. [리뷰 2026-08-25]
//
// README: "새 자리에 펫을 넣을 땐 petArt() 를 직접 부르지 말고 PetIcon 을 쓴다
// (아홉 군데가 어긋나던 원인)". 그 규약이 문서에만 있고 잠겨 있지 않아, 직접 호출이
// 이미 세 곳(씬 렌더러) 살아 있다. 그 셋은 SVG 씬 합성 때문에 컴포넌트 참조가 필요해
// 허용하되(allowlist), **목록이 조용히 늘어나는 것**을 여기서 막는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "..");

/** petArt( 직접 호출이 허용된 파일 — 새 자리는 PetIcon 을 쓰고, 정말 씬 합성이 필요할 때만 여기 올린다. */
const ALLOW = new Set([
  join("components", "island", "art", "pets.tsx"), // 정의부
  join("components", "island", "PetIcon.tsx"), // 단일 진입점
  join("components", "island", "IslandScene.tsx"), // SVG 씬 합성(컴포넌트 참조 필요)
  join("components", "island", "HomePet.tsx"), // 홈 히어로 씬(동일 사유)
  join("components", "IslandGame.tsx"), // 섬 헤더 씬(동일 사유)
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test("★ petArt() 는 allowlist 밖에서 직접 못 부른다 — 새 자리는 PetIcon 으로", () => {
  const bad: string[] = [];
  for (const f of walk(SRC)) {
    if (!/\.(ts|tsx)$/.test(f) || f.endsWith(".test.ts")) continue;
    const rel = f.slice(SRC.length + 1);
    if (ALLOW.has(rel)) continue;
    const src = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, ""); // 주석 속 언급(규약 설명)은 호출이 아니다
    if (/\bpetArt\s*\(/.test(src)) bad.push(rel);
  }
  assert.deepEqual(bad, [], `petArt 직접 호출이 늘었다(PetIcon 을 쓸 것): ${bad.join(", ")}`);
});
