// 해파리 다시 짓기 — 2026-11-17 [사용자: 기준 이미지와 비교해 퀄리티가 떨어진다 → 최대한 비슷하게]
// 옛 모델은 넓은 갓 하나에 줄무늬뿐이고 기준 이미지의 늘어진 입팔 · 촉수가 없었다.
// 갓 = 기준 이미지에서 줄마다 잰 반폭으로 돌린 회전체(위가 둥근 돔 + 오목한 아랫면), 그림을 앞에서 비춰 입힌다.
// 입팔 · 촉수 = 갓 아래 그림 영역을 얇게 부풀린 판 두 장을 직각으로 엇갈려(어느 쪽에서 봐도 늘어진 다발).
// 게임 규칙: 갓 꼭대기가 +X(엔진이 세운다), 뼈 10개 — spine_0 = 갓(숨쉬기 크기), spine_1~5 = 아래로 늘어진 다발(물결)
// node design/aqua3d-review/jelly-build.mjs jellyfish [fry_jellyfish juv_jellyfish moon_jelly]
import * as T from 'three';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
import {compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {loadArt,fillTexture,relief,material} from './relief-build.mjs';
async function build(key){const art=await loadArt(`public/aqua/fish/${key}.webp`),{data,W,H}=art;
 // 줄마다 불투명 폭
 const rows=[];for(let y=0;y<H;y++){let x0=-1,x1=-1;for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]>60){if(x0<0)x0=x;x1=x;}rows.push(x0<0?null:[x0,x1]);}
 const top=rows.findIndex(r=>r),bot=H-1-[...rows].reverse().findIndex(r=>r);let ymax=top,wmax=0;for(let y=top;y<bot;y++)if(rows[y]&&rows[y][1]-rows[y][0]>wmax){wmax=rows[y][1]-rows[y][0];ymax=y;}
 let rim=ymax;while(rim<bot&&rows[rim]&&rows[rim][1]-rows[rim][0]>.62*wmax)rim++;
 const cx=(rows[ymax][0]+rows[ymax][1])/2,half=y=>{const r=rows[Math.round(y)];return r?Math.max(1,(r[1]-r[0])/2):1;};
 const P=[],UV=[],I=[],ROLE=[];const push=(x,y,z,role)=>{P.push(x,y,z);UV.push(Math.min(1,Math.max(0,x/W)),Math.min(1,Math.max(0,y/H)));ROLE.push(role);return P.length/3-1;};
 // 갓 바깥: 꼭대기 → 가장자리
 const A=36,K=26,outer=[];for(let k=0;k<=K;k++){const y=top+(rim-top)*k/K,r=k===0?0:half(y);const ring=[];for(let a=0;a<A;a++){const t=a/A*Math.PI*2;ring.push(push(cx+Math.cos(t)*r,y,Math.sin(t)*r,'bell'));}outer.push(ring);}
 // 갓 아랫면: 가장자리 → 가운데로 오목하게 올라간다(두께)
 const inner=[],M=8,rimR=half(rim),lift=(rim-top)*.32;for(let k=1;k<=M;k++){const f=k/M,r=rimR*(1-f)*.96,y=rim-lift*Math.sin(f*Math.PI/2);const ring=[];for(let a=0;a<A;a++){const t=a/A*Math.PI*2;ring.push(push(cx+Math.cos(t)*r,y,Math.sin(t)*r,'bell'));}inner.push(ring);}
 const strip=(r1,r2,flip)=>{for(let a=0;a<A;a++){const b=(a+1)%A,p=r1[a],q=r1[b],s=r2[a],t=r2[b];if(flip)I.push(p,q,s,q,t,s);else I.push(p,s,q,q,s,t);}};
 for(let k=0;k<K;k++)strip(outer[k],outer[k+1],false);strip(outer[K],inner[0],false);for(let k=0;k<M-1;k++)strip(inner[k],inner[k+1],false);
 // 입자루 — 갓 아랫면 가운데에서 입팔 뿌리까지 잇는 기둥(갓과 입팔이 떠 보이지 않게)
 {const y0=rim-lift*.95,y1=rim+(bot-rim)*.32,r0=rimR*.5,r1=rimR*.42,S=12,L=6,rr=[];for(let k=0;k<=L;k++){const f=k/L,y=y0+(y1-y0)*f,r=r0+(r1-r0)*f,ring=[];for(let a=0;a<S;a++){const t=a/S*Math.PI*2;ring.push(push(cx+Math.cos(t)*r,y,Math.sin(t)*r,'hang'));}rr.push(ring);}for(let k=0;k<L;k++)for(let a=0;a<S;a++){const b=(a+1)%S;I.push(rr[k][a],rr[k][b],rr[k+1][a],rr[k][b],rr[k+1][b],rr[k+1][a]);}}
 // 입팔 · 촉수: 가장자리 조금 위부터 아래 그림 — 판 두 장(앞뒤 · 좌우)
 const hang=relief(art,{depth:.05,round:.04,step:2,alpha:35,inside:(x,y)=>y>rim-(rim-top)*.3&&Math.abs(x-cx)<rimR*(y<rim?.55:9),targetTris:2600});
 // 입팔 묶음을 갓 안쪽(오목한 아랫면 속)까지 끌어올린다 — 그림의 갓 바로 아래가 반투명이라 입팔이 갓에서 떨어져 시작했다(2026-11-17 [사용자: "다리와 몸통이 분리되어있잖아"])
 {let ty=1e9;for(const v of hang.I)ty=Math.min(ty,hang.P[v*3+1]);const want=rim-lift*.55,sh=ty-want;if(sh>0)for(let i=1;i<hang.P.length;i+=3)hang.P[i]-=sh;}
 for(const turn of[false,true]){const base=P.length/3,n=hang.P.length/3;for(let i=0;i<n;i++){const x=hang.P[i*3],y=hang.P[i*3+1],z=hang.P[i*3+2],dx=x-cx;// 갓 안쪽으로 조금 감춘다
   if(turn)push(cx+z,y,dx,'hang');else push(x,y,z,'hang');UV[UV.length-2]=hang.UV[i*2];UV[UV.length-1]=hang.UV[i*2+1];}for(const k of hang.I)I.push(base+k);}
 // 게임 좌표: 갓 꼭대기 +X, 길이 2(전체 높이 기준) — 몸길이는 엔진이 선 키(y)로 잰다
 const n=P.length/3,span=bot-top,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(top+span/2-P[i*3+1])/span*2;pos[i*3+1]=-(P[i*3]-cx)/span*2;pos[i*3+2]=P[i*3+2]/span*2;}
 // 뼈: spine_0 = 갓 가운데, 그 아래로 다발을 따라
 const xBell=(top+span/2-(top+rim)/2)/span*2,xRim=(top+span/2-rim)/span*2,xEnd=-1,names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'];
 const BX=[xBell,xRim,xRim+(xEnd-xRim)*.25,xRim+(xEnd-xRim)*.5,xRim+(xEnd-xRim)*.75,xEnd],bones=names.map(m=>{const b=new T.Bone();b.name=m;return b;});
 for(let i=0;i<6;i++){bones[i].position.set(i?BX[i]-BX[i-1]:BX[0],0,0);if(i)bones[i-1].add(bones[i]);}for(const [c,p]of[[6,0],[8,0]]){bones[p].add(bones[c]);bones[c].add(bones[c+1]);bones[c+1].position.set(-.05,0,0);}
 // 뼈의 기준 자세를 계산해 둔다 — 안 하면 packAsset 이 단위 행렬을 바인드로 저장해, 게임에서 뼈를 입히는 순간 입팔이 그 뼈 자리만큼 밀려 갓과 떨어졌다(2026-11-17)
 bones[0].updateMatrixWorld(true);
 const J=new Uint16Array(n*4),Wt=new Float32Array(n*4);for(let i=0;i<n;i++){const x=pos[i*3];if(ROLE[i]==='bell'){J[i*4]=0;Wt[i*4]=1;continue;}let k=1;while(k<5&&x<BX[k+1])k++;const f=Math.max(0,Math.min(1,(BX[k]-x)/(BX[k]-BX[Math.min(5,k+1)]||1)));J[i*4]=k;J[i*4+1]=Math.min(5,k+1);Wt[i*4]=1-f;Wt[i*4+1]=f;}
 if(n>65535)throw Error('too many vertices');const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Wt,4));g.setIndex(I);g.computeVertexNormals();
 // 갓 · 입팔의 반투명한 곳은 해파리 몸빛(옅은 흰 파랑) 바탕에 겹쳐 굽는다 — 투명한 그대로 두거나 물빛으로 칠하면 갓 아랫부분 · 입자루가 물속에서 안 보여 입팔이 갓과 떨어져 보였다
 const png=await (await import('sharp')).default(`public/aqua/fish/${key}.webp`).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).flatten({background:'#c6d8e4'}).png().toBuffer(),glb=await compressGLB(material(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'reference-jelly-revolve',source:`public/aqua/fish/${key}.webp`}}],png,bones),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.alphaMode='BLEND';m.pbrMetallicRoughness.baseColorFactor=[1,1,1,.62];m.pbrMetallicRoughness.metallicFactor=.08;m.pbrMetallicRoughness.roughnessFactor=.76;}),{webpQuality:92});
 return {glb,tris:I.length/3};}
const keys=process.argv.slice(2);await mkdir('design/aqua3d-review/relief-old',{recursive:true});
for(const key of keys){const file=`public/aqua/models/fish/${key}.glb`;try{await readFile(`design/aqua3d-review/relief-old/${key}.glb`);}catch{await writeFile(`design/aqua3d-review/relief-old/${key}.glb`,await readFile(file));}const {glb,tris}=await build(key);if(tris>8000)throw Error(key+' tris '+tris);await writeFile(file,glb);console.log(key,tris,'tris',glb.length,'bytes');}
void MeshoptSimplifier;
