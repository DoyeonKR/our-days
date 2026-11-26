// 유진(사람, 2026-11-26) — 물속에선 자유형, 땅 위에선 두 발로 걷는다(glb.fishMotion 의 HUMAN_SWIMMERS · HUMAN_WALKERS).
// [사용자: "사람이 자유영 하느 느낌으로 수영하는 모션도 취해야해"] — 두 팔이 번갈아(반 바퀴 어긋나게) 크게 돌고(한 팔이 등 위로 넘어갈 때 다른 팔은 배 밑), 발은 빠르게 찬다.
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
async function run(upright: number, speed: number) {
  const b = readFileSync("public/aqua/models/fish/yujin.glb");
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const holder = new T.Group(); holder.add(g.scene);
  const anim = fishMotion(g.scene, "yujin", "yujin"), get = (n: string) => g.scene.getObjectByName(n)!;
  const arms = [get("fin_L"), get("fin_R")], tips = [get("fin_L_tip"), get("fin_R_tip")], legs = [get("leg_L"), get("leg_R")], head = get("spine_0"), tail = get("spine_5");
  const ay: number[][] = [[], []], lx: number[][] = [[], []];
  for (let k = 0; k < 240; k++) {
    anim(k / 30, 1, { dt: 1 / 30, amp: .8, effort: 1, speed, upright, hover: 0, ground: 0 } as never);
    if (k > 60) { holder.updateMatrixWorld(true); for (let s = 0; s < 2; s++) { const root = arms[s].getWorldPosition(new T.Vector3()), tip = tips[s].getWorldPosition(new T.Vector3()); ay[s].push(tip.y - root.y); lx[s].push(legs[s].getWorldQuaternion(new T.Quaternion()).z); } }
  }
  holder.updateMatrixWorld(true);
  const hp = head.getWorldPosition(new T.Vector3()), tp = tail.getWorldPosition(new T.Vector3());
  const corr = (a: number[], b: number[]) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let c = 0, va = 0, vb = 0; a.forEach((v, i) => { c += (v - ma) * (b[i] - mb); va += (v - ma) ** 2; vb += (b[i] - mb) ** 2; }); return c / Math.sqrt(va * vb || 1); };
  const span = (a: number[]) => Math.max(...a) - Math.min(...a);
  return { armSpan: span(ay[0]), armCorr: corr(ay[0], ay[1]), legSpan: span(lx[0]), legCorr: corr(lx[0], lx[1]), headUp: hp.y - tp.y, along: Math.abs(hp.x - tp.x) };
}

test("물속(upright 0) — 자유형: 두 팔이 번갈아 크게 돈다 · 몸은 엎드려 있다", async () => {
  const s = await run(0, .5);
  assert.ok(s.armSpan > .3, `팔이 등 위 · 배 밑을 오간다 (${s.armSpan.toFixed(2)})`);
  assert.ok(s.armCorr < -.8, `두 팔이 번갈아 (상관 ${s.armCorr.toFixed(2)})`);
  assert.ok(Math.abs(s.headUp) < s.along * .6, `엎드린 자세 (${s.headUp.toFixed(2)} / ${s.along.toFixed(2)})`);
});

test("땅 위(upright 1) — 서서 두 다리를 번갈아 내딛는다", async () => {
  const w = await run(1, .3);
  assert.ok(w.headUp > w.along * 1.5, `머리가 위 (${w.headUp.toFixed(2)})`);
  assert.ok(w.legSpan > .1 && w.legCorr < -.8, `다리 번갈아 (폭 ${w.legSpan.toFixed(2)} · 상관 ${w.legCorr.toFixed(2)})`);
  assert.equal((habitOf("yujin") as { walk?: boolean }).walk, true);
});
