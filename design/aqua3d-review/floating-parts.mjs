// 몸에서 떨어진 부품 찾기 — 2026-11-17 [사용자: "몸과 다른 부품들이 떨어져있는것처럼 보이면 안대"]
// GLB 를 바인드 자세로 읽어 메시를 '이어진 덩어리'(삼각형이 꼭짓점을 나누는 묶음 — 같은 자리 꼭짓점은 하나로)로 나누고,
// 가장 큰 덩어리(몸)에서 시작해 표면끼리 tol 안으로 닿는 덩어리를 이어 붙인다. 끝까지 안 닿는 덩어리 = 떠 있는 부품.
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export async function floating(file,tolRatio=.012){const bytes=await(await fetch('/'+file,{cache:'no-store'})).arrayBuffer(),scene=(await loader.parseAsync(bytes,'/')).scene;scene.updateMatrixWorld(true);
 const pos=[],tris=[];scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,p=g.attributes.position,base=pos.length/3,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);pos.push(v.x,v.y,v.z);}const idx=g.index?g.index.array:[...Array(p.count).keys()];for(let i=0;i<idx.length;i+=3)tris.push(base+idx[i],base+idx[i+1],base+idx[i+2]);});
 const n=pos.length/3;let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<n;i++)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],pos[i*3+k]);mx[k]=Math.max(mx[k],pos[i*3+k]);}const L=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]),tol=L*tolRatio;
 // 같은 자리 꼭짓점 합치기 + union-find
 const par=new Int32Array(n).map((_,i)=>i),f=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;},u=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
 const key=new Map(),q=L*1e-4;for(let i=0;i<n;i++){const k=Math.round(pos[i*3]/q)+','+Math.round(pos[i*3+1]/q)+','+Math.round(pos[i*3+2]/q);if(key.has(k))u(i,key.get(k));else key.set(k,i);}
 for(let t=0;t<tris.length;t+=3){u(tris[t],tris[t+1]);u(tris[t],tris[t+2]);}
 const comp=new Map();for(let t=0;t<tris.length;t+=3){const r=f(tris[t]);if(!comp.has(r))comp.set(r,{tris:[],pts:[]});comp.get(r).tris.push(tris[t],tris[t+1],tris[t+2]);}
 const P=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]];
 // 표면 표본: 꼭짓점 + 삼각형 무게중심 + 변 가운데(+ 큰 삼각형은 더 촘촘히)
 const comps=[...comp.values()];for(const c of comps){for(let t=0;t<c.tris.length;t+=3){const a=P(c.tris[t]),b=P(c.tris[t+1]),d=P(c.tris[t+2]),m=Math.max(1,Math.ceil(Math.max(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),Math.hypot(a[0]-d[0],a[1]-d[1],a[2]-d[2]))/(tol*1.5)));for(let i=0;i<=m;i++)for(let j=0;j<=m-i;j++){const w1=i/m,w2=j/m,w0=1-w1-w2;c.pts.push(a[0]*w0+b[0]*w1+d[0]*w2,a[1]*w0+b[1]*w1+d[1]*w2,a[2]*w0+b[2]*w1+d[2]*w2);}}}
 comps.sort((a,b)=>b.tris.length-a.tris.length);
 const cell=tol,grid=new Map(),gk=(x,y,z)=>Math.floor(x/cell)+','+Math.floor(y/cell)+','+Math.floor(z/cell);
 const addGrid=c=>{for(let i=0;i<c.pts.length;i+=3){const k=gk(c.pts[i],c.pts[i+1],c.pts[i+2]);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(c.pts[i],c.pts[i+1],c.pts[i+2]);}};
 const near=(c,wide=false)=>{let best=Infinity;if(wide){for(const g of grid.values())for(let j=0;j<g.length;j+=9)for(let i=0;i<c.pts.length;i+=3){const d=Math.hypot(g[j]-c.pts[i],g[j+1]-c.pts[i+1],g[j+2]-c.pts[i+2]);if(d<best)best=d;}return best;}for(let i=0;i<c.pts.length;i+=3){const x=c.pts[i],y=c.pts[i+1],z=c.pts[i+2],cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const g=grid.get((cx+dx)+','+(cy+dy)+','+(cz+dz));if(!g)continue;for(let j=0;j<g.length;j+=3){const d=Math.hypot(g[j]-x,g[j+1]-y,g[j+2]-z);if(d<best)best=d;if(best<tol)return best;}}}return best;};
 const attached=new Set([0]);addGrid(comps[0]);let grew=true;while(grew){grew=false;for(let i=1;i<comps.length;i++){if(attached.has(i))continue;if(near(comps[i])<tol){attached.add(i);addGrid(comps[i]);grew=true;}}}
 const out=[];for(let i=1;i<comps.length;i++)if(!attached.has(i)){const c=comps[i],gap=near(c,true);let s=[0,0,0];for(let j=0;j<c.pts.length;j+=3){s[0]+=c.pts[j];s[1]+=c.pts[j+1];s[2]+=c.pts[j+2];}const m=c.pts.length/3;out.push({tris:c.tris.length/3,gap:+(gap/L).toFixed(3),at:s.map(v=>+(v/m/L).toFixed(3))});}
 return {file,components:comps.length,floating:out};}
export async function floatingAll(){const j=await(await fetch('/design/aqua3d-review/models.json',{cache:'no-store'})).json(),files=new Map();const walk=o=>{if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(v&&typeof v==='object'&&v.file&&String(v.file).endsWith('.glb'))files.set(k,v.file);else walk(v);}};walk(j);const rows=[];for(const [k,f]of files){try{const r=await floating(f);if(r.floating.length)rows.push({key:k,...r});}catch(e){rows.push({key:k,error:String(e).slice(0,60)});}}return {checked:files.size,rows};}
// 떠 있는 덩어리를 빨갛게 칠해 그린 한 장(검수용) — 앞 · 비스듬히 · 위
export async function highlightPNG(file){const r=await floating(file),bytes=await(await fetch('/'+file,{cache:'no-store'})).arrayBuffer(),scene=(await loader.parseAsync(bytes,'/')).scene;scene.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(scene),c=box.getCenter(new T.Vector3()),L=box.getSize(new T.Vector3()).length()*.5,mk=[];
 for(const f of r.floating){const s=new T.Mesh(new T.SphereGeometry(L*Math.max(.04,f.gap>1?0:.04),10,8),new T.MeshBasicMaterial({color:0xff0000,wireframe:true}));const L2=Math.max(box.getSize(new T.Vector3()).x,box.getSize(new T.Vector3()).y,box.getSize(new T.Vector3()).z);s.position.set(f.at[0]*L2,f.at[1]*L2,f.at[2]*L2);mk.push(s);}
 const sc=new T.Scene();sc.background=new T.Color(0xa9b7bc);sc.add(new T.HemisphereLight(0xffffff,0x555555,2));sc.add(scene);for(const m of mk)sc.add(m);
 const rd=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});rd.setSize(900,300);rd.setScissorTest(true);
 [[0,0,1],[1,.6,1.3],[1,0,0]].forEach((v,i)=>{const cam=new T.OrthographicCamera(-L,L,L,-L,.01,100);cam.position.copy(c).add(new T.Vector3(...v).normalize().multiplyScalar(10));cam.lookAt(c);rd.setViewport(i*300,0,300,300);rd.setScissor(i*300,0,300,300);rd.render(sc,cam);});
 return rd.domElement.toDataURL();}
// 실제 틈(몸 길이 대비) — 떠 있는 덩어리마다 붙은 덩어리 표면 표본까지의 가장 가까운 거리(전수)
export async function gaps(file){const r=await floating(file,.012);if(!r.floating.length)return [];const bytes=await(await fetch('/'+file,{cache:'no-store'})).arrayBuffer();void bytes;return r.floating;}
// 그냥 그리기(앞 · 비스듬히 · 옆) — 고치기 전후 비교용
export async function renderPNG(file){const bytes=await(await fetch('/'+file,{cache:'no-store'})).arrayBuffer(),scene=(await loader.parseAsync(bytes,'/')).scene;scene.updateMatrixWorld(true);const box=new T.Box3().setFromObject(scene),c=box.getCenter(new T.Vector3()),L=box.getSize(new T.Vector3()).length()*.5;
 const sc=new T.Scene();sc.background=new T.Color(0xa9b7bc);sc.add(new T.HemisphereLight(0xffffff,0x555555,2.2));const d=new T.DirectionalLight(0xffffff,1.2);d.position.set(2,4,3);sc.add(d);sc.add(scene);
 const rd=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});rd.setSize(900,300);rd.setScissorTest(true);
 [[1,0,0],[1,.6,1.3],[0,0,1]].forEach((v,i)=>{const cam=new T.OrthographicCamera(-L,L,L,-L,.01,100);cam.position.copy(c).add(new T.Vector3(...v).normalize().multiplyScalar(10));cam.lookAt(c);rd.setViewport(i*300,0,300,300);rd.setScissor(i*300,0,300,300);rd.render(sc,cam);});
 const u=rd.domElement.toDataURL();rd.dispose();return u;}
