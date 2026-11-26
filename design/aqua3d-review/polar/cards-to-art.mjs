// 카드(모델을 찍은 1024 PNG, polar/cards/card-<key>.png) → 도감 · 낚시 그림(public/aqua/fish 512 · sm 192) (2026-11-26)
// 그다음 할 일: node scripts/aqua-model-profiles.mjs(수조 겉 그림 · profiles.json) → node design/aqua3d-review/polar/sync-hashes.mjs <key...>
// node design/aqua3d-review/polar/cards-to-art.mjs <key...>
import sharp from 'sharp';
const keys = process.argv.slice(2);
if (!keys.length) throw Error('key 를 주세요');
for (const k of keys) {
  const src = `design/aqua3d-review/polar/cards/card-${k}.png`;
  await sharp(src).resize(512, 512, {kernel: 'lanczos3'}).webp({quality: 90, alphaQuality: 95}).toFile(`public/aqua/fish/${k}.webp`);
  await sharp(src).resize(192, 192, {kernel: 'lanczos3'}).webp({quality: 90, alphaQuality: 95}).toFile(`public/aqua/fish/sm/${k}.webp`);
  console.log(k);
}
