import { test } from "node:test";
import assert from "node:assert/strict";
import { petSprites } from "./pixelart.ts";
import { mythicSigil } from "./pixelrank.ts";
import { validateSprite } from "./pixel.ts";

const FORMS = ["tiger", "bengal_tiger", "mudeung_tiger", "lion", "giraffe"];

test("신화형은 유효하고 서로 다른 별자리 문양을 가진다", () => {
  const seen = new Set<string>();
  for (const form of FORMS) {
    const sigil = mythicSigil(form);
    assert.ok(sigil, `${form}: 문양 없음`);
    assert.deepEqual(validateSprite(sigil!, form), []);
    const key = sigil!.rows.join("|") + JSON.stringify(sigil!.pal);
    assert.ok(!seen.has(key), `${form}: 중복 문양`);
    seen.add(key);
  }
});

test("신화 오라는 얼굴 아이콘 영역을 프레임마다 흔들지 않는다", () => {
  for (const form of FORMS) {
    const frames = petSprites(form);
    const face = (i: number) => frames[i].rows.slice(0, 30).map((r) => r.slice(6, 42)).join("|");
    for (let i = 1; i < frames.length; i++) assert.equal(face(i), face(0), `${form} ${i}: 얼굴 오라 흔들림`);
  }
});
