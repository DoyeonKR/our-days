/** 압축한 수조 GLB 가 원본과 같은 모델인지 — 게임과 같은 길(three GLTFLoader + MeshoptDecoder)로 둘 다 열어 맞대어 본다.
 *
 *   node scripts/aqua-model-verify.mjs [--ref <git ref>] [--validator <폴더>] [--json <결과 파일>] [key…]
 *
 * 원본은 git 의 <ref>(기본 HEAD) 에서 꺼낸다 — 압축 커밋 뒤에 돌릴 땐 --ref HEAD~1 처럼 압축 전 커밋을 준다.
 * 보는 것(모델마다, 하나라도 넘으면 실패):
 *  - 노드 이름 · 계층 · 메시 · 뼈 순서 · 재질(투명 · 발광 · 양면 · 거칠기)이 같다, 정점 수 · 삼각형 순서(index)가 같다
 *  - 뼈 번호(JOINTS)는 정확히 같다, 가중치는 1/10000 안쪽, 정점마다 합 1
 *  - 쉬는 자세와 일부러 꺾은 자세(뼈마다 다른 각도) 둘 다에서 뼈로 휜 월드 위치가 원본과 같다(모델 크기의 1/1000 안쪽)
 *    — IBM 에 접어 넣은 양자화 배율 · 뼈 번호 · 가중치가 맞아야만 통과한다
 *  - 법선 각도 오차(2° 안쪽) · UV 오차(1/2048 안쪽) · 수조가 크기를 재는 Box3.setFromObject 가 같다
 *  - 텍스처: 512 이하 WebP, 원본 그림을 같은 크기로 줄인 것과 PSNR 30dB 이상
 *  - (--validator 가 있으면) Khronos glTF-Validator 오류 0 — 압축본, 그리고 압축을 푼 데이터(검사기가 meshopt 를 못 풀어서)
 */
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {execFileSync} from 'node:child_process';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import {parseGLB, readView, isCompressed, expandGLB} from '../design/aqua3d-review/glb-compress.mjs';

const args = process.argv.slice(2), opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
const ref = opt('--ref', 'HEAD'), validatorDir = opt('--validator'), jsonOut = opt('--json');
const keys = new Set(args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')));
const validator = validatorDir ? createRequire(path.join(validatorDir, 'package.json'))('gltf-validator') : null;

/** 텍스처는 node 에서 못 그리니(DOM 없음) 빈 텍스처로 — 이름이 EXT_texture_webp 라 내장 WebP 처리기를 갈아 끼우고, 원본(JPEG/PNG)도 여기서 받는다 */
class StubTexture { constructor() { this.name = 'EXT_texture_webp'; } loadTexture() { return Promise.resolve(new T.Texture()); } }
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => new StubTexture());
const load = (buf) => new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));

const meshesOf = (root) => { const m = []; root.traverse((o) => { if (o.isMesh) m.push(o); }); return m; };
const names = (root) => { const n = []; root.traverse((o) => n.push(`${o.type}:${o.name}:${o.parent?.name ?? ''}`)); return n.join('|'); };
const pose = (root) => root.traverse((o) => { if (o.isBone) { const h = [...o.name].reduce((s, c) => s + c.charCodeAt(0), 0); o.rotation.set(Math.sin(h) * 0.35, Math.cos(h * 1.3) * 0.45, Math.sin(h * 0.7) * 0.3); } });
const worldPositions = (mesh) => {
  const p = mesh.geometry.attributes.position, out = new Float64Array(p.count * 3), v = new T.Vector3();
  for (let i = 0; i < p.count; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
  return out;
};
const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
const material = (m) => JSON.stringify({t: m.transparent, o: +m.opacity.toFixed(4), e: m.emissive?.getHexString(), em: !!m.emissiveMap, map: !!m.map, side: m.side, r: m.roughness, mt: m.metalness, c: m.color.getHexString()});

async function psnr(origGlb, newGlb) {
  const a = parseGLB(origGlb), b = parseGLB(newGlb);
  const src = await readView(a.json, a.bin, a.json.images[0].bufferView), dst = await readView(b.json, b.bin, b.json.images[0].bufferView);
  const meta = await sharp(dst).metadata();
  const x = await sharp(src).resize(meta.width, meta.height, {kernel: 'lanczos3'}).removeAlpha().raw().toBuffer();
  const y = await sharp(dst).removeAlpha().raw().toBuffer();
  let se = 0; for (let i = 0; i < x.length; i++) se += (x[i] - y[i]) ** 2;
  return {db: 10 * Math.log10(255 ** 2 / (se / x.length || 1e-9)), width: meta.width, height: meta.height, format: meta.format};
}

async function verify(kind, key) {
  const file = `public/aqua/models/${kind}/${key}.glb`, now = await readFile(file);
  const orig = execFileSync('git', ['show', `${ref}:${file}`], {maxBuffer: 1 << 26});
  const fail = [];
  if (isCompressed(parseGLB(orig).json)) throw new Error(`${ref} 의 ${key} 도 이미 압축본이다 — 압축 전 커밋을 --ref 로 준다`);
  if (!isCompressed(parseGLB(now).json)) fail.push('압축되지 않았다');
  const [A, B] = [await load(orig), await load(now)];
  for (const g of [A, B]) g.scene.updateMatrixWorld(true);
  if (names(A.scene) !== names(B.scene)) fail.push('노드 이름 · 계층이 다르다');
  const ma = meshesOf(A.scene), mb = meshesOf(B.scene);
  const box = new T.Box3().setFromObject(A.scene), size = box.getSize(new T.Vector3()).length();
  const r = {key, kind, vertices: 0, triangles: 0, rest: 0, posed: 0, normalDeg: 0, uv: 0, weight: 0, box: 0, size};
  r.box = Math.max(maxDiff(box.min.toArray(), new T.Box3().setFromObject(B.scene).min.toArray()), maxDiff(box.max.toArray(), new T.Box3().setFromObject(B.scene).max.toArray()));
  if (ma.length !== mb.length) fail.push('메시 수가 다르다');
  for (let k = 0; k < Math.min(ma.length, mb.length); k++) {
    const a = ma[k], b = mb[k], ga = a.geometry, gb = b.geometry;
    if (a.isSkinnedMesh !== b.isSkinnedMesh) fail.push(`${a.name}: 뼈 메시 여부가 다르다`);
    if (material(a.material) !== material(b.material)) fail.push(`${a.name}: 재질이 다르다 ${material(a.material)} / ${material(b.material)}`);
    if (ga.attributes.position.count !== gb.attributes.position.count) { fail.push(`${a.name}: 정점 수가 다르다`); continue; }
    const n = ga.attributes.position.count; r.vertices += n; r.triangles += ga.index.count / 3;
    // meshopt 의 TRIANGLES 부호화는 삼각형 안의 꼭짓점을 돌려 담는다(a,b,c → b,c,a — 감는 방향은 그대로). 돌림만 같게 맞춰 비교한다
    const tri = (ix, t) => { const x = [ix[t], ix[t + 1], ix[t + 2]], m = x.indexOf(Math.min(...x)); return `${x[m]},${x[(m + 1) % 3]},${x[(m + 2) % 3]}`; };
    if (ga.index.count !== gb.index.count) fail.push(`${a.name}: 삼각형 수가 다르다`);
    else for (let t = 0; t < ga.index.count; t += 3) if (tri(ga.index.array, t) !== tri(gb.index.array, t)) { fail.push(`${a.name}: 삼각형 ${t / 3} 이 다르다`); break; }
    if (Object.keys(ga.attributes).sort().join() !== Object.keys(gb.attributes).sort().join()) fail.push(`${a.name}: 속성 목록이 다르다`);
    const v = new T.Vector3(), w = new T.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(ga.attributes.normal, i).normalize(); w.fromBufferAttribute(gb.attributes.normal, i).normalize();
      r.normalDeg = Math.max(r.normalDeg, Math.acos(Math.min(1, v.dot(w))) * 180 / Math.PI);
      r.uv = Math.max(r.uv, Math.abs(ga.attributes.uv.getX(i) - gb.attributes.uv.getX(i)), Math.abs(ga.attributes.uv.getY(i) - gb.attributes.uv.getY(i)));
    }
    if (a.isSkinnedMesh) {
      const ja = ga.attributes.skinIndex, jb = gb.attributes.skinIndex, wa = ga.attributes.skinWeight, wb = gb.attributes.skinWeight, bones = b.skeleton.bones.length;
      if (a.skeleton.bones.map((x) => x.name).join() !== b.skeleton.bones.map((x) => x.name).join()) fail.push(`${a.name}: 뼈 순서가 다르다`);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (const c of ['X', 'Y', 'Z', 'W']) {
          const jaV = ja[`get${c}`](i), jbV = jb[`get${c}`](i), waV = wa[`get${c}`](i), wbV = wb[`get${c}`](i);
          if ((waV > 0 || wbV > 0) && jaV !== jbV) fail.push(`${a.name}: 정점 ${i} 뼈 번호가 다르다`);
          if (jbV >= bones) fail.push(`${a.name}: 정점 ${i} 뼈 번호 ${jbV} 가 뼈 수 밖`);
          r.weight = Math.max(r.weight, Math.abs(waV - wbV)); sum += wbV;
        }
        if (Math.abs(sum - 1) > 1e-6) fail.push(`${a.name}: 정점 ${i} 가중치 합 ${sum}`);
      }
    }
    r.rest = Math.max(r.rest, maxDiff(worldPositions(a), worldPositions(b)));
  }
  for (const g of [A, B]) { pose(g.scene); g.scene.updateMatrixWorld(true); }
  for (let k = 0; k < Math.min(ma.length, mb.length); k++) if (ma[k].geometry.attributes.position.count === mb[k].geometry.attributes.position.count) r.posed = Math.max(r.posed, maxDiff(worldPositions(ma[k]), worldPositions(mb[k])));
  const tex = await psnr(orig, now); r.psnr = tex.db; r.texture = `${tex.format} ${tex.width}x${tex.height}`;
  r.bytes = [orig.length, now.length];
  // 허용 오차 — 양자화(위치 14비트 · 법선 8비트 octahedral · UV 12비트 · 가중치 16비트)에서 나오는 값의 몇 배 여유
  if (r.rest > size * 1e-3) fail.push(`쉬는 자세 위치 오차 ${r.rest}`);
  if (r.posed > size * 1e-3) fail.push(`꺾은 자세 위치 오차 ${r.posed}`);
  if (r.normalDeg > 2) fail.push(`법선 오차 ${r.normalDeg}°`);
  if (r.uv > 1 / 2048) fail.push(`UV 오차 ${r.uv}`);
  if (r.weight > 1e-4) fail.push(`가중치 오차 ${r.weight}`);
  if (r.box > size * 1e-3) fail.push(`경계 상자 오차 ${r.box}`);
  if (tex.format !== 'webp' || tex.width > 512 || tex.height > 512) fail.push(`텍스처 ${r.texture}`);
  if (tex.db < 30) fail.push(`텍스처 PSNR ${tex.db.toFixed(1)}dB`);
  if (validator) {
    const v1 = await validator.validateBytes(new Uint8Array(now), {maxIssues: 100});
    const v2 = await validator.validateBytes(new Uint8Array(await expandGLB(now)), {maxIssues: 100});
    // 푼 파일은 WebP 를 core source 로 담아(검수 도구용) 그 한 가지 오류는 따로 친다
    const e2 = v2.issues.messages.filter((m) => m.severity === 0 && !/image\/webp|IMAGE_MIME|MIME_TYPE/i.test(m.code + m.message));
    r.validation = [v1.issues.numErrors, e2.length];
    if (v1.issues.numErrors) fail.push(`검사기 오류(압축본) ${JSON.stringify(v1.issues.messages.filter((m) => m.severity === 0).slice(0, 3))}`);
    if (e2.length) fail.push(`검사기 오류(푼 데이터) ${JSON.stringify(e2.slice(0, 3))}`);
  }
  r.fail = [...new Set(fail)];
  return r;
}

const rows = [];
for (const kind of ['fish', 'decor']) for (const f of (await readdir(`public/aqua/models/${kind}`)).filter((f) => f.endsWith('.glb')).sort()) {
  const key = f.slice(0, -4); if (keys.size && !keys.has(key)) continue;
  const r = await verify(kind, key); rows.push(r);
  if (r.fail.length) console.log(`FAIL ${kind}/${key}: ${r.fail.slice(0, 4).join(' · ')}`);
}
const worst = (k) => rows.reduce((m, r) => Math.max(m, r[k] / (k === 'rest' || k === 'posed' || k === 'box' ? r.size : 1)), 0);
const failed = rows.filter((r) => r.fail.length);
console.log(`${rows.length}개 검사 · 실패 ${failed.length}`);
console.log(`최대 오차 — 쉬는 자세 ${worst('rest').toExponential(2)} · 꺾은 자세 ${worst('posed').toExponential(2)} · 경계 상자 ${worst('box').toExponential(2)} (모델 크기 대비), 법선 ${worst('normalDeg').toFixed(2)}° · UV ${worst('uv').toExponential(2)} · 가중치 ${worst('weight').toFixed(4)}`);
console.log(`텍스처 PSNR 최저 ${Math.min(...rows.map((r) => r.psnr)).toFixed(1)}dB · 평균 ${(rows.reduce((s, r) => s + r.psnr, 0) / rows.length).toFixed(1)}dB`);
if (jsonOut) await writeFile(jsonOut, JSON.stringify(rows, null, 1) + '\n');
if (failed.length) process.exit(1);
