import fs from 'node:fs/promises';
import sharp from 'sharp';
const root='design/aqua3d-review',families=['catfish','sweetfish','jellyfish'];
const keys=families.flatMap(f=>[`fry_${f}`,`juv_${f}`,f]);
const report=JSON.parse(await fs.readFile(`${root}/models.json`,'utf8'));
const tiles=[],comparisons=[];
for(let i=0;i<keys.length;i++){
 const key=keys[i],x=i%3*300,y=Math.floor(i/3)*230;
 tiles.push({input:await sharp(`public/aqua/fish/${key}.webp`).resize(270,190,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:x+15,top:y+4});
 const label=Buffer.from(`<svg width="300" height="32"><text x="150" y="22" text-anchor="middle" font-family="Arial" font-size="17" fill="#e5f0ef">${key}</text></svg>`);
 tiles.push({input:label,left:x,top:y+194});
 comparisons.push({input:await sharp(`${root}/models/${key}-comparison.webp`).resize(960,364).webp({quality:93}).toBuffer(),left:0,top:i*364});
 const m=report.models[key];m.approval='pending';m.productionReady=false;m.visualStatus='pending_user_review';
 m.coordinateSystem={up:'+Y',front:'+X',origin:'body center'};
}
await sharp({create:{width:900,height:690,channels:4,background:'#213944'}}).composite(tiles).webp({quality:94}).toFile(`${root}/timed-fish-art.webp`);
await sharp({create:{width:960,height:keys.length*364,channels:4,background:'#18323a'}}).composite(comparisons).webp({quality:93}).toFile(`${root}/timed-fish-models.webp`);
report.approved=Object.values(report.models).every(m=>m.approval?.startsWith('user_approved'));
report.status=report.approved?'all_deployed_user_approved':'baseline_approved_new_timed_forms_pending';
report.pendingVisualApproval=keys;
report.scope.createdFish=Object.keys(report.models).filter(k=>report.models[k].kind==='fish');
report.scope.fishCount=report.scope.createdFish.length;
report.scope.createdDecor=Object.keys(report.models).filter(k=>report.models[k].kind==='decor');
report.scope.decorCount=report.scope.createdDecor.length;report.scope.missing=[];
await fs.writeFile(`${root}/models.json`,JSON.stringify(report,null,2)+'\n');
await fs.writeFile(`${root}/timed-fish-status.json`,JSON.stringify({keys,sourceArtwork:'built-in image_gen',visualApproval:'pending',activation:'not enabled',referenceProfiles:true,models:keys.map(key=>({key,...report.models[key]})),biologicalReferences:['https://www.fishbase.org/summary/6566','https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/jellies']},null,2)+'\n');
console.log('Prepared 9 timed-fish review cards; existing approvals preserved; no new visual approvals inferred.');
