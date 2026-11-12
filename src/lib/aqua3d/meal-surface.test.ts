import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {mealSurface} from './meal-surface.ts';
import {mealPose,mealEnd,type HuntStyle} from './hunt.ts';
import {mealGrip} from './meal-grip.ts';

test('all five visual timelines are bounded, continuous, and motionless after release',()=>{
 for(const style of ['charge','ambush','gulp','strike','wrap'] as HuntStyle[]){
  let last=mealPose(0,style);
  for(let t=1/120;t<mealEnd(style)+.1;t+=1/120){const p=mealPose(t,style);
   for(const k of ['swallow','grip','vitality','fade','sink'] as const){assert.ok(p[k]>=0&&p[k]<=1,`${style} ${k}`);assert.ok(Math.abs(p[k]-last[k])<.09,`${style} continuous ${k}`);}
   if(p.bit&&!p.held)assert.equal(p.vitality,0);
   if(!p.bit)assert.equal(p.swallow,0);
   last=p;
  }
  assert.equal(last.fade,1);
 }
});

test('per-replay material clipping/fade preserves source hooks, scale and shared textures',()=>{
 const texture=new T.Texture(),source=new T.MeshStandardMaterial({map:texture}),root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(),source);root.add(mesh);
 let compiled=0;source.onBeforeCompile=()=>{compiled++;};let textureDisposed=0,materialDisposed=0;texture.addEventListener('dispose',()=>textureDisposed++);
 const effect=mealSurface(root,true),copy=mesh.material;copy.addEventListener('dispose',()=>materialDisposed++);
 assert.notEqual(copy,source);assert.equal(copy.map,texture);assert.ok(copy.customProgramCacheKey().endsWith('|meal-surface-v1'));
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};copy.onBeforeCompile(shader as never,{} as never);assert.equal(compiled,1);assert.match(shader.fragmentShader,/distance\(vMealWorld,mealWound\)/);assert.match(shader.vertexShader,/modelMatrix\*vec4\(transformed/);
 effect.update(new T.Vector3(2,0,0),new T.Vector3(1,0,0),.5);
 assert.equal(copy.opacity,.5);assert.equal(source.opacity,1);
 assert.equal(copy.clippingPlanes![0].distanceToPoint(new T.Vector3(3,0,0)),1);
 assert.equal(copy.clippingPlanes![0].distanceToPoint(new T.Vector3(1,0,0)),-1);
 assert.deepEqual(root.scale.toArray(),[1,1,1]);
 effect.dispose();effect.dispose();assert.equal(mesh.material,source);assert.equal(materialDisposed,1);assert.equal(textureDisposed,0);
 mesh.geometry.dispose();source.dispose();texture.dispose();
});

test('arm grip is safe without an arm rig and bounded for independent chains',()=>{
 const empty=new T.Group();mealGrip(empty)(new T.Vector3(),1,1);
 const root=new T.Group(),chain=[0,1,2].map(i=>{const b=new T.Bone();b.name=`arm_0_${i}`;b.position.x=i?1:0;return b;});root.add(chain[0]);chain[0].add(chain[1]);chain[1].add(chain[2]);
 const target=new T.Vector3(1,1,0),before=chain[2].getWorldPosition(new T.Vector3()).distanceTo(target);mealGrip(root)(target,.1,1);
 assert.ok(chain[2].getWorldPosition(new T.Vector3()).distanceTo(target)<before);
 for(const bone of chain)assert.ok(new T.Quaternion().angleTo(bone.quaternion)<=.55+1e-6);
});

test('legacy cephalopod arm-region deformation pins the mantle in world space',()=>{
 const root=new T.Group(),bones=[0,1,2,3].map(i=>{const b=new T.Bone();b.name=`spine_${i}`;b.position.x=i?-.4:0;return b;});root.add(bones[0]);for(let i=1;i<4;i++)bones[i-1].add(bones[i]);
 root.rotation.y=.4;root.scale.setScalar(2);
 const before=bones[3].getWorldPosition(new T.Vector3());mealGrip(root)(new T.Vector3(1,0,0),.4,1);
 assert.ok(bones[3].getWorldPosition(new T.Vector3()).distanceTo(before)<1e-6);
 assert.ok(new T.Quaternion().angleTo(bones[1].quaternion)>.2);
});
