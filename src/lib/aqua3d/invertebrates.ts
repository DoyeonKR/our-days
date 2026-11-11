import * as T from "three";
import type { AnimalModel, ModelKit } from "./models.ts";
import { WORLD } from "./world.ts";
import { roomX, settlePoint, type CourseOptions } from "./habits.ts";

/** 불가사리 — 모래 위를 아주 천천히 큰 고리로 긴다. opts 를 주면 장식 · 바위 · 터널 · 돔을 비켜 간다(2026-11-11 — 예전엔 장애물을 안 받아 장식을 뚫고 지났고,
 *  터널 수족관에선 터널 밖으로 미는 쪽을 x 의 부호로 정해서 x = 0 을 지날 때마다 터널 반대편으로 순간 이동했다). 터널이 있으면 고리 자체를 터널 한쪽 옆 길로 옮긴다.
 *  머리는 비킨 길의 앞뒤 자리 차이를 본다. 같은 시각 = 같은 자리(순수) */
const STAR = { x: 0, y: 0, z: 0 };
export function starCourse(id:number,seconds:number,length:number,scale=1,opts?:CourseOptions) {
  const hash=Math.imul(id,2654435761)>>>0,phase=(hash%6283)/1000,r=Math.max(.2,4.4-length*.55),half=length/2,hall=opts?.hall??null;
  let cx=0,rx=r*scale,lane=0;
  if(hall?.kind==="tunnel"){
    lane=(hash>>>5)&1?1:-1;
    const inner=hall.r+half*.55+.1+.45+.15,outer=roomX(half,scale),w=Math.max(.12,Math.min(rx,(outer-inner)/2));
    rx=w;cx=lane*Math.max(inner+w,Math.min(outer-w,inner+w));if(inner+w>outer)cx=lane*Math.max(outer-w,0);
  }
  const at=(s:number)=>{const t=s*.025+phase;STAR.x=cx+rx*Math.sin(t);STAR.y=WORLD.floor+length*.10;STAR.z=1.4*Math.cos(t*.7);
    if(opts&&(opts.obstacles?.length||hall))settlePoint(STAR,length,scale,WORLD.floor,opts.obstacles,{deep:opts.deep,tall:opts.tall,hall,ring:{cx,cz:0,rx,zr:1.4,lane}});return STAR;};
  if(!opts){const t=seconds*.025+phase;return {x:r*scale*Math.sin(t),y:WORLD.floor+length*.10,z:1.4*Math.cos(t*.7),dx:r*scale*Math.cos(t),dy:0,dz:-.98*Math.sin(t*.7),effort:.35};}
  // 머리 — 비킨 길의 앞뒤 1초 자리 차이(아주 느려서 접선만 보면 장식 둘레에서 몸이 옆으로 기었다)
  const a=at(seconds-1),ax=a.x,az=a.z,b=at(seconds+1),bx=b.x,bz=b.z,p=at(seconds);
  const dx=bx-ax,dz=bz-az,dl=Math.hypot(dx,dz*(opts.deep??1));
  return {x:p.x,y:p.y,z:p.z,dx:dl>1e-6?dx:rx*Math.cos(seconds*.025+phase),dy:0,dz:dl>1e-6?dz:-.98*Math.sin((seconds*.025+phase)*.7),effort:.35};
}

export const INVERTEBRATE_FAMILIES = ["starfish", "squid", "octopus", "giant_squid", "kraken"] as const;
const baseNames = ["spine_0", "spine_1", "spine_2", "spine_3", "spine_4", "spine_5", "fin_L", "fin_L_tip", "fin_R", "fin_R_tip"];
const clamp = (n:number, a=0, b=1) => Math.max(a,Math.min(b,n));
const isSquid = (f:string) => f==="squid"||f==="giant_squid";
const count = (f:string) => f==="starfish"?5:isSquid(f)?10:8;
const armName = (i:number,j:number) => `arm_${i}_${j}`;

function armPoint(family:string,key:string,i:number,t:number):T.Vector3 {
  const young=key.startsWith("fry_")?1:key.startsWith("juv_")?.45:0;
  if(family==="starfish") { const a=i*Math.PI*2/5-Math.PI/2;return new T.Vector3(Math.cos(a)*(.24+t*.70),.025,Math.sin(a)*(.24+t*.70)); }
  const th=i*Math.PI*2/8, tentacle=i>=8, octo=!isSquid(family);
  if(octo){
    const a=-Math.PI+.18+i/7*Math.PI*1.12,L=(family==="kraken"?1.65:1.45)*(1-young*.15);let x=.10,y=.20;
    for(let n=0;n<32;n++){const u=(n+.5)/32*t,th=a+(i%2?1:-1)*3.6*u*u;x+=Math.cos(th)*t*L/32;y+=Math.sin(th)*t*L/32;}
    return new T.Vector3(x,y,Math.sin(i*2.399)*Math.sin(t*Math.PI)*.40);
  }
  const length=(tentacle?(family==="giant_squid"?2.10:1.45):.86)*(1-young*.20), spread=.24*(1-young*.14);
  const r=.13+Math.sin(t*Math.PI*.82)*spread;
  return new T.Vector3(.02+t*length-(octo?.18*Math.sin(t*Math.PI*1.2):0),Math.cos(th)*r-.06*t,Math.sin(th)*r+(octo?Math.sin(t*5+i)*t*.055:0));
}

/** Standard names remain present; independent three-joint arm chains add the missing anatomy. */
export function makeInvertebrateRig(family:string,key:string):T.Bone[] {
  const bones=baseNames.map(name=>{const b=new T.Bone();b.name=name;return b;});
  for(let i=1;i<6;i++)bones[0].add(bones[i]);
  for(const [r,tip,s] of [[6,7,1],[8,9,-1]]) { bones[0].add(bones[r]);bones[r].position.set(-.7,0,s*.14);bones[r].add(bones[tip]);bones[tip].position.set(-.15,0,s*.22); }
  for(let i=0;i<count(family);i++)for(let j=0;j<3;j++){
    const bone=new T.Bone();bone.name=armName(i,j);
    const here=armPoint(family,key,i,j*.4),prev=j?armPoint(family,key,i,(j-1)*.4):new T.Vector3();
    bone.position.copy(here.sub(prev));(j?bones[bones.length-1]:bones[0]).add(bone);bones.push(bone);
  }
  bones[0].updateMatrixWorld(true);return bones;
}

/** Original closed body volumes + tapered, genuinely three-dimensional arms. No cutout planes. */
export function createInvertebrateGeometry(family:string,key:string,palette=false,source?:{data:Uint8Array;info:{width:number;height:number}}):T.BufferGeometry {
  const p:number[]=[],uv:number[]=[],ix:number[]=[],ids:number[]=[],weights:number[]=[];
  const fry=key.startsWith("fry_"), young=fry?1:key.startsWith("juv_")?.45:0;
  const squid=isSquid(family),kraken=family==="kraken";
  const tex=(x:number,y:number,z:number):number[]=>family==="starfish"?[.5+x*.42,.5+z*.42]:squid?[clamp(.32+(x+.63)*.39,.11,.59),clamp(.51-y*.28,.45,.59)]:[clamp((kraken?.40:.42)+(x+.47)*.31,.23,.60),clamp((kraken?.29:.28)-(y-.46)*.25,.20,.38)];
  const swatch=(n:number)=>palette?[(n*8+4)/512,4/512]:[.45,.45];
  const add=(g:T.BufferGeometry,at:T.Vector3,scale:T.Vector3,binding:(v:T.Vector3)=>[number[],number[]],color?:number,uvAt?:(v:T.Vector3,i:number)=>number[])=>{
    g.scale(scale.x,scale.y,scale.z);g.translate(at.x,at.y,at.z);const off=p.length/3,a=g.attributes.position;
    for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i),[js,ws]=binding(v);p.push(v.x,v.y,v.z);uv.push(...(uvAt?uvAt(v,i):color===undefined?tex(v.x,v.y,v.z):swatch(color)));ids.push(...js);weights.push(...ws);}
    for(let i=0;i<(g.index?.count??a.count);i++)ix.push(off+(g.index?g.index.getX(i):i));g.dispose();
  };
  const rigid=(b=0):[number[],number[]]=>[[b,0,0,0],[1,0,0,0]];
  const armBind=(i:number,t:number):[number[],number[]]=>{const q=clamp(t/.8,0,.9999)*2,j=Math.floor(q),f=q-j;return [[10+i*3+j,10+i*3+j+1,0,0],[1-f,f,0,0]];};
  const ball=(at:number[],scale:number[],bone=0,color?:number,segments=fry?10:16,rings=fry?6:9)=>add(new T.SphereGeometry(1,segments,rings),new T.Vector3().fromArray(at),new T.Vector3().fromArray(scale),()=>rigid(bone),color);
  if(family==="starfish"){
    const rows=8,cols=60,v:number[]=[],ind:number[]=[];
    for(let side=0;side<2;side++)for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
      const a=k/cols*Math.PI*2,t=j/rows;let R=(.48+.52*Math.pow((1+Math.cos(5*(a+Math.PI/2)))/2,.75))*(1-young*.05);
      if(source){let last=1;for(let r=1;r<250;r++){const x=Math.round(source.info.width/2+Math.cos(a)*r),y=Math.round(source.info.height/2+Math.sin(a)*r);if(source.data[(y*source.info.width+x)*4+3]>160)last=r;}R=Math.max(.20,(last-1)/215);}
      v.push(Math.cos(a)*R*t,side?-.035:.025+.15*(1-t*t),Math.sin(a)*R*t);
      if(j<rows&&k<cols){const q=side*(rows+1)*(cols+1)+j*(cols+1)+k;ind.push(q,q+1,q+cols+1,q+1,q+cols+2,q+cols+1);}
    }
    const offset=(rows+1)*(cols+1);for(let k=0;k<cols;k++){const a=rows*(cols+1)+k,b=offset+a;ind.push(a,b,a+1,a+1,b,b+1);}
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(v,3));g.setIndex(ind);
    add(g,new T.Vector3(),new T.Vector3(1,1,1),v=>{
      const angle=(Math.atan2(v.z,v.x)+Math.PI/2+Math.PI*2)%(Math.PI*2),i=Math.round(angle/(Math.PI*2/5))%5,r=Math.hypot(v.x,v.z);
      if(r<.25)return rigid();const [js,ws]=armBind(i,clamp((r-.24)/.70)),f=clamp((r-.25)/.20);return [[js[0],js[1],0,0],[ws[0]*f,ws[1]*f,1-f,0]];
    });
    // A small raised dorsal ossicle pattern, not a face.
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;ball([Math.cos(a)*.46,.15,Math.sin(a)*.46],[.025,.017,.025],10+i*3,undefined,6,4);}
  }else{
    ball(squid?[-.63,0,0]:[-.47,.46,0],[squid?.52:.43*(1+young*.15),squid?.19:.32, squid?.20:.34],0);
    ball(squid?[-.12,.01,0]:[.02,.34,0],[.23,.20*(1+young*.12),.23],0);
    for(const s of [-1,1]){const y=squid?.09:.43,x=squid?-.04:.09;ball([x,y,s*.215],[.040*(1+young*.2),.033,.024],0,kraken?2:3);ball([x+.005,y,s*.237],[.022,.006,.008],0,0);ball([x+.012,y+.010,s*.243],[.005,.005,.004],0,2,6,4);}
    if(squid)for(const [bone,s]of [[6,1],[8,-1]]){
      const v=[-1.1,0,0,-.81,s*.38,s*.23,-.47,0,s*.15,-.79,s*.08,s*.14,-1.1,-.012,0,-.81,s*.36,s*.23,-.47,-.012,s*.15];
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(v,3));g.setIndex([0,1,3,1,2,3,0,3,2,4,6,5,0,4,1,1,4,5,1,5,2,2,5,6,2,6,0,0,6,4]);add(g,new T.Vector3(),new T.Vector3(1,1,1),v=>rigid(Math.abs(v.z)>.24?bone+1:bone));
    }
    const segments=fry?10:18,sides=fry?5:8;
    for(let i=0;i<count(family);i++){
      const v:number[]=[],ind:number[]=[],tentacle=i>=8;
      for(let j=0;j<=segments;j++){
        const t=j/segments,c=armPoint(family,key,i,t),a=armPoint(family,key,i,Math.max(0,t-.005)),b=armPoint(family,key,i,Math.min(1,t+.005)),tangent=b.sub(a).normalize();
        const axis=Math.abs(tangent.y)>.90?new T.Vector3(0,0,1):new T.Vector3(0,1,0),side=new T.Vector3().crossVectors(tangent,axis).normalize(),up=new T.Vector3().crossVectors(side,tangent).normalize();
        const radius=(tentacle?.021:(squid?.067:.091)*(1-young*.18))*Math.pow(1-t,1.2)+.005+(tentacle&&t>.82?.035*Math.sin((t-.82)/.18*Math.PI):0);
        for(let k=0;k<=sides;k++){const th=k/sides*Math.PI*2,pt=c.clone().addScaledVector(side,Math.cos(th)*radius).addScaledVector(up,Math.sin(th)*radius);v.push(pt.x,pt.y,pt.z);if(j<segments&&k<sides){const q=j*(sides+1)+k;ind.push(q,q+sides+1,q+1,q+1,q+sides+1,q+sides+2);}}
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(v,3));g.setIndex(ind);
      let vertex=0;add(g,new T.Vector3(),new T.Vector3(1,1,1),()=>armBind(i,Math.floor(vertex++/(sides+1))/segments),undefined,squid?undefined:(_v,n)=>[.40+.065*Math.cos(n%(sides+1)/sides*Math.PI*2),.25+Math.floor(n/(sides+1))/segments*.07]);
      for(let j=0;j<(fry?2:5);j++)for(const row of squid?[0]:[-1,1]){const t=.18+j*(fry?.25:.15),c=armPoint(family,key,i,t);c.z+=.065*(1-t);c.x+=row*.018*(1-t);ball(c.toArray(),[.020*(1-t)+.006,.017*(1-t)+.006,.010],10+i*3+Math.min(2,Math.floor(t/.4)),2,6,4);}
    }
    if(kraken)for(let i=0;i<(fry?4:12);i++){const a=i*2.399;ball([-.50+Math.sin(a)*.22,.70+Math.cos(a)*.07,Math.cos(a)*.18],[.035,.035,.028],0,3,6,4);}
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setAttribute("skinIndex",new T.Uint16BufferAttribute(ids,4));g.setAttribute("skinWeight",new T.Float32BufferAttribute(weights,4));g.setIndex(ix);g.computeVertexNormals();
  const normals=g.attributes.normal;for(let i=0;i<normals.count;i++)if(new T.Vector3().fromBufferAttribute(normals,i).lengthSq()<.001)normals.setXYZ(i,0,1,0);
  g.userData.bodyCenter=[0,0,0];g.userData.anatomy=family==="starfish"?"star":"cephalopod";return g;
}

export function invertebrateMotion(root:T.Group,family:string,key:string):(time:number,effort:number)=>void {
  const rig=makeInvertebrateRig(family,key),names=rig.map(b=>b.name),bones=names.map(n=>root.getObjectByName(n)),bases=bones.map(b=>b?.quaternion.clone()),scales=bones.map(b=>b?.scale.clone());
  const q=new T.Quaternion(),axis=new T.Vector3(),squash=new T.Vector3(); // 매 프레임 새 벡터를 안 만든다
  return (time,effort)=>{
    const star=family==="starfish",phase=time*(star?1.1:isSquid(family)?3.1:1.9)*Math.max(.25,effort);
    for(let i=0;i<count(family);i++)for(let j=0;j<3;j++){
      const index=10+i*3+j,b=bones[index];if(!b)continue;
      const angle=i*Math.PI*2/(star?5:8),wave=Math.sin(phase-i*.67-j*.65)*(star?.065:.10+j*.075);
      axis.set(star?-Math.sin(angle):0,star?0:Math.cos(angle),star?Math.cos(angle):Math.sin(angle)).normalize();
      b.quaternion.copy(bases[index]!).multiply(q.setFromAxisAngle(axis,wave));
    }
    for(const [i,s]of[[6,1],[7,1],[8,-1],[9,-1]])if(bones[i])bones[i]!.quaternion.copy(bases[i]!).multiply(q.setFromAxisAngle(axis.set(1,0,0),Math.sin(phase-(i%2)*.6)*s*.16));
    if(bones[0]&&scales[0])bones[0].scale.copy(scales[0]!).multiply(squash.set(1+Math.sin(phase)*(star?0:.018),1-Math.sin(phase)*(star?0:.03),1-Math.sin(phase)*(star?0:.03)));
  };
}

export function makeInvertebrateAnimal(kit:ModelKit,family:string,key:string):AnimalModel {
  const root=new T.Group();root.name=key;root.userData.model="authored-invertebrate";
  const g=createInvertebrateGeometry(family,key),material=new T.MeshStandardMaterial({color:0xb7aa98,roughness:.72,metalness:.03,side:T.DoubleSide});
  const mesh=new T.SkinnedMesh(g,material),bones=makeInvertebrateRig(family,key);mesh.name="invertebrate-sculpt";mesh.add(bones[0]);mesh.bind(new T.Skeleton(bones));mesh.frustumCulled=false;root.add(mesh);
  kit.referenceTexture(key,t=>{material.map=t;material.color.set(0xffffff);material.needsUpdate=true;});
  return {root,animate:invertebrateMotion(root,family,key)};
}
