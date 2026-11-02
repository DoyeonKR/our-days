import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
const fish=['cobra_guppy','neon_tetra','ryukin_gold','halfmoon_betta','silver_angel','ocellaris_clown','blue_discus','kohaku_koi','motoro_ray','golden_arowana','bluefin_tuna','whale_shark','oceanic_manta','azure_dragonfish','moon_jelly'];
const decor=['mailbox','diver','heart_bubbler','sand_castle','windmill','treasure','pearl_clam','stone_pagoda','sunken_ship','hanok','mermaid','turtle_ship','dragon_palace','star_gate'];
await mkdir('design/aqua3d-review/models',{recursive:true});
for(const [kind,keys]of[['fish',fish],['decor',decor]]){
 const cards=[];for(let i=0;i<keys.length;i++){const label=Buffer.from(`<svg width="240" height="28"><text x="5" y="20" fill="white" font-family="sans-serif" font-size="14">${keys[i]}</text></svg>`);
 cards.push({input:await sharp(`public/aqua/${kind}/${keys[i]}.webp`).resize(240,220,{fit:'contain'}).png().toBuffer(),left:i%5*240,top:Math.floor(i/5)*248});cards.push({input:label,left:i%5*240,top:Math.floor(i/5)*248+220});}
 await sharp({create:{width:1200,height:Math.ceil(keys.length/5)*248,channels:4,background:'#18323a'}}).composite(cards).webp({quality:90}).toFile(`design/aqua3d-review/stage1-${kind}-references.webp`);
}
