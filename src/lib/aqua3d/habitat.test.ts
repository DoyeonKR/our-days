import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { makeHabitat, substrateHeight, leafGeometry, HABITAT_THEMES } from "./habitat.ts";
import { decorToWorld, worldToDecor, WORLD } from "./world.ts";

test("six aquascapes have real substrate, glass, lighting, hardscape, foliage, equipment and different compositions", () => {
  const signatures = new Set<string>();
  assert.equal(HABITAT_THEMES.length, 11, "10 터널 · 11 돔까지 물빛이 있다");
  assert.ok(makeHabitat(9).floor.geometry.attributes.position.count > 3000, "상위 어항은 6단계 지형 + 다른 색");
  for (let tier = 1; tier <= 6; tier++) {
    const h = makeHabitat(tier); h.animate(0);
    for (const name of ["contoured-substrate", "substrate-stratum-0", "bottom-plinth", "side-glass", "glass-corner", "lighting-canopy", "rippling-water-surface", "waterline-meniscus", "weathered-hardscape", "ribbon-planting", "broadleaf-planting", "foreground-grass-tufts", "filter-glass-pipe", "diffuser-bubbles", "suspended-water-particles"]) assert.ok(h.root.getObjectByName(name), `${tier}: ${name}`);
    assert.ok(h.floor.geometry.attributes.position.count > 3000);
    let triangles = 0;
    const names: string[] = [];
    h.root.traverse(o => {
      names.push(o.name);
      if (o instanceof T.Mesh || o instanceof T.Points) {
        const p = o.geometry.attributes.position;
        for (const n of p.array) assert.ok(Number.isFinite(n));
        if (o instanceof T.Mesh) triangles += (o.geometry.index?.count ?? p.count) / 3 * (o instanceof T.InstancedMesh ? o.count : 1);
      }
    });
    assert.ok(triangles < 150000, `environment triangle budget: ${tier} = ${triangles}`);
    const plants = h.root.getObjectByName("ribbon-planting") as T.InstancedMesh;
    signatures.add(`${plants.count}:${names.filter(n => n === "gnarled-driftwood").length}:${names.filter(n => n === "aged-palace-column").length}:${HABITAT_THEMES[tier - 1].rock}`);
    // 2026-11-05 — 거품은 공 메시 인스턴스(CPU 가 매 프레임 행렬을 올렸다)에서 점 입자 한 묶음으로 바뀌었다. 위치는 셰이더가 시간으로 계산한다
    const bubble = h.root.getObjectByName("diffuser-bubbles") as T.Points<T.BufferGeometry, T.ShaderMaterial>;
    assert.ok(bubble instanceof T.Points);
    assert.ok(bubble.geometry.attributes.position.count >= 100 && bubble.geometry.attributes.position.count <= 200);
    const before = bubble.material.uniforms.uTime.value; h.animate(.7);
    assert.notEqual(bubble.material.uniforms.uTime.value, before);
    const background = h.root.getObjectByName("deep-water-backdrop") as T.Mesh<T.BufferGeometry, T.ShaderMaterial>;
    const depth = background.geometry.attributes.position;
    assert.ok(Math.max(...Array.from(depth.array).filter((_, i) => i % 3 === 2)) - Math.min(...Array.from(depth.array).filter((_, i) => i % 3 === 2)) > .8);
    assert.equal(h.root.children.filter(o => o.name === "sculpted-side-scenery").length, 2);
    assert.ok(readFileSync(`public/aqua/tank/tank_${tier}.webp`).length > 10000);
    h.setWater(100); const clean = background.material.uniforms.high.value.getHex(); h.setWater(0);
    assert.notEqual(background.material.uniforms.high.value.getHex(), clean);
    h.dispose();
  }
  assert.equal(signatures.size, 6);
});

test("contoured floor ray picking matches placement height without changing saved x/y coordinates", () => {
  for (let tier = 1; tier <= 6; tier++) {
    const h = makeHabitat(tier); h.root.updateMatrixWorld(true);
    for (const x of [6, 30, 50, 70, 94]) for (const y of [14, 54, 94]) {
      const world = decorToWorld(x, y), height = h.heightAt(world.x, world.z);
      assert.ok(height > WORLD.floor - .02 && height < WORLD.floor + 1);
      const ray = new T.Raycaster(new T.Vector3(world.x, 2, world.z), new T.Vector3(0, -1, 0));
      const hit = ray.intersectObject(h.floor)[0]; assert.ok(hit);
      assert.ok(Math.abs(hit.point.y - height) < .006);
      const saved = worldToDecor(hit.point.x, hit.point.z); assert.equal(saved.x, x); assert.equal(saved.y, y);
    }
    assert.ok(substrateHeight(4.7, -2.8, tier) > substrateHeight(0, 0, tier) + .3);
    h.dispose();
  }
});

test("leaves are curved midrib meshes and scene cleanup includes particles and instanced environments", () => {
  for (const broad of [false, true]) {
    const leaf = leafGeometry(broad), bounds = new T.Box3().setFromBufferAttribute(leaf.attributes.position as T.BufferAttribute);
    assert.ok(bounds.max.z - bounds.min.z > .1); assert.equal(leaf.attributes.uv.count, leaf.attributes.position.count);
  }
  const scene = readFileSync("src/lib/aqua3d/scene.ts", "utf8");
  assert.match(scene, /ray.intersectObject\(habitat.floor\)/);
  assert.match(scene, /habitat\?\.heightAt\(pos.x,pos.z\)/);
  assert.match(scene, /o instanceof T.Points/);
  assert.match(scene, /o instanceof T.InstancedMesh\)o.dispose\(\)/);
  assert.doesNotMatch(scene, /backdrop=makeDecor/);
});
