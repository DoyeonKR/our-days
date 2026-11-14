import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as T from "three";
import {DECOR} from "../aquarium.ts";
import {ModelKit} from "./models.ts";
import {makeDecor} from "./decor.ts";
import {shellGeometry} from "./decor-details.ts";
import {seatDecor} from "./decor-layout.ts";
import {bodyBounds,swapBody} from "./glb.ts";

test("all 40 decorations use detailed volumetric meshes, texture relief and finite animation",()=>{
  assert.equal(DECOR.length,40);
  for(const d of DECOR){const m=makeDecor(new ModelKit(),d.key);assert.equal(m.root.userData.detailVersion,2,d.key);let textured=0,triangles=0;
    m.animate(0);m.animate(1.2);m.root.updateMatrixWorld(true);
    m.root.traverse(o=>{if(o instanceof T.Mesh){for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n),d.key);
      for(const n of o.matrixWorld.elements)assert.ok(Number.isFinite(n),d.key);
      triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof T.InstancedMesh?o.count:1);
      if(o.material instanceof T.MeshStandardMaterial&&o.material.map&&o.material.bumpMap)textured++;
      if(o instanceof T.InstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n),d.key);
    }});
    assert.ok(textured>0,d.key);assert.ok(triangles<80000,`${d.key}: ${triangles}`);
    const bounds=new T.Box3().setFromObject(m.root).getSize(new T.Vector3());assert.ok(bounds.x>.1&&bounds.y>.1&&bounds.z>.1,d.key);
  }
});
test("shells have separate inner/outer surfaces and decorative emitters animate",()=>{
  const g=shellGeometry();g.computeBoundingBox();assert.ok(g.boundingBox!.max.y-g.boundingBox!.min.y>.2);assert.ok(g.attributes.position.count>1000);
  // 2026-11-05 — 장식 거품은 공 인스턴스에서 점 입자(셰이더가 시간으로 움직인다)로 바뀌었다. 시간이 넘어가는지와, 몸과 따로 남는 표시를 본다
  for(const key of["heart_bubbler","star_gate","filter_3","heater_3"]){const m=makeDecor(new ModelKit(),key),b=m.root.getObjectByName("decor-animated-bubbles") as T.Points<T.BufferGeometry,T.ShaderMaterial>;
    assert.ok(b instanceof T.Points,key);assert.equal(b.parent,m.root,key);assert.equal(b.userData.aquaKeep,true,key);
    const before=b.material.uniforms.uTime.value;m.animate(.7);assert.notEqual(b.material.uniforms.uTime.value,before,key);
    m.effects(1.9);assert.equal(b.material.uniforms.uTime.value,1.9,key);}
});
test("제작 모델로 갈아 끼워도 거품은 남는다 · 크기는 거품 · 왕관을 빼고 잰다",()=>{
  for(const key of["heart_bubbler","star_gate","filter_3","heater_3"]){
    const m=makeDecor(new ModelKit(),key),body=bodyBounds(m.root).getSize(new T.Vector3());
    const inner=new T.Group();inner.add(new T.Mesh(new T.BoxGeometry(2,4,2)));
    const old=swapBody(m.root,inner,"base");
    assert.equal(old.getObjectByName("decor-animated-bubbles"),undefined,`${key}: 거품이 옛 몸과 함께 지워진다`);
    assert.ok(m.root.getObjectByName("decor-animated-bubbles"),key);
    const after=bodyBounds(m.root).getSize(new T.Vector3());
    assert.ok(Math.abs(Math.max(after.x,after.z,after.y*1.25)-Math.max(body.x,body.z,body.y*1.25))<1e-6,`${key}: 새 몸이 옛 몸 크기에 맞는다`);
  }
  // 왕관(aquaKeep)을 재면 새 몸이 작게 맞춰진다 — 왕관을 달아도 새 몸 크기가 같아야 한다
  const fish=()=>{const g=new T.Group();g.add(new T.Mesh(new T.BoxGeometry(3,1,.5)));return g;};
  const plain=fish(),crowned=fish(),crown=new T.Mesh(new T.BoxGeometry(.5,3,.5));crown.position.y=2;crown.userData.aquaKeep=true;crowned.add(crown);
  const a=new T.Group(),b=new T.Group();a.add(new T.Mesh(new T.BoxGeometry(1,1,1)));b.add(new T.Mesh(new T.BoxGeometry(1,1,1)));
  swapBody(plain,a,"center");swapBody(crowned,b,"center");
  assert.equal(b.scale.x,a.scale.x);assert.equal(crown.parent,crowned);
});
test("placement preview is renderer-only and committed through shared island actions",()=>{
  const scene=readFileSync("src/lib/aqua3d/scene.ts","utf8"),ui=readFileSync("src/components/AquariumGame.tsx","utf8"),preview=readFileSync("src/components/DecorPreview.tsx","utf8");
  assert.match(scene,/next\.aquarium\.placed\.filter/);assert.match(scene,/decorPose\(p\)/);assert.match(ui,/preview: draft/);
  assert.match(ui,/배치 확정/);assert.match(ui,/moveDecor\(st, p.id, p.x, p.y, t, pose\)/);assert.match(ui,/setDraft\(null\)/);
  assert.match(preview,/useDialogFocus/);assert.match(preview,/viewer\?\.dispose\(\)/);
});
test("all scaled/rotated decorations stay inside the glass and stand on the terrain",()=>{
  for(const d of DECOR){const m=makeDecor(new ModelKit(),d.key);
    for(const side of[-1,1])for(const angle of[0,Math.PI/4,Math.PI/2,Math.PI]){
      m.root.position.set(side*4.4,-5.3,side*2.7);m.root.rotation.y=angle;m.root.scale.setScalar(1.6);
      seatDecor(m.root,()=>-5.15);
      const b=new T.Box3().setFromObject(m.root);
      assert.ok(b.min.x>=-4.90001&&b.max.x<=4.90001,d.key);assert.ok(b.min.z>=-2.90001&&b.max.z<=2.90001,d.key);
      assert.ok(Math.abs(b.min.y+5.15)<.0001,d.key);
    }
  }
  const wide=makeDecor(new ModelKit(),"treasure").root;wide.position.x=6.7;seatDecor(wide,()=>-5.15,7.35);
  assert.ok(wide.position.x>6,"a widened tank must not push ornaments back into the original ten-unit width");
});
