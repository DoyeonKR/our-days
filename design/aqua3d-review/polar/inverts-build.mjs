// 남극 무척추 다섯 3D — 클리오네 · 바다돼지 · 남극 대왕등각류 · 남극성게 · 살프 사슬(2026-11-25 [사용자: "기존에있는 것과 조금 다른 느낌없어 ?" → "다 완벽하게 진행해줘"])
// 부위로 짓는다(kit.mjs). 생김새는 도감 기술을 눈으로 잡은 값이고 그림 픽셀은 쓰지 않는다. 반투명 둘(클리오네 · 살프 — 바다돼지는 반투명하게 하면 다리 뿌리가 검게 비쳐 불투명 분홍으로 했다)은 재질 알파(BLEND)로,
// 속 기관을 몸보다 먼저 쌓아(먼저 그려진다) 껍질 너머로 비치게 한다. 속 기관은 껍질에 닿게 둔다(떠 있는 부품 0).
//  · 클리오네(Clione limacina antarctica, 바다천사): 투명한 몸 · 머리에 작은 뿔 둘 · 목 양옆의 날개(측족) 둘 · 몸속 주황빨강 내장 덩어리 · 꼬리 끝 주황
//  · 바다돼지(Scotoplanes, 해삼): 분홍빛 반투명 통통한 몸 · 아래 양옆에 통통한 관족 다리 다섯 쌍 · 머리 위에 솟은 돌기 두 쌍 · 앞 아래 입 둘레 촉수
//  · 남극 대왕등각류(Glyptonotus antarcticus): 납작한 타원 갑옷 · 마디 일곱 · 꼬리판(세모) · 긴 더듬이 둘 · 짧은 더듬이 둘 · 등 위의 겹눈 · 다리 일곱 쌍 · 회갈에 주황 얼룩
//  · 남극성게(Sterechinus neumayeri): 납작한 공 · 짧은 가시 빽빽이 · 보라 · 초록빛 · 몸 위에 조개껍데기 · 해초 조각을 얹고 다닌다
//  · 살프 사슬(Salpa thompsoni 군체): 투명한 통 여덟이 지그재그로 이어진 사슬 · 통마다 흰 근육 띠 · 주황갈 핵(내장)
// node design/aqua3d-review/polar/inverts-build.mjs [key...]
import {writeFile} from 'node:fs/promises';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, noise, norm, add, cross} from './kit.mjs';

const famOf = (key) => key.replace(/^(fry|juv)_/, ''), STAGE = (key) => (key.startsWith('fry_') ? 'fry' : key.startsWith('juv_') ? 'juv' : 'adult');
const grain = (p, f = 30, k = .08) => 1 - k / 2 + k * noise(p[0] * f, p[1] * f, p[2] * f);
// 칸 나누기 — 부위가 많은 모델은 줄 · 칸 격자로 텍스처 칸을 준다
function islands(n, top = 0, bottom = 1) { const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), out = []; for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); out.push([c / cols, top + (bottom - top) * r / rows, (c + 1) / cols - .004, top + (bottom - top) * (r + 1) / rows - .004]); } return out; }

// ───────────── 클리오네 ─────────────
function clione(stage) {
  const m = new Model(), k = stage === 'fry' ? 1.12 : 1, W = stage === 'fry' ? .8 : stage === 'juv' ? .92 : 1;
  // 몸 단면(x: 꼬리 -3 → 머리 끝 2.4) — 머리(둥근) · 목(잘록) · 몸(통통) · 꼬리(가늘게)
  const PR = [[-3.0, .08], [-2.4, .32], [-1.2, .7], [-.1, .82], [.8, .7], [1.2, .5], [1.5, .56], [2.0, .62], [2.4, .32]];
  const R = (x) => { let i = 0; while (i < PR.length - 2 && x > PR[i + 1][0]) i++; const A = PR[i], B = PR[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])); return (A[1] + (B[1] - A[1]) * t * t * (3 - 2 * t)) * k; };
  const SKIN = [200, 222, 236], ORG = [236, 96, 46], ORG2 = [250, 150, 70];
  // 속 기관 먼저(먼저 그려진다): 내장 덩어리(몸 가운데 · 꼬리 쪽으로 닿는다) · 머리의 주황 입 기관
  m.sweep('gut', (s) => { const x = -2.75 + 2.5 * s, r = R(x) * (.66 + .3 * Math.sin(Math.PI * s)); return {c: [x, -.04, 0], u: [0, 1, 0], v: [0, 0, 1], a: r, b: r * .92}; },
    {ns: 16, nt: 14, capStart: .1, capEnd: .2, capRings: 2, island: [0, .5, .3, .7], bone: 'body', paint: (p) => mix(ORG, ORG2, smooth(.3, .8, fbm([p[0] * 3, p[1] * 3, p[2] * 3]))).map((v) => v * grain(p, 20))});
  m.sweep('mouth', (s) => { const x = 1.55 + 1.0 * s, r = Math.max(.12, R(x) * .8 * (1 - .3 * s)); return {c: [x, .02, 0], u: [0, 1, 0], v: [0, 0, 1], a: r, b: r}; },
    {ns: 8, nt: 12, capStart: .1, capEnd: .05, capRings: 1, island: [.3, .5, .45, .7], bone: 'head', paint: (p) => mix(ORG, [255, 200, 120], smooth(1.6, 2.4, p[0])).map((v) => v * grain(p, 20))});
  // 투명한 몸
  m.sweep('body', (s) => { const x = -3 + 5.4 * s; return {c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: R(x), b: R(x) * .95}; },
    {ns: 40, nt: 20, capStart: .08, capEnd: .2, capRings: 3, capSpanStart: .03, capSpanEnd: .08, island: [0, 0, 1, .5], bone: 'body', paint: (p, n) => {
      const rim = 1 - Math.abs(n[2]) * .4; let c = SKIN.map((v) => v * (.92 + .1 * rim));
      // 몸 표면의 가는 근육 결 · 꼬리 끝 주황
      c = c.map((v) => v * (.96 + .05 * Math.sin(p[0] * 26 + Math.atan2(p[2], p[1]) * 3)));
      return mix(c, ORG, smooth(-2.5, -2.95, p[0]) * .9);
    }});
  // 머리 뿔 둘(작은 원뿔 — 위 · 앞으로)
  for (const sd of [-1, 1]) {
    const base = [2.05, R(2.05) * .7, sd * R(2.05) * .45], D = norm([.55, .8, sd * .35]), L = .55 * k;
    m.sweep('horn' + sd, (s) => ({c: add(base, D, L * s), u: [0, 1, 0], v: [0, 0, 1], a: .14 * k * (1 - .8 * s), b: .14 * k * (1 - .8 * s)}), {ns: 6, nt: 8, capEnd: .03, capRings: 1, island: sd < 0 ? [.45, .5, .55, .6] : [.45, .6, .55, .7], bone: 'head', paint: (p) => SKIN.map((v) => v * grain(p))});
  }
  // 날개(측족) 둘 — 목 양옆에서 옆으로 뻗은 둥근 노(fin 뼈 — 위아래로 친다)
  const fins = {};
  for (const sd of [-1, 1]) {
    const root = [1.0, .05, sd * R(1.0) * .75], D = norm([.05, .12, sd]), L = 1.45 * W * k;
    m.sweep('wing' + sd, (s) => ({c: add(root, D, L * s), u: [1, 0, 0], v: [0, 1, 0], a: (.62 * Math.sin(Math.PI * (.18 + .72 * s)) + .06) * W, b: .045, e: 2.4}),
      {ns: 12, nt: 10, capEnd: .08, capRings: 1, island: sd < 0 ? [.55, .5, .78, .7] : [.78, .5, 1, .7], bone: 'fin' + sd, paint: (p, n, [s]) => SKIN.map((v) => v * (.9 + .1 * Math.abs(Math.sin(s * 30))) * grain(p))});
    fins[sd < 0 ? 'R' : 'L'] = {root, tip: add(root, D, L)};
  }
  return {m, fins, alpha: .58, roughness: .25};
}

// ───────────── 바다돼지(스코토플라네스) ─────────────
function seaPig(stage) {
  const m = new Model(), fat = stage === 'fry' ? 1.12 : 1, legK = stage === 'fry' ? .75 : stage === 'juv' ? .9 : 1;
  const PR = [[-2.9, .2, .25], [-2.4, .66, .72], [-1.2, .92, 1.0], [.3, 1.0, 1.08], [1.6, .94, 1.0], [2.5, .7, .78], [2.95, .3, .34]];
  const P = (x) => { let i = 0; while (i < PR.length - 2 && x > PR[i + 1][0]) i++; const A = PR[i], B = PR[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), q = t * t * (3 - 2 * t); return {a: (A[1] + (B[1] - A[1]) * q) * fat, b: (A[2] + (B[2] - A[2]) * q) * fat}; };
  const PINK = stage === 'fry' ? [240, 206, 206] : [232, 172, 172], DEEP = [204, 120, 128];
  const skin = (p, n) => { let c = mix(PINK, DEEP, smooth(.3, .95, n[1]) * .5 + smooth(.55, .75, fbm([p[0] * 1.8, p[1] * 1.8, p[2] * 1.8])) * .35); c = mix(c, [250, 226, 220], smooth(-.3, -.9, n[1]) * .5); return c.map((v) => v * grain(p, 24)); };
  // 몸(아래가 납작)
  m.sweep('body', (s) => { const x = -2.9 + 5.85 * s, p = P(x); return {c: [x, 0, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, r: (th) => (Math.cos(th) < 0 ? 1 - .3 * Math.abs(Math.cos(th)) ** 2 : 1) * (1 + .03 * Math.sin(x * 7 + th * 3))}; },
    {ns: 40, nt: 24, capStart: .2, capEnd: .25, capRings: 3, capSpanStart: .04, capSpanEnd: .06, island: [0, 0, 1, .5], bone: 'body', paint: skin});
  const isl = islands(22, .5, .62);
  let ii = 0;
  // 다리(관족) 다섯 쌍 — 몸 아래 양옆에서 아래 · 바깥으로, 끝이 둥글다
  const legX = [1.9, 1.0, .1, -.8, -1.7];
  for (const x of legX) for (const sd of [-1, 1]) {
    const p = P(x), base = [x, -p.a * .55, sd * p.b * .72], D = norm([.05 * (x > 0 ? 1 : -1), -1, sd * .55]), L = .75 * legK;
    m.sweep('leg', (s) => ({c: add(base, D, L * s), u: [1, 0, 0], v: [0, 0, 1], a: .22 * (1 - .35 * s) * fat, b: .22 * (1 - .35 * s) * fat}), {ns: 6, nt: 10, capEnd: .14, capRings: 2, island: isl[ii++], bone: 'body', paint: skin});
  }
  // 등 위 돌기 두 쌍(앞쪽이 길다 — 위 · 앞으로 솟는다)
  for (const [x, len, sd] of [[2.0, 1.55, -1], [2.0, 1.55, 1], [1.35, 1.05, -1], [1.35, 1.05, 1]]) {
    const p = P(x), base = [x, p.a * .7, sd * p.b * .3], D = norm([.35, 1, sd * .3]), L = len * legK;
    m.sweep('papilla', (s) => ({c: add(base, add(D, [.25 * s * s, 0, 0]), L * s), u: [1, 0, 0], v: [0, 0, 1], a: .16 * (1 - .6 * s), b: .16 * (1 - .6 * s)}), {ns: 8, nt: 8, capEnd: .06, capRings: 1, island: isl[ii++], bone: 'head', paint: skin});
  }
  // 입 둘레 촉수(앞 아래, 짧은 손가락 여덟)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, base = [2.75, -.05 + .14 * Math.cos(a), .14 * Math.sin(a)], D = norm([1, -.5 + .35 * Math.cos(a), .45 * Math.sin(a)]);
    if (ii >= isl.length) break;
    m.sweep('tent', (s) => ({c: add(base, D, .32 * s), u: [0, 1, 0], v: [0, 0, 1], a: .07, b: .07}), {ns: 3, nt: 6, capEnd: .03, capRings: 1, island: isl[ii++], bone: 'head', paint: () => [250, 210, 200]});
  }
  return {m, fins: {L: {root: [1, -.6, .8], tip: [1, -1.2, 1.2]}, R: {root: [1, -.6, -.8], tip: [1, -1.2, -1.2]}}, roughness: .35};
}

// ───────────── 남극 대왕등각류 ─────────────
function isopod(stage) {
  const m = new Model(), wide = stage === 'fry' ? .88 : 1, k = stage === 'fry' ? 1.1 : 1;
  // x: 꼬리판 끝 -3.4 → 머리 앞 2.6. 반폭 b · 반높이 a
  const PR = [[-3.4, .02, .05], [-2.9, .12, .42], [-2.1, .28, .88], [-1.2, .42, 1.16], [.0, .5, 1.3], [1.2, .5, 1.26], [2.0, .44, 1.0], [2.4, .36, .72], [2.6, .18, .4]];
  const P = (x) => { let i = 0; while (i < PR.length - 2 && x > PR[i + 1][0]) i++; const A = PR[i], B = PR[i + 1], t = clamp((x - A[0]) / (B[0] - A[0])), q = t * t * (3 - 2 * t); return {a: (A[1] + (B[1] - A[1]) * q) * k * 1.7, b: (A[2] + (B[2] - A[2]) * q) * wide}; };
  // 마디 경계(앞 → 뒤): 머리 | 가슴 마디 일곱 | 배 마디 · 꼬리판
  const SEG = [2.0, 1.45, .95, .45, -.05, -.55, -1.05, -1.55, -1.9, -2.15];
  const segDip = (x) => SEG.reduce((d, sx) => d + Math.exp(-(((x - sx) / .07) ** 2)), 0);
  const BASE = stage === 'fry' ? [196, 170, 140] : [150, 126, 104], ORANGE = [204, 120, 60], CREAM = [226, 206, 170];
  const shell = (p, n) => {
    const [x, y, z] = p, pr = P(x), side = Math.abs(z) / pr.b;
    let c = mix(BASE, ORANGE, smooth(.55, .72, fbm([x * 1.5, y * 3, z * 1.5])) * .7);
    c = mix(c, CREAM, smooth(.66, .82, fbm([x * 3 + 9, y * 3, z * 3])) * .55);
    c = mix(c, c.map((v) => v * .78), smooth(.75, .98, side));                  // 가장자리 판은 짙다
    c = c.map((v) => v * (1 - .38 * clamp(segDip(x))));                        // 마디 홈
    c = mix(c, [236, 226, 206], smooth(-.2, -.7, n[1]) * .6);                  // 배 쪽은 옅다
    // 등 가운데 능선(작은 혹 줄)
    c = c.map((v) => v * (1 + .1 * smooth(.25, .05, side) * smooth(.4, .9, n[1])));
    return c.map((v) => v * grain(p, 36, .12));
  };
  m.sweep('body', (s) => {
    const x = -3.4 + 6 * s, p = P(x);
    return {c: [x, .1, 0], u: [0, 1, 0], v: [0, 0, 1], a: p.a, b: p.b, e: 2.7, r: (th) => {
      const top = Math.cos(th) > 0 ? 1 : .55, dip = 1 - .07 * clamp(segDip(x)) * top;
      const ridge = 1 + .08 * Math.exp(-(((th - Math.PI) / .3) ** 2)) * 0 + .06 * Math.exp(-((th / .35) ** 2)) * (x > -2 && x < 2 ? 1 : 0);
      return dip * ridge * (Math.cos(th) < 0 ? .65 : 1);
    }};
  }, {ns: 72, nt: 26, capStart: .04, capEnd: .1, capRings: 2, capSpanStart: .02, capSpanEnd: .04, island: [0, 0, 1, .5], bone: 'body', paint: shell});
  // 겹눈(등 위 머리 양옆)
  const isl = islands(24, .5, 1); let ii = 0;
  for (const sd of [-1, 1]) {
    const x = 2.15, p = P(x), c = [x, .1 + p.a * .82, sd * p.b * .4];
    m.sphere('eye', c, .13 * k, {island: isl[ii++], bone: 'head', paint: (q) => mix([30, 26, 26], [70, 60, 56], noise(q[0] * 60, q[1] * 60, q[2] * 60))});
  }
  // 더듬이: 긴 둘(옆 · 앞으로 휘어 뻗는다, 마디 결) · 짧은 둘
  for (const [len, th, rad] of [[2.4, .9, .07], [1.0, .35, .05]]) for (const sd of [-1, 1]) {
    const base = [2.45, .14, sd * .22], D0 = norm([1, .15, sd * th]);
    m.sweep('ant', (s) => ({c: add(add(base, D0, len * s), [0, 0, sd * .5 * len * s * s * th]), u: [0, 1, 0], v: [0, 0, 1], a: rad * (1 - .6 * s) * k, b: rad * (1 - .6 * s) * k}),
      {ns: 16, nt: 6, capEnd: .02, capRings: 1, island: isl[ii++], bone: 'head', paint: (q, n, [s]) => mix([170, 140, 110], [110, 90, 74], .5 + .5 * Math.sin(s * 60)).map((v) => v * grain(q))});
  }
  // 다리 일곱 쌍 — 몸 밑에서 옆 · 아래로 꺾여 바닥을 짚는다(무릎 하나)
  const legX = [1.65, 1.15, .65, .15, -.35, -.85, -1.35];
  legX.forEach((x, i) => {
    for (const sd of [-1, 1]) {
      const p = P(x), base = [x, -.05, sd * p.b * .55], knee = [x + (i < 3 ? .25 : -.25), -.05, sd * (p.b + .25)], foot = [x + (i < 3 ? .45 : -.45), -.62, sd * (p.b + .45)];
      m.sweep('leg', (s) => { const q = s < .5 ? add(base, add(knee, base, -1), s * 2) : add(knee, add(foot, knee, -1), (s - .5) * 2); return {c: q, u: [0, 1, 0], v: [1, 0, 0], a: .08 * (1 - .5 * s) * k, b: .08 * (1 - .5 * s) * k}; },
        {ns: 10, nt: 6, capEnd: .03, capRings: 1, island: isl[ii++], bone: 'body', paint: (q) => [182, 156, 128].map((v) => v * grain(q))});
    }
  });
  return {m, fins: {L: {root: [1.15, -.05, .8], tip: [1.4, -.6, 1.6]}, R: {root: [1.15, -.05, -.8], tip: [1.4, -.6, -1.6]}}, roughness: .55};
}

// ───────────── 남극성게 ─────────────
function urchin(stage) {
  const m = new Model(), R0 = 1.15, flat = .72, spineL = stage === 'fry' ? .5 : stage === 'juv' ? .62 : .72, nSp = stage === 'fry' ? 90 : 130;
  const TEST = stage === 'fry' ? [168, 140, 160] : [128, 88, 118], GREEN = [104, 126, 84];
  // 껍질(테스트) — 납작한 공 · 다섯 갈래 관족 줄(옅은 띠)
  const test = (p, n) => {
    const az = Math.atan2(p[2], p[0]), amb = Math.pow(Math.abs(Math.cos(az * 2.5)), 6);
    let c = mix(TEST, GREEN, smooth(.5, .75, fbm([p[0] * 2, p[1] * 2, p[2] * 2])) * .5); c = mix(c, [214, 190, 200], amb * .35);
    // 가시 뿌리 혹
    c = c.map((v) => v * (.9 + .15 * smooth(.6, .9, noise(p[0] * 14, p[1] * 14, p[2] * 14))));
    return c.map((v) => v * grain(p, 40));
  };
  m.sweep('test', (s) => { const ph = -Math.PI / 2 + Math.PI * s, r = R0 * Math.cos(ph); return {c: [0, R0 * flat * Math.sin(ph), 0], u: [1, 0, 0], v: [0, 0, 1], a: Math.max(.02, r), b: Math.max(.02, r)}; },
    {ns: 22, nt: 26, island: [0, 0, 1, .4], bone: 'body', paint: test});
  // 가시 — 황금각으로 고루(아래쪽 30% 는 짧다)
  const SP = stage === 'fry' ? [230, 200, 224] : [214, 170, 206], TIP = [246, 236, 240], isl = islands(nSp + 6, .4, 1);
  let ii = 0;
  for (let i = 0; i < nSp; i++) {
    const yv = 1 - 2 * (i + .5) / nSp, rr = Math.sqrt(1 - yv * yv), th = i * 2.39996, dir = norm([rr * Math.cos(th), yv * 1.0, rr * Math.sin(th)]);
    const base = [dir[0] * R0 * .93, dir[1] * R0 * flat * .93, dir[2] * R0 * .93], L = spineL * (yv < -.4 ? .45 : 1) * (.8 + .4 * noise(i * 1.3, 0, 0));
    m.sweep('spine', (s) => ({c: add(base, dir, L * s), u: norm(cross(dir, [0.3, 1, .2])), v: norm(cross(dir, norm(cross(dir, [0.3, 1, .2])))), a: .05 * (1 - .9 * s), b: .05 * (1 - .9 * s)}),
      {ns: 2, nt: 5, capEnd: .02, capRings: 1, island: isl[ii++], bone: 'body', paint: (q, n, [s]) => mix(SP, TIP, s)});
  }
  // 몸 위의 꾸밈: 조개껍데기 조각 둘 · 해초 조각 하나(위에 얹혀 가시에 걸린다)
  if (stage !== 'fry') {
    for (const [ang, col, w] of [[.6, [236, 226, 214], .42], [2.6, [206, 196, 186], .34]]) {
      const c = [Math.cos(ang) * .45, R0 * flat * .98, Math.sin(ang) * .45];
      m.sweep('shell', (s) => ({c: add(c, [Math.cos(ang + 1.2), .15 * (s - .5), Math.sin(ang + 1.2)], w * (s - .5)), u: [0, 1, 0], v: [Math.cos(ang), 0, Math.sin(ang)], a: .05, b: w * .55 * Math.sin(Math.PI * clamp(s, .05, .95)), e: 2.2}),
        {ns: 6, nt: 10, island: isl[ii++], bone: 'body', paint: (q) => col.map((v) => v * (.9 + .12 * Math.abs(Math.sin(Math.hypot(q[0] - c[0], q[2] - c[2]) * 40))))});
    }
    const c = [-.35, R0 * flat * .97, -.25];
    m.sweep('weed', (s) => ({c: add(c, [.9, .35 * Math.sin(s * 4), .3 * Math.sin(s * 6)], .55 * (s - .3)), u: [0, 1, 0], v: [0, 0, 1], a: .03, b: .16 * Math.sin(Math.PI * clamp(s, .05, .95)), e: 2.2}),
      {ns: 10, nt: 8, island: isl[ii++], bone: 'body', paint: (q) => [96, 120, 52].map((v) => v * grain(q, 20, .2))});
  }
  return {m, fins: {L: {root: [0, 0, .9], tip: [0, 0, 1.3]}, R: {root: [0, 0, -.9], tip: [0, 0, -1.3]}}, roughness: .6};
}

// ───────────── 살프 사슬 ─────────────
function salp(stage) {
  const m = new Model(), n = stage === 'fry' ? 4 : stage === 'juv' ? 6 : 8, len = 1.5, rad = .5, gap = len * .82;
  const CLEAR = [214, 232, 236], MUS = [246, 250, 250], NUC = [190, 104, 46];
  const centers = []; for (let i = 0; i < n; i++) centers.push([(i - (n - 1) / 2) * gap, (i % 2 ? .28 : -.28), (i % 2 ? .12 : -.12)]);
  const isl = islands(n * 2, 0, 1);
  // 핵(내장) 먼저 — 통 뒤쪽 아래 벽에 붙는다
  centers.forEach((c, i) => { const nc = add(c, [-len * .32, -rad * .62, 0]); m.sphere('nucleus', nc, .2, {island: isl[n + i], bone: 'body', paint: (q) => mix(NUC, [140, 70, 30], noise(q[0] * 20, q[1] * 20, q[2] * 20)).map((v) => v * grain(q))}); });
  centers.forEach((c, i) => {
    const tilt = (i % 2 ? .18 : -.18);
    m.sweep('zooid', (s) => { const x = (s - .5) * len, r = rad * (.62 + .38 * Math.sin(Math.PI * clamp(s, 0, 1)) ** .6); return {c: add(c, [x, tilt * x, 0]), u: [0, 1, 0], v: [0, 0, 1], a: r, b: r * .9}; },
      {ns: 16, nt: 18, capStart: .08, capEnd: .08, capRings: 2, island: isl[i], bone: 'body', paint: (q, nn, [s]) => {
        // 근육 띠 다섯(통을 감는 흰 고리, 가운데서 조금 기운다)
        const band = Math.max(...[.2, .35, .5, .65, .8].map((b) => smooth(.03, .008, Math.abs(s - b - .03 * Math.sin(Math.atan2(q[2] - c[2], q[1] - c[1]))))));
        return mix(CLEAR, MUS, band * .9).map((v) => v * grain(q, 20, .05));
      }});
  });
  return {m, fins: {L: {root: [0, 0, .4], tip: [0, 0, .9]}, R: {root: [0, 0, -.4], tip: [0, 0, -.9]}}, alpha: .5, roughness: .2};
}

const BUILD = {clione, sea_pig: seaPig, giant_isopod: isopod, antarctic_urchin: urchin, salp};
export const KEYS = Object.keys(BUILD).flatMap((k) => ['fry_' + k, 'juv_' + k, k]);
const keys = process.argv.slice(2).length ? process.argv.slice(2) : KEYS;
for (const key of keys) {
  const fam = famOf(key), {m, fins, alpha = 1, roughness} = BUILD[fam](STAGE(key));
  const {glb, tris} = await bake(key, m, {fins, alpha, roughness, source: 'design/aqua3d-review/polar/inverts-build.mjs', weight: (part, g, [s]) => {
    if (part.bone === 'fin1' || part.bone === 'fin-1') { const root = part.bone === 'fin1' ? 6 : 8, k = smooth(0, .2, s); return [[1, 1 - k], [root, k * (1 - s)], [root + 1, k * s]]; }
    if (part.bone === 'head' && fam !== 'salp') return spineWeight(Math.max(g[0], .5));
    return spineWeight(g[0]);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
