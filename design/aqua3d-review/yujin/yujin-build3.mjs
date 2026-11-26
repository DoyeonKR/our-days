// 유진 3D — 3차(2026-11-27) [사용자: "관절을 10배 이상 많게 해야해 그리고 얼굴에 지저분함이 있어 검은색 비슷한 것들 다 지우ㅏ줘 더 또렷하게 … 디테일 지금보다 3배 압그래이드해 동작도 추가하고"]
// 1차(앉은 스캔 + 사진) → 2차(머리는 스캔, 몸은 서 있는 사진 비율로 지음, yujin-build.mjs) → 3차(이 파일):
//   · 얼굴: 스캔 얼굴(감은 눈 굴곡 · 얼굴에 얹힌 머리 가닥)이 사진 위에 검은 얼룩을 만들었다 → 얼굴 타원을 떼고 매끈한 얼굴 면(앞 깊이 격자 — 가운데값 · 고르기, 코는 살린다)을
//     새로 깔고 정면 사진을 그 면 전용의 큰 텍스처 칸(4096 아틀라스의 38% × 56% → 배포 2048 에서 얼굴 약 780 × 1150px)에 칠한다
//   · 관절 126개(기본 12 + 목/머리 1 + 긴 머리 가닥 12줄 × 6마디 + 팔마다 손목 · 손바닥 · 손가락 5 × 3마디 + 다리마다 무릎 · 발목 · 발가락 + 가방)
//   · 디테일 약 3배: 삼각형 약 3만, 텍스처 2048, 다섯 손가락, 지퍼 손잡이, 소매 · 청바지 주름, 밑단 시보리 결
// 원본 · 사진은 레포에 없다(source/ · ref/ — .gitignore). node design/aqua3d-review/yujin/yujin-build3.mjs [--debug]
import {writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {MeshoptSimplifier} from 'meshoptimizer';
import {Model, bake, spineWeight, clamp, smooth, mix, fbm, norm, add, cross} from '../polar/kit.mjs';
import {loadSource} from './load.mjs';

const HERE = new URL('./', import.meta.url);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a, b, t) => a + (b - a) * t;
async function photo(name) { const {data, info} = await sharp(new URL('ref/' + name, HERE).pathname.replace(/^\/([A-Z]:)/, '$1')).removeAlpha().raw().toBuffer({resolveWithObject: true}); return {d: data, w: info.width, h: info.height}; }
const sample = (ph, u, v) => { u = clamp(u, 0, ph.w - 1.001); v = clamp(v, 0, ph.h - 1.001); const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, o = (y * ph.w + x) * 3, r = ph.w * 3; return [0, 1, 2].map((c) => (ph.d[o + c] * (1 - fx) + ph.d[o + 3 + c] * fx) * (1 - fy) + (ph.d[o + r + c] * (1 - fx) + ph.d[o + r + 3 + c] * fx) * fy); };
const avgBox = (ph, u0, v0, u1, v1) => { const s = [0, 0, 0]; let n = 0; for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) { const c = sample(ph, u, v); for (let k = 0; k < 3; k++) s[k] += c[k]; n++; } return s.map((x) => x / n); };

// ── 비율(사람 좌표 — y 위 · 얼굴 +z · 오른쪽 -x). 서 있는 사진에서: 7.5 등신 · 재킷 밑단 키의 48% · 가랑이 53% ──
const B = { chin: .765, floor: -.76, neck: [-.01, -.235], bodyZ: -.235, shoulderY: .655, hemY: .15, crotchY: .07, sh: [.175, .6], el: [.232, .4], wr: [.245, .2], legX: .095, legR: .086 };
// 얼굴(정면 사진) — 눈 가운데 · 눈→턱 거리 하나의 배율
const FACE_MODEL = [[-.046, .884], [.031, .883], [-.012, .829], [-.011, .792], [-.008, .765]];
const FACE_PHOTO = [[447, 535], [643, 533], [543, 668], [543, 752], [543, 878]];
const faceMap = () => { const em = [(FACE_MODEL[0][0] + FACE_MODEL[1][0]) / 2, (FACE_MODEL[0][1] + FACE_MODEL[1][1]) / 2], ep = [(FACE_PHOTO[0][0] + FACE_PHOTO[1][0]) / 2, (FACE_PHOTO[0][1] + FACE_PHOTO[1][1]) / 2], sc = (FACE_PHOTO[4][1] - ep[1]) / (em[1] - FACE_MODEL[4][1]); return (x, y) => [ep[0] + (x - em[0]) * sc, ep[1] - (y - em[1]) * sc]; };
// 얼굴 면 타원(사진의 얼굴 윤곽 — 이마 위 머리선 아래 · 턱 · 양 뺨)
const FE = {x: -.009, y: .846, rx: .058, ry: .082, ryUp: .112}; // 위로는 머리선까지(이마)
const feOf = (x, y) => Math.hypot((x - FE.x) / FE.rx, (y - FE.y) / (y > FE.y ? FE.ryUp : FE.ry));
const noseW = (x, y) => Math.exp(-(((x + .012) / .016) ** 2 + ((y - .832) / .03) ** 2));

// ── 머리(스캔) + 얼굴 면 ──
const CUT_Y = .7;
function head() {
  const {P, I} = loadSource();
  // ① 앞 깊이 격자 — 칸마다 가장 앞 z, 가운데값으로 가는 머리 가닥(얇다)을 지우고 고르게. 코 둘레는 덜 고른다
  const G = .0025, nx = Math.ceil(2 * FE.rx * 1.15 / G) + 1, ny = Math.ceil((FE.ry + FE.ryUp) * 1.15 / G) + 1, x0 = FE.x - FE.rx * 1.15, y0 = FE.y - FE.ry * 1.15;
  const zmax = new Float32Array(nx * ny).fill(-9);
  for (const p of P) { if (p[2] < -.2) continue; const i = Math.round((p[0] - x0) / G), j = Math.round((p[1] - y0) / G); if (i >= 0 && j >= 0 && i < nx && j < ny) zmax[j * nx + i] = Math.max(zmax[j * nx + i], p[2]); }
  const med = (src, r, keep) => { const out = new Float32Array(src.length); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const R = keep(i, j) ? 1 : r, vs = []; for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && src[jj * nx + ii] > -9) vs.push(src[jj * nx + ii]); } vs.sort((a, b) => a - b); out[j * nx + i] = vs.length ? vs[vs.length >> 1] : -9; } return out; };
  const isNose = (i, j) => noseW(x0 + i * G, y0 + j * G) > .35;
  let Z = med(zmax, 5, (i, j) => false);
  for (let it = 0; it < 14; it++) { const Z2 = Z.slice(); for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const o = j * nx + i, k = .5 * (1 - .45 * noseW(x0 + i * G, y0 + j * G)); const m = (Z[o - 1] + Z[o + 1] + Z[o - nx] + Z[o + nx]) / 4; if (Z[o] > -9 && Z[o - 1] > -9 && Z[o + 1] > -9 && Z[o - nx] > -9 && Z[o + nx] > -9) Z2[o] = Z[o] + (m - Z[o]) * k; } Z = Z2; }
  const zAt = (x, y) => { const fi = (x - x0) / G, fj = (y - y0) / G, i = clamp(Math.floor(fi), 0, nx - 2), j = clamp(Math.floor(fj), 0, ny - 2), a = fi - i, b = fj - j; const v = [Z[j * nx + i], Z[j * nx + i + 1], Z[(j + 1) * nx + i], Z[(j + 1) * nx + i + 1]]; if (v.some((q) => q < -8)) return Math.max(...v); return (v[0] * (1 - a) + v[1] * a) * (1 - b) + (v[2] * (1 - a) + v[3] * a) * b; };
  // ② 얼굴 면 — 격자 삼각형, 가장자리는 조금 뒤로 숨겨(스캔 면이 덮는다) 이음매가 안 보이게
  const FP = [], FI = [], idx = new Int32Array(nx * ny).fill(-1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i * G, y = y0 + j * G, e = feOf(x, y); if (e > 1.07 || y < B.chin - .001) continue; const z = zAt(x, y); if (z < -8) continue; idx[j * nx + i] = FP.length; FP.push([x, y, z - .0015 * smooth(.95, 1.07, e)]); }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = idx[j * nx + i], b = idx[j * nx + i + 1], c = idx[(j + 1) * nx + i], d = idx[(j + 1) * nx + i + 1]; if (a >= 0 && b >= 0 && c >= 0 && d >= 0) FI.push(a, b, d, a, d, c); }
  // ③ 스캔 — 얼굴 타원 안 앞쪽(얼굴 · 얹힌 머리 가닥)을 떼고, 목 아래를 뗀다(몸은 새로 짓는다), 가장 큰 덩어리
  const inFace = (p) => feOf(p[0], p[1]) < .97 && p[2] > -.2;
  const inHead = (p) => (p[1] > CUT_Y || (p[1] > .46 && p[2] < -.34 && Math.abs(p[0] + .01) < .17)) && !inFace(p);
  const keep = []; for (let t = 0; t < I.length; t += 3) if (inHead(P[I[t]]) && inHead(P[I[t + 1]]) && inHead(P[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
  const par = Int32Array.from({length: P.length}, (_, i) => i), f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let t = 0; t < keep.length; t += 3) { const a = f(keep[t]); par[f(keep[t + 1])] = a; par[f(keep[t + 2])] = a; }
  const cnt = new Map(); for (let t = 0; t < keep.length; t += 3) cnt.set(f(keep[t]), (cnt.get(f(keep[t])) ?? 0) + 1);
  const bigC = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0], K = []; for (let t = 0; t < keep.length; t += 3) if (f(keep[t]) === bigC) K.push(keep[t], keep[t + 1], keep[t + 2]);
  const flat = new Float32Array(P.length * 3); P.forEach((p, i) => { flat[i * 3] = p[0]; flat[i * 3 + 1] = p[1]; flat[i * 3 + 2] = p[2]; });
  const [ix] = MeshoptSimplifier.simplify(new Uint32Array(K), flat, 3, 13000 * 3, .05, []);
  const used = new Map(), HP = [], HI = []; for (const i of ix) { if (!used.has(i)) { used.set(i, HP.length); HP.push(P[i]); } HI.push(used.get(i)); }
  return {P: HP, I: HI, face: {P: FP, I: FI, box: [x0, y0, x0 + (nx - 1) * G, y0 + (ny - 1) * G]}};
}

// ── 칸 나누기(스캔) ──
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const projUV = (a, p) => [[-p[2], p[1]], [p[2], p[1]], [p[0], -p[2]], [p[0], p[2]], [p[0], p[1]], [-p[0], p[1]]][a];
function charts(P, I) {
  const nt = I.length / 3, tn = [], lab = new Int8Array(nt);
  for (let t = 0; t < nt; t++) { const a = P[I[t * 3]], b = P[I[t * 3 + 1]], c = P[I[t * 3 + 2]], n = norm(cross(sub(b, a), sub(c, a))); tn.push(n); let best = 0, bd = -9; AXES.forEach((ax, k) => { const d = dot(n, ax); if (d > bd) { bd = d; best = k; } }); lab[t] = best; }
  const em = new Map(), nb = Array.from({length: nt}, () => []);
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) { const a = I[t * 3 + e], b = I[t * 3 + (e + 1) % 3], k = a < b ? a + ',' + b : b + ',' + a; const o = em.get(k); if (o !== undefined) { nb[t].push(o); nb[o].push(t); } else em.set(k, t); }
  for (let it = 0; it < 5; it++) for (let t = 0; t < nt; t++) { const cnt = new Map(); for (const o of nb[t]) cnt.set(lab[o], (cnt.get(lab[o]) ?? 0) + 1); for (const [l, c] of cnt) if (l !== lab[t] && c >= 2 && dot(tn[t], AXES[l]) > .2) { lab[t] = l; break; } }
  const comp = new Int32Array(nt).fill(-1), out = []; let id = 0;
  for (let t = 0; t < nt; t++) { if (comp[t] >= 0) continue; const q = [t], list = []; comp[t] = id; while (q.length) { const u = q.pop(); list.push(u); for (const o of nb[u]) if (comp[o] < 0 && lab[o] === lab[t]) { comp[o] = id; q.push(o); } } out.push({axis: lab[t], tris: list}); id++; }
  return out;
}
const ATLAS = 4096;
function pack(items, area) {
  const [X0, Y0, X1, Y1] = area, PAD = 8 / ATLAS, MIN = 40 / ATLAS;
  const tryS = (s) => { let x = X0, y = Y0, row = 0; const pos = []; for (const it of [...items].sort((a, b) => b.h - a.h)) { const w = Math.max(MIN, it.w * s * it.k) + 2 * PAD, h = Math.max(MIN, it.h * s * it.k) + 2 * PAD; if (x + w > X1) { x = X0; y += row; row = 0; } if (y + h > Y1) return null; pos.push([it, [x + PAD, y + PAD, x + w - PAD, y + h - PAD]]); x += w; row = Math.max(row, h); } return pos; };
  let lo = 0, hi = 50; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (tryS(m)) lo = m; else hi = m; }
  return tryS(lo);
}

// ── 뼈(사람 좌표) — 기본 12(spine 0..5 · 어깨 fin · 팔꿈치 fin_tip · 엉덩이 leg) 뒤에 붙는다 ──
const HAIR_N = 12, HAIR_SEG = 6, HAIR_TOP = .79, HAIR_BOT = .46, HAIR_X = .16, HAIR_Z = -.39;
function skeleton(arms, legs, bagTop) {
  const E = [{name: 'head', parent: 'spine_0', at: [B.neck[0], .735, B.neck[1]]}];
  for (let h = 0; h < HAIR_N; h++) { const x = lerp(-HAIR_X, HAIR_X, h / (HAIR_N - 1)) + B.neck[0]; for (let k = 0; k < HAIR_SEG; k++) E.push({name: `hair_${h}_${k}`, parent: k ? `hair_${h}_${k - 1}` : 'head', at: [x, lerp(HAIR_TOP, HAIR_BOT, k / HAIR_SEG), HAIR_Z + .01 * k]}); }
  for (const [side, fin] of [['R', 'fin_L'], ['L', 'fin_R']]) { // 오른팔(x<0)이 게임 Z>0 = fin_L
    const a = arms[side];
    E.push({name: 'wrist_' + side, parent: fin + '_tip', at: a.wr}, {name: 'palm_' + side, parent: 'wrist_' + side, at: a.hand0});
    a.fingers.forEach((fg, fi) => fg.joints.forEach((j, k) => E.push({name: `f${fi}_${k}_${side}`, parent: k ? `f${fi}_${k - 1}_${side}` : 'palm_' + side, at: j})));
  }
  for (const [side, leg] of [['R', 'leg_L'], ['L', 'leg_R']]) { const l = legs[side]; E.push({name: 'knee_' + side, parent: leg, at: l.knee}, {name: 'ankle_' + side, parent: 'knee_' + side, at: l.ank}, {name: 'toe_' + side, parent: 'ankle_' + side, at: l.toe}); }
  E.push({name: 'bag', parent: 'spine_1', at: bagTop});
  return E;
}

async function build() {
  const ph2 = await photo('photo2.webp'), ph3 = await photo('photo3.png'), face = faceMap();
  const JACKET = avgBox(ph3, 95, 160, 120, 200).map((v, k) => Math.max(v, [20, 20, 24][k])), JEANS = [112, 124, 134], JEANS_LT = [158, 168, 176], BAG = [214, 206, 184];
  const SKIN = avgBox(ph2, 380, 620, 440, 680), HAIR = [22, 19, 18];
  const m = new Model(), n3 = (p, f, o = 3) => fbm([p[0] * f, p[1] * f, p[2] * f], o);

  // ── 머리 ──
  const {P, I, face: FM} = head();
  const hairCol = (p) => { const strand = fbm([p[0] * 220, p[1] * 16, p[2] * 220], 3), sheen = smooth(.6, .92, fbm([p[0] * 30, p[1] * 4, p[2] * 30], 2)); return HAIR.map((v, k) => v * (.7 + .7 * strand) + [30, 24, 22][k] * sheen * .35); };
  // 사진 색 — 흰 배경(사진 머리칼보다 스캔 머리가 넓은 곳)은 얼굴 밖에서만 머리색으로
  const FEAT = [[FACE_MODEL[0][0], FACE_MODEL[0][1], .024, .012], [FACE_MODEL[1][0], FACE_MODEL[1][1], .024, .012], [FACE_MODEL[0][0], FACE_MODEL[0][1] + .022, .03, .009], [FACE_MODEL[1][0], FACE_MODEL[1][1] + .022, .03, .009], [-.012, .83, .022, .014], [-.011, .8, .036, .02]];
  const featW = (x, y) => Math.max(...FEAT.map(([cx, cy, rx, ry]) => smooth(1.25, .9, Math.hypot((x - cx) / rx, (y - cy) / ry))));
  const lum = (c) => .3 * c[0] + .59 * c[1] + .11 * c[2], SKL = lum(SKIN);
  // 얼굴 안의 어두운 얼룩(뺨에 걸린 머리카락 · 그늘)은 눈 · 눈썹 · 코 · 입 밖이면 피부색으로
  const clean = (p, pc) => { const r = lum(pc) / SKL, fore = smooth(.913, .925, p[1]) * smooth(1.02, .9, feOf(p[0], p[1])), dark = Math.max(smooth(.55, .38, r), fore * smooth(.95, .8, r)) * (1 - featW(p[0], p[1])); return dark > 0 ? mix(pc, SKIN.map((v) => v * (.96 + .04 * n3(p, 60, 2))), dark) : pc; };
  const photoAt = (p, n, inside) => { const [u, v] = face(p[0], p[1]), pc = sample(ph2, u, v); if (inside) return clean(p, pc); const lo = Math.min(...pc), bg = smooth(185, 215, lo) * smooth(30, 12, Math.max(...pc) - lo); return mix(pc, hairCol(p), bg); };
  const headPaint = (p, n) => {
    const dn = Math.hypot(p[0] - B.neck[0], p[2] - B.neck[1]);
    let c = (p[1] < B.chin - .005 && dn < .12 && p[2] > -.33) ? JACKET.map((v) => v * (.8 + .4 * n3(p, 90))) : hairCol(p);
    const wf = Math.max(smooth(1.22, 1.1, feOf(p[0], p[1])) * smooth(-.3, 0, n[2]), smooth(.1, .4, n[2]) * smooth(.75, .775, p[1]));
    if (wf > 0) { const e = feOf(p[0], p[1]), ph = photoAt(p, n, false); c = mix(c, mix(ph, clean(p, ph), smooth(1.16, 1.02, e)), wf); }
    return c;
  };
  // 얼굴 면 — 사진 그대로(가장 큰 칸)
  { const [bx0, by0, bx1, by1] = FM.box; m.parts.push({name: 'face', P: FM.P, ST: FM.P.map((p) => [(p[0] - bx0) / (bx1 - bx0), (p[1] - by0) / (by1 - by0)]), I: FM.I, island: [0, 0, .4, .6], paint: (p, n) => photoAt(p, n, feOf(p[0], p[1]) < .97), bone: 'face', B: [], keepWinding: true, weld: 'face'}); }
  const ch = charts(P, I), items = ch.map((c) => {
    let u0 = 9, u1 = -9, v0 = 9, v1 = -9;
    for (const t of c.tris) for (let e = 0; e < 3; e++) { const p = P[I[t * 3 + e]], [u, v] = projUV(c.axis, p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    return {c, u0, v0, w: Math.max(1e-4, u1 - u0), h: Math.max(1e-4, v1 - v0), k: 1};
  });
  for (const [it, island] of pack(items, [.4, 0, 1, .6])) {
    const loc = new Map(), part = {name: 'head', P: [], ST: [], I: [], island, paint: headPaint, bone: 'head', B: [], keepWinding: true, weld: 'head'};
    for (const t of it.c.tris) for (let e = 0; e < 3; e++) { const i = I[t * 3 + e]; if (!loc.has(i)) { loc.set(i, part.P.length); part.P.push(P[i]); const [u, v] = projUV(it.c.axis, P[i]); part.ST.push([(u - it.u0) / it.w, (v - it.v0) / it.h]); } part.I.push(loc.get(i)); }
    m.parts.push(part);
  }
  console.log('head charts', ch.length, 'tris', I.length / 3, 'face tris', FM.I.length / 3);

  // ── 지은 부위 칸 ──
  let slot = 0; const SLOTS = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) SLOTS.push([c / 10, .6 + r * .4 / 5, (c + 1) / 10, .6 + (r + 1) * .4 / 5]);
  const isl = () => SLOTS[slot++], big = (n = 2) => { const a = SLOTS[slot], b = SLOTS[slot + n - 1]; slot += n; return [a[0], a[1], b[2], b[3]]; };
  const fleece = (p, n) => { const g = n3(p, 160, 3), cl = n3(p, 24, 2); return JACKET.map((v, k) => v * (.72 + .5 * g + .25 * (cl - .5)) * (.9 + .15 * smooth(-.5, .8, n[1])) + [6, 6, 8][k] * smooth(.6, .95, g)); };
  const zip = (p) => smooth(.006, .0025, Math.abs(p[0] - B.neck[0])) * (p[2] > B.bodyZ ? 1 : 0);
  const jacketPaint = (p, n) => mix(fleece(p, n), [78, 78, 82], zip(p) * .9);
  const torsoW = (y) => { const t = clamp((B.shoulderY - y) / (B.shoulderY - B.hemY)); return {a: .2 + .012 * Math.sin(t * Math.PI), b: lerp(.12, .13, t) + .012 * Math.sin(t * Math.PI * .8), dz: .012 * Math.sin(t * Math.PI)}; };
  // 몸통 — 옷 주름(옆구리 · 등에 세로로 진 결)
  m.sweep('torso', (s) => { const y = lerp(B.shoulderY + .05, B.hemY, s), w = torsoW(y), k = smooth(B.shoulderY + .05, B.shoulderY - .045, y); return {c: [B.neck[0], y, B.bodyZ + w.dz], u: [0, 0, 1], v: [1, 0, 0], a: lerp(.085, w.b, Math.sqrt(k)), b: lerp(.09, w.a, Math.sin(k * Math.PI / 2)), e: lerp(2, 2.6, k), r: (th) => 1 + k * .012 * Math.sin(th * 9 + y * 20) * smooth(.4, .2, y)}; },
    {ns: 34, nt: 48, capStart: .02, capRings: 3, island: big(4), bone: 'body', paint: jacketPaint});
  m.sweep('collar', (s) => ({c: [B.neck[0], lerp(B.shoulderY + .005, B.chin - .02, s), B.neck[1] + .005], u: [0, 0, 1], v: [1, 0, 0], a: .085 - .008 * s, b: .088 - .01 * s, e: 2.2, r: (th) => 1 + .02 * Math.sin(th * 14)}),
    {ns: 6, nt: 36, capEnd: .01, capRings: 2, island: isl(), bone: 'body', paint: jacketPaint});
  // 지퍼 손잡이 — 옷깃 앞 위
  { const zc = [B.neck[0], B.chin - .045, B.neck[1] + .093]; m.sweep('zipper', (s) => ({c: add(zc, [0, -.022 * s, .002 * s]), u: [0, 0, 1], v: [1, 0, 0], a: .0025, b: .0055 * (1 - .3 * s) + .001, e: 3}), {ns: 4, nt: 8, capStart: .002, capEnd: .002, capRings: 1, island: isl(), bone: 'body', paint: () => [150, 150, 156]}); }
  m.sweep('hem', (s) => { const w = torsoW(B.hemY); return {c: [B.neck[0], lerp(B.hemY + .03, B.hemY - .015, s), B.bodyZ + w.dz], u: [0, 0, 1], v: [1, 0, 0], a: w.b - .006 * s, b: w.a - .01 * s, e: 2.6, r: (th) => 1 + .006 * Math.sin(th * 120)}; },
    {ns: 4, nt: 96, island: isl(), bone: 'body', paint: (p, n) => fleece(p, n).map((v) => v * (.85 + .2 * Math.max(0, Math.sin(Math.atan2(p[0], p[2] - B.bodyZ) * 120))))});

  // ── 팔 · 손 · 손가락 ──
  const arms = {}, skin = (p) => SKIN.map((v, k) => v * (.86 + .1 * n3(p, 140, 2)) * [.9, .8, .74][k]);
  for (const [side, sd] of [['R', -1], ['L', 1]]) {
    const sh = [sd * B.sh[0], B.sh[1], B.bodyZ], el = [sd * B.el[0], B.el[1], B.bodyZ + .01], wr = [sd * B.wr[0], B.wr[1], B.bodyZ + .05];
    const path = (s) => (s < .5 ? mix(sh, el, s / .5) : mix(el, wr, (s - .5) / .5));
    m.sweep('sleeve' + side, (s) => { const c = path(s), r = lerp(.074, .066, s) + .006 * Math.sin(s * Math.PI * 2) * (1 - s); const d = norm(sub(path(Math.min(1, s + .02)), path(Math.max(0, s - .02)))); let u = norm(cross(d, [1, 0, 0])); if (u[2] < 0) u = u.map((x) => -x); const v = cross(d, u); return {c, u, v, a: r * .92, b: r, e: 2, r: (th) => 1 + .03 * Math.sin(th * 3 + s * 30) * Math.exp(-(((s - .5) / .12) ** 2))}; },
      {ns: 30, nt: 22, capStart: .03, capRings: 2, island: big(2), bone: 'sleeve' + side, paint: jacketPaint});
    const cuffD = norm(sub(wr, el));
    m.sweep('cuff' + side, (s) => ({c: add(wr, cuffD, lerp(-.01, .045, s)), u: [0, 0, 1], v: [1, 0, 0], a: .056 - .01 * s, b: .058 - .01 * s, e: 2, r: (th) => 1 + .02 * Math.max(0, Math.sin(th * 18))}),
      {ns: 4, nt: 36, island: isl(), bone: 'cuff' + side, paint: (p, n) => fleece(p, n).map((v) => v * (.82 + .22 * Math.max(0, Math.sin(Math.atan2(p[0] - wr[0], p[2] - wr[2]) * 18))))});
    // 손 — 손바닥은 몸 쪽을 보고(손등이 바깥), 손가락 넷은 나란히 아래로 살짝 굽고, 엄지는 앞쪽
    const hand0 = add(wr, cuffD, .04), hd = norm(add(cuffD, [0, -.45, .05], 1)), hx = [sd, 0, 0], hw = norm(cross(hd, hx)); // hw: 손 폭(앞뒤)
    m.sweep('palm' + side, (s) => ({c: add(hand0, hd, s * .055), u: hx, v: hw, a: .014 - .002 * s, b: .029 + .004 * Math.sin(s * Math.PI), e: 2.4}), {ns: 8, nt: 14, capStart: .008, capEnd: .006, capRings: 2, island: isl(), bone: 'palm' + side, paint: skin});
    const fingers = [];
    for (let fi = 0; fi < 5; fi++) {
      const thumb = fi === 0, off = thumb ? .028 : lerp(.02, -.022, (fi - 1) / 3), len = thumb ? .04 : [0, .052, .058, .054, .044][fi], r0 = thumb ? .0085 : .0068;
      const base = thumb ? add(add(hand0, hd, .018), hw, .028) : add(add(hand0, hd, .052), hw, off), dir = thumb ? norm(add(hd, hw, .6)) : norm(add(hd, hx, -.12 * sd));
      const curl = (s) => add(add(base, dir, s * len), hx, -sd * .006 * s * s); // 끝으로 갈수록 손바닥 쪽으로 살짝 굽는다
      fingers.push({joints: [base, curl(.38), curl(.72)]});
      m.sweep(`finger${fi}${side}`, (s) => ({c: curl(s), u: hx, v: hw, a: r0 * (1 - .25 * s), b: r0 * (1.05 - .25 * s), e: 2}), {ns: 6, nt: 8, capEnd: r0 * .8, capRings: 2, island: isl(), bone: `finger${fi}${side}`, paint: (p) => mix(skin(p), [222, 186, 178], smooth(.85, .98, 0))});
    }
    arms[side] = {sh, el, wr, hand0, fingers};
  }

  // ── 청바지 · 신발 ──
  const denim = (p, n, light = 0) => { const tw = Math.sin((p[1] * 1100 + p[0] * 1100 + p[2] * 360)) * .5 + .5, g = n3(p, 70, 3); const base = mix(JEANS, JEANS_LT, clamp(light + .35 * (g - .5))); return base.map((v) => v * (.88 + .1 * tw + .1 * (n3(p, 9, 2) - .5)) * (.92 + .1 * smooth(-.6, .6, n[1]))); };
  m.sweep('hips', (s) => ({c: [0, lerp(B.hemY + .07, B.crotchY - .015, s), B.bodyZ], u: [0, 0, 1], v: [1, 0, 0], a: .12 + .01 * Math.sin(s * Math.PI), b: .17 - .02 * s, e: 2.4}), {ns: 8, nt: 36, capEnd: .025, capRings: 3, island: isl(), bone: 'hips', paint: (p, n) => denim(p, n, .2)});
  const legs = {};
  for (const [side, sd] of [['R', -1], ['L', 1]]) {
    const top = [sd * B.legX, B.crotchY + .06, B.bodyZ], ank = [sd * (B.legX + .008), B.floor + .045, B.bodyZ + .01], knee = mix(top, ank, .5);
    const toe = [sd * (B.legX + .01), B.floor + .03, B.bodyZ + .13], heel = [sd * (B.legX + .008), B.floor + .035, B.bodyZ - .07];
    legs[side] = {root: top, knee, ank: [ank[0], B.floor + .06, ank[2]], toe: mix(heel, toe, .7)};
    // 와이드 청바지 — 무릎 뒤 · 발목에 접힌 주름, 밑단이 신발 위로 살짝 끌린다
    m.sweep('leg' + side, (s) => { const c = mix(top, ank, s), r = B.legR + .004 * Math.sin(s * Math.PI) + .006 * smooth(.85, 1, s); return {c, u: [0, 0, 1], v: [1, 0, 0], a: r * .94, b: r, e: 2.1, r: (th) => 1 + .03 * Math.sin(th * 4 + s * 40) * (Math.exp(-(((s - .5) / .07) ** 2)) + smooth(.82, .97, s)) + .01 * Math.sin(th * 7 + s * 13)}; },
      {ns: 40, nt: 26, capStart: .03, capRings: 2, island: big(3), bone: 'leg' + side, paint: (p, n) => { const knee2 = Math.exp(-(((p[1] - (B.floor + .5)) / .08) ** 2)) * smooth(0, .5, n[2]); const side2 = smooth(.03, .006, Math.abs(Math.abs(p[0]) - (B.legX + B.legR * .97))); return mix(denim(p, n, .15 + .45 * knee2), JEANS.map((v) => v * .8), side2 * .6); }});
    m.sweep('shoe' + side, (s) => { const c = mix(heel, toe, s), w = .046 * Math.sin(Math.PI * (.08 + .84 * s)) ** .5 + .006; return {c: add(c, [0, -.008 * s * s, 0]), u: [0, 1, 0], v: [1, 0, 0], a: .034 * (1 - .35 * s) + .004, b: w, e: 2.6}; },
      {ns: 14, nt: 16, capStart: .02, capEnd: .025, capRings: 3, island: isl(), bone: 'shoe' + side, paint: (p) => { const sole = smooth(B.floor + .018, B.floor + .008, p[1]), lace = smooth(.82, .95, Math.sin(p[2] * 900)) * smooth(B.floor + .045, B.floor + .06, p[1]) * smooth(.025, .01, Math.abs(Math.abs(p[0]) - B.legX - .01)); return mix(mix([62, 62, 66], [205, 202, 196], sole), [190, 190, 194], lace).map((v) => v * (.92 + .1 * n3(p, 80, 2))); }});
  }

  // ── 크로스백 ──
  const front = (x, y) => { const w = torsoW(y); const ex = clamp((x - B.neck[0]) / (w.a + .01), -.99, .99); return B.bodyZ + w.dz + (w.b + .012) * (1 - Math.abs(ex) ** 2.6) ** (1 / 2.6); };
  const bagC = [-.215, .22, B.bodyZ + .09], s0 = [.12, B.shoulderY - .005], s1 = [-.2, .3];
  m.sweep('strap', (s) => { const x = lerp(s0[0], s1[0], s), y = lerp(s0[1], s1[1], s), z = front(x, y) + .006; return {c: [x, y, z], u: [0, 0, 1], v: norm([1, -.75, 0]), a: .006, b: .016, e: 3}; },
    {ns: 24, nt: 8, island: isl(), bone: 'strap', paint: (p) => { const d = Math.sin(p[0] * 300) * Math.sin(p[1] * 300); return mix(BAG, [30, 30, 32], smooth(.6, .9, d)); }});
  const bagPaint = (p) => { const q = [(p[0] - bagC[0]) * 46, (p[1] - bagC[1]) * 46], quilt = Math.abs(Math.sin(q[0] + q[1]) * Math.sin(q[0] - q[1])), dots = smooth(.75, .9, Math.sin(p[0] * 380) * Math.sin(p[1] * 380 + 1)); return mix(BAG.map((v) => v * (.8 + .22 * quilt)), [26, 26, 28], dots); };
  m.sweep('bag', (s) => ({c: add(bagC, [0, lerp(.075, -.075, s), 0]), u: [0, 0, 1], v: [1, 0, 0], a: .035 * Math.sin(Math.PI * (.1 + .8 * s)) ** .5 + .006, b: .07 * Math.sin(Math.PI * (.08 + .84 * s)) ** .4 + .008, e: 2.4, r: (th) => 1 + .03 * Math.abs(Math.sin(th * 4 + s * 12))}),
    {ns: 14, nt: 24, capStart: .01, capEnd: .01, capRings: 2, island: isl(), bone: 'bag', paint: bagPaint});
  console.log('slots used', slot, '/', SLOTS.length);

  // ── 게임 좌표 · 뼈 ──
  const G = (p) => [p[1], -p[2], -p[0]], H = (g) => [-g[2], g[0], -g[1]];
  for (const part of m.parts) { part.H = part.P; part.P = part.P.map(G); const f = part.paint; part.paint = (p, n, st) => f(H(p), H(n), st); }
  const fins = {L: {root: G(arms.R.sh), tip: G(arms.R.el)}, R: {root: G(arms.L.sh), tip: G(arms.L.el)}};
  const legsG = {L: {root: G(legs.R.root)}, R: {root: G(legs.L.root)}, parent: 3};
  const E = skeleton(arms, legs, [bagC[0], bagC[1] + .08, bagC[2]]).map((e) => ({...e, at: G(e.at)}));
  return {m, fins, legs: legsG, E, arms, legsH: legs};
}

const debug = process.argv.includes('--debug');
await MeshoptSimplifier.ready;
const {m, fins, legs, E, arms, legsH} = await build();
const NAMES = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip', 'leg_L', 'leg_R', ...E.map((e) => e.name)];
const BI = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const FIN = {R: 'fin_L', L: 'fin_R'}, LEG = {R: 'leg_L', L: 'leg_R'};
const W2 = (a, b, t) => [[BI[a], 1 - t + 1e-4], [BI[b], t + 1e-4]];
const {glb, tris} = await bake('yujin', m, {fins, legs, extraBones: E, atlas: ATLAS, roughness: .66, compress: {textureSize: 2048, uvBits: 14}, source: 'design/aqua3d-review/yujin/yujin-build3.mjs (머리 = Tripo 스캔 + 매끈한 얼굴 면 + 정면 사진, 몸 = 사진 비율로 지음, 관절 126)', weight: (part, g, st, k) => {
  const s = st[0], h = part.H?.[k];
  const sideOf = (nm) => nm.slice(-1);
  if (part.name.startsWith('sleeve')) { const sd = sideOf(part.name), w = smooth(.42, .58, s), sw = smooth(0, .14, s); return [[BI[FIN[sd] + '_tip'], w * sw + 1e-4], [BI[FIN[sd]], (1 - w) * sw + 1e-4], ...spineWeight(g[0]).slice(0, 2).map(([b, x]) => [b, x * (1 - sw) + 1e-5])]; }
  if (part.name.startsWith('cuff')) { const sd = sideOf(part.name); return W2(FIN[sd] + '_tip', 'wrist_' + sd, smooth(.2, .9, s)); }
  if (part.name.startsWith('palm')) { const sd = sideOf(part.name); return W2('wrist_' + sd, 'palm_' + sd, smooth(.1, .6, s)); }
  if (part.name.startsWith('finger')) { const fi = +part.name[6], sd = sideOf(part.name), j = s < .38 ? 0 : s < .72 ? 1 : 2, t = j === 0 ? smooth(.28, .42, s) : j === 1 ? smooth(.62, .76, s) : 1; return j === 2 ? [[BI[`f${fi}_2_${sd}`], 1]] : W2(`f${fi}_${j}_${sd}`, `f${fi}_${j + 1}_${sd}`, t); }
  if (part.name.startsWith('leg')) { const sd = sideOf(part.name), top = smooth(0, .1, s); if (s < .42) return [[BI[LEG[sd]], top + 1e-4], [3, 1 - top + 1e-4]]; return s < .58 ? W2(LEG[sd], 'knee_' + sd, smooth(.42, .58, s)) : s < .92 ? [[BI['knee_' + sd], 1]] : W2('knee_' + sd, 'ankle_' + sd, smooth(.92, 1, s)); }
  if (part.name.startsWith('shoe')) { const sd = sideOf(part.name); return W2('ankle_' + sd, 'toe_' + sd, smooth(.55, .8, s)); }
  if (part.name === 'bag') return [[BI.bag, 1]];
  if (part.name === 'strap') return W2('spine_1', 'bag', smooth(.4, 1, s));
  if ((part.name === 'head' || part.name === 'face') && h) {
    // 머리 — 목 아래(옷깃)는 몸, 뒤로 늘어진 긴 머리는 가닥 사슬(가로 두 가닥 · 세로 두 마디를 섞는다), 나머지는 머리
    const neckW = smooth(.725, .755, h[1]);
    if (h[2] < -.27 && h[1] < HAIR_TOP + .01 && h[1] > HAIR_BOT - .05) {
      const fx = clamp((h[0] - B.neck[0] + HAIR_X) / (2 * HAIR_X)) * (HAIR_N - 1), a = Math.min(HAIR_N - 2, Math.floor(fx)), ta = fx - a;
      const fy = clamp((HAIR_TOP - h[1]) / (HAIR_TOP - HAIR_BOT)) * HAIR_SEG, k = Math.min(HAIR_SEG - 1, Math.floor(fy)), k2 = Math.min(HAIR_SEG - 1, k + 1), tk = fy - k, root = smooth(0, .6, fy);
      const w = [[BI[`hair_${a}_${k}`], (1 - ta) * (1 - tk) * root], [BI[`hair_${a + 1}_${k}`], ta * (1 - tk) * root], [BI[`hair_${a}_${k2}`], (1 - ta) * tk * root], [BI[`hair_${a + 1}_${k2}`], ta * tk * root]];
      if (root < 1) w[0][1] += 0; return root < .999 ? [[BI.head, 1 - root + 1e-4], ...w.slice(0, 3)] : w;
    }
    return [[BI.head, neckW + 1e-4], [0, 1 - neckW + 1e-4]];
  }
  return spineWeight(g[0]);
}});
console.log('bones', NAMES.length);
if (tris > 40000 || glb.length > 3000000) throw Error(`yujin ${tris} tris ${glb.length} bytes`);
if (debug) await writeFile(new URL('source/debug-yujin.glb', HERE), glb);
else for (const key of ['yujin', 'juv_yujin', 'fry_yujin']) await writeFile(`public/aqua/models/fish/${key}.glb`, glb);
console.log('yujin', tris, 'tris', glb.length, 'bytes');
