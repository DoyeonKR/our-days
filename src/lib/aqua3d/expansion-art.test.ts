import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { EXPANSION_FAMILIES } from "./prepared.ts";
import { FISH_GLB } from "./glb.ts";
import { FISH_IMAGE_KEYS } from "../aquaimages.ts";
import { REFERENCE_PROFILES } from "./reference-model.ts";
import { isFishModelApproved } from "./quality.ts";
import { FAMILIES } from "../aquarium.ts";
import { FISHING_IMAGE_KEYS } from "../fishingimages.ts";

const keys=EXPANSION_FAMILIES.flatMap(f=>[f,`fry_${f}`,`juv_${f}`]);
const bones=["spine_0","spine_1","spine_2","spine_3","spine_4","spine_5","fin_L","fin_L_tip","fin_R","fin_R_tip"];

test("all 14 expansion species have three distinct original images, matching profiles and rigged GLBs",()=>{
  assert.equal(keys.length,42);
  for(const family of EXPANSION_FAMILIES){
    const sourceHashes=new Set<string>(),geometryHashes=new Set<string>();
    for(const key of [family,`fry_${family}`,`juv_${family}`]){
      assert.ok(FISH_IMAGE_KEYS.has(key),key);assert.ok(FISH_GLB.has(key),key);
      const source=readFileSync(`public/aqua/fish/${key}.webp`);
      const hash=createHash("sha256").update(source).digest("hex");sourceHashes.add(hash);
      assert.equal(REFERENCE_PROFILES[key]?.sourceHash,hash,key);
      assert.ok(existsSync(`public/aqua/fish/sm/${key}.webp`),key);
      assert.ok(existsSync(`public/aqua/skin/${key}.webp`),key);
      const b=readFileSync(`public/aqua/models/fish/${key}.glb`);
      assert.equal(b.readUInt32LE(0),0x46546c67,key);assert.equal(b.readUInt32LE(8),b.length,key);
      assert.ok(b.length<=300000,key);
      const jsonLength=b.readUInt32LE(12),j=JSON.parse(b.toString("utf8",20,20+jsonLength));
      assert.equal(j.meshes.length,1,key);assert.equal(j.skins.length,1,key);
      assert.deepEqual(j.skins[0].joints.map((i:number)=>j.nodes[i].name),bones,key);
      assert.equal(j.materials.length,1,key);assert.equal(j.materials[0].alphaMode??"OPAQUE","OPAQUE",key);
      assert.equal(j.images.length,1,key);assert.ok(j.images[0].bufferView!==undefined&&!j.images[0].uri,key);
      // 2026-11-05 배포용 압축(meshopt · 양자화 · 512px WebP, design/aqua3d-review/glb-compress.mjs) 셋만 — 원본 대조는 scripts/aqua-model-verify.mjs
      assert.equal(j.animations?.length??0,0,key);assert.deepEqual([...(j.extensionsUsed??[])].sort(),["EXT_meshopt_compression","EXT_texture_webp","KHR_mesh_quantization"],key);
      const p=j.meshes[0].primitives[0];assert.ok(j.accessors[p.indices].count/3<=3000,key);
      // 위치 데이터는 meshopt 로 압축돼 GLB BIN 의 extension 자리(byteOffset/byteLength)에 있다 — 그 바이트로 '세 형태의 형상이 서로 다르다'를 본다
      const v=j.bufferViews[j.accessors[p.attributes.POSITION].bufferView].extensions.EXT_meshopt_compression;
      geometryHashes.add(createHash("sha256").update(b.subarray(28+jsonLength+v.byteOffset,28+jsonLength+v.byteOffset+v.byteLength)).digest("hex"));
    }
    assert.equal(sourceHashes.size,3,family);assert.equal(geometryHashes.size,3,family);
  }
});

test("expansion fish are approved by the user and active in the catch catalogue",()=>{
  for(const key of keys)assert.equal(isFishModelApproved(key),true,key);
  for(const family of EXPANSION_FAMILIES)assert.ok(FAMILIES.some(f=>f.key===family),family);
  const report=JSON.parse(readFileSync("design/aqua3d-review/models.json","utf8"));
  for(const key of keys){assert.notEqual(report.models[key].approval,"pending",key);assert.equal(report.models[key].validation.errors,0,key);}
});

test("prepared Namhae harbor background is registered and fills a 4:5 portrait frame",async()=>{
  assert.ok(FISHING_IMAGE_KEYS.has("spot_harbor"));
  const m=await sharp("public/fishing/spot_harbor.webp").metadata();
  assert.equal(m.width,1024);assert.equal(m.height,1280);
});
