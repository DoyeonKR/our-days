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

test("사냥 장면 시간표 — 쫓기 → 물고 흔들며 세 번 뜯기 → 놓고 가라앉기 → 끝", () => {
  assert.equal(mealPose(MEAL_CHASE + 0.05).held, true);
  assert.equal(mealPose(MEAL_CHASE + 0.05).bites, 1);
  assert.equal(mealPose(MEAL_CHASE + 2).bites, 3);
  let maxShake = 0; for (let t = MEAL_CHASE; t < MEAL_CHASE + 2; t += 0.01) maxShake = Math.max(maxShake, Math.abs(mealPose(t).shake));
  assert.ok(maxShake > 0.8, "머리를 세게 흔든다");
  assert.equal(mealPose(MEAL_END - 0.5).held, false);
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
  assert.match(scene, /"blood",meal\.tint,elapsed\),makeBurst\(mx,my,mz,size,"chunk"/, "뜯을 때 피와 살점");
  assert.match(scene, /makeBurst\(mx,my,mz,size,"chunk"/, "뜯을 때 살점");
  assert.match(scene, /if\(!calm\)ghost\.phase\+=dt\*34/, "물린 먹이가 꼬리를 퍼덕인다");
  assert.match(scene, /\(meal\?swimmers\.get\(meal\.ghostId\):undefined\)\?\?swimmers\.get/);
  const game = readFileSync(join(process.cwd(), "src/components/AquariumGame.tsx"), "utf8");
  assert.match(game, /const \[shown, setShown\] = useState\(!g\.ate\)/);
  assert.match(game, /aquaDangers\(a\)/);
});

test("턱 — 다가가며 크게 벌리고, 뜯는 순간 콱 닫고, 물고 있는 동안 씹는다 · 사냥하는 종에만", () => {
  assert.ok(mealPose(MEAL_CHASE - 0.05).jaw > 0.8, "다가가며 크게");
  assert.equal(mealPose(MEAL_CHASE + 0.03).jaw, 0, "뜯는 순간 닫힌다");
  const chew = [0.3, 0.4, 0.45].map((d) => mealPose(MEAL_CHASE + d).jaw);
  assert.ok(Math.max(...chew) - Math.min(...chew) > 0.1, "씹는다(열렸다 닫혔다)");
  assert.ok(mealPose(MEAL_END).jaw < 0.05, "끝나면 닫힌다");
  const post = readFileSync(join(process.cwd(), "src/lib/aqua3d/post.ts"), "utf8");
  assert.match(post, /export function addJaw/);
  assert.match(post, /float saw = /, "톱니 이빨");
  const scene = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  // 먹고 있는 그 한 마리만(재질 복제) · 두족류는 턱 대신 감싸기 · 끝나면 원래 재질로
  assert.match(post, /const m = src\.clone\(\);/, "재질을 복제해 그 한 마리에만");
  assert.match(scene, /meal!\.jaw\?\.restore\(\)/);
  assert.match(scene, /meal\.jaw\?\.set\(/);
  // 물빛이 붉게 · 뜯을 때 화면 흔들림 · 남은 뼈
  assert.match(scene, /lerp\(BLOOD_FOG,bloodLevel/);
  assert.match(scene, /shakeAt=elapsed/);
  assert.match(scene, /makeBones\(ghost\.length/);
});
