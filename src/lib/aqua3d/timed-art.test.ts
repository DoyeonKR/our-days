import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { FAMILIES } from "../aquarium.ts";
import { FISH_IMAGE_KEYS } from "../aquaimages.ts";
import { FISH_GLB } from "./glb.ts";
import { REFERENCE_PROFILES } from "./reference-model.ts";
import { anatomy } from "./anatomy.ts";
import { isFishModelApproved } from "./quality.ts";
import { makeAnimal, ModelKit } from "./models.ts";
import * as T from "three";

const families = ["catfish", "sweetfish", "jellyfish"];
const bones = ["spine_0", "spine_1", "spine_2", "spine_3", "spine_4", "spine_5", "fin_L", "fin_L_tip", "fin_R", "fin_R_tip"];

test("new timed-guest families have all nine source images, profiles, skins and embedded rigged GLBs", () => {
  for (const family of families) {
    const active = FAMILIES.find(f => f.key === family);
    if (active) assert.ok(active.finals.some(s => s.key === family), family);
    for (const key of [family, `fry_${family}`, `juv_${family}`]) {
      assert.ok(FISH_IMAGE_KEYS.has(key), key);
      assert.ok(FISH_GLB.has(key), key);
      assert.equal(isFishModelApproved(key), false, `${key}: must await user visual approval`);
      const source = readFileSync(`public/aqua/fish/${key}.webp`);
      assert.equal(REFERENCE_PROFILES[key]?.sourceHash, createHash("sha256").update(source).digest("hex"), key);
      assert.ok(existsSync(`public/aqua/fish/sm/${key}.webp`), key);
      assert.ok(existsSync(`public/aqua/skin/${key}.webp`), key);
      const b = readFileSync(`public/aqua/models/fish/${key}.glb`);
      assert.equal(b.readUInt32LE(0), 0x46546c67);
      assert.ok(b.length < 300000, key);
      const j = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12)));
      assert.equal(j.meshes.length, 1, key);
      assert.equal(j.skins.length, 1, key);
      assert.deepEqual(j.skins[0].joints.map((i: number) => j.nodes[i].name), bones, key);
      assert.equal(j.images.length, 1, key);
      assert.ok(j.images[0].bufferView !== undefined && !j.images[0].uri, key);
      assert.equal(j.animations?.length ?? 0, 0, key);
      assert.equal(j.extensionsUsed?.length ?? 0, 0, key);
      assert.equal(j.materials[0].alphaMode ?? "OPAQUE", family === "jellyfish" ? "BLEND" : "OPAQUE", key);
    }
  }
});

test("new natural moon jelly uses jelly anatomy, not the mythical moonlight species", () => {
  for (const key of ["jellyfish", "fry_jellyfish", "juv_jellyfish"]) assert.equal(anatomy("jellyfish", key).kind, "jelly");
  assert.ok(!isFishModelApproved("unknown"));
});

test("prepared timed forms can construct their fallback meshes without missing-profile exceptions", () => {
  const kit = new ModelKit();
  for (const family of families) for (const key of [family, `fry_${family}`, `juv_${family}`]) {
    const model = makeAnimal(kit, family, key);
    model.animate(.4, 1);model.root.updateMatrixWorld(true);
    const size = new T.Box3().setFromObject(model.root).getSize(new T.Vector3());
    assert.ok([size.x, size.y, size.z].every(n => Number.isFinite(n) && n > .01), key);
  }
});
