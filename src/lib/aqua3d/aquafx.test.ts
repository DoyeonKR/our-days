// 수조 효과 lock (2026-11-12) — 정어리가 물고기로 보이게 · GLB 물풀이 흔들리게 · 쉬는 거북은 덜 젓게 · 일렁이는 빛이 움직이게.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { CAUSTIC_GLSL, WATER_LIGHT, causticAt, waterLit } from "./waterlight.ts";
import { GlbLibrary, SWAY_TIP, SWAY_VERTEX, flushGlbCache, prepareDecorSource, setGlbSource, swayOffset } from "./glb.ts";
import { SARDINE_GLSL, makeShoal, sardineTurn } from "./shoal.ts";
import { makeAnimal, ModelKit } from "./models.ts";

const ascii = (s: string) => /^[\x00-\x7f]*$/.test(s);
const shaderOf = () => ({ uniforms: {} as Record<string, unknown>, vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader });

test("일렁이는 빛 — 두 겹(min) · 몇 초 박자로 움직이고 · 평균 밝기는 옛 식과 같다 · 셰이더 원문 ASCII", () => {
  assert.ok(ascii(CAUSTIC_GLSL), "CAUSTIC_GLSL 에 ASCII 밖 글자");
  assert.match(CAUSTIC_GLSL, /float aquaCaustic\(vec2 xz,float t\)/, "모래 · 재질이 부르는 이름 그대로");
  assert.match(CAUSTIC_GLSL, /min\(c1,c2\)/);
  const old = (x: number, z: number, t: number) => {
    const qx = x * 2.1, qy = z * 2.1, a = Math.sin(qx + Math.sin(qy * 1.7 + t * 0.22) * 1.3), b = Math.sin(qy * 1.3 + Math.cos(qx * 1.2 - t * 0.18) * 1.1);
    return Math.max(0, 1 - Math.abs(a * b)) ** 20;
  };
  const mean = (f: (x: number, z: number, t: number) => number, t: number) => { let s = 0; for (let i = 0; i < 160; i++) for (let j = 0; j < 160; j++) s += f(i * 0.05, j * 0.05, t); return s / 160 ** 2; };
  const change = (f: (x: number, z: number, t: number) => number, t: number, dt: number) => { let s = 0; for (let i = 0; i < 80; i++) for (let j = 0; j < 80; j++) s += Math.abs(f(i * 0.1, j * 0.1, t + dt) - f(i * 0.1, j * 0.1, t)); return s / 80 ** 2; };
  for (const t of [3, 40, 300]) {
    const m = mean(causticAt, t), mo = mean(old, t);
    assert.ok(Math.abs(m - mo) < 0.04 && m > 0.06, `평균 밝기 ${m.toFixed(3)} (옛 ${mo.toFixed(3)})`);
    // 2초 사이에 무늬가 크게 바뀐다 — 옛 식은 28초 박자라 같은 자리에서 꿈틀대기만 했다
    assert.ok(change(causticAt, t, 2) > 1.2 * m, `2초 변화 ${change(causticAt, t, 2).toFixed(3)} / 평균 ${m.toFixed(3)}`);
  }
  // 재질에 단 것도 그대로 이 식
  const rock = new T.MeshStandardMaterial(); waterLit(rock, false);
  const s = shaderOf(); rock.onBeforeCompile(s as never, {} as never);
  assert.ok(s.fragmentShader.includes(CAUSTIC_GLSL));
});

/** 물풀 GLB 흉내 — 압축본처럼 작은 노드 배율 · 정수 단위 위치, 줄기 둘 + 같은 재질을 쓰는 꽃(수련) */
function fakePlant() {
  const scene = new T.Group(), mat = new T.MeshStandardMaterial();
  const stem = (name: string, x: number) => {
    const g = new T.BoxGeometry(800, 8191, 800); g.translate(0, 8191 / 2, 0);
    const m = new T.Mesh(g, mat); m.name = name; m.position.set(x, 0.05, 0); m.scale.setScalar(0.00015); scene.add(m); return m;
  };
  const a = stem("moving_stem_0", 0.1), b = stem("moving_stem_1", -0.2);
  const og = new T.BoxGeometry(6000, 2000, 6000); og.translate(0, 7000, 0);
  const flower = new T.Mesh(og, mat); flower.name = "static_ornament"; flower.scale.setScalar(0.00015); scene.add(flower);
  return { scene, mat, a, b, flower };
}

test("물풀 흔들림 — 줄기가 있는 GLB 만 · 바닥은 그대로 · 끝은 그루 높이의 SWAY_TIP · 행렬을 안 바꾼다(묶음 그리기 그대로)", () => {
  const { scene, mat, a, flower } = fakePlant();
  assert.equal(prepareDecorSource(scene), true);
  assert.equal(prepareDecorSource(scene), true, "두 번 불러도 된다");
  const sway = a.geometry.getAttribute("aquaSway") as T.BufferAttribute, root = a.geometry.getAttribute("aquaRoot") as T.BufferAttribute;
  assert.ok(sway && root && flower.geometry.getAttribute("aquaSway"), "같은 재질을 쓰는 꽃도 값을 받는다(빈 속성 금지)");
  scene.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(scene), H = box.max.y - box.min.y;
  let bottom = Infinity, top = -Infinity;
  for (let i = 0; i < sway.count; i++) {
    const y = a.geometry.attributes.position.getY(i), w = sway.getX(i) * a.scale.x; // GLB 단위로 되돌린 폭
    if (y < 1) bottom = Math.min(bottom, w); else top = Math.max(top, w);
    // 뿌리(GLB 원점)를 메시 좌표로 — 다시 GLB 로 옮기면 원점
    const o = new T.Vector3(root.getX(i), root.getY(i), root.getZ(i)).applyMatrix4(a.matrixWorld);
    assert.ok(o.length() < 1e-6, `뿌리 ${o.toArray()}`);
  }
  assert.ok(bottom < SWAY_TIP * H * 0.01, `바닥 폭 ${bottom}`);
  assert.ok(Math.abs(top - SWAY_TIP * H) < SWAY_TIP * H * 0.02, `끝 폭 ${top} / ${SWAY_TIP * H}`);
  // 재질 — 한 번만 · 물속 빛과 같이 · ASCII · aquaTime 은 정점 셰이더에만 새로 선언
  waterLit(mat, false);
  const s = shaderOf(); mat.onBeforeCompile(s as never, {} as never);
  assert.ok(s.vertexShader.includes("transformed.x += aquaSway.x"));
  assert.equal(s.vertexShader.split("attribute vec2 aquaSway").length, 2, "한 번만");
  assert.match(s.vertexShader, /vAquaWorld=\(modelMatrix\*aquaW\)\.xyz/, "물속 빛도 그대로");
  assert.ok(s.vertexShader.indexOf("aquaSway.x * sin") < s.vertexShader.indexOf("vAquaWorld="), "휜 자리로 빛을 받는다");
  assert.equal(s.fragmentShader.split("uniform float aquaTime").length, 2, "조각 셰이더엔 물속 빛 것 하나");
  assert.ok(ascii(s.vertexShader) && ascii(SWAY_VERTEX));
  assert.equal(s.uniforms.aquaTime, WATER_LIGHT.aquaTime);
  assert.match(mat.customProgramCacheKey(), /aqua-sway-v1/);
  // 묶음(instanceMatrix)과 따로 그리기(modelMatrix) 모두 같은 원점에서 박자를 잰다
  assert.match(SWAY_VERTEX, /#ifdef USE_INSTANCING\s+aquaO = instanceMatrix \* aquaO;\s+#endif\s+aquaO = modelMatrix \* aquaO;/);
  scene.traverse((o) => assert.ok(!o.userData.moving, `${o.name} 이 움직이는 노드로 표시됐다 — 묶음이 매 프레임 다시 올라간다`));
  // 그루마다 박자가 다르다
  const [x1] = swayOffset(1, 1, 0, 0, 10), [x2] = swayOffset(1, 1, 1.4, 0.6, 10);
  assert.ok(Math.abs(x1 - x2) > 0.2);
});

test("물풀 흔들림 — 물풀이 아닌 장식은 그대로 · 수조가 받는 장식(GlbLibrary)에 저절로 달린다", async () => {
  const rock = new T.Group(); rock.add(Object.assign(new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()), { name: "static_ornament" }));
  assert.equal(prepareDecorSource(rock), false);
  assert.ok(!((rock.children[0] as T.Mesh).material as T.Material).userData.aquaSway);
  setGlbSource(async () => fakePlant().scene);
  try {
    const lib = new GlbLibrary(), src = await lib.load("decor", "java_fern");
    assert.ok(src);
    const m = src!.getObjectByName("moving_stem_0") as T.Mesh;
    assert.equal((m.material as T.Material).userData.aquaSway, true);
    assert.equal((m.material as T.Material).userData.aquaLit, "caustic");
    lib.dispose();
  } finally { setGlbSource(null); flushGlbCache(); }
});

test("거북 — 모래 위에서 쉬면 지느러미를 거의 안 젓고, 떠오르면 0.8초 남짓에 걸쳐 다시 젓는다 · pose 가 없으면 예전과 같다", () => {
  const saved = WATER_LIGHT.aquaTime.value;
  try {
    const turtle = makeAnimal(new ModelKit(), "sea_turtle", "green_sea_turtle"), limb = turtle.root.getObjectByName("front-flipper-1")!;
    const swim = { amp: 1, ground: 0, hover: 0 }, rest = { amp: 0.2, ground: 1, hover: 1 };
    let clock = 0, phase = 0, peak = 0, last = 0, jump = 0;
    const run = (seconds: number, pose: typeof swim) => {
      peak = 0;
      for (let k = 0; k < seconds * 30; k++) {
        clock += 1 / 30; phase += (1 / 30) * 1.3; WATER_LIGHT.aquaTime.value = clock;
        turtle.animate(phase, 1, pose);
        peak = Math.max(peak, Math.abs(limb.rotation.x)); jump = Math.max(jump, Math.abs(limb.rotation.x - last)); last = limb.rotation.x;
      }
      return peak;
    };
    const swimming = run(6, swim), resting = (run(4, rest), run(4, rest)), back = run(5, swim);
    assert.ok(swimming > 0.4, `헤엄 ${swimming}`);
    assert.ok(resting < swimming * 0.15, `쉴 때 ${resting} / 헤엄 ${swimming}`);
    assert.ok(back > 0.4, `다시 헤엄 ${back}`);
    assert.ok(jump < 0.12, `한 프레임에 지느러미가 ${jump} rad 튀었다`);
  } finally { WATER_LIGHT.aquaTime.value = saved; }
});

test("정어리 — 짙은 등 · 은빛 배 · 검은 눈, 마리마다 다른 꼬리 물결(묶음 속성 하나) · 가끔 몇 마리만 번쩍 · 그리기 호출 하나", () => {
  const s = makeShoal(320, { halfX: 6.6, halfZ: 6.4, top: 10 });
  const geo = s.mesh.geometry, mat = s.mesh.material as T.MeshStandardMaterial;
  assert.ok(mat.vertexColors && mat.emissive.getHex() === 0, "스스로 내는 흰빛 없음(예전 0x3a6b80 × 0.9 가 빗줄기처럼 보였다)");
  const pos = geo.attributes.position, col = geo.attributes.color;
  let top = 0, nt = 0, belly = 0, nb = 0, dark = 0;
  for (let i = 0; i < pos.count; i++) {
    const l = col.getX(i) + col.getY(i) + col.getZ(i);
    if (pos.getY(i) > 0.06) { top += l; nt++; } else if (pos.getY(i) < -0.06) { belly += l; nb++; }
    if (l < 0.1) dark++;
  }
  assert.ok(top / nt < 0.4 * (belly / nb), `등 ${top / nt} · 배 ${belly / nb}`);
  assert.ok(dark >= 6, "눈");
  const swim = geo.getAttribute("aquaSwim") as T.InstancedBufferAttribute;
  assert.ok(swim instanceof T.InstancedBufferAttribute && swim.count === 320 && swim.itemSize === 4);
  const phases = new Set<number>(); for (let i = 0; i < 320; i++) phases.add(Math.round(swim.getX(i) * 100));
  assert.ok(phases.size > 200, "꼬리 박자가 마리마다 다르다");
  // 셰이더 — 물결 · 법선 · 번쩍임, ASCII
  const sh = shaderOf(); mat.onBeforeCompile(sh as never, {} as never);
  assert.match(sh.vertexShader, /transformed\.z \+= aquaBend/);
  assert.match(sh.vertexShader, /objectNormal = normalize/);
  assert.match(sh.fragmentShader, /vAquaFlash/);
  for (const src of Object.values(SARDINE_GLSL)) assert.ok(ascii(src));
  // 번쩍임 — 어느 순간이든 몇 마리만, 시간이 지나면 많은 마리가 한 번씩
  let ever = 0;
  const flashed = new Uint8Array(320);
  for (let t = 0; t < 30; t += 0.1) {
    s.animate(t);
    let now = 0;
    for (let i = 0; i < 320; i++) if (swim.getW(i) > 0.3) { now++; flashed[i] = 1; }
    assert.ok(now < 320 * 0.15, `${t.toFixed(1)}초에 ${now}마리가 동시에 번쩍`);
  }
  for (const f of flashed) ever += f;
  assert.ok(ever > 320 * 0.7, `30초 동안 번쩍인 정어리 ${ever}`);
  assert.equal(sardineTurn(10, 0, 0.45), 1);
  assert.equal(sardineTurn(10, 0, 5), 0);
  s.dispose();
});
