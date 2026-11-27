// 갈라파고스 50종 에셋 · 레지스트리 · 승인 · 스키마 동기화 스크립트
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { GALAPAGOS_KEYS } from '../../../src/lib/galapagos.ts';

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// 1. Generate public/fishing/junk_lava.webp (512x512 transparent WebP)
{
  const W = 512, H = 512, buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (x - 256) / 180, ny = (y - 262) / 150;
    const ang = Math.atan2(ny, nx);
    const jag = 1 + 0.14 * Math.sin(ang * 5 + 0.7) + 0.08 * Math.cos(ang * 9 - 1.1) + 0.05 * Math.sin(ang * 13);
    const r = Math.hypot(nx, ny) / jag;
    if (r < 1) {
      const z = Math.sqrt(Math.max(0, 1 - r * r));
      const pores = Math.sin(x * 0.22 + Math.cos(y * 0.19) * 2) * Math.cos(y * 0.25);
      const light = 0.45 + 0.55 * Math.max(0, (-nx * 0.45 - ny * 0.55 + z * 0.7));
      const base = 36 + light * 48 + (pores > 0.65 ? -16 : pores < -0.7 ? 24 : 0);
      const barnacle = Math.hypot(nx + 0.28, ny + 0.15) < 0.14 || Math.hypot(nx - 0.18, ny - 0.22) < 0.11;
      const o = (y * W + x) * 4;
      buf[o] = Math.min(255, Math.max(0, Math.round(barnacle ? 210 * light : base * 1.05)));
      buf[o + 1] = Math.min(255, Math.max(0, Math.round(barnacle ? 204 * light : base * 0.98)));
      buf[o + 2] = Math.min(255, Math.max(0, Math.round(barnacle ? 190 * light : base * 0.94)));
      buf[o + 3] = Math.round(Math.min(1, (1 - r) * 18) * 255);
    }
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 90, alphaQuality: 95 }).toFile('public/fishing/junk_lava.webp');
}

// 2. Resize all 150 Galápagos sm thumbnails to 192x192 & build review sheet
const galForms = GALAPAGOS_KEYS.flatMap((k) => [k, `juv_${k}`, `fry_${k}`]);
for (const k of galForms) {
  await sharp(`public/aqua/fish/${k}.webp`).resize(192, 192, { kernel: 'lanczos3' }).webp({ quality: 86, alphaQuality: 92 }).toFile(`public/aqua/fish/sm/${k}.webp`);
}
await sharp('public/aqua/fish/galapagos_penguin.webp').resize(256, 256).webp({ quality: 85 }).toFile('design/aqua3d-review/galapagos/review.webp');

// 3. Fix aquaimages.ts (exclude boss_*)
const fishImgs = readdirSync('public/aqua/fish').filter((f) => f.endsWith('.webp') && !f.startsWith('boss_')).map((f) => f.slice(0, -5)).sort();
let aquaImgSrc = readFileSync('src/lib/aquaimages.ts', 'utf8');
aquaImgSrc = aquaImgSrc.replace(/export const FISH_IMAGE_KEYS: ReadonlySet<string> = new Set<string>\(\[[\s\S]*?\]\);/, `export const FISH_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([\n${fishImgs.map((k) => `  "${k}",`).join('\n')}\n]);`);
writeFileSync('src/lib/aquaimages.ts', aquaImgSrc);

// 4. Fix fishingimages.ts (exclude fx_*)
const fishSpotImgs = readdirSync('public/fishing').filter((f) => f.endsWith('.webp') && !f.startsWith('fx_')).map((f) => f.slice(0, -5)).sort();
let fishingImgSrc = readFileSync('src/lib/fishingimages.ts', 'utf8');
fishingImgSrc = fishingImgSrc.replace(/export const FISHING_IMAGE_KEYS: ReadonlySet<string> = new Set<string>\(\[[\s\S]*?\]\);/, `export const FISHING_IMAGE_KEYS: ReadonlySet<string> = new Set<string>([\n${fishSpotImgs.map((k) => `  "${k}",`).join('\n')}\n]);`);
writeFileSync('src/lib/fishingimages.ts', fishingImgSrc);

// 5. Register 150 Galápagos forms in style-approvals.json & model-revisions.ts
const sa = JSON.parse(readFileSync('src/lib/aqua3d/style-approvals.json', 'utf8'));
let rev = readFileSync('src/lib/aqua3d/model-revisions.ts', 'utf8');
for (const k of galForms) {
  sa.forms[k] = { sourceHash: sha(`public/aqua/fish/${k}.webp`), sheet: 'design/aqua3d-review/galapagos/review.webp' };
  const h = sha(`public/aqua/models/fish/${k}.glb`).slice(0, 12);
  const line = ` ${k}:'${h}',`;
  const re = new RegExp(`^ ${k}:'[0-9a-f]{12}',`, 'm');
  rev = re.test(rev) ? rev.replace(re, line) : rev.replace(/Object\.freeze\(\{(\r?\n)/, (m0, nl) => m0 + line + nl);
}
writeFileSync('src/lib/aqua3d/style-approvals.json', JSON.stringify(sa, null, 2) + '\n');
writeFileSync('src/lib/aqua3d/model-revisions.ts', rev);

// 6. Append migration to supabase/schema.sql if missing
const mig = readFileSync('supabase/migrations/20261127000000_fish_families_galapagos.sql', 'utf8').trim();
const schema = readFileSync('supabase/schema.sql', 'utf8');
if (!schema.includes(mig)) {
  writeFileSync('supabase/schema.sql', schema.trimEnd() + '\n\n' + mig + '\n');
}
console.log(`Synced ${galForms.length} Galápagos forms, ${fishImgs.length} fish images, ${fishSpotImgs.length} fishing images!`);
