/** Original anatomical sculpture: closed radial bodies, attached membranes,
 * protruding eyes/lips, swept ray wings and revolved jellyfish bells.
 * Source paintings supply colour only; no image planes or silhouette extrusion.
 */
import * as T from 'three';
import {anatomy} from '../../src/lib/aqua3d/anatomy.ts';
import {fitBody} from './fish-fit.mjs';
import {volumeFish} from './volume-fish.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function sculptFish(family,key,ref,profile=null){
 if(profile&&!['upright'].includes(profile.body)&&!['skate','goosefish'].includes(family))return volumeFish(family,key,ref,profile);
 const a=anatomy(family,key),p=[],uv=[],ix=[],joint=[],weight=[];
 let bellVertexCount=0;
 const pairedRanges=[];
 let profileFit=null;
 if(key==='pearl_carp')Object.assign(a,{cx:.61,cy:.50,rx:.27,ry:.20,depth:.25});
 const young=key.startsWith('fry_')?1:key.startsWith('juv_')?.45:0;
 if(young){a.rx*=1-.17*young;a.ry*=1+.09*young;a.depth*=1+.18*young;a.cx+=.025*young;}
 const [l,t,r,b]=ref.bounds,w=r-l,h=b-t,ratio=2*h/w;
 const X=u=>(u-.5)*2,Y=v=>(.5-v)*ratio;
 const paint=(u,v)=>[(l+u*w)/ref.info.width,(t+v*h)/ref.info.height];
 const swatch=i=>[(i*8+4)/512,4/512];
 const append=(g,paintAt,at=[0,0,0],scale=[1,1,1],rotation=null)=>{
  g.scale(...scale);if(rotation)g.applyMatrix4(rotation);g.translate(...at);
  const pos=g.attributes.position,off=p.length/3;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);p.push(x,y,z);uv.push(...(typeof paintAt==='function'?paintAt(x,y,z):paintAt));}
  for(let i=0;i<(g.index?.count??pos.count);i++)ix.push(off+(g.index?g.index.getX(i):i));
 };
 const geo=(v,u,ind)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(u,2));g.setIndex(ind);g.computeVertexNormals();const normal=g.attributes.normal;for(let i=0;i<normal.count;i++)if(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))<.001)normal.setXYZ(i,1,0,0);return g;};
 const surface=(rows,cols,point,texture,wrap=false)=>{const v=[],u=[],ind=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const xyz=point(j/rows,i/cols);v.push(...xyz);u.push(...texture(...xyz,j/rows,i/cols));if(j<rows&&i<cols){const k=j*(cols+1)+i;ind.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}append(geo(v,u,ind),(x,y,z)=>texture(x,y,z));};
 const ball=(at,scale,col,segments=10,rings=6)=>append(new T.SphereGeometry(1,segments,rings),typeof col==='number'?swatch(col):col,at,scale);
 const tube=(pts,radius,col,steps=14,sides=5)=>append(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v))),steps,radius,sides,false),typeof col==='number'?swatch(col):col);
 const eyes=(x,y,z,size)=>{for(const s of[-1,1]){ball([x,y,s*z],[size*1.05,size,size*.62],1);ball([x+size*.13,y,s*(z+size*.50)],[size*.60,size*.64,size*.20],0);ball([x+size*.29,y+size*.26,s*(z+size*.68)],[size*.17,size*.17,size*.11],2,8,5);}};
 const dorsalProfile=profile&&['skate','goosefish'].includes(family);
 const ray=a.kind==='ray'||dorsalProfile,jelly=a.kind==='jelly',dragon=a.kind==='dragon';
 const flatfish=family==='flounder'&&key!=='fry_flounder';
 const cephalopod=a.kind==='cephalopod';
 const shark=['nurse_shark','leopard_shark','blue_shark','hammerhead','great_white','megamouth'].includes(family);
 const membranes=(dorsal=false)=>{
  // Exact contour-constrained triangulation leaves forked tails and narrow
  // filaments open; a scanline strip would incorrectly bridge these gaps.
  const inside=(pt,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const A=poly[i],B=poly[j];if((A[1]>pt[1])!==(B[1]>pt[1])&&pt[0]<(B[0]-A[0])*(pt[1]-A[1])/(B[1]-A[1])+A[0])yes=!yes;}return yes;};
  const clipHead=loop=>{const out=[],cut=.77;for(let i=0;i<loop.length;i++){const A=loop[(i+loop.length-1)%loop.length],B=loop[i],a=A[0]<=cut,b=B[0]<=cut;if(a!==b){const f=(cut-A[0])/(B[0]-A[0]);out.push([cut,A[1]+f*(B[1]-A[1])]);}if(b)out.push(B);}return out;};
  const loops=ref.loops,parents=loops.map((loop,i)=>loops.reduce((p,c,j)=>j<i&&inside(loop[0],c)?j:p,-1)),depth=i=>parents[i]<0?0:depth(parents[i])+1;
  for(let j=0;j<loops.length;j++){if(depth(j)%2)continue;const contour=loops[j].map(q=>new T.Vector2(...q)),holes=loops.filter((_,i)=>parents[i]===j).map(c=>c.map(q=>new T.Vector2(...q))),points=[...contour,...holes.flat()],tris=T.ShapeUtils.triangulateShape(contour,holes),v=[],tex=[],ind=[];
   for(const point of points){const q=point.x,vv=point.y;for(const side of[-1,1]){if(dorsal){const z=(vv-a.cy)*ratio,body=Math.sqrt(Math.max(0,1-((q-a.cx)/a.rx)**2-((vv-a.cy)/a.ry)**2));v.push(X(q),side*(.004+a.depth*.60*body),z);}else{const r=Math.hypot(q-a.cx,vv-a.cy),th=Math.atan2(vv-a.cy,q-a.cx);
    let thickness=.004,height=Y(vv);
    if(profileFit){const f=profileFit.sample(clamp((q-profileFit.s0)/(profileFit.s1-profileFit.s0))),outside=Math.max(0,Math.abs(vv-f.center)-f.half)*ratio;thickness=.002+.028*Math.exp(-outside/.08);
     // Hide the painted body-outline seam inside the radial trunk, not above its back.
     if(q>=profileFit.s0&&q<=profileFit.s1){const radius=f.half*ratio,tolerance=Math.min(.16,radius*.65);
      if(outside<tolerance)height=Y(f.center)+Math.sign(height-Y(f.center))*Math.min(Math.abs(height-Y(f.center)),Math.max(0,radius-Math.min(.015,radius*.15)));
     }
    }
    v.push(X(q),height,(cephalopod?r*.55*Math.sin(th*4+r*6):0)+side*thickness);}tex.push(...paint(q,vv));}}
   for(const tri of tris){ind.push(...tri.map(i=>i*2),...tri.toReversed().map(i=>i*2+1));}
   const edges=new Map();for(const tri of tris)for(let i=0;i<3;i++){const A=tri[i],B=tri[(i+1)%3],k=[A,B].sort((a,b)=>a-b).join(':');if(edges.has(k))edges.delete(k);else edges.set(k,[A,B]);}for(const[A,B]of edges.values())ind.push(A*2,B*2,A*2+1,B*2,B*2+1,A*2+1);
   const g=geo(v,tex,ind);const off=p.length/3;p.push(...g.attributes.position.array);uv.push(...g.attributes.uv.array);ix.push(...Array.from(g.index.array,i=>i+off));
  }
 };
 let fitMid=null;
 if(dorsalProfile){
  const fit=fitBody(ref);a.cx=(fit.s0+fit.s1)/2;a.cy=fit.cMid;a.rx=(fit.s1-fit.s0)/2;a.ry=fit.hMax;a.depth=family==='skate'?.055:.12;
  surface(40,16,(s,u)=>{const q=fit.sample(s),th=u*Math.PI*2,end=s<=0||s>=1;return[X(q.u),end?0:Math.sin(th)*a.depth*Math.sin(Math.PI*s)**.45,((q.center-.5)+Math.cos(th)*(end?0:q.half))*ratio];},(x,y,z)=>paint(clamp((x+1)/2),clamp(.5+z/ratio)));
  membranes(true);
  // Preserve the painted dorsal contour, scale lateral width to the species contract.
  const maxZ=Math.max(...p.filter((_,i)=>i%3===2).map(Math.abs));
  for(let i=2;i<p.length;i+=3)p[i]*=profile.widthRatio/(maxZ||1);
 }else if(flatfish){
  // Metamorphosed flatfish lie horizontally; the ocular face is +Y, not a vertical fish slab.
  membranes(true);
  ball([X(a.cx),0,0],[a.rx*2,a.depth,ratio*a.ry],(x,y,z)=>paint(clamp((x+1)/2),clamp(a.cy+z/ratio)),18,10);
  for(const [dx,z]of[[.00,-.065],[.10,.035]]){
   ball([X(a.cx+a.rx*.70)+dx,.070,z],[.026,.018,.025],1,8,5);
   ball([X(a.cx+a.rx*.70)+dx,.085,z],[.013,.005,.014],0,8,4);
  }
  ball([X(a.cx+a.rx*.99),.012,0],[.012,.018,.055],3,8,4);
 }else if(family==='jellyfish'){
  const ephyra=key==='fry_jellyfish',R=ephyra?.69:.78;
  surface(12,32,(s,u)=>{const th=u*Math.PI*2,outer=s<=.70,q=outer?s/.70:(1-s)/.30,rr=Math.sin(q*Math.PI/2)*R*(ephyra?.72+.28*Math.cos(th*8)**2:1+.012*Math.cos(th*32)),x=outer?.76-.56*(1-Math.cos(q*Math.PI/2)):.20+.08*(1-q);return[x,Math.cos(th)*rr,Math.sin(th)*rr];},(x,y,z)=>paint(clamp(.5+y*.52),clamp(.18+(.76-x)*.52)));
  if(!ephyra)for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4,cy=Math.cos(a)*.27,cz=Math.sin(a)*.27,pts=[];for(let j=0;j<=10;j++){const th=-Math.PI*.3+j/10*Math.PI*1.6;pts.push([.63,cy+Math.cos(th)*.12,cz+Math.sin(th)*.12]);}tube(pts,.010,4,10,5);}
  bellVertexCount=p.length/3;
  const count=ephyra?8:24;
  for(let k=0;k<count;k++){const th=k/count*Math.PI*2,pts=[];for(let j=0;j<=6;j++){const s=j/6;pts.push([.20-s*(ephyra?.10:.19),Math.cos(th)*(R+s*.025),Math.sin(th)*(R+s*.025)]);}tube(pts,ephyra?.005:.0045,5,6,4);}
  if(!ephyra)for(let k=0;k<4;k++){const th=k*Math.PI/2,pts=[];for(let j=0;j<=10;j++){const s=j/10;pts.push([.24-s*.45,Math.cos(th)*(.09+s*.12)+Math.sin(s*7+k)*.035,Math.sin(th)*(.09+s*.12)]);}tube(pts,.025,5,10,5);}
 }else if(jelly){
  // Closed radial bell: domed exterior and a recessed, thick inner rim.
  surface(16,28,(s,u)=>{const theta=u*Math.PI*2,rr=Math.sin(s*Math.PI)*.52*(1+.018*Math.cos(theta*20)),x=.96-s*.69;return[x,Math.cos(theta)*rr,Math.sin(theta)*rr];},(x,y,z)=>paint(.5+y*.72,.08+(1-x)*.35));
  bellVertexCount=p.length/3;
  for(let k=0;k<16;k++){const theta=k/16*Math.PI*2,rad=k%3===0?.022:.008,pts=[];for(let i=0;i<13;i++){const s=i/12;pts.push([.34-s*(1.05+(k%3)*.10),Math.cos(theta)*(.33+s*.05)+Math.sin(s*9+k)*s*.04,Math.sin(theta)*(.33+s*.05)+Math.cos(s*8+k)*s*.04]);}tube(pts,rad,paint(.48,.55),12,k%3===0?6:4);}
 }else if(ray){
  // Wing planform is sampled from the dorsal reference; camber and thickness
  // are actual surfaces, with an anatomical central body rather than a slab.
  membranes(true);
  // Raised thorax supplies continuous volume above the contour membrane.
  ball([X(a.cx),0,0],[a.rx*1.8,a.depth*.65,ratio*a.ry*.7],(x,y,z)=>paint(clamp((x+1)/2),clamp(a.cy+z/ratio)),16,10);
  eyes(X(a.cx+a.rx*.48),.09,ratio*a.ry*.24,.020);
  if(family==='manta')for(const s of[-1,1])tube([[.75,.015,s*.10],[.92,.025,s*.15],[1.02,.08,s*.12]],.025,paint(.88,.48),9,6);
 }else if(dragon){
  // Straight bind pose: articulated serpentine trunk, cheek/jaw volumes,
  // branching antlers, long barbels and scalloped fins all modelled in 3D.
  surface(35,14,(s,u)=>{const x=-.97+s*1.70,r=.015+.115*Math.sin(Math.PI*s)**.7,th=u*Math.PI*2;return[x,Math.cos(th)*r,Math.sin(th)*r*.88];},(x,y,z)=>paint(clamp((x+1)/2),clamp(.49-y*1.3)));
  ball([.76,.035,0],[.20,.135,.145],paint(.83,.46),16,10);ball([.92,-.012,0],[.13,.065,.09],paint(.89,.52),12,7);ball([.89,-.078,0],[.14,.022,.095],paint(.85,.55));eyes(.82,.075,.125,.026);
  for(const s of[-1,1]){for(let k=0;k<3;k++){const x=.72-k*.075; tube([[x,.12,s*.06],[x-.07,.25,s*.105],[x-.21,.34+k*.025,s*.14]],.011,paint(.75,.33),10);tube([[x-.07,.25,s*.105],[x-.05,.34,s*.16]],.007,paint(.75,.33),5);}
   tube([[.95,-.02,s*.065],[.89,-.15,s*.12],[.67,-.21,s*.16],[.42,-.16,s*.15]],.005,paint(.8,.36),18);
  }
  for(let k=0;k<17;k++){const x=-.87+k*.085,base=.045+.075*Math.sin((k+1)/18*Math.PI),v=[x,base,0,x-.075,base+.13,0,x+.055,base+.065,0];append(geo(v,[0,0,0,0,0,0],[0,1,2]),paint(.4,.35));}
  for(const s of[-1,1]){const v=[.31,-.025,s*.09,.10,-.15,s*.36,-.07,-.10,s*.20];append(geo(v,[0,0,0,0,0,0],[0,1,2]),paint(.4,.4));}
 }else if(['oarfish','hairtail','eel'].includes(family)){
  // Ribbon trunk follows the silver tissue, not an ellipse spanning the tall red crest.
  const samples=[];
  for(let j=0;j<=40;j++){
   const s=j/40,px=Math.round(l+s*w),ys=[];
   for(let yy=t;yy<=b;yy++){const off=(yy*ref.info.width+px)*4,R=ref.data[off],G=ref.data[off+1],B=ref.data[off+2];if(ref.data[off+3]>160&&(family==='oarfish'?G>R*.78&&B>R*.76:true))ys.push(yy);}
   const lo=ys.length?ys[0]:t+h*.65,hi=ys.length?ys.at(-1):lo+2;
   samples.push({center:(lo+hi)/2,half:Math.max(1,(hi-lo)/2)});
  }
  surface(40,16,(s,u)=>{const j=Math.min(40,Math.round(s*40)),c=samples[j],th=u*Math.PI*2,edge=Math.sin(Math.PI*s)**.45,depth=family==='hairtail'?.030:family==='eel'?.070:.065;return[X(s),Y((c.center-t)/h)+Math.cos(th)*c.half*2/w,Math.sin(th)*(.006+depth*edge)];},(x,y,z)=>paint(clamp((x+1)/2),clamp(.5-y/ratio)));
  membranes();
  for(const s of[-1,1])ball([.63,-.02,s*a.depth*1.4],[.07,.025,.06],paint(.8,.66),8,5);
 }else if(family==='anglerfish'){
  // The lure is already a separate narrow silhouette: do not duplicate it or inflate the empty mouth.
  const cx=.52,cy=.66,rx=.26,ry=.28;
  surface(20,24,(s,u)=>{const th=u*Math.PI*2,q=Math.cos(s*Math.PI),r=Math.sin(s*Math.PI);return[X(cx+q*rx),Y(cy)+Math.cos(th)*r*ry*ratio,Math.sin(th)*r*.29];},(x,y,z)=>paint(clamp((x+1)/2),clamp(.5-y/ratio)));
  membranes();
  for(const s of[-1,1])ball([X(.46),Y(.65),s*a.depth*.95],[.12,.10,.08],paint(.4,.6),8,5);
 }else{
  // 몸통은 세로줄마다 그림의 위 · 아래에 맞춘 고리다 — 옆에서 보면 윤곽이 그림과 같다(fish-fit). 눈 · 아가미 · 입은 그림에 있으므로 덧붙이지 않는다
  const rawFit=fitBody(ref,200,profile ? .65 : .34);
  let fit=rawFit;
  if(profile&&!['upright','eel','disc'].includes(profile.body)){
   // A broad dorsal-fin root can survive morphological opening. Constrain the trunk
   // with fin-free head/peduncle landmarks; the separate contour still keeps the fin.
   const tail=rawFit.sample(.08),head=rawFit.sample(['marlin','swordfish','halfbeak'].includes(family) ? .60 : .82),peak=head.half*1.22;
   fit={...rawFit,hMax:peak,cMid:(tail.center+head.center)/2,sample:s=>{
    const q=rawFit.sample(s),center=tail.center+(head.center-tail.center)*s;
    return {...q,center:clamp(q.center,center-.025,center+.025),half:Math.min(q.half,peak*(.24+.76*Math.sin(Math.PI*s)**.6))};
   }};
  }
  if(profile){profileFit=fit;a.cx=(fit.s0+fit.s1)/2;a.cy=fit.cMid;}fitMid=Y(fit.cMid);const centerX=X((fit.s0+fit.s1)/2),centerY=Y(fit.cMid),rx=fit.s1-fit.s0,ry=fit.hMax*ratio;
  const depthAt=s=>{if(s<=0||s>=1)return 0;const peak=.67,tail=.24;
   const bill=['marlin','swordfish','halfbeak'].includes(family)?Math.min(1,fit.sample(s).half/(fit.hMax*.5)):1;
   return profile.widthRatio*bill*(s<peak?tail+(1-tail)*Math.sin(s/peak*Math.PI/2):Math.sqrt(Math.max(0,1-((s-peak)/(1-peak))**2)));};
  surface(40,16,(s,u)=>{const q=fit.sample(s),end=s<=0||s>=1,half=end?0:q.half,th=u*Math.PI*2,side=profile?depthAt(s):end?0:a.depth*.90*(q.half/fit.hMax)**.85;
   const box=profile?.body==='box',C=box?Math.sign(Math.cos(th))*Math.sqrt(Math.abs(Math.cos(th))):family==='pleco'?Math.max(-.80,Math.cos(th)):Math.cos(th),S=box?Math.sign(Math.sin(th))*Math.sqrt(Math.abs(Math.sin(th))):Math.sin(th);
   return[X(q.u),Y(q.center)+C*half*ratio,S*side];},(x,y,z)=>{
   if(!profile)return paint(clamp((x+1)/2),clamp(.5-y/ratio));
   const u=clamp((x+1)/2),s=clamp((u-fit.s0)/(fit.s1-fit.s0)),q=fit.sample(s),cos=clamp((y-Y(q.center))/(q.half*ratio||1),-1,1);
   const theta=Math.atan2(Math.abs(z)/(depthAt(s)||1),cos);
   // Keep the face, eye and flank projected exactly from the reference. Only the
   // dorsal crown uses the angular 17.5–30% inset strip; blend before the sidewall
   // so a narrow back strip cannot stretch the eye/gill into vertical streaks.
   const fraction=.175+.125*Math.min(1,theta/(Math.PI/4)),dorsal=q.center+q.half*(fraction*2-1);
   const blend=clamp((theta-Math.PI/4)/(Math.PI/9));
   return paint(u,clamp(dorsal*(1-blend)+(.5-y/ratio)*blend));
  });
  // Attached dorsal/anal/tail membranes follow the painted outline, but have
  // independent vertices and a physically narrow attachment to the trunk.
  membranes();
  // Paired pectorals fan outward in Z rather than lying in the image plane.
  if(!cephalopod&&family!=='moray')for(const s of[-1,1]){const anchor=[centerX+rx*.18,centerY-ry*.15,s*(profile?profile.widthRatio*.88:a.depth*.72)],v=[...anchor],u=[...paint(a.cx,a.cy)],start=p.length/3;for(let k=0;k<=9;k++){const th=-.9+k/9*1.6;
   if(profile){const f=k/9,leaf=Math.sin(f*Math.PI),size=['upright','box'].includes(profile.body)?.25:['eel','disc','blob'].includes(profile.body)?.45:1;v.push(anchor[0]-(.11+.20*f)*size,anchor[1]-(.025+.065*leaf)*size,s*(Math.abs(anchor[2])+.24*leaf*size));}
   else v.push(anchor[0]-.18+Math.cos(th)*.16,anchor[1]-.12-Math.sin(th)*.08,s*(a.depth*.72+.16*Math.sin(k/9*Math.PI)));u.push(0,0);}const ind=[];for(let k=1;k<10;k++)ind.push(0,k,k+1);append(geo(v,u,ind),profile?paint(fit.uMid,fit.cMid-fit.hMax*.40):(x,y)=>paint(clamp((x+1)/2),clamp(.5-y/ratio)));if(profile)pairedRanges.push({start,end:p.length/3,side:s});}
  if(family==='hammerhead'){
   // Wide cephalofoil and eyes on its ends remain visible from front and overhead.
   {const q=fit.sample(.96);ball([X(q.u),Y(q.center),0],[.05,q.half*ratio*.5,.34*(1+young*.08)],(x,y)=>paint(clamp((x+1)/2),clamp(.5-y/ratio)),16,8);}
  }
  if(shark){
   if(family==='nurse_shark')for(const s of[-1,1])tube([[centerX+rx*.95,centerY-ry*.19,s*.035],[centerX+rx*.98,centerY-ry*.45,s*.045]],.004,paint(.85,.6),4,4);
  }
  if(['ranchu_gold','oranda_gold'].includes(key))for(let k=0;k<8;k++){const th=k/8*Math.PI*2;ball([centerX+rx*.62,centerY+ry*.52+Math.sin(th)*.045,Math.cos(th)*a.depth*.40],[.055,.05,.05],paint(.84,.30),6,4);}
  const mouthX=centerX+rx*.98;
  if(family==='catfish')for(const s of[-1,1]){tube([[mouthX-.025,centerY,s*a.depth*.25],[mouthX-.12,centerY-.04,s*.25],[mouthX-.43,centerY-.12,s*.42]],.006,paint(.78,.53),14,5);tube([[mouthX-.04,centerY-ry*.14,s*.035],[mouthX-.09,centerY-.14,s*.10],[mouthX-.17,centerY-.18,s*.14]],.004,paint(.8,.6),9,4);}
  if(['bullhead','common_carp','cutlassfish_pollock'].includes(family)){
   const pairs=family==='bullhead'?4:family==='common_carp'?2:1;
   for(let k=0;k<pairs;k++)for(const s of family==='cutlassfish_pollock'?[0]:[-1,1]){
    const long=family==='bullhead'?.30:family==='common_carp'?.13:.06;
    tube([[mouthX-.025-k*.016,centerY-ry*.13,s*.018],[mouthX-.06-long*.3,centerY-.04-k*.02,s*(.045+long*.25)],[mouthX-.05-long,centerY-.08-k*.02,s*(.06+long*.50)]],.004,paint(.79,.58),6,4);
   }
  }
  if(family==='coelacanth')for(const s of[-1,1])for(const x of[centerX+.10,centerX-.25])ball([x,centerY-ry*.55,s*a.depth*.85],[.13,.055,.11],(x,y,z)=>paint(clamp((x+1)/2),clamp(.5-y/ratio)),8,5);
  if(family==='gulper_eel')ball([-.94,centerY,0],[.018,.018,.018],2,8,5);
 }
 // Standard ten-bone binding; head rigid, tail graded, paired fins independent.
 const g=geo(p,uv,ix);
 if(!ray&&!jelly&&!flatfish){const N=g.attributes.normal;for(let i=0;i<N.count;i++){const z=p[i*3+2];if(Math.abs(z)<1e-4)continue;const nx=N.getX(i),ny=N.getY(i),nz=N.getZ(i)+Math.sign(z)*.75,len=Math.hypot(nx,ny,nz)||1;N.setXYZ(i,nx/len,ny/len,nz/len);}}
 for(let i=0;i<p.length;i+=3){const x=p[i],y=p[i+1],z=p[i+2],q=clamp(family==='jellyfish'?1+(.20-x)/.09:(.85-x)/.34,0,4.999),b0=Math.floor(q),f=q-b0;let fin=0;
  if(ray||flatfish)fin=clamp((Math.abs(z)-(flatfish?.08:.16))/(flatfish?.30:.58))*clamp((x+.50)*2);
  else if(dragon)fin=clamp((Math.abs(z)-.15)/.16)*clamp((.50-x)*5);
  else if(!jelly)fin=profile?0:clamp((Math.abs(z)-a.depth*.90)/.12);
  if(family==='hammerhead'&&x>.55)fin=0; // The cephalofoil is rigid head tissue, not a pectoral fin.
  const root=z>=0?6:8,tip=['oarfish','hairtail','eel'].includes(family)?clamp((Math.abs(z)-a.depth*.72)/.13):clamp((Math.abs(z)-.22)/.5),ids=[b0,b0+1,root,root+1],ws=[(1-f)*(1-fin),f*(1-fin),fin*(1-tip),fin*tip];
  if(profile){const paired=pairedRanges.find(r=>i/3>=r.start&&i/3<r.end);if(paired){const root=paired.side>0?6:8,blend=i/3===paired.start?0:.65;ids.splice(0,4,root,root+1,0,0);ws.splice(0,4,1-blend,blend,0,0);}
   else if(family==='moray'&&i/3>=41*17&&Math.abs(y-fitMid)>.04){const root=z>=0?6:8;ids.splice(0,4,root,root+1,0,0);ws.splice(0,4,.55,.45,0,0);}
  }
  if(jelly&&i/3<bellVertexCount){ids.fill(0);ws.splice(0,4,1,0,0,0);}for(let k=0;k<4;k++)if(ws[k]===0)ids[k]=0;joint.push(...ids);weight.push(...ws);
 }
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joint,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weight,4));const center=dragon?[0,0,0]:jelly?[.61,0,0]:ray||flatfish?[X(a.cx),0,0]:[X(a.cx),fitMid??Y(a.cy),0];g.translate(-center[0],-center[1],-center[2]);g.userData.bodyCenter=center;g.userData.authoring='anatomical-radial-sculpt-v2';return g;
}
