// 새우류 뼈대(2026-11-14) — 그림 · 모델이 들어와 SHRIMP_ON 을 켜기 전까지는 게임에 아무것도 안 들어간다. 켠 뒤의 모양을 여기서 미리 잰다
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { ACTIVE_SHRIMP, SHRIMP_FAMILIES, SHRIMP_ON, withShrimp } from "./shrimp.ts";
import { FAMILIES, FISH_BASE_CM, GRADES } from "./aquarium.ts";
import { FRESH_FAMILIES, SPOTS } from "./fishing.ts";
import { FISH_HABITS } from "./aqua3d/habits.ts";

test("꺼져 있는 동안은 계열 표 · 몸길이 · 낚시터 · 습성 어디에도 없다", () => {
  if (SHRIMP_ON) return;
  assert.equal(ACTIVE_SHRIMP.length, 0);
  for (const f of SHRIMP_FAMILIES) {
    assert.ok(!FAMILIES.some((x) => x.key === f.key), f.key);
    assert.equal(FISH_BASE_CM[f.key], undefined, f.key);
    assert.ok(!FISH_HABITS[f.key], f.key);
    assert.ok(!SPOTS.some((s) => s.pool.some(([k]) => k === f.key)), f.key);
  }
});

test("켠 뒤의 모양 — key 가 겹치지 않고, 낚시터 · 물 · 앞 계열이 맞고, 그 낚시터의 가장 싼 계열보다 싸지 않다(미끼 1% 규칙)", () => {
  const gradeOf = (k: string) => GRADES.indexOf(FAMILIES.find((f) => f.key === k)!.finals[0].grade);
  for (const f of SHRIMP_FAMILIES) {
    assert.ok(!FAMILIES.some((x) => x.key === f.key) || SHRIMP_ON, `${f.key} 가 이미 있는 계열과 겹친다`);
    assert.ok(f.cm > 0 && f.hours > 0 && f.price > 0, f.key);
    for (const [spot, w, after] of f.spots) {
      const sp = SPOTS.find((s) => s.key === spot);
      assert.ok(sp, `${f.key} → 없는 낚시터 ${spot}`);
      assert.ok(sp!.pool.some(([k]) => k === after), `${f.key}: ${spot} 에 ${after} 가 없다`);
      assert.equal(f.fresh, sp!.water !== "sea", `${f.key}: ${spot} 의 물(${sp!.water})`);
      assert.ok(w > 0 && w < 10, f.key);
      const cheapest = Math.min(...sp!.pool.filter(([k]) => !SHRIMP_FAMILIES.some((x) => x.key === k)).map(([k]) => gradeOf(k)));
      assert.ok(GRADES.indexOf(f.grade) >= cheapest, `${f.key} 는 ${spot} 의 가장 싼 계열보다 싸다`);
      const pool = withShrimp(spot, sp!.pool, SHRIMP_FAMILIES);
      assert.equal(pool[pool.findIndex(([k]) => k === after) + 1][0], f.key, "정해진 계열 바로 뒤");
      assert.deepEqual(pool[0], [...sp!.pool[0]], "대표 물고기 자리는 그대로");
    }
  }
  assert.ok(!FRESH_FAMILIES.has("dokdo_shrimp") || SHRIMP_ON);
});

test("그림 세션 프롬프트가 남아 있다(design/ART-GUIDE.md D — 세 key)", () => {
  const doc = readFileSync(new URL("../../design/ART-GUIDE.md", import.meta.url), "utf8");
  for (const f of SHRIMP_FAMILIES) assert.ok(doc.includes(`\`${f.key}\``), f.key);
});
