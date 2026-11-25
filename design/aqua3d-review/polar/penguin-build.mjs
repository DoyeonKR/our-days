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
  fry_emperor_penguin: {chick: true, juv: false, fat: 1.3, bill: .62, wing: 1.5},
};
// 몸 단면(x: 꼬리 -4.3 → 머리 앞 3.95). 새끼는 더 짧고 통통하다
// 2026-11-25 — 예전엔 목(2.35)이 잘록했다가 머리(2.95)가 다시 부풀어 공을 몸에 얹은 모양이었다. 황제펭귄 헤엄 자세는 몸 → 목 → 머리가 한 줄로 가늘어지는 어뢰다
const PROF = [[-4.3, .32, .3, .1], [-3.7, .78, .68, .02], [-2.5, 1.22, 1.1, -.06], [-1.0, 1.5, 1.34, -.1], [.4, 1.48, 1.32, -.08], [1.6, 1.26, 1.12, .02],
  [2.35, 1.0, .9, .1], [2.95, .86, .78, .2], [3.45, .64, .56, .3], [3.95, .32, .29, .32]];
// 새끼는 큰 둥근 머리가 몸과 나뉜다(목이 잘록)
const PROF_CHICK = [[-3.2, .4, .38, .06], [-2.6, 1.0, .92, 0], [-1.4, 1.45, 1.36, -.06], [0, 1.6, 1.5, -.06], [1.2, 1.4, 1.3, 0], [1.85, 1.0, .94, .12],
  [2.4, 1.08, 1.0, .24], [2.85, 1.02, .96, .26], [3.2, .88, .84, .26], [3.45, .7, .67, .25], [3.63, .47, .45, .24], [3.74, .22, .21, .23]];
const profOf = (T) => (x) => { let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++; const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t); return {a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k}; };

function build(key) {
  const st = STAGES[key], m = new Model(), T = st.chick ? PROF_CHICK : PROF, P0 = profOf(T), X0 = T[0][0], X1 = T[T.length - 1][0];
  const headX = st.chick ? 2.55 : 2.95, neckX = st.chick ? 1.9 : 2.35;
  // 머리 단면 — 2026-11-25 [사용자: "펭귄 얼굴이 너무 부자연스러운 원형이야"] 예전엔 머리가 거의 둥근 원기둥 끝이라 정면에서 동그란 공이었다.
  //   진짜 펭귄 머리: 옆으로 납작(높이보다 폭이 좁다) · 정수리는 좁고 평평하게 · 눈 아래 뺨이 조금 불룩 · 턱 밑으로 좁아지며 목에 이어진다
  const headK = (x) => smooth(neckX - .15, headX + .1, x);
  const hr = (x, th) => { const k = headK(x), c = Math.cos(th), s = Math.sin(th) ** 2; return 1 - k * (.17 * Math.max(0, c) * s + .12 * Math.max(0, c) ** 6 - .07 * Math.exp(-(((c + .3) / .35) ** 2)) * s + .08 * Math.max(0, -c - .55) * s); };
  const P = (x) => { const p = P0(x); return {...p, b: p.b * (1 - .24 * headK(x))}; };
  const surf = (x, th, k = 1) => { const p = P(x), q = k * hr(x, th); return [x, p.cy + Math.cos(th) * p.a * q, Math.sin(th) * p.b * q]; };
  const eyeX = st.chick ? 3.05 : 3.3, eyeC = [-1, 1].map((sd) => surf(eyeX, sd * 1.05, .96));
  // 2026-11-25 3차 — 머리는 새까맣고 등은 그보다 밝은 청회색(예전엔 등까지 거의 검정에 큰 얼룩)
  const BLACK = st.juv ? [62, 66, 76] : [26, 30, 40], BACK = st.juv ? [96, 104, 118] : [74, 88, 108], HEAD = st.juv ? [40, 42, 48] : [10, 11, 14];

  // ── 몸통 ──
  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => hr(x, th)}; },
    {ns: 52, nt: 28, capStart: .2, capEnd: st.chick ? .08 : .26, capRings: 6, capSpanStart: .03, capSpanEnd: .1, island: [0, 0, 1, .62], bone: 'body',
      sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < neckX ? (x - X0) / (neckX - X0) * .6 : .6 + (x - neckX) / (X1 - neckX) * .4; },
      paint: (p, n) => {
        const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / pr.a, side = Math.abs(z) / pr.b;
        // 깃털 결 — 큰 얼룩(예전 fbm 6) 대신 촘촘한 비늘 같은 깃 + 아주 옅은 굵은 결
        const fx = x * 26 + .6 * Math.sin(z * 9), fz = z * 30, cell = Math.hypot(fx - Math.round(fx), (fz + (Math.round(fx) % 2) * .5) - Math.round(fz + (Math.round(fx) % 2) * .5));
        const grain = .95 + .07 * fbm([x * 3, y * 3, z * 3], 2) + .07 * smooth(.25, .5, cell) + .05 * (noise(x * 55, y * 55, z * 55) - .5);
        if (st.chick) {
          // 새끼: 은회색 솜털, 검은 머리 · 흰 얼굴 가면(눈 둘레 · 뺨 · 턱)
          let c = mix([186, 189, 194], [150, 154, 160], smooth(-.4, .6, n[1]) * .5 + smooth(.4, -.8, yr) * .5);
          const head = smooth(headX - .55, headX - .2, x);
          c = mix(c, [18, 19, 24], head);
          // 얼굴 가면(2026-11-25 — 예전엔 앞면 전체가 흰 원판이라 정면에서 접시 같았다): 눈 둘레 · 뺨 · 턱은 희고, 정수리 · 뒷머리는 검다.
          //   가장자리는 솜털이라 부드럽게, 정수리 선은 뒤로 갈수록 내려간다
          const eyeY = (eyeC[0][1] - pr.cy) / pr.a, front = smooth(headX - .55, headX - .1, x), crown = eyeY + .3 - .35 * smooth(headX + .2, headX - .5, x);
          const mask = head * front * smooth(crown + .1, crown - .1, yr) * (.85 + .15 * noise(x * 18, y * 18, z * 18));
          c = mix(c, [242, 242, 238], mask);
          const throat = smooth(headX - .5, headX - .1, x) * smooth(-.05, -.5, yr) * (1 - smooth(.65, .95, side)); c = mix(c, [236, 236, 232], throat);
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
          // 귀 무늬(2026-11-25 — 예전엔 목 아래 옆에 길쭉한 덩이로 떨어져 있었다): 눈 바로 뒤 눈높이에서 시작해 목 옆을 따라 뒤 · 아래로 흐르는 쉼표.
          //   위쪽은 진한 주황 · 노랑, 아래로 갈수록 연해져 가슴의 옅은 노랑으로 잇는다
          const A = [eyeX - .38, eyeC[0][1] - .1], Bp = [neckX - .1, P(neckX).cy - P(neckX).a * .62], ab = [Bp[0] - A[0], Bp[1] - A[1]], abL = Math.hypot(...ab);
          const tt = clamp(((x - A[0]) * ab[0] + (y - A[1]) * ab[1]) / (abL * abL)), px = A[0] + ab[0] * tt, py = A[1] + ab[1] * tt, dist = Math.hypot(x - px, y - py);
          const wdt = .36 * (1 - tt) ** .8 + .1 + .04 * Math.sin(tt * Math.PI), ear = smooth(wdt, wdt * .15, dist) * smooth(.28, .55, side) * smooth(-.15, .05, ((x - A[0]) * ab[0] + (y - A[1]) * ab[1]) / (abL * abL));
          const earCol = st.juv ? [230, 228, 220] : mix(mix([236, 134, 22], [250, 196, 60], smooth(0, .45, tt)), [252, 232, 150], smooth(.5, 1, tt));
          c = mix(c, earCol, ear);
          if (!st.juv) { const chest = smooth(neckX - 1.6, neckX - .3, x) * (1 - smooth(neckX + .2, neckX + .5, x)) * smooth(-.2, -.6, yr) * smooth(1.05, .4, side); c = mix(c, [252, 230, 150], chest * .7); }
        }
        return c.map((v) => v * grain);
      }});

  // ── 부리(2026-11-25 — 예전엔 위 · 아래 두 쪽이 따로 떠 젓가락 둘로 보였다) — 머리 속에서 시작해 한 덩어리로 가늘어지며 아래로 살짝 휜다.
  //    단면은 위아래로 높고 옆으로 좁다. 윗부리 검정, 아랫부리 옆 뿌리 쪽 반에 주황 · 분홍 판(어린 개체는 흐린 살구색, 새끼는 검정)
  const B = st.bill, b0 = X1 - .42, bp = P(b0);
  m.sweep('bill', (s) => ({c: [b0 + (B + .42) * s, bp.cy - .02 - .16 * B * s * s, 0], u: norm([.12 * s, 1, 0]), v: [0, 0, 1], a: (st.chick ? .24 : .27) * (1 - .9 * s ** .7) + .012, b: (st.chick ? .2 : .19) * (1 - .88 * s ** .7) + .01, e: 2.1}),
    {ns: 14, nt: 14, capEnd: .03, capRings: 2, island: [0, .62, .3, .74], bone: 'head',
      paint: (p, n, [s, t]) => {
        const low = Math.cos(t * Math.PI * 2), side = Math.abs(Math.sin(t * Math.PI * 2));
        let c = [16, 16, 20];
        if (!st.chick) {
          const plate = smooth(-.45, .05, low) * smooth(.66, .36, s) * smooth(.03, .1, s);
          c = mix(c, st.juv ? [206, 170, 150] : [238, 126, 96], plate);
          // 부리 끝 쪽 아랫선을 따라 가는 분홍 줄
          c = mix(c, st.juv ? [150, 130, 120] : [214, 108, 92], smooth(.55, .85, low) * smooth(.75, .45, s) * .6);
        }
        // 부리 결(뿌리 쪽 살짝 밝다)
        return c.map((v) => v * (1 + .25 * smooth(.25, 0, s)));
      }});
  // ── 눈 ──
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, st.chick ? .11 : .085, {island: [.31 + i * .05, .62, .35 + i * .05, .68], bone: 'head', paint: (p) => { const d = Math.hypot(p[0] - c[0] - .04, p[1] - c[1] - .04); return d < .02 ? [220, 220, 220] : [10, 10, 14]; }}));

  // ── 날개(납작한 노 — 옆으로 뻗어 뒤로 젖힌다. 윗면 검정 · 아랫면 흰색 · 흰 뒷가장자리) ──
  const fins = {}, wingX = st.chick ? .8 : 1.3;
  for (const sd of [-1, 1]) {
    // 날개(2026-11-25 — 예전엔 두께 0.09 의 판이 옆으로 곧게 뻗어 정면에서 바늘 둘이었다). 앞가장자리가 두툼한 노가 어깨에서 뒤 · 아래로 젖혀지고 끝이 뒤로 휜다
    const root = surf(wingX, sd * 1.62, .82), D = norm([-.7, -.42, sd * .58]), L = st.wing * .88;
    let Wd = [1, .1, 0]; Wd = norm(add(Wd, D, -(Wd[0] * D[0] + Wd[1] * D[1]))); const Nf = norm(cross(D, Wd));
    m.sweep('wing' + sd, (s) => ({c: add(add(root, D, L * s), Wd, -.28 * s * s), u: Nf, v: Wd, a: .13 - .085 * s, b: (st.chick ? .36 : .46) * (1 - .5 * s ** 1.5) + .04, e: 2.2,
      r: (th) => 1 + .25 * Math.max(0, Math.sin(th)) * (1 - s)}),
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
