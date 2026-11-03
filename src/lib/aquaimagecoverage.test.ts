import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_SPECIES, DECOR, FAMILIES, TANKS } from "./aquarium.ts";
import { DECOR_IMAGE_KEYS, FISH_IMAGE_KEYS, TANK_IMAGE_KEYS } from "./aquaimages.ts";
import { PREPARED_FISH_KEYS } from "./aqua3d/prepared.ts";

test("aquarium art covers all growth stages, adult species, decorations and tanks", () => {
  const fish = [...FAMILIES.flatMap(f => [`fry_${f.key}`, `juv_${f.key}`]), ...ALL_SPECIES.map(s => s.key)];
  const prepared = PREPARED_FISH_KEYS;
  assert.deepEqual([...FISH_IMAGE_KEYS].sort(), [...new Set([...fish, ...prepared])].sort());
  assert.deepEqual([...DECOR_IMAGE_KEYS].sort(), DECOR.map(d => d.key).sort());
  assert.deepEqual([...TANK_IMAGE_KEYS].sort(), TANKS.map((_, i) => `tank_${i + 1}`).sort());
});

function webpSize(buf: Buffer) {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  const type = buf.toString("ascii", 12, 16);
  if (type === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), alpha: !!(buf[20] & 0x10) };
  if (type === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff), alpha: !!(bits & 0x10000000) };
  }
  assert.equal(type, "VP8 ");
  assert.equal(buf.toString("hex", 23, 26), "9d012a");
  return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, alpha: false };
}

test("aquarium collectible art has transparent 512px masters and 192px thumbnails", () => {
  for (const [kind, keys] of [["fish", FISH_IMAGE_KEYS], ["decor", DECOR_IMAGE_KEYS]] as const) {
    for (const key of keys) for (const [dir, size] of [["", 512], ["sm", 192]] as const) {
      const file = join(process.cwd(), "public/aqua", kind, dir, key + ".webp");
      const buf = readFileSync(file);
      assert.deepEqual(webpSize(buf), { width: size, height: size, alpha: true }, file);
      assert.ok(buf.length < (size === 512 ? 450000 : 75000), file);
    }
  }
});

test("all aquarium backdrops fill a portrait 4:5 frame", () => {
  for (const key of TANK_IMAGE_KEYS) {
    const file = join(process.cwd(), "public/aqua/tank", key + ".webp");
    const size = webpSize(readFileSync(file));
    assert.equal(size.width, 1024, key);
    assert.equal(size.height, 1280, key);
  }
});

test("art import keeps fin padding and UI resolves registered files through the app base path", () => {
  const root = process.cwd();
  const sync = readFileSync(join(root, "scripts/aqua-art-sync.mjs"), "utf8");
  assert.match(sync, /resize\(410, 410/);
  assert.match(sync, /top: 51, bottom: 51, left: 51, right: 51/);
  const art = readFileSync(join(root, "src/components/AquaArt.tsx"), "utf8");
  assert.match(art, /FISH_IMAGE_KEYS\.has\(artKey\)/);
  assert.match(art, /DECOR_IMAGE_KEYS\.has\(artKey\)/);
  assert.match(art, /asset\(`\/aqua\/fish\/sm\//);
  assert.match(art, /asset\(`\/aqua\/decor\/sm\//);
});
