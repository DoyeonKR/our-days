// 고래 5종 · 톱상어 그림(새끼 · 어린 · 다 큰) — 2026-11-18 [사용자: "고래 종류 5가지 와 톱상어 추가해줘"]
// 기준: NOAA Fisheries 고래 일러스트(미국 정부 저작물 — 퍼블릭 도메인) · 톱상어는 Pristiophorus cirratus 옛 채색 도판(퍼블릭 도메인, 같은 속).
// 흰 바탕을 가장자리에서 채워 지우고(가장 큰 덩어리만), 흑백 원화는 밝기 → 종의 실제 몸빛으로 물들인다. 머리 오른쪽 · 512 투명 · sm 192.
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const R='design/aqua3d-review/whales/reference/';
// [원본, 머리가 왼쪽이면 뒤집기, 바탕 문턱(밝기), 어두운 색, 밝은 색(null = 원래 색)]
export const WHALES={
 minke_whale:[R+'src-minke.png',false,236,[38,46,58],[238,240,242]],
 // 귀신고래는 2026-11-18 사용자 사진(옆 · 위 · 앞)이 기준 — 오려낸 옆 사진을 그대로 쓴다(gray-cut.mjs, 'cut'). 옛 NOAA 흑백 일러스트(src-gray.jpg)는 실제와 달랐다
 gray_whale:[R+'gray-cut-side.png','cut'],
 humpback_whale:[R+'src-humpback.png',true,236,[22,28,38],[226,230,234]],
 sperm_whale:[R+'src-sperm.png',false,236,[40,38,40],[170,160,154]],
 blue_whale:[R+'src-blue.png',false,240,[20,32,52],[100,128,154]],
 sawshark:[R+'src-sawshark.png',false,232,null,null],
};
export const STAGE={fry:{k:.3,rgb:[205,214,222]},juv:{k:.14,rgb:[205,214,222]},adult:null};
export async function cutout(src,flip,thr,dark,light){
 let img=sharp(src).removeAlpha();if(flip)img=img.flop();
 const {data,info}=await img.raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height,N=W*H;
 const lum=new Float32Array(N),sat=new Float32Array(N);for(let i=0;i<N;i++){const r=data[i*3],g=data[i*3+1],b=data[i*3+2];lum[i]=.299*r+.587*g+.114*b;sat[i]=Math.max(r,g,b)-Math.min(r,g,b);}
 const bg=new Uint8Array(N),q=new Int32Array(N);let qa=0,qb=0;const isBg=i=>lum[i]>=thr&&sat[i]<40;
 for(let x=0;x<W;x++)for(const y of[0,H-1]){const i=y*W+x;if(!bg[i]&&isBg(i)){bg[i]=1;q[qb++]=i;}}for(let y=0;y<H;y++)for(const x of[0,W-1]){const i=y*W+x;if(!bg[i]&&isBg(i)){bg[i]=1;q[qb++]=i;}}
 while(qa<qb){const i=q[qa++],x=i%W;for(const j of[i-W,i+W,x?i-1:-1,x<W-1?i+1:-1])if(j>=0&&j<N&&!bg[j]&&isBg(j)){bg[j]=1;q[qb++]=j;}}
 // 가장 큰 덩어리
 const lab=new Int32Array(N).fill(-1);let best=-1,bestN=0;for(let s=0;s<N;s++){if(bg[s]||lab[s]>=0)continue;let a=0,b=0;q[b++]=s;lab[s]=s;let n=0;while(a<b){const i=q[a++],x=i%W;n++;for(const j of[i-W,i+W,x?i-1:-1,x<W-1?i+1:-1])if(j>=0&&j<N&&!bg[j]&&lab[j]<0){lab[j]=s;q[b++]=j;}}if(n>bestN){bestN=n;best=s;}}
 const out=Buffer.alloc(N*4);let x0=W,x1=0,y0=H,y1=0;
 for(let i=0;i<N;i++){if(lab[i]!==best)continue;const x=i%W,y=(i/W)|0;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
  let r=data[i*3],g=data[i*3+1],b=data[i*3+2];
  if(dark){const t=Math.min(1,Math.max(0,(lum[i]-20)/(225)));const tt=t*t*(3-2*t)*.6+t*.4;r=dark[0]+(light[0]-dark[0])*tt;g=dark[1]+(light[1]-dark[1])*tt;b=dark[2]+(light[2]-dark[2])*tt;}
  // 바탕과 닿은 가장자리는 덜 불투명하게(흰 테 지우기)
  let edge=0;for(const j of[i-W,i+W,x?i-1:-1,x<W-1?i+1:-1])if(j>=0&&j<N&&lab[j]!==best)edge=1;
  out[i*4]=r;out[i*4+1]=g;out[i*4+2]=b;out[i*4+3]=edge?(lum[i]>200?60:170):255;}
 return sharp(out,{raw:{width:W,height:H,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).png().toBuffer();
}
// 오려낸 사진의 물빛 비침 걷기(gray-build.mjs 의 nearest 와 같은 식) — 가장자리 · 배 아래의 청록 기를 회색 쪽으로
async function uncast(src){const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=0;i<info.width*info.height;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2],c=Math.max(0,Math.min(1,(b-r-12)/30));if(!c)continue;const l=(r+g+b)/3;data[i*4]=Math.round(r+(l*1.02-r)*c);data[i*4+1]=Math.round(g+(l-g)*c);data[i*4+2]=Math.round(b+(l*.97-b)*c);}return sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();}
async function tint(png,t){if(!t)return png;const {data,info}=await sharp(png).raw().toBuffer({resolveWithObject:true});for(let i=0;i<info.width*info.height;i++)for(let c=0;c<3;c++)data[i*4+c]=Math.round(data[i*4+c]*(1-t.k)+t.rgb[c]*t.k);return sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();}
if(process.argv[1]&&process.argv[1].split(String.fromCharCode(92)).join('/').endsWith('whales/make-art.mjs')){const only=process.argv.slice(2);
 for(const [key,[src,flip,thr,dark,light]]of Object.entries(WHALES)){if(only.length&&!only.includes(key))continue;const cut=flip==='cut'?await uncast(src):await cutout(src,flip,thr,dark,light);
  await writeFile(`design/aqua3d-review/whales/reference/${key}-cut.png`,cut);
  for(const [stage,t]of Object.entries(STAGE)){const name=stage==='adult'?key:`${stage}_${key}`;const png=await tint(cut,t);
   const big=await sharp(png).resize(470,470,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:21,bottom:21,left:21,right:21,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:90,alphaQuality:100}).toBuffer();
   await writeFile(`public/aqua/fish/${name}.webp`,big);await writeFile(`public/aqua/fish/sm/${name}.webp`,await sharp(big).resize(192,192).webp({quality:88,alphaQuality:100}).toBuffer());console.log(name);}}}
