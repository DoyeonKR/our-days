// 펭귄은 땅 위에서 두 발로 선다(2026-11-26 [사용자: "펭귄은 해변에서도 헤엄치는 모션이야 해변에서는 이족보행으로 다녀야해"]).
// 쉼터(모래사장 · 바위)에 다 올라오면 haulBlend 가 course.upright 를 1 로 주고, fishMotion 이 몸을 세운다 — 머리가 꼬리보다 높고 부리는 앞을 본다,
// 걸으면 좌우로 뒤뚱 기운다. 물속(upright 0)에서는 예전처럼 누운 헤엄 자세다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { fishMotion } from "./glb.ts";
import { haulBlend, habitOf, type Course } from "./habits.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
async function pose(key: string, upright: number, speed: number) {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const holder = new T.Group(); holder.add(g.scene);
  const anim = fishMotion(g.scene, key.replace(/^(fry_|juv_)/, ""), key), head = g.scene.getObjectByName("spine_0")!, tail = g.scene.getObjectByName("spine_5")!;
  const leans: number[] = [];
  for (let k = 0; k < 180; k++) { anim(k / 60, 1, { dt: 1 / 60, amp: 0.12, effort: 0.12, speed, upright, hover: 1, ground: 1 } as never); if (k > 90) { holder.updateMatrixWorld(true); leans.push(head.getWorldPosition(new T.Vector3()).z); } }
  holder.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new T.Vector3()), tp = tail.getWorldPosition(new T.Vector3());
  return { headUp: hp.y - tp.y, along: hp.x - tp.x, lean: Math.max(...leans) - Math.min(...leans) };
}

test("땅 위(upright 1)에선 몸을 세운다 — 머리가 꼬리보다 위, 물속(0)에선 누워 있다", async () => {
  for (const key of ["gentoo_penguin", "emperor_penguin", "adelie_penguin", "chinstrap_penguin", "fry_gentoo_penguin"]) {
    const lying = await pose(key, 0, 0.3), stand = await pose(key, 1, 0);
    assert.ok(Math.abs(lying.headUp) < lying.along * 0.6, `${key} 물속에선 누운 자세 (${lying.headUp.toFixed(2)} / ${lying.along.toFixed(2)})`);
    assert.ok(stand.headUp > Math.abs(stand.along) * 1.5, `${key} 땅 위에선 머리가 위 (${stand.headUp.toFixed(2)} / ${stand.along.toFixed(2)})`);
  }
});

test("걸으면 좌우로 뒤뚱 기울고, 서 있기만 하면 기울지 않는다", async () => {
  const still = await pose("gentoo_penguin", 1, 0), walk = await pose("gentoo_penguin", 1, 0.3);
  assert.ok(walk.lean > 0.12, `걸을 때 머리가 옆으로 흔들리는 폭 ${walk.lean.toFixed(3)}`);
  assert.ok(still.lean < 0.02, `서 있을 땐 ${still.lean.toFixed(3)}`);
});

test("쉼터에 다 올라오면 펭귄은 upright 1, 해달 · 물범은 0 — 습성 표의 walk", () => {
  const rock = { x: 0, z: 0, r: 1.2, h: 1, kind: "rock" as const };
  for (const fam of ["gentoo_penguin", "emperor_penguin", "spotted_seal"]) {
    const h = habitOf(fam) as { walk?: boolean };
    let best = 0;
    for (let t = 0; t < 400; t += 0.5) { const c = { x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, turn: 0, amp: 1, effort: 1, hover: 0, ground: 0 } as unknown as Course; haulBlend(3, t, 1, 1, -5, { rock, share: 0, walk: h.walk }, c); best = Math.max(best, c.upright ?? 0); }
    assert.equal(best > 0.99, fam.endsWith("penguin"), `${fam} upright 최대 ${best.toFixed(2)}`);
  }
});
