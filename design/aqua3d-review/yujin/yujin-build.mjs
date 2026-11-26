// 유진 3D(2026-11-26 [사용자: "이걸 기준으로 너가 해당 여자의 전신 모습을 3d 모델링해줘 … 기준 이미지와 완전 똑같아야해"] — 본인 요청 · 공개 배포 동의)
// 2차(같은 날) [사용자: "그냥 마네킹에 사진 붙여놓은 것 같아 … 근본적으로 고쳐야해" → 서 있는 전신 사진 + "색정보라던지 그런 비율 그런것들을 너가 만들어야해"]
//   1차는 앉은 스캔(Tripo — 색 없음, 뭉개진 몸, 무릎 아래 없음)을 세우고 사진을 비춰 붙였다 → 마네킹 같았다.
//   이제 스캔은 머리(얼굴 형상 · 머리칼)만 쓰고, 몸은 서 있는 사진(ref/photo3)의 비율 · 옷 색으로 부위마다 짓는다:
//   검은 플리스 집업(하이넥 · 넉넉한 소매 · 시보리 소맷단) · 손 · 연청 와이드 청바지 · 신발 · 크림색 도트 퀼팅 크로스백 · 등에 늘어진 긴 머리.
//   얼굴은 정면 증명사진(ref/photo2)을 눈 가운데 · 눈→턱 거리로 같은 배율로 맞춰 비춘다.
// 원본 · 사진은 레포에 올리지 않는다(source/ · ref/ — .gitignore).
// 비율(사진 photo3 에서 잰 값 — 머리 꼭대기 44px · 턱 92px · 발 405px · 재킷 밑단 218px · 가랑이 235px · 다리 폭 35px):
//   7.5 등신 · 머리 0.235(스캔 그대로, 꼭대기 y 1 · 턱 0.765) → 키 1.76, 바닥 y -0.76 · 재킷 밑단 y 0.15 · 가랑이 y 0.07
// 좌표: 사람(y 위 · 얼굴 +z · 오른쪽 -x)으로 짓고 게임 좌표(+X 머리 · +Y 등)로 돌린다.
// node design/aqua3d-review/yujin/yujin-build.mjs [--debug]
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
const sample = (ph, u, v) => {
  u = clamp(u, 0, ph.w - 1.001); v = clamp(v, 0, ph.h - 1.001); const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y, o = (y * ph.w + x) * 3, r = ph.w * 3;
  return [0, 1, 2].map((c) => (ph.d[o + c] * (1 - fx) + ph.d[o + 3 + c] * fx) * (1 - fy) + (ph.d[o + r + c] * (1 - fx) + ph.d[o + r + 3 + c] * fx) * fy);
};
const avgBox = (ph, u0, v0, u1, v1) => { const s = [0, 0, 0]; let n = 0; for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) { const c = sample(ph, u, v); for (let k = 0; k < 3; k++) s[k] += c[k]; n++; } return s.map((x) => x / n); };

// ── 비율(사람 좌표) ──
export const B = {
  top: 1, chin: .765, floor: -.76,
  neck: [-.01, -.235], // 목 가운데(x, z)
  bodyZ: -.235, // 몸통 가운데 z
  shoulderY: .655, hemY: .15, crotchY: .07,
  sh: [.175, .6], el: [.232, .4], wr: [.245, .2], // 어깨 · 팔꿈치 · 손목(x, y) — 넉넉한 소매라 몸에서 조금 떨어져 늘어진다
  legX: .095, legR: .086,
};

// ── 얼굴(photo2) — 같은 배율 하나 ──
const FACE_MODEL = [[-.046, .884], [.031, .883], [-.012, .829], [-.011, .792], [-.008, .765]];
const FACE_PHOTO = [[447, 535], [643, 533], [543, 668], [543, 752], [543, 878]];
function faceMap() {
  const em = [(FACE_MODEL[0][0] + FACE_MODEL[1][0]) / 2, (FACE_MODEL[0][1] + FACE_MODEL[1][1]) / 2], ep = [(FACE_PHOTO[0][0] + FACE_PHOTO[1][0]) / 2, (FACE_PHOTO[0][1] + FACE_PHOTO[1][1]) / 2];
  const sc = (FACE_PHOTO[4][1] - ep[1]) / (em[1] - FACE_MODEL[4][1]);
  return (x, y) => [ep[0] + (x - em[0]) * sc, ep[1] - (y - em[1]) * sc];
}

// ── 머리(스캔) ──
const CUT_Y = .7;
function head() {
  const {P, I} = loadSource();
  // 얼굴 고르기 — 스캔의 감은 눈 · 눈두덩 굴곡이 사진의 뜬 눈 밑에 그림자를 만든다. 코는 덜
  const nb = Array.from({length: P.length}, () => new Set());
  for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const wOf = (p) => { if (p[1] < .76 || p[1] > .93 || p[2] < -.2) return 0; const e = Math.hypot((p[0] + .008) / .06, (p[1] - .845) / .08); const nose = Math.exp(-(((p[0] + .012) / .016) ** 2 + ((p[1] - .835) / .03) ** 2)); return smooth(1, .7, e) * (1 - .85 * nose); };
  const W = P.map(wOf), ids = P.map((_, i) => i).filter((i) => W[i] > 0);
  for (let it = 0; it < 22; it++) { const nx = ids.map((i) => { const m = [0, 0, 0]; for (const j of nb[i]) { m[0] += P[j][0]; m[1] += P[j][1]; m[2] += P[j][2]; } const k = nb[i].size || 1; return [m[0] / k, m[1] / k, m[2] / k]; }); ids.forEach((i, j) => { const w = W[i] * .75; P[i] = [P[i][0] + (nx[j][0] - P[i][0]) * w, P[i][1] + (nx[j][1] - P[i][1]) * w, P[i][2] + (nx[j][2] - P[i][2]) * w]; }); }
  // 목 아래를 뗀다(몸은 새로 짓는다) — 삼각형 세 꼭짓점이 모두 CUT_Y 위인 것만, 그중 가장 큰 덩어리
  const inHead = (p) => p[1] > CUT_Y || (p[1] > .46 && p[2] < -.34 && Math.abs(p[0] + .01) < .17);
  const keep = []; for (let t = 0; t < I.length; t += 3) if (inHead(P[I[t]]) && inHead(P[I[t + 1]]) && inHead(P[I[t + 2]])) keep.push(I[t], I[t + 1], I[t + 2]);
  const par = Int32Array.from({length: P.length}, (_, i) => i), f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let t = 0; t < keep.length; t += 3) { const a = f(keep[t]); par[f(keep[t + 1])] = a; par[f(keep[t + 2])] = a; }
  const cnt = new Map(); for (let t = 0; t < keep.length; t += 3) cnt.set(f(keep[t]), (cnt.get(f(keep[t])) ?? 0) + 1);
  const big = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0], K = []; for (let t = 0; t < keep.length; t += 3) if (f(keep[t]) === big) K.push(keep[t], keep[t + 1], keep[t + 2]);
  // 줄이기 — 얼굴 쪽은 부풀린 좌표에서(같은 오차면 얼굴에 삼각형이 더 남는다)
  const flat = new Float32Array(P.length * 3); P.forEach((p, i) => { const k = 1 + 1.6 * smooth(-.24, -.15, p[2]) * smooth(.75, .78, p[1]); flat[i * 3] = p[0] * k; flat[i * 3 + 1] = p[1] * k; flat[i * 3 + 2] = p[2] * k; });
  const [ix] = MeshoptSimplifier.simplify(new Uint32Array(K), flat, 3, 5000 * 3, .05, []);
  const used = new Map(), HP = [], HI = []; for (const i of ix) { if (!used.has(i)) { used.set(i, HP.length); HP.push(P[i]); } HI.push(used.get(i)); }
  return {P: HP, I: HI};
}

// ── 칸 나누기(스캔) ──
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const projUV = (a, p) => [[-p[2], p[1]], [p[2], p[1]], [p[0], -p[2]], [p[0], p[2]], [p[0], p[1]], [-p[0], p[1]]][a];
function charts(P, I) {
  const nt = I.length / 3, tn = [], lab = new Int8Array(nt);
  for (let t = 0; t < nt; t++) { const a = P[I[t * 3]], b = P[I[t * 3 + 1]], c = P[I[t * 3 + 2]], n = norm(cross(sub(b, a), sub(c, a))); tn.push(n); let best = 0, bd = -9; AXES.forEach((ax, k) => { const d = dot(n, ax); if (d > bd) { bd = d; best = k; } }); lab[t] = best; }
  const em = new Map(), nb = Array.from({length: nt}, () => []);
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) { const a = I[t * 3 + e], b = I[t * 3 + (e + 1) % 3], k = a < b ? a + ',' + b : b + ',' + a; const o = em.get(k); if (o !== undefined) { nb[t].push(o); nb[o].push(t); } else em.set(k, t); }
  for (let it = 0; it < 4; it++) for (let t = 0; t < nt; t++) { const cnt = new Map(); for (const o of nb[t]) cnt.set(lab[o], (cnt.get(lab[o]) ?? 0) + 1); for (const [l, c] of cnt) if (l !== lab[t] && c >= 2 && dot(tn[t], AXES[l]) > .2) { lab[t] = l; break; } }
  const comp = new Int32Array(nt).fill(-1), out = []; let id = 0;
  for (let t = 0; t < nt; t++) { if (comp[t] >= 0) continue; const q = [t], list = []; comp[t] = id; while (q.length) { const u = q.pop(); list.push(u); for (const o of nb[u]) if (comp[o] < 0 && lab[o] === lab[t]) { comp[o] = id; q.push(o); } } out.push({axis: lab[t], tris: list}); id++; }
  return out;
}
function pack(items, area) {
  const [X0, Y0, X1, Y1] = area, PAD = 6 / 2048, MIN = 26 / 2048;
  const tryS = (s) => { let x = X0, y = Y0, row = 0; const pos = []; for (const it of [...items].sort((a, b) => b.h - a.h)) { const w = Math.max(MIN, it.w * s * it.k) + 2 * PAD, h = Math.max(MIN, it.h * s * it.k) + 2 * PAD; if (x + w > X1) { x = X0; y += row; row = 0; } if (y + h > Y1) return null; pos.push([it, [x + PAD, y + PAD, x + w - PAD, y + h - PAD]]); x += w; row = Math.max(row, h); } return pos; };
  let lo = 0, hi = 50; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (tryS(m)) lo = m; else hi = m; }
  return tryS(lo);
}

async function build() {
  const ph2 = await photo('photo2.webp'), ph3 = await photo('photo3.png'), face = faceMap();
  // 색 — photo3(서 있는 전신)에서: 재킷(검은 플리스), 청바지(연청), 가방(크림), 피부는 photo2
  const JACKET = avgBox(ph3, 95, 160, 120, 200), JEANS = avgBox(ph3, 75, 280, 95, 360), JEANS_LT = avgBox(ph3, 115, 250, 135, 290), BAG = avgBox(ph3, 60, 200, 66, 225);
  const SKIN = avgBox(ph2, 380, 620, 440, 680), HAIR = [22, 19, 18];
  // 역 조명(초록빛 형광등) · 작은 사진이라 잰 값이 칙칙하다 — 연청 · 크림 · 검정을 사진 색상 쪽으로 맞춰 바로잡는다
  JACKET.splice(0, 3, ...JACKET.map((v, k) => Math.max(v, [20, 20, 24][k]))); JEANS.splice(0, 3, 112, 124, 134); JEANS_LT.splice(0, 3, 158, 168, 176); BAG.splice(0, 3, 214, 206, 184);
  console.log(JSON.stringify({JACKET, JEANS, JEANS_LT, BAG, SKIN}, (k, v) => (typeof v === 'number' ? Math.round(v) : v)));
  const m = new Model();
  const n3 = (p, f, o = 3) => fbm([p[0] * f, p[1] * f, p[2] * f], o);

  // ── 머리(스캔) ──
  const {P, I} = head();
  const hairCol = (p) => { const strand = fbm([p[0] * 160, p[1] * 14, p[2] * 160], 3), sheen = smooth(.55, .9, fbm([p[0] * 30, p[1] * 4, p[2] * 30], 2)); return HAIR.map((v, k) => v * (.7 + .7 * strand) + [30, 24, 22][k] * sheen * .35); };
  const faceW = (p, n) => { if (p[1] < .73 || p[1] > .95) return 0; const e = Math.hypot((p[0] + .008) / .062, (p[1] - .83) / .095); return smooth(1.12, .9, e) * smooth(-.35, -.05, n[2]); }; // 얼굴 타원 안은 면 방향과 상관없이(코 밑 · 이마 위를 보는 면이 머리색을 받아 거뭇했다)
  const headPaint = (p, n) => {
    // 목 · 옷깃(턱 아래, 목 둘레) — 하이넥 검은 집업
    const dn = Math.hypot(p[0] - B.neck[0], p[2] - B.neck[1]);
    let c = (p[1] < B.chin - .005 && dn < .12 && p[2] > -.33) ? JACKET.map((v) => v * (.8 + .4 * n3(p, 90))) : hairCol(p);
    const wf = Math.max(faceW(p, n), smooth(.1, .4, n[2]) * smooth(.75, .775, p[1]));
    if (wf > 0) { const [u, v] = face(p[0], p[1]), pc = sample(ph2, u, v), bright = Math.min(...pc), bg = smooth(185, 215, bright) * smooth(30, 12, Math.max(...pc) - bright) * smooth(.6, .2, faceW(p, n)); let col = pc; const under = smooth(-.3, -.65, n[1]) * smooth(.6, .3, Math.hypot((p[0] + .008) / .062, (p[1] - .83) / .095)); if (under > 0) col = mix(col, SKIN.map((x, k) => x * [.93, .88, .86][k]), under * .6); c = mix(c, col, wf * (1 - bg)); }
    return c;
  };
  const ch = charts(P, I), items = ch.map((c) => {
    let u0 = 9, u1 = -9, v0 = 9, v1 = -9, cz = 0, cnt = 0;
    for (const t of c.tris) for (let e = 0; e < 3; e++) { const p = P[I[t * 3 + e]], [u, v] = projUV(c.axis, p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); cz += p[2]; cnt++; }
    const k = c.axis === 4 && cz / cnt > -.25 ? 4 : 1; // 얼굴 쪽 칸을 넓게
    return {c, u0, v0, w: Math.max(1e-4, u1 - u0), h: Math.max(1e-4, v1 - v0), k};
  });
  // 아틀라스: 위 0.62 는 머리, 아래 0.38 은 지은 부위
  for (const [it, island] of pack(items, [0, 0, 1, .62])) {
    const loc = new Map(), part = {name: 'head', P: [], ST: [], I: [], island, paint: headPaint, bone: 'head', B: [], keepWinding: true, weld: 'head'};
    for (const t of it.c.tris) for (let e = 0; e < 3; e++) { const i = I[t * 3 + e]; if (!loc.has(i)) { loc.set(i, part.P.length); part.P.push(P[i]); const [u, v] = projUV(it.c.axis, P[i]); part.ST.push([(u - it.u0) / it.w, (v - it.v0) / it.h]); } part.I.push(loc.get(i)); }
    m.parts.push(part);
  }
  console.log('head charts', ch.length, 'tris', I.length / 3);

  // ── 지은 부위 칸(아래 띠) ──
  let slot = 0; const SLOTS = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) SLOTS.push([c / 8, .62 + r * .38 / 3, (c + 1) / 8, .62 + (r + 1) * .38 / 3]);
  const isl = () => SLOTS[slot++];
  const big = (n = 2) => { const a = SLOTS[slot], b = SLOTS[slot + n - 1]; slot += n; return [a[0], a[1], b[2], b[3]]; };

  // 검은 플리스 — 보송한 결, 솔기 · 지퍼
  const fleece = (p, n) => { const g = n3(p, 140, 3), cl = n3(p, 22, 2); return JACKET.map((v, k) => v * (.72 + .5 * g + .25 * (cl - .5)) * (.9 + .15 * smooth(-.5, .8, n[1])) + [6, 6, 8][k] * smooth(.6, .95, g)); };
  const zip = (p) => smooth(.007, .003, Math.abs(p[0] - B.neck[0])) * (p[2] > B.bodyZ ? 1 : 0);
  const jacketPaint = (p, n) => mix(fleece(p, n), [70, 70, 74], zip(p) * .9);
  // 몸통 — 어깨에서 밑단까지. 넉넉한 박스핏, 가슴이 조금 앞으로
  const torsoW = (y) => { const t = clamp((B.shoulderY - y) / (B.shoulderY - B.hemY)); return {a: .2 + .012 * Math.sin(t * Math.PI), b: lerp(.12, .13, t) + .012 * Math.sin(t * Math.PI * .8), dz: .012 * Math.sin(t * Math.PI)}; };
  m.sweep('torso', (s) => { const y = lerp(B.shoulderY + .05, B.hemY, s), w = torsoW(y), k = smooth(B.shoulderY + .05, B.shoulderY - .045, y); return {c: [B.neck[0], y, B.bodyZ + w.dz], u: [0, 0, 1], v: [1, 0, 0], a: lerp(.085, w.b, Math.sqrt(k)), b: lerp(.09, w.a, Math.sin(k * Math.PI / 2)), e: lerp(2, 2.6, k)}; },
    {ns: 16, nt: 24, capStart: .02, capRings: 2, island: big(3), bone: 'body', paint: jacketPaint});
  // 하이넥 옷깃 — 턱 밑까지, 지퍼
  m.sweep('collar', (s) => ({c: [B.neck[0], lerp(B.shoulderY + .005, B.chin - .02, s), B.neck[1] + .005], u: [0, 0, 1], v: [1, 0, 0], a: .085 - .008 * s, b: .088 - .01 * s, e: 2.2}),
    {ns: 4, nt: 24, capEnd: .01, capRings: 1, island: isl(), bone: 'body', paint: jacketPaint});
  // 밑단 시보리(조금 좁고 결이 세로)
  m.sweep('hem', (s) => { const w = torsoW(B.hemY); return {c: [B.neck[0], lerp(B.hemY + .03, B.hemY - .015, s), B.bodyZ + w.dz], u: [0, 0, 1], v: [1, 0, 0], a: w.b - .006 * s, b: w.a - .01 * s, e: 2.6}; },
    {ns: 3, nt: 28, island: isl(), bone: 'body', paint: (p, n) => fleece(p, n).map((v) => v * (.85 + .2 * Math.max(0, Math.sin(Math.atan2(p[0], p[2] - B.bodyZ) * 90))))});

  // 소매 · 손(팔마다) — 어깨 → 팔꿈치 → 손목, 소맷단 시보리, 손
  const arms = {};
  for (const [side, sd] of [['R', -1], ['L', 1]]) {
    const sh = [sd * B.sh[0], B.sh[1], B.bodyZ], el = [sd * B.el[0], B.el[1], B.bodyZ + .01], wr = [sd * B.wr[0], B.wr[1], B.bodyZ + .05];
    arms[side] = {sh, el, wr};
    const path = (s) => (s < .5 ? mix(sh, el, s / .5) : mix(el, wr, (s - .5) / .5));
    m.sweep('sleeve' + side, (s) => { const c = path(s), r = lerp(.074, .066, s) + .006 * Math.sin(s * Math.PI * 2) * (1 - s); const d = norm(sub(path(Math.min(1, s + .02)), path(Math.max(0, s - .02)))); let u = norm(cross(d, [1, 0, 0])); if (u[2] < 0) u = u.map((x) => -x); const v = cross(d, u); return {c, u, v, a: r * .92, b: r, e: 2}; },
      {ns: 16, nt: 14, capStart: .03, capRings: 2, island: isl(), bone: 'sleeve' + side, paint: jacketPaint});
    const cuffD = norm(sub(wr, el));
    m.sweep('cuff' + side, (s) => { const c = add(wr, cuffD, lerp(-.01, .045, s)); return {c, u: [0, 0, 1], v: [1, 0, 0], a: .056 - .01 * s, b: .058 - .01 * s, e: 2}; },
      {ns: 3, nt: 14, island: isl(), bone: 'sleeve' + side, paint: (p, n) => fleece(p, n).map((v) => v * (.82 + .22 * Math.max(0, Math.sin(Math.atan2(p[0] - wr[0], p[2] - wr[2]) * 14))))});
    // 손 — 손바닥(납작한 타원) + 모은 손가락 + 엄지. 손바닥이 몸 쪽을 본다
    const hand0 = add(wr, cuffD, .035), hd = norm(add(cuffD, [0, -.4, .05], 1)), hx = [sd, 0, 0];
    const skin = (p) => SKIN.map((v, k) => v * (.86 + .1 * n3(p, 120, 2)) * [.9, .8, .74][k]);
    m.sweep('hand' + side, (s) => { const c = add(hand0, hd, s * .105), w = .038 * Math.sin(Math.PI * (.12 + .8 * s)) ** .6 + .006, t = .017 * (1 - .4 * s) + .004; return {c, u: hx, v: norm(cross(hd, hx)), a: t, b: w, e: 2.2}; },
      {ns: 10, nt: 12, capStart: .01, capEnd: .012, capRings: 2, island: isl(), bone: 'hand' + side, paint: skin});
    m.sweep('thumb' + side, (s) => { const c = add(add(hand0, hd, .025 + s * .045), norm(cross(hd, hx)), .028 + .006 * s); return {c, u: hx, v: norm(cross(hd, hx)), a: .011 - .003 * s, b: .012 - .003 * s, e: 2}; },
      {ns: 5, nt: 8, capEnd: .008, capRings: 2, island: isl(), bone: 'hand' + side, paint: skin});
  }

  // 청바지 — 엉덩이(재킷 밑단 안쪽부터) · 다리(와이드 스트레이트, 밑단이 신발 위로 살짝 끌린다)
  const denim = (p, n, light = 0) => { const tw = Math.sin((p[1] * 900 + p[0] * 900 + p[2] * 300)) * .5 + .5, g = n3(p, 60, 3); const base = mix(JEANS, JEANS_LT, clamp(light + .35 * (g - .5))); return base.map((v) => v * (.88 + .1 * tw + .1 * (n3(p, 9, 2) - .5)) * (.92 + .1 * smooth(-.6, .6, n[1]))); };
  m.sweep('hips', (s) => ({c: [0, lerp(B.hemY + .07, B.crotchY - .015, s), B.bodyZ], u: [0, 0, 1], v: [1, 0, 0], a: .12 + .01 * Math.sin(s * Math.PI), b: .17 - .02 * s, e: 2.4}),
    {ns: 6, nt: 24, capEnd: .025, capRings: 2, island: isl(), bone: 'hips', paint: (p, n) => denim(p, n, .2)});
  const legs = {};
  for (const [side, sd] of [['R', -1], ['L', 1]]) {
    const top = [sd * B.legX, B.crotchY + .06, B.bodyZ], ank = [sd * (B.legX + .008), B.floor + .045, B.bodyZ + .01];
    legs[side] = {root: top};
    m.sweep('leg' + side, (s) => { const c = mix(top, ank, s), r = B.legR + .004 * Math.sin(s * Math.PI) + .006 * smooth(.85, 1, s); return {c, u: [0, 0, 1], v: [1, 0, 0], a: r * .94, b: r, e: 2.1}; },
      {ns: 16, nt: 16, capStart: .03, capRings: 2, island: big(2), bone: 'leg' + side, paint: (p, n) => { const knee = Math.exp(-(((p[1] - (B.floor + .5)) / .08) ** 2)) * smooth(0, .5, n[2]); const side2 = smooth(.03, .006, Math.abs(Math.abs(p[0]) - (B.legX + B.legR * .97))); return mix(denim(p, n, .15 + .45 * knee), JEANS.map((v) => v * .8), side2 * .6); }});
    // 신발 — 밑단 아래로 앞코만 보인다(사진: 짙은 회색 운동화)
    const toe = [sd * (B.legX + .01), B.floor + .03, B.bodyZ + .13], heel = [sd * (B.legX + .008), B.floor + .035, B.bodyZ - .07];
    m.sweep('shoe' + side, (s) => { const c = mix(heel, toe, s), w = .046 * Math.sin(Math.PI * (.08 + .84 * s)) ** .5 + .006; return {c: add(c, [0, -.008 * s * s, 0]), u: [0, 1, 0], v: [1, 0, 0], a: .034 * (1 - .35 * s) + .004, b: w, e: 2.6}; },
      {ns: 8, nt: 10, capStart: .02, capEnd: .025, capRings: 2, island: isl(), bone: 'leg' + side, paint: (p) => mix([62, 62, 66], [205, 202, 196], smooth(B.floor + .018, B.floor + .008, p[1])).map((v) => v * (.92 + .1 * n3(p, 80, 2)))});
  }

  // 크로스백 — 왼어깨에서 몸 앞을 가로질러 오른쪽 엉덩이로 내려오는 끈 + 크림색 도트 퀼팅 가방
  const front = (x, y) => { const w = torsoW(y); const ex = clamp((x - B.neck[0]) / (w.a + .01), -.99, .99); return B.bodyZ + w.dz + (w.b + .012) * (1 - Math.abs(ex) ** 2.6) ** (1 / 2.6); };
  const bagC = [-.215, .22, B.bodyZ + .09], s0 = [.12, B.shoulderY - .005], s1 = [-.2, .3];
  m.sweep('strap', (s) => { const x = lerp(s0[0], s1[0], s), y = lerp(s0[1], s1[1], s), z = front(x, y) + .006; return {c: [x, y, z], u: [0, 0, 1], v: norm([1, -.75, 0]), a: .006, b: .016, e: 3}; },
    {ns: 14, nt: 6, island: isl(), bone: 'body', paint: (p) => { const d = Math.sin(p[0] * 260) * Math.sin(p[1] * 260); return mix(BAG, [30, 30, 32], smooth(.6, .9, d)); }});
  const bagPaint = (p) => { const q = [(p[0] - bagC[0]) * 40, (p[1] - bagC[1]) * 40], quilt = Math.abs(Math.sin(q[0] + q[1]) * Math.sin(q[0] - q[1])), dots = smooth(.75, .9, Math.sin(p[0] * 330) * Math.sin(p[1] * 330 + 1)); return mix(BAG.map((v) => v * (.82 + .2 * quilt)), [26, 26, 28], dots); };
  m.sweep('bag', (s) => ({c: add(bagC, [0, lerp(.075, -.075, s), 0]), u: [0, 0, 1], v: [1, 0, 0], a: .035 * Math.sin(Math.PI * (.1 + .8 * s)) ** .5 + .006, b: .07 * Math.sin(Math.PI * (.08 + .84 * s)) ** .4 + .008, e: 2.4}),
    {ns: 8, nt: 14, capStart: .01, capEnd: .01, capRings: 2, island: isl(), bone: 'body', paint: bagPaint});

  // 등에 늘어진 긴 머리 — 뒤통수 아래에서 등 가운데까지, 끝이 가늘어지며 층이 진다
  if (false) m.sweep('hairBack', (s) => { const y = lerp(.79, .43, s), w = .125 - .025 * s + .02 * Math.sin(s * Math.PI), back = Math.min(-.37, B.bodyZ - torsoW(Math.min(y, B.shoulderY)).b - .02); return {c: [B.neck[0], y, back], u: [0, 0, 1], v: [1, 0, 0], a: .022 * (1 - .5 * s) + .004, b: w, e: 3, r: (th) => 1 + .25 * Math.sin(th * 7 + s * 3) * smooth(.6, 1, s)}; },
    {ns: 14, nt: 16, capEnd: .01, capRings: 2, island: isl(), bone: 'body', paint: hairCol});
  console.log('slots used', slot, '/', SLOTS.length);

  // 게임 좌표 — X = 위, Y = 등(-z), Z = -x
  const G = (p) => [p[1], -p[2], -p[0]], H = (g) => [-g[2], g[0], -g[1]];
  for (const part of m.parts) { part.P = part.P.map(G); const f = part.paint; part.paint = (p, n, st) => f(H(p), H(n), st); }
  // 팔 뼈: 게임 Z>0 = 오른팔(x<0) → fin_L(6 · 7) · 다리 뼈: 오른 다리 → leg_L(10)
  const fins = {L: {root: G(arms.R.sh), tip: G(arms.R.el)}, R: {root: G(arms.L.sh), tip: G(arms.L.el)}};
  const legsG = {L: {root: G(legs.R.root)}, R: {root: G(legs.L.root)}, parent: 3};
  return {m, fins, legs: legsG};
}

const debug = process.argv.includes('--debug');
await MeshoptSimplifier.ready;
const {m, fins, legs} = await build();
const armBone = {sleeveR: 6, handR: 7, sleeveL: 8, handL: 9};
const {glb, tris} = await bake('yujin', m, {fins, legs, atlas: 2048, roughness: .66, compress: {textureSize: 1024, uvBits: 14}, source: 'design/aqua3d-review/yujin/yujin-build.mjs (머리 = Tripo 스캔 + 정면 사진, 몸 = 사진 비율로 지음)', weight: (part, g, st) => {
  const s = st[0];
  if (part.bone === 'sleeveR' || part.bone === 'sleeveL') { const root = armBone[part.bone]; if (part.name.startsWith('cuff')) return [[root + 1, 1]]; const w = smooth(.42, .58, s), sw = smooth(0, .14, s); return [[root + 1, w * sw], [root, (1 - w) * sw + 1e-4], ...spineWeight(g[0]).map(([b, x]) => [b, x * (1 - sw) + 1e-5])].slice(0, 4); }
  if (part.bone === 'handR' || part.bone === 'handL') return [[armBone[part.bone], 1]];
  if (part.bone === 'legR') return part.name.startsWith('leg') ? [[10, smooth(0, .12, s)], [3, 1 - smooth(0, .12, s) + 1e-4]] : [[10, 1]];
  if (part.bone === 'legL') return part.name.startsWith('leg') ? [[11, smooth(0, .12, s)], [3, 1 - smooth(0, .12, s) + 1e-4]] : [[11, 1]];
  return spineWeight(g[0]);
}});
if (tris > 12000 || glb.length > 900000) throw Error(`yujin ${tris} tris ${glb.length} bytes`);
if (debug) await writeFile(new URL('source/debug-yujin.glb', HERE), glb);
else for (const key of ['yujin', 'juv_yujin', 'fry_yujin']) await writeFile(`public/aqua/models/fish/${key}.glb`, glb);
console.log('yujin', tris, 'tris', glb.length, 'bytes');
