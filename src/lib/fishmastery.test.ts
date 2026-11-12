// 낚시터 숙련도(2026-11-12) [사용자: "낚시터마다 잡은 수 · 종류로 별 1~5개 … 귀한 물고기 확률이 조금 오르고, 배경이 밤 · 노을로 바뀌고, 별 5개면 주인의 각성(2단계)"]
// 잠그는 것: 실제 끌어올리기 함수로 세기 · 별 문턱(모든 낚시터에서 ★5 가 닿는다) · 보상 계산 · 미끼 1% 규칙(사용자 결정)이 그대로인지 ·
// 경제에 얹히는 크기 · 저장이 낚시 저장 · 옛 앱의 s.fishing 다시 짓기를 지나도 남는지 · 각성한 주인의 기록이 fishPlus 에만 쓰이는지.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland, type IslandState } from "./island.ts";
import { aquaOf, tankOf } from "./aquarium.ts";
import {
  BAITS, BAIT_STEP, SPOTS, baitIndex, bossOpen, bossLost, bossRefund, bossWon, bossCatch, buyBait, catchArt, catchTable, coinValue, familyBaitTier, fishingOf,
  haulJunk, rollCatch, sellCatch, spendBait, spotMinBait, spotOf, tryNet, tryStore, tryStoreSwap, type FishCatch, type FishSpot,
} from "./fishing.ts";
import { BOSSES, BOSS_REPEAT_SHARE, bossOf, bossReward, type BossRecord } from "./fishingworld.ts";
import { fishPlusOf, specialCatch, withFishPlus } from "./fishplus.ts";
import {
  AWAKE_STAR, LOOK_STAR, MASTERY_KINDS_CAP, MASTERY_LUCK_PER_STAR, MASTERY_SALE_BONUS, MAX_STARS, STAR_NEED, awakeBossAt, bossRecOf, masteryLuck, masteryOf,
  masterySaleBonus, noteMastery, setSpotLook, spotLookOf, spotMastery, spotStars, starsFor, withMasteryLuck,
} from "./fishmastery.ts";

const NOW = Date.UTC(2026, 10, 12, 3);
const TODAY = "2026-11-12";
const DAY = { time: "day" as const, wx: null };
const brook = spotOf("brook")!;

function island(level = 10): IslandState {
  const s = createIsland("펫", null, NOW);
  return { ...s, coins: 1_000_000, fishing: { ...fishingOf(s), level } };
}
/** 이 낚시터의 진짜 물고기 몇 마리(꽝 · 다 큰 대물 없이 — 작은 수조에 담기게) */
function catchesAt(spot: FishSpot, n: number, bait = baitIndex(spotMinBait(spot).key)): FishCatch[] {
  const out: FishCatch[] = [];
  for (let i = 0; out.length < n && i < 10000; i++) {
    const c = rollCatch(spot, 5, 0.4, (i * 7919 + 17) >>> 0, { bait, junk: true });
    if (!c.junk && c.stage === 0) out.push(c);
  }
  return out;
}
/** 별을 그만큼 가진 섬 — 수 · 종류를 그 별의 문턱만큼 */
function withStars(st: IslandState, spot: string, stars: number): IslandState {
  const need = stars > 0 ? STAR_NEED[stars - 1] : { n: 0, kinds: 0 };
  return withFishPlus(st, { mastery: { ...masteryOf(st), [spot]: { n: need.n, kinds: Array.from({ length: need.kinds }, (_, i) => `form_${i}`) } } });
}

test("rollCatch 가 낚시터를 찍는다 · 뽑기 순서는 그대로(at 만 더해진다)", () => {
  const c = rollCatch(brook, 5, 0.4, 7, { bait: 0, junk: true });
  assert.equal(c.at, "brook");
  const timed = rollCatch(spotOf("seomjin")!, 5, 0.4, 3, { bait: 2, when: { time: "dawn", wx: null } });
  assert.equal(timed.at, "seomjin");
  const { at: _at, ...rest } = c;
  void _at;
  assert.equal(Object.keys(rest).includes("at"), false);
});

test("세기 — 실제 끌어올리기 함수(팔기 · 담기 · 빠져나감 · 그물 · 교체)가 한 마리씩 센다 · 꽝 · 특별한 것 · 주인은 안 센다", () => {
  let s = island();
  const cs = catchesAt(brook, 12);
  // 팔기
  let r = sellCatch(s, cs[0], TODAY);
  assert.ok(r.ok); s = r.ok ? r.state : s;
  assert.equal(spotMastery(s, "brook").n, 1);
  assert.deepEqual(spotMastery(s, "brook").kinds, [catchArt(cs[0])]);
  // 담기(성공) · 빠져나감
  r = tryStore(s, cs[1], 1, 0, NOW, TODAY); assert.ok(r.ok && r.outcome === "stored"); s = r.ok ? r.state : s;
  r = tryStore(s, cs[2], 0, 0.5, NOW, TODAY); assert.ok(r.ok && r.outcome === "slipped"); s = r.ok ? r.state : s;
  assert.equal(spotMastery(s, "brook").n, 3);
  // 수조를 채우고 그물 · 교체
  while (aquaOf(s).fish.length < tankOf(aquaOf(s)).fish) { const k = tryStore(s, cs[3], 1, 0, NOW, TODAY); assert.ok(k.ok); s = k.ok ? k.state : s; }
  const before = spotMastery(s, "brook").n;
  r = tryNet(s, cs[4], 1, 0, NOW, TODAY); assert.ok(r.ok && r.outcome === "netted", r.ok ? r.outcome : r.reason); s = r.ok ? r.state : s;
  r = tryNet(s, cs[5], 0, 0.5, NOW, TODAY); assert.ok(r.ok && r.outcome === "slipped"); s = r.ok ? r.state : s;
  assert.equal(spotMastery(s, "brook").n, before + 2);
  // 교체 — 빠져나감은 여기서, 성공은 tryStore 가 한 번만
  r = tryStoreSwap(s, cs[6], aquaOf(s).fish[0].id, 0, 0.5, NOW, TODAY); assert.ok(r.ok && r.outcome === "slipped"); s = r.ok ? r.state : s;
  assert.equal(spotMastery(s, "brook").n, before + 3);
  r = tryStoreSwap(s, cs[7], aquaOf(s).fish[0].id, 1, 0, NOW, TODAY); assert.ok(r.ok && r.outcome === "stored"); s = r.ok ? r.state : s;
  assert.equal(spotMastery(s, "brook").n, before + 4, "교체 성공도 한 번만");
  assert.equal(spotMastery(s, "brook").n, fishingOf(s).landed, "f.landed 와 같은 기준");
  // 안 세는 것
  const n0 = spotMastery(s, "brook").n;
  const junk = rollCatch(brook, 1, 0.4, 1, { bait: 0 });
  const j = haulJunk(s, { ...junk, junk: "junk_can" }, TODAY); assert.ok(j.ok); s = j.ok ? j.state : s;
  assert.equal(noteMastery(s, specialCatch("bottle", "b1", "유리병")), s, "특별한 것은 같은 상태 그대로");
  assert.equal(noteMastery(s, { ...cs[8], boss: "dolsoe" }), s, "주인은 안 센다");
  assert.equal(noteMastery(s, { ...cs[8], at: undefined }), s, "어디서 문 줄 모르는 옛 물고기");
  assert.equal(spotMastery(s, "brook").n, n0);
  // 다른 낚시터는 따로
  const sea = catchesAt(spotOf("harbor")!, 1, 1)[0];
  const h = sellCatch(s, sea, TODAY); assert.ok(h.ok);
  if (h.ok) { assert.equal(spotMastery(h.state, "harbor").n, 1); assert.equal(spotMastery(h.state, "brook").n, n0); }
});

test("종류는 모습마다 한 번 · 상한이 있다 · 망가진 저장은 0 으로 읽는다", () => {
  let s = island();
  const c = catchesAt(brook, 1)[0];
  for (let i = 0; i < 5; i++) s = noteMastery(s, c);
  assert.deepEqual(spotMastery(s, "brook"), { n: 5, kinds: [catchArt(c)] });
  let big = withFishPlus(s, { mastery: { brook: { n: 3, kinds: Array.from({ length: MASTERY_KINDS_CAP }, (_, i) => `k${i}`) } } });
  big = noteMastery(big, { ...c, species: "new_one", stage: 2 });
  assert.equal(spotMastery(big, "brook").kinds.length, MASTERY_KINDS_CAP);
  assert.equal(spotMastery(big, "brook").n, 4, "수는 계속 센다");
  const broken = withFishPlus(s, { mastery: { brook: { n: "x", kinds: [1, "a"] }, pond: 7 } });
  assert.deepEqual(spotMastery(broken, "brook"), { n: 0, kinds: ["a"] });
  assert.equal(spotStars(broken, "pond"), 0);
});

test("별 문턱 — 수와 종류 둘 다 · 늘 오른다 · ★5 는 진행 시뮬레이션의 머무는 던지기(최대 489번)보다 한참 뒤", () => {
  assert.equal(STAR_NEED.length, MAX_STARS);
  for (let i = 1; i < STAR_NEED.length; i++) assert.ok(STAR_NEED[i].n > STAR_NEED[i - 1].n && STAR_NEED[i].kinds > STAR_NEED[i - 1].kinds);
  assert.equal(starsFor({ n: 10_000, kinds: [] }), 0, "종류 없이 수만으론 안 된다");
  assert.equal(starsFor({ n: 9, kinds: Array(20).fill("x") }), 0, "종류만으론 안 된다");
  assert.equal(starsFor({ n: 150, kinds: Array(7).fill("x") }), 3);
  assert.equal(starsFor({ n: 1000, kinds: Array(10).fill("x") }), 5);
  assert.ok(STAR_NEED[2].n < 489 && STAR_NEED[4].n >= 2 * 489, "★3 은 지나가며, ★5 는 가장 오래 머무는 낚시터의 두 배 넘게");
  // 열심히 하는 커플(하루 60번 · 끌어올림 80%)로 한 곳 ★5 가 몇 주
  const days = STAR_NEED[4].n / (60 * 0.8);
  assert.ok(days >= 14 && days <= 35, `${days.toFixed(1)}일`);
});

test("모든 낚시터 — 낮 · 날씨 없음에서도 ★5 종류에 닿는다(시작 미끼 ~ 두 단계 위, 8,000번 안)", () => {
  const need = STAR_NEED[4].kinds;
  for (const s of SPOTS) {
    const min = baitIndex(spotMinBait(s).key), seen = new Set<string>();
    for (let b = min; b <= Math.min(BAITS.length - 1, min + 2); b++) {
      for (let i = 0; i < 8000 && seen.size < need; i++) {
        const c = rollCatch(s, 10, 0.5, (i * 7919 + 13 + b * 104729) >>> 0, { bait: b, when: DAY });
        seen.add(catchArt(c));
      }
    }
    assert.ok(seen.size >= need, `${s.key}: ${seen.size}/${need}`);
  }
});

test("보상 — 별마다 행운 +1 · ★4 팔기 +5% · 배경은 별이 있어야 · 고른 배경만 바뀐다", () => {
  let s = island();
  assert.equal(masteryLuck(s, "brook"), 0);
  s = withStars(s, "brook", 3);
  assert.equal(spotStars(s, "brook"), 3);
  assert.equal(masteryLuck(s, "brook"), 3 * MASTERY_LUCK_PER_STAR);
  assert.equal(masteryLuck(s, "pond"), 0, "그 낚시터에서만");
  assert.deepEqual(withMasteryLuck({ luck: 7, catch: 2 }, s, "brook"), { luck: 10, catch: 2 });
  const same = { luck: 7 };
  assert.equal(withMasteryLuck(same, s, "pond"), same, "덤이 없으면 같은 객체");
  assert.equal(masterySaleBonus(s, "brook"), 0);
  // 배경
  assert.equal(LOOK_STAR.dusk, 2); assert.equal(LOOK_STAR.night, 3);
  const r = setSpotLook(s, "brook", "night"); assert.ok(r.ok);
  if (r.ok) { assert.equal(spotLookOf(r.state, "brook"), "night"); assert.equal(spotLookOf(r.state, "pond"), null); }
  assert.equal(setSpotLook(withStars(island(), "brook", 1), "brook", "dusk").ok, false);
  const off = r.ok ? setSpotLook(r.state, "brook", null) : r; assert.ok(off.ok);
  if (off.ok) assert.equal(spotLookOf(off.state, "brook"), null);
  assert.equal(spotLookOf(withFishPlus(island(), { spotLook: { brook: "night" } }), "brook"), null, "별이 없으면 저장값이 있어도 없는 셈");
  // ★4 팔기
  const four = withStars(island(), "brook", 4), c = catchesAt(brook, 1)[0];
  assert.equal(masterySaleBonus(four, "brook"), MASTERY_SALE_BONUS);
  const a = sellCatch(island(), c, TODAY), b = sellCatch(four, c, TODAY);
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    assert.equal(a.coins, coinValue(c.difficulty));
    assert.equal(b.coins, Math.round(coinValue(c.difficulty) * 1.05));
  }
  // 빠져나간 절반에는 안 붙는다
  const sl = tryStore(four, c, 0, 0.5, NOW, TODAY); assert.ok(sl.ok);
  if (sl.ok) assert.equal(sl.coins, Math.round(coinValue(c.difficulty) / 2));
});

/** 시작 미끼 단계 위의 계열(미끼 1% 규칙이 걸리는 계열)의 확률 — catchTable 은 실제 뽑기를 센다 */
function rareRows(s: FishSpot, luck: number, bait: number, n: number) {
  const min = baitIndex(spotMinBait(s).key), base = Math.max(min, Math.min(bait, s.common ?? -1));
  return catchTable(s, luck, bait, "float", undefined, n).filter((r) => familyBaitTier(r.family) > base);
}

test("미끼 1% 규칙은 그대로 — ★5 의 행운 +5 는 귀한 계열 하나 · 미끼 한 단계에 0.05%p 남짓", () => {
  // 식으로: 귀한 계열 하나의 확률 = BAIT_STEP × (1 + 행운 × 0.012 + …) × (단계 차 + 1)
  const perStep = BAIT_STEP * 0.012 * MASTERY_LUCK_PER_STAR * MAX_STARS;
  assert.ok(perStep < 0.001, `한 단계 ${(perStep * 100).toFixed(3)}%p`);
  // 실제 뽑기로: 시작 미끼 한두 단계 위(사람들이 쓰는 미끼)
  let worstSum = 0, worstFam = 0;
  for (const s of SPOTS) {
    const min = baitIndex(spotMinBait(s).key);
    for (let b = min + 1; b <= Math.min(BAITS.length - 1, min + 2); b++) {
      const A = rareRows(s, 10, b, 12000), B = rareRows(s, 10 + MASTERY_LUCK_PER_STAR * MAX_STARS, b, 12000);
      const sum = B.reduce((n, r) => n + r.chance, 0) - A.reduce((n, r) => n + r.chance, 0);
      worstSum = Math.max(worstSum, Math.abs(sum));
      for (const r of B) worstFam = Math.max(worstFam, Math.abs(r.chance - (A.find((x) => x.family === r.family)?.chance ?? 0)));
      // 미끼 한 단계의 차이(약 1%)는 숙련도 덤보다 한참 크다 — 구조가 그대로
      if (b + 1 < BAITS.length) {
        const up = rareRows(s, 10, b + 1, 12000).reduce((n, r) => n + r.chance, 0) - A.reduce((n, r) => n + r.chance, 0);
        if (up > 0.005) assert.ok(Math.abs(sum) < up / 3, `${s.key} 미끼 ${b}: 덤 ${(sum * 100).toFixed(2)}%p / 한 단계 ${(up * 100).toFixed(2)}%p`);
      }
    }
  }
  assert.ok(worstSum < 0.006, `귀한 계열 합 ${(worstSum * 100).toFixed(2)}%p`);
  assert.ok(worstFam < 0.003, `계열 하나 ${(worstFam * 100).toFixed(2)}%p`);
});

/** 한 번 던질 때 판매 하트(econbalance.test 의 net 과 같은 어림 — 끌어올림 80% · 다 팔기 · 쓰레기 2하트) */
function gross(spot: FishSpot, bait: number, luck: number, sale = 0, n = 3000): number {
  let v = 0;
  for (let i = 0; i < n; i++) {
    const c = rollCatch(spot, luck, 0.6, (Math.imul(i + 1, 2654435761) + 7) >>> 0, { bait, junk: true });
    v += c.junk ? 2 : Math.round(coinValue(c.difficulty) * (1 + sale));
  }
  return (v / n) * 0.8;
}

// 1년 시뮬레이션 스크립트는 레포에 없다 — 그 결과(README §10.25 열심 하루 순수입 19,800)를 분모로, 가장 많이 버는 경우를 위로 어림한다:
// 하루 60번을 전부 ★5 낚시터에서 · 시작 미끼 · 행운 25 · 다 판다. 실제로는 ★4 이상 낚시터에서만 · 담는 물고기는 덤이 없다.
test("경제 — 한 낚시터 ★5(행운 +5 · 팔기 +5%)를 하루 내내 써도 열심히 하는 커플 하루 순수입(README §10.25, 19,800)의 3% 안 · 각성 주인 첫 토벌 합", () => {
  const DAILY_HARD = 19_800, CASTS = 60;
  let worst = 0, where = "", luckOnly = 0;
  for (const s of SPOTS) {
    const bait = baitIndex(spotMinBait(s).key), base = gross(s, bait, 25);
    const extra = gross(s, bait, 25 + MAX_STARS * MASTERY_LUCK_PER_STAR, MASTERY_SALE_BONUS) - base;
    luckOnly = Math.max(luckOnly, gross(s, bait, 25 + MAX_STARS * MASTERY_LUCK_PER_STAR) - base);
    if (extra > worst) { worst = extra; where = s.key; }
  }
  const perDay = worst * CASTS;
  assert.ok(perDay / DAILY_HARD < 0.03, `${where}: 한 번 +${worst.toFixed(2)} · 하루 +${Math.round(perDay)} (${((perDay / DAILY_HARD) * 100).toFixed(2)}%)`);
  assert.ok(luckOnly * CASTS / DAILY_HARD < 0.01, `행운 덤만 하루 +${Math.round(luckOnly * CASTS)}`);
  // 각성한 주인 — 처음만 1.5배, 다시 잡기는 0(주인 다시 잡기 수입을 두 배로 만들지 않는다)
  const first = BOSSES.reduce((n, b) => n + bossReward(bossOf(`${b.key}_awake`)!, 0), 0);
  assert.equal(first, BOSSES.reduce((n, b) => n + Math.round(b.coins * 1.5), 0));
  for (const b of BOSSES) assert.equal(bossReward(bossOf(`${b.key}_awake`)!, 1), 0, b.key);
  assert.equal(bossReward(BOSSES[0], 1), Math.round(BOSSES[0].coins * BOSS_REPEAT_SHARE), "옛 주인 보상은 그대로");
});

test("저장 — fishPlus 는 낚시 저장을 지나도 남고, 옛 앱이 s.fishing 을 아는 칸으로 다시 지어도 별은 그대로", () => {
  let s = withStars(island(), "brook", 3);
  const sl = setSpotLook(s, "brook", "dusk"); assert.ok(sl.ok); s = sl.ok ? sl.state : s;
  const keep = fishPlusOf(s);
  const steps = [
    (x: IslandState) => buyBait(x, "bait_shrimp", TODAY),
    (x: IslandState) => spendBait(x, brook, "float", "bait_worm", TODAY, 12),
  ];
  for (const f of steps) { const r = f(s); assert.ok(r.ok); if (r.ok) { assert.deepEqual(r.state.fishPlus?.spotLook, keep.spotLook); assert.deepEqual(masteryOf(r.state), masteryOf(s)); s = r.state; } }
  // 옛 앱 — fishingOf 로 아는 칸만 다시 짓고(모르는 칸은 버린다) 맨 위 칸은 ...st 로 흘린다
  const rebuilt: IslandState = { ...s, fishing: fishingOf({ fishing: { ...fishingOf(s), mastery: { brook: { n: 0 } } } as never }) };
  assert.equal(spotStars(rebuilt, "brook"), 3);
  assert.equal(spotLookOf(rebuilt, "brook"), "dusk");
  assert.equal("mastery" in (rebuilt.fishing as object), false, "s.fishing 안에는 두지 않는다");
  // 다른 갈래의 칸도 그대로
  const other = withFishPlus(s, { bottles: [{ id: "b1" }] });
  const after = noteMastery(other, catchesAt(brook, 1)[0]);
  assert.deepEqual(fishPlusOf(after).bottles, [{ id: "b1" }]);
});

test("각성한 주인 — ★5 · 그 낚시터 주인 한 번 토벌 뒤에만 · 기록은 fishPlus.awake · 더 세고 처음만 1.5배", () => {
  const base = BOSSES.find((b) => b.spot === "brook")!;
  const awake = bossOf(`${base.key}_awake`)!;
  assert.equal(awake.name, `각성한 ${base.name}`);
  assert.equal(awake.difficulty, Math.round((base.difficulty + 1) * 10) / 10);
  assert.ok(awake.chunk < base.chunk);
  assert.equal(awake.coins, Math.round(base.coins * 1.5));
  assert.equal(awake.species, base.species);
  assert.equal(bossOf(base.key), base, "옛 주인은 그대로");
  assert.equal(bossOf("nope_awake"), undefined);

  let s = island();
  assert.equal(awakeBossAt(s, "brook"), null);
  s = withStars(s, "brook", AWAKE_STAR);
  assert.equal(awakeBossAt(s, "brook"), null, "주인을 아직 안 잡았다");
  assert.equal(bossOpen(s, awake.key, "me", TODAY).ok, false);
  const caught: BossRecord = { hp: 1, at: "2026-11-01", tries: {}, caught: 1, until: "" };
  s = { ...s, fishing: { ...fishingOf(s), bosses: { [base.key]: caught } } };
  assert.equal(awakeBossAt(s, "brook")?.key, awake.key);
  assert.equal(awakeBossAt(withStars(s, "brook", 4), "brook"), null, "★4 면 아직");

  const o = bossOpen(s, awake.key, "me", TODAY); assert.ok(o.ok);
  s = o.ok ? o.state : s;
  assert.deepEqual(fishingOf(s).bosses[base.key], caught, "옛 주인 기록은 그대로");
  assert.equal(fishingOf(s).bosses[awake.key], undefined, "s.fishing.bosses 에는 안 쓴다");
  assert.equal(bossRecOf(s, awake.key)?.tries.me.n, 1);
  // 깎기 · 돌려주기 · 토벌
  const l = bossLost(s, awake.key, 0.1, TODAY, "me", 0, 1); assert.ok(l.ok); s = l.ok ? l.state : s;
  assert.ok((bossRecOf(s, awake.key)?.hp ?? 1) < 1);
  const rf = bossRefund(s, awake.key, "me", TODAY); assert.ok(rf.ok);
  const coins = s.coins;
  const w = bossWon(s, awake.key, "me", TODAY, 0); assert.ok(w.ok); s = w.ok ? w.state : s;
  assert.equal(s.coins - coins, awake.coins, "처음은 1.5배");
  assert.equal(bossRecOf(s, awake.key)?.caught, 1);
  assert.deepEqual(fishingOf(s).bosses[base.key], caught);
  // 같은 토벌을 다시 저장해도 두 번 안 준다
  const again = bossWon(s, awake.key, "me", TODAY, 0); assert.ok(again.ok); if (again.ok) assert.equal(again.state, s);
  // 왕관 — 수조에 '각성한 …' 으로 들어온다 · 숙련도는 안 센다
  const c = bossCatch(awake);
  const st = tryStore(s, c, 1, 0, NOW, TODAY); assert.ok(st.ok);
  if (st.ok) {
    assert.ok(aquaOf(st.state).fish.some((f) => f.crown === awake.name));
    assert.equal(spotMastery(st.state, "brook").n, spotMastery(s, "brook").n);
  }
  // 옛 앱이 s.fishing 을 다시 지어도 각성 기록은 남는다
  const rebuilt: IslandState = { ...s, fishing: fishingOf(s) };
  assert.equal(bossRecOf(rebuilt, awake.key)?.caught, 1);
});

test("화면 — 행운 덤은 eff 한 곳 · 낚시터 고르기에 별 · 배경은 하늘 위 한 겹(시간은 그대로) · 수집 탭에 숙련도 · 레이드는 bossRecOf", () => {
  const strip = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const game = strip("src/components/FishingGame.tsx");
  assert.match(game, /const eff = withMasteryLuck\(buffedStats\(st, fs, clock\(\)\), st, spot\.key\);/);
  assert.match(game, /rollCatch\(spot, eff\.luck,/, "뽑기가 같은 eff 를 쓴다");
  assert.match(game, /luck=\{eff\.luck\}/, "물고기 표도");
  assert.match(game, /spotStars\(st, x\.key\)/);
  assert.match(game, /\{look && <i className=\{`fish-look l-\$\{look\}`\} aria-hidden \/>\}/);
  assert.doesNotMatch(game, /\.bosses\[/, "주인 기록은 bossRecOf 로만(각성한 주인은 fishPlus 에 있다)");
  assert.match(game, /masterySaleBonus\(st, fish\.at\)/, "팔기 버튼 값 = 실제 받는 값");
  assert.match(strip("src/components/FishCollect.tsx"), /<FishMastery \{\.\.\.p\} \/>/);
  const css = readFileSync(join(process.cwd(), "src/styles/games.css"), "utf8");
  assert.match(css, /\.fish-look\.l-dusk/); assert.match(css, /\.fish-look\.l-night/);
  // 별은 글자(★ ☆)로 — 이모지가 아니다
  assert.doesNotMatch(strip("src/components/FishMastery.tsx"), /\p{Extended_Pictographic}(?<![★☆])/u);
});
