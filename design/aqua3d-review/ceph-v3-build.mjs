// 두족류 12모습 3D v3 — 2026-11-18 [ART-GUIDE C. "두족류 3D 모델 다시 짓기"]
// 왜: 옛 두족류 GLB 는 옆모습 그림 한 장을 세운 판이라 위 · 앞에서 보면 납작했다(ART-GUIDE 검수 규칙 2). v2(그림 세션, 2026-11-13)는 팔을 수평으로 펼친 판이라
//     옆에서 막대로 보여 되돌렸다 — 수조는 옆모습 돌리기(sideon 0.8)로 두족류를 거의 옆에서 보이므로 옆모습이 여전히 첫째다.
// 그래서: 몸(외투막 + 머리)은 그림에서 열마다 잰 중심선 · 반두께의 둥근 관(포유류 · 새우와 같은 길) — 옆에서 그림 그대로, 그림을 몸 둘레로 굽는다(눈 · 얼룩 · 크라켄 따개비가 그대로 온다).
//     팔은 그 위에 3D 로 짓는다 — 문어 · 크라켄은 그림에서 따라 그린 팔 길(traceArms) 그대로 옆모습을 두고 앞뒤로만 부채처럼 벌린다(위에서 별), 팔 뿌리 사이엔 얇은 막.
//     문어 · 크라켄 팔 텍스처는 그 팔의 그림 길을 편 띠(빨판 구슬 · 색 띠가 그림 그대로) + 빨판 쪽에 오각뿔 구슬 두 줄 · 크라켄 머리는 크게(KHEAD) 울퉁불퉁하게(2026-11-18 2차).
//     오징어 · 대왕오징어는 팔 8개가 앞으로 모이고 촉완 2개는 길게(대왕오징어는 아래 · 뒤로 늘어진다), 외투막 끝엔 옆으로 편 지느러미 한 쌍(fin 뼈 — 게임이 지느러미를 젓는다).
// 팔 움직임(src/lib/aqua3d/cephalopod.ts)은 uv 의 '팔 띠'에서 팔 번호 · 뿌리→끝을 읽는다(CEPH_UV) — 새 정점 속성 없이 기존 압축기 · 묶음기를 그대로 쓴다.
// 규격: +X 팔 쪽 · 뼈 10개(spine_0 팔 끝 → spine_5 외투막 끝, 옛 모델과 같은 자리) · 길이 2(엔진은 max(x, z, 1.25y)로 잰다) · 삼각형 6,000 안 · 16비트 색인.
// node design/aqua3d-review/ceph-v3-build.mjs [--install] [key...]   — 기본은 ceph-v3/stage(오징어류) · ceph-v3/octopus-candidates(문어 · 크라켄), --install 이면 오징어류 · 문어 3모습은 public/aqua/models/fish · 크라켄은 늘 후보 폴더
import * as T from 'three';
import sharp from 'sharp';
import {writeFile,mkdir} from 'node:fs/promises';
import {compressGLB} from './glb-compress.mjs';
import {packAsset} from './shrimp-pack.mjs';
import {loadArt,material,distance} from './relief-build.mjs';
import {CEPH_UV} from '../../src/lib/aqua3d/cephalopod3d.ts';

/** 그림 좌표(u 오른쪽 · v 아래, 0~1)로 읽은 팔 고리(hub) · 팔 고리 반지름(crown) · 외투막 타원(가운데 u v · 반지름 u v) — 옛 cephalopod.ts 의 표(2026-11-13 그림에서 잰 값) */
export const CEPH_ART = {
  octopus: {hub: [0.56, 0.47], crown: 0.1, mantle: [0.42, 0.25, 0.21, 0.14]},
  fry_octopus: {hub: [0.53, 0.5], crown: 0.1, mantle: [0.43, 0.28, 0.18, 0.15]},
  juv_octopus: {hub: [0.47, 0.5], crown: 0.1, mantle: [0.33, 0.3, 0.19, 0.15]},
  kraken: {hub: [0.65, 0.5], crown: 0.12, mantle: [0.45, 0.27, 0.32, 0.14]},
  fry_kraken: {hub: [0.6, 0.5], crown: 0.12, mantle: [0.43, 0.27, 0.26, 0.14]},
  juv_kraken: {hub: [0.57, 0.5], crown: 0.11, mantle: [0.45, 0.25, 0.23, 0.12]},
  squid: {hub: [0.6, 0.5], crown: 0.06, mantle: [0.32, 0.5, 0.26, 0.09]},
  fry_squid: {hub: [0.52, 0.5], crown: 0.05, mantle: [0.28, 0.5, 0.21, 0.08]},
  juv_squid: {hub: [0.57, 0.49], crown: 0.05, mantle: [0.3, 0.49, 0.23, 0.07]},
  giant_squid: {hub: [0.66, 0.38], crown: 0.06, mantle: [0.33, 0.37, 0.26, 0.1]},
  fry_giant_squid: {hub: [0.62, 0.35], crown: 0.06, mantle: [0.32, 0.33, 0.21, 0.09]},
  juv_giant_squid: {hub: [0.61, 0.38], crown: 0.06, mantle: [0.33, 0.36, 0.24, 0.09]},
};
export const CEPH_KEYS = Object.keys(CEPH_ART);
/** 팔 길이(그림 폭 대비) · 팔 뿌리 굵기(외투막 반높이 대비) · 촉완 — 오징어류는 그림에서 팔이 퍼진 폭에 맞춰 눈으로 고른 값 */
const ARMS = {
  // 문어 · 크라켄(2026-11-18 2차): 팔 길이 · 말림은 그림 길에서 온다 — root(팔 뿌리 굵기 상한) · fan(앞뒤로 벌리는 몫, 팔 호 길이 대비). fan 은 물 뿜기 · 펴기가 보이는 최소(cephmotion3d 문턱)로 골랐다 — 크게 벌릴수록 몸 전체가 작아진다(길이 2 는 max(x, z) 로 잰다)
  octopus: {root: .42, fan: .5}, fry_octopus: {root: .4, fan: .7}, juv_octopus: {root: .41, fan: .8},
  kraken: {root: .46, fan: .5}, fry_kraken: {root: .44, fan: .5}, juv_kraken: {root: .45, fan: .5},
  squid: {len: .24, root: .32, tent: .36}, fry_squid: {len: .22, root: .32, tent: .32}, juv_squid: {len: .24, root: .32, tent: .36},
  giant_squid: {len: .28, root: .34, tent: 1.0, droop: true}, fry_giant_squid: {len: .26, root: .34, tent: .9, droop: true}, juv_giant_squid: {len: .27, root: .34, tent: .95, droop: true},
};
const octo = (key) => /octopus|kraken/.test(key);
/** 문어 · 크라켄 팔의 빨판 쪽을 그림 평면에서 앞(벌어진 쪽)으로 돌린 각(rad) */
const SUCK_TURN = .65;
/** 크라켄 머리(몸통 관) 배율 — 그림에서 잰 관만으로는 팔 아래에 깔린 머리가 작고 길쭉해 '크고 울퉁불퉁한 머리'가 사라졌다 */
const KHEAD = 1.2;
// 옛 모델과 같은 뼈 자리(엔진 · 시험이 spine_0 = 팔 쪽 +X, spine_3 ~ 5 = 외투막으로 안다)
const BX = [1.29, .95, .61, .27, -.07, -.41], CENTER = [.45, -.3, 0];

function rng(seed) { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 몸(외투막 + 머리) — 열마다 위 · 아래 끝을 그림에서 잰다. 팔이 이어진 아래쪽은 외투막 타원 · 팔 고리 높이로 자른다 */
function bodyProfile(art, key) {
  const {data, W, H} = art, A = CEPH_ART[key], O = octo(key), op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] > 60;
  const hx = A.hub[0] * W, hy = A.hub[1] * H, mx = A.mantle[0] * W, my = A.mantle[1] * H, mrx = A.mantle[2] * W, mry = A.mantle[3] * H, cr = A.crown * W;
  const x0 = Math.round(mx - mrx * .98), x1 = Math.round(hx + cr * (O ? (/kraken/.test(key) ? 1.4 : 1.15) : .45)); // 문어 · 크라켄은 팔 고리 앞의 머리 · 눈까지(.75 에서 자르면 눈이 끝 마개에 뭉개졌다)
  const C = new Float32Array(W), R = new Float32Array(W);
  for (let x = x0; x <= x1; x++) {
    // 가운데 짐작: 외투막 가운데 → 팔 고리 쪽으로
    const f = smooth(mx, hx, x), cg = my * (1 - f) + (O ? (hy - cr * .9) : hy) * f;
    const upLim = O ? mry * 1.45 : mry * 1.2, dnLim = O ? (x < mx ? my + mry * Math.sqrt(Math.max(0, 1 - ((x - mx) / mrx) ** 2)) : (my + mry) * (1 - f) + hy * f) - cg : mry * 1.2;
    let top = cg, bot = cg;
    while (top > cg - upLim && op(x, Math.round(top - 1))) top--;
    while (bot < cg + dnLim && op(x, Math.round(bot + 1))) bot++;
    C[x] = (top + bot) / 2; R[x] = Math.max(2, (bot - top) / 2) * (O ? 1.12 : 1.06);
  }
  // 고르게(관이 울퉁불퉁하지 않게) · 두 끝은 둥글게 닫힌다
  const sm = (arr, w) => { const o = new Float32Array(arr); for (let x = x0; x <= x1; x++) { let s = 0, n = 0; for (let k = -w; k <= w; k++) { const j = Math.min(x1, Math.max(x0, x + k)); s += arr[j]; n++; } o[x] = s / n; } return o; };
  const Cs = sm(C, 6), Rs = sm(R, 5), RT = new Float32Array(Rs); // RT: 둥글게 닫기 전 높이 — 문어 · 크라켄 텍스처는 이걸로 그림을 읽는다(닫힌 끝에 눈 둘레 몇 줄이 늘어나 입처럼 보였다)
  for (let x = x0; x <= x1; x++) { const e = O ? Math.min((x - x0) / Math.max(1, (x1 - x0) * .14), (x1 - x) / Math.max(1, (x1 - x0) * .22)) : Math.min(x - x0, x1 - x) / Math.max(1, (x1 - x0) * .08); Rs[x] *= e >= 1 ? 1 : Math.sqrt(Math.max(.08, 1 - (1 - e) ** 2)); }
  return {x0, x1, C: Cs, R: Rs, RT, hx, hy, cr, mry, mrx, mx, my};
}

/** 문어 · 크라켄 팔을 그림에서 따라 그린다(2026-11-18 2차) — 첫 v3 는 팔을 코드로 지은 곡선(그림과 무관)이라 수조 카메라(거의 옆)에서 옛 그림 판보다 밋밋했다.
 *  불투명 픽셀(외투막 타원은 막는다)의 가장자리 거리 D 를 재고, 팔 고리에서 '가운데로 갈수록 싼' 길(비용 1 + 6/(D+.5))을 퍼뜨려
 *  가장 멀리 간 끝 → 팔 고리로 되짚은 길 = 팔 하나. 그 둘레를 차지한 뒤 다음으로 먼 끝을 고른다(팔 8개 또는 더 없을 때까지).
 *  몸통 안은 막는다. 돌려주는 팔: 그림 px 의 중심선 pts · 반폭 w(가장자리 거리) · 빨판 쪽(밝은 가장자리) 부호 side. 팔이 겹친 곳은 길이 옆 팔로 넘어갈 수 있다 — 결은 여전히 팔이다 */
export function traceArms(art, key) {
  const B = bodyProfile(art, key), {data, W, H} = art, A = CEPH_ART[key], hx = A.hub[0] * W, hy = A.hub[1] * H, cr = A.crown * W;
  const mx = A.mantle[0] * W, my = A.mantle[1] * H, mrx = A.mantle[2] * W, mry = A.mantle[3] * H;
  const N = W * H, mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0; mask[i] = data[i * 4 + 3] > 140 && ((x - mx) / (mrx * 1.02)) ** 2 + ((y - my) / (mry * 1.06)) ** 2 > 1 ? 1 : 0;
    // 몸통(외투막 + 머리) 안도 막는다 — 막지 않으면 넓은 머리가 가장 싼 길이라 팔 사이를 머리로 건너뛰고 눈 · 정수리로 '팔'이 났다(팔 고리 둘레는 연다)
    //   몸통 위쪽 전부와 팔 고리 앞(+X) 머리 · 눈 쪽 위도 막는다 — 크라켄 · 어린 문어는 눈 위로 '팔'이 났다
    //   팔 고리 앞(xb 너머)은 문어는 높은 곳만 막는다 — 오른쪽 위로 솟는 팔이 머리 앞을 지난다
    const xb = hx + cr * .75, body = x >= B.x0 && x <= xb && (Math.abs(y - B.C[x]) < B.R[x] * .78 || y < B.C[x] + B.R[x] * .35);
    const brow = x > xb && x <= hx + cr * (/kraken/.test(key) ? 2.25 : 1.25) && y < hy - cr * (/kraken/.test(key) ? .4 : 1.3);
    if (mask[i] && (body || brow) && Math.hypot(x - hx, y - hy) > cr * 1.15) mask[i] = 0; }
  const D = distance(mask, W, H);
  // 다익스트라(이진 힙) — 비용은 가운데(D 큼)일수록 싸다. 호 길이(len)는 따로 센다(끝 고르기는 실제 길이로)
  const cost = new Float64Array(N).fill(Infinity), len = new Float32Array(N), par = new Int32Array(N).fill(-1), heap = [];
  const push = (c, i) => { heap.push([c, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (let i = 0; i < N; i++) if (mask[i] && Math.hypot(i % W - hx, ((i / W) | 0) - hy) < cr) { cost[i] = 0; push(0, i); }
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  while (heap.length) {
    const [c, i] = pop(); if (c > cost[i]) continue; const x = i % W, y = (i / W) | 0;
    for (const [dx, dy, l] of NB) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (!mask[j]) continue; const nc = c + l * (1 + 6 / (D[j] + .5)); if (nc < cost[j]) { cost[j] = nc; len[j] = len[i] + l; par[j] = i; push(nc, j); } }
  }
  const claimed = new Uint8Array(N), arms = [], tips = [];
  for (let k = 0; k < 8; k++) {
    // 끝끼리 떨어져야 한다(W 의 9%) — 차지 반경을 줄이자 팔 하나를 두 번 고르거나 한쪽 무리에서만 여덟을 골랐다(크라켄 오른쪽 팔이 빠졌다)
    let best = -1; for (let i = 0; i < N; i++) if (mask[i] && !claimed[i] && cost[i] < Infinity && D[i] >= 1 && (best < 0 || len[i] > len[best]) && tips.every(([tx, ty]) => Math.hypot(i % W - tx, ((i / W) | 0) - ty) > W * .09)) best = i;
    if (best < 0 || (arms.length && len[best] < arms[0].length * .28)) break;
    tips.push([best % W, (best / W) | 0]); const raw = []; for (let i = best; i >= 0; i = par[i]) raw.push(i); raw.reverse();
    // 차지: 팔 고리 근처(호 길이 30px 안)는 팔끼리 나눠 쓰므로 비워 둔다
    for (const i of raw) { if (len[i] < 30) continue; const x = i % W, y = (i / W) | 0, rad = D[i] * 2 + 4; for (let yy = Math.max(0, Math.floor(y - rad)); yy <= Math.min(H - 1, y + rad); yy++) for (let xx = Math.max(0, Math.floor(x - rad)); xx <= Math.min(W - 1, x + rad); xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= rad * rad) claimed[yy * W + xx] = 1; }
    // 계단을 고르게: 호 길이 고르게 다시 뽑고 이동 평균
    const P = raw.map((i) => [i % W, (i / W) | 0, D[i]]), cum = [0]; for (let j = 1; j < P.length; j++) cum.push(cum[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]));
    const L = cum[cum.length - 1], M = Math.max(8, Math.round(L / 2)), rs = [];
    for (let j = 0, q = 0; j <= M; j++) { const t = L * j / M; while (q < cum.length - 2 && cum[q + 1] < t) q++; const f = (t - cum[q]) / Math.max(1e-6, cum[q + 1] - cum[q]); rs.push([0, 1, 2].map((c) => P[q][c] + (P[q + 1][c] - P[q][c]) * f)); }
    const sm = rs.map((_, j) => { let s = [0, 0, 0], n = 0; for (let o = -4; o <= 4; o++) { const r = rs[Math.max(0, Math.min(rs.length - 1, j + o))]; s[0] += r[0]; s[1] += r[1]; s[2] += r[2]; n++; } return s.map((v) => v / n); });
    // 빨판 쪽: 왼쪽(진행 방향 기준 +법선) 가장자리와 오른쪽 가장자리의 밝기를 견준다(빨판은 옅다)
    const lum = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return 0; const o = (y * W + x) * 4; return data[o + 3] > 140 ? data[o] * .3 + data[o + 1] * .59 + data[o + 2] * .11 : 0; };
    let sL = 0, sR = 0;
    for (let j = 2; j < sm.length - 2; j++) { const tx = sm[j + 1][0] - sm[j - 1][0], ty = sm[j + 1][1] - sm[j - 1][1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, w = Math.max(1, sm[j][2]) * .75; sL += lum(sm[j][0] + nx * w, sm[j][1] + ny * w); sR += lum(sm[j][0] - nx * w, sm[j][1] - ny * w); }
    arms.push({pts: sm.map((p) => [p[0], p[1]]), w: sm.map((p) => Math.max(1.2, p[2])), side: sL >= sR ? 1 : -1, length: L});
  }
  return arms;
}

/** 관(중심선 · 반지름 · 기준 법선) — 평행 이동 틀. ring(j, i) 의 uv 는 uvOf(s, q) 가 준다(q: 둘레 0~1, 0 = 기준 법선 쪽) */
function tube(G, pts, rad, ref0, sides, uvOf, part, twist = null, opt = null) {
  const n = pts.length, rings = [];
  let nrm = ref0.clone();
  for (let i = 0; i < n; i++) {
    const t = (i < n - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1])).normalize();
    // opt.frames: 마디마다 정한 기준 법선(문어 · 크라켄 — 그림의 빨판 쪽), opt.s: 마디마다 뿌리→끝 몫(고르지 않은 마디)
    if (opt?.frames) nrm = opt.frames[i].clone();
    nrm.sub(t.clone().multiplyScalar(nrm.dot(t))).normalize();
    const bin = new T.Vector3().crossVectors(t, nrm), ring = [], s = opt?.s ? opt.s[i] : i / (n - 1);
    for (let j = 0; j <= sides; j++) {
      const q = j / sides, a = q * Math.PI * 2 + (twist ? twist(s) : 0), d = nrm.clone().multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a));
      ring.push(G.v(pts[i].clone().addScaledVector(d, rad[i]), uvOf(s, q), part, d));
    }
    rings.push(ring);
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) { const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j], d = rings[i + 1][j + 1]; G.I.push(a, b, c, b, d, c); }
  // 끝 마개(뿌리는 몸 속이라 끝만)
  const last = rings[n - 1], tip = G.v(pts[n - 1].clone().add(pts[n - 1].clone().sub(pts[n - 2]).normalize().multiplyScalar(rad[n - 1] * .8)), uvOf(1, 0), part, pts[n - 1].clone().sub(pts[n - 2]).normalize());
  for (let j = 0; j < sides; j++) G.I.push(last[j], tip, last[j + 1]);
  return rings;
}
/** 팔 띠 uv — 팔 a, 뿌리→끝 s, 둘레 q(0 = 빨판 쪽). 막(web)은 띠의 위쪽 몫 */
const bandV = (a, f) => CEPH_UV.band0 + (a + f) * CEPH_UV.bandH;
const armUV = (a) => (s, q) => [CEPH_UV.u0 + s * (CEPH_UV.u1 - CEPH_UV.u0), bandV(a, CEPH_UV.margin + q * (CEPH_UV.webFrac - 2 * CEPH_UV.margin))];
const webUV = (a) => (s, q) => [CEPH_UV.u0 + s * (CEPH_UV.u1 - CEPH_UV.u0), bandV(a, CEPH_UV.webFrac + CEPH_UV.margin + q * (1 - CEPH_UV.webFrac - 2 * CEPH_UV.margin))];

async function build(key) {
  const art = await loadArt(`public/aqua/fish/${key}.webp`), {data, W, H} = art, O = octo(key), AR = ARMS[key], rnd = rng(key);
  const B = bodyProfile(art, key);
  // 새끼(fry_)는 삼각형 3,000 · 300KB 안(models.json 의 새끼 규격 — expansion2-art · gamepolish 시험) — 같은 모양을 마디 · 둘레를 줄여 짓는다
  const lo = key.startsWith('fry_');
  // 그림 px → 모델(팔 고리가 원점, +Y 위). 마지막에 길이 2 로 맞춘다
  const M = (x, y, z = 0) => new T.Vector3(x - B.hx, B.hy - y, z);
  const G = {P: [], UV: [], I: [], part: [], N: [], v(p, uv, part, nrm) { this.P.push(p.x, p.y, p.z); this.UV.push(uv[0], uv[1]); this.part.push(part); this.N.push(nrm ? [nrm.x, nrm.y, nrm.z] : null); return this.P.length / 3 - 1; }};
  // 그림 픽셀(빈 곳은 가장 가까운 불투명 픽셀) — 텍스처 · 크라켄 혹이 같이 읽는다
  const near = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H); let qa = 0, qb = 0; for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] > 150) { near[i] = i; q[qb++] = i; }
  while (qa < qb) { const i = q[qa++], x = i % W; for (const j of [i - W, i + W, ...(x ? [i - 1] : []), ...(x < W - 1 ? [i + 1] : [])]) if (j >= 0 && j < W * H && near[j] < 0) { near[j] = near[i]; q[qb++] = j; } }
  const px = (x, y) => { x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y))); const k = near[y * W + x] * 4; return [data[k], data[k + 1], data[k + 2]]; };
  const KR = /kraken/.test(key), bodyRows = CEPH_UV.body;
  // 문어 · 크라켄은 몸 둘레를 펼쳐(0 ~ 2π) 둔다(1024 아틀라스의 몸 몫을 한쪽 옆에 205줄씩).
  // 오징어류는 예전 그대로(양옆이 같은 그림을 나눠 쓰는 접힌 배치 — 배포한 GLB 와 바이트가 같아야 한다)
  const bodyUV = O ? (x, phi) => [(x - B.x0) / (B.x1 - B.x0), (phi / (2 * Math.PI)) * (bodyRows - .004) + .002]
    : (x, phi) => { const pm = phi <= Math.PI ? phi : 2 * Math.PI - phi; return [(x - B.x0) / (B.x1 - B.x0), (pm / Math.PI) * (bodyRows - .004) + .002]; };
  // 몸 둘레 φ → 그림 y. 옆모습 투영(cos)은 등(φ≈0)에서 기울기가 0 이라 등 전체가 그림 윗가장자리 몇 줄로 늘어나 위에서 보면 줄무늬였다(크라켄 윗면).
  // 문어 · 크라켄은 등 쪽(φ < .9 rad)을 각에 비례하는 배치로 옮긴다 — 등 가운데는 몸 윗부분 안쪽 그림, 옆으로 갈수록 옆모습 그대로(양옆 거울)
  const texY = (c, r, phi) => {
    if (!O) return c - Math.cos(phi) * r * .9;
    const pm = phi <= Math.PI ? phi : 2 * Math.PI - phi, h = pm < .9 ? (1 - 2 * pm / Math.PI) * (1 - smooth(0, .9, pm)) + Math.cos(pm) * smooth(0, .9, pm) : Math.cos(pm);
    return c - h * r * .9;
  };
  const lumOf = (c) => c[0] * .3 + c[1] * .59 + c[2] * .11;
  const h3 = (a, b, c) => { const t = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return t - Math.floor(t); };
  const noise3 = (x, y, z) => { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = [x - xi, y - yi, z - zi].map((t) => t * t * (3 - 2 * t)); let o = 0; for (let k = 0; k < 8; k++) { const dx = k & 1, dy = (k >> 1) & 1, dz = k >> 2; o += h3(xi + dx, yi + dy, zi + dz) * (dx ? f[0] : 1 - f[0]) * (dy ? f[1] : 1 - f[1]) * (dz ? f[2] : 1 - f[2]); } return o; };
  let lumMean = 0; if (KR) { let cnt = 0; for (let x = B.x0; x <= B.x1; x += 2) for (let k = 0; k < 12; k++) { lumMean += lumOf(px(x, texY(B.C[x], B.RT[x], k / 12 * Math.PI * 2))); cnt++; } lumMean /= cnt; }
  // ── 몸통 관(외투막 + 머리): 가로 단면 = 높이 R · 폭 R×wz. 크라켄은 머리가 넓고(wz) 등 쪽이 울퉁불퉁하다 — 큰 혹(잡음) + 그림의 밝은 따개비 자리를 밖으로 민다
  const wz = O ? (KR ? 1.15 : 1.02) : 1, NS = O ? (lo ? (KR ? 16 : 12) : (KR ? 28 : 20)) : (lo ? 12 : 18), step = Math.max(2, (B.x1 - B.x0) / (O ? (lo ? (KR ? 20 : 15) : (KR ? 36 : 26)) : (lo ? 15 : 24))), rings = [];
  for (let x = B.x0; x <= B.x1 + .01; x += step) {
    const xi = Math.min(B.x1, Math.round(x)), r = B.R[xi], c = B.C[xi], ring = [];
    for (let j = 0; j <= NS; j++) {
      const phi = j / NS * Math.PI * 2, d = new T.Vector3(0, Math.cos(phi), Math.sin(phi) * wz);
      let rr = r;
      if (KR) {
        const fx = (x - B.x0) / (B.x1 - B.x0), fade = smooth(0, .12, fx) * smooth(0, .3, 1 - fx), up = smooth(-.35, .35, Math.cos(phi));
        const big = noise3(x / 26, Math.cos(phi) * r / 26, Math.sin(phi) * r / 26) - .45, barn = (lumOf(px(x, texY(c, B.RT[xi], phi))) - lumMean) / 255;
        rr = r * KHEAD * (1 + fade * up * Math.max(-.04, .3 * big + .5 * barn)); // 머리는 그림보다 KHEAD 배 크게(그림은 그대로 입힌다 — 옆에서 그림이 커진 꼴)
      }
      ring.push(G.v(M(x, c - Math.cos(phi) * rr, Math.sin(phi) * rr * wz), bodyUV(x, phi), 'body', d));
    }
    rings.push({ring, x});
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < NS; j++) { const a = rings[i].ring[j], b = rings[i].ring[j + 1], c = rings[i + 1].ring[j], d = rings[i + 1].ring[j + 1]; G.I.push(a, c, b, b, c, d); }
  for (const [k, rev] of [[0, true], [rings.length - 1, false]]) { const x = rings[k].x, xi = Math.min(B.x1, Math.round(x)), ctr = G.v(M(x + (rev ? -1 : 1) * B.R[xi] * .15, B.C[xi]), bodyUV(x, Math.PI / 2), 'body', new T.Vector3(rev ? -1 : 1, 0, 0)); for (let j = 0; j < NS; j++) { const a = rings[k].ring[j], b = rings[k].ring[j + 1]; G.I.push(...(rev ? [ctr, b, a] : [ctr, a, b])); } }
  const bodyAt = (x) => { const xi = Math.max(B.x0, Math.min(B.x1, Math.round(x))); return {c: B.C[xi], r: B.R[xi], rt: O ? B.RT[xi] : B.R[xi]}; };

  // ── 팔
  const armInfo = [], r0 = B.mry * AR.root, LW = (AR.len ?? 0) * W; // LW 는 오징어류만(문어 · 크라켄 팔 길이는 그림 길)
  if (O) {
    // 팔은 그림에서 따라 그린 길(traceArms) — 옆에서 보면 그림의 팔 그대로(xy = 그림), 앞뒤(z)로만 부채처럼 벌린다(위 · 앞에서 별).
    // 길 여덟을 그림 방향(오른쪽 위 → 아래 → 왼쪽 위) 순으로 세우고 엇갈려 앞(+z) 넷 · 뒤(−z) 넷에 나눈다 — 고리에서 이웃한 팔이 그림에서도 이웃한 방향이라 막이 덜 늘어난다.
    // 옆으로 뻗은 팔은 조금, 아래로 늘어진 팔은 크게 벌린다(sin θ). 길이 여덟보다 적으면 이웃 길을 앞뒤로 나눠 쓴다
    const paths = traceArms(art, key), rc = B.cr * .45, n = lo ? 14 : KR ? 22 : 24, sides = lo ? 6 : KR ? 7 : 8, kz = AR.fan;
    const dirOfPath = (p) => { const m = p.pts[Math.floor(p.pts.length * .4)]; let f = Math.atan2(m[1] - B.hy, m[0] - B.hx); if (f < -Math.PI / 2) f += 2 * Math.PI; return f; };
    const sorted = paths.map((p) => ({...p, dir: dirOfPath(p)})).sort((a, b) => a.dir - b.dir), ord = Array.from({length: 8}, (_, k) => sorted[Math.round(k * (sorted.length - 1) / 7)]);
    const pick = [ord[0], ord[2], ord[4], ord[6], ord[7], ord[5], ord[3], ord[1]];
    // 마디는 끝으로 갈수록 촘촘하게(말린 끝이 각지지 않게)
    const svals = Array.from({length: n + 1}, (_, i) => 1 - (1 - i / n) ** 1.35);
    for (let a = 0; a < 8; a++) {
      const tr = pick[a], zs = Math.sin((a + .5) * Math.PI / 4), ap = [[B.hx, B.hy], ...tr.pts], aw = [tr.w[0], ...tr.w], cum = [0];
      for (let j = 1; j < ap.length; j++) cum.push(cum[j - 1] + Math.hypot(ap[j][0] - ap[j - 1][0], ap[j][1] - ap[j - 1][1]));
      const La = cum[cum.length - 1];
      // 그림 길 위의 한 자리(호 길이 몫 s): 자리 · 반폭 · 빨판 쪽 법선(그림 좌표)
      const at2 = (s) => {
        const t = Math.max(0, Math.min(1, s)) * La; let j = 0; while (j < cum.length - 2 && cum[j + 1] < t) j++;
        const f = (t - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), x = ap[j][0] + (ap[j + 1][0] - ap[j][0]) * f, y = ap[j][1] + (ap[j + 1][1] - ap[j][1]) * f, w = aw[j] + (aw[j + 1] - aw[j]) * f;
        const j0 = Math.max(0, j - 2), j1 = Math.min(ap.length - 1, j + 3), tx = ap[j1][0] - ap[j0][0], ty = ap[j1][1] - ap[j0][1], tl = Math.hypot(tx, ty) || 1;
        return {x, y, w, nx: tr.side * -ty / tl, ny: tr.side * tx / tl};
      };
      const P = [], rad = [], frames = [];
      for (const sv of svals) {
        const p = at2(sv);
        P.push(M(p.x, p.y, zs * (rc + kz * sv * La)));
        rad.push(Math.max(.9, Math.min(r0 * 1.2, p.w * (KR ? 1.25 : 1.15))));
        // 그림 y 는 아래, 모델 y 는 위. 빨판 쪽을 그 팔이 벌어진 쪽(앞 팔은 +z — 수조 카메라 쪽)으로 SUCK_TURN 만큼 돌린다:
        // 그림 평면 그대로면 빨판 줄이 옆에서 보면 팔 윤곽선에 겹쳐 실 한 가닥으로만 보였다(그림은 비스듬히 그려 빨판 줄이 보인다)
        frames.push(new T.Vector3(p.nx * Math.cos(SUCK_TURN), -p.ny * Math.cos(SUCK_TURN), Math.sign(zs) * Math.sin(SUCK_TURN)));
      }
      tube(G, P, rad, frames[0], sides, armUV(a), 'arm', null, {frames, s: svals});
      armInfo.push({a, P, rad, L: La, at2});
      // 빨판 — 빨판 쪽 둘레(각 ±.45, 두 줄 엇갈려)에 오각뿔 구슬. 바닥은 팔 속으로 묻어 몸에서 떨어진 부품이 아니다.
      // uv 는 그 팔 띠의 아래 여백(f < margin — 옅은 빨판 색을 칠한다): cephArmData 가 팔 정점으로 읽고 팔과 같이 돈다
      const maxS = lo ? 12 : 28, sucks = [];
      for (let sv = .1, k = 0; sv < .93 && sucks.length < maxS; k++) { sucks.push([sv, k % 2 ? -.45 : .45]); sv += Math.max(at2(sv).w * .85, La * .82 / maxS) / La; }
      for (const [sv, ang] of sucks) {
        let i = 0; while (i < svals.length - 2 && svals[i + 1] < sv) i++;
        const f = (sv - svals[i]) / (svals[i + 1] - svals[i]), c = P[i].clone().lerp(P[i + 1], f), rr = rad[i] + (rad[i + 1] - rad[i]) * f, t = P[i + 1].clone().sub(P[i]).normalize();
        const nm = frames[i].clone().lerp(frames[i + 1], f); nm.sub(t.clone().multiplyScalar(nm.dot(t))).normalize();
        const bn = new T.Vector3().crossVectors(t, nm), d = nm.clone().multiplyScalar(Math.cos(ang)).addScaledVector(bn, Math.sin(ang)), e2 = new T.Vector3().crossVectors(d, t), sr = rr * .5;
        const uvA = [CEPH_UV.u0 + sv * (CEPH_UV.u1 - CEPH_UV.u0), bandV(a, CEPH_UV.margin * .4)], uvB = [uvA[0], bandV(a, CEPH_UV.margin * .8)];
        const apex = G.v(c.clone().addScaledVector(d, rr + sr * .7), uvA, 'arm', d), base = [];
        for (let k = 0; k < 5; k++) { const be = k / 5 * Math.PI * 2, o = t.clone().multiplyScalar(Math.cos(be)).addScaledVector(e2, Math.sin(be)); base.push(G.v(c.clone().addScaledVector(d, rr * .8).addScaledVector(o, sr), uvB, 'arm', d.clone().addScaledVector(o, .8).normalize())); }
        for (let k = 0; k < 5; k++) G.I.push(base[k], base[(k + 1) % 5], apex);
      }
    }
    // 팔 사이 막 — 이웃한 두 팔의 뿌리 22% 를 잇는 얇은 막(가장자리는 팔 사이에서 오목하게). 반은 왼팔 띠, 반은 오른팔 띠
    for (let a = 0; a < 8; a++) {
      const L1 = armInfo[a], L2 = armInfo[(a + 1) % 8], ns = lo ? 4 : 5, nf = lo ? 4 : 6, idx = [];
      const at = (arm, s) => { const k = s * (arm.P.length - 1), i = Math.min(arm.P.length - 2, Math.floor(k)), f = k - i; return arm.P[i].clone().lerp(arm.P[i + 1], f); };
      for (let i = 0; i <= ns; i++) { const row = []; for (let j = 0; j <= nf; j++) {
        const f = j / nf, sMax = .2 * (1 - .5 * Math.sin(Math.PI * f)), s = sMax * i / ns, p = at(L1, s).lerp(at(L2, s), f);
        const owner = f <= .5 ? L1 : L2, uv = webUV(owner.a)(s, f <= .5 ? f : 1 - f);
        row.push(G.v(p, uv, 'web', null));
      } idx.push(row); }
      // 가운데(f = .5)는 두 띠가 겹치므로 같은 자리 정점을 둘로 — 오른쪽 반은 L2 띠
      for (let i = 0; i < ns; i++) for (let j = 0; j < nf; j++) {
        let a0 = idx[i][j], b0 = idx[i][j + 1], c0 = idx[i + 1][j], d0 = idx[i + 1][j + 1];
        if (j === nf / 2) { const dup = (v) => G.v(new T.Vector3(G.P[v * 3], G.P[v * 3 + 1], G.P[v * 3 + 2]), webUV(L2.a)((G.UV[v * 2] - CEPH_UV.u0) / (CEPH_UV.u1 - CEPH_UV.u0), .5), 'web', null); a0 = dup(a0); c0 = dup(c0); }
        G.I.push(a0, c0, b0, b0, c0, d0);
      }
    }
    // 입 둘레(팔 고리 밑) — 아래에서 보면 팔 뿌리 사이가 비어 보였다
    const cy = -r0 * .15, cap = [], m = lo ? 10 : 16, ctr = G.v(new T.Vector3(0, cy - r0 * .2, 0), bodyUV(B.hx, Math.PI), 'body', new T.Vector3(0, -1, 0));
    for (let j = 0; j <= m; j++) { const t = j / m * Math.PI * 2; cap.push(G.v(new T.Vector3(Math.cos(t) * (rc + r0 * .9), cy, Math.sin(t) * (rc + r0 * .9)), bodyUV(B.hx, Math.PI * .9), 'body', new T.Vector3(0, -1, 0))); }
    for (let j = 0; j < m; j++) G.I.push(ctr, cap[j + 1], cap[j]);
  } else {
    const rc = B.cr * .35, ax = new T.Vector3(1, 0, 0);
    const mk = (a, phi, L, r0a, spread, n, sides, shape) => {
      const radial = new T.Vector3(0, Math.cos(phi), Math.sin(phi)), root = radial.clone().multiplyScalar(rc).add(new T.Vector3(-r0a * .5, 0, 0));
      let dir = ax.clone().addScaledVector(radial, Math.tan(spread)).normalize(), p = root.clone();
      const P = [p.clone()], wig = (rnd() - .5) * .9, side = new T.Vector3().crossVectors(radial, ax);
      // 팔: 뿌리에서 조금 벌어졌다가 끝 쪽은 안으로 말린다(빨판 쪽 = 축 쪽) · 팔마다 옆으로 조금씩 다르게 휜다
      const bend = .6 + rnd() * .8;
      for (let i = 1; i <= n; i++) { const s = i / n; dir = shape ? shape(s, dir, radial) : dir.clone().addScaledVector(radial, (s < .45 ? .05 * (AR.droop ? 2 : 1) : -.16 * bend * ((s - .45) / .55) ** 1.5) * 14 / n).addScaledVector(side, wig * .06 * Math.cos(s * 4)).normalize(); p = p.clone().addScaledVector(dir, L / n); P.push(p.clone()); }
      return {P, radial, root};
    };
    for (let a = 0; a < 8; a++) {
      const phi = (a + .5) * Math.PI / 4, L = LW * (.85 + rnd() * .3), n = lo ? 10 : 14, {P, radial} = mk(a, phi, L, r0, .42, n, 7, null);
      const rad = P.map((_, i) => r0 * (1 - .9 * i / n) ** 1.2 + r0 * .05);
      tube(G, P, rad, radial.clone().negate(), lo ? 6 : 7, armUV(a), 'arm');
      armInfo.push({a, P, rad, L});
    }
    // 촉완 둘 — 아래쪽 양옆에서. 대왕오징어는 앞으로 나갔다가 아래 · 뒤로 길게 늘어진다
    for (const [a, phi] of [[8, Math.PI * .78], [9, Math.PI * 1.22]]) {
      const L = AR.tent * W * (.95 + rnd() * .1), n = AR.droop ? (lo ? 24 : 34) : (lo ? 14 : 22), rT = r0 * (AR.droop ? .36 : .5);
      const shape = AR.droop ? (s) => { const pitch = s < .16 ? .15 : s < .5 ? .15 + (s - .16) / .34 * 2.55 : 2.7 + (s - .5) * .5, yaw = (phi > Math.PI ? 1 : -1) * (.2 + .5 * s); return new T.Vector3(Math.cos(pitch) * Math.cos(yaw), -Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)).normalize(); }
        : (s, dir, radial) => dir.clone().addScaledVector(radial, -.012).normalize();
      const {P, radial} = mk(a, phi, L, rT, .2, n, 6, shape);
      const rad = P.map((_, i) => { const s = i / n; return rT * (1 - .45 * s) + (s > .78 ? rT * 1.3 * Math.sin((s - .78) / .22 * Math.PI) ** .7 : 0) + rT * .12; });
      tube(G, P, rad, radial.clone().negate(), lo ? 5 : 6, armUV(a), 'arm');
      armInfo.push({a, P, rad, L, tentacle: true});
    }
    // 지느러미 한 쌍 — 외투막 끝 양옆에 편 얇은 판(위 · 아래 두 면), 조금 들린다
    const fl = (B.x1 - B.x0) * (AR.droop ? .28 : .36), xa = B.x0 + (B.x1 - B.x0) * .01, span = B.mry * (AR.droop ? 1.25 : 1.45);
    for (const sz of [1, -1]) {
      const nu = lo ? 6 : 10, nv = lo ? 4 : 6, top = [], bot = [];
      for (let i = 0; i <= nu; i++) { const t = i / nu, x = xa + t * fl, {c, r} = bodyAt(x), w = span * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** .7 * (1 - .15 * t), rowT = [], rowB = [];
        for (let j = 0; j <= nv; j++) { const f = j / nv, z = (r * .85 + w * f) * sz, y = c - f * w * .3, th = (1 - f) * r * .12 + .6;
          rowT.push(G.v(M(x, y - th, z), bodyUV(x, Math.PI / 2 * (1 - f * .8)), 'fin', null)); rowB.push(G.v(M(x, y + th, z), bodyUV(x, Math.PI / 2 * (1 + f * .8)), 'fin', null)); }
        top.push(rowT); bot.push(rowB); }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const s = sz > 0; const a0 = top[i][j], b0 = top[i][j + 1], c0 = top[i + 1][j], d0 = top[i + 1][j + 1]; G.I.push(...(s ? [a0, b0, c0, b0, d0, c0] : [a0, c0, b0, b0, c0, d0])); const e = bot[i][j], f2 = bot[i][j + 1], g2 = bot[i + 1][j], h2 = bot[i + 1][j + 1]; G.I.push(...(s ? [e, g2, f2, f2, g2, h2] : [e, f2, g2, f2, h2, g2])); }
      for (let i = 0; i < nu; i++) { const a0 = top[i][nv], b0 = top[i + 1][nv], c0 = bot[i][nv], d0 = bot[i + 1][nv]; G.I.push(a0, c0, b0, b0, c0, d0); }
    }
  }

  // ── 길이 2 · 옛 모델 자리로
  const n = G.P.length / 3; if (n > 65535) throw Error('vertices ' + n);
  const bb = new T.Box3(); for (let i = 0; i < n; i++) bb.expandByPoint(new T.Vector3(G.P[i * 3], G.P[i * 3 + 1], G.P[i * 3 + 2]));
  const sz = bb.getSize(new T.Vector3()), S = 2 / Math.max(sz.x, sz.z, sz.y * 1.25), c0 = bb.getCenter(new T.Vector3());
  const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = (G.P[i * 3 + k] - c0.getComponent(k)) * S + CENTER[k];

  // ── 뼈: 옛 모델과 같은 사슬. 오징어 지느러미 뼈는 외투막 끝 지느러미 뿌리에(게임이 X 축으로 저어 지느러미를 퍼덕인다)
  const names = ['spine_0', 'spine_1', 'spine_2', 'spine_3', 'spine_4', 'spine_5', 'fin_L', 'fin_L_tip', 'fin_R', 'fin_R_tip'], bones = names.map((m) => { const b = new T.Bone(); b.name = m; return b; });
  // 사슬 높이 = 몸통(외투막 · 머리) 가운데 높이 — 엔진이 숨 · 물 뿜기 때 spine_3 를 위아래로 오므리는데, 사슬이 몸 아래(늘어진 촉완 · 팔 쪽)에 있으면 외투막이 통째로 오르내렸다
  let by = 0, bc = 0; for (let i = 0; i < n; i++) if (G.part[i] === 'body') { by += pos[i * 3 + 1]; bc++; } const BY = by / bc;
  for (let i = 0; i < 6; i++) { bones[i].position.set(i ? BX[i] - BX[i - 1] : BX[0], i ? 0 : BY, 0); if (i) bones[i - 1].add(bones[i]); }
  let finRoot = null;
  if (O) { bones[1].add(bones[6]); bones[6].position.set(-.1, -.04, .12); bones[6].add(bones[7]); bones[7].position.set(-.12, -.05, .22); bones[1].add(bones[8]); bones[8].position.set(-.1, -.04, -.12); bones[8].add(bones[9]); bones[9].position.set(-.12, -.05, -.22); }
  else {
    // 지느러미 뿌리(몸 표면) · 끝 — 모델 좌표
    let fx = 0, fy = 0, fz = 0, tz = 0, cnt = 0; for (let i = 0; i < n; i++) if (G.part[i] === 'fin' && pos[i * 3 + 2] > 0) { fx += pos[i * 3]; fy += pos[i * 3 + 1]; cnt++; tz = Math.max(tz, pos[i * 3 + 2]); }
    fx /= cnt; fy /= cnt; let rz = 1e9; for (let i = 0; i < n; i++) if (G.part[i] === 'fin' && pos[i * 3 + 2] > 0) rz = Math.min(rz, pos[i * 3 + 2]); fz = rz;
    finRoot = {x: fx, y: fy, z: fz, tip: tz};
    bones[5].add(bones[6]); bones[6].position.set(fx - BX[5], fy - BY, fz); bones[6].add(bones[7]); bones[7].position.set(0, 0, (tz - fz) * .55);
    bones[5].add(bones[8]); bones[8].position.set(fx - BX[5], fy - BY, -fz); bones[8].add(bones[9]); bones[9].position.set(0, 0, -(tz - fz) * .55);
  }
  bones[0].updateMatrixWorld(true); // 저장 전에 world 행렬 — 역바인드가 '뼈 world × 역바인드 = 단위'가 되게(bindpose.test)
  // 가중치: x 로 사슬을 따라. 문어형의 팔 · 막 · 입은 앞 마디(spine_0 ~ 2)에만 — 외투막 숨(spine_3 배율)에 뒤쪽 팔이 같이 부풀지 않게
  const J = new Uint16Array(n * 4), Wt = new Float32Array(n * 4);
  const chain = (i, x) => { if (x >= BX[0]) { J[i * 4] = 0; Wt[i * 4] = 1; return; } let k = 0; while (k < 4 && x < BX[k + 1]) k++; const f = Math.max(0, Math.min(1, (BX[k] - x) / (BX[k] - BX[k + 1]))); J[i * 4] = k; J[i * 4 + 1] = k + 1; Wt[i * 4] = 1 - f; Wt[i * 4 + 1] = f; };
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], part = G.part[i];
    if (O && (part === 'arm' || part === 'web' || (part === 'body' && pos[i * 3 + 1] < CENTER[1] - .05 && x > BX[3]))) chain(i, Math.max(x, BX[2] + 1e-4));
    else if (part === 'fin') { const z = pos[i * 3 + 2], f = Math.min(1, Math.max(0, (Math.abs(z) - finRoot.z) / Math.max(1e-4, finRoot.tip - finRoot.z))), b = z > 0 ? 6 : 8; J[i * 4] = b; J[i * 4 + 1] = b + 1; Wt[i * 4] = 1 - f; Wt[i * 4 + 1] = f; }
        else chain(i, x);
  }
  // 법선: 같은 자리 정점끼리 평균(관의 이음매 · 팔 띠 둘레 이음매가 보이지 않게)
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(G.UV, 2)); g.setIndex(G.I); g.computeVertexNormals();
  const nr = g.attributes.normal, same = new Map(), keyOf = (i) => `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`;
  for (let i = 0; i < n; i++) { const k = keyOf(i), s = same.get(k) ?? [0, 0, 0]; s[0] += nr.getX(i); s[1] += nr.getY(i); s[2] += nr.getZ(i); same.set(k, s); }
  for (let i = 0; i < n; i++) { const s = same.get(keyOf(i)), l = Math.hypot(...s) || 1; nr.setXYZ(i, s[0] / l, s[1] / l, s[2] / l); }
  // 관(몸 · 팔)은 바깥 방향을 안다 — 감는 방향이 뒤집혀 법선이 안으로 향하면 뒤집는다(양면 재질이라 막 · 지느러미는 그대로 둔다)
  for (let i = 0; i < n; i++) { const d = G.N[i]; if (d && nr.getX(i) * d.x + nr.getY(i) * d.y + nr.getZ(i) * d.z < 0) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i)); }
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(J, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(Wt, 4));

  // ── 텍스처: 위 = 몸 둘레로 굽은 그림 · 아래 = 팔 띠 10 개. 문어 · 크라켄은 1024 로 그려 압축기가 512(배포 규격)로 줄인다 — 그림 픽셀을 가장 가까운 것 하나씩 집어 오므로, 512 에 바로 그리면 팔 띠의 빨판 구슬이 계단지고 줄면서 평균을 내면 부드럽다
  const SZ = O ? 1024 : 512, atlas = Buffer.alloc(SZ * SZ * 3), rowsBody = Math.round(bodyRows * SZ);
  for (let v = 0; v < rowsBody; v++) for (let u = 0; u < SZ; u++) { const x = B.x0 + (B.x1 - B.x0) * u / (SZ - 1), phi = (v + .5) / rowsBody * Math.PI * (O ? 2 : 1), {c, rt} = bodyAt(x); atlas.set(px(x, texY(c, rt, phi)), (v * SZ + u) * 3); }
  for (let v = rowsBody; v < Math.round(CEPH_UV.band0 * SZ); v++) atlas.copy(atlas, v * SZ * 3, (rowsBody - 1) * SZ * 3, rowsBody * SZ * 3);
  // 팔 색: 팔 고리에서 떨어지고 외투막 밖인 불투명 픽셀 — 밝기 순으로 등 쪽(가운데) · 빨판 쪽(밝은 쪽) · 어두운 쪽
  const sample = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (data[i * 4 + 3] < 200) continue; if (Math.hypot(x - B.hx, y - B.hy) < B.cr * 1.6) continue; if (((x - B.mx) / (B.mrx * 1.2)) ** 2 + ((y - B.my) / (B.mry * 1.25)) ** 2 < 1) continue; if (!O && x < B.hx) continue; sample.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]); }
  sample.sort((a, b) => (a[0] * .3 + a[1] * .59 + a[2] * .11) - (b[0] * .3 + b[1] * .59 + b[2] * .11));
  const avg = (lo, hi) => { const s = sample.slice(Math.floor(sample.length * lo), Math.max(Math.floor(sample.length * lo) + 1, Math.floor(sample.length * hi))); return [0, 1, 2].map((k) => s.reduce((t, c) => t + c[k], 0) / s.length); };
  // 외투막 색(타원 안쪽 60%) — 팔 등 쪽을 몸 색 쪽으로 끌어당긴다(팔 픽셀만 재면 빨판이 섞여 옅었다)
  const mant = [0, 0, 0]; let mc = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (data[i * 4 + 3] > 200 && ((x - B.mx) / (B.mrx * .6)) ** 2 + ((y - B.my) / (B.mry * .6)) ** 2 < 1) { for (let k = 0; k < 3; k++) mant[k] += data[i * 4 + k]; mc++; } }
  for (let k = 0; k < 3; k++) mant[k] /= Math.max(1, mc);
  const mix = (a, b, t) => a.map((v, k) => v * (1 - t) + b[k] * t), back = mix(avg(.35, .7), mant, .45), light = avg(.82, .97), dark = avg(.1, .3);
  const noise = (x, y) => { const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }; const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy) + (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy; };
  for (const arm of armInfo) if (O) {
    // 문어 · 크라켄: 팔 띠 = 그 팔이 따라 그린 그림 길을 편 것. 둘레 각 a 의 자리는 옆에서 보면 중심선에서 빨판 쪽으로 cos a × 반폭 — 그 그림 픽셀을 그대로(빨판 구슬 · 색 띠가 그림 그대로)
    const top = Math.round(bandV(arm.a, 0) * SZ), bot = Math.round(bandV(arm.a, 1) * SZ), pale = mix(light, [255, 244, 236], .35);
    const strip = Array.from({length: SZ}, (_, u) => arm.at2((u / (SZ - 1) - CEPH_UV.u0) / (CEPH_UV.u1 - CEPH_UV.u0)));
    for (let v = top; v < bot; v++) {
      const f = (v + .5 - top) / (bot - top);
      for (let u = 0; u < SZ; u++) {
        const p = strip[u]; let col;
        if (f < CEPH_UV.margin) col = mix(pale, light, f / CEPH_UV.margin * .6); // 빨판 구슬(오각뿔)이 읽는 여백 — 옅은 빨판 색
        else if (f < CEPH_UV.webFrac) { const lat = Math.cos((f - CEPH_UV.margin) / (CEPH_UV.webFrac - 2 * CEPH_UV.margin) * Math.PI * 2) * p.w * .9; col = px(p.x + p.nx * lat, p.y + p.ny * lat); }
        else col = mix(px(p.x - p.nx * p.w * .5, p.y - p.ny * p.w * .5), back, .4); // 막: 팔 등 쪽 그림 색을 몸 색으로 조금
        atlas.set(col.map((c) => Math.max(0, Math.min(255, Math.round(c)))), (v * SZ + u) * 3);
      }
    }
  } else {
    const top = Math.round(bandV(arm.a, 0) * 512), bot = Math.round(bandV(arm.a, 1) * 512), L = arm.L, n2 = arm.rad.length - 1;
    const rAt = (s) => arm.rad[Math.min(n2, Math.round(s * n2))];
    // 빨판 자리(뿌리→끝): 빨판 지름 ∝ 그 자리 굵기
    const suck = []; for (let s = .04; s < .97;) { suck.push(s); s += Math.max(.01, rAt(s) * 1.25 / L); }
    for (let v = top; v < bot; v++) {
      const f = (v + .5 - top) / (bot - top);
      for (let u = 0; u < 512; u++) {
        const s = Math.max(0, Math.min(1, (u / 511 - CEPH_UV.u0) / (CEPH_UV.u1 - CEPH_UV.u0))), mot = noise(s * L / 9, f * 12 + arm.a * 7) * .7 + noise(s * L / 3, f * 40) * .3;
        let col;
        if (f < CEPH_UV.webFrac) {
          const qq = Math.max(0, Math.min(1, (f - CEPH_UV.margin) / (CEPH_UV.webFrac - 2 * CEPH_UV.margin))), ang = qq * Math.PI * 2, oral = smooth(.15, .75, Math.cos(ang));
          col = mix(mix(back, dark, Math.max(0, .5 - mot) * .55), light, oral * .85);
          // 빨판: 문어형 두 줄(엇갈려) · 오징어형 한 줄. 둘레 각과 길이 방향 거리로 그린 원(테두리 밝게 · 가운데 조금 어둡게)
          const rows = O ? [-.42, .42] : [0];
          for (let ri = 0; ri < rows.length; ri++) for (let k = ri % 2; k < suck.length; k += O ? 2 : 1) {
            const ss = suck[k], da = Math.atan2(Math.sin(ang - rows[ri]), Math.cos(ang - rows[ri])) / (O ? .36 : .5), dl = (s - ss) * L / Math.max(.6, rAt(ss) * .55), d = Math.hypot(da, dl);
            if (d < 1) col = d > .55 ? mix(light, [255, 246, 238], .5) : mix(light, dark, .45);
          }
        } else col = mix(mix(back, light, .35), dark, Math.max(0, .5 - mot) * .5); // 막: 등 색과 빨판 색 사이
        atlas.set(col.map((c) => Math.max(0, Math.min(255, Math.round(c)))), (v * 512 + u) * 3);
      }
    }
  }
  const png = await sharp(atlas, {raw: {width: SZ, height: SZ, channels: 3}}).png().toBuffer();
  const glb = await compressGLB(material(packAsset(key, [{name: key, geometry: g, extras: {aquaGeometry: 'cephalopod-v3', source: `public/aqua/fish/${key}.webp`, bodyCrossSection: 'round tube traced from art', arms: armInfo.length, armUV: 'CEPH_UV bands (src/lib/aqua3d/cephalopod.ts)'}}], png, bones), (m) => { m.name = 'painted_PBR_atlas'; m.doubleSided = true; m.pbrMetallicRoughness.metallicFactor = .04; m.pbrMetallicRoughness.roughnessFactor = .55; }), {webpQuality: 90}); // 배포 규격은 512 이하 WebP(assets-compress.test) — 문어 · 크라켄의 1024 아틀라스는 압축기가 lanczos 로 줄인다
  return {glb, tris: G.I.length / 3, verts: n, png};
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const args = process.argv.slice(2), install = args.includes('--install'), keys = args.filter((a) => !a.startsWith('--'));
  // 2026-11-18 — 게임에 켠 건 오징어 · 대왕오징어(1차)와 문어 3모습(2차 — 그림 팔 길 · 그림 팔 띠 · 빨판 구슬로 수조 카메라에서도 옛 판만큼 풍성해졌다).
  // 크라켄 3모습은 수조 카메라에서 옛 판(그림의 빽빽한 촉수 덩어리)보다 여전히 성겨 늘 후보 폴더에만 쓴다(검수 시트 ceph-v3/review-kraken-2.webp)
  const dirOf = (key) => /kraken/.test(key) ? 'design/aqua3d-review/ceph-v3/octopus-candidates' : install ? 'public/aqua/models/fish' : octo(key) ? 'design/aqua3d-review/ceph-v3/octopus-candidates' : 'design/aqua3d-review/ceph-v3/stage';
  for (const key of keys.length ? keys : CEPH_KEYS) {
    const dir = dirOf(key); await mkdir(dir, {recursive: true});
    const {glb, tris, verts, png} = await build(key);
    if (tris > (key.startsWith('fry_') ? 3000 : 6000)) throw Error(`${key} tris ${tris}`);
    if (glb.length > 400000) throw Error(`${key} bytes ${glb.length}`);
    await writeFile(`${dir}/${key}.glb`, glb);
    if (process.env.ATLAS) await writeFile(`design/aqua3d-review/ceph-v3/stage/${key}-atlas.png`, png);
    console.log(key, tris, 'tris', verts, 'verts', glb.length, 'bytes');
  }
}
