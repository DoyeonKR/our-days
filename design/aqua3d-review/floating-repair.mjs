// 떠 있는 부품 붙이기 — 2026-11-17 [사용자: "몸과 다른 부품들이 떨어져있는것처럼 보이면 안대"]
// floating-parts-node 의 규칙으로 떠 있는 덩어리를 찾고, 서로 닿는 덩어리끼리 한 묶음으로 보고(풍차 날개 + 축처럼),
// 몸(붙은 쪽)에 가장 가까운 묶음부터 그 틈만큼(+ 몸 길이의 0.6% 더 파고들게) 옮겨 붙인다. 다 붙을 때까지 되풀이.
// 장식은 바닥(가장 낮은 높이)에 닿은 덩어리도 붙은 것으로 친다(수초 잎 · 자갈 · 동전 더미). 일부러 떠 있는 것(거품)은 EXEMPT.
// node design/aqua3d-review/floating-repair.mjs [--dry] [key...]
import * as T from 'three';
import {readFile,writeFile} from 'node:fs/promises';
import {parseGLB,expandGLB,compressGLB} from './glb-compress.mjs';
export const EXEMPT=new Set(['heart_bubbler','feeder_1','feeder_2','feeder_3']); // 하트 거품기의 거품(떠오른다) · 조개 먹이통의 먹이 알갱이(조개 바닥에 놓였다 — 붙이면 진주 속으로 사라진다)
const TOL=.012,PUSH=.006;
function writeGLB(json,bin){const s=Buffer.from(JSON.stringify(json)),jp=Buffer.concat([s,Buffer.alloc((4-s.length%4)%4,32)]),bp=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]),out=Buffer.alloc(28+jp.length+bp.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jp.length,12);out.writeUInt32LE(0x4e4f534a,16);jp.copy(out,20);out.writeUInt32LE(bp.length,20+jp.length);out.writeUInt32LE(0x004e4942,24+jp.length);bp.copy(out,28+jp.length);return out;}
const local=n=>{const m=new T.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new T.Vector3(...(n.translation??[0,0,0])),new T.Quaternion(...(n.rotation??[0,0,0,1])),new T.Vector3(...(n.scale??[1,1,1])));return m;};
// 펼친 GLB → 세계 좌표 꼭짓점 · 삼각형 + 각 꼭짓점이 어느 accessor 의 몇 번째인지
function gather(json,bin){const prims=[];const visit=(i,parent)=>{const n=json.nodes[i],w=parent.clone().multiply(local(n));if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives)prims.push({p,w});for(const c of n.children??[])visit(c,w);};for(const r of json.scenes[json.scene??0].nodes)visit(r,new T.Matrix4());
 const pos=[],tris=[],map=[],seen=new Map();
 const f32=a=>{const acc=json.accessors[a],v=json.bufferViews[acc.bufferView];return new Float32Array(bin.buffer,bin.byteOffset+(v.byteOffset??0)+(acc.byteOffset??0),acc.count*3);};
 const idx=a=>{const acc=json.accessors[a],v=json.bufferViews[acc.bufferView],C=acc.componentType===5125?Uint32Array:acc.componentType===5123?Uint16Array:Uint8Array;return new C(bin.buffer,bin.byteOffset+(v.byteOffset??0)+(acc.byteOffset??0),acc.count);};
 for(const {p,w}of prims){const a=p.attributes.POSITION,P=f32(a),base=pos.length/3;if(!seen.has(a))seen.set(a,{P,w,inv:w.clone().invert()});const v=new T.Vector3();for(let k=0;k<P.length;k+=3){v.set(P[k],P[k+1],P[k+2]).applyMatrix4(w);pos.push(v.x,v.y,v.z);map.push([a,k]);}for(const k of idx(p.indices))tris.push(base+k);}
 return {pos,tris,map,accs:seen};}
function components(pos,tris,L){const n=pos.length/3,par=new Int32Array(n).map((_,i)=>i),f=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;},u=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
 const key=new Map(),q=L*1e-4;for(let i=0;i<n;i++){const k=Math.round(pos[i*3]/q)+','+Math.round(pos[i*3+1]/q)+','+Math.round(pos[i*3+2]/q);if(key.has(k))u(i,key.get(k));else key.set(k,i);}for(let t=0;t<tris.length;t+=3){u(tris[t],tris[t+1]);u(tris[t],tris[t+2]);}
 const cm=new Map();for(let t=0;t<tris.length;t+=3){const r=f(tris[t]);if(!cm.has(r))cm.set(r,{tris:[],verts:new Set()});const c=cm.get(r);c.tris.push(tris[t],tris[t+1],tris[t+2]);for(let k=0;k<3;k++)c.verts.add(tris[t+k]);}
 return [...cm.values()].sort((a,b)=>b.tris.length-a.tris.length);}
function samples(c,pos,step){const out=[];const P=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]];for(let t=0;t<c.tris.length;t+=3){const a=P(c.tris[t]),b=P(c.tris[t+1]),d=P(c.tris[t+2]),m=Math.max(1,Math.ceil(Math.max(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),Math.hypot(a[0]-d[0],a[1]-d[1],a[2]-d[2]),Math.hypot(b[0]-d[0],b[1]-d[1],b[2]-d[2]))/step));for(let i=0;i<=m;i++)for(let j=0;j<=m-i;j++){const w1=i/m,w2=j/m,w0=1-w1-w2;out.push(a[0]*w0+b[0]*w1+d[0]*w2,a[1]*w0+b[1]*w1+d[1]*w2,a[2]*w0+b[2]*w1+d[2]*w2);}}return out;}
function closest(A,B){let best=Infinity,ai=0,bi=0;for(let i=0;i<A.length;i+=3)for(let j=0;j<B.length;j+=3){const d=(A[i]-B[j])**2+(A[i+1]-B[j+1])**2+(A[i+2]-B[j+2])**2;if(d<best){best=d;ai=i;bi=j;}}return {d:Math.sqrt(best),from:[A[ai],A[ai+1],A[ai+2]],to:[B[bi],B[bi+1],B[bi+2]]};}
// 한 번: 붙은 덩어리 · 떠 있는 묶음 계산
export function plan(pos,tris,{ground=false}={}){const n=pos.length/3;let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<n;i++)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],pos[i*3+k]);mx[k]=Math.max(mx[k],pos[i*3+k]);}const L=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]),tol=L*TOL;
 const comps=components(pos,tris,L);for(const c of comps)c.s=samples(c,pos,tol*1.5);
 const near=(a,b)=>{// 대충 상자로 먼저 거른다
  return closest(a.s,b.s).d<tol;};
 const att=new Set([0]);if(ground)comps.forEach((c,i)=>{let lo=1e9;for(const v of c.verts)lo=Math.min(lo,pos[v*3+1]);if(lo-mn[1]<tol)att.add(i);});
 let grew=true;while(grew){grew=false;for(let i=0;i<comps.length;i++){if(att.has(i))continue;for(const j of att)if(near(comps[i],comps[j])){att.add(i);grew=true;break;}}}
 const free=comps.map((_,i)=>i).filter(i=>!att.has(i));if(!free.length)return {L,clusters:[]};
 // 떠 있는 덩어리끼리 닿으면 한 묶음
 const grp=new Map(free.map(i=>[i,i])),g=i=>{while(grp.get(i)!==i)i=grp.get(i);return i;};for(const a of free)for(const b of free)if(a<b&&g(a)!==g(b)&&near(comps[a],comps[b]))grp.set(g(a),g(b));
 const cl=new Map();for(const i of free){const r=g(i);if(!cl.has(r))cl.set(r,[]);cl.get(r).push(i);}
 const attS=[].concat(...[...att].map(i=>comps[i].s));
 const clusters=[...cl.values()].map(m=>{const S=[].concat(...m.map(i=>comps[i].s)),c=closest(S,attS),verts=new Set();for(const i of m)for(const v of comps[i].verts)verts.add(v);return {members:m.length,tris:m.reduce((s,i)=>s+comps[i].tris.length/3,0),gap:c.d/L,from:c.from,to:c.to,verts};}).sort((a,b)=>a.gap-b.gap);
 return {L,clusters};}
export async function repair(file,{ground=false,dry=false}={}){const raw=await readFile(file),plainGLB=await expandGLB(raw),{json,bin:b0}=parseGLB(plainGLB),bin=Buffer.from(b0);
 const moved=[];for(let round=0;round<60;round++){const {pos,tris,map,accs}=gather(json,bin),{L,clusters}=plan(pos,tris,{ground});if(!clusters.length)break;const c=clusters[0];
  const d=new T.Vector3(...c.to).sub(new T.Vector3(...c.from)),len=d.length();if(len>1e-9)d.addScaledVector(d.clone().normalize(),PUSH*L);
  // 같은 accessor 의 같은 꼭짓점을 두 번 옮기지 않게
  const done=new Set();for(const v of c.verts){const [a,k]=map[v],id=a+':'+k;if(done.has(id))continue;done.add(id);const {P,w,inv}=accs.get(a),wp=new T.Vector3(P[k],P[k+1],P[k+2]).applyMatrix4(w).add(d).applyMatrix4(inv);P[k]=wp.x;P[k+1]=wp.y;P[k+2]=wp.z;}
  moved.push({members:c.members,tris:c.tris,gap:+c.gap.toFixed(3)});}
 // accessor min/max 다시
 for(const a of new Set(json.meshes.flatMap(m=>m.primitives.map(p=>p.attributes.POSITION)))){const acc=json.accessors[a],v=json.bufferViews[acc.bufferView],P=new Float32Array(bin.buffer,bin.byteOffset+(v.byteOffset??0)+(acc.byteOffset??0),acc.count*3);acc.min=[1e9,1e9,1e9];acc.max=[-1e9,-1e9,-1e9];for(let i=0;i<P.length;i++){acc.min[i%3]=Math.min(acc.min[i%3],P[i]);acc.max[i%3]=Math.max(acc.max[i%3],P[i]);}}
 if(!dry&&moved.length){const out=await compressGLB(writeGLB(json,bin),{webpQuality:95});await writeFile(file,out);}
 return moved;}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){const args=process.argv.slice(2),dry=args.includes('--dry'),keys=args.filter(a=>!a.startsWith('--'));const j=JSON.parse(await readFile('design/aqua3d-review/models.json','utf8')),files=new Map();const walk=o=>{if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(v&&typeof v==='object'&&v.file&&String(v.file).endsWith('.glb'))files.set(k,{file:v.file,kind:v.kind});else walk(v);}};walk(j);
 for(const [k,{file,kind}]of files){if(keys.length&&!keys.includes(k))continue;if(EXEMPT.has(k))continue;const m=await repair(file,{ground:kind==='decor',dry});if(m.length)console.log(k.padEnd(22),m.length,'moved; gaps',m.map(x=>x.gap).join(' '));}}
