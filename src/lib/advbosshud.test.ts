// 2026-11-10 대장 카드 — '다음 패턴'으로 보여 준 이름이 실제로 나온 패턴과 같아야 한다(화면은 엔진 값 a.sig 를 그대로 읽는다)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { REGIONS, bossLevel, makeMon, newSave, startBoss } from "./adventure.ts";
import { SIGNATURES, TPS, newArena, stepArena, think } from "./arena.ts";

const EMPTY = { balls: { basic: 0, great: 0, star: 0 }, items: { potion: 0, bigpotion: 0, cure: 0 } };

test("대장 카드 — 다음 패턴 예고가 실제 패턴과 같다", () => {
  let seen = 0;
  for (const ri of [0, 3, 6]) {
    const r = REGIONS[ri];
    const save = newSave("leaf_2", 77 + ri);
    const g = { s: 5 + ri };
    save.party = [0, 1, 2].map((i) => makeMon(save.party[0].species, bossLevel(r) + 2, g, `t${i}`));
    const a = newArena(startBoss(save, r).battle, EMPTY);
    const me = { s: 9 + ri };
    while (!a.b.over && a.tick < 120 * TPS) {
      const predicted = SIGNATURES[(a.sig.n + Math.abs(a.b.seed % 2)) % SIGNATURES.length];
      let inp = think(a, 0, me, 0.6);
      if (a.b.needSwap) inp = { dir: 0, swap: a.b.sides[0].team.findIndex((f) => f.mon.hp > 0) };
      stepArena(a, inp);
      for (const e of a.ev) if (e.t === "text" && e.s.includes("패턴 — ")) {
        assert.ok(e.s.includes(`패턴 — ${predicted}`), `${e.s} ≠ ${predicted}`);
        seen++;
      }
    }
  }
  assert.ok(seen >= 3, `패턴이 ${seen}번밖에 안 나왔다`);
});

test("대장 카드 — 화면이 엔진의 다음 패턴 · 분노를 읽는다(대전엔 없다)", () => {
  const src = fs.readFileSync(new URL("../components/adventure/BattleView.tsx", import.meta.url), "utf8");
  assert.match(src, /SIGNATURES\[\(a\.sig\.n \+ Math\.abs\(a\.b\.seed % 2\)\) % SIGNATURES\.length\]/);
  assert.match(src, /enraged: a\.units\[1\]\.enraged/);
  assert.match(src, /a\.b\.boss != null \|\| \(a\.b\.tower != null && a\.b\.tower % 10 === 0\)/);
});
