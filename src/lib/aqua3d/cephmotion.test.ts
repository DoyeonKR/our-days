// 두족류의 움직임(2026-11-13) [사용자: "문어도 움직임이 다른 물고기랑 비슷해 연체동물의 움직임을 파악하고 개선해야해"]
// 문어 · 크라켄은 팔로 바닥을 기다가(팔 쪽이 앞) 가끔 외투막을 앞세워 물을 뿜고 미끄러진다. 오징어 · 대왕오징어는 떠 있다가 외투막을 앞세워 뒤로 쏘아 나간다.
// 길(habits)은 물을 뿜을 때 몸을 돌리지 않고 길을 거꾸로 가며(외투막이 앞) 세기(course.jet)와 자세(course.rev)를 넘긴다. 팔 하나하나는 정점 셰이더(cephalopod.ts)가 따로 굽히고 말고 모은다 — 이 시험은 같은 식의 CPU 판을 실제 GLB 정점으로 돌린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { BREATH_S, breathOf, cephGlsl } from "./cephalopod.ts";
import { cephV2Pose, cephV2Rig, fishMotion } from "./glb.ts";
import { habitOf } from "./habits.ts";
import { fishCourse } from "./world.ts";

test("물 뿜기는 외투막이 앞(가는 쪽과 몸이 반대) · 기기 · 떠 있기는 팔이 앞", () => {
  for (const fam of ["octopus", "kraken", "squid", "giant_squid"]) {
    assert.ok(habitOf(fam).ceph, fam);
    let jets = 0, back = 0, walks = 0, fwd = 0;
    for (const id of [3, 7, 11]) {
      let prev = fishCourse(id, 0, 1.5, fam);
      for (let t = 0.05; t < 600; t += 0.05) {
        const c = fishCourse(id, t, 1.5, fam), vx = c.x - prev.x, vz = c.z - prev.z, v = Math.hypot(vx, vz);
        prev = c;
        if (v < 1e-4) continue;
        const dot = (vx * c.dx + vz * c.dz) / (v * (Math.hypot(c.dx, c.dz) || 1));
        if ((c.jet ?? 0) > 0.5 && (c.rev ?? 0) > 0.95) { jets++; if (dot < -0.5) back++; }
        else if ((c.rev ?? 0) === 0 && (c.jet ?? 0) === 0) { walks++; if (dot > 0.5) fwd++; }
      }
    }
    assert.ok(jets > 10, `${fam} 물 뿜기가 있다(${jets})`);
    assert.ok(back / jets > 0.85, `${fam} 뿜을 땐 외투막이 앞 ${back}/${jets}`);
    assert.ok(walks > 50 && fwd / walks > 0.7, `${fam} 평소엔 팔이 앞 ${fwd}/${walks}`);
  }
});

test("물 뿜기는 출발이 빠르고 미끄러지며 선다 · 문어는 바닥에서 조금만 떠오른다", () => {
  let fast = 0, slow = 0;
  let prev = fishCourse(5, 0, 1.5, "octopus");
  for (let t = 0.05; t < 900; t += 0.05) {
    const c = fishCourse(5, t, 1.5, "octopus"), v = Math.hypot(c.x - prev.x, c.z - prev.z) / 0.05;
    prev = c;
    if ((c.jet ?? 0) > 0.7) fast = Math.max(fast, v);
    if ((c.rev ?? 0) === 0 && (c.jet ?? 0) === 0) slow = Math.max(slow, v);
  }
  assert.ok(fast > slow * 1.5, `뿜는 순간 빠르다 ${fast.toFixed(2)} > 기기 ${slow.toFixed(2)}`);
});

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
const open = (key: string) => {
  const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
  return new Promise<T.Group>((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "", (g) => res(g.scene), rej));
};
const wrap = (d: number) => Math.atan2(Math.sin(d), Math.cos(d));

// 입체 두족류(v2, 2026-11-13) — 팔마다 뼈 여섯 마디. 팔 끝 뼈(arm_a_5)의 모델 좌표 자리로 잰다
type Pose = Parameters<typeof cephV2Pose>[2];
const P0: Pose = { walk: 0, stream: 0, flare: 0, breath: 0, squeeze: 0, seed: 0.7 };
async function rigOf(key: string) {
  const sc = await open(key); let m: T.SkinnedMesh | null = null; sc.traverse((o) => { if (!m && o instanceof T.SkinnedMesh) m = o; });
  const r = cephV2Rig(sc, m); assert.ok(r, `${key} 는 입체 두족류(v2)`);
  const tips = r!.arms.map((a) => a.joints[a.joints.length - 1].bone), roots = r!.arms.map((a) => a.joints[1].bone);
  const at = (b: T.Object3D) => { sc.updateMatrixWorld(true); return sc.worldToLocal(b.getWorldPosition(new T.Vector3())); };
  const rest = tips.map(at);
  return { sc, r: r!, tips, roots, at, rest };
}
const corr = (a: number[], b: number[]) => {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return ab / Math.sqrt(aa * bb || 1);
};

test("입체 두족류 열두 모습 — 모두 v2 사슬(팔 8 · 10개)이고 fishMotion 이 옛 그림 판 셰이더를 쓰지 않는다", async () => {
  for (const fam of ["octopus", "kraken", "squid", "giant_squid"]) for (const key of [`fry_${fam}`, `juv_${fam}`, fam]) {
    const { r, sc } = await rigOf(key);
    assert.equal(r.arms.length, /squid/.test(fam) ? 10 : 8, key);
    const anim = fishMotion(sc, fam, key); anim(1, 1, { amp: 1 });
    let patched = false; sc.traverse((o) => { if (o instanceof T.SkinnedMesh) patched ||= (o.material as T.Material).userData?.aquaArm !== undefined; });
    assert.ok(!patched, `${key} 옛 셰이더 없음`);
  }
});

test("팔은 저마다 따로 움직이고 · 끝이 뿌리보다 크게 움직인다 · 외투막 뼈는 제자리", async () => {
  for (const key of ["octopus", "kraken", "squid"]) {
    const { r, tips, roots, at, rest } = await rigOf(key);
    const tr: number[][] = tips.map(() => []);
    let tipMove = 0, rootMove = 0;
    const rootRest = roots.map(at), mantle0 = r.mantle ? at(r.mantle.bone) : null;
    for (let k = 0; k < 160; k++) {
      cephV2Pose(r, k * 0.08, P0);
      tips.forEach((b, a) => { const p = at(b); tr[a].push(p.y + p.z * 0.5 + p.x * 0.3); tipMove = Math.max(tipMove, p.distanceTo(rest[a])); });
      roots.forEach((b, a) => { rootMove = Math.max(rootMove, at(b).distanceTo(rootRest[a])); });
      if (mantle0) assert.ok(at(r.mantle!.bone).distanceTo(mantle0) < 1e-6, `${key} 외투막 뼈가 움직였다`);
    }
    let sum = 0, cnt = 0;
    for (let a = 0; a < tr.length; a++) for (let b = a + 1; b < tr.length; b++) { sum += corr(tr[a], tr[b]); cnt++; }
    assert.ok(sum / cnt < 0.55, `${key} 팔끼리 평균 상관 ${(sum / cnt).toFixed(2)}`);
    assert.ok(tipMove > rootMove * 3, `${key} 끝 ${tipMove.toFixed(3)} · 뿌리 ${rootMove.toFixed(3)}`);
    assert.ok(tipMove > 0.05, `${key} 팔 끝이 보이게 움직인다 ${tipMove.toFixed(3)}`);
  }
});

test("문어는 기어갈 때 팔이 번갈아 들린다 · 물 뿜기엔 팔이 앞(+X)으로 모여 물결이 준다 · 멈출 땐 우산처럼 편다", async () => {
  const { r, tips, at, rest } = await rigOf("octopus");
  // 기기: 짝 · 홀 팔의 끝 높이가 반대로
  const ev: number[] = [], od: number[] = [];
  for (let k = 0; k < 120; k++) { cephV2Pose(r, k * 0.05, { ...P0, walk: 1 }); ev.push(at(tips[0]).y + at(tips[2]).y); od.push(at(tips[1]).y + at(tips[3]).y); }
  assert.ok(corr(ev, od) < -0.3, `짝 · 홀 팔이 번갈아 ${corr(ev, od).toFixed(2)}`);
  // 물 뿜기: 팔 끝 평균 x 가 앞으로, 흔들림은 3분의 1 아래
  const spread = (o: Pose) => {
    let mx = 0, wob = 0; cephV2Pose(r, -0.05, o); const prev = tips.map(at);
    for (let k = 0; k < 80; k++) { cephV2Pose(r, k * 0.05, o); tips.forEach((b, a) => { const p = at(b); mx += p.x / (80 * tips.length); wob += p.distanceTo(prev[a]); prev[a].copy(p); }); }
    return { mx, wob };
  };
  const calm = spread(P0), jet = spread({ ...P0, stream: 1 });
  const restX = rest.reduce((s, p) => s + p.x, 0) / rest.length;
  assert.ok(jet.mx > restX + 0.15, `뿜으면 팔이 앞으로 모인다 ${restX.toFixed(2)} → ${jet.mx.toFixed(2)}`);
  assert.ok(jet.wob < calm.wob * 0.34, `뿜는 동안 물결 ${jet.wob.toFixed(3)} < 평소 ${calm.wob.toFixed(3)} × 1/3`);
  cephV2Pose(r, 0, { ...P0, flare: 1 });
  const lift = tips.reduce((s, b, a) => s + at(b).y - rest[a].y, 0) / tips.length;
  assert.ok(lift > 0.05, `멈출 땐 팔이 들린다 ${lift.toFixed(3)}`);
  // 어느 마디도 1.2 rad 넘게 돌지 않는다
  for (const o of [P0, { ...P0, walk: 1 }, { ...P0, stream: 1 }, { ...P0, flare: 1 }]) for (let k = 0; k < 40; k++) {
    cephV2Pose(r, k * 0.13, o);
    for (const arm of r.arms) for (const j of arm.joints) assert.ok(2 * Math.acos(Math.min(1, Math.abs(j.bone.quaternion.w))) < 1.2);
  }
});

test("물 뿜기에 몸을 돌리지 않는다 — 머리 방향은 그대로, 길이 거꾸로 가서 외투막이 앞 · 외투막 숨은 2 ~ 3초에 한 번", () => {
  for (const fam of ["octopus", "squid"]) {
    let prev = fishCourse(3, 0, 1.5, fam), worst = 0;
    for (let t = 0.05; t < 600; t += 0.05) {
      const c = fishCourse(3, t, 1.5, fam);
      if ((c.rev ?? 0) > 0) worst = Math.max(worst, Math.abs(wrap(Math.atan2(c.dz, c.dx) - Math.atan2(prev.dz, prev.dx))));
      prev = c;
    }
    assert.ok(worst < 0.2, `${fam} 뿜는 동안 한 프레임에 머리가 ${worst.toFixed(3)} rad 돈다`);
  }
  let peaks = 0;
  for (let j = 1; j < 2000; j++) { const a = breathOf((j - 1) * 0.01), b = breathOf(j * 0.01), c = breathOf((j + 1) * 0.01); if (b > a && b >= c && b > 0.9) peaks++; }
  assert.ok(peaks >= 7 && peaks <= 9, `20초에 숨 ${peaks}번`);
  assert.ok(BREATH_S >= 2 && BREATH_S <= 3);
});

test("셰이더는 CPU 식과 같은 묶음 한계를 쓰고 법선도 돌린다(ASCII 만)", () => {
  const g = cephGlsl(7, [1, 2], 0.5, 3);
  for (const part of [g.pars, g.normal, g.vertex]) assert.ok(/^[\x00-\x7f]*$/.test(part), "ASCII");
  assert.ok(g.pars.includes("clamp( cTo * 0.6, -0.75, 0.75 )") && g.pars.includes("clamp( cTo, -0.6, 0.6 )"));
  assert.ok(g.normal.includes("objectNormal.xy"), "법선도 돌린다");
});
