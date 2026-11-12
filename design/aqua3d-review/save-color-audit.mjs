// Temporary loopback-only export sink. One fixed output, no user path input.
// Close this process after the review export. Cross-origin callers are rejected.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='http://127.0.0.1:4197',limit=160*1024*1024;
const server=http.createServer(async(req,res)=>{
 if(req.headers.origin!==origin||req.url!=='/audit'){res.writeHead(403);return res.end('Forbidden');}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
 if(req.method!=='POST'||req.headers['content-type']!=='application/octet-stream'){res.writeHead(405);return res.end();}
 try{let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>limit){res.writeHead(413);res.end();req.destroy();return;}chunks.push(c);}
  const data=Buffer.concat(chunks);if(data.readUInt32LE(0)!==0x04034b50)throw new Error('ZIP required');
  await mkdir('design/aqua3d-review/color-quality',{recursive:true});await writeFile('design/aqua3d-review/color-quality/color-audit.zip',data);
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({saved:true,bytes:n}));console.log(`Saved local colour audit: ${n} bytes`);
 }catch(e){res.writeHead(400);res.end('Invalid export');console.error(e.message);}
});
server.listen(4198,'127.0.0.1',()=>console.log('Temporary local colour-export receiver on 127.0.0.1:4198'));
