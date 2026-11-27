// 실제 배포용 압축 GLB(EXT_meshopt_compression + KHR_mesh_quantization + EXT_texture_webp)를
// 직접 디코딩해 4각도(옆 · 3/4 · 위 · 정면)로 소프트웨어 래스터라이즈하여 육안 검수 시트를 만든다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import sharp from 'sharp';

await MeshoptDecoder.ready;
const ROOT = resolve(process.cwd());
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

async function loadGLBWithTexture(filePath) {
  const buf = readFileSync(filePath);
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
  return { geom: mesh.geometry, texData, tw: texInfo.width, th: texInfo.height };
}

function renderOne(geom, texData, tw, th, rgba, W, cellOx, cellOy, S) {
  const pos = geom.attributes.position, nor = geom.attributes.normal, uv = geom.attributes.uv, idx = geom.index;
  const nV = pos.count;
  const P = new Array(nV), N = new Array(nV), UV = new Array(nV);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < nV; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    P[i] = [x, y, z];
    N[i] = norm([nor.getX(i), nor.getY(i), nor.getZ(i)]);
    UV[i] = [uv.getX(i), uv.getY(i)];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
  const L1 = norm([0.38, 0.68, 0.62]), L2 = norm([-0.55, -0.35, 0.55]);
  const views = [
    { yaw: 0, pitch: 0, vx: 0, vy: 0 },
    { yaw: 30, pitch: 18, vx: S, vy: 0 },
    { yaw: 0, pitch: 88, vx: S * 2, vy: 0 },
    { yaw: 90, pitch: 8, vx: S * 3, vy: 0 },
  ];

  for (const { yaw, pitch, vx, vy } of views) {
    const cyaw = Math.cos(yaw * Math.PI / 180), syaw = Math.sin(yaw * Math.PI / 180);
    const cp = Math.cos(pitch * Math.PI / 180), sp = Math.sin(pitch * Math.PI / 180);
    const rotP = (v) => { const dx = v[0] - cx, dy = v[1] - cy, dz = v[2] - cz; const xr = dx * cyaw - dz * syaw, zr = dx * syaw + dz * cyaw; return [xr, dy * cp - zr * sp, dy * sp + zr * cp]; };
    const rotN = (n) => { const xr = n[0] * cyaw - n[2] * syaw, zr = n[0] * syaw + n[2] * cyaw; return [xr, n[1] * cp - zr * sp, n[1] * sp + zr * cp]; };
    let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
    const RP = P.map(rotP), RN = N.map(rotN);
    for (const r of RP) { if (r[0] < px0) px0 = r[0]; if (r[0] > px1) px1 = r[0]; if (r[1] < py0) py0 = r[1]; if (r[1] > py1) py1 = r[1]; }
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
        const rn = norm([RN[i0][0] * w0 + RN[i1][0] * w1 + RN[i2][0] * w2, RN[i0][1] * w0 + RN[i1][1] * w1 + RN[i2][1] * w2, RN[i0][2] * w0 + RN[i1][2] * w1 + RN[i2][2] * w2]);
        if (rn[2] < 0) { rn[0] = -rn[0]; rn[1] = -rn[1]; rn[2] = -rn[2]; }
        const u = clamp(UV[i0][0] * w0 + UV[i1][0] * w1 + UV[i2][0] * w2);
        const v = clamp(UV[i0][1] * w0 + UV[i1][1] * w1 + UV[i2][1] * w2);
        const tx = Math.min(tw - 1, Math.floor(u * tw)), ty = Math.min(th - 1, Math.floor(v * th));
        const to = (ty * tw + tx) * 4;
        const l = 0.46 + Math.max(0, rn[0] * L1[0] + rn[1] * L1[1] + rn[2] * L1[2]) * 0.54 + Math.max(0, rn[0] * L2[0] + rn[1] * L2[1] + rn[2] * L2[2]) * 0.14;
        const o = ((cellOy + vy + y) * W + (cellOx + vx + x)) * 4;
        rgba[o] = clamp(Math.round(texData[to] * l), 0, 255);
        rgba[o + 1] = clamp(Math.round(texData[to + 1] * l), 0, 255);
        rgba[o + 2] = clamp(Math.round(texData[to + 2] * l), 0, 255);
        rgba[o + 3] = 255;
      }
    }
  }
}

async function buildSheet(keys, outName) {
  const S = 224, W = S * 4, H = S * keys.length;
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = 240; rgba[i * 4 + 1] = 245; rgba[i * 4 + 2] = 250; rgba[i * 4 + 3] = 255; }
  for (let r = 0; r < keys.length; r++) {
    const k = keys[r];
    const { geom, texData, tw, th } = await loadGLBWithTexture(resolve(ROOT, `public/aqua/models/fish/${k}.glb`));
    renderOne(geom, texData, tw, th, rgba, W, 0, r * S, S);
  }
  const out = resolve(ROOT, `design/aqua3d-review/galapagos/${outName}`);
  await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90 }).toFile(out);
  console.log(`Rendered ${outName} (${keys.join(', ')})`);
}

await buildSheet(['scalloped_hammerhead', 'galapagos_penguin', 'marine_iguana', 'hawksbill_turtle', 'brydes_whale', 'spotted_eagle_ray'], 'glb_review_hero.webp');
await buildSheet(['king_angelfish', 'moorish_idol', 'sailfish', 'blacktip_reef_shark', 'yellowfin_tuna', 'picasso_triggerfish'], 'glb_review_fish.webp');
