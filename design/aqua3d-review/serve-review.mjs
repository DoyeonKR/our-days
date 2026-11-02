import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'../..');
const prefixes=['design/aqua3d-review/','public/aqua/models/','public/aqua/fish/','public/aqua/decor/','node_modules/three/','node_modules/fflate/'];
http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/'){res.writeHead(302,{Location:'/design/aqua3d-review/index.html'});return res.end();}
 const file=path.resolve(root,'.'+pathname),relative=path.relative(root,file).replaceAll('\\','/');
 if(!prefixes.some(p=>relative.startsWith(p))||relative.includes('..')){res.writeHead(403);return res.end('Forbidden');}
 const bytes=await readFile(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png'}[path.extname(file)]??'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4197,'127.0.0.1',()=>console.log('Review only: http://127.0.0.1:4197/ — no game/account writes'));
