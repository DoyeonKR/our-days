// 황제펭귄 원화 2판(2026-11-24) — make-art.mjs 의 황제펭귄 그림(모양 · 무늬) 위에 헤엄치는 펭귄 실사 사진의 깃털 결을 얹는다.
// 사진: 퍼블릭 도메인 — Tor-Egil Farestveit, "Penguin under water.jpg"(위키미디어 커먼즈, 젠투펭귄). 사진의 무늬 · 색은 쓰지 않고
// 밝기의 잔결(사진 − 흐린 사진)만 펭귄 몸 상자에 맞춰 늘려 더한다 — 그래서 무늬는 황제펭귄, 깃털 결 · 거품 같은 반짝임은 실사다.
// node design/aqua3d-review/penguin/make-art.mjs && node design/aqua3d-review/penguin/photo-penguin.mjs
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
sharp.cache(false);
const SRC = 'design/aqua3d-review/penguin/reference/penguin-under-water.jpg';
const S = 512;
// 사진 속 펭귄 몸 상자(가로 800 으로 본 값 — 부리 끝 ~ 꼬리, 거품 · 발 제외)
const BOX = { u0: 95, u1: 700, v0: 222, v1: 405 };
const meta = await sharp(SRC).metadata(), K = meta.width / 800;
const crop = { left: Math.round(BOX.u0 * K), top: Math.round(BOX.v0 * K), width: Math.round((BOX.u1 - BOX.u0) * K), height: Math.round((BOX.v1 - BOX.v0) * K) };
const gray = sharp(SRC).extract(crop).flop().greyscale();
const g0 = await gray.clone().raw().toBuffer({ resolveWithObject: true });
const gb = await sharp(SRC).extract(crop).flop().greyscale().blur(1.6).raw().toBuffer();

for (const [key, amt] of [['emperor_penguin', 1], ['juv_emperor_penguin', .9], ['fry_emperor_penguin', .55]]) {
  const { data: d, info } = await sharp(`public/aqua/fish/${key}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = S, x1 = 0, y0 = S, y1 = 0; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const W = g0.info.width, H = g0.info.height;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = (y * S + x) * 4; if (d[o + 3] < 10) continue;
    const sx = Math.min(W - 1, Math.round((x - x0) / (x1 - x0) * (W - 1))), sy = Math.min(H - 1, Math.round((y - y0) / (y1 - y0) * (H - 1)));
    const hi = Math.max(-16, Math.min(16, (g0.data[sy * W + sx] - gb[sy * W + sx]) * 1.6)) * amt;
    // 어두운 깃털엔 결이 덜 보이고 흰 배엔 더 보인다 — 밝기에 맞춰 세기를 조금 줄인다
    const l = (d[o] + d[o + 1] + d[o + 2]) / 3, k = .55 + .45 * (l / 255);
    for (let c = 0; c < 3; c++) d[o + c] = Math.max(0, Math.min(255, d[o + c] + hi * k));
  }
  await writeFile(`public/aqua/fish/${key}.webp`, await sharp(d, { raw: { width: S, height: S, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  console.log(key, 'detail', info.width);
}
