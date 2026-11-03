import fs from 'node:fs/promises';
import sharp from 'sharp';
const root='design/aqua3d-review';
const spec=JSON.parse(await fs.readFile(`${root}/expansion-prompts.json`,'utf8'));
const report=JSON.parse(await fs.readFile(`${root}/models.json`,'utf8'));
const keys=spec.species.flatMap(([f])=>[`fry_${f}`,`juv_${f}`,f]);
for(let page=0;page<2;page++){
 const tiles=[];
 for(let row=0;row<7;row++)for(let stage=0;stage<3;stage++){
  const key=keys[page*21+row*3+stage],left=stage*300,top=row*220;
  tiles.push({input:await sharp(`public/aqua/fish/${key}.webp`).resize(280,182,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:left+10,top});
  tiles.push({input:Buffer.from(`<svg width="300" height="32"><text x="150" y="23" text-anchor="middle" font-family="Arial" font-size="17" fill="#ecf4f3">${key}</text></svg>`),left,top:top+182});
 }
 await sharp({create:{width:900,height:1540,channels:4,background:'#213944'}}).composite(tiles).webp({quality:94}).toFile(`${root}/expansion-art-${page+1}.webp`);
}
for(let page=0;page<7;page++){
 const tiles=[];
 for(let row=0;row<6;row++)tiles.push({input:await fs.readFile(`${root}/models/${keys[page*6+row]}-comparison.webp`),left:0,top:row*364});
 await sharp({create:{width:960,height:2184,channels:4,background:'#18323a'}}).composite(tiles).webp({quality:93}).toFile(`${root}/expansion-models-${page+1}.webp`);
}
for(const key of keys){const m=report.models[key];m.approval='pending';m.productionReady=false;m.visualStatus='pending_user_review';m.coordinateSystem={up:'+Y',front:'+X',origin:'body center'};}
report.approved=Object.values(report.models).every(m=>m.approval?.startsWith('user_approved'));
report.pendingVisualApproval=Object.keys(report.models).filter(k=>!report.models[k].approval?.startsWith('user_approved'));
report.status='baseline_approved_new_forms_pending';
report.notes=report.notes.filter(n=>!n.startsWith('Expansion:'));
report.notes.push('Expansion: 14 real species / 42 growth forms. All are original rigged meshes and remain pending user visual approval. Hidden surfaces are estimates, not a measured similarity claim.');
report.scope.createdFish=Object.keys(report.models).filter(k=>report.models[k].kind==='fish');report.scope.fishCount=report.scope.createdFish.length;
report.scope.missing=[];
await fs.writeFile(`${root}/models.json`,JSON.stringify(report,null,2)+'\n');
await fs.writeFile(`${root}/expansion-status.json`,JSON.stringify({keys,artwork:'built-in image_gen',visualApproval:'pending',activation:'not enabled',referenceProfiles:true,harbor:{file:'public/fishing/spot_harbor.webp',horizon:.27,level:9,activation:'not enabled'},namingNote:'blue_shark follows Prionace glauca (청새리상어), not shortfin mako',biologicalReferences:['https://www.nifs.go.kr/portal/bt/frctA/actionSpeciesSearchView.do?taxonId=11416','https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/nurse-shark/'],models:keys.map(key=>({key,...report.models[key]}))},null,2)+'\n');
console.log('Prepared 42 expansion model reviews. Existing approvals preserved; no new approval inferred.');
