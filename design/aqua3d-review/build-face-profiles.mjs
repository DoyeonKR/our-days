import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {fitBody} from './fish-fit.mjs';
const dir='design/aqua3d-review/faces';await mkdir(dir,{recursive:true});
const report=JSON.parse(await readFile('design/aqua3d-review/models.json','utf8')),profiles={},items=[];
const excluded=new Set(['jellyfish','starfish','squid','octopus','giant_squid','kraken']);
for(const [key,m]of Object.entries(report.models)){
 if(m.kind!=='fish')continue;
 const source=await readFile(`public/aqua/fish/${key}.webp`),hash=createHash('sha256').update(source).digest('hex');
 if(excluded.has(m.family)||key==='moon_jelly'){profiles[key]={family:m.family,mode:'none',sourceHash:hash,reason:'No exposed vertebrate jaw/paired fish eyes; retain species anatomy'};items.push({key,...profiles[key]});continue;}
 const rotated=m.referenceRotation===90,{data,info}=await(rotated?sharp(source).rotate(90):sharp(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=0,b=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>100){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 const W=r-l,H=b-t,ref={data,info,bounds:[l,t,r,b]},fit=fitBody(ref,200,.5),span=fit.s1-fit.s0;
 const at=(x,y)=>{x=Math.max(0,Math.min(info.width-1,Math.round(x)));y=Math.max(0,Math.min(info.height-1,Math.round(y)));const i=(y*info.width+x)*4;return [...data.subarray(i,i+4)];};
 const lum=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
 // Large ornamental tails can be the largest component: never use their end as a face landmark.
 const runsAt=u=>{const runs=[];let start=-1;for(let y=t;y<=b+1;y++){const inside=y<=b&&at(l+u*W,y)[3]>110;if(inside&&start<0)start=y;if(!inside&&start>=0){runs.push([start,y-1]);start=-1;}}return runs;};
 const headRuns=runsAt(.91).sort((a,b)=>(b[1]-b[0])-(a[1]-a[0])),head=headRuns[0]??[t+H*.4,t+H*.6],q={center:((head[0]+head[1])/2-t)/H,half:Math.max(.015,(head[1]-head[0])/H/2)};
 let mouthU=.985,mouthV=q.center+q.half*.10,gap=0,gapX=mouthU;
 // Open silhouette: two tissue runs with a transparent oral gap near the snout.
 for(let u=.91;u<.995;u+=.006){const x=l+u*W,runs=[];let a=-1;
  for(let y=Math.round(t+H*(q.center-q.half*1.25));y<=Math.min(b,Math.round(t+H*(q.center+q.half*1.4)));y++){
   const inside=at(x,y)[3]>110;if(inside&&a<0)a=y;if(!inside&&a>=0){runs.push([a,y-1]);a=-1;}}
  for(let j=0;j<runs.length-1;j++){const A=runs[j],B=runs[j+1],g=(B[0]-A[1])/H,cy=((A[1]+B[0])/2-t)/H;
   if(A[1]-A[0]>=4&&B[1]-B[0]>=4&&g>.02&&g<q.half*1.5&&cy>q.center-q.half*.35&&g>gap){gap=g;mouthV=cy;gapX=u;}}
 }
 if(gap)mouthU=gapX;
 const eyePrior={x:.86,y:q.center-q.half*.35};let best=null;
 // Compact dark, locally contrasted iris; do not interpret long stripes as eyes.
 const seen=new Set();
 for(let y=Math.max(t,Math.round(t+(q.center-q.half*1.4)*H));y<Math.min(b,t+(q.center+q.half*.18)*H);y++)for(let x=Math.round(l+.68*W);x<l+.995*W;x++){
  const id=y*info.width+x,c=at(x,y);if(seen.has(id)||c[3]<180||lum(c)>75)continue;let queue=[[x,y]],pixels=[],x0=x,x1=x,y0=y,y1=y;seen.add(id);
  while(queue.length&&pixels.length<200){const [xx,yy]=queue.pop();pixels.push([xx,yy]);x0=Math.min(x0,xx);x1=Math.max(x1,xx);y0=Math.min(y0,yy);y1=Math.max(y1,yy);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=xx+dx,ny=yy+dy,nid=ny*info.width+nx;if(nx<l||nx>r||ny<t||ny>b||seen.has(nid))continue;const v=at(nx,ny);if(v[3]>180&&lum(v)<75){seen.add(nid);queue.push([nx,ny]);}}}
  const ew=x1-x0+1,eh=y1-y0+1;if(pixels.length<3||pixels.length>=180||Math.max(ew,eh)/Math.min(ew,eh)>2.1||ew>W*.065||eh>H*.13)continue;
  const cx=(x0+x1)/2,cy=(y0+y1)/2,rad=Math.max(2,(ew+eh)/4),ring=[];for(let k=0;k<12;k++){const a=k/12*Math.PI*2,v=at(cx+Math.cos(a)*(rad+2),cy+Math.sin(a)*(rad+2));if(v[3]>180)ring.push(lum(v));}
  const contrast=ring.reduce((n,v)=>n+v,0)/(ring.length||1)-pixels.reduce((n,p)=>n+lum(at(...p)),0)/pixels.length;
  const u=(cx-l)/W,v=(cy-t)/H,score=contrast-180*Math.abs(u-eyePrior.x)-60*Math.abs(v-eyePrior.y)+Math.min(10,pixels.length*.2);
  if(contrast>12&&(!best||score>best.score))best={u,v,radius:Math.max(ew,eh)/W/2,score};
 }
 const flat=['ray','manta','skate'].includes(m.family)||key==='aurora_ray'||m.family==='flounder'&&!key.startsWith('fry_');
 let mode=flat?'ventral':['pleco','sturgeon'].includes(m.family)?'inferior':'terminal';
 let teeth='none';if(['great_white','piranha'].includes(m.family))teeth='triangular';
 else if(['moray','eel','hairtail','barracuda','viperfish','anglerfish','goosefish','frilled_shark'].includes(m.family))teeth='fang';
 else if(['parrotfish','puffer'].includes(m.family))teeth='beak';
 else if(['blue_shark','leopard_shark','nurse_shark','hammerhead','megamouth'].includes(m.family))teeth='fine';
 if(['blue_shark','leopard_shark','nurse_shark','hammerhead','great_white','whale_shark','megamouth'].includes(m.family))mode='subterminal';
 const colors=[];for(let du of[-.04,-.02,0])for(let dv of[-.12,-.04,.06]){const c=at(l+(mouthU+du)*W,t+(mouthV+dv)*H);if(c[3]>160)colors.push(c.slice(0,3));}colors.sort((a,b)=>lum(a)-lum(b));
 const skin=colors[Math.floor(colors.length*.6)]??[137,133,112],eye=best?{u:best.u,v:best.v,radius:Math.max(.008,Math.min(.024,best.radius)),confidence:Math.round(best.score)}:{u:eyePrior.x,v:eyePrior.y,radius:.012,confidence:0};
 const profile={family:m.family,mode,sourceHash:hash,referenceBounds:[l,t,r,b],referenceRotation:rotated?90:0,mouth:[mouthU,mouthV],referenceGap:gap,restOpen:gap?Math.min(.65,.18+gap*2):.035,teeth,eye,skin,barbels:['catfish','bullhead','redtail_catfish','sturgeon','loach'].includes(m.family)?(m.family==='sturgeon'?4:2):0,review:'pending_reference_comparison'};
 profiles[key]=profile;items.push({key,...profile});
}
await writeFile('src/lib/aqua3d/face-profiles.json',JSON.stringify(profiles)+'\n');
await writeFile(`${dir}/inventory.json`,JSON.stringify({models:items.length,items},null,2)+'\n');
// Source landmark sheets. Anatomical assumptions remain explicitly reviewable.
for(let page=0;page<Math.ceil(items.length/36);page++){
 const group=items.slice(page*36,page*36+36),parts=[];
 for(let i=0;i<group.length;i++){const p=group[i],x=i%6*192,y=Math.floor(i/6)*150;let image=sharp(`public/aqua/fish/${p.key}.webp`);if(p.referenceRotation)image.rotate(p.referenceRotation);
  parts.push({input:await image.resize(192,120,{fit:'contain',background:'#173039'}).png().toBuffer(),left:x,top:y});
  parts.push({input:Buffer.from(`<svg width="192" height="30"><text x="3" y="12" fill="#fff" font-size="11">${p.key}</text><text x="3" y="25" fill="#abc" font-size="10">${p.mode} / ${p.teeth??'n/a'} / ${p.referenceGap?'open':'closed'}</text></svg>`),left:x,top:y+120});
 }
 await sharp({create:{width:1152,height:Math.ceil(group.length/6)*150,channels:4,background:'#173039'}}).composite(parts).webp({quality:93}).toFile(`${dir}/references-${page+1}.webp`);
}
console.log(JSON.stringify({models:items.length,facial:items.filter(i=>i.mode!=='none').length,anatomicalExceptions:items.filter(i=>i.mode==='none').length,openReferences:items.filter(i=>i.referenceGap>0).length,lowConfidenceEyes:items.filter(i=>i.eye?.confidence<15).length}));
