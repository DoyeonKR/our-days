import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {unzipSync} from 'fflate';
import {createHash} from 'node:crypto';
const DIR='design/aqua3d-review',status=JSON.parse(await readFile(DIR+'/remodel-status.json','utf8')),archive=process.argv[2];
if(!archive)throw Error('Pass native-render ZIP exported by remodel-viewer.html');
const files=unzipSync(await readFile(archive)),proof=JSON.parse(Buffer.from(files['remodel-render.json']).toString()),views=['top','front','side','oblique'],W=2128,cell=256;
await mkdir(DIR+'/remodel-renders',{recursive:true});
for(const [name,bytes]of Object.entries(files)){if(!/^[a-z0-9_-]+\.(png|json)$/.test(name))throw Error('Unexpected render filename');await writeFile(DIR+'/remodel-renders/'+name,bytes);}
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
for(const category of ['mammal','cephalopod']){
 const keys=Object.keys(proof.models).filter(k=>status.models[k].category===category);
 for(let start=0;start<keys.length;start+=4){const batch=keys.slice(start,start+4),H=76+batch.length*(cell+42),composite=[];let labels='<svg width="'+W+'" height="'+H+'"><style>text{font-family:Arial;fill:#e8f3f5;font-size:14px}.head{font-size:19px;font-weight:bold}</style><text x="16" y="25" class="head">'+category+' · actual GLB renders · visual approval pending</text>';
 for(let i=0;i<8;i++)labels+='<text x="'+(i*266+12)+'" y="58">'+views[Math.floor(i/2)]+' / '+(i%2?'V3':'old')+'</text>';
 for(const [row,key]of batch.entries()){const m=status.models[key],p=proof.models[key];if(p.sha256!==m.sha256||p.oldSHA256!==m.oldSHA256)throw Error('Stale render: '+key);const y=76+row*(cell+42);labels+='<text x="16" y="'+(y+17)+'">'+xml(key)+' · '+m.triangles+' triangles · '+m.bytes+' bytes</text>';for(const [vi,view]of views.entries())for(const [oi,kind]of ['old','new'].entries()){const name=key+'-'+kind+'-'+view+'.png',input=await sharp(files[name]).resize(cell,cell,{fit:'contain',background:'#17333d'}).flatten({background:'#17333d'}).png().toBuffer();composite.push({input,left:vi*532+oi*266+5,top:y+26});}}
 labels+='</svg>';composite.push({input:Buffer.from(labels),left:0,top:0});const out=DIR+'/remodel-'+category+'-models-'+(Math.floor(start/4)+1)+'.webp';await sharp({create:{width:W,height:H,channels:4,background:'#17333d'}}).composite(composite).webp({quality:92}).toFile(out);console.log(out);
 }
}
const sha=b=>createHash('sha256').update(b).digest('hex');await writeFile(DIR+'/remodel-render-proof.json',JSON.stringify({archiveSHA256:sha(await readFile(archive)),...proof},null,2)+'\n');
