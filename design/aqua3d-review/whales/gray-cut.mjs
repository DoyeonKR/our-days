// 귀신고래 기준 사진 오려내기(2026-11-18) [사용자: "위는 귀신고래 기준이미지야 … 해당 이미지를 기준이미지로 변경하고 그에맞게 glb 다시 가다듬어"]
// 사용자가 준 사진 셋(옆 · 위 · 앞, reference/gray-photo-*.webp)은 바탕이 흰 종이가 아니라 물빛(청록)이다. 고래 몸은 회색(채도 낮음)이나
// 따개비 · 고래이 자리(노란 베이지 — 빨강이 파랑보다 큼)라 "파랑 · 초록이 빨강보다 뚜렷이 크고 채도가 있는" 물빛을 가장자리에서 채워 지운다.
// 가장 큰 덩어리만 남기고 구멍을 메우고, 가장자리는 1px 반투명. 옆 사진은 머리가 왼쪽이라 뒤집는다(게임 규칙: 머리 오른쪽).
// 출력: reference/gray-cut-side.png · gray-cut-top.png(머리 오른쪽, 위가 몸 왼쪽) · gray-cut-front.png
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const R = 'design/aqua3d-review/whales/reference/';
export async function cutPhoto(src, {flip = false, rotate = 0, thr = 38} = {}) {
  let img = sharp(src).removeAlpha(); if (flip) img = img.flop(); if (rotate) img = img.rotate(rotate);
  const {data, info} = await img.raw().toBuffer({resolveWithObject: true}), W = info.width, H = info.height, N = W * H;
  // 물빛 모형 — 물은 부드러운 기울기(위가 어둡거나 밝다)라, 테두리 띠(바깥 6%)의 색으로 x · y 이차식을 채널마다 맞춘다.
  //   고래 몸도 그늘에서 푸르스름해 '푸른가'로는 못 가른다(꼬리 · 배가 지워졌다) — 그 자리의 물빛 예측과 얼마나 다른가로 가른다
  const band = Math.round(Math.min(W, H) * 0.06), rows = [], ys = [[], [], []];
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { if (x > band && x < W - band && y > band && y < H - band) continue; const u = x / W, v = y / H, i = y * W + x; rows.push([1, u, v, u * u, v * v, u * v]); for (let c = 0; c < 3; c++) ys[c].push(data[i * 3 + c]); }
  const fit = (yv) => { const n = 6, A = Array.from({length: n}, () => new Float64Array(n + 1)); rows.forEach((r, k) => { for (let a = 0; a < n; a++) { for (let b = 0; b < n; b++) A[a][b] += r[a] * r[b]; A[a][n] += r[a] * yv[k]; } });
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; } }
    return A.map((r, i) => r[n] / r[i]); };
  const coef = ys.map(fit), diff = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x / W, v = y / H, f = [1, u, v, u * u, v * v, u * v], i = y * W + x; let d = 0; for (let c = 0; c < 3; c++) { const e = data[i * 3 + c] - coef[c].reduce((s, k, j) => s + k * f[j], 0); d += e * e; } diff[i] = Math.sqrt(d); }
  // 5×5 평균으로 고르게(물속 부유물 · 압축 잡음) 한 뒤 문턱
  const sm = new Float32Array(N); for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { let s = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += diff[(y + dy) * W + x + dx]; sm[y * W + x] = s / 25; }
  const water = new Uint8Array(N); for (let i = 0; i < N; i++) water[i] = sm[i] < thr ? 1 : 0;
  const bg = new Uint8Array(N), q = new Int32Array(N); let qa = 0, qb = 0;
  const seed = (i) => { if (!bg[i] && water[i]) { bg[i] = 1; q[qb++] = i; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); } for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (qa < qb) { const i = q[qa++], x = i % W; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < N && !bg[j] && water[j]) { bg[j] = 1; q[qb++] = j; } }
  // 가장 큰 덩어리(물이 아닌 곳) — 물속 부유물 점은 빠진다
  const lab = new Int32Array(N).fill(-1); let best = -1, bestN = 0;
  for (let s = 0; s < N; s++) { if (bg[s] || lab[s] >= 0) continue; let a = 0, b = 0, n = 0; q[b++] = s; lab[s] = s; while (a < b) { const i = q[a++], x = i % W; n++; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < N && !bg[j] && lab[j] < 0) { lab[j] = s; q[b++] = j; } } if (n > bestN) { bestN = n; best = s; } }
  // 구멍 메우기 — 가장자리에서 닿지 않는 '덩어리 밖'은 몸 안의 구멍(파란 그늘)이다
  const out = new Uint8Array(N); for (let i = 0; i < N; i++) out[i] = lab[i] === best ? 1 : 0;
  const reach = new Uint8Array(N); qa = qb = 0; const s2 = (i) => { if (!out[i] && !reach[i]) { reach[i] = 1; q[qb++] = i; } };
  for (let x = 0; x < W; x++) { s2(x); s2((H - 1) * W + x); } for (let y = 0; y < H; y++) { s2(y * W); s2(y * W + W - 1); }
  while (qa < qb) { const i = q[qa++], x = i % W; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < N && !out[j] && !reach[j]) { reach[j] = 1; q[qb++] = j; } }
  for (let i = 0; i < N; i++) if (!reach[i]) out[i] = 1;
  const rgba = Buffer.alloc(N * 4); let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let i = 0; i < N; i++) {
    if (!out[i]) continue; const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    let edge = 0; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < N && !out[j]) edge = 1;
    rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = edge ? 150 : 255;
  }
  return sharp(rgba, {raw: {width: W, height: H, channels: 4}}).extract({left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1}).png().toBuffer();
}
if (process.argv[1]?.endsWith('gray-cut.mjs')) {
  await writeFile(R + 'gray-cut-side.png', await cutPhoto(R + 'gray-photo-side.webp', {flip: true}));
  await writeFile(R + 'gray-cut-top.png', await cutPhoto(R + 'gray-photo-top.webp', {flip: true}));
  await writeFile(R + 'gray-cut-front.png', await cutPhoto(R + 'gray-photo-front.webp'));
  console.log('ok');
}
