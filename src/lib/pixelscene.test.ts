/* 홈 풍경의 '픽셀 문법' 잠금.
 *
 * [사용자 요청 2026-08-07 "홈화면 배경 픽셀들 개선"]
 * 문제는 해상도가 아니라 **문법**이었다 — 배경은 SVG 베지어 곡선, 펫은 1px 격자라
 * 펫이 벡터 그림에 붙인 스티커처럼 보였다. 여기서는 그게 되돌아오는 걸 막는다.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sampleCubics, stepPath, stepPolyline, type Cubic } from "./pixelscene.ts";
import { birdSprite, cloudSprite, discPath, moonLitPath } from "./pixelsky.ts";
import { validateSprite } from "./pixel.ts";

const HILL: Cubic[] = [
  [54, 168, 104, 178, 160, 184],
  [212, 190, 258, 176, 312, 180],
  [352, 183, 378, 190, 400, 184],
];

test("계단 경로에는 곡선 명령이 없다", () => {
  /* 픽셀 아트에 곡선은 없다. C·Q·S·A 가 하나라도 있으면 그건 벡터로 되돌아간 것이다. */
  const d = stepPath(sampleCubics(186, HILL), 3, 400, 210);
  assert.equal(/[CcQqSsAaTt]/.test(d), false, `곡선 명령이 남아 있다: ${d.slice(0, 80)}`);
  assert.ok(d.startsWith("M"), "M 으로 시작해야 한다");
  assert.ok(d.endsWith("Z"), "면으로 닫혀야 한다");
});

test("모든 좌표가 격자 배수다", () => {
  for (const u of [2, 3, 4, 6]) {
    const d = stepPath(sampleCubics(186, HILL), u, 400, 210);
    // 마지막 바닥선(400/210/0)은 화면 규격이라 제외하고, 능선 좌표만 검사한다
    const ys = [...d.matchAll(/L\d+ (\d+)/g)].map((m) => Number(m[1])).filter((y) => y !== 210);
    assert.ok(ys.length > 0, "능선 좌표가 없다");
    for (const y of ys) assert.equal(y % u, 0, `격자 ${u} 를 벗어난 y=${y}`);
  }
});

test("실루엣이 유지된다 — 격자를 잘게 잡으면 원본 곡선에 수렴한다", () => {
  /* 계단으로 바꾸는 건 '다시 그리는' 게 아니라 '격자에 맞추는' 것이다.
     u 를 줄이면 원래 베지어와의 차이가 줄어야 한다. */
  const pts = sampleCubics(186, HILL);
  const err = (u: number) => {
    const d = stepPath(pts, u, 400, 210);
    // ⚠ 바닥 마감선(y=210)까지 능선으로 세면 오차가 24px 로 잡힌다 — 그건 능선이 아니다
    const steps = [...d.matchAll(/L(\d+) (\d+)/g)]
      .map((m) => [Number(m[1]), Number(m[2])])
      .filter(([, y]) => y !== 210);
    let worst = 0;
    for (const [x, y] of pts) {
      let best = Infinity;
      for (const [sx, sy] of steps) if (Math.abs(sx - x) < 6) best = Math.min(best, Math.abs(sy - y));
      if (best !== Infinity) worst = Math.max(worst, best);
    }
    return worst;
  };
  assert.ok(err(2) <= err(8), `격자를 잘게 해도 오차가 안 준다: ${err(2)} vs ${err(8)}`);
  assert.ok(err(2) < 6, `격자 2 에서도 원본과 ${err(2)}px 벗어난다 — 실루엣이 바뀐 것`);
});

test("산등성이도 같은 규칙을 쓴다", () => {
  const d = stepPolyline([[0, 104], [74, 62], [212, 55], [400, 82]], 6, 400, 210);
  assert.equal(/[CcQqSsAa]/.test(d), false);
  const ys = [...d.matchAll(/L\d+ (\d+)/g)].map((m) => Number(m[1])).filter((y) => y !== 210);
  for (const y of ys) assert.equal(y % 6, 0, `격자 6 을 벗어난 y=${y}`);
});

test("해·달도 계단 원반이다(원 명령 금지)", () => {
  for (const d of [discPath(12, 12, 11, 2), moonLitPath(23, 23, 15, 0.25, 2)]) {
    assert.ok(d.length > 0);
    assert.equal(/[CcQqSsAa]/.test(d), false, "원/호 명령이 남아 있다");
  }
  // 위상이 다르면 밝은 쪽 모양도 달라야 한다(안 그러면 달이 늘 보름달이다)
  assert.notEqual(moonLitPath(23, 23, 15, 0.1, 2), moonLitPath(23, 23, 15, 0.5, 2));
});

test("구름·새 스프라이트가 규격을 통과하고 서로 다르다", () => {
  for (const sz of ["s", "m", "l"] as const) {
    const sp = cloudSprite(sz, "#ffffff", "#ccccdd");
    assert.deepEqual(validateSprite(sp, `cloud_${sz}`), []);
  }
  const w = (["s", "m", "l"] as const).map((z) => cloudSprite(z, "#fff", "#ccd").w);
  assert.deepEqual(w, [...w].sort((a, b) => a - b), "구름 크기가 단조 증가가 아니다");
  // 새는 두 프레임이 달라야 '난다'로 읽힌다(한 장이면 매달린 것처럼 보인다)
  assert.notDeepEqual(birdSprite(0, "#555").rows, birdSprite(1, "#555").rows);
});

test("홈 풍경이 다시 베지어로 돌아가지 않는다", () => {
  /* 소스 스캔 — path 의 d 리터럴에 곡선 명령이 있으면 벡터로 되돌아간 것이다.
     ⚠ 주석을 먼저 지운다(이 저장소는 '왜'를 길게 적어서 정규식이 설명문을 먼저 문다). */
  const src = readFileSync(join(process.cwd(), "src", "components", "HomeWorld.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const hills = [...src.matchAll(/d="(M[^"]*)"/g)].map((m) => m[1]);
  for (const d of hills)
    assert.equal(/[CcQqSsAa]/.test(d), false, `HomeWorld 에 곡선 경로가 남아 있다: ${d.slice(0, 60)}`);
  // 계단을 매끈하게 깎으면 격자로 만든 의미가 없다
  assert.ok(src.includes("crispEdges"), "shapeRendering=crispEdges 가 빠졌다");
});
