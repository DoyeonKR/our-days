// 극지 동물(바다코끼리 · 황제펭귄) 검수 시트(2026-11-25) — 몸 다섯 방향 + 머리 확대 넷, &old=1 이면 polar/old-1125 를 위 줄에
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const qs = new URLSearchParams(location.search), status = document.querySelector('#status'), out = document.querySelector('#out'), CELL = +(qs.get('cell') ?? 300);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true}); renderer.setSize(CELL, CELL); renderer.toneMapping = T.NeutralToneMapping; renderer.outputColorSpace = T.SRGBColorSpace;
const BODY = [['side', [0, .05, 1], 1.1], ['front', [1, .05, 0], .6], ['3/4', [1, .45, 1.2], 1.1], ['top', [0, 1, .001], 1.1], ['below', [.6, -.8, .9], 1.1]];
const HEAD = [['head front', [1, .1, 0], .42], ['head 3/4', [1, .3, .9], .42], ['head side', [0, .05, 1], .42], ['head top', [.3, 1, .001], .42], ['head low', [1, -.5, .6], .42]];
function scene() { const s = new T.Scene(); s.background = new T.Color(0x8fa9b4); s.add(new T.HemisphereLight(0xe8f3ff, 0x666953, 1.6)); const d = new T.DirectionalLight(0xfff0dc, 2); d.position.set(2, 5, 4); s.add(d); const f = new T.DirectionalLight(0xa2d8e2, .7); f.position.set(-3, 2, -5); s.add(f); return s; }
async function load(url) { const bytes = await (await fetch(url, {cache: 'no-store'})).arrayBuffer(); const sc = (await loader.parseAsync(bytes, '/')).scene; sc.traverse((o) => { if (o.material?.map) { o.material.map.anisotropy = 8; o.material.map.needsUpdate = true; } }); return sc; }
function box(root) { root.updateMatrixWorld(true); const b = new T.Box3(), v = new T.Vector3(); root.traverse((o) => { if (o.isSkinnedMesh) for (let i = 0; i < o.geometry.attributes.position.count; i++) b.expandByPoint(o.getVertexPosition(i, v)); }); return b; }
function shot(sc, c, dir, half) { const cam = new T.OrthographicCamera(-half, half, half, -half, .01, 100); if (dir[1] > .9) cam.up.set(0, 0, -1); cam.position.copy(c).add(new T.Vector3(...dir).normalize().multiplyScalar(10)); cam.lookAt(c); renderer.render(sc, cam); return renderer.domElement; }
function label(ctx, x, y, t) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y, ctx.measureText(t).width + 10, 20); ctx.fillStyle = '#fff'; ctx.fillText(t, x + 5, y + 15); }
try {
  const keys = (qs.get('keys') ?? 'walrus').split(','), dirs = qs.get('old') ? [['옛', qs.get('olddir') ?? '/design/aqua3d-review/polar/old-1125'], ['새', '/public/aqua/models/fish']] : [['새', '/public/aqua/models/fish']];
  const cv = document.createElement('canvas'); cv.width = 5 * CELL; cv.height = keys.length * dirs.length * 2 * CELL; const ctx = cv.getContext('2d'); ctx.font = '13px system-ui';
  let r = 0;
  for (const key of keys) for (const [tag, dir] of dirs) {
    const m = await load(`${dir}/${key}.glb`), sc = scene(); sc.add(m); const b = box(m), c = b.getCenter(new T.Vector3()), hc = new T.Vector3(b.max.x - .34, c.y, 0);
    BODY.forEach(([v, d, h], i) => { ctx.drawImage(shot(sc, c, d, h), i * CELL, r * CELL); label(ctx, i * CELL + 4, r * CELL + 4, `${key} ${tag} · ${v}`); }); r++;
    HEAD.forEach(([v, d, h], i) => { ctx.drawImage(shot(sc, hc, d, h), i * CELL, r * CELL); label(ctx, i * CELL + 4, r * CELL + 4, v); }); r++;
  }
  out.append(cv);
  if (qs.get('save')) { const blob = await new Promise((res) => cv.toBlob(res, 'image/webp', .9)); await fetch('/save/' + (qs.get('name') ?? 'review') + '.webp', {method: 'PUT', body: blob}); }
  status.textContent = 'done';
} catch (e) { status.textContent = 'FAIL ' + (e.stack ?? e); }
