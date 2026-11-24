// 바다코끼리 모델 검사 — 떠 있는 부품(floating-parts-node 의 규칙). models.json 에 오르기 전에도 돈다
import {loadMesh,analyze} from '../floating-parts-node.mjs';
for(const k of (process.argv.length>2?process.argv.slice(2):['walrus','juv_walrus','fry_walrus'])){const {pos,tris}=await loadMesh(`public/aqua/models/fish/${k}.glb`),r=analyze(pos,tris);console.log(k,'parts',r.components,'floating',r.floating.length,r.floating.map(f=>f.gap.toFixed(3)).join(' '));}
