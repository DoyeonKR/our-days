// 귀상어 다시 짓기(2026-11-19) [사용자: "귀상어 기준 이미지 확인하고 모델링 디테일 업그레이드해"]
// 옛 모델(build-stage1 의 상어 공용 몸)은 옆에서만 원화와 같았다 — 위에서 보면 머리에 망치가 없이 가는 관 끝에 선 하나였고,
// 앞에서 보면 머리 둘레에 원반 고리가 둘린 모양이었다(귀상어의 핵심인 납작하고 넓은 T자 머리 '두익(cephalofoil)'이 없었다). 가슴지느러미도 위에서 작은 삼각형뿐이었다.
// 이제: ① 몸통 = 원화에서 열마다 잰 중심선 · 반높이의 둥근 관(위에서 본 폭은 반높이 × BODY_WIDTH), 원화를 몸 둘레로 굽는다(옆모습은 원화 그대로)
//       ② 머리 = 납작하고 넓은 두익 — 위에서 T자(폭은 몸길이의 HAMMER_SPAN), 앞 가장자리는 가운데가 살짝 파이고 양끝이 뒤로 젖혀지며, 양끝에 눈.
//          윗면은 원화의 머리 윗색, 아랫면은 배 색. 원화의 머리 자리(앞 HEAD_SHARE)는 관에서 빼고 두익이 덮는다
//       ③ 지느러미 = 원화에서 몸 밖으로 나온 판(등 · 둘째 등 · 뒷 · 배 · 꼬리), 앞쪽 아래 가슴지느러미는 뿌리 아래를 바깥으로 거의 눕혀(PEC_SPLAY) 위에서 긴 낫으로 보인다
// 게임 규칙: +X 머리 · +Y 위 · 길이 2 · 뼈 10개(가슴지느러미 = fin_L/R) · 저장 전 updateMatrixWorld(bindpose.test) · 삼각형 3,000 · 300KB 안(expansion-art.test).
// node design/aqua3d-review/hammerhead-build.mjs [key...]   (기본: hammerhead juv_hammerhead fry_hammerhead)
import * as T from 'three';
import sharp from 'sharp';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {loadArt, relief, material, distance} from './relief-build.mjs';

/** 원화 앞쪽에서 머리(망치)가 차지하는 몫 · 두익 폭(몸길이 대비 반폭) · 앞뒤 깊이 · 두께 · 위에서 본 몸 폭(반높이 대비) · 가슴지느러미 눕히기(rad) */
export const HEAD_SHARE = 0.125, HAMMER_SPAN = 0.13, HAMMER_CHORD = 0.075, HAMMER_THICK = 0.03, BODY_WIDTH = 0.82, PEC_SPLAY = 1.2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

async function build(key) {
  // 삼각형 3,000 안(expansion-art.test — 귀상어 세 모습 모두) — 고리 간격 · 둘레 칸 · 지느러미 판 · 두익 칸을 그 안에 맞춘다
  const RING_STEP = 7, RING_N = 13, FIN_TRIS = 480, HZ = 16, HS = 10;
  const art = await loadArt(`public/aqua/fish/${key}.webp`), {data, W, H} = art, A = 45;
  const mask = new Uint8Array(W * H); let al = W, ar = 0;
  for (let i = 0; i < W * H; i++) { mask[i] = data[i * 4 + 3] > A ? 1 : 0; if (mask[i]) { const x = i % W; al = Math.min(al, x); ar = Math.max(ar, x); } }
  const dist = distance(mask, W, H);
  const headX0 = ar - (ar - al) * HEAD_SHARE;
  // 열마다 중심선 · 반높이 — 머리 자리는 재지 않는다(망치가 비스듬히 그려져 높이가 부풀었다)
  const cy = new Float32Array(W).fill(NaN), rr = new Float32Array(W);
  for (let x = 0; x < W; x++) { let best = 0, by = -1; for (let y = 0; y < H; y++) { const d = dist[y * W + x]; if (d > best) { best = d; by = y; } } if (by >= 0) { cy[x] = by; rr[x] = best; } }
  let rmax = 0; for (let x = 0; x < headX0; x++) rmax = Math.max(rmax, rr[x] || 0);
  let span = [0, 0], s0 = -1; for (let x = 0; x <= Math.ceil(headX0); x++) { const on = x < headX0 && rr[x] > rmax * .18; if (on && s0 < 0) s0 = x; if (!on && s0 >= 0) { if (x - s0 > span[1] - span[0]) span = [s0, x - 1]; s0 = -1; } }
  // 관은 두익의 앞뒤 가운데까지 이어진다(목이 두익에 박혀 떠 보이지 않게)
  const bx0 = span[0], bx1 = Math.floor(ar - (ar - al) * HAMMER_CHORD * .55);
  const sm = (arr, i, w) => { let s = 0, n = 0; for (let k = -w; k <= w; k++) { const j = clamp(i + k, bx0, Math.floor(headX0)); if (Number.isFinite(arr[j])) { s += arr[j]; n++; } } return s / n; };
  const C = new Float32Array(W), Rr = new Float32Array(W);
  for (let x = bx0; x <= bx1; x++) { const xi = Math.min(x, Math.floor(headX0)); C[x] = sm(cy, xi, 7); Rr[x] = sm(rr, xi, 5) * 1.06; }
  // 주둥이 쪽으로 관을 가늘게 오므린다(두익 뒤 목) — 머리 자리에선 반높이를 머리 시작 값의 .8 로
  // 목 — 머리 앞 몸길이 10% 부터 두익까지 반높이를 절반 남짓으로 오므린다(원화의 머리 자리는 망치가 비스듬히 그려져 부풀어 있어 쓰지 않는다)
  { const xs = Math.max(bx0 + 1, Math.floor(headX0 - (ar - al) * .1)), r0 = Rr[xs]; for (let x = xs; x <= bx1; x++) { const t = clamp((x - xs) / Math.max(1, bx1 - xs)); Rr[x] = r0 * (1 - .5 * t * t * (3 - 2 * t)); if (x >= headX0) C[x] = C[Math.floor(headX0) - 1]; } }
  const cAt = (x) => C[clamp(Math.round(x), bx0, bx1)], rAt = (x) => Rr[clamp(Math.round(x), bx0, bx1)];
  // 텍스처: 위 반 = 몸 둘레로 굽은 원화 · 아래 반 = 원화 그대로(지느러미 판). 투명한 곳은 가장 가까운 색
  const near = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H); let qa = 0, qb = 0;
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 140) { near[i] = i; q[qb++] = i; }
  while (qa < qb) { const i = q[qa++], x = i % W; for (const j of [i - W, i + W, ...(x ? [i - 1] : []), ...(x < W - 1 ? [i + 1] : [])]) if (j >= 0 && j < W * H && near[j] < 0) { near[j] = near[i]; q[qb++] = j; } }
  const px = (x, y) => { x = clamp(Math.round(x), 0, W - 1); y = clamp(Math.round(y), 0, H - 1); const k = near[y * W + x] * 4; return [data[k], data[k + 1], data[k + 2]]; };
  const atlas = Buffer.alloc(512 * 512 * 3);
  for (let v = 0; v < 256; v++) for (let u = 0; u < 512; u++) { const x = bx0 + (Math.min(headX0, bx1) - bx0) * u / 511, phi = v / 255 * Math.PI * 2; atlas.set(px(x, cAt(x) - Math.cos(phi) * rAt(x) * .8), (v * 512 + u) * 3); }
  const ref = await sharp(Buffer.from(Array.from({length: W * H}, (_, i) => px(i % W, Math.floor(i / W))).flat()), {raw: {width: W, height: H, channels: 3}}).resize(512, 256, {fit: 'fill'}).raw().toBuffer();
  ref.copy(atlas, 512 * 256 * 3);
  // 두익 색 칸 — 오른쪽 아래 구석 네 칸(윗면 · 아랫면 · 눈 · 가장자리). 원화의 머리 윗색 · 배색을 쓴다
  const hx = Math.round(headX0 - (headX0 - bx0) * .04), topC = px(hx, cAt(hx) - rAt(hx) * .75), belC = px(hx, cAt(hx) + rAt(hx) * .7);
  const swatch = (i, c) => { for (let y = 496; y < 512; y++) for (let x = 448 + i * 16; x < 464 + i * 16; x++) atlas.set(c, (y * 512 + x) * 3); };
  swatch(0, topC); swatch(1, belC); swatch(2, [18, 20, 24]); swatch(3, topC.map((c, i) => Math.round(c * .75 + belC[i] * .25)));
  const SW = (i) => [(456 + i * 16) / 512, 503.5 / 511];
  const png = await sharp(atlas, {raw: {width: 512, height: 512, channels: 3}}).png().toBuffer();
  const P = [], UV = [], I = []; const vtx = (x, y, z, u, v) => { P.push(x, y, z); UV.push(u, v); return P.length / 3 - 1; };
  const refUV = (x, y) => [x / W, (256 + y / H * 255) / 511];
  // 몸통 관
  const N = RING_N, step = RING_STEP, rings = [];
  for (let x = bx0; x <= bx1; x += step) { const r = rAt(x), c = cAt(x), ring = []; for (let j = 0; j <= N; j++) { const phi = j / N * Math.PI * 2; ring.push(vtx(x, c - Math.cos(phi) * r, Math.sin(phi) * r * BODY_WIDTH, clamp((x - bx0) / (Math.min(headX0, bx1) - bx0)), (j / N * 254 + .5) / 511)); } rings.push(ring); }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < N; j++) { const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1]; I.push(a, c, b, b, c, d); }
  for (const [k, rev] of [[0, true], [rings.length - 1, false]]) { const x = bx0 + k * step, ctr = vtx(x, cAt(x), 0, clamp((x - bx0) / (headX0 - bx0)), .25); for (let j = 0; j < N; j++) { const a = rings[k][j], b = rings[k][j + 1]; I.push(...(rev ? [ctr, b, a] : [ctr, a, b])); } }
  // 지느러미 판 — 몸 밖으로 나온 원화(머리 자리는 빼고 — 거기는 두익)
  const outside = (x, y) => x < headX0 - 2 && (x < bx0 || Math.abs(y - cAt(x)) > rAt(x) * 1.0);
  const app = relief(art, {depth: .009, round: .007, step: 3, alpha: A, inside: outside, targetTris: FIN_TRIS});
  const APP = [];
  for (const side of [-1, 1]) { const base = P.length / 3, n = app.P.length / 3; for (let i = 0; i < n; i++) { const x = app.P[i * 3], y = app.P[i * 3 + 1], z = app.P[i * 3 + 2], pec = x > (bx0 + headX0) / 2 && x < headX0 && y > cAt(x), off = pec ? rAt(x) * BODY_WIDTH * .45 : 0; APP.push([vtx(x, y, z + side * off, ...refUV(x, y)), side, x, y]); } for (const k of app.I) I.push(base + k); }
  // 가슴지느러미 — 몸 앞쪽(가운데보다 앞) 아래로 나온 판을 뿌리 둘레로 바깥에 거의 눕힌다
  const mid = (bx0 + headX0) / 2, front = APP.filter(([, , x, y]) => x > mid && x < headX0 && y > cAt(x));
  let fx = 0, fy = 0; for (const [, , x, y] of front) { fx += x; fy += y; } const nf = Math.max(1, front.length); fx /= nf; fy /= nf;
  const rx = fx + (headX0 - bx0) * .04, rootY = cAt(rx) + rAt(rx) * .55, cs = Math.cos(PEC_SPLAY), sn = Math.sin(PEC_SPLAY);
  for (const [v, side, x, y] of APP) { if (!(x > mid && x < headX0 && y > cAt(x))) continue; const d = y - rootY; if (d <= 0) continue; P[v * 3 + 1] = rootY + d * cs; P[v * 3 + 2] += side * d * sn; }
  // 두익 — 위에서 T자. 옆 방향(z)으로 고리를 늘어놓고, 고리마다 앞뒤(x) · 위아래(y) 타원 단면
  const L = ar - al, half = L * HAMMER_SPAN, chord = L * HAMMER_CHORD, thick = L * HAMMER_THICK, hy = cAt(headX0) - rAt(headX0) * .15;
  const front0 = ar - chord * .15; // 앞 가장자리(가운데)
  const NZ = HZ, NS = HS, hring = [];
  for (let i = 0; i <= NZ; i++) {
    const t = -1 + 2 * i / NZ, a = Math.abs(t), z = t * half;
    // 끝으로 갈수록 앞뒤가 조금 짧아지고, 가운데는 살짝 파이고(앞 가장자리 오목), 양끝은 뒤로 젖혀진다
    const c = chord * (1 - .35 * a * a) * (a > .92 ? Math.sqrt(Math.max(.15, 1 - (a - .92) / .08)) : 1), th = thick * (1 - .45 * a);
    // 앞뒤 가운데 — 양끝은 뒤로 젖히고(.35 a²), 가운데 앞 가장자리는 살짝 파인다(.08 · 폭 .18)
    const xc = front0 - c / 2 - chord * .35 * a * a - chord * .08 * Math.exp(-((a / .18) ** 2));
    const ring = [];
    for (let j = 0; j <= NS; j++) { const phi = j / NS * Math.PI * 2, up = Math.sin(phi) > 0; ring.push(vtx(xc + Math.cos(phi) * c / 2, hy - Math.sin(phi) * th / 2, z, ...SW(up ? 0 : 1))); }
    hring.push(ring);
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NS; j++) { const a = hring[i][j], b = hring[i][j + 1], c = hring[i + 1][j], d = hring[i + 1][j + 1]; I.push(a, b, c, b, d, c); }
  for (const [k, rev] of [[0, true], [NZ, false]]) { const r = hring[k], cxm = r.reduce((s, v) => s + P[v * 3], 0) / r.length, ctr = vtx(cxm, hy, (k ? 1 : -1) * half * 1.002, ...SW(3)); for (let j = 0; j < NS; j++) I.push(...(rev ? [ctr, r[j], r[j + 1]] : [ctr, r[j + 1], r[j]])); }
  // 눈 — 두익 양끝 가장자리에 작은 검은 공
  for (const s of [-1, 1]) { const ex = front0 - chord * .55 - chord * .3, ez = s * half * .985, er = thick * .26, base = P.length / 3, NE = 8;
    for (let a = 0; a <= NE; a++) for (let b = 0; b <= NE; b++) { const th = a / NE * Math.PI, ph = b / NE * Math.PI * 2; vtx(ex + er * Math.sin(th) * Math.cos(ph), hy + er * Math.cos(th), ez + s * er * .4 + er * Math.sin(th) * Math.sin(ph), ...SW(2)); }
    for (let a = 0; a < NE; a++) for (let b = 0; b < NE; b++) { const p = base + a * (NE + 1) + b; I.push(p, p + NE + 1, p + 1, p + 1, p + NE + 1, p + NE + 2); } }
  // 게임 좌표: 머리 +X(원화 오른쪽), 위 +Y, 길이 2
  const n = P.length / 3, pos = new Float32Array(n * 3); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, P[i * 3]); x1 = Math.max(x1, P[i * 3]); y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]); }
  const S = 2 / (x1 - x0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (let i = 0; i < n; i++) { pos[i * 3] = (P[i * 3] - mx) * S; pos[i * 3 + 1] = (my - P[i * 3 + 1]) * S; pos[i * 3 + 2] = P[i * 3 + 2] * S; }
  if (n > 65535) throw Error('vertices ' + n);
  for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) throw Error(`${key}: 꼭짓점 ${Math.floor(i / 3)} 이 NaN (P ${P.slice(Math.floor(i / 3) * 3, Math.floor(i / 3) * 3 + 3)})`);
  // 뼈 — 몸통 여섯 · 가슴지느러미(뿌리 · 끝)
  const names = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'], BX = [.75, .45, .15, -.15, -.45, -.8];
  const bones = names.map((m) => { const b = new T.Bone(); b.name = m; return b; });
  for (let i = 0; i < 6; i++) { bones[i].position.set(i ? BX[i] - BX[i - 1] : BX[0], 0, 0); if (i) bones[i - 1].add(bones[i]); }
  bones[1].add(bones[6]); bones[6].add(bones[7]); bones[1].add(bones[8]); bones[8].add(bones[9]);
  const G = (x, y, z) => [(x - mx) * S, (my - y) * S, z * S], fd = Math.max(0, fy - rootY), root = G(rx, rootY, 0), tip = G(fx, rootY + fd * cs, 0), zr = rAt(rx) * BODY_WIDTH * .45 * S, zt = fd * sn * S;
  bones[6].position.set(root[0] - BX[1], root[1], zr); bones[7].position.set(tip[0] - root[0], tip[1] - root[1], zt);
  bones[8].position.set(root[0] - BX[1], root[1], -zr); bones[9].position.set(tip[0] - root[0], tip[1] - root[1], -zt);
  bones[0].updateMatrixWorld(true);
  const finOf = new Map(); for (const [v, side, x, y] of APP) if (x > mid && x < headX0 && y > cAt(x)) { const d = Math.hypot(x - rx, y - rootY), f = clamp(d / Math.max(4, Math.hypot(fx - rx, fy - rootY) * 1.6)); finOf.set(v, [side > 0 ? 6 : 8, f]); }
  const J = new Uint16Array(n * 4), Wt = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const fb = finOf.get(i); if (fb) { J[i * 4] = fb[0]; J[i * 4 + 1] = fb[0] + 1; Wt[i * 4] = 1 - fb[1]; Wt[i * 4 + 1] = fb[1]; continue; } const x = pos[i * 3]; if (x >= BX[0]) { Wt[i * 4] = 1; continue; } if (x <= BX[5]) { J[i * 4] = 5; Wt[i * 4] = 1; continue; } let k = 0; while (k < 4 && x < BX[k + 1]) k++; const f = clamp((BX[k] - x) / (BX[k] - BX[k + 1])); J[i * 4] = k; J[i * 4 + 1] = k + 1; Wt[i * 4] = 1 - f; Wt[i * 4 + 1] = f; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setAttribute('skinIndex', new T.Uint16BufferAttribute(J, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(Wt, 4)); g.setIndex((()=>{/* 2026-11-19 위아래를 뒤집어 담으면 감기도 뒤집힌다 — 삼각형을 바깥으로(flip-inward.mjs · facing.test) */for(let t=0;t<I.length;t+=3){const s=I[t+1];I[t+1]=I[t+2];I[t+2]=s;}return I;})()); g.computeVertexNormals();
  const glb = await compressGLB(material(packAsset(key, [{name: key, geometry: g, extras: {aquaGeometry: 'reference-traced-hammerhead', source: `public/aqua/fish/${key}.webp`, head: 'cephalofoil (flattened T-shaped wing)'}}], png, bones), (m) => { m.name = 'painted_PBR_atlas'; m.doubleSided = true; m.pbrMetallicRoughness.metallicFactor = .1; m.pbrMetallicRoughness.roughnessFactor = .62; }), {webpQuality: 92});
  return {glb, tris: I.length / 3};
}
const keys = process.argv.slice(2).length ? process.argv.slice(2) : ['hammerhead', 'juv_hammerhead', 'fry_hammerhead'];
await mkdir('design/aqua3d-review/hammerhead/old', {recursive: true});
for (const key of keys) {
  try { await readFile(`design/aqua3d-review/hammerhead/old/${key}.glb`); } catch { await writeFile(`design/aqua3d-review/hammerhead/old/${key}.glb`, await readFile(`public/aqua/models/fish/${key}.glb`)); }
  const {glb, tris} = await build(key);
  const cap = 3000;
  if (tris > cap || glb.length > 300000) throw Error(`${key} ${tris} tris ${glb.length} bytes`);
  await writeFile(`public/aqua/models/fish/${key}.glb`, glb); console.log(key, tris, 'tris', glb.length, 'bytes');
}
