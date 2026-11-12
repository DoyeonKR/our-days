/** Original, local asset authoring. Only writes the two requested asset/review folders.
 * Run with Node 22+: node design/aqua3d-review/build-stage1.mjs
 * No source edits, remote assets, paid service, animation clips or game integration.
 *
 * 2026-11-05 배포 형식: packGLB 는 이제 압축본을 쓴다(glb-compress.mjs — meshopt · 양자화 · 512px WebP).
 * 텍스처는 512px 무손실 PNG 로 만들어 넘기고(그림 원본이 512px — 예전 768px JPEG 는 늘리기만 했다) 손실 압축은 WebP 한 번뿐이다.
 * 같은 key 를 다시 빌드한 파일은 scripts/aqua-model-compress.mjs 로 바꾼 기존 파일과 바이트가 같지 않다(그쪽은 768 JPEG 를 줄였다).
 * 압축본은 glb.ts 의 MeshoptDecoder 등록이 있어야 열린다.
 */
import * as T from 'three';
import sharp from 'sharp';
import {compressGLB,COMPRESSION} from './glb-compress.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {anatomy} from '../../src/lib/aqua3d/anatomy.ts';
import {sculptFish} from './fish-sculpt.mjs';
import {bodyProfile} from './volume-fish.mjs';
import {createInvertebrateGeometry,makeInvertebrateRig,INVERTEBRATE_FAMILIES} from '../../src/lib/aqua3d/invertebrates.ts';
import {FAMILIES,DECOR} from '../../src/lib/aquarium.ts';
import {YOUNG,FINALS} from '../../scripts/aqua-art-prompts.mjs';

const OUT='design/aqua3d-review',DIR=`${OUT}/models`;
const requestedKeys=new Set(process.argv.slice(2));
const expansion4=JSON.parse(await readFile(`${OUT}/expansion4-prompts.json`,'utf8'));
const expansion4Profiles=new Map(expansion4.species.map(s=>[s.key,s]));
export const fish=[...FAMILIES.filter(f=>f.key!=='sea_turtle').flatMap(f=>[...f.finals.map(s=>[f.key,s.key]),[f.key,`fry_${f.key}`],[f.key,`juv_${f.key}`]]),
 ...YOUNG.filter(([family])=>!FAMILIES.some(f=>f.key===family)&&FINALS.some(([key])=>key===family)).flatMap(([family])=>[[family,family],[family,`fry_${family}`],[family,`juv_${family}`]])];
export const decors=DECOR.map(d=>d.key);
// Prepared-only assets: never enable families or rewrite existing models implicitly.
for(const item of expansion4.items)if(requestedKeys.has(item.key)&&!fish.some(([,k])=>k===item.key))fish.push([item.family,item.key]);
const largeFish=new Set(fish.filter(([family,key])=>(!/^fry_|^juv_/.test(key)&&['ray','arowana','bluefin','whale_shark','manta','rising','astral','oarfish','coelacanth','gulper_eel','anglerfish'].includes(family))||(!key.startsWith('fry_')&&INVERTEBRATE_FAMILIES.includes(family))).map(([,key])=>key));
for(const [family,key] of fish)if(!key.startsWith('fry_')&&['common_carp','snakehead','mandarin_fish','eel','lenok','hairtail','barred_knifejaw','cutlassfish_pollock','puffer'].includes(family))largeFish.add(key);
const largeDecor=new Set(['sunken_ship','hanok','turtle_ship','dragon_palace','star_gate']);
const BONE_NAMES=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=n=>{const x=Math.sin(n*123.17+48.31)*43758.5453;return x-Math.floor(x);};
await mkdir(DIR,{recursive:true});for(const kind of ['fish','decor'])await mkdir(`public/aqua/models/${kind}`,{recursive:true});

function geometry(p,uv,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const n=g.attributes.normal;for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.001)n.setXYZ(i,0,1,0);return g;}

const TEX=COMPRESSION.textureSize; // 512 — 그림 원본(public/aqua/fish/*.webp)과 같은 해상도. 키워도 세밀해지지 않고 바이트만 는다
async function reference(key,kind){
 const original=await readFile(`public/aqua/${kind}/${key}.webp`),upright=kind==='fish'&&expansion4Profiles.get(key.replace(/^(fry_|juv_)/,''))?.body==='upright';
 const {data,info}=await (upright?sharp(original).rotate(90):sharp(original)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const n=info.width*info.height,skin=new Uint8Array(data),seen=new Uint8Array(n),q=new Int32Array(n);let head=0,tail=0;
 let left=info.width,right=0,top=info.height,bottom=0;
 for(let i=0;i<n;i++)if(data[i*4+3]>96){q[tail++]=i;seen[i]=1;const x=i%info.width,y=Math.floor(i/info.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 while(head<tail){const i=q[head++],x=i%info.width;for(const k of[x?i-1:-1,x<info.width-1?i+1:-1,i-info.width,i+info.width])if(k>=0&&k<n&&!seen[k]){seen[k]=1;q[tail++]=k;for(let c=0;c<3;c++)skin[k*4+c]=skin[i*4+c];}}
 for(let i=0;i<n;i++)skin[i*4+3]=255;
 const paint=await sharp(skin,{raw:{width:info.width,height:info.height,channels:4}}).resize(TEX,TEX,{kernel:'lanczos3'}).raw().toBuffer();
 for(let k=0;k<6;k++)for(let y=0;y<TEX/64;y++)for(let x=k*TEX/64;x<(k+1)*TEX/64;x++){const i=(y*TEX+x)*4,c=[[12,17,23],[184,148,65],[248,246,226],[52,58,64],[187,164,193],[225,228,237]][k];paint.set([...c,255],i);}
 const profile=expansion4Profiles.get(key.replace(/^(fry_|juv_)/,''));
 if(profile&&profile.body!=='upright'&&!['skate','goosefish'].includes(profile.key)){
  // Continuous radial chart: blend colours, not UVs across unrelated atlas
  // islands. The previous strip made a visible seam and elongated eye stripes.
  const body=bodyProfile(profile.key,{data,info,bounds:[left,top,right,bottom]},profile),{raw,W,H,sample}=body;
  const side=Buffer.from(paint);
  const small=await sharp(side,{raw:{width:TEX,height:TEX,channels:4}}).resize(TEX,TEX/2).raw().toBuffer();small.copy(paint,TEX*TEX/2*4);
  const colour=(u,v)=>{const x=Math.max(0,Math.min(info.width-1,Math.round(left+u*W))),y=Math.max(0,Math.min(info.height-1,Math.round(top+v*H)));return skin.subarray((y*info.width+x)*4,(y*info.width+x)*4+3);};
  for(let y=0;y<256;y++)for(let x=0;x<TEX;x++){
   const u=x/(TEX-1),s=Math.max(0,Math.min(1,(u-raw.s0)/(raw.s1-raw.s0))),q=sample(s),theta=y/255*Math.PI;
   const sn=Math.sin(theta),f=Math.max(0,Math.min(1,(sn-.38)/.40)),blend=f*f*(3-2*f),dorsal=theta<Math.PI/2;
   const donor=sample(Math.max(.20,Math.min(.78,s+(1-sn)*.035*Math.sin(theta*5))));
   const samples=[];for(const du of[-.025,0,.025])for(const dv of[-.04,0,.04])samples.push([...colour(donor.u+du,donor.sourceCenter+(dorsal?-1:1)*donor.half*.72+dv)]);
   samples.sort((a,b)=>a[0]+a[1]+a[2]-b[0]-b[1]-b[2]);
   const cap=[0,1,2].map(c=>samples.slice(3,7).reduce((n,p)=>n+p[c],0)/4),flank=colour(u,q.sourceCenter-Math.cos(theta)*q.half);
   if(profile.key==='boxfish'&&Math.sin(u*96+Math.sin(theta*7))*Math.sin(theta*21+Math.cos(u*43))>.87)for(let c=0;c<3;c++)cap[c]*=.23;
   for(let c=0;c<3;c++)paint[(y*TEX+x)*4+c]=Math.round(cap[c]*(1-blend)+flank[c]*blend);
  }
 }
 // 무손실 PNG 로 넘긴다 — packGLB(compressGLB)가 WebP 로 한 번만 손실 압축한다
 const png=await sharp(paint,{raw:{width:TEX,height:TEX,channels:4}}).removeAlpha().png({compressionLevel:6}).toBuffer();
 return {data,info,bounds:[left,top,right,bottom],png,hash:createHash('sha256').update(original).digest('hex')};
}

function silhouetteLoops(ref,jelly=false){
 const {data,info,bounds:[l,t,r,b]}=ref,segments=[],links=new Map(),step=2;
 const value=(x,y)=>x<0||y<0||x>=info.width||y>=info.height||(jelly&&y>t+(b-t)*.37)?0:data[(y*info.width+x)*4+3];
 const table={1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],8:[[2,3]],9:[[2,0]],10:[[0,1],[2,3]],11:[[2,1]],12:[[1,3]],13:[[1,0]],14:[[0,3]]};
 const pointKey=p=>`${p[0].toFixed(4)},${p[1].toFixed(4)}`;
 for(let y=Math.max(0,t-4);y<=b+2;y+=step)for(let x=Math.max(0,l-4);x<=r+2;x+=step){
  const pts=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]],values=pts.map(p=>value(...p)),mask=values.reduce((m,v,i)=>m+(v>48?1<<i:0),0);if(!table[mask])continue;
  const edges=[[0,1],[1,2],[2,3],[3,0]],at=e=>{const [a,b]=edges[e],q=clamp((48-values[a])/(values[b]-values[a]),0,1);return [pts[a][0]+q*(pts[b][0]-pts[a][0]),pts[a][1]+q*(pts[b][1]-pts[a][1])];};
  for(const [a,b]of table[mask]){const s=[at(a),at(b)],id=segments.length;segments.push(s);for(const p of s){const k=pointKey(p);if(!links.has(k))links.set(k,[]);links.get(k).push(id);}}
 }
 const used=new Set(),loops=[];
 for(let i=0;i<segments.length;i++){if(used.has(i))continue;const loop=[segments[i][0]],start=pointKey(loop[0]);let id=i,end=segments[i][1];used.add(id);
  for(let guard=0;guard<segments.length;guard++){loop.push(end);const k=pointKey(end);if(k===start)break;const next=links.get(k)?.find(n=>!used.has(n));if(next===undefined)break;used.add(next);const s=segments[next];end=pointKey(s[0])===k?s[1]:s[0];}
  if(loop.length>5&&pointKey(loop.at(-1))===start){loop.pop();loops.push(loop);}
 }
 const area=p=>p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0];},0)/2;
 const simplify=(points,eps)=>{if(points.length<3)return points;const a=points[0],b=points.at(-1);let max=0,index=0;for(let i=1;i<points.length-1;i++){const p=points[i],u=clamp(((p[0]-a[0])*(b[0]-a[0])+(p[1]-a[1])*(b[1]-a[1]))/((b[0]-a[0])**2+(b[1]-a[1])**2||1),0,1),d=Math.hypot(p[0]-a[0]-u*(b[0]-a[0]),p[1]-a[1]-u*(b[1]-a[1]));if(d>max){max=d;index=i;}}if(max<=eps)return[a,b];return [...simplify(points.slice(0,index+1),eps).slice(0,-1),...simplify(points.slice(index),eps)];};
 const keep=loops.filter(p=>Math.abs(area(p))>5).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
 let simplified,eps=.65;do{simplified=keep.map(loop=>{const half=Math.floor(loop.length/2);return [...simplify(loop.slice(0,half+1),eps).slice(0,-1),...simplify([...loop.slice(half),loop[0]],eps).slice(0,-1)];}).filter(l=>l.length>=3);eps+=.25;}while(simplified.reduce((n,l)=>n+l.length,0)>300&&eps<4);
 return simplified.map(loop=>loop.map(([x,y])=>[(x-l)/(r-l),(y-t)/(b-t)]));
}
function authoredDragon(ref){
 const positions=[],uvs=[],indices=[],path=[[105,319],[158,243],[209,230],[274,272],[329,298],[372,284],[384,236],[419,234],[449,245]],lengths=[0];
 for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
 const sourceAt=s=>{const distance=s*lengths.at(-1);let i=1;while(i<lengths.length-1&&lengths[i]<distance)i++;const t=(distance-lengths[i-1])/(lengths[i]-lengths[i-1]),a=path[i-1],b=path[i],len=lengths[i]-lengths[i-1];return {x:a[0]+t*(b[0]-a[0]),y:a[1]+t*(b[1]-a[1]),nx:-(b[1]-a[1])/len,ny:(b[0]-a[0])/len};};
 const append=(g,at=[0,0,0],scale=[1,1,1],uvAt=null)=>{g.scale(...scale);g.translate(...at);const p=g.attributes.position,uv=g.attributes.uv,offset=positions.length/3;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);positions.push(x,y,z);if(uvAt)uvs.push(...uvAt);else {const s=clamp((x+.95)/1.7,0,1),point=sourceAt(s),shift=-y*150;uvs.push((point.x+point.nx*shift)/512,(point.y+point.ny*shift)/512);}}
  for(let i=0;i<(g.index?.count??p.count);i++)indices.push(offset+(g.index?g.index.getX(i):i));};
 const p=[],u=[],idx=[],rings=42,sides=16;
 for(let j=0;j<=rings;j++){const s=j/rings,x=-.98+s*1.72,r=.018+.115*Math.sin(Math.PI*s)**.7+.018*s;for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;p.push(x,Math.cos(a)*r,Math.sin(a)*r*.86);u.push(s,i/sides);if(j<rings&&i<sides){const k=j*(sides+1)+i;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}}
 append(geometry(p,u,idx));append(new T.SphereGeometry(1,18,12),[.78,.015,0],[.21,.105,.125]);append(new T.SphereGeometry(1,14,8),[.91,-.035,0],[.13,.055,.08]);
 // Dorsal membrane is a thin solid strip; sculpted horns/whiskers do not inherit broad body inflation.
 for(const side of[-1,1]){const v=[],tu=[],ix=[];for(let j=0;j<=28;j++){const s=j/28,x=-.89+s*1.45,base=.06+.08*Math.sin(Math.PI*s),crest=base+.04+Math.sin(Math.PI*s)*(.10+.055*Math.sin(s*25));v.push(x,base,side*.005,x,crest,side*.005);tu.push(s,.55,s,.85);if(j<28){const k=j*2;ix.push(k,k+1,k+2,k+1,k+3,k+2);}}append(geometry(v,tu,ix),[0,0,0],[1,1,1],[.37,.40]);}
 for(const s of[-1,1]){
  const curve=pts=>new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
  for(let i=0;i<3;i++)append(new T.TubeGeometry(curve([[.74-i*.04,.08,s*.07],[.65-i*.07,.21+i*.025,s*.12],[.53-i*.10,.27+i*.04,s*.14]]),14,.008,5,false),[0,0,0],[1,1,1],[.72,.31]);
  append(new T.TubeGeometry(curve([[.93,-.025,s*.06],[.91,-.14,s*.10],[.73,-.22,s*.12],[.51,-.18,s*.11]]),20,.004,5,false),[0,0,0],[1,1,1],[.80,.31]);
  append(new T.SphereGeometry(.014,10,6),[.86,.06,s*.106],[1,1,1],[.864,.474]);
  const fin=geometry([-.95,0,0,-1.06,.18,s*.10,-.82,.10,s*.06],[0,0,1,0,.5,1],[0,1,2]);append(fin,[0,0,0],[1,1,1],[.28,.45]);
  append(geometry([.22,-.025,s*.10,.03,-.15,s*.30,-.12,-.08,s*.17],[0,0,1,0,.5,1],[0,1,2]),[0,0,0],[1,1,1],[.37,.40]);
 }
 const g=geometry(positions,uvs,indices),joints=[],weights=[];
 for(let i=0;i<g.attributes.position.count;i++){const p=g.attributes.position,x=p.getX(i),z=p.getZ(i),t=clamp((.85-x)/.34,0,4.999),b=Math.floor(t),f=t-b,fin=x<.5&&x>-.3?clamp((Math.abs(z)-.10)/.06,0,.75):0,tip=clamp((Math.abs(z)-.16)/.14,0,1),root=z>=0?6:8,js=[b,b+1,root,root+1],ws=[(1-f)*(1-fin),f*(1-fin),fin*(1-tip),fin*tip];for(let k=0;k<4;k++)if(!ws[k])js[k]=0;joints.push(...js);weights.push(...ws);}
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.userData.bodyCenter=[0,0,0];return g;
}
function fishGeometry(family,key,ref,columns){
 if(key==='azure_dragonfish')return authoredDragon(ref);
 const a=anatomy(family,key),ray=a.kind==='ray',jelly=key==='moon_jelly',[l,t,r,b]=ref.bounds,w=r-l,h=b-t;
 const dragonSpine=[[105,319,15],[158,243,25],[209,230,27],[274,272,24],[329,298,25],[372,284,22],[384,236,22],[419,234,25],[449,245,20]];
 const fleshAt=(u,v)=>{if(a.kind!=='dragon')return Math.sqrt(Math.max(0,1-((u-a.cx)/a.rx)**2-((v-a.cy)/a.ry)**2));let strongest=0;
  const x=l+u*w,y=t+v*h;for(let i=1;i<dragonSpine.length;i++){const A=dragonSpine[i-1],B=dragonSpine[i],f=clamp(((x-A[0])*(B[0]-A[0])+(y-A[1])*(B[1]-A[1]))/((B[0]-A[0])**2+(B[1]-A[1])**2),0,1),d=Math.hypot(x-A[0]-f*(B[0]-A[0]),y-A[1]-f*(B[1]-A[1])),r=A[2]+f*(B[2]-A[2]);strongest=Math.max(strongest,Math.sqrt(Math.max(0,1-(d/r)**2)));}return strongest;};
 const p=[],uv=[],index=[],lookup=new Map(),loops=silhouetteLoops(ref,jelly),points=[],triangles=[];
 const inside=(pt,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 const parents=loops.map((loop,i)=>loops.reduce((found,p,j)=>j<i&&inside(loop[0],p)?j:found,-1)),depth=i=>parents[i]<0?0:depth(parents[i])+1;
 for(let i=0;i<loops.length;i++){if(depth(i)%2)continue;const holes=loops.filter((_,j)=>parents[j]===i),contour=loops[i].map(p=>new T.Vector2(...p)),holePoints=holes.map(loop=>loop.map(p=>new T.Vector2(...p))),offset=points.length;
  const tris=T.ShapeUtils.triangulateShape(contour,holePoints);points.push(...contour.map(p=>p.toArray()),...holePoints.flatMap(loop=>loop.map(p=>p.toArray())));triangles.push(...tris.map(t=>t.map(k=>k+offset)));
 }
 const boundary=points.length,budget=largeFish.has(key)?8000:3000,reserved=jelly?1360:4,maxSurface=Math.floor((budget-boundary*2-reserved)/2);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 // Constrained silhouette edges stay smooth; interior points add actual body volume within the budget.
 const candidates=[];for(let j=1;j<columns;j++)for(let i=1;i<columns;i++){const u=(i+(rand(i+j*columns)-.5)*.3)/columns,v=(j+(rand(i+j*columns+800)-.5)*.3)/columns;if(jelly&&v>.37)continue;const e=a.kind==='dragon'?1-fleshAt(u,v):((u-a.cx)/a.rx)**2+((v-a.cy)/a.ry)**2;candidates.push({p:[u,v],priority:e});}
 candidates.sort((a,b)=>a.priority-b.priority);
 for(const {p:point}of candidates){if(triangles.length+2>maxSurface)break;const found=triangles.findIndex(t=>{const [a,b,c]=t.map(i=>points[i]),d=cross(a,b,c),u=cross(point,b,c)/d,v=cross(a,point,c)/d,q=1-u-v;return u>.001&&v>.001&&q>.001;});if(found<0)continue;const [a,b,c]=triangles[found],n=points.length;points.push(point);triangles.splice(found,1,[a,b,n],[b,c,n],[c,a,n]);}
 for(let k=0;k<points.length;k++){
  const [u,v]=points[k];
  const thick=.005+a.depth*.75*fleshAt(u,v);
  let x=(u-.5)*2,y=(.5-v)*2*h/w;
  if(a.kind==='dragon'){
   const lengths=[0];for(let n=1;n<dragonSpine.length;n++)lengths.push(lengths[n-1]+Math.hypot(dragonSpine[n][0]-dragonSpine[n-1][0],dragonSpine[n][1]-dragonSpine[n-1][1]));
   const sx=l+u*w,sy=t+v*h;let best=Infinity;
   for(let n=1;n<dragonSpine.length;n++){const A=dragonSpine[n-1],B=dragonSpine[n],dx=B[0]-A[0],dy=B[1]-A[1],len=Math.hypot(dx,dy),f=clamp(((sx-A[0])*dx+(sy-A[1])*dy)/(len*len),0,1),d=Math.hypot(sx-A[0]-f*dx,sy-A[1]-f*dy);if(d<best){best=d;x=((lengths[n-1]+f*len)/lengths.at(-1)-.5)*2;y=-((sy-A[1])*dx-(sx-A[0])*dy)/len*2/w;}}
  }
  lookup.set(k,p.length/3);
  for(const side of[1,-1]){if(jelly)p.push((.5-v)*2,(.5-u)*2*w/h,side*thick);else if(ray)p.push(x,side*thick,-y);else p.push(x,y,side*thick);uv.push((l+u*w)/ref.info.width,(t+v*h)/ref.info.height);}
 }
 const edges=new Map();
 const face=(ids)=>{const vertices=ids.map(k=>lookup.get(k));if(vertices.some(v=>v===undefined))return;
  index.push(vertices[2],vertices[1],vertices[0],...[vertices[0]+1,vertices[1]+1,vertices[2]+1]);
  for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
 };
 for(const tri of triangles){if(cross(...tri.map(i=>points[i]))<0)tri.reverse();face(tri);}
 for(const [a,b]of edges.values())index.push(a,b,b+1,a,b+1,a+1);
 // Thin pectoral fins are genuine lateral geometry and use the fin chains, not dorsal joints.
 if(!ray&&!jelly){for(const s of[-1,1]){
  const anchor=[(a.cx-.5)*2-.10,-.04,s*a.depth*.62],start=p.length/3;
  const fin=[anchor,[anchor[0]-.14,-.12,s*(a.depth*.62+.12)],[anchor[0]-.08,-.18,s*(a.depth*.62+.05)]];
  for(const xyz of fin){p.push(...xyz);uv.push((l+a.cx*w)/ref.info.width,(t+clamp(a.cy+.18,0,1)*h)/ref.info.height);}
  index.push(start,start+1,start+2);
 }}
 const bellVertices=p.length/3;
 if(jelly){ // Cylindrical tentacles retain thickness from the front, unlike flat silhouette strips.
  for(let k=0;k<10;k++){const angle=k*2.399,len=.98+rand(k+3)*.40,start=p.length/3,rings=17,sides=4;
   for(let j=0;j<=rings;j++){const f=j/rings,x=.28-f*len,cy=Math.cos(angle)*(.12+f*.13),cz=Math.sin(angle)*(.15+f*.10),rad=(.006+(k%3)*.003)*(1-f*.8);
    for(let i=0;i<sides;i++){const theta=i/sides*Math.PI*2;p.push(x,cy+Math.cos(theta)*rad,cz+Math.sin(theta)*rad);uv.push(.50+(k%3-.5)*.035,.40+f*.43);}}
   for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const v=start+j*sides+i,n=start+j*sides+(i+1)%sides;index.push(v,v+sides,n,n,v+sides,n+sides);}
  }
 }
 if(jelly)for(let k=0;k<4;k++){const start=p.length/3,rings=22,sides=6,phase=k*Math.PI/2,len=1.05+rand(k+700)*.18;
  for(let j=0;j<=rings;j++){const f=j/rings,x=.29-f*len,cy=Math.cos(phase)*.11+Math.sin(f*9+phase)*.10*f,cz=Math.sin(phase)*.12+Math.cos(f*8+phase)*.10*f,wide=(.025+.035*Math.sin(f*13+phase)**2)*Math.sin(Math.PI*(.08+f*.86));
   for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;p.push(x,cy+Math.cos(a)*wide,cz+Math.sin(a)*.005);uv.push(.44+k*.04,.4+f*.48);}}
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const v=start+j*sides+i,n=start+j*sides+(i+1)%sides;index.push(v,v+sides,n,n,v+sides,n+sides);}
 }
 const g=geometry(p,uv,index),pos=g.attributes.position,joints=[],weights=[];
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),u=(x+1)/2,v=.5-y/(2*h/w);
  const spine=clamp(jelly?1+(.28-x)/.34:(.85-x)/.34,jelly?1:0,4.999),bone=Math.floor(spine),blend=spine-bone;
  let fin=0;if(ray)fin=clamp((Math.abs(z)-.12)/.65,0,1)*clamp((x+.45)*2,0,1);
  else if(!jelly)fin=clamp((Math.abs(z)-a.depth*.6)/.20,0,1)*clamp((x+.45)*3,0,1);
  const left=z>=0,root=left?6:8,tip=ray?clamp((Math.abs(z)-.25)/.5,0,1):clamp((Math.abs(z)-a.depth*.62)/.12,0,1);
  const js=[bone,bone+1,root,root+1],ws=[(1-blend)*(1-fin),blend*(1-fin),fin*(1-tip),fin*tip];if(jelly&&i<bellVertices){js.fill(0);ws.splice(0,4,1,0,0,0);}for(let k=0;k<4;k++)if(ws[k]===0)js[k]=0;joints.push(...js);weights.push(...ws);
 }
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const center=jelly?[(.5-a.cy)*2,(.5-a.cx)*2*w/h,0]:a.kind==='dragon'?[0,0,0]:ray?[(a.cx-.5)*2,0,(a.cy-.5)*2*h/w]:[(a.cx-.5)*2,(.5-a.cy)*2*h/w,0];
 g.translate(-center[0],-center[1],-center[2]);g.userData.bodyCenter=center;
 return g;
}

function skeleton(center=[0,0,0]){
 const bones=BONE_NAMES.map(name=>{const b=new T.Bone();b.name=name;return b;});
 for(let i=0;i<6;i++){bones[i].position.x=i?-.34:.85;if(i)bones[i-1].add(bones[i]);}
 for(const [root,tip,s]of[[6,7,1],[8,9,-1]]){bones[1].add(bones[root]);bones[root].position.set(-.10,-.04,s*.12);bones[root].add(bones[tip]);bones[tip].position.set(-.12,-.05,s*.22);}
 bones[0].position.sub(new T.Vector3(...center));bones[0].updateMatrixWorld(true);return bones;
}

// Ornament atlas: authored paint swatches, wood/stone/metal grain. Never sampled from an external asset.
const swatches=['#ad3730','#d6ba78','#a88b50','#283b40','#765238','#aaa58c','#e2d2aa','#cfac61','#447f74','#c37d86','#b2c7cc','#ded8bd','#d7a987','#e6e5d7','#4065a1','#263d29'];
async function atlas(){const size=512,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const tile=Math.floor(x/128)+Math.floor(y/128)*4,c=new T.Color(swatches[tile]).convertLinearToSRGB(),u=x%128/128,v=y%128/128;
 const grain=(rand(x+y*size)-.5)*.09,wood=tile===4?Math.sin(u*63+Math.sin(v*9)*1.8)*.05:0,tone=.85+.1*Math.sin(v*Math.PI)+grain+wood;
 const i=(y*size+x)*4;data[i]=c.r*255*tone;data[i+1]=c.g*255*tone;data[i+2]=c.b*255*tone;data[i+3]=255;
 }return sharp(data,{raw:{width:size,height:size,channels:4}}).png({palette:true,colours:256}).toBuffer();}

function ornament(key){
 const root=new T.Group();root.name=key;let target=root;const parts=[];
 const put=(g,swatch,p=[0,0,0],s=[1,1,1],rot=[0,0,0])=>{const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(swatch%4+(uv.getX(i)*.94+.03))/4,(Math.floor(swatch/4)+(uv.getY(i)*.94+.03))/4);const m=new T.Mesh(g,new T.MeshStandardMaterial({roughness:.74,metalness:.12}));m.position.set(...p);m.scale.set(...s);m.rotation.set(...rot);target.add(m);return m;};
 const box=(c,p,s,rot)=>put(new T.BoxGeometry(1,1,1),c,p,s,rot);
 const ball=(c,p,s)=>put(new T.SphereGeometry(1,12,8),c,p,s);
 const cyl=(c,p,s,radial=12)=>put(new T.CylinderGeometry(1,1,1,radial),c,p,s);
 const cone=(c,p,s)=>put(new T.ConeGeometry(1,1,12),c,p,s);
 const torus=(c,p,r,t=.025,rot)=>put(new T.TorusGeometry(r,t,5,24),c,p,[1,1,1],rot);
 const line=(c,points,r=.025,steps=12)=>put(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),steps,r,5,false),c);
 const segment=(c,a,b,r=.03)=>{const d=new T.Vector3(...b).sub(new T.Vector3(...a)),m=cyl(c,new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5).toArray(),[r,d.length(),r]);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;};
 const moving=(name,p,make)=>{const group=new T.Group();group.name=name;group.position.set(...p);root.add(group);const prev=target;target=group;make();target=prev;};
 const window=(x,y,z,w=.16,h=.22)=>{box(3,[x,y,z],[w,h,.025]);for(const dx of[-w*.5,0,w*.5])box(1,[x+dx,y,z+.02],[.012,h+.03,.015]);box(1,[x,y-h*.5,z+.02],[w,.02,.015]);};
 function roof(x,y,z,w,d,c=3){const p=[],uv=[],idx=[],n=10;for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const u=i/n*2-1,v=j/n*2-1,r=Math.max(Math.abs(u),Math.abs(v));p.push(u*w,.34*(1-r)+.11*r**5,v*d);uv.push(i/n,j/n);if(i<n&&j<n){const k=j*(n+1)+i;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}}put(geometry(p,uv,idx),c,[x,y,z]);
  const count=key==='windmill'?2:5;for(let i=-count;i<=count;i++)line(c,[[x+i*w*.17,y+.11,z+d],[x+i*w*.17,y+.30,z],[x+i*w*.17,y+.11,z-d]],.013,key==='windmill'?8:12);
 }
 function shell(p,tilt){const verts=[],uv=[],idx=[],n=32,rings=8;for(let j=0;j<=rings;j++)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=.015+j/rings*.985,rib=1+.026*Math.cos(a*16);verts.push(Math.cos(a)*r*.60*rib,(1-r*r)*.15,Math.sin(a)*r*.40*rib);uv.push(i/n,j/rings);if(j<rings&&i<n){const k=j*(n+1)+i;idx.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1);}}return put(geometry(verts,uv,idx),11,p,[1,1,1],[tilt,0,0]);}
 const stone=(c,at,scale,seed=0)=>{const g=new T.IcosahedronGeometry(1,2),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=.94+.07*Math.sin(x*13+seed)*Math.cos(y*11-z*8);p.setXYZ(i,x*r,y*r,z*r);}g.computeVertexNormals();return put(g,c,at,scale);};
 const leaf=(c,at,scale,angle=0)=>{const p=[],u=[],idx=[],rows=8,cols=4;for(let side=0;side<2;side++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const v=j/rows,x=(i/cols*2-1)*Math.sin(v*Math.PI)**.72;p.push(x*.20,v,.035*Math.sin(v*Math.PI)+Math.abs(x)*.045+(side?-.004:.004));u.push(i/cols,v);if(j<rows&&i<cols){const k=side*(rows+1)*(cols+1)+j*(cols+1)+i;idx.push(...(side?[k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2]:[k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1]));}}return put(geometry(p,u,idx),c,at,scale,[.22,angle,.55]);};
 if(['vallisneria','java_fern','anubias','red_rotala','glow_kelp','water_lily'].includes(key)){
  const broad=['anubias','java_fern','water_lily'].includes(key),color=key==='red_rotala'?0:key==='glow_kelp'?8:15,count=key==='water_lily'?3:4;
  for(let i=0;i<count;i++){const a=i*2.399,x=Math.cos(a)*.20,z=Math.sin(a)*.20,height=key==='vallisneria'?1.5:key==='anubias'?.58:1.05;
   moving(`moving_stem_${i}`,[x,0,z],()=>{segment(15,[0,0,0],[Math.sin(a)*.12,height,0],.013);for(let j=0;j<3;j++){const m=leaf(color,[Math.sin(a)*.10,.10+j*height*.25,0],[broad?1.1:.55,height*.65,1],a+j*2.4);if(key==='vallisneria')m.rotation.z=(i-1.5)*.10;}});
  }
  if(key==='water_lily'){for(let j=0;j<2;j++){const y=.65+j*.22;ball(15,[j*.30-.15,y,0],[.40,.025,.32]);}for(let i=0;i<12;i++){const a=i*Math.PI/6,m=ball(9,[Math.cos(a)*.17,1.12,Math.sin(a)*.17],[.09,.07,.23]);m.rotation.y=a;}ball(7,[0,1.16,0],[.10,.06,.10]);}
 }else if(key==='moss_ball'){
  for(let i=0;i<3;i++){const x=(i-1)*.26,z=Math.sin(i*2)*.10;stone(15,[x,.23,z],[.26,.25,.25],i);for(let j=0;j<10;j++){const a=j*2.399;cone(15,[x+Math.cos(a)*.20,.26+rand(i*11+j)*.18,z+Math.sin(a)*.20],[.025,.10,.025]);}}
 }else if(key==='coral'){
  for(let i=0;i<7;i++){const a=i*2.399,h=.55+(i%3)*.20,x=Math.cos(a)*.35,z=Math.sin(a)*.30;line(9,[[0,0,0],[x*.45,h*.45,z*.45],[x,h,z]],.045,10);for(const s of[-1,1]){line(i%2?9:12,[[x*.5,h*.5,z*.5],[x+s*.16,h*.85,z+.09],[x+s*.21,h+.08,z+.12]],.026,8);ball(9,[x+s*.21,h+.08,z+.12],[.035,.04,.035]);}}
 }else if(key==='pebbles'){
  for(let i=0;i<8;i++){const a=i*2.399;stone(i%2?5:11,[Math.cos(a)*.40,.08,Math.sin(a)*.28],[.17,.10,.15],i);}
 }else if(key==='driftwood'){
  line(4,[[-.78,.07,.08],[-.40,.20,0],[.08,.35,-.05],[.68,.64,-.12]],.10,20);for(const s of[-1,1]){line(4,[[-.15,.28,0],[-.12,.57,s*.12],[s*.25,.90,s*.22]],.045,14);line(4,[[.20,.40,0],[.44,.61,s*.17],[.69,.72,s*.25]],.035,12);}
 }else if(key==='stone_arch'){
  for(let i=0;i<9;i++){const a=i/8*Math.PI;stone(5,[Math.cos(a)*.61,.15+Math.sin(a)*.77,0],[.20,.23,.25],i);}
 }else if(key==='lava_rock'||key==='moon_stone'){
  const lava=key==='lava_rock';stone(lava?3:11,[0,.36,0],[.55,.48,.40],8);
  for(let i=0;i<(lava?14:8);i++){const a=i*2.399,x=Math.cos(a)*.40,y=.15+rand(i+20)*.55,z=.35*Math.sqrt(Math.max(0,1-(x/.55)**2-((y-.36)/.48)**2));put(new T.TorusGeometry(.025+rand(i)*.035,.009,4,10),lava?4:5,[x,y,z]);}
 }else if(key==='crystal'){
  for(let i=0;i<8;i++){const a=i*2.399,h=.45+(i%4)*.20,x=Math.cos(a)*.27,z=Math.sin(a)*.24;put(new T.CylinderGeometry(.095,.13,h*.8,6),10,[x,h*.4,z]);put(new T.ConeGeometry(.095,h*.3,6),14,[x,h*.95,z]);}
 }else if(key.startsWith('filter_')){
  const tier=Number(key.at(-1));box(3,[0,.06,0],[.65,.12,.52]);
  if(tier===3){for(let i=0;i<7;i++){const a=i*2.399;stone(5,[Math.cos(a)*.27,.20+i*.085,Math.sin(a)*.23],[.21,.18,.18],i);ball(15,[Math.cos(a)*.32,.23+i*.07,Math.sin(a)*.26],[.10,.06,.08]);}for(let i=0;i<3;i++){cyl(5,[0,.17+i*.25,.18-i*.10],[.32-i*.055,.06,.23-i*.04]);torus(10,[0,.22+i*.25,.18-i*.10],.19-i*.035,.015,[Math.PI/2,0,0]);line(10,[[0,.82-i*.24,-.02+i*.06],[.09,.69-i*.24,.10+i*.07],[0,.52-i*.24,.19+i*.07]],.022,10);}ball(10,[0,.91,-.05],[.085,.085,.085]);}
  else if(tier===2){box(10,[0,.71,0],[.80,.73,.40]);box(3,[0,1.10,0],[.86,.07,.44]);box(3,[0,.67,.213],[.64,.43,.03]);box(10,[0,.94,.32],[.70,.09,.28]);for(let i=0;i<8;i++)line(10,[[-.28+i*.08,.94,.44],[-.27+i*.08,.78,.48],[-.26+i*.08,.56,.44]],.012,7);line(3,[[-.28,.67,0],[-.48,.48,0],[-.48,.18,0]],.04,9);}
  else{cyl(tier===1?3:10,[0,.55,0],[.25,.85,.23]);for(let i=0;i<6;i++)torus(tier===1?5:3,[0,.20+i*.12,0],.25,.015,[Math.PI/2,0,0]);cyl(3,[0,1.03,0],[.28,.10,.26]);line(10,[[0,1.04,0],[0,1.32,0],[.37,1.32,0]],.045,10);}
 }else if(key.startsWith('heater_')){
  const tier=Number(key.at(-1));if(tier===3){for(let i=0;i<5;i++){const a=i*2.399;stone(3,[Math.cos(a)*.24,.22+rand(i)*.20,Math.sin(a)*.20],[.23,.28,.20],i);line(0,[[Math.cos(a)*.24,.30,Math.sin(a)*.20],[Math.cos(a)*.20,.45,Math.sin(a)*.18]],.013,5);}}
  else{cyl(10,[0,.69,0],[.085,1.25,.085]);cyl(3,[0,1.27,0],[.115,.18,.115]);for(let i=0;i<7;i++)torus(tier===1?0:7,[0,.25+i*.11,0],.085,.012,[Math.PI/2,0,0]);box(3,[0,.67,-.10],[.18,.12,.08]);line(3,[[0,1.35,0],[.15,1.48,-.08],[.26,1.14,-.12]],.018,10);}
 }else if(key.startsWith('feeder_')){
  const tier=Number(key.at(-1));if(tier===3){shell([0,.10,0],Math.PI);moving('moving_feeder_clam_lid',[0,.14,-.34],()=>shell([0,.33,.16],-1.0));ball(7,[0,.25,.05],[.19,.15,.19]);for(let i=0;i<8;i++)ball(7,[(rand(i)-.5)*.43,.12,(rand(i+30)-.5)*.30],[.03,.025,.03]);}
  else{box(3,[0,.22,0],[.42,.44,.38]);put(new T.CylinderGeometry(.30,.30,.43,16),tier===1?4:10,[0,.65,0],[1,1,1],[0,0,Math.PI/2]);torus(3,[.23,.65,0],.23,.025,[0,Math.PI/2,0]);box(3,[0,.29,.21],[.25,.15,.035]);box(tier===1?11:8,[0,.29,.233],[.20,.095,.01]);for(let i=0;i<3;i++)ball(7,[-.10+i*.10,.10,.27],[.018,.018,.018]);}
 }else if(key==='mailbox'){
  cyl(0,[0,.37,0],[.10,.65,.10]);cyl(1,[0,.07,0],[.29,.10,.22]);box(0,[0,.94,0],[.63,.75,.40]);
  put(new T.CylinderGeometry(.32,.32,.43,20,1,false,0,Math.PI),0,[0,1.31,0],[1,1,1],[Math.PI/2,0,0]);
  box(3,[0,1.13,.214],[.46,.045,.024]);box(11,[0,1.13,.235],[.32,.12,.015],[0,0,.08]);
  torus(1,[0,.92,.225],.17,.014);for(let i=0;i<8;i++){const a=i*Math.PI/4;ball(1,[Math.cos(a)*.27,.95+Math.sin(a)*.32,.22],[.025,.025,.018]);}
  line(1,[[-.3,.58,.18],[-.35,.95,.18],[-.3,1.35,.18]],.018);line(1,[[.3,.58,.18],[.35,.95,.18],[.3,1.35,.18]],.018);
  const heart=new T.Shape();heart.moveTo(0,.04);heart.bezierCurveTo(-.13,.18,-.18,-.01,0,-.15);heart.bezierCurveTo(.18,-.01,.13,.18,0,.04);put(new T.ExtrudeGeometry(heart,{depth:.018,bevelEnabled:false,curveSegments:8}),0,[0,.85,.229]);
  for(let i=0;i<9;i++){const a=i*2.399,x=-.31+rand(i)*.08,y=.23+rand(i+90)*1.14;torus(5,[x,y,.16+rand(i+45)*.05],.025+rand(i+66)*.02,.009);}
 }else if(key==='diver'){
  ball(2,[0,.66,0],[.28,.36,.22]);ball(2,[0,1.15,0],[.30,.29,.28]);torus(1,[0,1.16,.255],.20,.035);
  ball(3,[0,1.16,.257],[.17,.17,.035]);for(const x of[-.08,.08])box(1,[x,1.16,.294],[.018,.32,.015]);box(1,[0,1.16,.3],[.31,.018,.015]);
  for(const s of[-1,1]){segment(2,[s*.16,.87,0],[s*.38,.59,.08],.10);ball(3,[s*.39,.56,.08],[.10,.11,.10]);segment(2,[s*.16,.46,0],[s*.20,.15,.02],.115);ball(4,[s*.20,.10,.09],[.15,.10,.24]);torus(1,[s*.20,.25,.03],.10,.025,[Math.PI/2,0,0]);}
  box(1,[0,.68,.221],[.35,.20,.04]);for(let i=0;i<3;i++)torus(3,[-.11+i*.11,.70,.25],.03,.009);
  line(3,[[.24,1.17,0],[.45,1.02,-.12],[.39,.64,-.18],[.2,.57,-.21]],.04);
  torus(1,[0,.99,0],.235,.025,[Math.PI/2,0,0]);for(let i=0;i<8;i++){const a=i*Math.PI/4;put(new T.IcosahedronGeometry(.022,0),1,[Math.cos(a)*.23,1.16+Math.sin(a)*.23,.24]);}
  for(const s of[-1,1]){cyl(1,[s*.29,1.18,0],[.06,.10,.06]).rotation.z=Math.PI/2;for(let i=0;i<3;i++)segment(3,[s*(.35+i*.023),.59,.14],[s*(.35+i*.023),.51,.15],.016);}
  box(6,[-.32,.81,.18],[.30,.22,.012],[0,0,-.14]);line(4,[[-.43,.88,.20],[-.34,.83,.20],[-.27,.86,.20]],.007);
 }else if(key==='heart_bubbler'){
  const curve=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2;return [.031*16*Math.sin(a)**3,.64+.031*(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a)),0];});line(9,curve,.105,64);cyl(9,[0,.07,0],[.42,.14,.22]);
  for(let i=0;i<3;i++){const g=new T.Shape();g.moveTo(0,.05);g.bezierCurveTo(-.2,.23,-.2,-.03,0,-.17);g.bezierCurveTo(.2,-.03,.2,.23,0,.05);put(new T.ExtrudeGeometry(g,{depth:.06,bevelEnabled:false,curveSegments:6}),9,[.37+i*.07,1.15+i*.17,0],[.4,.4,.4]);}
 }else if(key==='sand_castle'){
  cyl(6,[0,.10,0],[.82,.20,.60]);box(6,[0,.44,0],[.85,.58,.48]);
  for(const[x,h]of[[-.59,.82],[0,1.30],[.59,.90]]){cyl(6,[x,h*.5+.12,0],[x? .21:.25,h,.21]);cone(6,[x,h+.28,0],[x?.28:.32,.40,.28]);window(x,h*.6,.215,.10,.18);segment(4,[x,h+.46,0],[x,h+.70,0],.012);box(x<0?14:x>0?7:0,[x+.09,h+.64,0],[.17,.10,.012]);}
  box(3,[0,.31,.25],[.25,.35,.025]);torus(11,[0,.47,.275],.14,.035);for(let i=0;i<8;i++)ball(11,[Math.sin(i*2)*.69,.12,Math.cos(i*2)*.45],[.10,.06,.07]);
  for(const x of[-.59,0,.59])for(let i=0;i<6;i++)box(6,[x-.16+i*.065,x===0?1.19:.76,.19],[.045,.09,.065]);
  for(let i=0;i<8;i++){const a=i*Math.PI/8;box(5,[Math.cos(a)*.18,.34+Math.sin(a)*.20,.267],[.07,.08,.035],[0,0,a]);}
 }else if(key==='windmill'){
  put(new T.CylinderGeometry(.22,.40,1.05,12),4,[0,.58,0]);cone(4,[0,1.25,0],[.44,.46,.39]);window(0,.39,.38,.19,.32);
  for(let j=0;j<5;j++)torus(5,[0,.2+j*.18,0],.39-j*.026,.018,[Math.PI/2,0,0]);
  for(const s of[-1,1]){box(4,[s*.35,.21,.12],[.21,.32,.28]);roof(s*.35,.38,.12,.23,.25,4);for(let i=0;i<4;i++)put(new T.IcosahedronGeometry(1,0),15,[s*(.28+rand(i)*.2),.05,rand(i+70)*.40],[.08,.10,.08]);}
  moving('moving_windmill_blades',[0,1.08,.43],()=>{for(let i=0;i<4;i++){const arm=new T.Group();arm.rotation.z=Math.PI/4+i*Math.PI/2;target.add(arm);const prior=target;target=arm;box(4,[0,.37,0],[.045,.77,.04]);for(const x of[-.09,.09])box(4,[x,.42,0],[.018,.64,.025]);for(let y=.12;y<.8;y+=.09)box(1,[0,y,.01],[.18,.014,.025]);target=prior;}torus(2,[0,0,.035],.09,.025);});
 }else if(key==='treasure'){
  box(4,[0,.26,0],[.90,.48,.61]);for(let j=0;j<4;j++)box(3,[0,.10+j*.11,.311],[.87,.010,.014]);
  for(const x of[-.34,.34])box(5,[x,.27,.325],[.055,.46,.03]);box(5,[0,.31,.34],[.15,.17,.05]);
  moving('moving_treasure_lid',[0,.50,-.31],()=>{const g=put(new T.CylinderGeometry(.33,.33,.94,16,1,false,0,Math.PI),4,[0,.20,0],[1,1,1],[0,0,Math.PI/2]);g.rotation.x=-.85;for(const x of[-.35,.35])torus(5,[x,.19,0],.33,.025,[0,Math.PI/2,0]);});
  for(let i=0;i<32;i++){const x=(rand(i)-.5)*.70,z=(rand(i+34)-.5)*.42;cyl(7,[x,.51+rand(i+83)*.06,z],[.048,.015,.048],10);}for(let i=0;i<6;i++)ball(i%2?14:0,[(rand(i+140)-.5)*.65,.57,(rand(i+180)-.5)*.35],[.055,.045,.05]);
 }else if(key==='pearl_clam'){
  shell([0,.13,0],Math.PI);moving('moving_clam_lid',[0,.17,-.36],()=>{shell([0,.34,.15],-1.05);});ball(13,[0,.28,.07],[.23,.23,.23]);
  for(let i=0;i<12;i++)ball(5,[Math.sin(i*2.4)*.5,.06,Math.cos(i*2.4)*.32],[.09,.05,.08]);
 }else if(key==='stone_pagoda'){
  box(5,[0,.11,0],[.96,.22,.83]);for(let j=0;j<3;j++){const w=.54-j*.10,y=.28+j*.43;box(5,[0,y+.13,0],[w,.26,w]);window(0,y+.14,w*.51,.14,.14);roof(0,y+.25,0,w*.85,w*.76,5);}ball(5,[0,1.72,0],[.09,.11,.09]);
 }else if(key==='hanok'||key==='dragon_palace'){
  const palace=key==='dragon_palace',levels=palace?3:1;
  for(let j=0;j<levels;j++){const w=palace?1.35-j*.30:.83,y=.20+j*.68;
   box(5,[0,y-.08,0],[w*2,.16,1.12]);box(palace?8:4,[0,y+.23,0],[w*1.8,.48,.82]);
   for(let i=-2;i<=2;i++){window(i*w*.32,y+.25,.425,w*.23,.37);segment(palace?0:4,[i*w*.4,y,.47],[i*w*.4,y+.54,.47],.035);}
   roof(0,y+.52,0,w*1.12,.69,palace?8:3);
   for(const s of[-1,1]){segment(1,[s*w*1.0,y+.63,0],[s*w*1.15,y+.82,0],.026);ball(7,[s*w*1.15,y+.85,0],[.035,.06,.035]);}
  }
  for(let i=0;i<4;i++)box(5,[0,.035+i*.035,.76-i*.09],[1.1-i*.07,.05,.18]);
  if(palace)for(const s of[-1,1]){cyl(8,[s*1.37,.40,0],[.20,.65,.20]);roof(s*1.37,.76,0,.42,.39,8);for(let i=0;i<3;i++)ball(9,[s*(.8+i*.21),.15,Math.sin(i)*.55],[.12,.15,.09]);}
  else for(const z of[-.53,.53])for(let i=-3;i<=3;i++)segment(4,[i*.24,.2,z],[i*.24,.45,z],.018);
 }else if(key==='sunken_ship'||key==='turtle_ship'){
  const turtle=key==='turtle_ship';
  const hp=[],huv=[],hi=[],rows=18,cols=12;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const x=j/rows*2-1,a=i/cols*Math.PI,r=Math.sqrt(Math.max(.015,1-x*x));hp.push(x*.94,.35-Math.sin(a)*.32*r,Math.cos(a)*.36*r);huv.push(j/rows,i/cols);if(j<rows&&i<cols){const k=j*(cols+1)+i;hi.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}
  put(geometry(hp,huv,hi),4);
  box(4,[0,.35,0],[1.65,.10,.65]);for(let i=0;i<12;i++)box(3,[-.78+i*.14,.406,0],[.008,.012,.60]);
  for(const s of[-1,1]){for(let i=0;i<7;i++){const x=-.7+i*.23;torus(5,[x,.22,s*.34],.045,.014);segment(4,[x,.4,s*.3],[x,.61,s*.3],.018);if(turtle)segment(4,[x,.20,s*.32],[x-.2,-.02,s*.70],.021);}line(4,[[-.8,.61,s*.3],[0,.65,s*.32],[.8,.61,s*.3]],.022);}
  if(turtle){ball(5,[0,.55,0],[.72,.27,.32]);for(let i=0;i<7;i++)for(const s of[-1,0,1])cone(5,[-.55+i*.18,.84-Math.abs(s)*.09,s*.20],[.028,.14,.028]);line(4,[[.78,.42,0],[1.03,.60,0],[1.17,.62,0]],.08);ball(5,[1.17,.65,0],[.12,.08,.08]);}
  else{segment(4,[0,.4,0],[-.10,1.65,0],.035);segment(4,[-.66,1.26,0],[.53,1.26,0],.024);for(const s of[-1,1])line(1,[[-.10,1.65,0],[s*.74,.4,s*.28]],.009);
   put(new T.PlaneGeometry(.84,.66,5,5),11,[-.08,1.13,0],[1,1,1],[0,.08,-.08]);box(4,[-.45,.56,-.06],[.35,.33,.38]);window(-.45,.56,.15,.16,.19);}
 }else if(key==='mermaid'){
  ball(11,[0,.88,0],[.18,.28,.14]);ball(11,[0,1.26,0],[.15,.19,.15]);
  line(11,[[0,.67,0],[.24,.42,.03],[.46,.17,.07]],.14);for(const s of[-1,1])put(new T.ConeGeometry(.17,.40,10),11,[.52,.15,s*.10],[1,.3,1],[0,0,-Math.PI/2]);
  for(const s of[-1,1])segment(11,[s*.14,1.01,0],[s*.25,.76,.10],.045);
  for(let i=0;i<8;i++)line(6,[[-.12+i*.035,1.40,0],[-.19+i*.045,1.24,-.13],[-.20+i*.05,.98,-.15]],.022);
  ball(5,[0,.12,0],[.52,.24,.37]);
  ball(11,[0,1.24,.151],[.025,.036,.043]);for(const s of[-1,1]){ball(5,[s*.056,1.29,.133],[.016,.009,.009]);ball(11,[s*.25,.75,.10],[.04,.07,.035]);}
  for(let i=0;i<5;i++)line(6,[[-.10+i*.04,1.02,.12],[-.11+i*.05,.82,.15],[-.16+i*.06,.68,.07]],.012);
 }else if(key==='star_gate'){
  torus(5,[0,.88,0],.65,.11);torus(1,[0,.88,.045],.67,.025);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;cone(5,[Math.cos(a)*.66,.88+Math.sin(a)*.66,0],[.10,.22,.12]).rotation.z=-a+Math.PI/2;ball(14,[Math.cos(a)*.65,.88+Math.sin(a)*.65,.13],[.045,.045,.03]);}
  for(let i=0;i<3;i++)box(5,[0,.04+i*.045,.10-i*.04],[1.50-i*.15,.07,.64-i*.08]);
  // The magic is modeled as curved strands and a curved backing, never a texture billboard.
  ball(3,[0,.88,-.12],[.58,.58,.06]);
  for(let arm=0;arm<3;arm++){const pts=[];for(let i=0;i<30;i++){const f=i/29,a=arm*Math.PI*2/3+f*Math.PI*3,r=f*.54;pts.push([Math.cos(a)*r,.88+Math.sin(a)*r,-.04+f*.04]);}line(arm===1?10:14,pts,.022,30);}
  for(let i=0;i<15;i++)put(new T.IcosahedronGeometry(.008,0),13,[(rand(i)-.5)*.80,.88+(rand(i+41)-.5)*.80,.04]);
 }
 root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3());root.position.set(-center.x,-bounds.min.y,-center.z);root.updateMatrixWorld(true);
 // Bake transforms while preserving authored moving pivots and one primitive per node.
 for(const node of [root,...root.children.filter(c=>c.name.startsWith('moving_'))]){
  const groupParts=[];node.traverse(o=>{if(o instanceof T.Mesh&&o.parent!==undefined){let p=o.parent;while(p&&p!==node&&!p.name.startsWith('moving_'))p=p.parent;if(p===node)groupParts.push(o);}});
  if(!groupParts.length)continue;const arrays={p:[],n:[],uv:[],i:[]};
  const inv=node===root?new T.Matrix4():new T.Matrix4().copy(node.matrixWorld).invert();
  for(const m of groupParts){const g=m.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv,m.matrixWorld)),offset=arrays.p.length/3;arrays.p.push(...g.attributes.position.array);arrays.n.push(...g.attributes.normal.array);arrays.uv.push(...g.attributes.uv.array);for(let i=0;i<(g.index?.count??g.attributes.position.count);i++)arrays.i.push(offset+(g.index?g.index.getX(i):i));}
  const g=geometry(arrays.p,arrays.uv,arrays.i);g.setAttribute('normal',new T.Float32BufferAttribute(arrays.n,3));parts.push({name:node===root?'static_ornament':node.name,geometry:g,translation:node===root?[0,0,0]:node.getWorldPosition(new T.Vector3()).toArray()});
 }
 return parts;
}

/** 배포용 GLB — 아래 packRawGLB(float · 원본 그림) 를 glb-compress 로 압축한다. 예산(bytes)도 압축본 기준이다 */
async function packGLB(key,parts,png,bones){return compressGLB(packRawGLB(key,parts,png,bones));}
function packRawGLB(key,parts,png,bones){
 const j={asset:{version:'2.0',generator:'Our Days original asset authoring / stage 1'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[{name:'painted_PBR_atlas',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:.08,roughnessFactor:.76},doubleSided:true}],textures:[{sampler:0,source:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],images:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
 const profile=expansion4Profiles.get(key.replace(/^(fry_|juv_)/,''));
 if(profile){j.materials[0].pbrMetallicRoughness.metallicFactor=0;j.materials[0].pbrMetallicRoughness.roughnessFactor=profile.body==='eel'?.48:.58;}
 const chunks=[];let length=0;
 const view=(bytes,target)=>{const buf=Buffer.from(bytes.buffer??bytes,bytes.byteOffset??0,bytes.byteLength??bytes.length),i=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:length,byteLength:buf.length,...(target?{target}:{})});chunks.push(buf);const pad=(4-buf.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));length+=buf.length+pad;return i;};
 const acc=(array,type,componentType,target)=>{const i=j.accessors.length,n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type],a={bufferView:view(array,target),componentType,count:array.length/n,type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<array.length;k++){a.min[k%3]=Math.min(a.min[k%3],array[k]);a.max[k%3]=Math.max(a.max[k%3],array[k]);}}j.accessors.push(a);return i;};
 const imageView=view(png);j.images.push({name:`${key}_basecolor`,bufferView:imageView,mimeType:png[0]===0xff?'image/jpeg':'image/png'});
 for(const part of parts){const g=part.geometry,attrs={POSITION:acc(new Float32Array(g.attributes.position.array),'VEC3',5126,34962),NORMAL:acc(new Float32Array(g.attributes.normal.array),'VEC3',5126,34962),TEXCOORD_0:acc(new Float32Array(g.attributes.uv.array),'VEC2',5126,34962)};
  if(bones){attrs.JOINTS_0=acc(new Uint16Array(g.attributes.skinIndex.array),'VEC4',5123,34962);attrs.WEIGHTS_0=acc(new Float32Array(g.attributes.skinWeight.array),'VEC4',5126,34962);}
  const mesh=j.meshes.length;j.meshes.push({name:part.name,primitives:[{attributes:attrs,indices:acc(new Uint16Array(g.index.array),'SCALAR',5123,34963),material:0,mode:4}]});const node=j.nodes.length;j.nodes.push({name:part.name,mesh,translation:part.translation??[0,0,0],...(g.userData.authoring==='closed-volume-v3'?{extras:{aquaGeometry:'closed-volume-v3'}}:{}),...(bones?{skin:0}:{})});j.scenes[0].nodes.push(node);
 }
 if(bones){const offset=j.nodes.length;for(const b of bones){const children=b.children.map(c=>offset+bones.indexOf(c));j.nodes.push({name:b.name,translation:b.position.toArray(),...(children.length?{children}:{})});}j.scenes[0].nodes.push(offset);
  const inverses=new Float32Array(16*bones.length);bones.forEach((b,i)=>new T.Matrix4().copy(b.matrixWorld).invert().toArray(inverses,i*16));j.skins=[{name:'aquarium_standard_10',joints:bones.map((_,i)=>offset+i),skeleton:offset,inverseBindMatrices:acc(inverses,'MAT4',5126)}];
 }
 if(key==='moon_jelly'||key.includes('jellyfish')){j.materials[0].alphaMode='BLEND';j.materials[0].pbrMetallicRoughness.baseColorFactor=[1,1,1,key.includes('jellyfish')?.62:.74];}
 if(key.includes('anglerfish')){j.materials[0].emissiveTexture={index:0};j.materials[0].emissiveFactor=[.12,.22,.24];}
 j.buffers[0].byteLength=length;const bin=Buffer.concat(chunks),json0=Buffer.from(JSON.stringify(j)),json=Buffer.concat([json0,Buffer.alloc((4-json0.length%4)%4,32)]),out=Buffer.alloc(12+8+json.length+8+bin.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);return out;
}

const report={schema:2,stage:'all',status:'generated_pending_visual_review',approved:false,notes:['All requested fish forms and decorations are generated. No numerical visual similarity scores or self-approval.','Fish have radial anatomical bodies or specialised ray/jelly/dragon surfaces with independent contour fins.','Source paintings constrain colour and visible silhouette; unseen sides are estimates.','Decorations are original low-poly sculptures with a procedural paint atlas. Detailed ornament/reference differences remain visible in comparisons.'],models:{}};
if(requestedKeys.size)Object.assign(report,JSON.parse(await readFile(`${OUT}/models.json`,'utf8')));
const decorPng=await atlas();
for(const [family,key]of fish){if(requestedKeys.size&&!requestedKeys.has(key))continue;const ref=await reference(key,'fish'),big=largeFish.has(key),budget=big?8000:3000;let columns=big?58:42,g;
 ref.loops=silhouetteLoops(ref,key==='moon_jelly');
 const invertebrate=family==='starfish';
 const profile=expansion4Profiles.get(family);
 g=invertebrate?createInvertebrateGeometry(family,key,true,ref):sculptFish(family,key,ref,profile);
 if(g.index.count/3>budget){ref.loops=ref.loops.map(loop=>loop.length>8?loop.filter((_,i)=>i%2===0):loop);g=sculptFish(family,key,ref,profile);}
 if(g.index.count/3>budget)throw new Error(`Triangle budget ${key}: ${g.index.count/3}`);
 const bones=invertebrate?makeInvertebrateRig(family,key):skeleton(g.userData.bodyCenter),bytes=await packGLB(key,[{name:key,geometry:g}],ref.png,bones),file=`public/aqua/models/fish/${key}.glb`;
 if(bytes.length>(big?800000:300000))throw new Error(`Size budget ${key}: ${bytes.length}`);
 await writeFile(file,bytes);report.models[key]={kind:'fish',family,form:key.startsWith('fry_')?'fry':key.startsWith('juv_')?'juvenile':'adult',file,triangles:g.index.count/3,bytes:bytes.length,bones:bones.map(b=>b.name),anatomyKind:anatomy(family,key).kind,textureSize:[TEX,TEX],materials:1,skinMeshes:1,animations:0,compression:{format:'EXT_meshopt_compression + KHR_mesh_quantization + EXT_texture_webp',tool:'design/aqua3d-review/glb-compress.mjs',settings:COMPRESSION},sourceSHA256:ref.hash,approval:'pending',limits:{triangles:budget,bytes:big?800000:300000}};
 if(profile)Object.assign(report.models[key],{authoringProfile:profile,geometryAuthoring:g.userData.authoring??'specialised-surface',wholeBodyPlate:g.userData.wholeBodyPlate??null,regions:g.userData.regions??[],swimmingMode:g.userData.swimmingMode??'specialised',referenceRotation:profile.body==='upright'?90:0,referenceDorsal:['skate','goosefish'].includes(family),coordinateSystem:{up:'+Y',front:'+X',origin:'body center'},visualApproval:'pending',activation:'not enabled'});
 console.log(`fish ${key}: ${g.index.count/3} triangles, ${bytes.length} bytes`);
}
for(const key of decors){if(requestedKeys.size&&!requestedKeys.has(key))continue;const parts=ornament(key),png=decorPng;
 const triangles=parts.reduce((s,p)=>s+p.geometry.index.count/3,0),bytes=await packGLB(key,parts,png),big=largeDecor.has(key),budget=big?15000:5000;
 if(triangles>budget||bytes.length>(big?1500000:800000))throw new Error(`Budget ${key}: ${triangles}, ${bytes.length}`);
 const file=`public/aqua/models/decor/${key}.glb`;await writeFile(file,bytes);const source=await readFile(`public/aqua/decor/${key}.webp`);
 report.models[key]={kind:'decor',file,triangles,bytes:bytes.length,bones:[],textureSize:[512,512],compression:{format:'EXT_meshopt_compression + KHR_mesh_quantization + EXT_texture_webp',tool:'design/aqua3d-review/glb-compress.mjs',settings:COMPRESSION},materials:1,movingNodes:parts.filter(p=>p.name.startsWith('moving_')).map(p=>p.name),animations:0,sourceSHA256:createHash('sha256').update(source).digest('hex'),approval:'pending',limits:{triangles:budget,bytes:big?1500000:800000}};console.log(`decor ${key}: ${triangles} triangles, ${bytes.length} bytes`);
}
// Another authoring session may finish while this batch runs. Merge only this batch's records.
if(requestedKeys.size){const latest=JSON.parse(await readFile(`${OUT}/models.json`,'utf8'));for(const key of requestedKeys)if(report.models[key])latest.models[key]=report.models[key];await writeFile(`${OUT}/models.json`,JSON.stringify(latest,null,2)+'\n');}
else await writeFile(`${OUT}/models.json`,JSON.stringify(report,null,2)+'\n');
