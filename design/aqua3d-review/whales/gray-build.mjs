// 귀신고래 3D — 사진 기준(2026-11-18) [사용자: "위는 귀신고래 기준이미지야 너가 알고있는거랑 달라 해당 이미지를 기준이미지로 변경하고 그에맞게 glb 다시 가다듬어"]
// 예전 모델은 NOAA 흑백 일러스트(옆모습 하나)에서 지은 관이라 위 · 앞에서 본 폭 · 가슴지느러미 · 꼬리 모양이 다 추측이었다.
// 사용자 사진 셋(reference/gray-photo-side · top · front, 오려낸 것 gray-cut-*.png — gray-cut.mjs)으로 다시 짓는다:
//  · 몸통 = 옆 사진의 열마다 중심선 · 반높이 × 위 사진의 열마다 반폭 — 단면이 타원(위에서 본 폭이 사진 그대로)
//  · 색 = 등 쪽은 위 사진(따개비 · 얼룩 · 숨구멍), 옆 · 배는 옆 사진 — 몸 둘레 각도에 따라 섞는다
//  · 가슴지느러미 · 꼬리 = 위 사진에서 몸 폭 밖으로 나온 판(위에서 본 모양 그대로, 얇게 부풀림). 앞 사진처럼 가슴지느러미는 몸 아래쪽에서
//    바깥 · 아래로 비스듬히(FIN_DROOP) 뻗는다. 꼬리는 수평.
// 게임 규칙: +X 머리 · +Y 위 · 길이 2 · 뼈 10개(spine_0..5 · fin_L/R(+tip) = 가슴지느러미) · 저장 전 updateMatrixWorld(bindpose.test) · 삼각형 8,000 안.
// node design/aqua3d-review/whales/gray-build.mjs   → public/aqua/models/fish/{,fry_,juv_}gray_whale.glb
import * as T from 'three';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {compressGLB} from '../glb-compress.mjs';
import {packAsset} from '../shrimp-pack.mjs';
import {loadArt, relief, material, distance} from '../relief-build.mjs';

const R = 'design/aqua3d-review/whales/reference/';
/** 가슴지느러미가 몸 밖으로 나온 만큼 아래로 처지는 기울기(앞 사진에서 약 35°) */
const FIN_DROOP = Math.tan(35 * Math.PI / 180);
/** 단계 빛깔 — make-art.mjs 의 STAGE 와 같다(새끼는 옅게) */
export const STAGE = {fry: {k: .3, rgb: [205, 214, 222]}, juv: {k: .14, rgb: [205, 214, 222]}, adult: null};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function tintArt(art, t) { if (!t) return art; const d = Buffer.from(art.data); for (let i = 0; i < art.W * art.H; i++) for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.round(d[i * 4 + c] * (1 - t.k) + t.rgb[c] * t.k); return {...art, data: d}; }
/** 열마다 중심선 · 반두께(내접원) · 몸 구간(반두께가 가장 굵은 곳의 18% 넘게 이어진 가장 긴 구간) · 전체 가로 범위 */
function profile({data, W, H}, A = 60) {
  const mask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] > A ? 1 : 0;
  const dist = distance(mask, W, H), cy = new Float32Array(W).fill(NaN), rr = new Float32Array(W);
  let l = W, r = 0;
  for (let x = 0; x < W; x++) { let best = 0, by = -1; for (let y = 0; y < H; y++) { if (mask[y * W + x]) { l = Math.min(l, x); r = Math.max(r, x); } const d = dist[y * W + x]; if (d > best) { best = d; by = y; } } if (by >= 0) { cy[x] = by; rr[x] = best; } }
  let rmax = 0; for (let x = 0; x < W; x++) rmax = Math.max(rmax, rr[x]);
  let span = [0, 0], s0 = -1; for (let x = 0; x <= W; x++) { const on = x < W && rr[x] > rmax * .18; if (on && s0 < 0) s0 = x; if (!on && s0 >= 0) { if (x - s0 > span[1] - span[0]) span = [s0, x - 1]; s0 = -1; } }
  const [b0, b1] = span, sm = (arr, i, w) => { let s = 0, n = 0; for (let k = -w; k <= w; k++) { const j = Math.min(b1, Math.max(b0, i + k)); if (Number.isFinite(arr[j])) { s += arr[j]; n++; } } return s / n; };
  const C = new Float32Array(W), Rr = new Float32Array(W); for (let x = b0; x <= b1; x++) { C[x] = sm(cy, x, 9); Rr[x] = sm(rr, x, 7); }
  return {mask, C, Rr, b0, b1, l, r};
}
/** 투명한 곳은 가장 가까운 불투명 색 — 가장자리 칸이 바탕색을 집지 않게 */
function nearest({data, W, H}) {
  const near = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H); let a = 0, b = 0;
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 240) { near[i] = i; q[b++] = i; }
  while (a < b) { const i = q[a++], x = i % W; for (const j of [i - W, i + W, ...(x ? [i - 1] : []), ...(x < W - 1 ? [i + 1] : [])]) if (j >= 0 && j < W * H && near[j] < 0) { near[j] = near[i]; q[b++] = j; } }
  // 물에 비친 청록 기 걷기 — 오려낸 가장자리 · 배 아래는 물빛이 비쳐 파랑이 빨강보다 크게 앞선다(고래 몸빛은 그 차이가 10 안팎). 넘는 만큼 회색 쪽으로
  return (x, y) => { x = clamp(Math.round(x), 0, W - 1); y = clamp(Math.round(y), 0, H - 1); const k = near[y * W + x] * 4, r = data[k], g = data[k + 1], b = data[k + 2], cast = clamp((b - r - 12) / 30); if (!cast) return [r, g, b]; const l = (r + g + b) / 3; return [r + (l * 1.02 - r) * cast, g + (l - g) * cast, b + (l * .97 - b) * cast].map(Math.round); };
}

export async function grayGLB(key, stage) {
  const side = tintArt(await loadArt(R + 'gray-cut-side.png', 1024), stage), top = tintArt(await loadArt(R + 'gray-cut-top.png', 1024), stage);
  const S1 = profile(side), T1 = profile(top), sidePx = nearest(side), topPx = nearest(top);
  // 위 사진 → 옆 사진 좌표: 꼬리 끝 · 주둥이 끝을 맞춘다. 옆 방향(위 사진의 세로)도 같은 배율, 몸 가운데 선이 0
  const k = (S1.r - S1.l) / (T1.r - T1.l), toSideX = (x) => S1.l + (x - T1.l) * k, toTopX = (x) => T1.l + (x - S1.l) / k;
  let zMid = 0, zn = 0; for (let x = T1.b0; x <= T1.b1; x++) { zMid += T1.C[x]; zn++; } zMid /= zn;
  const bx1 = S1.b1, bx0 = Math.max(S1.b0, Math.ceil(toSideX(T1.b0)));
  const cAt = (x) => S1.C[clamp(Math.round(x), bx0, bx1)], rvAt = (x) => S1.Rr[clamp(Math.round(x), bx0, bx1)] * 1.06;
  const rhAt = (x) => { const tx = clamp(Math.round(toTopX(x)), T1.b0, T1.b1); return T1.Rr[tx] * k * 1.04; };
  // 텍스처: 위 반 = 몸통(가로 = 몸 길이, 세로 = 둘레 각), 아래 반 = 위 사진(지느러미 · 꼬리 판이 쓴다)
  const atlas = Buffer.alloc(512 * 512 * 3);
  for (let v = 0; v < 256; v++) for (let u = 0; u < 512; u++) {
    const x = bx0 + (bx1 - bx0) * u / 511, phi = v / 255 * Math.PI * 2, up = Math.cos(phi), lat = Math.sin(phi);
    const w = smooth(.3, .8, up), tx = toTopX(x), txi = clamp(Math.round(tx), T1.b0, T1.b1);
    const a = topPx(tx, T1.C[txi] + lat * T1.Rr[txi] * .92), b = sidePx(x, cAt(x) - up * rvAt(x) * .82);
    atlas.set([0, 1, 2].map((c) => Math.round(a[c] * w + b[c] * (1 - w))), (v * 512 + u) * 3);
  }
  const topImg = await sharp(Buffer.from(Array.from({length: top.W * top.H}, (_, i) => topPx(i % top.W, Math.floor(i / top.W))).flat()), {raw: {width: top.W, height: top.H, channels: 3}}).resize(512, 256, {fit: 'fill'}).raw().toBuffer();
  topImg.copy(atlas, 512 * 256 * 3);
  const png = await sharp(atlas, {raw: {width: 512, height: 512, channels: 3}}).png().toBuffer();
  const P = [], UV = [], I = [], vtx = (x, y, z, u, v) => { P.push(x, y, z); UV.push(u, v); return P.length / 3 - 1; };
  // 몸통 — 타원 단면(반높이 · 반폭), 고리 RINGS 개
  const NR = 20, RINGS = 96, rings = [];
  for (let i = 0; i <= RINGS; i++) { const x = bx0 + (bx1 - bx0) * i / RINGS, c = cAt(x), rv = rvAt(x), rh = rhAt(x), ring = []; for (let j = 0; j <= NR; j++) { const phi = j / NR * Math.PI * 2; ring.push(vtx(x, c - Math.cos(phi) * rv, Math.sin(phi) * rh, i / RINGS, (j / NR * 254 + .5) / 511)); } rings.push(ring); }
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < NR; j++) { const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1]; I.push(a, c, b, b, c, d); }
  for (const [kk, rev] of [[0, true], [RINGS, false]]) { const x = bx0 + (bx1 - bx0) * kk / RINGS, ctr = vtx(x, cAt(x), 0, kk / RINGS, .25); for (let j = 0; j < NR; j++) { const a = rings[kk][j], b = rings[kk][j + 1]; I.push(...(rev ? [ctr, b, a] : [ctr, a, b])); } }
  // 판 — 위 사진에서 몸 폭 밖으로 나온 곳(가슴지느러미) · 몸 뒤(꼬리자루 끝 · 꼬리). 뿌리는 몸 안쪽 조금부터라 몸에 닿는다
  const inside = (x, y) => { const sx = toSideX(x); if (sx < bx0 + 4) return true; const tx = clamp(Math.round(x), T1.b0, T1.b1); return Math.abs(y - T1.C[tx]) > T1.Rr[tx] * .9; };
  const plate = relief(top, {depth: .012, round: .01, step: 3, alpha: 60, inside, targetTris: 2000});
  const PL = [], midX = (bx0 + bx1) / 2;
  for (let i = 0; i < plate.P.length / 3; i++) {
    const X = toSideX(plate.P[i * 3]), Z = (plate.P[i * 3 + 1] - zMid) * k, th = plate.P[i * 3 + 2] * k * .6;
    const flipper = X > midX, edge = Math.max(0, Math.abs(Z) - rhAt(X) * .85);
    // 가슴지느러미 — 몸 아래쪽(중심 + 반높이 .45)에 붙어 바깥 · 아래로. 꼬리 — 꼬리자루 높이 그대로 수평
    const y = flipper ? cAt(X) + rvAt(X) * .45 + edge * FIN_DROOP + th : cAt(Math.max(X, bx0)) + th;
    PL.push([vtx(X, y, Z, plate.P[i * 3] / top.W, (256 + plate.P[i * 3 + 1] / top.H * 255) / 511), flipper, X, Z, edge]);
  }
  const base = P.length / 3 - plate.P.length / 3; for (const t of plate.I) I.push(base + t);
  // 게임 좌표: 머리 +X, 위 +Y, 길이 2
  const n = P.length / 3, pos = new Float32Array(n * 3); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, P[i * 3]); x1 = Math.max(x1, P[i * 3]); y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]); }
  const S = 2 / (x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (let i = 0; i < n; i++) { pos[i * 3] = (P[i * 3] - mx) * S; pos[i * 3 + 1] = (my - P[i * 3 + 1]) * S; pos[i * 3 + 2] = P[i * 3 + 2] * S; }
  if (n > 65535) throw Error('vertices ' + n);
  // 뼈 — 몸통 여섯 · 가슴지느러미 뿌리(몸 가장자리 근처 판 꼭짓점의 가운데) · 끝(가장 먼 꼭짓점)
  const names = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'], BX = [.75, .45, .15, -.15, -.45, -.8];
  const bones = names.map((m) => { const b = new T.Bone(); b.name = m; return b; });
  for (let i = 0; i < 6; i++) { bones[i].position.set(i ? BX[i] - BX[i - 1] : BX[0], 0, 0); if (i) bones[i - 1].add(bones[i]); }
  const fin = {root: new T.Vector3(), n: 0, tip: new T.Vector3(), far: -1};
  for (const [v, flipper, , Z, edge] of PL) { if (!flipper || Z < 0) continue; const p = new T.Vector3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); if (edge < rvAt(midX) * .15) { fin.root.add(p); fin.n++; } if (edge > fin.far) { fin.far = edge; fin.tip.copy(p); } }
  if (!fin.n) throw Error('no flipper root');
  fin.root.divideScalar(fin.n);
  for (const [r, t, s] of [[6, 7, 1], [8, 9, -1]]) { bones[1].add(bones[r]); bones[r].position.set(fin.root.x - BX[1], fin.root.y, s * fin.root.z); bones[r].add(bones[t]); bones[t].position.set(fin.tip.x - fin.root.x, fin.tip.y - fin.root.y, s * (fin.tip.z - fin.root.z)); }
  bones[0].updateMatrixWorld(true);
  const J = new Uint16Array(n * 4), Wt = new Float32Array(n * 4), finOf = new Map();
  const reach = Math.max(1e-3, fin.root.distanceTo(fin.tip));
  for (const [v, flipper, , Z] of PL) if (flipper) { const p = new T.Vector3(pos[v * 3], pos[v * 3 + 1], Math.abs(pos[v * 3 + 2])); finOf.set(v, [Z >= 0 ? 6 : 8, clamp(p.distanceTo(fin.root) / reach)]); }
  for (let i = 0; i < n; i++) {
    const fb = finOf.get(i); if (fb) { J[i * 4] = fb[0]; J[i * 4 + 1] = fb[0] + 1; J[i * 4 + 2] = 1; Wt[i * 4] = (1 - fb[1]) * .85; Wt[i * 4 + 1] = fb[1] * .85; Wt[i * 4 + 2] = .15; continue; }
    const x = pos[i * 3]; if (x >= BX[0]) { Wt[i * 4] = 1; continue; } if (x <= BX[5]) { J[i * 4] = 5; Wt[i * 4] = 1; continue; }
    let a = 0; while (a < 4 && x < BX[a + 1]) a++; const f = clamp((BX[a] - x) / (BX[a] - BX[a + 1])); J[i * 4] = a; J[i * 4 + 1] = a + 1; Wt[i * 4] = 1 - f; Wt[i * 4 + 1] = f;
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setAttribute('skinIndex', new T.Uint16BufferAttribute(J, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(Wt, 4)); g.setIndex(I); g.computeVertexNormals();
  const glb = await compressGLB(material(packAsset(key, [{name: key, geometry: g, extras: {aquaGeometry: 'photo-traced-whale', source: 'design/aqua3d-review/whales/reference/gray-photo-{side,top,front}.webp', bodyCrossSection: 'ellipse (side height × top width)'}}], png, bones), (m) => { m.name = 'painted_PBR_atlas'; m.doubleSided = true; m.pbrMetallicRoughness.metallicFactor = .04; m.pbrMetallicRoughness.roughnessFactor = .78; }), {webpQuality: 92});
  return {glb, tris: I.length / 3};
}
if (process.argv[1]?.endsWith('gray-build.mjs')) {
  for (const [st, t] of Object.entries(STAGE)) { const key = st === 'adult' ? 'gray_whale' : `${st}_gray_whale`; const {glb, tris} = await grayGLB(key, t); if (tris > 8000) throw Error(key + ' tris ' + tris); await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes'); }
}
