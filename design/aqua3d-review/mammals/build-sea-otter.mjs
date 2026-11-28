// 해달(Enhydra lutris) 3면(측면 + 등쪽 탑뷰 + 배쪽 바텀뷰) 실사 사진 투영 3D 빌더
// — 해달은 헤엄칠 때(등 위)와 수면에서 쉴 때(배 위, otterRoll) 양쪽이 다 보이므로
//   측면(side) · 등쪽(dorsal) · 배쪽(ventral) 3장의 실사 기준 이미지를 법선 방향으로 블렌딩 투영한다.
// 실행: node design/aqua3d-review/mammals/build-sea-otter.mjs
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

// sea_otter_side.png / sea_otter_dorsal.png 에서 계측한 몸통 + 굵고 납작한 꼬리 윤곽 (X in [-1.00, +1.00])
const SIDE_TOP = [
  [-1.00, 0.068], [-0.90, 0.057], [-0.80, 0.042], [-0.70, 0.045],
  [-0.60, 0.062], [-0.50, 0.102], [-0.40, 0.148], [-0.30, 0.198],
  [-0.20, 0.240], [-0.10, 0.263], [0.00, 0.276], [0.10, 0.281],
  [0.20, 0.273], [0.30, 0.260], [0.40, 0.246], [0.50, 0.256],
  [0.60, 0.308], [0.70, 0.354], [0.80, 0.356], [0.90, 0.312],
  [0.96, 0.265], [1.00, 0.215],
];
// 순수 몸통 배선(앞발·뒷발이 아래로 내려오는 구간은 매끄럽게 보간)
const SIDE_BOT = [
  [-1.00, 0.040], [-0.90, -0.012], [-0.80, -0.046], [-0.70, -0.062],
  [-0.60, -0.095], [-0.50, -0.145], [-0.40, -0.184], [-0.30, -0.184],
  [-0.20, -0.172], [-0.10, -0.186], [0.00, -0.197], [0.10, -0.202],
  [0.20, -0.204], [0.30, -0.198], [0.40, -0.188], [0.50, -0.168],
  [0.60, -0.114], [0.70, -0.032], [0.80, 0.058], [0.90, 0.112],
  [0.96, 0.155], [1.00, 0.195],
];
// 순수 몸통+꼬리 좌우 반폭(뒷발 돌출 구간은 매끄럽게 보간)
const DORSAL_HALF = [
  [-1.00, 0.014], [-0.90, 0.044], [-0.80, 0.062], [-0.70, 0.082],
  [-0.60, 0.108], [-0.50, 0.172], [-0.40, 0.242], [-0.30, 0.262],
  [-0.20, 0.256], [-0.10, 0.248], [0.00, 0.258], [0.10, 0.260],
  [0.20, 0.252], [0.30, 0.244], [0.40, 0.246], [0.50, 0.228],
  [0.60, 0.192], [0.70, 0.166], [0.80, 0.145], [0.90, 0.110],
  [0.96, 0.068], [1.00, 0.018],
];

function spineWeight(x) {
  const t = clamp((0.86 - x) / 1.76, 0, 1) * 5;
  const i = Math.min(4, Math.floor(t)), f = t - i;
  const sm = f * f * (3 - 2 * f);
  return sm < 0.01 ? [[i, 1]] : sm > 0.99 ? [[i + 1, 1]] : [[i, 1 - sm], [i + 1, sm]];
}

function buildSeaOtterModel(sideImg, dorsalImg, ventralImg, stage) {
  const m = new Model();
  const isFry = stage === 'fry', isJuv = stage === 'juv';
  const bright = isFry ? 0.92 : isJuv ? 0.96 : 1.0;
  const yOff = -0.05;

  // 1. 실사 윤곽 기반 복실복실한 해달 몸통 + 굵고 납작한 꼬리(X=-1.00 ~ +1.00)
  m.sweep('body', (s) => {
    const x = 1.00 - s * 2.00;
    const yt = interpTable(SIDE_TOP, x) + yOff;
    const yb = interpTable(SIDE_BOT, x) + yOff;
    const cy = (yt + yb) * 0.5;
    const a = Math.max(0.012, (yt - yb) * 0.5 * (isFry ? 1.08 : 1.0));
    const b = Math.max(0.012, interpTable(DORSAL_HALF, x) * (isFry ? 1.08 : 1.0));
    return {
      c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.12,
      r: (th) => {
        // 둥글고 볼록한 해달 수염 볼(whisker pads) + 꼬리는 수평 납작
        const cu = Math.cos(th), sv = Math.sin(th);
        if (x > 0.78 && x < 0.96 && cu < 0.15 && Math.abs(sv) > 0.35) return 1.08;
        return 1;
      },
    };
  }, {
    ns: 46, nt: 26, capStart: 0.024, capEnd: 0.022, island: [0.02, 0.02, 0.64, 0.62], bone: 'body',
    paint: (P, n) => {
      const sx = P[0];
      const sy = P[1] - yOff;
      const sz = P[2];
      const cSide = sideImg.sample(sx, sy, 4);
      const cDorsal = dorsalImg.sample(sx, sz, 4);
      const cVentral = ventralImg.sample(sx, sz, 4);

      // 법선 기반 3면 실사 블렌딩:
      // — 머리/얼굴(sx > 0.58): 측면의 크림빛 얼굴·검은 다이아몬드 코·눈·수염을 선명하게 유지, 정수리(n[1] > 0.55)만 dorsal 블렌딩
      // — 등쪽(n[1] > 0.18): dorsal 사진의 풍성한 초콜릿 브라운 등털
      // — 배쪽(n[1] < -0.22): ventral 사진의 밝은 크림빛 가슴털·배털 (수면에서 배를 뒤집어 쉴 때 리얼하게!)
      const headProtect = smooth(0.56, 0.74, sx);
      const topMix = smooth(0.18 + headProtect * 0.36, 0.76 + headProtect * 0.15, n[1]);
      const botMix = smooth(-0.20 - headProtect * 0.30, -0.72 - headProtect * 0.15, n[1]) * (1 - headProtect * 0.5);
      let col = mix(cSide, cDorsal, topMix);
      col = mix(col, cVentral, botMix);

      // 측면 사진에서 앞발/뒷발이 겹치는 하단 배 영역 보정
      if (sx > 0.14 && sx < 0.44 && sy < -0.14 && n[1] < -0.1) {
        col = mix(col, cVentral, 0.72);
      }
      return mul(col, bright);
    },
  });

  // 2. 짧고 둥근 해달 앞발(fin_L / fin_R) — 가슴 아래로 자연스럽게 모인 귀여운 두 손
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.28, -0.11 + yOff, sd * 0.16];
    const t = [0.34, -0.25 + yOff, sd * 0.10];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => {
      const cx = r[0] + (t[0] - r[0]) * s + Math.sin(s * Math.PI) * 0.04;
      const cy = r[1] + (t[1] - r[1]) * s;
      const cz = r[2] + (t[2] - r[2]) * s + sd * Math.sin(s * Math.PI) * 0.03;
      const rad = 0.068 * (0.95 - 0.25 * s) * (0.9 + 0.16 * Math.sin(s * Math.PI));
      return { c: [cx, cy, cz], u: [1, 0, 0], v: [0, 0, 1], a: rad * 1.1, b: rad * 0.78, e: 2.1 };
    }, {
      ns: 12, nt: 12, capStart: 0.025, capEnd: 0.024, island: [0.66, 0.02, 0.98, 0.48], bone: sd > 0 ? 6 : 8,
      paint: (P, n, [s]) => {
        const cPaw = sideImg.sample(0.28 + s * 0.06, -0.22 - s * 0.02, 3);
        return mul(cPaw, bright * (0.92 - 0.12 * s));
      },
    });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };

    // 3. 넓적하고 큰 물갈퀴 뒷발(hind_L / hind_R) — dorsal.png 에서 실제 부채꼴 물갈퀴 직접 투영
    m.sweep('hind' + sd, (s) => {
      const cx = -0.44 - s * 0.30;
      const cy = (-0.11 - s * 0.13) + yOff;
      const cz = sd * (0.14 + s * 0.19);
      const fanW = 0.062 + 0.058 * Math.sin(Math.pow(s, 0.65) * Math.PI * 0.9);
      const thick = 0.028 * (1 - 0.58 * s);
      return {
        c: [cx, cy, cz], u: [0, 1, 0], v: [0, 0, 1], a: thick, b: fanW, e: 2.15,
        r: (th) => 1 + (s > 0.72 ? 0.06 * Math.sin(th * 4) : 0),
      };
    }, {
      ns: 12, nt: 12, capStart: 0.025, capEnd: 0.020, island: [0.02, 0.66, 0.60, 0.98], bone: 5,
      paint: (P) => mul(dorsalImg.sample(P[0], P[2], 3), bright),
    });
  }

  // 4. 작고 둥근 귀(ear_L / ear_R) — 해달 머리 양옆의 귀여운 작은 귀
  for (const sd of [1, -1]) {
    m.sweep('ear' + sd, (s) => ({
      c: [0.71 - s * 0.03, (0.305 + s * 0.015) + yOff, sd * (0.145 + s * 0.024)],
      u: [0, 1, 0], v: [1, 0, 0], a: 0.018 * (1 - 0.55 * s), b: 0.014 * (1 - 0.55 * s), e: 2.0,
    }), {
      ns: 5, nt: 6, capEnd: 0.006, island: [0.66, 0.54, 0.96, 0.96], bone: 0,
      paint: () => mul([42, 34, 28], bright),
    });
  }

  return {
    m, fins, roughness: 0.68, // 풍성하고 복실복실한 해달 모피 질감(과도한 플라스틱 광택 방지)
    weight: (part, g, [s]) => {
      if (part.name === 'fin_L') {
        const rootW = Math.max(0, 1 - s / 0.30) * 0.5;
        const finW = 1 - rootW;
        return rootW > 0.01 ? [[1, rootW], [6, finW * (1 - s * 0.6)], [7, finW * s * 0.6]] : [[6, 1 - s * 0.6], [7, s * 0.6]];
      }
      if (part.name === 'fin_R') {
        const rootW = Math.max(0, 1 - s / 0.30) * 0.5;
        const finW = 1 - rootW;
        return rootW > 0.01 ? [[1, rootW], [8, finW * (1 - s * 0.6)], [9, finW * s * 0.6]] : [[8, 1 - s * 0.6], [9, s * 0.6]];
      }
      if (part.bone === 0) return [[0, 1]];
      if (part.bone === 5) return [[5, 1]];
      return spineWeight(g[0]);
    },
  };
}

const sideImg = await loadPhoto(resolve(process.cwd(), 'design/aqua3d-review/mammals/ref/sea_otter_side.png'));
const dorsalImg = await loadPhoto(resolve(process.cwd(), 'design/aqua3d-review/mammals/ref/sea_otter_dorsal.png'));
const ventralImg = await loadPhoto(resolve(process.cwd(), 'design/aqua3d-review/mammals/ref/sea_otter_ventral.png'));

for (const [prefix, stage] of [['', 'adult'], ['juv_', 'juv'], ['fry_', 'fry']]) {
  const key = `${prefix}sea_otter`;
  const { m, fins, roughness, weight } = buildSeaOtterModel(sideImg, dorsalImg, ventralImg, stage);
  const { glb, tris } = await bake(key, m, {
    fins,
    weight,
    source: 'mammals-photo-3view (sea_otter)',
    atlas: 1024,
    roughness,
    compress: { webpQuality: 90 },
  });
  if (tris > 8000 || glb.length > 300000) throw new Error(`Budget ${key}: ${tris} tris, ${glb.length} bytes`);
  writeFileSync(resolve(OUT_DIR, `${key}.glb`), glb);
  console.log(`PHOTO-3D ${key}: ${tris} tris, ${(glb.length / 1024).toFixed(1)} KB`);
}
