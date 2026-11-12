/** Temporary, loopback-only receiver for the explicit 18-model head correction. */
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import sharp from 'sharp';
const root='design/aqua3d-review',origin='http://127.0.0.1:4197';
// Windows indexers can briefly hold a just-rendered WebP. Retry the exact
// bounded destination rather than dropping the entire verified export.
async function save(file,bytes){for(let attempt=0;;attempt++){try{return await writeFile(file,bytes);}catch(e){if(attempt>=12)throw e;await new Promise(r=>setTimeout(r,100+attempt*50));}}}
http.createServer(async(req,res)=>{
 if(req.headers.origin!==origin||req.url!=='/heads'){res.writeHead(403);return res.end();}
 res.setHeader('Access-Control-Allow-Origin',origin);
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
 if(req.method!=='POST'||req.headers['content-type']!=='application/octet-stream'){res.writeHead(405);return res.end();}
 try{
  let count=0;const chunks=[];for await(const c of req){count+=c.length;if(count>64*1024*1024)throw Error('limit');chunks.push(c);}
  const files=unzipSync(Buffer.concat(chunks)),proof=JSON.parse(Buffer.from(files['manifest.json']).toString()),audit=JSON.parse(await readFile(root+'/head-audit.json'));
  const keys=audit.changedKeys;if(keys.length!==30||Object.keys(proof.models).length!==30||Object.keys(files).length!==151)throw Error('count');
  for(const k of keys){
   if(!/^\w+$/.test(k)||proof.models[k]?.sha256!==createHash('sha256').update(await readFile(`public/aqua/models/fish/${k}.glb`)).digest('hex'))throw Error('hash');
   for(const view of ['front','side','oblique','top'])if(!files[k+'-'+view+'.png'])throw Error('view');
   if(!files[k+'-comparison.webp'])throw Error('card');
  }
  await mkdir(root+'/heads/after',{recursive:true});
  const native=JSON.parse(await readFile(root+'/native-render.json'));
  for(const k of keys){
   for(const v of ['front','side','oblique','top'])await save(`${root}/models/${k}-${v}.webp`,await sharp(files[k+'-'+v+'.png']).webp({quality:94}).toBuffer());
   await save(`${root}/heads/after/${k}-comparison.webp`,files[k+'-comparison.webp']);native.models[k]=proof.models[k];
  }
  await save(root+'/native-render.json',JSON.stringify(native,null,2)+'\n');await save(root+'/heads/manifest.json',files['manifest.json']);
  res.writeHead(200);res.end('Saved');console.log('Saved 30 corrected GLBs / 120 WebGL views / 30 reference-before-after cards');
 }catch(e){res.writeHead(400);res.end('Invalid export');console.error(e.message);}
}).listen(4198,'127.0.0.1',()=>console.log('Temporary head correction receiver on 127.0.0.1:4198'));
