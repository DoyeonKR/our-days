// 정원 확장 lock — 작물 16종 · 다시 열리는 작물 · 밭 궁합. [2026-09-23]
// [사용자 요청 "정원, 공방, 꾸미기 … 너무 기능도 없고 반복적인 것만 있어 … 더 많은 농작물"]
//
// 잠그는 것:
//  1. 새 작물이 **옛 작물을 죽이지 않는다** — 하루 수익이 같은 대역(판매가 ÷ 성장일).
//  2. 다시 열리는 작물은 뽑지 않고 times 번 더 딴 뒤에야 밭이 빈다.
//  3. 밭 궁합은 **4방향 이웃**만, 줄이 바뀌는 칸(3번↔4번)은 이웃이 아니다.
//  4. 짝을 맞춰 심었으면 **거두는 순서와 무관하게** 둘 다 보너스를 받는다(유예 12시간).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPANIONS,
  COMPANION_GRACE,
  CROPS,
  DAY_MS,
  FARM_COLS,
  TUNING,
  cropOf,
  cropStage,
  createIsland,
  harvest,
  harvestAllReady,
  plant,
  plotCompanions,
  qualityPreview,
  type CropKey,
  type IslandState,
} from "./island.ts";

const T0 = Date.UTC(2026, 8, 25, 3, 0, 0); // 9월 = 가을(KST)

/** 밭 12칸 · 코인 넉넉 · 스프링클러(물 걱정 없이 성장 시간만 본다) · 온실(계절 무관). */
function farm(): IslandState {
  const s = createIsland("콩", null, T0);
  s.coins = 100_000;
  s.farm.sprinkler = true;
  s.farm.greenhouse = true;
  while (s.farm.plots.length < 12) s.farm.plots.push({ crop: null, plantedAt: null, wateredAt: null, fert: 0 });
  return s;
}
/** 다 자랄 때까지의 시간(스프링클러 = 물 가속 포함) — cropStage 가 ripe 가 되는 첫 시각을 찾는다. */
function ripeAt(s: IslandState, plotId: number, from: number): number {
  let t = from;
  while (!cropStage(s, s.farm.plots[plotId], t).ripe) t += 15 * 60_000;
  return t;
}

const NEW: CropKey[] = [
  "potato", "pea", "lettuce", "tea", "pepper", "cucumber", "eggplant", "blueberry",
  "rice", "sweetpotato", "apple", "chestnut", "radish", "spinach", "tangerine", "wheat",
];

test("새 작물 16종 — 계절마다 넷, 스킬 게이트 없음(게이트는 전설의 표식)", () => {
  for (const k of NEW) assert.ok(CROPS.some((c) => c.key === k), `${k} 가 없다`);
  const bySeason = new Map<string, number>();
  for (const k of NEW) bySeason.set(cropOf(k).season, (bySeason.get(cropOf(k).season) ?? 0) + 1);
  assert.deepEqual([...bySeason.values()], [4, 4, 4, 4], `계절 분포: ${[...bySeason.entries()]}`);
  for (const k of NEW) assert.ok(!cropOf(k).minSkill && !cropOf(k).unique, `${k}: 일반 작물에 게이트`);
});

test("★ 하루 수익 대역 — 새 작물이 옛 작물보다 벌면 옛 작물이 죽는다", () => {
  const perDay = (k: CropKey) => {
    const c = cropOf(k);
    if (!c.regrow) return c.sell / c.growDays;
    // 다시 열리는 작물은 한 포기의 일생 전체로 본다
    const harvests = 1 + c.regrow.times;
    return (c.sell * harvests) / (c.growDays + c.regrow.days * c.regrow.times);
  };
  const normal = CROPS.filter((c) => !c.unique);
  const old = normal.filter((c) => !NEW.includes(c.key)).map((c) => perDay(c.key));
  const lo = Math.min(...old) * 0.8;
  const hi = Math.max(...old) * 1.1;
  for (const k of NEW) {
    const v = perDay(k);
    assert.ok(v >= lo && v <= hi, `${k}: 하루 ${v.toFixed(1)}💗 — 옛 대역 ${lo.toFixed(1)}~${hi.toFixed(1)} 밖`);
  }
});

test("다시 열리는 작물 — 뽑지 않고 times 번 더 딴 뒤에야 밭이 빈다", () => {
  let s = farm();
  s = plant(s, 0, "apple", T0);
  const c = cropOf("apple");
  assert.ok(c.regrow, "사과는 다시 열린다");
  let t = T0;
  for (let i = 0; i < c.regrow!.times; i++) {
    t = ripeAt(s, 0, t);
    s = harvest(s, 0, t);
    assert.equal(s.farm.plots[0].crop, "apple", `${i + 1}번째 수확 뒤에도 나무가 서 있어야 한다`);
    assert.equal(s.farm.plots[0].cycle, i + 1);
  }
  t = ripeAt(s, 0, t);
  s = harvest(s, 0, t);
  assert.equal(s.farm.plots[0].crop, null, "마지막 수확 뒤엔 밭이 빈다");
  // 한 포기에서 1 + times 번 땄다(풍년이면 한 번에 2개라 '이상'으로 본다)
  assert.ok((s.farm.barn.apple?.qty ?? 0) >= 1 + c.regrow!.times, `창고 사과 ${s.farm.barn.apple?.qty}`);
});

test("다시 열리는 작물 — 두 번째부터는 재수확 주기로 자란다(첫 성장보다 짧다)", () => {
  let s = farm();
  s = plant(s, 0, "tangerine", T0);
  const first = ripeAt(s, 0, T0) - T0;
  s = harvest(s, 0, T0 + first);
  const second = ripeAt(s, 0, T0 + first) - (T0 + first);
  const c = cropOf("tangerine");
  assert.ok(second < first, `재수확(${second / 3600000}h)이 첫 성장(${first / 3600000}h)보다 짧아야 한다`);
  // 비율도 표와 맞는다(물·온실 가속은 둘에 똑같이 걸린다)
  const ratio = second / first;
  assert.ok(Math.abs(ratio - c.regrow!.days / c.growDays) < 0.05, `비율 ${ratio.toFixed(2)}`);
});

test("밭 궁합 정의 — 실재 작물 · id·쌍 중복 없음 · 전설 제외", () => {
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const cp of COMPANIONS) {
    assert.ok(cropOf(cp.a) && cropOf(cp.b), `${cp.id}: 없는 작물`);
    assert.ok(!ids.has(cp.id), `id 중복 ${cp.id}`);
    ids.add(cp.id);
    const key = [cp.a, cp.b].sort().join("|");
    assert.ok(!pairs.has(key), `쌍 중복 ${key}`);
    pairs.add(key);
    assert.ok(!cropOf(cp.a).unique && !cropOf(cp.b).unique, `${cp.id}: 전설은 한 포기라 짝을 못 이룬다`);
    assert.ok(cp.bonus > 0 && cp.bonus <= TUNING.farm.companionCap);
  }
});

test("★ 밭 궁합 — 4방향 이웃만, 대각선·줄바꿈 칸은 아니다", () => {
  let s = farm();
  s = plant(s, 1, "corn", T0);
  s = plant(s, 2, "pumpkin", T0); // 1 옆(가로)
  assert.deepEqual(plotCompanions(s, 1, T0).map((c) => c.id), ["threesisters"]);
  assert.deepEqual(plotCompanions(s, 2, T0).map((c) => c.id), ["threesisters"]);

  let d = farm();
  d = plant(d, 1, "corn", T0);
  d = plant(d, 1 + FARM_COLS + 1, "pumpkin", T0); // 대각선
  assert.deepEqual(plotCompanions(d, 1, T0), [], "대각선은 이웃이 아니다");

  let w = farm();
  w = plant(w, FARM_COLS - 1, "corn", T0); // 첫 줄 맨 오른쪽
  w = plant(w, FARM_COLS, "pumpkin", T0); // 둘째 줄 맨 왼쪽 — 인덱스는 붙어 있지만 화면에선 떨어져 있다
  assert.deepEqual(plotCompanions(w, FARM_COLS - 1, T0), [], "줄이 바뀌는 칸은 이웃이 아니다");

  let v = farm();
  v = plant(v, 1, "corn", T0);
  v = plant(v, 1 + FARM_COLS, "pumpkin", T0); // 세로
  assert.deepEqual(plotCompanions(v, 1, T0).map((c) => c.id), ["threesisters"], "세로 이웃도 궁합");
});

test("★ 궁합이 품질 미리보기와 수확에 같은 값으로 들어간다", () => {
  let s = farm();
  s = plant(s, 1, "corn", T0);
  const alone = qualityPreview(s, 1, T0)!.score;
  s = plant(s, 2, "pumpkin", T0);
  const paired = qualityPreview(s, 1, T0)!;
  const part = paired.parts.find((p) => p.key === "companion");
  assert.ok(part && part.val === 10, `궁합 줄: ${JSON.stringify(part)}`);
  assert.equal(paired.score, alone + 10);
});

test("궁합 가산은 상한이 있다 — 사방을 짝으로 둘러도 companionCap 까지", () => {
  let s = farm();
  // 옥수수(5번 칸) 사방: 호박(세 자매 10) · 완두(8) · 호박 · 완두 → 합 36, 상한 16
  s = plant(s, 5, "corn", T0);
  for (const [i, k] of [[4, "pumpkin"], [6, "pea"], [1, "pumpkin"], [9, "pea"]] as const) s = plant(s, i, k, T0);
  const part = qualityPreview(s, 5, T0)!.parts.find((p) => p.key === "companion")!;
  assert.equal(part.val, TUNING.farm.companionCap);
});

test("★★ 거두는 순서와 무관하게 짝은 둘 다 보너스를 받는다(방금 거둔 이웃 유예)", () => {
  let s = farm();
  s = plant(s, 1, "corn", T0);
  s = plant(s, 2, "pumpkin", T0);
  const t = Math.max(ripeAt(s, 1, T0), ripeAt(s, 2, T0));
  s = harvest(s, 1, t); // 옥수수를 먼저 거둔다
  assert.equal(s.farm.plots[1].crop, null);
  const after = qualityPreview(s, 2, t)!.parts.find((p) => p.key === "companion");
  assert.equal(after?.val, 10, "방금 거둔 옥수수도 호박의 짝으로 쳐야 한다");
  const late = qualityPreview(s, 2, t + COMPANION_GRACE + 1)!.parts.find((p) => p.key === "companion");
  assert.equal(late, undefined, "유예가 지나면 짝이 아니다");
});

test("모두 수확 — 짝 둘 다 보너스를 받고 도감에 궁합이 남는다", () => {
  let s = farm();
  s = plant(s, 1, "corn", T0);
  s = plant(s, 2, "pumpkin", T0);
  const t = Math.max(ripeAt(s, 1, T0), ripeAt(s, 2, T0));
  const before = [qualityPreview(s, 1, t)!.score, qualityPreview(s, 2, t)!.score];
  s = harvestAllReady(s, t);
  assert.equal(s.farm.plots[1].crop, null);
  assert.equal(s.farm.plots[2].crop, null);
  assert.ok(s.catalog.includes("comp_threesisters"), "궁합이 도감에 남는다");
  assert.ok(before.every((v) => v >= 10), "전제: 둘 다 궁합 점수를 갖고 있었다");
});

test("구버전 밭(cycle·prev 없음)도 그대로 돈다 — 무마이그레이션", () => {
  let s = farm();
  s = plant(s, 0, "carrot", T0);
  delete (s.farm.plots[0] as { cycle?: number }).cycle;
  const t = ripeAt(s, 0, T0);
  assert.ok(t - T0 < 2 * DAY_MS);
  s = harvest(s, 0, t);
  assert.equal(s.farm.plots[0].crop, null);
  assert.equal(s.farm.plots[0].prev?.crop, "carrot");
});
