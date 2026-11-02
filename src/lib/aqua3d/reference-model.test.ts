import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import * as T from "three";
import { FAMILIES } from "../aquarium.ts";
import { FISH_IMAGE_KEYS } from "../aquaimages.ts";
import { REFERENCE_PROFILES } from "./reference-model.ts";
import { makeAnimal, ModelKit } from "./models.ts";
import styles from "./style-approvals.json" with { type: "json" };

test("all 84 geometry profiles match their actual originals and have opaque UV skins", async () => {
  assert.deepEqual(Object.keys(REFERENCE_PROFILES).sort(), [...FISH_IMAGE_KEYS].sort());
  assert.deepEqual(Object.keys(styles.forms).sort(), [...FISH_IMAGE_KEYS].sort());
  for (const key of FISH_IMAGE_KEYS) {
    const profile = REFERENCE_PROFILES[key];
    assert.equal(profile.sourceHash, createHash("sha256").update(readFileSync(`public/aqua/fish/${key}.webp`)).digest("hex"), key);
    const skin = await sharp(`public/aqua/skin/${key}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([skin.info.width, skin.info.height], profile.image, key);
    for (let i = 3; i < skin.data.length; i += 4) assert.equal(skin.data[i], 255, key);
    assert.equal(profile.rows.length, profile.grid + 1, key);
  }
});

test("each reconstructed form has a real finite volume, normalized rig weights and moving vertices", () => {
  const kit = new ModelKit();
  for (const family of FAMILIES) for (const key of [`fry_${family.key}`, `juv_${family.key}`, ...family.finals.map(s => s.key)]) {
    if (family.key === "sea_turtle") continue; // Separately sculpted and tested.
    const model = makeAnimal(kit, family.key, key), mesh = model.root.getObjectByName("reference-sculpt") as T.SkinnedMesh;
    assert.ok(mesh instanceof T.SkinnedMesh, key);
    assert.equal(mesh.skeleton.bones.length, 11, key);
    assert.equal(mesh.frustumCulled, false, key);
    const weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i++) assert.ok(Math.abs(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i) - 1) < 1e-6, key);
    const pose = (t: number) => {
      model.animate(t, 1); model.root.updateMatrixWorld(true);
      const samples: number[] = [];
      for (let i = 0; i < mesh.geometry.attributes.position.count; i += 101) {
        const p = new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i); mesh.applyBoneTransform(i, p);
        assert.ok([p.x, p.y, p.z].every(Number.isFinite), key); samples.push(p.x, p.y, p.z);
      }
      return samples;
    };
    assert.notDeepEqual(pose(0), pose(.6), key);
    assert.deepEqual(pose(.6), pose(.6), `no accumulated drift: ${key}`);
    const edges = new Map<string, number>(), index = mesh.geometry.index!;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      for (const [u, v] of [[a, b], [b, c], [c, a]]) { const e = `${Math.min(u, v)}:${Math.max(u, v)}`; edges.set(e, (edges.get(e) ?? 0) + 1); }
    }
    for (const count of edges.values()) assert.ok(count >= 2, `open silhouette boundary: ${key}`);
  }
});

test("style approvals have saved visual evidence, and texture retention releases unused references", () => {
  for (const form of Object.values(styles.forms)) assert.ok(existsSync(form.sheet), form.sheet);
  const kit = new ModelKit(), keep = new T.Texture(), drop = new T.Texture();
  let dropped = false; drop.addEventListener("dispose", () => { dropped = true; });
  kit.referenceTextures.set("cobra_guppy", keep); kit.referenceTextures.set("halfmoon_betta", drop);
  kit.retainReferences(new Set(["cobra_guppy"]));
  assert.equal(dropped, true); assert.equal(kit.referenceTextures.size, 1); assert.equal(kit.referenceTextures.get("cobra_guppy"), keep);
  assert.throws(() => kit.referenceTexture("../../outside", () => {})); kit.disposeReferences();
});
