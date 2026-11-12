// Prepared assets only; intentionally does not modify the game's catalogue.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const dir='design/aqua3d-review';
const spec=JSON.parse(await fs.readFile(`${dir}/expansion4-prompts.json`,'utf8'));
const exists=async p=>fs.access(p).then(()=>true,()=>false);
if(process.argv.includes('--import')){
 const sources=(await Promise.all((await fs.readdir(dir)).filter(n=>/^expansion4-sources(?:-\d+)?\.json$/.test(n)).map(async n=>JSON.parse(await fs.readFile(`${dir}/${n}`,'utf8'))))).flat();
 await fs.mkdir(`${dir}/expansion4-originals`,{recursive:true});
 for(const {key,path,error} of sources){
  if(error||!path)continue;
  if(!spec.items.some(i=>i.key===key))throw new Error(`Unknown source ${key}`);
  const original=`${dir}/expansion4-originals/${key}.png`;
  if(!await exists(original))await sharp(path).resize(1024,1024,{fit:'contain',background:'#00000000'}).png().toFile(original);
  const target=`public/aqua/fish/${key}.webp`;
  if(await exists(target))continue; // Never replace an existing reference implicitly.
  const meta=await sharp(original).metadata();
  if(!meta.hasAlpha)throw new Error(`Missing alpha: ${key}`);
  await sharp(original).trim({threshold:1}).resize(410,410,{fit:'contain',background:'#00000000'}).extend({top:51,bottom:51,left:51,right:51,background:'#00000000'}).webp({quality:90}).toFile(target);
  await sharp(target).resize(192,192).webp({quality:86}).toFile(`public/aqua/fish/sm/${key}.webp`);
 }
}
const report=JSON.parse(await fs.readFile(`${dir}/models.json`,'utf8'));
const ready=[];
for(const item of spec.items){
 if(await exists(`public/aqua/fish/${item.key}.webp`))ready.push(item.key);
}
const label=(text,width=960)=>Buffer.from(`<svg width="${width}" height="32"><text x="10" y="23" fill="#e9f5f5" font-family="sans-serif" font-size="16">${text}</text></svg>`);
for(let batch=0;batch<6;batch++){
 const families=spec.species.slice(batch*10,batch*10+10).map(s=>s.key);
 const keys=spec.items.filter(i=>families.includes(i.family)&&ready.includes(i.key)).map(i=>i.key);
 if(!keys.length)continue;
 const art=[];
 for(let i=0;i<keys.length;i++){
  art.push({input:await sharp(`public/aqua/fish/${keys[i]}.webp`).resize(300,180,{fit:'contain',background:'#00000000'}).png().toBuffer(),left:i%3*320+10,top:Math.floor(i/3)*214});
  art.push({input:label(keys[i],320),left:i%3*320,top:Math.floor(i/3)*214+180});
 }
 await sharp({create:{width:960,height:Math.ceil(keys.length/3)*214,channels:4,background:'#173039'}}).composite(art).webp({quality:92}).toFile(`${dir}/expansion4-art-${batch+1}.webp`);
 const reviewed=[];
 for(const k of keys)if(await exists(`${dir}/models/${k}-top.webp`))reviewed.push(k);
 for(let page=0;page<Math.ceil(reviewed.length/6);page++){
  const group=reviewed.slice(page*6,page*6+6),models=[],tops=[];
  for(let row=0;row<group.length;row++){
   const k=group[row];
   models.push({input:await fs.readFile(`${dir}/models/${k}-comparison.webp`),left:0,top:row*364});
   tops.push({input:label(`${k} — TOP / OBLIQUE / SIDE — ${report.models[k]?.renderMethod?.startsWith('Actual')?'WebGL PBR':'CPU proof'}, approval pending`),left:0,top:row*272});
   for(const [col,view] of ['top','oblique','side'].entries())tops.push({input:await sharp(`${dir}/models/${k}-${view}.webp`).resize(320,240,{fit:'contain',background:'#173039'}).png().toBuffer(),left:col*320,top:row*272+32});
  }
  const number=batch*5+page+1;
  await sharp({create:{width:960,height:group.length*364,channels:4,background:'#173039'}}).composite(models).webp({quality:92}).toFile(`${dir}/expansion4-models-${number}.webp`);
  await sharp({create:{width:960,height:group.length*272,channels:4,background:'#173039'}}).composite(tops).webp({quality:92}).toFile(`${dir}/expansion4-top-${number}.webp`);
 }
}
const items=await Promise.all(spec.items.map(async i=>({key:i.key,family:i.family,art:ready.includes(i.key),model:await exists(`public/aqua/models/fish/${i.key}.glb`),review:await exists(`${dir}/models/${i.key}-top.webp`),validation:report.models[i.key]?.validation??null,visualApproval:'pending',activation:'not enabled'})));
report.preparedSets={...report.preparedSets,expansion4:{requested:162,keys:items.filter(i=>i.model).map(i=>i.key),visualApproval:'pending',activation:'not enabled'}};
report.approved=Object.values(report.models).every(m=>m.approval?.startsWith('user_approved'));
report.pendingVisualApproval=Object.keys(report.models).filter(k=>!report.models[k].approval?.startsWith('user_approved'));
report.status='baseline_preserved_expansion4_pending';
await fs.writeFile(`${dir}/models.json`,JSON.stringify(report,null,2)+'\n');
const focus=[['fry_bitterling: immature pigmentation revised; approve developmental proportions','sturgeon: scutes and barbels are reference-derived approximations'],['pleco: check flattened belly and dorsal-fin attachment'],['seahorse: curled-tail depth and upright silhouette','lionfish: complex fin rays are approximated','moray: head/jaw and unseen-side texture need human review; cave behaviour is not implemented here'],['sunfish: body disc and clavus thickness','marlin / halfbeak: bill dimensions and jaw line'],['goosefish / skate: dorsal contour and estimated underside','boxfish: box-shaped cross-section'],['blobfish: living underwater anatomy, not collapsed form','frilled_shark: long-body profile and gill detail']];
const batches=Array.from({length:6},(_,i)=>{const families=spec.species.slice(i*10,i*10+10).map(s=>s.key),rows=items.filter(r=>families.includes(r.family));return {batch:i+1,families,keys:rows.map(r=>r.key),artCount:rows.filter(r=>r.art).length,modelCount:rows.filter(r=>r.model).length,reviewCount:rows.filter(r=>r.review).length,visualReviewFocus:focus[i],visualApproval:'pending',activation:'not enabled'};});
await fs.writeFile(`${dir}/expansion4-status.json`,JSON.stringify({requested:162,source:'built-in image_gen',visualApproval:'pending',activation:'not enabled',artCount:items.filter(i=>i.art).length,modelCount:items.filter(i=>i.model).length,reviewCount:items.filter(i=>i.review).length,batches,items},null,2)+'\n');
await fs.writeFile(`${dir}/expansion4-validation.json`,JSON.stringify(items.filter(i=>i.validation).map(i=>({key:i.key,...report.models[i.key]})),null,2)+'\n');
console.log(JSON.stringify({art:items.filter(i=>i.art).length,models:items.filter(i=>i.model).length,reviewed:items.filter(i=>i.review).length,total:162}));
