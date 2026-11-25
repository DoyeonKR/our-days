// 북극곰 3D — 부위로 짓는다(2026-11-25 [사용자: "북극곰도 만들어볼 수 있어 ? 태초등급으로 … 움직임도 이미지도 정말 이게 실제인지 그래픽인지 알 수없을정도로"])
// 기준(전부 퍼블릭 도메인 · CC0, reference/SOURCES.md):
//   · 몸 비율 · 털빛 · 털 결 — USFWS "Polar bear in Arctic Alaska"(옆으로 선 수컷) → model-art/side-cut.png(cut-side.mjs). 털 결은 사진 조각을 깔면 반복 무늬가 생겨 계산으로 그린다
//   · 헤엄 자세 — "Swimming Polar Bear 2"(Ltshears, 물속 옆모습): 머리 · 목을 앞으로 길게 뻗고, 앞발은 아래로 내려 노처럼 젓고, 뒷다리는 뒤로 끌린다
//   · 머리 · 얼굴 — "Swimming Bear (Unsplash, CC0)": 길고 좁은 머리, 평평한 이마에서 곧게 내려오는 콧등(로마 코), 작은 둥근 귀, 작고 검은 눈, 검은 코 · 입술
//   · 새끼 — USFWS 굴 속 새끼 사진: 머리가 크고 주둥이가 짧고 귀가 크다, 다리가 짧고 몸이 둥글다
// 몸(x: 꼬리 −X → 코 +X, y 위): 몸통 · 목 · 머리는 한 줄의 단면 관 — 단면은 원이 아니다(몸통은 옆이 납작하고 등이 넓은 깊은 통, 머리는 이마가 평평하고 뺨이 넓은 쐐기)
// 다리 넷: 앞다리는 fin 뼈(어깨 → 발) — 게임이 좌우 엇갈려 앞뒤로 젓는다(개헤엄). 뒷다리는 엉덩이 뼈(spine_4 · 5)에 묶여 뒤로 끌린다
// node design/aqua3d-review/polarbear/polarbear-build.mjs [key...]
import {writeFile} from 'node:fs/promises';

import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from '../polar/kit.mjs';

const STAGE = {
  polar_bear: {head: 1, muzzle: 1, ear: 1, leg: 1, body: 1, fluff: 0},
  juv_polar_bear: {head: 1.12, muzzle: .86, ear: 1.15, leg: .92, body: 1.03, fluff: .4},
  fry_polar_bear: {head: 1.32, muzzle: .66, ear: 1.4, leg: .8, body: 1.08, fluff: 1},
};

// 단면 [x, 반높이, 반폭, 중심 y] — 꼬리 쪽 엉덩이부터 코끝까지(헤엄 자세: 머리 · 목을 앞으로 곧게)
const PROF = [
  [-3.7, .45, .42, .18], [-3.4, 1.02, .86, .12], [-2.8, 1.26, 1.04, .06], [-1.9, 1.33, 1.16, 0], [-.8, 1.36, 1.15, .02],
  [.3, 1.4, 1.06, .17], [1.15, 1.12, .88, .24], [1.85, .8, .6, .36], [2.45, .66, .53, .43], [2.95, .6, .53, .45],
  [3.35, .48, .41, .41], [3.75, .34, .29, .33], [4.05, .23, .21, .28], [4.2, .13, .13, .26]];
const NECK = 1.6, SKULL = 2.5;

function build(key) {
  const st = STAGE[key], m = new Model(), cub = st.fluff;
  // 새끼: 머리 쪽(목 뒤)을 크게, 주둥이(눈 앞)를 짧게 — x 를 다시 매긴다
  const EYE0 = 3.2;
  const remapX = (x) => (x <= NECK ? NECK + (x - NECK) * (1 - .14 * cub) : x <= EYE0 ? NECK + (x - NECK) * (1 + (st.head - 1) * .55) : NECK + (EYE0 - NECK) * (1 + (st.head - 1) * .55) + (x - EYE0) * st.muzzle);
  const T = PROF.map(([x, a, b, cy]) => { const hk = smooth(NECK - .3, SKULL, x); const sc = 1 + (st.head - 1) * hk * (1 - .45 * smooth(EYE0, 4.2, x)), bk = 1 + (st.body - 1) * (1 - hk); return [remapX(x), a * sc * bk, b * sc * bk, cy + (st.head - 1) * hk * .25]; });
  const X0 = T[0][0], X1 = T[T.length - 1][0], eyeX = remapX(EYE0), skullX = remapX(SKULL), noseX = remapX(3.95);
  const P = (x) => { let i = 0; while (i < T.length - 2 && x > T[i + 1][0]) i++; const A = T[i], B = T[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t); return {a: A[1] + (B[1] - A[1]) * k, b: A[2] + (B[2] - A[2]) * k, cy: A[3] + (B[3] - A[3]) * k}; };
  // 단면 모양 — 몸통: 옆이 납작(초타원 아님, r 로) · 등은 넓고 평평 · 배는 둥글다 / 머리: 이마 평평 · 정수리 좁게 · 뺨 넓게 · 턱 밑 좁게
  const headK = (x) => smooth(remapX(NECK + .3), skullX, x);
  const hr = (x, th) => {
    const c = Math.cos(th), s2 = Math.sin(th) ** 2, k = headK(x), body = 1 - k;
    const torso = 1 - .09 * s2 * (1 - Math.abs(c)) * 2 + .05 * Math.max(0, c) ** 4 - .05 * Math.max(0, -c) ** 3;          // 옆 납작 · 등 넓게 · 배 둥글게 좁아짐
    const head = 1 - .12 * Math.max(0, c) ** 6 - .1 * Math.max(0, c) * s2 + .06 * Math.exp(-(((c + .15) / .4) ** 2)) * s2 - .1 * Math.max(0, -c - .5) * s2;
    const shag = 1 + (.035 * Math.max(0, -c) ** 2 + .012) * (fbm([x * 3.1, c * 2.2, Math.sin(th) * 2.2], 3) - .5) * 2 * (1 - .6 * k);
    return (body * torso + k * head) * shag;
  };
  const surf = (x, th, kk = 1) => { const p = P(x), q = kk * hr(x, th); return [x, p.cy + Math.cos(th) * p.a * q, Math.sin(th) * p.b * q]; };

  // ── 털빛 · 칠하기 ──
  const CREAM = [247, 242, 228], WARM = [234, 218, 184], SHADE = [196, 182, 156], SKIN = [22, 20, 22];
  const furCol = (p, n, along = [1, 0, 0]) => {
    const [x, y, z] = p, up = n[1];
    // 등은 희고 맑게, 배 · 다리 안쪽은 누렇게(실제 북극곰은 배 · 엉덩이 · 다리가 누렇게 물든다), 목 · 엉덩이에 얼룩
    let c = mix(CREAM, WARM, clamp(smooth(.3, -.7, up) * .75 + .25 * smooth(.35, .75, fbm([x * .6, y * .6, z * .6], 3))));
    c = mix(c, [255, 252, 240], cub * .55);
    // 털 — 흐르는 방향으로 길게 늘인 가닥(옆구리는 아래 · 뒤로, 등 · 배는 뒤로). 사진 조각을 깔면 반복 무늬가 생겨 계산으로 그린다
    //   가닥(가늘고 길다) · 뭉치(가닥 몇십 개가 한 다발 — 다발 사이 골이 조금 어둡다) · 큰 결(완만한 밝기 흐름)
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]), sw = ax + ay + az;
    const sideAlong = -.55 * x - y, sideAcross = x - .55 * y;                       // 옆: 아래 · 뒤로 흐른다
    const st1 = noise(sideAcross * 26, sideAlong * 2.2, z * 1.5), st2 = noise(z * 26 + 9, -x * 2.2, y * 1.5), st3 = noise(z * 26 + 3, -y * 2.2, x * 1.5);
    const strand = (st1 * az + st2 * ay + st3 * ax) / sw;
    const cl1 = fbm([sideAcross * 5, sideAlong * .9, z * .7], 2), cl2 = fbm([z * 5 + 4, -x * .9, y * .7], 2);
    const clump = (cl1 * (az + ax) + cl2 * ay) / sw, groove = smooth(.42, .3, clump);
    const l = 1 + .07 * (strand - .5) * (1 - .3 * cub) + .08 * (clump - .5) - .07 * groove;
    return c.map((v) => clamp(v * l, 0, 255));
  };
  const nose = (x) => smooth(noseX - .02, noseX + .08, x);

  // ── 몸통 · 목 · 머리 ──
  m.sweep('body', (s) => { const x = X0 + (X1 - X0) * s, p = P(x); return {c: [x, p.cy, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => hr(x, th)}; },
    {ns: 54, nt: 30, capStart: .3, capEnd: .14, capRings: 4, capSpanStart: .03, capSpanEnd: .05, island: [0, 0, 1, .56], bone: 'body',
      sMap: (s) => { const x = X0 + (X1 - X0) * s; return x < skullX ? (x - X0) / (skullX - X0) * .55 : .55 + (x - skullX) / (X1 - skullX) * .45; },
      paint: (p, n) => {
        const [x, y, z] = p, pr = P(x), yr = (y - pr.cy) / pr.a, side = Math.abs(z) / pr.b;
        let c = furCol(p, n);
        // 얼굴: 코 · 입술 · 눈가는 검은 살갗(북극곰 살갗은 검다). 콧등은 털이 짧아 조금 어둡고 결이 곱다
        const muzzle = smooth(eyeX + .1, noseX - .2, x);
        c = mix(c, c.map((v) => v * .9), muzzle * .5);
        c = mix(c, SKIN, nose(x));
        // 입 선 — 주둥이 옆 아래, 뒤로 갈수록 살짝 올라가다 눈 아래 못 미쳐 끝
        const mouthY = -.5 - .06 * smooth(noseX, eyeX + .2, x), lipEnd = smooth(eyeX + .3, eyeX + .55, x);
        const lip = smooth(.06, .015, Math.abs(yr - mouthY)) * lipEnd * smooth(.25, .55, side) * (1 - nose(x));
        c = mix(c, SKIN, lip * .9);
        // 눈가 — 눈 둘레 검은 살갗 조금
        for (const e of eyeC) { const d = Math.hypot(x - e[0], y - e[1], z - e[2]); c = mix(c, [60, 54, 50], smooth(eyeR * 2.1, eyeR * 1.2, d)); }
        // 물에 젖은 아랫배 — 조금 짙고 매끈
        c = mix(c, c.map((v) => v * .93), smooth(-.2, -.85, yr) * (1 - headK(x)) * .6);
        return c;
      }});
  // ── 눈 — 작고 검다, 앞 옆을 본다 ──
  const eyeR = .062 * (1 + (st.head - 1) * .9), eyeTh = 1.02, eyeC = [-1, 1].map((sd) => surf(eyeX, sd * eyeTh, .965));
  eyeC.forEach((c, i) => m.sphere('eye' + i, c, eyeR, {island: [.93 + i * .035, .93, .96 + i * .035, .965], bone: 'head',
    paint: (p) => { const d = Math.hypot(p[1] - c[1] - eyeR * .35, p[0] - c[0] - eyeR * .3); return d < eyeR * .22 ? [210, 210, 205] : [24, 16, 12]; }}));
  // ── 코 — 검은 코 패드(앞면이 조금 납작한 덩이) · 콧구멍 ──
  const nx = noseX + .02, np = P(nx);
  m.sweep('nose', (s) => ({c: [nx - .02 + .16 * s, np.cy + np.a * .25, 0], u: [0, 1, 0], v: [0, 0, 1], a: np.a * .46 * Math.sin(Math.PI * clamp(.15 + s * .85)) ** .55, b: np.b * .8 * Math.sin(Math.PI * clamp(.15 + s * .85)) ** .5, e: 2.4}),
    {ns: 8, nt: 14, capStart: .02, capEnd: .04, capRings: 2, island: [.9, .93, .925, .965], bone: 'head',
      paint: (p, n, [s, t]) => { const nost = smooth(.75, .9, s) * smooth(.14, .05, Math.abs(Math.abs(p[2]) - np.b * .38)) * smooth(.15, -.05, p[1] - np.cy - np.a * .25); return mix([30, 28, 30], [6, 5, 6], nost).map((v) => v * (.9 + .2 * noise(p[0] * 40, p[1] * 40, p[2] * 40))); }});
  // ── 귀 — 작고 둥근 반원, 머리 뒤 위 양옆. 안쪽이 조금 어둡다 ──
  for (const sd of [-1, 1]) {
    const base = surf(skullX + .12, sd * .66, .9), out = norm([-.2, .8, sd * .5]), face = norm([1, -.05, sd * .75]), fv = norm(add(face, out, -(face[0] * out[0] + face[1] * out[1] + face[2] * out[2]))), side = norm(cross(out, fv)), er = .2 * st.ear;
    m.sweep('ear' + sd, (s) => ({c: add(base, out, er * .95 * s), u: side, v: fv, a: er * Math.sqrt(Math.max(.04, 1 - (s * .96) ** 2)), b: er * .42 * (1 - .4 * s)}),
      {ns: 8, nt: 12, capEnd: er * .12, capRings: 2, island: sd < 0 ? [.82, .93, .86, .965] : [.86, .93, .9, .965], bone: 'head',
        paint: (p, n) => mix(furCol(p, n), [128, 116, 104], smooth(.2, .75, n[0] * fv[0] + n[1] * fv[1] + n[2] * fv[2]) * .5)});
  }
  // ── 다리 ──
  const legs = [], LEG_ISL = [[0, .56, .25, .78], [.25, .56, .5, .78], [.5, .56, .75, .78], [.75, .56, 1, .78]];
  const bez3 = (p0, p1, p2, p3, t) => p0.map((v, i) => (1 - t) ** 3 * v + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t ** 3 * p3[i]);
  const L = st.leg;
  // 앞다리: 어깨에서 아래로 내려 조금 앞으로(물을 잡는 자세), 넓적한 앞발은 발바닥이 뒤 · 아래를 본다
  for (const sd of [-1, 1]) {
    const sh = remapX(.6), pr = P(sh), root = [sh, pr.cy + pr.a * .05, sd * pr.b * .3];
    const elbow = [sh - .32, pr.cy - pr.a * .98, sd * pr.b * .62], wrist = [sh - .02, pr.cy - pr.a - .95 * L, sd * pr.b * .64], paw = [sh + .6 * L, pr.cy - pr.a - 1.16 * L, sd * pr.b * .64];
    legs.push({sd, front: true, root, tip: paw});
    m.sweep('leg' + sd, (s) => { const c = bez3(root, elbow, wrist, paw, s), d = norm(add(bez3(root, elbow, wrist, paw, Math.min(1, s + .02)), bez3(root, elbow, wrist, paw, Math.max(0, s - .02)), -1));
      const v = [0, 0, 1], u = norm(cross(v, d)), pawK = smooth(.78, .95, s);
      return {c, u, v, a: (.66 - .3 * s - .12 * pawK) * L, b: (.52 - .12 * s + .2 * pawK) * L, e: 2.2, r: (th) => 1 + .05 * (fbm([s * 9, Math.cos(th) * 2, Math.sin(th) * 2 + 4], 2) - .5)}; },
      {ns: 14, nt: 12, capStart: .05, capEnd: .16 * L, capRings: 4, island: LEG_ISL[sd < 0 ? 0 : 1], bone: 'fin' + sd,
        paint: (p, n, [s]) => { let c = furCol(p, n); c = mix(c, c.map((v) => v * .9), smooth(.4, 1, s) * .6); return c; }});
    // 발톱 — 앞발 끝 다섯, 짧고 검다
    for (let i = 0; i < 5; i++) {
      const zz = sd * pr.b * .66 + (i - 2) * .085 * L * (1 - Math.abs(i - 2) * .08), base = [paw[0] - .02 * L - Math.abs(i - 2) * .035 * L, paw[1] - .04 * L, zz], dir = norm([.85, -.5, 0]);
      m.sweep('claw' + sd + i, (q) => ({c: add(base, dir, .11 * L * q), u: [0, 1, 0], v: [0, 0, 1], a: .026 * L * (1 - .9 * q), b: .022 * L * (1 - .9 * q)}),
        {ns: 1, nt: 4, island: [.6 + i * .02 + (sd < 0 ? 0 : .1), .97, .615 + i * .02 + (sd < 0 ? 0 : .1), .99], bone: 'claw' + sd, paint: (p, nn, [q]) => mix([40, 34, 30], [120, 110, 100], q * .4)});
    }
  }
  // 뒷다리: 엉덩이에서 뒤로 끌린다(헤엄칠 때 키), 발바닥이 뒤 · 위를 본다
  for (const sd of [-1, 1]) {
    const hp = remapX(-2.6), pr = P(hp), root = [hp, pr.cy + pr.a * .05, sd * pr.b * .34];
    const knee = [hp - .5 * L, pr.cy - pr.a * .92, sd * pr.b * .66], ankle = [hp - 1.15 * L, pr.cy - pr.a * 1.0, sd * pr.b * .6], paw = [hp - 1.75 * L, pr.cy - pr.a * .86, sd * pr.b * .56];
    legs.push({sd, front: false, root, tip: paw});
    m.sweep('hleg' + sd, (s) => { const c = bez3(root, knee, ankle, paw, s), d = norm(add(bez3(root, knee, ankle, paw, Math.min(1, s + .02)), bez3(root, knee, ankle, paw, Math.max(0, s - .02)), -1));
      const v = [0, 0, 1], u = norm(cross(v, d)), pawK = smooth(.75, .95, s);
      return {c, u, v, a: (.86 - .52 * s - .08 * pawK) * L, b: (.62 - .22 * s + .16 * pawK) * L, e: 2.2, r: (th) => 1 + .05 * (fbm([s * 9, Math.cos(th) * 2, Math.sin(th) * 2 + 8], 2) - .5)}; },
      {ns: 13, nt: 12, capStart: .05, capEnd: .16 * L, capRings: 4, island: LEG_ISL[sd < 0 ? 2 : 3], bone: 'hind',
        paint: (p, n, [s]) => { let c = furCol(p, n); c = mix(c, WARM.map((v) => v * .97), smooth(.2, .8, s) * .35); return c; }});
  }
  // ── 꼬리 — 작고 짧은 털 뭉치 ──
  const tp = P(X0 + .25);
  m.sweep('tail', (s) => ({c: [X0 + .2 - .42 * s, tp.cy + tp.a * .55 - .05 * s, 0], u: [0, 1, 0], v: [0, 0, 1], a: .17 * (1 - .55 * s), b: .2 * (1 - .5 * s)}),
    {ns: 5, nt: 10, capEnd: .08, capRings: 2, island: [.6, .93, .8, .965], bone: 'tail', paint: (p, n) => furCol(p, n)});
  const fl = legs.find((g) => g.front && g.sd < 0), fr = legs.find((g) => g.front && g.sd > 0);
  return {m, fins: {L: {root: fl.root, tip: fl.tip}, R: {root: fr.root, tip: fr.tip}}};
}

export const KEYS = ['fry_polar_bear', 'juv_polar_bear', 'polar_bear'];
const keys = process.argv.slice(2).length ? process.argv.slice(2) : KEYS;
for (const key of keys) {
  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/polarbear/polarbear-build.mjs — USFWS · Ltshears · Unsplash(CC0) photos (public domain)', roughness: .82, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'tail') return [[5, 1]];
    if (part.bone === 'claw1' || part.bone === 'claw-1') return [[part.bone === 'claw1' ? 9 : 7, 1]]; // 발톱은 앞발 끝 뼈에만(밑동이 몸에 묶이면 저을 때 막대처럼 늘어난다)
    if (part.bone === 'hind') return [[4, .55 * (1 - s) + .1], [5, .45 * (1 - s) + .9 * s - .1 * s]].map(([b, w]) => [b, Math.max(0, w)]);
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 8 : 6, k = smooth(0, .18, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
