// 갈라파고스 물개(Arctocephalus galapagoensis) 실사 멀티뷰 투영 3D 빌더
// — 실제 생성한 측면(side) · 탑뷰(top) 실사 기준 이미지에서 몸통·지느러미발 윤곽을 그대로 계측하고,
//   법선 방향에 따라 측면 사진(얼굴·눈·코·수염·옆구리·배)과 탑뷰 사진(등털·어깨·지느러미발)을 블렌딩 투영한다.
// 실행: node design/aqua3d-review/galapagos/build-gala-fur-seal.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Model, bake, mix, smooth, clamp } from '../polar/kit.mjs';
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

const OUT_DIR = resolve(process.cwd(), 'public/aqua/models/fish');

// 1. 실사 기준 이미지(side, top) 로드 + 알파 마스크 기반 안전한 픽셀 샘플러(흰 테두리 방지)
async function loadPhoto(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const aspect = h / w;
  const alphaAt = (ix, iy) => data[(iy * w + ix) * 4 + 3];
  const rgbAt = (ix, iy) => {
    const o = (iy * w + ix) * 4;
    return [data[o], data[o + 1], data[o + 2]];
  };

  // 각 열(x)마다 유효 픽셀의 상·하 범위(yMin, yMax)를 미리 계산해 두어 경계 밖 샘플링 시 안쪽으로 안전하게 클램핑
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

  /** 모델 좌표 (x in [-1, 1], v in [-aspect, +aspect]) → 가장 가까운 내부 불투명 픽셀 RGB (바이리니어) */
  function sample(mx, mv, insetPx = 3) {
    const u = clamp((mx + 1) * 0.5, 0.002, 0.998);
    const fx = u * (w - 1);
    let ix = Math.round(fx);
    // 해당 열에 불투명 픽셀이 없으면 가장 가까운 유효 열을 찾는다
    if (colY1[ix] < colY0[ix]) {
      for (let d = 1; d < w; d++) {
        if (ix + d < w && colY1[ix + d] >= colY0[ix + d]) { ix = ix + d; break; }
        if (ix - d >= 0 && colY1[ix - d] >= colY0[ix - d]) { ix = ix - d; break; }
      }
    }
    const fyRaw = (0.5 - mv / (2 * aspect)) * (h - 1);
    const lo = Math.min(colY1[ix], colY0[ix] + insetPx);
    const hi = Math.max(colY0[ix], colY1[ix] - insetPx);
    let fy = clamp(fyRaw, lo, hi);
    const iy = Math.round(fy);

    // 여전히 반투명이면(예: 앞/뒷발 사이 빈틈) 열 내부에서 가장 가까운 불투명 픽셀로 이동
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

    // 2x2 바이리니어 보간(모두 불투명일 때만)
    const x0 = Math.min(w - 2, Math.max(0, Math.floor(fx)));
    const y0 = Math.min(h - 2, Math.max(0, Math.floor(fy)));
    const tx = clamp(fx - x0, 0, 1), ty = clamp(fy - y0, 0, 1);
    if (alphaAt(x0, y0) > 200 && alphaAt(x0 + 1, y0) > 200 && alphaAt(x0, y0 + 1) > 200 && alphaAt(x0 + 1, y0 + 1) > 200) {
      const c00 = rgbAt(x0, y0), c10 = rgbAt(x0 + 1, y0), c01 = rgbAt(x0, y0 + 1), c11 = rgbAt(x0 + 1, y0 + 1);
      return [0, 1, 2].map((k) => (c00[k] * (1 - tx) + c10[k] * tx) * (1 - ty) + (c01[k] * (1 - tx) + c11[k] * tx) * ty);
    }
    return rgbAt(ix, iy);
  }

  return { w, h, aspect, colY0, colY1, sample };
}

// 2. 선형 보간 테이블 유틸
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

// 실제 side.png / top.png 에서 계측한 갈라파고스 물개 몸통 윤곽 (X in [-0.66, +1.00])
// (앞지느러미발이 아래/옆으로 돌출하는 구간은 순수 몸통 곡선으로 자연스럽게 보간)
const SIDE_TOP = [
  [-0.66, -0.020], [-0.60, 0.043], [-0.50, 0.113], [-0.40, 0.173],
  [-0.30, 0.212], [-0.20, 0.244], [-0.10, 0.262], [0.00, 0.274],
  [0.10, 0.277], [0.20, 0.281], [0.30, 0.291], [0.40, 0.317],
  [0.50, 0.353], [0.60, 0.413], [0.70, 0.448], [0.80, 0.441],
  [0.90, 0.403], [0.96, 0.372], [1.00, 0.340],
];
const SIDE_BOT = [
  [-0.66, -0.145], [-0.60, -0.135], [-0.50, -0.121], [-0.40, -0.126],
  [-0.30, -0.143], [-0.20, -0.163], [-0.08, -0.185], [0.08, -0.200],
  [0.22, -0.205], [0.34, -0.195], [0.42, -0.165], [0.50, -0.111],
  [0.60, -0.038], [0.70, 0.051], [0.80, 0.172], [0.88, 0.204],
  [0.95, 0.245], [1.00, 0.318],
];
const TOP_HALF = [
  [-0.66, 0.088], [-0.60, 0.114], [-0.50, 0.132], [-0.40, 0.146],
  [-0.30, 0.168], [-0.15, 0.198], [0.00, 0.225], [0.15, 0.246],
  [0.30, 0.252], [0.40, 0.224], [0.50, 0.188], [0.60, 0.162],
  [0.70, 0.144], [0.80, 0.112], [0.90, 0.090], [0.96, 0.055],
  [1.00, 0.012],
];

// 척추 6본 가중치 (spine_0 머리 ~ spine_5 꼬리)
function spineWeight(x) {
  const t = clamp((0.86 - x) / 1.68, 0, 1) * 5;
  const i = Math.min(4, Math.floor(t)), f = t - i;
  const sm = f * f * (3 - 2 * f);
  return sm < 0.01 ? [[i, 1]] : sm > 0.99 ? [[i + 1, 1]] : [[i, 1 - sm], [i + 1, sm]];
}

function buildFurSealModel(sideImg, topImg, stage) {
  const m = new Model();
  const isFry = stage === 'fry', isJuv = stage === 'juv';
  const bright = isFry ? 0.88 : isJuv ? 0.95 : 1.0;
  // 모델 중심을 Y=0 부근으로 맞추기 위한 수직 오프셋 (side 사진의 몸통 중심이 Y≈+0.09)
  const yOff = -0.09;

  // 1. 실사 윤곽 기반 입체 몸통(body: 골반 X=-0.66 ~ 코끝 X=+1.00)
  m.sweep('body', (s) => {
    const x = 1.00 - s * 1.66;
    const yt = interpTable(SIDE_TOP, x) + yOff;
    const yb = interpTable(SIDE_BOT, x) + yOff;
    const cy = (yt + yb) * 0.5;
    const a = Math.max(0.014, (yt - yb) * 0.5 * (isFry ? 1.08 : 1.0));
    const b = Math.max(0.014, interpTable(TOP_HALF, x) * (isFry ? 1.08 : 1.0));
    return {
      c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.08,
      r: (th) => {
        // 주둥이(x > 0.82) 양옆 콧수염 볼 미세 볼륨 + 가슴/어깨 둥글게
        const cu = Math.cos(th), sv = Math.sin(th);
        if (x > 0.78 && x < 0.96 && cu < 0.15 && Math.abs(sv) > 0.45) return 1.06;
        return 1;
      },
    };
  }, {
    ns: 44, nt: 26, capStart: 0.022, capEnd: 0.032, island: [0.02, 0.02, 0.64, 0.62], bone: 'body',
    paint: (P, n) => {
      const sx = P[0];
      const sy = P[1] - yOff; // side 사진 원래 좌표로 복원
      const sz = P[2];
      const cSide = sideImg.sample(sx, sy, 4);
      const cTop = topImg.sample(sx, sz, 4);
      // 법선 기반 멀티뷰 블렌딩:
      // — 머리·주둥이 앞쪽(sx > 0.56)은 측면 사진의 눈·코·수염·귓바퀴 선명도를 우선하되 정수리(n[1] > 0.55)만 탑뷰 블렌딩
      // — 몸통 등쪽(n[1] > 0.18)은 탑뷰 사진의 실제 은빛 회갈색 등털을 부드럽게 블렌딩
      // — 옆구리 · 가슴 · 배는 측면 사진의 실제 털 결 · 명암을 그대로 유지
      const headProtect = smooth(0.54, 0.72, sx);
      const topMix = smooth(0.18 + headProtect * 0.36, 0.78 + headProtect * 0.14, n[1]);
      let col = mix(cSide, cTop, topMix);
      // 앞지느러미발이 측면 사진을 가리는 배 아래(sx ∈ [-0.12, 0.26], sy < -0.10)에서 어두운 지느러미 색이 몸통 배에 번지지 않게 위쪽 배털 샘플링
      if (sx > -0.14 && sx < 0.28 && sy < -0.06 && n[1] < -0.15) {
        const cleanBelly = sideImg.sample(sx, -0.04, 4);
        col = mix(col, cleanBelly, smooth(-0.06, -0.15, sy) * 0.85);
      }
      return mul(col, bright);
    },
  });

  // 2. 앞지느러미발(fin_L / fin_R) — top.png 의 실제 넓은 노(paddle) 위치 · 각도 · 곡선을 그대로 입체 조형 + top.png 직접 투영
  const fins = {};
  for (const sd of [1, -1]) {
    // 어깨가 몸통 안쪽(Z=±0.17)에 깊이 박혀 절대 벌어지지 않음 → 끝점(X=-0.22, Z=±0.51)
    const r = [0.16, -0.09 + yOff, sd * 0.17];
    const t = [-0.22, -0.34 + yOff, sd * 0.51];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => {
      // top.png 에서 측정한 앞쪽 볼록 곡선 + 뒤쪽 끝으로 우아하게 젖혀짐
      const fwd = Math.sin(Math.pow(s, 0.72) * Math.PI) * 0.15;
      const cx = r[0] + (t[0] - r[0]) * s + fwd;
      const cy = r[1] + (t[1] - r[1]) * s + Math.sin(s * Math.PI) * 0.03;
      const cz = r[2] + (t[2] - r[2]) * s;
      // 넓은 노(paddle) 폭: 어깨~끝 전까지 탄탄하게 유지되다 끝에서 둥글게 마감
      const chord = 0.165 * (0.78 + 0.36 * Math.sin(Math.pow(s, 0.72) * Math.PI)) * (1 - 0.24 * s * s);
      const thick = 0.032 * (1 - 0.66 * s);
      return {
        c: [cx, cy, cz], u: [1, 0.12, 0], v: [0, 1, 0], a: chord, b: thick, e: 2.1,
        r: (th) => {
          const c = Math.cos(th);
          // 뒤쪽 가장자리(-X)는 얇고 미세한 물결 주름(실제 물개 앞지느러미발 특징)
          if (c < 0) return (0.76 + 0.24 * (1 + c)) * (1 + 0.04 * Math.sin(s * Math.PI * 5));
          return 1.0;
        },
      };
    }, {
      ns: 18, nt: 14, capStart: 0.025, capEnd: 0.022, island: [0.66, 0.02, 0.98, 0.52], bone: sd > 0 ? 6 : 8,
      paint: (P, n, [s]) => {
        // top.png 에서 실제 앞지느러미발 픽셀 직접 투영 (어깨 뿌리는 몸통과 자연스럽게 이어짐)
        const cTop = topImg.sample(P[0], P[2], 3);
        const cBody = sideImg.sample(P[0], P[1] - yOff, 4);
        const col = mix(cBody, cTop, smooth(0.05, 0.28, s));
        return mul(col, bright);
      },
    });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };

    // 3. 뒷지느러미발(hind_L / hind_R) — top.png 의 좌우 대칭 부채꼴 물갈퀴 + 직접 사진 투영
    m.sweep('hind' + sd, (s) => {
      const cx = -0.60 - s * 0.40;
      const cy = (-0.09 - s * 0.07) + yOff;
      const cz = sd * (0.045 + s * 0.155);
      const fanW = 0.045 + 0.055 * Math.sin(Math.pow(s, 0.65) * Math.PI * 0.92);
      const thick = 0.024 * (1 - 0.62 * s);
      return {
        c: [cx, cy, cz], u: [0, 1, 0], v: [0, 0, 1], a: thick, b: fanW, e: 2.15,
        r: (th) => 1 + (s > 0.72 ? 0.06 * Math.sin(th * 3) : 0),
      };
    }, {
      ns: 12, nt: 10, capStart: 0.02, capEnd: 0.018, island: [0.02, 0.66, 0.56, 0.98], bone: 5,
      paint: (P) => mul(topImg.sample(P[0], P[2], 3), bright),
    });
  }

  // 4. 가운데 작은 꼬리(tail) — top.png 의 골반 뒤 짧은 삼각 꼬리
  m.sweep('tail', (s) => ({
    c: [-0.63 - s * 0.15, (-0.07 - s * 0.03) + yOff, 0], u: [0, 1, 0], v: [0, 0, 1],
    a: 0.030 * (1 - 0.78 * s), b: 0.034 * (1 - 0.78 * s), e: 2.0,
  }), {
    ns: 6, nt: 8, capEnd: 0.01, island: [0.60, 0.66, 0.80, 0.96], bone: 5,
    paint: (P) => mul(topImg.sample(P[0], P[2], 3), bright),
  });

  // 5. 작은 접힌 귓바퀴(pinnae) — top.png / side.png 의 귀 위치에 입체감 보강
  for (const sd of [1, -1]) {
    m.sweep('ear' + sd, (s) => ({
      c: [0.66 - s * 0.055, (0.365 - s * 0.012) + yOff, sd * (0.125 + s * 0.028)],
      u: [0, 1, 0], v: [1, 0, 0], a: 0.015 * (1 - 0.55 * s), b: 0.010 * (1 - 0.55 * s), e: 2.0,
    }), {
      ns: 5, nt: 6, capEnd: 0.004, island: [0.82, 0.66, 0.96, 0.96], bone: 0,
      paint: (P) => mul(sideImg.sample(P[0], P[1] - yOff, 3), bright * 0.82),
    });
  }

  return {
    m, fins, roughness: 0.50,
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
      if (part.bone === 0) return [[0, 1]];
      if (part.bone === 5) return [[5, 1]];
      return spineWeight(g[0]);
    },
  };
}

const sideImg = await loadPhoto(resolve(process.cwd(), 'design/aqua3d-review/galapagos/ref/galapagos_fur_seal_side.png'));
const topImg = await loadPhoto(resolve(process.cwd(), 'design/aqua3d-review/galapagos/ref/galapagos_fur_seal_top.png'));

for (const [prefix, stage] of [['', 'adult'], ['juv_', 'juv'], ['fry_', 'fry']]) {
  const key = `${prefix}galapagos_fur_seal`;
  const { m, fins, roughness, weight } = buildFurSealModel(sideImg, topImg, stage);
  const { glb, tris } = await bake(key, m, {
    fins,
    weight,
    source: 'galapagos-photo-multiview (galapagos_fur_seal)',
    atlas: 1024,
    roughness,
    compress: { webpQuality: 90 },
  });
  if (tris > 8000 || glb.length > 300000) throw new Error(`Budget ${key}: ${tris} tris, ${glb.length} bytes`);
  writeFileSync(resolve(OUT_DIR, `${key}.glb`), glb);
  console.log(`PHOTO-3D ${key}: ${tris} tris, ${(glb.length / 1024).toFixed(1)} KB`);
}
