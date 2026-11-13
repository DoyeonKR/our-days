// 수조 효과 lock (2026-11-12) — 먹이 알갱이 · 탁한 물 · 자라는 물고기 · 움직임 줄이기의 사냥 장면.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as T from "three";
import { EAT_MIN, FOOD_COUNT, FOOD_LIFE, FOOD_STILL_AGE, MOUTH_AHEAD, makeFood, type FoodFish } from "./food.ts";
import { MOTE_COUNT, makeMotes } from "./murk.ts";
import { WATER_LIGHT, waterLit } from "./waterlight.ts";
import { FINAL_FRAG } from "./post.ts";

const ascii = (s: string) => /^[\x00-\x7f]*$/.test(s);
const scene = readFileSync(join(import.meta.dirname, "scene.ts"), "utf8");
const FLOOR = -5.3, TOP = 4.75;
const world = (deep = 1) => ({ top: TOP, deep, floorAt: () => FLOOR });
const noFish: FoodFish = { positions: new Float32Array(3), heading: new Float32Array(3), lengths: new Float32Array(1), courses: [], count: 0 };
const pos = (f: ReturnType<typeof makeFood>) => f.points.geometry.getAttribute("position") as T.BufferAttribute;
const alpha = (f: ReturnType<typeof makeFood>) => f.points.geometry.getAttribute("aAlpha") as T.BufferAttribute;

test("먹이 알갱이 — 물고기가 모이는 자리(가로 ±0.9 · 앞뒤 ±0.9 × 깊이)에 뿌리고, 조각은 수면 가까이 · 알갱이는 바닥까지 · 먹이 창 끝에 사라진다", () => {
  const f = makeFood(), x = 1.7, deep = 2.4;
  assert.equal(f.points.geometry.drawRange.count, 0, "뿌리기 전엔 그리지 않는다");
  f.drop(10, x, world(deep));
  assert.equal(f.points.geometry.drawRange.count, FOOD_COUNT);
  let landed = 0, flakesHigh = 0, flakes = 0;
  for (let t = 10; t < 10 + FOOD_LIFE + 0.5; t += 1 / 30) {
    const n = f.step(t, 1 / 30, noFish, false), age = t - 10, P = pos(f);
    for (let i = 0; i < FOOD_COUNT; i++) {
      if (alpha(f).getX(i) <= 0) continue;
      assert.ok(Math.abs(P.getX(i) - x) < 1.1, `가로 ${P.getX(i)}`);
      assert.ok(Math.abs(P.getZ(i)) < 0.95 * deep + 0.1, `앞뒤 ${P.getZ(i)}`);
      assert.ok(P.getY(i) <= TOP && P.getY(i) >= FLOOR, `높이 ${P.getY(i)}`);
      if (Math.abs(age - 8) < 1 / 60) { if (P.getY(i) <= FLOOR + 0.05) landed++; else { flakes++; if (P.getY(i) > TOP - 2) flakesHigh++; } }
    }
    if (age > 0.5 && age < FOOD_LIFE - 4) assert.ok(n > FOOD_COUNT * 0.9, `${age.toFixed(1)}초에 ${n}알`);
  }
  // 8초면 알갱이(30%)는 바닥(바닥 물고기는 4.2초 뒤부터 바닥에서 먹는다) · 조각은 아직 수면 가까이(헤엄치는 물고기가 8초까지 수면에서 먹는다)
  assert.ok(landed >= FOOD_COUNT * 0.15 && landed <= FOOD_COUNT * 0.45, `바닥에 ${landed}`);
  assert.ok(flakesHigh >= flakes * 0.9, `수면 가까이 조각 ${flakesHigh}/${flakes}`);
  assert.equal(f.points.geometry.drawRange.count, 0, "먹이 창이 지나면 거둔다");
  f.dispose();
});

test("먹이 알갱이 — 먹이 쪽으로 온 물고기(course.feed) 입에 닿으면 먹혀 사라지고, 한 물고기는 한 프레임에 하나만 · 먹이를 안 보는 물고기는 안 먹는다", () => {
  const f = makeFood();
  f.drop(0, 0, world());
  f.step(1, 1 / 30, noFish, false);
  const P = pos(f), L = 0.5;
  // 0번 알 바로 뒤(입 = 머리 앞 0.45 L)에 +x 를 보는 물고기
  const fish = (feed: number): FoodFish => ({ positions: new Float32Array([P.getX(0) - L * MOUTH_AHEAD, P.getY(0), P.getZ(0)]), heading: new Float32Array([1, 0, 0]), lengths: new Float32Array([L]), courses: [{ feed }], count: 1 });
  f.step(1 + 1 / 30, 1 / 30, fish(0), false);
  assert.ok(alpha(f).getX(0) > 0, "먹이를 안 보는 물고기는 안 먹는다");
  const eatenBefore = [...Array(FOOD_COUNT).keys()].filter((i) => alpha(f).getX(i) <= 0).length;
  for (let k = 0; k < 10; k++) f.step(1 + (2 + k) / 30, 1 / 30, fish(1), false);
  assert.equal(alpha(f).getX(0), 0, "입에 닿은 알은 먹혔다");
  const eaten = [...Array(FOOD_COUNT).keys()].filter((i) => alpha(f).getX(i) <= 0).length - eatenBefore;
  assert.ok(eaten >= 1 && eaten <= 10, `열 프레임에 ${eaten}알(한 프레임 하나까지)`);
  assert.ok(EAT_MIN > 0.05, "아주 작은 물고기도 먹는다");
  f.dispose();
});

test("먹이 알갱이 — 움직임 줄이기면 한 장면(움직이지도 먹지도 않는다) · 프레임마다 새 객체를 안 만든다 · 셰이더 ASCII", () => {
  const f = makeFood();
  f.drop(5, 0, world());
  f.step(5, 0, noFish, true);
  const snap = Array.from(pos(f).array as Float32Array);
  f.step(5, 0, noFish, true);
  assert.deepEqual(Array.from(pos(f).array as Float32Array), snap, "멈춘 장면");
  assert.ok(FOOD_STILL_AGE > 0.8, "수면에서 조금 퍼진 모습");
  f.dispose();
  const src = readFileSync(join(import.meta.dirname, "food.ts"), "utf8");
  // 물고기 수가 늘 때만 다시 만드는 '먹은 물고기' 표는 뺀다
  const step = src.slice(src.indexOf("function step("), src.indexOf("return { points, drop")).replace(/if \(ate\.length < fish\.count\)[^\n]*/, "");
  assert.doesNotMatch(step, /new [A-Z]|\[\]|\{\s*\}/, "step 안에서 새 객체 · 배열");
});

test("탁한 물 — 부유물은 탁할수록 나타나고 맑으면 그리지 않는다 · 터널 · 돔 안엔 두지 않는다", () => {
  const box = { halfX: 4.5, halfZ: 6, bottom: -5, top: 4.8 };
  const m = makeMotes(box, (x, y, z) => y < -2.5 && Math.abs(x) < 2.5 && z > -5);
  m.setMurk(0); assert.equal(m.points.geometry.drawRange.count, 0);
  m.setMurk(0.6); assert.equal(m.points.geometry.drawRange.count, MOTE_COUNT);
  const P = m.points.geometry.getAttribute("position") as T.BufferAttribute;
  for (let i = 0; i < MOTE_COUNT; i++) assert.ok(!(P.getY(i) < -2.5 && Math.abs(P.getX(i)) < 2.5 && P.getZ(i) > -5), `공기 속 알 ${i}`);
  m.dispose();
});

test("탁한 물 — 후처리 · 재질 · 수조가 물 값을 받는다(물 60 아래에서만), 물을 갈면 2~3초에 걸쳐 맑아진다", () => {
  // 후처리 — 탁함 갈래(초록으로 기울이기 · 깊이만큼 묻기 · 유리 물때) · 빛 번짐 줄이기, 0 이면 건너뛴다
  assert.match(FINAL_FRAG, /uniform float murk;uniform vec3 murkColor;/);
  assert.match(FINAL_FRAG, /if\(murk>\.001\)\{/);
  assert.match(FINAL_FRAG, /texture2D\(tGlow,uv\)\.rgb\*\(1\.-\.65\*murk\)/);
  // 장식 · 물고기의 일렁임은 맑기만큼(모래는 habitat 이 따로)
  const rock = new T.MeshStandardMaterial(); waterLit(rock, false);
  const s = { uniforms: {} as Record<string, unknown>, vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader };
  rock.onBeforeCompile(s as never, {} as never);
  assert.equal(s.uniforms.aquaClarity, WATER_LIGHT.aquaClarity);
  assert.match(s.fragmentShader, /smoothstep\(\.15,\.85,vAquaUp\)\*aquaClarity/);
  assert.ok(ascii(s.fragmentShader), "물속 빛 셰이더 원문에 ASCII 밖 글자(주석 속 한글)");
  assert.equal(WATER_LIGHT.aquaClarity.value, 1, "기본은 맑음(미리보기도 쓴다)");
  // 수조 — 탁함 0~1 은 물 60 아래에서만 · 맑아질 땐 draw 가 따라가고 · 더러워지는 쪽 · 멈춘 그리기는 바로 · 안개가 가까워진다 · 닫으면 맑음으로
  assert.match(scene, /m=clamp\(\(60-w\)\/60,0,1\)/);
  assert.match(scene, /if\(waterShown<0\|\|rescaled\|\|reduced\.matches\|\|!active\|\|wGoal<=waterShown\)waterShown=wGoal;/);
  assert.match(scene, /waterShown=dt>0&&!reduced\.matches\?waterShown\+\(waterGoal-waterShown\)\*Math\.min\(1,dt\*1\.8\):waterGoal/);
  assert.match(scene, /f\.near=Math\.max\(\.5,f\.near-1\.5\*murkK\);f\.far=f\.near\+span\*\(1-\.45\*murkK\)/);
  assert.match(scene, /postNow\.setWater\(m,fogBase\);motes\?\.setMurk\(m\)/);
  assert.match(scene, /WATER_LIGHT\.aquaClarity\.value=1;/);
  // 2.5초 남짓 — 1 − exp(−1.8 t) 가 60 → 0.3 안에 드는 시간
  const settle = Math.log(60 / 0.3) / 1.8;
  assert.ok(settle > 2 && settle < 3.2, `맑아지는 시간 ${settle.toFixed(2)}초`);
});

test("먹이 · 사냥 · 자라기 — 수조가 쓰는 곳", () => {
  // 먹이 — 새 먹이면 뿌리고 매 프레임 한 번(물고기 입 · 먹이 반응), 움직임 줄이기면 한 장면 + 먹이 창 뒤에 거둔다
  assert.match(scene, /if\(motion\.feed&&motion\.feed!==foodFeed\)\{foodFeed=motion\.feed;food\.drop\(/);
  assert.match(scene, /food\.step\(elapsed,dt,motion,reduced\.matches\)/);
  assert.match(scene, /foodTimer=window\.setTimeout\(\(\)=>\{if\(!disposed&&!active\)draw\(0\);\},FOOD_LIFE\*1000\+60\)/);
  // 움직임 줄이기 — 사냥 장면을 만들지 않고 끝났다고만 알린다 · 도중에 바뀌면 바로 끝낸다
  assert.match(scene, /const opened=!reduced\.matches&&openMeal\(last,-last\.n,"real"\),done=opened\?plan\.skip:\[\.\.\.plan\.skip,last\.n\];/);
  assert.match(scene, /window\.setTimeout\(\(\)=>\{if\(!disposed\)for\(const n of done\)window\.dispatchEvent\(mealEndEvent\(\{n,replay:false\}\)\);\},250\)/);
  assert.match(scene, /if\(!pred\|\|!ghost\|\|reduced\.matches\)finishMeal\(\);/);
  assert.match(scene, /on\(reduced,"change",\(\)=>\{if\(!active\)draw\(0\);\}\)/);
  // 자라기 — 같은 Map 자리에서 갈아 끼운다(지우고 맨 뒤에 넣지 않는다) · 보정값은 id 로 옮긴다(0 으로 되돌리지 않는다) · 지난 자리에서 1초에 걸쳐
  assert.match(scene, /if\(old\)\{try\{addFish\(f,old\);\}/);
  assert.doesNotMatch(scene, /if\(old\)\{dropFish\(old\);swimmers\.delete\(f\.id\);\}/);
  assert.doesNotMatch(scene, /motion\.offsets=new Float32Array\(Math\.max\(3,n\*3\)\)/);
  assert.match(scene, /off\[j\*3\+c\]=motion\.offsets\[k\*3\+c\]\?\?0;fl\[j\*3\+c\]=motion\.flee\[k\*3\+c\]\?\?0;\}fe\[j\]=motion\.fear\[k\]\?\?0;/);
  assert.ok(scene.indexOf("relayoutMotion(!rescaled);") < scene.indexOf("if(motion.lengths.length<n){motion.positions=new Float32Array"), "자리 배열을 다시 잡기 전에 지난 자리를 읽는다");
  assert.match(scene, /m\.grow=\{old:shown,from:shownLen\/Math\.max\(1e-6,length\),k:0,wait:0\}/);
  assert.match(scene, /if\(m\.glb\|\|!m\.glbKey\|\|m\.glbFail\|\|g\.wait>GROW_WAIT\)\{dropFish\(g\.old\);g\.old=null;m\.root\.visible=true;batchesDirty=true;\}/);
  assert.match(scene, /m\.root\.scale\.setScalar\(m\.scale\*\(g\.from\+\(1-g\.from\)\*e\)\)/);
  assert.match(scene, /scene\.traverseVisible\(o=>\{if\(o instanceof T\.Mesh/, "숨긴 새 몸은 묶지 않는다");
  // Map.set 은 있던 키의 자리를 지킨다 — 이 성질에 기대 순서를 지킨다
  const m = new Map([[1, "a"], [2, "b"], [3, "c"]]); m.set(2, "B");
  assert.deepEqual([...m.keys()], [1, 2, 3]);
});
