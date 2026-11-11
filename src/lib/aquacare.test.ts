// 우리 수조 보강(2026-11-05) lock — 리뷰에서 잰 버그(B1~B12) · 밸런스 · 새 기능(F1~F10).
// 저장 칸은 전부 옵셔널(무마이그레이션), 두 기기의 결과가 같아야 하고(Math.random 금지), 하트를 찍어 내는 길이 없어야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_FORMS, AQUA_COMBOS, AWAY_CAP_H, activeCombos, BREED_H, DUO_CARE_H, FAMILIES, GRADES, NET_HOURS, NET_MAX, RAISE_SHARE, SKEW_MS, TANK_CORE_MAX, TANK_GATES, TANK_TOP_LEGACY, TANKS, WATER_PRICES, tankGate, waterPrice,
  addFish, aquaLuck, aquaOf, buyDecor, claimRequest, cleanWater, familyOf, feedFish, fishCare, keepInNet, makeFood, makeRequest,
  moveDecor, netToTank, placeDecor, releaseFish, releaseReward, requestMet, saleValue, sellNet, stow, storeDecor, syncAqua,
  tickAqua, unseenNews, upgradeTank, widenTank, type AquaResult, type AquaState, type Island,
} from "./aquarium.ts";
import { SPOTS, TANK_FULL, buffedStats, formsSeen, coinValue, effectiveStats, fishingOf, releaseToSea, sellCatch, storeBlock, tryNet, tryStore, tryStoreSwap, xpValue, type FishCatch } from "./fishing.ts";
import { createIsland, type IslandState } from "./island.ts";

const H = 3_600_000;
const T0 = Date.UTC(2026, 10, 5, 3); // KST 정오
const DAY = "2026-11-05";
const rich = (coins = 1_000_000): IslandState => ({ ...createIsland("콩", null, T0), coins });
function must(r: AquaResult | { ok: true; state: IslandState } | { ok: false; reason: string }): Island {
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.ok ? r.state : (undefined as never);
}
const alienFish = { id: 900, family: "future_fish", stage: 1, growH: 3, goodH: 2, totalH: 3, species: "future_species" };
const alienDecor = { id: 901, key: "future_decor", x: 40, y: 40 };
/** 새 번들이 더한 계열이 든 수조 — 이 번들은 모른다 */
function withAlien(): IslandState {
  const st = addFish(rich(), "guppy", 0, undefined, T0);
  const a = st.aquarium!;
  return { ...st, aquarium: { ...a, fish: [...a.fish, alienFish as never], placed: [alienDecor as never] } };
}
const alienKept = (st: IslandState) => {
  assert.ok(st.aquarium?.fish.some((f) => f.family === "future_fish"), "모르는 물고기가 저장에 남는다");
  assert.ok(st.aquarium?.placed.some((p) => p.key === "future_decor"), "모르는 장식이 저장에 남는다");
  assert.ok(!aquaOf(st).fish.some((f) => f.family === "future_fish"), "정산 · 화면에선 뺀다");
};

test("B1 — 모르는 계열은 먹이 · 물 · 보내기 · 넓히기 · 담기 · 정산 · 장식 · 그물 어느 쓰기에서도 지워지지 않는다", () => {
  const st = withAlien();
  const id = aquaOf(st).fish[0].id;
  const paths: [string, () => IslandState][] = [
    ["tick", () => syncAqua(st, T0 + 30 * H).state],
    ["feed", () => must(feedFish({ ...st, aquarium: { ...st.aquarium!, hunger: 10 } }, T0 + H))],
    ["clean", () => must(cleanWater({ ...st, aquarium: { ...st.aquarium!, water: 10 } }, T0 + H))],
    ["release", () => must(releaseFish(st, id, T0 + H))],
    ["upgrade", () => must(upgradeTank(st, T0 + H))],
    ["widen", () => must(widenTank(st, T0 + H))],
    ["addFish", () => addFish(st, "tetra", 0, undefined, T0 + H)],
    ["buy+place", () => must(placeDecor(must(buyDecor(st, "coral", T0)), "coral", 50, 50, T0 + H))],
    ["net", () => must(keepInNet(st, { family: "guppy", stage: 0, difficulty: 0, value: 15 }, T0))],
    ["swap", () => must(tryStoreSwap(st, { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 }, id, 1, 0, T0 + H, DAY))],
  ];
  for (const [name, run] of paths) {
    const out = run();
    try { alienKept(out); } catch (e) { throw new Error(`${name}: ${(e as Error).message}`); }
    // 다시 읽고 다시 써도 그대로(두 번째 저장에서 지워지지 않는다)
    alienKept(syncAqua(out, T0 + 50 * H).state);
  }
  // 모르는 물고기도 자리를 차지한다 — 새 앱에서 보면 넘치면 안 된다
  let full = withAlien();
  while (storeBlock(full, { family: "guppy" }) === null) full = addFish(full, "guppy", 0, undefined, T0);
  assert.equal(aquaOf(full).fish.length + 1, TANKS[0].fish);
});

test("B2 — 상대 시계가 앞서 저장한 시각은 지금으로 다시 잡는다(그동안 자라지도 줄지도 않는다) · 5분 안은 그대로", () => {
  const st = addFish(rich(), "guppy", 0, undefined, T0);
  const ahead = { ...st, aquarium: { ...st.aquarium!, at: T0 + 72 * H } };
  const s = syncAqua(ahead, T0);
  assert.equal(s.a.at, T0);
  assert.equal(s.a.hunger, 100);
  assert.ok(s.dirty, "보정한 시각은 한 번 저장한다");
  const later = syncAqua(s.state, T0 + 6 * H).a;
  assert.ok(later.fish[0].growH > 5, "보정 뒤엔 바로 자란다 — 예전엔 72시간 동안 멈췄다");
  assert.ok(must(feedFish({ ...ahead, aquarium: { ...ahead.aquarium!, hunger: 50 } }, T0)).aquarium!.at === T0);
  const near = { ...st, aquarium: { ...st.aquarium!, at: T0 + SKEW_MS - 1000 } };
  assert.equal(syncAqua(near, T0).a.at, T0 + SKEW_MS - 1000, "몇 분 차이는 시계 오차로 치지 않는다");
});

test("B3 — 120시간 방치를 한 번에 정산해도 6시간마다 정산해도 정성이 같다 · 방치 구간마다 48시간까지만", () => {
  const st = addFish(rich(), "koi", 0, undefined, T0);
  const once = tickAqua(aquaOf(st), T0 + 120 * H).a.fish[0];
  let a = aquaOf(st);
  for (let h = 6; h <= 120; h += 6) a = tickAqua(a, T0 + h * H).a;
  const split = a.fish[0];
  assert.ok(Math.abs(once.totalH - split.totalH) < 1e-6, `${once.totalH} vs ${split.totalH}`);
  assert.equal(fishCare(once), fishCare(split));
  assert.ok(once.totalH - once.goodH <= AWAY_CAP_H + 1e-6);
  // 먹이를 주고 다시 방치하면 새 방치 구간 — 다시 48시간까지 센다
  let s = must(feedFish(must(cleanWater(syncAqua(st, T0 + 120 * H).state, T0 + 120 * H)), T0 + 120 * H));
  s = syncAqua(s, T0 + 300 * H).state;
  const f = aquaOf(s).fish[0];
  assert.ok(f.totalH - f.goodH <= 2 * AWAY_CAP_H + 1e-6 && f.totalH - f.goodH > AWAY_CAP_H, `${f.totalH - f.goodH}`);
  // 자주 낚아서 addFish 가 자주 정산해도 벌받지 않는다
  let busy = addFish(rich(), "koi", 0, undefined, T0);
  for (let h = 1; h <= 120; h++) busy = { ...busy, aquarium: syncAqua(busy, T0 + h * H).state.aquarium, aquaPlus: syncAqua(busy, T0 + h * H).state.aquaPlus } as IslandState;
  assert.equal(fishCare(aquaOf(busy).fish[0]), fishCare(once));
});

test("B4 · F1 — 자란 소식은 두 사람이 각자 한 번씩 본다 · 낚시하다 자라도 결과에 실린다", () => {
  const st = addFish(rich(), "guppy", 1, undefined, T0);
  const grown = syncAqua(st, T0 + 20 * H).state;
  assert.equal(unseenNews(aquaOf(grown), "a").length, 1);
  assert.equal(unseenNews(aquaOf(grown), "b").length, 1);
  // 낚시로 담는 순간 정산되며 자랐다 — 낚은 사람(a)은 결과 카드에서 보고, b 는 수조에서 본다
  const r = tryStore(st, { family: "tetra", stage: 0, grade: "흔함", difficulty: 0 }, 1, 0, T0 + 20 * H, DAY, { who: "a", couple: true });
  assert.ok(r.ok && r.grown?.length === 1 && r.grown[0].stage === 2);
  if (!r.ok) return;
  assert.equal(unseenNews(aquaOf(r.state), "a").length, 0);
  assert.equal(unseenNews(aquaOf(r.state), "b").length, 1);
});

test("B5 · B7 — 수조에서 자란 어린 모습 · 담은 치어가 도감에 오른다 · '못 만난 형태 먼저'는 낚시 기록도 본다", () => {
  const st = addFish(rich(), "guppy", 0, undefined, T0);
  assert.ok(aquaOf(st).dex.includes("fry_guppy"));
  const juv = syncAqua(st, T0 + 12 * H).a;
  assert.equal(juv.fish[0].stage, 1);
  assert.ok(juv.dex.includes("juv_guppy"));
  // 낚시로 첫 형태를 이미 만났다면 정성이 열어 준 다른 형태가 먼저 나온다
  const fam = familyOf("guppy")!;
  const met = { ...st, fishing: { ...fishingOf(st), seen: [fam.finals[0].key] } } as IslandState;
  let s = met;
  for (let h = 6; h <= 48; h += 6) s = must(feedFish(syncAqua(s, T0 + h * H).state, T0 + h * H));
  const f = aquaOf(syncAqua(s, T0 + 60 * H).state).fish[0];
  assert.equal(f.stage, 2);
  assert.notEqual(f.species, fam.finals[0].key);
});

test("B6 — 잡기 → 담기 → 보내기 · 그물 · 알 어느 길도 그 자리에서 판 것보다 하트가 많지 않다(모든 계열 · 단계)", () => {
  for (const fam of FAMILIES) {
    for (const stage of [0, 1, 2] as const) {
      const sp = stage === 2 ? fam.finals[fam.finals.length - 1] : undefined;
      const c: FishCatch = { family: fam.key, stage, ...(sp ? { species: sp.key } : {}), grade: (sp ?? fam.finals[0]).grade, difficulty: GRADES.indexOf((sp ?? fam.finals[0]).grade) + stage * 0.5 };
      const big = { ...rich(0), aquarium: { ...aquaOf(rich(0), T0), tank: 6 } } as IslandState;
      const sold = must(sellCatch(big, c, DAY)).coins;
      const stored = must(tryStore(big, c, 1, 0, T0, DAY));
      const id = aquaOf(stored).fish.at(-1)!.id;
      const released = must(releaseFish(stored, id, T0)).coins;
      assert.ok(released <= sold, `${fam.key}/${stage}: 담고 바로 보내기 ${released} > 팔기 ${sold}`);
      // 다 키워서 보내도 다 큰 놈을 잡아 판 값보다 적다
      const adultSale = saleValue(GRADES.indexOf(fam.finals[fam.finals.length - 1].grade) + 1);
      const grownFish = { ...aquaOf(stored).fish.at(-1)!, stage: 2 as const, species: fam.finals[fam.finals.length - 1].key, growH: fam.hours };
      assert.ok(releaseReward(grownFish) <= Math.max(adultSale, coinValue(c.difficulty)), `${fam.key}/${stage}: 다 키워 보내기 ${releaseReward(grownFish)}`);
      // 그물에 두었다 팔아도 · 기한이 지나 저절로 팔려도 판 값 그대로
      const full = { ...big, aquarium: { ...big.aquarium!, fish: Array.from({ length: TANKS[5].fish }, (_, i) => ({ id: 100 + i, family: "guppy", stage: 0 as const, growH: 0, goodH: 0, totalH: 0 })) } } as IslandState;
      const netted = must(tryNet(full, c, 1, 0, T0, DAY));
      assert.equal(must(sellNet(netted, 0, T0)).coins, sold);
      assert.equal(syncAqua(netted, T0 + NET_HOURS * H).state.coins, sold);
    }
  }
  // 알에서 난 물고기는 잡은 값이 없다 — 키운 몫의 RAISE_SHARE 만
  const fam = familyOf("kraken")!;
  assert.equal(releaseReward({ family: "kraken", stage: 0, growH: 0, bred: true, caughtStage: 0, catchV: 0 }), 0);
  assert.equal(releaseReward({ family: "kraken", stage: 2, species: "kraken", growH: fam.hours, bred: true, caughtStage: 0, catchV: 0 }), Math.round(saleValue(GRADES.indexOf("태초") + 1) * RAISE_SHARE));
});

test("F4 — 보내 주면 키운 몫만큼 낚시 경험치 · 바로 보내면 0 · 계열별 기록이 남는다", () => {
  const st = addFish(rich(), "guppy", 0, undefined, T0);
  const id = aquaOf(st).fish[0].id;
  const now = must(releaseToSea(st, id, T0));
  assert.equal(fishingOf(now).xp, fishingOf(st).xp, "바로 보내면 경험치가 없다(잡을 때 이미 받았다)");
  assert.equal(aquaOf(now).released?.guppy, 1);
  const raised = syncAqua(must(feedFish(syncAqua(st, T0 + 10 * H).state, T0 + 10 * H)), T0 + 30 * H).state;
  const r = releaseToSea(raised, id, T0 + 30 * H);
  assert.ok(r.ok && r.xp > 0 && r.xp <= xpValue(GRADES.indexOf("희귀") + 1));
});

test("F5 — 대기 그물: 가득 찼을 때만 · 세 마리까지 · 수조로 옮기기 · 24시간이 지나면 다음 정산에서 저절로 판다", () => {
  let st = rich(0);
  for (let i = 0; i < TANKS[0].fish; i++) st = addFish(st, "guppy", 0, undefined, T0);
  const c: FishCatch = { family: "tetra", stage: 0, grade: "흔함", difficulty: 0 };
  assert.equal(storeBlock(st, c), TANK_FULL);
  assert.equal(tryNet(rich(0), c, 1, 0, T0, DAY).ok, false, "자리가 있으면 그물이 아니라 수조로");
  for (let i = 0; i < NET_MAX; i++) st = must(tryNet(st, c, 1, 0, T0 + i, DAY));
  assert.equal(aquaOf(st).net?.length, NET_MAX);
  assert.equal(tryNet(st, c, 1, 0, T0, DAY).ok, false);
  assert.equal(netToTank(st, 0, T0 + H).ok, false, "수조가 차 있으면 못 옮긴다");
  const freed = must(releaseFish(st, aquaOf(st).fish[0].id, T0 + H));
  const moved = must(netToTank(freed, 0, T0 + H));
  assert.equal(aquaOf(moved).net?.length, NET_MAX - 1);
  assert.equal(aquaOf(moved).fish.at(-1)!.family, "tetra");
  const expired = syncAqua(moved, T0 + (NET_HOURS + 1) * H);
  assert.equal(expired.a.net?.length, 0);
  assert.equal(expired.netSold, 2);
  assert.equal(expired.state.coins, moved.coins + 2 * coinValue(0));
  assert.ok(expired.dirty);
  // 그물 · 소식 같은 새 칸은 섬의 맨 위 칸에 산다 — 옛 앱이 수조 칸을 다시 만들어 저장해도 남는다
  const old = { ...st, aquarium: { ...st.aquarium!, fish: st.aquarium!.fish.slice(0, 2) } } as Island;
  assert.equal(aquaOf(old).net?.length, NET_MAX);
});

test("F3 — 둘이 같은 날 돌보면 하루 한 번 정성 보너스 · 혼자 섬(사람 하나)은 그대로", () => {
  const st = { ...addFish(rich(), "koi", 0, undefined, T0) } as IslandState;
  const low = (s: IslandState) => ({ ...s, aquarium: { ...s.aquarium!, hunger: 50, water: 50 } }) as IslandState;
  const a1 = must(feedFish(low(st), T0, { who: "a" }));
  const g0 = aquaOf(a1).fish[0].goodH;
  const b1 = must(cleanWater(low(a1), T0 + 1000, { who: "b" }));
  assert.ok(Math.abs(aquaOf(b1).fish[0].goodH - g0 - DUO_CARE_H) < 0.01);
  const again = must(feedFish(low(b1), T0 + 2000, { who: "a" }));
  assert.ok(aquaOf(again).fish[0].goodH - aquaOf(b1).fish[0].goodH < 0.01, "하루 한 번만");
  const solo = must(cleanWater(low(must(feedFish(low(st), T0, { who: "me" }))), T0 + 1000, { who: "me" }));
  assert.ok(aquaOf(solo).fish[0].goodH < 0.01);
});

test("F6 — 수조의 다 큰 계열이 낚시 행운에 작게 더해진다(다섯까지) · 맨 능력치는 그대로", () => {
  let st = rich();
  for (const k of ["guppy", "tetra", "goldfish", "betta", "angel", "koi", "clown"]) st = addFish(st, k, 2, familyOf(k)!.finals[0].key, T0);
  assert.equal(aquaLuck(aquaOf(st)), 5);
  const f = fishingOf(st);
  assert.equal(buffedStats(st, f, T0).luck, effectiveStats(f).luck + 5);
  assert.equal(buffedStats(rich(), f, T0).luck, effectiveStats(f).luck);
});

test("F7 — 가까이 놓은 두 장식이 조합이 된다(아름다움 · 성장) · 처음 한 번만 하트 · 멀리 떼면 풀린다", () => {
  const c = AQUA_COMBOS[0];
  let st = must(buyDecor(must(buyDecor(rich(), c.a, T0)), c.b, T0));
  st = must(placeDecor(st, c.a, 30, 50, T0));
  const before = st.coins;
  st = must(placeDecor(st, c.b, 40, 50, T0));
  assert.ok(aquaOf(st).combos?.includes(c.id));
  assert.ok(st.coins > before, "처음 만든 조합");
  const p = aquaOf(st).placed.find((x) => x.key === c.b)!;
  const far = must(moveDecor(st, p.id, 90, 90, T0));
  assert.ok(!activeCombos(aquaOf(far).placed).includes(c.id), "멀리 떼면 풀린다");
  const back = must(moveDecor(far, p.id, 40, 50, T0));
  assert.equal(back.coins, far.coins, "다시 붙여도 하트는 한 번뿐");
  const stored = must(storeDecor(back, p.id, T0));
  assert.equal(stored.coins, back.coins);
});

test("F8 — 오늘의 손님은 날짜 · 시드로 정해지고 한 번 저장되면 두 기기가 같다 · 들어주면 하루 한 번 하트", () => {
  const st = addFish(rich(0), "guppy", 2, "cobra_guppy", T0);
  const a = aquaOf(st);
  assert.deepEqual(makeRequest(a, DAY, 7), makeRequest(a, DAY, 7));
  const s = syncAqua(st, T0);
  assert.ok(s.a.req && s.a.req.day === DAY && s.dirty);
  assert.equal(syncAqua(s.state, T0 + H).dirty, false, "저장된 뒤엔 다시 정하지 않는다");
  // 어떤 부탁이든 들어줄 수 있다(장식 · 아름다움 · 다 큰 물고기)
  for (let seed = 0; seed < 30; seed++) {
    const r = makeRequest(a, DAY, seed);
    let cur = stow(st, { ...a, req: r });
    if (r.kind === "decor") cur = must(placeDecor(must(buyDecor({ ...cur, coins: 1e6 }, r.key, T0)), r.key, 50, 50, T0));
    if (r.kind === "beauty") for (const k of ["star_gate", "dragon_palace"]) cur = must(placeDecor(must(buyDecor({ ...cur, coins: 1e6 }, k, T0)), k, 50, 50, T0));
    assert.ok(requestMet(aquaOf(cur)), `${seed} ${r.kind} ${r.key}`);
    const got = must(claimRequest(cur, T0));
    assert.equal(got.coins - cur.coins, r.reward);
    assert.equal(claimRequest(got, T0).ok, false, "하루 한 번");
  }
});

test("F9 — 먹이는 쓰레기 쿠폰으로 만든다(수집함 숫자는 그대로) · 좋아하는 먹이는 정성 · 성장에 조금", () => {
  let st = addFish(rich(), "guppy", 0, undefined, T0) as IslandState;
  assert.equal(makeFood(st, "plankton", T0).ok, false, "쿠폰이 없다");
  st = { ...st, fishing: { ...fishingOf(st), junk: { junk_can: 5 } } } as IslandState;
  st = must(makeFood(st, "plankton", T0));
  assert.equal(st.fishing?.junk.junk_can, 5);
  assert.equal(aquaOf(st).food?.plankton, 3);
  const hungry = { ...st, aquarium: { ...st.aquarium!, hunger: 30 } } as IslandState;
  const plain = aquaOf(must(feedFish(hungry, T0))).fish[0];
  const liked = aquaOf(must(feedFish(hungry, T0, { food: "plankton" }))).fish[0];
  assert.ok(liked.goodH > plain.goodH && liked.growH > plain.growH);
  assert.ok(liked.stage === 0, "모습은 정산에서만 바뀐다");
  assert.equal(aquaOf(must(feedFish(hungry, T0, { food: "plankton" }))).food?.plankton, 2);
  assert.equal(feedFish(hungry, T0, { food: "star" }).ok, false, "없는 먹이는 못 준다");
});

test("F10 — 다 큰 짝 + 잘 돌본 72시간 → 알(치어 · 조금 큰 변이) · 3일에 하나 · 수조가 차면 안 낳는다 · 쪼개 정산해도 같다", () => {
  let st = rich();
  st = addFish(st, "guppy", 2, "cobra_guppy", T0, undefined, 5);
  st = addFish(st, "guppy", 2, "tuxedo_guppy", T0, undefined, 5);
  // 장비로 먹이 · 물이 오래 가게 하고 잘 돌본다
  const care = (s: IslandState, t: number) => {
    const f = feedFish(s, t), a = f.ok ? f.state : s, c = cleanWater(a, t);
    return c.ok ? c.state : a;
  };
  let once = st, split = st;
  for (let h = 12; h <= 12 * 14; h += 12) {
    once = care(once, T0 + h * H);
    split = care(syncAqua(syncAqua(split, T0 + (h - 5) * H).state, T0 + (h - 2) * H).state, T0 + h * H);
  }
  const A = aquaOf(syncAqua(once, T0 + 170 * H).state), B = aquaOf(syncAqua(split, T0 + 170 * H).state);
  const bred = A.fish.filter((f) => f.bred);
  assert.equal(bred.length, 2, `168시간 잘 돌보면 알 둘: ${bred.length}`);
  assert.ok(bred[0].adultCm! > 5, "조금 큰 변이");
  assert.deepEqual(B.fish.map((f) => [f.id, f.stage, f.bred ?? false]), A.fish.map((f) => [f.id, f.stage, f.bred ?? false]));
  assert.ok(A.news?.some((n) => n.egg));
  assert.ok(A.eggN! * BREED_H <= 170, "잘 돌본 시간은 실제 시간보다 길 수 없다 — 3일에 많아야 하나");
  // 가득 찬 수조엔 안 낳는다
  let full = st;
  for (let i = 0; i < TANKS[0].fish - 2; i++) full = addFish(full, "tetra", 0, undefined, T0);
  for (let h = 12; h <= 12 * 14; h += 12) full = care(full, T0 + h * H);
  assert.equal(aquaOf(full).fish.filter((f) => f.bred).length, 0);
});

test("밸런스 — 수조 값이 그 계열이 낚이는 레벨의 벌이에 맞는다 · 전설 위 · 주인은 수조 단계와 상관없이 담긴다", () => {
  const cum = TANKS.map((_, i) => TANKS.slice(0, i + 1).reduce((n, t) => n + t.price, 0));
  assert.ok(cum[3] <= 8000 && cum[4] <= 16000 && cum[5] <= 40000, `누적 ${cum} — 예전 81,000(5단계) · 201,000(6단계)`);
  for (let i = 1; i < TANKS.length; i++) assert.ok(TANKS[i].price > TANKS[i - 1].price && TANKS[i].fish > TANKS[i - 1].fish);
  const small = rich(0);
  assert.equal(storeBlock(small, { family: "kraken", grade: "태초" }), null, "태초는 작은 어항에도 한 칸");
  assert.equal(storeBlock(small, { family: "astral", grade: "신화" }), null);
  assert.match(storeBlock(small, { family: "bluefin", grade: "영웅" }) ?? "", /유리 수족관/, "영웅은 그대로 큰 수조부터");
  // 바뀐 수조 값에 맞춰 — 5단계 계열(참다랑어 · 청새리상어)이 처음 나오는 울릉도(레벨 18)
  assert.equal(SPOTS.find((s) => s.key === "ocean")?.minLevel, 18);
});

test("두 기기 결정성 — 새 칸도 Math.random · Date.now 없이 정해진다", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/aquarium.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(src, /Math\.random|Date\.now/);
});

test("화면 — 포만 · 문턱 · 다음 먹이 · 접근성 · 그물 · 소식 · 손님 · 왕관 경고 · 도감 접기", () => {
  const ui = readFileSync(join(process.cwd(), "src/components/AquariumGame.tsx"), "utf8");
  for (const s of ["포만", "role=\"meter\"", "aria-controls", "role=\"tabpanel\"", "다음 먹이까지", "대기 그물", "useDialogFocus", "unseenNews", "claimRequest", "<details", "낚시로 담아 오세요", "바로 놓기", "onFeedFx"]) assert.ok(ui.includes(s), s);
  assert.doesNotMatch(ui, /최종 형태 \{openFinals\(cq\)\}\/4/, "형태가 하나인 계열에 N/4 를 띄우지 않는다(B8)");
  const game = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.ok(game.includes("syncAqua(st, clock()).a"), "교체 목록은 정산한 수조로(B12)");
  assert.ok(game.includes("tryNet("));
});

test("옛 저장분 — 새 칸이 없어도 · 이상한 값이어도 돈다", () => {
  const raw = { aquarium: { tank: 99, hunger: "x", water: NaN, at: 5, nextId: 3, fish: [null, 7, { id: 1, family: "guppy", stage: 9, growH: "a" }], placed: [], bag: { coral: 2, bad: "x" }, dex: ["a", 3] }, aquaPlus: { net: [{ family: "guppy", stage: 0, difficulty: 0, value: 15, at: 1 }, "x"], badH: 1e9, news: [{ n: 1, id: 1, family: "guppy", stage: 1 }, null] } } as unknown as Island;
  const a: AquaState = aquaOf(raw, 0);
  assert.equal(a.tank, TANKS.length);
  assert.equal(a.hunger, 100);
  assert.equal(a.fish.length, 1);
  assert.equal(a.fish[0].stage, 0);
  assert.equal(a.alien?.fish.length, 2, "알 수 없는 값도 버리지 않는다");
  assert.deepEqual(a.bag, { coral: 2 });
  assert.equal(a.net?.length, 1);
  assert.equal(a.badH, AWAY_CAP_H);
  assert.ok(syncAqua(raw as IslandState, 10 * H).state);
});

test("물갈이는 하트가 든다 · 수조가 클수록 비싸다 · 모자라면 못 간다", () => {
  const low = (s: ReturnType<typeof rich>, coins: number, tank = 1) => ({ ...s, coins, aquarium: { ...s.aquarium!, water: 10, tank } });
  const ok = cleanWater(low(rich(0), 1000), T0 + 1000);
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.state.coins, 1000 - waterPrice(1));
  assert.equal(cleanWater(low(rich(0), waterPrice(1) - 1), T0 + 1000).ok, false);
  for (let i = 1; i < TANKS.length; i++) assert.ok(WATER_PRICES[i] > WATER_PRICES[i - 1]);
  assert.equal(WATER_PRICES.length, TANKS.length);
});

test("상위 어항 — 7단계부터는 맨 위 칸에 저장해 옛 앱이 깎지 못한다", () => {
  assert.ok(TANKS.length >= 9);
  const a = aquaOf({ ...rich(0), aquarium: { ...rich(0).aquarium!, tank: 8 } }, T0);
  const saved = stow(rich(0), { ...a, tank: 8 });
  assert.equal(saved.aquarium!.tank, TANK_CORE_MAX, "옛 앱이 아는 칸은 6까지");
  assert.equal(aquaOf(saved, T0).tank, 8);
  // 옛 앱이 aquarium 을 다시 써도(tank 6) 맨 위 칸이 남아 8 로 읽힌다
  assert.equal(aquaOf({ ...saved, aquarium: { ...saved.aquarium!, tank: 6 } }, T0).tank, 8);
  let s = { ...rich(0), coins: 1_000_000 } as typeof saved;
  for (let i = 1; i < TANK_TOP_LEGACY; i++) { const r = upgradeTank(s, T0); assert.ok(r.ok); if (r.ok) s = r.state as typeof saved; }
  assert.equal(aquaOf(s, T0).tank, TANK_TOP_LEGACY);
  assert.equal(upgradeTank(s, T0).ok, false);
});

/* 2026-11-06 화면 리뷰 — 옛 앱(7ab54e1, 2026-11-06 까지 배포)의 쓰기를 흉내 낸다.
   옛 stow 는 aquarium 을 아는 칸으로, aquaPlus 를 자기 PLUS_KEYS 로 다시 짓고(tankTop 을 모른다) 나머지는 ...st 로 흘린다.
   옛 aquaOf 는 tank 를 자기 TANKS 길이(6)로 깎는다. */
const OLD_PLUS_KEYS = ["badH", "news", "newsN", "newsSeen", "care", "duoDay", "released", "net", "combos", "req", "food", "junkUsed", "breedH", "eggN"] as const;
function oldClientSave(st: Island): Island {
  const a = st.aquarium!;
  const core = {
    tank: Math.min(6, Math.max(1, Math.floor(a.tank))), hunger: a.hunger, water: a.water, at: a.at, nextId: a.nextId,
    fish: a.fish, placed: a.placed, ...(a.wide !== undefined ? { wide: a.wide } : {}), bag: a.bag, dex: a.dex,
  };
  const plusIn = (st.aquaPlus ?? {}) as Record<string, unknown>, plus: Record<string, unknown> = {};
  for (const k of OLD_PLUS_KEYS) if (plusIn[k] !== undefined) plus[k] = plusIn[k];
  return { ...st, aquarium: core as AquaState, aquaPlus: plus } as Island;
}

test("P1 — 9단계 수조는 옛 앱이 aquaPlus 를 다시 지어도 9단계로 읽힌다(하트만 쓰이고 6으로 내려앉지 않는다)", () => {
  let s = { ...rich(0), coins: 1_000_000 } as Island;
  for (let i = 1; i < TANK_TOP_LEGACY; i++) s = must(upgradeTank(s, T0));
  assert.equal(aquaOf(s, T0).tank, 9);
  assert.equal(s.aquaTankTop, 9, "최상위 칸에 쓴다");
  const old = oldClientSave(s);
  assert.equal((old.aquaPlus as { tankTop?: number }).tankTop, undefined, "옛 앱은 tankTop 을 버린다");
  assert.equal(old.aquarium!.tank, 6);
  assert.equal(aquaOf(old, T0).tank, 9, "최상위 칸이 남아 9단계");
  // 새 앱이 다시 저장해도 단계가 이어지고 하트는 다시 빠지지 않는다
  const again = must(buyDecor(old, "filter_1", T0 + H));
  assert.equal(aquaOf(again, T0 + H).tank, 9);
  assert.equal(again.aquaTankTop, 9);
  assert.equal((again.aquaPlus as { tankTop?: number }).tankTop, 9, "지금 앱끼리의 사본도 다시 쓴다");
  assert.equal(again.coins, old.coins - 400, "장식 값만 빠진다");
  // 세 자리 중 가장 높은 값 — 하나가 낮아도 내려가지 않는다
  assert.equal(aquaOf({ ...old, aquarium: { ...old.aquarium!, tank: 1 }, aquaPlus: { tankTop: 7 } } as Island, T0).tank, 9);
  assert.equal(aquaOf({ ...old, aquaTankTop: 7, aquaPlus: { tankTop: 8 } } as Island, T0).tank, 8);
});

test("규칙 — 하트로 산 것(수조 단계 · 넓히기 · 장식)은 옛 앱의 다시 짓기를 지나도 남는다", () => {
  let s = { ...rich(0), coins: 5_000_000 } as Island;
  for (let i = 1; i < TANK_TOP_LEGACY; i++) s = must(upgradeTank(s, T0));
  while (widenTank(s, T0).ok) s = must(widenTank(s, T0));
  s = must(buyDecor(s, "filter_1", T0));
  const before = aquaOf(s, T0), after = aquaOf(oldClientSave(s), T0);
  assert.equal(after.tank, before.tank);
  assert.equal(after.wide, before.wide);
  assert.deepEqual(after.bag, before.bag);
  // aquaPlus 에 옛 PLUS_KEYS 밖의 새 칸이 생기면 걸린다 — 그 값은 옛 앱이 버리므로 최상위 칸에도 둬야 한다(tankTop → aquaTankTop)
  const newOnly = Object.keys(s.aquaPlus ?? {}).filter((k) => !(OLD_PLUS_KEYS as readonly string[]).includes(k) && k !== "tankTop");
  assert.deepEqual(newOnly, [], `aquaPlus 에만 있는 새 칸: ${newOnly.join(", ")}`);
});

/* 2026-11-11 — 10 해저 터널 · 11 심연 돔 궁전. 하트만으론 못 사고(낚시 레벨 · 수조 도감 · 주인 토벌), 지금 배포된 앱(9단계까지 아는 앱)이 저장해도 안 내려앉는다 */
function strongIsland(level: number, dex: number, bosses: number): Island {
  const s = { ...rich(0), coins: 10_000_000 } as Island;
  const bossRec = Object.fromEntries(Array.from({ length: bosses }, (_, i) => [`b${i}`, { hp: 1, at: "", tries: {}, caught: 1, until: "" }]));
  const a = { ...s.aquarium!, fish: [], dex: ALL_FORMS.slice(0, dex).map((f) => f.key) };
  return { ...s, aquarium: a, fishing: { ...(s.fishing ?? {}), level, bosses: bossRec } } as unknown as Island;
}
/** 2026-11-11 까지 배포된 앱 — TANKS 9개라 단계를 9 로 깎아 읽고, 7 위면 aquaTankTop 과 aquaPlus.tankTop 에 그 값을 다시 쓴다. aquaTankMax 는 모른다(...st 로 흘린다) */
function nineTierClientSave(st: Island): Island {
  const t = Math.min(9, aquaOf(st, T0).tank);
  const plus = { ...((st.aquaPlus ?? {}) as Record<string, unknown>), ...(t > 6 ? { tankTop: t } : {}) };
  return { ...st, aquarium: { ...st.aquarium!, tank: Math.min(6, t) }, aquaPlus: plus, ...(t > 6 ? { aquaTankTop: t } : {}) } as Island;
}

test("10 · 11단계 — 하트가 넘쳐도 기록이 없으면 못 산다 · 이유와 진행을 말한다", () => {
  let s = strongIsland(1, 0, 0);
  for (let i = 1; i < TANK_TOP_LEGACY; i++) s = must(upgradeTank(s, T0));
  assert.equal(aquaOf(s, T0).tank, 9);
  const r = upgradeTank(s, T0);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /낚시 레벨 30/);
  const g = tankGate(s, aquaOf(s, T0), 10);
  assert.equal(g.ok, false);
  assert.deepEqual(g.items.map((x) => x.label), ["낚시 레벨", "물고기 도감", "주인 토벌"]);
  assert.ok(TANK_GATES[11].level > TANK_GATES[10].level && TANK_GATES[11].dex > TANK_GATES[10].dex && TANK_GATES[11].bosses > TANK_GATES[10].bosses, "위 단계가 더 어렵다");
  assert.ok(TANKS[10].price >= TANKS[9].price * 3 && TANKS[9].price >= TANKS[8].price * 3, "값도 크게 뛴다");
});

test("수조 조건의 도감 수 = 도감 화면 · 게임 카드의 수(formsSeen) — 낚아 본 것도 세고, 모르는 key 는 안 센다", () => {
  const base = strongIsland(30, 0, 5);
  const fake = { ...base, aquarium: { ...base.aquarium!, dex: ["f0", "f1", "nope"] } } as Island;
  assert.equal(tankGate(fake, aquaOf(fake, T0), 10).items[1].have, 0, "가짜 key 는 0");
  const seen = ALL_FORMS.slice(0, 100).map((f) => f.key);
  const caught = { ...base, fishing: { ...(base.fishing as object), seen } } as unknown as Island;
  const g = tankGate(caught, aquaOf(caught, T0), 10);
  assert.equal(g.items[1].have, 100, "낚아 본 모습만으로도 센다");
  assert.equal(g.items[1].have, formsSeen(caught).size, "화면의 도감 수와 같다");
  assert.equal(g.ok, true);
});

test("10 · 11단계 — 기록을 채우면 산다 · 혼자 하는 섬도 닿는다(낚시 레벨 50 · 도감 222 · 주인 15 안)", () => {
  assert.ok(TANK_GATES[11].level <= 50 && TANK_GATES[11].dex <= 222 && TANK_GATES[11].bosses <= 15);
  let s = strongIsland(30, 100, 5);
  for (let i = 1; i < TANK_TOP_LEGACY; i++) s = must(upgradeTank(s, T0));
  s = must(upgradeTank(s, T0));
  assert.equal(aquaOf(s, T0).tank, 10);
  assert.equal(upgradeTank(s, T0).ok, false, "11 은 더 높은 기록");
  s = strongIsland(40, 180, 12);
  for (let i = 1; i < TANKS.length; i++) s = must(upgradeTank(s, T0));
  assert.equal(aquaOf(s, T0).tank, 11);
  assert.equal(upgradeTank(s, T0).ok, false, "가장 큰 수조");
});

test("10 · 11단계 — 9단계까지 아는 지금 배포된 앱이 저장해도 내려앉지 않는다(aquaTankMax)", () => {
  let s = strongIsland(40, 180, 12);
  for (let i = 1; i < TANKS.length; i++) s = must(upgradeTank(s, T0));
  assert.equal(s.aquaTankMax, 11);
  const old = nineTierClientSave(s);
  assert.equal(old.aquaTankTop, 9, "그 앱은 9 를 다시 쓴다");
  assert.equal(aquaOf(old, T0).tank, 11, "aquaTankMax 가 남아 11");
  const again = must(buyDecor(old, "filter_1", T0 + H));
  assert.equal(aquaOf(again, T0 + H).tank, 11);
  assert.equal(again.aquaTankMax, 11);
  // 9 이하 단계는 aquaTankMax 를 만들지 않는다(옛 저장 모양 그대로)
  let t = strongIsland(1, 0, 0);
  for (let i = 1; i < TANK_TOP_LEGACY; i++) t = must(upgradeTank(t, T0));
  assert.equal(t.aquaTankMax, undefined);
});
