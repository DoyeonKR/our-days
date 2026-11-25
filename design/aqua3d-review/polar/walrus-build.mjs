// 바다코끼리 3D — 부위로 짓는다(2026-11-24 [사용자: "펭귄도 바다코끼리도 다 엉망이야 모델이 다시 제작해 디테일이 단 하나도 없어"])
// 비율은 사용자가 보낸 정리 시트(앞 · 위 · 옆 · 아기)를 눈으로 잰 값 — 그림 픽셀은 쓰지 않는다(저작권). 색 · 주름은 3D 위치로 칠한다.
// 부위: 몸통(꼬리 → 거대한 목 · 어깨 → 작은 머리 → 넓은 수염 주둥이, 목 주름은 단면 물결) · 눈 둘 · 엄니 둘(주둥이 모서리에서 아래 · 조금 뒤로) ·
//       앞지느러미 둘(넓은 노, 발가락 고랑) · 뒷지느러미 둘(꼬리 끝에서 뒤로 펼친 부채).
// node design/aqua3d-review/polar/walrus-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, ridge, noise, norm, add, cross} from './kit.mjs';

const STAGES = {
  walrus: {tusk: 2.3, tuskR: .25, fat: 1, headK: 1, skin: [[178, 120, 98], [104, 66, 50]], fold: 1, fur: 0, len: 1},
  juv_walrus: {tusk: 1.0, tuskR: .17, fat: .96, headK: 1.06, skin: [[170, 118, 98], [100, 66, 52]], fold: .7, fur: .15, len: .97},
  fry_walrus: {tusk: 0, tuskR: 0, fat: 1.06, headK: 1.18, skin: [[128, 100, 86], [96, 74, 62]], fold: .3, fur: .8, len: .9},
};
// 옆 · 위에서 잰 몸 단면(x: 꼬리 -5 → 주둥이 끝 4.65). a 높이 반 · b 폭 반 · cy 중심 높이 · e 초타원(머리 · 주둥이는 네모에 가깝게)
const PROF = [
  [-5.0, .52, .44, .05, 2], [-4.3, .92, .86, .02, 2], [-3.2, 1.32, 1.36, 0, 2], [-1.8, 1.6, 1.7, -.04, 2.1], [-.3, 1.72, 1.84, -.06, 2.1],
  [1.0, 1.78, 1.84, -.04, 2.15], [2.0, 1.68, 1.66, 0, 2.2], [2.8, 1.38, 1.36, .02, 2.3], [3.4, 1.06, 1.06, .04, 2.3], [3.85, .92, .9, .02, 2.3],
  [4.15, .8, .78, -.06, 2.3], [4.42, .66, .66, -.1, 2.2], [4.62, .47, .5, -.14, 2.1], [4.76, .26, .3, -.17, 2],
];
function prof(x) {
  let i = 0; while (i < PROF.length - 2 && x > PROF[i + 1][0]) i++;
  const A = PROF[i], B = PROF[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t);
  return {a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k, e: A[4] + (B[4] - A[4]) * k};
}
const X0 = -5, X1 = 4.76;

function build(key) {
  const st = STAGES[key], m = new Model();
  const P = (x) => { const p = prof(x), head = smooth(3.0, 3.9, x); return {...p, a: p.a * (st.fat * (1 - head) + st.headK * head), b: p.b * (st.fat * (1 - head) + st.headK * head)}; };
  // 몸통 표면의 한 점(θ: 0 위 · π/2 +z 옆 · π 아래)
  const surf = (x, th, k = 1) => { const p = P(x), e = 2 / p.e, cu = Math.cos(th), sv = Math.sin(th); return [x, p.cy + Math.sign(cu) * Math.abs(cu) ** e * p.a * k, Math.sign(sv) * Math.abs(sv) ** e * p.b * k]; };
  // 눈 — 작고 높게, 주둥이 패드 바로 뒤 윗옆(2026-11-25: 정면에서 보이게 조금 앞 · 위로)
  const eyeX = 3.95, eyeTh = .82;
  const eyeC = [-1, 1].map((sd) => surf(eyeX, sd * eyeTh, .96));
  // 수염 패드(2026-11-25 [사용자: "어제 추가된 모델을 디테일이 너무 떨어져 실제와 비슷하게 계속 가다듬어봐"]) — 예전엔 몸통 끝을 네모 단면으로 늘린 상자라 정면이 우편함 같았다.
  //   실제 바다코끼리 주둥이는 좌우 두 덩이로 부푼 수염 패드(머리보다 넓고 턱 밑까지 늘어진다)라, 몸통 끝은 둥근 코로 줄이고 패드 둘을 따로 붙인다
  const hk = st.headK * (1 - .28 * st.fur), padC = (sd) => [4.3, P(4.3).cy - .26 * hk, sd * .36 * hk], PR = [.52 * hk, .56 * hk, .52 * hk];
  const padSurf = (sd, u, v, k = 1) => { const c = padC(sd); return [c[0] + PR[0] * k * Math.cos(v) * Math.cos(u), c[1] + PR[1] * k * Math.sin(v), c[2] + PR[2] * k * Math.cos(v) * Math.sin(u)]; };

  // ── 몸통 ──
  m.sweep('body', (s) => {
    const x = X0 + (X1 - X0) * s, p = P(x);
    return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, e: p.e, r: (th) => {
      // 목 · 어깨 주름(두꺼운 지방 고리) — 단면이 x 를 따라 물결친다. 등 쪽은 얕고 목 옆 · 아래가 깊다
      const band = smooth(-.2, 1.0, x) * (1 - smooth(3.2, 3.7, x)), side = .55 + .45 * Math.abs(Math.sin(th)) + .3 * smooth(0, -1, Math.cos(th));
      const roll = 1 + .045 * st.fold * band * side * Math.sin(x * 5.6 + .7 * Math.sin(th * 2) + 2.2 * noise(x * .7, th * .8, 3)) * (.6 + .4 * noise(x * 1.3, th * 1.7, 9));
      // 이마 — 눈 위가 살짝 솟는다
      const brow = Math.exp(-Math.pow((x - 3.85) / .3, 2)) * Math.exp(-Math.pow((Math.abs(th) - .7) / .35, 2)) * .05;
      // 혹(어른 수컷 목 · 어깨의 우툴두툴한 돌기) — 표면이 실제로 솟는다
      const knob = smooth(.62, .78, noise(x * 3.2, Math.cos(th) * 3.2 + 11, Math.sin(th) * 3.2)) * smooth(.6, 1.6, x) * (1 - smooth(3.2, 3.6, x)) * st.fold * .022;
      return roll * (1 + brow + knob);
    }};
  }, {ns: 52, nt: 26, capStart: .25, capEnd: .14, capRings: 4, capSpanStart: .03, capSpanEnd: .08, island: [0, 0, 1, .56], sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < 3 ? (x - X0) / (3 - X0) * .6 : .6 + (x - 3) / (X1 - 3) * .4; }, bone: 'body',
    paint: (p, n) => {
      const [x, y, z] = p, pr = P(x), dorsal = smooth(-.3, .8, n[1]);
      // 등 짙은 계피 갈색 · 배 · 목 아래 분홍빛(피가 몰린 살갗)
      let c = mix(st.skin[0], st.skin[1], dorsal);
      const neckPink = smooth(.4, 1.6, x) * (1 - smooth(3.3, 3.9, x)) * smooth(.4, -.6, n[1]);
      c = mix(c, [214, 150, 140], neckPink * .5 * st.fold);
      c = c.map((v) => v * (.84 + .3 * fbm([x * .9, y * .9, z * .9])));
      // 잔 얼룩(분홍 · 짙은 반점)
      c = mix(c, [226, 168, 152], smooth(.62, .8, fbm([x * 1.6 + 7, y * 1.6, z * 1.6])) * .3 * st.fold);
      // 가로 주름(몸을 감는 고랑) — 목 · 어깨에 깊고 촘촘, 배 · 꼬리 쪽은 얕고 성기다
      const band = smooth(-.4, .9, x) * (1 - smooth(3.4, 3.95, x)), lowBand = .35 + .65 * band;
      // 2026-11-25 3차 — 예전 고랑은 고른 간격의 곧은 세로줄이라 나뭇결 · 바코드 같았다. 간격이 들쭉날쭉하고(굵은 잡음으로 위상을 크게 흔든다)
      //   둘레를 따라 물결치며 중간에 끊기고 갈라지는 깊은 주름으로
      const ang = Math.atan2(z, y - pr.cy), warp = 2.6 * fbm([x * .35, Math.cos(ang) * 1.2, Math.sin(ang) * 1.2]) + .55 * Math.sin(ang * 3 + x * 1.3) + .3 * Math.sin(ang * 7 + x * 2.1);
      const ph = x * (1.5 + 1.3 * band) + warp;
      const groove = Math.pow(1 - Math.abs(Math.sin(Math.PI * ph)), 12) * lowBand * (.5 + .5 * st.fold) * smooth(.3, .62, noise(x * 1.1, Math.cos(ang) * 2 + 5, Math.sin(ang) * 2));
      const lit = Math.pow(1 - Math.abs(Math.sin(Math.PI * (ph + .14))), 8) * lowBand * st.fold * .8;
      // 잔주름(가는 그물 — 예전 '갈라진 진흙' 금보다 훨씬 얕게)
      const fine = Math.pow(1 - Math.abs(noise(x * 7, y * 7, z * 7) * 2 - 1), 12) * .6 + Math.pow(1 - Math.abs(noise(x * 16 + 3, y * 16, z * 16) * 2 - 1), 14) * .35;
      c = c.map((v) => v * (1 - .5 * groove - .12 * fine + .1 * lit));
      // 혹(목 · 가슴 · 어깨의 우툴두툴한 돌기) — 밝은 정수리 + 아래 그늘
      const wn = noise(x * 5, y * 5, z * 5), wart = smooth(.7, .8, wn) * smooth(-.6, 1.4, x) * (1 - smooth(3.4, 3.8, x)) * st.fold;
      c = mix(c, c.map((v) => Math.min(255, v * 1.18 + 8)), wart * .7);
      // 짧고 성긴 털(새끼 · 어린은 짙은 솜털)
      c = c.map((v) => v * (1 + (.06 + st.fur * .16) * (noise(x * 30, y * 30, z * 30) - .5)));
      // 콧구멍 — 코끝 위 앞쪽 두 개(가는 초승달)
      for (const sz of [-1, 1]) { const d = Math.hypot((x - 4.6) / .1, (y - (pr.cy + pr.a * .55)) / .07, (z - sz * .16) / .1); c = c.map((v) => v * (1 - .85 * smooth(1.1, .5, d))); }
      // 눈가 — 붉고 어두운 테, 눈 위는 주름 고랑
      for (const e of eyeC) { const d = Math.hypot(x - e[0], y - e[1], z - e[2]); c = mix(c, [128, 70, 60], smooth(.17, .09, d) * .6); c = c.map((v) => v * (1 - .35 * smooth(.26, .19, d) * smooth(.14, .19, d))); }
      return c;
    }});

  // ── 수염 패드 둘(좌우로 부푼 덩이, 가운데가 맞닿아 골이 진다) ──
  for (const sd of [-1, 1]) {
    const c0 = padC(sd);
    m.sweep('pad' + sd, (s) => { const v = -Math.PI / 2 + Math.PI * s, cv = Math.cos(v); return {c: [c0[0], c0[1] + PR[1] * Math.sin(v), c0[2]], u: [1, 0, 0], v: [0, 0, 1], a: Math.max(.01, PR[0] * cv), b: Math.max(.01, PR[2] * cv)}; },
      {ns: 12, nt: 18, island: sd < 0 ? [0, .56, .2, .7] : [.2, .56, .4, .7], bone: 'head',
        paint: (q, n) => {
          const [x, y, z] = q, rel = [(x - c0[0]) / PR[0], (y - c0[1]) / PR[1], (z - c0[2]) / PR[2]];
          // 살빛 · 위는 몸 색으로 이어진다. 앞 · 아래에 수염 뿌리(짙은 점 + 흰 가시 밑동)가 줄지어
          let c = mix([206, 156, 136], st.skin[0].map((v) => v * .92), smooth(.1, .7, rel[1]));
          c = c.map((v) => v * (.88 + .22 * fbm([x * 3, y * 3, z * 3])));
          const front = smooth(-.3, .6, rel[0]) * smooth(.55, -.1, rel[1]);
          const lat = Math.atan2(rel[2] * sd, rel[0]), row = (rel[1] + 1.2) * 6.5, col = lat * 6 + (Math.floor(row) % 2) * .5;
          const dd = Math.hypot(row - Math.floor(row) - .5, col - Math.floor(col) - .5);
          c = mix(c, [96, 60, 50], smooth(.4, .26, dd) * front * .75);
          c = mix(c, [240, 228, 206], smooth(.18, .08, dd) * front * .9);
          // 두 패드가 맞닿는 가운데 골(안쪽 면 그늘)
          c = c.map((v) => v * (1 - .4 * smooth(.2, -.5, rel[2] * sd)));
          return c;
        }});
  }
  // ── 입 — 패드 아래 가운데, 짧은 아랫입술(분홍) ──
  {
    const lc = [4.42, P(4.3).cy - .78 * hk, 0];
    m.sweep('lip', (s) => ({c: [lc[0] - .22 * s, lc[1] - .02 * s, 0], u: [0, 1, 0], v: [0, 0, 1], a: .16 * hk * (1 - .3 * s), b: .3 * hk * (1 - .2 * s)}),
      {ns: 4, nt: 12, capStart: .08, capRings: 2, island: [.4, .56, .5, .62], bone: 'head', paint: (q, n) => mix([150, 96, 84], [196, 132, 118], smooth(-.4, .4, n[1]))});
  }

  // ── 수염(굵고 뻣뻣한 크림색 가시) — 패드 앞 · 아래에서 아래 · 앞으로. 뿌리는 패드 속에 묻는다 ──
  {
    // 새끼도 짧은 수염이 난다(2026-11-25 — 예전엔 새끼만 빼서 패드가 맨 공 둘이었다)
    let k = 0; const thick = st.tusk > 0 ? 1 : .62;
    for (const sd of [-1, 1]) for (let row = 0; row < 4; row++) for (let i = 0; i < 9; i++) {
      const v = -.85 + row * .32, u = sd * (-.35 + (i + (row % 2) * .5) / 8.5 * 2.0), sp = padSurf(sd, u, v, .92);
      const nrm = norm([Math.cos(v) * Math.cos(u) / PR[0], Math.sin(v) / PR[1], Math.cos(v) * Math.sin(u) / PR[2]]);
      const dir = norm(add(add([nrm[0], nrm[1], nrm[2] * .45], [0, -1, 0], 1.25), [.3, 0, 0])), Lb = (.17 + .05 * ((k * 7) % 3) + .03 * row) * thick;
      m.sweep('whisker' + k++, (s) => ({c: add(sp, dir, (Lb + .06) * s), u: norm(cross(dir, [0, 0, 1])), v: [0, 0, 1], a: .026 * thick * (1 - .75 * s), b: .026 * thick * (1 - .75 * s)}),
        {ns: 1, nt: 3, island: [.5, .56, .56, .62], bone: 'head', paint: (q, n, [s]) => mix([214, 196, 168], [246, 238, 220], s)});
    }
  }
  // ── 눈(작고 촉촉 — 붉은 테 안 검은 눈) ──
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, .085, {ns: 6, nt: 8, island: [.57 + i * .04, .56, .6 + i * .04, .62], bone: 'head', paint: (p, n) => { const d = Math.hypot(p[0] - c[0] - .05, p[1] - c[1] - .04); return d < .02 ? [220, 210, 200] : [26, 14, 12]; }}));

  // ── 엄니(윗턱에서 패드 밑으로 나와 아래 · 조금 뒤로 휜다. 납작한 타원 단면, 밑동은 누렇고 끝은 상아색) ──
  if (st.tusk > 0) for (const sd of [-1, 1]) {
    const root = [4.42, P(4.3).cy - .62 * hk, sd * .3 * hk], L = st.tusk, R = st.tuskR;
    m.sweep('tusk' + sd, (s) => ({c: [root[0] - .1 * L * s - .16 * L * s * s, root[1] - L * s + .25 * (1 - s), root[2] + sd * (.03 * L * s - .05 * L * s * s * (1 - s))], u: norm([1, -.15 - .3 * s, 0]), v: [0, 0, 1], a: R * (1 - .8 * s ** 1.2), b: R * .78 * (1 - .8 * s ** 1.2)}),
      {ns: 14, nt: 10, capEnd: R * .35, capRings: 2, island: sd < 0 ? [0, .7, .1, .82] : [.1, .7, .2, .82], bone: 'head',
        paint: (p, n, [s]) => { let c = mix([190, 160, 112], [240, 230, 204], smooth(0, .4, s)); c = mix(c, [228, 214, 182], smooth(.8, 1, s)); return c.map((v) => v * (.9 + .12 * noise(p[0] * 3, p[1] * 22, p[2] * 3))); }});
  }

  // ── 앞지느러미(짧고 넓은 노 — 몸 옆 아래에서 뒤 · 아래로, 손가락 다섯의 고랑 · 끝이 살짝 말린다) ──
  const fins = {};
  for (const sd of [-1, 1]) {
    const root = surf(1.9, sd * 2.1, .8), D = norm([-.78, -.42, sd * .48]), L = 1.85 * st.len;
    let Wd = [1, 0, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0]))); const Nf = norm(cross(D, Wd));
    m.sweep('fore' + sd, (s) => ({c: add(add(root, D, L * s), Nf, -.12 * s * s), u: Nf, v: Wd, a: .25 - .16 * s, b: .46 + .4 * Math.sin(Math.PI * Math.min(1, s * 1.1) * .8), e: 2.3}),
      {ns: 12, nt: 14, capEnd: .18, capRings: 3, island: sd < 0 ? [.2, .7, .5, .84] : [.5, .7, .8, .84], bone: 'fin' + sd,
        paint: (p, n, [s, t]) => { let c = mix(st.skin[1].map((v) => v * .95), st.skin[1].map((v) => v * .72), smooth(0, .7, s)); const across = Math.sin(t * Math.PI * 2); c = c.map((v) => v * (1 - .28 * Math.pow(Math.abs(Math.sin(across * Math.PI * 2.5)), 6) * smooth(.25, .55, s))); c = c.map((v) => v * (.86 + .24 * fbm([p[0] * 3, p[1] * 3, p[2] * 3]))); return c; }});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
  }
  // ── 뒷지느러미(꼬리 끝에서 뒤로 펼친 부채 — 발가락 다섯 끝이 물결) ──
  for (const sd of [-1, 1]) {
    const root = [-4.7, .02, sd * .22], D = norm([-1, -.03, sd * .2]), L = 2.0 * st.len, Wd = norm([0, .62, sd * .78]), Nf = norm(cross(D, Wd));
    m.sweep('hind' + sd, (s) => ({c: add(root, D, L * s), u: Nf, v: Wd, a: .17 - .11 * s, b: .34 + .86 * s ** .8, e: 2.2, r: (th) => 1 - .14 * smooth(.72, 1, s) * Math.abs(Math.sin(Math.sin(th) * Math.PI * 2.5))}),
      {ns: 10, nt: 14, capEnd: .14, capRings: 2, island: sd < 0 ? [0, .84, .49, 1] : [.5, .84, .99, 1], bone: 'hind',
        paint: (p, n, [s, t]) => { let c = mix(st.skin[1].map((v) => v * .95), st.skin[1].map((v) => v * .7), smooth(0, .8, s)); const across = Math.sin(t * Math.PI * 2); c = c.map((v) => v * (1 - .32 * Math.pow(Math.abs(Math.sin(across * Math.PI * 2.5)), 6) * smooth(.2, .5, s))); return c.map((v) => v * (.86 + .24 * fbm([p[0] * 3, p[1] * 3, p[2] * 3]))); }});
  }
  return {m, fins};
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGES);
for (const key of keys) {
  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/polar/walrus-build.mjs', roughness: .66, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'hind') return [[5, 1]];
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .25, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
