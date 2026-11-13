// 물고기마다 헤엄 방식(2026-11-13) [사용자: "물고기들 전체적인 움직임이 각 물고기 특성에 맞게 움직이고 있는지 확인해 상어의 경우 옆쪽 지느러미 움직임도 같이"]
// 상어 · 다랑어 · 새치의 가슴지느러미는 굳은 날개다 — 꼬리 박자에 맞춰 젓지 않고, 돌 때 안쪽을 내려 몸을 기울이고, 오를 땐 앞쪽을 든다(뒤끝이 내려간다).
// 다랑어는 빨리 가면 지느러미를 몸 옆에 접는다. 홍어는 가오리처럼 날개를 친다. 전기뱀장어는 몸을 곧게 둔다. 실러캔스는 좌우 지느러미를 엇갈려 젓는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { fishMotion } from "./glb.ts";
import { anatomy, bendProfile, swimAngles } from "./anatomy.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
const open = async (key: string) => {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
  const holder = new T.Group(); holder.add(g.scene); return { holder, scene: g.scene };
};
type Pose = { turn?: number; speed?: number; ground?: number; amp?: number };
/** 2초 동안 돌려 지느러미 끝(fin_L_tip · fin_R_tip)의 몸 기준 자리를 모은다. climb: 초당 위로 오르는 몫(옆으로 1 갈 때) */
async function run(key: string, pose: Pose, climb = 0, bob = 0) {
  const { holder, scene } = await open(key), family = key === "bluefin_tuna" ? "bluefin" : key.replace(/^(fry_|juv_)/, "");
  const anim = fishMotion(scene, family, key), L = scene.getObjectByName("fin_L_tip")!, R = scene.getObjectByName("fin_R_tip")!;
  const ls: T.Vector3[] = [], rs: T.Vector3[] = [];
  for (let k = 0; k < 120; k++) {
    holder.position.set(bob ? 0 : k / 60, (k / 60) * climb + bob * Math.sin(k / 6), 0);
    anim(k / 60, 1, { dt: 1 / 60, effort: 1, amp: 1, ...pose });
    holder.updateMatrixWorld(true);
    if (k >= 60) { ls.push(scene.worldToLocal(L.getWorldPosition(new T.Vector3()))); rs.push(scene.worldToLocal(R.getWorldPosition(new T.Vector3()))); }
  }
  const span = (a: T.Vector3[], c: "x" | "y" | "z") => Math.max(...a.map((v) => v[c])) - Math.min(...a.map((v) => v[c]));
  const mean = (a: T.Vector3[], c: "x" | "y" | "z") => a.reduce((n, v) => n + v[c], 0) / a.length;
  return { swing: span(ls, "y") + span(rs, "y"), ly: mean(ls, "y"), ry: mean(rs, "y"), lz: mean(ls, "z"), rz: mean(rs, "z") };
}

test("상어 가슴지느러미는 꼬리 박자에 맞춰 젓지 않는다(붕어는 젓는다)", async () => {
  const carp = await run("crucian", { speed: 0.6 });
  for (const key of ["great_white", "blue_shark", "hammerhead", "whale_shark", "nurse_shark", "leopard_shark", "juv_great_white"]) {
    const shark = await run(key, { speed: 0.6 });
    assert.ok(shark.swing < carp.swing * 0.25, `${key} 지느러미 오르내림 ${shark.swing.toFixed(4)} < 붕어 ${carp.swing.toFixed(4)} 의 4분의 1`);
  }
});

test("돌 때 안쪽 지느러미를 내려 몸을 기울인다 · 오를 땐 앞쪽을 들어 뒤끝이 내려간다", async () => {
  // turn > 0 은 +Y 축 회전 — 머리(+X)가 −Z 쪽으로 돈다 → 안쪽은 −Z 의 fin_R
  const level = await run("great_white", { speed: 0.6 }), left = await run("great_white", { speed: 0.6, turn: 1 }), right = await run("great_white", { speed: 0.6, turn: -1 });
  assert.ok(left.ry < level.ry - 0.02 && left.ly > level.ly + 0.02, `오른쪽(안쪽)이 내려간다 ${(left.ry - level.ry).toFixed(3)} / ${(left.ly - level.ly).toFixed(3)}`);
  assert.ok(right.ly < level.ly - 0.02 && right.ry > level.ry + 0.02, "반대로 돌면 반대");
  const up = await run("great_white", { speed: 0.6 }, 0.6);
  assert.ok(up.ly < level.ly - 0.01 && up.ry < level.ry - 0.01, `오를 때 두 지느러미 뒤끝이 내려간다 ${(up.ly - level.ly).toFixed(3)}`);
});

test("바닥에 앉은 수염상어는 지느러미를 모래에 짚는다 · 다랑어는 빨리 가면 지느러미를 접는다", async () => {
  const swim = await run("nurse_shark", { speed: 0.3 }), sit = await run("nurse_shark", { speed: 0, ground: 1 });
  assert.ok(sit.ly < swim.ly - 0.02 && sit.ry < swim.ry - 0.02, "앉으면 지느러미가 내려간다");
  const slow = await run("bluefin_tuna", { speed: 0.3 }), fast = await run("bluefin_tuna", { speed: 1.6 });
  assert.ok(Math.abs(fast.lz) < Math.abs(slow.lz) - 0.02 && Math.abs(fast.rz) < Math.abs(slow.rz) - 0.02, `빨리 가면 몸 옆으로 접힌다 ${slow.lz.toFixed(3)} → ${fast.lz.toFixed(3)}`);
  const turning = await run("bluefin_tuna", { speed: 1.6, turn: 1.2 });
  assert.ok(Math.abs(turning.lz) > Math.abs(fast.lz) + 0.01, "급히 돌면 다시 편다");
});

test("홍어는 가오리처럼 날개를 치고 · 전기뱀장어는 몸이 곧고 · 실러캔스는 좌우를 엇갈려 젓는다", async () => {
  assert.equal(anatomy("skate", "skate").kind, "ray");
  assert.ok(bendProfile("skate").wing > 0.2);
  const skate = await run("skate", { speed: 0.4 });
  assert.ok(skate.swing > 0.05, `홍어 날개가 오르내린다 ${skate.swing.toFixed(3)}`);
  const ee = bendProfile("electric_eel"), eel = bendProfile("eel");
  assert.ok(ee.amp[3] < eel.amp[3] * 0.25, "전기뱀장어 몸 물결은 뱀장어보다 훨씬 작다");
  const out = new Float32Array(10), p = bendProfile("coelacanth");
  let opposite = 0;
  for (let k = 0; k < 40; k++) { swimAngles(p, k * 0.3, { amp: 1 }, out); if (Math.abs(out[6]) > 0.05) opposite += Math.sign(out[6]) === Math.sign(out[8]) ? 1 : 0; }
  assert.ok(opposite > 10, "실러캔스는 두 지느러미 각이 같은 부호(한쪽이 오를 때 한쪽은 내려간다)");
  const carp = bendProfile("crucian"); swimAngles(carp, 1, { amp: 1 }, out);
  assert.ok(Math.sign(out[6]) !== Math.sign(out[8]), "붕어는 두 지느러미가 같이 오르내린다");
});

test("제자리에서 들썩일 땐 지느러미 기울기가 튀지 않는다(위아래만 움직이면 atan2 가 ±90°)", async () => {
  for (const key of ["nurse_shark", "megamouth", "leopard_shark"]) {
    const still = await run(key, { speed: 0 }), bob = await run(key, { speed: 0 }, 0, 0.05);
    assert.ok(bob.swing < still.swing + 0.01, `${key} 들썩일 때 지느러미 오르내림 ${bob.swing.toFixed(4)}`);
  }
});

test("굳은 지느러미는 실제 메시에서 보인다 — 지느러미 뼈에 묶인 정점이 돌 때 · 접을 때 몸길이의 3% 넘게 움직인다", async () => {
  for (const [key, pose] of [["great_white", { speed: 0.6, turn: 1 }], ["nurse_shark", { speed: 0, ground: 1 }], ["whale_shark", { speed: 0.6, turn: 1 }], ["bluefin_tuna", { speed: 1.6 }]] as const) {
    const { holder, scene } = await open(key), family = key === "bluefin_tuna" ? "bluefin" : key;
    let m: T.SkinnedMesh | null = null; scene.traverse((o) => { if (!m && o instanceof T.SkinnedMesh) m = o; });
    const mesh = m as unknown as T.SkinnedMesh, fb = mesh.skeleton.bones.filter((b) => /^fin_/.test(b.name)), base = fb.map((b) => b.quaternion.clone());
    const idx = new Set(mesh.skeleton.bones.flatMap((b, i) => (/^fin_/.test(b.name) ? [i] : []))), si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
    const sel: number[] = [];
    for (let i = 0; i < si.count; i++) { let w = 0; for (let c = 0; c < 4; c++) if (idx.has(si.getComponent(i, c))) w += sw.getComponent(i, c); if (w > 0.3) sel.push(i); }
    const anim = fishMotion(scene, family, key), v = new T.Vector3();
    for (let k = 0; k < 90; k++) { holder.position.set(k / 60, 0, 0); anim(k / 60, 1, { dt: 1 / 60, effort: 1, amp: 1, ...pose }); }
    holder.updateMatrixWorld(true);
    const moved = sel.map((i) => mesh.getVertexPosition(i, v).clone());
    fb.forEach((b, k) => b.quaternion.copy(base[k])); holder.updateMatrixWorld(true);
    const d = Math.max(...sel.map((i, j) => mesh.getVertexPosition(i, v).distanceTo(moved[j])));
    assert.ok(sel.length >= 10 && d > 0.06, `${key} 지느러미 정점 ${sel.length}개가 ${d.toFixed(3)} 움직인다(몸길이 2)`);
  }
});

test("임시(코드) 모델도 상어 · 다랑어 가슴지느러미를 젓지 않는다 — 붕어는 그대로 젓는다(swimAngles)", () => {
  const swing = (fam: string) => { let lo = 9, hi = -9; const out = new Float32Array(10); for (let k = 0; k < 120; k++) { swimAngles(bendProfile(fam), k * 0.2, { amp: 1 }, out); lo = Math.min(lo, out[6]); hi = Math.max(hi, out[6]); } return hi - lo; };
  for (const fam of ["great_white", "hammerhead", "bluefin"]) assert.ok(swing(fam) < swing("crucian") * 0.25, `${fam} ${swing(fam).toFixed(3)} · 붕어 ${swing("crucian").toFixed(3)}`);
});

test("귀상어는 머리를 좌우로 휘젓는다 — 백상아리보다 머리(spine_0) 좌우 흔들림이 크다", async () => {
  const head = async (key: string) => {
    const { holder, scene } = await open(key), anim = fishMotion(scene, key, key), b = scene.getObjectByName("spine_0")!;
    let lo = 9, hi = -9;
    for (let k = 0; k < 600; k++) { holder.position.set(k / 60, 0, 0); anim(k / 60, 1, { dt: 1 / 60, effort: 1, amp: 1 }); const e = new T.Euler().setFromQuaternion(b.quaternion, "YXZ"); lo = Math.min(lo, e.y); hi = Math.max(hi, e.y); }
    return hi - lo;
  };
  const hh = await head("hammerhead"), gw = await head("great_white");
  assert.ok(hh > gw + 0.15, `귀상어 ${hh.toFixed(3)} · 백상아리 ${gw.toFixed(3)}`);
});

test("산갈치는 쉬는 동안 몸을 세워 떠 있다 — 세운 동안엔 바닥에서 몸 반 길이 위로, 헤엄칠 땐 눕는다", async () => {
  const { fishCourse } = await import("./world.ts");
  let up = 0, n = 0, lowWhenUp = 9, swimHigh = 0;
  for (let t = 0; t < 600; t += 0.25) {
    const c = fishCourse(3, t, 2, "oarfish"); n++;
    if ((c.stand ?? 0) > 0.95) { up++; lowWhenUp = Math.min(lowWhenUp, c.y); }
    if ((c.stand ?? 0) < 0.02) swimHigh = Math.max(swimHigh, c.y);
  }
  assert.ok(up / n > 0.1 && up / n < 0.5, `세워 떠 있는 시간 ${(up / n).toFixed(2)}`);
  assert.ok(lowWhenUp - 1 > -5.3, `세운 몸 아래 끝(가운데 − 몸 반 길이)이 바닥(WORLD.floor −5.3) 위 ${(lowWhenUp - 1).toFixed(2)}`);
});

test("종마다 다듬기 — 복어 · 쥐치는 몸이 굳고, 갈치는 쉬며 서 있고, 가물치 · 구라미는 숨 쉬러 수면에 오른다", async () => {
  const { RIGID } = await import("./anatomy.ts");
  const { habitOf } = await import("./habits.ts");
  const { fishCourse } = await import("./world.ts");
  for (const k of ["puffer", "filefish", "boxfish", "sunfish"]) { assert.ok(RIGID.test(k), k); assert.ok(bendProfile(k).amp[2] < 0.01, `${k} 몸통이 거의 안 휜다`); }
  assert.ok(bendProfile("crucian").amp[2] > 0.05, "붕어는 그대로 몸으로 헤엄친다");
  let up = 0;
  for (let t = 0; t < 600; t += 0.5) if ((fishCourse(4, t, 2, "hairtail").stand ?? 0) > 0.95) up++;
  assert.ok(up / 1200 > 0.08, `갈치가 서 있는 시간 ${(up / 1200).toFixed(2)}`);
  for (const k of ["snakehead", "gourami"]) {
    const h = habitOf(k);
    assert.ok((h.breathe ?? 0) > 0 && h.breathOnly, `${k} 공기 호흡`);
    let top = -9; for (let t = 0; t < 400; t += 0.5) top = Math.max(top, fishCourse(2, t, 1, k).y);
    assert.ok(top > 4, `${k} 수면 가까이 오른다 ${top.toFixed(2)}`);
  }
});
