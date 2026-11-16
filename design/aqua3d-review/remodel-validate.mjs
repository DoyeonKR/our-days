import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {parseGLB,expandGLB} from './glb-compress.mjs';
import {checkSkin} from './remodel-skin-check.mjs';
const DIR='design/aqua3d-review',validator=createRequire(path.join(tmpdir(),'our-days-glb-validator','package.json'))('gltf-validator'),names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'],sha=b=>createHash('sha256').update(b).digest('hex');
async function validationCopy(raw){const {json:j,bin}=parseGLB(raw),chunks=[bin];let length=bin.length;for(const image of j.images){const v=j.bufferViews[image.bufferView],png=await sharp(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)).png().toBuffer(),pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}image.bufferView=j.bufferViews.length;image.mimeType='image/png';j.bufferViews.push({buffer:0,byteOffset:length,byteLength:png.length});chunks.push(png);length+=png.length;}const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}j.buffers[0].byteLength=length;j.extensionsUsed=j.extensionsUsed.filter(e=>e!=='EXT_texture_webp');if(!j.extensionsUsed.length)delete j.extensionsUsed;j.extensionsRequired=(j.extensionsRequired??[]).filter(e=>e!=='EXT_texture_webp');if(!j.extensionsRequired.length)delete j.extensionsRequired;const b=Buffer.concat(chunks),s=Buffer.from(JSON.stringify(j)),json=Buffer.concat([s,Buffer.alloc((4-s.length%4)%4,32)]),out=Buffer.alloc(28+json.length+b.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(b.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);b.copy(out,28+json.length);return out;}
const status=JSON.parse(await readFile(DIR+'/remodel-status.json','utf8')),results=[];
for(const m of Object.values(status.models)){
 if(m.state!=='generated_pending_visual_review'){results.push({key:m.key,state:m.state,error:m.error??null});continue;}
 try{
 const bytes=await readFile(m.file);assert.equal(sha(bytes),m.sha256);assert.equal(m.bytes,bytes.length);assert.equal(m.pipelineSHA256,status.pipelineSHA256,'Model was built with an earlier pipeline');
 const packed=await validator.validateBytes(new Uint8Array(bytes),{maxIssues:10000}),expanded=await expandGLB(bytes),{json:j,bin}=parseGLB(expanded),decoded=await validator.validateBytes(new Uint8Array(await validationCopy(expanded)),{maxIssues:10000});
 assert.equal(packed.issues.numErrors,0,JSON.stringify(packed.issues.messages));assert.equal(decoded.issues.numErrors,0,JSON.stringify(decoded.issues.messages.filter(m=>m.severity===0)));
 assert.equal(j.meshes.length,1);assert.equal(j.meshes[0].primitives.length,1);assert.equal(j.materials.length,1);assert.equal(j.images.length,1);assert.equal(j.skins.length,1);assert.equal(j.animations?.length??0,0);
 assert.deepEqual(j.skins[0].joints.map(i=>j.nodes[i].name),names);for(const extension of ['EXT_meshopt_compression','KHR_mesh_quantization','EXT_texture_webp'])assert.ok(parseGLB(bytes).json.extensionsRequired.includes(extension));assert.ok(j.images.every(i=>i.bufferView!==undefined&&!i.uri));for(let i=1;i<=5;i++)assert.ok(j.nodes[j.skins[0].joints[i-1]].children.includes(j.skins[0].joints[i]));
 const p=j.meshes[0].primitives[0],pos=j.accessors[p.attributes.POSITION],triangles=j.accessors[p.indices].count/3;assert.ok(triangles<=(m.category==='mammal'?3000:6000));assert.ok(bytes.length<=300000);assert.ok(Math.abs(pos.max[0]-pos.min[0]-2)<.015);
 const image=j.images[0],v=j.bufferViews[image.bufferView],meta=await sharp(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)).metadata();assert.equal(meta.width,512);assert.equal(meta.height,512);
 const old=await readFile('public/aqua/models/fish/'+m.key+'.glb');assert.equal(sha(old),m.oldSHA256,'Active original changed after V3 snapshot; integration session may have updated it');
 const a=Object.fromEntries(Object.entries(p.attributes).map(([name,index])=>[name,j.accessors[index]]));assert.equal(a.JOINTS_0.count,a.POSITION.count);assert.equal(a.WEIGHTS_0.count,a.POSITION.count);const deformation=checkSkin(j,bin);assert.deepEqual(deformation.weightedBones,names);for(let axis=0;axis<3;axis++)assert.ok(Math.abs(pos.max[axis]+pos.min[axis])<.015,'Origin is not the bounding-box center');assert.equal(triangles,m.triangles);
 for(const [view,record]of Object.entries(m.registration.records)){const b=await readFile(record.file);assert.equal(sha(b),record.sha256,'Reference changed after build: '+view);assert.equal(sha(await readFile(DIR+'/remodel-refs/originals/'+m.key+'-'+view+'.png')),record.sourceSHA256,'Raw reference changed after build');const im=await sharp(b).metadata();assert.equal(im.width,1024);assert.equal(im.height,1024);assert.ok(im.hasAlpha);if(view!=='front')assert.equal(record.bounds.width,820,'Head-tail alpha X extent not registered');}
 if(m.category==='cephalopod')assert.equal(m.armCount,['squid','giant_squid'].includes(m.family)?10:8);
 results.push({key:m.key,triangles,bytes:bytes.length,texture:[meta.width,meta.height],bones:names,deformation,compressedErrors:0,decodedErrors:0,validationTexture:'WebP pixels decoded losslessly to PNG only in private expanded validation copy',originalUnchanged:true,sha256:m.sha256,visualApproval:'pending',activation:'not enabled'});
 console.log(m.key+': structural / compressed / expanded validation OK');
 }catch(e){results.push({key:m.key,state:'validation_failed',error:e.message});process.exitCode=1;console.error(m.key+': '+e.message);}
}
await writeFile(DIR+'/remodel-validation.json',JSON.stringify({complete:results.length===33&&results.every(r=>r.decodedErrors===0),results},null,2)+'\n');
