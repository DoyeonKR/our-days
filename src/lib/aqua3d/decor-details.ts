import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ModelKit } from "./models.ts";
import { surfaceMap } from "./habitat.ts";
import { bubbleStream } from "./bubbles.ts";

/** Thick hipped roof with lifted eaves, shared by Korean architecture decorations. */
export function roofGeometry(width:number):T.BufferGeometry {
  const p:number[]=[],uv:number[]=[],index:number[]=[],n=16,stride=(n+1)*(n+1);
  for(let side=0;side<2;side++)for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const u=i/n*2-1,v=j/n*2-1,r=Math.max(Math.abs(u),Math.abs(v)),y=.38*(1-r)+.105*r**5;
    p.push(u*width,y-side*.045,v*width*.72);uv.push(i/n,j/n);
    if(i<n&&j<n){const k=side*stride+j*(n+1)+i;index.push(...(side?[k,k+1,k+n+1,k+1,k+n+2,k+n+1]:[k,k+n+1,k+1,k+1,k+n+1,k+n+2]));}
  }
  for(let i=0;i<n;i++)for(const [a,b] of[[i,i+1],[n*(n+1)+i+1,n*(n+1)+i],[(i+1)*(n+1),i*(n+1)],[i*(n+1)+n,(i+1)*(n+1)+n]])index.push(a,b,a+stride,b,b+stride,a+stride);
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}

/** Ribbed, thick shell surface. Both inner and outer faces are modeled, not a flat card. */
export function shellGeometry(): T.BufferGeometry {
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],cols=48,rows=12;
  for(let layer=0;layer<2;layer++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const a=i/cols*Math.PI*2,r=.03+j/rows*.97,rib=1+.028*Math.cos(a*18)*r;
    positions.push(Math.cos(a)*r*.64*rib,(1-r*r)*.19+(layer?-.035:.008*Math.cos(a*18)*r),Math.sin(a)*r*.43*rib);
    uv.push(i/cols,j/rows);
  }
  const stride=(cols+1)*(rows+1);
  for(let side=0;side<2;side++)for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const k=side*stride+j*(cols+1)+i,a=k,b=k+1,c=k+cols+1,d=c+1;
    indices.push(...(side?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
  }
  for(let i=0;i<cols;i++){const a=rows*(cols+1)+i,b=a+1;indices.push(a,a+stride,b,b,a+stride,b+stride);}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(positions,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Fine geometry shared by the tank and the on-demand inspection viewer. */
export function addDecorDetails(root:T.Group,key:string,kit:ModelKit) {
  const metallic=key.startsWith("filter")||key.startsWith("heater")||key.startsWith("feeder")||key==="diver";
  const timber=["treasure","sunken_ship","turtle_ship","hanok","windmill","mailbox","driftwood"].includes(key);
  const plant=["moss_ball","vallisneria","java_fern","anubias","red_rotala","water_lily","coral","glow_kelp","sea_mustard","dasima","sea_lettuce"].includes(key);
  const surface=surfaceMap(timber?"wood":"stone",128),copies=new Map<T.Material,T.MeshStandardMaterial>();
  surface.map.repeat.set(3,3);surface.bump.repeat.set(4,4);
  root.traverse(o=>{if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial)||o.name==="polished-pearl")return;
    let m=copies.get(o.material);if(!m){m=o.material.clone();m.map??=surface.map;m.bumpMap??=surface.bump;m.bumpScale=plant?.007:metallic?.009:.025;m.roughness=plant?.7:metallic?.4:key==="crystal"?.23:.83;copies.set(o.material,m);}o.material=m;
  });
  const mesh=(g:T.BufferGeometry,c:number,p:number[],s:number[]=[1,1,1])=>{const m=new T.Mesh(g,kit.material(c));m.position.set(p[0],p[1],p[2]);m.scale.set(s[0],s[1],s[2]);root.add(m);return m;};
  const box=(c:number,p:number[],s:number[])=>mesh(kit.box,c,p,s);
  const sphere=(c:number,p:number[],s:number[])=>mesh(kit.sphere,c,p,s);
  const line=(c:number,pts:number[][],r=.015)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p as [number,number,number]))),16,r,6,false),c,[0,0,0]);
  const ring=(c:number,p:number[],r:number,t=.012)=>mesh(new T.TorusGeometry(r,t,6,32),c,p);
  if(key.startsWith("filter_")){
    for(let i=0;i<10;i++){const a=i*Math.PI/5;box(0x182e32,[Math.sin(a)*.278,.65,Math.cos(a)*.278],[.026,.75,.026]);}
    for(const x of[-.19,.19])sphere(0x91aba3,[x,1.16,.21],[.022,.022,.016]);
    line(0x8bada4,[[.43,1.47,0],[.56,1.43,.03],[.56,1.28,.08]],.06);
    if(key==="filter_2")for(let i=0;i<6;i++)box(0x91a9a4,[-.16+i*.06,.15,.255],[.018,.055,.02]);
    if(key==="filter_3")for(let i=0;i<5;i++){const a=i*Math.PI*2/5;mesh(new T.ConeGeometry(.055,.20,6),0x75bfa9,[Math.sin(a)*.22,1.28,Math.cos(a)*.22]);}
  }else if(key.startsWith("heater_")){
    if(key!=="heater_3"){
      for(const y of[.32,1.12]){box(0x203b40,[0,y,-.09],[.25,.09,.07]);sphere(0x1d3032,[0,y,-.16],[.12,.09,.05]);}
      line(0x242b2c,[[0,1.47,0],[.08,1.65,-.08],[.29,1.7,-.12]],.025);
      sphere(key==="heater_2"?0x59dac0:0xe48b4c,[0,1.38,.14],[.025,.025,.012]);
      if(key==="heater_2")box(0x24353a,[0,.91,.1],[.08,.15,.025]);
    }else for(let i=0;i<12;i++){const a=i*2.4;line(0xd47c35,[[Math.sin(a)*.17,.2,Math.cos(a)*.13],[Math.sin(a)*.3,.42,Math.cos(a)*.22],[Math.sin(a)*.24,.68,Math.cos(a)*.18]],.008);}
  }else if(key.startsWith("feeder_")&&key!=="feeder_3"){
    for(let i=0;i<8;i++)box(0x39494b,[-.15+i*.044,.35,.205],[.018,.12,.02]);
    ring(0xc5b57e,[.297,.7,0],.14).rotation.y=Math.PI/2;
    box(key==="feeder_2"?0x91ddc0:0xd3b66d,[0,.43,.219],[.16,.08,.015]);
    for(let i=0;i<5;i++)sphere(0x967646,[.12*Math.sin(i),.53,.15*Math.cos(i)],[.025,.025,.025]);
  }else if(key==="moss_ball"){
    const needles=new T.InstancedMesh(new T.ConeGeometry(.012,.065,4),kit.material(0x67934e),180),dummy=new T.Object3D();
    for(let i=0;i<needles.count;i++){const n=i%3,a=i*2.399,y=1-2*(Math.floor(i/3)+.5)/60,d=Math.sqrt(1-y*y),v=new T.Vector3(Math.cos(a)*d,y,Math.sin(a)*d);dummy.position.copy(v.clone().multiplyScalar(.24)).add(new T.Vector3(n*.26-.26,.22+n*.03,Math.sin(n)*.12));dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v);dummy.updateMatrix();needles.setMatrixAt(i,dummy.matrix);}root.add(needles);
  }else if(plant){
    if(key==="coral")for(let i=0;i<20;i++){const a=i*2.399;ring(0xe2b2a5,[Math.sin(a)*.34,.3+i%5*.19,Math.cos(a)*.24],.03,.009).rotation.y=a;}
    else if(key==="water_lily")for(let i=0;i<3;i++){const leaf=mesh(new T.CylinderGeometry(.25,.23,.018,28,1,false,.15,Math.PI*1.85),0x3b7252,[Math.sin(i*2)*.38,.48+i*.13,Math.cos(i*2)*.28]);leaf.rotation.z=.08*i;}
    else for(let i=0;i<6;i++){const a=i*2.399;line(key==="red_rotala"?0x813c32:0x416b39,[[0,.02,0],[Math.sin(a)*.18,.04,Math.cos(a)*.18],[Math.sin(a)*.32,.02,Math.cos(a)*.32]],.012);}
  }else if(["pebbles","stone_arch","lava_rock","moon_stone","crystal","driftwood"].includes(key)){
    if(key==="crystal")for(let i=0;i<7;i++){const a=i*2.4;ring(0xbbd4cf,[Math.sin(a)*.3,.08,Math.cos(a)*.25],.08,.012).rotation.x=Math.PI/2;}
    // 나무결 여섯 줄은 같은 재질이라 한 형상으로(2026-11-12 — 그리기 6번 → 1번, 세분 · 자리 그대로)
    else if(key==="driftwood"){const grain=Array.from({length:6},(_,i)=>{const x=-.6+i*.2;return new T.TubeGeometry(new T.CatmullRomCurve3([[x,.19,0],[x+.07,.31,.03],[x+.21,.40,-.02]].map(p=>new T.Vector3(p[0],p[1],p[2]))),16,.008,6,false);});
      mesh(mergeGeometries(grain),0x453e2c,[0,0,0]);grain.forEach(g=>g.dispose());}
    else for(let i=0;i<9;i++){const a=i*2.399;sphere(key==="moon_stone"?0x9aada0:0x52674c,[Math.sin(a)*.41,.03,Math.cos(a)*.25],[.045,.025,.04]);}
  }else if(key==="mailbox"){
    const roof=mesh(new T.CylinderGeometry(.34,.34,.43,24,1,false,0,Math.PI),0x9d4d41,[0,1.20,0]);roof.rotation.x=Math.PI/2;
    box(0xbaa573,[.35,1.16,0],[.025,.27,.025]);box(0xc6ac68,[.43,1.27,0],[.16,.10,.025]);
    for(const x of[-.24,.24])sphere(0xc9b887,[x,.83,.212],[.02,.02,.01]);
  }else if(key==="diver"){
    ring(0xa48d55,[0,1.17,.20],.16,.028);ring(0x5d5941,[0,1.17,.23],.115,.008);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;sphere(0xd5bb78,[Math.cos(a)*.18,1.17+Math.sin(a)*.18,.22],[.018,.018,.015]);}
    line(0x4c564c,[[.2,1.14,-.02],[.35,.96,-.13],[.27,.69,-.17],[.14,.64,-.21]],.025);
    for(const x of[-.17,.17])box(0x4a5750,[x,.10,.10],[.20,.06,.32]);
  }else if(key==="mermaid"){
    for(let i=0;i<9;i++)line(0x7a8f79,[[-.19+i*.045,1.34,0],[-.20+i*.047,1.17,-.14],[-.23+i*.05,.87,-.16]],.018);
    for(const s of[-1,1]){const fin=mesh(new T.ConeGeometry(.20,.42,12),0x86a99a,[.64,.17,s*.13],[1,.35,1]);fin.rotation.z=-Math.PI/2;}
    for(let i=0;i<7;i++)ring(0x9cae9c,[.06+i*.065,.43-i*.035,.095],.075,.009).rotation.x=Math.PI/2;
  }else if(key==="heart_bubbler"){
    box(0x546f70,[0,.05,0],[.66,.10,.40]);for(let i=0;i<5;i++)sphere(0x90b7b2,[-.24+i*.12,.12,.04],[.025,.025,.025]);
  }else if(["hanok","dragon_palace","stone_pagoda","sand_castle"].includes(key)){
    const gold=key==="dragon_palace",levels=key==="stone_pagoda"?4:gold?3:2;
    for(let j=0;j<levels;j++){const w=1.15-j*.2,y=.18+j*.55;
      if(key==="sand_castle")for(let i=0;i<7;i++){box(0xd3be91,[-w*.45+i*w*.15,y+.40,w*.325],[w*.09,.12,.10]);}
      else for(let i=-5;i<=5;i++)line(gold?0x8d9a71:0x66807a,[[i*w*.07,y+.31,w*.49],[i*w*.07,y+.53,0],[i*w*.07,y+.31,-w*.49]],.012);
      for(let i=0;i<3;i++){box(0x314b48,[-w*.28+i*w*.28,y+.16,w*.326],[w*.12,.20,.014]);box(gold?0xceb66f:0xab9b78,[-w*.28+i*w*.28,y+.16,w*.341],[.018,.20,.014]);}
    }
    for(let i=0;i<3;i++)box(0x8e9584,[0,.025+i*.04,.46-i*.08],[1.3-i*.12,.06,.20]);
    if(gold)for(const s of[-1,1])line(0xccbb7e,[[s*.70,.71,0],[s*.91,.85,0],[s*.84,.97,0]],.035);
  }else if(key==="windmill"){
    for(let y=.2;y<1;y+=.18)ring(0x756e58,[0,y,0],.32,.013).rotation.x=Math.PI/2;
    box(0x253f41,[0,.6,.318],[.14,.20,.02]);
  }else if(key==="treasure"){
    for(const x of[-.30,.30]){box(0xb6a266,[x,.26,.299],[.055,.44,.026]);box(0xb6a266,[x,.48,-.29],[.055,.26,.026]);}
    box(0xd6c082,[0,.32,.32],[.13,.15,.04]);box(0x3e4131,[0,.33,.343],[.025,.045,.012]);
    for(let i=0;i<10;i++){const coin=mesh(new T.CylinderGeometry(.06,.06,.018,16),0xe2c470,[Math.sin(i*2)*.28,.48+i%3*.02,Math.cos(i*2)*.16]);coin.rotation.z=i*.2;}
  }else if(key==="pearl_clam"||key==="feeder_3"){
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2;line(0xd6c6a0,[[0,.24,0],[Math.cos(a)*.35,.18,Math.sin(a)*.23],[Math.cos(a)*.61,.11,Math.sin(a)*.4]],.008);}
    ring(0xd8c89b,[0,.065,0],.19,.025).rotation.x=Math.PI/2;
  }else if(key==="sunken_ship"||key==="turtle_ship"){
    for(let i=0;i<9;i++)box(0x493e2e,[-.62+i*.155,.443,0],[.012,.018,.52]);
    for(const s of[-1,1])for(let i=0;i<6;i++){const x=-.6+i*.24;ring(0xa99969,[x,.29,s*.32],.05,.012);box(0x343e3a,[x,.29,s*.325],[.065,.055,.025]);}
    if(key==="turtle_ship")for(let i=0;i<7;i++){const x=-.5+i*.17;for(const s of[-1,1])line(0x7e7354,[[x,.30,s*.27],[x+.10,.17,s*.66],[x+.2,.12,s*.78]],.024);}
    else {for(const s of[-1,1])line(0xa49c77,[[-.12,1.45,0],[s*.65,.44,s*.22]],.012);for(let i=0;i<4;i++)box(0x405647,[-.6+i*.32,.16,.29],[.1,.04,.05]);}
  }else if(key==="star_gate"){
    for(let i=0;i<16;i++){const a=i*Math.PI/8,m=box(i%2?0x657b84:0xc6b16c,[Math.cos(a)*.78,.91+Math.sin(a)*.78,.10],[.06,.13,.035]);m.rotation.z=a-Math.PI/2;}
    for(let i=0;i<3;i++)box(0x657b7b,[0,.04+i*.04,.15-i*.05],[1.7-i*.16,.045,.65-i*.06]);
  }
  root.userData.detailVersion=2;
  // 거품 — 수조 산소 거품과 같은 점 입자(그리기 한 번). ⚠ 몸(코드 모델)과 따로 둔다(userData.aquaKeep):
  // 제작 모델로 갈아 끼울 때 옛 몸과 함께 지워져 하트 기포기 · 필터 · 별의 문 · 화산석 거품이 사라졌다(2026-11-05)
  const bubbles=["heart_bubbler","filter_3","star_gate","heater_3"].includes(key)?bubbleStream({count:14,origin:i=>[Math.sin(i*2.399)*.24,Math.cos(i*2.399)*.12],
    bottom:.17,top:1.82,size:[.03,.075],speed:[.3,.42],color:key==="heater_3"?0xeaaa59:0xa3d8d1,opacity:.7,wobble:.05,seed:key.length}):null;
  if(bubbles){bubbles.points.name="decor-animated-bubbles";root.add(bubbles.points);}
  return (time:number)=>{bubbles?.update(time);};
}
