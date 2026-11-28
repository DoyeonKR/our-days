// 갈라파고스 핵심 비어류 · 특수해부학 15종(×3단계 = 45 GLB) 정밀 3D 조각 빌더 (polar/kit.mjs 기반)
// 대상: 홍살귀상어 · 갈라파고스 펭귄(12뼈) · 바다이구아나(12뼈) · 브라이드고래 · 들쇠고래 · 점박이돌고래 ·
//       갈라파고스 바다사자 · 갈라파고스 물개 · 대모거북 · 붉은바다거북 · 장수거북 ·
//       대리석가오리 · 황금매가오리 · 얼룩매가오리 · 악마가오리
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Model, bake, spineWeight, fbm, noise, mix, smooth, clamp, norm, add, cross } from '../polar/kit.mjs';

const ROOT = resolve(process.cwd());
const GLB_DIR = resolve(ROOT, 'public/aqua/models/fish');
mkdirSync(GLB_DIR, { recursive: true });

const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mul = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
const stageOf = (k) => (k.startsWith('fry_') ? 0 : k.startsWith('juv_') ? 1 : 2);
const famOf = (k) => k.replace(/^(fry_|juv_)/, '');

// 1. 홍살귀상어 (Scalloped Hammerhead) — T자 물결 망치 머리 + 낫형 제1등지느러미 + 이형 꼬리
function buildScallopedHammerhead(stage) {
  const m = new Model();
  const isFry = stage === 0, isJuv = stage === 1;
  const cBack = isFry ? hex('#7c6e58') : isJuv ? hex('#726652') : hex('#665c4a');
  const cMid = isFry ? hex('#a0947e') : isJuv ? hex('#968b78') : hex('#8b8270');
  const cBelly = hex('#eceae2'), cTip = hex('#24262b');

  const paintBody = (P, n) => {
    const ny = clamp((P[1] / 0.19) * 0.5 + 0.5, 0, 1);
    let col = ny > 0.52 ? mix(cMid, cBack, smooth(0.52, 0.88, ny)) : mix(cBelly, cMid, smooth(0.18, 0.55, ny));
    const fine = fbm([P[0] * 26, P[1] * 26, P[2] * 26], 3);
    col = mul(col, 0.91 + fine * 0.14);
    if (P[0] > 0.22 && P[0] < 0.42 && P[1] > -0.095 && P[1] < 0.055 && Math.abs(n[2]) > 0.42) {
      for (let g = 0; g < 5; g++) {
        const d = Math.abs(P[0] - (0.39 - g * 0.036 + P[1] * 0.12));
        if (d < 0.009) col = mix(col, [24, 26, 28], (1 - smooth(0.002, 0.009, d)) * 0.72);
      }
    }
    return col;
  };
  const paintHammer = (P, n) => {
    let col = mix(cBelly, cBack, smooth(-0.22, 0.28, n[1]));
    col = mul(col, 0.92 + fbm([P[0] * 24, P[1] * 24, P[2] * 24], 3) * 0.13);
    if (n[1] < -0.35 && Math.abs(P[2]) < 0.11) {
      const md = Math.abs(P[0] - (0.72 - P[2] * P[2] * 4.5));
      if (md < 0.014) col = mix(col, [30, 22, 22], (1 - md / 0.014) * 0.78);
    }
    return col;
  };
  const paintFin = (P, n, [s]) => {
    let col = mix(mix(cMid, cBelly, 0.35), cBack, smooth(-0.3, 0.4, n[1]));
    col = mul(col, 0.92 + fbm([P[0] * 22, P[1] * 22, P[2] * 22], 2) * 0.12);
    if (s > 0.58) col = mix(col, cTip, smooth(0.58, 0.96, s) * 0.68);
    return col;
  };
  const paintEye = (P, n, [s]) => {
    if (Math.abs(n[2]) < 0.2) return cBack;
    const r = Math.hypot((s - 0.5) * 2.1, n[1] * 1.15);
    if (r < 0.62) return mix([12, 14, 16], [248, 250, 255], clamp(Math.exp(-(((s - 0.5) * 2.1 - 0.15) ** 2 + (n[1] * 1.15 - 0.18) ** 2) * 38) * 0.9));
    return mix(hex('#34322e'), hex('#d6d0c0'), smooth(0.62, 0.8, r) * (1 - smooth(0.88, 1, r)) * 0.85);
  };

  m.sweep('body', (s) => {
    const x = 0.82 - s * 1.70, prof = Math.sin(Math.pow(clamp(s, 0.015, 0.985), 0.58) * Math.PI), hf = smooth(0, 0.22, s);
    return { c: [x, 0.028 * Math.sin(clamp(s, 0, 0.85) / 0.85 * Math.PI) - 0.012 * (1 - hf), 0], u: [0, 1, 0], v: [0, 0, 1], a: (0.026 + 0.175 * Math.pow(prof, 0.82)) * (0.48 + 0.52 * hf), b: (0.024 + 0.15 * Math.pow(prof, 0.86)) * (0.85 + 0.15 * hf), e: 2.15 };
  }, { ns: 18, nt: 12, capStart: 0.035, capEnd: 0.025, island: [0.02, 0.02, 0.54, 0.52], paint: paintBody });

  const hh = isFry ? 0.35 : 0.39;
  m.sweep('hammer', (s) => {
    const u = (s - 0.5) * 2, au = Math.abs(u);
    const cx = 0.84 - Math.pow(au, 1.45) * 0.15 + (Math.cos(au * Math.PI * 3) * 0.014 - (au < 0.12 ? (0.12 - au) * 0.14 : 0));
    return { c: [cx, -0.008 - au * 0.012, u * hh], u: [1, 0, 0], v: [0, 1, 0], a: Math.max(0.055, 0.135 * (1 - 0.24 * Math.pow(au, 1.2))), b: Math.max(0.022, 0.044 * (1 - 0.42 * Math.pow(au, 0.9))), e: 2.3 };
  }, { ns: 16, nt: 10, capStart: 0.028, capEnd: 0.028, island: [0.56, 0.02, 0.98, 0.28], paint: paintHammer, bone: 0 });

  for (const sd of [1, -1]) m.sphere(sd > 0 ? 'eye_L' : 'eye_R', [0.722, -0.018, sd * (hh + 0.006)], 0.026, { ns: 6, nt: 8, island: [0.88, 0.88, 0.99, 0.99], paint: paintEye, bone: 0 });
  m.sweep('dorsal1', (s) => ({ c: [0.12 - Math.pow(s, 1.15) * 0.25, 0.155 + s * 0.38, 0], u: [1, 0, 0], v: [0, 0, 1], a: Math.max(0.015, 0.165 * Math.pow(1 - s * 0.86, 0.92)), b: Math.max(0.006, 0.026 * (1 - 0.72 * s)), e: 1.9 }), { ns: 10, nt: 8, capEnd: 0.014, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 2 });
  m.sweep('dorsal2', (s) => ({ c: [-0.52 - s * 0.10, 0.08 + s * 0.095, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.062 * (1 - 0.76 * s), b: 0.013 * (1 - 0.65 * s), e: 1.9 }), { ns: 6, nt: 6, capEnd: 0.008, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 4 });

  const pecLen = isFry ? 0.34 : 0.40;
  for (const sd of [1, -1]) {
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [0.19 - Math.pow(s, 1.1) * 0.28, -0.095 - s * 0.125, sd * (0.125 + s * pecLen)], u: [1, 0.12, 0], v: [0, 1, 0], a: Math.max(0.016, 0.135 * Math.pow(1 - s * 0.78, 0.75)), b: Math.max(0.006, 0.022 * (1 - 0.7 * s)), e: 1.95 }), { ns: 9, nt: 8, capEnd: 0.014, island: [0.48, 0.62, 0.86, 0.98], paint: paintFin, bone: sd > 0 ? 6 : 8 });
    m.sweep(sd > 0 ? 'pelvic_L' : 'pelvic_R', (s) => ({ c: [-0.26 - s * 0.12, -0.115 - s * 0.075, sd * (0.065 + s * 0.095)], u: [1, 0.1, 0], v: [0, 1, 0], a: 0.072 * (1 - 0.72 * s), b: 0.012 * (1 - 0.6 * s), e: 1.9 }), { ns: 5, nt: 6, capEnd: 0.008, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 3 });
  }
  m.sweep('anal', (s) => ({ c: [-0.51 - s * 0.10, -0.072 - s * 0.082, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.058 * (1 - 0.74 * s), b: 0.012 * (1 - 0.65 * s), e: 1.9 }), { ns: 5, nt: 6, capEnd: 0.008, island: [0.56, 0.30, 0.98, 0.60], paint: paintFin, bone: 4 });
  m.sweep('tail_top', (s) => ({ c: [-0.82 - s * 0.46, 0.01 + Math.pow(s, 0.92) * 0.42, 0], u: [0.52, 0.85, 0], v: [0, 0, 1], a: Math.max(0.012, 0.098 * (1 - 0.68 * s)), b: Math.max(0.005, 0.022 * (1 - 0.75 * s)), e: 1.85 }), { ns: 10, nt: 8, capEnd: 0.012, island: [0.02, 0.58, 0.44, 0.98], paint: paintFin, bone: 5 });
  m.sweep('tail_bot', (s) => ({ c: [-0.82 - s * 0.22, -0.01 - Math.pow(s, 0.95) * 0.24, 0], u: [0.45, -0.89, 0], v: [0, 0, 1], a: Math.max(0.012, 0.082 * (1 - 0.72 * s)), b: Math.max(0.005, 0.019 * (1 - 0.72 * s)), e: 1.85 }), { ns: 8, nt: 6, capEnd: 0.01, island: [0.02, 0.58, 0.44, 0.98], paint: paintFin, bone: 5 });

  return {
    m, roughness: 0.48,
    fins: { L: { root: [0.19, -0.095, 0.125], tip: [-0.09, -0.22, 0.125 + pecLen] }, R: { root: [0.19, -0.095, -0.125], tip: [-0.09, -0.22, -(0.125 + pecLen)] } },
    weight: (part, g) => part.name === 'fin_L' ? [[6, 1]] : part.name === 'fin_R' ? [[8, 1]] : part.bone === 0 ? [[0, 1]] : part.bone === 5 ? [[5, 1]] : spineWeight(g[0]),
  };
}

// 2. 갈라파고스 펭귄 (Galápagos Penguin) — 12뼈(leg_L/leg_R) + 눈~목 흰 고리 + 가슴 검은 말굽 띠
function buildGalapagosPenguin(stage) {
  const chick = stage === 0, juv = stage === 1, m = new Model();
  const T = chick
    ? [[-3.0, .42, .4, .06], [-2.4, 1.02, .94, 0], [-1.2, 1.46, 1.38, -.06], [.1, 1.56, 1.46, -.06], [1.2, 1.38, 1.28, 0], [1.85, 1.14, 1.04, .1], [2.45, .96, .88, .2], [2.95, .78, .72, .22], [3.35, .40, .38, .22]]
    : [[-3.8, .3, .28, .1], [-3.2, .72, .64, .02], [-2.1, 1.14, 1.04, -.06], [-.8, 1.38, 1.26, -.1], [.5, 1.36, 1.24, -.08], [1.5, 1.16, 1.04, 0], [2.15, .90, .82, .1], [2.7, .78, .70, .18], [3.25, .58, .50, .25], [3.7, .28, .25, .28]];
  const X0 = T[0][0], X1 = T[T.length - 1][0], headX = chick ? 2.45 : 2.7, neckX = chick ? 1.85 : 2.15;
  const P0 = (x) => { let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++; const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t); return { a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k }; };
  const headK = (x) => smooth(neckX - .15, headX + .1, x);
  const P = (x) => { const p = P0(x); return { ...p, b: p.b * (1 - .22 * headK(x)) }; };
  const surf = (x, th, k = 1) => { const p = P(x); return [x, p.cy + Math.cos(th) * p.a * k, Math.sin(th) * p.b * k]; };
  const eyeX = chick ? 2.75 : 3.08, eyeC = [-1, 1].map((sd) => surf(eyeX, sd * 1.02, .96));
  const SLATE = juv ? [64, 68, 76] : [28, 32, 38], CAP = [18, 20, 24], WHITE = [240, 241, 236];

  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return { c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b }; }, {
    ns: 44, nt: 24, capStart: .18, capEnd: .18, capRings: 3, island: [0, 0, 1, .60], bone: 'body',
    paint: (p, n) => {
      const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / pr.a, side = Math.abs(z) / pr.b;
      const grain = .93 + .14 * fbm([x * 6, y * 6, z * 6], 3);
      if (chick) {
        let c = mix([112, 106, 102], [186, 182, 176], smooth(.1, -.4, yr));
        return mul(c, grain);
      }
      const white = smooth(.04, -.12, yr);
      let c = mix(SLATE, WHITE, white);
      const head = smooth(neckX - .15, neckX + .25, x);
      c = mix(c, CAP, head);
      // 갈라파고스 펭귄 고유: 눈 뒤에서 턱 밑으로 이어지는 가는 흰 C자 띠 + 가슴 검은 말굽 띠
      const cheekBand = head * smooth(.12, .03, Math.abs((x - (eyeX - .35)) * .85 - (yr + .35) * .65)) * smooth(.2, .5, side) * smooth(.55, .1, yr);
      c = mix(c, WHITE, cheekBand * (juv ? .5 : .92));
      const chestBand = smooth(.24, .06, Math.abs(x - 1.55)) * white * (1 - smooth(.65, .85, side));
      c = mix(c, CAP, chestBand * (juv ? .4 : .9));
      // 가슴 옆 작은 검은 점
      if (white > 0.5 && x < 1.2 && x > -2.0 && noise(x * 7, y * 7, z * 7) > 0.84) c = mix(c, CAP, 0.55);
      return mul(c, grain);
    },
  });

  const bx = X1 - .12, bp = P(X1 - .25), B = chick ? .58 : .96;
  m.sweep('bill', (s) => ({ c: [bx + B * s, bp.cy - .04 - .06 * s * s, 0], u: [0, 1, 0], v: [0, 0, 1], a: .19 * (1 - .84 * s ** .85), b: .14 * (1 - .8 * s ** .85) }), {
    ns: 10, nt: 12, capStart: .04, capEnd: .02, island: [0, .62, .28, .74], bone: 'head',
    paint: (p, n, [s, t]) => {
      const up = Math.cos(t * Math.PI * 2 + Math.PI);
      // 갈라파고스 펭귄 부리: 윗부리 검정, 아랫부리 밑동 옅은 분홍노랑
      return up > -0.15 || s > 0.65 || chick ? [26, 26, 30] : [224, 178, 152];
    },
  });
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, chick ? .095 : .072, { island: [.30 + i * .06, .62, .35 + i * .06, .68], bone: 'head', paint: (p) => Math.hypot(p[0] - c[0] - .03, p[1] - c[1] - .03) < .02 ? [230, 230, 230] : [12, 12, 16] }));

  const fins = {};
  for (const sd of [-1, 1]) {
    const root = surf(1.0, sd * 1.48, .82), D = norm([-.58, -.22, sd * .78]), L = chick ? 1.4 : 2.0;
    let Wd = [1, .1, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0] + Wd[1] * D[1]))); const Nf = norm(cross(D, Wd));
    m.sweep('wing' + sd, (s) => ({ c: add(root, D, L * s), u: Nf, v: Wd, a: .08 - .05 * s, b: .42 * (1 - .55 * s ** 1.4) + .04, e: 2.3 }), {
      ns: 10, nt: 12, capEnd: .1, island: sd < 0 ? [.48, .62, .73, .80] : [.74, .62, .99, .80], bone: 'fin' + sd,
      paint: (p, n) => mix(SLATE, WHITE, smooth(.1, -.35, n[1]) * (chick ? 0.2 : 0.75)),
    });
    fins[sd < 0 ? 'R' : 'L'] = { root, tip: add(root, D, L) };
  }
  m.sweep('tail', (s) => ({ c: [X0 + .12 - .75 * s, P(X0).cy + .02, 0], u: [0, 1, 0], v: [0, 0, 1], a: .08 * (1 - .65 * s), b: .28 * (1 - .7 * s) }), { ns: 6, nt: 8, capEnd: .04, island: [.62, .82, .80, .92], bone: 'tail', paint: () => SLATE });

  const legs = { parent: 5 };
  for (const sd of [-1, 1]) {
    const root = surf(X0 + .68, Math.PI - sd * .5, .86);
    m.sweep('foot' + sd, (s) => ({ c: add(root, [-1, -.05, sd * .14], .65 * s), u: [0, 1, 0], v: [0, 0, 1], a: .07, b: .10 + .15 * s, e: 2.3 }), {
      ns: 6, nt: 8, capEnd: .05, island: sd < 0 ? [0, .82, .28, .94] : [.30, .82, .58, .94], bone: sd > 0 ? 'leg_L' : 'leg_R',
      paint: () => [48, 46, 52],
    });
    legs[sd > 0 ? 'L' : 'R'] = { root };
  }
  return {
    m, fins, legs, roughness: 0.56,
    weight: (part, g, [s]) => {
      if (part.bone === 'head') return [[0, 1]];
      if (part.bone === 'tail') return [[5, 1]];
      if (part.bone === 'leg_L') return [[10, 1]];
      if (part.bone === 'leg_R') return [[11, 1]];
      if (part.bone === 'fin1' || part.bone === 'fin-1') { const r = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .2, s); return [[1, 1 - k], [r, k * (1 - s)], [r + 1, k * s]]; }
      return spineWeight(g[0]);
    },
  };
}

// 3. 바다이구아나 (Marine Iguana) — 12뼈(leg_L/leg_R) + 용암흑색 비늘 + 등가시 + 4다리 + 납작한 수영 꼬리
function buildMarineIguana(stage) {
  const m = new Model();
  const isFry = stage === 0;
  const cDark = hex('#2c3035'), cRust = hex('#6c4434'), cTeal = hex('#345852'), cSalt = hex('#dcdad2'), cCrest = hex('#747066');
  // 몸통+긴 꼬리 (s=0 주둥이 +1.0 -> s=1 꼬리끝 -1.45)
  m.sweep('body', (s) => {
    const x = 1.0 - s * 2.45;
    let a, b, cy = 0;
    if (s < 0.14) { // 뭉툭한 파충류 머리
      const f = s / 0.14;
      a = 0.055 + 0.095 * Math.sin(f * Math.PI * 0.72);
      b = 0.052 + 0.085 * Math.sin(f * Math.PI * 0.72);
      cy = 0.05 + 0.02 * f;
    } else if (s < 0.46) { // 탄탄한 몸통
      const f = (s - 0.14) / 0.32;
      a = 0.13 + 0.048 * Math.sin(f * Math.PI);
      b = 0.135 + 0.052 * Math.sin(f * Math.PI);
      cy = 0.04 * (1 - f);
    } else { // 좌우로 납작한 수영용 꼬리
      const f = (s - 0.46) / 0.54;
      a = 0.125 * Math.pow(1 - f * 0.90, 0.85);
      b = 0.095 * Math.pow(1 - f * 0.94, 1.35);
      cy = -0.02 * Math.sin(f * Math.PI);
    }
    return { c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.012, a), b: Math.max(0.008, b), e: 2.15 };
  }, {
    ns: 34, nt: 16, capStart: 0.04, capEnd: 0.02, island: [0.02, 0.02, 0.72, 0.56], bone: 'body',
    paint: (P, n) => {
      const sc = 0.88 + 0.26 * fbm([P[0] * 34, P[1] * 34, P[2] * 34], 3);
      const mottle = fbm([P[0] * 7, P[1] * 7, P[2] * 7], 2);
      let col = mix(cDark, mottle > 0.56 ? cRust : cTeal, smooth(0.32, 0.75, mottle) * (isFry ? 0.2 : 0.52));
      if (P[0] > 0.68 && n[1] > 0.42 && !isFry) col = mix(col, cSalt, smooth(0.68, 0.88, P[0]) * smooth(0.42, 0.80, n[1]) * 0.78);
      if (n[1] < -0.35) col = mix(col, [72, 70, 66], 0.45);
      return mul(col, sc);
    },
  });
  // 등가시 볏 (목~등~꼬리 앞부분)
  m.sweep('crest', (s) => {
    const x = 0.74 - s * 1.38;
    const h = 0.068 * Math.sin(s * Math.PI) * (0.65 + 0.35 * Math.sin(s * 56));
    return { c: [x, 0.155 + h * 0.5 - s * 0.055, 0], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.012, h), b: 0.018, e: 1.6 };
  }, { ns: 26, nt: 6, capStart: 0.01, capEnd: 0.01, island: [0.74, 0.02, 0.98, 0.26], bone: 'body', paint: () => cCrest });
  for (const sd of [-1, 1]) m.sphere('eye' + sd, [0.83, 0.095, sd * 0.088], 0.026, { island: [0.88, 0.88, 0.98, 0.98], bone: 'head', paint: (P, n) => Math.abs(n[2]) > 0.55 ? [14, 14, 16] : [188, 152, 92] });

  // 앞다리 2개 (fin_L/fin_R) + 뒷다리 2개 (leg_L/leg_R) — 무릎이 굽은 입체 다리 + 발가락
  const fins = {}, legs = { parent: 3 };
  for (const sd of [1, -1]) {
    const rF = [0.46, -0.02, sd * 0.14], tF = [0.24, -0.22, sd * 0.34];
    m.sweep('arm' + sd, (s) => ({ c: [rF[0] + (tF[0] - rF[0]) * s, rF[1] + (tF[1] - rF[1]) * s + Math.sin(s * Math.PI) * 0.05, rF[2] + (tF[2] - rF[2]) * s + sd * Math.sin(s * Math.PI) * 0.06], u: [1, 0, 0], v: [0, 1, 0], a: 0.052 * (1 - 0.28 * s), b: 0.044 * (1 - 0.30 * s) }), { ns: 9, nt: 8, capEnd: 0.024, island: [0.02, 0.60, 0.44, 0.96], bone: sd > 0 ? 'fin_L' : 'fin_R', paint: () => cDark });
    fins[sd > 0 ? 'L' : 'R'] = { root: rF, tip: tF };

    const rB = [-0.12, -0.02, sd * 0.13], tB = [-0.38, -0.23, sd * 0.35];
    m.sweep('leg' + sd, (s) => ({ c: [rB[0] + (tB[0] - rB[0]) * s, rB[1] + (tB[1] - rB[1]) * s + Math.sin(s * Math.PI) * 0.05, rB[2] + (tB[2] - rB[2]) * s + sd * Math.sin(s * Math.PI) * 0.06], u: [1, 0, 0], v: [0, 1, 0], a: 0.058 * (1 - 0.30 * s), b: 0.048 * (1 - 0.30 * s) }), { ns: 9, nt: 8, capEnd: 0.025, island: [0.48, 0.60, 0.86, 0.96], bone: sd > 0 ? 'leg_L' : 'leg_R', paint: () => cDark });
    legs[sd > 0 ? 'L' : 'R'] = { root: rB };
  }
  return {
    m, fins, legs, roughness: 0.72,
    weight: (part, g, [s]) => {
      if (part.bone === 'head') return [[0, 1]];
      if (part.bone === 'fin_L') return [[6, 1 - s * 0.7], [7, s * 0.7]];
      if (part.bone === 'fin_R') return [[8, 1 - s * 0.7], [9, s * 0.7]];
      if (part.bone === 'leg_L') return [[10, 1]];
      if (part.bone === 'leg_R') return [[11, 1]];
      return spineWeight(g[0]);
    },
  };
}

// 4. 고래 · 돌고래 3종 (브라이드고래 · 들쇠고래 · 점박이돌고래)
function buildCetacean(kind, stage) {
  const m = new Model();
  const isBryde = kind === 'brydes_whale', isPilot = kind === 'pilot_whale', isDolphin = kind === 'spotted_dolphin';
  const cBack = isPilot ? hex('#2e343e') : isBryde ? hex('#3c4856') : hex('#445468');
  const cMid = isPilot ? hex('#4a525e') : isBryde ? hex('#5c6876') : hex('#8694a4');
  const cBelly = isPilot ? hex('#7c8490') : hex('#d8dce2');

  m.sweep('body', (s) => {
    const x = 1.0 - s * 2.0;
    let a, b, cy = 0;
    if (isPilot) {
      // 들쇠고래: 둥글고 불룩한 멜론 이마
      const melon = s < 0.22 ? Math.pow(Math.sin((s / 0.22) * Math.PI * 0.5), 0.55) : 1;
      const taper = s > 0.22 ? Math.pow(1 - (s - 0.22) / 0.78, 0.72) : 1;
      a = 0.02 + 0.22 * melon * taper;
      b = 0.02 + 0.19 * melon * taper;
      cy = 0.03 * Math.sin(s * Math.PI);
    } else if (isBryde) {
      // 브라이드고래: 길고 유선형인 수염고래 + 평평한 윗턱
      const prof = Math.sin(Math.pow(clamp(s, 0.01, 0.99), 0.62) * Math.PI);
      a = 0.018 + 0.165 * Math.pow(prof, 0.82);
      b = 0.022 + 0.175 * Math.pow(prof, 0.76);
      cy = 0.015 * Math.sin(s * Math.PI);
    } else {
      // 점박이돌고래: 뾰족한 부리 + 멜론 + 날렵한 유선형
      if (s < 0.13) {
        const f = s / 0.13;
        a = 0.022 + 0.048 * f; b = 0.024 + 0.048 * f; cy = -0.025 * (1 - f);
      } else {
        const f = (s - 0.13) / 0.87, prof = Math.sin(Math.pow(clamp(f, 0.01, 0.99), 0.58) * Math.PI);
        a = 0.022 + 0.185 * Math.pow(prof, 0.78);
        b = 0.020 + 0.155 * Math.pow(prof, 0.82);
        cy = 0.025 * Math.sin(f * Math.PI);
      }
    }
    return { c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.15 };
  }, {
    ns: 30, nt: 16, capStart: 0.03, capEnd: 0.025, island: [0.02, 0.02, 0.66, 0.54], bone: 'body',
    paint: (P, n) => {
      const ny = clamp(P[1] / 0.18 * 0.5 + 0.5, 0, 1);
      let col = ny > 0.5 ? mix(cMid, cBack, smooth(0.5, 0.85, ny)) : mix(cBelly, cMid, smooth(0.15, 0.52, ny));
      // 브라이드고래 배쪽 주름(ventral pleats)
      if (isBryde && P[0] > -0.05 && n[1] < -0.25) {
        const pleat = Math.sin(P[2] * 145);
        col = mul(col, 0.92 + 0.08 * pleat);
      }
      // 점박이돌고래 점무늬
      if (isDolphin && stage > 0) {
        const sp = noise(P[0] * 26, P[1] * 26, P[2] * 26);
        if (sp > 0.72) col = mix(col, ny > 0.52 ? [225, 230, 236] : [58, 68, 82], 0.65);
      }
      // 들쇠고래 등지느러미 뒤 옅은 안장 무늬
      if (isPilot && P[0] < 0.0 && P[0] > -0.35 && n[1] > 0.35) col = mix(col, [96, 102, 112], 0.32);
      return mul(col, 0.92 + 0.12 * fbm([P[0] * 14, P[1] * 14, P[2] * 14], 2));
    },
  });

  // 등지느러미
  const dX = isBryde ? -0.38 : isPilot ? 0.16 : 0.02;
  const dH = isBryde ? 0.12 : isPilot ? 0.18 : 0.21;
  m.sweep('dorsal', (s) => ({
    c: [dX - Math.pow(s, 1.2) * (isPilot ? 0.24 : 0.16), (isBryde ? 0.11 : 0.16) + s * dH, 0],
    u: [1, 0, 0], v: [0, 0, 1], a: Math.max(0.015, (isPilot ? 0.22 : 0.13) * (1 - 0.78 * s)), b: 0.022 * (1 - 0.7 * s), e: 1.9,
  }), { ns: 8, nt: 8, capEnd: 0.012, island: [0.68, 0.02, 0.98, 0.30], bone: isBryde ? 4 : 2, paint: () => cBack });

  // 가슴지느러미 (양쪽) — 뿌리를 몸통 안쪽(z=0.06)에 확실히 묻고 spine_1 과 블렌딩해 떠 있지 않게
  const pX = isBryde ? 0.26 : isPilot ? 0.32 : 0.28, pL = isPilot ? 0.44 : isBryde ? 0.34 : 0.30;
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [pX, -0.06, sd * 0.06], t = [pX - 0.24, -0.20, sd * (0.13 + pL)];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [1, 0.1, 0], v: [0, 1, 0], a: 0.10 * (1 - 0.72 * s), b: 0.02 * (1 - 0.65 * s), e: 1.9 }), { ns: 8, nt: 8, capEnd: 0.012, island: [0.68, 0.34, 0.98, 0.62], bone: sd > 0 ? 6 : 8, paint: () => cBack });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
  }

  // 수평 꼬리지느러미 (flukes — 고래/돌고래는 수평!)
  for (const sd of [1, -1]) {
    m.sweep('fluke' + sd, (s) => ({
      c: [-0.94 - s * 0.20, 0, sd * (0.015 + s * (isBryde ? 0.36 : 0.30))],
      u: [1, 0, 0], v: [0, 1, 0], a: Math.max(0.016, 0.13 * (1 - 0.72 * s)), b: Math.max(0.006, 0.022 * (1 - 0.7 * s)), e: 1.9,
    }), { ns: 8, nt: 8, capEnd: 0.012, island: [0.02, 0.60, 0.60, 0.96], bone: 5, paint: () => cBack });
  }
  for (const sd of [1, -1]) m.sphere('eye' + sd, [isDolphin ? 0.64 : isPilot ? 0.64 : 0.68, 0.01, sd * (isPilot ? 0.155 : isBryde ? 0.13 : 0.09)], 0.026, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [14, 16, 20] });

  return {
    m, fins, roughness: 0.42,
    weight: (part, g, [s]) => {
      if (part.name === 'fin_L' || part.name === 'fin_R') {
        const root = part.name === 'fin_L' ? 6 : 8, k = smooth(0, 0.28, s);
        return [[1, 1 - k], [root, k * (1 - s * 0.6)], [root + 1, k * s * 0.6]];
      }
      if (part.bone === 0) return [[0, 1]];
      if (part.bone === 5) return [[5, 1]];
      return spineWeight(g[0]);
    },
  };
}

// 5. 기각류 2종 (갈라파고스 바다사자 · 갈라파고스 물개)
function buildPinniped(kind, stage) {
  const m = new Model();
  const isFur = kind === 'galapagos_fur_seal';
  const cCoat = isFur ? hex('#5c5248') : hex('#9c764e');
  const cBelly = isFur ? hex('#84786c') : hex('#c8a47a');

  m.sweep('body', (s) => {
    const x = 0.98 - s * 1.96;
    let a, b, cy = 0;
    if (s < 0.08) { // 뾰족한 주둥이(muzzle)
      const f = s / 0.08;
      a = 0.032 + 0.045 * f; b = 0.030 + 0.042 * f; cy = 0.16 + 0.01 * f;
    } else if (s < 0.19) { // 둥근 두개골(head)
      const f = (s - 0.08) / 0.11;
      a = 0.077 + 0.045 * Math.sin(f * Math.PI); b = 0.072 + 0.042 * Math.sin(f * Math.PI); cy = 0.17 - 0.02 * f;
    } else if (s < 0.34) { // 잘록하고 우아하게 솟은 목(neck)
      const f = (s - 0.19) / 0.15;
      a = 0.095 + 0.092 * f; b = 0.090 + 0.088 * f; cy = 0.15 - 0.11 * f;
    } else { // 유선형 몸통 -> 골반
      const f = (s - 0.34) / 0.66, prof = Math.sin(Math.pow(clamp(1 - f, 0.02, 0.98), 0.66) * Math.PI * 0.5);
      a = 0.03 + 0.19 * prof; b = 0.03 + 0.18 * prof; cy = 0.04 * (1 - f);
    }
    return { c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.1 };
  }, {
    ns: 32, nt: 16, capStart: 0.03, capEnd: 0.025, island: [0.02, 0.02, 0.66, 0.56], bone: 'body',
    paint: (P, n) => {
      let col = mix(cBelly, cCoat, smooth(-0.32, 0.48, n[1]));
      if (P[0] > 0.93 && Math.hypot(P[1] - 0.165, P[2]) < 0.034) col = [24, 20, 18]; // 둥근 검은 코
      return mul(col, 0.90 + 0.18 * fbm([P[0] * 24, P[1] * 24, P[2] * 24], 3));
    },
  });
  for (const sd of [1, -1]) {
    m.sphere('eye' + sd, [0.78, 0.21, sd * 0.076], isFur ? 0.028 : 0.025, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [14, 12, 10] });
    m.sphere('ear' + sd, [0.66, 0.21, sd * 0.092], 0.020, { island: [0.80, 0.88, 0.86, 0.96], bone: 0, paint: () => cCoat });
  }
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.34, -0.06, sd * 0.15], t = [0.04, -0.22, sd * 0.48];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [1, 0.1, 0], v: [0, 1, 0], a: 0.11 * (1 - 0.55 * s), b: 0.022 * (1 - 0.6 * s), e: 2.1 }), { ns: 8, nt: 8, capEnd: 0.015, island: [0.68, 0.02, 0.98, 0.44], bone: sd > 0 ? 6 : 8, paint: () => mul(cCoat, 0.72) });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    // 뒷지느러미발
    m.sweep('hind' + sd, (s) => ({ c: [-0.84 - s * 0.30, -0.02 - s * 0.04, sd * (0.04 + s * 0.11)], u: [0, 1, 0], v: [0, 0, 1], a: 0.032 * (1 - 0.5 * s), b: 0.065 * (0.7 + 0.5 * s), e: 2.2 }), { ns: 7, nt: 8, capEnd: 0.014, island: [0.02, 0.60, 0.64, 0.96], bone: 5, paint: () => mul(cCoat, 0.68) });
  }
  return {
    m, fins, roughness: 0.62,
    weight: (part, g, [s]) => {
      if (part.name === 'fin_L') return [[6, 1 - s * 0.65], [7, s * 0.65]];
      if (part.name === 'fin_R') return [[8, 1 - s * 0.65], [9, s * 0.65]];
      if (part.bone === 0) return [[0, 1]];
      if (part.bone === 5) return [[5, 1]];
      return spineWeight(g[0]);
    },
  };
}

// 6. 바다거북 3종 (대모거북 · 붉은바다거북 · 장수거북)
function buildSeaTurtle(kind, stage) {
  const m = new Model();
  const isLeather = kind === 'leatherback_turtle', isLogger = kind === 'loggerhead_turtle', isHawks = kind === 'hawksbill_turtle';
  const cShellDark = isLeather ? hex('#1f252d') : isLogger ? hex('#6e3b1e') : hex('#2b180b');
  const cShellMid = isLeather ? hex('#38414e') : isLogger ? hex('#a45f32') : hex('#8f4d19');
  const cShellAmber = isLeather ? hex('#546070') : isLogger ? hex('#cfa05a') : hex('#dba13c');
  const cSkinBase = isLeather ? hex('#282e36') : isLogger ? hex('#b88b5a') : hex('#d8c484');
  const cScaleDark = isLeather ? hex('#1c2128') : isLogger ? hex('#5c3d22') : hex('#221c14');
  const cBelly = isLeather ? hex('#7e848c') : hex('#e6dab0');

  // 2D 보로노이(셀룰러) 비늘/인갑 거리 함수 — 실제 바다거북 머리와 지느러미발의 다각형 검은 비늘 모자이크
  const hash2 = (ix, iy) => {
    let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const a = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    let h2 = Math.imul(ix + 19, 1274126177) + Math.imul(iy - 7, 374761393);
    h2 = Math.imul(h2 ^ (h2 >>> 13), 668265263);
    const b = ((h2 ^ (h2 >>> 16)) >>> 0) / 4294967295;
    return [a, b];
  };
  const voronoi2 = (u, v, jitter = 0.72) => {
    const ix = Math.floor(u), iy = Math.floor(v);
    let d1 = 9, d2 = 9, cx = 0, cy = 0, id = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const [rx, ry] = hash2(ix + dx, iy + dy);
      const px = ix + dx + 0.5 + (rx - 0.5) * jitter;
      const py = iy + dy + 0.5 + (ry - 0.5) * jitter;
      const d = Math.hypot(u - px, v - py);
      if (d < d1) { d2 = d1; d1 = d; cx = px; cy = py; id = rx * 0.7 + ry * 0.3; }
      else if (d < d2) { d2 = d; }
    }
    return { edge: d2 - d1, d1, dx: u - cx, dy: v - cy, id };
  };

  // 대모거북/바다거북 비늘 모자이크 채색 (크림황금빛 피부 틈새 + 짙은 다각형 비늘판)
  const paintScaledSkin = (P, n, freq = 26, darkBias = 0.62) => {
    if (isLeather) return mul(cSkinBase, 0.88 + 0.22 * fbm([P[0] * 18, P[1] * 18, P[2] * 18], 2));
    const u = P[0] * freq + P[1] * freq * 0.35;
    const v = P[2] * freq + P[1] * freq * 0.85;
    const cell = voronoi2(u, v, 0.68);
    // 배쪽·아래쪽은 밝은 크림색, 위쪽·앞쪽 가장자리는 짙은 비늘
    const bellyFade = smooth(-0.55, 0.15, n[1]);
    const seamW = isHawks ? 0.14 : 0.17;
    const isScale = smooth(seamW * 0.7, seamW * 1.45, cell.edge);
    const scaleShade = mix(cScaleDark, cShellMid, 0.18 + 0.24 * cell.id);
    const col = mix(cSkinBase, scaleShade, isScale * (0.28 + darkBias * bellyFade));
    const micro = 0.92 + 0.16 * fbm([P[0] * 42, P[1] * 42, P[2] * 42], 2);
    return mul(col, micro);
  };

  // 1. 비대칭 방패형 등갑(Carapace) + 평평한 배딱지(Plastron) + 연판 테두리
  //    위쪽(+Y)은 중앙 용골이 살아있는 완만한 돔, 아래쪽(-Y)은 평평한 배딱지, 뒤로 갈수록 방패형으로 좁아지며 톱니 연판 요철
  const shellLen = 1.26, shellX0 = 0.54;
  m.sweep('shell', (s) => {
    const x = shellX0 - s * shellLen;
    const f = Math.sin(clamp(s, 0.008, 0.992) * Math.PI);
    // 앞쪽 어깨 부근(s~0.35)이 가장 넓고 뒤쪽(s>0.6)은 방패형으로 날렵하게 좁아진다
    const heart = Math.pow(f, 0.58) * (1.06 - 0.32 * s * s);
    // 대모거북 특유의 뒤쪽 연판 톱니 요철
    const serrate = isHawks && s > 0.32 ? 1 + 0.022 * Math.sin(s * Math.PI * 12) * smooth(0.32, 0.65, s) : 1;
    const w = (isLeather ? 0.44 : 0.49) * heart * serrate;
    const h = (isLeather ? 0.165 : 0.185) * Math.pow(f, 0.68) * (1 - 0.14 * s);
    return {
      c: [x, 0.015 * f, 0], u: [0, 1, 0], v: [0, 0, 1],
      a: Math.max(0.016, h), b: Math.max(0.024, w), e: 2.2,
      r: (th) => {
        const cu = Math.cos(th), sv = Math.sin(th);
        // 아래쪽(배딱지, cu < 0)은 평평하게 눌러주고, 좌우 테두리(|sv| > 0.8)는 얇은 연판 림으로 확장
        if (cu < -0.05) return 0.54 + 0.46 * (1 - Math.abs(cu)) ** 1.3;
        const rim = Math.exp(-Math.pow(cu / 0.24, 2)) * 0.07;
        const keel = Math.exp(-Math.pow(sv / 0.28, 2)) * (cu > 0.4 ? 0.055 : 0);
        return 1 + rim + keel;
      },
    };
  }, {
    ns: 32, nt: 26, capStart: 0.025, capEnd: 0.028, island: [0.02, 0.02, 0.62, 0.56], bone: 'body',
    paint: (P, n) => {
      // 배딱지(Plastron): 따뜻한 크림/상아빛 + 중앙 봉합선 + 좌우 배갑판 선
      if (n[1] < -0.22) {
        const midSeam = Math.exp(-Math.pow(P[2] / 0.014, 2)) * 0.14;
        const crossSeam = Math.exp(-Math.pow(((P[0] + 0.5) * 3.8) % 1 - 0.5, 2) * 180) * 0.08;
        const mottle = 0.93 + 0.12 * fbm([P[0] * 10, P[2] * 10, 1], 2);
        return mul(cBelly, (1 - midSeam - crossSeam) * mottle);
      }
      if (isLeather) {
        const ridge = Math.pow(Math.abs(Math.sin(P[2] * 26)), 6);
        const speck = noise(P[0] * 30, P[1] * 30, P[2] * 30) > 0.78 ? 0.45 : 0;
        return mix(mix(cShellDark, cShellAmber, ridge * 0.7), [185, 195, 205], speck);
      }
      // 등갑(Carapace): 중앙 척추판(5개) + 양옆 늑판(4쌍) + 가장자리 연판(11쌍)
      const sNorm = clamp((shellX0 - P[0]) / shellLen, 0, 1);
      const halfW = Math.max(0.06, 0.49 * Math.pow(Math.sin(clamp(sNorm, 0.02, 0.98) * Math.PI), 0.58) * (1.06 - 0.32 * sNorm * sNorm));
      const zFrac = Math.abs(P[2]) / halfW;
      // 가장자리 연판 띠(marginal scutes) — 부드러운 호박빛 테두리와 은은한 음영
      if (zFrac > 0.83 || sNorm < 0.06 || sNorm > 0.94) {
        const mPhase = (sNorm * 11) % 1;
        const mSeam = Math.exp(-Math.pow(Math.min(mPhase, 1 - mPhase) / 0.055, 2));
        const mNoise = fbm([P[0] * 14, P[2] * 14, 2], 3);
        const base = mix(cShellMid, cShellAmber, smooth(0.28, 0.72, mNoise) * 0.65);
        return mul(mix(base, cShellDark, mSeam * 0.55 + (1 - mNoise) * 0.28), 0.92 + 0.14 * fbm([P[0] * 24, P[2] * 24, 5], 2));
      }
      // 중앙 척추판(zFrac < 0.33) vs 양옆 늑판(0.33 <= zFrac <= 0.83)
      const isCentral = zFrac < 0.33;
      const rowFreq = isCentral ? 4.8 : 4.0;
      const rowOffset = isCentral ? 0.0 : 0.42;
      const uScute = sNorm * rowFreq + rowOffset;
      const vScute = isCentral ? (P[2] / halfW) * 1.45 : (Math.sign(P[2]) * (zFrac - 0.33) / 0.50) * 1.02;
      const cell = voronoi2(uScute, vScute, 0.16);
      // 자연스러운 대모거북 유기적 빗살·마블링(tortoiseshell): 인갑마다 고유 오프셋으로 뒤→앞 방향의 불규칙한 호박/적갈/흑갈 결
      const warp = fbm([P[0] * 7.5 + cell.id * 5, P[2] * 7.5 - cell.id * 3, 1.7], 3);
      const streak = fbm([P[0] * 13 + warp * 2.2, P[2] * 22 - warp * 1.6, cell.id * 7], 3);
      const blotch = fbm([P[0] * 5.2 + 3.1, P[2] * 5.8 - 1.4, 4.2], 3);
      // 뒤쪽이 짙고 앞쪽/가장자리로 갈수록 호박빛이 스며드는 실제 대모거북 인갑 음영
      const grad = smooth(-0.45, 0.45, cell.dx + (warp - 0.5) * 0.5);
      let col = mix(cShellDark, cShellMid, smooth(0.25, 0.74, streak * 0.72 + blotch * 0.28));
      col = mix(col, cShellAmber, smooth(0.46, 0.82, streak * 0.65 + grad * 0.35) * (isHawks ? 0.82 : 0.45));
      // 인갑 경계 홈(자연스러운 짙은 선) + 겹치는 인갑 가장자리 미세 톤 변화
      const seam = 1 - smooth(0.018, 0.068, cell.edge);
      col = mix(col, cShellDark, seam * 0.78);
      // 물속 자연 광택 · 미세 각질 결 + 해조류/바다 느낌의 미세 올리브 톤
      const grain = 0.91 + 0.18 * fbm([P[0] * 30, P[1] * 30, P[2] * 30], 2);
      return mul(col, grain);
    },
  });

  // 2. 목 + 매부리 머리(Hawksbill hooked beak) — 등갑 앞쪽(x=0.38)에서 자연스럽게 뻗어나온다
  m.sweep('head', (s) => {
    const x = 0.38 + s * 0.54;
    // 목이 등갑에서 살짝 내려왔다 머리를 들며, 끝(s>0.72)에서 매부리처럼 아래로 꺾인다
    const y = -0.01 + Math.sin(s * Math.PI * 0.85) * 0.042 - (isHawks ? Math.max(0, s - 0.68) * 0.14 : Math.max(0, s - 0.75) * 0.06);
    // 목(0~0.42)은 굵고 주름짐 → 뒤통수(0.45~0.68)가 볼록 → 주둥이/매부리(0.68~1.0)는 날렵하게 좁아짐
    const neckBulb = 0.082 + 0.022 * Math.sin(clamp((s - 0.38) / 0.42, 0, 1) * Math.PI);
    const taper = s > 0.60 ? Math.pow(1 - (s - 0.60) / 0.40, isHawks ? 1.15 : 0.85) : 1;
    const h = Math.max(0.014, neckBulb * (0.92 * taper + 0.08 * (1 - s)));
    const w = Math.max(0.012, (isLogger ? 1.24 : isHawks ? 0.86 : 1.0) * neckBulb * taper);
    return {
      c: [x, y, 0], u: [0, 1, 0], v: [0, 0, 1], a: h, b: w, e: 2.1,
      r: (th) => {
        // 주둥이 아래쪽 입선 미세 오목 + 위쪽 매부리 능선
        const cu = Math.cos(th);
        return s > 0.65 && cu < -0.2 ? 0.84 : 1;
      },
    };
  }, {
    ns: 20, nt: 16, capStart: 0.02, capEnd: 0.022, island: [0.65, 0.02, 0.98, 0.30], bone: 0,
    paint: (P, n, [s]) => {
      let col = paintScaledSkin(P, n, 30, 0.68);
      // 부리 끝(s > 0.76)은 각질화된 어두운 황갈색 매부리 + 입선
      if (s > 0.74) {
        const beakCol = mix(cShellMid, cShellDark, 0.55);
        col = mix(col, beakCol, smooth(0.74, 0.90, s) * 0.75);
        // 입선(mouth line)
        if (Math.abs(P[1] + 0.012) < 0.008 && s < 0.95) col = mul(col, 0.35);
      }
      // 목 주름 음영(s < 0.42)
      if (s < 0.44) {
        const wr = 0.90 + 0.10 * Math.sin(s * 55);
        col = mul(col, wr);
      }
      return col;
    },
  });

  // 눈(어두운 갈색 홍채 + 검은 동공 + 작은 반사광 + 눈꺼풀 테두리)
  for (const sd of [1, -1]) {
    m.sphere('eye' + sd, [0.76, 0.036, sd * 0.056], 0.022, {
      island: [0.88, 0.88, 0.98, 0.98], bone: 0,
      paint: (P, n) => {
        const side = Math.abs(n[2]);
        if (side > 0.74) return n[1] > 0.25 && n[0] > 0.2 ? [210, 218, 224] : [14, 12, 10];
        if (side > 0.48) return [54, 38, 22];
        return cScaleDark;
      },
    });
  }

  // 3. 우아한 긴 날개(낫) 모양 앞지느러미발(fin_L / fin_R) — 어깨가 등갑 안쪽에 깊이 박히고 앞쪽 두툼/뒤쪽 얇은 익형 단면
  const fins = {};
  const finSpan = isLeather ? 0.96 : isHawks ? 0.86 : 0.80;
  for (const sd of [1, -1]) {
    const r = [0.28, -0.025, sd * 0.24], t = [-0.20, -0.08, sd * finSpan];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => {
      // 앞쪽으로 활처럼 휘었다가 뒤쪽 끝으로 날렵하게 빠지는 낫(scythe) 곡선
      const sweepFwd = Math.sin(Math.pow(s, 0.78) * Math.PI) * 0.22;
      const archY = Math.sin(s * Math.PI) * 0.035;
      const cx = r[0] + (t[0] - r[0]) * s + sweepFwd;
      const cy = r[1] + (t[1] - r[1]) * s + archY;
      const cz = r[2] + (t[2] - r[2]) * s;
      // 폭(chord): 중간(s~0.35)이 넓고 끝으로 갈수록 날렵하게 좁아짐
      const chord = 0.145 * Math.pow(1 - s * 0.78, 0.85) * (0.82 + 0.32 * Math.sin(s * Math.PI));
      const thick = 0.028 * (1 - 0.68 * s);
      return {
        c: [cx, cy, cz], u: [1, 0, 0], v: [0, 1, 0], a: chord, b: thick, e: 2.05,
        r: (th) => {
          // 앞쪽 가장자리(+X, cos>0)는 둥글고 두툼, 뒤쪽 가장자리(-X, cos<0)는 날렵하게 얇아지는 익형
          const c = Math.cos(th);
          return c < 0 ? 0.72 + 0.28 * (1 + c) : 1.0;
        },
      };
    }, {
      ns: 18, nt: 14, capStart: 0.02, capEnd: 0.018, island: [0.65, 0.34, 0.98, 0.76], bone: sd > 0 ? 6 : 8,
      paint: (P, n) => paintScaledSkin(P, n, 24, 0.68),
    });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };

    // 4. 부채꼴 뒷지느러미발(hind_L / hind_R) — 등갑 뒤쪽 아래에서 자연스럽게 펼쳐짐 + 비늘 모자이크
    m.sweep('hind' + sd, (s) => {
      const cx = -0.46 - s * 0.34;
      const cy = -0.035 - s * 0.02;
      const cz = sd * (0.12 + s * 0.28);
      // 끝쪽으로 갈수록 부채꼴로 넓어졌다가 둥글게 마감
      const fanW = 0.075 + 0.065 * Math.sin(Math.pow(s, 0.7) * Math.PI);
      const thick = 0.020 * (1 - 0.55 * s);
      return { c: [cx, cy, cz], u: [0.55, 0, sd * 0.84], v: [0, 1, 0], a: fanW, b: thick, e: 2.1 };
    }, {
      ns: 10, nt: 10, capStart: 0.018, capEnd: 0.014, island: [0.02, 0.60, 0.58, 0.96], bone: 5,
      paint: (P, n) => paintScaledSkin(P, n, 26, 0.62),
    });
  }

  // 5. 작은 꼬리(tail)
  m.sweep('tail', (s) => ({
    c: [-0.60 - s * 0.14, -0.035 - s * 0.015, 0], u: [0, 1, 0], v: [0, 0, 1],
    a: 0.032 * (1 - 0.78 * s), b: 0.028 * (1 - 0.78 * s), e: 2.0,
  }), { ns: 6, nt: 8, capEnd: 0.008, island: [0.64, 0.78, 0.84, 0.96], bone: 5, paint: (P, n) => paintScaledSkin(P, n, 28, 0.55) });

  return {
    m, fins, roughness: 0.44,
    weight: (part, g, [s]) => {
      // 앞지느러미발 뿌리(s < 0.2)는 spine_1과 부드럽게 섞어 헤엄칠 때 어깨가 벌어지지 않게 한다
      if (part.name === 'fin_L') {
        const rootW = Math.max(0, 1 - s / 0.22) * 0.45;
        const finW = 1 - rootW;
        return rootW > 0.01 ? [[1, rootW], [6, finW * (1 - s * 0.65)], [7, finW * s * 0.65]] : [[6, 1 - s * 0.65], [7, s * 0.65]];
      }
      if (part.name === 'fin_R') {
        const rootW = Math.max(0, 1 - s / 0.22) * 0.45;
        const finW = 1 - rootW;
        return rootW > 0.01 ? [[1, rootW], [8, finW * (1 - s * 0.65)], [9, finW * s * 0.65]] : [[8, 1 - s * 0.65], [9, s * 0.65]];
      }
      if (part.bone === 0) return [[0, 1]];
      if (part.bone === 5) return [[5, 1]];
      return spineWeight(g[0]);
    },
  };
}

// 7. 가오리 4종 (대리석가오리 · 황금매가오리 · 얼룩매가오리 · 악마가오리) — 수평 마름모 날개 + 채찍 꼬리
function buildRay(kind, stage) {
  const m = new Model();
  const isMarble = kind === 'marble_ray', isCownose = kind === 'golden_cownose_ray', isEagle = kind === 'spotted_eagle_ray', isMobula = kind === 'mobula_ray';
  const cTop = isMarble ? hex('#465258') : isCownose ? hex('#a67c44') : isEagle ? hex('#242c38') : hex('#1d2430');
  const cBelly = hex('#e8e6de');

  const paintRay = (P, n) => {
    if (n[1] < -0.15) return mul(cBelly, 0.94 + 0.08 * noise(P[0] * 14, P[1] * 14, P[2] * 14));
    let col = cTop;
    if (isMarble) {
      const mbl = fbm([P[0] * 11, P[2] * 11, 1], 3);
      col = mix(hex('#262c32'), hex('#8e9a9e'), smooth(0.32, 0.70, mbl));
    } else if (isEagle) {
      // 얼룩매가오리: 짙은 남흑색 바탕에 또렷한 흰 점/고리
      const gx = Math.sin(P[0] * 38) * Math.sin(P[2] * 38);
      if (gx > 0.62) col = mix(col, [232, 236, 240], 0.85);
    } else if (isMobula) {
      // 악마가오리: 어깨 부위 밝은 회백 무늬
      if (P[0] > 0.15 && Math.abs(P[2]) > 0.12 && Math.abs(P[2]) < 0.42) col = mix(col, [182, 192, 204], 0.45);
    } else {
      col = mix(hex('#8c6430'), hex('#c89c58'), smooth(-0.2, 0.6, fbm([P[0] * 8, P[2] * 8, 2], 2)));
    }
    return mul(col, 0.92 + 0.12 * fbm([P[0] * 16, P[1] * 16, P[2] * 16], 2));
  };

  // 중앙 몸체 원반
  m.sweep('disc', (s) => {
    const x = 0.66 - s * 1.18;
    const f = Math.sin(clamp(s, 0.01, 0.99) * Math.PI);
    return { c: [x, 0.01 * f, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.018 + 0.095 * f, b: 0.04 + (isMarble ? 0.56 : 0.34) * Math.pow(f, 0.7), e: 2.2 };
  }, { ns: 18, nt: 16, capStart: 0.025, capEnd: 0.02, island: [0.02, 0.02, 0.56, 0.54], bone: 'body', paint: paintRay });

  // 넓은 가슴지느러미 날개 (fin_L/fin_R)
  const wingSpan = isMarble ? 0.64 : isMobula ? 1.15 : 0.98;
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.16, 0, sd * 0.22], t = [-0.08, 0.02, sd * wingSpan];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => {
      const chord = (isMarble ? 0.48 : 0.44) * Math.pow(1 - s * 0.86, 0.85);
      const thick = 0.055 * (1 - 0.82 * s);
      const cx = 0.16 - s * (isMarble ? 0.12 : 0.24);
      const cz = sd * (0.20 + s * (wingSpan - 0.20));
      return { c: [cx, 0.015 * Math.sin(s * Math.PI), cz], u: [1, 0, 0], v: [0, 1, 0], a: Math.max(0.02, chord), b: Math.max(0.008, thick), e: 2.15 };
    }, { ns: 12, nt: 10, capEnd: 0.016, island: [0.58, 0.02, 0.98, 0.60], bone: sd > 0 ? 6 : 8, paint: paintRay });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    // 악마가오리 두부 뿔 (cephalic fins)
    if (isMobula) {
      m.sweep('horn' + sd, (s) => ({ c: [0.62 + s * 0.26, -0.01, sd * (0.14 - s * 0.03)], u: [0, 1, 0], v: [0, 0, 1], a: 0.036 * (1 - 0.55 * s), b: 0.022 * (1 - 0.5 * s) }), { ns: 6, nt: 6, capEnd: 0.01, island: [0.62, 0.64, 0.94, 0.94], bone: 0, paint: () => cTop });
    }
    m.sphere('eye' + sd, [0.44, 0.065, sd * 0.14], 0.022, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [16, 18, 22] });
  }
  // 긴 채찍 꼬리
  m.sweep('tail', (s) => ({ c: [-0.46 - s * 0.86, -0.01 * s, 0], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.006, 0.036 * (1 - 0.85 * s)), b: Math.max(0.006, 0.032 * (1 - 0.85 * s)) }), { ns: 12, nt: 8, capEnd: 0.006, island: [0.02, 0.60, 0.56, 0.94], bone: 5, paint: () => cTop });

  return {
    m, fins, roughness: 0.50,
    weight: (part, g, [s]) => {
      if (part.name === 'fin_L') return [[6, 1 - s * 0.72], [7, s * 0.72]];
      if (part.name === 'fin_R') return [[8, 1 - s * 0.72], [9, s * 0.72]];
      if (part.bone === 0) return [[0, 1]];
      if (part.bone === 5) return [[5, 1]];
      return spineWeight(g[0]);
    },
  };
}

const BUILDERS = {
  scalloped_hammerhead: buildScallopedHammerhead,
  galapagos_penguin: buildGalapagosPenguin,
  marine_iguana: buildMarineIguana,
  brydes_whale: (st) => buildCetacean('brydes_whale', st),
  pilot_whale: (st) => buildCetacean('pilot_whale', st),
  spotted_dolphin: (st) => buildCetacean('spotted_dolphin', st),
  galapagos_sea_lion: (st) => buildPinniped('galapagos_sea_lion', st),
  galapagos_fur_seal: (st) => buildPinniped('galapagos_fur_seal', st),
  hawksbill_turtle: (st) => buildSeaTurtle('hawksbill_turtle', st),
  loggerhead_turtle: (st) => buildSeaTurtle('loggerhead_turtle', st),
  leatherback_turtle: (st) => buildSeaTurtle('leatherback_turtle', st),
  marble_ray: (st) => buildRay('marble_ray', st),
  golden_cownose_ray: (st) => buildRay('golden_cownose_ray', st),
  spotted_eagle_ray: (st) => buildRay('spotted_eagle_ray', st),
  mobula_ray: (st) => buildRay('mobula_ray', st),
};

export const SCULPTED_KEYS = new Set(Object.keys(BUILDERS));

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv.slice(2);
  const families = target.length ? target : Object.keys(BUILDERS);
  let count = 0;
  for (const fam of families) {
    for (const key of [fam, `juv_${fam}`, `fry_${fam}`]) {
      const res = BUILDERS[fam](stageOf(key));
      const { glb, tris } = await bake(key, res.m, {
        fins: res.fins,
        legs: res.legs,
        weight: res.weight,
        source: `galapagos-sculpted-hero (${fam})`,
        atlas: 512,
        roughness: res.roughness ?? 0.55,
        compress: { webpQuality: 90 },
      });
      if (tris > 8000 || glb.length > 300000) throw new Error(`Budget ${key}: ${tris} tris, ${glb.length} bytes`);
      writeFileSync(resolve(GLB_DIR, `${key}.glb`), glb);
      count++;
      if (key === fam) console.log(`SCULPT ${key}: ${tris} tris, ${(glb.length / 1024).toFixed(1)} KB`);
    }
  }
  console.log(`Built ${count} sculpted Galápagos hero GLBs.`);
}
