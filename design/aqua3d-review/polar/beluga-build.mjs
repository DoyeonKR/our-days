// 흰고래(벨루가) 3D — 부위로 짓는다(2026-11-26 [사용자: "개체 추가해줘 자신있는 개체로"])
// 비율은 흰고래 해부 · 사진 자료에서 널리 알려진 값을 눈으로 옮겼다(그림 · 사진 픽셀은 쓰지 않는다). 무늬 · 주름은 3D 위치로 칠한다.
// 생김새: 통통한 몸 · 목이 있어 머리 뒤가 살짝 잘록 · 크고 둥근 이마(멜론)가 짧은 주둥이 위로 튀어나온다 · 입꼬리가 올라간 입선(웃는 얼굴) ·
//   작은 눈(입꼬리 뒤 위) · 등지느러미 대신 낮은 등 능선 · 넓고 둥근 노 모양 가슴지느러미(어른은 끝이 위로 말린다) · 넓은 꼬리지느러미(가운데 홈).
// 색: 새끼는 짙은 청회색, 어린 개체는 옅은 회색, 어른은 크림빛 흰색(등 능선 · 흉터 자국은 조금 짙다).
// node design/aqua3d-review/polar/beluga-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from './kit.mjs';

const STAGES = {
  beluga: {skin: [238, 236, 228], back: [226, 222, 204], belly: [246, 245, 240], melon: 1, curl: 1, scar: 1, fat: 1, flip: 1},
  juv_beluga: {skin: [184, 190, 198], back: [160, 168, 178], belly: [214, 218, 222], melon: .9, curl: .5, scar: .3, fat: .97, flip: .95},
  fry_beluga: {skin: [112, 118, 130], back: [92, 98, 110], belly: [150, 156, 166], melon: .78, curl: 0, scar: 0, fat: 1.08, flip: .85},
};
// 몸 단면(x: 꼬리자루 -4.6 → 주둥이 끝 4.42). a 높이 반 · b 폭 반 · cy 중심 높이. 4.0 부터 주둥이가 멜론 아래로 내려간다
// 꼬리자루는 옆으로 납작하고 위아래로 높다(용골). 멜론은 3.3 ~ 4.0 에서 높게 버티다가 4.0 뒤로 짧은 주둥이로 뚝 떨어진다
const PROF = [[-4.6, .24, .11, .04], [-4.0, .44, .26, .04], [-3.0, .7, .58, .02], [-1.8, .98, .94, 0], [-.5, 1.12, 1.1, -.02], [.8, 1.12, 1.1, -.03],
  [1.8, .98, .96, -.01], [2.35, .86, .84, .01], [2.9, .93, .86, .1], [3.4, .98, .82, .15], [3.8, .86, .72, .11], [4.04, .53, .45, -.14], [4.22, .31, .3, -.24], [4.42, .18, .19, -.28]];
const profOf = (fat, melonK) => (x) => {
  let i = 0; while (i < PROF.length - 2 && x > PROF[i + 1][0]) i++;
  const A = PROF[i], B = PROF[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t), body = 1 - smooth(2.2, 2.9, x);
  const f = fat * body + 1 * (1 - body);
  return {a: (A[1] + (B[1] - A[1]) * k) * f, b: (A[2] + (B[2] - A[2]) * k) * f, cy: A[3] + (B[3] - A[3]) * k};
};
const X0 = -4.6, X1 = 4.42;
// 멜론(이마) — 눈 앞 위가 둥글게 솟아 주둥이 위로 내민다. 몸통 단면의 윗쪽을 부풀린다
const melonBump = (x, k) => k * Math.exp(-Math.pow((x - 3.55) / .6, 2));

function build(key) {
  const st = STAGES[key], m = new Model(), P = profOf(st.fat, st.melon);
  // 2026-11-26 — 좁은 혹(cos^1.3 · 0.42)은 정수리에 뾰족한 혹으로 솟았다. 머리 단면 자체를 높이고(PROF) 멜론은 넓고 낮게 — 둥근 돔이 앞 · 위로 부풀게
  const R = (x, th) => 1 + .12 * melonBump(x, st.melon) * Math.pow(Math.max(0, Math.cos(th - .25 * Math.sign(Math.sin(th)) * 0)), .7) * (1 - .3 * Math.abs(Math.sin(th)))
    // 등 능선 — 등 한가운데 가는 줄이 몸 가운데에서 꼬리 쪽으로(등지느러미 자리)
    + .05 * Math.exp(-Math.pow(th / .14, 2)) * smooth(-2.6, -1.4, x) * (1 - smooth(.2, .9, x))
    // 목 — 머리 뒤가 아주 살짝 잘록하고 옆으로 접힌다
    - .018 * Math.exp(-Math.pow((x - 2.45) / .32, 2)) * Math.abs(Math.sin(th));
  const surf = (x, th, k = 1) => { const p = P(x), r = R(x, th) * k; return [x, p.cy + Math.cos(th) * p.a * r, Math.sin(th) * p.b * r]; };
  const eyeX = 3.55, eyeC = [-1, 1].map((sd) => surf(eyeX, sd * 1.72, .97));
  // 입선 — 주둥이 끝 아래에서 뒤로 가며 올라가는 곡선(입꼬리가 눈 아래 앞)
  const mouthY = (x) => P(x).cy - P(x).a * (.32 - .55 * smooth(4.35, 3.7, x));

  // ── 몸통 ──
  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => R(x, th)}; },
    {ns: 58, nt: 30, capStart: .12, capEnd: .16, capRings: 5, capSpanStart: .02, capSpanEnd: .08, island: [0, 0, 1, .64], bone: 'body',
      sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < 2.2 ? (x - X0) / (2.2 - X0) * .62 : .62 + (x - 2.2) / (X1 - 2.2) * .38; },
      paint: (p, n) => {
        const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / (pr.a * R(x, 0));
        // 등은 조금 짙고(크림 · 회색) 배는 밝다 — 경계는 부드럽게
        let c = mix(st.belly, st.skin, smooth(-.7, .1, yr));
        c = mix(c, st.back, smooth(.35, .95, yr) * .8);
        // 등 능선 — 거칠고 조금 짙다, 작은 홈들
        const ridge = Math.exp(-Math.pow(Math.atan2(z, y - pr.cy) / .16, 2)) * smooth(-2.6, -1.4, x) * (1 - smooth(.2, .9, x));
        c = c.map((v) => v * (1 - .1 * ridge * (.6 + .8 * noise(x * 9, y * 9, z * 9))));
        // 살갗 결 — 아주 옅은 얼룩 + 고운 결
        c = c.map((v) => v * (.95 + .07 * fbm([x * 1.4, y * 1.4, z * 1.4], 3) + .03 * (noise(x * 30, y * 30, z * 30) - .5)));
        // 흉터 · 긁힌 자국(어른) — 얼음 · 다른 고래에 긁힌 옅은 회색 줄. 몇 개만
        if (st.scar) {
          // 2026-11-26 — 3D 잡음의 능선은 몸 전체에 그물(깨진 타일)로 깔렸다. 비스듬한 평행 긁힘 몇 묶음만: 묶음 자리는 굵은 잡음이 높은 곳
          const band = smooth(.7, .8, noise(x * .55 + 11, y * .55, z * .55)), stripe = Math.pow(Math.abs(Math.sin((x * 1.0 + y * 2.4) * 9)), 30);
          c = c.map((v) => v * (1 - .12 * band * stripe * st.scar));
        }
        // 목 주름 — 머리 뒤 옆으로 부드러운 고랑 셋
        const neck = Math.exp(-Math.pow((x - 2.45) / .28, 2)) * smooth(.3, .8, Math.abs(n[2]));
        c = c.map((v) => v * (1 - .05 * neck * Math.pow(Math.abs(Math.sin((x - 2.45) * 12 + y * 1.5)), 6)));
        // 입선 — 짙은 회색 가는 줄, 입술 쪽은 조금 분홍빛 회색
        if (x > 3.62) {
          const my = mouthY(x), d = Math.abs(y - my), side = smooth(.25, .6, Math.abs(z) / Math.max(.05, pr.b));
          c = mix(c, [118, 112, 114], smooth(.03, .012, d) * Math.max(side, smooth(4.25, 4.4, x)));
          c = mix(c, c.map((v) => v * .9 + 8), smooth(.12, .03, d) * smooth(3.9, 4.2, x) * .4);
        }
        // 숨구멍 — 멜론 뒤 정수리의 초승달
        // 앞으로 볼록한 초승달(뒤쪽 반 고리만) — 예전 고리 전체는 위에서 'O' 자로 보였다
        { const dx = (x - 2.92) / .07, dz = z / .13, d = Math.hypot(dx, dz); const top = smooth(.6, .9, yr); c = c.map((v) => v * (1 - .45 * smooth(1.1, .8, d) * smooth(.45, .75, d) * smooth(.2, -.4, dx) * top)); }
        // 눈가 — 작고 짙은 테
        for (const e of eyeC) { const d = Math.hypot(x - e[0], y - e[1], z - e[2]); c = mix(c, c.map((v) => v * .72), smooth(.13, .07, d)); }
        return c;
      }});

  // ── 눈 ──
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, st.melon < .8 ? .07 : .06, {ns: 6, nt: 8, island: [.02 + i * .05, .65, .06 + i * .05, .7], bone: 'head',
    paint: (q) => { const d = Math.hypot(q[0] - c[0] - .03, q[1] - c[1] - .03); return d < .016 ? [210, 210, 214] : [24, 22, 28]; }}));

  // ── 가슴지느러미(넓고 둥근 노 — 어깨 아래에서 옆 · 아래 · 뒤로, 어른은 끝이 위로 말린다) ──
  const fins = {};
  for (const sd of [-1, 1]) {
    const root = surf(2.0, sd * 2.15, .86), D = norm([-.64, -.5, sd * .58]), L = 1.3 * st.flip;
    let Wd = [1, 0, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0]))); let Nf = norm(cross(D, Wd)); if (Nf[1] < 0) Nf = Nf.map((v) => -v);
    m.sweep('flip' + sd, (s) => ({c: add(add(root, D, L * s), Nf, .22 * st.curl * smooth(.55, 1, s) * s), u: Nf, v: Wd, a: .14 - .09 * s, b: .26 + .3 * Math.sin(Math.PI * Math.min(1, s * .95)) * (1 - .25 * s), e: 2.2}),
      {ns: 12, nt: 14, capEnd: .16, capRings: 3, island: sd < 0 ? [.15, .65, .45, .8] : [.5, .65, .8, .8], bone: 'fin' + sd,
        paint: (q, nn, [s]) => {
          const up = nn[0] * Nf[0] + nn[1] * Nf[1] + nn[2] * Nf[2];
          let c = mix(st.belly, st.skin, smooth(-.4, .4, up));
          // 가장자리 · 끝은 조금 짙다(어린 개체에서 뚜렷)
          c = mix(c, st.back.map((v) => v * .9), smooth(.6, 1, s) * .35);
          return c.map((v) => v * (.94 + .1 * fbm([q[0] * 4, q[1] * 4, q[2] * 4], 3)));
        }});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
  }
  // ── 꼬리지느러미(가로로 넓은 두 날개 — 가운데 홈, 끝이 뒤로 젖혀지고 어른은 뒷가장자리가 물결) ──
  for (const sd of [-1, 1]) {
    const root = [X0 + .12, P(X0).cy, sd * .02], D = norm([-.42, 0, sd]), L = 1.15;
    m.sweep('fluke' + sd, (s) => ({c: add(add(root, D, L * s), [-.3 * s * s - .18, 0, 0], 1), u: [0, 1, 0], v: [1, 0, 0], a: .075 * (1 - .65 * s) + .012, b: .38 * (1 - .6 * s ** 1.3) + .05, e: 2.1,
      r: (th) => 1 + .06 * st.curl * Math.max(0, -Math.sin(th)) * Math.sin(s * Math.PI * 3)}),
      {ns: 10, nt: 12, capEnd: .07, capRings: 2, island: sd < 0 ? [0, .82, .48, .98] : [.5, .82, .98, .98], bone: 'tail',
        paint: (q, nn, [s]) => { let c = mix(st.belly, st.back, smooth(-.4, .5, nn[1])); c = mix(c, st.back.map((v) => v * .92), smooth(.7, 1, s) * .3); return c.map((v) => v * (.94 + .1 * fbm([q[0] * 4, q[1] * 4, q[2] * 4], 3))); }});
  }
  return {m, fins};
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGES);
for (const key of keys) {
  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/polar/beluga-build.mjs', roughness: .5, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'tail') return [[5, 1]];
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .2, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
