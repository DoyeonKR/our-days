// 보물 · 유물 낚기(2026-11-12) — 확률 · 주인전 · 뜰채 · 세트 완성 장식(한 번만) · 겹친 조각 하트 · 한 번만 열기 · 낚시 저장을 지나도 남기 ·
// 물고기 뽑기 순서 그대로 · 경제(물고기 대신이라 하트 벌이가 안 된다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland, type IslandState } from "./island.ts";
import { BAITS, SPOTS, buyBait, coinValue, fishingOf, haulJunk, rollCatch, spotOf, type FishCatch, type MethodKey } from "./fishing.ts";
import { aquaOf, DECOR } from "./aquarium.ts";
import { landSpecial, rollSpecial, type SpecialCtx } from "./fishplus.ts";
import {
  CHEST_BAIT_USES, RELIC_BASE, RELIC_MAX, RELIC_PIECES, RELIC_SETS, TREASURE_LOG,
  chestBait, devClearForced, devForceTreasure, landTreasure, parseTreasureId, relicSetsOf, relicsOf, rollTreasure, treasureChance, treasureLogOf, treasurePiece,
} from "./fishtreasure.ts";

const T0 = Date.UTC(2026, 10, 12, 3);
const DAY = "2026-11-12";
const brook = spotOf("brook")!, harbor = spotOf("harbor")!, abyss = spotOf("abyss")!;
const ctx = (seed: number, o: Partial<SpecialCtx> = {}): SpecialCtx =>
  ({ who: "user-a", couple: true, spot: brook, method: "float" as MethodKey, seed, now: T0 + seed, today: DAY, ...o });
const island = (): IslandState => ({ ...createIsland("펫", null, T0), coins: 1000 });
const seedOf = (i: number) => (Math.imul(i + 1, 2654435761) + 12345) >>> 0;

/** 조각 하나를 바로 끌어올린 상태 — 던지기 없이(id 만 맞추면 된다) */
const relicCatch = (piece: string, n: number): FishCatch => ({ family: "special", stage: 0, grade: "흔함", difficulty: 1, special: { kind: "treasure", id: `relic.${piece}.${n.toString(36)}.${(T0 + n).toString(36)}`, title: "오래된 유물" } });
const landOk = (s: IslandState, c: FishCatch, n = 0) => {
  const r = landTreasure(s, c, ctx(n));
  assert.ok(r.ok, r.ok ? "" : r.reason);
  return r.ok ? r : (null as never);
};

test("확률 — 민물 찌 약 1.2% · 상자 약 0.4% · 바다 · 심해 · 멀리 던지면 더 · 뜰채는 0", () => {
  devClearForced();
  const rate = (o: Partial<SpecialCtx>, n = 40000) => {
    let relic = 0, chest = 0;
    for (let i = 0; i < n; i++) {
      const c = rollTreasure(island(), ctx(seedOf(i), o));
      if (!c) continue;
      if (c.special!.id.startsWith("relic.")) relic++; else chest++;
    }
    return { relic: relic / n, chest: chest / n };
  };
  const base = rate({ cast: 0.5 });
  assert.ok(base.relic > 0.009 && base.relic < 0.015, `민물 유물 ${base.relic}`);
  assert.ok(base.chest > 0.0025 && base.chest < 0.0055, `민물 상자 ${base.chest}`);
  const sea = rate({ spot: harbor, method: "deep", cast: 1 });
  assert.ok(sea.relic > base.relic * 2, `바다 심해 멀리 ${sea.relic}`);
  assert.ok(sea.relic <= RELIC_MAX + 0.004);
  assert.deepEqual(rate({ method: "scoop" }, 5000), { relic: 0, chest: 0 }, "뜰채엔 안 걸린다");
  assert.equal(treasureChance({ spot: brook, method: "float", cast: 0.5 }).relic, RELIC_BASE);
  // 같은 seed 는 같은 답(두 기기가 갈리지 않게)
  const a = rollTreasure(island(), ctx(424242, { spot: harbor })), b = rollTreasure(island(), ctx(424242, { spot: harbor }));
  assert.deepEqual(a, b);
});

test("주인전엔 없다 — 화면이 rollSpecial 을 부르지 않는다 · 던지기 점수는 ref 로 넘긴다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.match(src, /const c = activeBoss \? base : rollSpecial\(st, specialCtx\(seed, clock\(\)\)\) \?\? base;/);
  assert.match(src, /castScoreRef\.current = score;[\s\S]{0,600}rollSpecial\(st, specialCtx/, "뽑기 전에 이번 판 점수를 넣는다");
  assert.match(src, /cast: castScoreRef\.current/);
});

test("물고기 뽑기 순서는 그대로 — rollSpecial 은 물고기 주사위를 건드리지 않는다", () => {
  devClearForced();
  for (let i = 0; i < 400; i++) {
    const seed = seedOf(i);
    const opts = { bait: 0, method: "float" as MethodKey, junk: true };
    const before = rollCatch(brook, 10, 0.5, seed, opts);
    rollSpecial(island(), ctx(seed, { cast: 0.5 }));
    const after = rollCatch(brook, 10, 0.5, seed, opts);
    assert.deepEqual(after, before, `seed ${seed}`);
  }
});

test("세트를 다 모으면 수조 보관함에 장식 하나 — 세트마다 한 번 · 하트는 안 든다", () => {
  const set = RELIC_SETS.find((x) => x.key === "wreck")!;
  let s = island();
  for (const [i, p] of set.pieces.entries()) {
    const r = landOk(s, relicCatch(p.key, i + 1), i + 1);
    s = r.state;
    if (i < set.pieces.length - 1) assert.equal((aquaOf(s).bag[set.reward] ?? 0), 0, "다 모으기 전엔 없다");
    else assert.match(r.special!.note!, /난파선 세트를 다 모았어요/);
  }
  assert.equal(aquaOf(s).bag[set.reward], 1, "보관함에 난파선 하나");
  assert.equal(s.coins, 1000, "장식은 공짜 · 겹친 조각이 없으니 하트도 그대로");
  assert.deepEqual(relicSetsOf(s), ["wreck"]);
  // 같은 세트 조각을 또 건져도 장식은 다시 안 준다
  const again = landOk(s, relicCatch(set.pieces[0].key, 99), 99);
  assert.equal(aquaOf(again.state).bag[set.reward], 1);
  assert.equal(again.coins, set.dupe, "겹친 조각은 하트");
  assert.equal(again.state.coins, 1000 + set.dupe);
  assert.equal(relicsOf(again.state)[set.pieces[0].key], 2);
});

test("겹친 조각은 하트 조금 — 물고기 한 마리 값보다 작다(유물로 하트를 버는 길이 되면 안 된다)", () => {
  const p = RELIC_PIECES[0];
  let s = landOk(island(), relicCatch(p.key, 1), 1).state;
  const r = landOk(s, relicCatch(p.key, 2), 2);
  s = r.state;
  assert.equal(r.coins, p.set.dupe);
  for (const x of RELIC_SETS) assert.ok(x.dupe < coinValue(1), `${x.key} ${x.dupe} < 가장 쉬운 물고기 ${coinValue(1)}`);
});

test("한 번만 연다 — 같은 id 를 두 번 끌어올리면 거절 · 기록은 상한까지", () => {
  const c = relicCatch(RELIC_PIECES[3].key, 7);
  const s = landOk(island(), c, 7).state;
  const twice = landTreasure(s, c, ctx(8));
  assert.equal(twice.ok, false);
  assert.equal(landSpecial(s, c, ctx(9)).ok, false, "landSpecial 도 같은 길");
  let t = island();
  for (let i = 0; i < TREASURE_LOG + 5; i++) t = landOk(t, relicCatch(RELIC_PIECES[i % RELIC_PIECES.length].key, 100 + i), 100 + i).state;
  assert.equal(treasureLogOf(t).length, TREASURE_LOG);
  // 모양이 틀린 id · 보물이 아닌 것은 거절
  assert.equal(landTreasure(island(), { ...c, special: { kind: "treasure", id: "relic.nope.1.2", title: "" } }, ctx(1)).ok, false);
  assert.equal(landTreasure(island(), { ...c, special: { kind: "bottle", id: c.special!.id, title: "" } }, ctx(1)).ok, false);
});

test("보물상자 — 하트 · 미끼 묶음 · 유물 셋 중 하나 · 같은 상자는 같은 답 · 미끼는 사기와 같은 길", () => {
  const kinds = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const c: FishCatch = { family: "special", stage: 0, grade: "흔함", difficulty: 1, special: { kind: "treasure", id: `chest.abyss.${i.toString(36)}.${T0.toString(36)}`, title: "보물상자" } };
    const a = landOk(island(), c, i), b = landOk(island(), c, i + 1);
    assert.deepEqual(a.special, b.special, "id 만으로 정한다");
    const body = a.special!.body;
    if (/하트/.test(body)) { kinds.add("hearts"); assert.ok(a.coins >= 45 && a.coins <= 260, `하트 ${a.coins}`); }
    else if (/회분/.test(body)) {
      kinds.add("bait");
      const bait = chestBait(abyss);
      assert.equal(fishingOf(a.state).baits[bait.key], CHEST_BAIT_USES);
      // 지렁이는 오늘 채워진 양이 그대로 셈에 들어간다(공짜 채우기를 덮지 않는다)
      assert.ok((fishingOf(a.state).baits[BAITS[0].key] ?? 0) >= 20);
    } else { kinds.add("relic"); assert.ok(a.special!.art && treasurePiece(`relic.${a.special!.art}.1.1`)); }
  }
  assert.deepEqual([...kinds].sort(), ["bait", "hearts", "relic"]);
  assert.notEqual(chestBait(brook).key, BAITS[0].key, "지렁이는 매일 공짜라 한 칸 위");
});

test("fishPlus 는 낚시 저장을 지나도 남는다 · 모르는 조각도 그대로", () => {
  let s = landOk(island(), relicCatch(RELIC_PIECES[0].key, 1), 1).state;
  s = { ...s, fishPlus: { ...s.fishPlus, relics: { ...(s.fishPlus?.relics as object), future_piece: 2, bad: "x" } } };
  const b = buyBait(s, "bait_shrimp", DAY);
  assert.ok(b.ok);
  if (b.ok) assert.deepEqual(b.state.fishPlus, s.fishPlus, "미끼 사기가 지우지 않는다");
  const j = haulJunk(s, { family: "x", stage: 0, grade: "흔함", difficulty: 1, junk: "junk_can" } as FishCatch, DAY);
  if (j.ok) assert.deepEqual(j.state.fishPlus, s.fishPlus, "꽝 건지기가 지우지 않는다");
  const next = landOk(s, relicCatch(RELIC_PIECES[1].key, 2), 2).state;
  assert.equal(relicsOf(next).future_piece, 2, "새 판이 더한 조각은 들고 다닌다");
  assert.equal(relicsOf(next).bad, undefined, "모양이 틀린 칸만 버린다");
});

test("표 — 보상 장식은 DECOR 에 있다 · 조각 key 겹침 없음 · 조각마다 그림 · id 왕복", () => {
  const keys = RELIC_PIECES.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const s of RELIC_SETS) {
    assert.ok(DECOR.some((d) => d.key === s.reward), `${s.key} → ${s.reward}`);
    assert.ok(s.pieces.length >= 4 && s.pieces.length <= 5);
  }
  assert.equal(new Set(RELIC_SETS.map((s) => s.reward)).size, RELIC_SETS.length, "세트마다 다른 장식");
  const src = readFileSync(join(process.cwd(), "src/components/FishRelics.tsx"), "utf8");
  for (const k of keys) assert.match(src, new RegExp(`\\b${k}: \\(`), `${k} 그림`);
  assert.deepEqual(parseTreasureId("relic.wreck_bell.a.b"), { type: "relic", piece: "wreck_bell" });
  assert.deepEqual(parseTreasureId("chest.harbor.a.b"), { type: "chest", spot: "harbor" });
  assert.equal(parseTreasureId("user-aaa.1.2"), null, "유리병 id 와 안 섞인다");
});

test("보물상자는 어느 낚시터에서 걸려도 열린다(id 에 담는 낚시터 key 가 모양 검사를 지난다)", () => {
  for (const sp of SPOTS) {
    assert.ok(devForceTreasure("chest"));
    const c = rollTreasure(island(), ctx(11, { spot: sp }))!;
    assert.ok(landTreasure(island(), c, ctx(12, { spot: sp })).ok, sp.key);
    assert.ok(devForceTreasure("relic"));
    const r = rollTreasure(island(), ctx(13, { spot: sp }))!;
    assert.ok(landTreasure(island(), r, ctx(14, { spot: sp })).ok, sp.key);
  }
  devClearForced();
});

test("개발용 — 다음 판 하나만 보물 · 지정한 조각", () => {
  assert.ok(devForceTreasure("pirate_map"));
  const c = rollTreasure(island(), ctx(5, { method: "scoop" }));
  assert.equal(treasurePiece(c?.special?.id), "pirate_map");
  assert.equal(rollTreasure(island(), ctx(5, { method: "scoop" })), null, "한 번만");
  assert.ok(devForceTreasure("chest"));
  assert.match(rollTreasure(island(), ctx(6))!.special!.id, /^chest\./);
  assert.equal(devForceTreasure("nope"), false);
  devClearForced();
  const ui = readFileSync(join(process.cwd(), "src/components/FishRelics.tsx"), "utf8");
  assert.match(ui, /process\.env\.NODE_ENV !== "production"[\s\S]{0,120}__fishForceTreasure = devForceTreasure/);
});

test("경제 — 물고기 대신 걸리므로 한 번당 기대 하트 변화가 아주 작다(하트 벌이가 아니다)", () => {
  // 한 판의 물고기 값(다 팔기)보다 특별한 것 한 번의 기대 하트가 작으면, 보물이 끼어 생기는 변화는 음수다
  const abyssFish = (() => { let v = 0; for (let i = 0; i < 2000; i++) { const c = rollCatch(abyss, 25, 0.6, seedOf(i), { bait: 3, junk: true }); v += c.junk ? 2 : coinValue(c.difficulty); } return v / 2000; })();
  let chestEv = 0;
  for (let i = 0; i < 400; i++) {
    const c: FishCatch = { family: "special", stage: 0, grade: "흔함", difficulty: 1, special: { kind: "treasure", id: `chest.abyss.${i.toString(36)}.z`, title: "" } };
    const r = landOk(island(), c, i);
    const bait = chestBait(abyss);
    chestEv += r.coins + (/회분/.test(r.special!.body) ? (bait.price / bait.uses) * CHEST_BAIT_USES : 0);
  }
  chestEv /= 400;
  assert.ok(chestEv < abyssFish * 6, `상자 기대값 ${chestEv.toFixed(0)} · 물고기 ${abyssFish.toFixed(0)}`);
  const ch = treasureChance({ spot: abyss, method: "deep", cast: 1 });
  const perCast = ch.chest * (chestEv - abyssFish) + ch.relic * (15 - abyssFish);
  assert.ok(perCast < 2, `가장 유리한 판의 한 번당 변화 ${perCast.toFixed(2)} 하트`);
});
