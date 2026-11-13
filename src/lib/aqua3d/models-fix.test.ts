/* 모델 다듬기 잠금 (2026-11-11) — 두족류 물결 · 누운 광어 · 갈아 끼울 때 크기 · 화면 밖 빼기 · 지느러미 막 · 아귀 초롱 · 거북 테 · 고래 꼬리 · 주인 수.
 * 실제 GLB 를 게임과 같은 길(GLTFLoader + MeshoptDecoder)로 열어 잰다 — 숫자는 README §14.4.6 '모델 다듬기' 와 같다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ALL_FORMS, BOSS_KEYS, FISH_BASE_CM, FISH_STAGE_SIZE, bossesBeaten } from "../aquarium.ts";
import { BOSSES } from "../fishingworld.ts";
import { anatomy, bendAxisFor, bendProfile, bodyMeasure, finGain, flatBody, glbUpright, HEAD_RECOIL, hoverPitch, stepSwim, swimAngles, swimClock } from "./anatomy.ts";
import { materialTweak } from "./appearance.ts";
import { lurePoint, membraneWeights } from "./fins.ts";
import { makeGiants } from "./giants.ts";
import { CULL_EXTRA, CULL_PAD, FISH_GLB, GlbLibrary, bodyBounds, finDisplacement, fishMotion, prepareFishSource, swapBody } from "./glb.ts";
import { ModelKit, makeAnimal } from "./models.ts";
import { WATER_LIGHT, waterLitTree } from "./waterlight.ts";
import { fishCourse, fishLength } from "./world.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
const open = (key: string) => {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  return new Promise<T.Group>((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "", (g) => res(g.scene), rej));
};
const skinnedOf = (root: T.Object3D) => { let m: T.SkinnedMesh | null = null; root.traverse((o) => { if (!m && o instanceof T.SkinnedMesh) m = o; }); assert.ok(m); return m as T.SkinnedMesh; };
const restOf = (m: T.SkinnedMesh) => { const v = new T.Vector3(), out: T.Vector3[] = []; for (let i = 0; i < m.geometry.attributes.position.count; i++) out.push(m.getVertexPosition(i, v).clone()); return out; };
const forms = new Map(ALL_FORMS.map((f) => [f.key, f]));
const CEPH = ["squid", "octopus", "giant_squid", "kraken"].flatMap((f) => [f, `fry_${f}`, `juv_${f}`]);

test("두족류 — 물결이 팔 끝(spine_0 · 1)에서 가장 크고 외투막(spine_3 ~ 5)은 거의 0, GLB 12개 모두 두족류 물결", () => {
  for (const key of CEPH) {
    const f = forms.get(key)!; const p = bendProfile(f.family, key);
    assert.equal(p.kind, "cephalopod", key);
    assert.ok(p.amp[0] >= p.amp[1] && p.amp[1] >= p.amp[2] && p.amp[2] > p.amp[3] && p.amp[3] >= p.amp[5], `${key} 팔 → 외투막으로 줄어든다`);
    const squidLike = /squid/.test(f.family);
    assert.ok(p.amp[0] > (squidLike ? 20 : 8) * p.amp[5], `${key} 외투막 끝은 거의 안 흔든다`);
  }
  assert.ok(bendProfile("crucian").amp[5] > bendProfile("crucian").amp[0], "붕어는 그대로 꼬리 쪽이 크다");
});

test("두족류 GLB — 팔 끝이 외투막 끝보다 크게 움직인다(옛 붕어 물결은 외투막 끝이 꼬리처럼 0.126·몸길이 흔들렸다)", async () => {
  // 문어형(octopus · kraken)의 팔은 2026-11-13 부터 정점 셰이더가 팔마다 따로 굽힌다(cephalopod.ts — cephmotion.test 가 잰다). 뼈로 팔 전체를 흔드는 몫은 4분의 1로 줄여서
  // 여기(뼈만 도는 CPU)서는 팔이 외투막보다 크게 움직이는지 보지 않고, 외투막이 꼬리처럼 흔들리지 않는지만 본다(min 0)
  for (const [key, min] of [["squid", 2.5], ["giant_squid", 3], ["octopus", 0], ["kraken", 0], ["fry_squid", 2], ["juv_octopus", 0]] as const) {
    const s = await open(key); s.updateMatrixWorld(true); const m = skinnedOf(s), P = restOf(m);
    // 이 GLB 의 spine_0 은 +X 끝(팔 끝)에 있다 — 외투막은 −X 쪽
    assert.ok(s.getObjectByName("spine_0")!.position.x > s.getObjectByName("spine_5")!.position.x, `${key} spine_0 이 팔 쪽`);
    const xs = P.map((p) => p.x), minX = Math.min(...xs), L = Math.max(...xs) - minX;
    const arm = P.flatMap((p, i) => ((p.x - minX) / L > 0.85 ? [i] : [])), mantle = P.flatMap((p, i) => ((p.x - minX) / L < 0.15 && p.y > -0.3 ? [i] : []));
    const anim = fishMotion(s, forms.get(key)!.family, key), v = new T.Vector3();
    let a = 0, mm = 0;
    for (let k = 0; k < 48; k++) {
      anim((k / 48) * 4, 1, { amp: 1 }); s.updateMatrixWorld(true);
      for (const i of arm) a = Math.max(a, m.getVertexPosition(i, v).distanceTo(P[i]) / L);
      for (const i of mantle) mm = Math.max(mm, m.getVertexPosition(i, v).distanceTo(P[i]) / L);
    }
    assert.ok(mm < 0.05, `${key} 외투막 끝 ${mm.toFixed(3)}`);
    assert.ok(a > min * mm, `${key} 팔 ${a.toFixed(3)} · 외투막 ${mm.toFixed(3)}`);
  }
});

test("누운 광어 — 어린 · 다 큰 GLB 는 위아래(Z 축)로 물결치고 옆으로는 안 꿈틀댄다 · 치어는 서서 헤엄 · 코드 모델도 같은 방향으로 눕는다", async () => {
  assert.deepEqual(["flounder", "juv_flounder", "fry_flounder"].map((k) => [flatBody("flounder", k), bendAxisFor("flounder", k)]), [[true, "z"], [true, "z"], [false, "y"]]);
  assert.equal(flatBody("ray"), false, "가오리는 따로(날개)");
  const kit = new ModelKit();
  for (const key of ["flounder", "juv_flounder", "fry_flounder"]) {
    const s = await open(key); s.updateMatrixWorld(true); const m = skinnedOf(s), P = restOf(m);
    const xs = P.map((p) => p.x), minX = Math.min(...xs), L = Math.max(...xs) - minX;
    const tail = P.flatMap((p, i) => ((p.x - minX) / L < 0.2 ? [i] : []));
    const anim = fishMotion(s, "flounder", key), v = new T.Vector3();
    let dy = 0, dz = 0;
    for (let k = 0; k < 48; k++) { anim((k / 48) * 3, 1, { amp: 1 }); s.updateMatrixWorld(true); for (const i of tail) { m.getVertexPosition(i, v); dy = Math.max(dy, Math.abs(v.y - P[i].y) / L); dz = Math.max(dz, Math.abs(v.z - P[i].z) / L); } }
    if (flatBody("flounder", key)) assert.ok(dy > 0.08 && dz < 0.01, `${key} 위아래 ${dy.toFixed(3)} 옆 ${dz.toFixed(3)}`);
    else assert.ok(dz > 0.08 && dy < 0.01, `${key} 치어는 옆으로`);
    // 갈아 끼울 때 몸이 90° 뒤집히지 않는다 — 코드 모델과 GLB 의 높이 ÷ 길이가 같은 쪽
    const code = new T.Box3().setFromObject(makeAnimal(kit, "flounder", key).root).getSize(new T.Vector3()), glb = new T.Box3().setFromPoints(P).getSize(new T.Vector3());
    assert.ok(Math.abs(code.y / code.x - glb.y / glb.x) < 0.12, `${key} 코드 ${(code.y / code.x).toFixed(2)} · GLB ${(glb.y / glb.x).toFixed(2)}`);
  }
});

test("갈아 끼우면 219폼 모두 잡은 길이의 5% 안 — 해파리는 0.57~0.76 배로 줄었다(엔진은 키로 키우고 swapBody 는 max(x, z, 1.25·높이)로 쟀다)", async () => {
  const kit = new ModelKit(); let worst = 0, n = 0;
  for (const key of FISH_GLB) {
    const f = forms.get(key); if (!f) continue;
    const code = makeAnimal(kit, f.family, key), length = fishLength((FISH_BASE_CM[f.family] ?? 20) * FISH_STAGE_SIZE[f.stage], f.family);
    code.root.scale.setScalar(length / bodyMeasure(f.family, key, new T.Box3().setFromObject(code.root).getSize(new T.Vector3())));
    const inner = await open(key); inner.rotation.z = glbUpright(f.family, key);
    swapBody(code.root, inner, "center", (s) => bodyMeasure(f.family, key, s));
    const ratio = (bodyMeasure(f.family, key, bodyBounds(code.root).getSize(new T.Vector3())) * code.root.scale.x) / length;
    worst = Math.max(worst, Math.abs(ratio - 1)); n++;
    assert.ok(Math.abs(ratio - 1) < 0.05, `${key} ${ratio.toFixed(3)}`);
  }
  assert.ok(n >= 219, `${n}폼`);
  assert.ok(worst < 0.01, `가장 먼 것 ${worst}`);
});

test("화면 밖 빼기 — 원본에서 잰 경계 구(× 1.3 + 여유)가 꼬리 · 팔 · C 자 · 갓 숨쉬기 · 막 흔들림을 다 덮고, 복제본은 culling 이 켜진다", async () => {
  const lib = new GlbLibrary();
  let worst = 0;
  for (const key of ["crucian", "great_white", "eel", "oarfish", "veil_betta", "altum_angel", "squid", "kraken", "giant_squid", "jellyfish", "fry_jellyfish", "moon_jelly", "flounder", "aurora_ray", "oceanic_manta", "imugi_fish", "starfish", "whale_shark", "anglerfish", "fry_guppy"]) {
    const f = forms.get(key)!; const src = await open(key); prepareFishSource(src);
    const sm = skinnedOf(src); assert.ok(sm.userData.aquaCull && sm.boundingSphere, key);
    const copy = lib.instance(src), m = skinnedOf(copy);
    assert.equal(m.frustumCulled, true, `${key} 복제본은 culling`);
    assert.ok(m.boundingSphere && m.boundingSphere.radius === sm.boundingSphere!.radius, `${key} 구를 그대로 물려받는다`);
    const sphere = m.boundingSphere!.clone(), anim = fishMotion(copy, f.family, key), v = new T.Vector3();
    const kind = anatomy(f.family, key).kind, flutter = kind === "fish" || kind === "dragon" ? 0.11 : 0; // 셰이더 막 변위 최대(세기 2.4 × 0.045)
    for (let k = 0; k < 32; k++) for (const turn of [-3, 0, 3]) {
      anim((k / 32) * 4, 1, { amp: 1.4, turn, pulse: Math.sin(k), feed: 1 }); copy.updateMatrixWorld(true);
      for (let i = 0; i < m.geometry.attributes.position.count; i += 3) worst = Math.max(worst, (m.getVertexPosition(i, v).distanceTo(sphere.center) + flutter) / sphere.radius);
    }
  }
  assert.ok(worst < 0.95, `구를 쓰는 비율 ${worst.toFixed(3)}`);
  assert.ok(CULL_PAD >= 1.3 && CULL_EXTRA >= 0.11);
});

test("지느러미 막 — 얇은 판 · 몸통 밖 정점만 떤다(몸통 · 지느러미 뼈 정점은 0) · 옛 GLB 는 막이 혼자 움직인 적이 없다", async () => {
  for (const key of ["crucian", "altum_angel", "veil_betta", "kohaku_koi", "great_white", "fry_smelt"]) {
    const s = await open(key); s.updateMatrixWorld(true); const m = skinnedOf(s), P = restOf(m), n = P.length;
    const flat = new Float32Array(n * 3), fb = new Float32Array(n), si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    P.forEach((p, i) => { flat[i * 3] = p.x; flat[i * 3 + 1] = p.y; flat[i * 3 + 2] = p.z; for (let c = 0; c < 4; c++) if (si.getComponent(i, c) >= 6) fb[i] += sw.getComponent(i, c); });
    const { w, u } = membraneWeights(flat, fb);
    const L = Math.max(...P.map((p) => p.x)) - Math.min(...P.map((p) => p.x));
    let mem = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(P[i].z) > 0.02 * L) assert.equal(w[i], 0, `${key} 두꺼운 몸통 정점 ${i}`);
      if (fb[i] > 0.999) assert.equal(w[i], 0, `${key} 지느러미 뼈 정점 ${i}`);
      assert.ok(u[i] >= 0 && u[i] <= 1);
      if (w[i] > 0.5) { mem++; assert.ok(fb[i] < 0.5, `${key} 막인데 이미 지느러미 뼈가 움직인다 — 그럴 거면 셰이더가 필요 없다`); }
    }
    assert.ok(mem >= 2, `${key} 막 정점 ${mem}`);
    // 셰이더 식의 CPU 사본 — 보통 세기에서 막 끝이 몸길이의 2% 남짓 옆으로 떤다
    let max = 0; for (let ph = 0; ph < 7; ph += 0.3) for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(finDisplacement(w[i], u[i], ph, 1)));
    assert.ok(max > 0.015 && max < 0.03, `${key} ${max.toFixed(4)}`);
    // 갈아 끼운 물고기 — 형상에 값이 달리고 뼈 텍스처 남는 칸에 박자 · 세기가 들어간다
    const anim = fishMotion(s, forms.get(key)!.family, key);
    assert.ok(m.geometry.getAttribute("aquaFin"), key);
    anim(1, 1, { amp: 1 });
    const slot = m.skeleton.bones.length * 16;
    const bm = m.skeleton.boneMatrices!;
    assert.ok(bm.length >= slot + 4 && bm[slot + 1] > 0.5, `${key} 세기`);
  }
  // 막이 없는 몸(해파리 · 가오리 · 두족류 · 누운 광어 · 불가사리)엔 안 단다
  for (const key of ["jellyfish", "aurora_ray", "squid", "flounder"]) {
    const s = await open(key); fishMotion(s, forms.get(key)!.family, key);
    assert.equal(skinnedOf(s).geometry.getAttribute("aquaFin"), undefined, key);
  }
});

test("뼈 텍스처 칸 — three r187 은 뼈 10개 뼈대에 8×8(행렬 16개)을 만든다 · 막 셰이더는 물속 빛을 감싸고 캐시 키도 잇는다", async () => {
  const bones = Array.from({ length: 10 }, () => new T.Bone()), sk = new T.Skeleton(bones).computeBoneTexture();
  assert.ok(sk.boneMatrices!.length >= 11 * 16, "11번째 행렬 자리가 남아야 막 박자를 쓴다");
  assert.ok(new T.Skeleton(bones).boneMatrices!.length === 160, "그리기 전엔 딱 뼈 수만큼 — 미리 만들어야 한다");
  const src = await open("crucian"); waterLitTree(src, true); prepareFishSource(src);
  const copy = new GlbLibrary().instance(src); fishMotion(copy, "crucian", "crucian");
  const mat = skinnedOf(copy).material as T.MeshStandardMaterial;
  const shader = { vertexShader: "#include <common>\nvoid main(){\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <project_vertex>\n}", fragmentShader: "#include <common>\n#include <emissivemap_fragment>", uniforms: {} as Record<string, unknown> } as unknown as T.WebGLProgramParametersWithUniforms;
  mat.onBeforeCompile(shader, {} as T.WebGLRenderer);
  assert.match(shader.vertexShader, /attribute vec2 aquaFin;/);
  assert.match(shader.vertexShader, /texelFetch\( boneTexture/);
  assert.match(shader.vertexShader, /vAquaWorld/, "물속 빛도 그대로");
  assert.ok(!/[가-힣]/.test(shader.vertexShader), "GLSL 에 한글 없음");
  assert.match(mat.customProgramCacheKey(), /aqua-water-light-v1.*aqua-fin-v1\|10/);
});

test("아귀 — 몸은 안 빛나고(GLB 의 몸 전체 빛을 끈다) 유인돌기 끝에 초롱 빛이 붙는다(치어도 턱이 아니라 돌기 끝)", async () => {
  assert.ok(materialTweak("anglerfish").emissiveIntensity === 0 && !materialTweak("anglerfish").emissiveFromMap);
  for (const key of ["anglerfish", "juv_anglerfish", "fry_anglerfish"]) {
    const s = await open(key); s.updateMatrixWorld(true); const m = skinnedOf(s), P = restOf(m);
    const before = (m.material as T.MeshStandardMaterial).emissive.getHex();
    assert.notEqual(before, 0, `${key} GLB 는 몸 전체 빛이 있었다`);
    const flat = new Float32Array(P.length * 3); P.forEach((p, i) => { flat[i * 3] = p.x; flat[i * 3 + 1] = p.y; flat[i * 3 + 2] = p.z; });
    const at = lurePoint(flat)!, box = new T.Box3().setFromPoints(P), size = box.getSize(new T.Vector3());
    assert.ok((at[0] - box.min.x) / size.x > 0.8 && (at[1] - box.min.y) / size.y > 0.8, `${key} 초롱 ${at.map((x) => x.toFixed(2))}`);
    fishMotion(s, "anglerfish", key);
    assert.equal((m.material as T.MeshStandardMaterial).emissive.getHex(), 0, key);
    const lure = s.getObjectByName("anglerfish-lure");
    assert.ok(lure instanceof T.Sprite && lure.parent?.name === "spine_0", `${key} 머리 뼈에`);
    s.updateMatrixWorld(true);
    const p = lure.getWorldPosition(new T.Vector3());
    assert.ok(p.distanceTo(new T.Vector3(...at).applyMatrix4(m.matrixWorld)) < 0.02, key);
  }
  // 다른 종은 초롱이 없다
  const c = await open("crucian"); fishMotion(c, "crucian", "crucian"); assert.equal(c.getObjectByName("anglerfish-lure"), undefined);
});

test("투명 해파리 갓도 깊이를 쓴다(따라가면 피사계 심도가 해파리를 배경처럼 흐렸다) · 양면이라 뒷면 → 앞면 두 번에 그린다", async () => {
  for (const key of ["jellyfish", "fry_jellyfish", "juv_jellyfish", "moon_jelly"]) {
    const s = await open(key); const mat = skinnedOf(s).material as T.MeshStandardMaterial;
    assert.ok(mat.transparent && !mat.depthWrite, `${key} GLB 원래는 깊이를 안 쓴다`);
    prepareFishSource(s);
    assert.ok(mat.transparent && mat.depthWrite && mat.side === T.DoubleSide && !mat.forceSinglePass, key);
  }
});

test("헤엄 시계 — 시계가 안 가면 옛 박자 그대로 · 실제로 빨리 움직이면 박자가 빨라진다 · 떠 있으면 지느러미만 빨리 · 급히 돌면 지느러미를 편다", () => {
  const a = anatomy("crucian", "crucian"), p = bendProfile("crucian");
  const c0 = swimClock(); let last = 0; for (let k = 0; k <= 30; k++) { last = k * 0.1; stepSwim(c0, a, p, last, 0, { amp: 1 }); }
  assert.ok(Math.abs(c0.beat - last * a.frequency) < 1e-9, "dt 없으면 phase = time · frequency");
  const run = (speed: number, hover = 0, turn = 0) => {
    const c = swimClock(); let t = 0;
    for (let k = 0; k < 600; k++) { t += 1 / 30; stepSwim(c, a, p, t, 1 / 30, { speed: k < 450 ? 0.3 : speed, hover, turn }); } // 평소 0.3 → 끝 5초만 바꾼다
    return c;
  };
  const slow = run(0.05), cruise = run(0.3), fast = run(0.8);
  assert.ok(slow.beat < cruise.beat && cruise.beat < fast.beat, `${slow.beat.toFixed(1)} < ${cruise.beat.toFixed(1)} < ${fast.beat.toFixed(1)}`);
  const hover = run(0.3, 1), still = run(0.3, 0);
  assert.ok(hover.fin - hover.beat * p.finRate > 50, "떠 있으면 지느러미가 따로 더 빨리");
  assert.ok(Math.abs(still.fin - still.beat * p.finRate) < 1e-6, "헤엄칠 땐 꼬리 박자에 묶인다");
  assert.ok(finGain(hover, { hover: 1 }) < finGain(still), "떠 있을 땐 작게");
  const turning = run(0.3, 0, 2.5);
  assert.ok(turning.flare > 0.9 && finGain(turning) > 1.6 * finGain(still), `펼침 ${turning.flare.toFixed(2)}`);
  // 펼침은 천천히 내린다
  for (let k = 0; k < 30; k++) stepSwim(turning, a, p, 20 + k / 30, 1 / 30, { turn: 0 });
  assert.ok(turning.flare > 0.2 && turning.flare < 0.9);
  // 머리 반동 — spine_0 에 꼬리 마디와 반대 위상의 몫
  const out = new Float32Array(10);
  for (let ph = 0; ph < 6; ph += 0.5) {
    swimAngles(p, ph, { amp: 1 }, out);
    assert.ok(Math.abs(out[0] - (Math.sin(ph - p.lag) * p.amp[0] - HEAD_RECOIL * Math.sin(ph - 6 * p.lag) * p.amp[5])) < 1e-6);
  }
});

test("바다거북 — 거북 것인 등딱지 · 피부만 가장자리 테 · 지느러미는 경계 구를 다시 안 재고 법선은 세 프레임에 한 번", () => {
  const kit = new ModelKit(), turtle = makeAnimal(kit, "sea_turtle", "green_sea_turtle");
  const shell = turtle.root.getObjectByName("sculpted-carapace") as T.Mesh;
  assert.equal((shell.material as T.Material).userData.aquaLit, "rim");
  assert.equal(((turtle.root.getObjectByName("neck") as T.Mesh).material as T.Material).userData.aquaLit, "rim", "피부");
  assert.notEqual(((turtle.root.getObjectByName("plastron") as T.Mesh).material as T.Material).userData.aquaLit, "rim", "키트 공용 재질엔 테 없음");
  const limb = turtle.root.getObjectByName("front-flipper-1")!.children[0] as T.Mesh, g = limb.geometry;
  const rest = g.clone(); rest.computeBoundingSphere();
  assert.ok(g.boundingSphere && g.boundingSphere.radius >= rest.boundingSphere!.radius + 0.1, "휘는 몫(.105)만큼 넉넉히");
  let spheres = 0, normals = 0;
  const cs = g.computeBoundingSphere.bind(g), cn = g.computeVertexNormals.bind(g);
  g.computeBoundingSphere = () => { spheres++; cs(); }; g.computeVertexNormals = () => { normals++; cn(); };
  for (let k = 0; k < 9; k++) turtle.animate(k * 0.1, 1);
  assert.equal(spheres, 0); assert.equal(normals, 3);
});

test("고래 그림자 — 꼬리지느러미가 꼬리 끝(x = −0.5)을 축으로 천천히 친다", () => {
  const g = makeGiants({ halfX: 9, backZ: -4, top: 4 }), whale = g.root.children.find((c) => c instanceof T.Group)!, fluke = whale.children[1] as T.Mesh;
  assert.equal(fluke.position.x, -0.5);
  g.animate(1); const a = fluke.rotation.z; g.animate(4.7); const b = fluke.rotation.z;
  assert.ok(Math.abs(a - b) > 0.1 && Math.abs(a) <= 0.28 && Math.abs(b) <= 0.28, `${a} ${b}`);
  g.dispose();
});

test("주인 수 — 수조 조건과 주인 화면이 같은 함수(BOSSES 에 있는 주인만 센다)", () => {
  assert.deepEqual([...BOSS_KEYS], BOSSES.map((b) => b.key), "목록이 같아야 한다 — 주인을 더하면 aquarium.ts 의 BOSS_KEYS 도");
  assert.equal(bossesBeaten({ dolsoe: { caught: 1 }, neuti: { caught: 0 }, old_unknown: { caught: 3 }, byeol: { caught: 2 } }), 2);
  assert.equal(bossesBeaten(undefined), 0);
  const src = readFileSync("src/components/FishingPanels.tsx", "utf8");
  assert.equal((src.match(/bossesBeaten\(/g) ?? []).length, 2, "주인 목록 · 모든 주인 시트 둘 다");
  assert.ok(!/BOSSES\.filter\(\(b\) => [^)]*caught/.test(src), "따로 세지 않는다");
});

test("물속 시계 기준 빠르기 — 엔진이 아무것도 안 넘겨도 몸이 움직인 거리로 박자를 잰다(WATER_LIGHT.aquaTime)", async () => {
  const s = await open("crucian"), holder = new T.Group(); holder.add(s);
  const spine = s.getObjectByName("spine_5")!;
  const saved = WATER_LIGHT.aquaTime.value;
  try {
    const angleAt = (speed: number) => {
      let t = 0; WATER_LIGHT.aquaTime.value = 0; holder.position.set(0, 0, 0);
      const anim = fishMotion(s, "crucian", "crucian");
      const seen: number[] = [];
      for (let k = 0; k < 240; k++) { t += 1 / 30; WATER_LIGHT.aquaTime.value = t; holder.position.x += (k < 180 ? 0.3 : speed) * 2 / 30; anim(t, 1, { amp: 1 }); seen.push(spine.quaternion.y); }
      let flips = 0; for (let k = 181; k < seen.length; k++) if (Math.sign(seen[k]) !== Math.sign(seen[k - 1])) flips++;
      return flips;
    };
    assert.ok(angleAt(1.2) > angleAt(0.02), "빨리 움직이면 꼬리를 더 자주 친다");
  } finally { WATER_LIGHT.aquaTime.value = saved; }
});

test("바닥에 앉아 쉬는 물고기는 노 젓기 · 끄덕임을 안 한다(habits 는 바닥에서 쉬어도 hover 를 준다 — ground 로 가른다)", () => {
  const a = anatomy("catfish", "catfish"), p = bendProfile("catfish"), c = swimClock(); let t = 0;
  for (let k = 0; k < 300; k++) { t += 0.002; stepSwim(c, a, p, t, 1 / 30, { speed: 0, hover: 1, ground: 1 }); }
  assert.ok(Math.abs(c.fin - c.beat * p.finRate) < 1e-6, "지느러미는 꼬리 박자에 묶인 채");
  assert.equal(hoverPitch(c, { hover: 1, ground: 1 }), 0);
  assert.ok(Math.abs(hoverPitch(c, { hover: 1, ground: 0 })) > 0 || Math.sin(c.bob) === 0, "물속에 떠 있으면 끄덕인다");
});

test("쉬다 옮겨 가는 종 — 움직이는 동안 꼬리 박자가 길(course)의 effort 와 같은 빠르기(쉬는 시간이 평균을 끌어내리지 않는다)", () => {
  for (const [fam, cm] of [["flounder", 40], ["eel", 60], ["catfish", 50], ["crucian", 20], ["bluefin", 200]] as const) {
    const L = fishLength(cm, fam), a = anatomy(fam, fam), p = bendProfile(fam), c = swimClock();
    let phase = 0, prev = fishCourse(3, 0, L, fam), now = 0, old = 0;
    for (let k = 1; k < 30 * 300; k++) {
      const co = fishCourse(3, k / 30, L, fam), dt = 1 / 30, speed = Math.hypot(co.x - prev.x, co.y - prev.y, co.z - prev.z) / dt / L;
      phase += dt * co.effort; const before = c.beat;
      stepSwim(c, a, p, phase, dt, { speed, hover: co.hover, ground: co.ground, turn: co.turn });
      if (k > 30 * 60 && speed > 0.05) { now += c.beat - before; old += dt * co.effort * a.frequency; }
      prev = co;
    }
    assert.ok(now / old > 0.9 && now / old < 1.15, `${fam} ${(now / old).toFixed(2)}`);
  }
});

test("깊이를 쓰는 투명 물고기(해파리)는 빛줄기 · 유리보다 늦게 그린다 — 뒤의 빛줄기에 구멍을 내지 않게", () => {
  const root = new T.Group();
  const jelly = new T.Mesh(new T.SphereGeometry(1), new T.MeshStandardMaterial({ transparent: true, opacity: .6 }));
  const body = new T.Mesh(new T.SphereGeometry(1), new T.MeshStandardMaterial());
  root.add(jelly, body);
  prepareFishSource(root);
  assert.equal((jelly.material as T.Material).depthWrite, true);
  assert.equal(jelly.renderOrder, 4);
  assert.equal(body.renderOrder, 0);
  const giants = readFileSync("src/lib/aqua3d/giants.ts", "utf8");
  const beamOrder = Number(/beams\.renderOrder = (\d+);/.exec(giants)?.[1]);
  assert.ok(jelly.renderOrder > beamOrder, "빛줄기보다 늦게");
});
