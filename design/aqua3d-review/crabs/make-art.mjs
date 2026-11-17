// 게 그림 6장(새끼 · 어린 · 다 큰) — 기준 그림(NOAA 등쪽 일러스트, 퍼블릭 도메인)을 게임 규칙(머리 오른쪽 · 512 투명 · sm 192)으로.
// 새끼는 옅고 덜 붉게(갓 탈피한 어린 게처럼), 어린 것은 그 중간. 3D 는 crab-build.mjs 가 같은 그림 · 같은 색으로 짓는다.
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
export const CRABS={snow_crab:'design/aqua3d-review/crabs/reference/noaa-snow-crab.png',king_crab:'design/aqua3d-review/crabs/reference/noaa-red-king-crab.png',
 // 바닷가재(2026-11-18) — 원화는 머리 왼쪽 · 비스듬히 위에서 본 그림이라 머리를 위로 돌린 판(-up)을 쓴다
 lobster:'design/aqua3d-review/crabs/reference/noaa-american-lobster-up.png'};
export const DOME={lobster:.9};
export const TINT={fry:{k:.42,rgb:[236,214,190]},juv:{k:.2,rgb:[232,190,160]},adult:null};
export async function tinted(ref,t){const {data,info}=await sharp(ref).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(t)for(let i=0;i<info.width*info.height;i++)for(let c=0;c<3;c++)data[i*4+c]=Math.round(data[i*4+c]*(1-t.k)+t.rgb[c]*t.k);return sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();}
if(process.argv[1]&&process.argv[1].replace(/\\/g,'/').endsWith('crabs/make-art.mjs')){const only=process.argv.slice(2);for(const [key,ref]of Object.entries(CRABS)){if(only.length&&!only.includes(key))continue;for(const [stage,t]of Object.entries(TINT)){const name=stage==='adult'?key:`${stage}_${key}`;const png=await tinted(ref,t);
 const rot=await sharp(png).rotate(90,{background:{r:0,g:0,b:0,alpha:0}}).trim({threshold:1}).toBuffer();
 const big=await sharp(rot).resize(470,470,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:21,bottom:21,left:21,right:21,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:90,alphaQuality:100}).toBuffer();
 await writeFile(`public/aqua/fish/${name}.webp`,big);await writeFile(`public/aqua/fish/sm/${name}.webp`,await sharp(big).resize(192,192).webp({quality:88,alphaQuality:100}).toBuffer());console.log(name);}}}
