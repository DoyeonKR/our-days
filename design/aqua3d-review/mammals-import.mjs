import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GEAR_STYLE,JUNK_ART,RELIC_ART,CRAFT_ART} from '../../scripts/fishing-art.mjs';
const guide=JSON.parse(await readFile('design/aqua3d-review/mammals-prompts.json','utf8'));
const fishing=[...JUNK_ART.slice(0,8),...RELIC_ART,...CRAFT_ART];
export const plan=[...guide.items.map(i=>({key:i.key,kind:'mammal',prompt:`${guide.style}\nSubject: ${i.subject}\nOnly ONE animal, genuine alpha transparency. No checkerboard painted into pixels.`})),...fishing.map(([key,name,subject])=>({key,name,kind:'fishing',prompt:`${GEAR_STYLE}\nSubject: ${subject}\nHand-painted, NOT a 3D plastic render. One isolated item, no extra objects beyond those described. No text, numbers, logos, or watermark. Genuine alpha transparency, not a painted checkerboard.`}))];
const [key,input]=process.argv.slice(2);
if(key==='--plan')console.log(JSON.stringify(plan));
else if(key){
 const item=plan.find(i=>i.key===key);if(!item||!input)throw Error('Expected a requested key and generated image path');
 const dir=item.kind==='mammal'?'design/aqua3d-review/mammals-originals':'design/fishing-review/originals-2026-11-13';
 await mkdir(dir,{recursive:true});
 const original=await sharp(input).ensureAlpha().trim({threshold:1}).resize(820,820,{fit:'inside'}).extend({top:102,bottom:102,left:102,right:102,background:'#00000000'}).resize(1024,1024,{fit:'contain',background:'#00000000'}).png().toBuffer();
 await writeFile(`${dir}/${key}.png`,original);
 await writeFile(`${dir}/${key}.json`,JSON.stringify({...item,tool:'built-in image_gen',sha256:createHash('sha256').update(original).digest('hex')},null,2)+'\n');
 if(item.kind==='mammal'){
  await mkdir('public/aqua/fish/sm',{recursive:true});
  await sharp(original).resize(512,512).webp({quality:92}).toFile(`public/aqua/fish/${key}.webp`);
  await sharp(original).resize(192,192).webp({quality:86}).toFile(`public/aqua/fish/sm/${key}.webp`);
 }
 console.log(`Imported ${key}`);
}
