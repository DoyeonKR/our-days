import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {FAMILIES,DECOR} from '../../src/lib/aquarium.ts';
const root='design/aqua3d-review',report=JSON.parse(await readFile(`${root}/models.json`,'utf8'));
const expectedFish=FAMILIES.filter(f=>f.key!=='sea_turtle').flatMap(f=>[...f.finals.map(s=>s.key),`fry_${f.key}`,`juv_${f.key}`]);
const expectedDecor=DECOR.map(d=>d.key),missing=[...expectedFish,...expectedDecor].filter(k=>!report.models[k]);
if(missing.length)throw Error('Missing GLBs: '+missing.join(', '));
report.stage='all';report.status='all_requested_assets_generated_structurally_valid';report.approved=false;report.visualApproval='pending_user';report.productionReady=false;
report.fishRevision=3;report.fishGeometry='Radial anatomical bodies, contour-constrained fin meshes, swept horns/barbels, ray thorax and revolved jelly bell. No billboard/image-plane body.';
report.provenance={geometry:'Original locally authored geometry. No external models or market/game assets.',fishTextures:'Embedded atlas derived only from each matching repository-owned reference.',decorTextures:'Original procedural paint atlas.',sourceCodeWrites:false,packageJsonWrites:false,supabaseWrites:false,turtlesCreated:false,tankEnvironmentCreated:false};
report.scope={createdFish:expectedFish,createdDecor:expectedDecor,excluded:['green_sea_turtle','fry_sea_turtle','juv_sea_turtle'],missing:[],fishCount:expectedFish.length,decorCount:expectedDecor.length};
report.notes=['All 81 requested fish forms and 37 decorations have GLB files; this is not a claim of user-approved visual similarity.','No numerical visual similarity scores are assigned. Unseen faces and undersides are estimated from single reference paintings.','Young fish use shorter trunks, fuller heads and larger eyes plus their own source outlines and textures, not uniform adult scale copies.','Some ornaments remain stylised low-poly interpretations rather than reference-level ornamental sculpture.','All GLBs contain no animation clips. The viewer can rotate the standard bones for deformation inspection.','Game source and account data are untouched. Runtime integration remains the other session’s responsibility.'];
for(const m of Object.values(report.models)){
 m.approval='pending';m.productionReady=false;m.visualStatus='pending_user_review';
 m.coordinateSystem={up:'+Y',front:m.kind==='fish'?'+X':'+Z',origin:m.kind==='fish'?'body center':'bottom center'};
}
for(const kind of ['fish','decor']){
 const keys=Object.keys(report.models).filter(k=>report.models[k].kind===kind),rows=Math.ceil(keys.length/3),parts=[];
 for(let i=0;i<keys.length;i++)parts.push({input:await sharp(`${root}/models/${keys[i]}-comparison.webp`).resize(384,146).webp({quality:92}).toBuffer(),left:(i%3)*384,top:Math.floor(i/3)*146});
 await sharp({create:{width:1152,height:rows*146,channels:4,background:'#18323a'}}).composite(parts).webp({quality:94}).toFile(`${root}/stage1-${kind}-overview.webp`);
 for(let page=0;page<Math.ceil(keys.length/27);page++){
  const slice=keys.slice(page*27,(page+1)*27),images=[];
  for(let i=0;i<slice.length;i++)images.push({input:await sharp(`${root}/models/${slice[i]}-comparison.webp`).resize(384,146).webp({quality:92}).toBuffer(),left:(i%3)*384,top:Math.floor(i/3)*146});
  await sharp({create:{width:1152,height:Math.ceil(slice.length/3)*146,channels:4,background:'#18323a'}}).composite(images).webp({quality:94}).toFile(`${root}/all-${kind}-review-${page+1}.webp`);
 }
}
const status={stage:'all',createdFish:expectedFish,createdDecor:expectedDecor,structuralValidation:report.structuralValidation,allVisualApproval:'pending',missing:[],gameIntegrated:false};
await writeFile(`${root}/models.json`,JSON.stringify(report,null,2)+'\n');await writeFile(`${root}/stage-status.json`,JSON.stringify(status,null,2)+'\n');
console.log(`${expectedFish.length} fish + ${expectedDecor.length} decorations generated; no missing keys.`);
