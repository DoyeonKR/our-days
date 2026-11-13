import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {EXPANSION2_FAMILIES} from "./prepared.ts";
import {FISH_GLB} from "./glb.ts";
import {FISH_IMAGE_KEYS} from "../aquaimages.ts";
import {REFERENCE_PROFILES} from "./reference-model.ts";
import {isFishModelApproved} from "./quality.ts";
import {makeAnimal,ModelKit} from "./models.ts";
import {anatomy} from "./anatomy.ts";
import {FAMILIES} from "../aquarium.ts";

test("27 new forms have original art, matching profiles, self-contained rigged GLBs and strict budgets",()=>{
  const report=JSON.parse(readFileSync("design/aqua3d-review/models.json","utf8"));
  for(const family of EXPANSION2_FAMILIES){
    assert.ok(FAMILIES.some(f=>f.key===family));
    for(const key of[family,`fry_${family}`,`juv_${family}`]){
      assert.ok(FISH_IMAGE_KEYS.has(key)&&FISH_GLB.has(key),key);assert.equal(isFishModelApproved(key),true,key);
      const hash=createHash("sha256").update(readFileSync(`public/aqua/fish/${key}.webp`)).digest("hex");assert.equal(REFERENCE_PROFILES[key]?.sourceHash,hash,key);
      for(const path of[`public/aqua/fish/sm/${key}.webp`,`public/aqua/skin/${key}.webp`])assert.ok(existsSync(path),key);
      const b=readFileSync(`public/aqua/models/fish/${key}.glb`),j=JSON.parse(b.toString("utf8",20,20+b.readUInt32LE(12))),m=report.models[key];
      assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(j.meshes.length,1);assert.equal(j.skins.length,1);assert.equal(j.materials.length,1);
      // 2026-11-05 배포용 압축(meshopt · 양자화 · 512px WebP, design/aqua3d-review/glb-compress.mjs) 셋만 — 원본 대조는 scripts/aqua-model-verify.mjs
      assert.equal(j.animations?.length??0,0);assert.deepEqual([...(j.extensionsUsed??[])].sort(),["EXT_meshopt_compression","EXT_texture_webp","KHR_mesh_quantization"],key);
      assert.ok(j.images[0].bufferView!==undefined&&!j.images[0].uri);
      assert.ok(m.triangles<=m.limits.triangles&&m.bytes<=m.limits.bytes,key);
      if(key.startsWith("fry_"))assert.ok(m.triangles<=3000&&b.length<=300000,key);
      assert.equal(m.validation.errors,0,key);
      const kind=anatomy(family,key).kind;
      if(kind==="star")assert.ok(j.skins[0].joints.map((i:number)=>j.nodes[i].name).includes("arm_0_2"),key);
    }
  }
});

test("new profile-backed runtime fallbacks build the dedicated star/cephalopod shape without throwing",()=>{
  const kit=new ModelKit();for(const f of EXPANSION2_FAMILIES)for(const key of[f,`fry_${f}`,`juv_${f}`]){const model=makeAnimal(kit,f,key);model.animate(.5,1);model.root.updateMatrixWorld(true);assert.ok(model.root.children.length>0,key);}
});
