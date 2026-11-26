// 갓파는 땅 위에서 사람처럼 두 발로 걷는다(2026-11-26 [사용자: "갓파 는 해변에서 이족보행 해야해 사람처럼"]).
// 쉼터(모래사장 · 바위)에 올라오면 haulBlend 가 course.upright 를 주고, fishMotion 이 몸을 곧게 세운다 — 머리가 위, 다리(leg_L · leg_R 뼈)는 곧게 내려
// 걸을 때 번갈아 앞뒤로 내딛고, 팔은 내려 흔든다. 물속(upright 0)에선 예전처럼 엎드려 헤엄친다
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { fishMotion } from "./glb.ts";
import { habitOf } from "./habits.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
async function run(key: string, upright: number, speed: number) {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const holder = new T.Group(); holder.add(g.scene);
  const anim = fishMotion(g.scene, "kappa", key), head = g.scene.getObjectByName("spine_0")!, tail = g.scene.getObjectByName("spine_5")!;
  const legs = ["leg_L", "leg_R"].map((n) => g.scene.getObjectByName(n));
  const L: number[] = [], R: number[] = [], downs: number[] = [];
  const dirs = [new T.Vector3(-0.88, -0.05, 0.17).normalize(), new T.Vector3(-0.88, -0.05, -0.17).normalize()];
  for (let k = 0; k < 240; k++) {
    anim(k / 60, 1, { dt: 1 / 60, amp: 0.12, effort: 0.12, speed, upright, hover: 1, ground: 1 } as never);
    if (k > 120 && legs[0] && legs[1]) {
      holder.updateMatrixWorld(true);
      const w = legs.map((l, i) => dirs[i].clone().applyQuaternion(l!.getWorldQuaternion(new T.Quaternion())));
      L.push(w[0].x); R.push(w[1].x); downs.push(w[0].y, w[1].y);
    }
  }
  holder.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new T.Vector3()), tp = tail.getWorldPosition(new T.Vector3());
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const ml = mean(L), mr = mean(R);
  const cov = L.reduce((s, v, i) => s + (v - ml) * (R[i] - mr), 0), vl = L.reduce((s, v) => s + (v - ml) ** 2, 0), vr = R.reduce((s, v) => s + (v - mr) ** 2, 0);
  return { legs: !!(legs[0] && legs[1]), headUp: hp.y - tp.y, along: hp.x - tp.x, swing: Math.max(...L) - Math.min(...L), corr: cov / Math.sqrt(vl * vr || 1), down: Math.max(...downs) };
}

test("갓파 모델 셋 다 다리 뼈가 있고, 땅 위에선 곧게 서서 다리를 번갈아 내딛는다", async () => {
  for (const key of ["kappa", "juv_kappa", "fry_kappa"]) {
    const lying = await run(key, 0, 0.3), stand = await run(key, 1, 0), walk = await run(key, 1, 0.3);
    assert.ok(walk.legs, `${key} leg_L · leg_R 뼈`);
    assert.ok(Math.abs(lying.headUp) < lying.along * 0.6, `${key} 물속에선 엎드린 자세 (${lying.headUp.toFixed(2)} / ${lying.along.toFixed(2)})`);
    assert.ok(stand.headUp > Math.abs(stand.along) * 1.5, `${key} 땅 위에선 머리가 위 (${stand.headUp.toFixed(2)} / ${stand.along.toFixed(2)})`);
    assert.ok(stand.down < -0.85, `${key} 다리가 곧게 아래로 (${stand.down.toFixed(2)})`);
    assert.ok(stand.swing < 0.02, `${key} 서 있기만 하면 다리가 안 움직인다 (${stand.swing.toFixed(3)})`);
    assert.ok(walk.swing > 0.4, `${key} 걸을 때 다리가 앞뒤로 (${walk.swing.toFixed(2)})`);
    assert.ok(walk.corr < -0.9, `${key} 두 다리가 번갈아 (상관 ${walk.corr.toFixed(2)})`);
  }
});

test("갓파 습성은 땅 위에서 걷는다(walk)", () => {
  assert.equal((habitOf("kappa") as { walk?: boolean }).walk, true);
});
