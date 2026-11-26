// 갑각류(게 · 바닷가재) 3D — 2026-11-18 [사용자: "토종물고기 보다는 갑각류를 추가하자"]
// 기준 그림: NOAA Fisheries 등쪽(위에서 본) 일러스트 — 미국 연방정부 저작물이라 퍼블릭 도메인(design/aqua3d-review/crabs/reference).
// 위에서 본 그림을 '둥글게' 부풀린다: 깊이 = √(d·(2R − d)) — d 는 가장자리에서 떨어진 거리, R 은 그 둘레의 가장 굵은 반폭.
//   다리 · 집게처럼 가는 곳은 단면이 둥근 관이 되고, 넓은 등딱지는 낮은 돔(DOME 배)이 된다 — 옆모습 판(relief)과 달리 어느 쪽에서 봐도 입체다(ART-GUIDE 검수 규칙 2).
// 다리는 몸 가운데에서 멀어질수록 바닥으로 처진다(끝이 바닥을 짚는다). 그림을 위 · 아래에 입힌다(아래는 조금 옅게 — 배 쪽).
// 게임 규칙: 머리(그림의 위) = +X, 위 = +Y, 길이 2, 뼈 10개 — 몸통 spine_0, 왼쪽 다리 fin_L(→ tip), 오른쪽 다리 fin_R(→ tip). 저장 전 updateMatrixWorld(bindpose.test).
// 2026-11-18 다리마다 따로 걷기(src/lib/aqua3d/crabwalk.ts 의 CRAB_ART — 다리 가운데 선 표): 다른 다리끼리 맞닿은 칸을 자르고, 그림에서 위 다리에 가려진
//   아래 다리 자리에 그 다리의 둥근 관을 한 겹 더 깔고(채움), 정점마다 다리 번호를 _AQUA_PART(uint8 ×4, +1 · 0 = 몸통)로 굽는다. 표가 .ts 라 Node 22.6+ 의 타입 지우기로 돈다(이 저장소는 Node 25).
// node design/aqua3d-review/crab-build.mjs <key> <reference.png> [dome .42] [droop .55] [rotate 0]
import * as T from 'three';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
import {compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {material,distance} from './relief-build.mjs';
import {CRAB_ART,crabFamilyOf,crabLabeler,lineProject} from '../../src/lib/aqua3d/crabwalk.ts';

export async function crabGLB(key,ref,{dome=.42,droop=.55,tint=null,targetTris=7000,alpha=1,source='NOAA Fisheries dorsal illustration (public domain)',belly=.45,zmul=null}={}){
 const {data,info}=await sharp(ref).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height;
 if(tint)for(let i=0;i<W*H;i++)for(let c=0;c<3;c++)data[i*4+c]=Math.round(data[i*4+c]*(1-tint.k)+tint.rgb[c]*tint.k);
 const mask=new Uint8Array(W*H);for(let i=0;i<W*H;i++)mask[i]=data[i*4+3]>60?1:0;
 const D=distance(mask,W,H);
 // 둘레의 가장 굵은 반폭 R — 반경 = 자기 거리의 1.6배 + 3 안의 최대 거리(가는 다리는 그 다리의 반폭, 등딱지는 큰 값)
 const R=new Float32Array(W*H);{const step=2;for(let y=0;y<H;y+=1)for(let x=0;x<W;x+=1){const i=y*W+x;if(!mask[i])continue;const w=Math.ceil(D[i]*1.6+3);let m=D[i];for(let yy=Math.max(0,y-w);yy<=Math.min(H-1,y+w);yy+=step)for(let xx=Math.max(0,x-w);xx<=Math.min(W-1,x+w);xx+=step){const v=D[yy*W+xx];if(v>m)m=v;}R[i]=m;}}
 // 가장 굵은 곳 = 등딱지 가운데
 let cx=0,cy=0,rmax=0;for(let i=0;i<W*H;i++)if(D[i]>rmax){rmax=D[i];cx=i%W;cy=Math.floor(i/W);}
 const rc=rmax; // 등딱지 반지름(대충)
 const zOf=(x,y)=>{const i=y*W+x,d=D[i],r=Math.max(d,R[i]),z=Math.sqrt(Math.max(0,d*(2*r-d)));const zz=r>rc*.45?z*dome:z;return zmul?zz*zmul(x,y):zz;};
 const sag=(x,y)=>{const r=Math.hypot(x-cx,y-cy);return -droop*Math.max(0,r-rc*1.05)*.42;};// 등딱지 밖은 멀어질수록 처진다
 // 격자(2px) 앞 · 뒤면 + 가장자리 띠
 const step=2,cols=Math.floor(W/step),rows=Math.floor(H/step),id=new Int32Array(cols*rows).fill(-1),P=[],UV=[],SIDE=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=c*step,y=r*step;if(!mask[y*W+x])continue;id[r*cols+c]=P.length/3;P.push(x,y,zOf(x,y));UV.push(x/W,y/H*.5);}
 // 다리 사이 자르기(2026-11-18) — 게임이 다리마다 따로 걷게 한다(src/lib/aqua3d/crabwalk.ts). 그림에서 다리끼리 겹친 곳(대게의 발끝마디가 옆 다리 위)은
 // 메시가 한 장이라 다리마다 따로 움직이면 그 사이가 막처럼 늘어난다 → 같은 표(다리 가운데 선)로 칸의 네 꼭짓점이 서로 다른 다리면 그 칸을 비운다.
 // 다리와 몸통 사이 · 움직이지 않는 부속(바닷가재 더듬이)과의 사이는 자르지 않는다(붙어 있어야 한다). 비운 칸의 가장자리는 아래 가장자리 띠가 막는다
 // 다리마다 반폭 — 가운데 선을 따라 1px 마다 거리 지도(D)를 재고, 앞뒤 8px 안의 가장 작은 값(다른 다리와 겹친 곳은 거리 지도가 부풀어 있다)
 const art=CRAB_ART[crabFamilyOf(key)??''],lab=new Int16Array(cols*rows).fill(-1);
 const radius=art?art.parts.map(part=>{const L=part.line,smp=[];let acc=0;for(let k=1;k<L.length;k++){const [ax,ay]=L[k-1],[bx,by]=L[k],seg=Math.hypot(bx-ax,by-ay);for(let u=0;u<seg;u++){const x=Math.round(ax+(bx-ax)*u/seg),y=Math.round(ay+(by-ay)*u/seg);smp.push([acc+u,x>=0&&y>=0&&x<W&&y<H?D[y*W+x]:0]);}acc+=seg;}return smp;}):[];
 const radiusAt=(j,s)=>{let m=Infinity;for(const [t,d]of radius[j])if(Math.abs(t-s)<=8&&d>0&&d<m)m=d;return Number.isFinite(m)?m:2;};
 const label=art?crabLabeler(art,radiusAt):null;
 if(label)for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(id[r*cols+c]>=0)lab[r*cols+c]=label(c*step,r*step).part;
 // 부스러기 없애기 — 다른 다리 칸 한가운데 홀로 남은 작은 조각(같은 다리 칸이 8개 아래)은 둘레에 가장 많은 다리로 바꾼다.
 // 그대로 두면 잘린 채 제 다리를 따라 움직여, 다리끼리 벌어질 때 공중에 뜬 부스러기처럼 보였다
 if(art){const seen=new Uint8Array(cols*rows);for(let g0=0;g0<cols*rows;g0++){if(seen[g0]||lab[g0]<0)continue;const L=lab[g0],grp=[g0],nb=new Map();seen[g0]=1;for(let h=0;h<grp.length;h++){const g=grp[h],r=Math.floor(g/cols),c=g%cols;for(const [dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){const rr=r+dr,cc=c+dc;if(rr<0||cc<0||rr>=rows||cc>=cols)continue;const k=rr*cols+cc;if(id[k]<0)continue;if(lab[k]===L){if(!seen[k]){seen[k]=1;grp.push(k);}}else if(lab[k]>=0)nb.set(lab[k],(nb.get(lab[k])||0)+1);}}
  if(grp.length<8&&nb.size){let best=-1,bn=0;for(const [k,v]of nb)if(v>bn){bn=v;best=k;}for(const g of grp)lab[g]=best;}}}
 const torn=(...k)=>{let p=-1;for(const i of k){const l=lab[i];if(l<0||art.parts[l].kind==='still')continue;if(p>=0&&l!==p)return true;p=l;}return false;};
 const quads=cut=>{const f=[];for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=id[r*cols+c],b=id[r*cols+c+1],d=id[(r+1)*cols+c],e=id[(r+1)*cols+c+1],n=(a>=0)+(b>=0)+(d>=0)+(e>=0);if(cut&&torn(r*cols+c,r*cols+c+1,(r+1)*cols+c,(r+1)*cols+c+1))continue;if(n===4)f.push(a,d,b,b,d,e);else if(n===3){const v=[a,b,e,d].filter(k=>k>=0);f.push(v[0],v[2],v[1]);}}return f;};
 // 작은 섬 빼기(가장 큰 덩어리의 2% 아래) — 자르기 전 메시로 정한다(자르며 떨어진 다리 조각 — 옆 다리에 가려 끊긴 발끝 — 은 버리지 않는다. 그 다리의 채움이 잇는다)
 const front=quads(true);
 {const all=quads(false),par=new Int32Array(P.length/3).map((_,i)=>i),fd=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;};for(let k=0;k<all.length;k+=3){const a=fd(all[k]),b=fd(all[k+1]),c=fd(all[k+2]);par[a]=c;par[b]=c;}const cnt=new Map();for(let k=0;k<all.length;k+=3){const r=fd(all[k]);cnt.set(r,(cnt.get(r)||0)+1);}const big=Math.max(...cnt.values()),keep=[];for(let k=0;k<front.length;k+=3)if(cnt.get(fd(front[k]))>=big*.02)keep.push(front[k],front[k+1],front[k+2]);front.length=0;for(const v of keep)front.push(v);}
const PART=[];for(let i=0;i<P.length/3;i++)PART.push(-1);for(let g=0;g<cols*rows;g++)if(id[g]>=0)PART[id[g]]=lab[g];
 // 가려진 다리 채우기(2026-11-18) — 그림에서 위에 얹힌 다리 밑의 다리는 그림에 없다. 자른 채로 두면 위 다리가 비켜설 때 아래 다리에 구멍이 보인다.
 // 그 자리(다른 다리 칸인데 이 다리 가운데 선에서 이 다리 반폭 안)에 이 다리의 둥근 관(높이 √(r² − d²))을 한 겹 더 깐다 — 그림은 같은 자리(위 다리 빛깔)를 쓴다.
 // 반폭 r 은 위의 radiusAt(겹친 곳의 부푼 거리는 앞뒤 최솟값으로 걸러진다). 이 다리 칸으로 한 칸 더 넓혀 이음매가 안 벌어지게
 if(art)art.parts.forEach((part,j)=>{
  if(part.kind==='still')return;
  const rAt=s=>radiusAt(j,s);
  const inP=new Uint8Array(cols*rows),zP=new Float32Array(cols*rows);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const g=r*cols+c;if(id[g]<0||lab[g]<0||lab[g]===j||art.parts[lab[g]].kind==='still')continue;const q=lineProject(part.line,c*step,r*step),rr=rAt(q.s);if(q.d<=rr-.5){inP[g]=1;zP[g]=Math.sqrt(Math.max(0,rr*rr-q.d*q.d))*.97;}}
  for(let r=1;r<rows-1;r++)for(let c=1;c<cols-1;c++){const g=r*cols+c;if(id[g]<0||lab[g]!==j||inP[g])continue;let near=false;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(inP[g+dr*cols+dc]===1)near=true;if(near){const q=lineProject(part.line,c*step,r*step),rr=rAt(q.s);inP[g]=2;zP[g]=Math.sqrt(Math.max(0,rr*rr-q.d*q.d))*.97;}}
  const pid=new Int32Array(cols*rows).fill(-1);for(let g=0;g<cols*rows;g++)if(inP[g]){pid[g]=P.length/3;const x=(g%cols)*step,y=Math.floor(g/cols)*step;P.push(x,y,zP[g]);UV.push(x/W,y/H*.5);PART.push(j);}
  for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=pid[r*cols+c],b=pid[r*cols+c+1],d=pid[(r+1)*cols+c],e=pid[(r+1)*cols+c+1],n=(a>=0)+(b>=0)+(d>=0)+(e>=0);if(n===4)front.push(a,d,b,b,d,e);else if(n===3){const v=[a,b,e,d].filter(k=>k>=0);front.push(v[0],v[2],v[1]);}}
 });
 const nv=P.length/3;for(let i=0;i<nv;i++){P.push(P[i*3],P[i*3+1],-P[i*3+2]);UV.push(UV[i*2],UV[i*2+1]+.5);PART.push(PART[i]);}
 const I=[];for(let k=0;k<front.length;k+=3){I.push(front[k],front[k+1],front[k+2]);I.push(front[k]+nv,front[k+2]+nv,front[k+1]+nv);}
 const edges=new Map();for(let k=0;k<front.length;k+=3)for(let e=0;e<3;e++){const a=front[k+e],b=front[k+(e+1)%3],kk=a<b?a+','+b:b+','+a;edges.set(kk,(edges.get(kk)||0)+1);}
 for(let k=0;k<front.length;k+=3)for(let e=0;e<3;e++){const a=front[k+e],b=front[k+(e+1)%3],kk=a<b?a+','+b:b+','+a;if(edges.get(kk)===1)I.push(a,a+nv,b,b,a+nv,b+nv);}
 // 처짐은 앞 · 뒷면에 똑같이(모양이 휘어 내려간다)
 for(let i=0;i<P.length/3;i++){const x=P[i*3],y=P[i*3+1];P[i*3+2]+=sag(Math.round(x),Math.round(y));}
 // 줄이기 · 안 쓰는 꼭짓점 빼기
 const pos=new Float32Array(P),[simp]=MeshoptSimplifier.simplify(new Uint32Array(I),pos,3,Math.min(I.length,targetTris*3),.008,[]);
 const remap=new Int32Array(pos.length/3).fill(-1),P2=[],U2=[],I2=[],K2=[];let n2=0;for(const v of simp){if(remap[v]<0){remap[v]=n2++;P2.push(pos[v*3],pos[v*3+1],pos[v*3+2]);U2.push(UV[v*2],UV[v*2+1]);K2.push(PART[v]);}I2.push(remap[v]);}
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
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(out,3));g.setAttribute('uv',new T.Float32BufferAttribute(U2,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Wt,4));
 // 다리 번호(+1, 0 = 몸통 · 어느 다리도 아님) — 게임이 _aqua_part 로 읽어 다리마다 따로 걷게 한다(crabwalk.ts). 가려진 다리 채움도 제 다리 번호
 if(art){const A=new Uint8Array(n2*4);for(let i=0;i<n2;i++)A[i*4]=K2[i]>=0?K2[i]+1:0;g.setAttribute('aquaPart',new T.BufferAttribute(A,4));}g.setIndex(I2);g.computeVertexNormals();
 // 텍스처: 위 반 = 그림(등), 아래 반 = 같은 그림을 옅게(배)
 const near=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let qa=0,qb=0;for(let i=0;i<W*H;i++)if(data[i*4+3]>160){near[i]=i;q[qb++]=i;}while(qa<qb){const i=q[qa++],x=i%W;for(const j of[i-W,i+W,...(x?[i-1]:[]),...(x<W-1?[i+1]:[])])if(j>=0&&j<W*H&&near[j]<0){near[j]=near[i];q[qb++]=j;}}
 const top=Buffer.alloc(W*H*3),bot=Buffer.alloc(W*H*3);for(let i=0;i<W*H;i++)for(let c=0;c<3;c++){const v=data[near[i]*4+c];top[i*3+c]=v;bot[i*3+c]=Math.round(v*(1-belly)+232*belly);}
 const half=async b=>sharp(b,{raw:{width:W,height:H,channels:3}}).resize(512,256,{fit:'fill'}).raw().toBuffer();
 const atlas=Buffer.concat([await half(top),await half(bot)]),png=await sharp(atlas,{raw:{width:512,height:512,channels:3}}).png().toBuffer();
 const glb=await compressGLB(material(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'reference-rounded-crustacean',source,bodyCrossSection:'round inflation'}}],png,bones),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.pbrMetallicRoughness.metallicFactor=.05;m.pbrMetallicRoughness.roughnessFactor=alpha<1?.25:.6;if(alpha<1){m.alphaMode='BLEND';m.pbrMetallicRoughness.baseColorFactor=[1,1,1,alpha];}}),{webpQuality:92});
 return {glb,tris:I2.length/3};}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){const [key,ref,dm,dr]=process.argv.slice(2);const {glb,tris}=await crabGLB(key,ref,{dome:dm?+dm:.42,droop:dr?+dr:.55});await writeFile(`design/aqua3d-review/crabs/${key}.glb`,glb);console.log(key,tris,'tris',glb.length,'bytes');}
