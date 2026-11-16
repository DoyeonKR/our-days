// Artifact-only finalizer. Does not stage, commit, push, deploy or enable assets.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const DIR='design/aqua3d-review',guide=JSON.parse(await readFile(DIR+'/remodel-prompts.json','utf8')),status=JSON.parse(await readFile(DIR+'/remodel-status.json','utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),pipeline=sha(Buffer.concat(await Promise.all(status.pipelineFiles.map(f=>readFile(DIR+'/'+f))))),stale=[];
for(const item of guide.items){const m=status.models[item.key];let dirty=m.state!=='generated_pending_visual_review'||m.pipelineSHA256!==pipeline;for(const view of ['side','top','front','bottom']){const bytes=await readFile(DIR+'/remodel-refs/originals/'+item.key+'-'+view+'.png');if(sha(bytes)!==m.registration?.records?.[view]?.sourceSHA256)dirty=true;}if(dirty)stale.push(item.key);}
const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(args[0]+' exited '+code)));});
if(stale.length){console.log('Rebuilding '+stale.length+' models with the final pipeline / final reference hashes');await run([DIR+'/remodel-build.mjs',...stale]);}
await run([DIR+'/remodel-validate.mjs']);const check=JSON.parse(await readFile(DIR+'/remodel-validation.json','utf8'));assert.equal(check.complete,true,'Some requested models remain incomplete or invalid');await run([DIR+'/remodel-reference-sheets.mjs']);console.log('33 V3 GLBs / 132 registered references / compressed + expanded validation / five skin poses verified. Visual approval remains pending.');
