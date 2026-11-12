import {readFile,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
for(const [sourceName,target]of [['color-quality','runtime-color'],['waterlight','runtime-waterlight'],['post','runtime-post'],['faces','runtime-faces']]){
 const path=`src/lib/aqua3d/${sourceName}.ts`,source=await readFile(path,'utf8');
 await writeFile(`design/aqua3d-review/${target}.mjs`,`// Generated from ${path} by build-color-preview.mjs\n`+stripTypeScriptTypes(source).replaceAll('./color-quality.ts','./runtime-color.mjs').replaceAll('./waterlight.ts','./runtime-waterlight.mjs').replaceAll('./faces.ts','./runtime-faces.mjs').replaceAll('three/examples/jsm/','three/addons/'));
}
await writeFile('design/aqua3d-review/face-profiles.json',await readFile('src/lib/aqua3d/face-profiles.json'));
