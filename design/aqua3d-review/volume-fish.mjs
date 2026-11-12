/** Closed volume + separate anatomical fins. No whole-animal silhouette plate.
 * Explicitly selected expansion forms and legacy shark revisions only.
 */
import * as T from 'three';
import {fitBody} from './fish-fit.mjs';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
// Legacy sharks must use a volumetric trunk and a single pair of swept fins.
// Hammerhead and megamouth retain their specialised head sculptures.
export const SHARK_PROFILES=new Map([
 ['leopard_shark',.105,.28],['blue_shark',.085,.44],
 ['nurse_shark',.125,.25],['great_white',.15,.34],
].map(([key,widthRatio,finSpan])=>[key,{key,body:'fish',widthRatio,finSpan,shark:true}]));
// These references have split jaws or sharply tapered faces. A morphological
// opening can jump between jaw fragments; never inflate its centre with a
// radius averaged from unrelated neighbouring columns.
export const HEAD_CONTOUR_FAMILIES=new Set(['frilled_shark','moray','butterflyfish','corydoras','molly','barracuda']);
export function headContour(ref,u){
 const [l,t,r,b]=ref.bounds,H=b-t,W=r-l,edges=[];
 for(const dx of [-1,0,1]){
  const x=clamp(Math.round(l+u*W)+dx,0,ref.info.width-1),runs=[];
  for(let y=t;y<=b;){
   if(ref.data[(y*ref.info.width+x)*4+3]<=96){y++;continue;}
   const a=y;while(y<=b&&ref.data[(y*ref.info.width+x)*4+3]>96)y++;
   if(y-a>=2)runs.push([a,y-1]);
  }
  if(runs.length)edges.push([runs[0][0],runs.at(-1)[1]]);
 }
 if(!edges.length)return null;
 const top=edges.reduce((n,e)=>n+e[0],0)/edges.length,bottom=edges.reduce((n,e)=>n+e[1],0)/edges.length;
 return {center:((top+bottom)/2-t)/H,half:Math.max(.001,(bottom-top)/2/H)};
}
// Monotone cubic interpolation: no overshoot, bulbous tail or ring-wise steps.
export function widthCurve(s,kind='fish'){
 const knots=kind==='eel'?[[0,0],[.035,.14],[.14,.32],[.36,.64],[.64,.92],[.80,1],[.94,.70],[1,0]]:
  [[0,0],[.035,.19],[.14,.25],[.34,.55],[.58,.92],[.70,1],[.84,.84],[.95,.48],[1,0]];
 let i=0;while(i<knots.length-2&&s>knots[i+1][0])i++;
 const slope=j=>{if(j===0||j===knots.length-1)return 0;const a=(knots[j][1]-knots[j-1][1])/(knots[j][0]-knots[j-1][0]),b=(knots[j+1][1]-knots[j][1])/(knots[j+1][0]-knots[j][0]);return a*b<=0?0:2*a*b/(a+b);};
 const [x0,y0]=knots[i],[x1,y1]=knots[i+1],h=x1-x0,t=clamp((s-x0)/h);
 return Math.max(0,(2*t**3-3*t*t+1)*y0+(t**3-2*t*t+t)*h*slope(i)+(-2*t**3+3*t*t)*y1+(t**3-t*t)*h*slope(i+1));
}
export function bodyProfile(family,ref,profile){
 const [l,t,r,b]=ref.bounds,W=r-l,H=b-t,ratio=2*H/W,X=u=>(u-.5)*2,Y=v=>(.5-v)*ratio;
 const fitted=fitBody(ref,240,profile.shark?.34:.62),headFixed=HEAD_CONTOUR_FAMILIES.has(family)||profile.shark;
 // Recover narrow snouts lost by the body-core opening (e.g. barracuda).
 const snoutEnd=family==='barracuda'||profile.shark?.9979166666666667:fitted.s1;
 const raw=headFixed?{...fitted,s1:snoutEnd,sample(s){const u=fitted.s0+s*(snoutEnd-fitted.s0),q=fitted.sample(clamp((u-fitted.s0)/(fitted.s1-fitted.s0)));return {...q,u};}}:fitted;
 const long=profile.body==='eel',bill=['marlin','swordfish','halfbeak'].includes(family),box=profile.body==='box';
 const head=raw.sample(bill?.94:.82),tail=raw.sample(.08),peak=head.half*(profile.body==='compressed'?1.40:1.22);
 const sample=s=>{
  const q=raw.sample(clamp(s)),near=[-.06,-.03,0,.03,.06].map(d=>raw.sample(clamp(s+d)));
  const half=near.reduce((n,v)=>n+v.half,0)/near.length,baseline=tail.center+(head.center-tail.center)*s;
  const center=long?q.center:clamp(near.reduce((n,v)=>n+v.center,0)/near.length,baseline-.025,baseline+.025);
  const cap=long||profile.body==='disc'?half:Math.min(half,peak*(.25+.75*Math.sin(Math.PI*clamp(s))**.65));
  const onset=profile.shark?.80:.64,contour=headFixed&&q.u>onset?headContour(ref,q.u):null;
  if(contour){const blend=smooth((q.u-onset)/(profile.shark?.10:.14)),c=center+(contour.center-center)*blend,h=cap+(contour.half-cap)*blend;
   return {u:q.u,center:c,half:Math.max(.001,h),sourceCenter:c};}
  return {u:q.u,center,half:Math.max(.001,cap),sourceCenter:bill||profile.shark?center:q.center};
 };
 const sourceAt=u=>sample(clamp((u-raw.s0)/(raw.s1-raw.s0)));
 const center=[X((raw.s0+raw.s1)/2),Y(sample(.5).center),0];
 return {l,t,r,b,W,H,ratio,X,Y,raw,long,bill,box,peak,sample,sourceAt,center};
}
export function volumeFish(family,key,ref,profile){
 const positions=[],uvs=[],indices=[],joints=[],weights=[],regions=[];
 const {l,t,r,b,W,H,ratio,X,Y,raw,long,bill,box,peak,sample,sourceAt,center}=bodyProfile(family,ref,profile);
 const paint=(u,v)=>[(l+clamp(u)*W)/ref.info.width,.5+(t+clamp(v)*H)/ref.info.height*.5];
 const skin=(x,fin=null)=>{
  if(fin){const root=fin.side>0?6:8,f=smooth(fin.t);return {ids:[root,root+1,0,0],ws:[1-f,f,0,0]};}
  if(!long&&x>=.65)return {ids:[0,0,0,0],ws:[1,0,0,0]};
  const q=clamp((.85-x)/.34,0,5);
  const j=Math.floor(q),f=q-j,a=[(1-f)**3/6,(3*f**3-6*f*f+4)/6,(-3*f**3+3*f*f+3*f+1)/6,f**3/6],map=new Map();
  [j-1,j,j+1,j+2].forEach((n,i)=>{n=clamp(n,0,5);map.set(n,(map.get(n)||0)+a[i]);});
  if(!long&&x>.30){const gain=smooth((.65-x)/.35);for(const [n,w]of map)map.set(n,w*gain);map.set(0,(map.get(0)||0)+1-gain);}
  const ids=[...map.keys()],ws=[...map.values()];while(ids.length<4){ids.push(0);ws.push(0);}return {ids,ws};
 };
 const vertex=(p,tex,fin=null)=>{const index=positions.length/3;positions.push(...p);uvs.push(...tex);const s=skin(p[0],fin);joints.push(...s.ids);weights.push(...s.ws);return index;};
 const rows=40,cols=16;
 // Retain the 41x17 body-ring prefix expected by the game's top-view adapter.
 for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
  const s=j/rows,q=sample(s),a=k/cols*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),end=j===0||j===rows;
  const radius=end?0:q.half*ratio,depth=profile.widthRatio*widthCurve(s,long?'eel':'fish')*(bill?Math.min(1,q.half/(peak*.5)):1);
  const C=box?Math.sign(c)*Math.abs(c)**.55:family==='pleco'?Math.max(-.80,c):c,S=box?Math.sign(sn)*Math.abs(sn)**.55:sn;
  const p=[X(q.u),Y(q.center)+C*radius,S*depth];
  // Side projection stays faithful. Only the crown samples an inset back band;
  // its lateral range is broad enough not to smear a single outline row.
  const theta=Math.acos(clamp(c,-1,1));
  vertex(p,[q.u,(.5+254*theta/Math.PI)/512]);
  if(j<rows&&k<cols){const n=j*(cols+1)+k;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
 }
 regions.push({name:'closed_body',start:0,end:positions.length/3});
 const alpha=(x,y)=>x<0||y<0||x>=ref.info.width||y>=ref.info.height?0:ref.data[(Math.round(y)*ref.info.width+Math.round(x))*4+3];
 const outline=u=>{const x=Math.round(l+u*W);let lo=b,hi=t;for(let y=t;y<=b;y++)if(alpha(x,y)>110){lo=Math.min(lo,y);hi=Math.max(hi,y);}return lo>hi?null:{top:(lo-t)/H,bottom:(hi-t)/H};};
 // Median fins only: roots lie inside the body, no head/face/body image plate.
 for(const sign of [1,-1]){
  const strip=[],N=40,limit=bill?(sign>0?raw.s1-.03:raw.s0+(raw.s1-raw.s0)*.60):family==='lionfish'?.91:long?.83:.79;
  for(let j=0;j<=N;j++){
   const u=raw.s0+(raw.s1-raw.s0)*j/N,q=sourceAt(u),edge=outline(u),height=edge?(sign>0?q.center-q.half-edge.top:edge.bottom-q.center-q.half)*ratio:0;
   // The source's near pectoral is not a ventral midline fin. It is rebuilt
   // later as a lateral swept foil, never duplicated as a vertical image plate.
   strip.push({u,q,edge,height:u>limit||profile.shark&&sign<0&&u>.40&&u<.82?0:height});
  }
  const start=positions.length/3;
  for(let j=0;j<N;j++){
   const A=strip[j],B=strip[j+1];if(Math.max(A.height,B.height)<.035||!A.edge||!B.edge)continue;
   const base=positions.length/3;
   for(const side of [-1,1])for(const q of [A,B])for(let k=0;k<=2;k++){
    const f=k/2,root=q.q.center-sign*q.q.half*.88,edge=q.height>0?(sign>0?q.edge.top:q.edge.bottom):root,v=root+(edge-root)*f;
    vertex([X(q.u),Y(v),side*(.014*(1-f)**1.3+.0008)],paint(q.u,v));
   }
   for(let side=0;side<2;side++)for(let k=0;k<2;k++){
    const a=base+side*6+k,b=a+3;if(side===0)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b);
   }
   indices.push(base+2,base+5,base+8,base+5,base+11,base+8);
  }
  regions.push({name:sign>0?'dorsal_fin':'anal_fin',start,end:positions.length/3});
 }
 // Isolate the actual tail silhouette, never extrude the whole fish outline.
 const cut=raw.s0+.025,startTail=positions.length/3;
 const clip=loop=>{const out=[];for(let j=0;j<loop.length;j++){const A=loop[(j+loop.length-1)%loop.length],B=loop[j],a=A[0]<=cut,b=B[0]<=cut;if(a!==b){const f=(cut-A[0])/(B[0]-A[0]);out.push([cut,A[1]+f*(B[1]-A[1])]);}if(b)out.push(B);}return out;};
 for(const loop of long?[]:ref.loops){const points=clip(loop).map(p=>new T.Vector2(...p));if(points.length<3)continue;const tris=T.ShapeUtils.triangulateShape(points,[]),base=positions.length/3;
  for(const side of [-1,1])for(const p of points)vertex([X(p.x),Y(p.y),side*(.001+.012*smooth(p.x/(cut||1)))],paint(p.x,p.y));
  const n=points.length;for(const tri of tris){indices.push(...tri.map(i=>base+i),...tri.toReversed().map(i=>base+n+i));}
  for(let j=0;j<n;j++){const k=(j+1)%n;indices.push(base+j,base+k,base+n+j,base+k,base+n+k,base+n+j);}
 }
 regions.push({name:'caudal_fin',start:startTail,end:positions.length/3});
 if(bill){
  // The bill is tissue, not a transparent silhouette fin. Morphological body
  // fitting intentionally drops this narrow part, so build a tapered volume.
  const start=positions.length/3,q=sample(.97),tip=outline(.985),v=tip?(tip.top+tip.bottom)/2:q.sourceCenter;
  const x0=X(q.u)-.025,x1=.995,y0=Y(q.center),y1=Y(v),R=8,C=8;
  for(let j=0;j<=R;j++)for(let k=0;k<=C;k++){
   const f=j/R,a=k/C*Math.PI*2,r=(family==='halfbeak'?.009:.014)*(1-f)**.85;
   vertex([x0+(x1-x0)*f,y0+(y1-y0)*f+Math.cos(a)*r,Math.sin(a)*r],paint(q.u+(1-q.u)*f,v));
   if(j<R&&k<C){const n=start+j*(C+1)+k;indices.push(n,n+1,n+C+1,n+1,n+C+2,n+C+1);}
  }
  regions.push({name:'solid_bill',start,end:positions.length/3});
 }
 // Thin, cambered, swept leaf fins with a real root and flexible distal region.
 if(profile.shark)for(const side of [-1,1]){
  const start=positions.length/3,q=sample(.71),rootX=X(q.u),rootY=Y(q.center)-q.half*ratio*.35,rootZ=profile.widthRatio*widthCurve(.71)*.85;
  const span=profile.finSpan*(key.startsWith('fry_')?.8:key.startsWith('juv_')?.9:1),R=8,C=4;
  // Triangular swept planform with a broad attached root, thin edges and
  // camber. Both surfaces meet at their leading/trailing edges and tip.
  for(const face of [-1,1])for(let j=0;j<=R;j++)for(let k=0;k<=C;k++){
   const f=j/R,v=k/C,chord=.22*(1-f),sweep=.30*f;
   const x=rootX-sweep-v*chord,y=rootY-.045*f+face*.008*Math.sin(Math.PI*v)*(1-f),z=side*(rootZ+span*f);
   const sourceU=clamp(q.u-sweep/2-v*chord/2),sourceV=clamp(q.center+q.half+(span*f)/ratio);
   vertex([x,y,z],paint(sourceU,sourceV),{side,t:f*.85});
   if(j<R&&k<C){const a=start+(face===1?(R+1)*(C+1):0)+j*(C+1)+k;
    if(face<0)indices.push(a,a+C+1,a+1,a+1,a+C+1,a+C+2);else indices.push(a,a+1,a+C+1,a+1,a+C+2,a+C+1);}
  }
  regions.push({name:side>0?'pectoral_L':'pectoral_R',start,end:positions.length/3});
 }
 else if(family!=='moray')for(const side of [-1,1]){
  const start=positions.length/3,s=.72,q=sample(s),anchor=[X(q.u),Y(q.center)-q.half*ratio*.28,side*profile.widthRatio*widthCurve(s)];
  const gain=['box','disc','blob'].includes(profile.body)?.48:long?.42:1,R=6,C=4;
  for(const face of [-1,1])for(let j=0;j<=R;j++)for(let k=0;k<=C;k++){
   const f=j/R,v=k/C*2-1,spread=Math.sin(Math.PI*f),x=anchor[0]-.29*f*gain+v*.075*spread*gain;
   const y=anchor[1]-.09*f*gain+.025*spread*(1-v*v)+face*.002*spread*(1-v*v);
   const z=anchor[2]+side*(.20*f*gain+.035*spread*(1-v*v));
   vertex([x,y,z],paint(clamp(q.u-.12*f*gain),q.sourceCenter+q.half*(.25+.25*v)),{side,t:f*.9});
   if(j<R&&k<C){const a=start+(face===1?(R+1)*(C+1):0)+j*(C+1)+k;
    if(face<0)indices.push(a,a+C+1,a+1,a+1,a+C+1,a+C+2);else indices.push(a,a+1,a+C+1,a+1,a+C+2,a+C+1);
   }
  }
  regions.push({name:side>0?'pectoral_L':'pectoral_R',start,end:positions.length/3});
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(indices);g.computeVertexNormals();
 const n=g.attributes.normal;
 for(let j=0;j<=rows;j++){const a=j*17,b=a+16,v=new T.Vector3(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
 for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.01)n.setXYZ(i,i<17?-1:1,0,0);
 g.translate(-center[0],-center[1],0);g.userData={bodyCenter:center,authoring:'closed-volume-v3',regions,bodyRingVertices:697,wholeBodyPlate:false,swimmingMode:long?'anguilliform':['box','disc','blob'].includes(profile.body)?'fin-propelled':'body-caudal'};
 return g;
}
