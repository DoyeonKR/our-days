// Validate shipped fishing art and render a compact review sheet.
import fs from "node:fs";
import sharp from "sharp";
import { SPOTS, GEAR, BAIT_ART, JUNK_ART } from "../../scripts/fishing-art.mjs";

const entries = [...SPOTS, ...GEAR, ...BAIT_ART, ...JUNK_ART];
const report = [];
for (const [key] of entries) {
  const file = `public/fishing/${key}.webp`;
  const meta = await sharp(file).metadata();
  const background = key.startsWith("spot_");
  if (meta.width !== (background ? 1024 : 512) || meta.height !== (background ? 1280 : 512)) throw Error(`${key}: dimensions`);
  if (!background) {
    if (!meta.hasAlpha) throw Error(`${key}: missing alpha`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
      if (data[(y * info.width + x) * info.channels + 3] !== 0) throw Error(`${key}: opaque corner`);
    }
  }
  report.push({ key, width: meta.width, height: meta.height, alpha: meta.hasAlpha, bytes: fs.statSync(file).size });
}
const items = [...BAIT_ART, ...JUNK_ART];
const tile = 210, columns = 6, rows = Math.ceil(items.length / columns);
const layers = [];
for (let i = 0; i < items.length; i++) {
  const [key] = items[i];
  const x = (i % columns) * tile, y = Math.floor(i / columns) * tile;
  layers.push({ input: await sharp(`public/fishing/${key}.webp`).resize(170, 170).png().toBuffer(), left: x + 20, top: y + 6 });
  const label = `<svg width="210" height="30"><text x="105" y="20" text-anchor="middle" font-family="Arial" font-size="14" fill="#e2e8f0">${key}</text></svg>`;
  layers.push({ input: Buffer.from(label), left: x, top: y + 176 });
}
fs.mkdirSync("design/fishing-review", { recursive: true });
await sharp({ create: { width: columns * tile, height: rows * tile, channels: 4, background: "#25334a" } }).composite(layers).webp({ quality: 90 }).toFile("design/fishing-review/new-items.webp");
fs.writeFileSync("design/fishing-review/assets.json", JSON.stringify({ assets: report, count: report.length }, null, 2) + "\n");
fs.writeFileSync("design/fishing-review/prompts.json", JSON.stringify({ mode: "built-in image_gen", style: "Premium hand-painted 2D mobile game item icon; upper-left light; readable at 52px; diagonal, isolated, 10% padding; genuine transparency; no text, border, hands, scenery, watermark or CGI.", subjects: items.map(([key, name, subject]) => ({ key, name, subject })) }, null, 2) + "\n");
console.log(`Validated ${report.length} fishing assets; review sheet contains ${items.length} new items.`);
