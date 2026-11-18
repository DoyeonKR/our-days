// 두족류 v3 검수 시트 — 옛 모델(ceph-v3/old)과 새 모델을 같은 배율 · 같은 빛으로 다섯 방향에서. motion 은 실제 게임 코드(glb.ts fishMotion + 팔 셰이더)로 자세를 잡고 그린다.
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const qs = new URLSearchParams(location.search), status = document.querySelector('#status'), out = document.querySelector('#out');
const newDir = qs.get('dir') ?? '/public/aqua/models/fish', oldDir = '/design/aqua3d-review/ceph-v3/old';
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), CELL = +(qs.get('cell') ?? 220);
const VIEWS = {side: [0, 0, 1], top: [0, 1, .001], front: [1, 0, 0], oblique: [1, .6, 1.3], tank: [.35, .42, 1]};
const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true}); renderer.setSize(CELL, CELL); renderer.toneMapping = T.NeutralToneMapping; renderer.outputColorSpace = T.SRGBColorSpace;
const errors = []; const origErr = console.error; console.error = (...a) => { errors.push(a.join(' ').slice(0, 300)); origErr(...a); };
function scene() { const s = new T.Scene(); s.background = new T.Color(0x8fa9b4); s.add(new T.HemisphereLight(0xe8f3ff, 0x666953, 1.6)); const d = new T.DirectionalLight(0xfff0dc, 2); d.position.set(2, 5, 4); s.add(d); const f = new T.DirectionalLight(0xa2d8e2, .7); f.position.set(-3, 2, -5); s.add(f); return s; }
async function load(url) { const bytes = await (await fetch(url, {cache: 'no-store'})).arrayBuffer(); return (await loader.parseAsync(bytes, '/')).scene; }
function shot(sc, center, dir, half = 1.2) {
  const cam = new T.OrthographicCamera(-half, half, half, -half, .01, 100); if (dir[1] > .9) cam.up.set(0, 0, -1);
  cam.position.copy(center).add(new T.Vector3(...dir).normalize().multiplyScalar(10)); cam.lookAt(center); renderer.render(sc, cam); return renderer.domElement;
}
function skinnedBox(root) { root.updateMatrixWorld(true); const b = new T.Box3(), v = new T.Vector3(); root.traverse((o) => { if (o.isSkinnedMesh) for (let i = 0; i < o.geometry.attributes.position.count; i++) b.expandByPoint(o.getVertexPosition(i, v)); }); return b; }
// Image.decode() 는 숨은 탭에서 멈출 때가 있어 비트맵으로 바로 푼다
async function img(src) { return createImageBitmap(await (await fetch(src, {cache: 'no-store'})).blob()); }
function label(ctx, x, y, t) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x, y, ctx.measureText(t).width + 10, 20); ctx.fillStyle = '#fff'; ctx.fillText(t, x + 5, y + 15); }
async function save(canvas, name) { const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', .9)); await fetch('/save/' + name, {method: 'PUT', body: blob}); }

async function sheet(keys, name) {
  const cols = 1 + Object.keys(VIEWS).length, cv = document.createElement('canvas'); cv.width = cols * CELL; cv.height = keys.length * 2 * CELL; const ctx = cv.getContext('2d'); ctx.font = '13px system-ui';
  let r = 0;
  for (const key of keys) {
    const ref = await img(`/public/aqua/fish/${key}.webp`);
    for (const [tag, dir] of [['옛', oldDir], ['새', newDir]]) {
      ctx.fillStyle = '#8fa9b4'; ctx.fillRect(0, r * CELL, CELL, CELL); ctx.drawImage(ref, 0, r * CELL, CELL, CELL);
      const m = await load(`${dir}/${key}.glb`), sc = scene(); sc.add(m); const box = skinnedBox(m), c = box.getCenter(new T.Vector3());
      Object.entries(VIEWS).forEach(([v, d], i) => { ctx.drawImage(shot(sc, c, d), (i + 1) * CELL, r * CELL); if (r === 0 || r === 1) label(ctx, (i + 1) * CELL + 4, r * CELL + 4, v); });
      label(ctx, 4, r * CELL + 4, `${key} · ${tag}`); r++;
    }
  }
  out.append(cv); if (qs.get('save')) await save(cv, name + '.webp');
}

async function motion(keys, name) {
  const {fishMotion} = await import('/src/lib/aqua3d/glb.ts');
  const {WATER_LIGHT} = await import('/src/lib/aqua3d/waterlight.ts');
  const poses = [['쉼 t=0', 0, {}], ['기어감 t=1.7', 1.7, {amp: 1}], ['기어감 t=3.1', 3.1, {amp: 1}], ['물 뿜기', 5.2, {rev: 1, jet: 1, amp: 1}], ['미끄러진 끝(펴기)', 6.4, {rev: 1, jet: 0, amp: .3}]];
  const views = [['비스듬히', [1, .6, 1.3]], ['위', [0, 1, .001]], ['수조', [.35, .42, 1]]];
  const cv = document.createElement('canvas'); cv.width = poses.length * CELL; cv.height = keys.length * views.length * CELL; const ctx = cv.getContext('2d'); ctx.font = '13px system-ui';
  let row = 0;
  for (const key of keys) {
    const family = key.replace(/^(fry|juv)_/, ''), m = await load(`${newDir}/${key}.glb`), sc = scene(); sc.add(m);
    const anim = fishMotion(m, family, key), c0 = skinnedBox(m).getCenter(new T.Vector3());
    for (const [vn, vd] of views) {
      poses.forEach(([pn, t, pose], i) => {
        // 박자는 물속 시계(aquaTime)로 — 프레임 사이 dt 를 위해 앞에서 몇 번 돌린다
        for (let k = 8; k >= 0; k--) { WATER_LIGHT.aquaTime.value = t - k / 30; anim(t - k / 30, 1, pose); }
        m.updateMatrixWorld(true); ctx.drawImage(shot(sc, c0, vd, 1.25), i * CELL, row * CELL);
        label(ctx, i * CELL + 4, row * CELL + 4, `${key} · ${vn} · ${pn}`);
      });
      row++;
    }
  }
  out.append(cv); if (qs.get('save')) await save(cv, name + '.webp');
}

try {
  if (qs.get('sheet')) await sheet(qs.get('sheet').split(','), qs.get('name') ?? 'review');
  if (qs.get('motion')) await motion(qs.get('motion').split(','), qs.get('name') ?? 'review-motion');
  status.textContent = 'done' + (errors.length ? '\nERRORS:\n' + errors.join('\n') : '');
} catch (e) { status.textContent = 'FAIL ' + (e.stack ?? e) + '\n' + errors.join('\n'); }
