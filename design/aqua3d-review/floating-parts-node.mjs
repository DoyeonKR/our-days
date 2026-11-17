// 몸에서 떨어진 부품 찾기(node 판) — floating-parts.mjs 와 같은 규칙. 2026-11-17
// node design/aqua3d-review/floating-parts-node.mjs [key...]  → 떠 있는 덩어리와 실제 틈(몸 길이 대비)
import * as T from 'three';
import {readFile} from 'node:fs/promises';
import {parseGLB,readDecoded} from './glb-compress.mjs';
export async function loadMesh(file){const {json,bin}=parseGLB(await readFile(file)),pos=[],tris=[];
 const local=n=>{const m=new T.Matrix4();if(n.matrix)m.fromArray(n.matrix);else m.compose(new T.Vector3(...(n.translation??[0,0,0])),new T.Quaternion(...(n.rotation??[0,0,0,1])),new T.Vector3(...(n.scale??[1,1,1])));return m;};
 const visit=async(i,parent)=>{const n=json.nodes[i],w=parent.clone().multiply(local(n));if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const P=await readDecoded(json,bin,p.attributes.POSITION),base=pos.length/3,v=new T.Vector3();for(let k=0;k<P.length;k+=3){v.set(P[k],P[k+1],P[k+2]).applyMatrix4(w);pos.push(v.x,v.y,v.z);}const I=p.indices!==undefined?await readDecoded(json,bin,p.indices):[...Array(P.length/3).keys()];for(const k of I)tris.push(base+k);}for(const c of n.children??[])await visit(c,w);};
 for(const r of json.scenes[json.scene??0].nodes)await visit(r,new T.Matrix4());return {pos,tris,json};}
export function analyze(pos,tris,tolRatio=.012){const n=pos.length/3;let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<n;i++)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],pos[i*3+k]);mx[k]=Math.max(mx[k],pos[i*3+k]);}const L=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]),tol=L*tolRatio;
 const par=new Int32Array(n).map((_,i)=>i),f=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;},u=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
 const key=new Map(),q=L*1e-4;for(let i=0;i<n;i++){const k=Math.round(pos[i*3]/q)+','+Math.round(pos[i*3+1]/q)+','+Math.round(pos[i*3+2]/q);if(key.has(k))u(i,key.get(k));else key.set(k,i);}
 for(let t=0;t<tris.length;t+=3){u(tris[t],tris[t+1]);u(tris[t],tris[t+2]);}
 const cm=new Map();for(let t=0;t<tris.length;t+=3){const r=f(tris[t]);if(!cm.has(r))cm.set(r,{tris:[],verts:new Set(),pts:[]});const c=cm.get(r);c.tris.push(tris[t],tris[t+1],tris[t+2]);for(let k=0;k<3;k++)c.verts.add(tris[t+k]);}
 const P=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]],comps=[...cm.values()].sort((a,b)=>b.tris.length-a.tris.length);
 for(const c of comps)for(let t=0;t<c.tris.length;t+=3){const a=P(c.tris[t]),b=P(c.tris[t+1]),d=P(c.tris[t+2]),m=Math.max(1,Math.ceil(Math.max(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),Math.hypot(a[0]-d[0],a[1]-d[1],a[2]-d[2]),Math.hypot(b[0]-d[0],b[1]-d[1],b[2]-d[2]))/(tol*1.5)));for(let i=0;i<=m;i++)for(let j=0;j<=m-i;j++){const w1=i/m,w2=j/m,w0=1-w1-w2;c.pts.push(a[0]*w0+b[0]*w1+d[0]*w2,a[1]*w0+b[1]*w1+d[1]*w2,a[2]*w0+b[2]*w1+d[2]*w2);}}
 const cell=tol,grid=new Map(),gk=(x,y,z)=>Math.floor(x/cell)+','+Math.floor(y/cell)+','+Math.floor(z/cell),attachedPts=[];
 const addGrid=c=>{for(let i=0;i<c.pts.length;i+=3){const k=gk(c.pts[i],c.pts[i+1],c.pts[i+2]);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(c.pts[i],c.pts[i+1],c.pts[i+2]);attachedPts.push(c.pts[i],c.pts[i+1],c.pts[i+2]);}};
 const touches=c=>{for(let i=0;i<c.pts.length;i+=3){const x=c.pts[i],y=c.pts[i+1],z=c.pts[i+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const g=grid.get((cx+dx)+','+(cy+dy)+','+(cz+dz));if(!g)continue;for(let j=0;j<g.length;j+=3)if(Math.hypot(g[j]-x,g[j+1]-y,g[j+2]-z)<tol)return true;}}return false;};
 const att=new Set([0]);addGrid(comps[0]);let grew=true;while(grew){grew=false;for(let i=1;i<comps.length;i++)if(!att.has(i)&&touches(comps[i])){att.add(i);addGrid(comps[i]);grew=true;}}
 const out=[];for(let i=1;i<comps.length;i++){if(att.has(i))continue;const c=comps[i];// 가장 가까운 두 점(떠 있는 쪽 꼭짓점 → 붙은 표면 표본)
  let best=Infinity,bi=-1,bj=-1;const vs=[...c.verts],step=Math.max(3,Math.floor(attachedPts.length/60000)*3);for(const v of vs){const x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];for(let j=0;j<attachedPts.length;j+=step){const d=(attachedPts[j]-x)**2+(attachedPts[j+1]-y)**2+(attachedPts[j+2]-z)**2;if(d<best){best=d;bi=v;bj=j;}}}
  out.push({tris:c.tris.length/3,verts:vs,gap:Math.sqrt(best)/L,from:P(bi),to:[attachedPts[bj],attachedPts[bj+1],attachedPts[bj+2]]});}
 return {L,tol,components:comps.length,floating:out};}
if(import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){const keys=process.argv.slice(2);const j=JSON.parse(await readFile('design/aqua3d-review/models.json','utf8')),files=new Map();const walk=o=>{if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(v&&typeof v==='object'&&v.file&&String(v.file).endsWith('.glb'))files.set(k,v.file);else walk(v);}};walk(j);
 for(const [k,f]of files){if(keys.length&&!keys.includes(k))continue;const {pos,tris}=await loadMesh(f),r=analyze(pos,tris);if(r.floating.length)console.log(k.padEnd(22),String(r.floating.length).padStart(3),'max gap',Math.max(...r.floating.map(x=>x.gap)).toFixed(3),'tris',r.floating.reduce((s,x)=>s+x.tris,0));}}
