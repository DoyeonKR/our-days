// 모델을 찍은 카드 그림(card-<key>.png, ceph-v3/review.html?card=) → 게임 그림(public/aqua/fish 512 · sm 192). 2026-11-25 남극 10종
// 투명 바탕을 잘라 내고 가로 468(512 안 여백 22)에 맞춰 가운데, sm 은 가로 192 꽉.
// node design/aqua3d-review/polar/cards-to-art.mjs key...
import sharp from 'sharp';
import {readFile, writeFile, rename} from 'node:fs/promises';
sharp.cache(false);
for (const key of process.argv.slice(2)) {
  const src = `design/aqua3d-review/polar/cards/card-${key}.png`;
  try { await rename(`design/aqua3d-review/ceph-v3/card-${key}.png`, src); } catch {}
  const trimmed = await sharp(await readFile(src)).trim({threshold: 1}).png().toBuffer();
  const fit = async (W, H, pad) => { const inner = await sharp(trimmed).resize(W - pad * 2, H - pad * 2, {fit: 'inside'}).png().toBuffer(); return sharp({create: {width: W, height: H, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}}).composite([{input: inner, gravity: 'center'}]).webp({quality: 90, alphaQuality: 100}).toBuffer(); };
  await writeFile(`public/aqua/fish/${key}.webp`, await fit(512, 512, 22));
  await writeFile(`public/aqua/fish/sm/${key}.webp`, await fit(192, 192, 0));
  console.log(key);
}
