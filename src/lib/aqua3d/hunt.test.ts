// 쫓고 달아나기 · 사냥 장면(2026-11-11)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HUNT, MEAL_CHASE, MEAL_END, MEAL_LONGEST, huntOf, huntPass, mealEnd, mealPose, tailBeat, type HuntStyle } from "./hunt.ts";
import { PREDATORS } from "../predation.ts";

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
  assert.match(scene, /huntPass\(motion\.positions,motion\.lengths,motion\.preds,motion\.flee,motion\.count,dt,motion\.pinned,motion\.fear,motion\.busy\)/);
  assert.match(scene, /huntShot\(/, "사냥 카메라는 둘을 같이 본다");
  assert.match(scene, /const inMeal=m===mealGhost\|\|m===mealPredS,so=inMeal\?0:sideOnOf/, "장면의 둘은 옆모습 돌리기를 안 한다(입 자리가 어긋난다)");
  assert.match(scene, /m\.phase\+=dt\*m\.course\.effort\*\(tailBeat\(f\)-1\)/, "겁 · 살금살금이 꼬리 박자를 바꾼다");
  assert.match(scene, /"blood",meal\.tint,elapsed\),makeBurst\(mx,my,mz,size,"chunk"/, "뜯을 때 피와 살점");
  assert.match(scene, /makeBurst\(mx,my,mz,size,"chunk"/, "뜯을 때 살점");
  assert.match(scene, /if\(!calm\)ghost\.phase\+=dt\*34/, "물린 먹이가 꼬리를 퍼덕인다");
  // 카메라는 먹이를 따라가고, 통째로 삼킨 뒤엔 사냥꾼을
  assert.match(scene, /\(meal\?swimmers\.get\(meal\.style==="gulp"&&meal\.bitesDone>0\?meal\.predId:meal\.ghostId\):undefined\)\?\?swimmers\.get/);
  const game = readFileSync(join(process.cwd(), "src/components/AquariumGame.tsx"), "utf8");
  assert.match(game, /const \[shown, setShown\] = useState\(!g\.ate\)/);
  assert.match(game, /aquaDangers\(a\)/);
  assert.match(game, /setShown\(true\), MEAL_LONGEST \* 1000/, "소식 카드는 가장 긴 사냥 장면 뒤에");
});

test("사냥 방식 · 이빨 — 사냥하는 종마다 정해져 있고, 방식마다 장면이 다르다", () => {
  for (const f of PREDATORS) assert.ok(HUNT[f], `${f} 의 사냥 방식`);
  const styles = new Set(Object.values(HUNT).map((h) => h.style));
  assert.deepEqual([...styles].sort(), ["ambush", "charge", "gulp", "strike", "wrap"]);
  const teeth = new Set(Object.values(HUNT).map((h) => h.jaw.teeth));
  assert.ok(teeth.size >= 5, "이빨이 다섯 가지");
  assert.equal(huntOf("great_white").jaw.teeth, "saw");
  assert.equal(huntOf("catfish").style, "gulp");
  assert.equal(huntOf("octopus").style, "wrap");
  for (const s of styles as Set<HuntStyle>) {
    assert.equal(mealPose(mealEnd(s) + 0.01, s).done, true, `${s} 끝`);
    assert.ok(mealEnd(s) <= MEAL_LONGEST);
  }
  // 숨어 기다리기 — 덮치기 직전까지 붙지 않고 꼬리도 거의 안 친다, 덮칠 땐 0.3초 안에 붙는다
  assert.equal(mealPose(1.5, "ambush").chase, 0);
  assert.equal(mealPose(1.5, "ambush").lurk, true);
  assert.ok(mealPose(1.9, "ambush").chase > 0.99);
  // 통째로 — 빨려 들어가 사라지고 가라앉지 않는다
  assert.ok(mealPose(2.6, "gulp").swallow > 0.95);
  assert.equal(mealPose(4, "gulp").sink, 0);
  assert.ok(mealPose(1.95, "gulp").jaw > 0.9, "입을 크게 벌린다");
  // 튕기기 — 먼저 몸을 당기고, 물면 몸째 비틀어 돈다
  assert.ok(mealPose(1.2, "strike").crouch > 0.5);
  let roll = 0; for (let t = 1.7; t < 3.9; t += 0.02) roll = Math.max(roll, Math.abs(mealPose(t, "strike").roll));
  assert.ok(roll > 3, "한 바퀴 가까이 돈다");
  // 겁 → 꼬리 박자
  assert.ok(tailBeat(1) > 1.8 && tailBeat(-1) < 0.6 && tailBeat(0) === 1);
});

test("겁 — 사냥꾼 곁의 먹잇감은 겁에 질리고(꼬리를 빨리), 다가가는 사냥꾼은 살금살금", () => {
  const n = 2, off = new Float32Array(6), fear = new Float32Array(2);
  for (let f = 0; f < 60; f++) huntPass(new Float32Array([0, 0, 0, 1.2, 0, 0]), new Float32Array([2, 0.5]), new Uint8Array([1, 0]), off, n, 1 / 30, undefined, fear);
  assert.ok(fear[1] > 0.4, `먹이 ${fear[1]}`);
  assert.ok(fear[0] < -0.3, `사냥꾼 ${fear[0]}`);
});

test("이빨 셰이더 — 종마다 다른 모양 · 밀도 · 길이 · 벌리는 각", () => {
  const post = readFileSync(join(process.cwd(), "src/lib/aqua3d/post.ts"), "utf8");
  assert.match(post, /uniform vec4 jawLook/);
  assert.match(post, /vJawX = \(transformed\.x - hx\) \/ L \* jawLook\.x/);
  assert.match(post, /\* jawLook\.z;/, "벌리는 각");
  const scene = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  assert.match(scene, /addJaw\(pred\.root,jawFor\(pred\.family\)\)/);
  assert.match(scene, /mealPose\(elapsed-meal\.t0,meal\.style\)/);
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

test("사냥 카메라 — 둘의 가운데를 옆에서, 둘이 다 들어오게 · 앞쪽에서만", async () => {
  const { huntShot, SHOT_ANGLE_MAX } = await import("./hunt.ts");
  // x 축으로 늘어선 둘 → 앞(각 0)에서 본다
  const s = huntShot(-1, 0, 0, 1, 0, 0, 2, 0.4, 0.3);
  assert.ok(Math.abs(s.angle) < 1e-9 && Math.abs(s.x) < 1e-9, `각 ${s.angle}`);
  assert.ok(s.dist >= 2 * 1.5, "둘 사이의 1.5배 넘게 물러난다");
  // z 축(카메라 쪽)으로 늘어선 둘 → 옆으로 돌되 상한까지만
  const t = huntShot(0, 0, -1, 0, 0, 1, 2, 0.4, 0);
  assert.ok(Math.abs(Math.abs(t.angle) - SHOT_ANGLE_MAX) < 1e-9, `상한 ${t.angle}`);
  // 작은 먹이여도 사냥꾼 크기만큼은 물러난다(예전 3.6 = 먹이 몸길이 기준 하한)
  const u = huntShot(0, 0, 0, 0.3, 0, 0, 4, 0.2, 0);
  assert.ok(u.dist >= 4 * 1.9, `거리 ${u.dist}`);
  // 붙어 있으면(같은 자리) 지금 각 그대로
  assert.equal(huntShot(0, 0, 0, 0, 1, 0, 2, 0.4, 0.2).angle, 0.2);
});

test("장면은 모델이 다 오거나 상한이 지나야 연다", async () => {
  const { mealReady, MEAL_WAIT_MAX } = await import("./hunt.ts");
  assert.equal(mealReady(true, false, 1), false);
  assert.equal(mealReady(true, true, 0), true);
  assert.equal(mealReady(false, false, MEAL_WAIT_MAX), true);
});

test("입 자리 — 코끝보다 조금 뒤, 입이 큰 종일수록 더 뒤", async () => {
  const { mouthReach } = await import("./hunt.ts");
  assert.ok(mouthReach("great_white") < 0.46 && mouthReach("great_white") > 0.35);
  assert.ok(mouthReach("gulper_eel") < mouthReach("eel"), "풍선장어 입이 더 크다");
  assert.equal(mouthReach("octopus"), 0.08);
});

test("사냥 장면의 먹이는 다른 사냥꾼이 노리지 않는다(busy)", () => {
  const pos = [0, 0, 0, 1.5, 0, 0], off = new Float32Array(6);
  let P = new Float32Array(pos);
  for (let f = 0; f < 60; f++) { P = new Float32Array(pos); huntPass(P, new Float32Array([2, 0.5]), new Uint8Array([1, 0]), off, 2, 1 / 30, undefined, undefined, new Uint8Array([0, 1])); }
  assert.ok(Math.abs(P[0]) < 1e-6 && Math.abs(P[3] - 1.5) < 1e-6, "둘 다 그대로");
});

test("가리지 않는 자리 — 앞을 막은 물고기 · 장식을 비켜 옆이나 위로, 비슷하면 지금 자리 그대로", async () => {
  const { blockedBy, clearShot } = await import("./hunt.ts");
  // 장면(0,0,0), 정면 카메라(0,0,8) 사이에 큰 물고기
  const fish = [{ x: 0, y: 0, z: 4, r: 1 }];
  assert.ok(blockedBy(0, 0, 8, 0, 0, 0, fish) > 0.9);
  assert.equal(blockedBy(4, 0, 6, 0, 0, 0, fish), 0);
  const a = clearShot(0, 0, 0, 8, 0, 0, null, fish);
  assert.ok(Math.abs(a.angle) >= 0.35 || a.up > 0, `비켜 간다 ${JSON.stringify(a)}`);
  // 아무것도 없으면 옆(base) 그대로 · 지금 자리가 거의 같으면 안 바꾼다
  assert.deepEqual(clearShot(0, 0, 0, 8, 0, 0.2, null, []), { angle: 0.2, up: 0, dist: 8 });
  assert.equal(clearShot(0, 0, 0, 8, 0, 0, { angle: 0.35, up: 0 }, []).angle, 0.35);
  // 바닥 장식 기둥이 사방을 막으면 위에서 내려다본다
  const ring = [-0.7, -0.35, 0, 0.35, 0.7, 0.95, -0.95].map((g) => ({ x: Math.sin(g) * 4, y: -1, z: Math.cos(g) * 4, r: 1.6, top: 0.8 }));
  assert.ok(clearShot(0, 0, 0, 8, 0, 0, null, ring).up > 0, "위로");
  // 기둥(장식) — 시선 높이가 기둥 위면 안 가린다
  const col = [{ x: 0, y: -1, z: 4, r: 1, top: 0.5 }];
  assert.ok(blockedBy(0, 0, 8, 0, 0, 0, col) > 0.9);
  assert.equal(blockedBy(0, 3, 8, 0, 3, 0, col), 0);
});
