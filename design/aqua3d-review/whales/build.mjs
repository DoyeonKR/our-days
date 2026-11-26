// 고래 5종 · 톱상어 3D — mammal-tube-build.mjs 와 같은 길(원화에서 잰 중심선 · 반두께로 둥근 몸통, 앞 · 가슴지느러미는 fin 뼈). 2026-11-18
// V3(2026-11-15) 모델은 네 방향 그림에서 깎은 입체라 물개 · 바다사자 · 강치가 고개를 든 '앉은' 자세 · 날개처럼 옆으로 뻗은 앞지느러미였고,
// 원화(헤엄치는 옆모습)와 자세 · 색 · 무늬가 달랐다. 새우와 같은 길(shrimp-tube-build.mjs): 원화에서 열마다 잰 중심선 · 반두께로 둥근 몸통을 짓고
// 원화를 몸 둘레로 굽는다 — 옆에서 원화와 같고 위에서도 둥글다. 지느러미 · 다리(몸 밖의 얇은 부분)는 몸 양옆에 붙이고,
// 몸 아래 앞쪽 지느러미는 fin_L · fin_R 뼈에 묶어 물개류가 앞지느러미로 노를 젓는다(anatomy 의 OTARIID). 저장 전 updateMatrixWorld(bindpose.test).
// 톱상어(2026-11-20) [사용자: "쏠배감펭이랑 톱상어도 업그레이드해"] — 톱 주둥이가 몸 옆에 붙인 얇은 판이라 위에서 보면 선 하나였다. 이제 납작하고 넓은 칼날(옆 반폭 = 위아래 반두께의 3.2 → 2.2 배)
//   양옆 가장자리에 길고 짧은 이빨이 번갈아 22쌍, 머리는 앞 18% 에서 옆으로 1.45 배까지 납작하게. 옛 모델은 design/aqua3d-review/sawshark/old
// node design/aqua3d-review/whales/build.mjs <key...>
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
 const bx0=best[0];let bx1=best[1];const sm=(arr,i,w)=>{let s=0,n=0;for(let k=-w;k<=w;k++){const j=Math.min(bx1,Math.max(bx0,i+k));if(Number.isFinite(arr[j])){s+=arr[j];n++;}}return s/n;};
 const C=new Float32Array(W),Rr=new Float32Array(W);for(let x=bx0;x<=bx1;x++){C[x]=sm(cy,x,7);Rr[x]=sm(rr,x,5)*1.08;}
 // 향유고래 머리(2026-11-22 [사용자: "지금 향유고래 앞머리 아니 대가리가 아예 그려지지않았어 … 대가리 기준이미지 보내줄테니까 참고해서 모델 그려"])
 //   몸 두께를 '가장자리에서 떨어진 거리'로 재면, 앞면이 수직으로 끊긴 네모 머리는 앞쪽 열이 전부 얇게 재져 몸통(18% 문턱)에서 빠지고 얇은 판으로만 남았다 — 게임에선 둥글게 깎인 코였다.
 //   머리 구간(몸 앞 34%)은 그 열의 세로 폭(위 · 아래 끝)으로 재고 몸통을 그림의 진짜 앞끝까지 늘린다. 단면은 네모에 가까운 둥근 사각(아래 spermBox) — 크고 뭉툭한 머리. 기준 사진 · 피규어는 비율만 보고 그림은 쓰지 않았다(저작권).
 const sperm=/sperm_whale/.test(key);let headX0=Infinity;
 if(sperm){let front=bx1;for(let x=bx1;x<W;x++){for(let y=0;y<H;y++)if(mask[y*W+x]){front=x;break;}}
  const run=x=>{let bt=-1,bb=-1,t=-1;for(let y=0;y<=H;y++){const on=y<H&&mask[y*W+x];if(on&&t<0)t=y;if(!on&&t>=0){if(y-1-t>bb-bt)[bt,bb]=[t,y-1];t=-1;}}return [bt,bb];};
  headX0=Math.round(front-(front-bx0)*.34);const blend=(front-bx0)*.08;
  for(let x=headX0-Math.round(blend);x<=front;x++){const [t,b]=run(x);if(t<0)continue;const w=Math.min(1,Math.max(0,(x-(headX0-blend))/blend)),c=(t+b)/2,r=(b-t)/2*.97;
   const c0=x<=bx1?C[x]:c,r0=x<=bx1?Rr[x]:r;C[x]=c0+(c-c0)*w;Rr[x]=Math.max(r0*(1-w),r0+(r-r0)*w);}
  bx1=front;}
 // 머리 크기 — 아래 spermGeo(2026-11-23). 예전 머리 가중치(1.32배 · 몸길이 6% 안에서 켜짐)는 이음매에 계단을 냈다
 if(!sperm&&!/sawshark/.test(key)){let front=bx1;for(let x=bx1;x<W;x++){for(let y=0;y<H;y++)if(mask[y*W+x]){front=x;break;}}
  // 2026-11-23 [사용자: "이런것들이 또 있나 검토해봐 고래류에 많을 것 같은데"] — 빠진 주둥이 끝은 그 열의 세로 폭(위 · 아래 끝)으로 잰다. 뾰족한 주둥이라 그대로 가늘어진다
  for(let x=bx1+1;x<=front;x++){let t=-1,b=-1,bt=-1,bb=-1;for(let y=0;y<=H;y++){const on=y<H&&mask[y*W+x];if(on&&t<0)t=y;if(!on&&t>=0){if(y-1-t>bb-bt)[bt,bb]=[t,y-1];t=-1;}}if(bt<0)continue;C[x]=(bt+bb)/2;Rr[x]=Math.max(.8,(bb-bt)/2*.95);}
  bx1=front;}
 // 향유고래 머리 · 몸 이음(2026-11-23) [사용자: "대가리와 몸통부분이 자연스럽게 이어지지않아"] — 위 머리 가중치가 몸길이 6% 안에서 0 → 1 로 뛰어
 //   이음매 바로 뒤가 잘록하고(허리) 곧바로 아랫선이 몸 두께의 3할만큼 떨어졌다(윗선은 오히려 앞으로 갈수록 내려갔다) — 통나무에 네모 상자를 씌운 모양.
 //   이제 윗선은 등에서 머리 끝까지 거의 수평(조금 높게), 아랫선은 몸 가운데(xm)부터 머리 앞(xh)까지 긴 smoothstep 으로 깊어지고,
 //   단면(둥근 → 둥근 사각) · 옆폭도 같은 곡선으로 풀린다. 앞끝은 아래 모서리를 둥글리고, 앞면은 고리 열(타원 곡선 — 깊이는 머리 반높이의 0.32)으로 오므려 둥근 이마로(예전엔 납작한 원판 — 정면에서 통 뚜껑처럼 보였다). 선은 넓은 창으로 고르게(그림의 주름 결이 몸 테두리를 울퉁불퉁하게 했다)
 const SPERM_DEEP=+(process.env.SPERM_DEEP??.3),SPERM_LIFT=+(process.env.SPERM_LIFT??.05),SPERM_HW=+(process.env.SPERM_HW??.8);
 let spermGeo=null,spermCapX=0;
 if(sperm){const L=bx1-bx0,xm=bx0+L*+(process.env.SPERM_XM??.3),xh=headX0+L*.04,xr=bx1-L*.075,T0=new Float32Array(W),B0=new Float32Array(W);
  for(let x=bx0;x<=bx1;x++){let a=0,b=0,n=0;for(let k=-12;k<=12;k++){const j=Math.min(bx1,Math.max(bx0,x+k));a+=C[j]-Rr[j];b+=C[j]+Rr[j];n++;}T0[x]=a/n;B0[x]=b/n;}
  const im=Math.round(xm),tm=T0[im],bm=B0[im],hb=bm-tm,ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  spermGeo=x=>{const xi=Math.max(bx0,Math.min(bx1,Math.round(x))),s=ss(xm,xh,x),t=Math.min(1,Math.max(0,(x-xr)/(bx1-xr)));
   let top=x<xm?T0[xi]:tm-hb*SPERM_LIFT*s,bot=x<xm?B0[xi]:bm+hb*SPERM_DEEP*s;const hh=bot-top;bot-=hh*.34*t*t;top+=hh*.07*t*t*t;
   const ry=(bot-top)/2,rzT=Math.max(.5,(B0[xi]-T0[xi])/2)**.95,rz=rzT+(ry*SPERM_HW-rzT)*s;return {cy:(top+bot)/2,ry,rz,ex:2/(2+1.2*s)};};}
 // 텍스처: 위 반 = 관 둘레로 굽은 몸 · 아래 반 = 원화(다리 · 더듬이가 원화 자리의 색을 쓴다). 투명한 곳은 가장 가까운 색
 const near=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let qa=0,qb=0;for(let i=0;i<W*H;i++)if(data[i*4+3]>140){near[i]=i;q[qb++]=i;}while(qa<qb){const i=q[qa++],x=i%W;for(const j of[i-W,i+W,...(x?[i-1]:[]),...(x<W-1?[i+1]:[])])if(j>=0&&j<W*H&&near[j]<0){near[j]=near[i];q[qb++]=j;}}
 const px=(x,y)=>{x=Math.max(0,Math.min(W-1,Math.round(x)));y=Math.max(0,Math.min(H-1,Math.round(y)));const k=near[y*W+x]*4;return [data[k],data[k+1],data[k+2]];};
 const atlas=Buffer.alloc(512*512*3);for(let v=0;v<256;v++)for(let u=0;u<512;u++){const x=bx0+(bx1-bx0)*u/511,phi=v/255*Math.PI*2,xi=Math.round(x);atlas.set(px(x,C[xi]-Math.cos(phi)*Rr[xi]*.78),(v*512+u)*3);}
 const ref=await sharp(Buffer.from(Array.from({length:W*H},(_,i)=>px(i%W,Math.floor(i/W))).flat()),{raw:{width:W,height:H,channels:3}}).resize(512,256,{fit:'fill'}).raw().toBuffer();ref.copy(atlas,512*256*3);
 // 향유고래 색(2026-11-23) [사용자: "올리브빛 색"] — 원화는 거의 무채색 짙은 회색(평균 54 · 52 · 52)인데 수조의 따뜻한 빛 · 청록 테두리가 얹히면 국방색(올리브)으로 보였다.
 //   바탕 그림만 푸른 회색 쪽으로 기울인다(R ×.86 · G ×.95 · B ×1.2, 밝기는 거의 그대로) — 셰이더 · 다른 고래는 그대로
 if(sperm&&!process.env.SPERM_NOTINT)for(let i=0;i<atlas.length;i+=3){atlas[i]=Math.min(255,atlas[i]*.86);atlas[i+1]=Math.min(255,atlas[i+1]*.95);atlas[i+2]=Math.min(255,atlas[i+2]*1.2);}
 const png=await sharp(atlas,{raw:{width:512,height:512,channels:3}}).png().toBuffer();
 const P=[],UV=[],I=[];const vtx=(x,y,z,u,v)=>{P.push(x,y,z);UV.push(u,v);return P.length/3-1;};const refUV=(x,y)=>[x/W,(256+y/H*255)/511];
 // 몸통 관
 // 톱상어(2026-11-20) — 머리는 위아래로 납작하고 옆으로 넓다(앞 18% 에서 옆 폭을 1.45 배까지)
 // 남극 물고기(2026-11-25) — 단면은 둥근 타원(지수 1). 고래 기본값 2 는 위아래 · 옆이 뾰족한 마름모 단면이다
 const fishKey=/toothfish|icefish/.test(key);
 const sawKey=/sawshark/.test(key),headK=x=>sawKey?1+.45*Math.max(0,Math.min(1,(x-(bx1-(bx1-bx0)*.18))/((bx1-bx0)*.18)))**1.5:1;
 const N=16,step=4,rings=[];for(let x=bx0;x<=bx1;x+=step){const r=Rr[x],c=C[x],ring=[];for(let j=0;j<=N;j++){const phi=j/N*Math.PI*2;const g=spermGeo?.(x),ex=g?g.ex:fishKey?1:2,cs=Math.cos(phi),sn=Math.sin(phi),ys=Math.sign(cs)*Math.abs(cs)**ex,zs=Math.sign(sn)*Math.abs(sn)**ex;ring.push(vtx(x,g?g.cy-ys*g.ry:c-ys*r,g?zs*g.rz:zs*r**.95*headK(x),(x-bx0)/(bx1-bx0),(j/N*254+.5)/511));}rings.push(ring);}
 if(sperm){const xl=bx0+(rings.length-1)*step,gl=spermGeo(Math.min(bx1,xl));for(const [dx,k]of[.25,.42,.56,.68,.78,.86,.92,.96,.985,.997].map(t=>[t*gl.ry*.32,(1-t**2.4)**(1/2.4)])){spermCapX=xl+dx;const ring=[];for(let j=0;j<=N;j++){const phi=j/N*Math.PI*2,cs=Math.cos(phi),sn=Math.sin(phi),ex=gl.ex;ring.push(vtx(xl+dx,gl.cy-Math.sign(cs)*Math.abs(cs)**ex*gl.ry*k,Math.sign(sn)*Math.abs(sn)**ex*gl.rz*k,.95,(j/N*254+.5)/511));}rings.push(ring);}
  // 아래턱 — 머리 밑에 가늘고 긴 막대(앞끝은 머리 앞면보다 조금 뒤), 위쪽 절반은 머리 속에 묻혀 떠 있지 않다. 색은 그림의 입가(머리 아래 밝은 줄)
  {const hl=bx1-headX0,j0=headX0+hl*.12,j1=bx1-hl*.07,NJ=10,jr=[],mUV=refUV(bx1-hl*.25,C[Math.round(bx1-hl*.25)]+Rr[Math.round(bx1-hl*.25)]*.85);
   for(let x=j0;x<=j1+1e-6;x+=(j1-j0)/12){const xi=Math.round(Math.min(bx1,x)),r0=Rr[xi],gj=spermGeo(x),bottom=gj.cy+gj.ry,t=(x-j0)/(j1-j0),ry=r0*.16*(t<.85?1:1-(t-.85)/.15*.5),rz=r0*.34*(1-.35*t),cy0=bottom-ry*.45,ring=[];
    for(let j=0;j<=NJ;j++){const phi=j/NJ*Math.PI*2;ring.push(vtx(x,cy0-Math.cos(phi)*ry,Math.sin(phi)*rz,...mUV));}jr.push(ring);}
   for(let i=0;i<jr.length-1;i++)for(let j=0;j<NJ;j++){const a=jr[i][j],b=jr[i][j+1],c=jr[i+1][j],d=jr[i+1][j+1];I.push(a,c,b,b,c,d);}
   for(const [k,rev]of[[0,true],[jr.length-1,false]]){const ring=jr[k],cx=P[ring[0]*3],cyy=(P[ring[0]*3+1]+P[ring[NJ/2]*3+1])/2,ctr=vtx(cx,cyy,0,...mUV);for(let j=0;j<NJ;j++)I.push(...(rev?[ctr,ring[j+1],ring[j]]:[ctr,ring[j],ring[j+1]]));}}}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){const a=rings[i][j],b=rings[i][j+1],c=rings[i+1][j],d=rings[i+1][j+1];I.push(a,c,b,b,c,d);}
 for(const [k,rev]of[[0,true],[rings.length-1,false]]){const x=k===rings.length-1&&sperm?spermCapX:bx0+k*step,ctr=vtx(x,spermGeo?spermGeo(Math.min(bx1,x)).cy:C[Math.min(bx1,x)],0,Math.min(sperm?.95:1,(x-bx0)/(bx1-bx0)),sperm&&k?.5/511:.25);for(let j=0;j<N;j++){const a=rings[k][j],b=rings[k][j+1];I.push(...(rev?[ctr,b,a]:[ctr,a,b]));}}
 // 몸 밖의 얇은 부분(다리 · 더듬이 · 꼬리부채) — 몸통 타원 안쪽 조금(뿌리)부터
 const rAt=x=>{const xi=Math.max(bx0,Math.min(bx1,Math.round(x)));return Rr[xi];},cAt=x=>C[Math.max(bx0,Math.min(bx1,Math.round(x)))];
 // 고래는 꼬리지느러미가 수평이다 — 원화(옆모습)의 꼬리 판은 빼고 아래에서 수평 꼬리를 따로 짓는다. 톱상어(상어)는 세로 꼬리 그대로
 // 남극 물고기 둘(2026-11-25 — 메로 · 남극빙어, polar/ref-art.mjs 의 퍼블릭 도메인 기준 그림)도 톱상어처럼 세로 꼬리지느러미 그대로
 const whale=!/sawshark|toothfish|icefish/.test(key);
 // 톱 주둥이(톱상어) — 몸통 앞(bx1)부터 원화 끝까지, 열마다 가장 굵은 줄기(거리 변환의 능선 ± 반두께 1.6)는 납작한 칼날로 따로 짓는다. 수염 · 이빨 선은 판 그대로
 let sawTip=bx1;if(sawKey)for(let x=bx1;x<W;x++)if(rr[x]>.8)sawTip=x;
 const SC=new Float32Array(W),SR=new Float32Array(W);if(sawKey){for(let x=bx1;x<=sawTip;x++){let a=0,b=0,n=0;for(let k=-4;k<=4;k++){const j=Math.max(bx1,Math.min(sawTip,x+k));if(rr[j]>0){a+=cy[j];b+=rr[j];n++;}}SC[x]=n?a/n:cAt(bx1);SR[x]=n?b/n:1;}}
 const inSaw=(x,y)=>sawKey&&x>bx1&&x<=sawTip&&Math.abs(y-SC[Math.round(x)])<=SR[Math.round(x)]*1.6;
 const outside=(x,y)=>(whale&&x<bx0)?false:!inSaw(x,y)&&(x<bx0||x>bx1||Math.abs(y-cAt(x))>rAt(x)*1.0);
 const app=relief(art,{depth:.02,round:.015,step:2,alpha:A,inside:outside,targetTris:1500});const appStart=P.length/3,APP=[];
 for(const side of[-1,1]){const base=P.length/3,n=app.P.length/3;for(let i=0;i<n;i++){const x=app.P[i*3],y=app.P[i*3+1],z=app.P[i*3+2],inBody=x>=bx0&&x<=bx1,below=inBody&&y>cAt(x),off=inBody&&below?rAt(x)*.45:0;APP.push([vtx(x,y,z+side*off,...refUV(x,y)),side,x,y]);}for(const k of app.I)I.push(base+k);}
 const mid=(bx0+bx1)/2,front=APP.filter(([, ,x,y])=>x>mid&&x<=bx1&&y>cAt(x));let fx=0,fy=0,rx=0;for(const [, ,x,y]of front){fx+=x;fy+=y;}const nf=Math.max(1,front.length);fx/=nf;fy/=nf;rx=fx+ (bx1-bx0)*.04;let rootY=cAt(rx)+rAt(rx)*.6;
 // 향유고래 가슴지느러미(2026-11-23) [사용자: "젓가락 가슴지느러미"] — 원화의 지느러미는 머리 밑 작은 얼룩이라 거의 안 보였고, 정면에서 보이던 '젓가락'은 종잇장 같은 꼬리지느러미 옆선이었다.
 //   머리 바로 뒤 몸 아래쪽 양옆에 작은 노(길이 몸의 7%, 폭 3%, 두께는 폭의 3할)를 뒤 · 아래 · 바깥으로 비스듬히 단다. 뿌리 반쯤은 몸 속에 묻는다. fin 뼈를 이 노에 맞춘다
 const PAD=[];
 if(sperm){const L=bx1-bx0,xp=headX0-L*.035,g0=spermGeo(xp),lp=L*.07,wp=L*.03,tp=wp*.3,d0=[-.62,.5,.6],dl=Math.hypot(...d0),d=d0.map(v=>v/dl);
  let a0=[1,0,0];const ad=a0[0]*d[0];a0=a0.map((v,i)=>v-ad*d[i]);const al=Math.hypot(...a0);const ax=a0.map(v=>v/al),nv=[d[1]*ax[2]-d[2]*ax[1],d[2]*ax[0]-d[0]*ax[2],d[0]*ax[1]-d[1]*ax[0]];
  const pUV=[(xp-bx0)/(bx1-bx0),(N/2*254/N*.5+.5)/511],NU=8,NV=6;
  for(const side of[-1,1]){const root=[xp,g0.cy+g0.ry*.5,side*g0.rz*.72],grid=[[],[]];
   for(let i=0;i<=NU;i++){const u=i/NU,w=Math.sin(Math.PI*(.12+.88*u))**.6*(1-.35*u)*(u<.12?.6+u/.12*.4:1);for(let j=0;j<=NV;j++){const v=-1+2*j/NV,t=tp*w*Math.sqrt(Math.max(0,1-v*v));
     for(const [h,sg]of[[0,1],[1,-1]]){const q=[0,1,2].map(c=>root[c]+(c===2?side:1)*(d[c]*u*lp+ax[c]*v*wp*w)+(c===2?side:1)*nv[c]*t*sg);const id=vtx(q[0],q[1],q[2],...pUV);grid[h].push(id);PAD.push([id,side,u]);}}}
   const at=(h,i,j)=>grid[h][i*(NV+1)+j];
   for(let i=0;i<NU;i++)for(let j=0;j<NV;j++){const q=[at(0,i,j),at(0,i,j+1),at(0,i+1,j),at(0,i+1,j+1)],r=[at(1,i,j),at(1,i,j+1),at(1,i+1,j),at(1,i+1,j+1)];
    if(side>0){I.push(q[0],q[2],q[1],q[1],q[2],q[3],r[0],r[1],r[2],r[1],r[3],r[2]);}else{I.push(q[0],q[1],q[2],q[1],q[3],q[2],r[0],r[2],r[1],r[1],r[2],r[3]);}}}
  rx=xp;rootY=g0.cy+g0.ry*.5;fx=xp+d[0]*lp;fy=rootY+d[1]*lp;}
 // 가슴지느러미를 몸 밖으로 벌린다(2026-11-18 — 앞에서 보면 몸 옆에 붙은 말뚝 둘이었다). 실제 고래 · 상어는 몸 옆에서 아래 · 바깥으로 비스듬히 뻗는다.
 //   몸 아래 붙는 선(가운데 + 반두께 .6)보다 아래로 나온 만큼 바깥(z)으로 옮기고 조금 들어 올린다. 상어(톱상어)는 더 수평으로
 const splayZ=whale?.85:1,splayY=whale?.4:.7,attach=x=>cAt(x)+rAt(x)*.6;
 for(const [v,side,x,y]of APP){if(!(x>mid&&x<=bx1))continue;const dy=y-attach(x);if(dy<=0)continue;P[v*3+2]+=side*dy*splayZ;P[v*3+1]-=dy*splayY;}
 if(sawKey){
  // 칼날 — 위아래 반두께는 원화 그대로(옆모습이 같다), 옆 반폭은 그 3.2배(뿌리) → 2.2배(끝). 실제 톱상어의 톱은 납작하고 넓은 판이다
  const L=sawTip-bx1,NB=12,blade=[],x0b=bx1-step*2;
  for(let x=x0b;x<=sawTip;x+=3){const xi=Math.min(sawTip,Math.max(bx1,Math.round(x))),t=Math.max(0,(x-bx1)/Math.max(1,L)),rv=Math.max(1.2,x<bx1?rAt(x)*.55:SR[xi]*.95),rh=x<bx1?rAt(x)*.55*headK(x)*1.4:rv*(3.2-1*t),cy0=x<bx1?cAt(x):SC[xi],ring=[];
   for(let j=0;j<=NB;j++){const phi=j/NB*Math.PI*2;ring.push(vtx(x,cy0-Math.cos(phi)*rv,Math.sin(phi)*rh,...refUV(x,cy0-Math.cos(phi)*rv*.8)));}blade.push([x,ring,rh,cy0]);}
  for(let i=0;i<blade.length-1;i++)for(let j=0;j<NB;j++){const a=blade[i][1][j],b=blade[i][1][j+1],c=blade[i+1][1][j],d=blade[i+1][1][j+1];I.push(a,c,b,b,c,d);}
  {const [x,ring,,cy0]=blade.at(-1),tip=vtx(x+3,cy0,0,...refUV(x,cy0));for(let j=0;j<NB;j++)I.push(ring[j],tip,ring[j+1]);}
  // 이빨 — 칼날 양옆 가장자리에 바깥으로 뻗은 가시(길고 짧은 것이 번갈아, 뿌리는 칼날 속에 묻힌다). 위아래 두께가 있는 납작한 세모 둘(위 · 아래)
  const nT=22,tc=px(sawTip,SC[sawTip]).map(v=>Math.min(255,v*1.25+30)),tUV=refUV(sawTip-L*.2,SC[Math.round(sawTip-L*.2)]-SR[Math.round(sawTip-L*.2)]*.3);
  for(let k=1;k<nT;k++){const x=bx1+L*k/nT,xi=Math.round(x),rec=blade.reduce((b,r)=>Math.abs(r[0]-x)<Math.abs(b[0]-x)?r:b),rh=rec[2],cy0=SC[xi],rv=SR[xi]*.95,len=SR[xi]*(k%2?2.4:1.5),half=Math.max(.9,L/nT*.32);
   for(const sd of[-1,1]){const b0=vtx(x-half,cy0,sd*rh*.8,...tUV),b1=vtx(x+half,cy0,sd*rh*.8,...tUV),up=vtx(x,cy0-rv*.35,sd*rh*.85,...tUV),dn=vtx(x,cy0+rv*.35,sd*rh*.85,...tUV),tp=vtx(x-half*.6,cy0,sd*(rh+len),...tUV);
    I.push(b0,up,tp,up,b1,tp,b1,dn,tp,dn,b0,tp);}}
  void tc;
 }
 // 수평 꼬리지느러미(고래) — 갈래 둘 · 가운데 홈 · 앞 가장자리는 뒤로 젖혀진다. 윗면은 등 색, 아랫면은 배 색(혹등고래는 흰 아랫면)
 // 향유고래(2026-11-23) [사용자: "작은 꼬리지느러미"] — 펼친 폭 몸길이의 23% → 32%, 뿌리를 몸 쪽으로 조금 더 들이고 두께 0.4 → 0.75(반두께 기준). 종잇장이라 정면 · 옆에서 선 하나로 보였다
 if(whale){let xl=bx0;for(let x=0;x<bx0;x++){let on=false;for(let y=0;y<H;y++)if(mask[y*W+x]){on=true;break;}if(on){xl=x;break;}}
  const xr=bx0+(bx1-bx0)*(sperm?.05:.03),tl=Math.max(8,xr-xl)*(sperm?1.25:1),span=(bx1-bx0)*(sperm?.16:.115),yc=cAt(bx0),th=rAt(bx0)*(sperm?.75:.4),NA=14,NS=6,top=[],bot=[];
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
 const finOf=new Map();for(const [v,side,x,y]of APP)if(x>mid&&x<=bx1&&y>cAt(x)){const d=Math.hypot(x-rx,y-rootY),f=Math.min(1,d/Math.max(4,Math.hypot(fx-rx,fy-rootY)*1.6));finOf.set(v,[side>0?6:8,f]);}for(const [v,side,u]of PAD)finOf.set(v,[side>0?6:8,Math.min(1,u*1.1)]);
 const J=new Uint16Array(n*4),Wt=new Float32Array(n*4);for(let i=0;i<n;i++){const x=pos[i*3];const fb=finOf.get(i);if(fb){J[i*4]=fb[0];J[i*4+1]=fb[0]+1;Wt[i*4]=1-fb[1];Wt[i*4+1]=fb[1];continue;}if(x>=BX[0]){Wt[i*4]=1;continue;}let k=0;while(k<4&&x<BX[k+1])k++;const f=Math.max(0,Math.min(1,(BX[k]-x)/(BX[k]-BX[k+1])));J[i*4]=k;J[i*4+1]=k+1;Wt[i*4]=1-f;Wt[i*4+1]=f;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Wt,4));g.setIndex((()=>{/* 2026-11-19 위아래를 뒤집어(my-y) 담으면 감기 방향도 뒤집힌다 — 삼각형을 바깥으로(flip-inward.mjs 와 같은 일, facing.test) */for(let t=0;t<I.length;t+=3){const s=I[t+1];I[t+1]=I[t+2];I[t+2]=s;}return I;})());g.computeVertexNormals();
 const glb=await compressGLB(material(packAsset(key,[{name:key,geometry:g,extras:{aquaGeometry:'reference-traced-whale',source:`public/aqua/fish/${key}.webp`,bodyCrossSection:'closed ellipse',...(sawKey?{rostrum:'flattened saw blade with lateral teeth (2026-11-20)'}:{})}}],png,bones),m=>{m.name='painted_PBR_atlas';m.doubleSided=true;m.pbrMetallicRoughness.metallicFactor=.08;m.pbrMetallicRoughness.roughnessFactor=.72;}),{webpQuality:92});
 return {glb,tris:I.length/3,body:[bx0,bx1]};}
for(const key of process.argv.slice(2)){if(/gray_whale/.test(key))throw Error('귀신고래는 2026-11-18 사진 기준 — whales/gray-build.mjs 로 짓는다');const {glb,tris,body}=await build(key);if(tris>8000)throw Error(key+' tris '+tris);await writeFile(`public/aqua/models/fish/${key}.glb`,glb);console.log(key,tris,'tris',glb.length,'bytes','body',body.join('-'));}
