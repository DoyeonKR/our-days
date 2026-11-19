// 새우류 다시 짓기 — 2026-11-17 [사용자: "새우들 탑뷰에서 확인해봐. 지금 다 무너지는 그래픽이야"]
// 앞 판(relief-build 의 fishReliefGLB — 옆모습 윤곽을 앞뒤로 부풀린 판)은 옆에서만 원화와 같고 위에서 보면 납작한 판에 옆면 그림이 늘어져 무너져 보였다.
// 몸통 = 원화에서 자동으로 잰 중심선(열마다 가장자리에서 가장 먼 점) · 굵기로 지은 둥근 관(단면 높이 r, 폭 0.85r), 그림을 관 둘레로 굽는다(황룡어와 같은 길).
// 다리 · 더듬이 · 꼬리부채 = 몸통 밖의 얇은 부분만 얇게 부풀려, 몸 양옆(관 반지름의 절반 바깥)으로 두 벌 — 위에서 보면 몸 양쪽으로 뻗는다.
// 뼈 10개(spine_0 머리 → spine_5 꼬리)에 x 로 나눠 묶고, 저장 전에 뼈 world 행렬을 계산한다(bindpose.test).
// node design/aqua3d-review/shrimp-tube-build.mjs <key...>  (옛 shrimp-build.mjs 는 처음 새우 모델을 만든 그림 세션 스크립트 — 그대로 둔다)
import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {loadArt,relief,material,distance} from './relief-build.mjs';
async function build(key){const art=await loadArt(`public/aqua/fish/${key}.webp`),{data,W,H}=art,A=45;
 const mask=new Uint8Array(W*H);for(let i=0;i<W*H;i++)mask[i]=data[i*4+3]>A?1:0;const dist=distance(mask,W,H);
 // 열마다 중심선(가장 깊은 점)과 반두께
 const cy=new Float32Array(W).fill(NaN),rr=new Float32Array(W);for(let x=0;x<W;x++){let best=0,by=-1;for(let y=0;y<H;y++){const d=dist[y*W+x];if(d>best){best=d;by=y;}}if(by>=0){cy[x]=by;rr[x]=best;}}
 // 몸통 = 반두께가 가장 굵은 곳의 18% 넘는 열 중 가장 긴 이어진 구간(더듬이 · 다리 끝은 얇아서 빠진다)
 let rmax=0;for(let x=0;x<W;x++)rmax=Math.max(rmax,rr[x]);let best=[0,0],s0=-1;for(let x=0;x<=W;x++){const on=x<W&&rr[x]>rmax*.18;if(on&&s0<0)s0=x;if(!on&&s0>=0){if(x-s0>best[1]-best[0])best=[s0,x-1];s0=-1;}}
 const [bx0,bx1]=best;const sm=(arr,i,w)=>{let s=0,n=0;for(let k=-w;k<=w;k++){const j=Math.min(bx1,Math.max(bx0,i+k));if(Number.isFinite(arr[j])){s+=arr[j];n++;}}return s/n;};
 const C=new Float32Array(W),Rr=new Float32Array(W);for(let x=bx0;x<=bx1;x++){C[x]=sm(cy,x,7);Rr[x]=sm(rr,x,5)*1.08;}
 // 텍스처: 위 반 = 관 둘레로 굽은 몸 · 아래 반 = 원화(다리 · 더듬이가 원화 자리의 색을 쓴다). 투명한 곳은 가장 가까운 색
 const near=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let qa=0,qb=0;for(let i=0;i<W*H;i++)if(data[i*4+3]>140){near[i]=i;q[qb++]=i;}while(qa<qb){const i=q[qa++],x=i%W;for(const j of[i-W,i+W,...(x?[i-1]:[]),...(x<W-1?[i+1]:[])])if(j>=0&&j<W*H&&near[j]<0){near[j]=near[i];q[qb++]=j;}}
 const px=(x,y)=>{x=Math.max(0,Math.min(W-1,Math.round(x)));y=Math.max(0,Math.min(H-1,Math.round(y)));const k=near[y*W+x]*4;return [data[k],data[k+1],data[k+2]];};
 const atlas=Buffer.alloc(512*512*3);for(let v=0;v<256;v++)for(let u=0;u<512;u++){const x=bx0+(bx1-bx0)*u/511,phi=v/255*Math.PI*2,xi=Math.round(x);atlas.set(px(x,C[xi]-Math.cos(phi)*Rr[xi]*.92),(v*512+u)*3);}
 const ref=await sharp(Buffer.from(Array.from({length:W*H},(_,i)=>px(i%W,Math.floor(i/W))).flat()),{raw:{width:W,height:H,channels:3}}).resize(512,256,{fit:'fill'}).raw().toBuffer();ref.copy(atlas,512*256*3);
 const png=await sharp(atlas,{raw:{width:512,height:512,channels:3}}).png().toBuffer();
 const P=[],UV=[],I=[];const vtx=(x,y,z,u,v)=>{P.push(x,y,z);UV.push(u,v);return P.length/3-1;};const refUV=(x,y)=>[x/W,(256+y/H*255)/511];
 // 몸통 관
 const N=14,step=4,rings=[];for(let x=bx0;x<=bx1;x+=step){const r=Rr[x],c=C[x],ring=[];for(let j=0;j<=N;j++){const phi=j/N*Math.PI*2;ring.push(vtx(x,c-Math.cos(phi)*r,Math.sin(phi)*r*.85,(x-bx0)/(bx1-bx0),(j/N*254+.5)/511));}rings.push(ring);}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){const a=rings[i][j],b=rings[i][j+1],c=rings[i+1][j],d=rings[i+1][j+1];I.push(a,c,b,b,c,d);}
 for(const [k,rev]of[[0,true],[rings.length-1,false]]){const x=bx0+k*step,ctr=vtx(x,C[Math.min(bx1,x)],0,(x-bx0)/(bx1-bx0),.25);for(let j=0;j<N;j++){const a=rings[k][j],b=rings[k][j+1];I.push(...(rev?[ctr,b,a]:[ctr,a,b]));}}
 // 몸 밖의 얇은 부분(다리 · 더듬이 · 꼬리부채) — 몸통 타원 안쪽 조금(뿌리)부터
 const rAt=x=>{const xi=Math.max(bx0,Math.min(bx1,Math.round(x)));return Rr[xi];},cAt=x=>C[Math.max(bx0,Math.min(bx1,Math.round(x)))];
 const outside=(x,y)=>x<bx0||x>bx1||Math.abs(y-cAt(x))>rAt(x)*.7;
 const app=relief(art,{depth:.012,round:.01,step:2,alpha:A,inside:outside,targetTris:1700});
 for(const side of[-1,1]){const base=P.length/3,n=app.P.length/3;for(let i=0;i<n;i++){const x=app.P[i*3],y=app.P[i*3+1],z=app.P[i*3+2],inBody=x>=bx0&&x<=bx1,below=inBody&&y>cAt(x),off=inBody?rAt(x)*(below?.45:.3):0;vtx(x,y,z+side*off,...refUV(x,y));}for(const k of app.I)I.push(base+k);}
 // 게임 좌표: 머리 +X(원화 오른쪽), 위 +Y, 길이 2
 const n=P.length/3,pos=new Float32Array(n*3);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(let i=0;i<n;i++){x0=Math.min(x0,P[i*3]);x1=Math.max(x1,P[i*3]);y0=Math.min(y0,P[i*3+1]);y1=Math.max(y1,P[i*3+1]);}const S=2/(x1-x0),mx=(x0+x1)/2,my=(y0+y1)/2;for(let i=0;i<n;i++){pos[i*3]=(P[i*3]-mx)*S;pos[i*3+1]=(my-P[i*3+1])*S;pos[i*3+2]=P[i*3+2]*S;}
 if(n>65535)throw Error('vertices '+n);
 const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],BX=[.75,.45,.15,-.15,-.45,-.8],bones=names.map(m=>{const b=new T.Bone();b.name=m;return b;});
 for(let i=0;i<6;i++){bones[i].position.set(i?BX[i]-BX[i-1]:BX[0],0,0);if(i)bones[i-1].add(bones[i]);}bones[1].add(bones[6]);bones[6].add(bones[7]);bones[1].add(bones[8]);bones[8].add(bones[9]);bones[6].position.set(-.1,-.04,.12);bones[7].position.set(-.12,-.05,.22);bones[8].position.set(-.1,-.04,-.12);bones[9].position.set(-.12,-.05,-.22);
 bones[0].updateMatrixWorld(true);
 const J=new Uint16Array(n*4),Wt=new Float32Array(n*4);for(let i=0;i<n;i++){const x=pos[i*3];if(x>=BX[0]){Wt[i*4]=1;continue;}let k=0;while(k<4&&x<BX[k+1])k++;const f=Math.max(0,Math.min(1,(BX[k]-x)/(BX[k]-BX[k+1])));J[i*4]=k;J[i*4+1]=k+1;Wt[i*4]=1-f;Wt[i*4+1]=f;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Wt,4));g.setIndex((()=>{/* 2026-11-19 위아래를 뒤집어(my-y) 담으면 감기 방향도 뒤집힌다 — 삼각형을 바깥으로(flip-inward.mjs 와 같은 일, facing.test) */for(let t=0;t<I.length;t+=3){const s=I[t+1];I[t+1]=I[t+2];I[t+2]=s;}return I;})());g.computeVertexNormals();
 const glb=await compressGLB(material(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'reference-traced-crustacean',source:`public/aqua/fish/${key}.webp`,bodyCrossSection:'closed ellipse'}}],png,bones),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.pbrMetallicRoughness.metallicFactor=.08;m.pbrMetallicRoughness.roughnessFactor=.55;}),{webpQuality:92});
 return {glb,tris:I.length/3,body:[bx0,bx1]};}
await mkdir('design/aqua3d-review/relief-old',{recursive:true});
for(const key of process.argv.slice(2)){const {glb,tris,body}=await build(key);if(tris>8000)throw Error(key+' tris '+tris);await writeFile(`public/aqua/models/fish/${key}.glb`,glb);console.log(key,tris,'tris',glb.length,'bytes','body',body.join('-'));}
void readFile;
