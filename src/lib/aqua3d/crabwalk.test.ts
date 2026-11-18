// 게 · 바닷가재 걷기(2026-11-18) — 다리가 하나하나 번갈아 움직이는지 실제 GLB 정점으로 잰다(crabwalk.ts 의 CPU 식은 셰이더와 같은 식이다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { CRAB_ART, GAIT, IDLE, KIND, crabDisplace, crabGlsl, crabLegData, legPhase, walkOf, type CrabPose } from "./crabwalk.ts";
import { FISH_GLB, GlbLibrary, fishMotion, flushGlbCache, setGlbSource } from "./glb.ts";
import { bendProfile } from "./anatomy.ts";
import { WATER_LIGHT } from "./waterlight.ts";

const KEYS = ["snow_crab", "king_crab", "lobster"].flatMap((k) => [`fry_${k}`, `juv_${k}`, k]);
await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
const open = (key: string) => {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  return new Promise<T.Group>((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "", (g) => res(g.scene), rej));
};
const meshOf = (g: T.Object3D) => { let m: T.SkinnedMesh | null = null; g.traverse((o) => { if (!m && o instanceof T.SkinnedMesh) m = o; }); return m as unknown as T.SkinnedMesh; };
async function legsOf(key: string) {
  const mesh = meshOf(await open(key)), g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, n = pos.count;
  const P = new Float32Array(n * 3), U = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) { P[k * 3] = pos.getX(k); P[k * 3 + 1] = pos.getY(k); P[k * 3 + 2] = pos.getZ(k); U[k * 2] = uv.getX(k); U[k * 2 + 1] = uv.getY(k); }
  const part = g.attributes._aqua_part;
  return { mesh, g, P, n, part, d: crabLegData(key, P, U, n, part ? (part.array as ArrayLike<number>) : null)! };
}
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
const pose = (gait: number, walk: number, idle = 0, t = 0): CrabPose => ({ gait, walk, t, idle });

test("교대 사각 보행 — 한쪽의 이웃한 다리는 반대 박자, 맞은편 같은 자리 다리도 반대 박자", () => {
  for (const side of [-1, 1]) for (let i = 0; i + 1 < 4; i++) assert.ok(Math.abs(Math.abs(wrap(legPhase(i + 1, side) - legPhase(i, side))) - Math.PI) <= GAIT.wave + 1e-9, `같은 쪽 ${side} ${i}`);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(Math.abs(wrap(legPhase(i, 1) - legPhase(i, -1))) - Math.PI) < 1e-9, `맞은편 ${i}`);
  // 한 무리 = 왼1 · 오2 · 왼3 · 오4 (같은 박자에 든다)
  const groupOf = (i: number, side: number) => Math.round(wrap(legPhase(i, side) - i * GAIT.wave) / Math.PI) & 1;
  assert.deepEqual([groupOf(0, -1), groupOf(1, 1), groupOf(2, -1), groupOf(3, 1)], [0, 0, 0, 0]);
  assert.deepEqual([groupOf(0, 1), groupOf(1, -1), groupOf(2, 1), groupOf(3, -1)], [1, 1, 1, 1]);
});

test("모든 게 · 바닷가재 GLB 에 다리 번호(_AQUA_PART)가 있고, 지느러미 뼈에 묶인 정점(옛 다리 묶음)은 거의 다 다리 · 집게다", async () => {
  for (const key of KEYS) {
    assert.ok(FISH_GLB.has(key), key);
    const { mesh, g, n, part, d } = await legsOf(key);
    assert.ok(part && part.itemSize === 4, `${key} 다리 번호`);
    const fam = key.replace(/^(fry_|juv_)/, ""), art = CRAB_ART[fam];
    // 다리 · 집게 수 — 표 그대로, 다리마다 정점이 넉넉히
    const want = { snow_crab: [8, 2], king_crab: [6, 2], lobster: [8, 2] }[fam]!;
    assert.equal(d.parts.filter((p) => p.kind === "leg").length, want[0], key);
    assert.equal(d.parts.filter((p) => p.kind === "claw").length, want[1], key);
    for (const p of d.parts) if (p.kind !== "still") assert.ok(p.vertices >= 30 && p.length > 0, `${key} ${p.kind}${p.side}#${p.index} 정점 ${p.vertices}`);
    // 다리 · 집게 번호가 있는 정점은 모두 걸음 자료가 있다(바닷가재 더듬이 still 은 움직이지 않는다)
    for (let i = 0; i < n; i++) { const j = part.array[i * 4] - 1; if (j >= 0 && art.parts[j].kind !== "still") assert.ok(d.a[i * 4] === KIND.leg || d.a[i * 4] === KIND.claw, `${key} ${i}`); else assert.ok(d.a[i * 4] === KIND.none || d.a[i * 4] === KIND.tail, `${key} ${i} 몸통`); }
    // 기준: 모델을 지을 때 fin_L · fin_R(6 · 8 · 7 · 9번 뼈)에 묶인 정점 — 몸통 표(등딱지 · 바닷가재 배) 밖이면 다리 · 집게여야 한다.
    // 바닷가재의 더듬이는 표에 '움직이지 않는 부속(still)'으로 따로 있다(오른쪽 집게 위를 가로질러 그려져 있다). 표에 없는 조각(눈자루 · 작은 더듬이 · 가시)만 봐준다
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    let outside = 0, covered = 0;
    for (let i = 0; i < n; i++) {
      let w = 0; for (let c = 0; c < 4; c++) if (si.getComponent(i, c) >= 6) w += sw.getComponent(i, c);
      if (w < 0.9 || d.label[i] === -2) continue;
      const j = part.array[i * 4] - 1;
      outside++; if (d.label[i] >= 0 || (j >= 0 && art.parts[j].kind === "still")) covered++;
    }
    assert.ok(covered / outside >= 0.95, `${key} 다리 덮음 ${covered}/${outside}`);
    void mesh;
  }
});

test("든 다리만 끝이 오르고(짚은 다리는 바닥 그대로), 아무 정점도 바닥 아래로 안 내려간다 · 다리 안은 찢어지지 않는다", async () => {
  for (const key of ["snow_crab", "king_crab", "lobster"]) {
    const { P, n, d, g } = await legsOf(key), o = [0, 0, 0], idx = g.index!.array;
    let floor = Infinity; for (let i = 0; i < n; i++) floor = Math.min(floor, P[i * 3 + 1]);
    // 다리마다 끝(뿌리에서 가장 먼 정점)
    const tip = d.parts.map((_, j) => { let b = -1; for (let i = 0; i < n; i++) if (d.label[i] === j && (b < 0 || d.a[i * 4 + 1] > d.a[b * 4 + 1])) b = i; return b; });
    let worst = 1;
    for (let s = 0; s < 32; s++) {
      const g0 = (s / 32) * Math.PI * 2, p = pose(g0, 1, 1, s * 0.4), Q = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { crabDisplace(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], d.a, d.b, i, p, o); Q[i * 3] = o[0]; Q[i * 3 + 1] = o[1]; Q[i * 3 + 2] = o[2]; assert.ok(o[1] >= P[i * 3 + 1] - 1e-3 && o[1] >= floor - 1e-3, `${key} 바닥 아래 ${i}`); }
      d.parts.forEach((pt, j) => {
        if (pt.kind !== "leg") return;
        const i = tip[j], rise = Q[i * 3 + 1] - P[i * 3 + 1], swing = Math.sin(g0 + pt.phase);
        if (swing <= 0) assert.ok(Math.abs(rise) < 0.5, `${key} 짚은 다리 ${j} 가 떴다 ${rise}`);
        else if (swing > 0.5) assert.ok(rise > pt.length * GAIT.lift * 0.4 * d.a[i * 4 + 1] ** 1.3 && rise > 0, `${key} 든 다리 ${j} 가 안 올랐다 ${rise}`);
      });
      // 같은 다리 안의 변(모델 길이의 0.25% 넘는 변)은 1.5 배 넘게 안 늘어난다 — 다리를 통째로 돌린다
      for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
        const a = idx[t + e], b = idx[t + (e + 1) % 3];
        if (d.label[a] !== d.label[b] || d.label[a] < 0 || d.parts[d.label[a]].kind !== "leg") continue;
        const l0 = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
        if (l0 < 40) continue;
        worst = Math.max(worst, Math.hypot(Q[a * 3] - Q[b * 3], Q[a * 3 + 1] - Q[b * 3 + 1], Q[a * 3 + 2] - Q[b * 3 + 2]) / l0);
      }
    }
    assert.ok(worst < 1.5, `${key} 다리 늘어남 ${worst.toFixed(2)}`);
  }
});

test("걸음 폭은 걷는 몫에 비례하고 쉬면 다리가 거의 서 있다 · 든 다리는 앞으로, 짚은 다리는 뒤로", async () => {
  const { P, n, d } = await legsOf("snow_crab"), o = [0, 0, 0];
  const move = (walk: number, idle: number) => { let m = 0; for (let s = 0; s < 16; s++) { const p = pose((s / 16) * Math.PI * 2, walk, idle, s * 0.5); for (let i = 0; i < n; i++) { if (d.a[i * 4] !== KIND.leg) continue; crabDisplace(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], d.a, d.b, i, p, o); m = Math.max(m, Math.hypot(o[0] - P[i * 3], o[1] - P[i * 3 + 1], o[2] - P[i * 3 + 2])); } } return m; };
  const full = move(1, 1), half = move(0.5, 1), rest = move(0, 1);
  assert.ok(full > 0 && Math.abs(half / full - 0.5) < 0.08, `반만 걸으면 반 ${half / full}`);
  assert.ok(rest < 1e-9, "쉬면 걷는 다리는 서 있다");
  assert.equal(walkOf(0.2), 0, "쉬는 길(amp 0.2)");
  assert.equal(walkOf(1), 1);
  assert.ok(walkOf(0.5) > 0.2 && walkOf(0.5) < 0.8);
  // 든 동안(sin > 0) 끝이 머리 쪽(+x)으로 가고, 짚은 동안 꼬리 쪽으로 — 몸이 앞으로 가며 바닥을 민다
  const j = d.parts.findIndex((p) => p.kind === "leg"), tip = (() => { let b = -1; for (let i = 0; i < n; i++) if (d.label[i] === j && (b < 0 || d.a[i * 4 + 1] > d.a[b * 4 + 1])) b = i; return b; })();
  const xAt = (psi: number) => { crabDisplace(P[tip * 3], P[tip * 3 + 1], P[tip * 3 + 2], d.a, d.b, tip, pose(psi - d.parts[j].phase, 1), o); return o[0]; };
  assert.ok(xAt(Math.PI * 0.75) > xAt(Math.PI * 0.25), "든 동안 앞으로");
  assert.ok(xAt(Math.PI * 1.75) < xAt(Math.PI * 1.25), "짚은 동안 뒤로");
  // 집게는 걷는 데 안 쓴다 — 걸어도 쉬는 몫만큼만 흔든다, 움직임 줄이기(idle 0)면 집게 · 꼬리도 서 있다
  for (let i = 0; i < n; i++) if (d.a[i * 4] === KIND.claw) { const a = crabDisplace(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], d.a, d.b, i, pose(1, 1, 0, 3), o); assert.ok(a === 0 && o[1] === P[i * 3 + 1]); }
  assert.ok(IDLE.claw < GAIT.swing);
});

test("게임이 실제로 다리 걸음을 켠다 — 지느러미 뼈는 서 있고, 박자 · 걷는 몫을 뼈 텍스처 남는 칸에 쓴다 · 보폭이 짧다", async () => {
  for (const key of ["snow_crab", "lobster"]) {
    const inner = new T.Group(); inner.add(await open(key));
    const mesh = meshOf(inner), sk = mesh.skeleton, fin = inner.getObjectByName("fin_L")!, q0 = fin.quaternion.clone();
    const motion = fishMotion(inner, key, key);
    assert.ok(mesh.geometry.attributes.aquaCrab && mesh.geometry.attributes.aquaCrabRoot, key);
    const slot = sk.bones.length * 16, data = sk.boneMatrices as Float32Array;
    let t = 5; motion(t, 1, { amp: 1, ground: 1, effort: 1 });
    const g0 = data[slot];
    for (let k = 0; k < 10; k++) { t += 0.05; WATER_LIGHT.aquaTime.value = t; motion(t, 1, { amp: 1, ground: 1, effort: 1 }); }
    assert.ok(Math.abs(wrap(data[slot] - g0)) > 0.5, `${key} 걸음 박자가 흐른다`);
    assert.equal(data[slot + 1], 1, `${key} 걷는 몫`);
    assert.ok(fin.quaternion.angleTo(q0) < 1e-6, `${key} 지느러미 뼈는 그대로`);
    motion(t + 0.05, 1, { amp: 0.2, ground: 1, effort: 1 });
    assert.equal(data[slot + 1], 0, `${key} 쉬면 0`);
    assert.ok(bendProfile(key).stride < 0.3, key);
    // 몸통 마디는 굽히지 않는다(물고기 물결 대신 다리 걸음)
    for (const n of ["spine_0", "spine_3", "spine_5"]) { const b = inner.getObjectByName(n)!; motion(t + 0.1, 1, { amp: 1, ground: 1, effort: 1 }); const q = b.quaternion.clone(); motion(t + 0.3, 1, { amp: 1, ground: 1, effort: 1 }); assert.ok(b.quaternion.angleTo(q) < 1e-6, `${key} ${n}`); }
  }
  WATER_LIGHT.aquaTime.value = 0;
});

test("셰이더는 ASCII 만 · CPU 식과 같은 상수를 쓴다", () => {
  const g = crabGlsl(10), all = g.pars + g.normal + g.vertex;
  assert.ok(/^[\x00-\x7f]*$/.test(all));
  for (const v of [GAIT.swing, GAIT.lift, GAIT.rootBlend, IDLE.claw, IDLE.clawLift, IDLE.tail]) assert.ok(all.includes(String(v)), String(v));
  assert.ok(all.includes("aquaCrabRoot") && all.includes("10 * 4"));
});

test("수조가 쓰는 길(GlbLibrary — 물속 빛 재질 · 뼈째 복제)을 지나도 다리 번호가 남고 걸음이 켜진다", async () => {
  setGlbSource(async (url) => open(url.match(/fish\/([a-z_]+)\.glb/)![1]));
  try {
    for (const key of ["snow_crab", "lobster"]) {
      const lib = new GlbLibrary(), src = await lib.load("fish", key);
      assert.ok(src, key);
      const inner = new T.Group(); inner.add(lib.instance(src!));
      const mesh = meshOf(inner);
      assert.ok(mesh.geometry.attributes._aqua_part, `${key} 다리 번호가 복제본에 남는다`);
      fishMotion(inner, key, key);
      const a = mesh.geometry.attributes.aquaCrab;
      assert.ok(a, key);
      // 구운 번호로 나눈 결과(가려진 다리 채움까지 제 다리) — 그림 자리로 다시 나누면 채움이 위 다리로 잘못 간다
      let legs = 0; for (let i = 0; i < a.count; i++) if (a.getX(i) === KIND.leg) legs++;
      assert.ok(legs > 300, `${key} 다리 정점 ${legs}`);
      lib.dispose();
    }
  } finally { setGlbSource(null); flushGlbCache(); }
});

test("쉬는 동안 집게는 흔들리고 바닷가재 꼬리는 들썩인다(움직임 줄이기면 0) — 몸길이에 견줘 작게", async () => {
  for (const key of ["snow_crab", "lobster"]) {
    const { P, n, d } = await legsOf(key), o = [0, 0, 0];
    let span = 0; for (let i = 0; i < n; i++) span = Math.max(span, Math.abs(P[i * 3]));
    let claw = 0, tail = 0;
    for (let s = 0; s < 40; s++) {
      const p = pose(0, 0, 1, s * 0.5);
      for (let i = 0; i < n; i++) {
        const k = d.a[i * 4];
        if (k !== KIND.claw && k !== KIND.tail) continue;
        crabDisplace(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], d.a, d.b, i, p, o);
        const m = Math.hypot(o[0] - P[i * 3], o[1] - P[i * 3 + 1], o[2] - P[i * 3 + 2]);
        if (k === KIND.claw) claw = Math.max(claw, m); else tail = Math.max(tail, o[1] - P[i * 3 + 1]);
      }
    }
    // 몸길이(머리 → 꼬리 2 × span)의 1% 넘게 움직이되 8% 는 안 넘는다
    assert.ok(claw > 0.02 * span && claw < 0.16 * span, `${key} 집게 ${(claw / span / 2).toFixed(3)}`);
    if (key === "lobster") assert.ok(tail > 0.01 * span && tail < 0.16 * span, `꼬리 ${(tail / span / 2).toFixed(3)}`);
  }
});
