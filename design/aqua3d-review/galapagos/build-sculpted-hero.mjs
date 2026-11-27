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
  const isLeather = kind === 'leatherback_turtle', isLogger = kind === 'loggerhead_turtle';
  const cShell1 = isLeather ? hex('#242a32') : isLogger ? hex('#8a4e2c') : hex('#6b3f1e');
  const cShell2 = isLeather ? hex('#444e5c') : isLogger ? hex('#b87444') : hex('#c89236');
  const cSkin = isLeather ? hex('#2c323a') : isLogger ? hex('#a87a4e') : hex('#8e7444');
  const cBelly = isLeather ? hex('#7e848c') : hex('#dfd2a8');

  // 등껍질(carapace) + 배딱지(plastron)
  m.sweep('shell', (s) => {
    const x = 0.56 - s * 1.24;
    const f = Math.sin(clamp(s, 0.01, 0.99) * Math.PI);
    const w = (isLeather ? 0.44 : 0.48) * Math.pow(f, 0.62) * (1 - 0.14 * s);
    const h = (isLeather ? 0.17 : 0.19) * Math.pow(f, 0.72);
    return { c: [x, 0.01, 0], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.02, h), b: Math.max(0.03, w), e: 2.35 };
  }, {
    ns: 22, nt: 18, capStart: 0.03, capEnd: 0.03, island: [0.02, 0.02, 0.62, 0.56], bone: 'body',
    paint: (P, n) => {
      if (n[1] < -0.25) return mul(cBelly, 0.94 + 0.1 * noise(P[0] * 12, P[1] * 12, P[2] * 12));
      if (isLeather) {
        const ridge = Math.pow(Math.abs(Math.sin(P[2] * 26)), 6);
        const speck = noise(P[0] * 30, P[1] * 30, P[2] * 30) > 0.78 ? 0.45 : 0;
        return mix(mix(cShell1, cShell2, ridge * 0.7), [185, 195, 205], speck);
      }
      // 대모/붉은바다거북 등갑 판 무늬
      const pat = fbm([P[0] * 9, P[1] * 9, P[2] * 9], 3);
      return mix(cShell1, cShell2, smooth(0.32, 0.72, pat));
    },
  });
  // 목 + 머리
  m.sweep('head', (s) => ({
    c: [0.52 + s * 0.36, 0.02 - 0.02 * s, 0], u: [0, 1, 0], v: [0, 0, 1],
    a: 0.095 * (1 - 0.45 * s ** 1.4), b: (isLogger ? 0.125 : 0.095) * (1 - 0.45 * s ** 1.4), e: 2.1,
  }), { ns: 10, nt: 10, capEnd: 0.025, island: [0.66, 0.02, 0.98, 0.30], bone: 0, paint: (P) => mul(cSkin, 0.85 + 0.25 * fbm([P[0] * 22, P[1] * 22, P[2] * 22], 2)) });
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.76, 0.05, sd * 0.068], 0.022, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [16, 14, 12] });

  // 긴 날개형 앞지느러미발(fin_L/R) + 뒷지느러미발
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.34, -0.04, sd * 0.32], t = [-0.08, -0.09, sd * (isLeather ? 0.92 : 0.78)];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({
      c: [r[0] + (t[0] - r[0]) * s + Math.sin(s * Math.PI) * 0.12, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s],
      u: [1, 0, 0], v: [0, 1, 0], a: 0.14 * (1 - 0.68 * s), b: 0.026 * (1 - 0.6 * s), e: 2.1,
    }), { ns: 10, nt: 8, capEnd: 0.015, island: [0.66, 0.34, 0.98, 0.74], bone: sd > 0 ? 6 : 8, paint: (P) => mul(cSkin, 0.84 + 0.24 * fbm([P[0] * 18, P[1] * 18, P[2] * 18], 2)) });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    m.sweep('hind' + sd, (s) => ({
      c: [-0.58 - s * 0.28, -0.04, sd * (0.14 + s * 0.24)], u: [1, 0, 0], v: [0, 1, 0], a: 0.09 * (1 - 0.45 * s), b: 0.02 * (1 - 0.5 * s), e: 2.1,
    }), { ns: 6, nt: 8, capEnd: 0.012, island: [0.02, 0.62, 0.58, 0.96], bone: 5, paint: () => cSkin });
  }
  return {
    m, fins, roughness: 0.64,
    weight: (part, g, [s]) => {
      if (part.name === 'fin_L') return [[6, 1 - s * 0.65], [7, s * 0.65]];
      if (part.name === 'fin_R') return [[8, 1 - s * 0.65], [9, s * 0.65]];
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
