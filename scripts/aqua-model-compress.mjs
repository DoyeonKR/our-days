/** 수조 GLB 를 배포용(meshopt · 양자화 · 512px WebP)으로 한 번에 바꾼다 — 제자리 덮어쓰기, 여러 번 돌려도 같다.
 *
 *   node scripts/aqua-model-compress.mjs [key…] [--validator <gltf-validator 가 설치된 폴더>]
 *
 * 왜 따로 있나: 새로 만드는 모델은 build-stage1.mjs 가 처음부터 압축해서 쓴다. 이건 이미 커밋된 압축 안 한 GLB 를
 * 다시 빌드하지 않고 바꾸는 길이다(다시 빌드하면 형상이 같아도 그림 · 승인 기록과 엮인 해시가 다 바뀐다).
 * 원본 해시는 models.json 의 compression.uncompressedSha256 에 남겨 native-render.json(옛 GLB 해시로 찍은 WebGL 사진)과 이어 준다.
 * 검증은 scripts/aqua-model-verify.mjs(three GLTFLoader 로 원본과 정점 하나하나를 맞대어 본다).
 */
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {compressGLB, parseGLB, isCompressed, readView, COMPRESSION} from '../design/aqua3d-review/glb-compress.mjs';
import sharp from 'sharp';

const args = process.argv.slice(2), vi = args.indexOf('--validator');
const validatorDir = vi >= 0 ? args[vi + 1] : path.join(tmpdir(), 'our-days-glb-validator');
const keys = new Set(args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--validator'));
let validator = null;
try { validator = createRequire(path.join(validatorDir, 'package.json'))('gltf-validator'); } catch { console.warn(`gltf-validator 없음(${validatorDir}) — models.json 의 validation 은 그대로 둔다`); }

const REPORT = 'design/aqua3d-review/models.json', report = JSON.parse(await readFile(REPORT, 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const totals = {};
for (const kind of ['fish', 'decor']) {
  const t = totals[kind] = {files: 0, before: 0, after: 0, beforeGz: 0, afterGz: 0};
  for (const f of (await readdir(`public/aqua/models/${kind}`)).filter((f) => f.endsWith('.glb')).sort()) {
    const key = f.slice(0, -4), file = `public/aqua/models/${kind}/${f}`;
    if (keys.size && !keys.has(key)) continue;
    const before = await readFile(file), after = await compressGLB(before);
    if (after !== before) await writeFile(file, after);
    t.files++; t.before += before.length; t.after += after.length; t.beforeGz += gzipSync(before, {level: 9}).length; t.afterGz += gzipSync(after, {level: 9}).length;
    const m = report.models[key];
    if (!m) throw new Error(`models.json 에 ${key} 가 없다`);
    const {json, bin} = parseGLB(after), image = await sharp(await readView(json, bin, json.images[0].bufferView)).metadata();
    if (after !== before) m.compression = {format: 'EXT_meshopt_compression + KHR_mesh_quantization + EXT_texture_webp', tool: 'design/aqua3d-review/glb-compress.mjs', settings: COMPRESSION, uncompressedBytes: before.length, uncompressedSha256: sha(before)};
    m.bytes = after.length; m.sha256 = sha(after); m.textureSize = [image.width, image.height];
    if (validator && after !== before) {
      const v = await validator.validateBytes(new Uint8Array(after), {uri: file, maxIssues: 1000});
      m.validation = {validator: `Khronos glTF-Validator ${validator.version()}`, errors: v.issues.numErrors, warnings: v.issues.numWarnings, messages: v.issues.messages};
      if (v.issues.numErrors) throw new Error(`${key}: ${JSON.stringify(v.issues.messages.filter((x) => x.severity === 0).slice(0, 5))}`);
    }
    if (!isCompressed(json)) throw new Error(`${key}: 압축되지 않았다`);
  }
}
await writeFile(REPORT, JSON.stringify(report, null, 2) + '\n');
const kb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;
for (const [kind, t] of Object.entries(totals)) console.log(`${kind}: ${t.files}개 ${kb(t.before)} → ${kb(t.after)} (gzip ${kb(t.beforeGz)} → ${kb(t.afterGz)})`);
