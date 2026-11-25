// 남극 종 기준 그림(2026-11-25 [사용자: "기준이미지 없이 모델을 만드니 그렇게 허접하게 만들지 너무 다르잖아 실제 어종과"])
// 퍼블릭 도메인 기준(reference/SOURCES.md)을 바탕에서 오려 게임 그림 규칙(머리 오른쪽 · 512 투명 · 여백 22 · sm 192)으로 만든다.
// 이 그림이 곧 카드 그림이고, 3D 는 이 그림에서 잰 몸 · 입힌 무늬로 짓는다(whales/build.mjs 와 같은 길).
// node design/aqua3d-review/polar/ref-art.mjs [family...]
import sharp from 'sharp';
import {readFile, writeFile} from 'node:fs/promises';
sharp.cache(false);
const R = 'design/aqua3d-review/polar/reference/';

/** 바탕 지우기 — 테두리에서 이어진 바탕색(흰 · 검정)만 지운다(몸 안의 밝은 곳은 남는다) */
async function cutout(file, {bg = 'white', tol = 26, flop = false, crop = null, rotate = 0}) {
  let img = sharp(await readFile(R + file)); if (rotate) img = img.rotate(rotate); if (crop) img = img.extract(crop); if (flop) img = img.flop();
  const {data, info} = await img.ensureAlpha().raw().toBuffer({resolveWithObject: true}), W = info.width, H = info.height;
  // bg: white · black · auto(테두리 색의 가운데값에서 tol*3 안 — 종이 바탕 도판)
  let ref = null; if (bg === 'auto') { const px = []; for (let x = 0; x < W; x += 4) for (const y of [0, H - 1]) px.push(y * W + x); for (let y = 0; y < H; y += 4) for (const x of [0, W - 1]) px.push(y * W + x); ref = [0, 1, 2].map((c) => px.map((i) => data[i * 4 + c]).sort((p, q) => p - q)[px.length >> 1]); }
  const isBg = (i) => { const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (ref) return Math.hypot(r - ref[0], g - ref[1], b - ref[2]) < tol * 3;
    return bg === 'white' ? mn > 255 - tol * 2.2 && mx - mn < tol : mx < tol * 2.4; };
  const seen = new Uint8Array(W * H), q = new Int32Array(W * H); let a = 0, b = 0;
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (!seen[i] && isBg(i)) { seen[i] = 1; q[b++] = i; } }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (!seen[i] && isBg(i)) { seen[i] = 1; q[b++] = i; } }
  while (a < b) { const i = q[a++], x = i % W; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < W * H && !seen[j] && isBg(j)) { seen[j] = 1; q[b++] = j; } }
  // 가장 큰 덩어리만(떨어진 글자 · 눈금 · 티끌 지우기)
  const lab = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0, id = 0;
  for (let s = 0; s < W * H; s++) { if (seen[s] || lab[s] >= 0) continue; let n = 0; a = 0; b = 0; q[b++] = s; lab[s] = id;
    while (a < b) { const i = q[a++], x = i % W; n++; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < W * H && !seen[j] && lab[j] < 0) { lab[j] = id; q[b++] = j; } }
    if (n > bestN) { bestN = n; best = id; } id++; }
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = lab[i] === best ? 255 : 0;
  // 가장자리 1px 부드럽게
  const al = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) al[i] = data[i * 4 + 3];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!al[i]) continue; let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += al[i + dy * W + dx]; data[i * 4 + 3] = Math.round(s / 9); }
  return {data, W, H};
}
/** 색 바꾸기 — 흑백 도판(빙어)을 실제 몸빛으로: 밝기 L 을 어두운 색 → 밝은 색 사이에 놓는다 */
function tone(img, dark, light, gamma = 1) { const {data, W, H} = img; for (let i = 0; i < W * H; i++) { const L = ((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 765) ** gamma; for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(dark[c] + (light[c] - dark[c]) * L); } return img; }
/** 새끼 · 어린 — 옅게(새끼는 더) */
function lighten(img, k, to = [236, 232, 224]) { const {data, W, H} = img; for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(data[i * 4 + c] * (1 - k) + to[c] * k); return img; }
async function save(key, {data, W, H}) {
  const png = await sharp(data, {raw: {width: W, height: H, channels: 4}}).png().toBuffer(), trimmed = await sharp(png).trim({threshold: 1}).png().toBuffer();
  const fit = async (S, pad) => { const inner = await sharp(trimmed).resize(S - pad * 2, S - pad * 2, {fit: 'inside'}).png().toBuffer(); return sharp({create: {width: S, height: S, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).composite([{input: inner, gravity: 'center'}]).webp({quality: 92, alphaQuality: 100}).toBuffer(); };
  await writeFile(`public/aqua/fish/${key}.webp`, await fit(512, 22)); await writeFile(`public/aqua/fish/sm/${key}.webp`, await fit(192, 0)); console.log(key);
}
const clone = ({data, W, H}) => ({data: Buffer.from(data), W, H});

/** 위에서 본 그림(머리 위쪽) — crab-build 가 부풀린다(design/aqua3d-review/polar/model-art/<key>-top.png) */
async function saveTop(key, {data, W, H}, rot) { const {mkdir} = await import('node:fs/promises'); await mkdir('design/aqua3d-review/polar/model-art', {recursive: true});
  let img = sharp(await sharp(data, {raw: {width: W, height: H, channels: 4}}).png().toBuffer()).trim({threshold: 1}); if (rot) img = sharp(await img.png().toBuffer()).rotate(rot, {background: {r: 0, g: 0, b: 0, alpha: 0}});
  const b = await img.resize(480, 480, {fit: 'inside'}).png().toBuffer(); await writeFile(`design/aqua3d-review/polar/model-art/${key}-top.png`, await sharp({create: {width: 512, height: 512, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).composite([{input: b, gravity: 'center'}]).png().toBuffer()); console.log('top', key); }
export const ART = {
  // 이빨고기(메로) — FDA Regulatory Fish Encyclopedia 사진(PD-USGov, 흰 바탕 옆모습 · 머리 오른쪽)
  async toothfish() { const a = await cutout('toothfish.jpg', {bg: 'white', tol: 22}); await save('toothfish', a); await save('juv_toothfish', lighten(clone(a), .12, [190, 180, 168])); await save('fry_toothfish', lighten(clone(a), .3, [200, 186, 166])); },
  // 클리오네 — NOAA NMFS AFSC 사진 "Sea angel"(Matt Wilson · Jay Clark, 퍼블릭 도메인). 위에서 본 모습 · 머리 왼쪽 · 검은 바탕 → 카드는 머리 오른쪽, 3D 는 머리 위쪽으로 돌려 부풀린다
  async clione() { const a = await cutout('clione-sea-angel.jpg', {bg: 'black', tol: 16, flop: true});
    // 검은 바탕이 비쳐 어두운 반투명 몸 · 날개 — 실제처럼 맑은 물빛으로 띄운다(밝기가 낮을수록 더)
    for (let i = 0; i < a.W * a.H; i++) { const L = (a.data[i * 4] + a.data[i * 4 + 1] + a.data[i * 4 + 2]) / 3, k = Math.max(0, 1 - L / 150) * .85; for (let c = 0; c < 3; c++) a.data[i * 4 + c] = Math.round(a.data[i * 4 + c] * (1 - k) + [196, 214, 226][c] * k); } for (const [k, t] of [['clione', 0], ['juv_clione', .08], ['fry_clione', .18]]) { const c = lighten(clone(a), t, [230, 236, 240]); await save(k, clone(c)); await saveTop(k, c, -90); } },
  // 남극 대왕등각류 — William Speirs Bruce 의 스코샤 탐험 사진(퍼블릭 도메인, 종이 바탕 · 위에서 본 모습 · 머리 위쪽)
  async giant_isopod() { const a = await cutout('isopod-bruce.jpg', {bg: 'auto', tol: 14}); const warm = (img, k) => { const {data, W, H} = img; for (let i = 0; i < W * H; i++) { const L = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3; const c = [L * 1.08 + 10, L * .92 + 4, L * .74]; for (let q = 0; q < 3; q++) data[i * 4 + q] = Math.max(0, Math.min(255, Math.round(c[q] * (1 - k) + [226, 206, 176][q] * k))); } return img; };
    for (const [k, t] of [['giant_isopod', 0], ['juv_giant_isopod', .14], ['fry_giant_isopod', .3]]) { const c = warm(clone(a), t); await saveTop(k, clone(c), 0); const r = await sharp(await sharp(c.data, {raw: {width: c.W, height: c.H, channels: 4}}).png().toBuffer()).rotate(90, {background: {r: 0, g: 0, b: 0, alpha: 0}}).ensureAlpha().raw().toBuffer({resolveWithObject: true}); await save(k, {data: r.data, W: r.info.width, H: r.info.height}); } },
  // 남극성게 — 스미스소니언 표본 사진(USNM E21812, CC0 · 검은 바탕 옆모습). 글자 · 자 눈금은 가장 큰 덩어리만 남겨 지운다
  async antarctic_urchin() { const a = await cutout('urchin-usnm1.jpg', {bg: 'black', tol: 20}); const {mkdir} = await import('node:fs/promises'); await mkdir('design/aqua3d-review/polar/model-art', {recursive: true});
    await writeFile('design/aqua3d-review/polar/model-art/antarctic_urchin-side.png', await sharp(await sharp(a.data, {raw: {width: a.W, height: a.H, channels: 4}}).png().toBuffer()).trim({threshold: 1}).png().toBuffer());
    await save('antarctic_urchin', clone(a)); await save('juv_antarctic_urchin', lighten(clone(a), .1, [214, 160, 120])); await save('fry_antarctic_urchin', lighten(clone(a), .25, [226, 190, 160])); },
  // 바다돼지 — Lindberg 의 Scotoplanes 도판(퍼블릭 도메인, 흰 바탕 흑백 옆모습 · 입 촉수가 오른쪽 = 머리 오른쪽). 살아 있는 몸빛(분홍 · 반투명)으로 칠한다
  async sea_pig() { const base = await cutout('seapig-lindberg.jpg', {bg: 'white', tol: 16}); const {mkdir} = await import('node:fs/promises'); await mkdir('design/aqua3d-review/polar/model-art', {recursive: true});
    const c = (k) => lighten(tone(clone(base), [120, 52, 70], [250, 214, 216], .75), k, [252, 228, 226]);
    const a0 = c(0); await writeFile('design/aqua3d-review/polar/model-art/sea_pig-side.png', await sharp(await sharp(a0.data, {raw: {width: a0.W, height: a0.H, channels: 4}}).png().toBuffer()).trim({threshold: 1}).png().toBuffer());
    await save('sea_pig', a0); await save('juv_sea_pig', c(.1)); await save('fry_sea_pig', c(.22)); },
  // 살프 — 사슬 사진은 퍼블릭 도메인으로 찾지 못했다. 낱개 개체 도판(Salpa maxima, Bevalet 그림 · 퍼블릭 도메인)의 몸 윤곽 · 근육 띠 · 핵을 쓰고 사슬은 3D 에서 잇는다.
  //   도판 아래 글자(Fig. 126 …)는 잘라 낸다. 투명한 물빛(근육 띠는 흰빛, 핵은 주황갈)으로 칠한다
  async salp() { const m = await sharp(R + 'salp-maxima.jpg').metadata(); const base = await cutout('salp-maxima.jpg', {bg: 'auto', tol: 12, crop: {left: 0, top: 0, width: m.width, height: Math.round(m.height * .8)}}); const {mkdir} = await import('node:fs/promises'); await mkdir('design/aqua3d-review/polar/model-art', {recursive: true});
    const a0 = tone(clone(base), [70, 96, 120], [214, 232, 240], 1.2); { const {data, W, H} = a0; const x0 = W * .78; for (let y = 0; y < H; y++) for (let x = Math.floor(x0); x < W; x++) { const i = y * W + x; const L = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3; if (L < 150) { data[i * 4] = 190; data[i * 4 + 1] = 104; data[i * 4 + 2] = 46; } } }
    await writeFile('design/aqua3d-review/polar/model-art/salp-side.png', await sharp(await sharp(a0.data, {raw: {width: a0.W, height: a0.H, channels: 4}}).png().toBuffer()).trim({threshold: 1}).png().toBuffer()); console.log('salp model-art'); },
  // 남극빙어 — Searle 도판(퍼블릭 도메인, 흰 바탕 흑백 · 머리 왼쪽 → 뒤집는다). 피가 투명한 흰 몸 · 짙은 지느러미 결
  async icefish() { const base = await cutout('icefish-searle.jpg', {bg: 'white', tol: 18, flop: true}); const c = (k) => lighten(tone(clone(base), [34, 40, 46], [226, 234, 236], .8), k, [240, 244, 244]); await save('icefish', c(0));
    // 카드도 3D 도 꼬리를 곧게 편 그림으로(아래 icefishModelArt) — 새끼 · 어린 것은 그 그림을 옅게
    await icefishModelArt(); const st = await sharp('design/aqua3d-review/polar/model-art/icefish.webp').ensureAlpha().raw().toBuffer({resolveWithObject: true}), sa = {data: st.data, W: st.info.width, H: st.info.height};
    await save('icefish', clone(sa)); await save('juv_icefish', lighten(clone(sa), .12, [240, 244, 244])); await save('fry_icefish', lighten(clone(sa), .28, [240, 244, 244])); },
};
// 3D 용 그림 — 도판의 빙어는 꼬리가 아래로 휘어 말려 있어(죽은 표본) 몸통 관을 열마다 잴 수 없다. 카드 그림은 도판 그대로 두고,
//   3D 만 꼬리를 곧게 편 그림(model-art/icefish.webp)으로 짓는다: 몸 · 등 · 뒷지느러미는 그대로(x ≥ 52), 휜 꼬리자루는 몸 끝 열의 결로 곧게 이어 붙이고,
//   꼬리지느러미(도판에서 오른쪽 아래로 펼친 부채)는 잘라 좌우로 뒤집어 그 끝에 붙인다. 좌표는 512 카드 그림 기준(눈으로 잰 값)
export async function icefishModelArt(src = 'public/aqua/fish/icefish.webp', out = 'design/aqua3d-review/polar/model-art/icefish.webp') {
  const {data: d} = await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject: true}), S = 512, OX = 120, OW = 700;
  const o = Buffer.alloc(OW * S * 4), put = (x, y, r, g, b, a) => { if (x < 0 || y < 0 || x >= OW || y >= S || a <= 0) return; const k = (y * OW + x) * 4; if (o[k + 3] >= a) return; o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = a; };
  for (let y = 0; y < S; y++) for (let x = 52; x < S; x++) { if (y > 300 || (x < 78 && y > 262)) continue; const k = (y * S + x) * 4; put(x + OX, y, d[k], d[k + 1], d[k + 2], d[k + 3]); }
  // 꼬리자루: 몸 끝(x 58) 의 위 · 아래 가장자리를 재서 왼쪽으로 가늘어지게, 결은 x 60~74 열을 세로로 줄여 쓴다
  const top = 207, bot = 259; // x 58 의 몸 위 · 아래 가장자리(등 · 뒷지느러미 줄기는 빼고 — 눈으로 잰 값)
  const L = 46, cy0 = (top + bot) / 2;
  for (let i = 0; i <= L; i++) { const x = 52 + OX - i, t = i / L, h = (bot - top) / 2 * (1 - .52 * t), cy = cy0 + 2 * t, sx = 60 + (i % 15);
    for (let y = Math.round(cy - h); y <= Math.round(cy + h); y++) { const v = (y - cy) / h, sy = Math.round(cy0 + v * (bot - top) / 2), k = (sy * S + sx) * 4; put(x, y, d[k], d[k + 1], d[k + 2], 255); } }
  // 꼬리지느러미 — 도판의 부채(x 80~166, y 312~410)를 뒤집고 기울기를 펴서 꼬리자루 끝에
  const fan = await sharp(src).extract({left: 82, top: 310, width: 86, height: 102}).flop().rotate(-24, {background: {r: 0, g: 0, b: 0, alpha: 0}}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const fw = fan.info.width, fh = fan.info.height, ax = 52 + OX - L + 4, ay = Math.round(cy0 + 2);
  let fr = 0; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (fan.data[(y * fw + x) * 4 + 3] > 100) fr = Math.max(fr, x);
  let fy0 = fh, fy1 = 0; for (let y = 0; y < fh; y++) for (let x = fr - 10; x <= fr; x++) if (fan.data[(y * fw + x) * 4 + 3] > 100) { fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
  const fmid = (fy0 + fy1) / 2;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const k = (y * fw + x) * 4; put(ax - fr + x, Math.round(ay - fmid + y), fan.data[k], fan.data[k + 1], fan.data[k + 2], fan.data[k + 3]); }
  const {mkdir} = await import('node:fs/promises'); await mkdir('design/aqua3d-review/polar/model-art', {recursive: true});
  const trimmed = await sharp(o, {raw: {width: OW, height: S, channels: 4}}).png().toBuffer().then((b) => sharp(b).trim({threshold: 1}).png().toBuffer());
  const inner = await sharp(trimmed).resize(468, 468, {fit: 'inside'}).png().toBuffer();
  await writeFile(out, await sharp({create: {width: 512, height: 512, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).composite([{input: inner, gravity: 'center'}]).webp({quality: 92, alphaQuality: 100}).toBuffer());
  console.log('model-art', out);
}
if (process.argv.includes('--icefish-model')) { await icefishModelArt(); process.exit(0); }
for (const f of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ART)) await ART[f]();
