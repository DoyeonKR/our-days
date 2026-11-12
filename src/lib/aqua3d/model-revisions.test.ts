import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FISH_MODEL_REVISIONS,fishRevisionQuery} from './model-revisions.ts';
test('all 30 revised GLBs have content-addressed cache keys matching actual bytes',()=>{
 assert.equal(Object.keys(FISH_MODEL_REVISIONS).length,30);
 for(const [key,revision]of Object.entries(FISH_MODEL_REVISIONS)){
  const hash=createHash('sha256').update(readFileSync(`public/aqua/models/fish/${key}.glb`)).digest('hex').slice(0,12);
  assert.equal(revision,hash,key);assert.equal(fishRevisionQuery(key),'?v='+hash,key);
 }
});
test('unchanged assets retain their existing URLs; GLB loader versions revised fish requests',()=>{
 assert.equal(fishRevisionQuery('neon_tetra'),'');assert.equal(fishRevisionQuery('mailbox'),'');
 const loader=readFileSync('src/lib/aqua3d/glb.ts','utf8');assert.ok(loader.includes("kind==='fish'?fishRevisionQuery(key):''"));
 const worker=readFileSync('public/sw.js','utf8');assert.ok(worker.includes('c.match(request)'),'art cache must include the revision query');
});
