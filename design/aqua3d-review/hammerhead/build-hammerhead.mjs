// 귀상어(hammerhead · juv_hammerhead · fry_hammerhead) 전용 정밀 3D GLB 재제작기
// 기준 이미지(public/aqua/fish/hammerhead.webp)의 실사 형태를 충실히 반영:
// 넓은 부채꼴 물결(scalloped) 망치 머리(cephalofoil) · 끝단 눈 · 높고 낫처럼 휜 제1 등지느러미 ·
// 긴 가슴지느러미 · 배/뒷/제2등 지느러미 · 긴 상엽 이형 꼬리 · 5줄 아가미 · 청동회갈색+은백색 역음영.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Model, bake, spineWeight, fbm, ridge, mix, smooth, clamp, norm, add, cross } from '../polar/kit.mjs';

const ROOT = resolve(process.cwd());
const GLB_DIR = resolve(ROOT, 'public/aqua/models/fish');
const OUT_DIR = resolve(ROOT, 'design/aqua3d-review/hammerhead');
mkdirSync(OUT_DIR, { recursive: true });

const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

function buildHammerhead(stage) {
  // stage: 2=adult, 1=juv, 0=fry
  const m = new Model();
  const isFry = stage === 0;
  const isJuv = stage === 1;

  // 기준 이미지(hammerhead.webp)에서 직접 추출한 실사 색감
  const cBack = isFry ? hex('#6e685c') : isJuv ? hex('#747065') : hex('#68665e');
  const cMid = isFry ? hex('#969082') : isJuv ? hex('#96948a') : hex('#8a8880');
  const cBelly = isFry ? hex('#e5e3d8') : hex('#e8e7df');
  const cTip = isFry ? hex('#222428') : hex('#383a3e');

  const paintBody = (P, n) => {
    // 역음영(countershading): 등은 청동회갈색, 옆구리는 은회색, 배는 크림백색
    const ny = clamp((P[1] / 0.19) * 0.5 + 0.5, 0, 1);
    let col = ny > 0.52 ? mix(cMid, cBack, smooth(0.52, 0.88, ny)) : mix(cBelly, cMid, smooth(0.18, 0.55, ny));

    // 상어 피부 미세 입자(dermal denticle sheen) + 자연스러운 얼룩 음영
    const fine = fbm([P[0] * 28, P[1] * 28, P[2] * 28], 3);
    const broad = fbm([P[0] * 6.5, P[1] * 6.5, P[2] * 6.5], 3);
    col = mul(col, 0.90 + fine * 0.14 + (broad - 0.5) * 0.1);

    // 등줄기 하이라이트/어두운 중심선
    if (n[1] > 0.65 && Math.abs(P[2]) < 0.08) col = mul(col, 0.92);

    // 아가미 5줄 (가슴지느러미 뿌리 바로 앞 x = 0.24 .. 0.40)
    if (P[0] > 0.22 && P[0] < 0.42 && P[1] > -0.095 && P[1] < 0.055 && Math.abs(n[2]) > 0.42) {
      for (let g = 0; g < 5; g++) {
        const gx = 0.39 - g * 0.036 + P[1] * 0.12;
        const d = Math.abs(P[0] - gx);
        if (d < 0.009) {
          const slit = 1 - smooth(0.002, 0.009, d);
          col = mix(col, [26, 28, 30], slit * 0.72);
        }
      }
    }
    return col;
  };

  const paintHammer = (P, n) => {
    // 망치 머리는 윗면이 청동회갈색, 아랫면이 밝은 크림백색
    const topK = smooth(-0.22, 0.28, n[1]);
    let col = mix(cBelly, cBack, topK);
    const fine = fbm([P[0] * 24, P[1] * 24, P[2] * 24], 3);
    col = mul(col, 0.92 + fine * 0.13);
    // 앞 가장자리 물결(scallop) 음영 강조
    if (n[0] > 0.55) col = mul(col, 0.88);
    // 아래쪽 반달 입선 (x ≈ 0.72, y < -0.02, |z| < 0.12)
    if (n[1] < -0.35 && Math.abs(P[2]) < 0.11) {
      const mouthCurve = 0.72 - (P[2] * P[2]) * 4.5;
      const md = Math.abs(P[0] - mouthCurve);
      if (md < 0.014) col = mix(col, [32, 24, 24], (1 - md / 0.014) * 0.78);
    }
    return col;
  };

  const paintFin = (P, n, [s]) => {
    const shade = smooth(-0.3, 0.4, n[1]);
    let col = mix(mix(cMid, cBelly, 0.35), cBack, shade);
    const fine = fbm([P[0] * 22, P[1] * 22, P[2] * 22], 2);
    col = mul(col, 0.92 + fine * 0.12);
    // 지느러미 끝단 어두운 스모키 그라데이션 (기준 이미지 특징)
    if (s > 0.62) col = mix(col, cTip, smooth(0.62, 0.96, s) * (isFry ? 0.85 : 0.58));
    return col;
  };

  const paintEye = (P, n, [s]) => {
    const facing = Math.abs(n[2]);
    const dx = (s - 0.5) * 2.1, dy = n[1] * 1.15;
    const r = Math.hypot(dx, dy);
    if (facing < 0.2) return cBack;
    if (r < 0.62) {
      const glint = Math.exp(-((dx - 0.15) ** 2 + (dy - 0.18) ** 2) * 38);
      return mix([12, 14, 16], [248, 250, 255], clamp(glint * 0.9));
    }
    const rim = smooth(0.62, 0.8, r) * (1 - smooth(0.88, 1.0, r));
    return mix(hex('#34322e'), hex('#d6d0c0'), rim * 0.85);
  };

  // 1. 유선형 상어 몸통 (s=0 머리 접합부 x=+0.82 → s=1 꼬리 자루 x=-0.88)
  // 앞 끝이 망치 머리 안쪽으로 자연스럽게 들어가도록 설계 (앞에 뭉툭한 코가 튀어나오지 않음!)
  const bodyFull = isFry ? 1.04 : isJuv ? 1.02 : 1.0;
  m.sweep('body', (s) => {
    const x = 0.82 - s * 1.70;
    // 머리 쪽(s<0.18)은 납작하게 퍼지며 망치 머리와 매끄럽게 합쳐짐
    const prof = Math.sin(Math.pow(clamp(s, 0.015, 0.985), 0.58) * Math.PI);
    const headFlat = smooth(0.0, 0.22, s);
    const a = (0.026 + 0.178 * Math.pow(prof, 0.82) * bodyFull) * (0.48 + 0.52 * headFlat);
    const b = (0.024 + 0.152 * Math.pow(prof, 0.86) * bodyFull) * (0.85 + 0.15 * headFlat);
    // 등은 살짝 아치형, 꼬리 자루는 수평
    const y = 0.028 * Math.sin(clamp(s, 0, 0.85) / 0.85 * Math.PI) - 0.012 * (1 - headFlat);
    return { c: [x, y, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.15 };
  }, { ns: 18, nt: 12, capStart: 0.035, capEnd: 0.025, island: [0.02, 0.02, 0.54, 0.52], paint: paintBody });

  // 2. 넓은 T자형 물결 망치 머리 (cephalofoil)
  const hammerHalf = isFry ? 0.36 : isJuv ? 0.37 : 0.39;
  m.sweep('hammer', (s) => {
    const u = (s - 0.5) * 2; // -1(오른 끝) .. 0(중앙) .. +1(왼 끝)
    const au = Math.abs(u);
    const z = u * hammerHalf;
    // 뒤로 젖혀진 부채꼴 곡선 + 앞 가장자리 물결(scallop) 굴곡
    const sweepBack = Math.pow(au, 1.45) * 0.15;
    const scallop = (Math.cos(au * Math.PI * 3.0) * 0.012 - (au < 0.12 ? (0.12 - au) * 0.14 : 0));
    const cx = 0.84 - sweepBack + scallop;
    const cy = -0.008 - au * 0.012;
    // 앞뒤 폭(a): 중앙에서 몸통과 이어지다 바깥으로 갈수록 좁고 끝에서 둥글게 말림
    const chord = 0.135 * (1 - 0.24 * Math.pow(au, 1.2)) * (0.82 + 0.18 * Math.sin((1 - au) * Math.PI * 0.5));
    // 위아래 두께(b): 납작한 유체역학 날개 단면
    const thick = 0.044 * (1 - 0.42 * Math.pow(au, 0.9));
    return {
      c: [cx, cy, z],
      u: [1, 0, 0],
      v: [0, 1, 0],
      a: Math.max(0.055, chord),
      b: Math.max(0.022, thick),
      e: 2.3,
    };
  }, { ns: 16, nt: 10, capStart: 0.028, capEnd: 0.028, island: [0.56, 0.02, 0.98, 0.28], paint: paintHammer, bone: 0 });

  // 3. 눈 (망치 머리 양쪽 끝단 앞쪽 바깥)
  const eyeR = isFry ? 0.030 : isJuv ? 0.027 : 0.025;
  const eyeX = 0.84 - 0.15 + 0.032;
  const eyeY = -0.018;
  const eyeZ = hammerHalf + 0.006;
  m.sphere('eye_L', [eyeX, eyeY, eyeZ], eyeR, { ns: 6, nt: 8, island: [0.88, 0.88, 0.99, 0.99], paint: paintEye, bone: 0 });
  m.sphere('eye_R', [eyeX, eyeY, -eyeZ], eyeR, { ns: 6, nt: 8, island: [0.88, 0.88, 0.99, 0.99], paint: paintEye, bone: 0 });

  // 4. 높고 낫처럼 휜 제1 등지느러미 (falcate 1st dorsal)
  const d1H = isFry ? 0.31 : isJuv ? 0.34 : 0.38;
  m.sweep('dorsal1', (s) => {
    const y = 0.155 + s * d1H;
    // 앞쪽은 우아하게 뒤로 휘고, 끝은 뾰족하게 젖혀짐
    const x = 0.12 - Math.pow(s, 1.15) * 0.25;
    const chord = 0.165 * Math.pow(1 - s * 0.86, 0.92);
    const thick = 0.026 * (1 - 0.72 * s);
    return { c: [x, y, 0], u: [1, 0, 0], v: [0, 0, 1], a: Math.max(0.015, chord), b: Math.max(0.006, thick), e: 1.9 };
  }, { ns: 10, nt: 8, capEnd: 0.014, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 2 });

  // 5. 제2 등지느러미
  m.sweep('dorsal2', (s) => {
    const y = 0.08 + s * 0.095;
    const x = -0.52 - s * 0.10;
    return { c: [x, y, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.062 * (1 - 0.76 * s), b: 0.013 * (1 - 0.65 * s), e: 1.9 };
  }, { ns: 6, nt: 6, capEnd: 0.008, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 4 });

  // 6. 긴 날개형 가슴지느러미 (fin_L · fin_R)
  const pecLen = isFry ? 0.35 : 0.40;
  for (const side of [1, -1]) {
    m.sweep(side > 0 ? 'fin_L' : 'fin_R', (s) => {
      const px = 0.19 - Math.pow(s, 1.1) * 0.28;
      const py = -0.095 - s * 0.125;
      const pz = side * (0.125 + s * pecLen);
      const chord = 0.135 * Math.pow(1 - s * 0.78, 0.75);
      const thick = 0.022 * (1 - 0.7 * s);
      return { c: [px, py, pz], u: [1, 0.12, 0], v: [0, 1, 0], a: Math.max(0.016, chord), b: Math.max(0.006, thick), e: 1.95 };
    }, { ns: 9, nt: 8, capEnd: 0.014, island: [0.48, 0.62, 0.86, 0.98], paint: paintFin, bone: side > 0 ? 6 : 8 });
  }
  const fins = {
    L: { root: [0.19, -0.095, 0.125], tip: [0.19 - 0.28, -0.22, 0.125 + pecLen] },
    R: { root: [0.19, -0.095, -0.125], tip: [0.19 - 0.28, -0.22, -(0.125 + pecLen)] },
  };

  // 7. 배지느러미 (pelvic fins) + 뒷지느러미 (anal fin)
  for (const side of [1, -1]) {
    m.sweep(`pelvic_${side > 0 ? 'L' : 'R'}`, (s) => ({
      c: [-0.26 - s * 0.12, -0.115 - s * 0.075, side * (0.065 + s * 0.095)],
      u: [1, 0.1, 0], v: [0, 1, 0],
      a: 0.072 * (1 - 0.72 * s), b: 0.012 * (1 - 0.6 * s), e: 1.9,
    }), { ns: 5, nt: 6, capEnd: 0.008, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 3 });
  }
  m.sweep('anal', (s) => ({
    c: [-0.51 - s * 0.10, -0.072 - s * 0.082, 0],
    u: [1, 0, 0], v: [0, 0, 1],
    a: 0.058 * (1 - 0.74 * s), b: 0.012 * (1 - 0.65 * s), e: 1.9,
  }), { ns: 5, nt: 6, capEnd: 0.008, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 4 });

  // 8. 길고 우아한 이형 꼬리지느러미 (heterocercal tail: 긴 상엽 + 짧은 하엽)
  m.sweep('tail_top', (s) => {
    const x = -0.82 - s * 0.46;
    const y = 0.01 + Math.pow(s, 0.92) * 0.42;
    const notch = 1 - 0.25 * Math.exp(-Math.pow((s - 0.78) / 0.08, 2));
    const chord = 0.098 * (1 - 0.68 * s) * notch;
    const thick = 0.022 * (1 - 0.75 * s);
    return { c: [x, y, 0], u: [0.52, 0.85, 0], v: [0, 0, 1], a: Math.max(0.012, chord), b: Math.max(0.005, thick), e: 1.85 };
  }, { ns: 10, nt: 8, capEnd: 0.012, island: [0.02, 0.58, 0.44, 0.98], paint: paintFin, bone: 5 });

  m.sweep('tail_bot', (s) => {
    const x = -0.82 - s * 0.22;
    const y = -0.01 - Math.pow(s, 0.95) * 0.24;
    const chord = 0.082 * (1 - 0.72 * s);
    const thick = 0.019 * (1 - 0.72 * s);
    return { c: [x, y, 0], u: [0.45, -0.89, 0], v: [0, 0, 1], a: Math.max(0.012, chord), b: Math.max(0.005, thick), e: 1.85 };
  }, { ns: 8, nt: 6, capEnd: 0.01, island: [0.02, 0.58, 0.44, 0.98], paint: paintFin, bone: 5 });

  return { m, fins };
}

function weight(part, g) {
  // 상어 가슴지느러미는 굳은 날개(stiff hydrofoil) — fin_L/R 뿌리 뼈에 단단히 묶어 과도한 펄럭임을 방지
  if (part.name === 'fin_L') return [[6, 1]];
  if (part.name === 'fin_R') return [[8, 1]];
  if (part.bone === 0) return [[0, 1]];
  if (part.bone === 5) return [[5, 1]];
  return spineWeight(g[0]);
}

// 4각도 미리보기 시트 렌더러 (옆 · 3/4 · 위 · 앞)
async function renderSheet(model, outPath) {
  const S = 384;
  const views = [
    { yaw: 0, pitch: 0, ox: 0, oy: 0 },      // 옆모습
    { yaw: 28, pitch: 18, ox: S, oy: 0 },    // 3/4 (기준 이미지와 같은 각도!)
    { yaw: 0, pitch: 88, ox: 0, oy: S },     // 위에서 본 T자 망치 머리
    { yaw: 90, pitch: 8, ox: S, oy: S },     // 정면
  ];
  const W = S * 2, H = S * 2;
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { rgba[i * 4] = 242; rgba[i * 4 + 1] = 246; rgba[i * 4 + 2] = 250; rgba[i * 4 + 3] = 255; }

  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of model.parts) for (const v of p.P) {
    if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0];
    if (v[1] < y0) y0 = v[1]; if (v[1] > y1) y1 = v[1];
    if (v[2] < z0) z0 = v[2]; if (v[2] > z1) z1 = v[2];
  }
  const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
  const L1 = norm([0.38, 0.68, 0.62]), L2 = norm([-0.55, -0.35, 0.55]);

  for (const { yaw, pitch, ox, oy } of views) {
    const cyaw = Math.cos(yaw * Math.PI / 180), syaw = Math.sin(yaw * Math.PI / 180);
    const cp = Math.cos(pitch * Math.PI / 180), sp = Math.sin(pitch * Math.PI / 180);
    const rotP = (v) => {
      const dx = v[0] - cx, dy = v[1] - cy, dz = v[2] - cz;
      const x1r = dx * cyaw - dz * syaw, z1r = dx * syaw + dz * cyaw;
      return [x1r, dy * cp - z1r * sp, dy * sp + z1r * cp];
    };
    const rotN = (n) => {
      const x1r = n[0] * cyaw - n[2] * syaw, z1r = n[0] * syaw + n[2] * cyaw;
      return [x1r, n[1] * cp - z1r * sp, n[1] * sp + z1r * cp];
    };
    let px0 = 1e9, px1 = -1e9, py0 = 1e9, py1 = -1e9;
    for (const p of model.parts) for (const v of p.P) {
      const r = rotP(v);
      if (r[0] < px0) px0 = r[0]; if (r[0] > px1) px1 = r[0];
      if (r[1] < py0) py0 = r[1]; if (r[1] > py1) py1 = r[1];
    }
    const scale = (S * 0.82) / Math.max(px1 - px0, py1 - py0, 0.001);
    const pcx = (px0 + px1) * 0.5, pcy = (py0 + py1) * 0.5;
    const zbuf = new Float32Array(S * S).fill(-1e9);

    for (const part of model.parts) {
      const N = part.N;
      const R = part.P.map((v) => { const r = rotP(v); return [S * 0.5 + (r[0] - pcx) * scale, S * 0.5 - (r[1] - pcy) * scale, r[2]]; });
      const RN = N.map(rotN);
      for (let i = 0; i < part.I.length; i += 3) {
        const i0 = part.I[i], i1 = part.I[i + 1], i2 = part.I[i + 2];
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
          const P3 = [part.P[i0][0] * w0 + part.P[i1][0] * w1 + part.P[i2][0] * w2, part.P[i0][1] * w0 + part.P[i1][1] * w1 + part.P[i2][1] * w2, part.P[i0][2] * w0 + part.P[i1][2] * w1 + part.P[i2][2] * w2];
          const n3 = norm([N[i0][0] * w0 + N[i1][0] * w1 + N[i2][0] * w2, N[i0][1] * w0 + N[i1][1] * w1 + N[i2][1] * w2, N[i0][2] * w0 + N[i1][2] * w1 + N[i2][2] * w2]);
          const rn = norm([RN[i0][0] * w0 + RN[i1][0] * w1 + RN[i2][0] * w2, RN[i0][1] * w0 + RN[i1][1] * w1 + RN[i2][1] * w2, RN[i0][2] * w0 + RN[i1][2] * w1 + RN[i2][2] * w2]);
          if (rn[2] < 0) { rn[0] = -rn[0]; rn[1] = -rn[1]; rn[2] = -rn[2]; }
          const st = [part.ST[i0][0] * w0 + part.ST[i1][0] * w1 + part.ST[i2][0] * w2, part.ST[i0][1] * w0 + part.ST[i1][1] * w1 + part.ST[i2][1] * w2];
          const base = part.paint(P3, n3, st);
          const l = 0.44 + Math.max(0, rn[0] * L1[0] + rn[1] * L1[1] + rn[2] * L1[2]) * 0.58 + Math.max(0, rn[0] * L2[0] + rn[1] * L2[1] + rn[2] * L2[2]) * 0.16;
          const o = ((oy + y) * W + (ox + x)) * 4;
          rgba[o] = clamp(Math.round(base[0] * l), 0, 255);
          rgba[o + 1] = clamp(Math.round(base[1] * l), 0, 255);
          rgba[o + 2] = clamp(Math.round(base[2] * l), 0, 255);
          rgba[o + 3] = 255;
        }
      }
    }
  }
  await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92 }).toFile(outPath);
}

const TARGETS = [
  { key: 'hammerhead', stage: 2 },
  { key: 'juv_hammerhead', stage: 1 },
  { key: 'fry_hammerhead', stage: 0 },
];

let rev = readFileSync(resolve(ROOT, 'src/lib/aqua3d/model-revisions.ts'), 'utf8');

for (const { key, stage } of TARGETS) {
  const { m, fins } = buildHammerhead(stage);
  const { glb, tris } = await bake(key, m, {
    fins,
    weight,
    source: 'hammerhead-part-built (2026-11-27)',
    atlas: 512,
    roughness: 0.48,
    compress: { webpQuality: 92 },
  });
  const out = resolve(GLB_DIR, `${key}.glb`);
  writeFileSync(out, glb);
  const h = createHash('sha256').update(glb).digest('hex').slice(0, 12);
  rev = rev.replace(new RegExp(`\\b${key}:'[0-9a-f]{12}'`), `${key}:'${h}'`);
  console.log(`Built ${key}.glb (${(glb.length / 1024).toFixed(1)} KB, ${tris} tris, rev=${h})`);
  if (stage === 2) await renderSheet(m, resolve(OUT_DIR, 'preview.webp'));
}

writeFileSync(resolve(ROOT, 'src/lib/aqua3d/model-revisions.ts'), rev);
console.log('Updated model-revisions.ts');
