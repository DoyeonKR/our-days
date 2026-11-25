// 부위로 짓는 동물 모델 도구(2026-11-24 [사용자: "펭귄도 바다코끼리도 다 엉망이야 모델이 다시 제작해 디테일이 단 하나도 없어"])
// 옆모습 그림 한 장을 관으로 부풀리는 길(mammal-tube-build)은 얼굴 · 주둥이 · 지느러미처럼 앞 · 위에서 보이는 것을 만들 수 없다.
// 여기서는 부위마다 '단면을 따라 이어 붙인 입체(sweep)'를 짓고, 텍스처는 부위마다 따로 나눈 칸에 3D 위치로 칠한다(무늬 · 주름 · 깃털 결이 입체에 붙는다).
// 게임 규칙: +X 머리 · +Y 위 · 길이 2 · 뼈 10개 · 저장 전 updateMatrixWorld · 겉면 바깥 · 떠 있는 부품 0.
import * as T from 'three';
import sharp from 'sharp';
import {compressGLB} from '../glb-compress.mjs';
import {packAsset} from '../shrimp-pack.mjs';
import {material} from '../relief-build.mjs';

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, t) => { const k = clamp((t - a) / (b - a)); return k * k * (3 - 2 * k); };
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
export const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);

// ── 3D 값 잡음 · fbm · 능선 ──
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
export function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export const fbm = (p, oct = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise(p[0] * f, p[1] * f, p[2] * f); a *= .5; f *= 2.03; } return s / (1 - .5 ** oct); };
export const ridge = (p, oct = 3) => { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise(p[0] * f, p[1] * f, p[2] * f) * 2 - 1)); a *= .5; f *= 2.1; } return s / (1 - .5 ** oct); };

/** 모델 하나 — 부위(part)를 쌓는다. 부위마다: 꼭짓점(위치 · 뼈 · 부위 안 좌표 s,t), 삼각형, 텍스처 칸, 칠하기 함수 */
export class Model {
  constructor() { this.parts = []; }
  /**
   * 단면을 따라 이어 붙인 입체. frame(s) → {c:[x,y,z] 중심, u:[..] 단면 '높이' 방향, v:[..] 단면 '폭' 방향, a 높이 반, b 폭 반, e 초타원(1 둥글다 · 클수록 네모), r?(θ) 단면 반지름 배율}
   * s = 0..1(길이), θ = 0..2π(둘레 — 0 이 u 방향). capStart/capEnd: 끝을 둥글게 닫을 길이(0 이면 점으로 모은다)
   */
  sweep(name, frame, {ns = 24, nt = 16, capStart = 0, capEnd = 0, capRings = 4, island, paint, bone, sMap = (s) => s, capSpanStart = 0, capSpanEnd = 0}) {
    // 끝을 닫는 고리도 텍스처 칸을 따로 받는다(capSpan — 칸의 가로 몫). 없으면 끝 얼굴이 한 줄에 몰려 방사형 줄무늬가 된다
    const S0 = capStart ? capSpanStart : 0, S1 = capEnd ? capSpanEnd : 0, body = (s) => S0 + (1 - S0 - S1) * sMap(s);
    const part = {name, P: [], ST: [], I: [], island, paint, bone, B: []}, ring = (s, k = 1, dx = [0, 0, 0], su = null) => {
      const f = frame(s), out = [];
      for (let j = 0; j <= nt; j++) {
        const th = Math.PI + j / nt * Math.PI * 2 /* 이음매(둘레 시작)는 아래쪽 — 위 · 옆에서 안 보이게 */, cu = Math.cos(th), sv = Math.sin(th), e = 2 / (f.e ?? 2), m = (f.r ? f.r(th, s) : 1) * k;
        const pu = spow(cu, e) * f.a * m, pv = spow(sv, e) * f.b * m;
        out.push(part.P.length); part.P.push(add(add(add(f.c, f.u, pu), f.v, pv), dx)); part.ST.push([su ?? body(s), j / nt]);
      }
      return out;
    };
    const rings = [];
    const capRingList = (atStart) => {
      const L = atStart ? capStart : capEnd; if (!L) return [];
      const s0 = atStart ? 0 : 1, f = frame(s0), dir = norm(add(frame(atStart ? 0.001 : .999).c, f.c, -1)), list = []; // dir: 끝에서 몸 안쪽
      for (let k = capRings; k >= 1; k--) { const q = Math.sin(k / (capRings + 1) * Math.PI / 2), shrink = Math.sqrt(1 - q * q); /* 끝으로 갈수록 고리를 촘촘히(돔 끝까지 둥글게) */ list.push(ring(s0, shrink, dir.map((v) => v * -L * q), atStart ? S0 * (1 - q) : 1 - S1 * (1 - q))); }
      return list;
    };
    const startCaps = capRingList(true); rings.push(...startCaps);
    for (let i = 0; i <= ns; i++) rings.push(ring(i / ns));
    const endCaps = capRingList(false).reverse(); rings.push(...endCaps);
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < nt; j++) { const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1]; part.I.push(a, c, b, b, c, d); }
    // 끝 점(닫기)
    // 2026-11-25 [사용자: "코가 너무 뭉툭해 글라인더로 자른느낌이야"] — 예전엔 마지막 고리(반지름 약 절반)의 가운데에 점을 찍어 끝이 납작한 원판이었다.
    //   끝을 둥글게 닫는 부위는 가운데 점을 돔 꼭대기(마개 길이 L 끝)로 내민다
    const tipOut = (atStart) => { const L = atStart ? capStart : capEnd; if (!L) return [0, 0, 0]; const f = frame(atStart ? 0 : 1).c, g = frame(atStart ? .001 : .999).c, q = Math.sin(capRings / (capRings + 1) * Math.PI / 2); return norm(add(f, g, -1)).map((v) => v * L * (1 - q)); };
    for (const [r, end] of [[rings[0], true], [rings[rings.length - 1], false]]) {
      const ctr = add(r.reduce((s, v) => add(s, part.P[v], 1 / r.length), [0, 0, 0]), tipOut(end)), ci = part.P.length; part.P.push(ctr); part.ST.push([end ? (S0 ? 0 : part.ST[r[0]][0]) : (S1 ? 1 : part.ST[r[0]][0]), .5]);
      for (let j = 0; j < nt; j++) part.I.push(...(end ? [ci, r[j + 1], r[j]] : [ci, r[j], r[j + 1]]));
    }
    this.parts.push(part); return part;
  }
  /** 구(눈) */
  sphere(name, c, r, opt) { return this.sweep(name, (s) => ({c: add(c, [r * (s * 2 - 1), 0, 0]), u: [0, 1, 0], v: [0, 0, 1], a: r * Math.sin(Math.PI * Math.max(.02, Math.min(.98, s))), b: r * Math.sin(Math.PI * Math.max(.02, Math.min(.98, s)))}), {ns: 8, nt: 10, ...opt}); }
}

/** 겉면 바깥 — 부위마다 (삼각형 법선 · 무게중심에서 바깥) 합이 음수면 그 부위 삼각형을 뒤집는다 */
function orient(part) {
  const P = part.P, c = P.reduce((s, p) => add(s, p, 1 / P.length), [0, 0, 0]); let sum = 0;
  for (let i = 0; i < part.I.length; i += 3) { const a = P[part.I[i]], b = P[part.I[i + 1]], d = P[part.I[i + 2]], n = cross(add(b, a, -1), add(d, a, -1)), m = [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3]; sum += n[0] * (m[0] - c[0]) + n[1] * (m[1] - c[1]) + n[2] * (m[2] - c[2]); }
  if (sum < 0) for (let i = 0; i < part.I.length; i += 3) { const t = part.I[i + 1]; part.I[i + 1] = part.I[i + 2]; part.I[i + 2] = t; }
}

/** 텍스처: 부위 칸(island [u0,v0,u1,v1], 0..1)에 삼각형을 깔고 3D 위치 · 법선으로 칠한다. 빈 칸은 가까운 색으로 번지게 */
async function paintAtlas(model, SIZE) {
  const img = new Float32Array(SIZE * SIZE * 3), has = new Uint8Array(SIZE * SIZE);
  for (const part of model.parts) {
    const [u0, v0, u1, v1] = part.island, uv = part.ST.map(([s, t]) => [u0 + (u1 - u0) * s, v0 + (v1 - v0) * t]); part.UV = uv;
    const N = part.N;
    for (let i = 0; i < part.I.length; i += 3) {
      const ids = [part.I[i], part.I[i + 1], part.I[i + 2]], q = ids.map((k) => [uv[k][0] * SIZE, uv[k][1] * SIZE]);
      const minx = Math.max(0, Math.floor(Math.min(...q.map((p) => p[0])) - 1)), maxx = Math.min(SIZE - 1, Math.ceil(Math.max(...q.map((p) => p[0])) + 1));
      const miny = Math.max(0, Math.floor(Math.min(...q.map((p) => p[1])) - 1)), maxy = Math.min(SIZE - 1, Math.ceil(Math.max(...q.map((p) => p[1])) + 1));
      const den = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]); if (Math.abs(den) < 1e-9) continue;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + .5, py = y + .5;
        let w0 = ((q[1][1] - q[2][1]) * (px - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / den, w1 = ((q[2][1] - q[0][1]) * (px - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / den, w2 = 1 - w0 - w1;
        if (w0 < -.02 || w1 < -.02 || w2 < -.02) continue;
        const o = y * SIZE + x; if (has[o] === 2) continue;
        w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2); const ws = w0 + w1 + w2; w0 /= ws; w1 /= ws; w2 /= ws;
        const P = [0, 1, 2].map((k) => part.P[ids[0]][k] * w0 + part.P[ids[1]][k] * w1 + part.P[ids[2]][k] * w2);
        const n = norm([0, 1, 2].map((k) => N[ids[0]][k] * w0 + N[ids[1]][k] * w1 + N[ids[2]][k] * w2));
        const st = [0, 1].map((k) => part.ST[ids[0]][k] * w0 + part.ST[ids[1]][k] * w1 + part.ST[ids[2]][k] * w2);
        const col = part.paint(P, n, st);
        img[o * 3] = col[0]; img[o * 3 + 1] = col[1]; img[o * 3 + 2] = col[2]; has[o] = (w0 > 0 && w1 > 0 && w2 > 0) ? 2 : 1;
      }
    }
  }
  // 번지기(밉맵 · 이음매)
  const near = new Int32Array(SIZE * SIZE).fill(-1), qq = new Int32Array(SIZE * SIZE); let a = 0, b = 0;
  for (let i = 0; i < SIZE * SIZE; i++) if (has[i]) { near[i] = i; qq[b++] = i; }
  while (a < b) { const i = qq[a++], x = i % SIZE; for (const j of [i - SIZE, i + SIZE, x ? i - 1 : -1, x < SIZE - 1 ? i + 1 : -1]) if (j >= 0 && j < SIZE * SIZE && near[j] < 0) { near[j] = near[i]; qq[b++] = j; } }
  const out = Buffer.alloc(SIZE * SIZE * 3); for (let i = 0; i < SIZE * SIZE; i++) { const k = near[i] < 0 ? i : near[i]; for (let c = 0; c < 3; c++) out[i * 3 + c] = clamp(img[k * 3 + c], 0, 255); }
  return sharp(out, {raw: {width: SIZE, height: SIZE, channels: 3}}).png().toBuffer();
}

/**
 * GLB 로 굽는다. weight(part, p정규화, st) → [[뼈 번호, 가중치], ...]. fins: {L:{root,tip}, R:{root,tip}} 짓는 좌표.
 * 뼈: spine_0..5(BX) · fin_L · fin_L_tip · fin_R · fin_R_tip
 */
export const BX = [.75, .45, .15, -.15, -.45, -.8];
export async function bake(key, model, {fins, weight, source, atlas = 1024, roughness = .7, alpha = 1}) {
  for (const p of model.parts) orient(p);
  // 법선(부위마다 — 칠하기에 쓴다)
  for (const part of model.parts) {
    const N = part.P.map(() => [0, 0, 0]);
    for (let i = 0; i < part.I.length; i += 3) { const [a, b, c] = [part.I[i], part.I[i + 1], part.I[i + 2]], n = cross(add(part.P[b], part.P[a], -1), add(part.P[c], part.P[a], -1)); for (const k of [a, b, c]) N[k] = add(N[k], n); }
    part.N = N.map(norm);
  }
  const png = await paintAtlas(model, atlas);
  // 정규화 — 길이 2, 가운데 0
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of model.parts) for (const v of p.P) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); }
  const S = 2 / (x1 - x0), M = [(x0 + x1) / 2, (y0 + y1) / 2, 0], G = (v) => [(v[0] - M[0]) * S, (v[1] - M[1]) * S, (v[2] - M[2]) * S];
  const pos = [], uvs = [], idx = [], J = [], W = [];
  for (const part of model.parts) {
    const base = pos.length / 3;
    part.P.forEach((v, k) => { const g = G(v); pos.push(...g); uvs.push(...part.UV[k]); const w = weight(part, g, part.ST[k]).slice(0, 4); const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0]; let s = 0; w.forEach(([b, x], i) => { j4[i] = b; w4[i] = x; s += x; }); for (let i = 0; i < 4; i++) w4[i] /= s || 1; J.push(...j4); W.push(...w4); });
    for (const i of part.I) idx.push(base + i);
  }
  if (pos.length / 3 > 65535) throw Error('vertices ' + pos.length / 3);
  const names = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'], bones = names.map((m) => { const b = new T.Bone(); b.name = m; return b; });
  for (let i = 0; i < 6; i++) { bones[i].position.set(i ? BX[i] - BX[i - 1] : BX[0], 0, 0); if (i) bones[i - 1].add(bones[i]); }
  bones[1].add(bones[6]); bones[6].add(bones[7]); bones[1].add(bones[8]); bones[8].add(bones[9]);
  // 지느러미 뼈 자리는 짓는 좌표로 받아 정규화한다
  const fl = {root: G(fins.L.root), tip: G(fins.L.tip)}, fr = {root: G(fins.R.root), tip: G(fins.R.tip)};
  bones[6].position.set(fl.root[0] - BX[1], fl.root[1], fl.root[2]); bones[7].position.set(fl.tip[0] - fl.root[0], fl.tip[1] - fl.root[1], fl.tip[2] - fl.root[2]);
  bones[8].position.set(fr.root[0] - BX[1], fr.root[1], fr.root[2]); bones[9].position.set(fr.tip[0] - fr.root[0], fr.tip[1] - fr.root[1], fr.tip[2] - fr.root[2]);
  bones[0].updateMatrixWorld(true);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(J, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(W, 4)); g.setIndex(idx); g.computeVertexNormals();
  const glb = await compressGLB(material(packAsset(key, [{name: key, geometry: g, extras: {aquaGeometry: 'part-built (design/aqua3d-review/polar)', source}}], png, bones), (m) => { m.name = 'painted_PBR_atlas'; m.doubleSided = true; m.pbrMetallicRoughness.metallicFactor = .05; m.pbrMetallicRoughness.roughnessFactor = roughness; if (alpha < 1) { m.alphaMode = 'BLEND'; m.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, alpha]; } }), {webpQuality: 92});
  return {glb, tris: idx.length / 3, scale: S, center: M};
}
/** 정규화 x 로 몸통 뼈 두 개 사이 */
export function spineWeight(x) { if (x >= BX[0]) return [[0, 1]]; if (x <= BX[5]) return [[5, 1]]; let k = 0; while (k < 4 && x < BX[k + 1]) k++; const f = clamp((BX[k] - x) / (BX[k] - BX[k + 1])); return [[k, 1 - f], [k + 1, f]]; }
