// 갈라파고스 V4 다방향 실사 4뷰(Side · Top · Bottom · Front) Visual-Hull + 타이트 UV 사진 투영 GLB 파이프라인
// 사용법: node design/aqua3d-review/galapagos/v4-build.mjs <key> <sheetPath> [--prepare-only] [--save-live]
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';
import { projection, clamp, maskAt, smallMask, openedCore, taubin } from '../remodel-hull.mjs';
import { largestHull } from '../remodel-clean-hull.mjs';
import { anchorAppendage } from '../remodel-appendages.mjs';
import { packAsset } from '../shrimp-pack.mjs';
import { finishPacked } from '../remodel-material.mjs';
import { compressGLB } from '../glb-compress.mjs';

const ROOT = resolve(process.cwd());
const V4_DIR = resolve(ROOT, 'design/aqua3d-review/galapagos/v4-refs');
const BONE_NAMES = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'];

function isolateBackground(data, w, h) {
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (let x = 0; x < w; x += 4) {
    for (const y of [2, h - 3]) {
      const at = (y * w + x) * 4;
      br += data[at]; bg += data[at + 1]; bb += data[at + 2]; bn++;
    }
  }
  br /= bn; bg /= bn; bb /= bn;

  const isBg = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const q = new Int32Array(w * h);
  let head = 0, tail = 0;

  const bgDist = (i) => {
    const at = i * 4;
    const r = data[at], g = data[at + 1], b = data[at + 2];
    const d = Math.hypot(r - br, g - bg, b - bb);
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    return d < 28 && sat < 24;
  };

  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!visited[i] && bgDist(i)) { visited[i] = 1; isBg[i] = 1; q[tail++] = i; }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!visited[i] && bgDist(i)) { visited[i] = 1; isBg[i] = 1; q[tail++] = i; }
    }
  }
  while (head < tail) {
    const i = q[head++], x = i % w;
    for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
      if (j >= 0 && j < w * h && !visited[j] && bgDist(j)) {
        visited[j] = 1; isBg[j] = 1; q[tail++] = j;
      }
    }
  }
  // 2-pass light-grey edge fringe removal so dark flipper tips have zero white halo
  let mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = isBg[i] ? 0 : 1;
  for (const thresh of [62, 44]) {
    const next = mask.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        if (!mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) {
          const at = i * 4;
          const r = data[at], g = data[at + 1], b = data[at + 2];
          const d = Math.hypot(r - br, g - bg, b - bb);
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          if (d < thresh && sat < 30) next[i] = 0;
        }
      }
    }
    mask = next;
  }
  return mask;
}

function alphaBounds(data, width, height, threshold = 96) {
  let left = width, top = height, right = -1, bottom = -1, n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= threshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        n++;
      }
    }
  }
  if (!n) throw new Error('Empty alpha mask');
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, pixels: n };
}

async function prepareAndRegister(key, sheetPath, { rotateTopBottom = true } = {}) {
  await mkdir(V4_DIR, { recursive: true });
  const sheetBytes = await readFile(sheetPath);
  await writeFile(resolve(V4_DIR, `${key}-sheet.png`), await sharp(sheetBytes).png().toBuffer());

  const { data, info } = await sharp(sheetBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const mask = isolateBackground(data, w, h);

  const colHasFg = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = 0; y < h; y++) count += mask[y * w + x];
    colHasFg[x] = count > 4 ? 1 : 0;
  }
  const groups = [];
  let start = -1, last = -1;
  for (let x = 0; x <= w + 4; x++) {
    if (x < w && colHasFg[x]) {
      if (start < 0) start = x;
      last = x;
    } else if (start >= 0 && x - last > 2) {
      if (last - start > 50) groups.push([start, last]);
      start = -1;
    }
  }
  if (groups.length !== 4) {
    throw new Error(`${key}: expected 4 separated view columns, got ${JSON.stringify(groups)}`);
  }

  const viewNames = ['side', 'top', 'bottom', 'front'];
  const extracted = {};
  for (let i = 0; i < 4; i++) {
    const name = viewNames[i];
    const [x0, x1] = groups[i];
    let y0 = h, y1 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = x0; x <= x1; x++) {
        if (mask[y * w + x]) {
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const rgba = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = (y0 + y) * w + (x0 + x);
        const di = (y * cw + x) * 4;
        if (mask[si]) {
          rgba[di] = data[si * 4];
          rgba[di + 1] = data[si * 4 + 1];
          rgba[di + 2] = data[si * 4 + 2];
          rgba[di + 3] = 255;
        }
      }
    }
    let img = sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } });
    if (rotateTopBottom && (name === 'top' || name === 'bottom') && ch > cw) {
      img = img.rotate(90);
    }
    const png = await img.png().toBuffer();
    const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    extracted[name] = { png, ...raw, bounds: alphaBounds(raw.data, raw.info.width, raw.info.height) };
  }

  const calcH = (v) => Math.round(820 * extracted[v].bounds.height / extracted[v].bounds.width);
  const sideH = Math.min(820, calcH('side'));
  const depth = Math.min(820, Math.round((calcH('top') + calcH('bottom')) / 2));
  // Preserve front's true anatomical aspect ratio so torso height is never stretched to match hanging side flippers
  const frontH = Math.min(sideH, Math.round(depth * extracted.front.bounds.height / extracted.front.bounds.width));
  const target = {
    side: [820, sideH],
    top: [820, depth],
    bottom: [820, depth],
    front: [depth, frontH],
  };

  // Align front vertically with the top of the side silhouette (dorsal crown), since side's extra bottom height is the hanging fore-flipper
  const sidePadT = Math.floor((1024 - sideH) / 2);
  const views = {};
  const composites = [];
  for (let i = 0; i < 4; i++) {
    const name = viewNames[i];
    const s = extracted[name];
    const [tw, th] = target[name];
    const padL = Math.floor((1024 - tw) / 2);
    const padT = name === 'front' ? sidePadT : Math.floor((1024 - th) / 2);
    const regPng = await sharp(s.png)
      .extract({ left: s.bounds.left, top: s.bounds.top, width: s.bounds.width, height: s.bounds.height })
      .resize(tw, th, { fit: 'fill', kernel: 'lanczos3' })
      .extend({ left: padL, right: 1024 - tw - padL, top: padT, bottom: 1024 - th - padT, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await writeFile(resolve(V4_DIR, `${key}-${name}.png`), regPng);
    const raw = await sharp(regPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    views[name] = { ...raw, width: raw.info.width, height: raw.info.height, bounds: alphaBounds(raw.data, raw.info.width, raw.info.height) };
    composites.push({
      input: await sharp(regPng).resize(256, 256).png().toBuffer(),
      left: i * 256,
      top: 0,
    });
  }

  await sharp({ create: { width: 1024, height: 256, channels: 4, background: '#d9dce0' } })
    .composite(composites)
    .webp({ quality: 92 })
    .toFile(resolve(V4_DIR, `${key}-registration.webp`));

  console.log(`[v4-prepare] ${key}: side=${target.side.join('x')}, top/bottom=${target.top.join('x')}, front=${target.front.join('x')}`);
  return views;
}

// Smooth round-section prior that also trims hanging fore-flipper silhouettes from side view
function cleanRoundSectionPrior(views) {
  const profiles = {};
  for (const name of ['side', 'top', 'bottom']) {
    // Stronger opening on side (0.60) removes hanging fore-flipper below the chest
    const frac = name === 'side' ? 0.60 : 0.48;
    const s = openedCore(views[name], frac);
    const columns = [];
    for (let x = 0; x < 256; x++) {
      let best = null, start = -1;
      for (let y = 0; y <= 256; y++) {
        if (y < 256 && s.mask[y * 256 + x]) {
          if (start < 0) start = y;
        } else if (start >= 0) {
          if (!best || y - start > best[1] - best[0]) best = [start, y - 1];
          start = -1;
        }
      }
      columns.push(best);
    }
    profiles[name] = columns.map((p, x) => {
      if (!p) return null;
      const near = columns.slice(Math.max(0, x - 4), x + 5).filter(Boolean);
      const median = (k) => near.map((a) => a[k]).sort((a, b) => a - b)[Math.floor(near.length / 2)];
      return [median(0), median(1)];
    });
  }
  // Smooth bottom edge of side profile so no hanging flipper lump remains under the chest
  const sideP = profiles.side;
  for (let pass = 0; pass < 8; pass++) {
    const copy = sideP.map((p) => (p ? [...p] : null));
    for (let x = 2; x < 254; x++) {
      if (!copy[x] || !copy[x - 2] || !copy[x + 2]) continue;
      // Convex hull pull-up on belly (bottom y in image coords is max y -> pull upward if sagging below neighbors)
      const avgBot = (copy[x - 2][1] + copy[x + 2][1]) * 0.5;
      if (copy[x][1] > avgBot) sideP[x][1] = copy[x][1] * 0.65 + avgBot * 0.35;
    }
  }
  return (X, Y, Z) => {
    const x = Math.round((512 + 410 * X) / 4);
    const s = profiles.side[x], t = profiles.top[x], b = profiles.bottom[x];
    if (!s || !t || !b) return true;
    const cy = (512 - 2 * (s[0] + s[1])) / 410;
    const ry = Math.max(0.006, (2 * (s[1] - s[0] + 1)) / 410);
    const za = (4 * t[0] - 512) / 410, zb = (4 * t[1] - 512) / 410;
    const ba = (512 - 4 * b[1]) / 410, bb = (512 - 4 * b[0]) / 410;
    const z0 = Math.max(za, ba), z1 = Math.min(zb, bb);
    if (z1 <= z0) return false;
    const cz = (z0 + z1) / 2, rz = Math.max(0.006, (z1 - z0) / 2);
    return ((Y - cy) / ry) ** 2 + ((Z - cz) / rz) ** 2 <= 1.04;
  };
}

async function buildCleanVisualHull(views, targetTris = 2400) {
  const NX = 256, NY = 128, NZ = 128, N = NX * NY * NZ;
  const roundPrior = cleanRoundSectionPrior(views);
  const frontCore = openedCore(views.front, 0.45);

  const yLimit = 0.05 + Math.max(...Array.from({ length: 1024 }, (_, y) => {
    for (let x = 0; x < 1024; x += 16) if (maskAt(views.side, x, y)) return Math.abs(y - 512) / 410;
    return 0;
  }));
  const zLimit = 0.05 + Math.max(...Array.from({ length: 1024 }, (_, y) => {
    for (let x = 0; x < 1024; x += 16) if (maskAt(views.top, x, y) || maskAt(views.bottom, x, y)) return Math.abs(y - 512) / 410;
    return 0;
  }));
  const lo = [-1.05, -yLimit, -zLimit];
  const step = [2.1 / (NX - 1), (2 * yLimit) / (NY - 1), (2 * zLimit) / (NZ - 1)];
  const field = new Uint8Array(N);
  const at = (x, y, z) => (x * NY + y) * NZ + z;

  let occupied = 0;
  for (let x = 1; x < NX - 1; x++) {
    const X = lo[0] + x * step[0];
    for (let y = 1; y < NY - 1; y++) {
      const Y = lo[1] + y * step[1];
      if (!maskAt(views.side, ...projection('side', X, Y, 0))) continue;
      for (let z = 1; z < NZ - 1; z++) {
        const Z = lo[2] + z * step[2];
        if (!maskAt(views.top, ...projection('top', X, Y, Z))) continue;
        if (!maskAt(views.bottom, ...projection('bottom', X, Y, Z))) continue;
        if (!maskAt(views.front, ...projection('front', X, Y, Z))) continue;
        const q = projection('front', X, Y, Z);
        const px = Math.round(q[0] / 4), py = Math.round(q[1] / 4);
        if (px < 0 || px > 255 || py < 0 || py > 255 || !frontCore.mask[py * 256 + px]) continue;
        if (!roundPrior(X, Y, Z)) continue;
        field[at(x, y, z)] = 1;
        occupied++;
      }
    }
  }
  if (occupied < 100) throw new Error('Visual-hull intersection is empty');

  const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const vertices = [], indices = [];
  const edgeMaps = [new Int32Array(N).fill(-1), new Int32Array(N).fill(-1), new Int32Array(N).fill(-1)];

  for (let x = 0; x < NX - 1; x++) for (let y = 0; y < NY - 1; y++) for (let z = 0; z < NZ - 1; z++) {
    let c = 0;
    for (let k = 0; k < 8; k++) { const d = corners[k]; if (field[at(x + d[0], y + d[1], z + d[2])]) c |= 1 << k; }
    if (!c || c === 255) continue;
    const m = edgeTable[c], edges = new Int32Array(12);
    for (let e = 0; e < 12; e++) if (m & (1 << e)) {
      const a = corners[pairs[e][0]], b = corners[pairs[e][1]];
      const axis = a[0] !== b[0] ? 0 : a[1] !== b[1] ? 1 : 2;
      const slot = at(x + Math.min(a[0], b[0]), y + Math.min(a[1], b[1]), z + Math.min(a[2], b[2]));
      let v = edgeMaps[axis][slot];
      if (v < 0) {
        v = vertices.length / 3;
        vertices.push(lo[0] + (x + (a[0] + b[0]) * 0.5) * step[0], lo[1] + (y + (a[1] + b[1]) * 0.5) * step[1], lo[2] + (z + (a[2] + b[2]) * 0.5) * step[2]);
        edgeMaps[axis][slot] = v;
      }
      edges[e] = v;
    }
    for (let t = 0; triTable[c * 16 + t] !== -1; t += 3) indices.push(edges[triTable[c * 16 + t]], edges[triTable[c * 16 + t + 1]], edges[triTable[c * 16 + t + 2]]);
  }

  let P = Float32Array.from(vertices), I = Uint32Array.from(indices), vol = 0;
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) + P[a + 1] * (P[b + 2] * P[c] - P[b] * P[c + 2]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  if (vol < 0) for (let i = 0; i < I.length; i += 3) { const tmp = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = tmp; }

  const clean = largestHull(I, P.length / 3);
  I = clean.indices;
  P = taubin(P, I, 100);
  await MeshoptSimplifier.ready;
  let simplified;
  for (const tol of [0.01, 0.03, 0.07, 0.15]) {
    [simplified] = MeshoptSimplifier.simplify(I, P, 3, targetTris * 3, tol, ['Prune', 'Regularize']);
    if (simplified.length <= targetTris * 3) break;
  }
  const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
  const newP = new Float32Array(count * 3);
  for (let old = 0; old < remap.length; old++) if (remap[old] !== 0xffffffff) newP.set(P.subarray(old * 3, old * 3 + 3), remap[old] * 3);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(taubin(newP, simplified, 24), 3));
  g.setIndex(new T.BufferAttribute(simplified, 1));
  g.computeVertexNormals();
  return g;
}

// Extract flippers with slight inward root overlap so shoulder seam is 100% closed
function loopsOf(mask, w, h) {
  const edges = new Map(), code = (x, y) => y * (w + 1) + x;
  const add = (a, b) => { if (!edges.has(a)) edges.set(a, []); edges.get(a).push(b); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    const a = code(x, y), b = code(x + 1, y), c = code(x + 1, y + 1), d = code(x, y + 1);
    if (!y || !mask[(y - 1) * w + x]) add(a, b);
    if (x === w - 1 || !mask[y * w + x + 1]) add(b, c);
    if (y === h - 1 || !mask[(y + 1) * w + x]) add(c, d);
    if (!x || !mask[y * w + x - 1]) add(d, a);
  }
  const out = [];
  while (edges.size) {
    const start = edges.keys().next().value;
    let at = start; const pts = [];
    for (let n = 0; n < w * h * 4; n++) {
      pts.push([at % (w + 1), Math.floor(at / (w + 1))]);
      const next = edges.get(at);
      if (!next?.length) break;
      const q = next.pop();
      if (!next.length) edges.delete(at);
      at = q;
      if (at === start) break;
    }
    if (pts.length > 8) out.push(pts);
  }
  return out;
}

function buildSeamlessFlippers(views) {
  const { mask, D, w, h } = smallMask(views.top);
  const maxD = Math.max(...D);
  const radius = maxD * 0.56; // slightly tighter core -> fuller flipper root embedded into shoulder
  const seeds = new Uint8Array(w * h);
  for (let i = 0; i < D.length; i++) seeds[i] = D[i] >= radius ? 1 : 0;
  const opened = new Uint8Array(w * h), R = Math.ceil(radius);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (seeds[y * w + x]) {
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) opened[yy * w + xx] = 1;
    }
  }
  const residual = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    residual[i] = mask[i] && !opened[i] && Math.abs(y - 128) > 3 ? 1 : 0;
  }
  // Dilate residual 2px into the torso mask so flipper roots embed cleanly inside body
  let embedded = residual.slice();
  for (let pass = 0; pass < 2; pass++) {
    const next = embedded.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i] || embedded[i] || Math.abs(y - 128) <= 3) continue;
      if (embedded[i - 1] || embedded[i + 1] || embedded[i - w] || embedded[i + w]) next[i] = 1;
    }
    embedded = next;
  }

  const sd = smallMask(views.side);
  const result = [];
  for (const raw of loopsOf(embedded, w, h)) {
    const area = Math.abs(raw.reduce((s, p, i) => { const q = raw[(i + 1) % raw.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) * 0.5;
    if (area < 20) continue;
    const stride = Math.max(1, Math.floor(raw.length / 36));
    const outline = raw.filter((_, i) => i % stride === 0).map((p) => new T.Vector2((p[0] * 4 - 512) / 410, (p[1] * 4 - 512) / 410));
    if (outline.length < 4) continue;
    const centroid = outline.reduce((a, p) => a.add(p), new T.Vector2()).multiplyScalar(1 / outline.length);
    if (centroid.x > 0.65 || (Math.abs(centroid.y) < 0.08 && centroid.x > -0.75)) continue;

    const isFore = centroid.x > -0.4;
    const sx = Math.max(0, Math.min(255, Math.round((512 + centroid.x * 410) / 4)));
    let sy = 128, sr = 0;
    for (let yy = 0; yy < 256; yy++) if (sd.D[yy * 256 + sx] > sr) { sr = sd.D[yy * 256 + sx]; sy = yy; }
    const rootY = isFore ? (512 - sy * 4) / 410 - sr * 0.65 / 410 : (512 - sy * 4) / 410;

    const faces = T.ShapeUtils.triangulateShape(outline, []);
    const p = [], I = [], n = outline.length;
    const maxZ = Math.max(...outline.map((q) => Math.abs(q.y)));
    const minZ = Math.min(...outline.map((q) => Math.abs(q.y)));
    for (const side of [-1, 1]) {
      for (const v of outline) {
        const t = clamp((Math.abs(v.y) - minZ) / Math.max(0.01, maxZ - minZ));
        const half = (isFore ? 0.022 : 0.015) * (1 - t) + 0.0022 * t;
        const droop = isFore ? Math.max(0, Math.abs(v.y) - minZ) * 0.16 : 0;
        p.push(v.x, rootY - droop + side * half, v.y);
      }
    }
    for (const f of faces) I.push(f[0], f[2], f[1], f[0] + n, f[1] + n, f[2] + n);
    for (let i = 0; i < n; i++) { const q = (i + 1) % n; I.push(i, q, i + n, q, q + n, i + n); }

    let vol = 0;
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
      vol += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) + p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    if (vol < 0) for (let i = 0; i < I.length; i += 3) { const tmp = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = tmp; }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setIndex(I);
    g.computeVertexNormals();
    g.userData.appendage = { role: isFore ? 'fore' : 'hind', side: centroid.y >= 0 ? 'L' : 'R', triangles: I.length / 3 };
    result.push(g);
  }
  return result.sort((a, b) => b.userData.appendage.triangles - a.userData.appendage.triangles).slice(0, 6);
}

// 4-view TIGHT-BOUNDS photorealistic texture baker (~3x higher texel density for face, fur, flippers!)
function bleedView(view) {
  const w = view.width, h = view.height, N = w * h;
  const near = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) {
    if (view.data[i * 4 + 3] >= 96) { near[i] = i; q[tail++] = i; }
  }
  while (head < tail) {
    const i = q[head++], x = i % w;
    for (const j of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
      if (j >= 0 && j < N && near[j] < 0) { near[j] = near[i]; q[tail++] = j; }
    }
  }
  return { ...view, nearest: near };
}

function sampleViewColor(view, x, y, z) {
  const q = projection(view.name, x, y, z);
  const px = Math.round(clamp(q[0], 0, 1023));
  const py = Math.round(clamp(q[1], 0, 1023));
  const at = view.nearest[py * 1024 + px] * 4;
  return [view.data[at], view.data[at + 1], view.data[at + 2]];
}

async function projectedTexture4ViewTight(g, views) {
  // 512x512 atlas packed tightly to each view's actual pixel bounding box (with 6px margin)
  const names = ['side', 'top', 'bottom', 'front'];
  const rects = [
    [0,   0, 512, 134], // side   (wide, slim)
    [0, 136, 512, 186], // top    (wide, medium)
    [0, 324, 340, 186], // bottom (wide, medium)
    [342, 324, 170, 186], // front (square-ish, zoomed tight onto face & chest!)
  ];
  const refs = names.map((name) => {
    const b = views[name].bounds;
    const pad = 8;
    const u0 = Math.max(0, b.left - pad), u1 = Math.min(1023, b.right + pad);
    const v0 = Math.max(0, b.top - pad),  v1 = Math.min(1023, b.bottom + pad);
    return { ...bleedView(views[name]), name, crop: [u0, v0, u1 - u0, v1 - v0] };
  });

  const W = 512;
  const atlas = Buffer.alloc(W * W * 3);
  const depth = new Float32Array(W * W).fill(-Infinity);

  // Initialize each tile with dilated tight-cropped view so UV edges never sample black
  for (let v = 0; v < 4; v++) {
    const [rx, ry, rw, rh] = rects[v];
    const view = refs[v], [cu, cv, cw, ch] = view.crop;
    for (let yy = 0; yy < rh; yy++) {
      for (let xx = 0; xx < rw; xx++) {
        const px = Math.round(cu + (xx / (rw - 1)) * cw);
        const py = Math.round(cv + (yy / (rh - 1)) * ch);
        const at = view.nearest[py * 1024 + px] * 4;
        atlas.set(view.data.subarray(at, at + 3), ((ry + yy) * W + rx + xx) * 3);
      }
    }
  }

  const P = g.attributes.position, N = g.attributes.normal, I = g.index.array;
  const author = g.attributes.authorRole;
  const outP = [], outN = [], outUV = [], outJ = [], outW = [], outR = [];
  const edge = (a, b, x, y) => (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);

  for (let t = 0; t < I.length; t += 3) {
    const ids = [I[t], I[t + 1], I[t + 2]];
    const A = new T.Vector3().fromBufferAttribute(P, ids[0]);
    const B = new T.Vector3().fromBufferAttribute(P, ids[1]);
    const C = new T.Vector3().fromBufferAttribute(P, ids[2]);
    const face = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
    const cx = (A.x + B.x + C.x) / 3;

    let v;
    if (cx > 0.35 && face.x > 0.42 && face.x >= Math.max(Math.abs(face.y), Math.abs(face.z)) * 0.80) {
      v = 3; // front
    } else if (Math.abs(face.y) > Math.abs(face.z)) {
      v = face.y > 0 ? 1 : 2; // top or bottom
    } else {
      v = 0; // side
    }

    const [sx, sy, sw, sh] = rects[v];
    const [cu, cv, cw, ch] = refs[v].crop;
    const verts = ids.map((id) => {
      const point = new T.Vector3().fromBufferAttribute(P, id);
      const normal = new T.Vector3().fromBufferAttribute(N, id);
      const q = projection(names[v], point.x, point.y, point.z);
      const tx = sx + clamp((q[0] - cu) / Math.max(1, cw)) * (sw - 1);
      const ty = sy + clamp((q[1] - cv) / Math.max(1, ch)) * (sh - 1);
      outP.push(point.x, point.y, point.z);
      outN.push(normal.x, normal.y, normal.z);
      outUV.push(tx / 511, ty / 511);
      outR.push(author ? author.getX(id) : 0);
      if (g.attributes.skinIndex) {
        for (let c = 0; c < 4; c++) {
          outJ.push(g.attributes.skinIndex.array[id * 4 + c]);
          outW.push(g.attributes.skinWeight.array[id * 4 + c]);
        }
      }
      return { x: tx, y: ty, point, normal };
    });

    const [a, b, c] = verts;
    const area = edge(a, b, c.x, c.y);
    if (Math.abs(area) < 1e-7) continue;

    const minY = Math.max(sy, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(sy + sh - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const minX = Math.max(sx, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(sx + sw - 1, Math.ceil(Math.max(a.x, b.x, c.x)));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const u = edge(b, c, x + 0.5, y + 0.5) / area;
        const w = edge(c, a, x + 0.5, y + 0.5) / area;
        const z = 1 - u - w;
        if (u < 0 || w < 0 || z < 0) continue;

        const point = a.point.clone().multiplyScalar(u).addScaledVector(b.point, w).addScaledVector(c.point, z);
        const d = v === 0 ? Math.abs(point.z) : v === 1 ? point.y : v === 2 ? -point.y : point.x;
        const at = y * W + x;
        if (d <= depth[at]) continue;
        depth[at] = d;

        const normal = a.normal.clone().multiplyScalar(u).addScaledVector(b.normal, w).addScaledVector(c.normal, z).normalize();
        const frontGate = clamp((point.x - 0.35) / 0.22);
        const wSide = Math.pow(Math.abs(normal.z), 6);
        const wTop = Math.pow(Math.max(0, normal.y), 6);
        const wBot = Math.pow(Math.max(0, -normal.y), 6);
        const wFront = frontGate * Math.pow(Math.max(0, normal.x), 4) * 2.2;
        const weights = [wSide, wTop, wBot, wFront];
        const sum = weights[0] + weights[1] + weights[2] + weights[3];
        if (sum < 1e-8) weights[0] = 1;
        const total = Math.max(sum, 1e-8);

        const rgb = [0, 0, 0];
        for (let q = 0; q < 4; q++) {
          if (weights[q] <= 0) continue;
          const sCol = sampleViewColor(refs[q], point.x, point.y, point.z);
          const amt = weights[q] / total;
          rgb[0] += sCol[0] * amt;
          rgb[1] += sCol[1] * amt;
          rgb[2] += sCol[2] * amt;
        }
        atlas.set([Math.round(clamp(rgb[0], 0, 255)), Math.round(clamp(rgb[1], 0, 255)), Math.round(clamp(rgb[2], 0, 255))], at * 3);
      }
    }
  }

  // Copy 1px gutters so bilinear filtering never bleeds across tiles
  atlas.copy(atlas, 134 * W * 3, 133 * W * 3, 134 * W * 3);
  atlas.copy(atlas, 135 * W * 3, 136 * W * 3, 137 * W * 3);
  atlas.copy(atlas, 322 * W * 3, 321 * W * 3, 322 * W * 3);
  atlas.copy(atlas, 323 * W * 3, 324 * W * 3, 325 * W * 3);

  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(outP, 3));
  out.setAttribute('normal', new T.Float32BufferAttribute(outN, 3));
  out.setAttribute('uv', new T.Float32BufferAttribute(outUV, 2));
  out.setAttribute('authorRole', new T.Float32BufferAttribute(outR, 1));
  if (outJ.length) {
    out.setAttribute('skinIndex', new T.Uint16BufferAttribute(outJ, 4));
    out.setAttribute('skinWeight', new T.Float32BufferAttribute(outW, 4));
  }
  out.setIndex(Array.from({ length: outP.length / 3 }, (_, i) => i));
  const png = await sharp(atlas, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer();
  return { geometry: out, png };
}

function rigMammal(g) {
  const P = g.attributes.position, R = g.attributes.authorRole;
  g.computeBoundingBox();
  const box = g.boundingBox, len = box.max.x - box.min.x, cy = (box.min.y + box.max.y) * 0.5;
  const bones = BONE_NAMES.map((name) => { const b = new T.Bone(); b.name = name; return b; });
  const world = Array.from({ length: 6 }, (_, i) => new T.Vector3(box.max.x - len * (0.08 + i * 0.17), cy, 0));

  const roots = { L: [], R: [] };
  for (let i = 0; i < P.count; i++) {
    const r = R.getX(i);
    if (r === 1) roots.L.push(new T.Vector3().fromBufferAttribute(P, i));
    if (r === -1) roots.R.push(new T.Vector3().fromBufferAttribute(P, i));
  }
  for (const side of ['L', 'R']) {
    const all = roots[side], s = side === 'L' ? 1 : -1;
    const sorted = all.sort((a, b) => Math.abs(a.z) - Math.abs(b.z));
    const nSlice = Math.max(1, Math.floor(sorted.length * 0.12));
    const root = sorted.length
      ? sorted.slice(0, nSlice).reduce((a, b) => a.add(b), new T.Vector3()).multiplyScalar(1 / nSlice)
      : new T.Vector3(box.max.x - len * 0.34, cy - 0.05, s * 0.12);
    const tip = sorted.length
      ? sorted.slice(-nSlice).reduce((a, b) => a.add(b), new T.Vector3()).multiplyScalar(1 / nSlice)
      : root.clone().add(new T.Vector3(-0.18, -0.08, s * 0.28));
    world.push(root, tip);
  }

  const parent = [-1, 0, 1, 2, 3, 4, 1, 6, 1, 8];
  bones.forEach((b, i) => {
    b.position.copy(world[i]);
    if (parent[i] >= 0) { b.position.sub(world[parent[i]]); bones[parent[i]].add(b); }
  });
  bones[0].updateMatrixWorld(true);

  const joints = [], weights = [];
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    const f = clamp((world[0].x - x) / (len * 0.17), 0, 4.999999);
    const a = Math.floor(f), t = f - a;
    const role = R.getX(i);
    if (role === 1 || role === -1) {
      const base = role === 1 ? 6 : 8;
      const root = world[base], tip = world[base + 1];
      const u = clamp(Math.abs(z - root.z) / Math.max(0.02, Math.abs(tip.z - root.z)));
      joints.push(base, base + 1, 0, 0);
      weights.push(1 - u, u, 0, 0);
    } else {
      joints.push(a, a + 1, 0, 0);
      weights.push(1 - t, t, 0, 0);
    }
  }
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(joints, 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  return bones;
}

async function renderInspection(glbPath, outPath) {
  await MeshoptDecoder.ready;
  const buf = await readFile(glbPath);
  const jl = buf.readUInt32LE(12);
  const j = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  const bin = buf.subarray(20 + jl + 8);
  const iv = j.bufferViews[j.images[0].bufferView];
  const imgBytes = bin.subarray(iv.byteOffset || 0, (iv.byteOffset || 0) + iv.byteLength);
  const { data: texData, info: texInfo } = await sharp(imgBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const stub = { name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new T.Texture()) };
  const gltf = await new Promise((res, rej) =>
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(() => stub)
      .parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
  );
  let mesh = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const geom = mesh.geometry;
  const pos = geom.attributes.position, nor = geom.attributes.normal, uv = geom.attributes.uv, idx = geom.index;
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const P = [], N = [], UV = [];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    P.push([x, y, z]);
    N.push(norm3([nor.getX(i), nor.getY(i), nor.getZ(i)]));
    UV.push([uv.getX(i), uv.getY(i)]);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
  const L1 = norm3([0.35, 0.72, 0.60]), L2 = norm3([-0.55, -0.35, 0.55]);

  const S = 360, cols = 3, rows = 2, W = S * cols, H = S * rows;
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = 232; rgba[i * 4 + 1] = 237; rgba[i * 4 + 2] = 242; rgba[i * 4 + 3] = 255; }

  const views = [
    { label: 'SIDE',     yaw: 0,    pitch: 0,   col: 0, row: 0 },
    { label: '3/4 HERO', yaw: 32,   pitch: 18,  col: 1, row: 0 },
    { label: 'TOP',      yaw: 0,    pitch: 89,  col: 2, row: 0 },
    { label: 'FRONT',    yaw: 90,   pitch: 5,   col: 0, row: 1 },
    { label: 'REAR 3/4', yaw: -145, pitch: 22,  col: 1, row: 1 },
    { label: 'BOTTOM',   yaw: 0,    pitch: -89, col: 2, row: 1 },
  ];

  for (const { yaw, pitch, col, row } of views) {
    const cyaw = Math.cos((yaw * Math.PI) / 180), syaw = Math.sin((yaw * Math.PI) / 180);
    const cp = Math.cos((pitch * Math.PI) / 180), sp = Math.sin((pitch * Math.PI) / 180);
    const rotP = (v) => { const dx = v[0] - cx, dy = v[1] - cy, dz = v[2] - cz; const xr = dx * cyaw - dz * syaw, zr = dx * syaw + dz * cyaw; return [xr, dy * cp - zr * sp, dy * sp + zr * cp]; };
    const rotN = (n) => { const xr = n[0] * cyaw - n[2] * syaw, zr = n[0] * syaw + n[2] * cyaw; return [xr, n[1] * cp - zr * sp, n[1] * sp + zr * cp]; };
    const RP = P.map(rotP), RN = N.map(rotN);
    let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
    for (const r of RP) { px0 = Math.min(px0, r[0]); px1 = Math.max(px1, r[0]); py0 = Math.min(py0, r[1]); py1 = Math.max(py1, r[1]); }
    const scale = (S * 0.80) / Math.max(px1 - px0, py1 - py0, 0.001);
    const pcx = (px0 + px1) * 0.5, pcy = (py0 + py1) * 0.5;
    const R = RP.map((r) => [S * 0.5 + (r[0] - pcx) * scale, S * 0.5 - (r[1] - pcy) * scale, r[2]]);
    const zbuf = new Float32Array(S * S).fill(-1e9);

    for (let t = 0; t < idx.count; t += 3) {
      const i0 = idx.getX(t), i1 = idx.getX(t + 1), i2 = idx.getX(t + 2);
      const p0 = R[i0], p1 = R[i1], p2 = R[i2];
      const den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
      if (Math.abs(den) < 1e-4) continue;
      const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), maxx = Math.min(S - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
      const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), maxy = Math.min(S - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((p1[1] - p2[1]) * (px - p2[0]) + (p2[0] - p1[0]) * (py - p2[1])) / den;
        const w1 = ((p2[1] - p0[1]) * (px - p2[0]) + (p0[0] - p2[0]) * (py - p2[1])) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
        const z = p0[2] * w0 + p1[2] * w1 + p2[2] * w2;
        if (z <= zbuf[y * S + x]) continue;
        zbuf[y * S + x] = z;
        const rn = norm3([RN[i0][0] * w0 + RN[i1][0] * w1 + RN[i2][0] * w2, RN[i0][1] * w0 + RN[i1][1] * w1 + RN[i2][1] * w2, RN[i0][2] * w0 + RN[i1][2] * w1 + RN[i2][2] * w2]);
        if (rn[2] < 0) { rn[0] = -rn[0]; rn[1] = -rn[1]; rn[2] = -rn[2]; }
        const u = clamp(UV[i0][0] * w0 + UV[i1][0] * w1 + UV[i2][0] * w2);
        const v = clamp(UV[i0][1] * w0 + UV[i1][1] * w1 + UV[i2][1] * w2);
        const tx = Math.min(texInfo.width - 1, Math.floor(u * texInfo.width));
        const ty = Math.min(texInfo.height - 1, Math.floor(v * texInfo.height));
        const to = (ty * texInfo.width + tx) * 4;
        const l = 0.52 + Math.max(0, rn[0] * L1[0] + rn[1] * L1[1] + rn[2] * L1[2]) * 0.48 + Math.max(0, rn[0] * L2[0] + rn[1] * L2[1] + rn[2] * L2[2]) * 0.12;
        const o = ((row * S + y) * W + (col * S + x)) * 4;
        rgba[o] = clamp(Math.round(texData[to] * l), 0, 255);
        rgba[o + 1] = clamp(Math.round(texData[to + 1] * l), 0, 255);
        rgba[o + 2] = clamp(Math.round(texData[to + 2] * l), 0, 255);
        rgba[o + 3] = 255;
      }
    }
  }

  const labelSvg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    views.map((v) => `<text x="${v.col * S + 14}" y="${v.row * S + 26}" font-family="sans-serif" font-size="16" font-weight="bold" fill="#223044">${v.label}</text>`).join('') +
    `</svg>`,
  );
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: labelSvg, top: 0, left: 0 }])
    .webp({ quality: 92 })
    .toFile(outPath);
}

// Main CLI
const [key, sheetPath, ...flags] = process.argv.slice(2);
if (!key || !sheetPath) {
  console.error('Usage: node v4-build.mjs <key> <sheetPath> [--prepare-only] [--save-live]');
  process.exit(1);
}
const prepareOnly = flags.includes('--prepare-only');
const saveLive = flags.includes('--save-live');

const views = await prepareAndRegister(key, sheetPath);
if (prepareOnly) process.exit(0);

const item = { key, family: key, category: 'mammal' };
const hull = await buildCleanVisualHull(views, 2400);
hull.setAttribute('authorRole', new T.Float32BufferAttribute(new Float32Array(hull.attributes.position.count), 1));

const parts = [hull];
const appendages = buildSeamlessFlippers(views);
for (const g of appendages) {
  anchorAppendage(g, hull);
  const a = g.userData.appendage;
  const r = a.role === 'fore' ? (a.side === 'L' ? 1 : -1) : 0;
  g.setAttribute('authorRole', new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(r), 1));
  parts.push(g);
}
console.log(`[v4-build] ${key}: hull=${hull.index.count / 3} tris, appendages=${appendages.length} (${appendages.map((a) => `${a.userData.appendage.role}_${a.userData.appendage.side}:${a.userData.appendage.triangles}`).join(', ')})`);

let merged = mergeGeometries(parts, false);
const budget = 3400;
if (merged.index.count / 3 > budget) {
  await MeshoptSimplifier.ready;
  const [I] = MeshoptSimplifier.simplify(
    Uint32Array.from(merged.index.array),
    Float32Array.from(merged.attributes.position.array),
    3,
    budget * 3,
    0.04,
    ['Prune', 'Regularize'],
  );
  merged.setIndex(new T.BufferAttribute(I, 1));
  merged.computeVertexNormals();
}

const bones = rigMammal(merged);
const tex = await projectedTexture4ViewTight(merged, views);
const mesh = mergeVertices(tex.geometry, 1e-6);
mesh.computeBoundingBox();
const center = mesh.boundingBox.getCenter(new T.Vector3());
const scale = 2 / (mesh.boundingBox.max.x - mesh.boundingBox.min.x);
mesh.translate(-center.x, -center.y, -center.z);
mesh.scale(scale, scale, scale);
bones[0].position.sub(center);
bones.forEach((b) => b.position.multiplyScalar(scale));
bones[0].updateMatrixWorld(true);

const packed = finishPacked(
  packAsset(key, [{ name: key, geometry: mesh, extras: { aquaGeometry: 'visual-hull-v4', standardTenBones: true } }], tex.png, bones),
  item,
);
const bytes = await compressGLB(packed, { webpQuality: 90 });
const sha12 = createHash('sha256').update(bytes).digest('hex').slice(0, 12);

const previewGlb = resolve(V4_DIR, `${key}.glb`);
await writeFile(previewGlb, bytes);
await writeFile(resolve(V4_DIR, `${key}-atlas.png`), tex.png);
if (saveLive) {
  await writeFile(resolve(ROOT, `public/aqua/models/fish/${key}.glb`), bytes);
}

const inspectOut = resolve(V4_DIR, `${key}-inspect.webp`);
await renderInspection(previewGlb, inspectOut);
console.log(`[v4-done] ${key}: ${mesh.index.count / 3} tris, ${bytes.length} bytes, sha=${sha12}`);
console.log(`  GLB: ${previewGlb}`);
console.log(`  Inspect: ${inspectOut}`);
