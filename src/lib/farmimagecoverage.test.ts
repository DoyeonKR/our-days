import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CROPS, GOODS, PRODUCTS } from "./island.ts";
import { CROP_IMAGE_KEYS, FOOD_IMAGE_KEYS } from "./farmimages.ts";

test("every garden crop, cooked food and animal good has dedicated raster artwork", () => {
  assert.deepEqual([...CROP_IMAGE_KEYS].sort(), CROPS.map(c => c.key).sort());
  assert.deepEqual([...FOOD_IMAGE_KEYS].sort(), [...PRODUCTS, ...GOODS].map(c => c.key).sort());
});

function dimensions(buf: Buffer) {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  const type = buf.toString("ascii", 12, 16);
  if (type === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), alpha: !!(buf[20] & 0x10) };
  assert.equal(type, "VP8L");
  const bits = buf.readUInt32LE(21);
  return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff), alpha: !!(bits & 0x10000000) };
}

test("garden artwork ships transparent 512px masters and lightweight 160px thumbnails", () => {
  for (const [dir, keys] of [["crop", CROP_IMAGE_KEYS], ["food", FOOD_IMAGE_KEYS]] as const) {
    for (const key of keys) for (const [subdir, size] of [["", 512], ["sm", 160]] as const) {
      const file = join(process.cwd(), "public/farm", dir, subdir, `${key}.webp`);
      const buf = readFileSync(file);
      assert.deepEqual(dimensions(buf), { width: size, height: size, alpha: true }, file);
      assert.ok(buf.length < (size === 512 ? 900000 : 65000), `unexpected payload: ${file}`);
    }
  }
});

test("high resolution farm art overrides inherited pixelated rendering", () => {
  const src = readFileSync(join(process.cwd(), "src/components/island/CropIcon.tsx"), "utf8");
  assert.match(src, /imageRendering:\s*"auto"/);
  assert.match(src, /src=\{asset\(src\)\}/);
  assert.match(src, /loading="lazy"/);
});
