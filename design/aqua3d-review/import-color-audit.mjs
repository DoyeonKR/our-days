import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const archive=process.argv[2];if(!archive)throw new Error('Pass the locally downloaded colour-audit ZIP.');
const dir='design/aqua3d-review/color-quality';await mkdir(`${dir}/renders`,{recursive:true});
const files=unzipSync(await readFile(archive)),proof=JSON.parse(Buffer.from(files['color-render.json']).toString()),inventory=[];
for(const kind of ['fish','decor'])for(const file of await readdir(`public/aqua/models/${kind}`))if(file.endsWith('.glb'))inventory.push({key:file.slice(0,-4),kind,file:`public/aqua/models/${kind}/${file}`});
assert.deepEqual(Object.keys(proof.models).sort(),inventory.map(m=>m.key).sort(),'All repo GLBs must be included, not just expansion4.');
const failures=[],flags=[];let frames=0;
for(const item of inventory){
 const bytes=await readFile(item.file),hash=createHash('sha256').update(bytes).digest('hex'),p=proof.models[item.key];assert.equal(hash,p.sha256,item.key);
 const j=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));assert.equal(j.asset.version,'2.0');
 item.sha256=hash;item.bytes=bytes.length;item.materials=j.materials.length;item.textureCount=j.textures.length;item.colorMetrics=p.metrics;
 for(const view of ['side','oblique'])for(const look of ['before','after']){
  const name=`${item.key}-${view}-${look}`,png=files[`${name}.png`];assert.ok(png,name);const meta=await sharp(png).metadata();assert.equal(meta.width,512);assert.equal(meta.height,512);
  await sharp(png).webp({quality:92}).toFile(`${dir}/renders/${name}.webp`);frames++;
  if(!p.metrics[`${view}-${look}`].pixels)failures.push(`${name}: empty render`);
 }
 const a=p.metrics['side-before'],b=p.metrics['side-after'];
 if(b.saturation<a.saturation-.02||b.highlightFraction>a.highlightFraction+.02)flags.push({key:item.key,before:a,after:b,reason:b.saturation<a.saturation-.02?'saturation decrease; inspect neutral/bright surfaces':'increased highlights; inspect clipping'});
}
const label=(text,w=1152,h=24)=>Buffer.from(`<svg width="${w}" height="${h}"><text x="8" y="18" fill="#e4efed" font-family="sans-serif" font-size="13">${text}</text></svg>`);
inventory.sort((a,b)=>a.key.localeCompare(b.key));
for(let page=0;page<Math.ceil(inventory.length/42);page++){
 const group=inventory.slice(page*42,page*42+42),parts=[];
 for(let i=0;i<group.length;i++){const k=group[i].key,x=i%6*192,y=Math.floor(i/6)*128;parts.push({input:label(k,192),left:x,top:y});
  for(const [col,look]of ['before','after'].entries())parts.push({input:await sharp(`${dir}/renders/${k}-side-${look}.webp`).resize(96,96).png().toBuffer(),left:x+col*96,top:y+24});
 }
 await sharp({create:{width:1152,height:Math.ceil(group.length/6)*128,channels:4,background:'#173039'}}).composite(parts).webp({quality:93}).toFile(`${dir}/overview-${page+1}.webp`);
}
const chosen=['parrotfish','cobra_guppy','blue_discus','ocellaris_clown','platinum_arowana','black_ray','pearl_clam','dragon_palace','star_gate'];
for(let page=0;page<3;page++){
 const group=chosen.slice(page*3,page*3+3),parts=[];
 for(let i=0;i<group.length;i++){const k=group[i];parts.push({input:label(`${k} — BEFORE (left) / AFTER (right)`,960,32),left:0,top:i*352});for(const [col,look]of ['before','after'].entries())parts.push({input:await sharp(`${dir}/renders/${k}-oblique-${look}.webp`).resize(480,320,{fit:'contain',background:'#173039'}).png().toBuffer(),left:col*480,top:i*352+32});}
 await sharp({create:{width:960,height:group.length*352,channels:4,background:'#173039'}}).composite(parts).webp({quality:94}).toFile(`${dir}/comparison-${page+1}.webp`);
}
const report={date:'2026-11-12',revision:proof.revision,models:inventory.length,fish:inventory.filter(m=>m.kind==='fish').length,decor:inventory.filter(m=>m.kind==='decor').length,frames,hashesVerified:inventory.length,looks:proof.looks,failures,flags,inventory,note:'All assets rendered; measurements flag colour changes only, not a visual approval or geometry-quality score. Original GLB bytes are unchanged.',deployment:'not performed'};
await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({models:inventory.length,frames,failures,flags:flags.map(f=>f.key)},null,2));if(failures.length)process.exitCode=1;
