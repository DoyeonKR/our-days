// 갈라파고스 상어(Carcharhinus galapagensis) 실사 멀티뷰(측면 + 탑뷰) 사진 투영 3D 빌더
// — 새로 생성한 정측면(side) · 정수직 탑뷰(top) 실사 기준 이미지에서 몸통·지느러미 윤곽을 그대로 계측하고
//   법선 방향에 따라 측면 사진(눈·5쌍 아가미틈·옆구리·흰 배·등/꼬리지느러미)과 탑뷰 사진(등피부·가슴/배지느러미)을 투영한다.
// 실행: node design/aqua3d-review/galapagos/build-gala-shark.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Model, bake, mix, smooth, clamp } from '../polar/kit.mjs';
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

const OUT_DIR = resolve(process.cwd(), 'public/aqua/models/fish');

async function loadPhoto(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const aspect = h / w;
  const alphaAt = (ix, iy) => data[(iy * w + ix) * 4 + 3];
  const rgbAt = (ix, iy) => {
    const o = (iy * w + ix) * 4;
    return [data[o], data[o + 1], data[o + 2]];
  };
  const colY0 = new Int32Array(w).fill(h);
  const colY1 = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (alphaAt(x, y) > 180) {
        if (y < colY0[x]) colY0[x] = y;
        if (y > colY1[x]) colY1[x] = y;
      }
    }
  }
  function sample(mx, mv, insetPx = 3) {
    const u = clamp((mx + 1) * 0.5, 0.002, 0.998);
    const fx = u * (w - 1);
    let ix = Math.round(fx);
    if (colY1[ix] < colY0[ix]) {
      for (let d = 1; d < w; d++) {
        if (ix + d < w && colY1[ix + d] >= colY0[ix + d]) { ix = ix + d; break; }
        if (ix - d >= 0 && colY1[ix - d] >= colY0[ix - d]) { ix = ix - d; break; }
      }
    }
    const fyRaw = (0.5 - mv / (2 * aspect)) * (h - 1);
    const lo = Math.min(colY1[ix], colY0[ix] + insetPx);
    const hi = Math.max(colY0[ix], colY1[ix] - insetPx);
    const fy = clamp(fyRaw, lo, hi);
    const iy = Math.round(fy);
    if (alphaAt(ix, iy) < 200) {
      let bestY = iy, bestD = 1e9;
      for (let y = lo; y <= hi; y++) {
        if (alphaAt(ix, y) >= 200) {
          const d = Math.abs(y - fyRaw);
          if (d < bestD) { bestD = d; bestY = y; }
        }
      }
      return rgbAt(ix, bestY);
    }
    const x0 = Math.min(w - 2, Math.max(0, Math.floor(fx)));
    const y0 = Math.min(h - 2, Math.max(0, Math.floor(fy)));
    const tx = clamp(fx - x0, 0, 1), ty = clamp(fy - y0, 0, 1);
    if (alphaAt(x0, y0) > 200 && alphaAt(x0 + 1, y0) > 200 && alphaAt(x0, y0 + 1) > 200 && alphaAt(x0 + 1, y0 + 1) > 200) {
      const c00 = rgbAt(x0, y0), c10 = rgbAt(x0 + 1, y0), c01 = rgbAt(x0, y0 + 1), c11 = rgbAt(x0 + 1, y0 + 1);
      return [0, 1, 2].map((k) => (c00[k] * (1 - tx) + c10[k] * tx) * (1 - ty) + (c01[k] * (1 - tx) + c11[k] * tx) * ty);
    }
    return rgbAt(ix, iy);
  }
  return { w, h, aspect, sample };
}

function interpTable(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0);
      const sm = t * t * (3 - 2 * t);
      return y0 + (y1 - y0) * sm;
    }
  }
  return pts[pts.length - 1][1];
}

// galapagos_shark_side.png / galapagos_shark_top.png 에서 계측한 순수 방추형 몸통 윤곽 (X in [-0.62, +1.00])
const SIDE_TOP = [
  [-0.62, 0.015], [-0.50, 0.032], [-0.40, 0.052], [-0.30, 0.075],
  [-0.20, 0.101], [-0.10, 0.125], [0.00, 0.155], [0.10, 0.172],
  [0.20, 0.178], [0.30, 0.176], [0.40, 0.164], [0.50, 0.149],
  [0.60, 0.127], [0.70, 0.100], [0.80, 0.070], [0.90, 0.035],
  [0.96, 0.012], [1.00, -0.013],
];
const SIDE_BOT = [
  [-0.62, -0.078], [-0.50, -0.094], [-0.40, -0.106], [-0.30, -0.118],
  [-0.20, -0.140], [-0.10, -0.160], [0.00, -0.174], [0.10, -0.180],
  [0.20, -0.182], [0.30, -0.180], [0.40, -0.178], [0.50, -0.175],
  [0.60, -0.166], [0.70, -0.150], [0.80, -0.128], [0.90, -0.076],
  [0.96, -0.045], [1.00, -0.023],
];
const TOP_HALF = [
  [-0.62, 0.034], [-0.50, 0.044], [-0.40, 0.057], [-0.30, 0.072],
  [-0.20, 0.088], [-0.10, 0.104], [0.00, 0.116], [0.10, 0.132],
  [0.20, 0.145], [0.30, 0.155], [0.40, 0.164], [0.50, 0.166],
  [0.60, 0.160], [0.70, 0.150], [0.80, 0.132], [0.90, 0.102],
  [0.96, 0.062], [1.00, 0.012],
];

function spineWeight(x) {
  const t = clamp((0.88 - x) / 1.82, 0, 1) * 5;
  const i = Math.min(4, Math.floor(t)), f = t - i;
  const sm = f * f * (3 - 2 * f);
  return sm < 0.01 ? [[i, 1]] : sm > 0.99 ? [[i + 1, 1]] : [[i, 1 - sm], [i + 1, sm]];
}

function buildGalapagosSharkModel(sideImg, topImg, stage) {
  const m = new Model();
  const isFry = stage === 'fry', isJuv = stage === 'juv';
  const bright = isFry ? 0.94 : isJuv ? 0.97 : 1.0;

  // 1. 유선형 방추형 상어 몸통(body: X=-0.62 ~ +1.00)
  m.sweep('body', (s) => {
    const x = 1.00 - s * 1.62;
    const yt = interpTable(SIDE_TOP, x);
    const yb = interpTable(SIDE_BOT, x);
    const cy = (yt + yb) * 0.5;
    const a = Math.max(0.012, (yt - yb) * 0.5);
    const b = Math.max(0.012, interpTable(TOP_HALF, x));
    return {
      c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.15,
      r: (th) => {
        // 주둥이(x > 0.72)는 수평으로 살짝 넓적하고 아래쪽이 평평한 흉상어 주둥이
        const cu = Math.cos(th);
        if (x > 0.72 && cu < -0.1) return 0.86;
        return 1;
      },
    };
  }, {
    ns: 44, nt: 26, capStart: 0.018, capEnd: 0.022, island: [0.02, 0.02, 0.62, 0.56], bone: 'body',
    paint: (P, n) => {
      const sx = P[0], sy = P[1], sz = P[2];
      const cSide = sideImg.sample(sx, sy, 4);
      const cTop = topImg.sample(sx, sz, 4);
      // 등쪽(n[1] > 0.35)은 top 사진(단, 등지느러미 그림자가 있는 중앙선 |sz|<0.05, sx∈[-0.08,0.22]는 측면 상단 피부색 유지)
      const dorsalShadow = sx > -0.10 && sx < 0.24 && Math.abs(sz) < 0.065 ? 1 : 0;
      const topMix = smooth(0.32, 0.80, n[1]) * (1 - dorsalShadow * 0.85);
      let col = mix(cSide, cTop, topMix);
      // 측면 사진에서 가슴지느러미가 배 옆을 가리는 구간(sx∈[0.14,0.44], sy<-0.06)은 깨끗한 앞쪽 흰 배 픽셀로 보정
      if (sx > 0.14 && sx < 0.44 && sy < -0.06) {
        const cleanBelly = sideImg.sample(0.52, sy, 4);
        col = mix(col, cleanBelly, smooth(-0.06, -0.14, sy) * 0.88);
      }
      return mul(col, bright);
    },
  });

  // 2. 제1등지느러미(dorsal1) — 몸통 등 안쪽(Y=0.11)에 깊이 박고 side.png 에서 직접 투영
  m.sweep('dorsal1', (s) => {
    const cy = 0.11 + s * 0.285;
    const cx = 0.14 - s * 0.055;
    const chord = 0.175 * Math.pow(1 - s * 0.84, 0.82);
    const thick = 0.026 * (1 - 0.78 * s);
    return { c: [cx, cy, 0], u: [1, 0, 0], v: [0, 0, 1], a: chord, b: thick, e: 2.0 };
  }, {
    ns: 14, nt: 10, capStart: 0.015, capEnd: 0.012, island: [0.66, 0.02, 0.98, 0.30], bone: 'body',
    paint: (P) => mul(sideImg.sample(P[0], P[1], 3), bright),
  });

  // 3. 제2등지느러미(dorsal2) & 뒷지느러미(anal)
  m.sweep('dorsal2', (s) => ({
    c: [-0.39 - s * 0.035, 0.03 + s * 0.068, 0], u: [1, 0, 0], v: [0, 0, 1],
    a: 0.058 * (1 - 0.76 * s), b: 0.012 * (1 - 0.75 * s), e: 2.0,
  }), {
    ns: 8, nt: 8, capEnd: 0.006, island: [0.66, 0.32, 0.82, 0.48], bone: 'body',
    paint: (P) => mul(sideImg.sample(P[0], P[1], 2), bright),
  });
  m.sweep('anal', (s) => ({
    c: [-0.40 - s * 0.035, -0.075 - s * 0.068, 0], u: [1, 0, 0], v: [0, 0, 1],
    a: 0.055 * (1 - 0.76 * s), b: 0.012 * (1 - 0.75 * s), e: 2.0,
  }), {
    ns: 8, nt: 8, capEnd: 0.006, island: [0.83, 0.32, 0.98, 0.48], bone: 'body',
    paint: (P) => mul(sideImg.sample(P[0], P[1], 2), bright),
  });

  // 4. 긴 낫형 가슴지느러미(fin_L / fin_R) — top.png 의 대칭 실루엣 그대로 조형 + top.png 직접 투영
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.36, -0.11, sd * 0.12];
    const t = [0.15, -0.26, sd * 0.45];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => {
      const fwd = Math.sin(Math.pow(s, 0.75) * Math.PI) * 0.07;
      const cx = r[0] + (t[0] - r[0]) * s + fwd;
      const cy = r[1] + (t[1] - r[1]) * s;
      const cz = r[2] + (t[2] - r[2]) * s;
      const chord = 0.135 * Math.pow(1 - s * 0.82, 0.78);
      const thick = 0.022 * (1 - 0.75 * s);
      return {
        c: [cx, cy, cz], u: [1, 0, 0], v: [0, 1, 0], a: chord, b: thick, e: 2.0,
        r: (th) => (Math.cos(th) < 0 ? 0.74 + 0.26 * (1 + Math.cos(th)) : 1.0),
      };
    }, {
      ns: 16, nt: 12, capStart: 0.02, capEnd: 0.014, island: [0.66, 0.50, 0.98, 0.96], bone: sd > 0 ? 6 : 8,
      paint: (P, n) => {
        // 윗면 · 앞날(n[1] >= -0.12)은 top.png 의 브론즈 그레이 지느러미, 아랫면만 밝은 회백색
        const cTop = topImg.sample(P[0], P[2], 3);
        const cBot = [212, 214, 212];
        return mul(mix(cBot, cTop, smooth(-0.62, -0.12, n[1])), bright);
      },
    });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };

    // 5. 배지느러미(pelvic_L / pelvic_R)
    m.sweep('pelvic' + sd, (s) => ({
      c: [-0.14 - s * 0.11, -0.115 - s * 0.055, sd * (0.065 + s * 0.105)],
      u: [1, 0, 0], v: [0, 1, 0], a: 0.072 * (1 - 0.72 * s), b: 0.012 * (1 - 0.7 * s), e: 2.0,
    }), {
      ns: 8, nt: 8, capStart: 0.012, capEnd: 0.008, island: [0.02, 0.60, 0.28, 0.96], bone: 'body',
      paint: (P, n) => mul(mix([206, 208, 206], topImg.sample(P[0], P[2], 2), smooth(-0.62, -0.12, n[1])), bright),
    });
  }

  // 6. 비대칭 초승달형 꼬리지느러미(tail_up 긴 상엽 + tail_lo 짧은 하엽) — 꼬리자루(X=-0.58)에 깊이 매립
  m.sweep('tail_up', (s) => {
    const cx = -0.57 - s * 0.43;
    const cy = -0.025 + Math.pow(s, 1.08) * 0.275;
    // 상어 꼬리 위쪽 끝 근처 노치(subterminal notch) 살짝 표현
    const notch = s > 0.78 && s < 0.88 ? 0.78 : 1.0;
    const chord = 0.088 * (1 - 0.76 * s) * notch;
    const thick = 0.018 * (1 - 0.78 * s);
    return { c: [cx, cy, 0], u: [0.55, 0.84, 0], v: [0, 0, 1], a: chord, b: thick, e: 2.0 };
  }, {
    ns: 14, nt: 10, capStart: 0.015, capEnd: 0.010, island: [0.30, 0.60, 0.64, 0.82], bone: 'body',
    paint: (P) => mul(sideImg.sample(P[0], P[1], 2), bright),
  });
  m.sweep('tail_lo', (s) => {
    const cx = -0.57 - s * 0.21;
    const cy = -0.045 - Math.pow(s, 1.05) * 0.195;
    const chord = 0.072 * (1 - 0.78 * s);
    const thick = 0.016 * (1 - 0.78 * s);
    return { c: [cx, cy, 0], u: [0.72, -0.70, 0], v: [0, 0, 1], a: chord, b: thick, e: 2.0 };
  }, {
    ns: 10, nt: 8, capStart: 0.012, capEnd: 0.008, island: [0.30, 0.83, 0.64, 0.98], bone: 'body',
    paint: (P) => mul(sideImg.sample(P[0], P[1], 2), bright),
  });

  return {
    m, fins, roughness: 0.36, // 매끄러운 상어 피부의 수중 광택
    weight: (part, g, [s]) => {
      if (part.name === 'fin_L') {
        const rootW = Math.max(0, 1 - s / 0.25) * 0.45;
        const finW = 1 - rootW;
        return rootW > 0.01 ? [[1, rootW], [6, finW * (1 - s * 0.65)], [7, finW * s * 0.65]] : [[6, 1 - s * 0.65], [7, s * 0.65]];
      }
      if (part.name === 'fin_R') {
        const rootW = Math.max(0, 1 - s / 0.25) * 0.45;
        const finW = 1 - rootW;
        return rootW > 0.01 ? [[1, rootW], [8, finW * (1 - s * 0.65)], [9, finW * s * 0.65]] : [[8, 1 - s * 0.65], [9, s * 0.65]];
      }
      return spineWeight(g[0]);
    },
  };
}

const sideImg = await loadPhoto(resolve(process.cwd(), 'design/aqua3d-review/galapagos/ref/galapagos_shark_side.png'));
const topImg = await loadPhoto(resolve(process.cwd(), 'design/aqua3d-review/galapagos/ref/galapagos_shark_top.png'));

for (const [prefix, stage] of [['', 'adult'], ['juv_', 'juv'], ['fry_', 'fry']]) {
  const key = `${prefix}galapagos_shark`;
  const { m, fins, roughness, weight } = buildGalapagosSharkModel(sideImg, topImg, stage);
  const { glb, tris } = await bake(key, m, {
    fins,
    weight,
    source: 'galapagos-photo-multiview (galapagos_shark)',
    atlas: 1024,
    roughness,
    compress: { webpQuality: 90 },
  });
  if (tris > 8000 || glb.length > 300000) throw new Error(`Budget ${key}: ${tris} tris, ${glb.length} bytes`);
  writeFileSync(resolve(OUT_DIR, `${key}.glb`), glb);
  console.log(`PHOTO-3D ${key}: ${tris} tris, ${(glb.length / 1024).toFixed(1)} KB`);
}
