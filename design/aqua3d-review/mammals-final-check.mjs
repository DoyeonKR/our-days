import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {expandGLB} from './glb-compress.mjs';
const DIR='design/aqua3d-review',guide=JSON.parse(await readFile(`${DIR}/mammals-prompts.json`,'utf8')),models=JSON.parse(await readFile(`${DIR}/models.json`,'utf8')).models,proof=JSON.parse(await readFile(`${DIR}/native-render.json`,'utf8')).models;
const validator=createRequire(path.join(tmpdir(),'our-days-glb-validator','package.json'))('gltf-validator'),results=[];
for(const item of guide.items){
 const key=item.key,meta=models[key],bytes=await readFile(meta.file),raw=await expandGLB(bytes),validation=await validator.validateBytes(new Uint8Array(raw),{maxIssues:100});
 if(validation.issues.numErrors)throw Error(`${key}: expanded validation failed`);
 const hash=createHash('sha256').update(bytes).digest('hex');if(proof[key]?.sha256!==hash||proof[key].views.length!==4)throw Error(`Stale WebGL proof ${key}`);
 for(const [size,file]of [[512,`public/aqua/fish/${key}.webp`],[192,`public/aqua/fish/sm/${key}.webp`]]){const m=await sharp(file).metadata(),s=await sharp(file).stats();if(m.width!==size||m.height!==size||!m.hasAlpha||s.channels[3].min!==0)throw Error(`Image contract ${key}`);}
 results.push({key,triangles:meta.triangles,bytes:bytes.length,errors:meta.validation.errors,expandedErrors:validation.issues.numErrors,bones:meta.bones,textureSize:meta.textureSize,sha256:hash,renderMethod:'Actual GLTFLoader / WebGL PBR, 4 views, hash verified'});
}
await writeFile(`${DIR}/mammals-validation.json`,JSON.stringify(results,null,2)+'\n');
console.log(`Validated ${results.length} compressed + expanded GLBs and 72 actual WebGL frames.`);
