// 킹크랩 — 2026-11-17 [사용자: "너무달라 실사 이미지를 웹에서 캡쳐해서 누끼따서 참고해서 그려"]
// 참고 그림: NOAA Fisheries 의 red king crab 등쪽 일러스트(위키미디어 커먼즈 · 미국 연방정부 저작물 = 퍼블릭 도메인,
// https://commons.wikimedia.org/wiki/File:Paralithodes_camtschaticus_dorsal_illustration_NOAA_Fisheries.png). 배경은 이미 투명.
// 2D 원화 = 그 그림을 게임 규칙(머리 오른쪽 · 512 정사각 · 투명)으로 돌려 맞춘 것.
// 3D = 그 그림에서 잰 등딱지 윤곽 · 다리 중심선 위에 짓고(다리 굵기는 그림의 투명 경계까지 재서), 그림을 위에서 그대로 입힌다.
import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {packAsset} from '../shrimp-pack.mjs';
import {compressGLB} from '../glb-compress.mjs';
const D='design/aqua3d-review/kingcrab',SRC=D+'/reference/noaa-red-king-crab.png';await mkdir(D,{recursive:true});
const {data:raw,info}=await sharp(SRC).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height;// 640 × 427, 앞 = 위
const alpha=(x,y)=>{x=Math.round(x);y=Math.round(y);return x<0||y<0||x>=W||y>=H?0:raw[(y*W+x)*4+3];};
// ── 2D 원화: 시계 방향 90° (앞 → 오른쪽), 정사각 512 에 여백 6%
{const rot=await sharp(SRC).rotate(90,{background:{r:0,g:0,b:0,alpha:0}}).toBuffer(),m=await sharp(rot).metadata(),s=Math.round(512*.88/Math.max(m.width,m.height));
 const fit=await sharp(rot).resize(Math.round(m.width*s*.999)||1,null).toBuffer().catch(()=>null);void fit;
 const art=await sharp(rot).resize(Math.round(512*.88),Math.round(512*.88),{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:31,bottom:31,left:31,right:31,background:{r:0,g:0,b:0,alpha:0}}).resize(512,512).webp({quality:90,alphaQuality:100}).toBuffer();await writeFile(D+'/kingcrab.webp',art);}
// ── 텍스처: 그림을 512×512 로(투명한 곳은 가장 가까운 불투명 색으로 채워 경계에 흰 테가 안 생기게)
const near=new Int32Array(W*H).fill(-1),q=new Int32Array(W*H);let qa=0,qb=0;for(let i=0;i<W*H;i++)if(raw[i*4+3]>200){near[i]=i;q[qb++]=i;}
while(qa<qb){const i=q[qa++],x=i%W;for(const j of[i-W,i+W,...(x?[i-1]:[]),...(x<W-1?[i+1]:[])])if(j>=0&&j<W*H&&near[j]<0){near[j]=near[i];q[qb++]=j;}}
const rgb=Buffer.alloc(W*H*3);for(let i=0;i<W*H;i++)rgb.set(raw.subarray(near[i]*4,near[i]*4+3),i*3);
const png=await sharp(rgb,{raw:{width:W,height:H,channels:3}}).resize(512,512,{fit:'fill'}).png().toBuffer();
// ── 치수(그림 픽셀, 앞 = 위). 몸 가운데 x 315
const CX=315,CY=228,S=150,HT=1/S;
const toW=(px,py,h)=>new T.Vector3((CY-py)/S,h,(px-CX)/S),uvOf=(px,py)=>[px/W,py/H];
const LEFT=[ // [x, y, 높이(px)] — 무릎이 솟고 끝이 바닥(-28)을 짚는다
 {pts:[[236,182,4],[164,96,34],[108,104,26],[62,150,0],[42,205,-28]]},
 {pts:[[228,228,4],[123,164,34],[86,212,24],[56,270,0],[45,318,-28]]},
 {pts:[[230,268,2],[98,256,30],[110,292,20],[155,340,-4],[225,352,-28]]},
 {pts:[[270,152,8],[262,100,30],[270,70,32],[305,80,26],[322,115,16]],claw:true},
];
const mir=p=>[2*CX-p[0],p[1],p[2]];
const RIGHT=[{pts:LEFT[0].pts.map(mir)},{pts:LEFT[1].pts.map(mir)},{pts:LEFT[2].pts.map(mir)},{pts:[[360,152,8],[378,110,30],[382,80,32],[359,62,28],[328,58,22],[330,78,16]],claw:true}];
const P=[],UV=[],I=[];let parts=0;
function addTri(a,b,c){I.push(a,b,c);}
function vert(p,uv){P.push(p.x,p.y,p.z);UV.push(uv[0],uv[1]);return P.length/3-1;}
// 그림의 투명 경계까지 반폭 재기
function halfWidth(x,y,nx,ny){let a=0,b=0;for(let k=1;k<40;k++){if(alpha(x+nx*k,y+ny*k)<100)break;a=k;}for(let k=1;k<40;k++){if(alpha(x-nx*k,y-ny*k)<100)break;b=k;}return [a,b];}
// 다리: 중심선을 촘촘히 나눠 둘레 8 의 관. 단면 위아래 두께는 폭의 75%
function limb(pts){const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],p[1],p[2])),false,'centripetal'),N=30,SIDES=8,rings=[];
 for(let i=0;i<=N;i++){const t=i/N,c=curve.getPoint(t),d=curve.getTangent(t),l=Math.hypot(d.x,d.y)||1,nx=-d.y/l,ny=d.x/l;let [a,b]=halfWidth(c.x,c.y,nx,ny);const half=Math.max(2.5,Math.min(20,(a+b)/2*(i===N?.4:1))),off=(a-b)/2,cx=c.x+nx*off,cy=c.y+ny*off,ring=[];
  for(let j=0;j<SIDES;j++){const ang=j/SIDES*Math.PI*2,sx=Math.cos(ang)*half,sy=Math.sin(ang)*half*.75,px=cx+nx*sx,py=cy+ny*sx;ring.push(vert(toW(px,py,(c.z+sy)*HT),uvOf(px,py)));}rings.push(ring);}
 for(let i=0;i<N;i++)for(let j=0;j<SIDES;j++){const a=rings[i][j],b=rings[i][(j+1)%SIDES],c=rings[i+1][j],d=rings[i+1][(j+1)%SIDES];addTri(a,c,b);addTri(b,c,d);}
 const end=rings[N],tip=curve.getPoint(1),tv=vert(toW(tip.x,tip.y,tip.z*HT),uvOf(tip.x,tip.y));for(let j=0;j<SIDES;j++)addTri(end[j],tv,end[(j+1)%SIDES]);parts++;}
// 다리 뿌리는 등딱지 밑으로 깊이 넣는다 — 몸 가장자리에서 시작하면 떨어져 보인다(2026-11-17 [사용자: "다리가 몸과 다 떨어져있는 느낌"])
for(const l of[...LEFT,...RIGHT]){const [x,y]=l.pts[0];limb([[x+(CX-x)*.32,y+(CY-y)*.32,6],...l.pts]);}
// 등딱지: 그림에서 가운데와 이어진 불투명 영역(다리 뿌리 안쪽)만 — 격자 높이장 돔 + 납작한 배
{const inside=(x,y)=>{const ex=(x-CX)/88,ey=(y-CY)/(y<CY?84:78);return ex*ex+ey*ey<1.02&&alpha(x,y)>100;},A=56,K=9,rim=[];
 // 가운데에서 방향마다 그림의 등딱지 끝까지 — 매끈한 윤곽(이웃 셋 평균)
 for(let i=0;i<A;i++){const a=i/A*Math.PI*2;let r=0;while(r<110&&inside(CX+Math.cos(a)*(r+1),CY+Math.sin(a)*(r+1)))r++;rim.push(r);}
 const sm=rim.map((r,i)=>(rim[(i+A-1)%A]+2*r+rim[(i+1)%A])/4);
 const rims=[];for(const bottom of[false,true]){const ring=[];for(let k=0;k<=K;k++){const s=1-k/K,row=[];for(let i=0;i<A;i++){const a=i/A*Math.PI*2,x=CX+Math.cos(a)*sm[i]*s,y=CY+Math.sin(a)*sm[i]*s,t=1-s,h=bottom?-12:4+38*Math.sqrt(1-s*s)+3*Math.sin(x*.21)*Math.sin(y*.19)*t;row.push(vert(toW(x,y,h*HT),uvOf(x,y)));}ring.push(row);}
  rims.push(ring[0]);const top=vert(toW(CX,CY,(bottom?-12:42)*HT),uvOf(CX,CY));
  for(let k=0;k<K;k++)for(let i=0;i<A;i++){const a=ring[k][i],b=ring[k][(i+1)%A],c=ring[k+1][i],d=ring[k+1][(i+1)%A];if(bottom){addTri(a,b,c);addTri(b,d,c);}else{addTri(a,c,b);addTri(b,c,d);}}
  for(let i=0;i<A;i++){const a=ring[K][i],b=ring[K][(i+1)%A];if(bottom)addTri(a,b,top);else addTri(a,top,b);}}
 // 등딱지 옆면 — 위 · 아래 가장자리를 잇는 띠(두께가 있어야 다리 뿌리가 몸에 박혀 보인다)
 for(let i=0;i<A;i++){const a=rims[0][i],b=rims[0][(i+1)%A],c=rims[1][i],d=rims[1][(i+1)%A];addTri(a,b,c);addTri(b,d,c);}
 parts++;}
// 눈 두 개(그림의 이마 양옆)
for(const s of[-1,1]){const g=new T.SphereGeometry(4.2*HT,8,6),c=toW(CX+s*12,150,12*HT);g.translate(c.x,c.y,c.z);const o=P.length/3,pos=g.attributes.position;for(let i=0;i<pos.count;i++)vert(new T.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)),[.5,.36]);for(const k of g.index.array)I.push(k+o);parts++;}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.setIndex(I);
const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],bones=names.map(n=>{const b=new T.Bone();b.name=n;return b;});for(let i=1;i<6;i++){bones[i].position.x=-.1;bones[i-1].add(bones[i]);}bones[0].add(bones[6]);bones[6].add(bones[7]);bones[0].add(bones[8]);bones[8].add(bones[9]);
const n=P.length/3,J=new Uint16Array(n*4),Wt=new Float32Array(n*4);for(let i=0;i<n;i++)Wt[i*4]=1;g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Wt,4));
g.computeBoundingBox();const bb=g.boundingBox,sc=2/(bb.max.x-bb.min.x);g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);g.scale(sc,sc,sc);g.computeVertexNormals();
const bytes=await compressGLB(packAsset('king_crab',[{name:'king-crab-from-noaa-reference',geometry:g,extras:{aquaGeometry:'reference-traced-crab',reference:'NOAA Fisheries dorsal illustration (public domain)'}}],png,bones),{webpQuality:90});
await writeFile(D+'/kingcrab.glb',bytes);await writeFile(D+'/model.json',JSON.stringify({key:'king_crab',triangles:I.length/3,bytes:bytes.length,parts,reference:'https://commons.wikimedia.org/wiki/File:Paralithodes_camtschaticus_dorsal_illustration_NOAA_Fisheries.png',license:'Public domain (work of a U.S. federal government employee, NOAA Fisheries)'},null,1));
console.log('king_crab: '+I.length/3+' triangles, '+bytes.length+' bytes');
void readFile;
