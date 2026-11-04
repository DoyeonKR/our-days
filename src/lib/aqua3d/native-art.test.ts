import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {NATIVE_FAMILIES,NATIVE_SPOT_KEYS} from "./prepared.ts";
import {FISH_GLB} from "./glb.ts";
import {FISH_IMAGE_KEYS} from "../aquaimages.ts";
import {FISHING_IMAGE_KEYS} from "../fishingimages.ts";
import {REFERENCE_PROFILES} from "./reference-model.ts";
import {isFishModelApproved} from "./quality.ts";
import {ModelKit,makeAnimal} from "./models.ts";
import {FAMILIES} from "../aquarium.ts";
import {FX_SPOTS} from "../fishingfx.ts";

test("native artwork has 60 independently authored forms and 5 portrait backgrounds, and every family is on",async()=>{
  assert.equal(NATIVE_FAMILIES.length,20);assert.equal(NATIVE_SPOT_KEYS.length,5);
  for(const family of NATIVE_FAMILIES){
    assert.ok(FAMILIES.some(f=>f.key===family),family);
    const hashes=new Set<string>();
    for(const key of[family,`fry_${family}`,`juv_${family}`]){
      assert.ok(FISH_IMAGE_KEYS.has(key)&&FISH_GLB.has(key),key);assert.equal(isFishModelApproved(key),true,key);
      const source=readFileSync(`public/aqua/fish/${key}.webp`),hash=createHash("sha256").update(source).digest("hex");hashes.add(hash);
      assert.equal(REFERENCE_PROFILES[key]?.sourceHash,hash,key);
      const image=await sharp(source).metadata();assert.equal(image.width,512);assert.equal(image.height,512);assert.ok(image.hasAlpha,key);
      for(const path of[`public/aqua/fish/sm/${key}.webp`,`public/aqua/skin/${key}.webp`])assert.ok(existsSync(path),path);
    }
    assert.equal(hashes.size,3,`${family}: growth forms are not duplicate images`);
  }
  for(const key of NATIVE_SPOT_KEYS){
    assert.ok(FISHING_IMAGE_KEYS.has(key),key);const image=await sharp(`public/fishing/${key}.webp`).metadata();assert.equal(image.width,1024);assert.equal(image.height,1280);
    assert.ok(FX_SPOTS[key.replace("spot_","")].horizon>.15&&FX_SPOTS[key.replace("spot_","")].horizon<.50,key);
  }
});

test("native GLBs have one embedded PBR texture, one weighted ten-bone skin, no animation/compression and validated budgets",()=>{
  const report=JSON.parse(readFileSync("design/aqua3d-review/models.json","utf8")),bones=["spine_0","spine_1","spine_2","spine_3","spine_4","spine_5","fin_L","fin_L_tip","fin_R","fin_R_tip"];
  const validation=JSON.parse(readFileSync("design/aqua3d-review/native-validation.json","utf8"));assert.equal(validation.length,60);assert.ok(validation.every((m:{errors:number})=>m.errors===0));
  for(const f of NATIVE_FAMILIES)for(const key of[f,`fry_${f}`,`juv_${f}`]){
    const b=readFileSync(`public/aqua/models/fish/${key}.glb`),j=JSON.parse(b.toString("utf8",20,20+b.readUInt32LE(12))),m=report.models[key];
    assert.equal(j.meshes.length,1,key);assert.equal(j.skins.length,1,key);assert.equal(j.materials.length,1,key);assert.ok(j.images[0].bufferView!==undefined&&!j.images[0].uri,key);
    assert.deepEqual(j.skins[0].joints.map((i:number)=>j.nodes[i].name),bones,key);assert.equal(j.animations?.length??0,0,key);assert.equal(j.extensionsUsed?.length??0,0,key);
    assert.ok(m.triangles<=m.limits.triangles&&b.length<=m.limits.bytes,key);if(key.startsWith("fry_"))assert.ok(m.triangles<=3000&&b.length<=300000,key);
    assert.equal(m.validation.errors,0,key);
    assert.equal(createHash("sha256").update(b).digest("hex"),m.sha256,key);
    for(const view of["front","side","oblique"])assert.ok(existsSync(`design/aqua3d-review/models/${key}-${view}.webp`),`${key}/${view}`);
  }
});

test("native runtime fallback profiles build and animate every new form without a missing-profile error",()=>{
  const kit=new ModelKit();try{for(const f of NATIVE_FAMILIES)for(const key of[f,`fry_${f}`,`juv_${f}`]){const animal=makeAnimal(kit,f,key);animal.animate(.5,1);animal.root.updateMatrixWorld(true);assert.ok(animal.root.children.length,key);}}finally{kit.disposeReferences();kit.sphere.dispose();kit.box.dispose();kit.cylinder.dispose();}
});
