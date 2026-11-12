import test from 'node:test';
import assert from 'node:assert/strict';
import {anatomy,bendProfile,swimAngles,stepSwim,swimClock} from './anatomy.ts';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {prepareFishSource,fishMotion} from './glb.ts';

test('곰치·전기뱀장어·미꾸라지·주름상어는 전신 파동, 곰치의 없는 가슴지느러미는 움직이지 않는다',()=>{
 for(const family of ['moray','electric_eel','loach','frilled_shark']){
  const p=bendProfile(family);assert.ok(p.lag>=.9);assert.ok(p.amp[1]>.05);assert.ok(p.amp[5]>p.amp[1]);
  const out=new Float32Array(10);swimAngles(p,1.2,{amp:1},out);assert.ok([...out].every(Number.isFinite));
 }
 assert.equal(bendProfile('moray').fin,0);
});
test('청새치·황새치·바라쿠다는 꼬리 추진, 거북복은 몸통을 유지하고 지느러미로 추진한다',()=>{
 for(const family of ['marlin','swordfish','barracuda']){const p=bendProfile(family);assert.ok(p.amp[5]>p.amp[1]*10);}
 for(const family of ['boxfish','sunfish','seahorse']){const p=bendProfile(family);assert.ok(p.amp[2]<.01);assert.ok(p.fin>=.2);assert.ok(p.curl<=.2);}
});
test('새 어종도 속도가 바뀌는 순간 위상이 되감기거나 튀지 않고 포즈는 유한하다',()=>{
 for(const family of ['moray','boxfish','marlin']){
  const a=anatomy(family,family),p=bendProfile(family),c=swimClock(),out=new Float32Array(10);let t=0,last=0;
  for(let k=0;k<300;k++){const effort=k<150?.4:1.2;t+=effort/60;stepSwim(c,a,p,t,1/60,{effort});assert.ok(c.beat>=last&&c.beat-last<.2);last=c.beat;swimAngles(p,c.beat,{turn:Math.sin(k*.03),amp:1},out);assert.ok([...out].every(Number.isFinite));}
 }
});
test('입체 V3 자산에는 예전 평면판용 탑뷰·UV 보정을 다시 적용하지 않는다',()=>{
 const mesh=new T.SkinnedMesh(new T.SphereGeometry(.3,16,40),new T.MeshStandardMaterial());
 mesh.userData.aquaGeometry='closed-volume-v3';const root=new T.Bone();mesh.add(root);mesh.bind(new T.Skeleton([root]));
 const n=mesh.geometry.attributes.position.count;mesh.geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(n*4),4));
 const w=new Float32Array(n*4);for(let i=0;i<n;i++)w[i*4]=1;mesh.geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));
 const positions=Array.from(mesh.geometry.attributes.position.array),uv=Array.from(mesh.geometry.attributes.uv.array);
 prepareFishSource(mesh,'boxfish');assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),positions);assert.deepEqual(Array.from(mesh.geometry.attributes.uv.array),uv);assert.equal(mesh.geometry.userData.aquaTop,undefined);
 mesh.geometry.dispose();(mesh.material as T.Material).dispose();
});
test('저장된 V3 GLB에 실제 게임의 수영·회전 함수를 적용해도 UV 보존, 정점 유한, 몸 변형이 유지된다',async()=>{
 await MeshoptDecoder.ready;
 const texture={name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new T.Texture())};
 for(const key of ['moray','fry_moray','boxfish','shiri','marlin','frilled_shark']){
  const b=readFileSync(`public/aqua/models/fish/${key}.glb`),gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(()=>texture as never).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,'');
  const scene=gltf.scene;let mesh:T.SkinnedMesh|null=null;scene.traverse(o=>{if(o instanceof T.SkinnedMesh)mesh=o;});assert.ok(mesh,key);const m=mesh as T.SkinnedMesh;
  assert.equal(m.userData.aquaGeometry,'closed-volume-v3',key);const uv=Array.from(m.geometry.attributes.uv.array);prepareFishSource(scene,key);assert.deepEqual(Array.from(m.geometry.attributes.uv.array),uv,key);
  const rest=new T.Vector3();m.getVertexPosition(200,rest);const animate=fishMotion(scene,key.replace(/^fry_/,''),key);let travel=0;
  for(let frame=0;frame<90;frame++){
   animate(frame/60,1,{dt:1/60,speed:.6,effort:1,turn:Math.sin(frame*.05)*.8});scene.updateMatrixWorld(true);m.skeleton.update();
   for(let i=0;i<m.geometry.attributes.position.count;i+=23){const v=m.getVertexPosition(i,new T.Vector3());assert.ok([v.x,v.y,v.z].every(Number.isFinite),`${key}/${frame}/${i}`);}
   travel=Math.max(travel,m.getVertexPosition(200,new T.Vector3()).distanceTo(rest));
  }
  assert.ok(travel>.001,`${key}: deformation ${travel}`);m.skeleton.dispose();m.geometry.dispose();for(const mat of Array.isArray(m.material)?m.material:[m.material]){(mat as T.MeshStandardMaterial).map?.dispose();mat.dispose();}
 }
});
