// 씬 픽셀 문법 lock. [2026-08-03]
// 사용자: "모든 톤앤매너 도트 픽셀로 — 메인 화면도 그렇고 섬도 그렇고".
// 씬에서 픽셀 톤을 깨는 것은 **연속으로 흐르는 색**(그라데이션 보간)과 **블러**다.
// 이 테스트가 막는 회귀: 소프트 그라데이션·블러 글로우·둥근 별이 되살아나는 것.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bands, haloRings, q8, snap } from "./pixelscene.ts";

test("q8 — 채널을 8 배수로 양자화(팔레트가 정해진 느낌)", () => {
  assert.equal(q8("#ffffff"), "#f8f8f8");
  assert.equal(q8("#000000"), "#000000");
  assert.equal(q8("#123456"), "#103858"); // 0x12→16, 0x34(52)→56, 0x56(86)→88
  // 색이 아닌 값은 손대지 않는다(rgba/이름)
  assert.equal(q8("rgba(0,0,0,.5)"), "rgba(0,0,0,.5)");
  for (const hex of ["#ff5f97", "#2b2f3d", "#e8bd7e"]) {
    const out = q8(hex);
    for (let i = 1; i < 7; i += 2) {
      assert.equal(parseInt(out.slice(i, i + 2), 16) % 8, 0, `${hex} → ${out}: 채널이 8 배수가 아니다`);
    }
  }
});

test("bands — 하드 스톱만 만든다(보간 구간이 없어야 한다)", () => {
  const g = bands(["#ff0000", "#00ff00", "#0000ff"]);
  // 각 색이 시작/끝 두 번 등장 = 경계에서 뚝 끊긴다
  for (const c of ["#f80000", "#00f800", "#0000f8"]) {
    assert.equal((g.match(new RegExp(c.replace("#", "\\#"), "g")) ?? []).length, 2, `${c} 가 두 번(시작/끝) 나와야 한다`);
  }
  assert.ok(g.startsWith("linear-gradient(180deg,"), "세로 밴드");
  assert.equal(bands([]), "transparent");
  assert.equal(bands(["#ffffff"]), "#f8f8f8");
});

test("haloRings — blur 0, spread 만 쓴다", () => {
  const h = haloRings("#ffe08a", [6, 12, 20]);
  // `0 0 0 Npx` — 세 번째(blur) 가 반드시 0
  for (const part of h.split(", ")) {
    const m = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s/.exec(part + " ");
    assert.ok(m, `형식 불일치: ${part}`);
    assert.equal(m![3], "0", `blur 는 0 이어야 한다(번지면 도트가 뭉갠다): ${part}`);
  }
});

test("snap — 도트 격자 반올림", () => {
  assert.equal(snap(5), 6);
  assert.equal(snap(5, 4), 4);
  assert.equal(snap(0), 0);
});

test("씬 소스 — 블러 글로우/둥근 별이 되살아나지 않는다 [회귀 lock]", () => {
  const hw = readFileSync(join(import.meta.dirname, "..", "components", "HomeWorld.tsx"), "utf8");
  // ⚠ 정규식을 조립하지 않는다 — 이스케이프 사고로 검사가 조용히 죽는다(실제로 겪음).
  const code = hw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert.ok(!code.includes("radial-gradient"), "HomeWorld: radial 그라데이션 금지(연속 감쇠 = 번짐)");
  assert.ok(!code.includes("blur("), "HomeWorld: blur 금지");
  // box-shadow 의 blur 반경이 0 이 아닌 것(예: '0 0 30px')이 없어야 한다
  assert.ok(!/0 0 \d+px \d/.test(code), "HomeWorld: 블러 글로우(box-shadow blur>0) 금지");
});
