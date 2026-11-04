// Contact sheets from saved originals and actual GLB renders. Never assigns approval scores.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {FX_SPOTS} from '../../src/lib/fishingfx.ts';
import {FAMILIES} from '../../src/lib/aquarium.ts';
const root='design/aqua3d-review',spec=JSON.parse(await fs.readFile(`${root}/native-prompts.json`,'utf8'));
const keys=spec.species.flatMap(({key})=>[`fry_${key}`,`juv_${key}`,key]);
const label=(key,width=300)=>Buffer.from(`<svg width="${width}" height="30"><text x="${width/2}" y="21" text-anchor="middle" font-family="Arial" font-size="16" fill="#eef4f3">${key}</text></svg>`);
for(let page=0;page<4;page++){
 const parts=[],list=keys.slice(page*15,page*15+15);
 for(let i=0;i<list.length;i++){
  const key=list[i],left=i%3*300,top=Math.floor(i/3)*220;
  parts.push({input:await sharp(`public/aqua/fish/${key}.webp`).resize(280,182,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:left+10,top});
  parts.push({input:label(key),left,top:top+182});
 }
 await sharp({create:{width:900,height:1100,channels:4,background:'#213944'}}).composite(parts).webp({quality:94}).toFile(`${root}/native-art-${page+1}.webp`);
}
const bg=[];
for(let i=0;i<spec.backgrounds.length;i++){
 const {key}=spec.backgrounds[i];bg.push({input:await sharp(`public/fishing/${key}.webp`).resize(256,320).png().toBuffer(),left:i*256,top:0});
 bg.push({input:label(key,256),left:i*256,top:320});
}
await sharp({create:{width:1280,height:350,channels:4,background:'#213944'}}).composite(bg).webp({quality:93}).toFile(`${root}/native-backgrounds.webp`);
if(process.argv.includes('--art-only'))process.exit(0);
for(let page=0;page<10;page++){
 const list=keys.slice(page*6,page*6+6),parts=[];
 for(let i=0;i<list.length;i++)parts.push({input:await fs.readFile(`${root}/models/${list[i]}-comparison.webp`),left:0,top:i*364});
 await sharp({create:{width:960,height:list.length*364,channels:4,background:'#18323a'}}).composite(parts).webp({quality:93}).toFile(`${root}/native-models-${page+1}.webp`);
}
const report=JSON.parse(await fs.readFile(`${root}/models.json`,'utf8'));
for(const key of keys){const m=report.models[key];if(!m||m.validation?.errors!==0)throw new Error(`Unvalidated model: ${key}`);if(!m.approval?.startsWith('user_approved'))Object.assign(m,{approval:'pending',productionReady:false,visualStatus:'pending_user_review'});}
report.approved=false;report.status='baseline_approved_new_forms_pending';report.pendingVisualApproval=Object.keys(report.models).filter(k=>!report.models[k].approval?.startsWith('user_approved'));
report.scope.createdFish=Object.keys(report.models).filter(k=>report.models[k].kind==='fish');report.scope.fishCount=report.scope.createdFish.length;
// Windows preview/indexing readers can temporarily prevent truncate-in-place.
const reportTemp=`${root}/models.json.native-tmp`;
await fs.writeFile(reportTemp,JSON.stringify(report,null,2)+'\n');
await fs.rename(reportTemp,`${root}/models.json`);
await fs.writeFile(`${root}/native-status.json`,JSON.stringify({keys,sourceArtwork:'built-in image_gen',visualApproval:'pending_user',activation:{activeFamilies:spec.species.filter(s=>FAMILIES.some(f=>f.key===s.key)).length,totalFamilies:spec.species.length,managedBy:'parallel game implementation; this art batch does not grant visual approval'},openDecisions:['manual visual approval','confirm parallel catalogue activation and conservation context'],backgrounds:spec.backgrounds.map(({key,name})=>({key,name,size:[1024,1280],waterBoundary:FX_SPOTS[key.replace('spot_','')]?.horizon})),models:keys.map(key=>({key,...report.models[key]}))},null,2)+'\n');
console.log(`Prepared ${keys.length} native forms, 10 model comparison sheets and 5 backgrounds. No visual approval inferred.`);
