// Generated from src/lib/aqua3d/faces.ts by build-color-preview.mjs
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import rawProfiles from './face-profiles.json' with {type:'json'};
import {waterLit} from './runtime-waterlight.mjs';

                                                                                                                                                                                                                                                 
export const FACE_PROFILES                                     =rawProfiles;
export const FACE_REVISION='anatomical-surface-v2';
                                                                                                                                               
const faces=new WeakMap                     ();
const clamp=(v       ,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
const quantile=(a         ,q       )=>a.length?a.sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*q))]:0;
export function respiratoryGape(p            ,time       ,seed       ,bite=0)       {
 const rate=p.family==='moray'?.55:p.family==='whale_shark'?.24:.7;
 const wave=(1-Math.cos((Number.isFinite(time)?time:0)*Math.PI*2*rate+(Number.isFinite(seed)?seed:0)))*.5;
 return clamp(Math.max(clamp(bite),Math.min(.22,p.restOpen??.035)+wave*(p.referenceGap?.15:.075)),0,.9);
}
/** Bills end beyond the mouth; rays breathe ventrally; seahorses purse a tube.
 * Flatfish keep their asymmetric native eyes, never a second pair of spheres. */
export function facialAnatomy(family       ,key       ){
 return {ventral:['ray','manta','skate'].includes(family)||key==='aurora_ray',bill:['marlin','swordfish','halfbeak'].includes(family),shark:['nurse_shark','leopard_shark','blue_shark','hammerhead','great_white'].includes(family),tube:family==='seahorse',nativeDentition:['anglerfish','goosefish','gulper_eel'].includes(family),fantasy:family==='rising'&&['imugi_fish','azure_dragonfish','golden_dragonfish'].includes(key)};
}
export function faceJaw(root           )                                                          {
 let found              =null;root.traverse(o=>{found??=faces.get(o)??null;});if(!found)return null;const f=found            ;return {set:f.setBite,restore:()=>f.setBite(0),count:1};
}
export function disposeFishFace(root           )     {const found=new Set          ();root.traverse(o=>{const f=faces.get(o);if(f)found.add(f);});found.forEach(f=>f.dispose());}

/** Sculpt the existing head, not floating eye/lip overlays. Per-instance skin
 * and material preserve the shared GLB. This changes no visual-approval record,
 * game species, inventory or spawn rules. */
export function createFishFace(inner           ,family       ,key       )              {
 const p=FACE_PROFILES[key];if(!p||p.mode==='none')return null;
 let candidate                   =null;inner.traverse(o=>{if(!candidate&&o instanceof T.SkinnedMesh)candidate=o;});if(!candidate)return null;
 const body=candidate                 ,existing=faces.get(body);if(existing)return existing;
 const head=body.skeleton.bones.find(b=>b.name==='spine_0');if(!head)return null;
 const originalMaterial=body.material,source=(Array.isArray(originalMaterial)?originalMaterial[0]:originalMaterial)                          ;
 if(!(source instanceof T.MeshStandardMaterial))return null;
 inner.updateMatrixWorld(true);body.skeleton.update();
 const inverse=new T.Matrix4().copy(inner.matrixWorld).invert(),toRoot=new T.Matrix4().multiplyMatrices(inverse,body.matrixWorld),points            =[],box=new T.Box3();
 const originalGeometry=body.geometry,pos=originalGeometry.attributes.position;
 for(let i=0;i<pos.count;i++){const v=body.getVertexPosition(i,new T.Vector3()).applyMatrix4(toRoot);points.push(v);box.expandByPoint(v);}
 const size=box.getSize(new T.Vector3()),L=size.x;if(!(L>.1&&L<20))return null;
 const a=facialAnatomy(family,key),forward=a.ventral?new T.Vector3(0,-1,0):a.shark?new T.Vector3(.78,-.625,0).normalize():new T.Vector3(1,0,0),up=new T.Vector3(-forward.y,forward.x,0);
 const u=a.bill?(family==='halfbeak'?.76:.73):a.shark?(family==='hammerhead'?.82:.89):clamp(p.mouth?.[0]??.98,.83,.99);
 const center=new T.Vector3(box.min.x+u*L,box.max.y-clamp(p.mouth?.[1]??.55,.08,.92)*size.y,0);
 const section=points.filter(v=>Math.abs(v.x-(center.x-L*.035))<L*.045),depth=clamp(quantile(section.map(v=>Math.abs(v.z)),.70),L*.008,L*.13);
 if(a.shark)center.y=quantile(section.map(v=>v.y),.16)+L*.003;
 if(a.ventral){center.x=box.min.x+L*.77;center.y=box.min.y+size.y*.09;}
 if(a.fantasy){center.x=box.min.x+L*.93;center.y=quantile(section.map(v=>v.y),.5)-L*.018;}
 const width=a.ventral?size.z*.065:depth*.66,jawLength=L*(a.tube?.018:a.bill?.045:a.nativeDentition?.14:.085),oralHeight=clamp((p.referenceGap??0)*size.y*.35,L*.0015,L*.014),pivot=center.clone().addScaledVector(forward,-jawLength);
 // Bounded relief on existing skin only; leave fins, silhouette plates and iris paint intact.
 const geometry=originalGeometry.clone(),gp=geometry.attributes.position,rawBox=originalGeometry.boundingBox??(originalGeometry.computeBoundingBox(),originalGeometry.boundingBox ),positionScale=L/(rawBox.max.x-rawBox.min.x);
 for(let i=0;i<gp.count;i++){
  const v=points[i];if(v.x<box.min.x+L*.68||Math.abs(v.z)<depth*.4||a.ventral||a.tube||a.bill||a.fantasy)continue;
  const dx=(v.x-center.x+L*.014)/(L*.035),dy=(v.y-center.y)/(L*.014),lip=Math.exp(-dx*dx-dy*dy)*L*.0016;
  let socket=0;if(p.eye&&p.eye.confidence>55){const ex=box.min.x+p.eye.u*L,ey=box.max.y-p.eye.v*size.y,r=clamp(p.eye.radius*L,L*.006,L*.02),d=Math.hypot(v.x-ex,v.y-ey)/r;socket=(Math.exp(-(((d-1.1)/.48)**2))-Math.exp(-((d/.60)**2))*.25)*L*.0009;}
  gp.setZ(i,gp.getZ(i)+Math.sign(v.z)*(lip+socket)/positionScale);
 }
 gp.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();body.geometry=geometry;
 const group=new T.Group();group.name='anatomical-face-v2';group.userData.moving=true;
 group.matrix.copy(new T.Matrix4().copy(head.matrixWorld).invert().multiply(inner.matrixWorld));group.matrix.decompose(group.position,group.quaternion,group.scale);head.add(group);
 const basis=new T.Matrix4().makeBasis(forward,up,new T.Vector3(0,0,1)),rotation=new T.Quaternion().setFromRotationMatrix(basis),upper=new T.Group(),lower=new T.Group();
 upper.name='face-upper-jaw';lower.name='face-lower-jaw';for(const g of [upper,lower]){g.position.copy(pivot);g.quaternion.copy(rotation);group.add(g);}
 const enamel=new T.MeshStandardMaterial({color:0xc4bba0,roughness:.48,metalness:0});waterLit(enamel,false);
 // Enamel must stay inside the recessed oral volume even at maximum gape.
 // Without this, the lower row could protrude beyond a tapered native snout.
 const oralInverse={value:new T.Matrix4()},oralCenter={value:center.clone().addScaledVector(forward,-jawLength*.43)},oralAxes={value:new T.Vector3(jawLength*.48,oralHeight*.92,Math.max(width*.8,L*.003))};
 const enamelPrior=enamel.onBeforeCompile,enamelCache=enamel.customProgramCacheKey.bind(enamel);
 enamel.onBeforeCompile=(shader,renderer)=>{enamelPrior.call(enamel,shader,renderer);Object.assign(shader.uniforms,{oralInverse,oralCenter,oralAxes,oralForward:{value:forward},oralUp:{value:up}});shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 oralInverse;varying vec3 enamelLocal;').replace('#include <project_vertex>','enamelLocal=(oralInverse*modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 enamelLocal;uniform vec3 oralCenter;uniform vec3 oralAxes;uniform vec3 oralForward;uniform vec3 oralUp;').replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nvec3 enamelP=enamelLocal-oralCenter;vec3 enamelQ=vec3(dot(enamelP,oralForward),dot(enamelP,oralUp),enamelP.z)/oralAxes;if(dot(enamelQ,enamelQ)>1.)discard;');};
 enamel.customProgramCacheKey=()=>enamelCache()+'|recessed-enamel-v2';
 const geometries                   =[];let triangles=0;
 const cavityMaterial=new T.MeshStandardMaterial({color:0x160c0d,roughness:.94,side:T.BackSide});waterLit(cavityMaterial,false);
 // Recessed closed interior. It never extends beyond the native snout.
 if(!a.tube&&!a.ventral&&!a.bill&&!a.fantasy&&!a.nativeDentition){const g=new T.SphereGeometry(1,10,6);g.scale(jawLength*.55,oralHeight,width*.88);g.translate(jawLength*.49,0,0);geometries.push(g);const cavity=new T.Mesh(g,cavityMaterial);cavity.userData.glbShared=true;upper.add(cavity);triangles+=(g.index?.count??g.attributes.position.count)/3;}
 if(!a.nativeDentition&&!a.ventral&&!a.tube&&!a.bill&&!a.fantasy&&['fang','triangular','fine','beak'].includes(p.teeth??'')){
  for(const top of [true,false]){const parts                   =[],count=p.teeth==='beak'?2:p.teeth==='fine'?10:8;
   for(let i=0;i<count;i++){const angle=(i+.5)/count*Math.PI,h=Math.min(oralHeight*.65,L*(p.teeth==='fang'?.006:p.teeth==='triangular'?.005:p.teeth==='beak'?.004:.002)),g=p.teeth==='beak'?new T.SphereGeometry(1,6,3):new T.ConeGeometry(1,1,p.teeth==='triangular'?3:4,1);
    g.scale(h*.25,h,h*.18);if(top)g.rotateZ(Math.PI);g.translate(jawLength*(.18+.67*Math.sin(angle)),(top?1:-1)*(oralHeight-h*.45),Math.cos(angle)*width*.70);parts.push(g);}
   const g=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(g){geometries.push(g);triangles+=(g.index?.count??g.attributes.position.count)/3;const mesh=new T.Mesh(g,enamel);mesh.name='recessed-enamel';mesh.userData.glbShared=true;mesh.onBeforeRender=()=>{oralInverse.value.copy(group.matrixWorld).invert();};(top?upper:lower).add(mesh);}
  }
 }
 const cloned=source.clone();cloned.onBeforeCompile=source.onBeforeCompile;cloned.customProgramCacheKey=source.customProgramCacheKey;
 const opening={value:0},clock={value:0},mode={value:new T.Vector4(a.tube?1:0,a.ventral?1:0,a.nativeDentition?1:0,a.bill?1:0)},dim={value:new T.Vector4(jawLength,Math.max(width,L*.005),oralHeight,positionScale)};
 const prior=cloned.onBeforeCompile,cache=cloned.customProgramCacheKey.bind(cloned);
 const declarations='uniform float faceOpen;uniform float faceClock;uniform vec3 faceMouth;uniform vec3 faceForward;uniform vec3 faceUp;uniform vec4 faceDim;uniform vec4 faceMode;';
 const deformation=`
 vec3 faceP=transformed*faceDim.w-faceMouth;
 float faceX=dot(faceP,faceForward),faceY=dot(faceP,faceUp);
 float jawWeight=smoothstep(-faceDim.x,-faceDim.x*.12,faceX)*(1.-smoothstep(-faceDim.z*.5,faceDim.z*.5,faceY));
 float faceAngle=-faceOpen*.16*jawWeight*(1.-faceMode.x);
 float faceAlong=faceX+faceDim.x;
 transformed+=(faceForward*(faceAlong*(cos(faceAngle)-1.)-faceY*sin(faceAngle))+faceUp*(faceAlong*sin(faceAngle)+faceY*(cos(faceAngle)-1.)))/faceDim.w;
 float purse=faceMode.x*faceOpen*.07*smoothstep(-faceDim.x,0.,faceX);
 transformed-=(faceUp*faceY+vec3(0.,0.,faceP.z))*purse/faceDim.w;
 float gill=exp(-pow((faceX+faceDim.x*2.)/(faceDim.x*.8),2.))*sin(faceClock)*.0011;
 transformed.z+=faceP.z*gill*(1.-faceMode.x);
 `;
 cloned.onBeforeCompile=(shader,renderer)=>{prior.call(cloned,shader,renderer);Object.assign(shader.uniforms,{faceOpen:opening,faceClock:clock,faceMouth:{value:center},faceForward:{value:forward},faceUp:{value:up},faceDim:dim,faceMode:mode});shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+declarations+'varying vec3 faceRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nfaceRest=transformed*faceDim.w;\n'+deformation);
  if(!a.tube&&!a.ventral&&!a.bill&&!a.fantasy&&!a.nativeDentition)shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+declarations+'varying vec3 faceRest;').replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
   vec3 oralP=faceRest-faceMouth;float oralX=dot(oralP,faceForward),oralY=dot(oralP,faceUp);
   float oralH=faceDim.z*(.30+faceOpen*.70);
   if(faceOpen>.08&&oralX>-faceDim.x*.62&&oralX<faceDim.x*.08&&pow(oralY/oralH,2.)+pow(oralP.z/(faceDim.y*.78),2.)<1.)discard;`);
 };
 cloned.customProgramCacheKey=()=>cache()+'|'+FACE_REVISION;cloned.needsUpdate=true;body.material=cloned;
 const seed=Array.from(body.uuid).reduce((n,c)=>(n*31+c.charCodeAt(0))%997,0)*.031,q=new T.Quaternion(),axis=new T.Vector3(0,0,1);let bite=0,disposed=false;
 const rig         ={root:group,profile:p,triangles,setBite:v=>{bite=clamp(v);},animate:time=>{const t=Number.isFinite(time)?time:0,gape=respiratoryGape(p,t,seed,bite);opening.value=gape;clock.value=t*Math.PI*1.4+seed;lower.quaternion.copy(rotation).multiply(q.setFromAxisAngle(axis,-gape*.16*(a.tube?0:1)));},dispose:()=>{if(disposed)return;disposed=true;faces.delete(body);group.removeFromParent();body.material=originalMaterial;body.geometry=originalGeometry;cloned.dispose();geometry.dispose();geometries.forEach(g=>g.dispose());enamel.dispose();cavityMaterial.dispose();}};
 faces.set(body,rig);rig.animate(0);return rig;
}
