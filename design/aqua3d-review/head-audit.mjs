/** Diagnostics, not a visual approval score. Compare fitted head with source alpha. */
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {bodyProfile,HEAD_CONTOUR_FAMILIES,SHARK_PROFILES} from './volume-fish.mjs';
export async function headReference(key){
 const {data,info}=await sharp(`public/aqua/fish/${key}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=0,b=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>96){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 return {data,info,bounds:[l,t,r,b]};
}
export function headMetrics(p,ref){
 const [l,t,r,b]=ref.bounds,H=b-t,W=r-l;let outside=0,jump=0,previous=null;
 for(let i=30;i<40;i++){
  const q=p.sample(i/40),x=Math.round(l+q.u*W);let top=b,bottom=t;
  for(let y=t;y<=b;y++)if(ref.data[(y*ref.info.width+x)*4+3]>96){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const crown=t+(q.center-q.half)*H,belly=t+(q.center+q.half)*H;
  outside=Math.max(outside,top-crown,belly-bottom);
  if(previous!==null)jump=Math.max(jump,Math.abs(crown-previous));previous=crown;
 }
 return {outsidePixels:+outside.toFixed(2),crownStepPixels:+jump.toFixed(2),snoutExtent:+p.raw.s1.toFixed(4)};
}
if(process.argv[1]?.endsWith('head-audit.mjs')){
 const report=JSON.parse(await readFile('design/aqua3d-review/models.json')),spec=JSON.parse(await readFile('design/aqua3d-review/expansion4-prompts.json'));
 const baseline=execFileSync('git',['show','HEAD:design/aqua3d-review/volume-fish.mjs'],{encoding:'utf8'}).replace("'three'",JSON.stringify(import.meta.resolve('three'))).replace("'./fish-fit.mjs'",JSON.stringify(new URL('./fish-fit.mjs',import.meta.url).href));
 const before=await import('data:text/javascript;base64,'+Buffer.from(baseline).toString('base64'));
 const rows=[];for(const [key,m]of Object.entries(report.models))if(m.geometryAuthoring==='closed-volume-v3'){
  const ref=await headReference(key),profile=SHARK_PROFILES.get(m.family)??spec.species.find(s=>s.key===m.family),p=bodyProfile(m.family,ref,profile);
  rows.push({key,changed:HEAD_CONTOUR_FAMILIES.has(m.family)||SHARK_PROFILES.has(m.family),before:profile.shark?null:headMetrics(before.bodyProfile(m.family,ref,profile),ref),...headMetrics(p,ref)});
 }
 rows.sort((a,b)=>b.outsidePixels-a.outsidePixels);
 console.table(rows.filter(r=>r.outsidePixels>2||r.crownStepPixels>8||r.snoutExtent<.90));
 if(process.argv.includes('--save')){
  const changedKeys=rows.filter(r=>r.changed).map(r=>r.key);
  await mkdir('design/aqua3d-review/heads/before',{recursive:true});
  for(const key of changedKeys)await writeFile(`design/aqua3d-review/heads/before/${key}-side.webp`,execFileSync('git',['show',`HEAD:design/aqua3d-review/models/${key}-side.webp`],{maxBuffer:1024*1024}));
  await writeFile('design/aqua3d-review/head-audit.json',JSON.stringify({baselineCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),note:'Source-alpha diagnostics of 165 V3 forms only, not all 381 fish. Shark baseline was a different legacy authoring method; see before images, not synthetic before metrics. Remaining flags require visual review; no automatic approval.',changedKeys,models:rows},null,2)+'\n');
 }
}
