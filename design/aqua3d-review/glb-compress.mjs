/** 수조 GLB 압축기 — packGLB 가 만든 "압축 안 한" GLB 를 받아 배포용 GLB 로 바꾼다.
 *
 * 왜: 물고기 219 · 장식 37 GLB 가 합쳐 42.9MB(gzip 23.2MB) 였다 → 압축 뒤 8.9MB(gzip 6.1MB). 물고기 텍스처는 512px 그림을 768px JPEG 로 늘려 담아(그림보다 세밀해지지 않는다)
 * 바이트의 절반을 먹었고, 형상은 float32(정점당 56B)라 나머지 절반이었다. 장식 37개는 똑같은 512px PNG 아틀라스를 하나씩 품었다.
 * 그래서
 *  - 형상: KHR_mesh_quantization(위치 int16 · 법선 int8 · UV uint16 · 뼈 번호 uint8 · 가중치 uint16) 후
 *          EXT_meshopt_compression 으로 bufferView 를 압축한다. three 의 GLTFLoader 는 setMeshoptDecoder 가 있어야 연다(glb.ts).
 *  - 텍스처: 512px WebP(EXT_texture_webp, 품질 82) — 그림 원본 해상도 그대로. GLB 안에 담는다(파일 하나로 완결, 경로 문제 없음).
 *
 * 정점 순서 · 삼각형 순서 · 노드 · 뼈 · 재질은 그대로 둔다(검증이 원본과 정점 하나하나를 맞대어 볼 수 있게).
 * 위치를 정수로 담으려면 배율 s 가 필요하다.
 *  - 뼈로 휘는 메시(물고기): glTF 규칙상 메시 노드의 변환은 무시되므로 s 를 역바인드 행렬(IBM)에 곱한다 — IBM' = IBM · S(s).
 *    three 도 같은 결과다(bindMatrix 는 단위행렬, 뼈 행렬 = 뼈 월드 · IBM').
 *  - 고정 메시(장식): 노드 scale 에 s 를 곱한다. 균등 배율이라 회전축(노드 원점)과 법선 방향이 안 바뀐다 — 풍차 날개 · 뚜껑이 그대로 돈다.
 *
 * 재현: meshoptimizer(@types/three 가 이미 끌어온 1.1.1) · sharp(프로젝트에 이미 있음)만 쓴다. 패키지 매니페스트는 건드리지 않는다.
 */
import {MeshoptEncoder, MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';

export const COMPRESSION = Object.freeze({
  textureSize: 512,      // 그림 원본(public/aqua/fish/*.webp)과 같은 해상도 — 이보다 키우면 바이트만 는다
  webpQuality: 82,
  positionBits: 14,      // 2 단위 길이 물고기에서 1.5e-4 — 화면에서 안 보이는 크기. 비트가 적을수록 meshopt 가 더 줄인다
  normalBits: 8,         // octahedral 필터 8비트 — 오차 1° 안쪽
  uvBits: 12,            // 512px 텍스처의 1/8 텍셀
});

const COMPONENTS = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16};
const ARRAYS = {5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
const MESHOPT = 'EXT_meshopt_compression', QUANT = 'KHR_mesh_quantization', WEBP = 'EXT_texture_webp';

export function parseGLB(glb) {
  if (glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2) throw new Error('GLB 2.0 이 아니다');
  const jsonLength = glb.readUInt32LE(12), json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
  const binLength = glb.length > 28 + jsonLength ? glb.readUInt32LE(20 + jsonLength) : 0;
  return {json, bin: glb.subarray(28 + jsonLength, 28 + jsonLength + binLength)};
}

export function isCompressed(json) {
  return (json.extensionsUsed ?? []).includes(MESHOPT);
}

/** 압축 안 한 GLB 의 accessor 를 typed array 로 꺼낸다(복사본) */
function readAccessor(json, bin, index) {
  const a = json.accessors[index], v = json.bufferViews[a.bufferView], C = ARRAYS[a.componentType], n = COMPONENTS[a.type];
  if (v.buffer !== 0 || v.byteStride) throw new Error('interleaved/외부 buffer 는 다루지 않는다');
  const start = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new C(bin.buffer.slice(start, start + a.count * n * C.BYTES_PER_ELEMENT));
}

function writeGLB(json, bin) {
  const j0 = Buffer.from(JSON.stringify(json)), jp = Buffer.concat([j0, Buffer.alloc((4 - j0.length % 4) % 4, 32)]);
  const bp = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]), out = Buffer.alloc(28 + jp.length + bp.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jp.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jp.copy(out, 20);
  out.writeUInt32LE(bp.length, 20 + jp.length); out.writeUInt32LE(0x004e4942, 24 + jp.length); bp.copy(out, 28 + jp.length);
  return out;
}

/** 가중치를 합이 정확히 65535 인 uint16 으로 — three 는 셰이더에서 합을 다시 맞추지 않아서, 합이 어긋나면 그 정점이 뼈 쪽으로 쪼그라든다.
 * uint8 은 오징어 · 대왕오징어의 긴 팔(뼈 사슬 끝)을 크게 꺾었을 때 모델 크기의 1.5/1000 까지 어긋나서(검증 실측) 16비트로 둔다 — 파일당 1~2KB 차이 */
function quantizeWeights(w) {
  const out = new Uint16Array(w.length);
  for (let i = 0; i < w.length; i += 4) {
    const sum = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1;
    let total = 0, big = i;
    for (let k = 0; k < 4; k++) {
      out[i + k] = Math.round(w[i + k] / sum * 65535); total += out[i + k];
      if (w[i + k] > w[big]) big = i + k;
    }
    out[big] += 65535 - total;
  }
  return out;
}

/** 압축 안 한 GLB → meshopt · 양자화 · WebP GLB. 이미 압축된 파일은 그대로 돌려준다(여러 번 돌려도 같다). */
export async function compressGLB(glb, options = {}) {
  const o = {...COMPRESSION, ...options};
  const {json: src, bin} = parseGLB(glb);
  if (isCompressed(src)) return glb;
  await MeshoptEncoder.ready;
  const j = structuredClone(src);
  j.accessors = []; j.bufferViews = [];
  const chunks = []; let binLength = 0, fallbackLength = 0;
  const pushBin = (bytes) => {
    const at = binLength, b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    chunks.push(b); const pad = (4 - b.length % 4) % 4; if (pad) chunks.push(Buffer.alloc(pad));
    binLength += b.length + pad; return at;
  };
  /** 압축 bufferView — 실제 데이터는 GLB BIN(buffer 0), 풀린 크기만큼 자리만 잡는 fallback(buffer 1) 을 가리킨다 */
  const compressed = (raw, count, stride, mode, target, filter) => {
    const enc = MeshoptEncoder.encodeGltfBuffer(raw, count, stride, mode); // version 0 — EXT_meshopt_compression 규격
    const view = {buffer: 1, byteOffset: fallbackLength, byteLength: raw.byteLength, ...(mode === 'ATTRIBUTES' ? {byteStride: stride} : {}), target,
      extensions: {[MESHOPT]: {buffer: 0, byteOffset: pushBin(enc), byteLength: enc.byteLength, byteStride: stride, count, mode, ...(filter ? {filter} : {})}}};
    fallbackLength += raw.byteLength + (4 - raw.byteLength % 4) % 4;
    j.bufferViews.push(view); return j.bufferViews.length - 1;
  };
  const plain = (bytes) => { j.bufferViews.push({buffer: 0, byteOffset: pushBin(bytes), byteLength: bytes.byteLength}); return j.bufferViews.length - 1; };
  const accessor = (a) => { j.accessors.push(a); return j.accessors.length - 1; };

  // 메시마다 위치 배율 s — 뼈가 있는 메시인지 노드에서 본다
  const meshNodes = new Map();
  src.nodes.forEach((n, i) => { if (n.mesh !== undefined) { if (meshNodes.has(n.mesh)) throw new Error('한 메시를 여러 노드가 쓰면 노드 배율을 나눌 수 없다'); meshNodes.set(n.mesh, i); } });
  const meshScale = new Map();

  j.meshes = src.meshes.map((mesh, mi) => {
    let maxAbs = 0;
    for (const p of mesh.primitives) for (const v of readAccessor(src, bin, p.attributes.POSITION)) maxAbs = Math.max(maxAbs, Math.abs(v));
    const s = Math.max(maxAbs, 1e-6) / ((1 << (o.positionBits - 1)) - 1);
    meshScale.set(mi, s);
    // 배율을 적어 둔다 — expandGLB(검수용 되풀기)가 이 값으로 원래 좌표를 되찾는다. 게임은 읽지 않는다.
    return {...mesh, extras: {...(mesh.extras ?? {}), aquaPositionScale: s}, primitives: mesh.primitives.map((p) => {
      if ((p.mode ?? 4) !== 4) throw new Error('삼각형만 다룬다');
      const P = readAccessor(src, bin, p.attributes.POSITION), n = P.length / 3, attributes = {};
      // 위치: int16 x3 + 0 — meshopt 는 4바이트 배수 stride 만 받는다
      const pos = new Int16Array(n * 4), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const q = Math.round(P[i * 3 + c] / s); pos[i * 4 + c] = q; min[c] = Math.min(min[c], q); max[c] = Math.max(max[c], q); }
      attributes.POSITION = accessor({bufferView: compressed(new Uint8Array(pos.buffer), n, 8, 'ATTRIBUTES', 34962), componentType: 5122, count: n, type: 'VEC3', min, max});
      if (p.attributes.NORMAL !== undefined) {
        const N = readAccessor(src, bin, p.attributes.NORMAL), f = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { const x = N[i * 3], y = N[i * 3 + 1], z = N[i * 3 + 2], l = Math.hypot(x, y, z) || 1; f[i * 4] = x / l; f[i * 4 + 1] = y / l; f[i * 4 + 2] = z / l; }
        const oct = MeshoptEncoder.encodeFilterOct(f, n, 4, o.normalBits);
        attributes.NORMAL = accessor({bufferView: compressed(oct, n, 4, 'ATTRIBUTES', 34962, 'OCTAHEDRAL'), componentType: 5120, normalized: true, count: n, type: 'VEC3'});
      }
      if (p.attributes.TEXCOORD_0 !== undefined) {
        const U = readAccessor(src, bin, p.attributes.TEXCOORD_0), step = 1 / ((1 << o.uvBits) - 1);
        let inside = true; for (const u of U) if (u < 0 || u > 1) { inside = false; break; }
        if (inside) { // [0,1] 안이면 uint16 정규화. 값은 uvBits 격자에 맞춰 둔다(아래 비트가 0 이라 meshopt 가 더 줄인다)
          const q = new Uint16Array(n * 2); for (let i = 0; i < U.length; i++) q[i] = Math.round(Math.round(U[i] / step) * step * 65535);
          attributes.TEXCOORD_0 = accessor({bufferView: compressed(new Uint8Array(q.buffer), n, 4, 'ATTRIBUTES', 34962), componentType: 5123, normalized: true, count: n, type: 'VEC2'});
        } else { // 장식 몇 개는 UV 가 [0,1] 밖(-0.03~1.01)이다. 정규화하면 잘려 무늬가 밀리므로 float 그대로, 값만 같은 격자에 맞춘다
          const q = new Float32Array(n * 2); for (let i = 0; i < U.length; i++) q[i] = Math.round(U[i] / step) * step;
          attributes.TEXCOORD_0 = accessor({bufferView: compressed(new Uint8Array(q.buffer), n, 8, 'ATTRIBUTES', 34962), componentType: 5126, count: n, type: 'VEC2'});
        }
      }
      if (p.attributes.JOINTS_0 !== undefined) {
        const J = readAccessor(src, bin, p.attributes.JOINTS_0), q = new Uint8Array(J.length);
        for (let i = 0; i < J.length; i++) { if (J[i] > 255) throw new Error('뼈가 256개를 넘는다'); q[i] = J[i]; }
        attributes.JOINTS_0 = accessor({bufferView: compressed(q, n, 4, 'ATTRIBUTES', 34962), componentType: 5121, count: n, type: 'VEC4'});
      }
      if (p.attributes.WEIGHTS_0 !== undefined) {
        const q = quantizeWeights(readAccessor(src, bin, p.attributes.WEIGHTS_0));
        attributes.WEIGHTS_0 = accessor({bufferView: compressed(new Uint8Array(q.buffer), n, 8, 'ATTRIBUTES', 34962), componentType: 5123, normalized: true, count: n, type: 'VEC4'});
      }
      for (const k of Object.keys(p.attributes)) if (!(k in attributes)) throw new Error(`모르는 속성 ${k}`);
      const I = readAccessor(src, bin, p.indices), wide = n > 65535, idx = wide ? new Uint32Array(I) : new Uint16Array(I);
      const indices = accessor({bufferView: compressed(new Uint8Array(idx.buffer), idx.length, wide ? 4 : 2, 'TRIANGLES', 34963), componentType: wide ? 5125 : 5123, count: idx.length, type: 'SCALAR'});
      return {...p, attributes, indices};
    })};
  });

  // 배율 되돌리기: 뼈 메시는 IBM 에, 고정 메시는 노드 scale 에
  const skinScale = new Map();
  for (const [mi, ni] of meshNodes) {
    const node = j.nodes[ni], s = meshScale.get(mi);
    if (node.skin !== undefined) {
      if (skinScale.has(node.skin) && skinScale.get(node.skin) !== s) throw new Error('한 skin 을 배율이 다른 메시가 나눠 쓴다');
      skinScale.set(node.skin, s);
    } else {
      if (node.matrix) throw new Error('matrix 노드는 다루지 않는다');
      node.scale = (node.scale ?? [1, 1, 1]).map((v) => v * s);
    }
  }
  (j.skins ?? []).forEach((skin, si) => {
    const s = skinScale.get(si) ?? 1;
    const M = skin.inverseBindMatrices !== undefined ? readAccessor(src, bin, skin.inverseBindMatrices) : (() => { const m = new Float32Array(16 * skin.joints.length); for (let k = 0; k < skin.joints.length; k++) m[k * 16] = m[k * 16 + 5] = m[k * 16 + 10] = m[k * 16 + 15] = 1; return m; })();
    // 열 우선(column-major) 4x4: IBM · S(s) = 앞 세 열에 s 를 곱한다
    for (let k = 0; k < skin.joints.length; k++) for (let c = 0; c < 12; c++) M[k * 16 + c] *= s;
    skin.inverseBindMatrices = accessor({bufferView: plain(new Uint8Array(M.buffer)), componentType: 5126, count: skin.joints.length, type: 'MAT4'});
  });

  // 텍스처: 512px WebP. 큰 그림은 줄이고 작은 그림은 그대로(늘리지 않는다)
  j.images = await Promise.all(src.images.map(async (img) => {
    const v = src.bufferViews[img.bufferView], raw = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    let pipe = sharp(raw); const meta = await pipe.metadata();
    if (meta.width > o.textureSize || meta.height > o.textureSize) pipe = pipe.resize(Math.min(meta.width, o.textureSize), Math.min(meta.height, o.textureSize), {kernel: 'lanczos3'});
    if (meta.hasAlpha) { const {isOpaque} = await sharp(raw).stats(); if (isOpaque) pipe = pipe.removeAlpha(); }
    const webp = await pipe.webp({quality: o.webpQuality, effort: 6, smartSubsample: true}).toBuffer();
    const {name} = img; return {...(name ? {name} : {}), bufferView: plain(webp), mimeType: 'image/webp'};
  }));
  j.textures = (src.textures ?? []).map(({source, ...t}) => ({...t, extensions: {...(t.extensions ?? {}), [WEBP]: {source}}}));

  const used = new Set([...(src.extensionsUsed ?? []), MESHOPT, QUANT, WEBP]);
  j.extensionsUsed = [...used];
  j.extensionsRequired = [...new Set([...(src.extensionsRequired ?? []), MESHOPT, QUANT, WEBP])];
  j.buffers = [{byteLength: binLength}, {byteLength: fallbackLength, extensions: {[MESHOPT]: {fallback: true}}}];
  j.asset = {...src.asset, generator: `${src.asset.generator ?? 'Our Days'} + aqua glb-compress (meshopt/quantize/webp${o.textureSize})`};
  return writeGLB(j, Buffer.concat(chunks));
}

/** 압축 bufferView 하나를 풀어 bytes 로 — 압축 안 된 view 는 그대로 잘라 준다 */
export async function readView(json, bin, index) {
  const v = json.bufferViews[index], ext = v.extensions?.[MESHOPT];
  if (!ext) {
    if (v.buffer !== 0) throw new Error('GLB BIN 밖의 buffer');
    return new Uint8Array(bin.buffer.slice(bin.byteOffset + (v.byteOffset ?? 0), bin.byteOffset + (v.byteOffset ?? 0) + v.byteLength));
  }
  await MeshoptDecoder.ready;
  const out = new Uint8Array(ext.count * ext.byteStride), src = bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
  MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, src, ext.mode, ext.filter ?? 'NONE');
  return out;
}

/** 압축 GLB 의 accessor → 원래 단위의 수(정규화 · stride 를 푼다). 압축 안 된 GLB 에도 쓸 수 있다. */
export async function readDecoded(json, bin, index) {
  const a = json.accessors[index], v = json.bufferViews[a.bufferView], bytes = await readView(json, bin, a.bufferView);
  const C = ARRAYS[a.componentType], n = COMPONENTS[a.type], stride = v.byteStride ?? n * C.BYTES_PER_ELEMENT;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = new Float64Array(a.count * n);
  const get = {5120: (o) => dv.getInt8(o), 5121: (o) => dv.getUint8(o), 5122: (o) => dv.getInt16(o, true), 5123: (o) => dv.getUint16(o, true), 5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true)}[a.componentType];
  const norm = a.normalized ? {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[a.componentType] : 1;
  for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) {
    const x = get((a.byteOffset ?? 0) + i * stride + c * C.BYTES_PER_ELEMENT) / norm;
    out[i * n + c] = a.normalized ? Math.max(-1, x) : x; // 부호 있는 정규화의 -128 은 -1 로(glTF 규칙)
  }
  return out;
}

/** 검수 도구용: 압축 GLB → packGLB 가 쓰던 꼴(float · uint16 · meshopt/양자화 확장 없음)로 되푼다.
 * review-stage1 의 CPU 렌더러는 accessor 를 직접 읽어서 압축 형식을 모른다. 텍스처는 WebP 그대로(sharp 가 읽는다).
 * 게임은 이걸 쓰지 않는다 — 브라우저의 GLTFLoader 가 MeshoptDecoder 로 직접 푼다. */
export async function expandGLB(glb) {
  const {json: src, bin} = parseGLB(glb);
  if (!isCompressed(src)) return glb;
  const j = structuredClone(src);
  j.accessors = []; j.bufferViews = [];
  const chunks = []; let length = 0;
  const view = (typed, target) => {
    const b = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength), at = length;
    chunks.push(b); const pad = (4 - b.length % 4) % 4; if (pad) chunks.push(Buffer.alloc(pad)); length += b.length + pad;
    j.bufferViews.push({buffer: 0, byteOffset: at, byteLength: b.length, ...(target ? {target} : {})}); return j.bufferViews.length - 1;
  };
  const acc = (typed, type, componentType, target, minmax) => {
    const n = COMPONENTS[type], a = {bufferView: view(typed, target), componentType, count: typed.length / n, type};
    if (minmax) { a.min = Array(n).fill(Infinity); a.max = Array(n).fill(-Infinity); for (let k = 0; k < typed.length; k++) { a.min[k % n] = Math.min(a.min[k % n], typed[k]); a.max[k % n] = Math.max(a.max[k % n], typed[k]); } }
    j.accessors.push(a); return j.accessors.length - 1;
  };
  const scaleOf = src.meshes.map((m) => m.extras?.aquaPositionScale ?? 1);
  j.meshes = [];
  for (const [mi, mesh] of src.meshes.entries()) {
    const s = scaleOf[mi], primitives = [];
    for (const p of mesh.primitives) {
      const attributes = {};
      for (const [k, i] of Object.entries(p.attributes)) {
        const d = await readDecoded(src, bin, i), n = COMPONENTS[src.accessors[i].type];
        if (k === 'POSITION') attributes[k] = acc(Float32Array.from(d, (x) => x * s), 'VEC3', 5126, 34962, true);
        else if (k === 'NORMAL') {
          const f = new Float32Array(d.length);
          for (let q = 0; q < d.length; q += 3) { const l = Math.hypot(d[q], d[q + 1], d[q + 2]) || 1; f[q] = d[q] / l; f[q + 1] = d[q + 1] / l; f[q + 2] = d[q + 2] / l; }
          attributes[k] = acc(f, 'VEC3', 5126, 34962, true);
        } else if (k.startsWith('JOINTS')) attributes[k] = acc(Uint16Array.from(d), 'VEC4', 5123, 34962);
        else attributes[k] = acc(Float32Array.from(d), ['', 'SCALAR', 'VEC2', 'VEC3', 'VEC4'][n], 5126, 34962);
      }
      const I = await readDecoded(src, bin, p.indices), wide = I.some((x) => x > 65535);
      primitives.push({...p, attributes, indices: acc(wide ? Uint32Array.from(I) : Uint16Array.from(I), 'SCALAR', wide ? 5125 : 5123, 34963)});
    }
    const extras = {...(mesh.extras ?? {})}, out = {...mesh, primitives};
    delete extras.aquaPositionScale; // 되푼 파일은 원래 좌표라 배율이 없다
    if (Object.keys(extras).length) out.extras = extras; else delete out.extras;
    j.meshes.push(out);
  }
  const skinScale = new Map();
  src.nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const s = scaleOf[n.mesh];
    if (n.skin !== undefined) skinScale.set(n.skin, s);
    else if (j.nodes[i].scale) { j.nodes[i].scale = j.nodes[i].scale.map((v) => v / s); if (j.nodes[i].scale.every((v) => Math.abs(v - 1) < 1e-9)) delete j.nodes[i].scale; }
  });
  for (const [si, skin] of (j.skins ?? []).entries()) {
    const M = Float32Array.from(await readDecoded(src, bin, src.skins[si].inverseBindMatrices)), s = skinScale.get(si) ?? 1;
    for (let k = 0; k < skin.joints.length; k++) for (let c = 0; c < 12; c++) M[k * 16 + c] /= s;
    skin.inverseBindMatrices = acc(M, 'MAT4', 5126);
  }
  j.images = [];
  for (const img of src.images) j.images.push({...img, bufferView: view(await readView(src, bin, img.bufferView))});
  j.textures = src.textures.map(({extensions, ...t}) => {
    const {[WEBP]: w, ...rest} = extensions ?? {}, out = {...t, source: w?.source ?? t.source};
    if (Object.keys(rest).length) out.extensions = rest;
    return out;
  });
  const drop = new Set([MESHOPT, QUANT]);
  j.extensionsUsed = (src.extensionsUsed ?? []).filter((e) => !drop.has(e));
  j.extensionsRequired = (src.extensionsRequired ?? []).filter((e) => !drop.has(e));
  if (!j.extensionsRequired.length) delete j.extensionsRequired;
  j.buffers = [{byteLength: length}];
  return writeGLB(j, Buffer.concat(chunks));
}
