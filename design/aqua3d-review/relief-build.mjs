// 기준 이미지 → 입체(부풀린 윤곽) GLB — 2026-11-17 [사용자: "기준 이미지와 비교했을때 퀄리티가 너무 떨어져 … 기준이미지와 최대한 비슷하게 업그레이드"]
// 투명 배경 그림의 윤곽을 앞뒤로 부풀린다: 깊이 = 가장자리에서 떨어진 거리의 둥근 함수(가장자리는 얇게, 가운데는 두껍게).
// 앞면 · 뒷면에 그림을 그대로 입히고 가장자리 띠로 닫는다 — 정면에서 보면 기준 이미지와 같다. 그 뒤 meshoptimizer 로 삼각형을 줄인다.
// 장식: node design/aqua3d-review/relief-build.mjs decor <key> [깊이비 .32] [둥근 반경비 .22]
import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
import {compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {parseGLB} from './glb-compress.mjs';
/** GLB 재질 고치기(packAsset 은 재질 하나) */
export function material(glb,fn){const {json,bin}=parseGLB(glb);fn(json.materials[0]);const s=Buffer.from(JSON.stringify(json)),jp=Buffer.concat([s,Buffer.alloc((4-s.length%4)%4,32)]),bp=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]),out=Buffer.alloc(28+jp.length+bp.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jp.length,12);out.writeUInt32LE(0x4e4f534a,16);jp.copy(out,20);out.writeUInt32LE(bp.length,20+jp.length);out.writeUInt32LE(0x004e4942,24+jp.length);bp.copy(out,28+jp.length);return out;}
export async function loadArt(file,size=512){const {data,info}=await sharp(file).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,W:info.width,H:info.height};}
// 투명한 곳은 가장 가까운 불투명 색 — 가장자리에서 배경색이 번지지 않게
export async function fillTexture({data,W,H},out=512,seedAlpha=200){const near=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let a=0,b=0;for(let i=0;i<W*H;i++)if(data[i*4+3]>seedAlpha){near[i]=i;q[b++]=i;}while(a<b){const i=q[a++],x=i%W;for(const j of[i-W,i+W,...(x?[i-1]:[]),...(x<W-1?[i+1]:[])])if(j>=0&&j<W*H&&near[j]<0){near[j]=near[i];q[b++]=j;}}const rgb=Buffer.alloc(W*H*3);for(let i=0;i<W*H;i++)rgb.set(data.subarray(near[i]*4,near[i]*4+3),i*3);return sharp(rgb,{raw:{width:W,height:H,channels:3}}).resize(out,out,{fit:'fill'}).png().toBuffer();}
// 거리(3-4 챔퍼) — 픽셀 단위
export function distance(mask,W,H){const d=new Float32Array(W*H);for(let i=0;i<W*H;i++)d[i]=mask[i]?1e9:0;const at=(x,y)=>x<0||y<0||x>=W||y>=H?0:d[y*W+x];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!d[i])continue;d[i]=Math.min(d[i],at(x-1,y)+1,at(x,y-1)+1,at(x-1,y-1)+1.4142,at(x+1,y-1)+1.4142);}for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(!d[i])continue;d[i]=Math.min(d[i],at(x+1,y)+1,at(x,y+1)+1,at(x+1,y+1)+1.4142,at(x-1,y+1)+1.4142);}return d;}
/** 그림 픽셀 좌표(x 오른쪽, y 아래) 의 입체: positions(x, y, z 픽셀 단위) · uv · index
 *  depth: 가장 두꺼운 곳의 반두께(그림 폭 대비) · round: 가장자리 둥근 반경(그림 폭 대비) · inside(x,y): 쓸 영역(없으면 전부) */
export function relief({data,W,H},{depth=.32,round=.22,step=2,alpha=110,inside=null,targetTris=7000,zScale=null}={}){
 const mask=new Uint8Array(W*H);let x0=W,x1=0,y0=H,y1=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const on=data[(y*W+x)*4+3]>alpha&&(!inside||inside(x,y));mask[y*W+x]=on?1:0;if(on){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
 const bw=x1-x0+1,dist=distance(mask,W,H),R=round*bw,D=depth*bw;
 const prof=d=>{const t=Math.min(1,d/R);return Math.sqrt(Math.max(0,1-(1-t)*(1-t)));};
 const cols=Math.floor((x1-x0)/step)+2,rows=Math.floor((y1-y0)/step)+2,id=new Int32Array(cols*rows).fill(-1),P=[],UV=[],I=[];
 const gx=c=>x0+c*step,gy=r=>y0+r*step,on=(c,r)=>{const x=gx(c),y=gy(r);return x>=0&&y>=0&&x<W&&y<H&&mask[y*W+x];};
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(on(c,r)){const x=gx(c),y=gy(r),z=D*prof(dist[y*W+x])*(zScale?zScale(x,y):1);id[r*cols+c]=P.length/3;P.push(x,y,z);UV.push(x/W,y/H);}
 const front=[];for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=id[r*cols+c],b=id[r*cols+c+1],d=id[(r+1)*cols+c],e=id[(r+1)*cols+c+1],n=(a>=0)+(b>=0)+(d>=0)+(e>=0);if(n===4){front.push(a,d,b,b,d,e);}else if(n===3){const v=[a,b,e,d].filter(k=>k>=0);front.push(v[0],v[2],v[1]);}}
 // 작은 섬 빼기 — 가장 큰 덩어리의 2% 보다 작은 조각(반투명 더듬이 끊긴 토막 등)은 몸에 안 붙어 떠 보이므로 버린다
 {const par=new Int32Array(P.length/3).map((_,i)=>i),fd=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;};for(let k=0;k<front.length;k+=3){const a=fd(front[k]),b=fd(front[k+1]),c=fd(front[k+2]);par[a]=c;par[b]=c;}const cnt=new Map();for(let k=0;k<front.length;k+=3){const r=fd(front[k]);cnt.set(r,(cnt.get(r)||0)+1);}const big=Math.max(...cnt.values()),keep=[];for(let k=0;k<front.length;k+=3)if(cnt.get(fd(front[k]))>=big*.02)keep.push(front[k],front[k+1],front[k+2]);front.length=0;front.push(...keep);}
 // 뒷면 = 앞면 꼭짓점의 z 를 뒤집은 복사(뒤에서 보면 그림이 거울처럼)
 const nv=P.length/3;for(let i=0;i<nv;i++){P.push(P[i*3],P[i*3+1],-P[i*3+2]);UV.push(UV[i*2],UV[i*2+1]);}
 for(let k=0;k<front.length;k+=3){I.push(front[k],front[k+1],front[k+2]);I.push(front[k]+nv,front[k+2]+nv,front[k+1]+nv);}
 // 가장자리 띠 — 한 번만 쓰인 변
 const edges=new Map();for(let k=0;k<front.length;k+=3)for(let e=0;e<3;e++){const a=front[k+e],b=front[k+(e+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}
 for(let k=0;k<front.length;k+=3)for(let e=0;e<3;e++){const a=front[k+e],b=front[k+(e+1)%3],key=a<b?a+','+b:b+','+a;if(edges.get(key)===1)I.push(a,a+nv,b,b,a+nv,b+nv);}
 // 줄이기 — 모양 오차 1% 안
 const pos=new Float32Array(P),idx=new Uint32Array(I),[simp]=MeshoptSimplifier.simplify(idx,pos,3,Math.min(idx.length,targetTris*3),.01,[]);
 const remap=new Int32Array(pos.length/3).fill(-1),P2=[],U2=[],I2=new Uint32Array(simp.length);let nv2=0;for(let k=0;k<simp.length;k++){const v=simp[k];if(remap[v]<0){remap[v]=nv2++;P2.push(pos[v*3],pos[v*3+1],pos[v*3+2]);U2.push(UV[v*2],UV[v*2+1]);}I2[k]=remap[v];}if(nv2>65535)throw Error('too many vertices '+nv2);
 return {P:new Float32Array(P2),UV:new Float32Array(U2),I:I2,box:{x0,x1,y0,y1,bw}};}
// 픽셀 좌표 → 게임 좌표(그림 위 = +Y, 오른쪽 = +X, 앞 = +Z), 바닥 0 · 가운데 0
export function toGeometry({P,UV,I,box},{rotateToX=false}={}){const g=new T.BufferGeometry(),n=P.length/3,pos=new Float32Array(n*3),cx=(box.x0+box.x1)/2;for(let i=0;i<n;i++){const x=(P[i*3]-cx)/box.bw*2,y=(box.y1-P[i*3+1])/box.bw*2,z=P[i*3+2]/box.bw*2;if(rotateToX){pos[i*3]=y;pos[i*3+1]=-x;pos[i*3+2]=z;}else{pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;}}
 g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.BufferAttribute(UV,2));g.setIndex(new T.BufferAttribute(I,1));const used=new Set(I);void used;g.computeVertexNormals();return g;}
export async function decorGLB(key,{depth=.32,round=.22}={}){const art=await loadArt(`public/aqua/decor/${key}.webp`),r=relief(art,{depth,round}),g=toGeometry(r);
 // 정적 장식: 뼈 없이 한 메시 — packAsset 은 뼈를 받으니 뿌리 뼈 하나에 다 묶는다(움직이지 않는다)
 
 const png=await fillTexture(art);const glb=await compressGLB(material(packAsset(key,[{name:'static_ornament',geometry:g,extras:{aquaGeometry:'reference-relief',source:`public/aqua/decor/${key}.webp`}}],png,null),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.pbrMetallicRoughness.metallicFactor=.08;m.pbrMetallicRoughness.roughnessFactor=.76;}),{webpQuality:92});return {glb,tris:r.I.length/3};}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){const [kind,key,dp,rd]=process.argv.slice(2);if(kind==='decor'){await mkdir('design/aqua3d-review/relief-old',{recursive:true});const file=`public/aqua/models/decor/${key}.glb`;try{await readFile(`design/aqua3d-review/relief-old/${key}.glb`);}catch{await writeFile(`design/aqua3d-review/relief-old/${key}.glb`,await readFile(file));}
 const {glb,tris}=await decorGLB(key,{depth:dp?+dp:.32,round:rd?+rd:.22});await writeFile(file,glb);console.log(key,tris,'tris',glb.length,'bytes');}}
// 물고기 규격 입체(2026-11-17 새우류) — 원화(옆모습 · 머리 오른쪽)를 부풀리고 뼈 10개(spine_0 머리 → spine_5 꼬리)에 x 로 나눠 묶는다
// ⚠ 쓰지 마라(2026-11-17) — 옆모습 판을 부풀린 몸은 옆에서만 원화와 같고 위에서 보면 무너진다(새우 9종이 그랬다). 몸통은 둥근 관(shrimp-tube-build · golden-build)으로.
export async function fishReliefGLB(key,{depth=.13,round=.07,alpha=110}={}){if(!process.env.ALLOW_FLAT_FISH)throw Error('fishReliefGLB: 물고기 · 갑각류 몸통에 판 부풀리기 금지 — design/ART-GUIDE.md 의 3D 모델 검수 규칙');const art=await loadArt(`public/aqua/fish/${key}.webp`),r=relief(art,{depth,round,alpha,targetTris:7000}),g=toGeometry(r);
 const p=g.attributes.position,n=p.count;let y0=1e9,y1=-1e9,x0=1e9,x1=-1e9;for(let i=0;i<n;i++){y0=Math.min(y0,p.getY(i));y1=Math.max(y1,p.getY(i));x0=Math.min(x0,p.getX(i));x1=Math.max(x1,p.getX(i));}const cy=(y0+y1)/2;for(let i=0;i<n;i++)p.setY(i,p.getY(i)-cy);
 const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],BX=[.75,.45,.15,-.15,-.45,-.8],bones=names.map(m=>{const b=new T.Bone();b.name=m;return b;});
 for(let i=0;i<6;i++){bones[i].position.set(i?BX[i]-BX[i-1]:BX[0],0,0);if(i)bones[i-1].add(bones[i]);}bones[1].add(bones[6]);bones[6].add(bones[7]);bones[1].add(bones[8]);bones[8].add(bones[9]);bones[6].position.set(-.1,-.04,.12);bones[7].position.set(-.12,-.05,.22);bones[8].position.set(-.1,-.04,-.12);bones[9].position.set(-.12,-.05,-.22);
 bones[0].updateMatrixWorld(true); // 기준 자세 — 안 하면 바인드가 단위 행렬로 저장돼 뼈를 입히는 순간 몸이 뼈마다 밀린다
 const J=new Uint16Array(n*4),W=new Float32Array(n*4);for(let i=0;i<n;i++){const x=p.getX(i);if(x>=BX[0]){W[i*4]=1;continue;}let k=0;while(k<4&&x<BX[k+1])k++;const f=Math.max(0,Math.min(1,(BX[k]-x)/(BX[k]-BX[k+1])));J[i*4]=k;J[i*4+1]=k+1;W[i*4]=1-f;W[i*4+1]=f;}
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(W,4));g.computeVertexNormals();
 const png=await fillTexture(art),glb=await compressGLB(material(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'reference-relief-fish',source:`public/aqua/fish/${key}.webp`}}],png,bones),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.pbrMetallicRoughness.metallicFactor=.08;m.pbrMetallicRoughness.roughnessFactor=.6;}),{webpQuality:92});
 return {glb,tris:r.I.length/3};}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())&&process.argv[2]==='fish'){for(const key of process.argv.slice(3)){const file=`public/aqua/models/fish/${key}.glb`;try{await readFile(`design/aqua3d-review/relief-old/${key}.glb`);}catch{await writeFile(`design/aqua3d-review/relief-old/${key}.glb`,await readFile(file));}const {glb,tris}=await fishReliefGLB(key,{depth:.15,round:.08,alpha:45});await writeFile(file,glb);console.log(key,tris,'tris',glb.length,'bytes');}}
