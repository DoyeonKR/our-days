// Temporary local authoring worker. Never watches or writes game source/active GLBs.
import {watch} from 'node:fs';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const DIR='design/aqua3d-review',items=JSON.parse(await readFile(DIR+'/remodel-prompts.json','utf8')).items,done=new Map();await mkdir(DIR+'/remodel-refs/originals',{recursive:true});let busy=false,timer;
async function scan(){if(busy)return;busy=true;try{for(const item of items){let fingerprint='';try{for(const v of['side','top','front','bottom']){const s=await stat(`${DIR}/remodel-refs/originals/${item.key}-${v}.png`);fingerprint+=`${s.size}:${s.mtimeMs};`;}}catch{continue;}if(done.get(item.key)===fingerprint)continue;done.set(item.key,fingerprint);console.log('Building orthographic hull: '+item.key);await new Promise(resolve=>{const child=spawn(process.execPath,[DIR+'/remodel-build.mjs',item.key],{stdio:'inherit',windowsHide:true});child.once('exit',resolve);});}}finally{busy=false;}}
watch(DIR+'/remodel-refs/originals',()=>{clearTimeout(timer);timer=setTimeout(scan,2500);});await scan();console.log('Watching completed 4-view reference sets. Ctrl+C to stop.');
