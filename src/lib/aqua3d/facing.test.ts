// 겉면이 바깥을 보는지 — 2026-11-19 [사용자: "귀신고래는 계속 몸이 투명하게 보이고있어"]
// 관(tube)으로 지은 고래 · 물범류 · 톱상어 · 새우가 삼각형도 법선도 안쪽을 봤다. 양면 재질이라 빛은 멀쩡했지만 가려진 물고기 윤곽(post.ts xray —
// 앞면만 그리는 깊이 재질)이 가까운 껍질을 버리고 먼 껍질을 그려, 몸 전체를 '뒤에 숨은 물고기'로 보고 옅게 칠했다. design/aqua3d-review/flip-inward.mjs 로 고쳤다.
// 검사: x 조각마다 몸 가운데(y · z 평균)에서 꼭짓점 쪽으로 법선이 향하는 몫(바깥 몫) — 둥근 몸통이면 절반을 넘어야 한다. 납작한 몸(가오리 · 아귀 · 불가사리 · 해파리)은 이 축 검사가 안 맞아 뺀다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { outShare } from "../../../design/aqua3d-review/facing-outshare.mjs";
import { windShare } from "../../../design/aqua3d-review/facing-wind.mjs";

const TUBE = /whale|seal|sea_lion|otter|sawshark|shrimp|prawn|hammerhead|anglerfish|goosefish|skate/;

test("tube-built bodies face outward (normals and triangle winding)", async () => {
  const files = readdirSync("public/aqua/models/fish").filter((f) => f.endsWith(".glb") && TUBE.test(f) && !/orca/.test(f));
  assert.ok(files.length >= 45, `${files.length}`);
  const bad: string[] = [];
  for (const f of files) {
    const p = `public/aqua/models/fish/${f}`, o = await outShare(p), w = await windShare(p);
    if (o < 0.55 || w < 0.9) bad.push(`${f} out ${o.toFixed(2)} wind ${w.toFixed(2)}`);
  }
  assert.deepEqual(bad, []);
});
