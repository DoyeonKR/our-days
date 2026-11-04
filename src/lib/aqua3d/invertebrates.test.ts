import {test} from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {createInvertebrateGeometry,makeInvertebrateRig,invertebrateMotion,INVERTEBRATE_FAMILIES,starCourse} from "./invertebrates.ts";
import {fishCourse,fishLength,WORLD} from "./world.ts";

test("star and cephalopod models have volumetric bodies, independent arm chains and normalized weights",()=>{
  for(const family of INVERTEBRATE_FAMILIES)for(const key of[family,`fry_${family}`,`juv_${family}`]){
    const g=createInvertebrateGeometry(family,key),bones=makeInvertebrateRig(family,key);
    assert.ok(g.index!.count/3<=(key.startsWith("fry_")?3000:8000),key);
    assert.equal(bones.filter(b=>b.name.startsWith("arm_")).length,family==="starfish"?15:/squid/.test(family)?30:24,key);
    const weights=g.attributes.skinWeight,ids=g.attributes.skinIndex;
    for(let i=0;i<weights.count;i++){assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6,key);for(let c=0;c<4;c++)assert.ok(ids.array[i*4+c]<bones.length,key);}
    const root=new T.Group(),mesh=new T.SkinnedMesh(g,new T.MeshStandardMaterial());mesh.add(bones[0]);mesh.bind(new T.Skeleton(bones));root.add(mesh);
    const animate=invertebrateMotion(root,family,key),poses=(t:number)=>{animate(t,1);root.updateMatrixWorld(true);const points:number[]=[];for(let i=0;i<g.attributes.position.count;i+=23){const p=mesh.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(g.attributes.position,i));assert.ok(p.toArray().every(Number.isFinite),key);points.push(...p.toArray());}return points;};
    assert.notDeepEqual(poses(0),poses(.7),key);assert.deepEqual(poses(.7),poses(.7),`${key}: no cumulative pose drift`);
    g.computeBoundingBox();const box=g.boundingBox!.getSize(new T.Vector3());assert.ok(box.y>.12&&box.z>.3,key);
    g.dispose();mesh.material.dispose();mesh.skeleton.dispose();
  }
});

test("starfish crawl at substrate height, never bob or fly in a school",()=>{
  for(let t=0;t<600;t+=7)for(const id of[1,7,13]){const p=starCourse(id,t,1.3);assert.equal(p.dy,0);assert.ok(p.y>WORLD.floor&&p.y<WORLD.floor+.2);}
  assert.notDeepEqual(starCourse(1,0,1.3),starCourse(1,30,1.3));
});

test("giant squid and kraken fit under half the base tank width including their arms",()=>{
  for(const [family,cm]of[["giant_squid",1200],["kraken",2500]] as const){const length=fishLength(cm,family);assert.ok(length<WORLD.width*.5);for(let t=0;t<1200;t+=5){const p=fishCourse(5,t,length,family);assert.ok(Math.abs(p.x)+length*.5<=WORLD.width*.5);}}
});
