// 매너티 3D — 사용자가 다른 세션(Gemini 4 Neon → 나노 바나나 기준 그림 → Tripo h3.1)으로 만든 모델(source/tripo-manatee.glb)을 게임 형식으로 굽는다
// 2026-11-27 [사용자: "넣어도 괜찮아 허락 받았어 기준이미지도 넣고 매너티 움직임 구현해서 반영해줘"] — 기준 그림 reference/reference.png, 만든 과정 source/NOTES.md
// 원본: 삼각형 15만 · 꼭짓점 색(COLOR_0 — Tripo 텍스처를 옮긴 것) · UV · 뼈 없음 · 머리 -Z · 꼬리 주걱이 몸 축보다 아래로 처져 있다.
// 하는 일(모양은 원본을 따른다 — 고친 곳만 적는다):
//   ① 돌려서 +X 머리 · +Y 위(게임 규칙)
//   ② 꼬리를 편다 — 주걱이 몸 축보다 길이의 15%쯤 아래로 처져 쉴 때도 늘 꼬리를 내리친 모습이었다(뼈가 위아래로 흔든다)
//   ③ 삼각형을 약 7000개로 줄인다(meshoptimizer) — 게임 한 마리 8000개 이하
//   ④ 부위를 나눈다(몸 왼 · 오른 반쪽, 꼬리 주걱 위 · 아래, 가슴지느러미 양쪽 위 · 아래) — 부위마다 텍스처 칸을 따로 받아 겹치지 않게 칠한다
//   ⑤ 색: 원본 꼭짓점 색(녹조 얼룩 · 긁힌 자국 · 눈 · 콧구멍)을 가까운 고해상도 점에서 가져와 회갈색 살갗 위에 얹고, 오목한 곳(주름 · 입술 패드)을 어둡게
//   색: 다 큰 개체 회갈색 · 녹조 얼룩, 어린 개체 회색 · 얼룩 적게, 새끼는 짙은 회색 · 매끈(얼룩 거의 없음) · 통통
// node design/aqua3d-review/manatee/manatee-build.mjs [key...] [--debug]
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {MeshoptSimplifier} from 'meshoptimizer';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, norm, add, cross} from '../polar/kit.mjs';

const STAGES = {
  manatee: {skin: [132, 125, 116], belly: [150, 145, 137], keep: .42, fat: 1},
  juv_manatee: {skin: [122, 120, 116], belly: [142, 140, 136], keep: .24, fat: 1.03},
  fry_manatee: {skin: [98, 100, 104], belly: [122, 124, 128], keep: .07, fat: 1.08},
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ── ① 원본 읽기 · 돌리기(-Z 머리 → +X) · 꼭짓점 합치기 ──
function load() {
  const f = readFileSync(new URL('./source/tripo-manatee.glb', import.meta.url)), jl = f.readUInt32LE(12), j = JSON.parse(f.subarray(20, 20 + jl)), bin = f.subarray(20 + jl + 8);
  const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView], C = {5126: Float32Array, 5125: Uint32Array, 5121: Uint8Array}[a.componentType], n = {VEC3: 3, VEC4: 4, SCALAR: 1}[a.type], o = bin.byteOffset + bv.byteOffset + (a.byteOffset || 0); return new C(bin.buffer.slice(o, o + a.count * n * C.BYTES_PER_ELEMENT)); };
  const pr = j.meshes[0].primitives[0], P0 = acc(pr.attributes.POSITION), C0 = acc(pr.attributes.COLOR_0), I0 = acc(pr.indices);
  const map = new Map(), rep = new Int32Array(P0.length / 3), P = [], C = [];
  for (let i = 0; i < P0.length / 3; i++) {
    const v = [-P0[i * 3 + 2], P0[i * 3 + 1], P0[i * 3]], key = v.map((c) => Math.round(c * 1e5)).join();
    if (!map.has(key)) { map.set(key, P.length); P.push(v); C.push([C0[i * 4], C0[i * 4 + 1], C0[i * 4 + 2]]); } rep[i] = map.get(key);
  }
  const I = []; for (let t = 0; t < I0.length; t += 3) { const a = rep[I0[t]], b = rep[I0[t + 1]], c = rep[I0[t + 2]]; if (a !== b && b !== c && a !== c) I.push(a, b, c); }
  return {P, I, C};
}

// 몸 높이 단면 — 가슴지느러미 구간은 양옆 깨끗한 칸으로 잇는다
const PECT = [.16, .315], TAIL = -.34;
function profile(P) {
  const B = 60, x0 = -.5, x1 = .5, top = new Array(B).fill(-9), bot = new Array(B).fill(9), wid = new Array(B).fill(0);
  for (const v of P) { const b = Math.max(0, Math.min(B - 1, Math.floor((v[0] - x0) / (x1 - x0) * B))); top[b] = Math.max(top[b], v[1]); bot[b] = Math.min(bot[b], v[1]); wid[b] = Math.max(wid[b], Math.abs(v[2])); }
  const xc = (b) => x0 + (b + .5) / B * (x1 - x0);
  const patch = (arr, lo, hi) => { let a = -1, c = -1; for (let b = 0; b < B; b++) { if (xc(b) < lo) a = b; if (xc(b) > hi && c < 0) c = b; } for (let b = a + 1; b < c; b++) arr[b] = arr[a] + (arr[c] - arr[a]) * (b - a) / (c - a); };
  patch(bot, ...PECT); patch(wid, ...PECT);
  const at = (arr) => (x) => { const f = clamp((x - x0) / (x1 - x0) * B - .5, 0, B - 1), b = Math.min(B - 2, Math.floor(f)), t = f - b; return arr[b] + (arr[b + 1] - arr[b]) * t; };
  return {top: at(top), bot: at(bot), wid: at(wid), cy: (x) => (at(top)(x) + at(bot)(x)) / 2, hh: (x) => (at(top)(x) - at(bot)(x)) / 2};
}

// ② 꼬리 펴기 — x 만의 함수로 y 를 옮긴다(주걱 단면 · 두께는 그대로)
function straighten(P) {
  const pr = profile(P), ref = pr.cy(-.18), slope = .1;
  const sh = new Map(), shift = (x) => (ref + (x + .18) * slope - pr.cy(x)) * .8 * smooth(-.18, -.3, x);
  for (const v of P) { const k = Math.round(v[0] * 1e4); if (!sh.has(k)) sh.set(k, shift(v[0])); v[1] += sh.get(k); }
}

// 고해상도 이웃 · 오목함 · 꼭짓점 색 찾기(격자)
function hiRes(P, I, C) {
  const n = P.length, nb = Array.from({length: n}, () => new Set()), N = P.map(() => [0, 0, 0]);
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]], fn = cross(add(P[b], P[a], -1), add(P[c], P[a], -1));
    for (const k of [a, b, c]) N[k] = add(N[k], fn);
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  const Nn = N.map(norm); let cav = new Float32Array(n);
  for (let i = 0; i < n; i++) { let m = [0, 0, 0], e = 0; for (const j of nb[i]) { m = add(m, P[j], 1 / nb[i].size); e += Math.hypot(...add(P[j], P[i], -1)) / nb[i].size; } cav[i] = dot(Nn[i], add(m, P[i], -1)) / (e || 1); }
  for (let it = 0; it < 2; it++) { const c2 = new Float32Array(n); for (let i = 0; i < n; i++) { let s = cav[i]; for (const j of nb[i]) s += cav[j]; c2[i] = s / (nb[i].size + 1); } cav = c2; }
  const G = .008, grid = new Map(), gk = (x, y, z) => x + ',' + y + ',' + z;
  P.forEach((v, i) => { const k = gk(...v.map((c) => Math.floor(c / G))); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i); });
  const near = (p) => { const c = p.map((v) => Math.floor(v / G)); let best = -1, bd = 1e9; for (let r = 1; r <= 3 && best < 0; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) { const l = grid.get(gk(c[0] + dx, c[1] + dy, c[2] + dz)); if (l) for (const i of l) { const d = (P[i][0] - p[0]) ** 2 + (P[i][1] - p[1]) ** 2 + (P[i][2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } } } return best; };
  return (p) => { const i = near(p); return i < 0 ? {cav: 0, col: [128, 128, 128]} : {cav: cav[i], col: C[i]}; };
}

function build(key) {
  const st = STAGES[key], {P: HP, I: HI, C: HC} = load();
  straighten(HP);
  const pr0 = profile(HP);
  if (st.fat !== 1) for (const v of HP) { const cy = pr0.cy(v[0]), k = 1 + (st.fat - 1) * smooth(-.36, -.2, v[0]) * smooth(.47, .3, v[0]); v[1] = cy + (v[1] - cy) * k; v[2] *= k; }
  const pr = profile(HP), look = hiRes(HP, HI, HC);
  // ③ 줄이기
  const flat = new Float32Array(HP.flat()), [ix] = MeshoptSimplifier.simplify(new Uint32Array(HI), flat, 3, 7000 * 3, .02, []);
  const used = new Map(), P = [], I = []; for (const i of ix) { if (!used.has(i)) { used.set(i, P.length); P.push(HP[i].slice()); } I.push(used.get(i)); }
  // ④ 꼭짓점 분류 — 가슴지느러미(구간 안 · 몸 아래 선보다 아래이거나 몸 폭 밖) · 꼬리 주걱(TAIL 뒤)
  const kind = P.map((v) => {
    if (v[0] > PECT[0] && v[0] < PECT[1] && v[1] < pr.cy(v[0]) - .03 && Math.abs(v[2]) > .03 && (v[1] < pr.bot(v[0]) - .004 || Math.abs(v[2]) > pr.wid(v[0]) + .004)) return v[2] > 0 ? 'pectL' : 'pectR';
    if (v[0] < TAIL) return 'tail';
    return 'body';
  });
  const fins = {}, finAxis = {};
  for (const [side, sd] of [['L', 1], ['R', -1]]) {
    const ids = P.map((_, i) => i).filter((i) => kind[i] === 'pect' + side), ys = ids.map((i) => P[i][1]).sort((a, b) => b - a), yr = ys[Math.floor(ys.length * .12)];
    const rootIds = ids.filter((i) => P[i][1] >= yr), root = rootIds.reduce((s, i) => add(s, P[i], 1 / rootIds.length), [0, 0, 0]);
    let tip = root, td = 0; for (const i of ids) { const d = Math.hypot(...add(P[i], root, -1)); if (d > td) { td = d; tip = P[i]; } }
    const D = norm(add(tip, root, -1)); let W = [1, 0, 0]; W = norm(add(W, D, -dot(W, D))); let Nf = norm(cross(D, W)); if (dot(Nf, [0, 0, sd]) < 0) Nf = Nf.map((v) => -v);
    fins[side] = {root, tip}; finAxis[side] = {root, D, W, Nf, L: td, sd};
  }
  const finS = (p, side) => { const a = finAxis[side]; return clamp(dot(add(p, a.root, -1), a.D) / a.L); };
  // 뼈 가중치 — 꼭짓점마다 한 번(칸이 갈려도 같은 값 → 지느러미 뿌리가 벌어지지 않는다)
  const vw = (i, g) => {
    const base = spineWeight(g[0]); if (kind[i] !== 'pectL' && kind[i] !== 'pectR') return base;
    const side = kind[i].slice(4), s = finS(P[i], side), k = smooth(0, .3, s), root = side === 'L' ? 6 : 8;
    return [...base.map(([b, w]) => [b, w * (1 - k)]), [root, k * (1 - s)], [root + 1, k * s]];
  };

  // ── ⑤ 칠하기 ──
  const paint = (p) => {
    const {cav, col} = look(p), lum = (.3 * col[0] + .59 * col[1] + .11 * col[2]) / 128;
    const x = p[0], h = (p[1] - pr.cy(x)) / Math.max(.01, pr.hh(x));
    let c = mix(st.belly, st.skin, smooth(-.75, -.1, h)).map((v) => v * (.55 + .45 * Math.min(1.5, lum)));
    // 녹조 · 긁힌 자국(원본 색이 바탕보다 푸르거나 밝은 곳) — 새끼는 거의 없다
    c = mix(c, col.map((v) => v * 1.02), st.keep * smooth(.3, .9, Math.abs(col[1] - (col[0] + col[2]) / 2) / 12 + Math.abs(lum - 1) * 1.5));
    // 눈 · 콧구멍처럼 원본에서 아주 짙은 곳은 그대로 짙게
    if (lum < .45) c = mix(c, [28, 28, 30], smooth(.45, .2, lum));
    c = c.map((v) => v * (1 - .5 * smooth(.04, .22, cav)) * (1 + .05 * smooth(-.03, -.15, cav)));
    return c.map((v) => clamp(v * (.97 + .05 * fbm([p[0] * 40, p[1] * 40, p[2] * 40], 2)), 0, 255));
  };

  // ── 칸 나누기 · 부위 만들기 ──
  const m = new Model();
  const chart = (name, island, tris, uvOf) => {
    const loc = new Map(), part = {name, P: [], ST: [], I: [], island, paint, bone: 'tripo', B: [], keepWinding: true, weld: 'tripo', src: []};
    for (const t of tris) for (const i of [I[t], I[t + 1], I[t + 2]]) { if (!loc.has(i)) { loc.set(i, part.P.length); part.P.push(P[i]); part.ST.push(uvOf(P[i])); part.src.push(i); } part.I.push(loc.get(i)); }
    m.parts.push(part); return part;
  };
  const triN = (t) => norm(cross(add(P[I[t + 1]], P[I[t]], -1), add(P[I[t + 2]], P[I[t]], -1)));
  const triKind = (t) => { const ks = [I[t], I[t + 1], I[t + 2]].map((i) => kind[i]); for (const k of ['pectL', 'pectR', 'tail']) if (ks.filter((v) => v === k).length >= 2) return k; return 'body'; };
  const groups = {bodyL: [], bodyR: [], tailU: [], tailD: [], pectLu: [], pectLd: [], pectRu: [], pectRd: []};
  for (let t = 0; t < I.length; t += 3) {
    const k = triKind(t), n = triN(t), cz = (P[I[t]][2] + P[I[t + 1]][2] + P[I[t + 2]][2]) / 3;
    if (k === 'body') groups[cz >= 0 ? 'bodyL' : 'bodyR'].push(t);
    else if (k === 'tail') groups[n[1] >= 0 ? 'tailU' : 'tailD'].push(t);
    else { const a = finAxis[k.slice(4)]; groups[k + (dot(n, a.Nf) >= 0 ? 'u' : 'd')].push(t); }
  }
  let bx0 = 9, bx1 = -9, tw = 0; for (const v of P) { bx0 = Math.min(bx0, v[0]); bx1 = Math.max(bx1, v[0]); if (v[0] < TAIL) tw = Math.max(tw, Math.abs(v[2])); }
  const bodyUV = (p) => [clamp((p[0] - TAIL + .02) / (bx1 - TAIL + .02)), clamp(Math.atan2(Math.abs(p[2]), p[1] - pr.cy(p[0])) / Math.PI)];
  chart('bodyL', [0, 0, 1, .32], groups.bodyL, bodyUV);
  chart('bodyR', [0, .32, 1, .64], groups.bodyR, bodyUV);
  // 꼬리 주걱 — 위에서 본 평면
  const tailUV = (p) => [clamp((p[0] - bx0) / (TAIL + .03 - bx0)), clamp((p[2] + tw + .005) / (2 * tw + .01))];
  chart('tailU', [0, .64, .5, .84], groups.tailU, tailUV);
  chart('tailD', [.5, .64, 1, .84], groups.tailD, tailUV);
  // 가슴지느러미 — 지느러미 평면(뿌리 → 끝 · 앞뒤)
  for (const [side, x0] of [['L', 0], ['R', .5]]) {
    const a = finAxis[side], ids = P.map((_, i) => i).filter((i) => kind[i] === 'pect' + side), ws = ids.map((i) => dot(add(P[i], a.root, -1), a.W)), w0 = Math.min(...ws) - .005, w1 = Math.max(...ws) + .005;
    const uv = (p) => [clamp(dot(add(p, a.root, -1), a.D) / a.L), clamp((dot(add(p, a.root, -1), a.W) - w0) / (w1 - w0))];
    chart('pect' + side + 'u', [x0, .84, x0 + .25, .99], groups['pect' + side + 'u'], uv);
    chart('pect' + side + 'd', [x0 + .25, .84, x0 + .5, .99], groups['pect' + side + 'd'], uv);
  }
  return {m, fins, vw};
}

const args = process.argv.slice(2), debug = args.includes('--debug'), keys = args.filter((a) => !a.startsWith('--'));
await MeshoptSimplifier.ready;
for (const key of keys.length ? keys : Object.keys(STAGES)) {
  const {m, fins, vw} = build(key);
  const {glb, tris} = await bake(key, m, {fins, source: 'design/aqua3d-review/manatee/manatee-build.mjs (Tripo source/tripo-manatee.glb)', roughness: .8, weight: (part, g, st, k) => vw(part.src[k], g)});
  if (tris > 8000 || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(debug ? `design/aqua3d-review/manatee/debug-${key}.glb` : `public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
