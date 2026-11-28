// 해양 포유류 5계열(15폼) 입체 재제작(2026-11-27) — 점박이물범 · 물개 · 큰바다사자 · 독도 강치 · 수달
// 옛 mammal-tube-build.mjs 판(납작한 코 · 세로 종이판 뒷발/꼬리 · 입체 없는 얼굴)을 polar/kit.mjs 부위별 입체 모델로 교체.
// 기존 GLB는 design/aqua3d-review/mammals/old/ 에 자동 백업.
// node design/aqua3d-review/mammals/mammals-part-build.mjs [key...]
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from '../polar/kit.mjs';

const bez3 = (p0, p1, p2, p3, t) => p0.map((v, i) => (1 - t) ** 3 * v + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t ** 3 * p3[i]);

const SPEC = {
  spotted_seal: {
    kind: 'phocid',
    ears: false, crest: 0, mane: 0, spots: true, longTail: false,
    prof: [
      [-2.50, .20, .21, .02], [-2.10, .44, .48, .01], [-1.50, .68, .74, .00],
      [-0.70, .82, .88, -.01], [0.10, .84, .88, .00], [0.85, .74, .78, .03],
      [1.48, .58, .62, .08], [1.98, .54, .58, .12], [2.42, .48, .50, .10],
      [2.80, .34, .36, .06], [3.04, .22, .24, .04],
    ],
    finLen: 0.92, finW: 0.34, hindLen: 1.55, hindSpread: 0.42,
    col: {
      adult: {back: [132, 138, 142], belly: [196, 198, 194], fin: [92, 96, 100], spot: [42, 46, 50]},
      juv:   {back: [152, 156, 158], belly: [210, 212, 208], fin: [108, 112, 116], spot: [58, 62, 66]},
      fry:   {back: [224, 222, 214], belly: [236, 234, 228], fin: [148, 146, 142], spot: [170, 168, 162]},
    },
  },
  fur_seal: {
    kind: 'otariid',
    ears: true, crest: 0, mane: 0.08, spots: false, longTail: false,
    prof: [
      [-2.50, .18, .19, .02], [-2.00, .38, .40, .01], [-1.30, .58, .60, .00],
      [-0.40, .70, .72, .00], [0.45, .74, .74, .03], [1.18, .68, .66, .08],
      [1.76, .56, .54, .14], [2.26, .48, .48, .18], [2.66, .38, .38, .14],
      [2.98, .26, .26, .10], [3.20, .18, .18, .08],
    ],
    finLen: 1.95, finW: 0.42, hindLen: 1.55, hindSpread: 0.38,
    col: {
      adult: {back: [76, 68, 62], belly: [134, 122, 106], fin: [50, 46, 44], chest: [164, 152, 134]},
      juv:   {back: [90, 82, 74], belly: [148, 136, 118], fin: [58, 54, 52], chest: [176, 164, 144]},
      fry:   {back: [52, 48, 46], belly: [78, 72, 68], fin: [38, 36, 36], chest: [96, 88, 82]},
    },
  },
  steller_sea_lion: {
    kind: 'otariid',
    ears: true, crest: 0.04, mane: 0.16, spots: false, longTail: false,
    prof: [
      [-2.50, .20, .21, .02], [-1.98, .40, .42, .01], [-1.22, .62, .64, .00],
      [-0.30, .76, .78, .01], [0.55, .86, .84, .06], [1.28, .82, .78, .13],
      [1.86, .70, .66, .18], [2.34, .56, .54, .19], [2.72, .42, .42, .15],
      [3.04, .30, .30, .11], [3.26, .20, .21, .09],
    ],
    finLen: 2.05, finW: 0.46, hindLen: 1.62, hindSpread: 0.40,
    col: {
      adult: {back: [172, 142, 98], belly: [138, 110, 74], fin: [62, 54, 50], chest: [188, 160, 114]},
      juv:   {back: [154, 126, 86], belly: [126, 100, 68], fin: [58, 50, 46], chest: [170, 142, 102]},
      fry:   {back: [82, 66, 52], belly: [96, 78, 62], fin: [46, 40, 38], chest: [108, 88, 70]},
    },
  },
  japanese_sea_lion: {
    kind: 'otariid',
    ears: true, crest: 0.22, mane: 0.10, spots: false, longTail: false,
    prof: [
      [-2.50, .19, .20, .02], [-1.98, .39, .41, .01], [-1.22, .60, .62, .00],
      [-0.32, .74, .76, .01], [0.52, .80, .78, .05], [1.24, .74, .70, .11],
      [1.82, .62, .58, .17], [2.28, .56, .52, .22], [2.66, .42, .42, .16],
      [3.00, .28, .28, .11], [3.22, .19, .20, .09],
    ],
    finLen: 2.00, finW: 0.44, hindLen: 1.58, hindSpread: 0.40,
    col: {
      adult: {back: [88, 82, 76], belly: [118, 104, 88], fin: [52, 48, 46], chest: [132, 116, 98]},
      juv:   {back: [104, 96, 88], belly: [136, 122, 104], fin: [60, 56, 54], chest: [148, 132, 112]},
      fry:   {back: [68, 62, 58], belly: [88, 78, 70], fin: [44, 42, 40], chest: [98, 88, 78]},
    },
  },
  otter: {
    kind: 'mustelid',
    ears: true, crest: 0, mane: 0, spots: false, longTail: true,
    prof: [
      [-2.30, .26, .28, .02], [-1.80, .44, .48, .01], [-1.10, .54, .58, .00],
      [-0.25, .58, .62, -.01], [0.60, .56, .60, .01], [1.30, .50, .54, .04],
      [1.84, .44, .48, .08], [2.30, .42, .50, .10], [2.70, .36, .44, .08],
      [3.00, .27, .34, .05], [3.20, .19, .24, .04],
    ],
    finLen: 1.05, finW: 0.24, hindLen: 1.25, hindSpread: 0.34,
    col: {
      adult: {back: [92, 76, 62], belly: [206, 198, 182], fin: [68, 56, 46], chest: [222, 214, 198]},
      juv:   {back: [104, 88, 72], belly: [212, 204, 188], fin: [76, 64, 54], chest: [226, 218, 202]},
      fry:   {back: [122, 104, 86], belly: [218, 210, 194], fin: [88, 74, 62], chest: [230, 222, 206]},
    },
  },
};

const STAGE = {
  adult: {head: 1.00, muzzle: 1.00, body: 1.00, limb: 1.00, crest: 1.0, pup: 0.0},
  juv:   {head: 1.08, muzzle: 0.94, body: 0.95, limb: 0.96, crest: 0.45, pup: 0.0},
  fry:   {head: 1.22, muzzle: 0.84, body: 1.04, limb: 0.90, crest: 0.0, pup: 1.0},
};

function build(fam, stageName) {
  const sp = SPEC[fam], st = STAGE[stageName], col = sp.col[stageName], m = new Model();
  const NECK = 1.65, SKULL = 2.20, EYE0 = 2.55;
  const remapX = (x) => (
    x <= NECK ? NECK + (x - NECK) * (1 - 0.08 * st.pup)
      : x <= EYE0 ? NECK + (x - NECK) * (1 + (st.head - 1) * 0.48)
      : NECK + (EYE0 - NECK) * (1 + (st.head - 1) * 0.48) + (x - EYE0) * st.muzzle
  );
  const T = sp.prof.map(([x, a, b, cy]) => {
    const hk = smooth(NECK - 0.2, SKULL + 0.1, x);
    const sc = 1 + (st.head - 1) * hk * (1 - 0.28 * smooth(EYE0, 3.25, x));
    const bk = 1 + (st.body - 1) * (1 - hk);
    const crestBump = sp.crest * st.crest * Math.exp(-(((x - 2.22) / 0.28) ** 2));
    return [remapX(x), a * sc * bk + crestBump * 0.55, b * sc * bk, cy + (st.head - 1) * hk * 0.06 + crestBump * 0.45];
  });
  const X0 = T[0][0], X1 = T[T.length - 1][0];
  const neckX = remapX(NECK), skullX = remapX(SKULL), eyeX = remapX(EYE0), noseX = X1 + 0.04 * st.muzzle;
  const P = (x) => {
    let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++;
    const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t);
    return {a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k};
  };
  const hr = (x, th) => {
    const c = Math.cos(th), s = Math.sin(th), k = smooth(neckX, skullX + 0.2, x);
    const mane = sp.mane * (1 - st.pup) * Math.exp(-(((x - remapX(1.25)) / 0.65) ** 2)) * (0.6 + 0.4 * Math.max(0, c));
    const headFlat = sp.kind === 'mustelid' ? -0.10 * k * Math.max(0, c) ** 2 : 0;
    const shag = 1 + (0.016 + 0.025 * st.pup + mane * 0.14) * (fbm([x * 4.6, c * 3.2, s * 3.2], 3) - 0.5) * 2;
    return (1 + mane + headFlat - 0.03 * Math.max(0, c) ** 4) * shag;
  };
  const surf = (x, th, kk = 1) => {
    const p = P(x), q = kk * hr(x, th);
    return [x, p.cy + Math.cos(th) * p.a * q, Math.sin(th) * p.b * q];
  };

  const furCol = (p, n, baseOverride = null) => {
    const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / (pr.a || 1);
    let c = baseOverride;
    if (!c) {
      const bellyMix = sp.kind === 'mustelid'
        ? smooth(0.05, -0.55, yr) * (0.65 + 0.35 * smooth(0.4, 2.2, x))
        : smooth(0.25, -0.75, yr) * 0.72;
      c = mix(col.back, col.belly, bellyMix);
      if (col.chest && sp.kind === 'otariid') {
        const ch = smooth(0.1, 1.4, x) * smooth(2.6, 1.7, x) * smooth(0.15, -0.75, yr);
        c = mix(c, col.chest, ch * 0.58);
      }
      if (sp.spots) {
        const s1 = fbm([x * 4.2, y * 5.2, z * 5.2], 2);
        const s2 = noise(x * 7.8 + 3, y * 9.2, z * 9.2);
        const dot = smooth(0.62, 0.74, s1 * 0.55 + s2 * 0.45) * (1 - 0.45 * smooth(-0.2, -0.85, yr));
        c = mix(c, col.spot, dot * (st.pup ? 0.22 : 0.85));
      }
      const mottle = (fbm([x * 1.4, y * 1.8, z * 1.8], 3) - 0.5) * 0.14;
      c = c.map((v) => v * (1 + mottle));
    }
    const fine = 26, strand = noise(y * fine, -x * 3.8 + z * 1.4, z * 2.2);
    const clump = fbm([x * 3.2, y * 6.4, z * 6.4], 3);
    const lit = 1 + 0.18 * (strand - 0.5) + 0.12 * (clump - 0.5);
    return c.map((v) => clamp(v * lit, 0, 255));
  };

  const eyeR = (sp.kind === 'mustelid' ? 0.068 : 0.075) * (1 + (st.head - 1) * 0.65);
  const eyeC = [-1, 1].map((sd) => {
    const p = surf(eyeX + 0.02, sd * 1.05, 0.90);
    return [p[0], p[1] + 0.02, p[2]];
  });

  // 1. 몸통 + 목 + 머리
  m.sweep('body', (s) => {
    const x = X0 + (X1 - X0) * s, p = P(x);
    return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => hr(x, th)};
  }, {
    ns: 38, nt: 22, capStart: 0.18, capEnd: 0.08, capRings: 3, capSpanStart: 0.03, capSpanEnd: 0.04,
    island: [0, 0, 1, 0.50], bone: 'body',
    paint: (p, n) => {
      let c = furCol(p, n);
      for (const e of eyeC) {
        const d = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]);
        c = mix(c, [22, 18, 16], smooth(eyeR * 1.85, eyeR * 0.95, d) * 0.72);
      }
      return c;
    },
  });

  // 2. 수염 패드(좌/우) + 턱 + 검은 코 + 수염
  const mp = P(X1 - 0.06);
  const padCenters = [];
  for (const sd of [-1, 1]) {
    const pc = [X1 - 0.04, mp.cy - mp.a * 0.28, sd * mp.b * 0.46];
    padCenters.push({sd, c: pc});
    const pa = mp.a * 0.46, pb = mp.b * 0.50, pxLen = 0.22 * st.muzzle;
    m.sweep('wpad' + sd, (s) => {
      const k = Math.sin(Math.PI * clamp(0.08 + s * 0.84)) ** 0.55;
      return {c: [pc[0] - pxLen * 0.5 + s * pxLen * 1.25, pc[1] - 0.01 * s, pc[2] * (0.80 + 0.22 * s)], u: [0, 1, 0], v: [0, 0, 1], a: pa * k, b: pb * k, e: 2.1};
    }, {
      ns: 6, nt: 10, capStart: 0.02, capEnd: 0.04, capRings: 2,
      island: sd < 0 ? [0.52, 0.76, 0.66, 0.88] : [0.66, 0.76, 0.80, 0.88], bone: 'head',
      paint: (p, n) => furCol(p, n, sp.kind === 'mustelid' ? col.chest : col.belly),
    });
  }
  const np = P(X1);
  m.sweep('nose', (s) => {
    const k = Math.sin(Math.PI * clamp(0.08 + s * 0.84)) ** 0.52;
    return {
      c: [noseX - 0.12 + 0.22 * s * st.muzzle, np.cy + np.a * 0.12 - 0.02 * s, 0],
      u: [0, 1, 0], v: [0, 0, 1], a: np.a * 0.48 * k, b: np.b * 0.58 * k, e: 2.2,
    };
  }, {
    ns: 6, nt: 10, capStart: 0.02, capEnd: 0.04, capRings: 2,
    island: [0.88, 0.76, 1.0, 0.88], bone: 'head',
    paint: (p, n) => mix([24, 21, 22], [60, 58, 62], smooth(0.65, 0.95, n[1]) * 0.22),
  });

  // 수염(좌우 4가닥씩 — 뿌리를 패드 안쪽에 묻음)
  for (const {sd, c: pc} of padCenters) {
    for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
      const base = [pc[0] - 0.02 + k * 0.04, pc[1] + (0.02 - r * 0.04), pc[2] * 0.78];
      const len = (0.26 + k * 0.05) * st.muzzle;
      const dir = norm([-0.42 - k * 0.08, -0.14 - r * 0.10, sd * 0.88]);
      const u = [0, 1, 0], v = norm(cross(dir, u)), u2 = norm(cross(v, dir));
      m.sweep(`wh_${sd}_${r}_${k}`, (s) => ({c: add(base, dir, len * s), u: u2, v, a: 0.011 * (1 - 0.72 * s), b: 0.011 * (1 - 0.72 * s)}), {
        ns: 2, nt: 4, capEnd: 0.004, capRings: 1, island: [0.52, 0.88, 0.64, 0.99], bone: 'head',
        paint: (p, nn, [s]) => mix([225, 220, 210], [185, 180, 172], s),
      });
    }
  }

  // 눈 (머리에 반쯤 묻음)
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, eyeR, {
    island: [0.88 + i * 0.06, 0.88, 0.94 + i * 0.06, 0.99], bone: 'head',
    paint: (p) => Math.hypot(p[1] - c[1] - eyeR * 0.34, p[0] - c[0] - eyeR * 0.28) < eyeR * 0.24 ? [228, 226, 222] : [16, 12, 10],
  }));

  // 작은 귓바퀴(물개 · 바다사자 · 강치 · 수달)
  if (sp.ears) {
    for (const sd of [-1, 1]) {
      const base = surf(skullX - 0.06, sd * 1.02, 0.78);
      const out = norm([-0.55, sp.kind === 'mustelid' ? 0.35 : 0.18, sd * 0.78]);
      const u = [0, 1, 0], v = norm(cross(out, u)), u2 = norm(cross(v, out));
      const er = sp.kind === 'mustelid' ? 0.095 : 0.075;
      m.sweep('ear' + sd, (s) => ({
        c: add(base, out, er * 1.55 * s), u: u2, v,
        a: er * 0.65 * (1 - 0.55 * s), b: er * 0.38 * (1 - 0.50 * s),
      }), {
        ns: 4, nt: 8, capEnd: er * 0.14, capRings: 1,
        island: sd < 0 ? [0.64, 0.88, 0.76, 0.99] : [0.76, 0.88, 0.88, 0.99], bone: 'head',
        paint: (p, n) => furCol(p, n, col.back.map((v) => v * 0.85)),
      });
    }
  }

  // 3. 앞지느러미 / 앞발 (fin_L · fin_R — 뿌리를 몸통 안쪽 깊이 묻고 spine_1 과 블렌딩)
  const armMeta = {};
  const ARM_ISL = [[0, 0.50, 0.25, 0.74], [0.25, 0.50, 0.50, 0.74]];
  for (const sd of [-1, 1]) {
    const shX = remapX(sp.kind === 'mustelid' ? 0.95 : 0.65), pr = P(shX), Lf = sp.finLen * st.limb;
    const root = [shX, pr.cy - pr.a * 0.18, sd * pr.b * 0.42];
    let p1, p2, tip;
    if (sp.kind === 'otariid') {
      // 기각류: 길고 넓은 날개형 앞지느러미
      p1  = [shX - 0.18 * Lf, pr.cy - pr.a * 0.55, sd * (pr.b * 0.78 + 0.28 * Lf)];
      p2  = [shX - 0.58 * Lf, pr.cy - pr.a * 0.78, sd * (pr.b * 0.85 + 0.58 * Lf)];
      tip = [shX - 0.96 * Lf, pr.cy - pr.a * 0.82, sd * (pr.b * 0.72 + 0.76 * Lf)];
    } else if (sp.kind === 'phocid') {
      // 물범: 짧은 앞지느러미
      p1  = [shX - 0.18 * Lf, pr.cy - pr.a * 0.46, sd * (pr.b * 0.75 + 0.18 * Lf)];
      p2  = [shX - 0.46 * Lf, pr.cy - pr.a * 0.64, sd * (pr.b * 0.80 + 0.34 * Lf)];
      tip = [shX - 0.76 * Lf, pr.cy - pr.a * 0.68, sd * (pr.b * 0.72 + 0.42 * Lf)];
    } else {
      // 수달: 짧은 물갈퀴 앞발
      p1  = [shX - 0.15 * Lf, pr.cy - pr.a * 0.68, sd * (pr.b * 0.72 + 0.10 * Lf)];
      p2  = [shX - 0.36 * Lf, pr.cy - pr.a * 0.95, sd * (pr.b * 0.70 + 0.16 * Lf)];
      tip = [shX - 0.60 * Lf, pr.cy - pr.a * 0.98, sd * (pr.b * 0.62 + 0.20 * Lf)];
    }
    armMeta[sd > 0 ? 'R' : 'L'] = {root, tip};
    m.sweep('arm' + sd, (s) => {
      const c = bez3(root, p1, p2, tip, s);
      const d = norm(add(bez3(root, p1, p2, tip, Math.min(1, s + 0.02)), bez3(root, p1, p2, tip, Math.max(0, s - 0.02)), -1));
      const upRef = [0, 1, sd * 0.22], v = norm(cross(d, upRef)), u = norm(cross(v, d));
      const flat = sp.kind === 'otariid' ? 0.18 : 0.24;
      const w = sp.finW * st.limb * (0.72 + 0.42 * Math.sin(Math.PI * clamp(s * 0.95)) - 0.45 * s ** 1.6);
      const h = w * (flat + 0.45 * (1 - smooth(0, 0.35, s)));
      return {c, u, v, a: Math.max(0.03, h), b: Math.max(0.05, w), e: 2.2};
    }, {
      ns: 10, nt: 12, capStart: 0.06, capEnd: 0.09, capRings: 2,
      island: ARM_ISL[sd < 0 ? 0 : 1], bone: 'fin' + sd,
      paint: (p, n, [s]) => furCol(p, n, mix(col.back, col.fin, smooth(0.25, 0.75, s))),
    });
  }

  // 4. 뒷지느러미 / 뒷발 (몸통 꼬리 쪽 뿌리에 묻음)
  const HIND_ISL = [[0.50, 0.50, 0.75, 0.74], [0.75, 0.50, 1.0, 0.74]];
  for (const sd of [-1, 1]) {
    const hpX = remapX(sp.kind === 'mustelid' ? -1.45 : -1.95), pr = P(hpX), Lh = sp.hindLen * st.limb;
    const hip   = [hpX + 0.16, pr.cy - pr.a * 0.10, sd * pr.b * 0.32];
    const mid   = sp.kind === 'mustelid'
      ? [hpX - 0.45 * Lh, pr.cy - pr.a * 0.65, sd * (pr.b * 0.65 + 0.16 * Lh)]
      : [hpX - 0.55 * Lh, pr.cy + (sd > 0 ? 0.04 : -0.04), sd * (pr.b * 0.45 + sp.hindSpread * 0.55 * Lh)];
    const mid2  = sp.kind === 'mustelid'
      ? [hpX - 0.82 * Lh, pr.cy - pr.a * 0.85, sd * (pr.b * 0.68 + 0.24 * Lh)]
      : [hpX - 1.05 * Lh, pr.cy + (sd > 0 ? 0.05 : -0.05), sd * (pr.b * 0.42 + sp.hindSpread * 0.88 * Lh)];
    const tipF  = sp.kind === 'mustelid'
      ? [hpX - 1.15 * Lh, pr.cy - pr.a * 0.88, sd * (pr.b * 0.62 + 0.30 * Lh)]
      : [hpX - 1.50 * Lh, pr.cy + (sd > 0 ? 0.06 : -0.06), sd * (pr.b * 0.38 + sp.hindSpread * Lh)];
    m.sweep('hflip' + sd, (s) => {
      const c = bez3(hip, mid, mid2, tipF, s);
      const d = norm(add(bez3(hip, mid, mid2, tipF, Math.min(1, s + 0.02)), bez3(hip, mid, mid2, tipF, Math.max(0, s - 0.02)), -1));
      const upRef = sp.kind === 'phocid' ? [0, 0.35, sd * 0.94] : [0, 1, sd * 0.15];
      const v = norm(cross(d, upRef)), u = norm(cross(v, d));
      const web = smooth(0.32, 0.85, s) * (1 - 0.18 * smooth(0.88, 1.0, s));
      const thick = (0.24 * (1 - 0.72 * smooth(0.15, 0.68, s)) + 0.036) * st.limb;
      const wide  = (0.22 * (1 - 0.20 * smooth(0.1, 0.4, s)) + 0.28 * web) * st.limb;
      return {c, u, v, a: thick, b: wide, e: 2.2, r: (th) => 1 + 0.06 * web * Math.cos(th * 5) ** 2};
    }, {
      ns: 10, nt: 12, capStart: 0.05, capEnd: 0.09, capRings: 2,
      island: HIND_ISL[sd < 0 ? 0 : 1], bone: 'hind',
      paint: (p, n, [s, t]) => {
        const webK = smooth(0.35, 0.80, s);
        let c = furCol(p, n, mix(col.back, col.fin, webK));
        const rib = Math.abs(Math.sin((t - 0.5) * Math.PI * 5));
        return mix(c, c.map((v) => v * 0.76), webK * smooth(0.75, 0.98, rib) * 0.42);
      },
    });
  }

  // 5. 꼬리 (수달은 길고 굵은 원뿔형, 기각류/물범은 짧은 꼬리)
  const tp = P(X0 + 0.28);
  const tLen = sp.longTail ? 2.15 : 0.48;
  m.sweep('tail', (s) => {
    const x = X0 + 0.32 - tLen * s;
    const y = tp.cy + (sp.longTail ? -0.06 * s - 0.04 * s * s : 0.04 * s);
    const taper = Math.max(0.14, 1 - 0.82 * s ** 1.1);
    return {c: [x, y, 0], u: [0, 1, 0], v: [0, 0, 1], a: (sp.longTail ? 0.26 : 0.14) * taper, b: (sp.longTail ? 0.28 : 0.15) * taper, e: 2.0};
  }, {
    ns: sp.longTail ? 12 : 5, nt: 10, capStart: 0.04, capEnd: 0.08, capRings: 2,
    island: [0, 0.74, 0.50, 0.99], bone: 'tail',
    paint: (p, n) => furCol(p, n, col.back),
  });

  return {m, fins: {L: armMeta.L, R: armMeta.R}};
}

const FAMS = ['spotted_seal', 'fur_seal', 'steller_sea_lion', 'japanese_sea_lion', 'otter'];
export const KEYS = FAMS.flatMap((f) => [`fry_${f}`, `juv_${f}`, f]);
const req = process.argv.slice(2).length ? process.argv.slice(2) : KEYS;

await mkdir('design/aqua3d-review/mammals/old', {recursive: true});
for (const key of req) {
  const stageName = key.startsWith('fry_') ? 'fry' : key.startsWith('juv_') ? 'juv' : 'adult';
  const fam = key.replace(/^(fry|juv)_/, '');
  if (!SPEC[fam]) throw Error(`Unknown mammal family: ${key}`);
  try { await readFile(`design/aqua3d-review/mammals/old/${key}.glb`); }
  catch { await writeFile(`design/aqua3d-review/mammals/old/${key}.glb`, await readFile(`public/aqua/models/fish/${key}.glb`)); }

  const {m, fins} = build(fam, stageName);
  const {glb, tris} = await bake(key, m, {
    fins,
    source: `design/aqua3d-review/mammals/mammals-part-build.mjs — part-built ${fam}`,
    roughness: 0.78,
    weight: (part, g, [s]) => {
      if (part.bone === 'head') return [[0, 1]];
      if (part.bone === 'tail') return [[4, 0.35 * (1 - s)], [5, 0.65 + 0.35 * s]];
      if (part.bone === 'hind') return [[4, Math.max(0, 0.55 * (1 - s) + 0.1)], [5, Math.max(0, 0.45 * (1 - s) + 0.8 * s)]];
      if (part.bone === 'fin1' || part.bone === 'fin-1') {
        const root = part.bone === 'fin1' ? 8 : 6, k = smooth(0, 0.25, s);
        return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]];
      }
      return spineWeight(g[0]);
    },
  });
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb);
  console.log(key.padEnd(22), tris, 'tris', glb.length, 'bytes');
}
