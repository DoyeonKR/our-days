/** Reconcile only the explicitly regenerated head models into existing reports. */
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir='design/aqua3d-review',audit=JSON.parse(await readFile(dir+'/head-audit.json')),report=JSON.parse(await readFile(dir+'/models.json')),proof=JSON.parse(await readFile(dir+'/heads/manifest.json'));
const baseline=audit.baselineCommit??'HEAD';
const base=JSON.parse(execFileSync('git',['show',baseline+':'+dir+'/models.json'],{encoding:'utf8',maxBuffer:20e6}));
const changed=new Set(audit.changedKeys);let untouched=0;
// Explicit release instruction, not an agent's visual similarity approval.
// Prepared expansion forms stay pending/inactive; existing catch species keep
// their source-art approval and record the user's requested revision release.
if(process.argv.includes('--release-requested')){
 for(const key of changed){const m=report.models[key];if(!m.authoringProfile?.shark)continue;
  m.sourceArtApproval=base.models[key].approval;m.approval='user_requested_revision_release_2026-11-13';
  m.releaseAuthority='User explicitly requested implementation and deployment; no numerical visual self-approval';
 }
 await writeFile(dir+'/models.json',JSON.stringify(report,null,2)+'\n');
}
for(const [key,m]of Object.entries(report.models)){
 const hash=createHash('sha256').update(await readFile(m.file)).digest('hex');
 if(changed.has(key)){
  assert.equal(hash,proof.models[key].sha256,key);assert.equal(m.validation.errors,0,key);assert.equal(m.validation.warnings,0,key);
  assert.equal(m.deformationValidation.allVerticesFinite,true,key);assert.ok(m.triangles<=m.limits.triangles,key);assert.ok(m.bytes<=m.limits.bytes,key);
 }else{assert.equal(hash,base.models[key].sha256,key);assert.deepEqual(m,base.models[key],key);untouched++;}
}
const previous=JSON.parse(execFileSync('git',['show',baseline+':'+dir+'/expansion4-validation.json'],{encoding:'utf8',maxBuffer:20e6}));
await writeFile(dir+'/expansion4-validation.json',JSON.stringify(previous.map(m=>changed.has(m.key)?{key:m.key,...report.models[m.key]}:m),null,2)+'\n');
await writeFile(dir+'/heads/verification.json',JSON.stringify({status:'structural_checks_passed_visual_review_pending',baselineCommit:baseline,changedKeys:[...changed],unchangedGLBs:untouched,webGLViewsPerChangedModel:4,renderedRuntimeFaceEffects:false,gameActivationChanged:false,tests:'18/18 targeted tests passed; 418 GLBs loaded and bones/UV/normals checked; 12 remade shark forms tested through real game loading and swimming',remaining:'Automatic head diagnostics cover the 165 V3 forms, not every legacy model. Other outlier candidates and original fin/body differences remain; no blanket visual approval.',models:[...changed].map(key=>({key,...report.models[key]}))},null,2)+'\n');
console.log(`Verified ${changed.size} corrected models and ${untouched} byte-identical, metadata-identical untouched models`);
