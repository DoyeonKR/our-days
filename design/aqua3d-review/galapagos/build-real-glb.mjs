// 갈라파고스 50종 실사 기준 이미지 → 3D 튜브 GLB 일괄 제작기
// design/ART-GUIDE.md 및 design/aqua3d-review/whales/build.mjs 정식 파이프라인 기반:
// 1. 실사 투명 기준 이미지(public/aqua/fish/<key>.webp)에서 열마다 중심선 C[x] · 반두께 Rr[x] 측정
// 2. 종별 단면 비율(원통 · 타원 · 가오리/거북/게 납작 단면)로 둥근 3D 몸통 관 조형
// 3. 실사 사진 픽셀을 몸 둘레(상단 아틀라스) + 지느러미/다리/꼬리(하단 아틀라스)에 직접 투영
// 4. 뼈 10개(갈라파고스 펭귄 · 바다이구아나는 12개) + 바인드포즈 + 외향 법선 + meshopt/WebP 압축
import * as T from 'three';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compressGLB } from '../glb-compress.mjs';
import { packAsset } from '../shrimp-pack.mjs';
import { loadArt, relief, material, distance } from '../relief-build.mjs';
import { GALAPAGOS_KEYS } from '../../../src/lib/galapagos.ts';

const ROOT = resolve(process.cwd());
const GLB_DIR = resolve(ROOT, 'public/aqua/models/fish');

const CETACEANS = new Set(['spotted_dolphin', 'pilot_whale', 'brydes_whale']);
const WALKERS_12 = new Set(['galapagos_penguin', 'marine_iguana']);
const WIDE_FLAT = new Set(['marble_ray', 'golden_cownose_ray', 'spotted_eagle_ray', 'mobula_ray', 'sally_lightfoot_crab', 'hawksbill_turtle', 'loggerhead_turtle', 'leatherback_turtle', 'red_lipped_batfish', 'giant_clam']);
const DEEP_REEF = new Set(['galapagos_damselfish', 'moorish_idol', 'picasso_triggerfish', 'king_angelfish', 'clown_triggerfish', 'napoleon_wrasse', 'bumphead_parrotfish']);

function widthRatioFor(baseKey) {
  if (WIDE_FLAT.has(baseKey)) return 1.35;
  if (DEEP_REEF.has(baseKey)) return 0.52;
  if (CETACEANS.has(baseKey) || baseKey.includes('seal') || baseKey.includes('sea_lion') || baseKey.includes('penguin')) return 0.94;
  if (baseKey.includes('shark') || baseKey.includes('tuna') || baseKey.includes('wahoo') || baseKey.includes('marlin') || baseKey.includes('sailfish')) return 0.78;
  return 0.72;
}

async function buildOne(artKey, baseKey) {
  const art = await loadArt(`public/aqua/fish/${artKey}.webp`, 512);
  const { data, W, H } = art;
  const A = 45;

  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] > A ? 1 : 0;
  const dist = distance(mask, W, H);

  // 열마다 중심선(가장 깊은 점)과 반두께
  const cy = new Float32Array(W).fill(NaN);
  const rr = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let best = 0, by = -1;
    for (let y = 0; y < H; y++) {
      const d = dist[y * W + x];
      if (d > best) { best = d; by = y; }
    }
    if (by >= 0) { cy[x] = by; rr[x] = best; }
  }

  let rmax = 0;
  for (let x = 0; x < W; x++) rmax = Math.max(rmax, rr[x]);
  let best = [0, 0], s0 = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && rr[x] > rmax * 0.16;
    if (on && s0 < 0) s0 = x;
    if (!on && s0 >= 0) {
      if (x - s0 > best[1] - best[0]) best = [s0, x - 1];
      s0 = -1;
    }
  }
  let bx0 = best[0], bx1 = best[1];
  if (bx1 - bx0 < 24) {
    // 매우 가느다란 종(정원장어 등) 안전 처리
    bx0 = W; bx1 = 0;
    for (let x = 0; x < W; x++) if (rr[x] > 0) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); }
  }

  const sm = (arr, i, w) => {
    let s = 0, n = 0;
    for (let k = -w; k <= w; k++) {
      const j = Math.min(bx1, Math.max(bx0, i + k));
      if (Number.isFinite(arr[j])) { s += arr[j]; n++; }
    }
    return n ? s / n : H / 2;
  };
  const C = new Float32Array(W), Rr = new Float32Array(W);
  for (let x = bx0; x <= bx1; x++) {
    C[x] = sm(cy, x, 6);
    Rr[x] = Math.max(3, sm(rr, x, 5) * 1.05);
  }

  // 주둥이 끝까지 자연스럽게 확장
  let front = bx1;
  for (let x = bx1; x < W; x++) {
    for (let y = 0; y < H; y++) if (mask[y * W + x]) { front = x; break; }
  }
  if (front > bx1 && front - bx1 < W * 0.25) {
    for (let x = bx1 + 1; x <= front; x++) {
      let bt = -1, bb = -1, t = -1;
      for (let y = 0; y <= H; y++) {
        const on = y < H && mask[y * W + x];
        if (on && t < 0) t = y;
        if (!on && t >= 0) { if (y - 1 - t > bb - bt) [bt, bb] = [t, y - 1]; t = -1; }
      }
      if (bt < 0) continue;
      C[x] = (bt + bb) / 2;
      Rr[x] = Math.max(1.5, (bb - bt) / 2 * 0.92);
    }
    bx1 = front;
  }

  // 텍스처 아틀라스 (512x512): 위 반 = 몸 둘레 실사 투영, 아래 반 = 실사 원본(지느러미/꼬리/다리)
  const near = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H);
  let qa = 0, qb = 0;
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 140) { near[i] = i; q[qb++] = i; }
  if (qb === 0) for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 20) { near[i] = i; q[qb++] = i; }
  while (qa < qb) {
    const i = q[qa++], x = i % W;
    for (const j of [i - W, i + W, ...(x ? [i - 1] : []), ...(x < W - 1 ? [i + 1] : [])]) {
      if (j >= 0 && j < W * H && near[j] < 0) { near[j] = near[i]; q[qb++] = j; }
    }
  }
  const px = (x, y) => {
    x = Math.max(0, Math.min(W - 1, Math.round(x)));
    y = Math.max(0, Math.min(H - 1, Math.round(y)));
    const k = (near[y * W + x] >= 0 ? near[y * W + x] : y * W + x) * 4;
    return [data[k], data[k + 1], data[k + 2]];
  };

  const atlas = Buffer.alloc(512 * 512 * 3);
  for (let v = 0; v < 256; v++) {
    for (let u = 0; u < 512; u++) {
      const x = bx0 + (bx1 - bx0) * u / 511;
      const phi = v / 255 * Math.PI * 2;
      const xi = Math.max(bx0, Math.min(bx1, Math.round(x)));
      atlas.set(px(x, C[xi] - Math.cos(phi) * Rr[xi] * 0.78), (v * 512 + u) * 3);
    }
  }
  const fullRgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const k = (near[i] >= 0 ? near[i] : i) * 4;
    fullRgb[i * 3] = data[k];
    fullRgb[i * 3 + 1] = data[k + 1];
    fullRgb[i * 3 + 2] = data[k + 2];
  }
  const refHalf = await sharp(fullRgb, { raw: { width: W, height: H, channels: 3 } }).resize(512, 256, { fit: 'fill' }).raw().toBuffer();
  refHalf.copy(atlas, 512 * 256 * 3);
  const png = await sharp(atlas, { raw: { width: 512, height: 512, channels: 3 } }).png().toBuffer();

  // 3D 지오메트리 조립
  const P = [], UV = [], I = [];
  const vtx = (x, y, z, u, v) => { P.push(x, y, z); UV.push(u, v); return P.length / 3 - 1; };
  const refUV = (x, y) => [Math.max(0, Math.min(1, x / W)), Math.max(0.502, Math.min(0.998, (256 + y / H * 255) / 511))];

  const wr = widthRatioFor(baseKey);
  const N = 16;
  const step = Math.max(4, Math.floor((bx1 - bx0) / 36));
  const rings = [];
  for (let x = bx0; x <= bx1; x += step) {
    const xi = Math.min(bx1, Math.round(x));
    const r = Rr[xi], c = C[xi], ring = [];
    for (let j = 0; j <= N; j++) {
      const phi = j / N * Math.PI * 2;
      const cs = Math.cos(phi), sn = Math.sin(phi);
      ring.push(vtx(x, c - cs * r, sn * r * wr, (x - bx0) / Math.max(1, bx1 - bx0), (j / N * 252 + 1) / 511));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < N; j++) {
      const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1];
      I.push(a, c, b, b, c, d);
    }
  }
  // 앞·뒤 마개 닫기
  for (const [k, rev] of [[0, true], [rings.length - 1, false]]) {
    const x = bx0 + k * step;
    const xi = Math.min(bx1, Math.round(x));
    const ctr = vtx(x, C[xi], 0, Math.min(1, (x - bx0) / Math.max(1, bx1 - bx0)), 0.25);
    for (let j = 0; j < N; j++) {
      const a = rings[k][j], b = rings[k][j + 1];
      I.push(...(rev ? [ctr, b, a] : [ctr, a, b]));
    }
  }

  // 몸 밖의 지느러미 · 꼬리 · 다리 부속지 (실사 원본 그대로 투영)
  const rAt = (x) => Rr[Math.max(bx0, Math.min(bx1, Math.round(x)))];
  const cAt = (x) => C[Math.max(bx0, Math.min(bx1, Math.round(x)))];
  const isCetacean = CETACEANS.has(baseKey);
  const outside = (x, y) => (isCetacean && x < bx0) ? false : (x < bx0 || x > bx1 || Math.abs(y - cAt(x)) > rAt(x) * 0.92);

  let hasOutside = false;
  for (let y = 0; y < H && !hasOutside; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (mask[y * W + x] && outside(x, y)) { hasOutside = true; break; }
    }
  }

  const APP = [];
  if (hasOutside) {
    const app = relief(art, { depth: 0.018, round: 0.014, step: 2, alpha: A, inside: outside, targetTris: 1400 });
    for (const side of [-1, 1]) {
      const base = P.length / 3;
      const n = app.P.length / 3;
      for (let i = 0; i < n; i++) {
        const x = app.P[i * 3], y = app.P[i * 3 + 1], z = app.P[i * 3 + 2];
        const inBody = x >= bx0 && x <= bx1;
        const below = inBody && y > cAt(x);
        const off = inBody && below ? rAt(x) * wr * 0.45 : 0;
        APP.push([vtx(x, y, z + side * off, ...refUV(x, y)), side, x, y]);
      }
      for (const k of app.I) I.push(base + k);
    }
  }

  // 가슴지느러미 바깥쪽 벌리기 (위 · 앞에서 3D 입체감 확보)
  const mid = (bx0 + bx1) / 2;
  const attach = (x) => cAt(x) + rAt(x) * 0.55;
  for (const [v, side, x, y] of APP) {
    if (!(x > mid && x <= bx1)) continue;
    const dy = y - attach(x);
    if (dy <= 0) continue;
    P[v * 3 + 2] += side * dy * 0.72;
    P[v * 3 + 1] -= dy * 0.35;
  }

  // 고래류(돌고래 · 들쇠고래 · 브라이드고래) 수평 꼬리지느러미(flukes)
  if (isCetacean) {
    const L = Math.max(40, bx1 - bx0);
    const span = L * 0.24, chord = L * 0.13, cy0 = cAt(bx0);
    const uvTop = [(10 / 511), (1 / 511)], uvBot = [(10 / 511), (128 / 511)];
    for (const side of [-1, 1]) {
      const NU = 8, NV = 5, grid = [[], []];
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const zz = side * (rAt(bx0) * 0.3 + u * span);
        const xLead = bx0 - u * chord * 0.75;
        const cLen = chord * (1 - 0.65 * u);
        for (let j = 0; j <= NV; j++) {
          const v = j / NV;
          const xx = xLead - v * cLen;
          const thick = Math.max(1.2, rAt(bx0) * 0.28 * (1 - 0.65 * u) * Math.sin(v * Math.PI));
          grid[0].push(vtx(xx, cy0 - thick, zz, ...uvTop));
          grid[1].push(vtx(xx, cy0 + thick, zz, ...uvBot));
        }
      }
      const at = (h, i, j) => grid[h][i * (NV + 1) + j];
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        const q0 = [at(0, i, j), at(0, i, j + 1), at(0, i + 1, j), at(0, i + 1, j + 1)];
        const q1 = [at(1, i, j), at(1, i, j + 1), at(1, i + 1, j), at(1, i + 1, j + 1)];
        if (side > 0) I.push(q0[0], q0[2], q0[1], q0[1], q0[2], q0[3], q1[0], q1[1], q1[2], q1[1], q1[3], q1[2]);
        else I.push(q0[0], q0[1], q0[2], q0[1], q0[3], q0[2], q1[0], q1[2], q1[1], q1[1], q1[2], q1[3]);
      }
    }
  }

  // 픽셀 좌표 → 게임 좌표(+X 머리 · +Y 위 · 길이 2 · 가운데 원점)
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const nv = P.length / 3;
  for (let i = 0; i < nv; i++) {
    x0 = Math.min(x0, P[i * 3]); x1 = Math.max(x1, P[i * 3]);
    y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]);
  }
  const S = 2 / Math.max(1, x1 - x0);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    pos[i * 3] = (P[i * 3] - mx) * S;
    pos[i * 3 + 1] = (my - P[i * 3 + 1]) * S; // 이미지 Y↓ → 게임 Y↑
    pos[i * 3 + 2] = P[i * 3 + 2] * S;
  }

  // Y 반전으로 인해 삼각형 감김 방향을 바깥쪽으로 보정
  for (let i = 0; i < I.length; i += 3) {
    const tmp = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = tmp;
  }

  // 외향 감김 검증(전체 삼각형 법선이 무게중심 바깥을 향하도록)
  let outSum = 0;
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cxm = (pos[a] + pos[b] + pos[c]) / 3, cym = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3, czm = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    outSum += nx * cxm + ny * cym + nz * czm;
  }
  if (outSum < 0) {
    for (let i = 0; i < I.length; i += 3) { const tmp = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = tmp; }
  }

  // 뼈대 (기본 10개 · 갈라파고스 펭귄/바다이구아나는 leg_L/R 포함 12개)
  const BX = [0.75, 0.45, 0.15, -0.15, -0.45, -0.8];
  const hasLegs = WALKERS_12.has(baseKey);
  const names = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip', ...(hasLegs ? ['leg_L', 'leg_R'] : [])];
  const bones = names.map((nm) => { const b = new T.Bone(); b.name = nm; return b; });
  for (let i = 0; i < 6; i++) {
    bones[i].position.set(i ? BX[i] - BX[i - 1] : BX[0], 0, 0);
    if (i) bones[i - 1].add(bones[i]);
  }
  bones[1].add(bones[6]); bones[6].add(bones[7]);
  bones[1].add(bones[8]); bones[8].add(bones[9]);
  bones[6].position.set(-0.1, -0.05, 0.14); bones[7].position.set(-0.14, -0.06, 0.24);
  bones[8].position.set(-0.1, -0.05, -0.14); bones[9].position.set(-0.14, -0.06, -0.24);
  if (hasLegs) {
    bones[5].add(bones[10]); bones[10].position.set(0.06, -0.12, 0.08);
    bones[5].add(bones[11]); bones[11].position.set(0.06, -0.12, -0.08);
  }
  bones[0].updateMatrixWorld(true);

  // 정점 스키닝 가중치
  const J = new Uint16Array(nv * 4), Wgt = new Float32Array(nv * 4);
  const finSet = new Map();
  for (const [v, side, x, y] of APP) {
    if (x > mid && x <= bx1 && y > attach(x)) finSet.set(v, side);
  }
  for (let i = 0; i < nv; i++) {
    const fSide = finSet.get(i);
    if (fSide !== undefined) {
      J[i * 4] = fSide > 0 ? 6 : 8;
      Wgt[i * 4] = 1;
      continue;
    }
    const x = pos[i * 3];
    if (x >= BX[0]) { J[i * 4] = 0; Wgt[i * 4] = 1; }
    else if (x <= BX[5]) { J[i * 4] = 5; Wgt[i * 4] = 1; }
    else {
      let k = 0;
      while (k < 4 && x < BX[k + 1]) k++;
      const f = Math.max(0, Math.min(1, (BX[k] - x) / (BX[k] - BX[k + 1])));
      J[i * 4] = k; J[i * 4 + 1] = k + 1;
      Wgt[i * 4] = 1 - f; Wgt[i * 4 + 1] = f;
    }
  }

  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(J, 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(Wgt, 4));
  g.setIndex(I);
  g.computeVertexNormals();

  const glb = await compressGLB(
    material(
      packAsset(artKey, [{ name: artKey, geometry: g, extras: { aquaGeometry: 'reference-tube (galapagos)', source: `public/aqua/fish/${artKey}.webp` } }], png, bones),
      (m) => {
        m.name = 'painted_PBR_atlas';
        m.doubleSided = true;
        m.pbrMetallicRoughness.metallicFactor = 0.05;
        m.pbrMetallicRoughness.roughnessFactor = 0.56;
      }
    ),
    { webpQuality: 92 }
  );

  writeFileSync(resolve(GLB_DIR, `${artKey}.glb`), glb);
  return { tris: I.length / 3, bytes: glb.length };
}

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const onlySet = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').map((s) => s.trim())) : null;
const keys = onlySet ? GALAPAGOS_KEYS.filter((k) => onlySet.has(k)) : GALAPAGOS_KEYS;

console.log(`Building ${keys.length * 3} reference-photo 3D GLBs...`);
const t0 = Date.now();
let n = 0;
for (const baseKey of keys) {
  for (const prefix of ['', 'juv_', 'fry_']) {
    const artKey = `${prefix}${baseKey}`;
    await buildOne(artKey, baseKey);
    n++;
  }
  if (n % 30 === 0 || n === keys.length * 3) {
    console.log(`  [${n}/${keys.length * 3}] (${((Date.now() - t0) / 1000).toFixed(1)}s) last: ${baseKey}`);
  }
}
console.log(`Done! Built ${n} photorealistic reference-tube GLBs in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
