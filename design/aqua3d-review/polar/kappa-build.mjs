// 갓파 3D — 부위로 짓는다(2026-11-26 [사용자: "이벤트로 갓파쿠도 잡히게 해줘 기준이미지 줄게" → "최대한 유사하게 만들어 허락받았어"])
// 기준: 사용자가 보낸 그림 둘(서 있는 모습 · 앉은 모습). 그림 픽셀은 쓰지 않고 생김새만 눈으로 옮겼다.
// 생김새: 큰 머리(몸의 절반 가까이) · 동그랗고 큰 흰 눈에 커다란 검은 눈동자(반짝이 점) · 넓고 납작한 연둣빛 부리(입꼬리가 살짝 올라감) ·
//   머리 둘레를 덮는 덥수룩한 갈색 머리칼(앞머리는 이마를 덮는다) · 정수리의 옅은 연두색 접시 · 초록 살갗에 짙은 초록 가로 줄무늬 ·
//   배는 연한 초록 · 가는 팔다리, 손발은 세 갈래 물갈퀴 손가락 끝에 작은 발톱.
// 수조에서는 엎드려 헤엄치는 자세(+X 머리) — 팔은 앞옆으로 젓고(fin 뼈) 다리는 뒤로 뻗어 개구리처럼 찬다(꼬리 뼈).
// node design/aqua3d-review/polar/kappa-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from './kit.mjs';

const STAGES = {
  kappa: {head: 1, limb: 1, hair: 1, stripe: 1, eye: 1},
  juv_kappa: {head: 1.06, limb: .92, hair: .9, stripe: .9, eye: 1.05},
  fry_kappa: {head: 1.16, limb: .78, hair: .75, stripe: .7, eye: 1.12},
};
const GREEN = [116, 168, 84], DARK = [62, 104, 52], BELLY = [176, 206, 132], HAIR = [164, 116, 68], HAIR_D = [116, 78, 46], BEAK = [206, 214, 120], BEAK_D = [150, 160, 80], DISH = [196, 222, 168];

// 줄무늬 — 몸 · 팔다리를 감는 짙은 띠(그림처럼 가늘고 고르지 않게, 끝이 뾰족하게 끊긴다)
const stripeAt = (t, p, k) => { const w = Math.sin(t * Math.PI * 2 + 1.3 * fbm([p[0] * 1.2, p[1] * 1.2, p[2] * 1.2], 2)); return smooth(.55, .8, w) * smooth(.25, .6, noise(p[0] * 2.2 + 3, p[1] * 2.2, p[2] * 2.2) + .25) * k; };
const skin = (p, n, t, st, belly = 0) => { let c = mix(GREEN, BELLY, belly); c = mix(c, DARK, stripeAt(t, p, st.stripe) * (1 - belly * .7)); return c.map((v) => v * (.94 + .1 * fbm([p[0] * 3, p[1] * 3, p[2] * 3], 3))); };

/** 타원체 — x 를 각도로 매긴다(양 끝이 둥글다). axis 로 긴 축 방향을 돌릴 수 있다 */
function ell(m, name, c, rx, ry, rz, opt) {
  return m.sweep(name, (s) => { const a = Math.PI * s, e = Math.max(.012, Math.sin(a)); return {c: add(c, [-rx * Math.cos(a), 0, 0]), u: [0, 1, 0], v: [0, 0, 1], a: ry * e, b: rz * e, r: opt.r}; }, {ns: opt.ns ?? 16, nt: opt.nt ?? 18, ...opt});
}
/** 축을 따라 늘인 관(팔다리 · 손가락) — from 에서 dir 로 L, 반지름 r0 → r1 */
function limb(m, name, from, dir, L, r0, r1, opt) {
  const D = norm(dir); let U = Math.abs(D[1]) > .9 ? [1, 0, 0] : [0, 1, 0]; U = norm(add(U, D, -(U[0] * D[0] + U[1] * D[1] + U[2] * D[2]))); const V = norm(cross(D, U));
  return m.sweep(name, (s) => ({c: add(from, D, L * s), u: U, v: V, a: r0 + (r1 - r0) * s, b: (r0 + (r1 - r0) * s) * (opt.flat ?? 1)}), {ns: opt.ns ?? 6, nt: opt.nt ?? 8, capEnd: opt.cap ?? (r1 * .9), capRings: 2, ...opt});
}

function build(key) {
  const st = STAGES[key], m = new Model(), H = st.head, Lm = st.limb;
  // ── 몸통(작고 가늘다 — 가슴이 조금 넓고 배가 둥글다) ──
  const TP = [[-1.7, .34, .3], [-1.1, .5, .44], [-.2, .58, .52], [.7, .56, .5], [1.4, .44, .42], [1.8, .32, .3]];
  const tp = (x) => { let i = 0; while (i < TP.length - 2 && x > TP[i + 1][0]) i++; const A = TP[i], B = TP[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), k = t * t * (3 - 2 * t); return [A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]; };
  m.sweep('torso', (s) => { const x = -1.7 + 3.5 * s, [a, b] = tp(x); return {c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a, b}; },
    {ns: 16, nt: 14, capStart: .2, capEnd: .1, capRings: 3, island: [0, 0, .5, .3], bone: 'body',
      paint: (p, n, [s, t]) => skin(p, n, p[0] * .9, st, smooth(-.2, -.75, n[1]))});

  // ── 머리(큰 공 — 아래가 조금 좁고 뒤통수가 둥글다) ──
  const HC = [2.55, .12, 0], HR = [.98 * H, .92 * H, .96 * H];
  ell(m, 'head', HC, HR[0], HR[1], HR[2], {ns: 16, nt: 20, island: [0, .3, .5, .62], bone: 'head',
    r: (th) => 1 - .1 * Math.max(0, -Math.cos(th)),
    paint: (p, n) => { const yr = (p[1] - HC[1]) / HR[1]; let c = skin(p, n, (p[1] - HC[1]) * 1.6 + p[0] * .25, st, smooth(-.3, -.85, yr) * .6); return c; }});
  const headSurf = (u, v, k = 1) => [HC[0] + HR[0] * k * Math.cos(v) * Math.cos(u), HC[1] + HR[1] * k * Math.sin(v), HC[2] + HR[2] * k * Math.cos(v) * Math.sin(u)];

  // ── 눈(크고 동그란 흰 눈 — 얼굴 앞 위쪽에 툭 튀어나온다. 검은 눈동자가 크고 반짝이 점 둘) ──
  const ER = .37 * st.eye * H; // 기준 그림처럼 얼굴 폭의 3분의 1 가까이
  for (const sd of [-1, 1]) {
    const c = headSurf(sd * .48, .32, .86);
    ell(m, 'eye' + sd, c, ER, ER * 1.04, ER, {ns: 12, nt: 14, island: sd < 0 ? [.5, .3, .62, .42] : [.62, .3, .74, .42], bone: 'head',
      paint: (p, n) => {
        // 눈동자는 앞(+x)과 조금 안쪽 · 아래를 본다
        const look = norm([1, -.1, -sd * .28]), d = n[0] * look[0] + n[1] * look[1] + n[2] * look[2];
        let col = [250, 250, 246];
        col = mix(col, [16, 16, 20], smooth(.55, .62, d));
        // 반짝이 — 눈동자 위쪽에 큰 점 하나 · 작은 점 하나
        const h1 = norm([.86, .32, -sd * .18]), h2 = norm([.95, -.05, -sd * .38]);
        const s1 = n[0] * h1[0] + n[1] * h1[1] + n[2] * h1[2], s2 = n[0] * h2[0] + n[1] * h2[1] + n[2] * h2[2];
        col = mix(col, [255, 255, 255], smooth(.975, .985, s1)); col = mix(col, [255, 255, 255], smooth(.993, .996, s2));
        // 흰자 가장자리에 옅은 선
        col = mix(col, [60, 60, 60], smooth(.15, .02, d + .9) * .6);
        return col;
      }});
  }
  // ── 부리(넓고 납작한 연둣빛 — 얼굴 앞 아래에서 앞으로, 끝이 둥글고 살짝 아래로. 입선이 양옆으로 올라간다) ──
  {
    const b0 = headSurf(0, -.2, .82);
    m.sweep('beak', (s) => { const ph = s * Math.PI / 2, x = b0[0] + .62 * H * Math.sin(ph), env = Math.max(.02, Math.cos(ph)); return {c: [x, b0[1] - .1 * s * s, 0], u: [0, 1, 0], v: [0, 0, 1], a: .2 * H * Math.pow(env, .5), b: .4 * H * Math.pow(env, .35), e: 2.4}; },
      {ns: 12, nt: 18, island: [.74, .3, .99, .42], bone: 'head',
        paint: (p, n) => {
          let c = mix(BEAK, BEAK_D, smooth(.1, -.6, n[1]) * .5);
          // 입선 — 부리 가운데 높이를 가로질러 양 끝이 위로
          const mid = b0[1] - .02 + .12 * Math.pow(Math.abs(p[2]) / (.4 * H), 2);
          c = mix(c, [110, 90, 70], smooth(.025, .008, Math.abs(p[1] - mid)) * .85);
          // 콧구멍 둘
          for (const sd of [-1, 1]) { const d = Math.hypot((p[0] - (b0[0] + .42 * H)) / .05, (p[2] - sd * .1 * H) / .035, (p[1] - (b0[1] + .14 * H)) / .06); c = mix(c, [90, 90, 60], smooth(1.2, .6, d)); }
          return c;
        }});
  }
  // ── 접시(정수리 — 옅은 연두색 납작한 원판, 가장자리가 조금 도톰) ──
  {
    const top = add(headSurf(0, Math.PI / 2 - .12, .97), [0, .11 * H, 0]); // 머리칼 덩이 위로 — 정수리에 접시가 보이게
    m.sweep('dish', (s) => { const a = Math.PI * s, e = Math.max(.02, Math.sin(a)); return {c: [top[0] - .3 * H * Math.cos(a), top[1] + .02, 0], u: [0, 1, 0], v: [0, 0, 1], a: .08 * e, b: .34 * H * e, r: (th) => 1 + .3 * Math.max(0, Math.cos(th)) * (1 - e)}; },
      {ns: 10, nt: 16, island: [.5, .42, .7, .5], bone: 'head', paint: (p, n) => mix(DISH, DISH.map((v) => v * .85), smooth(.6, .95, Math.abs(p[2]) / (.32 * H))) });
  }
  // ── 머리칼 — 머리 위를 통째로 덮는 덥수룩한 갈색 덩이(가발처럼) + 가장자리에 늘어진 굵은 가닥 ──
  //   2026-11-26 처음 판은 가는 가닥 마흔여섯이 듬성듬성해 발톱처럼 보였다. 기준 그림의 머리칼은 접시 둘레부터 머리를 덮고
  //   앞머리는 눈 바로 위까지, 옆은 눈높이 아래 뺨까지, 뒤는 목덜미까지 내려오며 끝이 삐죽삐죽하다
  const hairLine = (dirx, dirz) => { const front = Math.max(0, dirx), back = Math.max(0, -dirx); return .5 * front + .08 * (1 - front - back) - .25 * back; };
  {
    const CR = HR.map((v) => v * 1.09);
    m.sweep('hairCap', (s) => { const a = Math.PI * s, e = Math.max(.012, Math.sin(a)), cx = -Math.cos(a); return {c: add(HC, [-CR[0] * Math.cos(a), .03, 0]), u: [0, 1, 0], v: [0, 0, 1], a: CR[1] * e, b: CR[2] * e,
      r: (th) => {
        const yn = Math.cos(th) * e, zn = Math.sin(th) * e, L = Math.hypot(cx, zn) || 1, h = hairLine(-cx / L * -1, zn / L);
        // 끝이 삐죽삐죽 — 둘레 방향으로 톱니
        const ang = Math.atan2(Math.abs(zn), -cx), jag = .1 * Math.abs(Math.sin(ang * 13)) + .05 * Math.cos(ang * 31); // 좌우 대칭
        const on = smooth(h - .02 + jag, h + .06 + jag, yn);
        return .78 + (1 - .78) * on + .04 * on * Math.sin(ang * 23 + yn * 9); // 덮지 않는 곳은 머리 속(머리 아래쪽이 좁아 .86 이면 뺨에 갈색이 비쳤다)
      }}; },
      {ns: 24, nt: 28, island: [.5, .42, .75, .62], bone: 'head',
        paint: (p, n, [s, t]) => { const ang = Math.atan2(p[2] - HC[2], p[0] - HC[0]); const c = mix(HAIR, HAIR_D, .35 + .35 * Math.sin(ang * 40 + noise(p[0] * 6, p[1] * 6, p[2] * 6) * 6)); return c.map((v) => v * (.82 + .3 * smooth(.2, 1, (p[1] - HC[1]) / CR[1]) + .08 * noise(p[0] * 25, p[1] * 25, p[2] * 25))); }});
    // 가장자리 굵은 가닥 — 덩이 끝에서 아래로 늘어진다(얼굴 앞은 짧게)
    let k = 0; const cnt = 30;
    for (let i = 0; i < cnt; i++) {
      const u = (i + .5) / cnt * Math.PI * 2, dx = Math.cos(u), dz = Math.sin(u), front = Math.max(0, dx), v = Math.asin(clamp(hairLine(dx, dz) + .04, -.9, .9));
      if (front > .55 && Math.abs(dz) < .5) { k++; continue; } // 눈 · 부리 앞은 비운다
      const root = headSurf(u, v, 1.08), out = norm(add(root, HC, -1)), dir = norm(add(out.map((q) => q * .45), [0, -1, 0], 1));
      const len = (.32 + .12 * Math.sin(i * 2.3) + .15 * (1 - front)) * st.hair * H, W = (.16 + .04 * Math.sin(i * 1.7)) * H, tw = norm(cross(dir, out)), nn = norm(cross(tw, dir));
      m.sweep('hair' + k++, (s) => ({c: add(add(root, dir, len * s), out, .04 * Math.sin(s * Math.PI)), u: nn, v: tw, a: .035 * (1 - .6 * s) + .006, b: W * (1 - .9 * Math.pow(s, 1.2)) + .006}),
        {ns: 3, nt: 5, capEnd: .02, capRings: 1, island: [.75 + (k % 5) * .05, .42, .8 + (k % 5) * .05, .5], bone: 'head',
          paint: (p, n, [s, t]) => mix(HAIR, HAIR_D, .3 + .4 * Math.sin(t * Math.PI * 5 + k)).map((q) => q * (.85 + .2 * (1 - s)))});
    }
  }

  // ── 팔(가늘고 길다 — 어깨에서 앞옆으로 뻗어 젓는다) · 손(세 갈래 물갈퀴, 끝에 작은 발톱) ──
  const fins = {};
  for (const sd of [-1, 1]) {
    const sh = [1.3, .08, sd * .46], D = norm([.55, -.35, sd * .76]), L = 1.25 * Lm;
    limb(m, 'arm' + sd, sh, D, L, .15, .1, {ns: 6, nt: 8, cap: 0, island: sd < 0 ? [0, .62, .25, .74] : [.25, .62, .5, .74], bone: 'fin' + sd,
      paint: (p, n, [s, t]) => skin(p, n, s * 3.2, st)});
    const wrist = add(sh, D, L);
    // 손바닥 + 손가락 셋
    ell(m, 'palm' + sd, wrist, .14, .06, .14, {ns: 6, nt: 8, island: sd < 0 ? [.5, .62, .58, .7] : [.58, .62, .66, .7], bone: 'fin' + sd, paint: (p, n) => skin(p, n, 0, st, .3)});
    for (let f = -1; f <= 1; f++) {
      const fd = norm(add(D, [0, -.1, f * .5 * sd], 1));
      limb(m, `finger${sd}_${f}`, wrist, fd, .32 * Lm, .045, .025, {ns: 3, nt: 6, island: [.66 + (f + 1) * .03, .62, .69 + (f + 1) * .03, .7], bone: 'fin' + sd,
        paint: (p, n, [s]) => mix(skin(p, n, 0, st, .2), [236, 236, 220], smooth(.82, .95, s))});
    }
    fins[sd < 0 ? 'R' : 'L'] = {root: sh, tip: wrist};
  }
  // ── 다리(뒤로 뻗어 개구리처럼 찬다 — 허벅지 · 정강이, 발은 세 갈래 물갈퀴) ──
  for (const sd of [-1, 1]) {
    const hip = [-1.45, -.1, sd * .3], D1 = norm([-.8, -.15, sd * .45]), L1 = .95 * Lm, knee = add(hip, D1, L1), D2 = norm([-.95, .05, -sd * .12]), L2 = 1.0 * Lm, ankle = add(knee, D2, L2);
    limb(m, 'thigh' + sd, hip, D1, L1, .2, .13, {ns: 6, nt: 10, cap: .12, island: sd < 0 ? [0, .74, .25, .86] : [.25, .74, .5, .86], bone: 'tail', paint: (p, n, [s]) => skin(p, n, s * 2.4, st)});
    limb(m, 'shin' + sd, knee, D2, L2, .13, .08, {ns: 6, nt: 10, cap: 0, island: sd < 0 ? [.5, .74, .75, .86] : [.75, .74, 1, .86], bone: 'tail', paint: (p, n, [s]) => skin(p, n, s * 2.6 + .5, st)});
    for (let f = -1; f <= 1; f++) {
      const fd = norm(add(D2, [0, -.05, f * .45], 1));
      limb(m, `toe${sd}_${f}`, ankle, fd, .42 * Lm, .055, .03, {ns: 3, nt: 6, flat: .7, island: [.5 + (f + 1) * .08 + (sd > 0 ? .25 : 0), .86, .56 + (f + 1) * .08 + (sd > 0 ? .25 : 0), .94], bone: 'tail',
        paint: (p, n, [s]) => mix(skin(p, n, 0, st, .2), [236, 236, 220], smooth(.84, .96, s))});
    }
    // 물갈퀴(발가락 사이 얇은 막)
    ell(m, 'web' + sd, add(ankle, D2, .2 * Lm), .2 * Lm, .025, .2 * Lm, {ns: 6, nt: 8, island: sd < 0 ? [0, .86, .12, .94] : [.12, .86, .24, .94], bone: 'tail', paint: (p, n) => skin(p, n, 0, st, .4).map((v) => v * .95)});
  }
  return {m, fins};
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGES);
for (const key of keys) {
  const {m, fins} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/polar/kappa-build.mjs', roughness: .5, weight: (part, g, [s]) => {
    if (part.bone === 'head') return [[0, 1]];
    if (part.bone === 'tail') return [[5, 1]];
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8; return [[root, 1 - s * .7], [root + 1, s * .7 + .001]]; }
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
