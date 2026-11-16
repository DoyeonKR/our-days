import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SPOTS, RODS, NETS, BAITS, JUNKS } from "./fishing.ts";
import { FISHING_IMAGE_KEYS } from "./fishingimages.ts";
import { NATIVE_SPOT_KEYS } from "./aqua3d/prepared.ts";
import {CRAFT_BAITS} from './fishcraft.ts';
import {RELIC_PIECES} from './fishtreasure.ts';

test("fishing art covers every spot, rod, landing net, bait and junk item", () => {
  // 새 전용 쓰레기 8종은 그림이 오기 전까지 FishingIcons 의 벡터로 그린다(design/FISHING-ART.md 에 프롬프트가 있다)
  const VECTOR_ONLY = new Set(["junk_buoy", "junk_basket", "junk_oar", "junk_ring", "junk_pole", "junk_stool", "junk_helmet", "junk_probe"].filter((k) => !FISHING_IMAGE_KEYS.has(k)));
  const relicKeys=RELIC_PIECES.map(p=>'relic_'+p.key);
  const expected = [...SPOTS.map(s => `spot_${s.key}`), ...RODS.map(r => r.key), ...NETS.map(n => n.key), ...BAITS.map(b => b.key), ...JUNKS.map(j => j.key),...relicKeys,...CRAFT_BAITS.map(b=>b.key)].filter((k) => !VECTOR_ONLY.has(k));
  // Harbor artwork is deployed before the reviewed species and spot are enabled.
  assert.deepEqual([...FISHING_IMAGE_KEYS].sort(), [...new Set([...expected, "spot_harbor", "spot_abyss", ...NATIVE_SPOT_KEYS])].sort());
});

test("fishing backgrounds are portrait HD and all item art retains transparent 512px masters", () => {
  for (const key of FISHING_IMAGE_KEYS) {
    const b = readFileSync(join(process.cwd(), "public/fishing", `${key}.webp`));
    assert.equal(b.toString("ascii", 0, 4), "RIFF", key);
    assert.equal(b.toString("ascii", 8, 12), "WEBP", key);
    const extended = b.toString("ascii", 12, 16) === "VP8X";
    const width = extended ? 1 + b.readUIntLE(24, 3) : b.readUInt16LE(26) & 0x3fff;
    const height = extended ? 1 + b.readUIntLE(27, 3) : b.readUInt16LE(28) & 0x3fff;
    const spot = key.startsWith("spot_");
    assert.equal(width, spot ? 1024 : 512, key);
    assert.equal(height, spot ? 1280 : 512, key);
    if (!spot) assert.ok(extended && (b[20] & 0x10), key);
    assert.ok(b.length < (spot ? 700000 : 150000), key);
  }
});
