// 범고래 게임 모델 변환(2026-11-14) [사용자: "범고래 모델 새로 들어갔고 … 커플 수조에 넣어줘 확인해보게"]
// 입력: orca-color/orca-colored.glb — 사용자가 Tripo(AI 3D 생성)로 만든 메시(삼각형 13.5만 · 뼈 없음)에 그림 세션이 정점 색으로 칠한 것.
// 출력: public/aqua/models/fish/orca.glb — 수조 계약(design/aqua3d-review/README.md): +X 머리 · +Y 위 · 몸 가운데 원점 · 길이 2,
//       재질 하나 · 512px 텍스처 하나 · 뼈 10개(spine_0..5 · fin_L/R(+tip) = 앞지느러미) · 삼각형 3,000 이하 · meshopt 압축.
// 순서: ① 고해상도 정점 색을 옆에서 본 텍스처로 굽는다(줄이기 전에 — 눈 무늬가 뭉개지지 않게) ② meshoptimizer 로 줄인다
//       ③ 길이 2 로 맞추고 x 위치로 몸통 뼈 · 지느러미 위치로 앞지느러미 뼈 가중치 ④ glb-compress 로 배포 형식.
// 앞지느러미는 옆에서 굽는 텍스처의 배 쪽(흰 면)을 가리므로 몸통 굽기에서 빼고, 지느러미 정점은 텍스처의 검은 칸을 가리킨다.
// 실행: node design/aqua3d-review/orca-build.mjs   (Node 22+, 레포 뿌리에서)
import * as T from 'three';
import sharp from 'sharp';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier} from 'meshoptimizer';
import {compressGLB, COMPRESSION} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';

const DIR = 'design/aqua3d-review', SRC = `${DIR}/orca-color/orca-colored.glb`, OUT = 'public/aqua/models/fish/orca.glb';
const TEX = 512, TARGET_TRIS = 2900;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (lo, hi, x) => { const t = clamp((x - lo) / (hi - lo)); return t * t * (3 - 2 * t); };

// ── 원본 읽기 ──
const src = await readFile(SRC);
const jl = src.readUInt32LE(12), j = JSON.parse(src.toString('utf8', 20, 20 + jl));
const bin = src.subarray(28 + jl, 28 + jl + src.readUInt32LE(20 + jl));
function readAcc(i) {
  const a = j.accessors[i], v = j.bufferViews[a.bufferView];
  const C = {5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array}[a.componentType];
  const n = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4}[a.type], at = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new C(bin.buffer.slice(bin.byteOffset + at, bin.byteOffset + at + a.count * n * C.BYTES_PER_ELEMENT));
}
const prim = j.meshes[0].primitives[0];
const P = readAcc(prim.attributes.POSITION), COL = readAcc(prim.attributes.COLOR_0);
const IDX = Uint32Array.from(readAcc(prim.indices));
const nv = P.length / 3;

// 원본 좌표(길이 1, x -0.5..0.5)에서의 앞지느러미 · 꼬리 영역 — 그림 세션 paint.mjs 의 마스크와 같은 식
const flipperOf = (x, y, z) => smooth(.042, .073, Math.abs(z)) * (1 - smooth(.133, .153, y)) * smooth(.09, .13, x) * (1 - smooth(.31, .35, x));

let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[i * 3 + k]); max[k] = Math.max(max[k], P[i * 3 + k]); }
const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
const S = 2 / (max[0] - min[0]); // 길이 2
const H = (max[1] - min[1]) * S;  // 높이(길이 2 기준)
// 옆에서 본 투영: u = 머리 쪽이 오른쪽 · v = 위가 위(텍스처 윗줄). 몸통은 윗 82%, 맨 아래 띠는 지느러미용 검은 칸.
const BODY_V = .82;
const uvOf = (x, y) => [.02 + .96 * (x + 1) / 2, .02 + (BODY_V - .04) * (1 - (y + H / 2) / H)];
const FIN_UV = [.5, .93];

// ── ① 텍스처 굽기(+z 쪽에서 본 몸통 · 지느러미 제외, z 버퍼) ──
const toSRGB = (c) => { c = clamp(c); return c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055; };
const img = new Float32Array(TEX * TEX * 3), zb = new Float32Array(TEX * TEX).fill(-Infinity), have = new Uint8Array(TEX * TEX);
const norm = (i) => [(P[i * 3] - center[0]) * S, (P[i * 3 + 1] - center[1]) * S, (P[i * 3 + 2] - center[2]) * S];
for (let t = 0; t < IDX.length; t += 3) {
  const ids = [IDX[t], IDX[t + 1], IDX[t + 2]];
  const cx = (P[ids[0] * 3] + P[ids[1] * 3] + P[ids[2] * 3]) / 3, cy = (P[ids[0] * 3 + 1] + P[ids[1] * 3 + 1] + P[ids[2] * 3 + 1]) / 3, cz = (P[ids[0] * 3 + 2] + P[ids[1] * 3 + 2] + P[ids[2] * 3 + 2]) / 3;
  if (cz < 0 || flipperOf(cx, cy, cz) > .5) continue;
  const v = ids.map((i) => { const [x, y, z] = norm(i), [u, w] = uvOf(x, y); return {px: u * (TEX - 1), py: w * (TEX - 1), z, c: [COL[i * 3], COL[i * 3 + 1], COL[i * 3 + 2]]}; });
  const x0 = Math.max(0, Math.floor(Math.min(v[0].px, v[1].px, v[2].px))), x1 = Math.min(TEX - 1, Math.ceil(Math.max(v[0].px, v[1].px, v[2].px)));
  const y0 = Math.max(0, Math.floor(Math.min(v[0].py, v[1].py, v[2].py))), y1 = Math.min(TEX - 1, Math.ceil(Math.max(v[0].py, v[1].py, v[2].py)));
  const d = (v[1].py - v[2].py) * (v[0].px - v[2].px) + (v[2].px - v[1].px) * (v[0].py - v[2].py);
  if (Math.abs(d) < 1e-9) continue;
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const a = ((v[1].py - v[2].py) * (px - v[2].px) + (v[2].px - v[1].px) * (py - v[2].py)) / d;
    const b = ((v[2].py - v[0].py) * (px - v[2].px) + (v[0].px - v[2].px) * (py - v[2].py)) / d, c = 1 - a - b;
    if (a < -.02 || b < -.02 || c < -.02) continue;
    const z = a * v[0].z + b * v[1].z + c * v[2].z, k = py * TEX + px;
    if (z <= zb[k]) continue;
    zb[k] = z; have[k] = 1;
    for (let ch = 0; ch < 3; ch++) img[k * 3 + ch] = a * v[0].c[ch] + b * v[1].c[ch] + c * v[2].c[ch];
  }
}
// 빈 칸 메우기(가까운 칠한 칸으로 번진다) — 실루엣 가장자리에서 정점이 텍스처 밖을 집지 않게
for (let pass = 0; pass < 40; pass++) {
  const next = have.slice();
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const k = y * TEX + x; if (have[k]) continue;
    let n = 0, s = [0, 0, 0];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= TEX || yy >= TEX) continue; const q = yy * TEX + xx; if (!have[q]) continue; n++; for (let ch = 0; ch < 3; ch++) s[ch] += img[q * 3 + ch]; }
    if (n) { next[k] = 1; for (let ch = 0; ch < 3; ch++) img[k * 3 + ch] = s[ch] / n; }
  }
  have.set(next);
}
const rgb = Buffer.alloc(TEX * TEX * 3);
const black = [11, 16, 21];
for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
  const k = y * TEX + x;
  if (y >= Math.floor(BODY_V * TEX)) { rgb.set(black, k * 3); continue; } // 앞지느러미 칸
  for (let ch = 0; ch < 3; ch++) rgb[k * 3 + ch] = Math.round(toSRGB(have[k] ? img[k * 3 + ch] : .004) * 255);
}
const png = await sharp(rgb, {raw: {width: TEX, height: TEX, channels: 3}}).png().toBuffer();
await writeFile(`${DIR}/orca-color/orca-texture.png`, png);

// ── ② 줄이기 ──
await MeshoptSimplifier.ready;
const pos = new Float32Array(P.length);
for (let i = 0; i < nv; i++) { const [x, y, z] = norm(i); pos.set([x, y, z], i * 3); }
const attrs = new Float32Array(nv * 3); for (let i = 0; i < nv * 3; i++) attrs[i] = COL[i];
const [simp, err] = MeshoptSimplifier.simplifyWithAttributes(IDX, pos, 3, attrs, 3, [.6, .6, .6], null, TARGET_TRIS * 3, .02, ['Prune']);
const used = new Map(), outPos = [], outSrc = [];
const outIdx = new Uint32Array(simp.length);
for (let t = 0; t < simp.length; t++) {
  const i = simp[t];
  if (!used.has(i)) { used.set(i, outSrc.length); outSrc.push(i); outPos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
  outIdx[t] = used.get(i);
}
const nOut = outSrc.length;
if (nOut > 65535) throw new Error('too many vertices ' + nOut);

// ── ③ 뼈 · 가중치 · UV ──
const NAMES = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'];
const SPINE_X = [.85, .51, .17, -.17, -.51, -.85];
// 앞지느러미 뿌리 · 끝(길이 2 기준) — 원본 마스크 영역의 지느러미 정점에서 잰다
const fin = {root: new T.Vector3(), tip: new T.Vector3(), n: 0, far: -Infinity};
for (let i = 0; i < nv; i++) {
  if (P[i * 3 + 2] <= 0 || flipperOf(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) < .5) continue;
  const [x, y, z] = norm(i);
  if (z < .14 * S / 2 + .05) { fin.root.add(new T.Vector3(x, y, z)); fin.n++; }
  const reach = z * .6 - y; if (reach > fin.far) { fin.far = reach; fin.tip.set(x, y, z); }
}
if (!fin.n) throw new Error('no flipper root vertices');
fin.root.divideScalar(fin.n);
const bones = NAMES.map((name) => { const b = new T.Bone(); b.name = name; return b; });
for (let i = 0; i < 6; i++) { bones[i].position.x = i ? SPINE_X[i] - SPINE_X[i - 1] : SPINE_X[0]; if (i) bones[i - 1].add(bones[i]); }
for (const [root, tip, s] of [[6, 7, 1], [8, 9, -1]]) {
  bones[1].add(bones[root]);
  bones[root].position.set(fin.root.x - SPINE_X[1], fin.root.y, s * fin.root.z);
  bones[root].add(bones[tip]);
  bones[tip].position.set(fin.tip.x - fin.root.x, fin.tip.y - fin.root.y, s * (fin.tip.z - fin.root.z));
}
bones[0].updateMatrixWorld(true);
const joints = new Uint16Array(nOut * 4), weights = new Float32Array(nOut * 4), uv = new Float32Array(nOut * 2);
const finAxis = fin.tip.clone().sub(fin.root), finLen2 = finAxis.lengthSq();
for (let v = 0; v < nOut; v++) {
  const i = outSrc[v], x = outPos[v * 3], y = outPos[v * 3 + 1], z = outPos[v * 3 + 2];
  const isFin = flipperOf(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) > .5;
  if (isFin) {
    const t = clamp(new T.Vector3(x, y, Math.abs(z)).sub(fin.root).dot(finAxis) / finLen2);
    const base = z >= 0 ? 6 : 8;
    joints.set([base, base + 1, 1, 0], v * 4); weights.set([(1 - t) * .85, t * .85 + (t > 0 ? 0 : 0), .15, 0], v * 4);
    const s = weights[v * 4] + weights[v * 4 + 1] + weights[v * 4 + 2]; for (let k = 0; k < 3; k++) weights[v * 4 + k] /= s;
    uv.set(FIN_UV, v * 2);
  } else {
    let a = 0; while (a < 5 && x < SPINE_X[a + 1]) a++;
    if (x >= SPINE_X[0]) { joints.set([0, 0, 0, 0], v * 4); weights.set([1, 0, 0, 0], v * 4); }
    else if (a >= 5) { joints.set([5, 0, 0, 0], v * 4); weights.set([1, 0, 0, 0], v * 4); }
    else { const f = clamp((SPINE_X[a] - x) / (SPINE_X[a] - SPINE_X[a + 1])); joints.set([a, a + 1, 0, 0], v * 4); weights.set([1 - f, f, 0, 0], v * 4); }
    uv.set(uvOf(x, y), v * 2);
  }
}
const g = new T.BufferGeometry();
g.setAttribute('position', new T.Float32BufferAttribute(outPos, 3));
g.setIndex(new T.Uint16BufferAttribute(Uint16Array.from(outIdx), 1));
g.computeVertexNormals();
g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
g.setAttribute('skinIndex', new T.Uint16BufferAttribute(joints, 4));
g.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));

// ── ④ 포장 · 압축 ──
const raw = packAsset('orca', [{name: 'orca', geometry: g}], png, bones);
const bytes = await compressGLB(raw);
await writeFile(OUT, bytes);
const tris = outIdx.length / 3;
if (tris > 3000) throw new Error('triangle budget ' + tris);
if (bytes.length > 300000) throw new Error('size budget ' + bytes.length);
const image = await readFile('public/aqua/fish/orca.webp');
const report = JSON.parse(await readFile(`${DIR}/models.json`, 'utf8'));
report.models.orca = {
  kind: 'fish', family: 'orca', form: 'adult', file: OUT, triangles: tris, bytes: bytes.length, bones: NAMES, anatomyKind: 'mammal',
  textureSize: [TEX, TEX], materials: 1, skinMeshes: 1, animations: 0,
  compression: {format: 'EXT_meshopt_compression + KHR_mesh_quantization + EXT_texture_webp', tool: 'design/aqua3d-review/glb-compress.mjs', settings: COMPRESSION},
  sourceSHA256: createHash('sha256').update(image).digest('hex'), meshSource: 'Tripo (user-supplied) → orca-color/paint.mjs → orca-build.mjs',
  meshSourceSHA256: createHash('sha256').update(src).digest('hex'), simplifyError: err,
  approval: 'user_approved_2026-11-14', visualApproval: 'pending', activation: 'not enabled', limits: {triangles: 3000, bytes: 300000},
};
await writeFile(`${DIR}/models.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`orca: ${nv} → ${nOut} vertices, ${tris} triangles, ${bytes.length} bytes, simplify error ${err.toFixed(4)}; fin root ${fin.root.toArray().map((v) => v.toFixed(2))} tip ${fin.tip.toArray().map((v) => v.toFixed(2))}`);
