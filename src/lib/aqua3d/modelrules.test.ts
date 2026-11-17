// 3D 모델 검수 규칙(2026-11-17 — design/ART-GUIDE.md 의 '3D 모델 검수 규칙') 중 기계로 볼 수 있는 것
// [사용자: "새우들 탑뷰에서 확인해봐. 지금 다 무너지는 그래픽이야 고쳐 그리고 재발생하지않게 지침에 녹여"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { parseGLB } from "../../../design/aqua3d-review/glb-compress.mjs";

test("no fish / crustacean body is a flat side-view relief (it collapses when seen from above)", () => {
  const bad: string[] = [];
  for (const f of readdirSync("public/aqua/models/fish").filter((x) => x.endsWith(".glb"))) {
    const { json } = parseGLB(readFileSync(`public/aqua/models/fish/${f}`));
    const tags = [...(json.nodes ?? []), ...(json.meshes ?? [])].map((n: { extras?: { aquaGeometry?: string } }) => n.extras?.aquaGeometry).filter(Boolean);
    if (tags.includes("reference-relief-fish")) bad.push(f);
  }
  assert.deepEqual(bad, []);
  // 만드는 길도 막혀 있다
  const src = readFileSync("design/aqua3d-review/relief-build.mjs", "utf8");
  assert.match(src, /fishReliefGLB: 물고기 · 갑각류 몸통에 판 부풀리기 금지/);
});

test("the art guide carries the model review rules (four views incl. top, skinned, attached, bind pose)", () => {
  const g = readFileSync("design/ART-GUIDE.md", "utf8");
  for (const s of ["3D 모델 검수 규칙", "위에서", "뼈를 입힌", "떠 있는 부품", "바인드"]) assert.ok(g.includes(s), s);
});
