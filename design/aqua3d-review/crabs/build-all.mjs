// 게 6모습 GLB — 그림과 같은 기준 · 같은 색(make-art.mjs 의 TINT)으로 crab-build 를 돌린다
import {writeFile} from 'node:fs/promises';
import {crabGLB} from '../crab-build.mjs';
import {CRABS,TINT} from './make-art.mjs';
for(const [key,ref]of Object.entries(CRABS))for(const [stage,t]of Object.entries(TINT)){const name=stage==='adult'?key:`${stage}_${key}`;const {glb,tris}=await crabGLB(name,ref,{dome:.55,droop:.55,tint:t});if(tris>8000)throw Error(name+' '+tris);await writeFile(`public/aqua/models/fish/${name}.glb`,glb);console.log(name,tris,glb.length);}
