import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {FACE_PROFILES,createFishFace,disposeFishFace,faceJaw,faceMouth,respiratoryGape,facialAnatomy} from './faces.ts';

test('얼굴 프로필은 기존·신규 GLB 381형태 모두의 기준 그림과 일치한다',()=>{
 const models=JSON.parse(readFileSync('design/aqua3d-review/models.json','utf8')).models;
 const fish=Object.entries(models).filter(([,m])=>{const meta=m as {kind:string;anatomyKind?:string};return meta.kind==='fish'&&meta.anatomyKind!=='mammal';});
 const mammals=Object.entries(models).filter(([,m])=>(m as {anatomyKind?:string}).anatomyKind==='mammal');
 assert.equal(mammals.length,18);for(const [key,meta] of mammals){assert.equal((meta as {activation:string}).activation,'not enabled',key);assert.equal((meta as {visualApproval:string}).visualApproval,'pending',key);assert.equal(FACE_PROFILES[key],undefined,'포유류에 물고기 얼굴을 붙이지 않는다');}
 assert.equal(fish.length,381);assert.equal(Object.keys(FACE_PROFILES).length,381);
 for(const [key] of fish){const p=FACE_PROFILES[key];assert.ok(p,key);assert.equal(p.sourceHash,createHash('sha256').update(readFileSync(`public/aqua/fish/${key}.webp`)).digest('hex'),key);}
 assert.equal(FACE_PROFILES.moray.teeth,'fang');assert.equal(FACE_PROFILES.piranha.teeth,'triangular');assert.equal(FACE_PROFILES.parrotfish.teeth,'beak');assert.equal(FACE_PROFILES.common_carp.teeth,'none');
 for(const key of ['moon_jelly','jellyfish','octopus','starfish'])assert.equal(FACE_PROFILES[key].mode,'none');
});
test('호흡은 연속적이고 개체별 위상이 다르며 먹이 입 벌림이 우선한다',()=>{
 for(const p of Object.values(FACE_PROFILES)){if(p.mode==='none')continue;let last=respiratoryGape(p,0,.31);
  for(let f=1;f<240;f++){const n=respiratoryGape(p,f/60,.31);assert.ok(n>=0&&n<=.9);assert.ok(Math.abs(n-last)<.02);last=n;}
  assert.ok(respiratoryGape(p,1,0,.8)>=.8);assert.ok(Number.isFinite(respiratoryGape(p,NaN,0)));}
 assert.notEqual(respiratoryGape(FACE_PROFILES.moray,1,.2),respiratoryGape(FACE_PROFILES.moray,1,2));
});
test('전체 GLB에 얼굴 생성·턱 제어·셰이더 연결·해제를 반복해도 원본과 공유 텍스처는 보존된다',async()=>{
 await MeshoptDecoder.ready;let made=0,exceptions=0,maxTriangles=0;
 const texture={name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new T.Texture())};
 for(const [key,p] of Object.entries(FACE_PROFILES)){
  const b=readFileSync(`public/aqua/models/fish/${key}.glb`),root=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(()=>texture as never).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,'')).scene;
  let mesh:T.SkinnedMesh|null=null;root.traverse(o=>{if(o instanceof T.SkinnedMesh&&!mesh)mesh=o;});assert.ok(mesh,key);const body=mesh as T.SkinnedMesh,original=body.material,buffer=Array.from(body.geometry.attributes.position.array);
  const sourceGeometry=body.geometry,face=createFishFace(root,p.family,key);
  if(p.mode==='none'){assert.equal(face,null,key);exceptions++;}
  else{assert.ok(face,key);made++;maxTriangles=Math.max(maxTriangles,face.triangles);assert.ok(face.triangles<3000,key);assert.equal(createFishFace(root,p.family,key),face);assert.ok(faceJaw(root),key);
   let mapDisposed=false;const source=(Array.isArray(original)?original[0]:original) as T.MeshStandardMaterial;source.map?.addEventListener('dispose',()=>{mapDisposed=true;});
   const oldNormals=sourceGeometry.attributes.normal,newNormals=body.geometry.attributes.normal;
   for(let i=0;i<oldNormals.count;i++){const before=new T.Vector3().fromBufferAttribute(oldNormals,i),after=new T.Vector3().fromBufferAttribute(newNormals,i);if(before.length()>.1)assert.ok(before.normalize().dot(after.normalize())>.97,`${key}: preserve authored smooth normal ${i}`);}
   const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};(body.material as T.Material).onBeforeCompile(shader as never,{} as never);assert.match(shader.vertexShader,/jawWeight/);assert.match(shader.vertexShader,/faceOpen/);assert.notEqual(body.geometry,sourceGeometry);
   for(let i=0;i<12;i++){face.setBite(i/12);face.animate(i*.2);root.updateMatrixWorld(true);assert.ok(face.root.matrixWorld.elements.every(Number.isFinite),key);const mouth=new T.Vector3();assert.equal(faceMouth(root,mouth),true,key);assert.ok(mouth.toArray().every(Number.isFinite),key);assert.ok(mouth.distanceTo(face.root.localToWorld(face.mouth.clone()))<1e-6,key);}
   face.root.traverse(o=>{if(o instanceof T.Mesh){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)assert.ok([a.getX(i),a.getY(i),a.getZ(i)].every(Number.isFinite),key);}});
   disposeFishFace(root);disposeFishFace(root);assert.equal(body.material,original,key);assert.equal(body.geometry,sourceGeometry,key);assert.equal(faceJaw(root),null);assert.equal(mapDisposed,false,key);}
  assert.deepEqual(Array.from(body.geometry.attributes.position.array),buffer,key);
  const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);if(o instanceof T.SkinnedMesh)o.skeleton.dispose();}});gs.forEach(g=>g.dispose());ms.forEach(m=>{(m as T.MeshStandardMaterial).map?.dispose();m.dispose();});
 }
 assert.equal(made,362);assert.equal(exceptions,19);assert.ok(maxTriangles>0);
});
test('관형 입·부리·아래쪽 입·기존 치열은 서로 다른 해부 구조로 처리한다',()=>{
 assert.equal(facialAnatomy('seahorse','seahorse').tube,true);assert.equal(facialAnatomy('swordfish','swordfish').bill,true);assert.equal(facialAnatomy('great_white','great_white').shark,true);assert.equal(facialAnatomy('manta','oceanic_manta').ventral,true);assert.equal(facialAnatomy('anglerfish','anglerfish').nativeDentition,true);assert.equal(facialAnatomy('rising','imugi_fish').fantasy,true);
});
