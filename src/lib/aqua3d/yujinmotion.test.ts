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

// 3차(2026-11-27 [사용자: "관절을 10배 이상 많게 … 동작도 추가하고"]) — 관절 126개 · 걸을 때 무릎 · 서 있을 때 하트 · 손 흔들기 · 머리카락 물결
async function rig() {
  const b = readFileSync("public/aqua/models/fish/yujin.glb");
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const holder = new T.Group(); holder.add(g.scene);
  return { holder, anim: fishMotion(g.scene, "yujin", "yujin"), get: (n: string) => g.scene.getObjectByName(n)!, scene: g.scene };
}
const angle = (o: T.Object3D) => 2 * Math.acos(Math.min(1, Math.abs(o.quaternion.w)));

test("관절 126개 — 머리 가닥 72 · 손가락 30 · 무릎 · 발목 · 가방", async () => {
  const { scene } = await rig();
  let n = 0; scene.traverse((o) => { if ((o as T.Bone).isBone) n++; });
  assert.ok(n >= 120, `뼈 ${n}`);
  const r = await rig();
  for (const name of ["head", "hair_0_0", "hair_11_5", "f0_2_R", "f4_2_L", "knee_R", "ankle_L", "toe_R", "bag"]) assert.ok(r.get(name), name);
});

test("걸을 때 — 내딛는 다리의 무릎을 굽히고(번갈아) 머리카락 · 가방이 흔들린다", async () => {
  const { anim, get } = await rig();
  const kr: number[] = [], kl: number[] = [], hair: number[] = [];
  for (let k = 0; k < 200; k++) { anim(k / 30, 1, { dt: 1 / 30, amp: .8, effort: 1, speed: .3, upright: 1, hover: 0, ground: 0 } as never); if (k > 60) { kr.push(angle(get("knee_R"))); kl.push(angle(get("knee_L"))); hair.push(get("hair_5_3").quaternion.z); } }
  const span = (a: number[]) => Math.max(...a) - Math.min(...a);
  assert.ok(Math.max(...kr) > .4 && Math.max(...kl) > .4, `무릎 굽힘 ${Math.max(...kr).toFixed(2)} ${Math.max(...kl).toFixed(2)}`);
  const both = kr.filter((v, i) => v > .3 && kl[i] > .3).length;
  assert.ok(both < kr.length * .1, `두 무릎이 같이 굽지 않는다 (${both}/${kr.length})`);
  assert.ok(span(hair) > .005, `머리카락 물결 ${span(hair).toFixed(3)}`);
});

test("서 있을 때 — 가만히 있으면 하트 · 손 흔들기 · 둘러보기를 돌아가며 한다", async () => {
  const { anim, get } = await rig();
  let armMax = 0, headMax = 0;
  for (let k = 0; k < 30 * 22; k++) { anim(k / 30, 1, { dt: 1 / 30, amp: .8, effort: 1, speed: 0, upright: 1, hover: 0, ground: 0 } as never); armMax = Math.max(armMax, angle(get("fin_L")), angle(get("fin_R"))); headMax = Math.max(headMax, angle(get("head"))); }
  assert.ok(armMax > 2, `팔을 머리 위로 (${armMax.toFixed(2)})`);
  assert.ok(headMax > .4, `고개를 돌린다 (${headMax.toFixed(2)})`);
});

test("하트 · 손 흔들기 도중에 걷기 시작해도 팔이 한 프레임에 툭 떨어지지 않는다", async () => {
  const { anim, get } = await rig();
  const arms = [get("fin_L"), get("fin_R")], prev = arms.map((a) => a.quaternion.clone());
  let k = 0, raised = false;
  for (; k < 30 * 14 && !raised; k++) { anim(k / 30, 1, { dt: 1 / 30, amp: .8, effort: 1, speed: 0, upright: 1, hover: 0, ground: 0 } as never); raised = k > 60 && arms.some((a) => angle(a) > 1.6); }
  assert.ok(raised, "팔을 든 동작이 나온다");
  arms.forEach((a, i) => prev[i].copy(a.quaternion));
  let jump = 0;
  for (let j = 0; j < 45; j++, k++) { anim(k / 30, 1, { dt: 1 / 30, amp: .8, effort: 1, speed: Math.min(.3, j * .02) /* 실제 빠르기는 점점 오른다 */, upright: 1, hover: 0, ground: 0 } as never); arms.forEach((a, i) => { jump = Math.max(jump, a.quaternion.angleTo(prev[i])); prev[i].copy(a.quaternion); }); }
  assert.ok(jump < .25 /* 예전엔 팔을 든 각(약 2.3 rad)이 한 프레임에 0 으로 */, `한 프레임 팔 변화 ${jump.toFixed(2)} rad`);
  assert.ok(arms.every((a) => angle(a) < 1), "걷는 동안엔 팔을 내린다");
});

test("땅 위에선 오가다 양 끝에서 서 있는다(habits.landStand) — 서서 하는 동작을 할 틈", async () => {
  const { standPhase } = await import("./habits.ts");
  const xs: number[] = [];
  for (let t = 0; t < 120; t += .1) xs.push(Math.sin(standPhase(t * 0.2 * (1 - .45) + 1, .45)));
  assert.equal(standPhase(2.5, 0), 2.5);
  assert.equal((habitOf("yujin") as { landStand?: number }).landStand, .45);
  let stillRuns = 0, run = 0; for (let i = 1; i < xs.length; i++) { if (Math.abs(xs[i] - xs[i - 1]) < 1e-4) run++; else { if (run >= 25) stillRuns++; run = 0; } }
  assert.ok(stillRuns >= 2, `2.5초 넘게 선 구간 ${stillRuns}`);
});
