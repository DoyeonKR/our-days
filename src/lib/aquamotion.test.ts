import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aquaSwimSheet, AQUA_SWIM_SHEETS } from "./aquamotion.ts";
import { familyOf, fishName, pickFinal, tickAqua, aquaOf } from "./aquarium.ts";

test("marine animals keep their own species through growth rather than becoming unrelated animals", () => {
  const pairs = [["bluefin", "bluefin_tuna"], ["sea_turtle", "green_sea_turtle"], ["whale_shark", "whale_shark"], ["manta", "oceanic_manta"]];
  for (const [key, species] of pairs) {
    const fam = familyOf(key)!;
    assert.ok(fam, key);
    assert.equal(fam.finals.length, 1);
    for (const care of [0, 60, 90, 100]) assert.equal(pickFinal(fam, care, [], 4).key, species);
    const a = aquaOf({}, 0);
    a.tank = 5;
    a.fish.push({ id: 1, family: key, stage: 1, growH: fam.hours - 0.1, goodH: 0, totalH: 0 });
    const grown = tickAqua(a, 3600000).a;
    assert.equal(grown.fish[0].species, species);
    assert.equal(grown.fish[0].stage, 2);
    assert.ok(grown.dex.includes(species));
  }
  assert.equal(fishName({ family: "sea_turtle", stage: 0 }), "바다거북 새끼");
  assert.equal(familyOf("guppy")!.finals.length, 4);
});

test("only registered marine adults request swim sheets, with species-specific cadence", () => {
  assert.equal(Object.keys(AQUA_SWIM_SHEETS).length, 4);
  assert.equal(aquaSwimSheet("green_sea_turtle"), "/aqua/motion/green_sea_turtle.webp");
  for (const key of ["unknown", "__proto__", "constructor", "fry_manta", "cobra_guppy"]) assert.equal(aquaSwimSheet(key), null);
  assert.ok(AQUA_SWIM_SHEETS.bluefin_tuna < AQUA_SWIM_SHEETS.whale_shark);
});

test("swim sheets are transparent 4 by 2 atlases with eight 256px frames", () => {
  for (const key of Object.keys(AQUA_SWIM_SHEETS)) {
    const buf = readFileSync(join(process.cwd(), "public", aquaSwimSheet(key)!));
    assert.equal(buf.toString("ascii", 8, 12), "WEBP", key);
    assert.equal(buf.toString("ascii", 12, 16), "VP8X", key);
    assert.ok(buf[20] & 0x10, key);
    assert.equal(1 + buf.readUIntLE(24, 3), 1024, key);
    assert.equal(1 + buf.readUIntLE(27, 3), 512, key);
  }
});

test("legacy sprite sheets retain fallback support, but the live tank uses actual 3D models", () => {
  const root = process.cwd();
  const art = readFileSync(join(root, "src/components/AquaArt.tsx"), "utf8");
  const tank = readFileSync(join(root, "src/components/AquariumGame.tsx"), "utf8");
  const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
  assert.match(art, /animate = false/);
  assert.match(art, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(art, /if \(failed\) return <FishArt/);
  assert.match(tank, /<Aquarium3D/);
  assert.equal((tank.match(/<FishArt[^>]+\banimate\s*\/>/g) ?? []).length, 0);
  assert.match(css, /background-size: 400% 200%/);
  assert.match(css, /87\.5% \{ background-position: 100% 100%/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.aqua-motion \{ animation: none/);
});
