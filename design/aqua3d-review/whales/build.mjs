// 고래 5종 · 톱상어 3D — mammal-tube-build.mjs 와 같은 길(원화에서 잰 중심선 · 반두께로 둥근 몸통, 앞 · 가슴지느러미는 fin 뼈). 2026-11-18
// V3(2026-11-15) 모델은 네 방향 그림에서 깎은 입체라 물개 · 바다사자 · 강치가 고개를 든 '앉은' 자세 · 날개처럼 옆으로 뻗은 앞지느러미였고,
// 원화(헤엄치는 옆모습)와 자세 · 색 · 무늬가 달랐다. 새우와 같은 길(shrimp-tube-build.mjs): 원화에서 열마다 잰 중심선 · 반두께로 둥근 몸통을 짓고
// 원화를 몸 둘레로 굽는다 — 옆에서 원화와 같고 위에서도 둥글다. 지느러미 · 다리(몸 밖의 얇은 부분)는 몸 양옆에 붙이고,
// 몸 아래 앞쪽 지느러미는 fin_L · fin_R 뼈에 묶어 물개류가 앞지느러미로 노를 젓는다(anatomy 의 OTARIID). 저장 전 updateMatrixWorld(bindpose.test).
// node design/aqua3d-review/mammal-tube-build.mjs <key...>
import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {compressGLB} from '../glb-compress.mjs';
import {packAsset} from '../shrimp-pack.mjs';
import {loadArt,relief,material,distance} from '../relief-build.mjs';
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
 const atlas=Buffer.alloc(512*512*3);for(let v=0;v<256;v++)for(let u=0;u<512;u++){const x=bx0+(bx1-bx0)*u/511,phi=v/255*Math.PI*2,xi=Math.round(x);atlas.set(px(x,C[xi]-Math.cos(phi)*Rr[xi]*.78),(v*512+u)*3);}
 const ref=await sharp(Buffer.from(Array.from({length:W*H},(_,i)=>px(i%W,Math.floor(i/W))).flat()),{raw:{width:W,height:H,channels:3}}).resize(512,256,{fit:'fill'}).raw().toBuffer();ref.copy(atlas,512*256*3);
 const png=await sharp(atlas,{raw:{width:512,height:512,channels:3}}).png().toBuffer();
 const P=[],UV=[],I=[];const vtx=(x,y,z,u,v)=>{P.push(x,y,z);UV.push(u,v);return P.length/3-1;};const refUV=(x,y)=>[x/W,(256+y/H*255)/511];
 // 몸통 관
 const N=16,step=4,rings=[];for(let x=bx0;x<=bx1;x+=step){const r=Rr[x],c=C[x],ring=[];for(let j=0;j<=N;j++){const phi=j/N*Math.PI*2;ring.push(vtx(x,c-Math.cos(phi)*r,Math.sin(phi)*r**.95,(x-bx0)/(bx1-bx0),(j/N*254+.5)/511));}rings.push(ring);}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){const a=rings[i][j],b=rings[i][j+1],c=rings[i+1][j],d=rings[i+1][j+1];I.push(a,c,b,b,c,d);}
 for(const [k,rev]of[[0,true],[rings.length-1,false]]){const x=bx0+k*step,ctr=vtx(x,C[Math.min(bx1,x)],0,(x-bx0)/(bx1-bx0),.25);for(let j=0;j<N;j++){const a=rings[k][j],b=rings[k][j+1];I.push(...(rev?[ctr,b,a]:[ctr,a,b]));}}
 // 몸 밖의 얇은 부분(다리 · 더듬이 · 꼬리부채) — 몸통 타원 안쪽 조금(뿌리)부터
 const rAt=x=>{const xi=Math.max(bx0,Math.min(bx1,Math.round(x)));return Rr[xi];},cAt=x=>C[Math.max(bx0,Math.min(bx1,Math.round(x)))];
 // 고래는 꼬리지느러미가 수평이다 — 원화(옆모습)의 꼬리 판은 빼고 아래에서 수평 꼬리를 따로 짓는다. 톱상어(상어)는 세로 꼬리 그대로
 const whale=!/sawshark/.test(key);
 const outside=(x,y)=>(whale&&x<bx0)?false:(x<bx0||x>bx1||Math.abs(y-cAt(x))>rAt(x)*1.0);
 const app=relief(art,{depth:.02,round:.015,step:2,alpha:A,inside:outside,targetTris:1500});const appStart=P.length/3,APP=[];
 for(const side of[-1,1]){const base=P.length/3,n=app.P.length/3;for(let i=0;i<n;i++){const x=app.P[i*3],y=app.P[i*3+1],z=app.P[i*3+2],inBody=x>=bx0&&x<=bx1,below=inBody&&y>cAt(x),off=inBody?rAt(x)*(below?.45:.3):0;APP.push([vtx(x,y,z+side*off,...refUV(x,y)),side,x,y]);}for(const k of app.I)I.push(base+k);}
 const mid=(bx0+bx1)/2,front=APP.filter(([, ,x,y])=>x>mid&&x<=bx1&&y>cAt(x));let fx=0,fy=0,rx=0;for(const [, ,x,y]of front){fx+=x;fy+=y;}const nf=Math.max(1,front.length);fx/=nf;fy/=nf;rx=fx+ (bx1-bx0)*.04;const rootY=cAt(rx)+rAt(rx)*.6;
 // 가슴지느러미를 몸 밖으로 벌린다(2026-11-18 — 앞에서 보면 몸 옆에 붙은 말뚝 둘이었다). 실제 고래 · 상어는 몸 옆에서 아래 · 바깥으로 비스듬히 뻗는다.
 //   몸 아래 붙는 선(가운데 + 반두께 .6)보다 아래로 나온 만큼 바깥(z)으로 옮기고 조금 들어 올린다. 상어(톱상어)는 더 수평으로
 const splayZ=whale?.85:1,splayY=whale?.4:.7,attach=x=>cAt(x)+rAt(x)*.6;
 for(const [v,side,x,y]of APP){if(!(x>mid&&x<=bx1))continue;const dy=y-attach(x);if(dy<=0)continue;P[v*3+2]+=side*dy*splayZ;P[v*3+1]-=dy*splayY;}
 // 수평 꼬리지느러미(고래) — 갈래 둘 · 가운데 홈 · 앞 가장자리는 뒤로 젖혀진다. 윗면은 등 색, 아랫면은 배 색(혹등고래는 흰 아랫면)
 if(whale){let xl=bx0;for(let x=0;x<bx0;x++){let on=false;for(let y=0;y<H;y++)if(mask[y*W+x]){on=true;break;}if(on){xl=x;break;}}
  const xr=bx0+(bx1-bx0)*.03,tl=Math.max(8,xr-xl),span=(bx1-bx0)*.115,yc=cAt(bx0),th=rAt(bx0)*.4,NA=14,NS=6,top=[],bot=[];
  const xf=a=>xr-(xr-xl)*.97*Math.pow(Math.abs(a),1.6),xb=a=>xl+tl*.3*Math.pow(1-Math.abs(a),.8);
  for(const [arr,sg,v]of[[top,-1,.5/511],[bot,1,127.5/511]])for(let i=0;i<=NA;i++){const a=-1+2*i/NA,row=[];for(let j=0;j<=NS;j++){const s=j/NS,x=xb(a)+(xf(a)-xb(a))*s,t=th*(1-Math.abs(a)*.85)*Math.sin(Math.PI*(.15+.85*s));row.push(vtx(x,yc+sg*t,a*span,.3,v));}arr.push(row);}
  for(let i=0;i<NA;i++)for(let j=0;j<NS;j++){const a=top[i][j],b=top[i][j+1],c=top[i+1][j],d=top[i+1][j+1];I.push(a,b,c,b,d,c);const e=bot[i][j],f=bot[i][j+1],g=bot[i+1][j],h=bot[i+1][j+1];I.push(e,g,f,f,g,h);}
  // 가장자리 띠(윗면 · 아랫면 이음) — 떠 있는 판이 아니라 닫힌 날개
  const rim=[];for(let i=0;i<=NA;i++)rim.push([top[i][0],bot[i][0]]);for(let j=1;j<=NS;j++)rim.push([top[NA][j],bot[NA][j]]);for(let i=NA-1;i>=0;i--)rim.push([top[i][NS],bot[i][NS]]);for(let j=NS-1;j>=1;j--)rim.push([top[0][j],bot[0][j]]);
  for(let k=0;k<rim.length;k++){const [a,b]=rim[k],[c,d]=rim[(k+1)%rim.length];I.push(a,c,b,b,c,d);}}
 // 게임 좌표: 머리 +X(원화 오른쪽), 위 +Y, 길이 2
 const n=P.length/3,pos=new Float32Array(n*3);let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(let i=0;i<n;i++){x0=Math.min(x0,P[i*3]);x1=Math.max(x1,P[i*3]);y0=Math.min(y0,P[i*3+1]);y1=Math.max(y1,P[i*3+1]);}const S=2/(x1-x0),mx=(x0+x1)/2,my=(y0+y1)/2;for(let i=0;i<n;i++){pos[i*3]=(P[i*3]-mx)*S;pos[i*3+1]=(my-P[i*3+1])*S;pos[i*3+2]=P[i*3+2]*S;}
 if(n>65535)throw Error('vertices '+n);
 const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],BX=[.75,.45,.15,-.15,-.45,-.8],bones=names.map(m=>{const b=new T.Bone();b.name=m;return b;});
 for(let i=0;i<6;i++){bones[i].position.set(i?BX[i]-BX[i-1]:BX[0],0,0);if(i)bones[i-1].add(bones[i]);}bones[1].add(bones[6]);bones[6].add(bones[7]);bones[1].add(bones[8]);bones[8].add(bones[9]);const G=(px,py,pz)=>[(px-mx)*S,(my-py)*S,pz*S],root=G(rx,rootY,0),tip=G(fx,fy,0),zr=rAt(rx)*.6*S;bones[6].position.set(root[0]-BX[1],root[1],zr);const tipOut=Math.max(0,fy-attach(fx));bones[7].position.set(tip[0]-root[0],tip[1]-root[1]+tipOut*splayY*S,zr*.4+tipOut*splayZ*S);bones[8].position.set(root[0]-BX[1],root[1],-zr);bones[9].position.set(tip[0]-root[0],tip[1]-root[1]+tipOut*splayY*S,-(zr*.4+tipOut*splayZ*S));
 bones[0].updateMatrixWorld(true);
 const finOf=new Map();for(const [v,side,x,y]of APP)if(x>mid&&x<=bx1&&y>cAt(x)){const d=Math.hypot(x-rx,y-rootY),f=Math.min(1,d/Math.max(4,Math.hypot(fx-rx,fy-rootY)*1.6));finOf.set(v,[side>0?6:8,f]);}
 const J=new Uint16Array(n*4),Wt=new Float32Array(n*4);for(let i=0;i<n;i++){const x=pos[i*3];const fb=finOf.get(i);if(fb){J[i*4]=fb[0];J[i*4+1]=fb[0]+1;Wt[i*4]=1-fb[1];Wt[i*4+1]=fb[1];continue;}if(x>=BX[0]){Wt[i*4]=1;continue;}let k=0;while(k<4&&x<BX[k+1])k++;const f=Math.max(0,Math.min(1,(BX[k]-x)/(BX[k]-BX[k+1])));J[i*4]=k;J[i*4+1]=k+1;Wt[i*4]=1-f;Wt[i*4+1]=f;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Wt,4));g.setIndex(I);g.computeVertexNormals();
 const glb=await compressGLB(material(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'reference-traced-whale',source:`public/aqua/fish/${key}.webp`,bodyCrossSection:'closed ellipse'}}],png,bones),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.pbrMetallicRoughness.metallicFactor=.08;m.pbrMetallicRoughness.roughnessFactor=.72;}),{webpQuality:92});
 return {glb,tris:I.length/3,body:[bx0,bx1]};}
for(const key of process.argv.slice(2)){const {glb,tris,body}=await build(key);if(tris>8000)throw Error(key+' tris '+tris);await writeFile(`public/aqua/models/fish/${key}.glb`,glb);console.log(key,tris,'tris',glb.length,'bytes','body',body.join('-'));}
