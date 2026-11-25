// 남극 물고기 둘 3D — 메로(남극이빨고기) · 남극빙어(2026-11-25 [사용자: "펭귄과 메로는 유지하고" → "다 완벽하게 진행해줘"])
// 부위로 짓는다: 몸통(단면을 따라 이은 입체 — 위에서 봐도 둥글다) · 지느러미는 몸에 뿌리를 묻은 얇은 막(줄기 결 · 가장자리 투명빛) · 눈 · 아래턱.
// 생김새는 도감 기술을 눈으로 잡은 값(그림 픽셀은 쓰지 않는다).
//  · 메로(Dissostichus mawsoni, 남극이빨고기): 2m 가까운 큰 몸 · 짙은 회갈색에 얼룩 · 큰 머리와 큰 입(아래턱이 나왔다) · 큰 눈 · 등지느러미 둘(앞은 짧은 가시 · 뒤는 길다) ·
//    긴 뒷지느러미 · 넓은 부채 가슴지느러미 · 끝이 곧은 꼬리
//  · 남극빙어(Chaenocephalus aceratus, 검은지느러미빙어): 피에 헤모글로빈이 없어 몸이 유령처럼 반투명한 흰빛 · 악어처럼 납작하고 긴 주둥이 · 큰 눈 ·
//    검은 첫 등지느러미(높은 돛) · 긴 둘째 등지느러미 · 큰 부채 가슴지느러미 · 옆구리에 옅은 세로 띠
// node design/aqua3d-review/polar/antfish-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from './kit.mjs';

const famOf = (key) => key.replace(/^(fry|juv)_/, ''), STAGE = (key) => (key.startsWith('fry_') ? 'fry' : key.startsWith('juv_') ? 'juv' : 'adult');
const prof = (T) => (x) => { let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++; const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t); return A.slice(1).map((v, j) => v + (B[j + 1] - v) * k); };

// 몸 단면 [x, 높이 반, 폭 반, 중심 높이]. x: 꼬리 자루 끝 -4 → 주둥이 끝
const BODY = {
  toothfish: [[-4.0, .16, .1, 0], [-3.4, .36, .2, 0], [-2.2, .74, .44, .02], [-.6, 1.02, .66, .02], [.8, 1.1, .74, .04], [1.9, 1.02, .76, .04], [2.7, .86, .7, .02], [3.3, .62, .56, -.04], [3.8, .34, .36, -.1]],
  icefish: [[-4.0, .11, .07, 0], [-3.4, .26, .15, 0], [-2.0, .5, .3, .02], [-.5, .66, .4, .04], [.6, .7, .46, .05], [1.5, .68, .48, .04], [2.2, .5, .42, -.02], [3.1, .3, .38, -.06], [3.9, .17, .28, -.08]],
};
const X0 = -4, X1 = {toothfish: 3.8, icefish: 3.9};

function build(key) {
  const fam = famOf(key), stage = STAGE(key), m = new Model(), ice = fam === 'icefish';
  // 새끼일수록 머리 · 눈이 크고 몸이 짧다
  const headK = stage === 'fry' ? 1.25 : stage === 'juv' ? 1.1 : 1, eyeK = stage === 'fry' ? 1.55 : stage === 'juv' ? 1.25 : 1;
  const B0 = prof(BODY[fam]), P = (x) => { const [a, b, cy] = B0(x), h = 1 + (headK - 1) * smooth(1.2, 2.6, x); return {a: a * h, b: b * h, cy}; };
  const XE = X1[fam], surf = (x, th, k = 1) => { const p = P(x); return [x, p.cy + Math.cos(th) * p.a * k, Math.sin(th) * p.b * k]; };
  const eyeX = ice ? 2.25 : 2.95, eyeC = [-1, 1].map((sd) => surf(eyeX, sd * (ice ? .78 : 1.0), .9)), eyeR = (ice ? .2 : .19) * eyeK;
  // 색
  const DORSAL = ice ? [214, 220, 216] : stage === 'fry' ? [118, 112, 104] : [72, 70, 68], BELLY = ice ? [246, 246, 242] : [178, 172, 164];
  const bodyCol = (p, n) => {
    const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / pr.a;
    let c = mix(BELLY, DORSAL, smooth(-.5, .45, yr));
    if (ice) {
      // 옅은 세로 띠 넷 · 등의 회갈 얼룩 · 배의 흰빛 · 머리는 조금 더 투명한 회색
      const band = smooth(.25, .95, Math.cos((x + .3) * 1.9)) * smooth(-.4, .2, yr) * (1 - smooth(1.6, 2.3, x));
      c = mix(c, [150, 156, 150], band * (stage === 'fry' ? .3 : .55));
      c = mix(c, [176, 168, 150], smooth(.6, .78, fbm([x * 1.6, y * 1.6, z * 1.6])) * smooth(-.1, .5, yr) * .5);
      c = mix(c, [200, 210, 214], smooth(2.2, 3.2, x) * .5);
    } else {
      // 메로: 짙은 회갈 바탕에 흐린 얼룩 · 옆줄 · 배는 옅다
      c = c.map((v) => v * (.82 + .32 * fbm([x * 1.1, y * 1.1, z * 1.1])));
      c = mix(c, [44, 42, 44], smooth(.58, .74, fbm([x * 2.2 + 4, y * 2.2, z * 2.2])) * smooth(-.3, .3, yr) * .6);
      const lat = smooth(.045, .01, Math.abs(yr - (.32 - .05 * x))) * (1 - smooth(2.2, 2.7, x)); c = mix(c, [152, 148, 140], lat * .45);
    }
    // 비늘 결(작은 반달)
    const sc = Math.abs(Math.sin(x * 22 + Math.sin(y * 22) * .5) * Math.sin(y * 22 + z * 8)); c = c.map((v) => v * (.95 + .07 * smooth(.6, 1, sc) * (1 - smooth(2, 2.6, x))));
    // 아가미 덮개 선
    const gx = ice ? 1.55 : 2.15, gill = smooth(.05, .015, Math.abs(x - gx - .18 * (yr + .3) ** 2)) * smooth(-.85, -.5, yr) * (1 - smooth(.5, .8, yr));
    c = mix(c, c.map((v) => v * .62), gill);
    return c.map((v) => v * (.95 + .08 * noise(x * 30, y * 30, z * 30)));
  };

  // ── 몸통(빙어는 주둥이가 위아래로 납작 — 단면이 앞으로 갈수록 넓적한 타원) ──
  m.sweep('body', (s) => {
    const x = X0 + (XE - X0) * s, p = P(x), flat = ice ? smooth(2.0, 3.0, x) : 0;
    return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a * (1 - .35 * flat), b: p.b * (1 + .15 * flat), e: 2 + .6 * flat,
      r: (th) => 1 + (ice ? 0 : .04 * smooth(2.4, 3.3, x) * Math.max(0, -Math.cos(th)))};   // 메로: 아래턱 쪽이 조금 두툼
  }, {ns: 56, nt: 26, capStart: .05, capEnd: ice ? .12 : .2, capRings: 3, capSpanStart: .02, capSpanEnd: .06, island: [0, 0, 1, .5], bone: 'body', paint: bodyCol});

  // ── 입(아래턱 — 메로는 크게 튀어나온 아래턱, 빙어는 긴 주둥이 아래의 얇은 턱) ──
  const jx0 = ice ? 2.6 : 3.0, jx1 = XE + (ice ? .02 : .08);
  m.sweep('jaw', (s) => { const x = jx0 + (jx1 - jx0) * s, p = P(x); return {c: [x, p.cy - p.a * (ice ? .55 : .62), 0], u: [0, 1, 0], v: [0, 0, 1], a: (ice ? .06 : .1) * (1 - .4 * s), b: p.b * (ice ? 1.05 : .9) * (1 - .3 * s ** 2), e: 2.2}; },
    {ns: 10, nt: 14, capEnd: .04, capRings: 1, island: [0, .5, .2, .58], bone: 'head', paint: (p, n) => mix([60, 56, 54].map((v) => (ice ? v * 2.6 : v)), BELLY, smooth(.2, -.6, n[1])).map((v) => clamp(v, 0, 255))});
  // 입 선(윗입술 그늘) — 주둥이 옆에 얇은 띠
  // ── 눈(큰 눈 · 금빛 홍채 · 검은 동공) ──
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, eyeR, {island: [.21 + i * .06, .5, .26 + i * .06, .58], bone: 'head', paint: (p) => {
    const out = norm([0, c[1] - P(eyeX).cy, c[2]]), d = Math.hypot(p[0] - c[0], (p[1] - c[1]) - out[1] * eyeR, (p[2] - c[2]) - out[2] * eyeR);
    return d < eyeR * .14 ? [235, 235, 230] : d < eyeR * .5 ? [10, 10, 12] : d < eyeR * .75 ? (ice ? [170, 160, 130] : [150, 120, 60]) : (ice ? [190, 196, 196] : [70, 66, 60]);
  }}));

  // ── 지느러미: 몸 위(또는 아래) 선을 따라 뿌리를 몸속에 묻고 밖으로 세운 얇은 막 ──
  // fin(name, x0, x1, side(+1 위 · -1 아래), height(t∈0..1 → 높이), island, colorFn)
  const fin = (name, x0, x1, sd, H, island, col, tilt = 0) => m.sweep(name, (s) => {
    const x = x0 + (x1 - x0) * s, p = P(x), base = p.cy + sd * p.a * .86, h = H(s);
    return {c: [x - tilt * h * .5, base + sd * h * .5, 0], u: [0, sd, 0], v: [0, 0, 1], a: h * .5 + p.a * .08, b: .028 + .02 * (1 - s), e: 2.6};
  }, {ns: 18, nt: 8, capStart: .03, capEnd: .03, capRings: 1, island, bone: 'body', paint: (p, n, [s, t]) => {
    const pr = P(p[0]), out = Math.abs(p[1] - (pr.cy + sd * pr.a * .86)) / Math.max(.05, H(clamp((p[0] - x0) / (x1 - x0)))), ray = .85 + .15 * Math.abs(Math.sin(s * 70));
    return col(out, s).map((v) => v * ray);
  }});
  const FIN = ice ? [214, 218, 214] : [70, 66, 62], DARK = [22, 22, 26];
  if (ice) {
    fin('d1', -.1, 1.15, 1, (s) => .9 * Math.sin(Math.PI * Math.min(1, s * 1.25)) ** .7 * (1 - .25 * s), [.3, .5, .45, .58], (o) => mix([40, 40, 44], DARK, smooth(.2, .6, o)), .15);  // 검은 돛
    fin('d2', -1.0, -3.4, 1, (s) => .5 * Math.sin(Math.PI * Math.min(1, s * 1.05 + .05)) ** .5, [.45, .5, .7, .58], (o) => mix(FIN, [170, 176, 176], o));
    fin('an', -.4, -3.4, -1, (s) => .42 * Math.sin(Math.PI * Math.min(1, s * 1.05 + .05)) ** .5, [.7, .5, .95, .58], (o) => mix(FIN, [176, 180, 180], o));
  } else {
    fin('d1', 1.0, .0, 1, (s) => .42 * Math.sin(Math.PI * Math.min(1, s * 1.1)) ** .6, [.3, .5, .45, .58], (o) => mix(FIN, [46, 44, 44], o));
    fin('d2', -.3, -3.2, 1, (s) => .58 * Math.sin(Math.PI * Math.min(1, s * 1.05 + .05)) ** .5, [.45, .5, .7, .58], (o) => mix(FIN, [44, 42, 42], o));
    fin('an', -.4, -3.2, -1, (s) => .5 * Math.sin(Math.PI * Math.min(1, s * 1.05 + .05)) ** .5, [.7, .5, .95, .58], (o) => mix([120, 114, 108], [56, 52, 50], o));
  }
  // 꼬리지느러미(세로 부채 — 메로는 끝이 곧고, 빙어는 둥글다)
  m.sweep('caudal', (s) => {
    const x = X0 + .2 - (ice ? 1.0 : 1.15) * s, h = .14 + (ice ? .95 : 1.05) * Math.sin(Math.PI * .5 * Math.min(1, s * 1.15)) * (ice ? 1 - .2 * s ** 3 : 1);
    return {c: [x, P(X0).cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: h, b: .04 * (1 - .6 * s), e: 2.8};
  }, {ns: 12, nt: 10, capEnd: .02, capRings: 1, island: [.25, .58, .5, .7], bone: 'tail', paint: (p, n, [s]) => mix(ice ? FIN : [66, 62, 60], ice ? [170, 176, 176] : [40, 38, 40], s).map((v) => v * (.86 + .14 * Math.abs(Math.sin(p[1] * 26))))});
  // 가슴지느러미(넓은 부채 — fin 뼈) · 배지느러미
  const fins = {};
  for (const sd of [-1, 1]) {
    const px = ice ? 1.3 : 1.85, root = surf(px, sd * 1.75, .82), D = norm([-.75, -.2, sd * .62]), L = (ice ? 1.45 : 1.3) * (stage === 'fry' ? .85 : 1);
    let Wd = [0, 1, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0] + Wd[1] * D[1] + Wd[2] * D[2]))); const Nf = norm(cross(D, Wd));
    m.sweep('pec' + sd, (s) => ({c: add(root, D, L * s), u: Wd, v: Nf, a: (ice ? .5 : .42) * Math.sin(Math.PI * (.22 + .7 * s)) + .05, b: .025, e: 2.6}),
      {ns: 12, nt: 8, capEnd: .06, capRings: 1, island: sd < 0 ? [.5, .58, .75, .7] : [.75, .58, 1, .7], bone: 'fin' + sd,
        paint: (p, n, [s]) => mix(FIN, ice ? [170, 176, 178] : [40, 38, 40], s).map((v) => v * (.85 + .15 * Math.abs(Math.sin(s * 40))))});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
    // 배지느러미(가슴 아래 앞쪽 — 작은 잎)
    const pr = surf(ice ? 1.7 : 2.0, Math.PI - sd * .35, .85), Dp = norm([-.8, -.45, sd * .3]);
    m.sweep('pel' + sd, (s) => ({c: add(pr, Dp, (ice ? .8 : .6) * s), u: [0, 0, 1], v: norm(cross(Dp, [0, 0, 1])), a: .2 * Math.sin(Math.PI * (.25 + .65 * s)) + .03, b: .02, e: 2.6}),
      {ns: 8, nt: 8, capEnd: .04, capRings: 1, island: sd < 0 ? [0, .7, .2, .78] : [.2, .7, .4, .78], bone: 'body', paint: (p, n, [s]) => (ice ? mix(FIN, DARK, s * .5) : mix(FIN, [40, 38, 40], s))});
  }
  return {m, fins};
}

export const KEYS = ['toothfish', 'icefish'].flatMap((k) => ['fry_' + k, 'juv_' + k, k]);
const keys = process.argv.slice(2).length ? process.argv.slice(2) : KEYS;
for (const key of keys) {
  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/polar/antfish-build.mjs', roughness: famOf(key) === 'icefish' ? .42 : .6, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'tail') return [[5, 1]];
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .2, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
