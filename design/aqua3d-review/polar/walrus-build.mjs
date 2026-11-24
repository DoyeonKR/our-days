// 바다코끼리 3D — 부위로 짓는다(2026-11-24 [사용자: "펭귄도 바다코끼리도 다 엉망이야 모델이 다시 제작해 디테일이 단 하나도 없어"])
// 비율은 사용자가 보낸 정리 시트(앞 · 위 · 옆 · 아기)를 눈으로 잰 값 — 그림 픽셀은 쓰지 않는다(저작권). 색 · 주름은 3D 위치로 칠한다.
// 부위: 몸통(꼬리 → 거대한 목 · 어깨 → 작은 머리 → 넓은 수염 주둥이, 목 주름은 단면 물결) · 눈 둘 · 엄니 둘(주둥이 모서리에서 아래 · 조금 뒤로) ·
//       앞지느러미 둘(넓은 노, 발가락 고랑) · 뒷지느러미 둘(꼬리 끝에서 뒤로 펼친 부채).
// node design/aqua3d-review/polar/walrus-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, ridge, noise, norm, add, cross} from './kit.mjs';

const STAGES = {
  walrus: {tusk: 2.3, tuskR: .27, fat: 1, headK: 1, skin: [[212, 150, 132], [116, 78, 62]], fold: 1, fur: 0, len: 1},
  juv_walrus: {tusk: 1.0, tuskR: .18, fat: .96, headK: 1.06, skin: [[196, 140, 122], [108, 74, 60]], fold: .7, fur: .15, len: .97},
  fry_walrus: {tusk: 0, tuskR: 0, fat: 1.06, headK: 1.18, skin: [[128, 100, 86], [96, 74, 62]], fold: .3, fur: .8, len: .9},
};
// 옆 · 위에서 잰 몸 단면(x: 꼬리 -5 → 주둥이 끝 4.65). a 높이 반 · b 폭 반 · cy 중심 높이 · e 초타원(머리 · 주둥이는 네모에 가깝게)
const PROF = [
  [-5.0, .52, .44, .05, 2], [-4.3, .92, .86, .02, 2], [-3.2, 1.32, 1.36, 0, 2], [-1.8, 1.6, 1.7, -.04, 2.1], [-.3, 1.72, 1.84, -.06, 2.1],
  [1.0, 1.78, 1.84, -.04, 2.15], [2.0, 1.68, 1.66, 0, 2.2], [2.8, 1.38, 1.36, .02, 2.3], [3.4, 1.08, 1.1, 0, 2.5], [3.85, .98, 1.02, -.08, 2.8],
  [4.3, .92, 1.08, -.2, 3.2], [4.65, .82, 1.02, -.26, 3.4],
];
function prof(x) {
  let i = 0; while (i < PROF.length - 2 && x > PROF[i + 1][0]) i++;
  const A = PROF[i], B = PROF[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t);
  return {a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k, e: A[4] + (B[4] - A[4]) * k};
}
const X0 = -5, X1 = 4.65;

function build(key) {
  const st = STAGES[key], m = new Model();
  const P = (x) => { const p = prof(x), head = smooth(3.0, 3.9, x); return {...p, a: p.a * (st.fat * (1 - head) + st.headK * head), b: p.b * (st.fat * (1 - head) + st.headK * head)}; };
  // 몸통 표면의 한 점(θ: 0 위 · π/2 +z 옆 · π 아래)
  const surf = (x, th, k = 1) => { const p = P(x), e = 2 / p.e, cu = Math.cos(th), sv = Math.sin(th); return [x, p.cy + Math.sign(cu) * Math.abs(cu) ** e * p.a * k, Math.sign(sv) * Math.abs(sv) ** e * p.b * k]; };
  const eyeX = 3.72, eyeTh = 1.0;
  const eyeC = [-1, 1].map((sd) => { const q = surf(eyeX, sd * eyeTh, .965); return q; });

  // ── 몸통 ──
  m.sweep('body', (s) => {
    const x = X0 + (X1 - X0) * s, p = P(x);
    return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, e: p.e, r: (th) => {
      // 목 · 어깨 주름(두꺼운 지방 고리) — 단면이 x 를 따라 물결친다
      const band = smooth(.4, 1.3, x) * (1 - smooth(3.3, 3.8, x));
      const roll = 1 + .028 * st.fold * band * Math.sin(x * 7.4 + .9 * Math.sin(th * 2) + 1.6 * noise(x * .8, th, 3));
      // 수염 주둥이 — 앞쪽 아래 · 옆이 부풀어 넓은 패드(위에서 보면 머리보다 넓다)
      const lower = .5 - .5 * Math.cos(th), pad = smooth(3.85, 4.4, x) * lower * .3;
      // 두 갈래 패드 — 앞쪽 아래 가운데(θ≈π)가 살짝 들어간다
      const cleft = smooth(4.2, 4.6, x) * Math.exp(-Math.pow((th - Math.PI) / .22, 2)) * .1;
      return roll * (1 + pad - cleft);
    }};
  }, {ns: 56, nt: 28, capStart: .25, capEnd: .5, capRings: 6, capSpanStart: .03, capSpanEnd: .2, island: [0, 0, 1, .6], sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < 3 ? (x - X0) / (3 - X0) * .55 : .55 + (x - 3) / (X1 - 3) * .45; }, bone: 'body',
    paint: (p, n) => {
      const [x, y, z] = p, pr = P(x), dorsal = smooth(-.3, .8, n[1]);
      let c = mix(st.skin[0], st.skin[1], dorsal);
      c = c.map((v) => v * (.78 + .44 * fbm([x * .7, y * .7, z * .7])));
      c = mix(c, [226, 168, 150], smooth(.6, .78, fbm([x * 1.3 + 7, y * 1.3, z * 1.3])) * .35 * st.fold);
      // 목 · 어깨의 깊은 주름(고리) + 온몸의 잔금
      const band = smooth(.2, 1.2, x) * (1 - smooth(3.5, 4.05, x));
      const ph = x * 2.1 + 1.7 * fbm([x * .45, y * .8, z * .8]) + .35 * Math.sin(Math.atan2(z, y - pr.cy) * 2 + x);
      const fold = Math.pow(1 - Math.abs(Math.sin(Math.PI * ph)), 7) * band * st.fold * smooth(.3, .62, noise(x * 1.7, y * 1.7 + 5, z * 1.7));
      const crack = Math.pow(ridge([x * 3.4, y * 3.4, z * 3.4]), 7) * (.55 + .45 * st.fold);
      const crest = Math.pow(1 - Math.abs(Math.sin(Math.PI * (ph + .18))), 10) * band * st.fold;
      c = c.map((v) => v * (1 - .55 * fold - .4 * crack + .08 * crest));
      // 혹(목 · 가슴의 우툴두툴한 돌기)
      const wart = smooth(.74, .82, noise(x * 4.2, y * 4.2, z * 4.2)) * band * st.fold;
      c = mix(c, c.map((v) => v * 1.12), wart * .6);
      // 털(새끼 · 어린)
      if (st.fur) c = c.map((v) => v * (1 + st.fur * .18 * (noise(x * 22, y * 22, z * 22) - .5)));
      // 수염 주둥이 — 밝은 살빛 패드 + 수염 뿌리 점(줄지어)
      const padW = smooth(4.05, 4.3, x) * smooth(.25, -.15, (y - pr.cy) / pr.a);
      if (padW > 0) {
        c = mix(c, [222, 178, 156], padW * .75);
        const gy = (y - pr.cy) * 17, gz = z * 17 + ((Math.floor(gy) % 2) ? .5 : 0), dy = gy - Math.floor(gy) - .5, dz = gz - Math.floor(gz) - .5, dd = Math.hypot(dy, dz);
        c = mix(c, [112, 70, 58], smooth(.42, .3, dd) * padW * .55); c = mix(c, [246, 234, 214], smooth(.22, .1, dd) * padW * .95);
        // 가운데 세로 고랑(두 갈래 패드)
        c = c.map((v) => v * (1 - .45 * padW * smooth(.12, 0, Math.abs(z)) * smooth(.3, -.4, (y - pr.cy) / pr.a)));
      }
      // 입 — 패드 아래 어두운 줄
      const mouth = smooth(4.0, 4.3, x) * smooth(.12, 0, Math.abs((y - pr.cy) / pr.a + .86));
      c = c.map((v) => v * (1 - .7 * mouth));
      // 콧구멍 — 주둥이 위 앞쪽 두 개
      for (const sz of [-1, 1]) { const d = Math.hypot((x - 4.5) / .16, (y - (pr.cy + pr.a * .5)) / .09, (z - sz * .27) / .11); c = c.map((v) => v * (1 - .85 * smooth(1.2, .6, d))); }
      // 눈가(어둡고 붉은 테)
      for (const e of eyeC) { const d = Math.hypot(x - e[0], y - e[1], z - e[2]); c = mix(c, c.map((v) => v * .62), smooth(.3, .13, d)); }
      return c;
    }});

  // ── 수염(콧수염 가시) — 주둥이 패드 아래 · 옆에서 아래 · 앞으로 뻗는 가는 크림색 가시. 뿌리는 표면 속에 묻는다 ──
  if (st.tusk > 0 || st.fur < .5) {
    const padR = (x, th) => { const lower = .5 - .5 * Math.cos(th); return 1 + smooth(3.85, 4.4, x) * lower * .3; };
    let k = 0;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 13; i++) {
      const th = 1.75 + (i + (row % 2) * .5) / 12.5 * (Math.PI * 2 - 3.5), x = 4.42 + row * .09, sp = surf(x, th, padR(x, th) - .03);
      const outw = norm([.55, Math.cos(th) * .9 - .35, Math.sin(th) * .9]), Lb = (.2 + .05 * (k % 3)) * (st.tusk > 0 ? 1 : .6);
      m.sweep("whisker" + k++, (s) => ({c: add(sp, outw, Lb * s), u: norm(cross(outw, [0, 0, 1])), v: [0, 0, 1], a: .016 * (1 - .8 * s), b: .016 * (1 - .8 * s)}),
        {ns: 1, nt: 3, island: [.26, .72, .37, .8], bone: "head", paint: () => [236, 224, 200]});
    }
  }
  // ── 눈 ──
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, .11, {island: [.26 + i * .06, .62, .31 + i * .06, .7], bone: 'head', paint: (p, n) => { const d = Math.hypot(p[0] - c[0] - .06, p[1] - c[1] - .05); return d < .022 ? [210, 200, 190] : [22, 12, 10]; }}));

  // ── 엄니 ──
  if (st.tusk > 0) for (const sd of [-1, 1]) {
    const root = [4.3, P(4.3).cy - P(4.3).a * .45, sd * .4 * st.headK], L = st.tusk, R = st.tuskR;
    m.sweep('tusk' + sd, (s) => ({c: [root[0] - .3 * L * s ** 1.25 - .25 * (1 - s), root[1] - L * s + .45 * (1 - s), root[2] + sd * .07 * L * s], u: [1, 0, 0], v: [0, 0, 1], a: R * (1 - .82 * s), b: R * .92 * (1 - .82 * s)}),
      {ns: 16, nt: 12, capEnd: R * .4, capRings: 2, island: sd < 0 ? [0, .62, .12, .8] : [.13, .62, .25, .8], bone: 'head',
        paint: (p, n, [s]) => { let c = mix([196, 176, 140], [242, 232, 208], smooth(0, .35, s)); c = mix(c, [226, 210, 178], smooth(.75, 1, s)); return c.map((v) => v * (.92 + .1 * noise(p[0] * 2, p[1] * 18, p[2] * 2))); }});
  }

  // ── 앞지느러미(넓은 노 · 발가락 고랑) ──
  const fins = {};
  for (const sd of [-1, 1]) {
    const root = surf(1.75, sd * 2.2, .78), D = norm([-.5, -.52, sd * .7]), L = 2.35 * st.len;
    let Wd = [1, 0, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0]))); const Nf = norm(cross(D, Wd));
    m.sweep('fore' + sd, (s) => ({c: add(root, D, L * s), u: Nf, v: Wd, a: .2 - .13 * s, b: .5 + .45 * Math.sin(Math.PI * Math.min(1, s * 1.15) * .85), e: 2.2}),
      {ns: 14, nt: 14, capEnd: .2, capRings: 3, island: sd < 0 ? [.38, .62, .68, .82] : [.69, .62, .99, .82], bone: 'fin' + sd,
        paint: (p, n, [s, t]) => { let c = mix([118, 82, 68], [92, 64, 54], smooth(0, .6, s)); const across = Math.sin(t * Math.PI * 2); c = c.map((v) => v * (1 - .3 * Math.pow(Math.abs(Math.sin(across * Math.PI * 2.5)), 8) * smooth(.3, .6, s))); c = c.map((v) => v * (.88 + .2 * fbm([p[0] * 2, p[1] * 2, p[2] * 2]))); return c; }});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
  }
  // ── 뒷지느러미(꼬리 끝에서 뒤로 펼친 세로 부채) ──
  for (const sd of [-1, 1]) {
    const root = [-4.7, .02, sd * .2], D = norm([-1, -.02, sd * .16]), L = 1.9 * st.len, Wd = norm([0, .64, sd * .77]), Nf = norm(cross(D, Wd));
    m.sweep('hind' + sd, (s) => ({c: add(root, D, L * s), u: Nf, v: Wd, a: .16 - .1 * s, b: .32 + .78 * s ** .8, e: 2.2, r: (th) => 1 - .1 * smooth(.75, 1, s) * Math.abs(Math.sin(Math.sin(th) * Math.PI * 2.5))}),
      {ns: 12, nt: 14, capEnd: .14, capRings: 2, island: sd < 0 ? [0, .82, .49, 1] : [.5, .82, .99, 1], bone: 'hind',
        paint: (p, n, [s, t]) => { let c = mix([120, 84, 70], [86, 60, 50], smooth(0, .8, s)); const across = Math.sin(t * Math.PI * 2); c = c.map((v) => v * (1 - .32 * Math.pow(Math.abs(Math.sin(across * Math.PI * 2.5)), 8) * smooth(.2, .5, s))); return c.map((v) => v * (.88 + .2 * fbm([p[0] * 2, p[1] * 2, p[2] * 2]))); }});
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
