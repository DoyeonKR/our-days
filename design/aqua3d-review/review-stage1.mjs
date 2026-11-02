/** Read the actual saved GLBs, not the authoring scene, and render their rest poses.
 * CPU diffuse proof renders are not a substitute for a user's PBR/WebGL visual approval.
 */
import * as T from 'three';
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
const OUT='design/aqua3d-review',DIR=`${OUT}/models`,report=JSON.parse(await readFile(`${OUT}/models.json`,'utf8'));
const validator=createRequire(path.join(tmpdir(),'our-days-glb-validator','package.json'))('gltf-validator');
const boneNames=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'];
const size=480,light=new T.Vector3(-.4,.8,1).normalize();
const nativeStills=process.argv.includes('--native-stills');
function parse(bytes){
 if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid GLB header');
 const len=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+len)),bin=bytes.subarray(28+len);
 const access=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0),n=a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type]);
  const type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];return new type(bin.buffer,bin.byteOffset+offset,n);};
 return {json,bin,access};
}
async function sceneFromGLB(bytes){
 const {json:j,bin,access}=parse(bytes),images=[];
 for(const img of j.images){const view=j.bufferViews[img.bufferView],{data,info}=await sharp(bin.subarray(view.byteOffset,view.byteOffset+view.byteLength)).ensureAlpha().raw().toBuffer({resolveWithObject:true});images.push({data,width:info.width,height:info.height});}
 const joints=new Set(j.skins?.flatMap(s=>s.joints)??[]),nodes=j.nodes.map((n,i)=>{
  let o=joints.has(i)?new T.Bone():new T.Group();
  if(n.mesh!==undefined){const primitive=j.meshes[n.mesh].primitives[0],a=primitive.attributes,g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(access(a.POSITION),3));g.setAttribute('normal',new T.BufferAttribute(access(a.NORMAL),3));g.setAttribute('uv',new T.BufferAttribute(access(a.TEXCOORD_0),2));g.setIndex(new T.BufferAttribute(access(primitive.indices),1));
   if(n.skin!==undefined){g.setAttribute('skinIndex',new T.BufferAttribute(access(a.JOINTS_0),4));g.setAttribute('skinWeight',new T.BufferAttribute(access(a.WEIGHTS_0),4));}
   const mat=j.materials[primitive.material],image=images[j.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source],texture=new T.DataTexture(image.data,image.width,image.height);texture.colorSpace=T.SRGBColorSpace;texture.flipY=false;
   const m=new T.MeshStandardMaterial({map:texture,color:0xffffff,side:T.DoubleSide});m.userData.opacity=mat.pbrMetallicRoughness.baseColorFactor?.[3]??1;
   o=n.skin!==undefined?new T.SkinnedMesh(g,m):new T.Mesh(g,m);
  }
  o.name=n.name;o.position.fromArray(n.translation??[0,0,0]);if(n.rotation)o.quaternion.fromArray(n.rotation);return o;
 });
 const root=new T.Group();for(let i=0;i<j.nodes.length;i++)for(const child of j.nodes[i].children??[])nodes[i].add(nodes[child]);for(const i of j.scenes[j.scene].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
 for(let i=0;i<j.nodes.length;i++)if(j.nodes[i].skin!==undefined){const s=j.skins[j.nodes[i].skin],raw=access(s.inverseBindMatrices),inverses=s.joints.map((_,k)=>new T.Matrix4().fromArray(raw,k*16));nodes[i].bind(new T.Skeleton(s.joints.map(k=>nodes[k]),inverses),new T.Matrix4());}
 return {root,json:j,access,images};
}
const edge=(a,b,x,y)=>(x-a.x)*(b.y-a.y)-(y-a.y)*(b.x-a.x);
async function render(root,direction,file){
 const bounds=new T.Box3().setFromObject(root),center=bounds.getCenter(new T.Vector3()),extent=bounds.getSize(new T.Vector3()),span=Math.max(extent.x,extent.y,extent.z)*.64;
 const camera=new T.OrthographicCamera(-span,span,span,-span,.01,100);camera.position.copy(center).add(new T.Vector3(...direction).normalize().multiplyScalar(15));camera.lookAt(center);camera.updateMatrixWorld();
 const project=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),pixels=new Uint8Array(size*size*4),depth=new Float32Array(size*size).fill(Infinity);
 root.traverse(m=>{if(!(m instanceof T.Mesh))return;const g=m.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,image=m.material.map.image,normalMatrix=new T.Matrix3().getNormalMatrix(m.matrixWorld),vertices=[];
  for(let i=0;i<p.count;i++){const local=new T.Vector3().fromBufferAttribute(p,i);if(m instanceof T.SkinnedMesh)m.applyBoneTransform(i,local);const point=local.applyMatrix4(m.matrixWorld).applyMatrix4(project),normal=new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();vertices.push({x:(point.x+1)*size/2,y:(1-point.y)*size/2,z:point.z,u:uv.getX(i),v:uv.getY(i),normal});}
  for(let k=0;k<g.index.count;k+=3){const [a,b,c]=[0,1,2].map(i=>vertices[g.index.getX(k+i)]),area=edge(a,b,c.x,c.y);if(Math.abs(area)<.0001)continue;
   const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(size-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(size-1,Math.ceil(Math.max(a.y,b.y,c.y)));
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const w0=edge(b,c,x+.5,y+.5)/area,w1=edge(c,a,x+.5,y+.5)/area,w2=1-w0-w1;if(w0<0||w1<0||w2<0)continue;const z=a.z*w0+b.z*w1+c.z*w2,i=y*size+x;if(z>=depth[i])continue;
    const u=Math.max(0,Math.min(.99999,a.u*w0+b.u*w1+c.u*w2)),v=Math.max(0,Math.min(.99999,a.v*w0+b.v*w1+c.v*w2)),offset=(Math.floor(v*image.height)*image.width+Math.floor(u*image.width))*4;
    const normal=a.normal.clone().multiplyScalar(w0).addScaledVector(b.normal,w1).addScaledVector(c.normal,w2).normalize();if(area<0)normal.negate();const shade=.72+.28*Math.max(0,normal.dot(light));
    pixels[i*4]=image.data[offset]*shade;pixels[i*4+1]=image.data[offset+1]*shade;pixels[i*4+2]=image.data[offset+2]*shade;pixels[i*4+3]=Math.round(255*m.material.userData.opacity);depth[i]=z;
   }
  }
 });
 await sharp(pixels,{raw:{width:size,height:size,channels:4}}).webp({quality:90}).toFile(file);
}
const fishCards=[],decorCards=[],summary=[];
for(const [key,meta]of Object.entries(report.models)){
 const bytes=await readFile(meta.file),validated=await validator.validateBytes(new Uint8Array(bytes),{uri:meta.file,maxIssues:1000});
 meta.validation={validator:'Khronos glTF-Validator 2.0.0-dev.3.10',errors:validated.issues.numErrors,warnings:validated.issues.numWarnings,messages:validated.issues.messages};
 if(validated.issues.numErrors)throw new Error(`${key}: ${JSON.stringify(validated.issues.messages.filter(m=>m.severity===0).slice(0,5))}`);
 const {root,json,access,images}=await sceneFromGLB(bytes),triangles=json.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0),0),bones=json.skins?.[0].joints.map(i=>json.nodes[i].name)??[];
 if(triangles>meta.limits.triangles||bytes.length>meta.limits.bytes||images.some(i=>i.width>1024||i.height>1024))throw new Error(`Budget exceeded: ${key}`);
 if(meta.kind==='fish'){
  if(JSON.stringify(bones)!==JSON.stringify(boneNames)||json.nodes.filter(n=>n.skin!==undefined).length!==1||json.meshes.length!==1)throw new Error(`Skin contract ${key}`);
  const p=json.meshes[0].primitives[0],joint=access(p.attributes.JOINTS_0),weight=access(p.attributes.WEIGHTS_0);
  const influences=new Set();
  for(let i=0;i<weight.length;i+=4){let sum=0;for(let j=0;j<4;j++){if(joint[i+j]>=10)throw new Error(`Joint index ${key}`);sum+=weight[i+j];}if(Math.abs(sum-1)>.0001)throw new Error(`Skin weight ${key}`);}
  for(let i=0;i<weight.length;i++)if(weight[i]>1e-6)influences.add(bones[joint[i]]);meta.weightedBones=[...influences].sort();
  if(key!=='moon_jelly'&&bones.some(name=>!influences.has(name)))throw new Error(`Unused required joint ${key}: ${bones.filter(name=>!influences.has(name))}`);
  let skinned;root.traverse(o=>{if(o.isSkinnedMesh)skinned=o;});
  const rest=[];for(let i=0;i<skinned.geometry.attributes.position.count;i++)rest.push(new T.Vector3().fromBufferAttribute(skinned.geometry.attributes.position,i));
  let maximumDisplacement=0;
  for(const phase of[0,.7,1.4]){for(let i=1;i<6;i++)skinned.skeleton.bones[i].rotation.y=Math.sin(phase-i*.6)*(.02+i*.025);for(let i=6;i<10;i++)skinned.skeleton.bones[i].rotation.x=Math.sin(phase-i*.4)*.25;root.updateMatrixWorld(true);skinned.skeleton.update();
   for(let i=0;i<rest.length;i++){const moved=skinned.applyBoneTransform(i,rest[i].clone());if(![moved.x,moved.y,moved.z].every(Number.isFinite))throw new Error(`Nonfinite deformed vertex ${key}`);maximumDisplacement=Math.max(maximumDisplacement,moved.distanceTo(rest[i]));}
  }
  if(maximumDisplacement<.001)throw new Error(`Static skin ${key}`);
  for(const bone of skinned.skeleton.bones)bone.rotation.set(0,0,0);root.updateMatrixWorld(true);skinned.skeleton.update();
  meta.deformationValidation={sampledPoses:3,allVerticesFinite:true,maximumDisplacement};
 }
 meta.triangles=triangles;meta.bytes=bytes.length;meta.bones=bones;meta.textureSize=[images[0].width,images[0].height];meta.sha256=(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
 const fish=meta.kind==='fish',views={front:fish?[1,0,0]:[0,0,1],side:fish?[0,0,1]:[1,0,0],oblique:[1,.55,1.6]};
 if(!nativeStills)for(const [name,eye]of Object.entries(views))await render(root,eye,`${DIR}/${key}-${name}.webp`);
 const ray=meta.kind==='fish'&&(['ray','manta'].includes(meta.family)||key==='aurora_ray');if(ray&&!nativeStills)await render(root,[0,1,.001],`${DIR}/${key}-top.webp`);
 const refPath=`public/aqua/${meta.kind}/${key}.webp`,reference=sharp(await readFile(refPath));if(key==='moon_jelly')reference.rotate(90);
 const source=await reference.resize(320,300,{fit:'contain',background:'#18323a'}).png().toBuffer();
 const projection=await sharp(`${DIR}/${key}-${ray?'top':'side'}.webp`).resize(320,300,{fit:'contain',background:'#18323a'}).png().toBuffer();
 const oblique=await sharp(`${DIR}/${key}-oblique.webp`).resize(320,300,{fit:'contain',background:'#18323a'}).png().toBuffer();
 const text=Buffer.from(`<svg width="960" height="64"><g fill="#edf4e8" font-family="sans-serif" font-size="17"><text x="12" y="23">${key} · PENDING USER REVIEW</text><text x="12" y="52">Reference${key==='moon_jelly'?' (90°)':''}</text><text x="332" y="52">${ray?'Top (reference is dorsal)':fish?'Side (+Z)':'Side (+X)'}</text><text x="652" y="52">Oblique · no approval score</text></g></svg>`);
 const card=await sharp({create:{width:960,height:364,channels:4,background:'#18323a'}}).composite([{input:text,left:0,top:0},{input:source,left:0,top:64},{input:projection,left:320,top:64},{input:oblique,left:640,top:64}]).webp({quality:91}).toBuffer();
 await writeFile(`${DIR}/${key}-comparison.webp`,card);(fish?fishCards:decorCards).push({key,card});summary.push({key,triangles,bytes:bytes.length,errors:validated.issues.numErrors,warnings:validated.issues.numWarnings});console.log(`Reviewed actual GLB: ${key}`);
}
for(const [kind,cards]of[['fish',fishCards],['decor',decorCards]])for(let page=0;page<Math.ceil(cards.length/5);page++){
 const rows=cards.slice(page*5,page*5+5),parts=rows.map((r,i)=>({input:r.card,left:0,top:i*364}));await sharp({create:{width:960,height:rows.length*364,channels:4,background:'#18323a'}}).composite(parts).webp({quality:90}).toFile(`${OUT}/stage1-${kind}-comparison-${page+1}.webp`);
}
report.structuralValidation='passed';report.visualApproval='pending_user';report.renderMethod=nativeStills?'Actual GLBLoader / three.js WebGL PBR rest poses; PNG captures converted to WebP; each source GLB hash verified in native-render.json':'CPU texture/normal proof renders from saved GLB rest poses, not production WebGL/PBR approval';
await writeFile(`${OUT}/models.json`,JSON.stringify(report,null,2)+'\n');await writeFile(`${OUT}/stage1-validation.json`,JSON.stringify(summary,null,2)+'\n');
