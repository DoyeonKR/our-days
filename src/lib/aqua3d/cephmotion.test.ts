// 두족류의 움직임(2026-11-13) [사용자: "문어도 움직임이 다른 물고기랑 비슷해 연체동물의 움직임을 파악하고 개선해야해"]
// 문어 · 크라켄은 팔로 바닥을 기다가(팔 쪽이 앞) 가끔 외투막을 앞세워 물을 뿜고 미끄러진다. 오징어 · 대왕오징어는 떠 있다가 외투막을 앞세워 뒤로 쏘아 나간다.
// 길(habits)은 몸 방향을 돌리고(course.rev) 세기를 넘기며(course.jet), 모델(glb.fishMotion)은 뿜는 동안 팔을 모아 곧게 늘어뜨린다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { fishMotion } from "./glb.ts";
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

test("모델 — 물 뿜는 동안 팔이 모여 곧게(옆 물결이 기기보다 훨씬 작다) · 외투막은 제자리", async () => {
  for (const key of ["octopus", "squid"]) {
    const s = await open(key); s.updateMatrixWorld(true);
    let m: T.SkinnedMesh | null = null; s.traverse((o) => { if (!m && o instanceof T.SkinnedMesh) m = o; });
    const mesh = m as unknown as T.SkinnedMesh, v = new T.Vector3();
    const rest = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => mesh.getVertexPosition(i, v).clone());
    const xs = rest.map((p) => p.x), minX = Math.min(...xs), L = Math.max(...xs) - minX;
    const arm = rest.flatMap((p, i) => ((p.x - minX) / L > 0.85 ? [i] : [])), mantle = rest.flatMap((p, i) => ((p.x - minX) / L < 0.15 && p.y > -0.3 ? [i] : []));
    const anim = fishMotion(s, key, key);
    const sway = (pose: { amp: number; jet?: number; rev?: number }) => {
      let a = 0, mm = 0;
      for (let k = 0; k < 48; k++) {
        anim((k / 48) * 4, 1, pose); s.updateMatrixWorld(true);
        for (const i of arm) a = Math.max(a, Math.abs(mesh.getVertexPosition(i, v).z - rest[i].z) / L);
        for (const i of mantle) mm = Math.max(mm, mesh.getVertexPosition(i, v).distanceTo(rest[i]) / L);
      }
      return { a, mm };
    };
    const swim = sway({ amp: 1 }), jet = sway({ amp: 1, jet: 1, rev: 1 });
    assert.ok(jet.a < swim.a * 0.6, `${key} 뿜을 때 팔 옆 물결 ${jet.a.toFixed(3)} < 평소 ${swim.a.toFixed(3)} 의 60%`);
    assert.ok(swim.mm < 0.05, `${key} 외투막은 제자리 ${swim.mm.toFixed(3)}`);
  }
});
