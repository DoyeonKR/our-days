import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {widthCurve,bodyProfile,HEAD_CONTOUR_FAMILIES,SHARK_PROFILES,volumeFish} from './volume-fish.mjs';
import {headReference,headMetrics} from './head-audit.mjs';
test('split-jaw references cannot create a detached forehead spike',async()=>{
 const spec=JSON.parse(await readFile(new URL('./expansion4-prompts.json',import.meta.url)));
 for(const family of ['frilled_shark','moray'])for(const key of [family,'fry_'+family,'juv_'+family]){
  const ref=await headReference(key),p=bodyProfile(family,ref,spec.species.find(s=>s.key===family)),metrics=headMetrics(p,ref);
  assert.ok(metrics.outsidePixels<1,`${key}: head extrudes beyond source alpha`);
  assert.ok(metrics.crownStepPixels<4,`${key}: abrupt crown spike`);
  for(let i=80;i<=100;i++){const q=p.sample(i/100);assert.ok(Number.isFinite(q.center)&&Number.isFinite(q.half)&&q.half>0);}
 }
});
test('targeted head corrections do not change the authoring scope or activate fish',async()=>{
 assert.equal(HEAD_CONTOUR_FAMILIES.size,6);
 const report=JSON.parse(await readFile(new URL('./models.json',import.meta.url)));
 for(const [key,m]of Object.entries(report.models))if(HEAD_CONTOUR_FAMILIES.has(m.family)){
  assert.equal(m.activation,'not enabled',key);assert.equal(m.visualApproval,'pending',key);
 }
 const ref=await headReference('barracuda'),spec=JSON.parse(await readFile(new URL('./expansion4-prompts.json',import.meta.url)));
 assert.ok(bodyProfile('barracuda',ref,spec.species.find(s=>s.key==='barracuda')).raw.s1>.99,'narrow snout must not be amputated');
});
test('top-view profiles taper continuously, have no tail bulb or cubic overshoot',()=>{
 for(const kind of ['fish','eel']){
  let last=0;const peak=kind==='eel'?.8:.7;
  for(let i=0;i<=1000;i++){const s=i/1000,v=widthCurve(s,kind);assert.ok(Number.isFinite(v)&&v>=0&&v<=1.000001);if(s<=peak)assert.ok(v>=last-1e-8);if(s>peak)assert.ok(v<=last+1e-8);last=v;}
  assert.equal(widthCurve(0,kind),0);assert.equal(widthCurve(1,kind),0);
 }
});
test('165 closed-volume models preserve the geometry-version marker and nonmetal PBR',async()=>{
 const report=JSON.parse(await readFile(new URL('./models.json',import.meta.url)));
 const models=Object.entries(report.models).filter(([,m])=>m.geometryAuthoring==='closed-volume-v3');assert.equal(models.length,165);
 for(const [key,m]of models){const b=await readFile(m.file),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  assert.equal(m.wholeBodyPlate,false,key);assert.ok(j.nodes.some(n=>n.extras?.aquaGeometry==='closed-volume-v3'),key);
  assert.equal(j.materials[0].pbrMetallicRoughness.metallicFactor,0,key);assert.ok(m.triangles<=m.limits.triangles,key);assert.equal(m.validation.errors,0,key);
 }
});
test('sharks have swept lateral foils, independent fin bones and no whole-body silhouette plate',async()=>{
 for(const [family,profile]of SHARK_PROFILES)for(const key of [family,'fry_'+family,'juv_'+family]){
  const ref=await headReference(key);ref.loops=[];
  assert.ok(bodyProfile(family,ref,profile).raw.s1>.99,key+': retain narrow snout');
  const g=volumeFish(family,key,ref,profile),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  assert.equal(g.userData.wholeBodyPlate,false,key);
  const fins=g.userData.regions.filter(r=>r.name.startsWith('pectoral_'));assert.equal(fins.length,2,key);
  if(family==='nurse_shark')assert.equal(g.userData.regions.filter(r=>r.name.startsWith('nasal_barbel_')).length,2,key);
  for(const f of fins){let minZ=Infinity,maxZ=-Infinity,minY=Infinity,maxY=-Infinity;
   for(let i=f.start;i<f.end;i++){minZ=Math.min(minZ,p.getZ(i));maxZ=Math.max(maxZ,p.getZ(i));minY=Math.min(minY,p.getY(i));maxY=Math.max(maxY,p.getY(i));assert.ok(si.getX(i)>=6&&sw.getX(i)+sw.getY(i)>.999,key);}
   assert.ok(maxZ-minZ>.19,key);assert.ok(maxY-minY<.065,key);
  }
  g.dispose();
 }
});
test('review motion is generated verbatim from the same game motion source',async()=>{
 const original=await readFile('src/lib/aqua3d/anatomy.ts','utf8'),mirror=await readFile(new URL('./runtime-swim.mjs',import.meta.url),'utf8');
 assert.equal(mirror,'// Generated from src/lib/aqua3d/anatomy.ts by build-swim-preview.mjs\n'+stripTypeScriptTypes(original).replace(/[^\S\r\n]+$/gm,''));
});
