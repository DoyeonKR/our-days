/* 장식 GLB 화면 밖 빼기 잠금 (2026-11-12 GPU 점검) — 실제 GLB 37개를 게임과 같은 길(GlbLibrary.load → prepareDecorSource → prepareDecorBounds)로 열어
 * 모든 정점이, 물풀은 흔들림 최대 변위까지 더해도 경계 구 안에 있는지 · 복제본의 culling 이 켜지는지 본다.
 * 구가 모자라면 물풀 끝 · 풍차 날개가 화면 가장자리에서 툭 사라진다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DECOR_GLB, GlbLibrary, SWAY_REACH, decorMotion, flushGlbCache, setGlbSource, swayOffset } from "./glb.ts";

await MeshoptDecoder.ready;
const webp = { name: "EXT_texture_webp", loadTexture: () => Promise.resolve(new T.Texture()) };
const open = (url: string) => {
  const key = /decor\/([a-z_0-9]+)\.glb$/.exec(url)![1], b = readFileSync(`public/aqua/models/decor/${key}.glb`);
  return new Promise<T.Group>((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => webp as never).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "", (g) => res(g.scene), rej));
};

test("장식 GLB 37개 — 모든 정점(물풀은 흔들림까지)이 경계 구 안 · 복제본은 culling 이 켜지고 상자는 그대로", async () => {
  setGlbSource(open);
  const lib = new GlbLibrary();
  try {
    let worst = 0, plants = 0;
    for (const key of DECOR_GLB) {
      const src = await lib.load("decor", key);
      assert.ok(src, key);
      const copy = lib.instance(src!);
      decorMotion(copy)(7.3); // 풍차 날개 · 뚜껑을 돌린 자세에서도 — 구는 메시 좌표라 노드가 돌아도 같이 돈다
      copy.updateMatrixWorld(true);
      let meshes = 0;
      copy.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        meshes++;
        const g = o.geometry, sphere = g.boundingSphere;
        assert.equal(o.frustumCulled, true, `${key}/${o.name} culling`);
        assert.ok(sphere && Number.isFinite(sphere.radius) && sphere.radius > 0, `${key}/${o.name} 구`);
        // 상자는 넓히지 않는다 — 크기 · 바닥 자리는 정점 그대로의 상자로 잰다
        const box = new T.Box3().setFromBufferAttribute(g.attributes.position as T.BufferAttribute);
        g.computeBoundingBox(); assert.ok(g.boundingBox!.equals(box), `${key}/${o.name} 상자`);
        const pos = g.attributes.position, sway = g.attributes.aquaSway, root = g.attributes.aquaRoot, v = new T.Vector3();
        if (sway) plants++;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          let d = 0;
          if (sway) {
            // 셰이더 식 그대로 몇 자세 — 가장 큰 변위는 SWAY_REACH × 폭을 넘지 않는다
            for (const t of [0, 1.3, 2.9, 4.4]) { const [dx, dz] = swayOffset(sway.getX(i), sway.getY(i), root.getX(i), root.getZ(i), t); d = Math.max(d, Math.hypot(dx, dz)); }
            assert.ok(d <= Math.abs(sway.getX(i)) * SWAY_REACH + 1e-9, `${key} 흔들림 상한`);
            d = Math.abs(sway.getX(i)) * SWAY_REACH;
          }
          worst = Math.max(worst, (v.distanceTo(sphere!.center) + d) / sphere!.radius);
        }
      });
      assert.ok(meshes > 0, key);
      lib.release("decor", key);
    }
    assert.ok(plants > 0, "물풀이 하나도 없다 — prepareDecorSource 가 안 돌았다");
    assert.ok(worst <= 1, `구를 쓰는 비율 ${worst.toFixed(4)}`);
  } finally { lib.dispose(); setGlbSource(null); flushGlbCache(); }
});
