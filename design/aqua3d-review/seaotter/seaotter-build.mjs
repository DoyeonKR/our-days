// 해달(Enhydra lutris) 3D — 부위로 짓는 입체 모델(2026-11-27)
// 옛 mammal-tube-build 판은 옆모습 그림을 원통에 감고 몸 밖을 세로 판으로 오려 붙여:
//   · 어린/새끼 이마에 V자 종이 판이 붙고
//   · 코끝이 납작한 검은 구멍처럼 보였으며
//   · 뒷발(물갈퀴발)과 꼬리가 세로 종이판 두 장으로 서고
//   · 앞발 · 귀 · 볼 · 수염 패드 입체가 전혀 없었다.
// polar/kit.mjs 로 몸통 · 목 · 둥근 머리 · 볼록한 수염 패드 · 하트형 검은 코 · 수염 · 눈 · 작은 귀 ·
// 짧은 앞발(손바닥) · 수평 물갈퀴 뒷발 · 두툼한 납작 꼬리를 각각 입체로 짓고,
// 기존 기준 그림(public/aqua/fish/{fry_,juv_,}sea_otter.webp)의 털빛 · 무늬 · 성장 단계를 3D 위치로 칠한다.
// node design/aqua3d-review/seaotter/seaotter-build.mjs [key...]
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from '../polar/kit.mjs';

const STAGE = {
  sea_otter:     {head: 1.00, muzzle: 1.00, body: 1.00, paw: 1.00, flipper: 1.00, tail: 1.00, pup: 0.0, juv: 0.0},
  juv_sea_otter: {head: 1.08, muzzle: 0.94, body: 0.94, paw: 0.95, flipper: 0.95, tail: 0.96, pup: 0.0, juv: 1.0},
  fry_sea_otter: {head: 1.24, muzzle: 0.80, body: 1.04, paw: 0.88, flipper: 0.86, tail: 0.84, pup: 1.0, juv: 0.0},
};

// 단면 [x, 반높이 a, 반폭 b, 중심 y] — 엉덩이(-X) → 몸통 → 목 → 둥근 머리 → 뭉툭한 주둥이(+X)
const PROF = [
  [-2.48, .26, .27,  .04],
  [-2.20, .54, .56,  .02],
  [-1.72, .74, .78,  .00],
  [-1.05, .86, .89, -.02],
  [-0.25, .88, .90, -.02],
  [ 0.55, .82, .84,  .01],
  [ 1.22, .69, .71,  .07],
  [ 1.68, .59, .62,  .15],
  [ 2.12, .64, .72,  .24],
  [ 2.54, .63, .73,  .25],
  [ 2.86, .52, .60,  .19],
  [ 3.12, .42, .49,  .12],
  [ 3.28, .31, .37,  .09],
];
const NECK = 1.68, SKULL = 2.12, EYE0 = 2.66;

function build(key) {
  const st = STAGE[key], m = new Model(), pup = st.pup, juv = st.juv;
  const remapX = (x) => (
    x <= NECK ? NECK + (x - NECK) * (1 - .10 * pup - .03 * juv)
      : x <= EYE0 ? NECK + (x - NECK) * (1 + (st.head - 1) * .52)
      : NECK + (EYE0 - NECK) * (1 + (st.head - 1) * .52) + (x - EYE0) * st.muzzle
  );
  const T = PROF.map(([x, a, b, cy]) => {
    const hk = smooth(NECK - .20, SKULL + .10, x);
    const sc = 1 + (st.head - 1) * hk * (1 - .32 * smooth(EYE0, 3.30, x));
    const bk = 1 + (st.body - 1) * (1 - hk);
    return [remapX(x), a * sc * bk, b * sc * bk, cy + (st.head - 1) * hk * .10];
  });
  const X0 = T[0][0], X1 = T[T.length - 1][0];
  const neckX = remapX(NECK), skullX = remapX(SKULL), eyeX = remapX(EYE0), noseX = X1 + .05 * st.muzzle;
  const P = (x) => {
    let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++;
    const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t);
    return {a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k};
  };
  const headK = (x) => smooth(neckX, skullX + .20, x);

  const hr = (x, th) => {
    const c = Math.cos(th), s = Math.sin(th), s2 = s * s, k = headK(x), body = 1 - k;
    const torso = 1 - .04 * Math.max(0, c) ** 4 + .03 * Math.max(0, -c) ** 2;
    const head = 1 - .05 * Math.max(0, c) ** 4 + .09 * Math.exp(-(((c + .20) / .38) ** 2)) * s2 - .04 * Math.max(0, -c - .55) * s2;
    const fluffAmp = (.024 + .038 * pup) * (1 - .52 * k);
    const shag = 1 + fluffAmp * (fbm([x * 4.4, c * 3.2, s * 3.2], 3) - .5) * 2;
    return (body * torso + k * head) * shag;
  };
  const surf = (x, th, kk = 1) => {
    const p = P(x), q = kk * hr(x, th);
    return [x, p.cy + Math.cos(th) * p.a * q, Math.sin(th) * p.b * q];
  };

  const BODY_ADULT = [60, 52, 46],  BELLY_ADULT = [82, 71, 62],  GUARD_ADULT = [122, 112, 102], HEAD_ADULT = [214, 206, 192], CHEEK_ADULT = [232, 226, 214];
  const BODY_JUV   = [98, 90, 82],  BELLY_JUV   = [124, 115, 104], GUARD_JUV = [154, 146, 136], HEAD_JUV   = [210, 205, 194], CHEEK_JUV   = [228, 224, 214];
  const BODY_PUP   = [184, 149, 100], BELLY_PUP = [206, 174, 124], GUARD_PUP = [226, 202, 158], HEAD_PUP   = [216, 186, 142], CHEEK_PUP   = [232, 208, 168];

  const BODY_DARK  = pup ? BODY_PUP  : juv ? BODY_JUV  : BODY_ADULT;
  const BELLY_COL  = pup ? BELLY_PUP : juv ? BELLY_JUV : BELLY_ADULT;
  const GUARD_COL  = pup ? GUARD_PUP : juv ? GUARD_JUV : GUARD_ADULT;
  const HEAD_LIGHT = pup ? HEAD_PUP  : juv ? HEAD_JUV  : HEAD_ADULT;
  const CHEEK_COL  = pup ? CHEEK_PUP : juv ? CHEEK_JUV : CHEEK_ADULT;
  const PAW_COL    = pup ? [116, 94, 70] : juv ? [64, 58, 52] : [44, 38, 35];
  const FLIP_COL   = pup ? [104, 84, 62] : juv ? [62, 56, 50] : [42, 37, 34];
  const NOSE_COL   = [26, 22, 23];

  const furCol = (p, n, baseOverride = null) => {
    const [x, y, z] = p;
    const pr = P(x), yr = (y - pr.cy) / (pr.a || 1);
    let c = baseOverride;
    if (!c) {
      const jitter = (fbm([x * 2.6, y * 3.0, z * 3.0], 3) - .5) * .42;
      const neckBlend = smooth(neckX - .55, skullX + .34, x + jitter - yr * .16);
      const torsoBase = mix(BODY_DARK, BELLY_COL, smooth(.25, -.75, yr) * .68);
      const headBase = mix(HEAD_LIGHT, CHEEK_COL, smooth(.35, -.55, yr) * .62);
      c = mix(torsoBase, headBase, neckBlend);
      const crownShade = smooth(.48, .96, yr) * smooth(neckX - .1, eyeX, x) * (pup ? .07 : .11);
      c = c.map((v) => v * (1 - crownShade));
      const guardMask = (1 - neckBlend) * smooth(-.1, .85, yr) * smooth(.42, .76, fbm([x * 2.2, y * 4.5, z * 4.5], 3));
      c = mix(c, GUARD_COL, guardMask * (pup ? .42 : .34));
      const mottle = (fbm([x * 1.2, y * 1.4, z * 1.4], 3) - .5) * .16;
      c = c.map((v) => v * (1 + mottle));
    }
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]), sw = ax + ay + az || 1;
    const fineScale = pup ? 20 : 28;
    const sSide = noise(y * fineScale, -x * 3.6 + z * 1.2, z * 2.0);
    const sTop  = noise(z * fineScale + 7, -x * 3.6, y * 2.0);
    const sFrnt = noise(z * fineScale + 3, y * fineScale * .65, x * 2.0);
    const strand = (sSide * az + sTop * ay + sFrnt * ax) / sw;
    const clump = fbm([x * 3.2, y * 6.8, z * 6.8], 3);
    const groove = smooth(.46, .26, clump);
    const contrast = pup ? .24 : .20;
    const lit = 1 + contrast * (strand - .5) + .14 * (clump - .5) - .12 * groove;
    return c.map((v) => clamp(v * lit, 0, 255));
  };

  const eyeR = .088 * (1 + (st.head - 1) * .78);
  const eyeC = [-1, 1].map((sd) => {
    const p = surf(eyeX + .06, sd * 1.06, .95);
    return [p[0] + .02, p[1] + .03, p[2]];
  });

  m.sweep('body', (s) => {
    const x = X0 + (X1 - X0) * s, p = P(x);
    return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => hr(x, th)};
  }, {
    ns: 40, nt: 24, capStart: .20, capEnd: .08, capRings: 3, capSpanStart: .03, capSpanEnd: .04,
    island: [0, 0, 1, .52], bone: 'body',
    sMap: (s) => {
      const x = X0 + (X1 - X0) * s;
      return x < skullX ? (x - X0) / (skullX - X0) * .56 : .56 + (x - skullX) / (X1 - skullX) * .44;
    },
    paint: (p, n) => {
      const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / (pr.a || 1);
      let c = furCol(p, n);
      for (const e of eyeC) {
        const d = Math.hypot(x - e[0], y - e[1], z - e[2]);
        c = mix(c, [30, 24, 21], smooth(eyeR * 2.05, eyeR * 1.02, d) * .84);
      }
      const bridge = smooth(eyeX + .05, X1 - .04, x) * smooth(.10, .70, yr) * smooth(.55, .12, Math.abs(z) / (pr.b || 1));
      c = mix(c, c.map((v) => v * .88), bridge * .42);
      return c;
    },
  });

  const mp = P(X1 - .06);
  const padCenters = [];
  for (const sd of [-1, 1]) {
    const pc = [X1 - .02, mp.cy - mp.a * .34, sd * (mp.b * .52)];
    padCenters.push({sd, c: pc});
    const pa = mp.a * .52, pb = mp.b * .56, pxLen = .26 * st.muzzle;
    m.sweep('wpad' + sd, (s) => {
      const k = Math.sin(Math.PI * clamp(.06 + s * .88)) ** .55;
      return {
        c: [pc[0] - pxLen * .55 + s * pxLen * 1.35, pc[1] - .02 * s, pc[2] * (.82 + .24 * s)],
        u: [0, 1, 0], v: [0, 0, 1], a: pa * k, b: pb * k, e: 2.1,
      };
    }, {
      ns: 8, nt: 12, capStart: .03, capEnd: .06, capRings: 2,
      island: sd < 0 ? [.52, .76, .66, .88] : [.66, .76, .80, .88], bone: 'head',
      paint: (p, n) => {
        let c = furCol(p, n, CHEEK_COL);
        const dots = smooth(.64, .76, noise(p[0] * 36, p[1] * 36, p[2] * 36));
        c = mix(c, c.map((v) => v * .72), dots * .45);
        return c;
      },
    });
  }

  m.sweep('chin', (s) => {
    const k = Math.sin(Math.PI * clamp(.08 + s * .84)) ** .6;
    return {
      c: [X1 - .20 + s * .34 * st.muzzle, mp.cy - mp.a * .76 + .05 * s, 0],
      u: [0, 1, 0], v: [0, 0, 1], a: mp.a * .34 * k, b: mp.b * .58 * k, e: 2.2,
    };
  }, {
    ns: 6, nt: 10, capStart: .02, capEnd: .05, capRings: 2,
    island: [.80, .76, .92, .88], bone: 'head',
    paint: (p, n) => {
      let c = furCol(p, n, CHEEK_COL.map((v) => v * .94));
      c = mix(c, [34, 27, 25], smooth(.45, .88, n[1]) * .78);
      return c;
    },
  });

  const np = P(X1);
  m.sweep('nose', (s) => {
    const k = Math.sin(Math.PI * clamp(.08 + s * .84)) ** .50;
    return {
      c: [noseX - .14 + .26 * s * st.muzzle, np.cy + np.a * .12 - .03 * s, 0],
      u: [0, 1, 0], v: [0, 0, 1],
      a: np.a * .50 * k, b: np.b * .64 * k, e: 2.3,
      r: (th) => 1 + .14 * Math.max(0, Math.cos(th)) - .18 * Math.max(0, -Math.cos(th)),
    };
  }, {
    ns: 7, nt: 12, capStart: .03, capEnd: .055, capRings: 2,
    island: [.92, .76, 1.0, .88], bone: 'head',
    paint: (p, n, [s]) => {
      const nost = smooth(.58, .86, s) * smooth(.09, .025, Math.abs(Math.abs(p[2]) - np.b * .26)) * smooth(.08, -.05, p[1] - (np.cy + np.a * .08));
      const grain = .90 + .16 * noise(p[0] * 48, p[1] * 48, p[2] * 48);
      const sheen = smooth(.65, .95, n[1]) * .18;
      let c = mix(NOSE_COL, [6, 5, 6], nost);
      c = mix(c, [66, 62, 66], sheen);
      return c.map((v) => clamp(v * grain, 0, 255));
    },
  });

  for (const {sd, c: pc} of padCenters) {
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 2; k++) {
        const base = [pc[0] + .02 + k * .045, pc[1] + (.035 - r * .042), pc[2] * .90];
        const len = (.30 + k * .06 + r * .02) * st.muzzle;
        const dir = norm([-.36 - k * .08, -.16 - r * .10, sd * (.90 + r * .04)]);
        const u = [0, 1, 0], v = norm(cross(dir, u)), u2 = norm(cross(v, dir));
        m.sweep(`wh_${sd}_${r}_${k}`, (s) => ({
          c: add(base, dir, len * s), u: u2, v,
          a: .012 * (1 - .74 * s), b: .012 * (1 - .74 * s),
        }), {
          ns: 2, nt: 4, capEnd: .005, capRings: 1,
          island: [.52, .88, .64, .99], bone: 'head',
          paint: (p, nn, [s]) => mix([238, 232, 218], [204, 196, 184], s),
        });
      }
    }
  }

  eyeC.forEach((c, i) => m.sphere('eye' + i, c, eyeR, {
    island: [.88 + i * .06, .88, .94 + i * .06, .99], bone: 'head',
    paint: (p) => {
      const hi = Math.hypot(p[1] - c[1] - eyeR * .34, p[0] - c[0] - eyeR * .30);
      return hi < eyeR * .24 ? [228, 226, 220] : [18, 12, 10];
    },
  }));

  for (const sd of [-1, 1]) {
    const base = surf(skullX + .14, sd * .96, .86);
    const out = norm([-.28, .48, sd * .82]);
    const face = norm([.94, .05, sd * .35]);
    const fv = norm(add(face, out, -(face[0] * out[0] + face[1] * out[1] + face[2] * out[2])));
    const side = norm(cross(out, fv));
    const er = .145 * (1 + .20 * pup);
    m.sweep('ear' + sd, (s) => ({
      c: add(base, out, er * 1.15 * s), u: side, v: fv,
      a: er * .86 * Math.sqrt(Math.max(.05, 1 - (s * .94) ** 2)),
      b: er * .42 * (1 - .38 * s),
    }), {
      ns: 6, nt: 10, capEnd: er * .12, capRings: 2,
      island: sd < 0 ? [.64, .88, .76, .99] : [.76, .88, .88, .99], bone: 'head',
      paint: (p, n) => {
        const inner = smooth(.15, .75, n[0] * fv[0] + n[1] * fv[1] + n[2] * fv[2]);
        return mix(furCol(p, n, HEAD_LIGHT.map((v) => v * .84)), [46, 38, 34], inner * .68);
      },
    });
  }

  const bez3 = (p0, p1, p2, p3, t) => p0.map((v, i) => (1 - t) ** 3 * v + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t ** 3 * p3[i]);
  const armMeta = {};
  const ARM_ISL = [[0, .52, .25, .76], [.25, .52, .50, .76]];
  for (const sd of [-1, 1]) {
    const shX = remapX(1.08), pr = P(shX), Lp = st.paw;
    const root  = [shX, pr.cy - pr.a * .08, sd * pr.b * .42];
    const elbow = [shX - .30 * Lp, pr.cy - pr.a * .82, sd * pr.b * .72];
    const wrist = [shX - .06 * Lp, pr.cy - pr.a * 1.14, sd * pr.b * .60];
    const paw   = [shX + .24 * Lp, pr.cy - pr.a * 1.16, sd * pr.b * .44];
    armMeta[sd > 0 ? 'R' : 'L'] = {root, tip: paw};
    m.sweep('arm' + sd, (s) => {
      const c = bez3(root, elbow, wrist, paw, s);
      const d = norm(add(bez3(root, elbow, wrist, paw, Math.min(1, s + .02)), bez3(root, elbow, wrist, paw, Math.max(0, s - .02)), -1));
      const v = norm([0, -.12, sd]), u = norm(cross(v, d)), v2 = norm(cross(d, u));
      const pawK = smooth(.70, .94, s);
      return {
        c, u, v: v2,
        a: (.33 - .13 * s - .04 * pawK) * Lp,
        b: (.29 - .06 * s + .07 * pawK) * Lp,
        e: 2.1,
        r: (th) => 1 + .05 * pawK * Math.cos(th * 4),
      };
    }, {
      ns: 11, nt: 10, capStart: .06, capEnd: .11 * Lp, capRings: 2,
      island: ARM_ISL[sd < 0 ? 0 : 1], bone: 'fin' + sd,
      paint: (p, n, [s]) => {
        let c = furCol(p, n, mix(BODY_DARK, PAW_COL, smooth(.45, .88, s)));
        const palm = smooth(.70, .92, s) * smooth(.1, -.55, n[1]);
        c = mix(c, [32, 27, 25], palm * .65);
        return c;
      },
    });
  }

  const HIND_ISL = [[.50, .52, .75, .76], [.75, .52, 1.0, .76]];
  for (const sd of [-1, 1]) {
    const hpX = remapX(-1.75), pr = P(hpX), Lf = st.flipper;
    const hip   = [hpX + .10, pr.cy - pr.a * .10, sd * pr.b * .34];
    const ankle = [hpX - .68 * Lf, pr.cy - pr.a * .28, sd * (pr.b * .48 + .08 * Lf)];
    const midF  = [hpX - 1.32 * Lf, pr.cy - pr.a * .34, sd * (pr.b * .54 + .12 * Lf)];
    const tipF  = [hpX - 1.88 * Lf, pr.cy - pr.a * .32, sd * (pr.b * .52 + .14 * Lf)];
    m.sweep('hflip' + sd, (s) => {
      const c = bez3(hip, ankle, midF, tipF, s);
      const d = norm(add(bez3(hip, ankle, midF, tipF, Math.min(1, s + .02)), bez3(hip, ankle, midF, tipF, Math.max(0, s - .02)), -1));
      const upRef = [0, 1, sd * .14];
      const v = norm(cross(d, upRef)), u = norm(cross(v, d));
      const web = smooth(.35, .86, s) * (1 - .22 * smooth(.88, 1.0, s));
      const thick = (.32 * (1 - .74 * smooth(.15, .70, s)) + .045) * Lf;
      const wide  = (.27 * (1 - .25 * smooth(.1, .45, s)) + .28 * web) * Lf;
      return {
        c, u, v, a: thick, b: wide, e: 2.3,
        r: (th) => 1 + .07 * web * Math.cos(th * 5) ** 2,
      };
    }, {
      ns: 12, nt: 14, capStart: .06, capEnd: .12 * Lf, capRings: 2,
      island: HIND_ISL[sd < 0 ? 0 : 1], bone: 'hind',
      paint: (p, n, [s, t]) => {
        const webK = smooth(.40, .82, s);
        let c = furCol(p, n, mix(BODY_DARK, FLIP_COL, webK));
        const toeRib = Math.abs(Math.sin((t - .5) * Math.PI * 5));
        c = mix(c, c.map((v) => v * .74), webK * smooth(.75, .98, toeRib) * .48);
        return c;
      },
    });
  }

  const tp = P(X0 + .35), Lt = st.tail;
  m.sweep('tail', (s) => {
    const x = X0 + .40 - 1.56 * Lt * s;
    const y = tp.cy + .10 + .06 * s - .04 * s * s;
    const taper = Math.max(.20, 1 - .70 * s ** 1.15);
    return {
      c: [x, y, 0], u: [0, 1, 0], v: [0, 0, 1],
      a: .24 * taper * Lt, b: .33 * taper * Lt, e: 2.1,
    };
  }, {
    ns: 11, nt: 12, capStart: .05, capEnd: .14 * Lt, capRings: 2,
    island: [0, .76, .52, .99], bone: 'tail',
    paint: (p, n) => furCol(p, n, BODY_DARK),
  });

  return {m, fins: {L: armMeta.L, R: armMeta.R}};
}

export const KEYS = ['fry_sea_otter', 'juv_sea_otter', 'sea_otter'];
const keys = process.argv.slice(2).length ? process.argv.slice(2) : KEYS;

await mkdir('design/aqua3d-review/seaotter/old', {recursive: true});
for (const key of keys) {
  try { await readFile(`design/aqua3d-review/seaotter/old/${key}.glb`); }
  catch { await writeFile(`design/aqua3d-review/seaotter/old/${key}.glb`, await readFile(`public/aqua/models/fish/${key}.glb`)); }

  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {
    fins,
    source: 'design/aqua3d-review/seaotter/seaotter-build.mjs — part-built Enhydra lutris matching public/aqua/fish/*sea_otter.webp',
    roughness: .84,
    weight: (part, g, [s]) => {
      if (part.bone === 'head') return [[0, 1]];
      if (part.bone === 'tail') return [[4, .35 * (1 - s)], [5, .65 + .35 * s]];
      if (part.bone === 'hind') return [[4, .55 * (1 - s) + .1], [5, .45 * (1 - s) + .9 * s - .1 * s]].map(([b, w]) => [b, Math.max(0, w)]);
      if (part.bone === 'fin1' || part.bone === 'fin-1') {
        const root = part.bone === 'fin1' ? 8 : 6, k = smooth(0, .22, s);
        return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]];
      }
      return spineWeight(g[0]);
    },
  });
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb);
  console.log(key, tris, 'tris', glb.length, 'bytes');
}
