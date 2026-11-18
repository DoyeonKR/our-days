// 두족류 v3 검수용 서버 — 저장소 루트를 그대로 내주고, .ts 는 타입만 지워 브라우저가 실제 게임 코드(glb.ts 의 fishMotion · 팔 셰이더)를 부르게 한다.
// PUT /save/<이름> 은 design/aqua3d-review/ceph-v3/ 에 검수 그림을 쓴다(그 폴더 밖은 못 쓴다).
// node design/aqua3d-review/ceph-v3/serve.mjs [port 3217]  →  http://localhost:3217/design/aqua3d-review/ceph-v3/review.html
import http from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import path from 'node:path';
const root = process.cwd(), port = +(process.argv[2] ?? 3217), OUT = path.join(root, 'design/aqua3d-review/ceph-v3');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ts': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm'};
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'PUT' && p.startsWith('/save/')) {
      const name = path.basename(p.slice(6)); if (!/^[\w.-]+\.(png|webp|json)$/.test(name)) throw Error('name');
      const chunks = []; for await (const c of req) chunks.push(c);
      await writeFile(path.join(OUT, name), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); return;
    }
    const file = path.join(root, p); if (!file.startsWith(root)) throw Error('path');
    let body = await readFile(file), ext = path.extname(file);
    if (ext === '.ts') body = Buffer.from(stripTypeScriptTypes(body.toString('utf8')));
    res.writeHead(200, {'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'no-store'}); res.end(body);
  } catch (e) { res.writeHead(404); res.end(String(e)); }
}).listen(port, () => console.log('ceph-v3 review on', port));
