// 미끼 만들기(2026-11-12) — 남는 쓰레기만 쓰기 · 재료 부족 · 던질 때 횟수 · 미끼 1% 규칙 그대로 · 덤의 크기 · fishPlus 저장(옛 앱의 s.fishing 다시 짓기)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CROPS, createIsland, type IslandState } from "./island.ts";
import { BAITS, SPOTS, baitIndex, buyBait, captureChance, catchTable, fishingOf, haulJunk, rollCatch, sellCatch, spendBait, waitPlan, type FishCatch } from "./fishing.ts";
import { addFish, aquaOf, junkCoupons, makeFood, releaseReward, saleValue } from "./aquarium.ts";
import { kgOf, noteSize, rollCm, type SizeBook } from "./fishingworld.ts";
import { fishPlusOf, lureChance } from "./fishplus.ts";
import { rollBottle, sendBottle } from "./fishbottle.ts";
import {
  CRAFT_BAITS, CRAFT_CROPS, CRAFT_RECIPES, GLOW_TROPHY, SCENT_WAIT, SHINE_SPECIAL, STICKY_CAPTURE, castBlockCraft, craftAsBait, craftBait, craftEffects, craftInUse, craftJunkSpent,
  craftLeft, craftStock, craftTier, craftWhy, glowActive, spareJunk, spareJunkTotal, spendCraft, usableJunk,
} from "./fishcraft.ts";

const NOW = Date.UTC(2026, 10, 12, 3);
const DAY = "2026-11-12";
const spot = (k: string) => SPOTS.find((x) => x.key === k)!;
const code = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** 재료가 넉넉한 섬 — 같은 쓰레기 여러 개 · 작물 · 하트 */
function rich(junk: Record<string, number>, barn: Record<string, number> = {}, coins = 10000): IslandState {
  const s = createIsland("펫", null, NOW);
  const f = fishingOf(s);
  return {
    ...s,
    coins,
    fishing: { ...f, level: 20, junk },
    farm: { ...s.farm, barn: Object.fromEntries(Object.entries(barn).map(([k, n]) => [k, { qty: n, star: 3 }])) },
  };
}

test("만들기 — 남는 쓰레기만 쓴다(처음 하나는 수집함에) · 수집함 숫자는 그대로 · 작물 · 하트가 빠진다", () => {
  const s = rich({ junk_can: 3, junk_boot: 1, junk_bag: 2 }, { corn: 2 });
  assert.deepEqual(spareJunk(s), { junk_can: 2, junk_bag: 1 }, "장화는 하나뿐이라 남는 게 없다");
  const r = craftBait(s, "glow", NOW);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  if (!r.ok) return;
  assert.deepEqual(fishingOf(r.state).junk, { junk_can: 3, junk_boot: 1, junk_bag: 2 }, "수집함 · 목표 · 쿠폰이 읽는 숫자는 줄지 않는다");
  assert.deepEqual(craftJunkSpent(r.state), { junk_can: 2, junk_bag: 1 }, "많이 남은 것부터 장부에");
  assert.equal(spareJunkTotal(r.state), 0);
  assert.equal(r.state.farm.barn.corn.qty, 1, "옥수수 하나");
  assert.equal(r.state.farm.barn.corn.star, 3, "별은 그대로");
  assert.equal(r.state.coins, s.coins - 150);
  assert.equal(craftLeft(r.state, "craft_glow"), 10);
  assert.equal(junkCoupons(r.state, aquaOf(r.state)), junkCoupons(s, aquaOf(s)) - 3, "같은 쓰레기를 수조 먹이 쿠폰으로 또 쓰지 못한다");
  // 두 번째는 모자란다 — 상태는 그대로
  const again = craftBait(r.state, "glow", NOW);
  assert.equal(again.ok, false);
  // 작물을 다 쓰면 창고 칸이 빠진다
  const s2 = rich({ junk_can: 6 }, { corn: 1, pumpkin: 1 });
  const r2 = craftBait(s2, "sticky", NOW);
  assert.ok(r2.ok);
  if (r2.ok) {
    assert.equal(r2.state.farm.barn.corn, undefined);
    assert.equal(r2.state.farm.barn.pumpkin, undefined);
    assert.equal(craftLeft(r2.state, "craft_sticky"), 10);
  }
});

test("재료가 모자라면 못 만든다 — 이유를 말하고 아무것도 안 바뀐다", () => {
  const firsts = rich({ junk_can: 1, junk_boot: 1, junk_bag: 1, junk_sock: 1 }, { strawberry: 5 });
  assert.match(craftWhy(firsts, "scent_fruit", NOW) ?? "", /남는 쓰레기/, "처음 건진 하나씩은 못 쓴다");
  const noCrop = rich({ junk_can: 5 });
  assert.match(craftWhy(noCrop, "scent_fruit", NOW) ?? "", /과일/);
  const poor = rich({ junk_can: 5 }, { strawberry: 2 }, 50);
  assert.match(craftWhy(poor, "scent_fruit", NOW) ?? "", /하트가 40개 모자라요/);
  const noFry = rich({ junk_can: 5 });
  assert.match(craftWhy(noFry, "scent_fry", NOW) ?? "", /치어/);
  assert.equal(craftWhy(rich({ junk_can: 5 }), "nope", NOW), "없는 만들기예요");
  const r = craftBait(poor, "scent_fruit", NOW);
  assert.equal(r.ok, false);
  // 쿠폰을 먹이로 다 바꿨으면 남는 쓰레기도 이미 쓴 것이다
  let s = rich({ junk_can: 9 }, { strawberry: 2 });
  assert.equal(usableJunk(s), 8);
  for (let i = 0; i < 3; i++) {
    const m = makeFood(s, "star", NOW);
    if (m.ok) s = m.state;
  }
  assert.equal(junkCoupons(s, aquaOf(s)), 1, "9 − 별빛 먹이 8");
  assert.equal(usableJunk(s), 1);
  assert.match(craftWhy(s, "scent_fruit", NOW) ?? "", /먹이로 이미 바꿨어요/);
});

test("작은 물고기 — 흔함 · 보통 치어 중 돌려받는 하트가 가장 적은 것을 쓴다 · 다 큰 물고기 · 주인은 안 쓴다", () => {
  let s = rich({ junk_can: 4 });
  s = addFish(s, "guppy", 0, undefined, NOW, undefined, 3, saleValue(0));
  s = addFish(s, "arowana", 0, undefined, NOW, undefined, 30, saleValue(4));
  s = addFish(s, "tetra", 2, "neon_tetra", NOW);
  const before = aquaOf(s).fish.length;
  const r = craftBait(s, "scent_fry", NOW);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  if (!r.ok) return;
  const left = aquaOf(r.state).fish;
  assert.equal(left.length, before - 1);
  assert.ok(!left.some((f) => f.family === "guppy"), "구피 치어를 썼다");
  assert.ok(left.some((f) => f.family === "arowana"), "귀한 계열 치어는 안 쓴다");
  assert.equal(craftLeft(r.state, "craft_scent"), 10);
  assert.equal(r.state.coins, s.coins - 120);
});

test("던질 때 — 만든 미끼 횟수만 줄고 산 미끼 · 공짜 지렁이는 그대로 · 심해는 2개 · 다 쓰면 못 던진다", () => {
  const made = craftBait(rich({ junk_can: 5 }, { strawberry: 2 }), "scent_fruit", NOW);
  assert.ok(made.ok);
  if (!made.ok) return;
  const s = made.state;
  const brook = spot("brook");
  const a = spendCraft(s, brook, "float", "craft_scent", DAY, 22.5);
  assert.ok(a.ok);
  if (!a.ok) return;
  assert.equal(craftLeft(a.state, "craft_scent"), 9);
  assert.deepEqual(fishingOf(a.state).baits, fishingOf(s).baits, "산 미끼는 그대로");
  assert.equal(fishingOf(a.state).wormDay, fishingOf(s).wormDay, "공짜 지렁이 채운 날을 건드리지 않는다(채우지 않은 채 날짜만 넘기면 지렁이를 잃는다)");
  assert.equal(fishingOf(a.state).bestCast, 22.5);
  assert.equal(fishingOf(a.state).dayCast, 22.5);
  const d = spendCraft(a.state, brook, "deep", "craft_scent", DAY);
  assert.ok(d.ok);
  if (d.ok) assert.equal(craftLeft(d.state, "craft_scent"), 7, "심해는 미끼 2개");
  // 하나 남았을 때 심해는 못 던지고, 다 쓰면 칸이 빠진다
  let x: IslandState = s;
  for (let i = 0; i < 9; i++) { const r = spendCraft(x, brook, "float", "craft_scent", DAY); assert.ok(r.ok); if (r.ok) x = r.state; }
  assert.match(castBlockCraft(x, fishingOf(x), brook, "deep", "craft_scent", DAY) ?? "", /2개/);
  const last = spendCraft(x, brook, "float", "craft_scent", DAY);
  assert.ok(last.ok);
  if (!last.ok) return;
  assert.equal(craftStock(last.state).craft_scent, undefined);
  assert.match(castBlockCraft(last.state, fishingOf(last.state), brook, "float", "craft_scent", DAY) ?? "", /다 떨어졌어요/);
  assert.equal(spendCraft(last.state, brook, "float", "craft_scent", DAY).ok, false);
  assert.equal(craftInUse(last.state, fishingOf(last.state), brook, "float", "craft_scent", DAY), null, "떨어지면 화면은 산 미끼로 넘어간다");
  // 이 낚시터에서 안 무는 단계면 산 미끼와 같은 이유로 막는다(서귀포 문섬은 민물새우부터 — 향 미끼는 민물새우라 문다)
  assert.equal(castBlockCraft(s, { level: 50 }, spot("reef"), "float", "craft_scent", DAY), null);
  assert.match(castBlockCraft(s, { level: 50 }, spot("abyss"), "float", "craft_scent", DAY) ?? "", /부터 물어요/);
  assert.match(castBlockCraft(s, { level: 1 }, brook, "deep", "craft_scent", DAY) ?? "", /Lv/);
});

test("미끼 1% 규칙 그대로 — 만든 미끼는 그 단계 산 미끼와 같은 물고기 표 · 빛 미끼의 길이 뽑기는 계열 · 등급 · 단계를 바꾸지 않는다", () => {
  // 화면이 하는 그대로 — craftAsBait 의 bait 번호 + craftEffects 의 size 로 뽑아 같은 단계 산 미끼(덤 없음)와 물고기 표를 견준다(길이는 표에 없다)
  const when = { time: "night" as const, wx: null };
  const table = (sp: ReturnType<typeof spot>, bait: number, size: number) => {
    const rows = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const c = rollCatch(sp, 10, 0.4, (Math.imul(i + 1, 2654435761) + 11) >>> 0, { bait, method: "float", when, size });
      const k = `${c.family}|${c.stage}|${c.species ?? ""}|${c.grade}`;
      rows.set(k, (rows.get(k) ?? 0) + 1);
    }
    return [...rows].sort();
  };
  for (const c of CRAFT_BAITS) {
    const screen = baitIndex(craftAsBait(c).bait.key);
    const bought = BAITS.findIndex((b) => b.key === c.tier);
    assert.ok(screen >= 0 && screen === bought, `${c.name} 은 ${c.tier} 번호로 뽑는다`);
    for (const k of ["brook", "harbor", "ocean", "abyss"]) {
      const sp = spot(k);
      if (castBlockCraft(createIsland("펫", null, NOW), { level: 50 }, sp, "float", c.key, DAY)) continue;
      const fx = craftEffects(c.key, { spot: sp, method: "float", when });
      assert.deepEqual(table(sp, screen, fx.size), table(sp, bought, 0), `${c.name} @ ${k}`);
      assert.deepEqual(catchTable(sp, 10, screen, "float", when, 1000), catchTable(sp, 10, bought, "float", when, 1000));
    }
  }
  const sp = spot("ocean");
  const glow = baitIndex(CRAFT_BAITS.find((x) => x.key === "craft_glow")!.tier);
  for (let i = 0; i < 3000; i++) {
    const seed = (Math.imul(i + 1, 2654435761) + 7) >>> 0;
    const a = rollCatch(sp, 12, 0.6, seed, { bait: glow, method: "float", junk: true, when: { time: "night", wx: null } });
    const b = rollCatch(sp, 12, 0.6, seed, { bait: glow, method: "float", junk: true, when: { time: "night", wx: null }, size: GLOW_TROPHY });
    assert.deepEqual({ ...a, cm: 0 }, { ...b, cm: 0 }, "길이 말고는 똑같다");
    if (a.cm && b.cm) assert.ok(b.cm >= a.cm, "같은 주사위면 길어지기만 한다");
  }
});

test("덤의 크기 — 향 ×0.7 · 끈끈 +5%p(95% 상한) · 반짝 ×2(1 상한) · 빛은 대물 문턱만(최대 길이 그대로)", () => {
  for (const seed of [1, 9, 12345, 987654]) {
    const a = waitPlan(seed), b = waitPlan(seed, SCENT_WAIT);
    assert.ok(Math.abs(b.waitMs - a.waitMs * SCENT_WAIT) <= 1, "기다림 ×0.7");
    assert.equal(b.nibbles.length, a.nibbles.length, "간 보기 횟수는 그대로");
    assert.ok(b.nibbles.every((t) => t < b.waitMs + 300), "간 보기는 입질 전에");
  }
  assert.deepEqual(waitPlan(9), waitPlan(9, 1), "기본값이면 예전 그대로");
  assert.equal(captureChance(10, 2, 0.5, false, "float", STICKY_CAPTURE), Math.round((captureChance(10, 2, 0.5, false) + 0.05) * 100) / 100);
  assert.equal(captureChance(999, 0, 1, true, "scoop", STICKY_CAPTURE), 0.95, "상한은 그대로");
  assert.equal(captureChance(1, 0, 0, false, "float", 0), captureChance(1, 0, 0, false));
  assert.equal(lureChance(0.3, { lure: SHINE_SPECIAL }), 0.6);
  assert.equal(lureChance(0.8, { lure: SHINE_SPECIAL }), 1);
  assert.equal(lureChance(0.3, {}), 0.3);
  // 빛 미끼 — 밤 · 새벽 · 심해 방식 · 깊은 바다에서만
  assert.equal(glowActive({ spot: spot("brook"), method: "float", when: { time: "day", wx: null } }), false);
  assert.equal(glowActive({ spot: spot("brook"), method: "float", when: { time: "night", wx: null } }), true);
  assert.equal(glowActive({ spot: spot("brook"), method: "deep", when: { time: "day", wx: null } }), true);
  assert.equal(glowActive({ spot: spot("ocean"), method: "float", when: { time: "day", wx: null } }), true);
  assert.equal(glowActive({ spot: spot("harbor"), method: "float", when: { time: "day", wx: null } }), false);
  assert.equal(craftEffects("craft_glow", { spot: spot("harbor"), method: "float", when: { time: "day", wx: null } }).size, 0);
  assert.deepEqual(craftEffects(null, { spot: spot("brook"), method: "float" }), { wait: 1, size: 0, special: 1, capture: 0 });
  // 대물 비율 · 최대 길이
  let t0 = 0, t1 = 0, max0 = 0, max1 = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const r1 = ((i * 7919) % N) / N, r2 = ((i * 104729) % N) / N;
    const a = rollCm("mackerel", 0, 10, 0.4, r1, r2), b = rollCm("mackerel", 0, 10, 0.4, r1, r2, GLOW_TROPHY);
    const base = rollCm("mackerel", 0, 0, 0, 0.5, 0.5) / 1;
    if (a > base * 1.28) t0++;
    if (b > base * 1.28) t1++;
    max0 = Math.max(max0, a);
    max1 = Math.max(max1, b);
  }
  assert.ok(t1 / N - t0 / N <= GLOW_TROPHY + 0.01 && t1 > t0, `대물 비율 ${(t0 / N).toFixed(3)} → ${(t1 / N).toFixed(3)}`);
  assert.ok(max1 <= max0 * 1.01, "가장 긴 길이는 그대로");
});

test("빛 미끼의 하트 — 크기 기록 하트(recordCoins)가 늘어나는 몫은 만들 때 더 낸 몫보다 작다", () => {
  // 울릉도 앞바다 · 밤 · 오징어살 단계로 2,000번 끌어올렸을 때 크기 기록이 몇 번 나오나(같은 주사위, 빛 미끼만 다르다)
  const sp = spot("ocean");
  const tier = baitIndex("bait_squid");
  const run = (boost: number) => {
    let book: SizeBook = {}, n = 0, kg = 0;
    for (let i = 0; i < 2000; i++) {
      const seed = (Math.imul(i + 3, 2246822519) + 1) >>> 0;
      const c = rollCatch(sp, 12, 0.5, seed, { bait: tier, method: "float", when: { time: "night", wx: null }, size: boost });
      kg += kgOf(c.cm ?? 0);
      const r = noteSize(book, `${c.family}:${c.stage}:${c.species ?? ""}`, "me", c.cm ?? 0);
      book = r.book;
      if (r.note) n++;
    }
    return { n, kg };
  };
  const a = run(0), b = run(GLOW_TROPHY);
  // 기록 한 번 = recordCoins(최소 20 · 판매가의 2배). 깊은 바다 흔한 물고기는 판매가 15~40 이라 기록 하나에 30~80 하트
  const extra = (b.n - a.n) * 80;
  const paid = 2000 / 10 * (150 + 38 - 16 * 10); // 빛 미끼 200 묶음을 만들 때 산 오징어살보다 더 낸 하트(작물은 가장 싼 값)
  assert.ok(b.n >= a.n, `기록 ${a.n} → ${b.n}`);
  assert.ok(extra < paid, `기록 하트 +${extra} < 더 낸 하트 ${paid}`);
  assert.ok(b.kg >= a.kg, "원정 무게는 조금 는다");
});

test("반짝 미끼 — 유리병 편지가 두 배 잘 걸린다(주사위는 그대로)", () => {
  let s = createIsland("펫", null, NOW);
  const sent = sendBottle(s, "partner", "안녕", NOW - 3_600_000);
  assert.ok(sent.ok);
  if (sent.ok) s = sent.state;
  let a = 0, b = 0;
  for (let i = 0; i < 4000; i++) {
    const ctx = { who: "me", couple: true, spot: spot("brook"), method: "float" as const, seed: i * 7 + 1, now: NOW, today: DAY };
    if (rollBottle(s, ctx)) a++;
    if (rollBottle(s, { ...ctx, lure: SHINE_SPECIAL })) b++;
  }
  assert.ok(a > 0 && b > a * 1.8 && b < a * 2.2, `병 ${a} → ${b}`);
});

test("fishPlus 저장 — 낚시 저장을 지나도 · 옛 앱이 s.fishing 을 다시 지어도 만든 미끼 · 장부가 남는다", () => {
  const made = craftBait(rich({ junk_can: 6 }, { corn: 3 }), "glow", NOW);
  assert.ok(made.ok);
  if (!made.ok) return;
  const s = made.state;
  const keep = fishPlusOf(s);
  const c: FishCatch = { family: "mackerel", stage: 0, grade: "흔함", difficulty: 0, cm: 20, at: "harbor" };
  for (const r of [
    buyBait(s, "bait_shrimp", DAY),
    spendBait(s, spot("brook"), "float", "bait_worm", DAY, 10),
    haulJunk(s, { ...c, junk: "junk_can" }, DAY),
    sellCatch(s, c, DAY),
  ]) {
    assert.ok(r.ok);
    if (r.ok) {
      assert.deepEqual(fishPlusOf(r.state).craft, keep.craft);
      assert.deepEqual(fishPlusOf(r.state).craftJunk, keep.craftJunk);
    }
  }
  // 옛 앱 — 아는 칸만으로 s.fishing 을 다시 짓고 나머지는 ...st 로 흘린다(모르는 s.fishing 칸은 사라진다)
  const old = fishingOf(s);
  const rebuilt: IslandState = { ...s, fishing: { level: old.level, xp: old.xp, points: old.points, stats: old.stats, rod: old.rod, net: old.net, day: old.day, dayCoins: old.dayCoins, landed: old.landed, stored: old.stored, baits: old.baits, wormDay: old.wormDay, junk: { ...old.junk, junk_can: old.junk.junk_can + 1 } } as unknown as IslandState["fishing"] };
  assert.equal(craftLeft(rebuilt, "craft_glow"), 10, "만든 미끼는 s.fishing 밖에 있다");
  assert.deepEqual(craftJunkSpent(rebuilt), craftJunkSpent(s));
  assert.equal(spareJunkTotal(rebuilt), spareJunkTotal(s) + 1, "옛 앱이 건진 쓰레기는 남는 쪽에 더해진다");
  // 던지기도 fishPlus 의 다른 칸(편지 · 숙련도 …)을 지우지 않는다
  const withOther: IslandState = { ...s, fishPlus: { ...s.fishPlus, bottles: [{ id: "x" }], mastery: { brook: { n: 3, kinds: [] } } } };
  const t = spendCraft(withOther, spot("harbor"), "float", "craft_glow", DAY);
  assert.ok(t.ok);
  if (t.ok) {
    assert.deepEqual(fishPlusOf(t.state).bottles, [{ id: "x" }]);
    assert.deepEqual(fishPlusOf(t.state).mastery, { brook: { n: 3, kinds: [] } });
  }
});

test("경제 — 재료 바닥값(하트 + 가장 싼 작물 + 치어 보내 주기 값) ≥ 같은 단계 산 미끼로 같은 횟수", () => {
  // 알에서 난 치어는 보내 줘도 0 하트 — 치어는 값으로 치지 않는다(하트 + 작물만으로 산 미끼 값 이상)
  assert.equal(releaseReward({ family: "guppy", stage: 0, growH: 0, bred: true }), 0);
  const fryFloor = 0;
  for (const r of CRAFT_RECIPES) {
    const tier = craftTier(CRAFT_BAITS.find((x) => x.key === r.bait)!);
    const bought = (tier.price / tier.uses) * r.uses;
    const crops = r.crops ? Math.min(...r.crops.keys.map((k) => CRAFT_CROPS[k].sell)) * r.crops.n : 0;
    const floor = r.coins + crops + (r.fry ?? 0) * fryFloor;
    assert.ok(floor >= bought, `${r.id}: 바닥값 ${floor} < 산 미끼 ${bought}`);
    assert.ok(r.coins > 0, "하트를 늘 조금은 빨아들인다");
  }
  // 작물 표는 섬 표와 같다(이름 · 판매가) — 섬 엔진을 낚시 조각에 싣지 않으려고 따로 둔 사본
  for (const [k, v] of Object.entries(CRAFT_CROPS)) {
    const c = CROPS.find((x) => x.key === k);
    assert.ok(c, k);
    assert.equal(c!.name, v.name);
    assert.equal(c!.sell, v.sell);
    assert.ok(!c!.unique && !c!.legendXp, "전설 작물은 안 쓴다");
  }
});

test("화면 — 낚시 준비가 만든 미끼를 고르고, 쓸 때는 spendCraft · 뽑기는 그 단계 산 미끼 번호 · 장비 아래 칸이 FishCraft", () => {
  const src = code("src/components/FishingGame.tsx");
  assert.match(src, /ck \? spendCraft\(s, sp, m, ck, kstDate\(t\), castM, night\) : spendBait\(s, sp, m, key, kstDate\(t\), castM, night\), true\)/, '만든 미끼도 집어등 밤 판정을 같이 받는다');
  assert.match(src, /const \{ shown, bait \} = craft \? craftAsBait\(craft\) : currentBait\(fs, spot, baitPick/);
  assert.match(src, /waitPlan\(seed, tideEffect\(spot\.water, moment\.moon\)\.wait \* craftFx\.wait\)/, '물때 배율에 향 미끼 배율을 곱한다');
  assert.match(src, /size: craftFx\.size \}\)/);
  assert.match(src, /lure: craftFx\.special/);
  assert.match(src, /captureChance\(eff\.catch, fish\.difficulty, quality, perfectHook, method, craftEffects\(roundCraft/);
  assert.match(src, /function clearRound\(\) \{\s+setRoundCraft\(null\);/);
  assert.match(code("src/components/FishGearPlus.tsx"), /<FishCraft \{\.\.\.p\} \/>/);
  assert.doesNotMatch(code("src/lib/fishing.ts"), /from "\.\/fishcraft/, "fishing.ts 는 만들기를 모른다(선택 인자로만 받는다)");
  assert.doesNotMatch(code("src/lib/fishcraft.ts"), /^import \{[^}]*\} from "\.\/island\.ts"/m, "섬 엔진은 타입만");
});

test("집어등 — 만든 미끼도 산 미끼와 같은 밤 판정(낮엔 못 던지고 미끼도 안 쓴다)", async () => {
  const { CRAFT_BAITS: list, castBlockCraft: gate } = await import("./fishcraft.ts");
  const harbor = SPOTS.find((x) => x.water === "sea" && x.minLevel <= 12)!;
  const st = createIsland("콩", null, 0);
  const key = list[0].key;
  const day = gate(st, { level: 50 }, harbor, "light", key, "2026-11-12", false);
  assert.ok(day && day.includes("밤"), `낮엔 막힌다: ${day}`);
  const night = gate(st, { level: 50 }, harbor, "light", key, "2026-11-12", true);
  assert.ok(!night || !night.includes("밤"), `밤엔 밤 때문엔 안 막힌다: ${night}`);
});
