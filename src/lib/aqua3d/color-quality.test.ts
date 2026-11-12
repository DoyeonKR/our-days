import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {COLOR_FRAGMENT,MODEL_COLOR,modelColor,modelColorMaterial,modelColorTree,modelTextureQuality} from './color-quality.ts';
import {waterLit,waterLitTree} from './waterlight.ts';
import {fishShading} from './post.ts';

const shader=()=>({uniforms:{} as Record<string,unknown>,vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader});
test('무채색·흰색·검정 보존, 유색 채도 증가, 선형 휘도와 RGB 색역 보존',()=>{
 for(let i=0;i<=100;i++){const v=i/100,out=modelColor([v,v,v]);out.forEach(c=>assert.ok(Math.abs(c-v)<1e-12));}
 for(const c of [[.42,.12,.08],[.04,.22,.45],[.08,.31,.12],[.7,.5,.04],[.99,.98,.95],[.02,.025,.035]]){
  const out=modelColor(c),y=(a:readonly number[])=>a[0]*.2126+a[1]*.7152+a[2]*.0722;
  assert.ok(Math.abs(y(out)-y(c))<1e-10);assert.ok(Math.max(...out)-Math.min(...out)>=Math.max(...c)-Math.min(...c)-1e-10);assert.ok(out.every(v=>v>=0&&v<=1));
  modelColor(c,0).forEach((v,i)=>assert.ok(Math.abs(v-c[i])<1e-10));
 }
});
test('알파·재질·원본 텍스처 불변, 중복 보정 없음, 물빛·피부 셰이더와 캐시 키를 이어 붙인다',()=>{
 const map=new T.Texture(),mat=new T.MeshStandardMaterial({map,transparent:true,opacity:.43,roughness:.61,metalness:.12});
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(),mat));
 waterLitTree(root,true);modelColorTree(root);fishShading(root);modelColorMaterial(mat);waterLit(mat,true);
 const s=shader();mat.onBeforeCompile(s as never,{} as never);
 assert.equal(s.fragmentShader.split('float aqGain =').length,2);assert.ok(s.fragmentShader.includes('aquaCaustic('));assert.ok(s.fragmentShader.includes('float rim ='));assert.ok(s.fragmentShader.includes('abs(dot(normal,normalize(vViewPosition)))'));
 assert.equal(s.uniforms.aquaColorStrength,MODEL_COLOR.strength);assert.equal(mat.map,map);assert.equal(mat.opacity,.43);assert.equal(mat.transparent,true);assert.equal(mat.roughness,.61);assert.equal(mat.metalness,.12);
 assert.match(mat.customProgramCacheKey(),/model-color-v1/);assert.match(mat.customProgramCacheKey(),/fishShade1/);
 assert.ok(/^[\x00-\x7F]*$/.test(COLOR_FRAGMENT));root.children.forEach(o=>(o as T.Mesh).geometry.dispose());mat.dispose();map.dispose();
});
test('418개 GLB와 신규·기존 코드 모델을 같은 공통 물빛 진입점에서 보정한다',()=>{
 const standard=new T.MeshStandardMaterial(),physical=new T.MeshPhysicalMaterial(),basic=new T.MeshBasicMaterial();const root=new T.Group();
 for(const m of [standard,physical,basic])root.add(new T.Mesh(new T.BoxGeometry(),m));waterLitTree(root,false);
 assert.ok(standard.userData.aquaModelColor);assert.ok(physical.userData.aquaModelColor);assert.equal(basic.userData.aquaModelColor,undefined);
 root.children.forEach(o=>{(o as T.Mesh).geometry.dispose();if((o as T.Mesh).material instanceof T.Material)((o as T.Mesh).material as T.Material).dispose();});
});
test('사선 텍스처 선명도는 기기 한도와 모바일 상한 4를 넘지 않고 원본 맵을 유지한다',()=>{
 const map=new T.Texture(),m=new T.MeshStandardMaterial({map}),mesh=new T.Mesh(new T.BoxGeometry(),m);
 modelTextureQuality(mesh,16);assert.equal(map.anisotropy,4);assert.equal(m.map,map);modelTextureQuality(mesh,2);assert.equal(map.anisotropy,2);modelTextureQuality(mesh,NaN);assert.equal(map.anisotropy,1);
 mesh.geometry.dispose();m.dispose();map.dispose();
});
