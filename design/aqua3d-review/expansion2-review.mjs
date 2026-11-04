import fs from 'node:fs/promises';
import sharp from 'sharp';
import {FX_SPOTS} from '../../src/lib/fishingfx.ts';
const root='design/aqua3d-review',spec=JSON.parse(await fs.readFile(`${root}/expansion2-prompts.json`,'utf8')),report=JSON.parse(await fs.readFile(`${root}/models.json`,'utf8'));
const keys=spec.species.flatMap(({key:f})=>[`fry_${f}`,`juv_${f}`,f]);
const tiles=[];
for(let i=0;i<keys.length;i++){
 const key=keys[i],left=i%3*300,top=Math.floor(i/3)*220;
 tiles.push({input:await sharp(`public/aqua/fish/${key}.webp`).resize(280,182,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:left+10,top});
 tiles.push({input:Buffer.from(`<svg width="300" height="32"><text x="150" y="23" text-anchor="middle" font-family="Arial" font-size="17" fill="#ecf4f3">${key}</text></svg>`),left,top:top+182});
}
await sharp({create:{width:900,height:1980,channels:4,background:'#213944'}}).composite(tiles).webp({quality:94}).toFile(`${root}/expansion2-art.webp`);
for(let page=0;!process.argv.includes('--art-only')&&page<5;page++){
 const list=keys.slice(page*6,page*6+6),parts=[];
 for(let row=0;row<list.length;row++)parts.push({input:await fs.readFile(`${root}/models/${list[row]}-comparison.webp`),left:0,top:row*364});
 await sharp({create:{width:960,height:list.length*364,channels:4,background:'#18323a'}}).composite(parts).webp({quality:93}).toFile(`${root}/expansion2-models-${page+1}.webp`);
}
const bg=[];for(let i=0;i<spec.backgrounds.length;i++){
 const {key}=spec.backgrounds[i],left=i%5*256,top=Math.floor(i/5)*350;
 bg.push({input:await sharp(`public/fishing/${key}.webp`).resize(256,320).png().toBuffer(),left,top});
 bg.push({input:Buffer.from(`<svg width="256" height="30"><text x="128" y="21" text-anchor="middle" font-family="Arial" font-size="16" fill="#fff">${key}</text></svg>`),left,top:top+320});
}
await sharp({create:{width:1280,height:Math.ceil(spec.backgrounds.length/5)*350,channels:4,background:'#213944'}}).composite(bg).webp({quality:93}).toFile(`${root}/regional-backgrounds.webp`);
if(process.argv.includes('--art-only'))process.exit(0);
for(const key of keys){Object.assign(report.models[key],{approval:'pending',productionReady:false,visualStatus:'pending_user_review',coordinateSystem:{up:'+Y',front:'+X',origin:'body center'}});}
report.approved=Object.values(report.models).every(m=>m.approval?.startsWith('user_approved'));
report.pendingVisualApproval=Object.keys(report.models).filter(k=>!report.models[k].approval?.startsWith('user_approved'));
report.status='baseline_approved_new_forms_pending';report.scope.createdFish=Object.keys(report.models).filter(k=>report.models[k].kind==='fish');report.scope.fishCount=report.scope.createdFish.length;
await fs.writeFile(`${root}/models.json`,JSON.stringify(report,null,2)+'\n');
await fs.writeFile(`${root}/expansion2-status.json`,JSON.stringify({keys,backgrounds:spec.backgrounds.map(({key,name})=>({key,name,size:[1024,1280],waterBoundary:FX_SPOTS[key.replace('spot_','')]?.horizon})),visualApproval:'pending',activation:'not enabled',sourceArtwork:'built-in image_gen',models:keys.map(key=>({key,...report.models[key]}))},null,2)+'\n');
console.log('Prepared 27 new model reviews and regional background contact sheet; no visual approval inferred.');
