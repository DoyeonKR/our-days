import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import * as T from "three";
import { makeAnimal, ModelKit } from "./models.ts";

test("authored turtle has a solid sculpted shell, four swept closed flippers, neck and jaw", () => {
  const model = makeAnimal(new ModelKit(), "sea_turtle", "green_sea_turtle");
  const shell = model.root.getObjectByName("sculpted-carapace") as T.Mesh;
  // 2026-11-12 — 예전 하한 6000 은 36고리 × 96칸 격자의 정점 수(7,178)였다. 고리를 sin 간격으로 모아(위 16 · 아래 6 × 72칸 = 1,752)
  // 옆 실루엣 오차는 오히려 1/5 로 줄었다 — 하한은 '판이 아니라 속이 찬 돔'을 보는 수준으로 낮추고, 대신 거북 한 마리 삼각형 예산을 잠근다
  assert.ok(shell.geometry.attributes.position.count > 1500);
  let triangles = 0;
  model.root.traverse(o => { if (o instanceof T.Mesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
  assert.ok(triangles <= 8000, `거북은 늘 화면에 있는 코드 모델(GLB 없음) — 한 마리 ${triangles} 삼각형`);
  // 성긴 얼굴 형상은 수조(kit)마다 한 벌 — 거북마다 새로 만들면 수조의 묶어 그리기(같은 형상 + 재질 셋 이상)가 깨져 그리기가 늘어난다.
  // 나눠 쓰는 형상은 한 마리가 떠날 때 지우면 안 된다(glbShared)
  const kit = new ModelKit(), a = makeAnimal(kit, "sea_turtle", "green_sea_turtle"), b = makeAnimal(kit, "sea_turtle", "juv_sea_turtle");
  for (const name of ["jaw", "beak", "eye", "eye-socket", "nostril", "mouth-crease"]) {
    const ma = a.root.getObjectByName(name) as T.Mesh, mb = b.root.getObjectByName(name) as T.Mesh;
    assert.equal(ma.geometry, mb.geometry, name); assert.equal(ma.userData.glbShared, true, name);
  }
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
