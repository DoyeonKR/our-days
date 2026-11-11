// 쫓고 달아나기 · 사냥 장면(2026-11-11)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MEAL_CHASE, MEAL_END, huntPass, mealPose } from "./hunt.ts";

function run(frames: number, pos: number[], len: number[], pred: number[], pinned?: number[]) {
  const n = len.length, off = new Float32Array(n * 3);
  let P = new Float32Array(pos);
  for (let f = 0; f < frames; f++) { P = new Float32Array(pos); huntPass(P, new Float32Array(len), new Uint8Array(pred), off, n, 1 / 30, pinned ? new Float32Array(pinned) : undefined); }
  return P;
}

test("작은 물고기는 사냥꾼에게서 멀어지고 · 사냥꾼은 다가간다 · 같은 크기끼리는 안 한다", () => {
  // 사냥꾼(길이 2) x=0, 먹잇감(길이 0.5) x=1.5
  const P = run(60, [0, 0, 0, 1.5, 0, 0], [2, 0.5], [1, 0]);
  assert.ok(P[3] > 1.5 + 0.2, `먹이가 달아났다 ${P[3]}`);
  assert.ok(P[0] > 0.05, `사냥꾼이 다가갔다 ${P[0]}`);
  const Q = run(60, [0, 0, 0, 1.5, 0, 0], [2, 1.9], [1, 0]);
  assert.ok(Math.abs(Q[3] - 1.5) < 1e-6 && Math.abs(Q[0]) < 1e-6, "덩치가 비슷하면 그대로");
});

test("보정은 천천히 따라간다(떨림 없음) · 끝이 있다 · 모래 위 물고기는 안 움직인다", () => {
  const first = run(1, [0, 0, 0, 0.6, 0, 0], [3, 0.4], [1, 0]);
  const later = run(90, [0, 0, 0, 0.6, 0, 0], [3, 0.4], [1, 0]);
  assert.ok(first[3] - 0.6 < later[3] - 0.6, "한 프레임에 다 밀지 않는다");
  assert.ok(Math.hypot(later[3] - 0.6, later[4], later[5]) <= 0.9 + 1e-6, "최대 0.9");
  const pin = run(60, [0, 0, 0, 0.6, 0, 0], [3, 0.4], [1, 0], [0, 1]);
  assert.ok(Math.abs(pin[3] - 0.6) < 1e-6, "모래 위 물고기는 그대로");
});

test("사냥 장면 시간표 — 쫓기 → 물기 → 가라앉기 → 끝", () => {
  assert.equal(mealPose(0).chase, 0);
  assert.equal(mealPose(MEAL_CHASE - 0.01).bit, false);
  assert.equal(mealPose(MEAL_CHASE).bit, true);
  assert.equal(mealPose(MEAL_END + 0.01).done, true);
  assert.ok(mealPose(MEAL_END - 0.1).sink > 0.9);
});

test("수조가 쓰는 곳 — 유령으로 다시 그리기 · 피 · 카메라 · 소식 카드는 장면 뒤에", () => {
  const scene = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  assert.match(scene, /for\(const\[id,m\]of swimmers\)if\(id>=0&&!ids\.has\(id\)\)/, "유령(음수 id)은 상태 갱신이 지우지 않는다");
  // 사냥꾼이 이미 swimmers 에 있는지 보려면 물고기를 넣은 뒤에 찾아야 한다(먼저 찾으면 첫 갱신에 건너뛰었다)
  assert.ok(scene.indexOf("// 잡아먹기 소식") > scene.indexOf("try{addFish(f);}"), "물고기를 넣은 뒤에 찾는다");
  assert.match(scene, /huntPass\(motion\.positions,motion\.lengths,motion\.preds,motion\.flee,motion\.count,dt,motion\.pinned\)/);
  assert.match(scene, /makeBlood\(/);
  assert.match(scene, /\(meal\?swimmers\.get\(meal\.ghostId\):undefined\)\?\?swimmers\.get/);
  const game = readFileSync(join(process.cwd(), "src/components/AquariumGame.tsx"), "utf8");
  assert.match(game, /const \[shown, setShown\] = useState\(!g\.ate\)/);
  assert.match(game, /aquaDangers\(a\)/);
});
