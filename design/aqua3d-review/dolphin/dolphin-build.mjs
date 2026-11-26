// 큰돌고래 3D — 사용자가 Tripo 로 만든 모델(source/tripo-dolphin.glb)을 게임 형식으로 굽는다
// 2026-11-26 [사용자: "만들었고 여기에 움직임과 색상 입혀서 배포해"] — 기준 사진은 reference/tursiops-truncatus-01.jpg(NASA, 퍼블릭 도메인)
// 원본: 삼각형 11.9만 · 색 · UV · 뼈 없음 · 머리 +Z · 꼬리가 아래로 휘어 있고 꼬리지느러미가 없다.
// 하는 일(모양은 원본을 따른다 — 고친 곳만 적는다):
//   ① 돌려서 +X 머리 · +Y 위(게임 규칙)
//   ② 꼬리를 편다 — 꼬리자루가 몸 축보다 길이의 17%쯤 아래로 꺾여 있어 쉴 때도 늘 꼬리를 내리친 모습이었다(뼈가 위아래로 흔든다)
//   ③ 삼각형을 약 6500개로 줄인다(meshoptimizer) — 게임 한 마리 8000개 이하
//   ④ 부위를 나눈다(몸 왼 · 오른 반쪽, 등지느러미 양면, 가슴지느러미 양쪽 위 · 아래) — 부위마다 텍스처 칸을 따로 받아 겹치지 않게 칠한다
//   ⑤ 원본 고해상도의 오목한 곳(입선 · 눈 · 숨구멍 · 이마 골)을 텍스처에 어둡게 옮긴다 — 줄인 그물에서 사라지는 결을 색으로 남긴다
//   ⑥ 꼬리지느러미(가로로 넓은 두 날개)를 부위로 지어 꼬리자루 끝에 붙인다
//   색: 큰돌고래 — 등은 짙은 청회색(망토), 옆구리는 밝은 회색, 배 · 아래턱은 흰빛. 새끼는 옅고 옆구리에 태아 때 접힌 자국(세로 옅은 띠)이 남는다
// node design/aqua3d-review/dolphin/dolphin-build.mjs [key...] [--debug]
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, norm, add, cross} from '../polar/kit.mjs';

const STAGES = {
  bottlenose_dolphin: {back: [78, 88, 102], flank: [138, 147, 158], belly: [226, 228, 230], fat: 1, folds: 0, tint: 1},
  juv_bottlenose_dolphin: {back: [96, 106, 120], flank: [152, 160, 170], belly: [230, 232, 234], fat: 1.04, folds: .25, tint: 1},
  fry_bottlenose_dolphin: {back: [118, 128, 142], flank: [168, 176, 186], belly: [232, 233, 236], fat: 1.1, folds: 1, tint: 1},
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ── ① 원본 읽기 · 돌리기 · 꼭짓점 합치기 ──
function load() {
  const f = readFileSync(new URL('./source/tripo-dolphin.glb', import.meta.url)), jl = f.readUInt32LE(12), j = JSON.parse(f.subarray(20, 20 + jl)), bin = f.subarray(20 + jl + 8);
  const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], C = a.componentType === 5126 ? Float32Array : Uint32Array, n = {VEC3: 3, SCALAR: 1}[a.type], o = bin.byteOffset + bv.byteOffset + (a.byteOffset || 0); return new C(bin.buffer.slice(o, o + a.count * n * 4)); };
  const pr = j.meshes[0].primitives[0], P0 = acc(pr.attributes.POSITION), I0 = acc(pr.indices);
  const map = new Map(), rep = new Int32Array(P0.length / 3), P = [];
  for (let i = 0; i < P0.length / 3; i++) {
    const v = [P0[i * 3 + 2], P0[i * 3 + 1], -P0[i * 3]], key = v.map((c) => Math.round(c * 1e5)).join();
    if (!map.has(key)) { map.set(key, P.length); P.push(v); } rep[i] = map.get(key);
  }
  const I = []; for (let t = 0; t < I0.length; t += 3) { const a = rep[I0[t]], b = rep[I0[t + 1]], c = rep[I0[t + 2]]; if (a !== b && b !== c && a !== c) I.push(a, b, c); }
  return {P, I};
}

// 몸 높이 단면(x 마다 위 · 아래 끝) — 지느러미 구간은 양옆 깨끗한 칸으로 잇는다
function profile(P, I, fins) {
  const B = 60, x0 = -.5, x1 = .5, top = new Array(B).fill(-9), bot = new Array(B).fill(9), wid = new Array(B).fill(0);
  for (const v of P) { const b = Math.max(0, Math.min(B - 1, Math.floor((v[0] - x0) / (x1 - x0) * B))); top[b] = Math.max(top[b], v[1]); bot[b] = Math.min(bot[b], v[1]); wid[b] = Math.max(wid[b], Math.abs(v[2])); }
  const xc = (b) => x0 + (b + .5) / B * (x1 - x0);
  const patch = (arr, lo, hi) => { let a = -1, c = -1; for (let b = 0; b < B; b++) { if (xc(b) < lo) a = b; if (xc(b) > hi && c < 0) c = b; } for (let b = a + 1; b < c; b++) arr[b] = arr[a] + (arr[c] - arr[a]) * (b - a) / (c - a); };
  patch(top, ...fins.dorsal); patch(bot, ...fins.pect); patch(wid, ...fins.pect);
  const at = (arr) => (x) => { const f = clamp((x - x0) / (x1 - x0) * B - .5, 0, B - 1), b = Math.min(B - 2, Math.floor(f)), t = f - b; return arr[b] + (arr[b + 1] - arr[b]) * t; };
  return {top: at(top), bot: at(bot), wid: at(wid), cy: (x) => (at(top)(x) + at(bot)(x)) / 2, hh: (x) => (at(top)(x) - at(bot)(x)) / 2};
}

// ② 꼬리 펴기 — x 만의 함수로 y 를 옮긴다(꼬리자루 단면은 그대로)
const FINS = {dorsal: [-.285, -.05], pect: [.035, .2]};
function straighten(P, I) {
  const pr = profile(P, I, FINS), ref = pr.cy(-.2), slope = .12;
  const shift = (x) => (ref + (x + .2) * slope - pr.cy(x)) * .85 * smooth(-.2, -.32, x);
  const sh = new Map(); for (const v of P) { const k = Math.round(v[0] * 1e4); if (!sh.has(k)) sh.set(k, shift(v[0])); v[1] += sh.get(k); }
}

// 이마(멜론) 가운데 솟은 칼날 능선 — 원본은 숨구멍 앞에서 주둥이 쪽으로 가운데만 몸 둘레보다 1.5% 높이 솟아 옆에서 보면 지느러미 조각처럼 보였다.
//   큰돌고래 이마는 둥글다. 가운데 2cm 안의 위쪽 면만 옆 높이로 낮춘다(가운데일수록 많이)
function smoothCrest(P) {
  const B = new Map(), key = (x) => Math.round(x * 200);
  for (const v of P) { if (v[0] < .33 || v[0] > .47) continue; const w = Math.abs(v[2]), e = B.get(key(v[0])) ?? {c: -1, s: -1}; if (w < .006) e.c = Math.max(e.c, v[1]); if (w > .012 && w < .02) e.s = Math.max(e.s, v[1]); B.set(key(v[0]), e); }
  for (const v of P) {
    if (v[0] < .352 || v[0] > .455) continue; const e = B.get(key(v[0])); if (!e || e.c < 0 || e.s < 0) continue;
    const w = Math.abs(v[2]); if (w >= .02 || v[1] < e.s - .006) continue;
    const ex = Math.max(0, e.c - e.s - .0015) * smooth(.352, .362, v[0]) * smooth(.455, .44, v[0]);
    v[1] -= ex * (1 - w / .02) ** 2 * smooth(e.s - .006, e.s, v[1]);
  }
}

// ⑤ 오목함(고해상도) — 꼭짓점에서 이웃 평균까지를 법선 쪽으로 잰 값(+ 오목), 두 번 고르게
function cavity(P, I) {
  const n = P.length, nb = Array.from({length: n}, () => new Set()), N = P.map(() => [0, 0, 0]);
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]], fn = cross(add(P[b], P[a], -1), add(P[c], P[a], -1));
    for (const k of [a, b, c]) N[k] = add(N[k], fn);
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  const Nn = N.map(norm); let cav = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = [0, 0, 0], e = 0; for (const j of nb[i]) { m = add(m, P[j], 1 / nb[i].size); e += Math.hypot(...add(P[j], P[i], -1)) / nb[i].size; } cav[i] = dot(Nn[i], add(m, P[i], -1)) / (e || 1); }
  for (let it = 0; it < 2; it++) { const c2 = new Float32Array(n); for (let i = 0; i < n; i++) { let s = cav[i]; for (const j of nb[i]) s += cav[j]; c2[i] = s / (nb[i].size + 1); } cav = c2; }
  // 가까운 꼭짓점 찾기(격자)
  const G = .006, grid = new Map(), gk = (x, y, z) => x + ',' + y + ',' + z;
  P.forEach((v, i) => { const k = gk(...v.map((c) => Math.floor(c / G))); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); });
  const near = (p) => { const c = p.map((v) => Math.floor(v / G)); let best = -1, bd = 1e9; for (let r = 1; r <= 3 && best < 0; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) { const l = grid.get(gk(c[0] + dx, c[1] + dy, c[2] + dz)); if (l) for (const i of l) { const d = (P[i][0] - p[0]) ** 2 + (P[i][1] - p[1]) ** 2 + (P[i][2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } } return best; };
  return (p) => { const i = near(p); return i < 0 ? 0 : cav[i]; };
}

function build(key) {
  const st = STAGES[key], {P: HP, I: HI} = load();
  smoothCrest(HP); straighten(HP, HI);
  // 몸 굵기(새끼일수록 통통 — 몸 축을 중심으로 y · z 를 키운다)
  const pr0 = profile(HP, HI, FINS);
  if (st.fat !== 1) for (const v of HP) { const cy = pr0.cy(v[0]), k = 1 + (st.fat - 1) * smooth(.48, .3, v[0]); v[1] = cy + (v[1] - cy) * k; v[2] *= k; }
  const pr = profile(HP, HI, FINS), cavAt = cavity(HP, HI);
  // ③ 줄이기
  const flat = new Float32Array(HP.flat()), [ix] = MeshoptSimplifier.simplify(new Uint32Array(HI), flat, 3, 6500 * 3, .02, []);
  const used = new Map(), P = [], I = []; for (const i of ix) { if (!used.has(i)) { used.set(i, P.length); P.push(HP[i].slice()); } I.push(used.get(i)); }
  // ④ 꼭짓점 분류 — 등지느러미(몸 위 선보다 위) · 가슴지느러미(구간 안 · 몸 아래 선 가까이 옆으로)
  const kind = P.map((v) => {
    if (v[0] > FINS.dorsal[0] - .01 && v[0] < FINS.dorsal[1] && v[1] > pr.top(v[0]) + .006) return 'dorsal';
    if (v[0] > FINS.pect[0] && v[0] < FINS.pect[1] && v[1] < pr.cy(v[0]) - .02 && Math.abs(v[2]) > pr.wid(v[0]) * .55 && (v[1] < pr.bot(v[0]) + .03 || Math.abs(v[2]) > pr.wid(v[0]) + .002)) return v[2] > 0 ? 'pectL' : 'pectR';
    return 'body';
  });
  // 가슴지느러미 축(뿌리 → 끝)
  const fins = {}, finAxis = {};
  for (const [side, sd] of [['L', 1], ['R', -1]]) {
    const ids = P.map((_, i) => i).filter((i) => kind[i] === 'pect' + side), ys = ids.map((i) => P[i][1]).sort((a, b) => b - a), yr = ys[Math.floor(ys.length * .12)];
    const rootIds = ids.filter((i) => P[i][1] >= yr), root = rootIds.reduce((s, i) => add(s, P[i], 1 / rootIds.length), [0, 0, 0]);
    let tip = root, td = 0; for (const i of ids) { const d = Math.hypot(...add(P[i], root, -1)); if (d > td) { td = d; tip = P[i]; } }
    const D = norm(add(tip, root, -1)); let W = [1, 0, 0]; W = norm(add(W, D, -dot(W, D))); let Nf = norm(cross(D, W)); if (Nf[1] < 0) Nf = Nf.map((v) => -v);
    fins[side] = {root, tip}; finAxis[side] = {root, D, W, Nf, L: td, sd};
  }
  const finS = (i, side) => { const a = finAxis[side]; return clamp(dot(add(P[i], a.root, -1), a.D) / a.L); };
  // 뼈 가중치 — 꼭짓점마다 한 번(칸이 갈려 같은 자리에 둘이 생겨도 같은 값 → 지느러미 뿌리가 벌어지지 않는다)
  const vw = (i, g) => {
    const base = spineWeight(g[0]); if (kind[i] !== 'pectL' && kind[i] !== 'pectR') return base;
    const side = kind[i].slice(4), s = finS(i, side), k = smooth(0, .3, s), root = side === 'L' ? 6 : 8;
    return [...base.map(([b, w]) => [b, w * (1 - k)]), [root, k * (1 - s)], [root + 1, k * s]];
  };

  // ── 칠하기 ──
  const eye = [.305, .151, .074];
  const tone = (p) => {
    const x = p[0], cy = pr.cy(x), hh = Math.max(.01, pr.hh(x)), h = (p[1] - cy) / hh, wav = fbm([x * 9, p[1] * 9, Math.abs(p[2]) * 9], 3) - .5;
    // 배 ↔ 옆구리 경계는 가슴지느러미 뒤에서 위로 비스듬히 오르다 꼬리자루에서 내려간다
    const bnd = -.25 + .18 * smooth(.25, -.05, x) * smooth(-.45, -.15, x) + .12 * wav;
    let c = mix(st.belly, st.flank, smooth(bnd - .14, bnd + .14, h));
    // 등 망토 — 숨구멍 뒤에서 등지느러미 뒤까지 짙게, 머리 · 꼬리자루는 옅게 퍼진다
    const cape = .32 - .14 * smooth(.3, -.05, x) * smooth(-.42, -.25, x) + .1 * wav;
    c = mix(c, st.back, smooth(cape - .2, cape + .2, h));
    // 아래턱 · 목은 흰빛(입선 아래) — 입선 높이는 주둥이 끝에서 입꼬리까지 몸 축 조금 아래
    if (x > .33) { const my = cy - hh * (.05 + .25 * smooth(.36, .47, x)); c = mix(c, st.belly, smooth(my + .006, my - .01, p[1]) * smooth(.33, .37, x)); }
    // 눈 — 작고 짙은 눈, 둘레가 조금 어둡고 눈에서 가슴지느러미 쪽으로 옅은 띠
    const ez = Math.sign(p[2]) * eye[2], de = Math.hypot(x - eye[0], p[1] - eye[1], p[2] - ez);
    c = mix(c, st.back.map((v) => v * .8), smooth(.03, .012, de) * .5);
    const t = clamp((eye[0] - x) / (eye[0] - .14)), sl = [eye[1] + (pr.bot(.14) + .02 - eye[1]) * t], ds = Math.abs(p[1] - sl[0]);
    if (x < eye[0] && x > .14 && Math.abs(p[2]) > .03) c = mix(c, st.flank.map((v) => v * .82), smooth(.012, .003, ds) * .35 * smooth(.14, .2, x));
    if (de < .0105) c = mix([28, 30, 36], [70, 74, 82], smooth(.004, .0105, de));
    if (de < .003 && p[1] > eye[1]) c = [200, 204, 210];
    // 새끼 — 옆구리에 세로로 옅은 접힌 자국
    if (st.folds) c = mix(c, c.map((v) => Math.min(255, v * 1.12)), st.folds * .55 * Math.max(0, Math.sin(x * 70)) ** 6 * smooth(.25, -.05, Math.abs(h)) * smooth(.15, .05, x) * smooth(-.3, -.15, x));
    return c;
  };
  const shade = (c, p) => { const cv = cavAt(p); c = c.map((v) => v * (1 - .45 * smooth(.05, .22, cv)) * (1 + .06 * smooth(-.03, -.15, cv))); return c.map((v) => v * (.97 + .05 * fbm([p[0] * 40, p[1] * 40, p[2] * 40], 2))); };
  const finTone = (p, n, up) => shade(mix(st.flank.map((v) => v * .92), st.back, smooth(-.3, .5, up)), p);

  // ── 칸 나누기 · 부위 만들기 ──
  const m = new Model();
  const chart = (name, island, tris, uvOf, paint) => {
    const loc = new Map(), part = {name, P: [], ST: [], I: [], island, paint, bone: 'tripo', B: [], keepWinding: true, weld: 'tripo', src: []};
    for (const t of tris) for (const i of [I[t], I[t + 1], I[t + 2]]) { if (!loc.has(i)) { loc.set(i, part.P.length); part.P.push(P[i]); part.ST.push(uvOf(P[i], i)); part.src.push(i); } part.I.push(loc.get(i)); }
    m.parts.push(part); return part;
  };
  const triN = (t) => norm(cross(add(P[I[t + 1]], P[I[t]], -1), add(P[I[t + 2]], P[I[t]], -1)));
  const triKind = (t) => { const ks = [I[t], I[t + 1], I[t + 2]].map((i) => kind[i]); for (const k of ['dorsal', 'pectL', 'pectR']) if (ks.filter((v) => v === k).length >= 2) return k; return 'body'; };
  const groups = {bodyL: [], bodyR: [], dorsalL: [], dorsalR: [], pectLu: [], pectLd: [], pectRu: [], pectRd: []};
  for (let t = 0; t < I.length; t += 3) {
    const k = triKind(t), n = triN(t), cz = (P[I[t]][2] + P[I[t + 1]][2] + P[I[t + 2]][2]) / 3;
    if (k === 'body') groups[cz >= 0 ? 'bodyL' : 'bodyR'].push(t);
    else if (k === 'dorsal') groups[n[2] >= 0 ? 'dorsalL' : 'dorsalR'].push(t);
    else { const a = finAxis[k.slice(4)]; groups[k + (dot(n, a.Nf) >= 0 ? 'u' : 'd')].push(t); }
  }
  let bx0 = 9, bx1 = -9; for (const v of P) { bx0 = Math.min(bx0, v[0]); bx1 = Math.max(bx1, v[0]); }
  const bodyUV = (p) => [clamp((p[0] - bx0) / (bx1 - bx0)), clamp(Math.atan2(Math.abs(p[2]), p[1] - pr.cy(p[0])) / Math.PI)];
  const bodyPaint = (p) => shade(tone(p), p);
  chart('bodyL', [0, 0, 1, .34], groups.bodyL, bodyUV, bodyPaint);
  chart('bodyR', [0, .34, 1, .68], groups.bodyR, bodyUV, bodyPaint);
  // 등지느러미 — 옆에서 본 평면
  const dIds = P.map((_, i) => i).filter((i) => kind[i] === 'dorsal'), dB = [Math.min(...dIds.map((i) => P[i][0])) - .01, Math.max(...dIds.map((i) => P[i][0])) + .01, Math.min(...dIds.map((i) => P[i][1])) - .01, Math.max(...dIds.map((i) => P[i][1])) + .005];
  const dorsalUV = (p) => [clamp((p[0] - dB[0]) / (dB[1] - dB[0])), clamp((p[1] - dB[2]) / (dB[3] - dB[2]))];
  const dorsalPaint = (p, n) => mix(bodyPaint(p, n), shade(mix(st.back, st.back.map((v) => v * .86), smooth(.03, .09, p[1] - pr.top(p[0]))), p), smooth(.004, .02, p[1] - pr.top(p[0])));
  chart('dorsalL', [0, .68, .25, .84], groups.dorsalL, dorsalUV, dorsalPaint);
  chart('dorsalR', [.25, .68, .5, .84], groups.dorsalR, dorsalUV, dorsalPaint);
  // 가슴지느러미 — 지느러미 평면(뿌리 → 끝 · 앞뒤)
  for (const [side, isl] of [['L', [.5, .68, .75]], ['R', [.75, .68, 1]]]) {
    const a = finAxis[side], ids = P.map((_, i) => i).filter((i) => kind[i] === 'pect' + side), ws = ids.map((i) => dot(add(P[i], a.root, -1), a.W)), w0 = Math.min(...ws) - .005, w1 = Math.max(...ws) + .005;
    const uv = (p) => [clamp(dot(add(p, a.root, -1), a.D) / a.L), clamp((dot(add(p, a.root, -1), a.W) - w0) / (w1 - w0))];
    const mid = (isl[0] + isl[2]) / 2;
    // 뿌리 쪽은 몸 색으로 녹인다 — 지느러미 칸 경계가 옆구리에 짙은 조각으로 보였다
    const blend = (p, n, up) => { const s = clamp(dot(add(p, a.root, -1), a.D) / a.L); return mix(bodyPaint(p, n), finTone(p, n, up), smooth(.04, .22, s)); };
    chart('pect' + side + 'u', [isl[0], isl[1], mid, .84], groups['pect' + side + 'u'], uv, (p, n) => blend(p, n, .6));
    chart('pect' + side + 'd', [mid, isl[1], isl[2], .84], groups['pect' + side + 'd'], uv, (p, n) => blend(p, n, -.2));
  }
  // ⑥ 꼬리지느러미 — 꼬리자루 끝(펴진 뒤)에 가로로 넓은 두 날개, 끝이 뒤로 젖혀진다
  const tailX = bx0, tailY = pr.cy(tailX + .03);
  for (const sd of [-1, 1]) {
    const root = [tailX + .028, tailY, sd * .002], D = norm([-.5, 0, sd]), L = .135;
    m.sweep('fluke' + sd, (s) => ({c: add(add(root, D, L * s), [-.035 * s * s - .012, -.004 * s, 0], 1), u: [0, 1, 0], v: [1, 0, 0], a: .0085 * (1 - .6 * s) + .0016, b: .044 * (1 - .62 * s ** 1.4) + .006, e: 2.1}),
      {ns: 10, nt: 12, capEnd: .008, capRings: 2, island: sd < 0 ? [0, .84, .48, .99] : [.5, .84, .98, .99], bone: 'tail',
        paint: (q, nn) => shade(mix(st.flank.map((v) => v * .9), st.back, smooth(-.4, .5, nn[1])), q)});
  }
  return {m, fins, vw, P};
}

const args = process.argv.slice(2), debug = args.includes('--debug'), keys = args.filter((a) => !a.startsWith('--'));
await MeshoptSimplifier.ready;
for (const key of keys.length ? keys : Object.keys(STAGES)) {
  const {m, fins, vw} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/dolphin/dolphin-build.mjs (Tripo source/tripo-dolphin.glb)', roughness: .38, weight: (part, g, st, k) => {
    if (part.bone === 'tail') return [[5, 1]];
    return vw(part.src[k], g);
  }});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(debug ? `design/aqua3d-review/dolphin/debug-${key}.glb` : `public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
