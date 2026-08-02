// 픽셀 아이콘 lock. [2026-08-03]
// 사용자: "모든 톤앤매너 도트 픽셀로" → UI 크롬 아이콘 36종도 도트다.
// 이 테스트가 막는 회귀: (1) 도트 오타, (2) 엔진(icons.ts)에 이름을 추가하고 도트를 잊는 것,
// (3) Icon.tsx 가 안티앨리어싱/비정수 크기로 되돌아가 아이콘이 흐려지는 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PIXEL_ICON_PATHS, PIXEL_ICON_ROWS, rowsToPath } from "./pixelicon.ts";
import { ICON_PATHS } from "./icons.ts";

test("도트 포맷 정합 — 모든 아이콘이 12×12", () => {
  const errs: string[] = [];
  for (const [name, rows] of Object.entries(PIXEL_ICON_ROWS)) {
    if (rows.length !== 12) errs.push(`${name}: 행 수 ${rows.length}`);
    rows.forEach((r, y) => {
      if (r.length !== 12) errs.push(`${name}[${y}]: 길이 ${r.length}`);
      const bad = [...r].filter((c) => c !== "#" && c !== ".");
      if (bad.length) errs.push(`${name}[${y}]: 허용되지 않는 문자 ${bad.join("")}`);
    });
  }
  assert.deepEqual(errs, [], errs.join("\n"));
});

test("이름 집합이 icons.ts 와 정확히 일치(빠진 아이콘 = 빈 자리)", () => {
  const svg = Object.keys(ICON_PATHS).sort();
  const px = Object.keys(PIXEL_ICON_ROWS).sort();
  assert.deepEqual(px, svg, "아이콘 이름 집합 불일치 — 한쪽에만 있는 이름이 있다");
});

test("빈 아이콘 금지 — 전부 실제로 칠해진 도트가 있다", () => {
  const empty = Object.entries(PIXEL_ICON_PATHS)
    .filter(([, d]) => !d || d.length < 8)
    .map(([k]) => k);
  assert.deepEqual(empty, [], `도트가 비었거나 거의 없음:\n${empty.join("\n")}`);
});

test("rowsToPath — 가로 런을 합쳐 노드를 줄인다", () => {
  // 한 줄이 전부 칠해지면 사각형 1개여야 한다(12개가 아니라).
  const rows = Array.from({ length: 12 }, (_, i) => (i === 0 ? "############" : "............"));
  const d = rowsToPath(rows);
  assert.equal(d, "M0 0h12v1h-12z", "가로 12칸이 사각형 하나로 합쳐져야 한다");
  // 길이가 어긋나면 즉시 실패해야 한다(조용히 밀린 아트 방지)
  assert.throws(() => rowsToPath(["###"]), /행 수/);
  assert.throws(() => rowsToPath(Array.from({ length: 12 }, () => "###")), /길이/);
});

test("Icon.tsx 렌더 계약 — crispEdges + 12 배수 스냅 [회귀 lock]", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "components", "Icon.tsx"), "utf8");
  // ⚠ 정규식을 조립하지 않는다 — 이스케이프 사고로 검사가 조용히 죽는다(실제로 겪음).
  assert.ok(src.includes('shapeRendering="crispEdges"'), "crispEdges 없으면 도트 경계가 번진다");
  assert.ok(src.includes('viewBox="0 0 12 12"'), "12 격자 viewBox");
  assert.ok(src.includes("Math.round(size / 12) * 12"), "크기를 12 배수로 스냅해야 굵기가 균일하다");
  assert.ok(src.includes("PIXEL_ICON_PATHS"), "픽셀 아이콘 경로 사용");
  assert.ok(!src.includes("strokeLinecap"), "둥근 캡(선 아이콘 잔재) 금지");
});
