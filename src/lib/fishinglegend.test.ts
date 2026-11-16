// 전설 확률 다시 맞추기(2026-11-14) [사용자: "상위 미끼나 상위 낚시터에서 전설 낚을 확률이 너무 높아 수치조정이 잘못된거같아"]
// 잰 결과(행운 40 · 심해 방식 · 별가루): 울릉분지 심해 전설 이상 32% · 울릉도 25% · 용궁사 · 거진항 100%(물고기 목록이 전부 전설 · 신화).
// 고친 것: 단계 몫은 등급 칸 하나(같은 단계 계열이 나눠 갖는다) · 덤 배수 2배까지 · 전설 이상 몫은 절반 · 용궁사 · 거진항은 영웅급이 기본.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BAITS, SPOTS, catchValue, poolFor, rollCatch, spotMinBait, spotValue, type MethodKey } from "./fishing.ts";
import { GRADES } from "./aquarium.ts";

const rate = (spotKey: string, bait: number, luck: number, method: MethodKey, n = 6000) => {
  const spot = SPOTS.find((s) => s.key === spotKey)!;
  let leg = 0, myth = 0;
  for (let i = 0; i < n; i++) {
    const g = GRADES.indexOf(rollCatch(spot, luck, 0.7, (Math.imul(i + 1, 2654435761) + 11) >>> 0, { bait, method }).grade);
    if (g >= 5) leg++;
    if (g >= 6) myth++;
  }
  return { leg: leg / n, myth: myth / n };
};

test("가장 좋은 미끼 · 가장 좋은 손(행운 40)으로도 어느 낚시터든 전설 이상은 6% 안, 신화 이상은 3% 안", () => {
  const star = BAITS.length - 1;
  for (const s of SPOTS) for (const m of ["float", "lure", "deep"] as MethodKey[]) {
    if (!poolFor(s, BAITS[star].maxGrade).length) continue;
    const r = rate(s.key, star, 40, m);
    assert.ok(r.leg < 0.06, `${s.key} ${m} 전설 이상 ${(r.leg * 100).toFixed(1)}%`);
    assert.ok(r.myth < 0.03, `${s.key} ${m} 신화 이상 ${(r.myth * 100).toFixed(1)}%`);
  }
});

test("그래도 좋은 미끼 · 깊은 낚시터일수록 전설이 조금씩 는다(0 이 되지 않는다)", () => {
  const glow = BAITS.findIndex((b) => b.key === "bait_glow"), star = BAITS.length - 1;
  for (const k of ["ocean", "palace", "starsea", "abyss"]) {
    const a = rate(k, glow, 10, "float").leg, b = rate(k, star, 10, "float").leg;
    assert.ok(a > 0 && b > a, `${k} 발광 ${(a * 100).toFixed(1)}% → 별가루 ${(b * 100).toFixed(1)}%`);
  }
});

test("용궁사 · 거진항은 영웅급이 기본 — 시작 미끼(떡밥)로 낚으면 거의 영웅 이하", () => {
  for (const k of ["palace", "starsea"]) {
    const s = SPOTS.find((x) => x.key === k)!;
    const b = BAITS.findIndex((x) => x.key === spotMinBait(s).key);
    assert.equal(BAITS[b].key, "bait_paste", k);
    assert.ok(rate(k, b, 10, "float").leg < 0.01, k);
  }
});

test("깊은 낚시터 물고기는 값이 더 나간다 — 뒤 낚시터일수록 한 마리 값이 높다", () => {
  assert.equal(spotValue("ocean"), 1);
  assert.ok(spotValue("palace") > 1 && spotValue("starsea") > spotValue("palace") && spotValue("abyss") > spotValue("starsea"));
  const c = { difficulty: 3, at: "abyss" };
  assert.ok(catchValue(c) > catchValue({ ...c, at: "ocean" }));
});
