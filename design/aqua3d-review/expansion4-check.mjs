// Delivery contract checks; this is not a visual approval or a similarity score.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
const dir='design/aqua3d-review';
const spec=JSON.parse(await fs.readFile(`${dir}/expansion4-prompts.json`,'utf8'));
const report=JSON.parse(await fs.readFile(`${dir}/models.json`,'utf8'));
const nativeProof=JSON.parse(await fs.readFile(`${dir}/native-render.json`,'utf8'));
const status=JSON.parse(await fs.readFile(`${dir}/expansion4-status.json`,'utf8'));
const names=['spine_0','spine_1','spine_2','spine_3','spine_4','spine_5','fin_L','fin_L_tip','fin_R','fin_R_tip'];
const selected=process.argv.slice(2),items=selected.length?spec.items.filter(i=>selected.includes(i.key)):spec.items;
const failures=[];let checked=0;
for(const item of items){try{
 const k=item.key,m=report.models[k];assert.ok(m,`missing record ${k}`);
 for(const [path,size] of [[`public/aqua/fish/${k}.webp`,512],[`public/aqua/fish/sm/${k}.webp`,192],[`${dir}/expansion4-originals/${k}.png`,1024]]){
  const meta=await sharp(path).metadata();assert.equal(meta.width,size,path);assert.equal(meta.height,size,path);assert.ok(meta.hasAlpha,path);
 }
 const image=await fs.readFile(`public/aqua/fish/${k}.webp`);assert.equal(createHash('sha256').update(image).digest('hex'),m.sourceSHA256,k);
 const bytes=await fs.readFile(m.file),j=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.equal(bytes.length,m.bytes,k);assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256,k);
 assert.equal(j.materials.length,1,k);assert.equal(j.textures.length,1,k);assert.equal(j.meshes.length,1,k);assert.equal(j.skins.length,1,k);assert.equal(j.animations?.length??0,0,k);
 assert.deepEqual(j.skins[0].joints.map(i=>j.nodes[i].name),names,k);
 assert.deepEqual(m.textureSize,[512,512],k);assert.ok(m.triangles<=m.limits.triangles,k);assert.ok(bytes.length<=m.limits.bytes,k);
 for(const ext of ['EXT_meshopt_compression','KHR_mesh_quantization','EXT_texture_webp'])assert.ok(j.extensionsRequired.includes(ext),`${k} ${ext}`);
 assert.equal(m.validation.errors,0,k);assert.equal(m.validation.warnings,0,k);assert.equal(m.deformationValidation.allVerticesFinite,true,k);
 for(const view of ['front','side','oblique','top'])await fs.access(`${dir}/models/${k}-${view}.webp`);
 if(m.renderMethod?.startsWith('Actual')){assert.equal(nativeProof.models[k]?.sha256,m.sha256,k);for(const view of ['front','side','oblique','top'])assert.ok(nativeProof.models[k].views.includes(view),`${k}/${view}`);}
 assert.equal(m.approval,'pending',k);assert.equal(status.items.find(i=>i.key===k).activation,'not enabled',k);checked++;
 }catch(e){failures.push({key:item.key,error:e.message});}}
const baseline=JSON.parse(execFileSync('git',['show','HEAD:design/aqua3d-review/models.json'],{encoding:'utf8',maxBuffer:20e6}));
const changedExisting=Object.keys(baseline.models).filter(k=>JSON.stringify(report.models[k])!==JSON.stringify(baseline.models[k]));
const protectedChanges=execFileSync('git',['diff','--name-only','--','src','supabase','package.json'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const authorisedRuntime=['src/lib/aqua3d/anatomy.ts','src/lib/aqua3d/glb.ts','src/lib/aqua3d/scene.ts','src/lib/aqua3d/multiangle-motion.test.ts','src/lib/aqua3d/color-quality.ts','src/lib/aqua3d/color-quality.test.ts','src/lib/aqua3d/waterlight.ts','src/lib/aqua3d/post.ts','src/lib/aqua3d/decor-preview.ts'];
const unexpectedChanges=protectedChanges.filter(p=>!authorisedRuntime.includes(p));
const result={checked,requested:items.length,failures,changedExisting,protectedChanges,authorisedRuntime,unexpectedChanges,visualApproval:'pending',activation:'not enabled',renderMethod:items.every(i=>report.models[i.key]?.renderMethod?.startsWith('Actual'))?'Actual GLTFLoader / WebGL PBR, GLB hashes verified; no self-approval':'Saved GLB CPU proof renders; no self-approval'};
await fs.writeFile(`${dir}/expansion4-contract.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(failures.length||changedExisting.length||unexpectedChanges.length)process.exitCode=1;
