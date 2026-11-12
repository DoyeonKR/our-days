import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {widthCurve} from './volume-fish.mjs';
test('top-view profiles taper continuously, have no tail bulb or cubic overshoot',()=>{
 for(const kind of ['fish','eel']){
  let last=0;const peak=kind==='eel'?.8:.7;
  for(let i=0;i<=1000;i++){const s=i/1000,v=widthCurve(s,kind);assert.ok(Number.isFinite(v)&&v>=0&&v<=1.000001);if(s<=peak)assert.ok(v>=last-1e-8);if(s>peak)assert.ok(v<=last+1e-8);last=v;}
  assert.equal(widthCurve(0,kind),0);assert.equal(widthCurve(1,kind),0);
 }
});
test('153 closed-volume models preserve the geometry-version marker and nonmetal PBR',async()=>{
 const report=JSON.parse(await readFile(new URL('./models.json',import.meta.url)));
 const models=Object.entries(report.models).filter(([,m])=>m.geometryAuthoring==='closed-volume-v3');assert.equal(models.length,153);
 for(const [key,m]of models){const b=await readFile(m.file),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  assert.equal(m.wholeBodyPlate,false,key);assert.ok(j.nodes.some(n=>n.extras?.aquaGeometry==='closed-volume-v3'),key);
  assert.equal(j.materials[0].pbrMetallicRoughness.metallicFactor,0,key);assert.ok(m.triangles<=m.limits.triangles,key);assert.equal(m.validation.errors,0,key);
 }
});
test('review motion is generated verbatim from the same game motion source',async()=>{
 const original=await readFile('src/lib/aqua3d/anatomy.ts','utf8'),mirror=await readFile(new URL('./runtime-swim.mjs',import.meta.url),'utf8');
 assert.equal(mirror,'// Generated from src/lib/aqua3d/anatomy.ts by build-swim-preview.mjs\n'+stripTypeScriptTypes(original));
});
