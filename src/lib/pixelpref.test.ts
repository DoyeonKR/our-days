// 아트 스타일 기본값 lock.
// [2026-08-03] 사용자: "모든걸 픽셀화 기본으로 해줘" → 저장된 선택이 없으면 **픽셀**이어야 한다.
// 이 테스트가 막는 회귀: 기본값이 일러스트로 되돌아가는 것, 그리고 저장값 해석이 뒤집히는 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parsePixelPref } from "./pixelpref.ts";

test("저장된 선택이 없으면 픽셀이 기본", () => {
  assert.equal(parsePixelPref(null), true);
});

test("저장값 해석 — '1' 픽셀 / '0' 일러스트", () => {
  assert.equal(parsePixelPref("1"), true);
  assert.equal(parsePixelPref("0"), false);
});

test("펫 렌더 지점이 전역 설정을 쓴다(각자 localStorage 를 읽지 않는다)", () => {
  // 컴포넌트가 제각기 localStorage 를 읽으면 섬에서 스타일을 바꿔도 홈은 안 바뀐다
  // (오버레이를 닫아도 홈은 리마운트되지 않으므로). 키 접근은 pixelpref 한 곳으로 모은다.
  // ⚠ 정규식을 조립하지 않는다 — 이스케이프 사고로 검사가 조용히 죽는다(실제로 겪음).
  const roots = ["components", "app"];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx") || p.endsWith(".ts")) {
        if (readFileSync(p, "utf8").includes("ourdays:pixelPet")) offenders.push(p);
      }
    }
  };
  for (const r of roots) walk(join(import.meta.dirname, "..", r));
  assert.deepEqual(offenders, [], `pixelpref 밖에서 키를 직접 읽음:\n${offenders.join("\n")}`);
});
