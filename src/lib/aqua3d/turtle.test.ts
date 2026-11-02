import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import * as T from "three";
import { makeAnimal, ModelKit } from "./models.ts";

test("authored turtle has a solid sculpted shell, four swept closed flippers, neck and jaw", () => {
  const model = makeAnimal(new ModelKit(), "sea_turtle", "green_sea_turtle");
  const shell = model.root.getObjectByName("sculpted-carapace") as T.Mesh;
  assert.ok(shell.geometry.attributes.position.count > 6000);
  for (const name of ["plastron", "neck-joint", "skull", "jaw", "beak", "front-flipper--1", "front-flipper-1", "rear-flipper--1", "rear-flipper-1"]) assert.ok(model.root.getObjectByName(name), name);
  const topNormals = shell.geometry.attributes.normal;
  const pos = shell.geometry.attributes.position;
  let topCount = 0;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > .25) { assert.ok(topNormals.getY(i) > 0, `inward shell normal ${i}`); topCount++; }
  assert.ok(topCount > 100);
  const geometry = (model.root.getObjectByName("front-flipper-1")!.children[0] as T.Mesh).geometry;
  const rest = Array.from(geometry.attributes.position.array);
  model.animate(.6, 1);
  assert.notDeepEqual(Array.from(geometry.attributes.position.array), rest);
  const once = Array.from(geometry.attributes.position.array);
  model.animate(.6, 1); assert.deepEqual(Array.from(geometry.attributes.position.array), once, "animation must not accumulate drift");
  model.animate(.6 + Math.PI * 2 / 2.1, 1);
  for (let i = 0; i < once.length; i++) assert.ok(Math.abs(once[i] - geometry.attributes.position.array[i]) < 1e-6);
});

test("reference texture projection stays on opaque original pixels, not the transparent cutout", async () => {
  const { data, info } = await sharp("public/aqua/fish/green_sea_turtle.webp").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const texture = new T.DataTexture(data, info.width, info.height), kit = new ModelKit();
  kit.referenceTextures.set("green_sea_turtle", texture);
  const model = makeAnimal(kit, "sea_turtle", "green_sea_turtle");
  const mesh = model.root.getObjectByName("sculpted-carapace") as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  assert.equal(mesh.material.map, texture);
  for (let i = 0; i < mesh.geometry.attributes.uv.count; i++) {
    const uv = mesh.geometry.attributes.uv;
    const x = Math.floor(uv.getX(i) * info.width), y = Math.floor(uv.getY(i) * info.height);
    assert.ok(data[(y * info.width + x) * 4 + 3] >= 200, `transparent projection at ${x},${y}`);
  }
  let disposed = false; texture.addEventListener("dispose", () => { disposed = true; });
  kit.disposeReferences(); assert.equal(disposed, true); assert.equal(kit.referenceTextures.size, 0);
});
