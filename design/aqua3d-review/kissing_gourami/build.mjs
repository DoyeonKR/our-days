// 키싱구라미(Helostoma temminckii, 분홍 품종) 3D GLB 빌더 (2026-11-27)
// volume-fish.mjs(HEAD_CONTOUR_FAMILIES + kissing_lips) + 연속 방사 아틀라스 + glb-compress.mjs
// node design/aqua3d-review/kissing_gourami/build.mjs
import * as T from 'three';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { volumeFish, bodyProfile } from '../volume-fish.mjs';
import { compressGLB, COMPRESSION } from '../glb-compress.mjs';

const ROOT = resolve(process.cwd());
const TEX = COMPRESSION.textureSize; // 512
const BONE_NAMES = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const PROFILE = { key: 'kissing_gourami', body: 'compressed', widthRatio: 0.18 };

async function buildReference(key) {
  const original = await readFile(resolve(ROOT, `public/aqua/fish/${key}.webp`));
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const skin = new Uint8Array(data), seen = new Uint8Array(n), q = new Int32Array(n);
  let head = 0, tail = 0, left = info.width, right = 0, top = info.height, bottom = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] > 96) {
      q[tail++] = i; seen[i] = 1;
      const x = i % info.width, y = Math.floor(i / info.width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  while (head < tail) {
    const i = q[head++], x = i % info.width;
    for (const k of [x ? i - 1 : -1, x < info.width - 1 ? i + 1 : -1, i - info.width, i + info.width]) {
      if (k >= 0 && k < n && !seen[k]) {
        seen[k] = 1; q[tail++] = k;
        for (let c = 0; c < 3; c++) skin[k * 4 + c] = skin[i * 4 + c];
      }
    }
  }
  for (let i = 0; i < n; i++) skin[i * 4 + 3] = 255;

  const paint = await sharp(skin, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(TEX, TEX, { kernel: 'lanczos3' }).raw().toBuffer();
  const body = bodyProfile('kissing_gourami', { data, info, bounds: [left, top, right, bottom] }, PROFILE);
  const { raw, W, H, sample } = body;
  const side = Buffer.from(paint);
  const small = await sharp(side, { raw: { width: TEX, height: TEX, channels: 4 } }).resize(TEX, TEX / 2).raw().toBuffer();
  small.copy(paint, TEX * (TEX / 2) * 4);

  const colour = (u, v) => {
    const x = Math.max(0, Math.min(info.width - 1, Math.round(left + u * W)));
    const y = Math.max(0, Math.min(info.height - 1, Math.round(top + v * H)));
    return skin.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 3);
  };
  for (let y = 0; y < 256; y++) for (let x = 0; x < TEX; x++) {
    const u = x / (TEX - 1), s = clamp((u - raw.s0) / (raw.s1 - raw.s0 || 1)), qs = sample(s), theta = (y / 255) * Math.PI;
    const sn = Math.sin(theta), f = clamp((sn - 0.38) / 0.40), blend = f * f * (3 - 2 * f), dorsal = theta < Math.PI / 2;
    const donor = sample(clamp(s + (1 - sn) * 0.035 * Math.sin(theta * 5), 0.20, 0.78));
    const samples = [];
    for (const du of [-0.025, 0, 0.025]) for (const dv of [-0.04, 0, 0.04]) {
      samples.push([...colour(donor.u + du, donor.sourceCenter + (dorsal ? -1 : 1) * donor.half * 0.72 + dv)]);
    }
    samples.sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]);
    const cap = [0, 1, 2].map((c) => samples.slice(3, 7).reduce((acc, p) => acc + p[c], 0) / 4);
    const flank = colour(u, qs.sourceCenter - Math.cos(theta) * qs.half);
    for (let c = 0; c < 3; c++) paint[(y * TEX + x) * 4 + c] = Math.round(cap[c] * (1 - blend) + flank[c] * blend);
  }
  const png = await sharp(paint, { raw: { width: TEX, height: TEX, channels: 4 } }).removeAlpha().png({ compressionLevel: 6 }).toBuffer();
  return { data, info, bounds: [left, top, right, bottom], png };
}

function silhouetteLoops(ref) {
  const { data, info, bounds: [l, t, r, b] } = ref, segments = [], links = new Map(), step = 2;
  const value = (x, y) => (x < 0 || y < 0 || x >= info.width || y >= info.height ? 0 : data[(y * info.width + x) * 4 + 3]);
  const table = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]] };
  const pointKey = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  for (let y = Math.max(0, t - 4); y <= b + 2; y += step) for (let x = Math.max(0, l - 4); x <= r + 2; x += step) {
    const pts = [[x, y], [x + step, y], [x + step, y + step], [x, y + step]], values = pts.map((p) => value(...p));
    const mask = values.reduce((m, v, i) => m + (v > 48 ? 1 << i : 0), 0);
    if (!table[mask]) continue;
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
    const at = (e) => { const [a, bb] = edges[e], q = clamp((48 - values[a]) / (values[bb] - values[a] || 1)); return [pts[a][0] + q * (pts[bb][0] - pts[a][0]), pts[a][1] + q * (pts[bb][1] - pts[a][1])]; };
    for (const [a, bb] of table[mask]) {
      const s = [at(a), at(bb)], id = segments.length; segments.push(s);
      for (const p of s) { const k = pointKey(p); if (!links.has(k)) links.set(k, []); links.get(k).push(id); }
    }
  }
  const used = new Set(), loops = [];
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    const loop = [segments[i][0]], start = pointKey(loop[0]);
    let end = segments[i][1]; used.add(i);
    for (let guard = 0; guard < segments.length; guard++) {
      loop.push(end); const k = pointKey(end); if (k === start) break;
      const next = links.get(k)?.find((n) => !used.has(n)); if (next === undefined) break;
      used.add(next); const s = segments[next]; end = pointKey(s[0]) === k ? s[1] : s[0];
    }
    if (loop.length > 5 && pointKey(loop.at(-1)) === start) { loop.pop(); loops.push(loop); }
  }
  const area = (p) => p.reduce((sum, a, i) => { const bb = p[(i + 1) % p.length]; return sum + a[0] * bb[1] - a[1] * bb[0]; }, 0) / 2;
  const simplify = (pts, eps) => {
    if (pts.length < 3) return pts;
    const a = pts[0], bb = pts.at(-1); let max = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], u = clamp(((p[0] - a[0]) * (bb[0] - a[0]) + (p[1] - a[1]) * (bb[1] - a[1])) / ((bb[0] - a[0]) ** 2 + (bb[1] - a[1]) ** 2 || 1));
      const d = Math.hypot(p[0] - a[0] - u * (bb[0] - a[0]), p[1] - a[1] - u * (bb[1] - a[1]));
      if (d > max) { max = d; idx = i; }
    }
    if (max <= eps) return [a, bb];
    return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
  };
  const keep = loops.filter((p) => Math.abs(area(p)) > 5).sort((a, bb) => Math.abs(area(bb)) - Math.abs(area(a)));
  let simplified, eps = 0.65;
  do {
    simplified = keep.map((loop) => {
      const half = Math.floor(loop.length / 2);
      return [...simplify(loop.slice(0, half + 1), eps).slice(0, -1), ...simplify([...loop.slice(half), loop[0]], eps).slice(0, -1)];
    }).filter((l) => l.length >= 3);
    eps += 0.25;
  } while (simplified.reduce((n, l) => n + l.length, 0) > 280 && eps < 4);
  return simplified.map((loop) => loop.map(([x, y]) => [(x - l) / (r - l || 1), (y - t) / (b - t || 1)]));
}

function makeSkeleton(center = [0, 0, 0]) {
  const bones = BONE_NAMES.map((name) => { const b = new T.Bone(); b.name = name; return b; });
  for (let i = 0; i < 6; i++) { bones[i].position.x = i ? -0.34 : 0.85; if (i) bones[i - 1].add(bones[i]); }
  for (const [root, tip, s] of [[6, 7, 1], [8, 9, -1]]) {
    bones[1].add(bones[root]); bones[root].position.set(-0.10, -0.04, s * 0.12);
    bones[root].add(bones[tip]); bones[tip].position.set(-0.12, -0.05, s * 0.22);
  }
  bones[0].position.sub(new T.Vector3(...center));
  bones[0].updateMatrixWorld(true);
  return bones;
}

function packRawGLB(key, g, png, bones) {
  const j = {
    asset: { version: '2.0', generator: 'Our Days kissing_gourami volume-fish / stage 1' },
    scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
    materials: [{ name: 'painted_PBR_atlas', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.56 }, doubleSided: true }],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }],
  };
  const chunks = []; let length = 0;
  const view = (bytes, target) => {
    const buf = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length);
    const i = j.bufferViews.length;
    j.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: buf.length, ...(target ? { target } : {}) });
    chunks.push(buf);
    const pad = (4 - (buf.length % 4)) % 4; if (pad) chunks.push(Buffer.alloc(pad));
    length += buf.length + pad; return i;
  };
  const acc = (array, type, componentType, target) => {
    const i = j.accessors.length, n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const a = { bufferView: view(array, target), componentType, count: array.length / n, type };
    if (type === 'VEC3') {
      a.min = [Infinity, Infinity, Infinity]; a.max = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < array.length; k++) { a.min[k % 3] = Math.min(a.min[k % 3], array[k]); a.max[k % 3] = Math.max(a.max[k % 3], array[k]); }
    }
    j.accessors.push(a); return i;
  };
  j.images.push({ name: `${key}_basecolor`, bufferView: view(png), mimeType: 'image/png' });
  const attrs = {
    POSITION: acc(new Float32Array(g.attributes.position.array), 'VEC3', 5126, 34962),
    NORMAL: acc(new Float32Array(g.attributes.normal.array), 'VEC3', 5126, 34962),
    TEXCOORD_0: acc(new Float32Array(g.attributes.uv.array), 'VEC2', 5126, 34962),
    JOINTS_0: acc(new Uint16Array(g.attributes.skinIndex.array), 'VEC4', 5123, 34962),
    WEIGHTS_0: acc(new Float32Array(g.attributes.skinWeight.array), 'VEC4', 5126, 34962),
  };
  j.meshes.push({ name: key, primitives: [{ attributes: attrs, indices: acc(new Uint16Array(g.index.array), 'SCALAR', 5123, 34963), material: 0, mode: 4 }] });
  j.nodes.push({ name: key, mesh: 0, translation: [0, 0, 0], extras: { aquaGeometry: 'closed-volume-v3' }, skin: 0 });
  j.scenes[0].nodes.push(0);

  const offset = j.nodes.length;
  for (const b of bones) {
    const children = b.children.map((c) => offset + bones.indexOf(c));
    j.nodes.push({ name: b.name, translation: b.position.toArray(), ...(children.length ? { children } : {}) });
  }
  j.scenes[0].nodes.push(offset);
  const inverses = new Float32Array(16 * bones.length);
  bones.forEach((b, i) => new T.Matrix4().copy(b.matrixWorld).invert().toArray(inverses, i * 16));
  j.skins = [{ name: 'aquarium_standard_10', joints: bones.map((_, i) => offset + i), skeleton: offset, inverseBindMatrices: acc(inverses, 'MAT4', 5126) }];

  j.buffers[0].byteLength = length;
  const bin = Buffer.concat(chunks), json0 = Buffer.from(JSON.stringify(j)), json = Buffer.concat([json0, Buffer.alloc((4 - (json0.length % 4)) % 4, 32)]);
  const out = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(json.length, 12); out.writeUInt32LE(0x4e4f534a, 16); json.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(out, 28 + json.length);
  return out;
}

await mkdir(resolve(ROOT, 'public/aqua/models/fish'), { recursive: true });
for (const key of ['fry_kissing_gourami', 'juv_kissing_gourami', 'kissing_gourami']) {
  const ref = await buildReference(key);
  ref.loops = silhouetteLoops(ref);
  let g = volumeFish('kissing_gourami', key, ref, PROFILE);
  if (g.index.count / 3 > 3000) {
    ref.loops = ref.loops.map((loop) => (loop.length > 8 ? loop.filter((_, i) => i % 2 === 0) : loop));
    g = volumeFish('kissing_gourami', key, ref, PROFILE);
  }
  const bones = makeSkeleton(g.userData.bodyCenter);
  const bytes = await compressGLB(packRawGLB(key, g, ref.png, bones), { webpQuality: 88 });
  if (bytes.length > 300000) throw new Error(`Size budget ${key}: ${bytes.length}`);
  await writeFile(resolve(ROOT, `public/aqua/models/fish/${key}.glb`), bytes);
  console.log(`${key}: ${g.index.count / 3} tris, ${bytes.length} bytes`);
}
