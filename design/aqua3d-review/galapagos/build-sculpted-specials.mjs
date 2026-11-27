// 갈라파고스 특수 체형 · 결함 20종(×3단계 = 60 GLB) 전용 정밀 3D 조각 빌더 (polar/kit.mjs 기반)
// 무척추(게 · 랍스터 · 파란고리문어 · 앵무조개 · 대왕조개), 특수어류(피그미해마 · 나뭇잎해룡 · 붉은입술박쥐물고기 ·
// 가시복 · 리본장어 · 정원장어 · 트럼펫피쉬 · 만다린피쉬 · 깃대돔), 외양대형/상어(돗새치 · 청새치 · 황다랑어 · 가다랑어 · 미흑점상어 · 화이트팁 리프샤크)
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Model, bake, spineWeight, fbm, noise, mix, smooth, clamp } from '../polar/kit.mjs';

const ROOT = resolve(process.cwd());
const GLB_DIR = resolve(ROOT, 'public/aqua/models/fish');
mkdirSync(GLB_DIR, { recursive: true });

const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mul = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
const stageOf = (k) => (k.startsWith('fry_') ? 0 : k.startsWith('juv_') ? 1 : 2);

const stdFinWeight = (part, g, [s]) => {
  if (part.name === 'fin_L' || part.bone === 6) return [[6, 1 - s * 0.65], [7, s * 0.65]];
  if (part.name === 'fin_R' || part.bone === 8) return [[8, 1 - s * 0.65], [9, s * 0.65]];
  if (part.bone === 0) return [[0, 1]];
  if (part.bone === 5) return [[5, 1]];
  return spineWeight(g[0]);
};

// 1. 샐리 라이트풋 게 (Sally Lightfoot Crab) — 선홍색 등껍질 · 청록 배 · 집게 2 · 걷는다리 8
function buildCrab(stage) {
  const m = new Model();
  const cRed = stage === 0 ? hex('#3a3234') : hex('#d9381e');
  const cOrg = stage === 0 ? hex('#5c4a3e') : hex('#f28522');
  const cBlue = hex('#5db7d4');
  // 둥글고 납작한 갑각(carapace)
  m.sweep('carapace', (s) => {
    const x = 0.44 - s * 0.88, f = Math.sin(clamp(s, 0.01, 0.99) * Math.PI);
    return { c: [x, 0.04, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.025 + 0.14 * Math.pow(f, 0.72), b: 0.06 + 0.46 * Math.pow(f, 0.62), e: 2.3 };
  }, {
    ns: 18, nt: 16, capStart: 0.02, capEnd: 0.02, island: [0.02, 0.02, 0.56, 0.54], bone: 'body',
    paint: (P, n) => {
      if (n[1] < -0.25) return mul(cBlue, 0.92 + 0.12 * noise(P[0] * 18, P[1] * 18, P[2] * 18));
      const spot = fbm([P[0] * 14, P[2] * 14, 1], 3);
      return mix(cRed, cOrg, smooth(0.35, 0.72, spot));
    },
  });
  // 눈자루 2개
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.43, 0.14, sd * 0.14], 0.045, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [20, 22, 26] });
  // 앞 집게발 2개 (fin_L / fin_R)
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.28, 0.0, sd * 0.36], t = [0.68, -0.06, sd * 0.24];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => {
      const arc = Math.sin(s * Math.PI) * 0.18;
      return { c: [r[0] + (t[0] - r[0]) * s, r[1] - 0.04 * s, r[2] + (t[2] - r[2]) * s + sd * arc], u: [0, 1, 0], v: [0, 0, 1], a: 0.045 + 0.055 * Math.sin(s * Math.PI), b: 0.045 + 0.04 * Math.sin(s * Math.PI) };
    }, { ns: 10, nt: 8, capEnd: 0.018, island: [0.58, 0.02, 0.98, 0.44], bone: sd > 0 ? 6 : 8, paint: (P, n, [s]) => mix(cRed, cOrg, s * 0.45) });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    // 좌우 걷는다리 4쌍 (총 8개)
    for (let k = 0; k < 4; k++) {
      const lx = 0.18 - k * 0.16, spread = 0.78 + (k === 1 || k === 2 ? 0.14 : 0);
      m.sweep(`leg_${sd}_${k}`, (s) => {
        const knee = Math.sin(s * Math.PI) * 0.14;
        return { c: [lx - s * 0.10 * (k - 1.2), 0.02 + knee - s * 0.20, sd * (0.38 + s * spread)], u: [1, 0, 0], v: [0, 1, 0], a: 0.036 * (1 - 0.65 * s), b: 0.030 * (1 - 0.65 * s) };
      }, { ns: 8, nt: 6, capEnd: 0.008, island: [0.02, 0.58, 0.84, 0.96], bone: k < 2 ? 2 : 4, paint: (P, n, [s]) => mix(cRed, cOrg, smooth(0.4, 0.9, s)) });
    }
  }
  return { m, fins, roughness: 0.44, weight: stdFinWeight };
}

// 2. 갈라파고스 가시랍스터 (Spiny Lobster) — 붉은주황 마디 몸통 · 긴 더듬이 2 · 다리 10 · 부채꼬리
function buildLobster(stage) {
  const m = new Model();
  const cShell = hex('#b8451e'), cGold = hex('#e08a38'), cDark = hex('#4a1c10');
  m.sweep('body', (s) => {
    const x = 0.85 - s * 1.65;
    const seg = 1 + 0.06 * Math.sin(s * 34);
    const a = (s < 0.42 ? 0.15 + 0.03 * Math.sin(s / 0.42 * Math.PI) : 0.14 * (1 - (s - 0.42) * 0.72)) * seg;
    const b = a * 1.08;
    return { c: [x, 0.02, 0], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.035, a), b: Math.max(0.04, b), e: 2.1 };
  }, {
    ns: 26, nt: 14, capStart: 0.03, capEnd: 0.02, island: [0.02, 0.02, 0.62, 0.54], bone: 'body',
    paint: (P, n) => {
      const band = Math.sin(P[0] * 32) > 0.35 ? 0.55 : 0;
      return mix(mix(cShell, cGold, fbm([P[0] * 14, P[1] * 14, P[2] * 14], 2)), cDark, band * 0.45);
    },
  });
  // 꼬리 부채(tail fan)
  for (const ang of [-0.55, -0.25, 0, 0.25, 0.55]) {
    m.sweep('tfan' + ang, (s) => ({ c: [-0.78 - s * 0.24 * Math.cos(ang), 0, Math.sin(ang) * (0.04 + s * 0.28)], u: [0, 1, 0], v: [0, 0, 1], a: 0.018, b: 0.055 * (0.5 + 0.7 * s) }), { ns: 5, nt: 6, capEnd: 0.01, island: [0.64, 0.02, 0.96, 0.30], bone: 5, paint: () => cGold });
  }
  const fins = {};
  for (const sd of [1, -1]) {
    m.sphere('eye' + sd, [0.80, 0.11, sd * 0.085], 0.032, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [14, 14, 16] });
    // 긴 2개의 뿔더듬이 (antennae)
    m.sweep('ant' + sd, (s) => ({ c: [0.84 + s * 0.48 - s * s * 0.32, 0.08 + s * 0.14, sd * (0.07 + s * 0.42)], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.007, 0.028 * (1 - 0.78 * s)), b: Math.max(0.007, 0.028 * (1 - 0.78 * s)) }), { ns: 10, nt: 6, capEnd: 0.006, island: [0.64, 0.34, 0.96, 0.62], bone: 0, paint: () => cGold });
    // 앞다리 1쌍 -> fin_L/R
    const r = [0.52, -0.05, sd * 0.15], t = [0.64, -0.22, sd * 0.50];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s + Math.sin(s * Math.PI) * 0.06, r[2] + (t[2] - r[2]) * s], u: [1, 0, 0], v: [0, 1, 0], a: 0.028 * (1 - 0.55 * s), b: 0.026 * (1 - 0.55 * s) }), { ns: 7, nt: 6, capEnd: 0.008, island: [0.02, 0.58, 0.84, 0.96], bone: sd > 0 ? 6 : 8, paint: () => cShell });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    // 걷는다리 4쌍
    for (let k = 0; k < 4; k++) {
      const lx = 0.38 - k * 0.14;
      m.sweep(`leg_${sd}_${k}`, (s) => ({ c: [lx - s * 0.08, -0.05 + Math.sin(s * Math.PI) * 0.08 - s * 0.22, sd * (0.14 + s * 0.36)], u: [1, 0, 0], v: [0, 1, 0], a: 0.024 * (1 - 0.6 * s), b: 0.022 * (1 - 0.6 * s) }), { ns: 6, nt: 6, capEnd: 0.007, island: [0.02, 0.58, 0.84, 0.96], bone: k < 2 ? 2 : 3, paint: (P, n, [s]) => mix(cShell, cGold, s * 0.5) });
    }
  }
  return { m, fins, roughness: 0.48, weight: stdFinWeight };
}

// 3. 파란고리문어 (Blue-Ringed Octopus) — 황토빛 둥근 외투막 + 형광 파란 고리 무늬 + 8개 촉수
function buildBlueRingedOctopus(stage) {
  const m = new Model();
  const cOchre = hex('#d9b458'), cDark = hex('#7c5624'), cBlue = hex('#14a8ff');
  const paintOcto = (P) => {
    const f = fbm([P[0] * 14, P[1] * 14, P[2] * 14], 2);
    let col = mix(cOchre, cDark, smooth(0.45, 0.78, f) * 0.55);
    // 형광 파란 고리(ring) 패턴
    const g = Math.hypot(Math.sin(P[0] * 24), Math.sin(P[2] * 24 + P[1] * 18));
    if (g > 0.34 && g < 0.50) col = cBlue;
    else if (g >= 0.50 && g < 0.58) col = [30, 24, 18];
    return col;
  };
  // 둥근 외투막(head/mantle) — 뒤쪽(+/-)으로 둥글게
  m.sweep('mantle', (s) => {
    const x = 0.10 + s * 0.68, f = Math.sin(clamp(s, 0.02, 0.98) * Math.PI);
    return { c: [x, 0.14 + 0.08 * f, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.04 + 0.24 * Math.pow(f, 0.75), b: 0.04 + 0.23 * Math.pow(f, 0.75), e: 2.05 };
  }, { ns: 16, nt: 16, capStart: 0.03, capEnd: 0.03, island: [0.02, 0.02, 0.52, 0.54], bone: 0, paint: paintOcto });
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.22, 0.18, sd * 0.15], 0.048, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [18, 20, 24] });
  // 8개 촉수 (방사형으로 퍼지며 뒤·옆으로 우아하게 뻗음)
  const fins = { L: { root: [0.1, 0, 0.18], tip: [-0.5, -0.08, 0.75] }, R: { root: [0.1, 0, -0.18], tip: [-0.5, -0.08, -0.75] } };
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const dx = -0.35 + Math.cos(ang) * 0.62, dz = Math.sin(ang) * 0.76;
    m.sweep('arm' + k, (s) => {
      const wave = Math.sin(s * Math.PI * 1.4 + k) * 0.06;
      return { c: [0.14 + dx * s, 0.04 - 0.14 * s + wave, Math.sin(ang) * 0.12 + dz * s], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.012, 0.072 * (1 - 0.82 * s)), b: Math.max(0.012, 0.072 * (1 - 0.82 * s)) };
    }, { ns: 10, nt: 8, capEnd: 0.01, island: [0.54, 0.02, 0.98, 0.96], bone: Math.sin(ang) > 0.4 ? 6 : Math.sin(ang) < -0.4 ? 8 : 4, paint: (P, n) => n[1] < -0.45 ? [238, 232, 214] : paintOcto(P) });
  }
  return { m, fins, roughness: 0.45, weight: stdFinWeight };
}

// 4. 앵무조개 (Nautilus) — 나선형 껍질 + 적갈색 호랑이 줄무늬 + 두건 + 촉수 다발
function buildNautilus(stage) {
  const m = new Model();
  const cIvory = hex('#eee6d4'), cStripe = hex('#9c3c1e'), cHood = hex('#7a3a22');
  // 둥근 나선 껍질 (두툼한 원반형)
  m.sweep('shell', (s) => {
    const ang = s * Math.PI * 2.05;
    const r = 0.08 + s * 0.34;
    return { c: [-0.12 - Math.cos(ang) * r * 0.88, 0.04 + Math.sin(ang) * r * 0.88, 0], u: [Math.cos(ang), -Math.sin(ang), 0], v: [0, 0, 1], a: 0.04 + s * 0.24, b: 0.04 + s * 0.22, e: 2.1 };
  }, {
    ns: 28, nt: 14, capStart: 0.02, capEnd: 0.02, island: [0.02, 0.02, 0.62, 0.64], bone: 'body',
    paint: (P, n, [s]) => {
      const band = Math.sin(s * 54 + Math.abs(P[2]) * 6);
      return band > 0.15 ? mix(cStripe, hex('#6c2410'), 0.3) : cIvory;
    },
  });
  // 두건(hood) + 큰 눈
  m.sweep('hood', (s) => ({ c: [0.16 + s * 0.34, 0.16 - s * 0.08, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.14 * (1 - 0.55 * s), b: 0.16 * (1 - 0.45 * s) }), { ns: 8, nt: 10, capEnd: 0.02, island: [0.64, 0.02, 0.98, 0.40], bone: 0, paint: (P) => mix(cHood, cIvory, noise(P[0] * 28, P[1] * 28, P[2] * 28) > 0.65 ? 0.8 : 0) });
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.28, 0.02, sd * 0.17], 0.058, { island: [0.86, 0.86, 0.98, 0.98], bone: 0, paint: (P, n) => Math.abs(n[2]) > 0.72 ? [16, 16, 20] : [235, 228, 212] });
  // 촉수 다발(cirri)
  for (let k = 0; k < 10; k++) {
    const dy = (k / 9 - 0.5) * 0.26, dz = ((k % 3) - 1) * 0.08;
    m.sweep('cir' + k, (s) => ({ c: [0.24 + s * 0.44, -0.05 + dy - s * 0.06, dz * (1 + s * 0.5)], u: [0, 1, 0], v: [0, 0, 1], a: 0.016 * (1 - 0.65 * s), b: 0.016 * (1 - 0.65 * s) }), { ns: 6, nt: 5, capEnd: 0.005, island: [0.64, 0.44, 0.98, 0.80], bone: 0, paint: () => cIvory });
  }
  const fins = { L: { root: [0.2, 0, 0.16], tip: [0.55, -0.05, 0.22] }, R: { root: [0.2, 0, -0.16], tip: [0.55, -0.05, -0.22] } };
  return { m, fins, roughness: 0.42, weight: stdFinWeight };
}

// 5. 대왕조개 (Giant Clam) — 물결 주름 조개껍질 2짝 + 안쪽 영롱한 청록·보라 외투막
function buildGiantClam(stage) {
  const m = new Model();
  const cShell = hex('#dfd5c0'), cRib = hex('#b8ab92'), cMantle1 = hex('#1288a8'), cMantle2 = hex('#3ce0d0'), cPurple = hex('#5c38a8');
  for (const sd of [1, -1]) {
    m.sweep('valve' + sd, (s) => {
      const x = 0.74 - s * 1.48, f = Math.sin(clamp(s, 0.01, 0.99) * Math.PI);
      const flute = 1 + 0.14 * Math.sin(s * Math.PI * 5);
      return { c: [x, -0.08 + 0.18 * f, sd * (0.14 + 0.22 * f * flute)], u: [0, 1, 0], v: [0, 0, 1], a: 0.04 + 0.28 * Math.pow(f, 0.7), b: 0.05 + 0.10 * f, e: 2.2 };
    }, {
      ns: 24, nt: 12, capStart: 0.02, capEnd: 0.02, island: [0.02, 0.02, 0.62, 0.56], bone: sd > 0 ? 6 : 8,
      paint: (P, n, [s]) => mix(cShell, cRib, smooth(0.3, 0.8, Math.abs(Math.sin(s * Math.PI * 5))) * 0.65),
    });
  }
  // 안쪽 화려한 청록 외투막(mantle)
  m.sweep('mantle', (s) => {
    const x = 0.64 - s * 1.28, f = Math.sin(clamp(s, 0.02, 0.98) * Math.PI);
    return { c: [x, 0.10 + 0.08 * f, Math.sin(s * Math.PI * 5) * 0.04], u: [0, 1, 0], v: [0, 0, 1], a: 0.04 + 0.14 * f, b: 0.06 + 0.24 * f, e: 2.1 };
  }, {
    ns: 22, nt: 14, capStart: 0.02, capEnd: 0.02, island: [0.02, 0.60, 0.96, 0.96], bone: 'body',
    paint: (P) => {
      const v = fbm([P[0] * 14, P[2] * 14, 1], 3);
      return v > 0.62 ? cMantle2 : v < 0.36 ? cPurple : cMantle1;
    },
  });
  const fins = { L: { root: [0, -0.1, 0.15], tip: [0, 0.2, 0.42] }, R: { root: [0, -0.1, -0.15], tip: [0, 0.2, -0.42] } };
  return { m, fins, roughness: 0.65, weight: stdFinWeight };
}

// 6. 피그미 해마 (Pygmy Seahorse) — 분홍 산호 돌기 해마 · 관형 주둥이 · 말린 꼬리
function buildPygmySeahorse(stage) {
  const m = new Model();
  const cPink = hex('#e8a0b0'), cBump = hex('#d93c64');
  // S자 해마 몸통 + 통통한 배 + 말린 꼬리
  const pts = [
    [0.46, 0.46, 0.034], [0.28, 0.50, 0.088], [0.14, 0.44, 0.125], [0.08, 0.24, 0.115],
    [0.14, 0.02, 0.185], [0.08, -0.20, 0.155], [-0.04, -0.40, 0.098],
    [-0.14, -0.56, 0.064], [-0.04, -0.68, 0.044], [0.08, -0.62, 0.028],
  ];
  const samplePt = (s) => {
    const f = clamp(s) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
    const A = pts[i], B = pts[i + 1];
    return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  };
  m.sweep('body', (s) => {
    const [x, y, r] = samplePt(s);
    const bump = 1 + 0.14 * Math.pow(Math.abs(Math.sin(s * 42)), 3);
    // 수직으로 서는 해마 척추: 앞뒤(X)와 좌우(Z)로 단면이 열리도록 u=[1,0,0] 사용!
    return { c: [x, y, 0], u: [1, 0, 0], v: [0, 0, 1], a: r * bump, b: r * 0.82 * bump, e: 2.0 };
  }, {
    ns: 32, nt: 14, capStart: 0.018, capEnd: 0.012, island: [0.02, 0.02, 0.68, 0.68], bone: 'body',
    paint: (P) => {
      const tub = noise(P[0] * 26, P[1] * 26, P[2] * 26);
      return tub > 0.66 ? cBump : mix(cPink, [248, 224, 232], smooth(0.3, 0.7, fbm([P[0] * 12, P[1] * 12, P[2] * 12], 2)));
    },
  });
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.24, 0.48, sd * 0.095], 0.032, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [20, 16, 18] });
  // 등지느러미 — 등 중심(x=+0.02)에서 뒤로 매끄럽게 뻗음
  m.sweep('dorsal', (s) => ({ c: [0.02 - s * 0.14, 0.02, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.11 * (0.65 + 0.35 * Math.sin(s * Math.PI)), b: 0.014 }), { ns: 6, nt: 6, capEnd: 0.006, island: [0.70, 0.02, 0.96, 0.36], bone: 2, paint: () => cPink });
  const fins = { L: { root: [0.14, 0.28, 0.10], tip: [0.04, 0.26, 0.19] }, R: { root: [0.14, 0.28, -0.10], tip: [0.04, 0.26, -0.19] } };
  return { m, fins, roughness: 0.62, weight: stdFinWeight };
}

// 7. 나뭇잎해룡 (Leafy Seadragon) — 가느다란 주황·금빛 해룡 몸통 + 입체 3D 해조류 잎사귀 부속지
function buildLeafySeadragon(stage) {
  const m = new Model();
  const cBody = hex('#d87c2c'), cGold = hex('#e4b848'), cLeaf = hex('#7c9a3e');
  const bodyY = (s) => (s < 0.25 ? 0.14 - s * 0.32 : Math.sin((s - 0.25) / 0.75 * Math.PI * 1.3) * 0.12);
  m.sweep('body', (s) => {
    const x = 0.92 - s * 1.84;
    const y = bodyY(s);
    const r = s < 0.18 ? 0.024 + s * 0.16 : 0.082 * Math.sin(clamp((s - 0.12) / 0.88, 0.02, 0.98) * Math.PI) ** 0.65 + 0.016;
    return { c: [x, y, 0], u: [0, 1, 0], v: [0, 0, 1], a: r * 1.15, b: r * 0.68, e: 2.0 };
  }, {
    ns: 30, nt: 12, capStart: 0.015, capEnd: 0.01, island: [0.02, 0.02, 0.56, 0.54], bone: 'body',
    paint: (P) => mix(cBody, cGold, smooth(0.3, 0.75, Math.sin(P[0] * 28) * 0.5 + 0.5)),
  });
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.56, 0.10, sd * 0.052], 0.024, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [18, 16, 14] });
  // 입체 해조류 잎사귀 부속지 — 모든 잎의 뿌리를 몸통 중심선(bodyY)에 정확히 고정!
  const leaves = [
    [0.34, 0.01, 0.26, 0.10], [0.12, -0.01, 0.30, -0.12], [-0.14, 0.01, 0.28, 0.14],
    [-0.40, -0.01, 0.24, -0.12], [-0.66, 0.01, 0.20, 0.09],
    [0.24, -0.01, -0.24, -0.10], [-0.04, 0.01, -0.28, 0.13], [-0.34, -0.01, -0.25, -0.12],
  ];
  leaves.forEach(([lx, lz, dy, dz], i) => {
    const s0 = clamp((0.92 - lx) / 1.84), ly = bodyY(s0);
    m.sweep('leaf' + i, (s) => ({
      c: [lx - s * 0.16, ly + dy * s, lz + dz * s], u: [1, 0, 0], v: [0, 0, 1],
      a: 0.058 * Math.sin(clamp(s, 0.05, 0.95) * Math.PI) + 0.014, b: 0.012, e: 1.8,
    }), { ns: 7, nt: 6, capEnd: 0.008, island: [0.58, 0.02, 0.98, 0.80], bone: i < 2 ? 1 : i < 5 ? 3 : 4, paint: (P, n, [s]) => mix(cGold, cLeaf, s * 0.75) });
  });
  const fins = { L: { root: [0.32, 0.02, 0.05], tip: [0.16, -0.05, 0.20] }, R: { root: [0.32, 0.02, -0.05], tip: [0.16, -0.05, -0.20] } };
  return { m, fins, roughness: 0.55, weight: stdFinWeight };
}

// 8. 붉은입술박쥐물고기 (Red-Lipped Batfish) — 납작한 삼각 머리 + 선명한 빨간 립스틱 입술 + 팔처럼 걷는 지느러미
function buildBatfish(stage) {
  const m = new Model();
  const cTop = hex('#888a82'), cSpot = hex('#3c3a36'), cBelly = hex('#d8d2c6'), cLip = hex('#dc1822');
  // 납작한 삼각형 몸통 -> 좁아지는 꼬리
  m.sweep('body', (s) => {
    const x = 0.78 - s * 1.68;
    const disc = s < 0.48 ? Math.sin((s / 0.48) * Math.PI * 0.82) : 0;
    const b = s < 0.48 ? 0.08 + 0.34 * disc : 0.18 * Math.pow(1 - (s - 0.48) / 0.52, 0.9) + 0.02;
    const a = s < 0.48 ? 0.05 + 0.13 * disc : 0.12 * Math.pow(1 - (s - 0.48) / 0.52, 0.85) + 0.02;
    return { c: [x, 0.02, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.3 };
  }, {
    ns: 24, nt: 16, capStart: 0.025, capEnd: 0.015, island: [0.02, 0.02, 0.62, 0.56], bone: 'body',
    paint: (P, n) => {
      if (n[1] < -0.28) return cBelly;
      const sp = fbm([P[0] * 14, P[2] * 14, 1], 2);
      return mix(cTop, cSpot, smooth(0.45, 0.78, sp));
    },
  });
  // 선명한 빨간 입술(iconic red lips)
  m.sweep('lips', (s) => {
    const u = (s - 0.5) * 2;
    return { c: [0.76 - u * u * 0.04, -0.02, u * 0.11], u: [1, 0, 0], v: [0, 1, 0], a: 0.042, b: 0.048 * (1 - 0.35 * Math.abs(u)), e: 2.0 };
  }, { ns: 10, nt: 8, capStart: 0.015, capEnd: 0.015, island: [0.66, 0.02, 0.96, 0.28], bone: 0, paint: () => cLip });
  // 코 위 작은 뿔(rostrum) + 눈
  m.sweep('horn', (s) => ({ c: [0.76 + s * 0.12, 0.06 + s * 0.03, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.022 * (1 - 0.7 * s), b: 0.022 * (1 - 0.7 * s) }), { ns: 5, nt: 6, capEnd: 0.005, island: [0.66, 0.32, 0.80, 0.44], bone: 0, paint: () => cSpot });
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.64, 0.09, sd * 0.11], 0.028, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [18, 20, 22] });
  // 팔처럼 바닥을 짚고 걷는 가슴지느러미 (fin_L/R)
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.10, -0.02, sd * 0.32], t = [-0.08, -0.24, sd * 0.54];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [1, 0, 0], v: [0, 1, 0], a: 0.068 * (1 - 0.35 * s), b: 0.026 * (1 - 0.4 * s) }), { ns: 8, nt: 8, capEnd: 0.012, island: [0.64, 0.48, 0.98, 0.82], bone: sd > 0 ? 6 : 8, paint: () => cSpot });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
  }
  // 꼬리지느러미
  m.sweep('tail', (s) => ({ c: [-0.86 - s * 0.24, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.04 + s * 0.16, b: 0.014 }), { ns: 6, nt: 6, capEnd: 0.008, island: [0.02, 0.62, 0.44, 0.94], bone: 5, paint: () => cTop });
  return { m, fins, roughness: 0.66, weight: stdFinWeight };
}

// 9. 가시복 (Porcupinefish) — 통통한 황갈색 점박이 몸통 + 3D 원뿔 가시 + 큰 눈
function buildPorcupinefish(stage) {
  const m = new Model();
  const cTop = hex('#a88c5c'), cBelly = hex('#e8dfc8'), cSpot = hex('#342a1e');
  m.sweep('body', (s) => {
    const x = 0.72 - s * 1.44, f = Math.sin(clamp(s, 0.01, 0.99) * Math.PI);
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.03 + 0.36 * Math.pow(f, 0.68), b: 0.03 + 0.34 * Math.pow(f, 0.68), e: 2.05 };
  }, {
    ns: 22, nt: 18, capStart: 0.03, capEnd: 0.02, island: [0.02, 0.02, 0.64, 0.64], bone: 'body',
    paint: (P, n) => {
      if (n[1] < -0.35) return cBelly;
      const sp = noise(P[0] * 22, P[1] * 22, P[2] * 22);
      return sp > 0.72 ? cSpot : mul(cTop, 0.90 + 0.18 * fbm([P[0] * 10, P[1] * 10, P[2] * 10], 2));
    },
  });
  // 입체 가시 (등/옆면에 28개)
  for (let i = 0; i < 28; i++) {
    const t = (i + 0.5) / 28, phi = i * 2.399, sx = 0.42 - t * 0.92;
    const f = Math.sin(clamp((0.72 - sx) / 1.44, 0.05, 0.95) * Math.PI);
    const ry = 0.34 * Math.pow(f, 0.68), rz = 0.32 * Math.pow(f, 0.68);
    const cy = Math.cos(phi) * ry, cz = Math.sin(phi) * rz;
    const ny = Math.cos(phi), nz = Math.sin(phi);
    m.sweep('sp' + i, (s) => ({ c: [sx - s * 0.05, cy + ny * s * 0.09, cz + nz * s * 0.09], u: [1, 0, 0], v: [0, -nz, ny], a: 0.016 * (1 - 0.85 * s), b: 0.016 * (1 - 0.85 * s) }), { ns: 3, nt: 5, capEnd: 0.003, island: [0.68, 0.02, 0.96, 0.30], bone: 2, paint: () => cBelly });
  }
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.50, 0.13, sd * 0.22], 0.068, { island: [0.86, 0.86, 0.98, 0.98], bone: 0, paint: (P, n) => Math.abs(n[2]) > 0.6 ? [16, 20, 26] : [188, 174, 134] });
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.22, -0.02, sd * 0.32], t = [0.02, -0.06, sd * 0.52];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [0, 1, 0], v: [1, 0, 0], a: 0.08 + s * 0.08, b: 0.012 }), { ns: 6, nt: 6, capEnd: 0.006, island: [0.68, 0.36, 0.96, 0.66], bone: sd > 0 ? 6 : 8, paint: () => cBelly });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
  }
  m.sweep('tail', (s) => ({ c: [-0.70 - s * 0.24, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.05 + s * 0.14, b: 0.014 }), { ns: 6, nt: 6, capEnd: 0.006, island: [0.02, 0.68, 0.44, 0.96], bone: 5, paint: () => cTop });
  return { m, fins, roughness: 0.58, weight: stdFinWeight };
}

// 10. 장어 · 관형 어류 3종 (리본 장어 · 정원장어 · 점박이 트럼펫피쉬)
function buildSlenderFish(kind, stage) {
  const m = new Model();
  const isRibbon = kind === 'ribbon_eel', isGarden = kind === 'garden_eel', isTrumpet = kind === 'spotted_trumpetfish';
  m.sweep('body', (s) => {
    const x = 0.98 - s * 1.96;
    const wave = isRibbon ? Math.sin(s * Math.PI * 2) * 0.04 : 0;
    let a, b;
    if (isTrumpet) {
      // 긴 관형 주둥이(s<0.28) + 가늘고 긴 몸통 + 작은 꼬리
      a = s < 0.26 ? 0.026 + 0.014 * (s / 0.26) : 0.058 * Math.sin(clamp((s - 0.18) / 0.82, 0.05, 0.95) * Math.PI) ** 0.55 + 0.016;
      b = a * 0.72;
    } else if (isRibbon) {
      a = 0.055 * Math.pow(1 - s * 0.65, 0.7) + 0.012; b = a * 0.48;
    } else {
      a = 0.046 * Math.pow(1 - s * 0.62, 0.7) + 0.012; b = a * 0.92;
    }
    return { c: [x, wave, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.0 };
  }, {
    ns: 32, nt: 12, capStart: 0.012, capEnd: 0.008, island: [0.02, 0.02, 0.74, 0.54], bone: 'body',
    paint: (P, n) => {
      if (isRibbon) {
        if (P[0] > 0.74) return hex('#f5d020'); // 노란 주둥이
        return n[1] < -0.55 ? hex('#f5d020') : hex('#1458e8'); // 코발트 블루 몸통
      }
      if (isGarden) {
        const dot = noise(P[0] * 42, P[1] * 42, P[2] * 42);
        const blotch = Math.hypot(P[0] - 0.45, P[1]) < 0.08;
        return blotch || dot > 0.72 ? [36, 38, 42] : [224, 222, 214];
      }
      // 트럼펫피쉬: 적갈·올리브 세로줄+흰점
      const bar = Math.sin(P[0] * 38) > 0.45 ? 0.35 : 0;
      return mix(hex('#8c6244'), hex('#d6b888'), bar);
    },
  });
  // 리본장어 높고 선명한 네온 노랑 등지느러미
  if (isRibbon) {
    m.sweep('crest', (s) => ({ c: [0.80 - s * 1.72, 0.085 + Math.sin(s * Math.PI * 2) * 0.04, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.055 * (1 - 0.5 * s), b: 0.008 }), { ns: 26, nt: 6, capEnd: 0.005, island: [0.76, 0.02, 0.98, 0.54], bone: 'body', paint: () => hex('#f8d824') });
  }
  if (isTrumpet) {
    m.sweep('tail', (s) => ({ c: [-0.94 - s * 0.16, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.025 + s * 0.09, b: 0.008 }), { ns: 5, nt: 6, capEnd: 0.005, island: [0.76, 0.02, 0.98, 0.44], bone: 5, paint: () => hex('#7a5438') });
  }
  for (const sd of [1, -1]) m.sphere('eye' + sd, [isTrumpet ? 0.42 : 0.88, 0.024, sd * 0.036], 0.020, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [18, 20, 24] });
  const fins = { L: { root: [0.45, -0.02, 0.04], tip: [0.32, -0.05, 0.11] }, R: { root: [0.45, -0.02, -0.04], tip: [0.32, -0.05, -0.11] } };
  return { m, fins, roughness: 0.42, weight: stdFinWeight };
}

// 11. 만다린 피쉬 (Mandarinfish) & 깃대돔 (Moorish Idol)
function buildOrnamentalReef(kind, stage) {
  const m = new Model();
  if (kind === 'mandarinfish') {
    const cOrg = hex('#f27418'), cBlue = hex('#1496e8'), cNavy = hex('#122452');
    m.sweep('body', (s) => {
      const x = 0.78 - s * 1.48, f = Math.sin(clamp(s, 0.01, 0.99) * Math.PI);
      return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.03 + 0.19 * Math.pow(f, 0.72), b: 0.03 + 0.16 * Math.pow(f, 0.75), e: 2.1 };
    }, {
      ns: 22, nt: 16, capStart: 0.02, capEnd: 0.015, island: [0.02, 0.02, 0.62, 0.56], bone: 'body',
      paint: (P) => {
        const w = Math.sin(P[0] * 26 + Math.sin(P[1] * 24) * 1.8);
        return w > 0.32 ? cBlue : w < -0.35 ? cNavy : cOrg;
      },
    });
    m.sweep('dorsal', (s) => ({ c: [0.22 - s * 0.74, 0.18 + Math.sin(s * Math.PI) * 0.14, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.09 + 0.08 * Math.sin(s * Math.PI), b: 0.012 }), { ns: 10, nt: 6, capEnd: 0.006, island: [0.64, 0.02, 0.98, 0.44], bone: 2, paint: (P) => Math.sin(P[0] * 32) > 0 ? cOrg : cBlue });
    m.sweep('tail', (s) => ({ c: [-0.68 - s * 0.28, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.06 + s * 0.18, b: 0.012 }), { ns: 7, nt: 6, capEnd: 0.006, island: [0.02, 0.60, 0.56, 0.96], bone: 5, paint: (P) => Math.abs(P[1]) > 0.12 ? cBlue : cOrg });
    for (const sd of [1, -1]) m.sphere('eye' + sd, [0.56, 0.07, sd * 0.11], 0.038, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: (P, n) => Math.abs(n[2]) > 0.55 ? [14, 16, 20] : [235, 110, 30] });
    const fins = {};
    for (const sd of [1, -1]) {
      const r = [0.26, -0.04, sd * 0.14], t = [0.02, -0.14, sd * 0.38];
      m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [0, 1, 0], v: [1, 0, 0], a: 0.07 + s * 0.08, b: 0.012 }), { ns: 7, nt: 6, capEnd: 0.006, island: [0.64, 0.48, 0.98, 0.84], bone: sd > 0 ? 6 : 8, paint: () => cBlue });
      fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    }
    return { m, fins, roughness: 0.45, weight: stdFinWeight };
  }
  // 깃대돔 (Moorish Idol) — 원반형 흑/백/노랑 세로 줄무늬 + 긴 흰 등지느러미 채찍
  const cBlk = hex('#181a20'), cWht = hex('#f2f0e6'), cYel = hex('#e8d238'), cOrg = hex('#e87c24');
  m.sweep('body', (s) => {
    const x = 0.72 - s * 1.24, f = Math.sin(clamp(s, 0.01, 0.99) * Math.PI);
    const snout = s < 0.16 ? 0.35 + 0.65 * (s / 0.16) : 1;
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: (0.04 + 0.48 * Math.pow(f, 0.68)) * snout, b: 0.015 + 0.095 * Math.pow(f, 0.72), e: 2.0 };
  }, {
    ns: 24, nt: 16, capStart: 0.015, capEnd: 0.012, island: [0.02, 0.02, 0.62, 0.60], bone: 'body',
    paint: (P) => {
      if (P[0] > 0.52) return P[1] > 0.02 ? cOrg : cWht;
      if (P[0] > 0.18) return cBlk;
      if (P[0] > -0.10) return P[1] < 0 ? cWht : mix(cWht, cYel, 0.35);
      if (P[0] > -0.34) return cBlk;
      return cYel;
    },
  });
  // 긴 흰 등지느러미 깃대(whip filament)
  m.sweep('whip', (s) => ({ c: [0.05 - s * 0.92, 0.44 + Math.sin(s * Math.PI) * 0.24 - s * 0.08, 0], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.010, 0.12 * Math.pow(1 - s, 1.4)), b: 0.008 }), { ns: 14, nt: 6, capEnd: 0.005, island: [0.64, 0.02, 0.98, 0.44], bone: 3, paint: () => cWht });
  // 검은 초승달 꼬리
  m.sweep('tail', (s) => ({ c: [-0.50 - s * 0.28, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.06 + s * 0.24, b: 0.010 }), { ns: 7, nt: 6, capEnd: 0.005, island: [0.02, 0.64, 0.48, 0.96], bone: 5, paint: () => cBlk });
  for (const sd of [1, -1]) m.sphere('eye' + sd, [0.36, 0.14, sd * 0.075], 0.032, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [20, 22, 26] });
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.16, -0.06, sd * 0.08], t = [-0.04, -0.14, sd * 0.24];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [0, 1, 0], v: [1, 0, 0], a: 0.06 * (1 - 0.4 * s), b: 0.008 }), { ns: 5, nt: 6, capEnd: 0.005, island: [0.64, 0.48, 0.96, 0.78], bone: sd > 0 ? 6 : 8, paint: () => cWht });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
  }
  return { m, fins, roughness: 0.48, weight: stdFinWeight };
}

// 12. 외양 대형어 4종 (돗새치 · 청새치 · 황다랑어 · 가다랑어)
function buildPelagicHero(kind, stage) {
  const m = new Model();
  const isSail = kind === 'sailfish', isMarlin = kind === 'blue_marlin', isYellowfin = kind === 'yellowfin_tuna', isSkipjack = kind === 'skipjack_tuna';
  const isBill = isSail || isMarlin;
  const cBack = isSail ? hex('#1a4a96') : isMarlin ? hex('#1c3c7a') : isYellowfin ? hex('#1b345c') : hex('#223458');
  const cMid = isSail ? hex('#6c94c4') : isMarlin ? hex('#5e82b4') : hex('#8fa4bc');
  const cBelly = hex('#e4eaf0'), cYel = hex('#f4c824');

  m.sweep('body', (s) => {
    const x = (isBill ? 0.58 : 0.86) - s * (isBill ? 1.46 : 1.72);
    const f = Math.sin(Math.pow(clamp(s, 0.01, 0.99), 0.62) * Math.PI);
    const a = (isBill ? 0.145 : isYellowfin ? 0.24 : 0.22) * Math.pow(f, 0.78) + 0.018;
    const b = (isBill ? 0.105 : 0.185) * Math.pow(f, 0.82) + 0.016;
    return { c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.15 };
  }, {
    ns: 26, nt: 16, capStart: 0.025, capEnd: 0.02, island: [0.02, 0.02, 0.60, 0.54], bone: 'body',
    paint: (P, n) => {
      const ny = clamp(P[1] / 0.20 * 0.5 + 0.5, 0, 1);
      let col = ny > 0.55 ? mix(cMid, cBack, smooth(0.55, 0.86, ny)) : mix(cBelly, cMid, smooth(0.18, 0.56, ny));
      if (isYellowfin && Math.abs(ny - 0.56) < 0.07) col = mix(col, cYel, 0.75); // 황다랑어 금빛 측선
      if (isSkipjack && ny < 0.48 && ny > 0.14) { // 가다랑어 배쪽 짙은 세로줄 4~5줄
        const stripe = Math.sin(P[1] * 110);
        if (stripe > 0.45) col = mix(col, hex('#263248'), 0.72);
      }
      if (isBill && ny > 0.32 && ny < 0.78 && Math.sin(P[0] * 38) > 0.55) col = mix(col, [160, 200, 240], 0.45);
      return mul(col, 0.93 + 0.12 * fbm([P[0] * 18, P[1] * 18, P[2] * 18], 2));
    },
  });
  // 새치류 긴 창 주둥이(bill)
  if (isBill) {
    m.sweep('bill', (s) => ({ c: [0.54 + s * 0.54, 0.01, 0], u: [0, 1, 0], v: [0, 0, 1], a: Math.max(0.006, 0.038 * (1 - 0.85 * s)), b: Math.max(0.006, 0.032 * (1 - 0.85 * s)) }), { ns: 10, nt: 8, capEnd: 0.005, island: [0.62, 0.02, 0.96, 0.18], bone: 0, paint: () => cBack });
  }
  // 등지느러미 (돗새치는 거대한 돛!)
  if (isSail) {
    m.sweep('sail', (s) => {
      const h = 0.08 + 0.36 * Math.sin(Math.pow(clamp(s, 0.02, 0.98), 0.72) * Math.PI);
      return { c: [0.36 - s * 0.96, 0.13 + h * 0.5, 0], u: [0, 1, 0], v: [0, 0, 1], a: h * 0.55, b: 0.010, e: 1.8 };
    }, { ns: 18, nt: 6, capEnd: 0.006, island: [0.62, 0.22, 0.98, 0.62], bone: 2, paint: (P) => noise(P[0] * 36, P[1] * 36, 1) > 0.74 ? [18, 28, 56] : hex('#225ec8') });
  } else if (isYellowfin) {
    m.sweep('dorsal1', (s) => ({ c: [0.24 - s * 0.22, 0.20 + s * 0.15, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.10 * (1 - 0.75 * s), b: 0.012 }), { ns: 6, nt: 6, capEnd: 0.006, island: [0.62, 0.22, 0.96, 0.44], bone: 2, paint: () => cBack });
    // 황다랑어 상징: 길고 낫처럼 휜 밝은 노란 제2등지느러미 & 뒷지느러미
    m.sweep('dorsal2', (s) => ({ c: [-0.14 - Math.pow(s, 1.3) * 0.34, 0.18 + s * 0.30, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.068 * (1 - 0.82 * s), b: 0.011 }), { ns: 9, nt: 6, capEnd: 0.005, island: [0.62, 0.46, 0.98, 0.74], bone: 3, paint: () => cYel });
    m.sweep('anal2', (s) => ({ c: [-0.14 - Math.pow(s, 1.3) * 0.32, -0.18 - s * 0.28, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.065 * (1 - 0.82 * s), b: 0.011 }), { ns: 9, nt: 6, capEnd: 0.005, island: [0.62, 0.46, 0.98, 0.74], bone: 3, paint: () => cYel });
  } else {
    m.sweep('dorsal1', (s) => ({ c: [0.26 - s * 0.28, (isMarlin ? 0.13 : 0.19) + s * (isMarlin ? 0.24 : 0.16), 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.12 * (1 - 0.78 * s), b: 0.013 }), { ns: 8, nt: 6, capEnd: 0.006, island: [0.62, 0.22, 0.96, 0.48], bone: 2, paint: () => cBack });
  }
  // 초승달 꼬리지느러미 (상엽 + 하엽)
  for (const sy of [1, -1]) {
    m.sweep('tail' + sy, (s) => ({ c: [-0.84 - Math.pow(s, 1.1) * 0.28, sy * (0.01 + s * (isBill ? 0.32 : 0.28)), 0], u: [0.45, sy * 0.88, 0], v: [0, 0, 1], a: Math.max(0.010, 0.075 * (1 - 0.78 * s)), b: 0.012 * (1 - 0.6 * s) }), { ns: 8, nt: 6, capEnd: 0.006, island: [0.02, 0.58, 0.54, 0.96], bone: 5, paint: () => cBack });
  }
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.26, -0.06, sd * (isBill ? 0.09 : 0.16)], t = [0.02, -0.14, sd * (isBill ? 0.36 : 0.40)];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [1, 0, 0], v: [0, 1, 0], a: 0.08 * (1 - 0.72 * s), b: 0.012 }), { ns: 7, nt: 6, capEnd: 0.006, island: [0.62, 0.76, 0.96, 0.96], bone: sd > 0 ? 6 : 8, paint: () => cBack });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    m.sphere('eye' + sd, [isBill ? 0.40 : 0.64, 0.03, sd * (isBill ? 0.075 : 0.115)], 0.028, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [16, 18, 22] });
  }
  return { m, fins, roughness: 0.36, weight: stdFinWeight };
}

// 13. 상어 2종 (미흑점상어 · 화이트팁 리프샤크)
function buildRequiemShark(kind, stage) {
  const m = new Model();
  const isWhite = kind === 'whitetip_reef_shark';
  const cBack = isWhite ? hex('#6c726c') : hex('#545e66'), cMid = hex('#8c9498'), cBelly = hex('#e8eae6'), cTip = isWhite ? hex('#f4f6f2') : hex('#2c3038');
  m.sweep('body', (s) => {
    const x = 0.94 - s * 1.82, f = Math.sin(Math.pow(clamp(s, 0.01, 0.99), 0.56) * Math.PI);
    return { c: [x, 0.02 * Math.sin(s * Math.PI), 0], u: [0, 1, 0], v: [0, 0, 1], a: 0.02 + (isWhite ? 0.145 : 0.16) * Math.pow(f, 0.8), b: 0.02 + 0.135 * Math.pow(f, 0.82), e: 2.15 };
  }, {
    ns: 24, nt: 14, capStart: 0.025, capEnd: 0.02, island: [0.02, 0.02, 0.58, 0.54], bone: 'body',
    paint: (P, n) => {
      const ny = clamp(P[1] / 0.16 * 0.5 + 0.5, 0, 1);
      let col = ny > 0.52 ? mix(cMid, cBack, smooth(0.52, 0.85, ny)) : mix(cBelly, cMid, smooth(0.18, 0.54, ny));
      return mul(col, 0.92 + 0.12 * fbm([P[0] * 22, P[1] * 22, P[2] * 22], 2));
    },
  });
  m.sweep('dorsal1', (s) => ({ c: [0.10 - s * 0.20, 0.13 + s * 0.24, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.13 * (1 - 0.8 * s), b: 0.018 * (1 - 0.7 * s) }), { ns: 8, nt: 6, capEnd: 0.008, island: [0.60, 0.02, 0.98, 0.38], bone: 2, paint: (P, n, [s]) => s > 0.68 ? cTip : cBack });
  m.sweep('dorsal2', (s) => ({ c: [-0.50 - s * 0.09, 0.07 + s * 0.09, 0], u: [1, 0, 0], v: [0, 0, 1], a: 0.06 * (1 - 0.7 * s), b: 0.012 }), { ns: 5, nt: 6, capEnd: 0.006, island: [0.60, 0.02, 0.98, 0.38], bone: 4, paint: () => cBack });
  m.sweep('tail_top', (s) => ({ c: [-0.84 - s * 0.42, 0.01 + s * 0.34, 0], u: [0.5, 0.86, 0], v: [0, 0, 1], a: 0.088 * (1 - 0.72 * s), b: 0.016 * (1 - 0.7 * s) }), { ns: 9, nt: 6, capEnd: 0.008, island: [0.02, 0.58, 0.54, 0.96], bone: 5, paint: (P, n, [s]) => s > 0.72 ? cTip : cBack });
  m.sweep('tail_bot', (s) => ({ c: [-0.84 - s * 0.20, -0.01 - s * 0.20, 0], u: [0.45, -0.88, 0], v: [0, 0, 1], a: 0.072 * (1 - 0.75 * s), b: 0.014 * (1 - 0.7 * s) }), { ns: 7, nt: 6, capEnd: 0.006, island: [0.02, 0.58, 0.54, 0.96], bone: 5, paint: () => cBack });
  const fins = {};
  for (const sd of [1, -1]) {
    const r = [0.22, -0.08, sd * 0.11], t = [-0.04, -0.18, sd * (isWhite ? 0.38 : 0.48)];
    m.sweep(sd > 0 ? 'fin_L' : 'fin_R', (s) => ({ c: [r[0] + (t[0] - r[0]) * s, r[1] + (t[1] - r[1]) * s, r[2] + (t[2] - r[2]) * s], u: [1, 0.1, 0], v: [0, 1, 0], a: 0.12 * (1 - 0.75 * s), b: 0.018 * (1 - 0.7 * s) }), { ns: 8, nt: 6, capEnd: 0.008, island: [0.60, 0.42, 0.98, 0.84], bone: sd > 0 ? 6 : 8, paint: (P, n, [s]) => s > 0.75 ? cTip : cBack });
    fins[sd > 0 ? 'L' : 'R'] = { root: r, tip: t };
    m.sphere('eye' + sd, [0.70, 0.02, sd * 0.092], 0.022, { island: [0.88, 0.88, 0.98, 0.98], bone: 0, paint: () => [16, 18, 20] });
  }
  return { m, fins, roughness: 0.48, weight: stdFinWeight };
}

const SPECIAL_BUILDERS = {
  sally_lightfoot_crab: buildCrab,
  galapagos_lobster: buildLobster,
  blue_ringed_octopus: buildBlueRingedOctopus,
  nautilus: buildNautilus,
  giant_clam: buildGiantClam,
  pygmy_seahorse: buildPygmySeahorse,
  leafy_seadragon: buildLeafySeadragon,
  red_lipped_batfish: buildBatfish,
  porcupinefish: buildPorcupinefish,
  ribbon_eel: (st) => buildSlenderFish('ribbon_eel', st),
  garden_eel: (st) => buildSlenderFish('garden_eel', st),
  spotted_trumpetfish: (st) => buildSlenderFish('spotted_trumpetfish', st),
  mandarinfish: (st) => buildOrnamentalReef('mandarinfish', st),
  moorish_idol: (st) => buildOrnamentalReef('moorish_idol', st),
  sailfish: (st) => buildPelagicHero('sailfish', st),
  blue_marlin: (st) => buildPelagicHero('blue_marlin', st),
  yellowfin_tuna: (st) => buildPelagicHero('yellowfin_tuna', st),
  skipjack_tuna: (st) => buildPelagicHero('skipjack_tuna', st),
  silky_shark: (st) => buildRequiemShark('silky_shark', st),
  whitetip_reef_shark: (st) => buildRequiemShark('whitetip_reef_shark', st),
};

export const SPECIAL_KEYS = new Set(Object.keys(SPECIAL_BUILDERS));

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv.slice(2);
  const families = target.length ? target : Object.keys(SPECIAL_BUILDERS);
  let count = 0;
  for (const fam of families) {
    for (const key of [fam, `juv_${fam}`, `fry_${fam}`]) {
      const res = SPECIAL_BUILDERS[fam](stageOf(key));
      const { glb, tris } = await bake(key, res.m, {
        fins: res.fins,
        weight: res.weight,
        source: `galapagos-sculpted-special (${fam})`,
        atlas: 512,
        roughness: res.roughness ?? 0.52,
        compress: { webpQuality: 90 },
      });
      if (tris > 8000 || glb.length > 300000) throw new Error(`Budget ${key}: ${tris} tris, ${glb.length} bytes`);
      writeFileSync(resolve(GLB_DIR, `${key}.glb`), glb);
      count++;
      if (key === fam) console.log(`SPEC ${key}: ${tris} tris, ${(glb.length / 1024).toFixed(1)} KB`);
    }
  }
  console.log(`Built ${count} sculpted special Galápagos GLBs.`);
}
