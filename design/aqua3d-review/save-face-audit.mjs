// Temporary loopback receiver: one fixed asset-review destination, no game writes.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {unzipSync} from 'fflate';
const origin='http://127.0.0.1:4197';
http.createServer(async(req,res)=>{
 if(req.headers.origin!==origin||req.url!=='/faces'){res.writeHead(403);res.end();return;}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
 if(req.method!=='POST'||req.headers['content-type']!=='application/octet-stream'){res.writeHead(405);res.end();return;}
 try{let count=0;const chunks=[];for await(const chunk of req){count+=chunk.length;if(count>128*1024*1024)throw Error('limit');chunks.push(chunk);}
  const files=unzipSync(Buffer.concat(chunks)),manifest=JSON.parse(Buffer.from(files['manifest.json']).toString()),keys=Object.keys(manifest.models);
  if(keys.length!==381||Object.keys(files).length!==382||keys.some(k=>!/^\w+$/.test(k)||!files[k+'.webp']))throw Error('manifest');
  await mkdir('design/aqua3d-review/faces/renders',{recursive:true});
  for(const key of keys)await writeFile(`design/aqua3d-review/faces/renders/${key}.webp`,files[key+'.webp']);
  await writeFile('design/aqua3d-review/faces/render-manifest.json',files['manifest.json']);res.writeHead(200);res.end('Saved');console.log(`Saved ${keys.length} face comparisons`);
 }catch(e){res.writeHead(400);res.end('Invalid export');console.error(e.message);}
}).listen(4198,'127.0.0.1',()=>console.log('Temporary face audit receiver on 127.0.0.1:4198'));
