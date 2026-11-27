// 갈라파고스 제도 50종 3D GLB 모델 + 2D 기준 이미지(512 · 160) 일괄 제작기
// polar/kit.mjs(부위별 3D 입체 sweep · 3D 아틀라스 채색 · 10/12뼈 리깅 · meshopt+WebP 압축) 기반.
// 실행: node design/aqua3d-review/galapagos/build-galapagos.mjs [--only key1,key2] [--skip-existing]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Model, bake, spineWeight, fbm, ridge, mix, smooth, clamp, norm, add, cross } from '../polar/kit.mjs';

const ROOT = resolve(process.cwd());
const GLB_DIR = resolve(ROOT, 'public/aqua/models/fish');
const IMG_DIR = resolve(ROOT, 'public/aqua/fish');
const SM_DIR = resolve(ROOT, 'public/aqua/fish/sm');
mkdirSync(GLB_DIR, { recursive: true });
mkdirSync(IMG_DIR, { recursive: true });
mkdirSync(SM_DIR, { recursive: true });

// ── 색상 · 무늬 도우미 ──
const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const addC = (c, d) => [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
const stageColor = (c, stage) => stage === 2 ? c : stage === 1 ? mix(c, [245, 248, 255], 0.08) : mix(c, [255, 252, 245], 0.22);

function makeEyePaint(irisHex = '#f5c542', pupilR = 0.56) {
  const iris = hex(irisHex);
  return (P, n, [s, t]) => {
    // s=0..1 along x, t=0..1 around circumference; outer side has |n[2]| large
    const facing = Math.abs(n[2]);
    const dx = (s - 0.52) * 2.1, dy = (n[1]) * 1.15;
    const r = Math.hypot(dx, dy);
    if (facing < 0.25) return mul(iris, 0.35);
    if (r < pupilR) {
      // glossy pupil with subtle catchlight
      const glint = Math.exp(-((dx - 0.16) ** 2 + (dy - 0.18) ** 2) * 42);
      return mix([12, 14, 18], [255, 255, 255], clamp(glint * 0.95));
    }
    const ring = smooth(pupilR, pupilR + 0.12, r) * (1 - smooth(0.84, 1.0, r));
    const col = mix(mul(iris, 0.45), iris, ring);
    const glint2 = Math.exp(-((dx - 0.2) ** 2 + (dy - 0.22) ** 2) * 24) * 0.45;
    return mix(col, [255, 255, 255], glint2);
  };
}

function addEyes(m, x, y, z, r, irisHex = '#f0c040', islandBase = [0.88, 0.88, 0.99, 0.99]) {
  const paint = makeEyePaint(irisHex);
  m.sphere('eye_L', [x, y, z], r, { island: islandBase, paint, bone: 0 });
  m.sphere('eye_R', [x, y, -z], r, { island: islandBase, paint, bone: 0 });
}

// ── 3D 메쉬에서 고해상도 2D 기준 카드(512x512 · 160x160 투명 WebP) 직접 렌더링 ──
// 2x 슈퍼샘플링(1024x1024 → Lanczos3 512x512) + 3/4 옆모습 스튜디오 + 수중 림 라이트
async function render2DCard(model, artKey, yawDeg = 11, pitchDeg = 6) {
  const W = 768, H = 768;
  // 모델 바운딩 계산
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of model.parts) {
    for (const v of p.P) {
      if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0];
      if (v[1] < y0) y0 = v[1]; if (v[1] > y1) y1 = v[1];
      if (v[2] < z0) z0 = v[2]; if (v[2] > z1) z1 = v[2];
    }
  }
  const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
  const cyaw = Math.cos(yawDeg * Math.PI / 180), syaw = Math.sin(yawDeg * Math.PI / 180);
  const cpitch = Math.cos(pitchDeg * Math.PI / 180), spitch = Math.sin(pitchDeg * Math.PI / 180);
  const rotP = (v) => {
    const dx = v[0] - cx, dy = v[1] - cy, dz = v[2] - cz;
    const x1r = dx * cyaw - dz * syaw;
    const z1r = dx * syaw + dz * cyaw;
    const y2r = dy * cpitch - z1r * spitch;
    const z2r = dy * spitch + z1r * cpitch;
    return [x1r, y2r, z2r];
  };
  const rotN = (n) => {
    const x1r = n[0] * cyaw - n[2] * syaw;
    const z1r = n[0] * syaw + n[2] * cyaw;
    const y2r = n[1] * cpitch - z1r * spitch;
    const z2r = n[1] * spitch + z1r * cpitch;
    return [x1r, y2r, z2r];
  };

  // 투영 범위 계산 (여백 10%)
  let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
  for (const p of model.parts) {
    for (const v of p.P) {
      const r = rotP(v);
      if (r[0] < px0) px0 = r[0]; if (r[0] > px1) px1 = r[0];
      if (r[1] < py0) py0 = r[1]; if (r[1] > py1) py1 = r[1];
    }
  }
  const span = Math.max(px1 - px0, py1 - py0, 0.001);
  const scale = (W * 0.82) / span;
  const pcx = (px0 + px1) * 0.5, pcy = (py0 + py1) * 0.5;

  const rgba = new Uint8Array(W * H * 4);
  const zbuf = new Float32Array(W * H).fill(-1e9);

  // 조명 벡터 (키 라이트 · 필 라이트 · 림 라이트)
  const L1 = norm([0.38, 0.68, 0.62]);
  const L2 = norm([-0.55, -0.35, 0.55]);
  const H1 = norm([L1[0], L1[1], L1[2] + 1]);

  for (const part of model.parts) {
    const isEye = part.name.startsWith('eye');
    // 법선 계산 (아직 없으면)
    let N = part.N;
    if (!N) {
      N = part.P.map(() => [0, 0, 0]);
      for (let i = 0; i < part.I.length; i += 3) {
        const a = part.I[i], b = part.I[i + 1], c = part.I[i + 2];
        const fn = cross(add(part.P[b], part.P[a], -1), add(part.P[c], part.P[a], -1));
        N[a] = add(N[a], fn); N[b] = add(N[b], fn); N[c] = add(N[c], fn);
      }
      N = N.map(norm);
    }
    const R = part.P.map((v) => {
      const r = rotP(v);
      return [W * 0.5 + (r[0] - pcx) * scale, H * 0.5 - (r[1] - pcy) * scale, r[2]];
    });
    const RN = N.map(rotN);

    for (let i = 0; i < part.I.length; i += 3) {
      const i0 = part.I[i], i1 = part.I[i + 1], i2 = part.I[i + 2];
      const p0 = R[i0], p1 = R[i1], p2 = R[i2];
      const den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
      if (Math.abs(den) < 1e-4) continue;
      const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
      const maxx = Math.min(W - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
      const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
      const maxy = Math.min(H - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
      for (let y = miny; y <= maxy; y++) {
        for (let x = minx; x <= maxx; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((p1[1] - p2[1]) * (px - p2[0]) + (p2[0] - p1[0]) * (py - p2[1])) / den;
          const w1 = ((p2[1] - p0[1]) * (px - p2[0]) + (p0[0] - p2[0]) * (py - p2[1])) / den;
          const w2 = 1 - w0 - w1;
          if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
          const z = p0[2] * w0 + p1[2] * w1 + p2[2] * w2;
          const idx = y * W + x;
          if (z <= zbuf[idx]) continue;
          zbuf[idx] = z;

          const P3 = [
            part.P[i0][0] * w0 + part.P[i1][0] * w1 + part.P[i2][0] * w2,
            part.P[i0][1] * w0 + part.P[i1][1] * w1 + part.P[i2][1] * w2,
            part.P[i0][2] * w0 + part.P[i1][2] * w1 + part.P[i2][2] * w2,
          ];
          const n3 = norm([
            N[i0][0] * w0 + N[i1][0] * w1 + N[i2][0] * w2,
            N[i0][1] * w0 + N[i1][1] * w1 + N[i2][1] * w2,
            N[i0][2] * w0 + N[i1][2] * w1 + N[i2][2] * w2,
          ]);
          const rn = norm([
            RN[i0][0] * w0 + RN[i1][0] * w1 + RN[i2][0] * w2,
            RN[i0][1] * w0 + RN[i1][1] * w1 + RN[i2][1] * w2,
            RN[i0][2] * w0 + RN[i1][2] * w1 + RN[i2][2] * w2,
          ]);
          // 양면 처리
          if (rn[2] < 0) { rn[0] = -rn[0]; rn[1] = -rn[1]; rn[2] = -rn[2]; }
          const st = [
            part.ST[i0][0] * w0 + part.ST[i1][0] * w1 + part.ST[i2][0] * w2,
            part.ST[i0][1] * w0 + part.ST[i1][1] * w1 + part.ST[i2][1] * w2,
          ];
          const base = part.paint(P3, n3, st);
          const ndl1 = Math.max(0, rn[0] * L1[0] + rn[1] * L1[1] + rn[2] * L1[2]);
          const ndl2 = Math.max(0, rn[0] * L2[0] + rn[1] * L2[1] + rn[2] * L2[2]);
          const rim = Math.pow(1 - clamp(rn[2], 0, 1), 2.6);
          const specPow = isEye ? 48 : 16;
          const specStr = isEye ? 0.55 : 0.14;
          const ndh = Math.max(0, rn[0] * H1[0] + rn[1] * H1[1] + rn[2] * H1[2]);
          const spec = Math.pow(ndh, specPow) * specStr;

          const light = 0.42 + ndl1 * 0.62 + ndl2 * 0.16;
          const rC = base[0] * light + rim * 28 + spec * 255;
          const gC = base[1] * light + rim * 44 + spec * 255;
          const bC = base[2] * light + rim * 54 + spec * 255;

          const o = idx * 4;
          rgba[o] = clamp(Math.round(rC), 0, 255);
          rgba[o + 1] = clamp(Math.round(gC), 0, 255);
          rgba[o + 2] = clamp(Math.round(bC), 0, 255);
          rgba[o + 3] = 255;
        }
      }
    }
  }

  const baseImg = sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } });
  await baseImg.clone().resize(512, 512, { kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 95 }).toFile(resolve(IMG_DIR, `${artKey}.webp`));
  await baseImg.clone().resize(160, 160, { kernel: 'lanczos3' }).webp({ quality: 86, alphaQuality: 92 }).toFile(resolve(SM_DIR, `${artKey}.webp`));
}

// ── 공통 지느러미 빌더 ──
function addFinRibbon(m, name, { x0, x1, yBase, yTip, zOff = 0, thick = 0.018, sweep = 0, island, paint, bone, ns = 12, nt = 8 }) {
  m.sweep(name, (s) => {
    const x = x0 + (x1 - x0) * s;
    const h = yTip(s);
    const yb = typeof yBase === 'function' ? yBase(s) : yBase;
    const dir = h >= 0 ? 1 : -1;
    const midY = yb + h * 0.5;
    const a = Math.max(0.01, Math.abs(h) * 0.5);
    const b = thick * (0.4 + 0.6 * Math.sin(s * Math.PI));
    return { c: [x + sweep * (1 - Math.abs(s - 0.5) * 2), midY, zOff], u: [0, dir, 0], v: [0, 0, 1], a, b, e: 1.8 };
  }, { ns, nt, capStart: 0.012, capEnd: 0.012, island, paint, bone });
}

function addPectorals(m, { x, y, z, len, w, thick = 0.016, sweepX = -0.18, droopY = -0.14, island, paint }) {
  for (const side of [1, -1]) {
    const nm = side > 0 ? 'fin_L' : 'fin_R';
    m.sweep(nm, (s) => {
      const k = Math.sin(clamp(s, 0.03, 0.97) * Math.PI);
      const px = x + sweepX * s;
      const py = y + droopY * s;
      const pz = side * (z + len * s);
      const a = w * (0.35 + 0.65 * Math.pow(k, 0.65)) * (1 - 0.3 * s);
      const b = thick * (1 - 0.55 * s);
      return { c: [px, py, pz], u: [1, 0.15, 0], v: [0, 1, 0], a, b, e: 2.0 };
    }, { ns: 10, nt: 8, capEnd: 0.015, island, paint, bone: side > 0 ? 6 : 8 });
  }
  return {
    L: { root: [x, y, z], tip: [x + sweepX, y + droopY, z + len] },
    R: { root: [x, y, -z], tip: [x + sweepX, y + droopY, -(z + len)] },
  };
}

function addTailFork(m, { x0, x1, spanY, fork = 0.45, asymTop = 1.0, asymBot = 1.0, thick = 0.022, island, paint }) {
  // 상엽
  m.sweep('tail_top', (s) => {
    const x = x0 + (x1 - x0) * s;
    const y = s * spanY * asymTop * (0.65 + 0.35 * s);
    const a = spanY * 0.24 * asymTop * (1 - 0.45 * s) * (1 - fork * 0.35 * s);
    const b = thick * (1 - 0.65 * s);
    return { c: [x, y, 0], u: [0.35, 0.93, 0], v: [0, 0, 1], a: Math.max(0.012, a), b, e: 1.8 };
  }, { ns: 12, nt: 8, capEnd: 0.015, island, paint, bone: 5 });
  // 하엽
  m.sweep('tail_bot', (s) => {
    const x = x0 + (x1 - x0) * s;
    const y = -s * spanY * asymBot * (0.65 + 0.35 * s);
    const a = spanY * 0.24 * asymBot * (1 - 0.45 * s) * (1 - fork * 0.35 * s);
    const b = thick * (1 - 0.65 * s);
    return { c: [x, y, 0], u: [0.35, -0.93, 0], v: [0, 0, 1], a: Math.max(0.012, a), b, e: 1.8 };
  }, { ns: 12, nt: 8, capEnd: 0.015, island, paint, bone: 5 });
}

// ── 표준 가중치 함수 ──
function defaultWeight(part, g, [s]) {
  if (part.name === 'fin_L') return [[6, clamp(1 - s * 0.85, 0.15, 1)], [7, clamp(s * 0.85, 0, 0.85)]];
  if (part.name === 'fin_R') return [[8, clamp(1 - s * 0.85, 0.15, 1)], [9, clamp(s * 0.85, 0, 0.85)]];
  if (part.name === 'leg_L') return [[10, 1]];
  if (part.name === 'leg_R') return [[11, 1]];
  if (part.bone !== undefined && part.bone >= 6) return [[part.bone, 1]];
  return spineWeight(g[0]);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. 리프 · 산호초 어류 빌더 (reef_fish / trigger_fish / mandarin_fish / puffer_fish)
// ════════════════════════════════════════════════════════════════════════════
function buildFish(spec, stage) {
  const m = new Model();
  const sK = stage === 2 ? 1 : stage === 1 ? 0.92 : 0.82;
  const eyeK = stage === 2 ? 1 : stage === 1 ? 1.2 : 1.45;
  const cTop = stageColor(hex(spec.top), stage);
  const cMid = stageColor(hex(spec.mid), stage);
  const cBot = stageColor(hex(spec.bot), stage);
  const cAcc = stageColor(hex(spec.acc || spec.top), stage);
  const cFin = stageColor(hex(spec.fin || spec.mid), stage);

  const bodyH = (spec.h ?? 0.36) * (stage === 0 ? 1.12 : 1);
  const bodyW = (spec.w ?? 0.16) * (stage === 0 ? 1.15 : 1);
  const len = spec.len ?? 1.8;
  const hump = spec.hump ?? 0;

  const paintBody = (P, n, [s, t]) => {
    const ny = clamp((P[1] / Math.max(0.08, bodyH) + 1) * 0.5, 0, 1);
    let col = ny > 0.5 ? mix(cMid, cTop, (ny - 0.5) * 2) : mix(cBot, cMid, ny * 2);
    const sc = ridge([P[0] * 14, P[1] * 14, P[2] * 14], 2);
    col = mul(col, 0.92 + sc * 0.14);

    if (spec.pattern === 'bars') {
      const b = Math.sin(P[0] * (spec.barFreq ?? 11) + (spec.barPhase ?? 0));
      if (b > (spec.barCut ?? 0.35)) col = mix(col, cAcc, smooth(spec.barCut ?? 0.35, 0.72, b));
    } else if (spec.pattern === 'moorish') {
      // 깃대돔: 굵은 검정/흰색/노랑 세로 띠
      if (P[0] > 0.25 && P[0] < 0.62) col = hex('#181a20');
      else if (P[0] > -0.22 && P[0] < 0.1) col = hex('#181a20');
      else if (P[0] < -0.22 && P[0] > -0.58) col = mix(hex('#f5d142'), hex('#fff7d6'), 0.35);
      else if (P[0] >= 0.62) col = mix(hex('#f5c040'), hex('#fff8ec'), smooth(0.62, 0.72, P[0]));
      else col = hex('#f6f8fb');
    } else if (spec.pattern === 'king_angel') {
      // 킹 엔젤피쉬: 깊은 코발트블루 + 선명한 흰색 수직 띠 + 주황 테두리
      const band = Math.exp(-Math.pow((P[0] - 0.18) * 10, 2));
      col = mix(col, [248, 250, 255], clamp(band * 1.1));
      if (P[0] < -0.42) col = mix(col, hex('#ff9c2a'), smooth(-0.42, -0.62, P[0]));
    } else if (spec.pattern === 'hogfish') {
      // 스패니시 호그피쉬: 앞쪽 등 보라-자주 + 뒤/배 선명한 황금노랑
      const diag = smooth(-0.18, 0.25, P[0] * 0.7 + P[1] * 1.1);
      col = mix(cBot, cTop, diag);
    } else if (spec.pattern === 'picasso') {
      // 피카소 쥐치: 기하학적 검은/파란/주황 대각선 무늬
      const d1 = Math.abs((P[0] + P[1] * 1.1) - 0.05);
      const d2 = Math.abs((P[0] - P[1] * 1.4) - 0.15);
      if (d1 < 0.08) col = hex('#1c2028');
      else if (d2 < 0.055) col = hex('#3cb4e5');
      else if (P[0] > 0.35 && P[1] < 0) col = hex('#f29c2b');
    } else if (spec.pattern === 'clown_trigger') {
      // 광대쥐치: 배에 큰 흰 물방울 + 등에 노란 벌집 무늬
      if (P[1] < 0.02) {
        const sp = Math.sin(P[0] * 16) * Math.sin(P[1] * 18 + P[2] * 12);
        if (sp > 0.35) col = [248, 250, 252];
      } else {
        const net = ridge([P[0] * 15, P[1] * 15, P[2] * 10], 2);
        col = mix(hex('#1e2228'), hex('#e8c838'), smooth(0.55, 0.75, net));
      }
      if (P[0] > 0.58) col = hex('#f5b427');
    } else if (spec.pattern === 'mandarin') {
      // 만다린 피쉬: 형광 파랑 · 주황 · 청록 소용돌이 미로 무늬
      const w = Math.sin(P[0] * 14 + fbm([P[0] * 5, P[1] * 5, P[2] * 5], 3) * 7);
      if (w > 0.35) col = hex('#19b5ff');
      else if (w < -0.35) col = hex('#ff6a1a');
      else col = hex('#102636');
    } else if (spec.pattern === 'spots') {
      const f = fbm([P[0] * (spec.spotFreq ?? 9), P[1] * (spec.spotFreq ?? 9), P[2] * (spec.spotFreq ?? 9)], 3);
      if (f > (spec.spotCut ?? 0.62)) col = mix(col, cAcc, smooth(spec.spotCut ?? 0.62, 0.74, f));
    } else if (spec.pattern === 'puffer') {
      const sp = fbm([P[0] * 11, P[1] * 11, P[2] * 11], 3);
      if (sp > 0.63 && P[1] > -0.15) col = hex('#2c241c');
    } else if (spec.pattern === 'napoleon') {
      const w = Math.sin(P[0] * 18 + P[1] * 12 + fbm([P[0] * 6, P[1] * 6, P[2] * 6], 2) * 4);
      col = mix(col, cAcc, smooth(0.45, 0.8, w) * 0.55);
    } else if (spec.pattern === 'skipjack') {
      if (P[1] < 0.02) {
        const st = Math.sin(P[1] * 42);
        if (st > 0.45) col = mix(col, hex('#2a3b58'), 0.75);
      }
    }
    // 아가미선(살짝 어두운 호)
    const gillD = Math.abs(P[0] - len * 0.22 + P[1] * 0.25);
    if (gillD < 0.018 && Math.abs(P[1]) < bodyH * 0.65 && Math.abs(n[2]) > 0.3) col = mul(col, 0.68);
    return col;
  };

  const paintFin = (P, n, [s, t]) => {
    const ray = 0.86 + 0.14 * Math.sin((P[0] * 38 + P[1] * 38));
    const edge = smooth(0.75, 1.0, s);
    return mul(mix(cFin, cAcc, edge * 0.4), ray);
  };

  // 몸통
  m.sweep('body', (s) => {
    const x = (0.5 - s) * len; // s=0 머리(+X), s=1 꼬리(-X)
    const prof = Math.sin(Math.pow(clamp(s, 0.01, 0.99), 0.72) * Math.PI);
    const a = Math.max(0.035, bodyH * Math.pow(prof, 0.75) * (1 - 0.15 * s));
    const b = Math.max(0.025, bodyW * Math.pow(prof, 0.78) * (1 - 0.2 * s));
    const yOff = hump && s < 0.38 ? hump * Math.sin((s / 0.38) * Math.PI) : 0;
    return {
      c: [x, yOff * 0.45, 0],
      u: [0, 1, 0],
      v: [0, 0, 1],
      a: a + yOff * 0.4,
      b,
      e: spec.e ?? 2.1,
    };
  }, { ns: 28, nt: 20, capStart: 0.07, capEnd: 0.04, island: [0.02, 0.02, 0.62, 0.62], paint: paintBody });

  // 등지느러미
  const dH = (spec.dorsalH ?? bodyH * 0.55) * sK;
  addFinRibbon(m, 'dorsal', {
    x0: len * (spec.dorsalX0 ?? 0.26),
    x1: -len * (spec.dorsalX1 ?? 0.38),
    yBase: (s) => bodyH * 0.78 * Math.sin(clamp(0.24 + s * 0.62, 0.05, 0.95) * Math.PI),
    yTip: (s) => {
      if (spec.pennant) return dH * (0.28 + 1.45 * Math.exp(-Math.pow((s - 0.15) * 3.8, 2)));
      if (spec.sickle) return dH * (0.25 + 1.15 * Math.pow(1 - s, 1.8));
      return dH * (0.35 + 0.65 * Math.sin(s * Math.PI));
    },
    sweep: spec.pennant ? -0.35 : -0.06,
    island: [0.64, 0.02, 0.98, 0.32],
    paint: paintFin,
  });

  // 뒷지느러미
  addFinRibbon(m, 'anal', {
    x0: len * 0.05,
    x1: -len * 0.38,
    yBase: (s) => -bodyH * 0.74 * Math.sin(clamp(0.42 + s * 0.44, 0.05, 0.95) * Math.PI),
    yTip: (s) => -(spec.analH ?? bodyH * 0.42) * sK * (spec.sickle ? (0.25 + 1.1 * Math.pow(1 - s, 1.7)) : (0.35 + 0.65 * Math.sin(s * Math.PI))),
    sweep: -0.05,
    island: [0.64, 0.34, 0.98, 0.62],
    paint: paintFin,
  });

  // 꼬리지느러미
  addTailFork(m, {
    x0: -len * 0.46,
    x1: -len * (spec.tailLen ?? 0.76),
    spanY: (spec.tailY ?? bodyH * 0.82) * sK,
    fork: spec.fork ?? 0.5,
    island: [0.02, 0.64, 0.46, 0.98],
    paint: paintFin,
  });

  // 가슴지느러미
  const fins = addPectorals(m, {
    x: len * 0.18,
    y: -bodyH * 0.16,
    z: bodyW * 0.72,
    len: (spec.pecLen ?? bodyH * 0.72) * sK,
    w: (spec.pecW ?? bodyH * 0.28) * sK,
    sweepX: -0.18,
    droopY: -0.1,
    island: [0.48, 0.64, 0.86, 0.98],
    paint: paintFin,
  });

  // 눈
  addEyes(m, len * 0.34, bodyH * 0.2, bodyW * 0.62, (spec.eyeR ?? 0.055) * eyeK, spec.iris ?? '#f4c842');
  return { m, fins, yaw: 12, pitch: 5 };
}

// ════════════════════════════════════════════════════════════════════════════
// 2. 새치류 빌더 (sailfish / blue_marlin)
// ════════════════════════════════════════════════════════════════════════════
function buildBillfish(spec, stage) {
  const m = new Model();
  const cTop = stageColor(hex(spec.top), stage);
  const cMid = stageColor(hex(spec.mid), stage);
  const cBot = stageColor(hex(spec.bot), stage);
  const cSail = stageColor(hex(spec.sail), stage);
  const isSail = spec.isSail;

  const paintBody = (P, n) => {
    const ny = clamp((P[1] / 0.22 + 1) * 0.5, 0, 1);
    let col = ny > 0.55 ? mix(cMid, cTop, (ny - 0.55) / 0.45) : mix(cBot, cMid, ny / 0.55);
    // 옆구리 은빛 세로 줄무늬
    const bar = Math.sin(P[0] * 18);
    if (bar > 0.55 && ny > 0.35 && ny < 0.82) col = mix(col, [160, 220, 255], 0.45);
    return col;
  };
  const paintSail = (P) => {
    const spot = fbm([P[0] * 12, P[1] * 12, P[2] * 12], 3);
    const ray = 0.85 + 0.15 * Math.sin(P[0] * 36);
    let col = mul(cSail, ray);
    if (isSail && spot > 0.62) col = hex('#101830');
    return col;
  };

  // 몸통 + 긴 주둥이(창)
  m.sweep('body', (s) => {
    const x = 1.05 - s * 1.95; // +1.05(창 끝) .. -0.90(꼬리 자루)
    const bill = s < 0.26;
    const u = bill ? s / 0.26 : (s - 0.26) / 0.74;
    const a = bill ? 0.012 + 0.055 * Math.pow(u, 1.5) : 0.03 + 0.21 * Math.sin(Math.pow(clamp(u, 0.01, 0.99), 0.58) * Math.PI);
    const b = bill ? 0.012 + 0.045 * Math.pow(u, 1.5) : 0.022 + 0.11 * Math.sin(Math.pow(clamp(u, 0.01, 0.99), 0.62) * Math.PI);
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.0 };
  }, { ns: 34, nt: 18, capStart: 0.02, capEnd: 0.03, island: [0.02, 0.02, 0.6, 0.58], paint: paintBody });

  // 거대한 돛 등지느러미(돗새치) 또는 날카로운 낫 등지느러미(청새치)
  addFinRibbon(m, 'dorsal', {
    x0: 0.42,
    x1: -0.62,
    yBase: (s) => 0.18 * Math.sin(clamp(0.18 + s * 0.72, 0.05, 0.95) * Math.PI),
    yTip: (s) => isSail ? (0.48 * Math.sin(Math.pow(s, 0.7) * Math.PI) + 0.12) : (0.34 * Math.pow(1 - s, 2.2) + 0.04),
    sweep: -0.08,
    island: [0.62, 0.02, 0.98, 0.52],
    paint: paintSail,
    ns: 18,
  });

  // 초승달 꼬리
  addTailFork(m, { x0: -0.86, x1: -1.16, spanY: 0.44, fork: 0.75, island: [0.02, 0.62, 0.48, 0.98], paint: paintSail });
  const fins = addPectorals(m, { x: 0.26, y: -0.07, z: 0.09, len: 0.34, w: 0.09, sweepX: -0.24, droopY: -0.1, island: [0.52, 0.62, 0.88, 0.98], paint: paintSail });
  addEyes(m, 0.45, 0.05, 0.068, 0.036 * (stage === 0 ? 1.35 : 1), '#70c8ff');
  return { m, fins, yaw: 10, pitch: 5 };
}

// ════════════════════════════════════════════════════════════════════════════
// 3. 상어 빌더 (6종: blacktip / whitetip / silky / galapagos / scalloped_hammerhead / tiger)
// ════════════════════════════════════════════════════════════════════════════
function buildShark(spec, stage) {
  const m = new Model();
  const cTop = stageColor(hex(spec.top), stage);
  const cBot = stageColor(hex(spec.bot), stage);
  const cTip = spec.tip ? stageColor(hex(spec.tip), stage) : null;
  const isHammer = !!spec.hammer;
  const isTiger = !!spec.tiger;

  const paintBody = (P, n) => {
    const ny = clamp((P[1] / 0.22 + 0.45), 0, 1);
    let col = mix(cBot, cTop, smooth(0.32, 0.68, ny));
    const grain = fbm([P[0] * 18, P[1] * 18, P[2] * 18], 2);
    col = mul(col, 0.93 + grain * 0.12);
    if (isTiger && ny > 0.38 && P[0] < 0.55 && P[0] > -0.65) {
      const bar = Math.sin(P[0] * 22 + Math.sin(P[1] * 8) * 0.8);
      if (bar > 0.35) col = mix(col, hex('#20262e'), smooth(0.35, 0.72, bar) * 0.65);
    }
    // 아가미 5줄
    for (let g = 0; g < 5; g++) {
      const gx = 0.42 - g * 0.038;
      if (Math.abs(P[0] - gx) < 0.008 && Math.abs(P[1]) < 0.085 && Math.abs(n[2]) > 0.45) col = mul(col, 0.45);
    }
    return col;
  };
  const paintFin = (P, n, [s]) => {
    let col = mix(cTop, cBot, 0.15);
    if (cTip && s > 0.72) col = mix(col, cTip, smooth(0.72, 0.92, s));
    return col;
  };

  // 상어 유선형 몸통
  m.sweep('body', (s) => {
    const x = 0.95 - s * 1.85;
    const prof = Math.sin(Math.pow(clamp(s, 0.01, 0.99), 0.62) * Math.PI);
    const a = 0.03 + 0.21 * Math.pow(prof, 0.78);
    const b = 0.025 + 0.18 * Math.pow(prof, 0.82);
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.1 };
  }, { ns: 30, nt: 20, capStart: 0.08, capEnd: 0.03, island: [0.02, 0.02, 0.58, 0.58], paint: paintBody });

  // 홍살귀상어 망치 머리 (cephalofoil)
  if (isHammer) {
    m.sweep('hammer', (s) => {
      const z = (s - 0.5) * 0.82;
      const edge = 1 - Math.abs(s - 0.5) * 2;
      const a = 0.105 * (0.74 + 0.26 * Math.sin(edge * Math.PI * 0.5));
      const b = 0.044 * (0.68 + 0.32 * edge);
      return { c: [0.94 - Math.abs(z) * 0.18, 0.005, z], u: [1, 0, 0], v: [0, 1, 0], a, b, e: 2.2 };
    }, { ns: 20, nt: 14, capStart: 0.03, capEnd: 0.03, island: [0.6, 0.02, 0.98, 0.24], paint: paintBody, bone: 0 });
  }

  // 제1 등지느러미 (크고 날렵한 삼각)
  m.sweep('dorsal1', (s) => {
    const y = 0.16 + s * 0.34;
    const x = 0.12 - s * 0.22;
    const a = 0.17 * (1 - 0.78 * s);
    const b = 0.026 * (1 - 0.65 * s);
    return { c: [x, y, 0], u: [1, 0, 0], v: [0, 0, 1], a: Math.max(0.018, a), b, e: 1.9 };
  }, { ns: 12, nt: 10, capEnd: 0.015, island: [0.6, 0.26, 0.98, 0.58], paint: paintFin, bone: 2 });

  // 제2 등지느러미
  m.sweep('dorsal2', (s) => {
    const y = 0.09 + s * 0.1;
    const x = -0.52 - s * 0.08;
    return { c: [x, y, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.06 * (1 - 0.7 * s), b: 0.014 * (1 - 0.6 * s), e: 1.9 };
  }, { ns: 8, nt: 8, capEnd: 0.01, island: [0.6, 0.26, 0.98, 0.58], paint: paintFin, bone: 4 });

  // 비대칭 이형 꼬리 (상엽이 길다)
  addTailFork(m, { x0: -0.84, x1: -1.24, spanY: 0.38, fork: 0.58, asymTop: 1.25, asymBot: 0.72, island: [0.02, 0.62, 0.46, 0.98], paint: paintFin });

  // 긴 가슴지느러미
  const fins = addPectorals(m, { x: 0.24, y: -0.09, z: 0.14, len: 0.46, w: 0.14, thick: 0.022, sweepX: -0.26, droopY: -0.1, island: [0.48, 0.62, 0.88, 0.98], paint: paintFin });

  if (isHammer) {
    addEyes(m, 0.87, 0.015, 0.4, 0.034, '#e6c84a');
  } else {
    addEyes(m, 0.7, 0.04, 0.105, 0.032 * (stage === 0 ? 1.35 : 1), '#282c32');
  }
  return { m, fins, yaw: 14, pitch: 8 };
}

// ════════════════════════════════════════════════════════════════════════════
// 4. 가오리 빌더 (marble_ray / golden_cownose_ray / spotted_eagle_ray / mobula_ray)
// ════════════════════════════════════════════════════════════════════════════
function buildRay(spec, stage) {
  const m = new Model();
  const cTop = stageColor(hex(spec.top), stage);
  const cBot = stageColor(hex(spec.bot), stage);
  const cAcc = stageColor(hex(spec.acc), stage);

  const paintRay = (P, n) => {
    if (n[1] < -0.18) return cBot;
    let col = cTop;
    if (spec.rayPat === 'marble') {
      const f = fbm([P[0] * 7, P[2] * 7, 1.3], 4);
      if (f > 0.52) col = mix(col, cAcc, smooth(0.52, 0.66, f));
    } else if (spec.rayPat === 'eagle') {
      const g = Math.sin(P[0] * 24) * Math.sin(P[2] * 24);
      const n2 = fbm([P[0] * 10, P[2] * 10, 2.1], 2);
      if (g * 0.5 + n2 > 0.85) col = cAcc;
    } else if (spec.rayPat === 'mobula') {
      const sh = smooth(0.15, 0.55, P[0]) * smooth(0.1, 0.45, Math.abs(P[2]));
      col = mix(col, cAcc, sh * 0.45);
    } else {
      const sheen = fbm([P[0] * 6, P[2] * 6, 0.5], 3);
      col = mix(col, cAcc, sheen * 0.35);
    }
    return col;
  };

  // 중앙 원반 몸통
  m.sweep('body', (s) => {
    const x = 0.68 - s * 1.25;
    const k = Math.sin(clamp(s, 0.02, 0.98) * Math.PI);
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.03 + 0.11 * Math.pow(k, 0.7), b: 0.06 + 0.32 * Math.pow(k, 0.65), e: 2.1 };
  }, { ns: 22, nt: 18, capStart: 0.06, capEnd: 0.03, island: [0.02, 0.02, 0.48, 0.48], paint: paintRay });

  // 넓은 날개 지느러미 (좌/우)
  const wingSpan = spec.wingSpan ?? 0.95;
  for (const side of [1, -1]) {
    m.sweep(side > 0 ? 'fin_L' : 'fin_R', (s) => {
      const z = side * (0.14 + s * wingSpan);
      const x = 0.12 - s * 0.24;
      const a = 0.52 * Math.pow(1 - s, 0.62);
      const b = 0.065 * (1 - 0.72 * s);
      return { c: [x, 0.01 * Math.sin(s * Math.PI), z], u: [1, 0, 0], v: [0, 1, 0], a: Math.max(0.03, a), b: Math.max(0.012, b), e: 2.0 };
    }, { ns: 16, nt: 12, capEnd: 0.025, island: side > 0 ? [0.5, 0.02, 0.98, 0.48] : [0.02, 0.5, 0.48, 0.98], paint: paintRay, bone: side > 0 ? 6 : 8 });
  }

  // 악마가오리 두부 뿔 지느러미(cephalic fins)
  if (spec.horns) {
    for (const side of [1, -1]) {
      m.sweep(`horn_${side > 0 ? 'L' : 'R'}`, (s) => ({
        c: [0.62 + s * 0.24, -0.01, side * (0.13 + s * 0.03)],
        u: [0, 1, 0], v: [0, 0, 1], a: 0.045 * (1 - 0.6 * s), b: 0.022 * (1 - 0.5 * s), e: 1.8,
      }), { ns: 8, nt: 8, capEnd: 0.012, island: [0.5, 0.5, 0.72, 0.72], paint: paintRay, bone: 0 });
    }
  }

  // 채찍 꼬리
  m.sweep('tail', (s) => ({
    c: [-0.52 - s * 0.78, -0.01, 0],
    u: [0, 1, 0], v: [0, 0, 1], a: 0.035 * (1 - 0.82 * s), b: 0.035 * (1 - 0.82 * s), e: 2.0,
  }), { ns: 14, nt: 8, capEnd: 0.01, island: [0.5, 0.74, 0.98, 0.98], paint: paintRay, bone: 5 });

  addEyes(m, 0.44, 0.065, 0.12, 0.028, '#d9b54a');
  const fins = {
    L: { root: [0.1, 0, 0.18], tip: [-0.12, 0, 0.14 + wingSpan] },
    R: { root: [0.1, 0, -0.18], tip: [-0.12, 0, -(0.14 + wingSpan)] },
  };
  return { m, fins, yaw: 24, pitch: 26 };
}

// ════════════════════════════════════════════════════════════════════════════
// 5. 장어 · 트럼펫피쉬 빌더 (garden_eel / ribbon_eel / spotted_trumpetfish)
// ════════════════════════════════════════════════════════════════════════════
function buildElongated(spec, stage) {
  const m = new Model();
  const cTop = stageColor(hex(spec.top), stage);
  const cBot = stageColor(hex(spec.bot), stage);
  const cAcc = stageColor(hex(spec.acc), stage);

  const paintBody = (P) => {
    const ny = clamp((P[1] / 0.1 + 0.5), 0, 1);
    let col = mix(cBot, cTop, ny);
    if (spec.elongKind === 'garden') {
      const sp = fbm([P[0] * 20, P[1] * 20, P[2] * 20], 3);
      if (sp > 0.6) col = cAcc;
    } else if (spec.elongKind === 'trumpet') {
      const bar = Math.sin(P[0] * 14);
      if (bar > 0.35) col = mix(col, cAcc, 0.55);
    }
    return col;
  };
  const paintCrest = () => cAcc;

  m.sweep('body', (s) => {
    const x = 1.0 - s * 2.0;
    const wave = spec.elongKind === 'trumpet' ? 0 : Math.sin(s * Math.PI * 2.4) * 0.08 * s;
    const r = spec.elongKind === 'trumpet'
      ? (s < 0.32 ? 0.035 + 0.02 * (s / 0.32) : 0.078 * Math.sin(clamp((s - 0.25) / 0.78, 0.08, 0.96) * Math.PI) + 0.025)
      : (0.068 * (1 - 0.55 * s) * Math.pow(Math.sin(clamp(s, 0.02, 0.98) * Math.PI), 0.25));
    return { c: [x, wave, 0], u: [0, 1, 0], v: [0, 0, 1], a: r * 1.15, b: r * 0.85, e: 2.0 };
  }, { ns: 36, nt: 14, capStart: 0.04, capEnd: 0.03, island: [0.02, 0.02, 0.7, 0.58], paint: paintBody });

  // 리본장어 등 리본 지느러미
  if (spec.elongKind === 'ribbon') {
    m.sweep('ribbon_fin', (s) => {
      const x = 0.84 - s * 1.82;
      const wave = Math.sin(s * Math.PI * 2.4) * 0.08 * s;
      return { c: [x, wave + 0.11, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.075 * (1 - 0.35 * s), b: 0.012, e: 1.7 };
    }, { ns: 32, nt: 8, capStart: 0.015, capEnd: 0.015, island: [0.02, 0.62, 0.98, 0.98], paint: paintCrest });
  } else if (spec.elongKind === 'trumpet') {
    addTailFork(m, { x0: -0.96, x1: -1.16, spanY: 0.16, fork: 0.3, island: [0.02, 0.62, 0.48, 0.98], paint: paintCrest });
  }

  const fins = addPectorals(m, { x: 0.62, y: -0.02, z: 0.05, len: 0.1, w: 0.045, sweepX: -0.06, droopY: -0.02, island: [0.72, 0.02, 0.98, 0.48], paint: paintCrest });
  addEyes(m, spec.elongKind === 'trumpet' ? 0.38 : 0.88, 0.03, 0.042, 0.026, '#ffe052');
  return { m, fins, yaw: 10, pitch: 5 };
}

// ════════════════════════════════════════════════════════════════════════════
// 6. 해마 · 나뭇잎해룡 빌더 (pygmy_seahorse / leafy_seadragon)
// ════════════════════════════════════════════════════════════════════════════
function buildSyngnathid(spec, stage) {
  const m = new Model();
  const cBody = stageColor(hex(spec.top), stage);
  const cAcc = stageColor(hex(spec.acc), stage);
  const isLeafy = !!spec.leafy;

  const paintBody = (P) => {
    const f = fbm([P[0] * 14, P[1] * 14, P[2] * 14], 3);
    return mix(cBody, cAcc, smooth(0.45, 0.72, f) * 0.7);
  };

  // S자 몸통 (머리는 +X 쪽으로 향하되 나뭇잎해룡은 수평, 피그미해마는 우아한 곡선)
  m.sweep('body', (s) => {
    const x = 0.85 - s * 1.75;
    const y = isLeafy
      ? Math.sin(s * Math.PI * 1.6) * 0.14
      : Math.sin(s * Math.PI * 1.8) * 0.24 - s * 0.12;
    const prof = Math.sin(clamp(s, 0.03, 0.97) * Math.PI);
    const a = (s < 0.18 ? 0.035 + 0.09 * (s / 0.18) : 0.03 + 0.16 * Math.pow(prof, 0.85)) * (isLeafy ? 0.85 : 1.05);
    const b = a * 0.68;
    return { c: [x, y, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.0 };
  }, { ns: 30, nt: 14, capStart: 0.025, capEnd: 0.02, island: [0.02, 0.02, 0.56, 0.56], paint: paintBody });

  // 나뭇잎해룡 잎사귀 부속지 또는 피그미해마 산호 돌기
  const frondCount = isLeafy ? 10 : 8;
  for (let i = 0; i < frondCount; i++) {
    const u = 0.18 + (i / frondCount) * 0.68;
    const fx = 0.85 - u * 1.75;
    const fy = (isLeafy ? Math.sin(u * Math.PI * 1.6) * 0.14 : Math.sin(u * Math.PI * 1.8) * 0.24 - u * 0.12);
    const dirY = i % 2 === 0 ? 1 : -1;
    const flen = isLeafy ? (0.28 + (i % 3) * 0.08) : 0.09;
    m.sweep(`frond_${i}`, (s) => ({
      c: [fx - s * 0.08, fy + dirY * (0.08 + s * flen), (i % 3 - 1) * 0.06 * s],
      u: [1, 0, 0], v: [0, 0, 1],
      a: (isLeafy ? 0.085 : 0.042) * Math.sin(clamp(s, 0.08, 0.95) * Math.PI),
      b: 0.014,
      e: 1.7,
    }), { ns: 8, nt: 6, capEnd: 0.01, island: [0.58, 0.02, 0.98, 0.56], paint: () => cAcc });
  }

  const fins = addPectorals(m, { x: 0.35, y: 0.06, z: 0.06, len: 0.14, w: 0.06, sweepX: -0.05, droopY: -0.03, island: [0.02, 0.6, 0.48, 0.98], paint: () => cAcc });
  addEyes(m, 0.58, 0.1, 0.065, 0.032, '#ffd85e');
  return { m, fins, yaw: 12, pitch: 8 };
}

// ════════════════════════════════════════════════════════════════════════════
// 7. 붉은입술박쥐물고기 빌더 (red_lipped_batfish)
// ════════════════════════════════════════════════════════════════════════════
function buildBatfish(spec, stage) {
  const m = new Model();
  const cTop = stageColor(hex('#8c7a6b'), stage);
  const cBot = stageColor(hex('#d9cbb8'), stage);
  const cLip = hex('#e61c2e');

  const paintBody = (P, n) => {
    if (n[1] < -0.25) return cBot;
    const f = fbm([P[0] * 10, P[1] * 10, P[2] * 10], 3);
    let col = mix(cTop, hex('#4a3c32'), smooth(0.45, 0.72, f));
    if (Math.abs(P[2]) < 0.08 && P[0] > 0.1) col = mix(col, hex('#3a2e26'), 0.45);
    return col;
  };

  // 삼각형 납작 몸통
  m.sweep('body', (s) => {
    const x = 0.72 - s * 1.44;
    const prof = Math.sin(clamp(s, 0.02, 0.98) * Math.PI);
    const a = 0.04 + 0.15 * Math.pow(prof, 0.75);
    const b = s < 0.48 ? 0.06 + 0.38 * Math.sin((s / 0.48) * Math.PI * 0.5) : 0.44 * Math.pow(1 - (s - 0.48) / 0.52, 1.35) + 0.03;
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.2 };
  }, { ns: 26, nt: 18, capStart: 0.04, capEnd: 0.02, island: [0.02, 0.02, 0.58, 0.58], paint: paintBody });

  // 시그니처 새빨간 입술 (도톰한 붉은 입술 링)
  m.sweep('red_lips', (s) => {
    const z = (s - 0.5) * 0.24;
    const arch = Math.cos((s - 0.5) * Math.PI);
    return { c: [0.73 + arch * 0.035, -0.025, z], u: [0, 1, 0], v: [1, 0, 0], a: 0.042 * (0.65 + 0.35 * arch), b: 0.032, e: 2.0 };
  }, { ns: 14, nt: 10, capStart: 0.015, capEnd: 0.015, island: [0.62, 0.02, 0.98, 0.28], paint: () => cLip, bone: 0 });

  // 이마 뿔(illicium)
  m.sweep('horn', (s) => ({
    c: [0.68 + s * 0.18, 0.06 + s * 0.04, 0],
    u: [0, 1, 0], v: [0, 0, 1], a: 0.028 * (1 - 0.65 * s), b: 0.022 * (1 - 0.65 * s), e: 2.0,
  }), { ns: 8, nt: 8, capEnd: 0.01, island: [0.62, 0.3, 0.98, 0.52], paint: paintBody, bone: 0 });

  // 다리처럼 걷는 가슴지느러미
  const fins = addPectorals(m, { x: 0.06, y: -0.08, z: 0.34, len: 0.28, w: 0.11, thick: 0.032, sweepX: -0.1, droopY: -0.16, island: [0.02, 0.62, 0.48, 0.98], paint: paintBody });
  addTailFork(m, { x0: -0.68, x1: -0.96, spanY: 0.2, fork: 0.15, island: [0.52, 0.62, 0.98, 0.98], paint: paintBody });
  addEyes(m, 0.56, 0.065, 0.12, 0.034, '#e6b830');
  return { m, fins, yaw: 28, pitch: 18 };
}

// ════════════════════════════════════════════════════════════════════════════
// 8. 바다거북 빌더 (hawksbill_turtle / loggerhead_turtle / leatherback_turtle)
// ════════════════════════════════════════════════════════════════════════════
function buildTurtle(spec, stage) {
  const m = new Model();
  const cShell = stageColor(hex(spec.shell), stage);
  const cShell2 = stageColor(hex(spec.shell2), stage);
  const cSkin = stageColor(hex(spec.skin), stage);
  const cBelly = stageColor(hex('#e8d8b0'), stage);
  const isLeather = !!spec.leather;

  const paintShell = (P, n) => {
    if (n[1] < -0.25) return cBelly;
    if (isLeather) {
      // 장수거북 7줄 세로 용골 + 흰 점박이
      const ridgeV = Math.cos(P[2] * 26);
      const sp = fbm([P[0] * 14, P[2] * 14, 1], 3);
      let col = mix(cShell, cShell2, smooth(0.65, 0.95, ridgeV) * 0.5);
      if (sp > 0.65) col = mix(col, [215, 225, 235], 0.55);
      return col;
    }
    // 대모거북 / 붉은바다거북 육각 등껍질 무늬
    const scute = ridge([P[0] * 6.5, P[2] * 6.5, 0.7], 2);
    return mix(cShell2, cShell, smooth(0.35, 0.72, scute));
  };
  const paintSkin = (P) => {
    const f = fbm([P[0] * 16, P[1] * 16, P[2] * 16], 2);
    return mix(cSkin, cShell2, smooth(0.45, 0.72, f) * 0.55);
  };

  // 등껍질 (dome carapace)
  m.sweep('body', (s) => {
    const x = 0.58 - s * 1.24;
    const k = Math.sin(clamp(s, 0.02, 0.98) * Math.PI);
    return { c: [x, 0.02, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.06 + 0.2 * Math.pow(k, 0.65), b: 0.08 + 0.38 * Math.pow(k, 0.6), e: 2.3 };
  }, { ns: 26, nt: 20, capStart: 0.06, capEnd: 0.05, island: [0.02, 0.02, 0.58, 0.58], paint: paintShell });

  // 머리 + 목
  m.sweep('head', (s) => {
    const x = 0.48 + s * 0.44;
    const k = Math.sin(clamp(s, 0.05, 0.95) * Math.PI);
    return { c: [x, 0.03 + s * 0.02, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.075 + 0.05 * k, b: 0.065 + 0.045 * k, e: 2.1 };
  }, { ns: 14, nt: 14, capEnd: 0.05, island: [0.6, 0.02, 0.98, 0.34], paint: paintSkin, bone: 0 });

  // 앞 지느러미 발 (날개형)
  const fins = addPectorals(m, { x: 0.28, y: -0.02, z: 0.3, len: 0.58, w: 0.14, thick: 0.032, sweepX: -0.28, droopY: -0.08, island: [0.02, 0.62, 0.52, 0.98], paint: paintSkin });

  // 뒤 지느러미 발
  for (const side of [1, -1]) {
    m.sweep(`hind_${side > 0 ? 'L' : 'R'}`, (s) => ({
      c: [-0.56 - s * 0.28, -0.04, side * (0.16 + s * 0.16)],
      u: [1, 0, 0], v: [0, 1, 0], a: 0.09 * (1 - 0.35 * s), b: 0.022 * (1 - 0.5 * s), e: 2.0,
    }), { ns: 8, nt: 8, capEnd: 0.015, island: [0.54, 0.62, 0.98, 0.98], paint: paintSkin, bone: 5 });
  }

  addEyes(m, 0.78, 0.07, 0.082, 0.028, '#221c14');
  return { m, fins, yaw: 22, pitch: 20 };
}

// ════════════════════════════════════════════════════════════════════════════
// 9. 갈라파고스 펭귄 빌더 (galapagos_penguin — 걷는 legs 뼈 포함)
// ════════════════════════════════════════════════════════════════════════════
function buildPenguin(spec, stage) {
  const m = new Model();
  const cDark = stageColor(hex('#1e242c'), stage);
  const cWhite = stageColor(hex('#f4f6f9'), stage);
  const cBeak = hex('#24262b');
  const cBeakPink = hex('#e8a098');

  const paintBody = (P, n) => {
    // 등 · 머리 검정, 배 흰색 + 갈라파고스 펭귄 특유의 말굽형 검은 가슴 띠 + 눈 뒤 얇은 흰 C자 줄
    const back = P[1] > 0.01 || P[0] > 0.42;
    if (P[0] > 0.36 && P[0] < 0.64 && P[1] > -0.1) {
      const ring = Math.abs(Math.hypot((P[0] - 0.54) * 1.5, P[1] - 0.01) - 0.13);
      if (ring < 0.018 && P[0] < 0.58 && Math.abs(n[2]) > 0.35) return cWhite;
    }
    if (!back) {
      // 가슴 말굽 띠
      if (P[0] > 0.18 && P[0] < 0.26 && Math.abs(P[2]) < 0.16) return cDark;
      return cWhite;
    }
    return cDark;
  };

  // 유선형 펭귄 몸통
  m.sweep('body', (s) => {
    const x = 0.76 - s * 1.56;
    const prof = Math.sin(Math.pow(clamp(s, 0.02, 0.98), 0.72) * Math.PI);
    const neck = 1 - 0.12 * Math.exp(-Math.pow((s - 0.22) / 0.065, 2));
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: (0.04 + 0.23 * prof) * neck, b: (0.04 + 0.2 * prof) * neck, e: 2.1 };
  }, { ns: 28, nt: 20, capStart: 0.08, capEnd: 0.05, island: [0.02, 0.02, 0.58, 0.58], paint: paintBody });

  // 부리 (위 검정, 아래 핑크)
  m.sweep('beak', (s) => ({
    c: [0.76 + s * 0.22, -0.01 - s * 0.015, 0],
    u: [0, 1, 0], v: [0, 0, 1], a: 0.05 * (1 - 0.78 * s), b: 0.042 * (1 - 0.78 * s), e: 1.9,
  }), { ns: 10, nt: 10, capEnd: 0.015, island: [0.6, 0.02, 0.98, 0.25], paint: (P) => P[1] < -0.015 ? cBeakPink : cBeak, bone: 0 });

  // 날개(플리퍼)
  const fins = addPectorals(m, { x: 0.18, y: -0.02, z: 0.18, len: 0.42, w: 0.1, thick: 0.022, sweepX: -0.26, droopY: -0.08, island: [0.6, 0.28, 0.98, 0.58], paint: () => cDark });

  // 물갈퀴 발 (leg_L / leg_R — 해변 보행 지원)
  for (const side of [1, -1]) {
    m.sweep(side > 0 ? 'leg_L' : 'leg_R', (s) => ({
      c: [-0.62 - s * 0.14, -0.14 - s * 0.05, side * (0.09 + s * 0.04)],
      u: [0, 1, 0], v: [0, 0, 1], a: 0.028 * (1 - 0.3 * s), b: 0.058 * (0.6 + 0.5 * s), e: 2.0,
    }), { ns: 8, nt: 8, capEnd: 0.015, island: [0.02, 0.62, 0.48, 0.98], paint: () => hex('#2d3138'), bone: side > 0 ? 10 : 11 });
  }
  const legs = { L: { root: [-0.62, -0.14, 0.09] }, R: { root: [-0.62, -0.14, -0.09] } };

  addEyes(m, 0.62, 0.06, 0.11, 0.028 * (stage === 0 ? 1.35 : 1), '#5c381c');
  return { m, fins, legs, yaw: 16, pitch: 8 };
}

// ════════════════════════════════════════════════════════════════════════════
// 10. 바다이구아나 빌더 (marine_iguana — 용암 비늘 + 등 가시 + 걷는 다리)
// ════════════════════════════════════════════════════════════════════════════
function buildIguana(spec, stage) {
  const m = new Model();
  const cDark = stageColor(hex('#26292e'), stage);
  const cRust = stageColor(hex('#7d3528'), stage);
  const cSalt = stageColor(hex('#d4d8dc'), stage);

  const paintBody = (P, n) => {
    const sc = ridge([P[0] * 22, P[1] * 22, P[2] * 22], 2);
    let col = mul(cDark, 0.8 + sc * 0.32);
    // 머리 위 흰 소금 결정 왕관
    if (P[0] > 0.52 && n[1] > 0.45) col = mix(col, cSalt, smooth(0.52, 0.72, P[0]) * 0.78);
    // 옆구리 붉은 용암 얼룩
    const patch = fbm([P[0] * 5, P[1] * 5, P[2] * 5], 3);
    if (patch > 0.58 && P[0] > -0.2 && P[0] < 0.45) col = mix(col, cRust, 0.5);
    return col;
  };

  // 몸통 + 납작한 수영 꼬리
  m.sweep('body', (s) => {
    const x = 0.88 - s * 1.98;
    const a = s < 0.16 ? 0.07 + 0.09 * (s / 0.16)
      : s < 0.54 ? 0.16 + 0.05 * Math.sin(((s - 0.16) / 0.38) * Math.PI)
      : 0.15 * Math.pow(1 - (s - 0.54) / 0.46, 0.85) + 0.02;
    const b = s < 0.54 ? a * 0.85 : a * 0.35; // 꼬리는 좌우로 납작
    return { c: [x, Math.sin(s * Math.PI * 1.5) * 0.04, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.1 };
  }, { ns: 34, nt: 16, capStart: 0.05, capEnd: 0.02, island: [0.02, 0.02, 0.6, 0.58], paint: paintBody });

  // 등 가시 볏 (crest — 몸통 등선에 밀착)
  m.sweep('crest', (s) => {
    const u = 0.1 + s * 0.74;
    const x = 0.88 - u * 1.98;
    const bodyA = u < 0.16 ? 0.07 + 0.09 * (u / 0.16)
      : u < 0.54 ? 0.16 + 0.05 * Math.sin(((u - 0.16) / 0.38) * Math.PI)
      : 0.15 * Math.pow(1 - (u - 0.54) / 0.46, 0.85) + 0.02;
    const bodyY = Math.sin(u * Math.PI * 1.5) * 0.04;
    const spike = 0.5 + 0.5 * Math.abs(Math.sin(s * Math.PI * 16));
    const h = 0.062 * spike * (1 - 0.45 * s);
    return { c: [x, bodyY + bodyA - 0.015 + h * 0.5, 0], u: [0, 1, 0], v: [0, 0, 1], a: h * 0.65, b: 0.014, e: 1.5 };
  }, { ns: 34, nt: 6, capStart: 0.01, capEnd: 0.01, island: [0.62, 0.02, 0.98, 0.3], paint: () => hex('#454c54') });

  // 앞다리 (fin_L/R)
  const fins = addPectorals(m, { x: 0.35, y: -0.08, z: 0.12, len: 0.26, w: 0.065, thick: 0.036, sweepX: -0.05, droopY: -0.16, island: [0.62, 0.34, 0.98, 0.64], paint: paintBody });

  // 뒷다리 (leg_L/R)
  for (const side of [1, -1]) {
    m.sweep(side > 0 ? 'leg_L' : 'leg_R', (s) => ({
      c: [-0.14 - s * 0.08, -0.08 - s * 0.18, side * (0.12 + s * 0.18)],
      u: [1, 0, 0], v: [0, 1, 0], a: 0.06 * (1 - 0.35 * s), b: 0.042 * (1 - 0.35 * s), e: 2.0,
    }), { ns: 10, nt: 8, capEnd: 0.015, island: [0.02, 0.62, 0.48, 0.98], paint: paintBody, bone: side > 0 ? 10 : 11 });
  }
  const legs = { L: { root: [-0.14, -0.08, 0.12] }, R: { root: [-0.14, -0.08, -0.12] } };

  addEyes(m, 0.72, 0.06, 0.095, 0.028, '#c89a30');
  return { m, fins, legs, yaw: 16, pitch: 10 };
}

// ════════════════════════════════════════════════════════════════════════════
// 11. 해양 포유류 빌더 (물개 · 바다사자 · 점박이돌고래 · 들쇠고래 · 브라이드고래)
// ════════════════════════════════════════════════════════════════════════════
function buildMammal(spec, stage) {
  const m = new Model();
  const cTop = stageColor(hex(spec.top), stage);
  const cBot = stageColor(hex(spec.bot), stage);
  const isPinniped = spec.mammalKind === 'pinniped';
  const isWhale = spec.mammalKind === 'whale';
  const isPilot = spec.mammalKind === 'pilot';
  const isDolphin = spec.mammalKind === 'dolphin';

  const paintBody = (P, n) => {
    const ny = clamp((P[1] / 0.24 + 0.5), 0, 1);
    let col = mix(cBot, cTop, smooth(0.28, 0.66, ny));
    const grain = fbm([P[0] * 14, P[1] * 14, P[2] * 14], 3);
    col = mul(col, 0.9 + grain * 0.16);
    if (isDolphin) {
      const sp = fbm([P[0] * 18, P[1] * 18, P[2] * 18], 3);
      if (sp > 0.62) col = mix(col, [235, 242, 250], 0.68);
    } else if (isWhale && P[1] < -0.04 && P[0] > -0.1) {
      // 브라이드고래 목 주름(pleats)
      const pleat = Math.sin(P[2] * 65);
      col = mul(col, 0.85 + pleat * 0.12);
    }
    return col;
  };

  if (isPinniped) {
    // 물개 / 바다사자: 개 같은 주둥이 + 굵은 목 + 유선형 몸통
    m.sweep('body', (s) => {
      const x = 0.88 - s * 1.72;
      const head = s < 0.22;
      const prof = Math.sin(Math.pow(clamp(s, 0.02, 0.98), 0.65) * Math.PI);
      const a = head ? 0.065 + 0.14 * Math.pow(s / 0.22, 0.7) : 0.045 + 0.22 * prof;
      const b = head ? 0.06 + 0.13 * Math.pow(s / 0.22, 0.7) : 0.045 + 0.2 * prof;
      const y = head ? 0.06 * (1 - s / 0.22) : 0;
      return { c: [x, y, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.1 };
    }, { ns: 30, nt: 20, capStart: 0.06, capEnd: 0.05, island: [0.02, 0.02, 0.58, 0.58], paint: paintBody });

    const fins = addPectorals(m, { x: 0.28, y: -0.09, z: 0.16, len: 0.44, w: 0.13, thick: 0.028, sweepX: -0.22, droopY: -0.14, island: [0.6, 0.02, 0.98, 0.48], paint: paintBody });
    // 뒷지느러미 발
    for (const side of [1, -1]) {
      m.sweep(`hind_${side > 0 ? 'L' : 'R'}`, (s) => ({
        c: [-0.8 - s * 0.28, -0.03, side * (0.05 + s * 0.12)],
        u: [0, 1, 0], v: [0, 0, 1], a: 0.03 * (1 - 0.4 * s), b: 0.075 * (0.6 + 0.5 * s), e: 1.9,
      }), { ns: 10, nt: 8, capEnd: 0.015, island: [0.02, 0.62, 0.48, 0.98], paint: paintBody, bone: 5 });
    }
    addEyes(m, 0.68, 0.08, 0.095, 0.032, '#221a14');
    return { m, fins, yaw: 16, pitch: 8 };
  }

  // 고래류 (점박이돌고래 / 들쇠고래 / 브라이드고래)
  m.sweep('body', (s) => {
    const x = 0.96 - s * 1.88;
    const prof = Math.sin(Math.pow(clamp(s, 0.01, 0.99), isPilot ? 0.52 : 0.62) * Math.PI);
    let a = 0.04 + (isWhale ? 0.24 : 0.23) * prof;
    let b = 0.04 + (isWhale ? 0.22 : 0.19) * prof;
    if (isDolphin && s < 0.14) {
      // 가늘고 긴 돌고래 부리
      const k = s / 0.14;
      a = 0.035 + 0.12 * Math.pow(k, 1.4);
      b = 0.035 + 0.11 * Math.pow(k, 1.4);
    } else if (isPilot && s < 0.18) {
      // 들쇠고래 둥근 멜론 이마
      a = 0.18 + 0.07 * Math.sin((s / 0.18) * Math.PI * 0.5);
      b = 0.16 + 0.05 * Math.sin((s / 0.18) * Math.PI * 0.5);
    }
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.15 };
  }, { ns: 32, nt: 20, capStart: isPilot ? 0.12 : 0.06, capEnd: 0.03, island: [0.02, 0.02, 0.58, 0.58], paint: paintBody });

  // 수평 꼬리 지느러미 (flukes)
  for (const side of [1, -1]) {
    m.sweep(`fluke_${side > 0 ? 'L' : 'R'}`, (s) => ({
      c: [-0.88 - s * 0.18, 0, side * (0.03 + s * 0.38)],
      u: [1, 0, 0], v: [0, 1, 0], a: 0.14 * (1 - 0.65 * s), b: 0.022 * (1 - 0.6 * s), e: 1.9,
    }), { ns: 10, nt: 8, capEnd: 0.015, island: [0.02, 0.62, 0.48, 0.98], paint: () => cTop, bone: 5 });
  }

  // 등지느러미
  m.sweep('dorsal', (s) => ({
    c: [(isWhale ? -0.35 : -0.05) - s * 0.14, (isWhale ? 0.14 : 0.19) + s * (isWhale ? 0.13 : 0.22), 0],
    u: [1, 0, 0], v: [0, 0, 1], a: 0.13 * (1 - 0.72 * s), b: 0.022 * (1 - 0.6 * s), e: 1.9,
  }), { ns: 10, nt: 8, capEnd: 0.012, island: [0.6, 0.02, 0.98, 0.34], paint: () => cTop, bone: 3 });

  const fins = addPectorals(m, { x: 0.28, y: -0.08, z: 0.16, len: isPilot ? 0.48 : 0.36, w: 0.11, thick: 0.024, sweepX: -0.24, droopY: -0.1, island: [0.6, 0.38, 0.98, 0.98], paint: () => cTop });
  addEyes(m, isDolphin ? 0.64 : 0.68, 0.01, 0.13, 0.026, '#1a1e24');
  return { m, fins, yaw: 14, pitch: 8 };
}

// ════════════════════════════════════════════════════════════════════════════
// 12. 무척추동물 빌더 (게 · 랍스터 · 대왕조개 · 파란고리문어 · 앵무조개)
// ════════════════════════════════════════════════════════════════════════════
function buildInvertebrate(spec, stage) {
  const m = new Model();
  const kind = spec.invKind;

  if (kind === 'crab') {
    // 샐리 라이트풋 게: 화려한 붉은-주황 + 청록 등딱지 + 8다리 + 집게발
    const cRed = stageColor(hex('#e8381e'), stage);
    const cTeal = stageColor(hex('#26b4c8'), stage);
    const cYel = hex('#f2b824');
    const paintShell = (P) => {
      const r = Math.hypot(P[0], P[2]);
      const f = fbm([P[0] * 10, P[2] * 10, 1], 3);
      return mix(r < 0.24 ? cTeal : cRed, cYel, smooth(0.58, 0.78, f) * 0.6);
    };
    m.sweep('body', (s) => {
      const x = 0.45 - s * 0.9;
      const k = Math.sin(clamp(s, 0.04, 0.96) * Math.PI);
      return { c: [x, 0.06, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.05 + 0.14 * k, b: 0.12 + 0.38 * k, e: 2.3 };
    }, { ns: 18, nt: 16, capStart: 0.05, capEnd: 0.05, island: [0.02, 0.02, 0.56, 0.56], paint: paintShell });

    // 양쪽 다리 4쌍
    for (const side of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const lx = 0.24 - i * 0.18;
        m.sweep(`leg_${side > 0 ? 'L' : 'R'}_${i}`, (s) => ({
          c: [lx - s * 0.06, 0.04 + Math.sin(s * Math.PI) * 0.06 - s * 0.24, side * (0.34 + s * 0.42)],
          u: [1, 0, 0], v: [0, 1, 0], a: 0.032 * (1 - 0.55 * s), b: 0.028 * (1 - 0.55 * s), e: 2.0,
        }), { ns: 8, nt: 6, capEnd: 0.01, island: [0.58, 0.02, 0.98, 0.48], paint: () => cRed, bone: side > 0 ? 6 : 8 });
      }
    }
    const fins = { L: { root: [0.2, 0, 0.35], tip: [0.1, -0.2, 0.76] }, R: { root: [0.2, 0, -0.35], tip: [0.1, -0.2, -0.76] } };
    addEyes(m, 0.44, 0.18, 0.16, 0.036, '#14161a');
    return { m, fins, yaw: 24, pitch: 24 };
  }

  if (kind === 'lobster') {
    // 갈라파고스 가시랍스터: 적갈+청록 마디 갑각 + 긴 더듬이 + 부채꼬리
    const cRed = stageColor(hex('#a82e1e'), stage);
    const cGrn = stageColor(hex('#2e6e58'), stage);
    const cSpot = hex('#f2d06b');
    const paintBody = (P) => {
      const seg = Math.sin(P[0] * 26);
      let col = mix(cRed, cGrn, smooth(-0.2, 0.4, P[0]));
      if (seg > 0.72) col = mul(col, 0.72);
      const sp = fbm([P[0] * 14, P[1] * 14, P[2] * 14], 2);
      if (sp > 0.66) col = mix(col, cSpot, 0.75);
      return col;
    };
    m.sweep('body', (s) => {
      const x = 0.76 - s * 1.56;
      const a = 0.06 + 0.14 * Math.sin(clamp(s, 0.04, 0.96) * Math.PI);
      const b = a * 1.1;
      return { c: [x, 0.04, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.2 };
    }, { ns: 26, nt: 16, capStart: 0.04, capEnd: 0.03, island: [0.02, 0.02, 0.58, 0.58], paint: paintBody });

    // 긴 더듬이 2개
    for (const side of [1, -1]) {
      m.sweep(`ant_${side > 0 ? 'L' : 'R'}`, (s) => ({
        c: [0.74 + s * 0.45, 0.08 + s * 0.12, side * (0.06 + s * 0.28)],
        u: [0, 1, 0], v: [0, 0, 1], a: 0.022 * (1 - 0.7 * s), b: 0.022 * (1 - 0.7 * s), e: 2.0,
      }), { ns: 10, nt: 6, capEnd: 0.008, island: [0.6, 0.02, 0.98, 0.3], paint: () => cRed, bone: 0 });
    }
    const fins = addPectorals(m, { x: 0.26, y: -0.06, z: 0.14, len: 0.3, w: 0.055, thick: 0.024, sweepX: -0.1, droopY: -0.16, island: [0.6, 0.34, 0.98, 0.64], paint: () => cRed });
    addTailFork(m, { x0: -0.76, x1: -1.0, spanY: 0.14, fork: 0.1, island: [0.02, 0.62, 0.48, 0.98], paint: paintBody });
    addEyes(m, 0.68, 0.12, 0.09, 0.028, '#16181c');
    return { m, fins, yaw: 18, pitch: 18 };
  }

  if (kind === 'clam') {
    // 대왕조개: 주름진 상아색 이매패 + 빛나는 형광 청록 외투막
    const cShell = stageColor(hex('#dfd6c3'), stage);
    const cMantle = stageColor(hex('#1492e8'), stage);
    const cGlow = hex('#2cf2d8');
    const paintShell = (P) => {
      const flute = 0.82 + 0.18 * Math.sin(P[0] * 18);
      return mul(cShell, flute);
    };
    const paintMantle = (P) => {
      const f = fbm([P[0] * 12, P[2] * 12, 1], 3);
      return mix(cMantle, cGlow, smooth(0.42, 0.72, f));
    };
    for (const side of [1, -1]) {
      m.sweep(`valve_${side > 0 ? 'L' : 'R'}`, (s) => {
        const x = 0.72 - s * 1.44;
        const k = Math.sin(clamp(s, 0.03, 0.97) * Math.PI);
        const wave = Math.sin(s * Math.PI * 5) * 0.04;
        return { c: [x, -0.04, side * (0.16 + 0.14 * k + wave * 0.3)], u: [0, 1, 0], v: [0, 0, 1], a: 0.08 + 0.34 * k, b: 0.07 + 0.09 * k, e: 2.1 };
      }, { ns: 22, nt: 14, capStart: 0.04, capEnd: 0.04, island: [0.02, 0.02, 0.56, 0.56], paint: paintShell });
    }
    m.sweep('mantle', (s) => {
      const x = 0.64 - s * 1.28;
      const k = Math.sin(clamp(s, 0.04, 0.96) * Math.PI);
      return { c: [x, 0.14, Math.sin(s * Math.PI * 7) * 0.05], u: [0, 1, 0], v: [0, 0, 1], a: 0.12 * k + 0.04, b: 0.16 * k + 0.04, e: 2.0 };
    }, { ns: 24, nt: 12, capStart: 0.03, capEnd: 0.03, island: [0.58, 0.02, 0.98, 0.58], paint: paintMantle });
    const fins = { L: { root: [0, 0, 0.25], tip: [0, 0.1, 0.4] }, R: { root: [0, 0, -0.25], tip: [0, 0.1, -0.4] } };
    return { m, fins, yaw: 24, pitch: 24 };
  }

  if (kind === 'octopus') {
    // 파란고리문어: 황토색 둥근 외투막 + 8개 촉수 + 빛나는 검은테 형광 파란 고리
    const cBase = stageColor(hex('#dfb24c'), stage);
    const cRing = hex('#18d2ff');
    const paintOcto = (P) => {
      const n = fbm([P[0] * 10, P[1] * 10, P[2] * 10], 3);
      const ringD = Math.abs(n - 0.62);
      if (ringD < 0.035) return cRing;
      if (ringD < 0.062) return hex('#181c24');
      return mul(cBase, 0.88 + n * 0.2);
    };
    // 외투막(머리)
    m.sweep('body', (s) => {
      const x = 0.12 + s * 0.68;
      const k = Math.sin(clamp(s, 0.04, 0.96) * Math.PI);
      return { c: [x, 0.14 * Math.sin(s * Math.PI), 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.08 + 0.24 * k, b: 0.08 + 0.22 * k, e: 2.0 };
    }, { ns: 20, nt: 16, capStart: 0.05, capEnd: 0.06, island: [0.02, 0.02, 0.56, 0.56], paint: paintOcto });

    // 촉수 8개
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const ay = Math.sin(ang), az = Math.cos(ang);
      m.sweep(`arm_${i}`, (s) => ({
        c: [0.18 - s * 0.96, ay * (0.12 + s * 0.28) + Math.sin(s * Math.PI * 2 + i) * 0.06, az * (0.12 + s * 0.34)],
        u: [0, 1, 0], v: [0, 0, 1], a: 0.055 * (1 - 0.72 * s), b: 0.055 * (1 - 0.72 * s), e: 2.0,
      }), { ns: 14, nt: 8, capEnd: 0.012, island: [0.58, 0.02, 0.98, 0.98], paint: paintOcto, bone: 4 });
    }
    addEyes(m, 0.34, 0.14, 0.16, 0.038, '#f0d848');
    const fins = { L: { root: [0.1, 0, 0.2], tip: [-0.4, 0, 0.4] }, R: { root: [0.1, 0, -0.2], tip: [-0.4, 0, -0.4] } };
    return { m, fins, yaw: 16, pitch: 12 };
  }

  // 앵무조개 (nautilus): 나선형 호랑이 줄무늬 껍데기 + 촉수 다발
  const cIvory = stageColor(hex('#f4ebd8'), stage);
  const cStripe = stageColor(hex('#b84c24'), stage);
  const paintShell = (P) => {
    const ang = Math.atan2(P[1], P[0] + 0.15);
    const st = Math.sin(ang * 14);
    return st > 0.22 ? cStripe : cIvory;
  };
  m.sweep('body', (s) => {
    // 로그 나선형 껍데기
    const th = s * Math.PI * 2.25;
    const R = 0.08 + 0.38 * Math.pow(s, 1.35);
    const cx = -0.15 + Math.cos(th) * R;
    const cy = Math.sin(th) * R;
    const rad = 0.05 + 0.24 * Math.pow(s, 1.2);
    return { c: [cx, cy, 0], u: [Math.cos(th), Math.sin(th), 0], v: [0, 0, 1], a: rad, b: rad * 0.65, e: 2.1 };
  }, { ns: 34, nt: 16, capStart: 0.03, capEnd: 0.04, island: [0.02, 0.02, 0.62, 0.62], paint: paintShell });

  // 촉수 6가닥
  for (let i = 0; i < 6; i++) {
    const offY = (i - 2.5) * 0.055;
    m.sweep(`tent_${i}`, (s) => ({
      c: [0.42 + s * 0.38, -0.08 + offY - s * 0.05, (i % 2 === 0 ? 1 : -1) * (0.04 + s * 0.06)],
      u: [0, 1, 0], v: [0, 0, 1], a: 0.024 * (1 - 0.65 * s), b: 0.024 * (1 - 0.65 * s), e: 2.0,
    }), { ns: 8, nt: 6, capEnd: 0.008, island: [0.64, 0.02, 0.98, 0.58], paint: () => hex('#e8d4b8'), bone: 0 });
  }
  addEyes(m, 0.38, 0.08, 0.14, 0.042, '#f4ebd8');
  const fins = { L: { root: [0.3, 0, 0.14], tip: [0.5, 0, 0.25] }, R: { root: [0.3, 0, -0.14], tip: [0.5, 0, -0.25] } };
  return { m, fins, yaw: 14, pitch: 8 };
}

// ════════════════════════════════════════════════════════════════════════════
// 갈라파고스 50종 전체 사양표
// ════════════════════════════════════════════════════════════════════════════
const SPECIES = [
  // 희귀 16종
  { key: 'galapagos_damselfish', builder: buildFish, top: '#1d4ea8', mid: '#2d72d6', bot: '#60a5fa', acc: '#facc15', fin: '#1e3a8a', h: 0.42, w: 0.14, len: 1.55, pattern: 'spots', spotFreq: 14, spotCut: 0.68, iris: '#38bdf8' },
  { key: 'mandarinfish', builder: buildFish, top: '#19b5ff', mid: '#ff6a1a', bot: '#123850', acc: '#22d3ee', fin: '#0ea5e9', h: 0.3, w: 0.17, len: 1.5, dorsalH: 0.32, pecLen: 0.36, pattern: 'mandarin', iris: '#ff4d2e' },
  { key: 'sally_lightfoot_crab', builder: buildInvertebrate, invKind: 'crab' },
  { key: 'moorish_idol', builder: buildFish, top: '#181a20', mid: '#f8fafc', bot: '#facc15', acc: '#181a20', fin: '#181a20', h: 0.5, w: 0.11, len: 1.45, pennant: true, dorsalH: 0.48, pattern: 'moorish', iris: '#facc15' },
  { key: 'picasso_triggerfish', builder: buildFish, top: '#b8a878', mid: '#e2d8b4', bot: '#f8fafc', acc: '#28a8e0', fin: '#e8c454', h: 0.44, w: 0.15, len: 1.55, pattern: 'picasso', iris: '#f59e0b' },
  { key: 'king_angelfish', builder: buildFish, top: '#1a3a8a', mid: '#1d4ed8', bot: '#1e293b', acc: '#ffffff', fin: '#f97316', h: 0.48, w: 0.12, len: 1.55, dorsalH: 0.36, pattern: 'king_angel', iris: '#facc15' },
  { key: 'spanish_hogfish', builder: buildFish, top: '#5b21b6', mid: '#7c3aed', bot: '#facc15', acc: '#eab308', fin: '#f59e0b', h: 0.34, w: 0.15, len: 1.65, pattern: 'hogfish', iris: '#ef4444' },
  { key: 'garden_eel', builder: buildElongated, elongKind: 'garden', top: '#d6ccb8', bot: '#ebe4d4', acc: '#28241e' },
  { key: 'porcupinefish', builder: buildFish, top: '#9c8658', mid: '#c8b482', bot: '#f4eedc', acc: '#2b2218', fin: '#d6c496', h: 0.42, w: 0.32, len: 1.5, dorsalH: 0.18, tailY: 0.22, fork: 0.1, pattern: 'puffer', eyeR: 0.072, iris: '#60a5fa' },
  { key: 'spotted_trumpetfish', builder: buildElongated, elongKind: 'trumpet', top: '#9a7838', bot: '#d4b86a', acc: '#3c2e16' },
  { key: 'red_snapper', builder: buildFish, top: '#c82828', mid: '#e85042', bot: '#fbd5d0', acc: '#991b1b', fin: '#dc2626', h: 0.38, w: 0.16, len: 1.7, iris: '#ef4444' },
  { key: 'skipjack_tuna', builder: buildFish, top: '#1e3a6e', mid: '#6488b8', bot: '#e2ecf5', acc: '#1e293b', fin: '#475569', h: 0.3, w: 0.2, len: 1.85, sickle: true, fork: 0.72, pattern: 'skipjack', iris: '#cbd5e1' },
  { key: 'amberjack', builder: buildFish, top: '#3c6278', mid: '#a8bcc8', bot: '#eef2f6', acc: '#d4a638', fin: '#889aa6', h: 0.31, w: 0.18, len: 1.85, sickle: true, fork: 0.68, pattern: 'bars', barFreq: 4, barCut: 0.85, iris: '#facc15' },
  { key: 'marble_ray', builder: buildRay, top: '#3c3834', bot: '#ebe6dc', acc: '#a89c88', rayPat: 'marble', wingSpan: 0.78 },
  { key: 'blacktip_reef_shark', builder: buildShark, top: '#8c8272', bot: '#f2f0ec', tip: '#14161a' },
  { key: 'whitetip_reef_shark', builder: buildShark, top: '#6c7278', bot: '#e8eaec', tip: '#f8fafc' },

  // 영웅 18종
  { key: 'pygmy_seahorse', builder: buildSyngnathid, top: '#f472b6', acc: '#fb7185', leafy: false },
  { key: 'red_lipped_batfish', builder: buildBatfish },
  { key: 'galapagos_lobster', builder: buildInvertebrate, invKind: 'lobster' },
  { key: 'clown_triggerfish', builder: buildFish, top: '#1c2028', mid: '#262b36', bot: '#1a1e24', acc: '#f8fafc', fin: '#facc15', h: 0.44, w: 0.16, len: 1.55, pattern: 'clown_trigger', iris: '#facc15' },
  { key: 'galapagos_penguin', builder: buildPenguin },
  { key: 'hawksbill_turtle', builder: buildTurtle, shell: '#a85a1c', shell2: '#3a1e0c', skin: '#c48a40' },
  { key: 'golden_cownose_ray', builder: buildRay, top: '#b87a28', bot: '#f5ecd8', acc: '#e8b648', rayPat: 'golden', wingSpan: 0.92 },
  { key: 'ribbon_eel', builder: buildElongated, elongKind: 'ribbon', top: '#1d64e8', bot: '#1e40af', acc: '#facc15' },
  { key: 'giant_clam', builder: buildInvertebrate, invKind: 'clam' },
  { key: 'loggerhead_turtle', builder: buildTurtle, shell: '#8c4428', shell2: '#4c2214', skin: '#b87c48' },
  { key: 'bumphead_parrotfish', builder: buildFish, top: '#2c7a7b', mid: '#389890', bot: '#76b8aa', acc: '#e88a98', fin: '#226468', h: 0.4, w: 0.19, len: 1.75, hump: 0.14, pattern: 'spots', spotFreq: 10, spotCut: 0.65, iris: '#f97316' },
  { key: 'galapagos_fur_seal', builder: buildMammal, mammalKind: 'pinniped', top: '#5a4638', bot: '#9a7e68' },
  { key: 'giant_trevally', builder: buildFish, top: '#4a5a6a', mid: '#98a8b8', bot: '#e2e8f0', acc: '#1e293b', fin: '#475569', h: 0.39, w: 0.17, len: 1.75, sickle: true, fork: 0.72, iris: '#e2e8f0' },
  { key: 'wahoo', builder: buildFish, top: '#1c4c78', mid: '#6492b8', bot: '#dce8f2', acc: '#163052', fin: '#325a80', h: 0.22, w: 0.14, len: 1.98, fork: 0.72, pattern: 'bars', barFreq: 20, barCut: 0.3, iris: '#cbd5e1' },
  { key: 'yellowfin_tuna', builder: buildFish, top: '#183868', mid: '#5882b4', bot: '#e2ecf6', acc: '#facc15', fin: '#facc15', h: 0.32, w: 0.22, len: 1.85, sickle: true, dorsalH: 0.38, analH: 0.34, fork: 0.76, iris: '#fde047' },
  { key: 'spotted_dolphin', builder: buildMammal, mammalKind: 'dolphin', top: '#4a5c72', bot: '#c8d4e0' },
  { key: 'silky_shark', builder: buildShark, top: '#4a5460', bot: '#e2e6ea' },
  { key: 'galapagos_shark', builder: buildShark, top: '#585c58', bot: '#e6e8e4', tip: '#323634' },

  // 전설 9종
  { key: 'blue_ringed_octopus', builder: buildInvertebrate, invKind: 'octopus' },
  { key: 'nautilus', builder: buildInvertebrate, invKind: 'nautilus' },
  { key: 'marine_iguana', builder: buildIguana },
  { key: 'galapagos_sea_lion', builder: buildMammal, mammalKind: 'pinniped', top: '#6e523a', bot: '#b28e68' },
  { key: 'goliath_grouper', builder: buildFish, top: '#645434', mid: '#887448', bot: '#c4b488', acc: '#3a2e1a', fin: '#524428', h: 0.42, w: 0.25, len: 1.75, tailY: 0.26, fork: 0.08, pattern: 'bars', barFreq: 10, barCut: 0.32, iris: '#eab308' },
  { key: 'spotted_eagle_ray', builder: buildRay, top: '#1c2436', bot: '#f4f6f8', acc: '#eef4fc', rayPat: 'eagle', wingSpan: 1.02 },
  { key: 'sailfish', builder: buildBillfish, top: '#143878', mid: '#4482c8', bot: '#d8e8f8', sail: '#1e40af', isSail: true },
  { key: 'scalloped_hammerhead', builder: buildShark, top: '#626862', bot: '#e8eae6', hammer: true },
  { key: 'pilot_whale', builder: buildMammal, mammalKind: 'pilot', top: '#1e2228', bot: '#464e58' },

  // 신화 6종
  { key: 'leafy_seadragon', builder: buildSyngnathid, top: '#9a8430', acc: '#c8a83c', leafy: true },
  { key: 'leatherback_turtle', builder: buildTurtle, shell: '#1c222a', shell2: '#485464', skin: '#2a323c', leather: true },
  { key: 'napoleon_wrasse', builder: buildFish, top: '#16686e', mid: '#24989c', bot: '#74c8c0', acc: '#38bdf8', fin: '#0e7490', h: 0.44, w: 0.2, len: 1.75, hump: 0.16, pattern: 'napoleon', iris: '#facc15' },
  { key: 'mobula_ray', builder: buildRay, top: '#182436', bot: '#f2f5f8', acc: '#3b6a9c', rayPat: 'mobula', wingSpan: 1.12, horns: true },
  { key: 'blue_marlin', builder: buildBillfish, top: '#102e68', mid: '#2c6cb8', bot: '#e2eef8', sail: '#1e3a8a', isSail: false },
  { key: 'tiger_shark', builder: buildShark, top: '#4a5450', bot: '#e6e8e2', tiger: true },

  // 태초 1종
  { key: 'brydes_whale', builder: buildMammal, mammalKind: 'whale', top: '#3c4856', bot: '#b8c4d0' },
];

// ── CLI 파싱 및 실행 ──
const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const onlySet = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',').map((s) => s.trim())) : null;
const skipExisting = args.includes('--skip-existing');
const list = onlySet ? SPECIES.filter((s) => onlySet.has(s.key)) : SPECIES;

const STAGES = [
  { stage: 2, prefix: '' },
  { stage: 1, prefix: 'juv_' },
  { stage: 0, prefix: 'fry_' },
];

console.log(`Building ${list.length} Galápagos species (${list.length * 3} GLBs + ${list.length * 6} 2D images)...`);
const t0 = Date.now();
let built = 0;

for (const spec of list) {
  for (const { stage, prefix } of STAGES) {
    const artKey = `${prefix}${spec.key}`;
    const glbPath = resolve(GLB_DIR, `${artKey}.glb`);
    const imgPath = resolve(IMG_DIR, `${artKey}.webp`);
    const smPath = resolve(SM_DIR, `${artKey}.webp`);
    if (skipExisting && existsSync(glbPath) && existsSync(imgPath) && existsSync(smPath)) {
      built++;
      continue;
    }
    const { m, fins, legs, yaw, pitch } = spec.builder(spec, stage);
    const { glb } = await bake(artKey, m, {
      fins,
      legs,
      weight: defaultWeight,
      source: 'galapagos-part-built (2026-11-27)',
      atlas: 512,
      roughness: 0.58,
      compress: { webpQuality: 90 },
    });
    writeFileSync(glbPath, glb);
    await render2DCard(m, artKey, yaw, pitch);
    built++;
  }
  if (built % 15 === 0 || built === list.length * 3) {
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  [${built}/${list.length * 3}] (${sec}s) last: ${spec.key}`);
  }
}

console.log(`Done! Built ${built} models & cards in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
