import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {plan} from './mammals-import.mjs';
const root='design/aqua3d-review',guide=JSON.parse(await readFile(`${root}/mammals-prompts.json`,'utf8'));
const label=(text,w=960)=>Buffer.from(`<svg width="${w}" height="32"><text x="10" y="23" fill="#ecf3f4" font-family="sans-serif" font-size="16">${text}</text></svg>`);
const bg='#18323a';
async function artSheet(items,file,cols,tile,source){
 const parts=[];for(let i=0;i<items.length;i++){
  const x=i%cols*tile,y=Math.floor(i/cols)*(tile+32),key=items[i].key;
  parts.push({input:await sharp(source(key)).resize(tile,tile,{fit:'contain',background:bg}).png().toBuffer(),left:x,top:y});
  parts.push({input:label(key,tile),left:x,top:y+tile});
 }
 await sharp({create:{width:cols*tile,height:Math.ceil(items.length/cols)*(tile+32),channels:4,background:bg}}).composite(parts).webp({quality:91}).toFile(file);
}
await artSheet(guide.items,`${root}/mammals-art.webp`,3,320,k=>`public/aqua/fish/${k}.webp`);
for(let page=0;page<3;page++){
 const items=guide.items.slice(page*6,page*6+6);
 for(const type of ['models','top']){
  const parts=[];
  for(let i=0;i<items.length;i++){
   const key=items[i].key,y=i*300;parts.push({input:label(`${key} — ${type==='top'?'TOP / OBLIQUE / SIDE':'REFERENCE / SIDE / OBLIQUE'} — APPROVAL PENDING`),left:0,top:y});
   const files=type==='top'?[`${root}/models/${key}-top.webp`,`${root}/models/${key}-oblique.webp`,`${root}/models/${key}-side.webp`]:[`public/aqua/fish/${key}.webp`,`${root}/models/${key}-side.webp`,`${root}/models/${key}-oblique.webp`];
   for(let j=0;j<3;j++)parts.push({input:await sharp(files[j]).resize(320,268,{fit:'contain',background:bg}).png().toBuffer(),left:j*320,top:y+32});
  }
  await sharp({create:{width:960,height:1800,channels:4,background:bg}}).composite(parts).webp({quality:92}).toFile(`${root}/mammals-${type}-${page+1}.webp`);
 }
}
const fishing=plan.filter(i=>i.kind==='fishing');
await artSheet(fishing,'design/fishing-review/batch-2026-11-13.webp',5,192,k=>`public/fishing/${k}.webp`);
console.log('Saved 18-animal art sheet, six multi-view sheets and 30-item fishing sheet.');
