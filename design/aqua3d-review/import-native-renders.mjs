import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import sharp from 'sharp';
const archive=process.argv[2];if(!archive)throw new Error('Pass the browser-exported ZIP path');
const root='design/aqua3d-review',report=JSON.parse(await readFile(`${root}/models.json`,'utf8')),files=unzipSync(await readFile(archive)),proof=JSON.parse(Buffer.from(files['native-render.json']).toString());let count=0;
for(const [key,meta]of Object.entries(report.models)){
 const source=await readFile(meta.file),hash=createHash('sha256').update(source).digest('hex'),model=proof.models[key];if(!model||model.sha256!==hash)throw new Error(`Native render does not match GLB: ${key}`);
 for(const view of model.views){if(!['front','side','oblique','top'].includes(view))throw new Error('Unexpected view');const png=files[`${key}-${view}.png`];if(!png)throw new Error('Missing frame');await sharp(png).webp({quality:94}).toFile(`${root}/models/${key}-${view}.webp`);count++;}
}
await writeFile(`${root}/native-render.json`,JSON.stringify(proof,null,2)+'\n');console.log(`Imported ${count} WebGL/PBR renders after matching all ${Object.keys(report.models).length} GLB hashes.`);
