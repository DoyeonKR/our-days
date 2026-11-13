import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {compressGLB} from './glb-compress.mjs';
import {packCeph} from './ceph-v2-pack.mjs';
const DIR='design/aqua3d-review',OUT='public/aqua/models/fish-v2';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const hash=(x,y,z)=>{const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n);};
function noise3(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),s=t=>t*t*(3-2*t),u=s(x-ix),v=s(y-iy),w=s(z-iz);return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),u),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),u),v),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),u),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),u),v),w)*2-1;}
const families=['octopus','kraken','squid','giant_squid'];
const standard=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'];
export function makeCeph(family,stage){
 const octo=family==='octopus'||family==='kraken',kraken=family==='kraken',baby=stage==='fry'?1:stage==='juv'?.45:0,arms=octo?8:10;
 const p=[],uv=[],idx=[],ji=[],wt=[],bones=[],world=[],parents=[],paths=[];
 function bone(name,v,parent){const b=new T.Bone();b.name=name;b.position.copy(v);const n=bones.length;bones.push(b);world.push(v.clone());parents.push(parent);if(parent>=0){b.position.sub(world[parent]);bones[parent].add(b);}return n;}
 standard.forEach((name,i)=>bone(name,new T.Vector3(i<6?-i*.13:-.68,octo?.157+i*.065:0,i<6?0:i<8?.16:-.16),i===0?-1:i<6?i-1:i===6||i===8?3:i-1));
 const mantleCenter=new T.Vector3(octo?(kraken?-.29:-.24):-.54,octo?.33+baby*.035:0,0),mantle=bone('mantle',mantleCenter,0);
 const centerline=(a,t)=>{
  if(octo){const angle=(a+.5)*Math.PI/4,L=(.75+.095*Math.sin(a*1.87))*(1-baby*.14),root=.105;let x=Math.cos(angle)*root,z=Math.sin(angle)*root;const steps=50,N=Math.max(1,Math.ceil(t*steps));for(let j=0;j<N;j++){const u=(j+.5)/N*t,turn=Math.pow(clamp((u-.66)/.34),2)*2.45*(a%2?-1:1),ang=angle+turn+.055*Math.sin(u*5+a);x+=Math.cos(ang)*L*t/N;z+=Math.sin(ang)*L*t/N;}return new T.Vector3(x,.13*Math.pow(1-t,2)+.027+.085*Math.pow(clamp((t-.73)/.27),1.8),z);}
  const giant=family==='giant_squid',tentacle=a>=8,angle=tentacle?(a===8?1:-1)*.27:(a-3.5)*.17,L=tentacle?(giant?2.05:1.0):(giant?.78:.6)+baby*.035,spread=tentacle?.16:.13;return new T.Vector3(.03+L*t,.055*Math.cos(a*Math.PI/4)+Math.sin(a*2.4)*spread*t+.04*Math.sin(t*4),Math.sin(angle)*(.09+L*t)+Math.sin(t*4+a)*.025*t);
 };
 for(let a=0;a<arms;a++){const path=Array.from({length:6},(_,j)=>centerline(a,j/5));paths.push(path.map(p=>p.toArray()));for(let j=0;j<6;j++)bone(`arm_${a}_${j}`,path[j],j===0?0:11+a*6+j-1);}
 bones[0].updateMatrixWorld(true);
 const bound=(id)=>[[id,0,0,0],[1,0,0,0]];
 const armBind=(a,t)=>{const f=clamp(t*5,0,4.999999),j=Math.floor(f);return [[11+a*6+j,11+a*6+j+1,0,0],[1-f+j,f-j,0,0]];};
 const vertex=(v,tex,b)=>{p.push(...v.toArray());uv.push(...tex);ji.push(...b[0]);wt.push(...b[1]);return p.length/3-1;};
 const addSphere=(center,scale,bind,texture='body',rotate=0,cols=24,rows=14)=>{const g=new T.SphereGeometry(1,cols,rows),off=p.length/3,pa=g.attributes.position,ua=g.attributes.uv,rot=new T.Matrix4().makeRotationZ(rotate);for(let i=0;i<pa.count;i++){const q=new T.Vector3().fromBufferAttribute(pa,i),bump=(bind===mantle?(kraken?.023:.010):.002)*Math.sin(q.x*18+q.z*7)*Math.sin(q.y*20-q.z*11),v=q.multiplyScalar(1+bump).multiply(new T.Vector3(...scale)).applyMatrix4(rot).add(center),u=ua.getX(i),vv=ua.getY(i);vertex(v,texture==='eye'?[.01+u*.28,.805+(1-vv)*.185]:[u,.015+(1-vv)*.46],bound(bind));}for(const n of g.index.array)idx.push(off+n);g.dispose();};
 addSphere(mantleCenter,octo?[(kraken?.43:.34)*(1+baby*.12),.25*(1+baby*.12),(kraken?.30:.265)*(1+baby*.12)]:[(family==='giant_squid'?.58:.51)*(1-baby*.12),(family==='giant_squid'?.16:.14)*(1+baby*.25),(family==='giant_squid'?.17:.15)*(1+baby*.25)],mantle,'body',octo?-.24:0,28,16);
 addSphere(new T.Vector3(octo?-.005:.015,octo?.205:0,0),(octo?[.195,.18,.21]:[.16,.13,.145]).map(v=>v*(1+baby*.12)),0,'body',0,24,12);
 // Lateral eye housings with a painted slit pupil. No billboard or detached eye stalk.
 for(const s of[-1,1]){addSphere(new T.Vector3(octo?.055:.025,octo?.285:.02,s*(octo?.178:.117)),octo?[.083,.077,.052]:[.062,.062,.037],0,'body',0,16,8);
  const off=p.length/3,cols=20,rows=5,r=(octo?.053:.045)*(1+baby*.16),c=new T.Vector3(octo?.106:.058,octo?.293:.025,s*(octo?.212:.14)),normal=new T.Vector3(.55,0,s*.835).normalize(),horizontal=new T.Vector3(.835,0,-s*.55).normalize();
  for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){const rr=j/rows,theta=k/cols*Math.PI*2,v=c.clone().addScaledVector(horizontal,Math.cos(theta)*r*rr).addScaledVector(new T.Vector3(0,1,0),Math.sin(theta)*r*rr).addScaledVector(normal,.012*(1-rr*rr));vertex(v,[.15+Math.cos(theta)*rr*.125,.895+Math.sin(theta)*rr*.085],bound(0));if(j<rows&&k<cols){const q=off+j*(cols+1)+k;idx.push(...(s>0?[q,q+cols+1,q+1,q+1,q+cols+1,q+cols+2]:[q,q+1,q+cols+1,q+1,q+cols+2,q+cols+1]));}}
 }
 // Closed tubes: round from every direction; small ventral ripples, never sphere suckers.
 for(let a=0;a<arms;a++){const off=p.length/3,rows=octo?24:19,cols=8;for(let j=0;j<=rows;j++){const t=j/rows,c=centerline(a,t),tangent=centerline(a,Math.min(1,t+.002)).sub(centerline(a,Math.max(0,t-.002))).normalize(),up=new T.Vector3(0,1,0).addScaledVector(tangent,-tangent.y).normalize(),side=new T.Vector3().crossVectors(tangent,up).normalize();let r=(octo?.073:.041)*(1-baby*.12)*Math.pow(1-t,.92)+.0025;if(!octo&&a>=8)r=.013+.028*Math.exp(-Math.pow((t-.89)/.085,2));
  for(let k=0;k<=cols;k++){const th=k/cols*Math.PI*2,ventral=Math.pow(Math.max(0,-Math.cos(th)),8),relief=.0017*ventral*Math.sin(t*Math.PI*30),v=c.clone().addScaledVector(up,Math.cos(th)*(r+relief)).addScaledVector(side,Math.sin(th)*r);vertex(v,[.015+t*.97,.505+k/cols*.275],armBind(a,t));if(j<rows&&k<cols){const q=off+j*(cols+1)+k;idx.push(q,q+1,q+cols+1,q+1,q+cols+2,q+cols+1);}}
 }for(const [row,rev]of[[0,false],[rows,true]]){const at=vertex(centerline(a,row/rows),[.5,.52],armBind(a,row/rows)),s=off+row*(cols+1);for(let k=0;k<cols;k++)idx.push(...(rev?[at,s+k,s+k+1]:[at,s+k+1,s+k]));}}
 if(octo){ // Bilateral thin-volume webs, blended across the two neighbouring arm chains.
  for(let a=0;a<8;a++){const b=(a+1)%8,off=p.length/3,rows=4,cols=4;for(const side of[-1,1])for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){const t=j/rows*.20,u=k/cols,A=centerline(a,t),B=centerline(b,t),v=A.clone().lerp(B,u);v.y+=Math.sin(Math.PI*u)*.015+side*.0035;const ba=armBind(a,t),bb=armBind(b,t);vertex(v,[(a/8+u/8),.03+t*1.4],[[ba[0][0],ba[0][1],bb[0][0],bb[0][1]],[ba[1][0]*(1-u),ba[1][1]*(1-u),bb[1][0]*u,bb[1][1]*u]]);if(j<rows&&k<cols){const q=off+(side===1?25:0)+j*5+k;idx.push(...(side===1?[q,q+1,q+5,q+1,q+6,q+5]:[q,q+5,q+1,q+1,q+5,q+6]));}}for(let k=0;k<4;k++){const q=off+20+k;idx.push(q,q+1,q+25,q+1,q+26,q+25);}}
 }else{for(const s of[-1,1]){const g=new T.SphereGeometry(1,16,8),pa=g.attributes.position;for(let i=0;i<pa.count;i++){const x=pa.getX(i),f=(1-Math.abs(x))/Math.max(.001,Math.sqrt(1-x*x));pa.setXYZ(i,x*.29-.80,pa.getY(i)*.018,pa.getZ(i)*f*.24+s*.055);}const off=p.length/3;for(let i=0;i<pa.count;i++)vertex(new T.Vector3().fromBufferAttribute(pa,i),[g.attributes.uv.getX(i),.01+g.attributes.uv.getY(i)*.46],bound(s>0?6:8));for(const n of g.index.array)idx.push(off+n);g.dispose();}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ji,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(wt,4));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3()),scale=2/Math.max(size.x,size.z),crownY=octo?.157:0;g.translate(0,-crownY,0);g.scale(scale,scale,scale);bones[0].position.y-=crownY;bones.forEach(b=>b.position.multiplyScalar(scale));bones[0].updateMatrixWorld(true);for(const path of paths)for(const v of path){v[1]-=crownY;for(let i=0;i<3;i++)v[i]*=scale;}return {geometry:g,bones,paths,octo,scale,groundPlaneY:-crownY*scale};
}
async function paint(key,family){
 const bytes=await readFile(`public/aqua/fish/${key}.webp`),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),pixels=Buffer.alloc(512*512*3);
 const region=family==='octopus'?[.38,.31,.15,.10]:family==='kraken'?[.40,.25,.16,.07]:family==='squid'?[.30,.51,.20,.035]:[.32,.35,.15,.035];
 const sample=(u,v)=>{let x=Math.round(clamp(u)*511),y=Math.round(clamp(v)*511),i=(y*info.width+x)*4;if(data[i+3]<150){x=Math.round(region[0]*511);y=Math.round(region[1]*511);i=(y*info.width+x)*4;}return [data[i],data[i+1],data[i+2]];};
 // Robust local palette, not a stretched projection of highlights, eyes, or other arms.
 const palette=[[],[],[]];for(let j=0;j<32;j++)for(let i=0;i<32;i++){const c=sample(region[0]+(i/31-.5)*region[2],region[1]+(j/31-.5)*region[3]);if(Math.max(...c)<215&&Math.min(...c)>12)c.forEach((v,k)=>palette[k].push(v));}const base=palette.map((a,k)=>(a.sort((a,b)=>a-b)[Math.floor(a.length*.50)]??90)*(family==='octopus'?[1.06,1.12,1.14][k]:1));
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const u=x/511,v=y/511,phi=u*Math.PI*2,theta=clamp((v-.015)/.46)*Math.PI,sx=Math.sin(theta)*Math.cos(phi),sy=Math.cos(theta),sz=Math.sin(theta)*Math.sin(phi),noise=hash(x,y,1)*2-1,cloud=y<250?noise3(sx*12+12,sy*12+12,sz*12+12):noise3(u*28,v*28,8),fine=y<250?noise3(sx*85+85,sy*85+85,sz*85+85):noise3(u*150,v*150,3),rgb=base;let color=rgb.map(c=>clamp(c*(1+cloud*.26+noise*.07+fine*.13),0,255));
  if(y<250&&(family==='squid'||family==='giant_squid')){color=color.map((c,i)=>mix(c,[222,194,172][i],clamp((theta/Math.PI-.48)*1.7)));const spot=noise3(sx*46+3,sy*46+3,sz*46+3),dark=family==='giant_squid'?[112,22,24]:[150,48,38];if(spot>.38)color=color.map((c,i)=>mix(c,dark[i],clamp((spot-.38)*3.2)*(1-clamp((theta/Math.PI-.5)*2))));}
  if(y>=256&&y<402){const theta=(v-.505)/.275*Math.PI*2,ventral=Math.max(0,-Math.cos(theta)),pale=family==='kraken'?[160,155,127]:[223,181,153];color=color.map((c,i)=>mix(c,pale[i],ventral*.53));for(const row of[.605,.68]){const dx=((u*15+.5)%1-.5)/.24,dy=(v-row)/.019,d=Math.hypot(dx,dy);if(d<1.12)color=(d>.7?[190,151,122]:d>.35?[227,200,170]:[124,89,67]).map((c,i)=>family==='kraken'?c*.78:c);}}
  if(y>404&&x<155){const dx=(u-.15)/.125,dy=(v-.895)/.085,d=Math.hypot(dx,dy),iris=family==='kraken'?[74,85,58]:[96,70,35];color=d>1?rgb:d>.88?[55,40,30]:iris.map(c=>c+Math.sin(Math.atan2(dy,dx)*40)*8);if(Math.abs(dy)<.12*(1-dx*dx)+.012&&Math.abs(dx)<.88)color=[8,12,10];}
  for(let c=0;c<3;c++)pixels[(y*512+x)*3+c]=Math.round(clamp(color[c],0,255));
 }
 return {png:await sharp(pixels,{raw:{width:512,height:512,channels:3}}).png().toBuffer(),sourceSHA256:createHash('sha256').update(bytes).digest('hex')};
}
if(process.argv[1]?.endsWith('build-ceph-v2.mjs')){
 await mkdir(OUT,{recursive:true});const models={};
 for(const family of families)for(const stage of['fry','juv','adult']){const key=stage==='adult'?family:`${stage}_${family}`,s=makeCeph(family,stage),tex=await paint(key,family),extras={aquaGeometry:'ceph-volume-v2',armJointCount:6,armCount:s.paths.length,legacyCephShader:false,origin:'arm crown center',groundPlaneY:s.groundPlaneY,authoringScale:s.scale,armRestPoints:s.paths},bytes=await compressGLB(packCeph(key,s.geometry,tex.png,s.bones,extras)),triangles=s.geometry.index.count/3;
  if(triangles>6000||bytes.length>400000)throw Error(`Budget: ${key} ${triangles} / ${bytes.length}`);
  const file=`${OUT}/${key}.glb`;await writeFile(file,bytes);models[key]={key,family,stage,kind:'fish',file,triangles,bytes:bytes.length,bones:s.bones.map(b=>b.name),textureSize:[512,512],materials:1,skinMeshes:1,animations:0,sourceSHA256:tex.sourceSHA256,sha256:createHash('sha256').update(bytes).digest('hex'),...extras,visualApproval:'pending',activation:'not enabled'};console.log(`${key}: ${triangles} triangles, ${bytes.length} bytes, ${s.bones.length} bones`);
 }
 await writeFile(`${DIR}/ceph-v2-models.json`,JSON.stringify({models},null,2)+'\n');
 await writeFile(`${DIR}/ceph-v2-status.json`,JSON.stringify({visualApproval:'pending',activation:'not enabled',keys:Object.keys(models),handoff:['Use six-joint arm chains; turn OFF the legacy image-UV ceph shader for aquaGeometry=ceph-volume-v2.','Root arm chains and mantle under spine_0. mantle supports local scaling. Original images and active GLBs untouched.','Ground-contact demonstration is isolated review IK, NOT integrated gameplay.'],limits:{triangles:6000,bytes:400000},notes:['Unseen anatomy is reconstructed from supplied single-view illustrations, not a scanned animal.','All twelve prepared models require user visual approval before replacing active assets.']},null,2)+'\n');
}
