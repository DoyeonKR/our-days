import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "three";
import { FAMILIES, DECOR } from "./aquarium.ts";
import { appearance } from "./aqua3d/appearance.ts";
import { makeAnimal, ModelKit } from "./aqua3d/models.ts";
import { makeDecor } from "./aqua3d/decor.ts";
import { decorToWorld, worldToDecor, fishCourse, WORLD } from "./aqua3d/world.ts";
import { habitOf } from "./aqua3d/habits.ts";

test("all 414 active fish forms have finite volumetric geometry and articulated animation", () => {
  const kit=new ModelKit();let count=0;
  for(const family of FAMILIES)for(const key of [`fry_${family.key}`,`juv_${family.key}`,...family.finals.map(s=>s.key)]){
    const m=makeAnimal(kit,family.key,key);count++;
    const bounds=new T.Box3().setFromObject(m.root),size=bounds.getSize(new T.Vector3());
    assert.ok(size.x>.1&&size.y>.1&&size.z>.03,key); // 갈치처럼 납작한 몸이 있다
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
  }assert.equal(count,414);
});

test("every one of the 37 owned decoration keys builds real 3D meshes",()=>{
  const kit=new ModelKit();for(const decor of DECOR){const m=makeDecor(kit,decor.key);let meshes=0;m.root.traverse(o=>{if(o instanceof T.Mesh)meshes++;});assert.ok(meshes>0,decor.key);m.animate(1);const b=new T.Box3().setFromObject(m.root);assert.ok(!b.isEmpty(),decor.key);}
});

test("existing decoration coordinates round trip without a save migration",()=>{
  for(const x of[6,20,50,80,94])for(const y of[14,30,54,80,94]){const p=decorToWorld(x,y),stored=worldToDecor(p.x,p.z);assert.equal(stored.x,x);assert.equal(stored.y,y);assert.equal(p.y,WORLD.floor);}
});

// 거북만 숨 쉬러 수면 바로 밑(5 안팎)까지 올라간다 — 2026-11-05 습성 개편(4.3 에서 멈추면 숨 쉬는 게 안 보였다)
test("fish swim in true bounded XYZ with a finite 3D tangent",()=>{
  for(let id=1;id<=20;id++)for(const family of FAMILIES){let minZ=Infinity,maxZ=-Infinity;
    // 경기장 고리(habits.lap — 고래상어)는 몸이 길을 따라 누워 있어 몸 끝(가운데 + 반길이 · 머리 방향)이 유리(가로 5 · 앞뒤 3) 안인지로 잰다(2026-11-12)
    // 굴에 사는 물고기(곰치 — habits.den)는 고리를 돌지 않는다 — 한 프레임 길은 denCourse(fishstep)가 정한다
    if(habitOf(family.key).den)continue;
    const lap=!!habitOf(family.key).lap;
    for(let t=0;t<400;t+=.5){const p=fishCourse(id,t,2.4,family.key);assert.ok(Object.values(p).every(Number.isFinite));const hl=Math.hypot(p.dx,p.dz)||1;assert.ok((lap?Math.abs(p.x)+1.2*Math.abs(p.dx)/hl<=4.9:Math.abs(p.x)<=3.41)&&p.y>=-5.4&&p.y<(habitOf(family.key).breathe?5.15:4.3)&&(lap?Math.abs(p.z)+1.2*Math.abs(p.dz)/hl<3:Math.abs(p.z)<2.7));assert.ok(p.dx*p.dx+p.dy*p.dy+p.dz*p.dz>0);
      minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
    assert.ok(maxZ-minZ>.5,family.key);
  }
});

test("big fish swim level instead of diving straight up and down",()=>{const p=[];for(let t=0;t<100;t+=.5)p.push(fishCourse(3,t,4.8,"whale_shark"));assert.ok(Math.max(...p.map(q=>Math.abs(q.y)))<1.7);assert.ok(Math.max(...p.map(q=>Math.abs(q.x)+2.4*Math.abs(q.dx)/(Math.hypot(q.dx,q.dz)||1)))<5);});

test("only the tank is replaced; renderer cleans up and handles context loss, visibility and reduced motion",()=>{
  const component=readFileSync("src/components/AquariumGame.tsx","utf8"),scene=readFileSync("src/lib/aqua3d/scene.ts","utf8");
  assert.match(component,/<Aquarium3D/);assert.doesNotMatch(component,/<AquaSwimmers|aqua-bubble|backgroundImage/);
  assert.match(scene,/new T.WebGLRenderer/);assert.match(scene,/new T.Raycaster/);assert.match(scene,/worldToDecor/);
  for(const contract of["webglcontextlost","visibilitychange","prefers-reduced-motion","IntersectionObserver","renderer.dispose()","renderer.forceContextLoss()","observer.disconnect()","skeleton.dispose()"] )assert.ok(scene.includes(contract),contract);
  assert.doesNotMatch(scene,/TextureLoader|SpriteMaterial|saveIsland|localStorage|fetch\(/);
});
