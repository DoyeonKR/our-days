// 청룡어(azure_dragonfish) 다시 짓기 — golden-build.mjs 를 바탕으로 만든 판. 원 주석: 황룡어 — 2026-11-17 [사용자: "이미지와 glb 모델이 많이 차이나는 … 황룡어를 보고 분석해봐 … 너가 직접해야해"]
// 이무기어(imugi-build.mjs)와 같은 길: 원화의 S자 몸 중심선을 따라 닫힌 타원 관을 짓고, 원화를 관에 둘러 굽는다.
// 머리 · 사슴뿔 · 갈기 · 수염 · 여의주 · 등 · 배 · 가슴지느러미 깃 · 부채꼴 꼬리깃을 원화 좌표에서 직접 그린다. 외부 모델 · 새 그림 없음.
import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {packAsset} from './shrimp-pack.mjs';
import {compressGLB} from './glb-compress.mjs';
const KEY='azure_dragonfish',D='design/aqua3d-review/azure-v2',FILE=`public/aqua/models/fish/${KEY}.glb`,ART=`public/aqua/fish/${KEY}.webp`,sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(D,{recursive:true});try{await access(D+'/old.glb');}catch{await writeFile(D+'/old.glb',await readFile(FILE));}
// 투명한 곳은 가장 가까운 불투명 색으로 채운다(금빛도 씨앗 — 이무기 판의 노란 빼기는 쓰지 않는다)
const raw=await sharp(ART).ensureAlpha().raw().toBuffer(),nearest=new Int32Array(512*512).fill(-1),queue=new Int32Array(512*512);let qa=0,qb=0;
for(let y=1;y<511;y++)for(let x=1;x<511;x++){const i=y*512+x,a=i*4;if(raw[a+3]>250&&raw[a-4+3]>250&&raw[a+4+3]>250&&raw[a-2048+3]>250&&raw[a+2048+3]>250){nearest[i]=i;queue[qb++]=i;}}
while(qa<qb){const i=queue[qa++],x=i%512;for(const j of[i-512,i+512,...(x?[i-1]:[]),...(x<511?[i+1]:[])])if(j>=0&&j<nearest.length&&nearest[j]<0){nearest[j]=nearest[i];queue[qb++]=j;}}
const rgb=Buffer.alloc(512*512*3);for(let i=0;i<nearest.length;i++)rgb.set(raw.subarray(nearest[i]*4,nearest[i]*4+3),i*3);
const px=(x,y)=>{x=Math.max(0,Math.min(511,Math.round(x)));y=Math.max(0,Math.min(511,Math.round(y)));return [...rgb.subarray((y*512+x)*3,(y*512+x)*3+3)];};
// 몸 중심선(원화 픽셀) — [x, y, 위아래 반지름, 좌우 반지름]. 머리 끝 → 꼬리 뿌리
const S=204,V=(x,y,z=0)=>new T.Vector3((x-256)/S,(256-y)/S,z),
control=[[459,236,4,4],[443,232,9,8],[422,226,13,12],[400,232,14,12],[385,250,13,11],[373,272,13,11],[352,291,14,12],[325,294,15,12],[295,283,15,13],[262,264,16,13],[228,248,16,13],[196,240,15,12],[166,243,13,11],[143,254,11,9],[127,272,9,7],[118,292,6,5],[112,309,3,3]],
curve=new T.CatmullRomCurve3(control.map(c=>V(c[0],c[1])),false,'centripetal');
function frame(t){const c=curve.getPoint(t),d=curve.getTangent(t).normalize(),n=new T.Vector3(d.y,-d.x,0).normalize(),v=t*(control.length-1),i=Math.min(control.length-2,Math.floor(v)),f=v-i,r=control[i][2]*(1-f)+control[i+1][2]*f,w=control[i][3]*(1-f)+control[i+1][3]*f;return{c,d,n,r:r/S,w:w/S};}
// 위 반: 관 둘레로 굽힌 몸 그림 · 아래 반: 원화 그대로(깃 · 뿔 · 여의주가 원화 자리의 색을 쓴다)
const atlas=Buffer.alloc(512*512*3);for(let y=0;y<256;y++)for(let x=0;x<512;x++){const t=x/511,phi=y/255*Math.PI*2,{c,n,r}=frame(t),p=c.clone().addScaledVector(n,Math.cos(phi)*r*.82),color=px(p.x*S+256,256-p.y*S);atlas.set(color,(y*512+x)*3);}
const reference=await sharp(rgb,{raw:{width:512,height:512,channels:3}}).resize(512,256,{fit:'fill'}).raw().toBuffer();reference.copy(atlas,512*256*3);
// 깃 무늬 두 장 — 아래 반 왼쪽(머리 부품은 원화 x>300 만 읽는다). A: 뿌리 금빛 → 끝 흰빛 · B: 흰 갈기. 세로 = 깃 길이, 가로 = 깃 폭, 결은 길이 방향
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
for(let r=0;r<256;r++)for(let c=0;c<64;c++){const f=r/255,cc=c%32,edge=Math.abs(cc-15.5)/15.5,white=c>=32,k=white?.55+.45*sm(0,.5,f):sm(.1,.85,f),base=[38+(232-38)*k,148+(246-148)*k,196+(246-196)*k],streak=.86+.1*Math.sin(cc*1.9+f*7)+.06*Math.sin(cc*5.3-f*23),shade=streak*(1-.18*edge*edge)*(1-.12*(1-f));atlas.set(base.map(v=>Math.max(0,Math.min(255,Math.round(v*shade)))),((256+r)*512+c)*3);}
const png=await sharp(atlas,{raw:{width:512,height:512,channels:3}}).png().toBuffer();await writeFile(D+'/atlas.png',png);
const parts=[],P=[],UV=[],I=[],roles=[],params=[];
const refUV=p=>[(p.x*S+256)/511,(256+(256-p.y*S)/2)/511];
function append(name,points,indices,role='body',tValues=null,uv=null){let volume=0;for(let q=0;q<indices.length;q+=3){const a=points[indices[q]],b=points[indices[q+1]],c=points[indices[q+2]];volume+=a.dot(new T.Vector3().crossVectors(b,c));}if(volume<0)for(let q=0;q<indices.length;q+=3)[indices[q+1],indices[q+2]]=[indices[q+2],indices[q+1]];const offset=P.length/3;for(let i=0;i<points.length;i++){const p=points[i];P.push(...p.toArray());UV.push(...(uv?uv[i]:refUV(p)));roles.push(role);params.push(tValues?tValues[i]:0);}for(const index of indices)I.push(index+offset);parts.push({name,role,triangles:indices.length/3,vertices:points.length});}
// 몸 — 닫힌 타원 관
{const points=[],indices=[],ts=[],uv=[],R=56,N=12;for(let i=0;i<=R;i++){const t=i/R,{c,n,r,w}=frame(t);for(let j=0;j<=N;j++){const phi=j/N*Math.PI*2;points.push(c.clone().addScaledVector(n,Math.cos(phi)*r).add(new T.Vector3(0,0,Math.sin(phi)*w)));ts.push(t);uv.push([t,(j/N*254+.5)/511]);if(i<R&&j<N){const a=i*(N+1)+j,b=a+1,c0=a+N+1,d=c0+1;indices.push(a,c0,b,b,c0,d);}}}for(const [i,reverse]of [[0,true],[R,false]]){const center=points.length;points.push(frame(i/R).c);ts.push(i/R);uv.push([i/R,.25]);for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+1;indices.push(...(reverse?[center,b,a]:[center,a,b]));}}append('golden-serpentine-body',points,indices,'body',ts,uv);}
function nearestT(p){let best=Infinity,t=0;for(let i=0;i<=180;i++){const q=i/180,d=curve.getPoint(q).distanceToSquared(p);if(d<best){best=d;t=q;}}return t;}
function solidTube(name,pixels,radii,role='head',{rings=14,sides=6}={}){const path=new T.CatmullRomCurve3(pixels.map(p=>V(...p))),points=[],indices=[],ts=[];for(let i=0;i<=rings;i++){const t=i/rings,c=path.getPoint(t),d=path.getTangent(t).normalize(),axis=Math.abs(d.z)<.9?new T.Vector3(0,0,1):new T.Vector3(0,1,0),u=new T.Vector3().crossVectors(d,axis).normalize(),v=new T.Vector3().crossVectors(d,u).normalize(),r=(radii[0]*(1-t)+radii[1]*t)/S;for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;points.push(c.clone().addScaledVector(u,Math.cos(a)*r).addScaledVector(v,Math.sin(a)*r));ts.push(nearestT(c));if(i<rings){const a0=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a0,b,a0+sides,b,b+sides,a0+sides);}}}for(const [i,reverse]of [[0,true],[rings,false]]){const at=points.length;points.push(path.getPoint(i/rings));ts.push(nearestT(points.at(-1)));for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(...(reverse?[at,b,a]:[at,a,b]));}}append(name,points,indices,role,ts);}
function sphere(name,center,scale,role='head',paint=null,seg=[10,7]){const g=new T.SphereGeometry(1,seg[0],seg[1]),points=[],indices=Array.from(g.index.array),ts=[],uv=[];g.scale(scale[0]/S,scale[1]/S,scale[2]/S);g.translate(...V(...center).toArray());for(let i=0;i<g.attributes.position.count;i++){const p=new T.Vector3().fromBufferAttribute(g.attributes.position,i);points.push(p);ts.push(nearestT(p));uv.push(paint?[paint[0]/511,(256+paint[1]/2)/511]:refUV(p));}append(name,points,indices,role,ts,uv);}
// 깃 — outline[0] 이 몸에 붙는 자리. 붙은 쪽은 도톰하고 끝으로 갈수록 얇아지며 z 로 벌어진다
function leaf(name,outline,z,role='body',thickness=.007,reach=65,uvOut=null){const shape=outline.map(p=>new T.Vector2(p[0],p[1])),faces=T.ShapeUtils.triangulateShape(shape,[]),points=[],indices=[],ts=[];for(const sign of[-1,1])for(const [x,y]of outline){const span=Math.min(1,Math.hypot(x-outline[0][0],y-outline[0][1])/reach),p=V(x,y,z*(.3+.7*span)+sign*thickness*(1-span*.75));points.push(p);ts.push(nearestT(p));}const n=outline.length;for(const f of faces)indices.push(f[0],f[1],f[2],f[0]+n,f[2]+n,f[1]+n);for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,i+n,j,j+n,i+n);}append(name,points,indices,role,ts,uvOut?[...uvOut,...uvOut]:null);}
// 불꽃 모양 깃 하나 — 뿌리(bx,by)에서 방향 ang(도, 화면 기준 0=오른쪽 · 90=위) 으로 len 만큼, 폭 wid, 끝이 curl 만큼 휜다
function flame(name,bx,by,ang,len,wid,z,role='body',curl=.35,thick=.006,white=false){const U=(f,side)=>[((white?32:0)+15.5+side*15)/511,(256+f*255)/511],uvs=[U(0,0)];const a=ang*Math.PI/180,dx=Math.cos(a),dy=-Math.sin(a),sx=-dy,sy=dx,pts=[[bx,by]];const K=9;for(let k=1;k<=K;k++){const f=k/K,bend=curl*f*f*len,w=wid*Math.pow(Math.sin(Math.PI*Math.min(1,f*1.02)),.75)*(1-.35*f);pts.push([bx+dx*len*f+sx*(w+bend),by+dy*len*f+sy*(w+bend)]);uvs.push(U(f,k===K?0:1));}const tip=pts.at(-1);const back=[];for(let k=K-1;k>=1;k--){const f=k/K,bend=curl*f*f*len,w=wid*Math.pow(Math.sin(Math.PI*Math.min(1,f*1.02)),.75)*(1-.35*f)*.85;back.push([bx+dx*len*f+sx*(bend-w),by+dy*len*f+sy*(bend-w)]);uvs.push(U(f,-1));}const all=[...pts,...back];leaf(name,all,z,role,thick,len,uvs);void tip;}
// 머리 — 머리뼈 · 주둥이 · 아래턱 · 눈썹 · 눈
sphere('skull',[416,223,0],[31,18,15]);sphere('cheek',[404,236,0],[18,12,14]);sphere('snout',[445,233,0],[15,8,9]);sphere('lower-jaw',[437,244,0],[17,5,8]);sphere('nose',[457,236,0],[5,5,6]);
for(const s of[-1,1]){sphere('brow-'+s,[420,211,s*.056],[11,4,5]);sphere('eye-'+s,[422,218,s*.068],[3.2,2.5,1.5],'head',[421,217]);
 solidTube('mouth-'+s,[[457,240,s*.028],[445,244,s*.042],[432,243,s*.048]],[.7,.4],'head',{rings:8,sides:4});
 // 은빛 사슴뿔 — 뒤로 젖혀 올라가는 큰 갈래와 곧게 서는 작은 갈래
 solidTube('antler-a-'+s,[[398,208,s*.045],[376,190,s*.06],[353,170,s*.08],[336,150,s*.09],[323,130,s*.095]],[3.2,.5],'head',{rings:14});
 solidTube('antler-a-b1-'+s,[[352,170,s*.08],[326,160,s*.1],[300,152,s*.105]],[2,.3],'head',{rings:8});
 solidTube('antler-a-b2-'+s,[[370,186,s*.068],[362,166,s*.08],[357,152,s*.085]],[1.6,.3],'head',{rings:6});
 solidTube('antler-b-'+s,[[406,205,s*.04],[399,180,s*.05],[390,152,s*.058],[385,138,s*.06]],[2.6,.4],'head',{rings:12});
 // 은빛 수염 — 하나는 몸을 따라 길게, 하나는 아래로 늘어진다
 solidTube('whisker-long-'+s,[[446,240,s*.035],[425,262,s*.06],[404,285,s*.08],[375,295,s*.09],[338,298,s*.095]],[1.2,.2],'head',{rings:16,sides:5});
 solidTube('whisker-down-'+s,[[449,242,s*.03],[452,270,s*.05],[448,295,s*.07],[431,315,s*.08],[415,321,s*.08]],[1.1,.2],'head',{rings:16,sides:5});
 // 청록 · 흰 갈기 — 목 뒤로 휘날린다
 for(let i=0;i<7;i++){const by=204+i*9,bx=390-i*2;flame('mane-'+s+'-'+i,bx,by,162-i*7,64-Math.abs(i-3)*5,13,s*(.09+i*.006),'head',i<3?.2:-.12,.005,true);}
 // 가슴지느러미 — 목 아래에서 뒤 아래로
 flame('pectoral-'+s,360,298,222,74,22,s*.13,s>0?'finL':'finR',-.15,.008);
 flame('pectoral2-'+s,346,300,244,58,16,s*.1,s>0?'finL':'finR',-.1,.007);
 // 배지느러미 — 아치 아래
 flame('pelvic-'+s,222,258,236,54,16,s*.07,'body',-.15,.006);
}
// 등 깃 — 아치 위로 불꽃처럼
for(const [k,t]of[.42,.49,.56,.63,.70,.77,.84].entries()){const {c,n,r}=frame(t),x=c.x*S+256,y=256-c.y*S,top=[x+n.x*r*S*.85,y-n.y*r*S*.85];flame('dorsal-'+k,top[0],top[1],108+k*4,44+Math.sin(k*1.3)*7,14,0,'body',-.35,.006);}
// 배 깃 — 목 뒤 아래 몸
for(const [k,t]of[.3,.36].entries()){const {c,n,r}=frame(t),x=c.x*S+256,y=256-c.y*S,bot=[x-n.x*r*S*.85,y+n.y*r*S*.85];flame('anal-'+k,bot[0],bot[1],250-k*10,40,12,0,'body',.3,.006);}
// 꼬리깃 — 위 왼쪽 부채 + 아래로 길게 끌리는 세 장
{const tails=[[144,72,24,-.3],[166,66,24,-.28],[190,58,22,-.22],[214,50,20,-.2],[242,42,16,-.2],[336,150,26,.22],[322,118,20,.18],[302,86,16,.12]];
 tails.forEach(([ang,len,wid,curl],k)=>flame('tail-'+k,114,306,ang,len,wid,(k%2?1:-1)*(.012+k*.004),'tail',curl,.008));}
const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],BT=[0,.17,.36,.56,.77,.985],world=BT.map(t=>frame(t).c);world.push(V(360,298,.06),V(318,350,.15),V(360,298,-.06),V(318,350,-.15));
const parent=[-1,0,1,2,3,4,1,6,1,8],bones=names.map(n=>{const b=new T.Bone();b.name=n;return b;});bones.forEach((b,i)=>{b.position.copy(world[i]);if(parent[i]>=0){b.position.sub(world[parent[i]]);bones[parent[i]].add(b);}});bones[0].updateMatrixWorld(true);
const J=[],W=[];for(let i=0;i<roles.length;i++){let joints=[0,0,0,0],weights=[1,0,0,0];const role=roles[i],t=params[i];if(role==='tail'){joints[0]=5;}else if(role==='finL'||role==='finR'){const base=role==='finL'?6:8,X=P[i*3]*S+256,Y=256-P[i*3+1]*S,progress=Math.max(0,Math.min(1,Math.hypot(X-360,Y-298)/80));joints=[base,base+1,0,0];weights=[1-progress,progress,0,0];}else if(role!=='head'){let k=0;while(k<4&&t>BT[k+1])k++;const f=Math.max(0,Math.min(1,(t-BT[k])/(BT[k+1]-BT[k])));joints=[k,k+1,0,0];weights=[1-f,f,0,0];}for(let q=0;q<4;q++)if(weights[q]<1/65535){joints[q]=0;weights[q]=0;}const total=weights.reduce((a,b)=>a+b,0);J.push(...joints);W.push(...weights.map(w=>w/total));}
const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(J,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(W,4));g.setIndex(I);g.computeVertexNormals();g.computeBoundingBox();
// 몸길이 2 — 수염 · 꼬리깃을 뺀 머리 끝 ~ 꼬리 뿌리 기준이 아니라 이무기와 같은 전체 폭 기준
const centerX=(g.boundingBox.min.x+g.boundingBox.max.x)/2,scale=2/(g.boundingBox.max.x-g.boundingBox.min.x);g.translate(-centerX,0,0);g.scale(scale,scale,scale);bones[0].position.x-=centerX;for(const b of bones)b.position.multiplyScalar(scale);bones[0].updateMatrixWorld(true);
const bytes=await compressGLB(packAsset(KEY,[{name:'reference-traced-azure-dragonfish',geometry:g,extras:{aquaGeometry:'solid-reference-traced-serpent',legacyImagePlaneShader:false,spineParameter:'body arc parameter, not world X',bodyCrossSection:'closed ellipse',referenceSHA256:sha(await readFile(ART))}}],png,bones),{webpQuality:90});
if(I.length/3>8000||bytes.length>300000)throw Error('Budget exceeded '+I.length/3+' '+bytes.length);
await writeFile(FILE,bytes);
await writeFile(D+'/model.json',JSON.stringify({key:KEY,file:FILE,oldFile:D+'/old.glb',sha256:sha(bytes),oldSHA256:sha(await readFile(D+'/old.glb')),sourceSHA256:sha(await readFile(ART)),triangles:I.length/3,bytes:bytes.length,bones:names,parts,controlPixels:control,method:'Same path as imugi-v2: closed-volume curved centerline with cylindrical original-image texture bake, solid antlers, whiskers, mane, flame fins and fan tail traced from the original art; no external asset'},null,2));
console.log(KEY+': '+I.length/3+' triangles, '+bytes.length+' bytes');

