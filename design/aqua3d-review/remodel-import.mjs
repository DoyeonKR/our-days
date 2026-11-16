import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const DIR='design/aqua3d-review',REF=DIR+'/remodel-refs';
const [key,view,file]=process.argv.slice(2);const guide=JSON.parse(await readFile(DIR+'/remodel-prompts.json','utf8'));if(!guide.items.some(i=>i.key===key)||!['side','top','front','bottom'].includes(view)||!file)throw Error('Expected catalogue key, orthographic view, generated file');
await mkdir(REF+'/originals',{recursive:true});const raw=await readFile(file);await writeFile(`${REF}/originals/${key}-${view}.png`,raw);
// Convert size only here. Cross-view registration is a separate, recorded pass.
const png=await sharp(raw).ensureAlpha().resize(1024,1024,{fit:'contain',background:'#00000000'}).png().toBuffer();await writeFile(`${REF}/${key}-${view}.png`,png);
await writeFile(`${REF}/${key}-${view}.json`,JSON.stringify({key,view,tool:'built-in image_gen',source:file,sourceSHA256:createHash('sha256').update(raw).digest('hex'),sha256:createHash('sha256').update(png).digest('hex'),registration:'pending'},null,2)+'\n');console.log(`Saved ${key}-${view}`);
