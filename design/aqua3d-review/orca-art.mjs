// Art-only import. Does not rewrite catalogue keys or enable gameplay.
import sharp from 'sharp';
import {mkdir,writeFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=process.argv[2];if(!source)throw Error('Pass the selected generated PNG path.');
const original='design/aqua3d-review/orca-originals/orca.png',game='public/aqua/fish/orca.webp',small='public/aqua/fish/sm/orca.webp';
for(const file of[original,game,small]){try{await access(file);throw Error('Refusing to overwrite existing asset: '+file);}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir('design/aqua3d-review/orca-originals',{recursive:true});await mkdir('public/aqua/fish/sm',{recursive:true});
const png=await sharp(source).ensureAlpha().trim({threshold:1}).resize(820,820,{fit:'contain',background:'#00000000'}).extend({top:102,bottom:102,left:102,right:102,background:'#00000000'}).png().toBuffer();
await writeFile(original,png);await sharp(png).resize(512,512).webp({quality:92}).toFile(game);await sharp(png).resize(192,192).webp({quality:86}).toFile(small);
for(const [file,size]of[[original,1024],[game,512],[small,192]]){const m=await sharp(file).metadata(),{data}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(m.width,size);assert.equal(m.height,size);assert.ok(m.hasAlpha);const margin=Math.floor(size*.09);for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(x<margin||y<margin||x>=size-margin||y>=size-margin)assert.ok(data[(y*size+x)*4+3]<=2);console.log(file+' / '+size+'px / alpha padding verified');}
