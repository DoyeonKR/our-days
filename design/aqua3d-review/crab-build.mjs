// 갑각류(게 · 바닷가재) 3D — 2026-11-18 [사용자: "토종물고기 보다는 갑각류를 추가하자"]
// 기준 그림: NOAA Fisheries 등쪽(위에서 본) 일러스트 — 미국 연방정부 저작물이라 퍼블릭 도메인(design/aqua3d-review/crabs/reference).
// 위에서 본 그림을 '둥글게' 부풀린다: 깊이 = √(d·(2R − d)) — d 는 가장자리에서 떨어진 거리, R 은 그 둘레의 가장 굵은 반폭.
//   다리 · 집게처럼 가는 곳은 단면이 둥근 관이 되고, 넓은 등딱지는 낮은 돔(DOME 배)이 된다 — 옆모습 판(relief)과 달리 어느 쪽에서 봐도 입체다(ART-GUIDE 검수 규칙 2).
// 다리는 몸 가운데에서 멀어질수록 바닥으로 처진다(끝이 바닥을 짚는다). 그림을 위 · 아래에 입힌다(아래는 조금 옅게 — 배 쪽).
// 게임 규칙: 머리(그림의 위) = +X, 위 = +Y, 길이 2, 뼈 10개 — 몸통 spine_0, 왼쪽 다리 fin_L(→ tip), 오른쪽 다리 fin_R(→ tip). 저장 전 updateMatrixWorld(bindpose.test).
// node design/aqua3d-review/crab-build.mjs <key> <reference.png> [dome .42] [droop .55] [rotate 0]
import * as T from 'three';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
import {compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {material,distance} from './relief-build.mjs';

export async function crabGLB(key,ref,{dome=.42,droop=.55,tint=null,targetTris=7000}={}){
 const {data,info}=await sharp(ref).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height;
 if(tint)for(let i=0;i<W*H;i++)for(let c=0;c<3;c++)data[i*4+c]=Math.round(data[i*4+c]*(1-tint.k)+tint.rgb[c]*tint.k);
 const mask=new Uint8Array(W*H);for(let i=0;i<W*H;i++)mask[i]=data[i*4+3]>60?1:0;
 const D=distance(mask,W,H);
 // 둘레의 가장 굵은 반폭 R — 반경 = 자기 거리의 1.6배 + 3 안의 최대 거리(가는 다리는 그 다리의 반폭, 등딱지는 큰 값)
 const R=new Float32Array(W*H);{const step=2;for(let y=0;y<H;y+=1)for(let x=0;x<W;x+=1){const i=y*W+x;if(!mask[i])continue;const w=Math.ceil(D[i]*1.6+3);let m=D[i];for(let yy=Math.max(0,y-w);yy<=Math.min(H-1,y+w);yy+=step)for(let xx=Math.max(0,x-w);xx<=Math.min(W-1,x+w);xx+=step){const v=D[yy*W+xx];if(v>m)m=v;}R[i]=m;}}
 // 가장 굵은 곳 = 등딱지 가운데
 let cx=0,cy=0,rmax=0;for(let i=0;i<W*H;i++)if(D[i]>rmax){rmax=D[i];cx=i%W;cy=Math.floor(i/W);}
 const rc=rmax; // 등딱지 반지름(대충)
 const zOf=(x,y)=>{const i=y*W+x,d=D[i],r=Math.max(d,R[i]),z=Math.sqrt(Math.max(0,d*(2*r-d)));return r>rc*.45?z*dome:z;};
 const sag=(x,y)=>{const r=Math.hypot(x-cx,y-cy);return -droop*Math.max(0,r-rc*1.05)*.42;};// 등딱지 밖은 멀어질수록 처진다
 // 격자(2px) 앞 · 뒤면 + 가장자리 띠
 const step=2,cols=Math.floor(W/step),rows=Math.floor(H/step),id=new Int32Array(cols*rows).fill(-1),P=[],UV=[],SIDE=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=c*step,y=r*step;if(!mask[y*W+x])continue;id[r*cols+c]=P.length/3;P.push(x,y,zOf(x,y));UV.push(x/W,y/H*.5);}
 const front=[];for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=id[r*cols+c],b=id[r*cols+c+1],d=id[(r+1)*cols+c],e=id[(r+1)*cols+c+1],n=(a>=0)+(b>=0)+(d>=0)+(e>=0);if(n===4)front.push(a,d,b,b,d,e);else if(n===3){const v=[a,b,e,d].filter(k=>k>=0);front.push(v[0],v[2],v[1]);}}
 // 작은 섬 빼기(가장 큰 덩어리의 2% 아래)
 {const par=new Int32Array(P.length/3).map((_,i)=>i),fd=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;};for(let k=0;k<front.length;k+=3){const a=fd(front[k]),b=fd(front[k+1]),c=fd(front[k+2]);par[a]=c;par[b]=c;}const cnt=new Map();for(let k=0;k<front.length;k+=3){const r=fd(front[k]);cnt.set(r,(cnt.get(r)||0)+1);}const big=Math.max(...cnt.values()),keep=[];for(let k=0;k<front.length;k+=3)if(cnt.get(fd(front[k]))>=big*.02)keep.push(front[k],front[k+1],front[k+2]);front.length=0;front.push(...keep);}
 const nv=P.length/3;for(let i=0;i<nv;i++){P.push(P[i*3],P[i*3+1],-P[i*3+2]);UV.push(UV[i*2],UV[i*2+1]+.5);}
 const I=[];for(let k=0;k<front.length;k+=3){I.push(front[k],front[k+1],front[k+2]);I.push(front[k]+nv,front[k+2]+nv,front[k+1]+nv);}
 const edges=new Map();for(let k=0;k<front.length;k+=3)for(let e=0;e<3;e++){const a=front[k+e],b=front[k+(e+1)%3],kk=a<b?a+','+b:b+','+a;edges.set(kk,(edges.get(kk)||0)+1);}
 for(let k=0;k<front.length;k+=3)for(let e=0;e<3;e++){const a=front[k+e],b=front[k+(e+1)%3],kk=a<b?a+','+b:b+','+a;if(edges.get(kk)===1)I.push(a,a+nv,b,b,a+nv,b+nv);}
 // 처짐은 앞 · 뒷면에 똑같이(모양이 휘어 내려간다)
 for(let i=0;i<P.length/3;i++){const x=P[i*3],y=P[i*3+1];P[i*3+2]+=sag(Math.round(x),Math.round(y));}
 // 줄이기 · 안 쓰는 꼭짓점 빼기
 const pos=new Float32Array(P),[simp]=MeshoptSimplifier.simplify(new Uint32Array(I),pos,3,Math.min(I.length,targetTris*3),.008,[]);
 const remap=new Int32Array(pos.length/3).fill(-1),P2=[],U2=[],I2=[];let n2=0;for(const v of simp){if(remap[v]<0){remap[v]=n2++;P2.push(pos[v*3],pos[v*3+1],pos[v*3+2]);U2.push(UV[v*2],UV[v*2+1]);}I2.push(remap[v]);}
 if(n2>65535)throw Error('vertices '+n2);
 // 게임 좌표: 그림 위(머리) → +X, 그림 오른쪽 → +Z, 높이 → +Y. 바닥(가장 낮은 곳) 0 근처 · 가운데 0 · 길이 2
 let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,h0=1e9;for(let i=0;i<n2;i++){const X=cy-P2[i*3+1],Z=P2[i*3]-cx;x0=Math.min(x0,X);x1=Math.max(x1,X);z0=Math.min(z0,Z);z1=Math.max(z1,Z);h0=Math.min(h0,P2[i*3+2]);}
 const S=2/Math.max(x1-x0,z1-z0),mx=(x0+x1)/2,mz=(z0+z1)/2,out=new Float32Array(n2*3);
 for(let i=0;i<n2;i++){out[i*3]=(cy-P2[i*3+1]-mx)*S;out[i*3+1]=P2[i*3+2]*S;out[i*3+2]=(P2[i*3]-cx-mz)*S;}
 // 뼈: 몸통 spine_0(가운데) · 다리 fin_L / fin_R(등딱지 옆) — 다리는 몸에서 멀수록 tip 쪽으로
 const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],bones=names.map(m=>{const b=new T.Bone();b.name=m;return b;});
 const rcW=rc*S;bones[0].position.set(0,0,0);for(let i=1;i<6;i++){bones[i].position.set(-.05,0,0);bones[i-1].add(bones[i]);}
 bones[0].add(bones[6]);bones[6].position.set(0,0,-rcW);bones[6].add(bones[7]);bones[7].position.set(0,-.1,-rcW);bones[0].add(bones[8]);bones[8].position.set(0,0,rcW);bones[8].add(bones[9]);bones[9].position.set(0,-.1,rcW);
 bones[0].updateMatrixWorld(true);
 const J=new Uint16Array(n2*4),Wt=new Float32Array(n2*4);for(let i=0;i<n2;i++){const x=out[i*3],z=out[i*3+2],r=Math.hypot(x,z);if(r<rcW*1.02){Wt[i*4]=1;continue;}const f=Math.min(1,(r-rcW)/(rcW*1.6)),base=z<0?6:8;J[i*4]=0;J[i*4+1]=base;J[i*4+2]=base+1;const w0=Math.max(0,1-(r-rcW)/(rcW*.25));Wt[i*4]=w0;Wt[i*4+1]=(1-w0)*(1-f);Wt[i*4+2]=(1-w0)*f;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(out,3));g.setAttribute('uv',new T.Float32BufferAttribute(U2,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Wt,4));g.setIndex(I2);g.computeVertexNormals();
 // 텍스처: 위 반 = 그림(등), 아래 반 = 같은 그림을 옅게(배)
 const near=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let qa=0,qb=0;for(let i=0;i<W*H;i++)if(data[i*4+3]>160){near[i]=i;q[qb++]=i;}while(qa<qb){const i=q[qa++],x=i%W;for(const j of[i-W,i+W,...(x?[i-1]:[]),...(x<W-1?[i+1]:[])])if(j>=0&&j<W*H&&near[j]<0){near[j]=near[i];q[qb++]=j;}}
 const top=Buffer.alloc(W*H*3),bot=Buffer.alloc(W*H*3);for(let i=0;i<W*H;i++)for(let c=0;c<3;c++){const v=data[near[i]*4+c];top[i*3+c]=v;bot[i*3+c]=Math.round(v*.55+232*.45);}
 const half=async b=>sharp(b,{raw:{width:W,height:H,channels:3}}).resize(512,256,{fit:'fill'}).raw().toBuffer();
 const atlas=Buffer.concat([await half(top),await half(bot)]),png=await sharp(atlas,{raw:{width:512,height:512,channels:3}}).png().toBuffer();
 const glb=await compressGLB(material(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'reference-rounded-crustacean',source:'NOAA Fisheries dorsal illustration (public domain)',bodyCrossSection:'round inflation'}}],png,bones),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.pbrMetallicRoughness.metallicFactor=.05;m.pbrMetallicRoughness.roughnessFactor=.6;}),{webpQuality:92});
 return {glb,tris:I2.length/3};}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){const [key,ref,dm,dr]=process.argv.slice(2);const {glb,tris}=await crabGLB(key,ref,{dome:dm?+dm:.42,droop:dr?+dr:.55});await writeFile(`design/aqua3d-review/crabs/${key}.glb`,glb);console.log(key,tris,'tris',glb.length,'bytes');}
