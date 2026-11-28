// 남극 펭귄 셋 3D — 젠투 · 턱끈 · 아델리(2026-11-25 [사용자: "남극기지 낚시터에 … 10종" → "다 완벽하게 진행해줘"])
// 황제펭귄(penguin-build.mjs)과 같은 부위 짓기 — 몸통 · 위아래 부리 · 눈 · 날개 · 꼬리깃 · 발. 비율 · 무늬는 종마다 실제 생김새(도감 기술)를 눈으로 잡은 값이고
// 그림 픽셀은 쓰지 않는다. 무늬는 3D 위치로 칠한다(몸에 붙는다).
//  · 젠투: 주황빨강 부리(윗부리 등줄만 검다) · 눈 위 흰 삼각 무늬가 정수리 흰 띠로 이어진다 · 흰 눈테 · 주황 발 · 긴 꼬리
//  · 턱끈: 검은 모자 · 흰 얼굴과 턱 · 귀에서 귀로 턱 밑을 지나는 가는 검은 끈 · 검은 부리 · 분홍 발
//  · 아델리: 머리 전체 검정 · 또렷한 흰 눈테 · 짧은 부리(밑동 절반은 깃털이 덮는다) · 분홍 발. 어린 개체는 턱이 희고 눈테가 없다
// node design/aqua3d-review/polar/penguins-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from './kit.mjs';

const SPECIES = {gentoo_penguin: 'gentoo', chinstrap_penguin: 'chinstrap', adelie_penguin: 'adelie'};
const STAGE = (key) => (key.startsWith('fry_') ? 'chick' : key.startsWith('juv_') ? 'juv' : 'adult');
const famOf = (key) => key.replace(/^(fry|juv)_/, '');
// 부리 길이 · 굵기 · 날개 길이 · 꼬리 길이
const SHAPE = {
  gentoo: {bill: 1.05, billR: 1.05, wing: 2.15, tail: 1.25, head: 1.04},
  chinstrap: {bill: .92, billR: .9, wing: 2.1, tail: .95, head: 1.0},
  adelie: {bill: .7, billR: 1.0, wing: 2.05, tail: 1.05, head: 1.06},
};
// 몸 단면(x: 꼬리 → 머리 앞). 2026-11-25 2판 — 사진(NOAA · USAP · CC0, reference/SOURCES.md)과 견줘 머리를 줄이고(몸 굵기의 0.62) 목을 잘록하게
const PROF = [[-3.9, .3, .28, .1], [-3.3, .74, .66, .02], [-2.2, 1.18, 1.08, -.06], [-.8, 1.46, 1.32, -.1], [.5, 1.44, 1.3, -.08], [1.55, 1.22, 1.1, 0],
  [2.2, .94, .86, .1], [2.75, .82, .74, .18], [3.3, .6, .53, .26], [3.75, .3, .27, .3]];
const PROF_CHICK = [[-3.0, .42, .4, .06], [-2.4, 1.02, .94, 0], [-1.2, 1.46, 1.38, -.06], [.1, 1.6, 1.5, -.06], [1.2, 1.4, 1.3, 0], [1.85, 1.16, 1.06, .1],
  [2.45, 1.0, .92, .2], [2.95, .82, .76, .22], [3.35, .42, .4, .22]];
const profOf = (T, hk) => (x) => { let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++; const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t), h = smooth(T[T.length - 4][0], T[T.length - 3][0], x) * (hk - 1) + 1; return {a: (A[1] + (B[1] - A[1]) * k) * h, b: (A[2] + (B[2] - A[2]) * k) * h, cy: A[3] + (B[3] - A[3]) * k}; };

function build(key) {
  const sp = SPECIES[famOf(key)], stage = STAGE(key), chick = stage === 'chick', juv = stage === 'juv', sh = SHAPE[sp], m = new Model();
  const T = chick ? PROF_CHICK : PROF, P0 = profOf(T, chick ? 1 : sh.head), X0 = T[0][0], X1 = T[T.length - 1][0];
  const headX = chick ? 2.45 : 2.75, neckX = chick ? 1.85 : 2.2;
  // 머리 단면 — 2026-11-25 [사용자: "펭귄 얼굴이 너무 부자연스러운 원형이야"] 예전엔 머리가 거의 둥근 원기둥 끝이라 정면에서 동그란 공이었다.
  //   진짜 펭귄 머리: 옆으로 납작(높이보다 폭이 좁다) · 정수리는 좁고 평평하게 · 눈 아래 뺨이 조금 불룩 · 턱 밑으로 좁아지며 목에 이어진다
  const headK = (x) => smooth(neckX - .15, headX + .1, x);
  const hr = (x, th) => { const k = headK(x), c = Math.cos(th), s = Math.sin(th) ** 2; return 1 - k * (.17 * Math.max(0, c) * s + .12 * Math.max(0, c) ** 6 - .07 * Math.exp(-(((c + .3) / .35) ** 2)) * s + .08 * Math.max(0, -c - .55) * s); };
  const P = (x) => { const p = P0(x); return {...p, b: p.b * (1 - .24 * headK(x))}; };
  const surf = (x, th, k = 1) => { const p = P(x), q = k * hr(x, th); return [x, p.cy + Math.cos(th) * p.a * q, Math.sin(th) * p.b * q]; };
  const eyeX = chick ? 2.78 : 3.12, eyeTh = sp === 'adelie' ? 1.0 : 1.05, eyeC = [-1, 1].map((sd) => surf(eyeX, sd * eyeTh, .96));
  const SLATE = juv ? [58, 64, 76] : [30, 36, 48], BACK = juv ? [86, 94, 108] : [52, 62, 78], CAP = juv ? [40, 42, 50] : [14, 15, 20], WHITE = [240, 241, 238];
  const eyeY = (eyeC[0][1] - P(eyeX).cy) / P(eyeX).a;

  // 머리 무늬 — x · yr(단면 높이 -1 아래 ~ 1 위) · side(0 가운데 ~ 1 옆) · z 로 판단
  function headPattern(c, x, y, z, yr, side) {
    const head = smooth(neckX - .2, neckX + .25, x);
    if (sp === 'gentoo') {
      c = mix(c, CAP, head * smooth(-1.05, -.6, yr) + head * (1 - smooth(-1.05, -.6, yr)) * smooth(neckX + .3, neckX + .55, x));
      // 눈 위 흰 삼각 — 눈 뒤 위쪽에서 정수리 가운데 띠로
      const ex = x - (eyeX - .08), ey = yr - (eyeY + .2), tri = smooth(.25, .13, Math.hypot(ex / 1.3, ey)) * smooth(.25, .55, side);
      const band = smooth(.085, .035, Math.abs(x - (eyeX - .05))) * smooth(.62, .85, yr);
      c = mix(c, WHITE, Math.max(tri, band) * (juv ? .7 : 1));
      // 흰 점 몇 개(머리 옆)
      const fleck = smooth(.82, .9, noise(x * 9, y * 9, z * 9)) * head * smooth(.3, .6, side) * smooth(-.4, .2, yr);
      c = mix(c, WHITE, fleck * .5);
      if (juv) c = mix(c, [150, 154, 160], head * smooth(-.25, -.75, yr) * .8);    // 어린 개체: 턱이 회색
    } else if (sp === 'chinstrap') {
      // 검은 모자(눈 위) · 흰 얼굴 · 턱끈
      const cap = head * smooth(eyeY - .02, eyeY + .14, yr);
      c = mix(c, head > .5 ? WHITE : c, head * (1 - cap));
      c = mix(c, CAP, cap);
      // 턱끈: 눈 뒤 아래에서 턱 밑을 가로지르는 가는 고리
      const tq = clamp((eyeY - .12 - yr) / (eyeY + .88)), sx = eyeX - .3 + .36 * tq, strap = smooth(.05, .018, Math.abs(x - sx)) * smooth(eyeY - .08, eyeY - .2, yr) * head;
      c = mix(c, juv ? [70, 72, 80] : [16, 17, 22], strap * (juv ? .55 : 1));
      if (juv) c = mix(c, [176, 178, 184], head * (1 - cap) * smooth(-.2, .3, yr) * .55);  // 어린 개체: 얼굴이 거뭇하다
      // 목 뒤는 검정(모자가 등으로 이어진다)
      c = mix(c, SLATE, smooth(neckX + .1, neckX - .3, x) * smooth(.2, .55, yr));
    } else {
      // 아델리: 머리 전체 검정(어린 개체는 턱 · 목 앞이 희다)
      const black = head * (juv ? smooth(eyeY - .4, eyeY - .15, yr) : 1);
      c = mix(c, CAP, black * (smooth(-1.05, -.6, yr) + (1 - smooth(-1.05, -.6, yr)) * smooth(neckX + .3, neckX + .55, x)));
      if (juv) c = mix(c, WHITE, head * smooth(eyeY - .15, eyeY - .45, yr) * smooth(neckX, neckX + .3, x));
    }
    return c;
  }

  // ── 몸통 ──
  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => hr(x, th)}; },
    {ns: 52, nt: 28, capStart: .2, capEnd: .2, capRings: 4, capSpanStart: .03, capSpanEnd: .08, island: [0, 0, 1, .62], bone: 'body',
      sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < neckX ? (x - X0) / (neckX - X0) * .6 : .6 + (x - neckX) / (X1 - neckX) * .4; },
      paint: (p, n) => {
        const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / pr.a, side = Math.abs(z) / pr.b;
        const grain = .92 + .16 * fbm([x * 6, y * 6, z * 6], 3) + .06 * (noise(x * 40, y * 40, z * 40) - .5);
        if (chick) {
          // 새끼 솜털: 젠투 — 회색 등 · 흰 배 / 턱끈 — 온몸 은회색 · 머리 조금 짙게 / 아델리 — 짙은 회갈색 · 머리 더 짙게
          const base = sp === 'gentoo' ? [134, 138, 146] : sp === 'chinstrap' ? [176, 179, 184] : [102, 98, 98];
          let c = mix(base, base.map((v) => v * .82), smooth(-.4, .6, n[1]) * .6);
          if (sp === 'gentoo') c = mix(c, [236, 236, 232], smooth(.05, -.35, yr) * (1 - smooth(headX - .3, headX, x) * .7));
          if (sp === 'chinstrap') c = mix(c, [212, 214, 216], smooth(-.1, -.6, yr) * .7);
          const head = smooth(headX - .55, headX - .2, x); c = mix(c, base.map((v) => v * (sp === 'gentoo' ? .72 : .62)), head * smooth(-.6, -.2, yr));
          return c.map((v) => v * (.88 + .24 * noise(x * 26, y * 26, z * 26)));
        }
        // 검은 등 · 흰 배(가슴에서 낮고 뒤로 갈수록 올라간다)
        const edge = -.02 - .16 * smooth(-2, .8, x) + .1 * smooth(1, 2.1, x) + .05 * Math.sin(x * 2.2);
        const white = smooth(edge + .07, edge - .07, yr);
        let c = mix(mix(SLATE, BACK, smooth(.2, .9, n[1])), WHITE, white);
        c = mix(c, c.map((v) => v * .9), smooth(.3, -.9, yr) * white);
        c = headPattern(c, x, y, z, yr, side);
        // 흰 눈테(아델리 굵고 또렷 · 젠투 얇게) — 눈 둘레 몸통에 칠한다
        if (ring) for (const e of eyeC) { const d = Math.hypot(x - e[0], y - e[1], z - e[2]); c = mix(c, WHITE, smooth(r0 + ring + .02, r0 + ring - .01, d)); }
        return c.map((v) => v * grain);
      }});

  // ── 부리 — 닫힌 하나의 쐐기(1판은 위 · 아래 두 쪽이 벌어져 포크처럼 보였다). 옆으로 납작하고 입 선을 칠한다 ──
  const bx = X1 - .14, bp = P(X1 - .3), B = sh.bill * (chick ? .6 : juv ? .9 : 1), R = sh.billR * (chick ? 1.15 : 1);
  const ORANGE = juv ? [214, 116, 70] : [232, 92, 52];
  m.sweep('bill', (s) => ({c: [bx + B * s, bp.cy - .03 - .07 * B * s * s, 0], u: [0, 1, 0], v: [0, 0, 1], a: .21 * R * (1 - .84 * s ** .85), b: .16 * R * (1 - .8 * s ** .85)}),
    {ns: 12, nt: 14, capStart: .05, capEnd: .03, capRings: 2, island: [0, .62, .3, .74], bone: 'head',
      paint: (p, n, [s, t]) => {
        const up = Math.cos(t * Math.PI * 2 + Math.PI), mouth = smooth(.09, .03, Math.abs(up + .12)) * smooth(.95, .8, s); // 1 = 위(등줄), 입 선은 옆 가운데 조금 아래
        let c = [18, 18, 22];
        if (sp === 'gentoo' && !chick) c = mix(ORANGE, [22, 20, 22], clamp(smooth(.5, .8, up) + smooth(.82, .95, s) * .8));   // 주황 부리 · 검은 등줄 · 검은 끝
        else if (sp === 'adelie' && !chick) c = mix([34, 30, 30], [14, 14, 16], s);
        else if (sp === 'chinstrap' && !chick) c = mix([26, 26, 30], [12, 12, 14], s);
        return mix(c, [6, 6, 8], mouth * .9).map((v) => v * (.94 + .1 * noise(p[0] * 30, p[1] * 30, p[2] * 30)));
      }});
  // 아델리: 부리 밑동 절반을 덮는 깃털 — 머리 쪽으로 짧은 덮개
  if (sp === 'adelie' && !chick) m.sweep('billFeather', (s) => ({c: [bx - .05 + B * .42 * s, bp.cy - .02, 0], u: [0, 1, 0], v: [0, 0, 1], a: .26 * (1 - .45 * s), b: .26 * (1 - .4 * s)}),
    {ns: 6, nt: 12, capEnd: .04, capRings: 1, island: [.31, .74, .4, .8], bone: 'head', paint: (p) => CAP.map((v) => v * (.9 + .2 * noise(p[0] * 30, p[1] * 30, p[2] * 30)))});
  // ── 눈(흰 눈테: 젠투 얇게 · 아델리 굵고 또렷 — 어린 아델리는 없다) ──
  const r0 = chick ? .1 : .075, ring = sp === 'adelie' && !juv && !chick ? .055 : sp === 'gentoo' && !chick ? .025 : 0, IRIS = sp === 'chinstrap' ? [120, 50, 30] : [40, 24, 18];
  eyeC.forEach((c, i) => {
    const r = chick ? .1 : .075;
    m.sphere('eye' + i, c, r, {island: [.31 + i * .05, .62, .35 + i * .05, .68], bone: 'head', paint: (p) => { const d = Math.hypot(p[0] - c[0] - .035, p[1] - c[1] - .035); return d < .02 ? [225, 225, 225] : d < r * .6 ? [8, 8, 10] : IRIS; }});
  });

  // ── 날개(납작한 노 — 윗면 검정 · 아랫면 흰색 · 흰 뒷가장자리) ──
  const fins = {}, wingX = chick ? .8 : 1.05;
  for (const sd of [-1, 1]) {
    const root = surf(wingX, sd * 1.5, .8), D = norm([-.6, -.22, sd * .78]), L = sh.wing * (chick ? .7 : 1);
    let Wd = [1, .1, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0] + Wd[1] * D[1]))); const Nf = norm(cross(D, Wd));
    m.sweep('wing' + sd, (s) => ({c: add(root, D, L * s), u: Nf, v: Wd, a: .09 - .06 * s, b: (chick ? .38 : .46) * (1 - .55 * s ** 1.4) + .04, e: 2.4}),
      {ns: 12, nt: 14, capEnd: .12, capRings: 2, island: sd < 0 ? [.48, .62, .73, .8] : [.74, .62, .99, .8], bone: 'fin' + sd,
        paint: (p, n, [s]) => {
          if (chick) return (sp === 'adelie' ? [96, 92, 92] : [150, 154, 160]).map((v) => v * (.9 + .2 * noise(p[0] * 20, p[1] * 20, p[2] * 20)));
          const upDir = Nf[1] >= 0 ? Nf : Nf.map((v) => -v), up = n[0] * upDir[0] + n[1] * upDir[1] + n[2] * upDir[2], trailing = -(n[0] * Wd[0] + n[1] * Wd[1] + n[2] * Wd[2]);
          let c = mix(SLATE, WHITE, smooth(.1, -.3, up));
          c = mix(c, WHITE, smooth(.55, .9, trailing) * .9);
          // 아랫면 끝의 검은 얼룩(젠투 · 턱끈은 끝, 아델리는 앞 가장자리)
          c = mix(c, [30, 32, 40], smooth(.1, -.3, up) * smooth(.72, .9, s) * .7);
          return c.map((v) => v * (.92 + .14 * fbm([p[0] * 5, p[1] * 5, p[2] * 5], 3)));
        }});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
  }
  // ── 꼬리깃(젠투는 길다) ──
  m.sweep('tail', (s) => ({c: [X0 + .15 - .9 * sh.tail * s, P(X0).cy + .02 + .05 * s, 0], u: [0, 1, 0], v: [0, 0, 1], a: .09 * (1 - .65 * s), b: .3 * (1 - .7 * s)}),
    {ns: 6, nt: 10, capEnd: .05, capRings: 1, island: [.62, .8, .8, .9], bone: 'tail', paint: (p) => (chick ? (sp === 'adelie' ? [96, 92, 92] : [150, 152, 158]) : SLATE).map((v) => v * (.9 + .2 * noise(p[0] * 30, 0, p[2] * 30)))});
  // ── 발(꼬리 밑, 뒤로 — 두 발 관절 leg_L / leg_R) — 젠투 주황 · 턱끈 · 아델리 분홍 ──
  const FOOT = sp === 'gentoo' ? (juv || chick ? [210, 140, 96] : [236, 120, 60]) : [226, 168, 170];
  const legs = {};
  for (const sd of [-1, 1]) {
    const root = surf(X0 + .7, Math.PI - sd * .5, .85);
    legs[sd < 0 ? 'R' : 'L'] = {root};
    m.sweep('foot' + sd, (s) => ({c: add(root, [-1, -.05, sd * .14], .7 * s), u: [0, 1, 0], v: [0, 0, 1], a: .07, b: .1 + .16 * s, e: 2.4}),
      {ns: 6, nt: 10, capEnd: .06, capRings: 1, island: sd < 0 ? [0, .8, .3, .9] : [.31, .8, .61, .9], bone: 'foot' + sd, paint: (p, n, [s, t]) => FOOT.map((v) => v * (.82 + .2 * smooth(.2, .9, s) + .08 * noise(p[0] * 30, p[1] * 30, p[2] * 30)))});
  }
  return {m, fins, legs};
}

export const KEYS = Object.keys(SPECIES).flatMap((k) => ['fry_' + k, 'juv_' + k, k]);
const keys = process.argv.slice(2).length ? process.argv.slice(2) : KEYS;
for (const key of keys) {
  const {m, fins, legs} = build(key);
  const {glb, tris} = await bake(key, m, {fins, legs, source: 'design/aqua3d-review/polar/penguins-build.mjs', roughness: .55, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'tail') return [[5, 1]];
    if (part.bone === 'foot1' || part.bone === 'foot-1') { const li = part.bone === 'foot1' ? 10 : 11, k = smooth(0, .25, s); return [[5, 1 - k], [li, k]]; }
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .2, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
