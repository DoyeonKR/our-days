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
  assert.match(scene, /huntPass\(motion\.positions,motion\.lengths,motion\.preds,motion\.flee,motion\.count,dt,motion\.pinned,motion\.fear,motion\.busy,scare\)/);
  assert.match(scene, /huntShot\(/, "사냥 카메라는 둘을 같이 본다");
  assert.match(scene, /const inMeal=m===mealGhost\|\|m===mealPredS,so=inMeal\?0:sideOnOf/, "장면의 둘은 옆모습 돌리기를 안 한다(입 자리가 어긋난다)");
  assert.match(scene, /m\.phase\+=dt\*m\.course\.effort\*\(tailBeat\(f\)-1\)/, "겁 · 살금살금이 꼬리 박자를 바꾼다");
  assert.match(scene, /"blood",meal\.tint,elapsed\),makeBurst\(mx,my,mz,size\*\.22,"chunk"/, "국소 출혈과 작은 조각");
  assert.match(scene, /preyPhase\+=dt\*18\*pose\.vitality/, "먹이는 점차 힘을 잃는다");
  // 카메라는 먹이를 따라가고, 통째로 삼킨 뒤엔 사냥꾼을
  assert.match(scene, /\(meal&&meal\.t0>=0\?swimmers\.get\(meal\.style==="gulp"&&meal\.bitesDone>0\?meal\.predId:meal\.ghostId\):undefined\)\?\?swimmers\.get/);
  assert.match(scene, /window\.dispatchEvent\(new Event\(MEAL_END_EVENT\)\)/, "장면이 끝나면 알린다");
  const game = readFileSync(join(process.cwd(), "src/components/AquariumGame.tsx"), "utf8");
  assert.match(game, /const \[shown, setShown\] = useState\(!g\.ate\)/);
  assert.match(game, /aquaDangers\(a\)/);
  assert.match(game, /window\.addEventListener\(MEAL_END_EVENT, show\)/, "소식 카드는 사냥 장면이 끝났다는 알림 뒤에");
  assert.match(game, /setTimeout\(show, \(MEAL_LONGEST \+ MEAL_WAIT_MAX\) \* 1000/, "못 들으면 가장 긴 장면 + 모델 기다림 뒤에");
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
  assert.ok(roll > .5 && roll <= .65, "입 접촉을 유지하는 제한된 비틀림");
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
  assert.doesNotMatch(scene, /makeBones\(/, "갑자기 일반 물고기 뼈로 바뀌지 않는다");
  assert.match(scene, /faceMouth\(pred.root,contact\)/, "실제 입 형상에 접촉");
  assert.match(scene, /lingeringBursts.push/, "장면 종료 뒤 출혈은 자연 소멸");
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
  assert.ok(Math.abs(a.angle) >= 0.35 || a.elev > 0, `비켜 간다 ${JSON.stringify(a)}`);
  // 아무것도 없으면 옆(base) 그대로 · 지금 자리가 거의 같으면 안 바꾼다
  assert.deepEqual(clearShot(0, 0, 0, 8, 0, 0.2, null, []), { angle: 0.2, elev: 0 });
  assert.equal(clearShot(0, 0, 0, 8, 0, 0, { angle: 0.35, elev: 0 }, []).angle, 0.35);
  // 바닥 장식 기둥이 사방을 막으면 위에서 내려다본다
  const ring = [-0.7, -0.35, 0, 0.35, 0.7, 0.95, -0.95].map((g) => ({ x: Math.sin(g) * 4, y: -1, z: Math.cos(g) * 4, r: 1.6, top: 0.8 }));
  assert.ok(clearShot(0, 0, 0, 8, 0, 0, null, ring).elev > 0, "위로");
  // 기둥(장식) — 시선 높이가 기둥 위면 안 가린다
  const col = [{ x: 0, y: -1, z: 4, r: 1, top: 0.5 }];
  assert.ok(blockedBy(0, 0, 8, 0, 0, 0, col) > 0.9);
  assert.equal(blockedBy(0, 3, 8, 0, 3, 0, col), 0);
});

test("사냥 장면 둘레의 다른 물고기는 크기와 상관없이 비켜난다(scare)", () => {
  const pos = [0, 0, 0, 0.8, 0, 0], off = new Float32Array(6);
  let P = new Float32Array(pos);
  // 큰 물고기(길이 3, 사냥꾼 아님)가 장면 자리(0,0,0) 곁에 있다
  for (let f = 0; f < 60; f++) { P = new Float32Array(pos); huntPass(P, new Float32Array([1, 3]), new Uint8Array([1, 0]), off, 2, 1 / 30, undefined, undefined, new Uint8Array([1, 0]), { x: 0, y: 0, z: 0, r: 3 }); }
  assert.ok(P[3] > 0.8 + 0.3, `비켜났다 ${P[3]}`);
  assert.equal(P[0], 0, "장면의 둘은 그대로");
});

test("모래에 붙은 물고기는 평소엔 그대로, 사냥 장면 곁이면 모래 위로 옆으로만 비켜난다", () => {
  const pos = [0, 0, 0, 0.8, -5, 0.2], off = new Float32Array(6);
  let P = new Float32Array(pos);
  for (let f = 0; f < 60; f++) { P = new Float32Array(pos); huntPass(P, new Float32Array([1, 3]), new Uint8Array([1, 0]), off, 2, 1 / 30, new Float32Array([0, 1]), undefined, new Uint8Array([1, 0]), { x: 0, y: -4, z: 0, r: 3 }); }
  assert.ok(P[3] > 0.8 + 0.2, `옆으로 비켜났다 ${P[3]}`);
  assert.equal(P[4], -5, "위아래는 그대로(바닥에서 안 뜬다)");
  const off2 = new Float32Array(6); let Q = new Float32Array(pos);
  for (let f = 0; f < 60; f++) { Q = new Float32Array(pos); huntPass(Q, new Float32Array([1, 3]), new Uint8Array([1, 0]), off2, 2, 1 / 30, new Float32Array([0, 1])); }
  assert.ok(Math.abs(Q[3] - 0.8) < 1e-6, "장면이 없으면 그대로");
});

test("다시 보기 — 잡아먹힌 물고기를 사냥꾼 시점으로(2026-11-12) · 떠난 사냥꾼은 잠깐 불러온다 · 본 소식 번호는 안 건드린다", () => {
  const scene = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  assert.match(scene, /replay\(n:number\)/);
  assert.match(scene, /pid=has\?item\.id:-800000-replayN/, "수조를 떠난 사냥꾼은 임시로");
  assert.match(scene, /mealSeen=keep/, "본 소식 번호는 그대로");
  assert.match(scene, /if\(meal!\.predId<=-800000&&pred\)\{dropFish\(pred\)/, "장면이 끝나면 임시 사냥꾼을 뺀다(배포 빌드에서도)");
  assert.match(scene, /const povGoal=meal&&meal\.pov&&meal\.t0>=0&&mealPredS/, "사냥꾼 시점 카메라");
  const tank = readFileSync(join(process.cwd(), "src/components/Aquarium3D.tsx"), "utf8");
  assert.match(tank, /controller\.current\?\.replay\(replaySignal\.n\)/);
  const game = readFileSync(join(process.cwd(), "src/components/AquariumGame.tsx"), "utf8");
  assert.match(game, /className="tap aqua-replay" onClick=\{\(\) => startReplay\(g\.n\)\}/);
  assert.match(game, /사냥꾼 시점으로 다시 보기/);
  const post = readFileSync(join(process.cwd(), "src/lib/aqua3d/post.ts"), "utf8");
  assert.match(post, /!gl_FrontFacing && vJaw > 0\.05 && vThick > 0\.012/, "얇은 지느러미 판의 뒷면은 목구멍 빛으로 칠하지 않는다(등에 붉은 줄)");
});

test("사냥꾼 시점 카메라(2026-11-12 다섯 방식 확인) — 몸 굵기만큼 옆에서 · 수면 아래 · 너무 올려다보지 않게 · 돌아가기 시작하면 부드럽게 빠진다", () => {
  const scene = readFileSync(join(process.cwd(), "src/lib/aqua3d/scene.ts"), "utf8");
  assert.match(scene, /povBox\.setFromObject\(mealPredS\.root\)/, "몸 굵기를 잰다(메기 · 문어는 몸속으로 들어갔다)");
  assert.match(scene, /return replayShot\(\{p:P,fwd:povFwd,side:\{x:povSide\.x\*c-povSide\.z\*s,y:0,z:povSide\.x\*s\+povSide\.z\*c\},len:L,r:povR,prey:mealGhost&&!swallowed\?mealGhost\.root\.position:null,fov:camera\.fov,aspect:camera\.aspect,halfW:5\*wide-\.35,top:tallY\(4\.3,tall\)/, "넓게 보는 카메라 · 수면 아래 · 옆벽 안");
  assert.match(scene, /for\(const d of \[0,-\.5,\.5,-1,1\]\)\{const t=shotAt\(d\),sc=blockedBy\(/, "가리는 물고기 · 장식을 비키는 각");
  assert.match(scene, /if\(cur>bs\+\.6\)povTurn=best;/, "곁을 지나는 물고기 하나에 넘어가지 않는다");
  assert.match(scene, /scene\.fog\.far\+=\(povDist\+9\+4\*deep-scene\.fog\.far\)\*povK/, "안개도 물러난 거리만큼");
  assert.match(scene, /povTarget\.y=Math\.min\(povTarget\.y,povEye\.y\+hd\*\.58\)/, "30° 까지만 올려다본다");
  assert.match(scene, /&&povBack<\.05\?1:0/, "돌아가기 시작하면 빠진다");
  assert.match(scene, /camera\.position\.lerp\(povCam,povK\)/, "들어가고 나올 때 부드럽게");
  assert.match(scene, /if\(hl>\.35\)/, "곧게 위아래를 볼 땐 옆 방향을 그대로");
});

test("다시 보기 카메라(2026-11-13) — 사냥꾼 몸과 먹이가 세로 화면에 다 들어오게 물러나고 · 옆벽 · 뒤 바위 · 수면 안에 머문다", async () => {
  const { replayShot } = await import("./hunt.ts");
  const norm = (v: { x: number; y: number; z: number }) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const sub = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const fov = 44, aspect = 0.62; // 폰 세로 화면
  const hf = Math.tan((fov * Math.PI) / 360) * aspect, vf = Math.tan((fov * Math.PI) / 360);
  let n = 0;
  for (const len of [0.8, 2, 4.5]) for (const yaw of [0, 1.2, 2.6, 4]) for (const sepK of [0.2, 0.8, 1.6]) {
    const fwd = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) };
    let side = { x: -fwd.z, y: 0, z: fwd.x };
    if (side.z < 0) side = { x: -side.x, y: 0, z: -side.z }; // 앞쪽(카메라 쪽)
    const p = { x: 0.5, y: -1, z: 0 };
    const prey = { x: p.x + fwd.x * len * (0.6 + sepK), y: p.y + 0.3, z: p.z + fwd.z * len * (0.6 + sepK) };
    const s = replayShot({ p, fwd, side, len, r: len * 0.12, prey, fov, aspect, halfW: 9, top: 2, floor: -4.7, back: -2.5 });
    const look = norm(sub(s.target, s.eye)), right = norm(cross(look, { x: 0, y: 1, z: 0 })), up = cross(right, look);
    const tail = { x: p.x - fwd.x * len * 0.5, y: p.y, z: p.z - fwd.z * len * 0.5 }, head = { x: p.x + fwd.x * len * 0.5, y: p.y, z: p.z + fwd.z * len * 0.5 };
    for (const q of [tail, head, prey]) {
      const d = sub(q, s.eye), z = dot(d, look);
      assert.ok(z > 0, "카메라 앞");
      assert.ok(Math.abs(dot(d, right) / z) <= hf * 1.02 && Math.abs(dot(d, up) / z) <= vf * 1.02, `len ${len} yaw ${yaw} sep ${sepK}: 화면 밖 h ${(dot(d, right) / z / hf).toFixed(2)} v ${(dot(d, up) / z / vf).toFixed(2)} eye ${JSON.stringify(s.eye)} dist ${s.dist.toFixed(2)}`);
    }
    const old = len * 0.12 + len * 0.12 + len * 0.18; // 예전 옆 거리(몸 굵기 + 몸길이 30%)
    assert.ok(s.dist > old * 2.5, `예전보다 한참 멀리 (${s.dist.toFixed(2)} · 예전 ${old.toFixed(2)})`);
    n++;
  }
  assert.equal(n, 36);
  // 벽 · 바위 · 수면
  const w = replayShot({ p: { x: 4.6, y: 1.8, z: -2 }, fwd: { x: 1, y: 0, z: 0 }, side: { x: 0, y: 0, z: -1 }, len: 4, r: 0.6, prey: { x: 8, y: 2, z: -2 }, fov, aspect, halfW: 4.65, top: 2, floor: -4.7, back: -2.5 });
  assert.ok(w.eye.x <= 4.65 && w.eye.y <= 2 && w.eye.z >= -2.5, JSON.stringify(w.eye));
  // 11단계 돔 안 — 앞 바다 그림 벽 안쪽에 머문다(밀려 나갈 때도)
  for (let i = 0; i < 400; i++) {
    const yaw = (i / 400) * Math.PI * 2, fwd = { x: Math.cos(yaw), y: 0, z: Math.sin(yaw) };
    const d = replayShot({ p: { x: ((i * 37) % 9) - 4, y: -3.3, z: ((i * 53) % 12) - 6 }, fwd, side: { x: 0, y: 0, z: 1 }, len: 1.5, r: 0.3, prey: { x: fwd.x * 2.5, y: -3, z: fwd.z * 2.5 }, fov: 58, aspect: 0.46, halfW: 4.65, top: 2, floor: -4.7, back: -6.7, front: 6.9 });
    assert.ok(d.eye.z <= 6.9 + 1e-9, `돔 앞 벽 너머 ${d.eye.z}`);
  }
  // 통째로 삼킨 뒤 — 입 앞을 본다
  const g = replayShot({ p: { x: 0, y: 0, z: 0 }, fwd: { x: 1, y: 0, z: 0 }, side: { x: 0, y: 0, z: 1 }, len: 2, r: 0.3, prey: null, fov, aspect, halfW: 9, top: 9, floor: -9, back: -9 });
  assert.ok(Math.abs(g.target.x - 0.6) < 1e-9 && g.dist >= 3.2, "삼킨 뒤엔 꼬리 ~ 입 앞의 가운데");
});
