// Bake geometric sampling metadata only. Original images are never changed.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { FISH_IMAGE_KEYS } from "../src/lib/aquaimages.ts";
import { writeApproved } from "./aqua-approved.mjs";

const profiles = {};
await mkdir("public/aqua/skin", { recursive: true });
for (const key of [...FISH_IMAGE_KEYS].sort()) {
  const grid = /jelly|dragonfish|imugi/.test(key) ? 144 : /angel|betta|astral|genesis/.test(key) ? 128 : 96;
  const original = await readFile(`public/aqua/fish/${key}.webp`);
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Bake an opaque UV texture by extending nearest opaque source colors. The
  // geometry owns the silhouette; transparent cutout pixels must not punch
  // holes through the side walls of a solid 3D body. UI originals stay untouched.
  const skin = new Uint8Array(data), seen = new Uint8Array(info.width * info.height);
  const queue = new Int32Array(seen.length); let head = 0, tail = 0;
  for (let i = 0; i < seen.length; i++) if (data[i * 4 + 3] >= 128) { queue[tail++] = i; seen[i] = 1; }
  if (!tail) throw new Error(`No opaque texture pixels: ${key}`);
  while (head < tail) {
    const i = queue[head++], x = i % info.width;
    for (const n of [x > 0 ? i - 1 : -1, x < info.width - 1 ? i + 1 : -1, i - info.width, i + info.width]) {
      if (n < 0 || n >= seen.length || seen[n]) continue;
      seen[n] = 1; queue[tail++] = n;
      skin[n * 4] = skin[i * 4]; skin[n * 4 + 1] = skin[i * 4 + 1]; skin[n * 4 + 2] = skin[i * 4 + 2];
    }
  }
  for (let i = 0; i < seen.length; i++) skin[i * 4 + 3] = 255;
  await sharp(skin, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 90 }).toFile(`public/aqua/skin/${key}.webp`);
  const alpha = (x, y) => data[(Math.max(0, Math.min(info.height - 1, y)) * info.width + Math.max(0, Math.min(info.width - 1, x))) * 4 + 3];
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (alpha(x, y) > 96) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (left >= right || top >= bottom) throw new Error(`Empty source: ${key}`);
  const pad = 3;
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(info.width - 1, right + pad); bottom = Math.min(info.height - 1, bottom + pad);
  const rows = [];
  for (let j = 0; j <= grid; j++) {
    const row = []; let start = -1;
    for (let i = 0; i <= grid + 1; i++) {
      let occupied = false;
      if (i <= grid) {
        const x = Math.round(left + i / grid * (right - left)), y = Math.round(top + j / grid * (bottom - top));
        for (let dy = -2; dy <= 2 && !occupied; dy++) for (let dx = -2; dx <= 2; dx++) if (alpha(x + dx, y + dy) > 40) { occupied = true; break; }
      }
      if (occupied && start < 0) start = i;
      if (!occupied && start >= 0) { row.push(start, i - 1); start = -1; }
    }
    rows.push(row);
  }
  profiles[key] = { sourceHash: createHash("sha256").update(original).digest("hex"), grid, bounds: [left, top, right, bottom], image: [info.width, info.height], rows };
}
await writeFile("src/lib/aqua3d/profiles.json", JSON.stringify(profiles));
console.log(`Baked ${Object.keys(profiles).length} local source-specific geometry profiles`);
// 화면의 승인 판정은 profiles.json 대신 이 목록을 읽는다(수조 · 낚시 조각에 300KB 를 싣지 않게) — 같이 다시 굽는다
const approved = await writeApproved();
console.log(`approved-fish.json: ${approved.forms.length} forms`);
