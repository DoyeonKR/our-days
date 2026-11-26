// 흰고래(벨루가) 3D — 부위로 짓는다(2026-11-26 [사용자: "개체 추가해줘 자신있는 개체로"])
// 2026-11-26 다시 짓기 [사용자: "저게 벨루가라는 말도 안되는 소리하지마 기준 이미지 보고 똑같이 만들어" — 수조 유리 앞 흰고래 · 입을 벌린 흰고래 사진 둘]
//   첫 판은 몸통 끝을 뾰족하게 줄여 개 주둥이 같았다. 사진의 머리는 셋으로 나뉜다:
//   ① 크고 말랑한 이마(멜론) — 머리 위 전체를 덮는 둥근 돔이 앞으로 부풀어 거의 입끝까지 나온다
//   ② 두툼한 윗입술 — 뭉툭하고 넓다. 이마와의 사이에 깊은 골이 둘레를 따라 돈다
//   ③ 둥근 아래턱 — 윗입술보다 조금 더 앞으로 나오고 턱 끝이 둥글다
//   입선은 입끝에서 뒤로 길게 가다 눈 아래 앞에서 위로 말려 올라간다(웃는 얼굴). 눈은 작고 입꼬리 바로 뒤 위.
//   목에 주름이 지고, 가슴지느러미는 크고 넓은 둥근 노, 등지느러미는 없다(낮은 능선). 비율 · 생김새는 사진을 눈으로 옮겼다(사진 픽셀은 쓰지 않는다).
// 색: 새끼는 짙은 청회색, 어린 개체는 옅은 회색, 어른은 흰색(아주 옅은 회색 그늘).
// node design/aqua3d-review/polar/beluga-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from './kit.mjs';

const STAGES = {
  beluga: {skin: [242, 242, 238], back: [232, 232, 228], belly: [248, 248, 245], crease: [178, 180, 182], melon: 1, curl: 1, scar: 1, fat: 1, flip: 1},
  juv_beluga: {skin: [190, 196, 202], back: [170, 177, 186], belly: [214, 218, 222], crease: [132, 138, 146], melon: .94, curl: .5, scar: .3, fat: .97, flip: .95},
  fry_beluga: {skin: [116, 122, 134], back: [98, 104, 116], belly: [150, 156, 166], crease: [70, 74, 84], melon: .86, curl: 0, scar: 0, fat: 1.08, flip: .88},
};
// 몸 단면(x: 꼬리자루 -4.6 → 4.0). 머리 앞은 이마 · 주둥이 부위가 덮는다 — 몸통은 그 안에서 끝난다
const PROF = [[-4.6, .24, .11, .04], [-4.0, .44, .26, .04], [-3.0, .7, .58, .02], [-1.8, .98, .94, 0], [-.5, 1.12, 1.1, -.02], [.8, 1.12, 1.1, -.03],
  [1.8, .98, .96, -.01], [2.4, .84, .82, 0], [2.95, .9, .82, .07], [3.4, .86, .74, .11], [3.75, .6, .56, .02], [4.0, .3, .32, -.1]];
const profOf = (fat) => (x) => {
  let i = 0; while (i < PROF.length - 2 && x > PROF[i + 1][0]) i++;
  const A = PROF[i], B = PROF[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t), body = 1 - smooth(2.2, 2.9, x);
  const f = fat * body + (1 - body);
  return {a: (A[1] + (B[1] - A[1]) * k) * f, b: (A[2] + (B[2] - A[2]) * k) * f, cy: A[3] + (B[3] - A[3]) * k};
};
const X0 = -4.6, X1 = 4.0;
// 입선 — 입끝(4.55, -0.42)에서 뒤로 거의 곧게 가다 입꼬리(3.42)에서 -0.1 까지 말려 올라간다
// 2026-11-26 [사용자: "입선은 눈 아래로 가야해"] — 입꼬리는 눈 바로 아래(x 3.2, 눈 아래 가장자리 조금 밑)까지 뒤로 간다
const MOUTH_END = 3.2;
const mouthY = (x) => -.47 + .37 * Math.pow(smooth(4.25, MOUTH_END, x), 1.5);
const mouthLine = (x, y, n) => x < MOUTH_END - .02 || x > 4.62 ? 0 : smooth(.032, .01, Math.abs(y - mouthY(x))) * smooth(MOUTH_END - .02, MOUTH_END + .06, x) * smooth(.3, .65, Math.abs(n[2]) + (x > 4.3 ? 1 : 0));
// 타원체 둘레 — x 를 각도로 매겨야 끝이 둥글다(x 를 고르게 · 반지름을 sin 으로 매기면 양 끝이 원뿔처럼 뾰족했다)

function build(key) {
  const st = STAGES[key], m = new Model(), P = profOf(st.fat), mk = st.melon;
  const R = (x, th) => 1
    + .05 * Math.exp(-Math.pow(th / .14, 2)) * smooth(-2.6, -1.4, x) * (1 - smooth(.2, .9, x))   // 등 능선
    - .03 * Math.exp(-Math.pow((x - 2.4) / .3, 2)) * Math.abs(Math.sin(th));                       // 목
  const surf = (x, th, k = 1) => { const p = P(x), r = R(x, th) * k; return [x, p.cy + Math.cos(th) * p.a * r, Math.sin(th) * p.b * r]; };
  // 눈 — 입꼬리(3.42, -0.1) 바로 뒤 위, 몸통 옆면
  const eyeX = 3.22, eyeY = .02, eyeC = [-1, 1].map((sd) => { const p = P(eyeX), th = Math.acos(clamp((eyeY - p.cy) / (p.a * .99), -1, 1)); return surf(eyeX, sd * th, .99); });

  // ── 몸통 ──
  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => R(x, th)}; },
    {ns: 50, nt: 28, capStart: .12, capEnd: .1, capRings: 4, capSpanStart: .02, capSpanEnd: .05, island: [0, 0, 1, .56], bone: 'body',
      sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < 2.2 ? (x - X0) / (2.2 - X0) * .66 : .66 + (x - 2.2) / (X1 - 2.2) * .34; },
      paint: (p, n) => {
        const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / pr.a;
        let c = mix(st.belly, st.skin, smooth(-.7, .1, yr));
        c = mix(c, st.back, smooth(.35, .95, yr) * .8);
        c = c.map((v) => v * (.96 + .05 * fbm([x * 1.3, y * 1.3, z * 1.3], 3) + .02 * (noise(x * 30, y * 30, z * 30) - .5)));
        if (st.scar) { const band = smooth(.72, .8, noise(x * .55 + 11, y * .55, z * .55)), stripe = Math.pow(Math.abs(Math.sin((x + y * 2.4) * 9)), 30); c = c.map((v) => v * (1 - .1 * band * stripe * st.scar)); }
        // 목 주름 — 머리 뒤에 부드러운 고랑 몇 줄(사진: 고개를 돌리면 접힌다)
        const neck = Math.exp(-Math.pow((x - 2.45) / .32, 2)) * smooth(.2, .7, Math.abs(n[2]) + Math.max(0, -n[1]) * .6);
        c = c.map((v) => v * (1 - .07 * neck * Math.pow(Math.abs(Math.sin((x - 2.45) * 11 + y * 1.4)), 5)));
        // 숨구멍 — 이마 뒤 정수리, 앞으로 볼록한 초승달
        { const dx = (x - 2.9) / .07, dz = z / .13, d = Math.hypot(dx, dz), top = smooth(.6, .9, yr); c = c.map((v) => v * (1 - .4 * smooth(1.1, .8, d) * smooth(.45, .75, d) * smooth(.2, -.4, dx) * top)); }
        // 눈가 — 작고 옅은 회색 테
        for (const e of eyeC) { const d = Math.hypot(x - e[0], y - e[1], z - e[2]); c = mix(c, st.crease, smooth(.12, .07, d) * .5); }
        // 입선 — 주둥이 뒤 뺨 위로 이어져 눈 아래에서 끝난다(이 자리는 몸통 겉이 가장 바깥이다)
        c = mix(c, st.crease, mouthLine(x, y, n) * .85);
        return c;
      }});

  // ── 이마(멜론) — 머리 위를 덮는 큰 돔. 앞으로 부풀고, 아래쪽 반은 안으로 들어가 입술 · 턱이 옆에서 보인다. 윗입술과 맞닿는 곳은 그늘(골) ──
  const MC = [3.64, .2, 0], MR = [1.0 * mk, .86 * mk, .8 * mk], tuck = (th) => 1 - .24 * Math.max(0, -Math.cos(th));
  m.sweep('melon', (s) => { const ang = Math.PI * s, e = Math.max(.015, Math.sin(ang)); return {c: [MC[0] - MR[0] * Math.cos(ang), MC[1], 0], u: [0, 1, 0], v: [0, 0, 1], a: MR[1] * e, b: MR[2] * e, r: tuck}; },
    {ns: 22, nt: 24, island: [0, .56, .3, .74], bone: 'head',
      paint: (p, n) => {
        const rel = [(p[0] - MC[0]) / MR[0], (p[1] - MC[1]) / MR[1], p[2] / MR[2]];
        let c = mix(st.skin, st.back, smooth(.2, .9, rel[1]) * .5);
        c = mix(c, st.crease, smooth(-.45, -.8, rel[1]) * smooth(.1, .6, rel[0]) * .6);
        c = mix(c, st.crease, mouthLine(p[0], p[1], n) * .85);
        return c.map((v) => v * (.97 + .04 * fbm([p[0] * 2, p[1] * 2, p[2] * 2], 3)));
      }});
  // ── 주둥이 — 이마 아래 짧고 넓고 뭉툭한 한 덩어리(2026-11-26 [사용자: "얼굴 부분 디테일이 실제 기준 이미지와 너무 달라 오리입 같아"]) ──
  //   윗입술 · 아래턱을 따로 내밀었더니 오리 부리처럼 보였다. 사진의 주둥이는 머리 아래 폭 그대로 넓은 둥근 덩어리이고 앞이 뭉툭하다.
  //   입선은 그 겉에 판 가는 고랑(입끝에서 뒤로 가다 입꼬리에서 위로 말린다), 아래턱 쪽이 아주 조금 더 앞으로 둥글다. 이마와의 사이는 부드러운 골
  // 입선은 주둥이 가운데보다 아래(앞에서 보면 아래쪽 40% 높이를 가로지르는 미소) — 가운데로 지나게 두면 앞 꼭짓점 둘레에 고리가 패였다
  const SN = {xb: 3.2, xf: 4.66, cy: -.3, a: .42 * (mk * .2 + .8), b: .66 * (mk * .2 + .8)};
  m.sweep('snout', (s) => {
    const ph = s * Math.PI / 2, x = SN.xb + (SN.xf - SN.xb) * Math.sin(ph), env = Math.max(.0005, Math.cos(ph)) /* 끝 고리를 점까지 — .03 이면 반지름 0.07 의 납작한 원판이 앞에 'o' 로 보였다 */, w = 1 - .12 * smooth(.3, 1, s);
    const a = SN.a * Math.pow(env, .55), b = SN.b * w * Math.pow(env, .5), cy = SN.cy;
    return {c: [x, cy, 0], u: [0, 1, 0], v: [0, 0, 1], a, b, e: 2.15, r: (th) => {
      const yy = Math.cos(th) * a + cy, side = Math.abs(Math.sin(th));
      // 입선 고랑 — 앞에서는 둘레를 따라, 옆에서는 입꼬리 쪽으로 올라간다
      const g = Math.exp(-Math.pow((yy - mouthY(Math.min(4.6, x))) / .03, 2)) * (.5 + .5 * side) * smooth(.3, .5, env);
      // 아래턱 — 아래 앞쪽이 아주 조금 더 나온다
      const chin = .05 * Math.max(0, -Math.cos(th)) * smooth(.55, .95, s);
      return 1 - .05 * g + chin;
    }};
  }, {ns: 22, nt: 30, island: [.3, .56, .8, .74], bone: 'head',
    paint: (p, n) => {
      const x = p[0], d = Math.abs(p[1] - mouthY(Math.min(4.6, x)));
      let c = mix(st.belly, st.skin, smooth(-.7, -.1, p[1]) * .6);
      c = mix(c, st.crease, Math.max(smooth(.035, .01, d) * smooth(MOUTH_END, MOUTH_END + .08, x), mouthLine(x, p[1], n)) * .85); // 입선
      c = mix(c, st.crease, smooth(-.12, .02, p[1]) * smooth(.2, .7, n[1]) * .25);           // 이마와의 골 그늘
      return c.map((v) => v * (.97 + .04 * fbm([p[0] * 3, p[1] * 3, p[2] * 3], 3)));
    }});

  // ── 눈 ──
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, st.melon < .9 ? .07 : .06, {ns: 6, nt: 8, island: [.82 + i * .06, .56, .87 + i * .06, .62], bone: 'head',
    paint: (q) => { const d = Math.hypot(q[0] - c[0] - .03, q[1] - c[1] - .03); return d < .016 ? [210, 212, 216] : [30, 32, 40]; }}));

  // ── 가슴지느러미(크고 넓은 둥근 노 — 어깨 아래에서 옆 · 아래 · 뒤로, 가장자리가 위로 살짝 말린다) ──
  const fins = {};
  for (const sd of [-1, 1]) {
    const root = surf(2.0, sd * 2.1, .88), D = norm([-.6, -.5, sd * .62]), L = 1.6 * st.flip;
    let Wd = [1, 0, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0]))); let Nf = norm(cross(D, Wd)); if (Nf[1] < 0) Nf = Nf.map((v) => -v);
    m.sweep('flip' + sd, (s) => ({c: add(add(root, D, L * s), Nf, .2 * st.curl * smooth(.55, 1, s) * s), u: Nf, v: Wd, a: .13 - .08 * s, b: .32 + .4 * Math.sin(Math.PI * Math.min(1, s * .92)) * (1 - .2 * s), e: 2.2,
      r: (th) => 1 + .12 * st.curl * Math.pow(Math.abs(Math.sin(th)), 6) * s}),
      {ns: 12, nt: 14, capEnd: .2, capRings: 3, island: sd < 0 ? [0, .74, .48, .86] : [.5, .74, .98, .86], bone: 'fin' + sd,
        paint: (q, nn, [s]) => { const up = nn[0] * Nf[0] + nn[1] * Nf[1] + nn[2] * Nf[2]; let c = mix(st.belly, st.skin, smooth(-.4, .4, up)); c = mix(c, st.back.map((v) => v * .92), smooth(.7, 1, s) * .3); return c.map((v) => v * (.95 + .08 * fbm([q[0] * 4, q[1] * 4, q[2] * 4], 3))); }});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
  }
  // ── 꼬리지느러미(가로로 넓은 두 날개 — 가운데 홈, 끝이 뒤로 젖혀지고 어른은 뒷가장자리가 물결) ──
  for (const sd of [-1, 1]) {
    const root = [X0 + .12, P(X0).cy, sd * .02], D = norm([-.42, 0, sd]), L = 1.15;
    m.sweep('fluke' + sd, (s) => ({c: add(add(root, D, L * s), [-.3 * s * s - .18, 0, 0], 1), u: [0, 1, 0], v: [1, 0, 0], a: .075 * (1 - .65 * s) + .012, b: .38 * (1 - .6 * s ** 1.3) + .05, e: 2.1,
      r: (th) => 1 + .06 * st.curl * Math.max(0, -Math.sin(th)) * Math.sin(s * Math.PI * 3)}),
      {ns: 10, nt: 12, capEnd: .07, capRings: 2, island: sd < 0 ? [0, .86, .48, .99] : [.5, .86, .98, .99], bone: 'tail',
        paint: (q, nn, [s]) => { let c = mix(st.belly, st.back, smooth(-.4, .5, nn[1])); c = mix(c, st.back.map((v) => v * .92), smooth(.7, 1, s) * .3); return c.map((v) => v * (.95 + .08 * fbm([q[0] * 4, q[1] * 4, q[2] * 4], 3))); }});
  }
  return {m, fins};
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGES);
for (const key of keys) {
  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/polar/beluga-build.mjs', roughness: .45, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'tail') return [[5, 1]];
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .2, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
