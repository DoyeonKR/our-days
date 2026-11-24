// 황제펭귄 3D — 부위로 짓는다(2026-11-24 [사용자: "펭귄도 바다코끼리도 다 엉망이야 모델이 다시 제작해 디테일이 단 하나도 없어"])
// 비율은 사용자가 보낸 사진(서 있는 어른 · 새끼)을 눈으로 잰 값 — 그림 픽셀은 쓰지 않는다(저작권). 무늬는 3D 위치로 칠한다.
// 부위: 몸통(헤엄 자세 — 꼬리 → 통통한 몸 → 목 → 둥근 머리) · 부리(위 · 아래 두 쪽, 아랫부리에 주황 줄) · 눈 둘 · 날개 둘(납작한 노, 옆으로) ·
//       꼬리깃(뻣뻣한 쐐기) · 발 둘(꼬리 밑에 붙여 뒤로).
// node design/aqua3d-review/polar/penguin-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from './kit.mjs';

const STAGES = {
  emperor_penguin: {chick: false, juv: false, fat: 1, bill: 1.45, wing: 2.5},
  juv_emperor_penguin: {chick: false, juv: true, fat: 1, bill: 1.2, wing: 2.3},
  fry_emperor_penguin: {chick: true, juv: false, fat: 1.3, bill: .55, wing: 1.5},
};
// 몸 단면(x: 꼬리 -4.3 → 머리 앞 3.95). 새끼는 더 짧고 통통하다
const PROF = [[-4.3, .32, .3, .1], [-3.7, .78, .68, .02], [-2.5, 1.22, 1.1, -.06], [-1.0, 1.5, 1.34, -.1], [.4, 1.5, 1.34, -.08], [1.6, 1.28, 1.14, 0],
  [2.35, .98, .9, .12], [2.95, 1.0, .9, .2], [3.5, .8, .72, .22], [3.95, .42, .4, .22]];
const PROF_CHICK = [[-3.2, .4, .38, .06], [-2.6, 1.0, .92, 0], [-1.4, 1.45, 1.36, -.06], [0, 1.6, 1.5, -.06], [1.2, 1.42, 1.32, 0], [1.9, 1.15, 1.05, .1],
  [2.5, 1.12, 1.02, .2], [3.0, .9, .82, .22], [3.4, .44, .42, .22]];
const profOf = (T) => (x) => { let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++; const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t); return {a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k}; };

function build(key) {
  const st = STAGES[key], m = new Model(), T = st.chick ? PROF_CHICK : PROF, P = profOf(T), X0 = T[0][0], X1 = T[T.length - 1][0];
  const headX = st.chick ? 2.55 : 2.95, neckX = st.chick ? 1.9 : 2.35;
  const surf = (x, th, k = 1) => { const p = P(x); return [x, p.cy + Math.cos(th) * p.a * k, Math.sin(th) * p.b * k]; };
  const eyeX = st.chick ? 2.85 : 3.3, eyeC = [-1, 1].map((sd) => surf(eyeX, sd * 1.05, .96));
  const BLACK = st.juv ? [62, 66, 76] : [22, 26, 36], BACK = st.juv ? [92, 98, 110] : [48, 56, 70], HEAD = st.juv ? [44, 46, 52] : [12, 13, 17];

  // ── 몸통 ──
  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b}; },
    {ns: 52, nt: 28, capStart: .2, capEnd: .2, capRings: 4, capSpanStart: .03, capSpanEnd: .08, island: [0, 0, 1, .62], bone: 'body',
      sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < neckX ? (x - X0) / (neckX - X0) * .6 : .6 + (x - neckX) / (X1 - neckX) * .4; },
      paint: (p, n) => {
        const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / pr.a, side = Math.abs(z) / pr.b;
        const grain = .92 + .16 * fbm([x * 6, y * 6, z * 6], 3) + .06 * (noise(x * 40, y * 40, z * 40) - .5);
        if (st.chick) {
          // 새끼: 은회색 솜털, 검은 머리 · 흰 얼굴 가면(눈 둘레 · 뺨 · 턱)
          let c = mix([186, 189, 194], [150, 154, 160], smooth(-.4, .6, n[1]) * .5 + smooth(.4, -.8, yr) * .5);
          const head = smooth(headX - .55, headX - .2, x);
          c = mix(c, [18, 19, 24], head);
          const eyeY = (eyeC[0][1] - pr.cy) / pr.a, front = smooth(headX - .45, headX - .05, x);
          const mask = head * front * smooth(eyeY + .32, eyeY + .12, yr) * smooth(-.95, -.6, yr + (1 - side) * .0); c = mix(c, [242, 242, 238], mask);
          const throat = smooth(headX - .4, headX, x) * smooth(-.1, -.5, yr) * (1 - smooth(.6, .9, side)); c = mix(c, [238, 238, 234], throat);
          return c.map((v) => v * (.9 + .2 * noise(x * 26, y * 26, z * 26)));
        }
        // 어른 · 어린: 검은 등 · 흰 배. 옆 경계는 가슴에서 낮고(날개 자리) 뒤로 갈수록 올라간다
        const edge = -.05 - .18 * smooth(-2, .8, x) + .1 * smooth(1, 2.2, x) + .05 * Math.sin(x * 2.2);
        const white = smooth(edge + .07, edge - .07, yr) * (1 - smooth(neckX + .1, neckX + .45, x) * smooth(-.45, -.1, yr) * 0);
        let c = mix(mix(BLACK, BACK, smooth(.2, .9, n[1])), [240, 240, 236], white);
        c = mix(c, c.map((v) => v * .9), smooth(.3, -.9, yr) * white);           // 배 아래 그늘
        // 머리 · 목: 검정(어린 개체는 턱 · 목 앞이 희다)
        const head = smooth(neckX - .2, neckX + .25, x) * (st.juv ? smooth(-.35, .1, yr) : 1);
        c = mix(c, HEAD, head * (st.juv ? 1 : smooth(-1.1, -.55, yr) + (1 - smooth(-1.1, -.55, yr)) * smooth(neckX + .3, neckX + .55, x)));
        // 노란 귀 무늬: 눈 뒤 아래 옆면에서 목을 따라 가슴으로 흘러내리는 쉼표 + 가슴 위쪽 옅은 노랑
        if (!st.juv || true) {
          const ec = [headX - .35, P(headX - .35).cy - .42], dx = x - ec[0], dy = y - ec[1], ca = Math.cos(.85), sa = Math.sin(.85);
          const ear = smooth(1, .6, Math.hypot((dx * ca + dy * sa) / .95, (-dx * sa + dy * ca) / .3)) * smooth(.3, .7, side);
          const earCol = st.juv ? [232, 230, 220] : mix([246, 160, 40], [250, 210, 90], smooth(-.2, .4, dx * ca + dy * sa));
          c = mix(c, earCol, ear);
          if (!st.juv) { const chest = smooth(neckX - 1.6, neckX - .3, x) * (1 - smooth(neckX + .2, neckX + .5, x)) * smooth(-.2, -.6, yr) * smooth(1.05, .4, side); c = mix(c, [250, 224, 140], chest * .8); }
        }
        return c.map((v) => v * grain);
      }});

  // ── 부리(위 · 아래 두 쪽) ──
  const bx = X1 - .12, bp = P(X1 - .3), B = st.bill;
  for (const [nm, dy, lower] of [['billU', .03, false], ['billL', -.1, true]]) {
    m.sweep(nm, (s) => ({c: [bx + B * s, bp.cy + dy - .12 * B * s * s - (lower ? .03 * s : 0), 0], u: [0, 1, 0], v: [0, 0, 1], a: (lower ? .15 : .19) * (1 - .86 * s ** .8) * (st.chick ? 1.2 : 1), b: .21 * (1 - .84 * s ** .8) * (st.chick ? 1.2 : 1)}),
      {ns: 10, nt: 12, capEnd: .04, capRings: 2, island: lower ? [.15, .62, .3, .74] : [0, .62, .14, .74], bone: 'head',
        paint: (p, n, [s, t]) => {
          if (!lower || st.chick || st.juv) return [16, 16, 20];
          // 아랫부리 옆면의 주황 · 분홍 줄(뿌리 쪽이 넓다)
          const sideness = Math.abs(Math.sin(t * Math.PI * 2)); return mix([18, 18, 22], [236, 128, 92], smooth(.35, .75, sideness) * smooth(.85, .45, s));
        }});
  }
  // ── 눈 ──
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, st.chick ? .11 : .085, {island: [.31 + i * .05, .62, .35 + i * .05, .68], bone: 'head', paint: (p) => { const d = Math.hypot(p[0] - c[0] - .04, p[1] - c[1] - .04); return d < .02 ? [220, 220, 220] : [10, 10, 14]; }}));

  // ── 날개(납작한 노 — 옆으로 뻗어 뒤로 젖힌다. 윗면 검정 · 아랫면 흰색 · 흰 뒷가장자리) ──
  const fins = {}, wingX = st.chick ? .8 : 1.3;
  for (const sd of [-1, 1]) {
    const root = surf(wingX, sd * 1.5, .8), D = norm([-.6, -.22, sd * .78]), L = st.wing;
    let Wd = [1, .1, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0] + Wd[1] * D[1]))); const Nf = norm(cross(D, Wd));
    m.sweep('wing' + sd, (s) => ({c: add(root, D, L * s), u: Nf, v: Wd, a: .09 - .06 * s, b: (st.chick ? .38 : .48) * (1 - .55 * s ** 1.4) + .04, e: 2.4}),
      {ns: 12, nt: 14, capEnd: .12, capRings: 2, island: sd < 0 ? [.4, .62, .69, .8] : [.7, .62, .99, .8], bone: 'fin' + sd,
        paint: (p, n, [s, t]) => {
          if (st.chick) return [140, 144, 150].map((v) => v * (.9 + .2 * noise(p[0] * 20, p[1] * 20, p[2] * 20)));
          const upDir = Nf[1] >= 0 ? Nf : Nf.map((v) => -v), up = n[0] * upDir[0] + n[1] * upDir[1] + n[2] * upDir[2], trailing = -(n[0] * Wd[0] + n[1] * Wd[1] + n[2] * Wd[2]);
          const under = smooth(.1, -.3, up);
          let c = mix(BLACK, [236, 236, 232], under);
          c = mix(c, [236, 236, 232], smooth(.55, .9, trailing) * .9);
          return c.map((v) => v * (.92 + .14 * fbm([p[0] * 5, p[1] * 5, p[2] * 5], 3)));
        }});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
  }
  // ── 꼬리깃(뻣뻣한 쐐기) ──
  m.sweep('tail', (s) => ({c: [X0 + .15 - .9 * s, P(X0).cy + .02, 0], u: [0, 1, 0], v: [0, 0, 1], a: .1 * (1 - .7 * s), b: .3 * (1 - .75 * s)}),
    {ns: 6, nt: 10, capEnd: .05, capRings: 1, island: [.62, .8, .8, .9], bone: 'tail', paint: (p) => (st.chick ? [150, 152, 158] : BLACK).map((v) => v * (.9 + .2 * noise(p[0] * 30, 0, p[2] * 30)))});
  // ── 발(꼬리 밑, 뒤로) ──
  for (const sd of [-1, 1]) {
    const root = surf(X0 + .7, Math.PI - sd * .5, .85);
    m.sweep('foot' + sd, (s) => ({c: add(root, [-1, -.05, sd * .12], .75 * s), u: [0, 1, 0], v: [0, 0, 1], a: .07, b: .1 + .14 * s, e: 2.4}),
      {ns: 6, nt: 10, capEnd: .06, capRings: 1, island: sd < 0 ? [0, .8, .3, .9] : [.31, .8, .61, .9], bone: 'tail', paint: () => [54, 48, 52]});
  }
  return {m, fins};
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGES);
for (const key of keys) {
  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/polar/penguin-build.mjs', roughness: .55, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'tail') return [[5, 1]];
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .2, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
