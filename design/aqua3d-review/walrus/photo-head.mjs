// 바다코끼리 원화 2판(2026-11-24 [사용자: "바다코끼리 가 너무너무 허접해 정말 실사이미지랑 너무 다르고 대가리 디테일이 너무 떨어져"])
// 머리 · 목은 USFWS 사진(퍼블릭 도메인 — Joel Garlich-Miller, "Pacific Walrus - Bull", 위키미디어 커먼즈 8247646168)에서 오려 붙인다.
// make-art.mjs 가 만든 몸(물범 바탕을 부풀린 몸)의 앞쪽을 걷어 내고, 사진 머리를 뒤집어(머리 오른쪽) 헤엄 각도로 돌려 이어 붙인다.
// 몸통 색은 사진 피부색 평균에 맞춘다. 엄니 자리(상아색)는 walrus/<key>-tusk.png 로 남겨 3D 빌더가 원뿔로 짓는다.
// 어린 개체는 엄니 아래쪽을 잘라 짧게, 새끼는 엄니를 지운다(지운 자리는 주변 피부로 채운다).
// node design/aqua3d-review/walrus/photo-head.mjs  (make-art.mjs 다음에)
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
sharp.cache(false);
const SRC = 'design/aqua3d-review/walrus/reference/usfws-pacific-walrus-bull.jpg';
const S = 512;
const STAGES = [
  { key: 'walrus', tusk: 1, gray: 0, headH: 1.55 },
  { key: 'juv_walrus', tusk: .45, gray: .05, headH: 1.5 },
  { key: 'fry_walrus', tusk: 0, gray: .25, headH: 1.25 },
];
const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

// 1) 사진에서 머리 · 목만 오린다(하늘 · 얼음은 푸르거나 흰 무채색, 바다코끼리는 붉은 갈색 · 엄니는 따뜻한 상아색)
const meta = await sharp(SRC).metadata();
const R = { left: Math.round(meta.width * .3), top: Math.round(meta.height * .1), width: Math.round(meta.width * .52), height: Math.round(meta.height * .62) };
const { data: ph, info: pi } = await sharp(SRC).extract(R).flop().raw().toBuffer({ resolveWithObject: true });
// 엄니 두 개의 뿌리 → 끝(뒤집은 자른 판의 비율 좌표, 눈으로 잡았다)
const TUSKS = [[.56, .37, .45, .69], [.655, .41, .515, .73]];
const PW = pi.width, PH = pi.height, cut = Buffer.alloc(PW * PH * 4), ivory = new Uint8Array(PW * PH);
let mr = 0, mg = 0, mb = 0, mn = 0;
for (let i = 0; i < PW * PH; i++) {
  const r = ph[i * 3], g = ph[i * 3 + 1], b = ph[i * 3 + 2], d = r - b;
  // 배경(하늘 · 얼음)은 밝고 푸르거나 무채색 — 바다코끼리는 어둡거나(그늘진 피부) 붉다. 엄니는 밝지만 따뜻하다
  const lum = .3 * r + .59 * g + .11 * b;
  const a = sm(-6, 2, d) * Math.max(sm(185, 160, lum), sm(8, 18, d));
  cut[i * 4] = r; cut[i * 4 + 1] = g; cut[i * 4 + 2] = b; cut[i * 4 + 3] = Math.round(a * 255);
  // 엄니 — 이 사진의 두 엄니가 지나는 길(뒤집은 자른 판 기준 비율 좌표) 안의 밝고 채도 낮은 픽셀
  const x = i % PW, y = (i - x) / PW, u = x / PW, v = y / PH, mx = Math.max(r, g, b) - Math.min(r, g, b);
  const inTusk = TUSKS.some(([x0, y0, x1, y1]) => { const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((u - x0) * dx + (v - y0) * dy) / (dx * dx + dy * dy))); return Math.hypot(u - x0 - t * dx, (v - y0 - t * dy) * PH / PW) < .038; });
  if (inTusk && lum > 95 && mx < 75) ivory[i] = 1;
  else if (a > .9 && lum < 150) { mr += r; mg += g; mb += b; mn++; }
}
// 가장 큰 덩어리만(멀리 있는 다른 바다코끼리 · 얼음 반점 제외) — 덩어리를 세어 작은 섬은 지운다
{ const lab = new Int32Array(PW * PH).fill(-1), sizes = []; let id = 0; const st = [];
  for (let i = 0; i < PW * PH; i++) { if (cut[i * 4 + 3] < 128 || lab[i] >= 0) continue; let n = 0; st.push(i); lab[i] = id; while (st.length) { const j = st.pop(); n++; const x = j % PW; for (const k of [j - PW, j + PW, x ? j - 1 : -1, x < PW - 1 ? j + 1 : -1]) if (k >= 0 && k < PW * PH && lab[k] < 0 && cut[k * 4 + 3] >= 128) { lab[k] = id; st.push(k); } } sizes.push(n); id++; }
  const big = sizes.indexOf(Math.max(...sizes)); for (let i = 0; i < PW * PH; i++) if (lab[i] !== big && cut[i * 4 + 3] >= 128) cut[i * 4 + 3] = 0; }
// 머리 · 목만 — 오른쪽 아래(사진 속 몸 뒤쪽 · 얼음과 섞인 그늘)는 부드럽게 잘라 낸다. 엄니는 불투명하게
for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x, u = x / PW, v = y / PH;
  const keep = 1 - sm(.0, .06, (u - .7) + (v - .55)) ; cut[i * 4 + 3] = Math.round(cut[i * 4 + 3] * keep); if (ivory[i] && keep > .5) cut[i * 4 + 3] = 255; }
// 작은 구멍(피부의 밝은 반점 · 그늘) 메우기 — 바깥에서 닿지 않는 1500픽셀 미만의 투명 덩어리
{ const lab = new Int32Array(PW * PH).fill(-1), st = []; let id = 0;
  for (let i = 0; i < PW * PH; i++) { if (cut[i * 4 + 3] >= 128 || lab[i] >= 0) continue; const mem = []; let edge = false; st.push(i); lab[i] = id; while (st.length) { const j = st.pop(); mem.push(j); const x = j % PW, y = (j - x) / PW; if (!x || !y || x === PW - 1 || y === PH - 1) edge = true; for (const k of [j - PW, j + PW, x ? j - 1 : -1, x < PW - 1 ? j + 1 : -1]) if (k >= 0 && k < PW * PH && lab[k] < 0 && cut[k * 4 + 3] < 128) { lab[k] = id; st.push(k); } }
    if (!edge && mem.length < 1500) for (const j of mem) cut[j * 4 + 3] = 255; id++; } }
{ const dbg = Buffer.from(cut); for (let i = 0; i < PW * PH; i++) if (ivory[i]) { dbg[i * 4] = 255; dbg[i * 4 + 1] = 0; dbg[i * 4 + 2] = 0; } await sharp(dbg, { raw: { width: PW, height: PH, channels: 4 } }).flatten({ background: '#40c040' }).png().toFile(process.env.TEMP + '/walrus/cut.png'); }
const skin = [mr / mn, mg / mn, mb / mn];
console.log('photo', PW, PH, 'skin', skin.map(v => v.toFixed(0)).join(','));

for (const st of STAGES) {
  // 2) 엄니 길이 — 엄니 픽셀 중 뿌리(가장 위)에서 아래로 st.tusk 만큼만 남기고, 나머지는 주변 피부로 메운다
  const img = Buffer.from(cut), tmask = new Uint8Array(PW * PH);
  let ty0 = PH, ty1 = 0; for (let i = 0; i < PW * PH; i++) if (ivory[i]) { const y = Math.floor(i / PW); ty0 = Math.min(ty0, y); ty1 = Math.max(ty1, y); }
  const keepY = ty0 + (ty1 - ty0) * st.tusk;
  const fill = [];
  for (let i = 0; i < PW * PH; i++) if (ivory[i]) { const y = Math.floor(i / PW); if (y <= keepY) tmask[i] = 1; else fill.push(i); }
  // 메우기: 엄니 아래쪽 자리는 가장 가까운 피부(왼쪽 · 오른쪽 같은 줄)로, 하늘 쪽이면 투명
  // 메우기: 엄니 옆(엄니 폭의 두 배쯤 왼쪽, 없으면 오른쪽)의 주름진 피부를 통째로 옮겨 온다 — 한 점을 늘이면 줄무늬가 진다
  const off = Math.round(PW * .075);
  for (const i of fill) { const y = Math.floor(i / PW), x = i % PW; let src = -1;
    for (const dx of [-off, off, -off * 1.6, off * 1.6]) { const xx = Math.round(x + dx); if (xx >= 0 && xx < PW) { const j = y * PW + xx; if (!ivory[j] && cut[j * 4 + 3] > 200) { src = j; break; } } }
    if (src < 0) img[i * 4 + 3] = 0; else for (let c = 0; c < 4; c++) img[i * 4 + c] = cut[src * 4 + c]; }
  // 회색 기(새끼는 옅고 회갈색)
  if (st.gray) for (let i = 0; i < PW * PH; i++) { const l = (img[i * 4] * .3 + img[i * 4 + 1] * .59 + img[i * 4 + 2] * .11); for (let c = 0; c < 3; c++) img[i * 4 + c] = img[i * 4 + c] * (1 - st.gray) + (l * 1.08) * st.gray; }
  // 3) 헤엄 각도로 — 뒤집은 사진은 주둥이가 오른쪽 위를 본다. 시계 방향으로 돌려 앞을 보게
  const ANG = 20;
  const rot = await sharp(img, { raw: { width: PW, height: PH, channels: 4 } }).rotate(ANG, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer({ resolveWithObject: true });
  const tm4 = Buffer.alloc(PW * PH * 4); for (let i = 0; i < PW * PH; i++) tm4[i * 4 + 3] = tmask[i] * 255;
  const trot = await sharp(tm4, { raw: { width: PW, height: PH, channels: 4 } }).rotate(ANG, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer();
  const RW = rot.info.width, RH = rot.info.height, rd = rot.data;
  let bx0 = RW, bx1 = 0, by0 = RH, by1 = 0; for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) if (rd[(y * RW + x) * 4 + 3] > 128) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }

  // 4) 몸(make-art 결과) 읽기 · 몸 높이 · 중심선
  const { data: bd } = await sharp(`public/aqua/fish/${st.key}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const top = new Float32Array(S).fill(NaN), bot = new Float32Array(S).fill(NaN);
  for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) if (bd[(y * S + x) * 4 + 3] > 100) { if (isNaN(top[x])) top[x] = y; bot[x] = y; }
  let front = 0, back = S; for (let x = 0; x < S; x++) if (!isNaN(top[x])) { front = Math.max(front, x); back = Math.min(back, x); }
  const L = front - back, seam = Math.round(back + L * .58), seamH = bot[seam] - top[seam], seamC = (top[seam] + bot[seam]) / 2;
  // 머리 크기: 사진 머리(목 포함) 높이를 목 이음 높이의 headH 배
  const sc = seamH * st.headH / (by1 - by0);
  const hw = Math.round((bx1 - bx0) * sc), hh = Math.round((by1 - by0) * sc);
  const head = await sharp(rd, { raw: { width: RW, height: RH, channels: 4 } }).extract({ left: bx0, top: by0, width: bx1 - bx0 + 1, height: by1 - by0 + 1 }).resize(hw, hh).raw().toBuffer();
  const headT = await sharp(trot, { raw: { width: RW, height: RH, channels: 4 } }).extract({ left: bx0, top: by0, width: bx1 - bx0 + 1, height: by1 - by0 + 1 }).resize(hw, hh).raw().toBuffer();
  // 자리: 머리 오른쪽 끝 = 원래 몸 앞끝 + 조금, 세로는 목 이음 중심에 머리 아래 3분의 2 가 오게
  const ox = Math.round(Math.min(S - 8 - hw, front + 6 - hw)), oy = Math.round(seamC - hh * .52);
  // 5) 몸 색을 사진 피부에 맞춘다(밝기 비율 유지)
  const out = Buffer.from(bd);
  let br = 0, bg = 0, bb = 0, bn = 0; for (let i = 0; i < S * S; i++) if (bd[i * 4 + 3] > 200) { br += bd[i * 4]; bg += bd[i * 4 + 1]; bb += bd[i * 4 + 2]; bn++; }
  const tgt = st.gray ? skin.map(v => v * (1 - st.gray) + ((skin[0] * .3 + skin[1] * .59 + skin[2] * .11) * 1.08) * st.gray) : skin;
  const k = [tgt[0] / (br / bn), tgt[1] / (bg / bn), tgt[2] / (bb / bn)];
  for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.min(255, out[i * 4 + c] * k[c]);
  // 6) 이음 — 몸은 이음 앞으로 흐려지고(머리가 덮는 곳만 지운다), 머리는 왼쪽 가장자리에서 서서히 나타난다
  const fadeL = ox + hw * .08, fadeR = ox + hw * .34;
  const tusk = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4, hx = x - ox, hy = y - oy;
    let ha = 0, hc = [0, 0, 0], ht = 0;
    if (hx >= 0 && hy >= 0 && hx < hw && hy < hh) { const j = (hy * hw + hx) * 4; ha = head[j + 3] / 255; hc = [head[j], head[j + 1], head[j + 2]]; ht = headT[j + 3]; }
    const w = ha * sm(fadeL, fadeR, x);
    const ba = out[o + 3] / 255 * (x > fadeR + hw * .1 ? 0 : 1);
    const a = Math.max(ba * (1 - w), w) ;
    if (a <= 0) { out[o + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) out[o + c] = (out[o + c] * ba * (1 - w) + hc[c] * w) / Math.max(1e-3, ba * (1 - w) + w);
    out[o + 3] = Math.round(Math.min(1, ba * (1 - w) + w) * 255);
    if (ht > 128 && w > .5) tusk[y * S + x] = 1;
  }
  await writeFile(`public/aqua/fish/${st.key}.webp`, await sharp(out, { raw: { width: S, height: S, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  const tm = Buffer.alloc(S * S * 4); for (let i = 0; i < S * S; i++) if (tusk[i]) { tm[i * 4] = tm[i * 4 + 1] = tm[i * 4 + 2] = tm[i * 4 + 3] = 255; }
  await sharp(tm, { raw: { width: S, height: S, channels: 4 } }).png().toFile(`design/aqua3d-review/walrus/${st.key}-tusk.png`);
  console.log(st.key, 'head', hw, hh, 'at', ox, oy, 'seam', seam);
}
