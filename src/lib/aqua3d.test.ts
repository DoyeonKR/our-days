import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { FAMILIES, DECOR } from "./aquarium.ts";
import { appearance } from "./aqua3d/appearance.ts";
import { makeAnimal, ModelKit } from "./aqua3d/models.ts";
import { makeDecor } from "./aqua3d/decor.ts";
import { decorToWorld, worldToDecor, fishCourse, WORLD } from "./aqua3d/world.ts";

test("all 84 fish forms have finite volumetric geometry and articulated animation", () => {
  const kit=new ModelKit();let count=0;
  for(const family of FAMILIES)for(const key of [`fry_${family.key}`,`juv_${family.key}`,...family.finals.map(s=>s.key)]){
    const m=makeAnimal(kit,family.key,key);count++;
    const bounds=new T.Box3().setFromObject(m.root),size=bounds.getSize(new T.Vector3());
    assert.ok(size.x>.1&&size.y>.1&&size.z>.1,key);
    const rotations:string[]=[];
    const sample=()=>{const values:number[]=[];m.root.traverse(o=>{values.push(o.rotation.x,o.rotation.y,o.rotation.z);});rotations.push(values.join(","));};
    m.animate(0,1);sample();m.animate(.35,1);sample();assert.notEqual(rotations[0],rotations[1],key);
    m.root.traverse(o=>{if(o instanceof T.Mesh){assert.ok(!(o.geometry instanceof T.PlaneGeometry),key);
      for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n),key);}});
    if(appearance(family.key,key).kind==="fish"||appearance(family.key,key).kind==="dragon"){
      const body=m.root.children.find(o=>o instanceof T.SkinnedMesh) as T.SkinnedMesh;
      assert.ok(body?.skeleton.bones.length>=5,key);
      const weights=body.geometry.attributes.skinWeight;
      for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6,key);
    }
  }assert.equal(count,84);
});

test("every one of the 37 owned decoration keys builds real 3D meshes",()=>{
  const kit=new ModelKit();for(const decor of DECOR){const m=makeDecor(kit,decor.key);let meshes=0;m.root.traverse(o=>{if(o instanceof T.Mesh)meshes++;});assert.ok(meshes>0,decor.key);m.animate(1);const b=new T.Box3().setFromObject(m.root);assert.ok(!b.isEmpty(),decor.key);}
});

test("existing decoration coordinates round trip without a save migration",()=>{
  for(const x of[6,20,50,80,94])for(const y of[14,30,54,80,94]){const p=decorToWorld(x,y),stored=worldToDecor(p.x,p.z);assert.equal(stored.x,x);assert.equal(stored.y,y);assert.equal(p.y,WORLD.floor);}
});

test("fish swim in true bounded XYZ with a finite 3D tangent",()=>{
  for(let id=1;id<=20;id++)for(const family of FAMILIES){let minZ=Infinity,maxZ=-Infinity,minY=Infinity,maxY=-Infinity;
    for(let t=0;t<100;t+=.5){const p=fishCourse(id,t,3.6,family.key);assert.ok(Object.values(p).every(Number.isFinite));assert.ok(Math.abs(p.x)<3&&Math.abs(p.y)<4&&Math.abs(p.z)<2);assert.ok(p.dx*p.dx+p.dy*p.dy+p.dz*p.dz>0);
      minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
    assert.ok(maxZ-minZ>3&&maxY-minY>6);
  }
});

test("only the tank is replaced; renderer cleans up and handles context loss, visibility and reduced motion",()=>{
  const component=readFileSync("src/components/AquariumGame.tsx","utf8"),scene=readFileSync("src/lib/aqua3d/scene.ts","utf8");
  assert.match(component,/<Aquarium3D/);assert.doesNotMatch(component,/<AquaSwimmers|aqua-bubble|backgroundImage/);
  assert.match(scene,/new T.WebGLRenderer/);assert.match(scene,/new T.Raycaster/);assert.match(scene,/worldToDecor/);
  for(const contract of["webglcontextlost","visibilitychange","prefers-reduced-motion","IntersectionObserver","renderer.dispose()","renderer.forceContextLoss()","observer.disconnect()","skeleton.dispose()"] )assert.ok(scene.includes(contract),contract);
  assert.doesNotMatch(scene,/TextureLoader|SpriteMaterial|saveIsland|localStorage|fetch\(/);
});
