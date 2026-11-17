// 킹크랩 시안 — 2026-11-17 [사용자: "신규 종 킹크랩을 하나 만들고 이미지와 glb 를 만들어서 나한테 보여줘"]
// 한 벌의 치수(SPEC)에서 2D 원화(위에서 본 그림, 머리 오른쪽 · 512 투명 WebP)와 3D GLB 를 함께 뽑는다 — 그래서 둘이 같은 게다.
// 외부 그림 · 모델 없음. 게임에는 아직 안 들어간다(시안).
import * as T from 'three';
import sharp from 'sharp';
import {writeFile,mkdir} from 'node:fs/promises';
import {packAsset} from '../shrimp-pack.mjs';
import {compressGLB} from '../glb-compress.mjs';
const D='design/aqua3d-review/kingcrab';await mkdir(D,{recursive:true});
// ── 치수(원화 픽셀, 위에서 본 그림). 앞 = 오른쪽(+x). 왼쪽 다리(y<256)만 적고 오른쪽은 거울
const C={x:246,y:256,rx:74,ry:88};
// 다리: 마디 점들 [x,y,높이(3D, 몸 두께 단위)] — 무릎이 솟았다가 끝이 바닥을 짚는다. w = 뿌리 굵기
const LEGS=[
 {pts:[[296,196,.1],[330,140,.75],[384,104,.45],[440,90,-.9]],w:24},
 {pts:[[258,180,.1],[258,112,.85],[282,58,.5],[318,26,-.9]],w:25},
 {pts:[[214,186,.1],[176,128,.85],[146,76,.5],[126,40,-.9]],w:24},
];
// 집게(앞다리): 오른쪽(y>256)이 더 크다 — 킹크랩 수컷처럼
const CLAWS=[{side:-1,pts:[[312,222,.05],[346,196,.35],[378,192,.25]],palm:[[374,192],[420,196]],w:20,pw:30},{side:1,pts:[[312,290,.05],[350,322,.4],[386,328,.3]],palm:[[382,328],[446,316]],w:24,pw:42}];
const mirror=p=>[p[0],512-p[1],p[2]];
const allLegs=[...LEGS.map(l=>({...l,side:-1})),...LEGS.map(l=>({...l,pts:l.pts.map(mirror),side:1}))];
// 등딱지 가시 — 결정적 배치(황금각)
const SPINES=[];for(let i=0;i<46;i++){const r=Math.sqrt((i+.5)/46)*.92,a=i*2.39996;SPINES.push([C.x+Math.cos(a)*C.rx*r,C.y+Math.sin(a)*C.ry*r,4+5*(1-r)+(i%3)]);}
// 색
const RED=[176,38,32],DEEP=[110,18,22],ORANGE=[226,92,48],CREAM=[244,214,176],TIP=[250,236,214];
const hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
// ── 2D 원화(SVG → WebP)
function legPath(pts,w0,w1){const L=[],R=[];for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,f=i/(pts.length-1),w=(w0*(1-f)+w1*f)/2;L.push([pts[i][0]+nx*w,pts[i][1]+ny*w]);R.unshift([pts[i][0]-nx*w,pts[i][1]-ny*w]);}const tip=pts.at(-1);return 'M'+[...L,[tip[0],tip[1]],...R].map(p=>p.map(v=>v.toFixed(1)).join(' ')).join(' L ')+' Z';}
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs>
<radialGradient id="shell" cx="58%" cy="40%" r="70%"><stop offset="0" stop-color="${hex(ORANGE)}"/><stop offset=".45" stop-color="${hex(RED)}"/><stop offset="1" stop-color="${hex(DEEP)}"/></radialGradient>
<linearGradient id="leg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(ORANGE)}"/><stop offset=".55" stop-color="${hex(RED)}"/><stop offset="1" stop-color="${hex(DEEP)}"/></linearGradient>
<radialGradient id="spine" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${hex(TIP)}"/><stop offset=".5" stop-color="${hex(ORANGE)}"/><stop offset="1" stop-color="${hex(RED)}"/></radialGradient></defs>`;
for(const l of allLegs){for(let i=0;i<l.pts.length-1;i++){const f0=i/(l.pts.length-1),f1=(i+1)/(l.pts.length-1),w0=l.w*(1-f0)+7*f0,w1=l.w*(1-f1)+7*f1,a=l.pts[i],b=l.pts[i+1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L;svg+=`<path d="${legPath([a,b],w0,i===l.pts.length-2?3:w1*.9)}" fill="url(#leg)" stroke="${hex(DEEP)}" stroke-width="2" stroke-linejoin="round"/>`;svg+=`<path d="M${a[0]+nx*w0*.18} ${a[1]+ny*w0*.18} L ${b[0]+nx*w1*.15} ${b[1]+ny*w1*.15}" stroke="${hex(ORANGE)}" stroke-width="${(w1*.22).toFixed(1)}" stroke-linecap="round" opacity=".75"/>`;const out=-l.side;for(let k=1;k<5;k++){const t=k/5,x=a[0]+dx*t,y=a[1]+dy*t,w=(w0*(1-t)+w1*t)/2,ox=nx*out,oy=ny*out;svg+=`<path d="M${x-dx/L*3+ox*w} ${y-dy/L*3+oy*w} L ${x+dx/L*2+ox*(w+6)} ${y+dy/L*2+oy*(w+6)} L ${x+dx/L*4+ox*w} ${y+dy/L*4+oy*w} Z" fill="${hex(TIP)}" stroke="${hex(DEEP)}" stroke-width=".8"/>`;}}
 for(let i=1;i<l.pts.length-1;i++)svg+=`<circle cx="${l.pts[i][0]}" cy="${l.pts[i][1]}" r="${(l.w*(1-i/(l.pts.length-1))+7*i/(l.pts.length-1))*.5}" fill="${hex(RED)}" stroke="${hex(DEEP)}" stroke-width="1.6"/>`;
 }
for(const c of CLAWS){svg+=`<path d="${legPath(c.pts,c.w,c.w*.8)}" fill="url(#leg)" stroke="${hex(DEEP)}" stroke-width="2"/>`;const [p,q]=c.palm,dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l,h=c.pw/2;
 svg+=`<path d="M${p[0]+nx*h} ${p[1]+ny*h} Q ${p[0]+dx*.6+nx*h*1.15} ${p[1]+dy*.6+ny*h*1.15} ${q[0]+nx*h*.35} ${q[1]+ny*h*.35} L ${q[0]+dx/l*16} ${q[1]+dy/l*16} L ${q[0]-nx*h*.1} ${q[1]-ny*h*.1} L ${q[0]+dx/l*12-nx*h*.7} ${q[1]+dy/l*12-ny*h*.7} L ${q[0]-nx*h*.55} ${q[1]-ny*h*.55} Q ${p[0]+dx*.5-nx*h*1.1} ${p[1]+dy*.5-ny*h*1.1} ${p[0]-nx*h} ${p[1]-ny*h} Z" fill="url(#leg)" stroke="${hex(DEEP)}" stroke-width="2" stroke-linejoin="round"/>`;}
// 등딱지 — 앞이 좁은 둥근 오각형
const shellPts=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2,front=Math.max(0,Math.cos(a)),r=1-.18*front*front+.04*Math.cos(a*5);shellPts.push([C.x+Math.cos(a)*C.rx*r,C.y+Math.sin(a)*C.ry*r]);}
svg+=`<path d="M${shellPts.map(p=>p.map(v=>v.toFixed(1)).join(' ')).join(' L ')} Z" fill="url(#shell)" stroke="${hex(DEEP)}" stroke-width="2.5"/>`;
svg+=`<path d="M${C.x-40} ${C.y} Q ${C.x} ${C.y-14} ${C.x+38} ${C.y}" fill="none" stroke="${hex(DEEP)}" stroke-width="2" opacity=".5"/><path d="M${C.x-40} ${C.y} Q ${C.x} ${C.y+14} ${C.x+38} ${C.y}" fill="none" stroke="${hex(DEEP)}" stroke-width="2" opacity=".5"/>`;
for(const [x,y,r]of SPINES)svg+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r*.62).toFixed(1)}" fill="url(#spine)" stroke="${hex(DEEP)}" stroke-width=".8"/>`;
// 눈 · 이마 가시
svg+=`<path d="M${C.x+C.rx-6} ${C.y-6} L ${C.x+C.rx+16} ${C.y} L ${C.x+C.rx-6} ${C.y+6} Z" fill="${hex(ORANGE)}" stroke="${hex(DEEP)}" stroke-width="1.5"/>`;
for(const s of[-1,1])svg+=`<line x1="${C.x+C.rx-8}" y1="${C.y+s*12}" x2="${C.x+C.rx+6}" y2="${C.y+s*18}" stroke="${hex(RED)}" stroke-width="5" stroke-linecap="round"/><circle cx="${C.x+C.rx+7}" cy="${C.y+s*19}" r="4.2" fill="#14100e"/><circle cx="${C.x+C.rx+8.2}" cy="${C.y+s*17.8}" r="1.2" fill="#fff"/>`;
svg+='</svg>';
const art=await sharp(Buffer.from(svg)).webp({quality:92,alphaQuality:100}).toBuffer();await writeFile(D+'/kingcrab.webp',art);await writeFile(D+'/kingcrab.svg',svg);
// ── 3D: 같은 치수로 짓는다. 1px = 1/S, 높이 단위 H
const S=150,H=.16,V=(x,y,h=0)=>new T.Vector3((x-256)/S,h*H,(y-256)/S);
// 텍스처 — 칸 넷(등딱지 빨강 얼룩 · 다리 빨강 · 배 크림 · 가시 끝/눈)
const atlas=Buffer.alloc(256*256*3);const noise=(x,y)=>Math.sin(x*.37+y*.11)*.5+Math.sin(x*.13-y*.29)*.5;
for(let y=0;y<256;y++)for(let x=0;x<256;x++){const q=(y<128?0:2)+(x<128?0:1),n=noise(x,y);let c;if(q===0){const t=.5+.5*n;c=RED.map((v,i)=>v*(1-.35*t)+ORANGE[i]*.35*t*.6);}else if(q===1){c=RED.map((v,i)=>v*(.85+.15*n)+(x%16<2?-20:0));}else if(q===2){c=CREAM.map(v=>v*(.92+.06*n));}else{c=y<192?TIP:[20,16,14];}atlas.set(c.map(v=>Math.max(0,Math.min(255,Math.round(v)))),(y*256+x)*3);}
const png=await sharp(atlas,{raw:{width:256,height:256,channels:3}}).png().toBuffer();
const UVR={shell:[.25,.25],leg:[.75,.25],belly:[.25,.75],tip:[.75,.62],eye:[.75,.9]};
const P=[],UV=[],I=[],JW=[];const parts=[];
function add(g,region,name,bone=0){g=g.index?g:g;const o=P.length/3,pos=g.attributes.position;for(let i=0;i<pos.count;i++){P.push(pos.getX(i),pos.getY(i),pos.getZ(i));const u=g.attributes.uv?g.attributes.uv.getX(i):0,v=g.attributes.uv?g.attributes.uv.getY(i):0,[cu,cv]=UVR[region];UV.push(cu+(u-.5)*.2,cv+(v-.5)*.2);JW.push(bone);}const idx=g.index?Array.from(g.index.array):[...Array(pos.count).keys()];for(const k of idx)I.push(k+o);parts.push({name,triangles:idx.length/3});}
// 등딱지 — 납작한 돔(윗면 빨강) + 배(크림)
{const top=new T.SphereGeometry(1,28,12,0,Math.PI*2,0,Math.PI/2),pos=top.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),front=Math.max(0,x),r=1-.18*front*front;pos.setXYZ(i,x*C.rx/S*r,y*2.4*H+.02,z*C.ry/S*r);}top.translate((C.x-256)/S,0,0);add(top,'shell','carapace-top');
 const bot=new T.SphereGeometry(1,28,6,0,Math.PI*2,Math.PI/2,Math.PI/2),pb=bot.attributes.position;for(let i=0;i<pb.count;i++){const x=pb.getX(i),y=pb.getY(i),z=pb.getZ(i),front=Math.max(0,x),r=1-.18*front*front;pb.setXYZ(i,x*C.rx/S*r,y*.9*H+.02,z*C.ry/S*r);}bot.translate((C.x-256)/S,0,0);add(bot,'belly','carapace-belly');}
// 가시 — 등딱지 위에 원뿔
for(const [k,[x,y,r]]of SPINES.entries()){const nx=(x-C.x)/C.rx,nz=(y-C.y)/C.ry,d=Math.min(1,Math.hypot(nx,nz)),hTop=Math.sqrt(Math.max(0,1-d*d))*2.4*H+.02,g=new T.ConeGeometry(r*.55/S,r*1.5/S,5);const up=new T.Vector3(nx*.7,1,nz*.7).normalize();g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),up));g.translate((x-256)/S,hTop+r*.5/S,(y-256)/S);add(g,'tip','spine-'+k);}
// 다리 — 마디마다 가늘어지는 원기둥 + 관절 공 + 작은 가시
function limb(pts,w0,w1,name,region='leg'){const vs=pts.map(p=>V(p[0],p[1],p[2]));for(let i=0;i<vs.length-1;i++){const a=vs[i],b=vs[i+1],f0=i/(vs.length-1),f1=(i+1)/(vs.length-1),r0=(w0*(1-f0)+w1*f0)/2/S,r1=(w0*(1-f1)+w1*f1)/2/S,len=a.distanceTo(b),g=new T.CylinderGeometry(r1,r0,len,8,1);g.translate(0,len/2,0);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(a.x,a.y,a.z);add(g,region,name+'-seg'+i);
  if(i>0){const j=new T.SphereGeometry(r0*1.05,8,6);j.translate(a.x,a.y,a.z);add(j,region,name+'-joint'+i);}
  for(let k=1;k<4;k++){const p=a.clone().lerp(b,k/4),r=(r0*(1-k/4)+r1*(k/4)),c=new T.ConeGeometry(r*.28,r*.9,4);c.translate(p.x,p.y+r*1.1,p.z);add(c,'tip',name+'-spike'+i+k);}}
 const tip=new T.ConeGeometry(w1/2/S,10/S,6),a=vs.at(-2),b=vs.at(-1),dir=b.clone().sub(a).normalize();tip.translate(0,5/S,0);tip.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir));tip.translate(b.x,b.y,b.z);add(tip,region,name+'-dactyl');}
allLegs.forEach((l,i)=>limb(l.pts,l.w,7,'leg'+i));
for(const [i,c]of CLAWS.entries()){limb(c.pts,c.w,c.w*.8,'claw-arm'+i);const p=V(...c.palm[0],c.pts.at(-1)[2]),q=V(...c.palm[1],c.pts.at(-1)[2]-.2),len=p.distanceTo(q),palm=new T.SphereGeometry(1,14,10);palm.scale(len*.55,c.pw*.5/S*.7,c.pw*.5/S);palm.rotateY(-Math.atan2(q.z-p.z,q.x-p.x));const m=p.clone().lerp(q,.45);palm.translate(m.x,m.y,m.z);add(palm,'leg','claw-palm'+i);
 for(const [fz,fl] of [[.35,1],[-.35,.85]]){const dir=q.clone().sub(p).normalize(),side=new T.Vector3(-dir.z,0,dir.x),base=p.clone().lerp(q,.85).addScaledVector(side,fz*c.pw/S*.45),fg=new T.ConeGeometry(c.pw*.2/S,c.pw*.95*fl/S,6);fg.translate(0,c.pw*.95*fl/S/2,0);fg.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.clone().addScaledVector(side,-fz*.35).normalize()));fg.translate(base.x,base.y,base.z);add(fg,'leg','claw-finger'+i+(fz>0?'a':'b'));}}
// 눈자루 · 눈 · 이마 가시
for(const s of[-1,1]){limb([[C.x+C.rx-8,C.y+s*12,1.6],[C.x+C.rx+6,C.y+s*18,2.6]],5,4,'eyestalk'+s);const e=new T.SphereGeometry(4.2/S,10,8),p=V(C.x+C.rx+7,C.y+s*19,2.7);e.translate(p.x,p.y,p.z);add(e,'eye','eye'+s);}
{const r=new T.ConeGeometry(6/S,22/S,6),p=V(C.x+C.rx-6,C.y,2.1);r.rotateZ(-Math.PI/2);r.translate(p.x+11/S,p.y,p.z);add(r,'shell','rostrum');}
// 바닥에 닿게(다리 끝이 y=0) · 길이 2 로 맞춤
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));
const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],bones=names.map(n=>{const b=new T.Bone();b.name=n;return b;});for(let i=1;i<6;i++){bones[i].position.x=-.1;bones[i-1].add(bones[i]);}bones[0].add(bones[6]);bones[6].add(bones[7]);bones[0].add(bones[8]);bones[8].add(bones[9]);
const J=new Uint16Array(JW.length*4),W=new Float32Array(JW.length*4);for(let i=0;i<JW.length;i++){J[i*4]=JW[i];W[i*4]=1;}g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(W,4));g.setIndex(I);g.computeBoundingBox();
const bb=g.boundingBox,sc=2/(bb.max.x-bb.min.x);g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,-(bb.min.z+bb.max.z)/2);g.scale(sc,sc,sc);g.computeVertexNormals();
const bytes=await compressGLB(packAsset('king_crab',[{name:'king-crab-concept',geometry:g,extras:{aquaGeometry:'parametric-crab',source:'same SPEC as kingcrab.webp'}}],png,bones),{webpQuality:90});
await writeFile(D+'/kingcrab.glb',bytes);await writeFile(D+'/model.json',JSON.stringify({key:'king_crab',triangles:I.length/3,bytes:bytes.length,parts:parts.length},null,1));
console.log('king_crab: '+I.length/3+' triangles, '+bytes.length+' bytes, art '+art.length+' bytes');
