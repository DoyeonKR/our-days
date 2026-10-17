// Visual QA: old sprite next to new artwork at actual stage size, plus enlarged detail.
import sharp, { type OverlayOptions } from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { PET_FORMS } from "../src/lib/island.ts";
import { petSprites } from "../src/lib/pixelart.ts";
import { HERO_V3_FORMS } from "../src/lib/heroassets.ts";

const output = ".qa/hero-art";
await mkdir(output, { recursive: true });
const forms = [...HERO_V3_FORMS].filter((key) => existsSync(`public/heroes/v3/${key}.webp`));
for (let page = 0; page * 12 < forms.length; page++) {
  const group = forms.slice(page * 12, (page + 1) * 12);
  const layers: OverlayOptions[] = [];
  for (const [i, key] of group.entries()) {
    const x = (i % 3) * 384, y = Math.floor(i / 3) * 204;
    const sp = petSprites(key)[0];
    const buf = Buffer.alloc(sp.w * sp.h * 4);
    for (let yy = 0; yy < sp.h; yy++) for (let xx = 0; xx < sp.w; xx++) {
      const color = sp.pal[sp.rows[yy][xx]];
      if (!color || color === "transparent") continue;
      const hex = color.replace("#", "");
      if (hex.length !== 6) throw new Error(`Unexpected palette value ${color}`);
      const at = (yy * sp.w + xx) * 4;
      buf.set([parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255], at);
    }
    layers.push({ input: await sharp(buf, { raw: { width: sp.w, height: sp.h, channels: 4 } }).resize(96, 96, { kernel: "nearest" }).png().toBuffer(), left: x + 8, top: y + 54 });
    layers.push({ input: await sharp(`public/heroes/v3/${key}.webp`).resize(112).png().toBuffer(), left: x + 110, top: y + 46 });
    layers.push({ input: await sharp(`public/heroes/v3/${key}.webp`).resize(156).png().toBuffer(), left: x + 224, top: y + 24 });
    layers.push({ input: Buffer.from(`<svg width="384" height="24"><text x="10" y="18" fill="#fff0cf" font-family="sans-serif" font-size="15">${key} · ${PET_FORMS[key]?.name ?? key}</text></svg>`), left: x, top: y });
  }
  await sharp({ create: { width: 1152, height: 816, channels: 4, background: "#201b32" } }).composite(layers).png().toFile(`${output}/comparison-${page + 1}.png`);
}
await writeFile(`${output}/index.html`, `<!doctype html><html lang="ko"><meta charset="utf-8"><title>히어로 아트 검수</title><style>body{background:#201b32;color:#fff0cf;font:16px sans-serif;margin:24px}img{max-width:100%;display:block;margin-bottom:24px}p{color:#c8bfd9}</style><h1>히어로 아트 검수 · ${forms.length}종</h1><p>각 칸: 이전 도트 / 실제 112px 표시 / 확대 디테일</p>${Array.from({ length: Math.ceil(forms.length / 12) }, (_, i) => `<img src="comparison-${i + 1}.png" alt="비교 ${i + 1}">`).join("")}</html>`);
console.log(`Reviewed ${forms.length} originals in ${output}`);
