/** Original mammalian volumes, not fish billboards. No game activation. */
import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compressGLB,COMPRESSION} from './glb-compress.mjs';
const DIR='design/aqua3d-review',guide=JSON.parse(await readFile(`${DIR}/mammals-prompts.json`,'utf8'));
const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const selected=new Set(process.argv.slice(2));

function rig(){
 const bones=names.map(name=>{const b=new T.Bone();b.name=name;return b;});
 const world=Array.from({length:6},(_,i)=>new T.Vector3(.85-i*.34,0,0));
 world.push(new T.Vector3(.34,-.10,.15),new T.Vector3(-.10,-.22,.34),new T.Vector3(.34,-.10,-.15),new T.Vector3(-.10,-.22,-.34));
 const parent=[-1,0,1,2,3,4,1,6,1,8];
 bones.forEach((b,i)=>{b.position.copy(world[i]);if(parent[i]>=0){b.position.sub(world[parent[i]]);bones[parent[i]].add(b);}});
 bones[0].updateMatrixWorld(true);return bones;
}
function sampleTable(rows,t){
 let i=0;while(i<rows.length-2&&rows[i+1][0]<t)i++;
 const a=rows[i],b=rows[i+1],q=clamp((t-a[0])/(b[0]-a[0]));return a.slice(1).map((v,k)=>mix(v,b[k+1],q));
}
function sculpt(item,species){
 const baby=item.stage==='fry'?1:item.stage==='juv'?.4:0,seal=species.body==='seal',lion=species.body==='sealion',river=item.family==='otter',sea=item.family==='sea_otter';
 const width=species.widthRatio*(1+baby*.16),p=[],uv=[],indices=[],joint=[],weight=[];
 const profile=river?[[0,.015,.035,.025],[.06,.09,.13,.055],[.14,.13,.16,.065],[.23,.12,.13,.025],[.37,.18,.18,0],[.55,.18,.17,-.015],[.70,.13,.12,-.025],[.77,.07,.07,-.025],[.90,.035,.035,-.025],[1,.007,.007,-.025]]:
 sea?[[0,.02,.04,.05],[.06,.11,.13,.085],[.16,.16,.18,.08],[.26,.16,.18,.02],[.43,.25,.26,0],[.65,.24,.24,-.015],[.82,.13,.14,-.02],[.94,.045,.05,-.02],[1,.008,.01,-.02]]:
 seal?[[0,.025,.045,.075],[.045,.09,.11,.10],[.12,.16,.17,.12],[.23,.19,.20,.07],[.42,.27,.28,0],[.63,.25,.25,-.015],[.80,.16,.16,-.015],[.94,.06,.07,-.015],[1,.015,.02,-.015]]:
 [[0,.025,.04,.09],[.04,.075,.08,.11],[.10,.13,.13,.13],[.18,.18,.16,.13],[.28,.22,.20,.065],[.43,.26,.27,0],[.63,.22,.22,-.02],[.82,.13,.13,-.025],[.95,.05,.05,-.025],[1,.015,.018,-.025]];
 const bodyEnd=river?-1:sea?-.94:-.77;
 const spineWeight=x=>{const f=clamp((.85-x)/.34,0,4.99999),i=Math.floor(f);return [[i,i+1,0,0],[1-(f-i),f-i,0,0]];};
 const vertex=(v,tex,binding)=>{p.push(...v);uv.push(...tex);joint.push(...binding[0]);weight.push(...binding[1]);return p.length/3-1;};
 const bodyCols=40,around=16;
 for(let j=0;j<=bodyCols;j++){
  const t=j/bodyCols,x=mix(1,bodyEnd,t),[ry0,rz0,cy0]=sampleTable(profile,t),head=1+baby*.14*(1-clamp(t/.32));
  let ry=ry0*head*(1+baby*.10),rz=rz0*width/species.widthRatio*head,cy=cy0;
  if(item.family==='steller_sea_lion'&&item.stage==='adult'&&t>.12&&t<.36){ry*=1.18;cy+=.025;}
  if(item.family==='japanese_sea_lion'&&item.stage==='adult'&&t>.10&&t<.20){ry*=1.16;cy+=.025;}
  for(let k=0;k<=around;k++){const a=k/around*Math.PI*2,theta=a<=Math.PI?a:Math.PI*2-a;
   vertex([x,cy+Math.cos(a)*ry,Math.sin(a)*rz],[(x+1)/2,theta/Math.PI*.495],spineWeight(x));
   if(j<bodyCols&&k<around){const q=j*(around+1)+k;indices.push(q,q+around+1,q+1,q+1,q+around+1,q+around+2);}
  }
 }
 for(const [row,sign]of [[0,1],[bodyCols,-1]]){const start=row*(around+1),c=new T.Vector3();for(let k=0;k<around;k++)c.add(new T.Vector3().fromArray(p,(start+k)*3));c.multiplyScalar(1/around);const at=vertex(c.toArray(),[(c.x+1)/2,.25],spineWeight(c.x));for(let k=0;k<around;k++)indices.push(...(sign>0?[at,start+k,start+k+1]:[at,start+k+1,start+k]));}
 // Thick tapered paddles. A closed elliptical cross-section, never a plane.
 function paddle(start,end,broad,thick,bind,fore=false){
  const a=new T.Vector3(...start),b=new T.Vector3(...end),axis=b.clone().sub(a).normalize(),side=new T.Vector3(0,0,1),up=new T.Vector3().crossVectors(side,axis).normalize(),off=p.length/3,rows=7,cols=8;
  for(let j=0;j<=rows;j++){const t=j/rows,c=a.clone().lerp(b,t),shape=.12+.88*Math.sin(Math.PI*(t*.84+.08));
   for(let k=0;k<=cols;k++){const th=k/cols*Math.PI*2,v=c.clone().addScaledVector(side,Math.sin(th)*broad*shape).addScaledVector(up,Math.cos(th)*thick*shape),tex=[clamp((v.x+1)/2),.505+clamp(.47-v.y*.80)*.49];vertex(v.toArray(),tex,bind(t));
    if(j<rows&&k<cols){const q=off+j*(cols+1)+k;indices.push(q,q+1,q+cols+1,q+1,q+cols+2,q+cols+1);}}
  }
  for(const [row,reverse]of [[0,true],[rows,false]]){const c=a.clone().lerp(b,row/rows),at=vertex(c.toArray(),[clamp((c.x+1)/2),.75],bind(row/rows)),s=off+row*(cols+1);for(let k=0;k<cols;k++)indices.push(...(reverse?[at,s+k+1,s+k]:[at,s+k,s+k+1]));}
 }
 for(const sign of [-1,1]){
  const root=sign===1?6:8;
  const foreLength=(lion?.55:seal?.26:.19)*(1-baby*.18),front=[.37,-.10,sign*width*.48],end=[.37-foreLength,lion?-.40:seal?-.36:-.31,sign*(width*.72+(lion?.13:.07))];
  paddle(front,end,lion?.125:seal?.075:.065,lion?.052:.04,t=>[[root,root+1,0,0],[1-t,t,0,0]],true);
  const hindX=river?-.50:sea?-.66:-.73,hindEnd=river?-.70:-1;
  paddle([hindX,-.045,sign*width*.30],[hindEnd,sea?-.16:-.02,sign*(sea?.23:river?.17:.22)],sea?.11:river?.06:.09,sea?.035:.025,t=>[[4,5,0,0],[1-t,t,0,0]]);
 }
 if(!seal){
  // External pinnae only (true seals have none). Eyes remain painted.
  for(const s of[-1,1]){const ear=new T.SphereGeometry(1,8,5);ear.scale(lion?.035:.045,lion?.055:.035,.025);ear.translate(.71,.19,s*(lion?.135:.15));
   const off=p.length/3,pa=ear.attributes.position;for(let i=0;i<pa.count;i++){const v=new T.Vector3().fromBufferAttribute(pa,i);vertex(v.toArray(),[clamp((v.x+1)/2),.11],[[0,0,0,0],[1,0,0,0]]);}for(const n of ear.index.array)indices.push(off+n);ear.dispose();}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joint,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weight,4));g.setIndex(indices);g.computeVertexNormals();
 g.userData.mammal={body:species.body,stage:item.stage,widthRatio:species.widthRatio};return g;
}
async function paint(key){
 const bytes=await readFile(`public/aqua/fish/${key}.webp`),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,r=0,top=info.height,bottom=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>128){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const W=r-l,H=bottom-top,atlas=Buffer.alloc(512*512*4),nearest=(x,y)=>{
  x=Math.round(clamp(x,0,info.width-1));y=Math.round(clamp(y,0,info.height-1));let i=(y*info.width+x)*4;
  if(data[i+3]<128){for(let rad=1;rad<100;rad++)for(const sy of[-1,1]){const yy=Math.round(clamp(y+sy*rad,0,info.height-1)),ii=(yy*info.width+x)*4;if(data[ii+3]>128)return data.subarray(ii,ii+3);}}
  return data.subarray(i,i+3);
 };
 for(let x=0;x<512;x++){
  const px=l+x/511*W,ys=[];for(let y=top;y<=bottom;y++)if(data[(y*info.width+Math.round(px))*4+3]>128)ys.push(y);
  const lo=ys[0]??top,hi=ys.at(-1)??bottom,mid=(lo+hi)*.5,half=(hi-lo)*.5;
  for(let y=0;y<256;y++){const a=y/255*Math.PI,flank=nearest(px,mid-Math.cos(a)*half*.88);
   // Dorsal/ventral caps sample a broad interior fur region, not an edge strip.
   const dorsal=a<Math.PI/2,angleFromPole=dorsal?a:Math.PI-a;
   const cap=nearest(px+Math.sin(a*3+x/511*8)*W*.008,mid+(dorsal?-1:1)*half*(.78-.76*angleFromPole/(Math.PI/2))),s=Math.sin(a),blend=clamp((s-.35)/.45);
   for(let c=0;c<3;c++)atlas[(y*512+x)*4+c]=Math.round(mix(cap[c],flank[c],blend));atlas[(y*512+x)*4+3]=255;
  }
  for(let y=256;y<512;y++){const rgb=nearest(px,top+(y-256)/255*H);atlas.set([...rgb,255],(y*512+x)*4);}
 }
 return {png:await sharp(atlas,{raw:{width:512,height:512,channels:4}}).removeAlpha().png().toBuffer(),sha:createHash('sha256').update(bytes).digest('hex')};
}
function rawGLB(key,g,png,bones){
 const j={asset:{version:'2.0',generator:'Our Days original mammal sculpt'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{name:key,mesh:0,skin:0,extras:{aquaGeometry:'mammal-volume-v1'}}],meshes:[],skins:[],materials:[{name:'natural_fur_PBR',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.91}}],textures:[{sampler:0,source:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],images:[],accessors:[],bufferViews:[],buffers:[{byteLength:0}]};
 const chunks=[];let length=0;
 const view=(array,target)=>{const bytes=Buffer.from(array.buffer??array,array.byteOffset??0,array.byteLength??array.length),index=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes);const pad=(4-bytes.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));length+=bytes.length+pad;return index;};
 const accessor=(array,type,componentType,target)=>{const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type],a={bufferView:view(array,target),componentType,count:array.length/n,type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++){a.min[i%3]=Math.min(a.min[i%3],array[i]);a.max[i%3]=Math.max(a.max[i%3],array[i]);}}j.accessors.push(a);return j.accessors.length-1;};
 j.images.push({bufferView:view(png),mimeType:'image/png',name:key+'_fur'});
 const attributes={};for(const [attribute,name,type,component]of[['position','POSITION','VEC3',5126],['normal','NORMAL','VEC3',5126],['uv','TEXCOORD_0','VEC2',5126],['skinIndex','JOINTS_0','VEC4',5123],['skinWeight','WEIGHTS_0','VEC4',5126]])attributes[name]=accessor(g.attributes[attribute].array,type,component,34962);
 j.meshes.push({primitives:[{attributes,indices:accessor(new Uint16Array(g.index.array),'SCALAR',5123,34963),material:0,mode:4}]});
 bones.forEach(b=>j.nodes.push({name:b.name,translation:b.position.toArray(),...(b.children.length?{children:b.children.map(c=>bones.indexOf(c)+1)}:{})}));
 const inverses=new Float32Array(160);bones.forEach((b,i)=>new T.Matrix4().copy(b.matrixWorld).invert().toArray(inverses,i*16));j.skins.push({name:'aquarium_standard_10',joints:bones.map((_,i)=>i+1),skeleton:1,inverseBindMatrices:accessor(inverses,'MAT4',5126)});
 j.buffers[0].byteLength=length;const bin=Buffer.concat(chunks),json0=Buffer.from(JSON.stringify(j)),json=Buffer.concat([json0,Buffer.alloc((4-json0.length%4)%4,32)]),out=Buffer.alloc(28+json.length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);return out;
}
await mkdir('public/aqua/models/fish',{recursive:true});const entries={};
for(const item of guide.items){if(selected.size&&!selected.has(item.key))continue;
 const species=guide.species.find(s=>s.key===item.family),geometry=sculpt(item,species),texture=await paint(item.key),bones=rig(),bytes=await compressGLB(rawGLB(item.key,geometry,texture.png,bones)),triangles=geometry.index.count/3;
 if(triangles>3000||bytes.length>300000)throw Error(`Budget exceeded ${item.key}`);
 const file=`public/aqua/models/fish/${item.key}.glb`;await writeFile(file,bytes);
 entries[item.key]={kind:'fish',family:item.family,form:item.stage==='juv'?'juvenile':item.stage,file,triangles,bytes:bytes.length,bones:names,anatomyKind:'mammal',textureSize:[512,512],materials:1,skinMeshes:1,animations:0,sourceSHA256:texture.sha,sha256:createHash('sha256').update(bytes).digest('hex'),authoringProfile:species,geometryAuthoring:'mammal-volume-v1',coordinateSystem:{up:'+Y',front:'+X',origin:'body center'},visualApproval:'pending',approval:'pending',activation:'not enabled',limits:{triangles:3000,bytes:300000},compression:{format:'EXT_meshopt_compression + KHR_mesh_quantization + EXT_texture_webp',tool:'design/aqua3d-review/glb-compress.mjs',settings:COMPRESSION}};
 console.log(`${item.key}: ${triangles} triangles / ${bytes.length} bytes`);geometry.dispose();
}
const report=JSON.parse(await readFile(`${DIR}/models.json`,'utf8'));Object.assign(report.models,entries);await writeFile(`${DIR}/models.json`,JSON.stringify(report,null,2)+'\n');
await writeFile(`${DIR}/mammals-status.json`,JSON.stringify({visualApproval:'pending',activation:'not enabled',keys:guide.items.map(i=>i.key),notes:['Original rounded mammalian bodies, painted eyes, solid paddles, exact standard ten-joint rig.','Scientific reconstruction of extinct Japanese sea lions remains an estimate based on supplied species description, not a museum-certified reconstruction.']},null,2)+'\n');
