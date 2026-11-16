import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ModelKit } from "./models.ts";
import { leafGeometry, surfaceMap } from "./habitat.ts";
import { addDecorDetails, shellGeometry, roofGeometry } from "./decor-details.ts";
type V = readonly [number, number, number];
/** effects: 몸과 따로 도는 효과(거품) — 제작 모델로 갈아 끼운 뒤에도 남아 계속 돈다 */
export type DecorModel = { root: T.Group; animate: (time: number) => void; effects: (time: number) => void };
/** 해초류 꾸미기(2026-11-14) [사용자: "해초류는 꾸미기로 추가"] — 미역 · 다시마 · 파래. 키 SEAWEEDS 는 aquarium.ts 의 장식 표와 같다 */
export const SEAWEEDS = ["sea_mustard", "dasima", "sea_lettuce"] as const;
/** 해초 잎 한 장 — 바닥에서 솟은 긴 띠. len 길이 · width 폭 · waves 굽이 수 · frill 가장자리 물결(미역의 주름) · taper 끝으로 좁아지는 몫 */
function ribbonGeometry(len: number, width: number, waves: number, frill: number, taper: number, seed: number): T.BufferGeometry {
  const rows = 28, cols = 4, q = cols + 1, p: number[] = [], uv: number[] = [], index: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const t = j / rows, sx = i / cols * 2 - 1, w = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.6 + 0.08)) ** 0.5) * (1 - taper * t * t);
    const bend = 0.22 * len * t * t * Math.sin(seed), wave = 0.06 * len * Math.sin(t * waves * Math.PI + seed) * t;
    const edge = frill * Math.abs(sx) ** 1.5 * Math.sin(t * 46 + sx * 3 + seed) * w;
    p.push(sx * w + wave, t * len, bend + edge); uv.push(i / cols, t);
    if (j < rows && i < cols) { const k = j * q + i; index.push(k, k + 1, k + q, k + 1, k + q + 1, k + q); }
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); return g;
}

export function makeDecor(kit: ModelKit, key: string): DecorModel {
  const root = new T.Group(); root.name = key;
  const rockMaterials = new Map<number,T.MeshStandardMaterial>();
  const moving: { node: T.Object3D; phase: number; axis: "x" | "y" | "z"; amount: number }[] = [];
  const box = (c: number, p: V, s: V) => kit.mesh(root, "box", c, p, s);
  const ball = (c: number, p: V, s: V) => kit.mesh(root, "sphere", c, p, s);
  const cyl = (c: number, p: V, s: V) => kit.mesh(root, "cylinder", c, p, s);
  const bar = (c: number, from: V, to: V, radius = 0.04) => {
    const a = new T.Vector3(...from), b = new T.Vector3(...to), d = b.clone().sub(a);
    const m = cyl(c, a.clone().add(b).multiplyScalar(0.5).toArray() as [number,number,number], [radius,d.length(),radius]);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()); return m;
  };
  const ring = (c: number, p: V, radius: number, tube = 0.06) => { const m = new T.Mesh(new T.TorusGeometry(radius,tube,8,32),kit.material(c,0.3)); m.position.set(...p); root.add(m); return m; };
  const roof = (x: number, y: number, z: number, width: number) => {
    const r = new T.Mesh(roofGeometry(width),kit.material(0x304e50)); r.position.set(x,y-.22,z);root.add(r);
    for(const s of [-1,1]) bar(0x416c6b,[x-s*width*.65,y-.12,z],[x-s*width*.88,y+.05,z],.05);
  };
  const tree = (color: number, count: number, broad = false) => {
    for(let i=0;i<count;i++){const a=i*2.399, g=new T.Group(),h=.7+(i%4)*.19;g.position.set(Math.cos(a)*.27,0,Math.sin(a)*.27);g.scale.set(key==="anubias"?1.2:1,key==="vallisneria"?1.6:key==="anubias"?.65:key==="glow_kelp"?1.5:1,1);root.add(g);
      const stem=kit.mesh(g,"cylinder",0x426342,[0,h*.5,0],[.025,h,.025]);stem.rotation.z=Math.sin(a)*.13;
      const material=kit.material(color,0,.78);material.side=T.DoubleSide;
      for(let j=0;j<5;j++){const s=j%2?1:-1,leaf=new T.Mesh(leafGeometry(broad),material);leaf.position.set(0,.16+j*.19,0);leaf.scale.set(broad?.7:.8,broad?.47:.56,1);leaf.rotation.set(.12,j*1.7,s*.72);g.add(leaf);}
      moving.push({node:g,phase:a,axis:"z",amount:.07});
    }
  };
  const rock = (c:number, at:V, scale:V, seed=0) => { const g=new T.IcosahedronGeometry(1,1); const pos=g.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),r=.93+.09*Math.sin(x*11+seed)*Math.cos(y*9-z*7);pos.setXYZ(i,x*r,y*r,z*r);}g.computeVertexNormals();
    if(!rockMaterials.has(c)){const maps=surfaceMap("stone");rockMaterials.set(c,new T.MeshStandardMaterial({color:c,map:maps.map,bumpMap:maps.bump,bumpScale:.04,roughness:.93}));}
    const m=new T.Mesh(g,rockMaterials.get(c)!);m.position.set(...at);m.scale.set(...scale);root.add(m);return m; };

  if(key.startsWith("filter_")){
    const tier=Number(key.slice(-1));cyl(tier===3?0x467d65:0x25363b,[0,.65,0],[.28,1.15,.25]);box(0x172b35,[0,.06,0],[.72,.12,.58]);
    for(let i=0;i<5;i++)ring(tier===3?0x7bb8a0:0x41545a,[0,.25+i*.16,0],.28,.025).rotation.x=Math.PI/2;
    bar(0x73989c,[0,1.12,0],[0,1.48,0],.07);bar(0x73989c,[0,1.48,0],[.45,1.48,0],.07);
    if(tier===3){ball(0x66dfc6,[0,1.16,0],[.17,.17,.17]);}
  }else if(key.startsWith("heater_")){
    if(key==="heater_3"){for(let i=0;i<5;i++)rock(i%2?0xc04c25:0x493d39,[Math.sin(i*2)*.35,.2+i*.1,Math.cos(i)*.2],[.25,.4,.25],i);}
    else {cyl(0x99b5b4,[0,.75,0],[.10,1.4,.1]);cyl(0x1d353c,[0,1.37,0],[.14,.20,.14]);for(let i=0;i<5;i++)ring(0x984b32,[0,.32+i*.13,0],.10,.022).rotation.x=Math.PI/2;}
  }else if(key.startsWith("feeder_")){
    if(key==="feeder_3"){const shell=new T.Mesh(shellGeometry(),kit.material(0xcda64c));shell.position.y=.18;shell.rotation.x=.2;root.add(shell);ball(0xe3cda1,[0,.43,0],[.18,.18,.18]);}
    else {box(0x2a414d,[0,.25,0],[.36,.5,.38]);const m=cyl(key==="feeder_1"?0x8b7060:0xc9d9da,[0,.7,0],[.42,.52,.42]);m.rotation.z=Math.PI/2;ring(0x4a626d,[.28,.7,0],.25).rotation.y=Math.PI/2;}
  }else if(key==="moss_ball"){for(let i=0;i<3;i++)ball(0x4b7431,[i*.26-.26,.22+i*.03,Math.sin(i)*.12],[.25,.24,.25]);
  }else if(["vallisneria","java_fern","anubias","red_rotala","glow_kelp"].includes(key)){tree(key==="red_rotala"?0xb65e50:key==="glow_kelp"?0x45b5ba:0x4b854e,key==="vallisneria"?7:5,key==="anubias"||key==="java_fern");
  }else if((SEAWEEDS as readonly string[]).includes(key)){
    // 해초 — 돌(뿌리 자리)에 붙어 솟은 잎 다발이 물살에 흔들린다. 미역은 주름진 긴 잎, 다시마는 넓고 긴 띠, 파래는 짧고 가는 잎이 수북하다
    const kind=key==="sea_mustard"?{c:0x5d6b2c,n:6,len:1.5,w:.13,waves:2.2,frill:.55,taper:.35}:key==="dasima"?{c:0x4f4726,n:4,len:1.9,w:.2,waves:1.4,frill:.12,taper:.25}:{c:0x5fb33c,n:14,len:.62,w:.07,waves:3,frill:.35,taper:.6};
    rock(0x5f5b50,[0,.08,0],[.24,.12,.2],3);
    const leaf=new T.MeshStandardMaterial({color:kind.c,roughness:.62,side:T.DoubleSide});
    for(let i=0;i<kind.n;i++){const a=i*2.399,r=key==="sea_lettuce"?.08+.12*((i*7)%5)/5:.06,g=new T.Group();g.position.set(Math.cos(a)*r,.14,Math.sin(a)*r);g.rotation.y=a*1.7;
      const h=kind.len*(.75+.35*((i*5)%4)/3),m=new T.Mesh(ribbonGeometry(h,kind.w,kind.waves,kind.frill,kind.taper,a),leaf);m.rotation.z=(Math.sin(a)*.22);g.add(m);root.add(g);
      moving.push({node:g,phase:a,axis:i%2?"x":"z",amount:key==="sea_lettuce"?.06:.13});}
  }else if(key==="water_lily"){
    tree(0x458054,3,true);for(let i=0;i<9;i++){const a=i*Math.PI*2/9,m=ball(0xe7a5ad,[Math.cos(a)*.19,1.12,Math.sin(a)*.19],[.13,.07,.27]);m.rotation.y=a;}
    ball(0xe0c25c,[0,1.15,0],[.12,.1,.12]);
  }else if(key==="coral"){
    for(let i=0;i<7;i++){const x=Math.sin(i*2.4)*.4,z=Math.cos(i*2.4)*.3,h=.65+(i%3)*.2;bar(i%2?0xc67483:0xc99775,[0,0,0],[x,h,z],.075);for(const s of[-1,1]){bar(0xc98991,[x*.6,h*.65,z*.6],[x+s*.2,h+.14,z+.12],.045);ball(0xe0a4a0,[x+s*.2,h+.14,z+.12],[.06,.06,.06]);}}
  }else if(key==="pebbles"){for(let i=0;i<9;i++)rock(0x89887b,[Math.sin(i*2)*.45,.10,Math.cos(i*2.3)*.3],[.17,.12,.15],i);
  }else if(key==="driftwood"){
    const maps=surfaceMap("wood"),material=new T.MeshStandardMaterial({color:0x88714f,map:maps.map,bumpMap:maps.bump,bumpScale:.025,roughness:.88});
    const paths=[[[ -.8,.05,.1],[-.35,.22,0],[.2,.36,-.07],[.75,.67,-.12]], [[-.2,.22,0],[-.17,.62,-.06],[.02,.95,-.18]], [[.25,.4,0],[.5,.65,.15],[.75,.78,.22]], [[-.37,.18,0],[-.45,.09,.35],[-.7,.06,.46]]];
    // 가지 넷은 재질이 같아 한 형상으로(2026-11-12 — 그리기 4번 → 1번). 세분은 그대로: 제작 모델(GLB)이 이 몸의 경계 상자에 맞춰 커지므로(swapBody) 상자가 바뀌면 안 된다
    const tubes=paths.map((path,i)=>new T.TubeGeometry(new T.CatmullRomCurve3(path.map(p=>new T.Vector3(p[0],p[1],p[2]))),20,i?.045:.10,7,false));
    root.add(new T.Mesh(mergeGeometries(tubes),material));tubes.forEach(g=>g.dispose());
  }else if(key==="stone_arch"){for(let i=0;i<9;i++){const a=i/8*Math.PI;rock(0x7e8775,[Math.cos(a)*.62,.2+Math.sin(a)*.8,0],[.22,.23,.29],i);}
  }else if(key==="lava_rock"||key==="moon_stone"){rock(key==="lava_rock"?0x61463d:0xb6b9a8,[0,.38,0],[.57,.55,.42],4);
  }else if(key==="crystal"){for(let i=0;i<7;i++){const h=.45+(i%4)*.23,m=new T.Mesh(new T.CylinderGeometry(.01,.14,h,6),kit.material(0x9383b3,.15,.25));m.position.set(Math.sin(i*2.4)*.3,h/2,Math.cos(i*2.4)*.25);root.add(m);}
  }else if(key==="mailbox"){cyl(0x52635b,[0,.4,0],[.065,.8,.065]);box(0xa4483b,[0,.96,0],[.65,.5,.4]);box(0x352f29,[0,1.02,.211],[.4,.045,.02]);
  }else if(key==="diver"||key==="mermaid"){
    const c=key==="diver"?0x967e4e:0xbcbfae;ball(c,[0,.74,0],[.23,.34,.18]);ball(c,[0,1.17,0],[.22,.23,.22]);
    if(key==="diver"){ball(0x263b40,[0,1.17,.19],[.15,.15,.04]);for(const s of[-1,1]){bar(c,[s*.12,.55,0],[s*.17,.1,0],.09);bar(c,[s*.16,.95,0],[s*.38,.62,0],.06);}}
    else{bar(c,[0,.51,0],[.25,.13,0],.15);bar(c,[.25,.13,0],[.58,.17,0],.08);rock(0x737d72,[0,.16,0],[.5,.2,.4]);}
  }else if(key==="heart_bubbler"){
    const curve=new T.CatmullRomCurve3(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return new T.Vector3(.026*16*Math.sin(a)**3,.6+.026*(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a)),0);}));
    root.add(new T.Mesh(new T.TubeGeometry(curve,40,.055,8,true),kit.material(0xb96b7d)));
  }else if(key==="sand_castle"||key==="dragon_palace"||key==="hanok"||key==="stone_pagoda"){
    const gold=key==="dragon_palace",c=gold?0xbca765:key==="sand_castle"?0xc6b28b:0x999d86, levels=key==="stone_pagoda"?4:gold?3:2;
    for(let i=0;i<levels;i++){const w=1.15-i*.2,y=.18+i*.55;box(c,[0,y+.16,0],[w,.38,w*.65]);if(key!=="sand_castle")roof(0,y+.49,0,w*.75);else for(const s of[-1,1])cyl(c,[s*.48,y+.4,0],[.16,.5,.16]);}
    if(key==="hanok"||gold)for(const s of[-1,1])bar(0x715d42,[s*.38,0,.30],[s*.38,.85,.30],.055);
  }else if(key==="windmill"){
    cyl(0x9a8e71,[0,.55,0],[.32,1.05,.32]);roof(0,1.2,0,.48);const blades=new T.Group();blades.position.set(0,.98,.4);root.add(blades);
    for(let i=0;i<4;i++){const m=kit.mesh(blades,"box",0x7b6950,[0,0,0],[.13,1.25,.055]);m.rotation.z=i*Math.PI/2;}moving.push({node:blades,phase:0,axis:"z",amount:1});
  }else if(key==="treasure"){
    box(0x715036,[0,.25,0],[.85,.45,.58]);const lid=box(0x76563a,[0,.61,-.14],[.88,.16,.58]);lid.rotation.x=-.65;
    for(let i=0;i<7;i++)ball(i%2?0xd8ad4f:0x53a6ad,[Math.sin(i)*.28,.49,Math.cos(i*3)*.18],[.09,.06,.09]);
  }else if(key==="pearl_clam"){
    const geometry=shellGeometry(),shell=new T.Mesh(geometry,kit.material(0xada688)),lid=new T.Mesh(geometry,kit.material(0xc7bba5));shell.position.y=.12;shell.rotation.z=Math.PI;lid.position.set(0,.51,-.20);lid.rotation.x=-.9;root.add(shell,lid);const pearl=ball(0xf2f1e4,[0,.27,.08],[.19,.19,.19]);pearl.name="polished-pearl";pearl.material=new T.MeshPhysicalMaterial({color:0xf4f1e0,roughness:.15,metalness:.18,clearcoat:1,clearcoatRoughness:.1});
  }else if(key==="sunken_ship"||key==="turtle_ship"){
    const hull=ball(0x6c5941,[0,.27,0],[.92,.30,.38]);hull.rotation.z=.07;box(0x827052,[0,.38,0],[1.4,.10,.6]);
    if(key==="sunken_ship"){bar(0x68533c,[0,.40,0],[-.12,1.45,0],.04);bar(0x68533c,[-.55,1,0],[.4,1,0],.03);box(0xaaa68d,[-.07,1.1,0],[.70,.5,.025]).rotation.z=-.17;}
    else{ball(0x777a6a,[0,.58,0],[.70,.29,.32]);for(let i=0;i<5;i++)bar(0x878773,[-.45+i*.22,.76,0],[-.45+i*.22,.95,0],.025);ball(0x8c8662,[.86,.49,0],[.2,.15,.12]);}
  }else if(key==="star_gate"){
    ring(0x9c936a,[0,.91,0],.78,.12);ring(0x6371ab,[0,.91,0],.62,.025);box(0x7b807b,[0,.1,0],[1.45,.2,.5]);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ball(0x8fc5ce,[Math.cos(a)*.78,.91+Math.sin(a)*.78,.12],[.065,.065,.05]);}
  }else throw new Error(`Missing 3D decoration: ${key}`);
  const details=addDecorDetails(root,key,kit);details(0);
  // 흔들리는 부품 — 수조가 묶어 그릴 때 이 밑은 매 프레임 행렬을 올린다(나머지 장식은 놓을 때 한 번)
  for(const m of moving)m.node.userData.moving=true;
  return {root,effects:details,animate:time=>{details(time);for(const m of moving)m.node.rotation[m.axis]=key==="windmill"?time*.22:Math.sin(time*.8+m.phase)*m.amount;}};
}
