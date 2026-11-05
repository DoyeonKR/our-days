import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PET_FORMS } from "./island.ts";
import { HERO_ART_REVISION, HERO_V3_FORMS, heroAsset } from "./heroassets.ts";

const root = join(import.meta.dirname, "../..");
const folder = join(root, "public/heroes/v3");
const old = readdirSync(join(root, "public/heroes/v2")).filter((x) => x.endsWith(".png")).map((x) => x.slice(0, -4));

test("every registered hero has an original image; none silently use placeholder dots", () => {
  assert.deepEqual([...new Set([...old, ...HERO_V3_FORMS])].sort(), Object.keys(PET_FORMS).sort());
  // -md(384px)는 2026-11-05 — 64~128px 칸이 768px 원화를 받지 않게
  const expected = [...HERO_V3_FORMS].flatMap((key) => [`${key}.webp`, `${key}-icon.webp`, `${key}-md.webp`]).sort();
  assert.deepEqual(readdirSync(folder).filter((x) => x.endsWith(".webp")).sort(), expected);
});

test("new originals and thumbnails retain alpha, resolution and a bounded download size", () => {
  const kinds = [["", 768, 400_000], ["-icon", 192, 45_000], ["-md", 384, 90_000]] as const;
  for (const key of HERO_V3_FORMS) for (const [suffix, px, cap] of kinds) {
    const name = `${key}${suffix}.webp`;
    const bytes = readFileSync(join(folder, name));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", name);
    assert.equal(bytes.toString("ascii", 8, 16), "WEBPVP8X", name);
    assert.ok(bytes[20] & 0x10, `${name}: missing transparency`);
    assert.equal(1 + bytes.readUIntLE(24, 3), px, name);
    assert.equal(1 + bytes.readUIntLE(27, 3), px, name);
    assert.ok(bytes.length < cap, `${name}: unexpectedly heavy asset`);
  }
});

test("small display slots use thumbnails while the pet stage uses the detailed original", () => {
  for (const key of HERO_V3_FORMS) {
    assert.equal(heroAsset(key, 44), `/heroes/v3/${key}-icon.webp?v=${HERO_ART_REVISION}`);
    assert.equal(heroAsset(key, 112), `/heroes/v3/${key}-md.webp?v=${HERO_ART_REVISION}`);
    assert.equal(heroAsset(key, 128), `/heroes/v3/${key}-md.webp?v=${HERO_ART_REVISION}`);
    assert.equal(heroAsset(key, 132), `/heroes/v3/${key}.webp?v=${HERO_ART_REVISION}`);
  }
  assert.equal(heroAsset("egg", 24), "/heroes/v2/egg.png");
});

test("the embedded island scene uses the same new art rather than baking the old sprite", () => {
  const scene = readFileSync(join(root, "src/components/island/IslandScene.tsx"), "utf8");
  assert.match(scene, /hasHeroAsset\(petForm\)[\s\S]*?href=\{asset\(heroAsset\(petForm, 44\)\)\}/);
  // (사냥 무대 HuntStage 는 2026-10-31 사냥과 함께 지웠다)
});

test("그림 판 번호는 고정값 — 배포 sha 를 붙이면 배포마다 그림 246장을 다시 받는다(2026-11-05)", () => {
  assert.match(HERO_ART_REVISION, /^\d{8}-v\d+$/);
  const src = readFileSync(join(root, "src/lib/heroassets.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /NEXT_PUBLIC_APP_VERSION|GITHUB_SHA/);
});
