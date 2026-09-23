// 꾸미기 확장 lock — 생산 장식 · 생산 재료 · 세트 퍽 · 잠금 단일 소스 · 화면 배선. [2026-09-23]
// [사용자 요청 "꾸미기도 … 형태를 엄청 많이 추가해야될 것 같아 ui 도 개편이 필요해"]
//
// 예전 꾸미기는 '사서 놓으면 평점이 오른다'가 전부였다. 생산 장식(벌통·닭장·젖소)은 놓는 자리가
// 생산량을 바꾸고, 그 재료(꿀·달걀·우유)가 공방 요리로 이어진다 — 그 다리가 끊기지 않게 잠근다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DECORS,
  DECOR_SETS,
  GOODS,
  PRODUCE_CAP,
  PRODUCTS,
  SET_PERK,
  collectProduce,
  createIsland,
  decorDef,
  decorLockReason,
  effectStarMult,
  feedPetWith,
  goodsOf,
  isGoodsKey,
  isProductKey,
  moveDecor,
  pantryAction,
  placeDecor,
  produceStatus,
  productOf,
  rawFeedXp,
  recipeFeasible,
  refreshOrders,
  removeDecor,
  skillXpFor,
  todayOrders,
  type IslandState,
  type ProductKey,
} from "./island.ts";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 8, 25, 3, 0, 0);

/** 레벨·코인·유대 게이트를 다 연 섬 — 배치 규칙만 보게 한다. */
function rich(): IslandState {
  const s = createIsland("콩", null, T0);
  return { ...s, level: 30, coins: 1_000_000, bond: { ...s.bond, level: 5 } };
}
function place(s: IslandState, key: string, x: number, y: number, t = T0): IslandState {
  const n = placeDecor(s, key, x, y, t);
  assert.notEqual(n, s, `${key} 배치가 거부됐다(전제 실패)`);
  return n;
}
const idOf = (s: IslandState, key: string) => s.decor.find((d) => d.key === key)!.id;
const statusOf = (s: IslandState, key: string, t: number) => produceStatus(s, t).find((x) => x.id === idOf(s, key))!;

// ── 1. 짝이 맞는다 ────────────────────────────────────────────────

test("생산 재료 셋 ↔ 생산 장식 셋 — 서로 가리키고, 부스트 이웃은 실재 장식이다", () => {
  assert.equal(GOODS.length, 3);
  for (const g of GOODS) {
    const d = decorDef(g.producer);
    assert.ok(d, `${g.name} 의 생산 장식 '${g.producer}' 가 없다`);
    assert.equal(d.produce?.goods, g.key, `${d.name} 이 ${g.name} 을 안 만든다`);
  }
  const producers = DECORS.filter((d) => d.produce);
  assert.equal(producers.length, GOODS.length, "생산 장식과 재료 수가 다르다");
  for (const d of producers) {
    assert.ok(d.produce!.hours > 0);
    assert.ok(d.produce!.boostBy.length > 0, `${d.name}: 부스트 이웃이 없으면 '어디에 놓나'가 의미 없다`);
    for (const k of d.produce!.boostBy) {
      assert.ok(decorDef(k), `${d.name} 의 부스트 이웃 '${k}' 가 없는 장식이다`);
      assert.notEqual(k, d.key, `${d.name} 이 자기 자신으로 부스트된다 — 도배하면 끝난다`);
    }
  }
});

test("생산 재료는 전부 어떤 요리의 재료다 — 쌓이기만 하고 쓸 데가 없으면 안 된다", () => {
  for (const g of GOODS) {
    assert.ok(
      PRODUCTS.some((p) => Object.keys(p.recipe).includes(g.key)),
      `${g.name} 을 쓰는 레시피가 없다`,
    );
  }
});

// ── 2. 시간 · 상한 · 모으기 ──────────────────────────────────────

test("★ 시간이 지나면 쌓이고, PRODUCE_CAP 에서 멈춘다", () => {
  const s = place(rich(), "henhouse", 0, 0);
  const hours = decorDef("henhouse").produce!.hours;
  assert.equal(statusOf(s, "henhouse", T0 + (hours - 0.1) * HOUR).ready, 0);
  assert.equal(statusOf(s, "henhouse", T0 + hours * HOUR).ready, 1);
  const full = statusOf(s, "henhouse", T0 + 100 * HOUR);
  assert.equal(full.ready, PRODUCE_CAP, "며칠 방치해도 한 번에 쏟아지면 안 된다");
  assert.equal(full.nextMs, 0);
});

test("★ 모으면 창고로 — ★3 · 진행 중인 몫은 남고, 가득 찼던 칸은 지금부터 다시 센다", () => {
  let s = place(rich(), "henhouse", 0, 0);
  const cyc = decorDef("henhouse").produce!.hours * HOUR;
  // 1개 + 1시간 진행
  const t1 = T0 + cyc + HOUR;
  s = collectProduce(s, t1);
  assert.deepEqual(s.farm.barn.egg, { qty: 1, star: 3 });
  const st = statusOf(s, "henhouse", t1);
  assert.equal(st.ready, 0);
  assert.equal(st.nextMs, cyc - HOUR, "진행 중이던 1시간이 버려졌다");
  // 가득 찬 뒤 모으면 넘친 시간은 버리고 지금부터
  const t2 = t1 + 100 * HOUR;
  s = collectProduce(s, t2);
  assert.equal(s.farm.barn.egg!.qty, 1 + PRODUCE_CAP);
  assert.equal(statusOf(s, "henhouse", t2).nextMs, cyc);
  // 모을 게 없으면 원본 그대로(쓰기 0)
  assert.equal(collectProduce(s, t2), s);
});

// ── 3. 배치가 곧 생산량 ───────────────────────────────────────────

test("★ 맞는 이웃이 붙으면 두 배 빠르고 ★4 — 대각선은 이웃이 아니다", () => {
  const cyc = decorDef("beehive").produce!.hours * HOUR;
  let s = place(rich(), "beehive", 1, 1);
  s = place(s, "tulip", 2, 1);
  const st = statusOf(s, "beehive", T0 + cyc / 2);
  assert.equal(st.boosted, true);
  assert.equal(st.ready, 1, "꽃 옆 벌통이 두 배 빠르지 않다");
  s = collectProduce(s, T0 + cyc / 2);
  assert.equal(s.farm.barn.honey!.star, 4, "부스트 생산품은 ★4");

  let d = place(rich(), "beehive", 1, 1);
  d = place(d, "tulip", 2, 2);
  assert.equal(statusOf(d, "beehive", T0 + cyc / 2).boosted, false, "대각선 꽃이 부스트를 줬다");
  assert.equal(statusOf(d, "beehive", T0 + cyc / 2).ready, 0);
});

test("★ 배치를 바꿔도 이미 흐른 시간은 새 속도로 다시 나뉘지 않는다 — '옮겨서 불리기' 차단", () => {
  const cyc = decorDef("beehive").produce!.hours * HOUR; // 8h, 부스트면 4h
  // 부스트 없이 6시간(= 0.75개) 쌓은 뒤 꽃을 붙인다
  let s = place(rich(), "beehive", 1, 1);
  const t = T0 + 0.75 * cyc;
  s = place(s, "tulip", 2, 1, t);
  // 예전 구멍: 6시간 ÷ 4시간 = 1개가 즉시 생겼다
  assert.equal(statusOf(s, "beehive", t).ready, 0, "붙이는 순간 과거 시간이 빠른 속도로 재계산됐다");
  // 남은 0.25개 = 부스트 주기(4h)의 1/4 = 1시간
  assert.equal(statusOf(s, "beehive", t + HOUR - 60_000).ready, 0);
  assert.equal(statusOf(s, "beehive", t + HOUR).ready, 1);

  // 반대 — 꽃을 치워도 쌓인 몫이 줄지 않는다
  let r = place(rich(), "beehive", 1, 1);
  r = place(r, "tulip", 2, 1);
  const t2 = T0 + 0.375 * cyc; // 부스트 주기의 0.75
  r = removeDecor(r, idOf(r, "tulip"), t2);
  assert.equal(statusOf(r, "beehive", t2).ready, 0);
  // 남은 0.25개 = 느린 주기(8h)의 1/4 = 2시간
  assert.equal(statusOf(r, "beehive", t2 + 2 * HOUR).ready, 1, "꽃을 치우자 쌓인 진행이 줄었다");

  // 옮기기도 같은 규칙
  let m = place(rich(), "tulip", 4, 1);
  m = place(m, "beehive", 0, 0);
  m = moveDecor(m, idOf(m, "beehive"), 3, 1, t);
  assert.equal(statusOf(m, "beehive", t).ready, 0, "꽃 옆으로 옮기자 과거 시간이 빠른 속도로 재계산됐다");
});

test("농장 세트를 다 놓으면 생산이 빨라진다(SET_PERK.farmSpeed) — 설명문이 아니라 계산", () => {
  // 부스트 이웃이 안 붙게 띄워 놓는다(부스트와 세트 효과를 따로 본다)
  const spots: Record<string, [number, number]> = {
    henhouse: [0, 0], beehive: [2, 0], cowshed: [4, 0], haystack: [0, 2], scarecrow: [2, 2], windmill: [4, 2],
  };
  const farm = DECORS.filter((d) => d.set === "farm").map((d) => d.key);
  assert.deepEqual([...farm].sort(), Object.keys(spots).sort(), "농장 세트 구성이 바뀌었다 — 이 테스트의 배치를 고쳐라");
  let s = rich();
  for (const k of farm) s = place(s, k, ...spots[k]);
  assert.ok(s.sets.includes("farm"), "농장 세트가 완성되지 않았다");
  const cyc = decorDef("henhouse").produce!.hours * HOUR * SET_PERK.farmSpeed;
  assert.equal(statusOf(s, "henhouse", T0 + cyc - 60_000).ready, 0);
  assert.equal(statusOf(s, "henhouse", T0 + cyc).ready, 1);
});

// ── 4. 세트 퍽은 전부 실제로 계산된다 ─────────────────────────────

test("★ 새 세트 다섯의 퍽이 엔진에서 실제로 읽힌다 — 설명만 있는 퍽 금지", () => {
  const src = readFileSync(join(import.meta.dirname, "island.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  for (const id of ["farm", "hanok", "cafe", "winter", "fun"]) {
    assert.ok(DECOR_SETS.some((x) => x.id === id), `${id} 세트가 없다`);
    assert.ok(src.includes(`sets.includes("${id}")`), `${id} 세트 퍽을 읽는 곳이 없다`);
  }
  for (const set of DECOR_SETS) assert.ok(DECORS.filter((d) => d.set === set.id).length >= 4, `${set.name} 세트가 너무 작다`);
});

test("한옥 세트 — 요리 효과 시간 ×1.25 · 카페 세트 — 요리 판매 ×1.1", () => {
  const dish: ProductKey = "pancake"; // 든든함(지속형) 효과
  const e = productOf(dish).effect!;
  assert.ok(e.kind !== "rush" && e.kind !== "restore", "전제: 지속형 효과여야 시간을 잴 수 있다");
  const base = (sets: string[]): IslandState => {
    const s = rich();
    return { ...s, sets, farm: { ...s.farm, pantry: { [dish]: { qty: 1, star: 3 } } } };
  };
  const plain = pantryAction(base([]), dish, "treat", T0);
  const hanok = pantryAction(base(["hanok"]), dish, "treat", T0);
  const len = (s: IslandState) => s.buffs![e.kind]!.until - T0;
  assert.equal(len(plain), Math.round(e.hours * effectStarMult(3) * HOUR));
  assert.equal(len(hanok), Math.round(e.hours * effectStarMult(3) * SET_PERK.hanokEffect * HOUR));

  const sold = pantryAction(base([]), dish, "sell", T0).coins - base([]).coins;
  const cafe = pantryAction(base(["cafe"]), dish, "sell", T0).coins - base(["cafe"]).coins;
  assert.equal(cafe, Math.round(sold * SET_PERK.cafeSell));
});

// ── 5. 문 없는 문 금지 ────────────────────────────────────────────

/** 레시피를 끝까지 따라 내려가 생산 재료가 필요한가 */
const needsGoods = (k: string): boolean =>
  isGoodsKey(k) || (isProductKey(k) && Object.keys(productOf(k).recipe).some(needsGoods));

test("★ 생산 장식이 없으면 그 재료 요리는 '못 만드는 요리'다 — 놓으면 열린다", () => {
  let s = rich();
  assert.equal(recipeFeasible(s, productOf("omurice")), false, "닭장 없이 오므라이스가 가능하다고 한다");
  assert.equal(recipeFeasible(s, productOf("pizza")), false, "젖소 없이 피자(치즈←우유)가 가능하다고 한다");
  s = place(s, "henhouse", 0, 0);
  assert.equal(recipeFeasible(s, productOf("omurice")), true);
  assert.equal(recipeFeasible(s, productOf("pizza")), false, "단계 요리의 재료(치즈)까지 따라 내려가지 않는다");
  s = place(s, "cowshed", 4, 0);
  assert.equal(recipeFeasible(s, productOf("pizza")), true);
  // 장식이 없어도 창고에 있으면 만들 수 있다(치운 뒤 남은 재료)
  const stock = { ...rich(), farm: { ...rich().farm, barn: { milk: { qty: 2, star: 3 } } } };
  assert.equal(recipeFeasible(stock, productOf("cheese")), true);
});

test("★ 주문 게시판은 못 만드는 요리를 주문하지 않는다 — 한 달치 주문 전수 확인", () => {
  const s0 = rich();
  const s = { ...s0, farm: { ...s0.farm, skillXp: skillXpFor(20), greenhouse: true } };
  let seen = 0;
  for (let d = 0; d < 30; d++) {
    const t = T0 + d * 24 * HOUR;
    const o = todayOrders(refreshOrders(s, t), t);
    for (const it of o.flatMap((x) => x.items)) {
      seen += 1;
      assert.ok(!needsGoods(it.key), `${d}일째 주문에 생산 장식 없이 못 만드는 '${it.key}' 가 나왔다`);
    }
  }
  assert.ok(seen > 30, "주문이 거의 안 나왔다(전제 실패)");
});

// ── 6. 창고의 생산 재료 ───────────────────────────────────────────

test("★ 창고의 달걀도 먹일 수 있다 — 작물과 같은 자(판매가 → 영양), 없는 키는 무반응", () => {
  const s0 = rich();
  const s = { ...s0, farm: { ...s0.farm, barn: { egg: { qty: 2, star: 3 } } } };
  const fed = feedPetWith(s, "egg", T0);
  assert.notEqual(fed, s, "달걀을 못 먹인다 — 창고의 생산 재료가 먹이기 화면에서 죽은 버튼이 된다");
  assert.equal(fed.farm.barn.egg!.qty, 1);
  assert.equal(fed.pet.careXp - s.pet.careXp, rawFeedXp(goodsOf("egg"), 3));
  const ghost = { ...s, farm: { ...s.farm, barn: { ...s.farm.barn, ghost: { qty: 1, star: 3 } } } };
  assert.equal(feedPetWith(ghost, "ghost", T0), ghost, "없는 키를 먹였다");
});

// ── 7. 잠금은 한 곳 ───────────────────────────────────────────────

test("★ 잠금 이유는 한 곳 — placeDecor 가 거부하는 장식은 decorLockReason 도 이유를 댄다", () => {
  for (const level of [1, 5, 12]) {
    const s0 = createIsland("콩", null, T0);
    const s = { ...s0, level, coins: 1_000_000, bond: { ...s0.bond, level: 1 } };
    for (const d of DECORS) {
      const refused = placeDecor(s, d.key, 0, 0, T0) === s;
      assert.equal(refused, decorLockReason(s, d) != null, `Lv.${level} ${d.name}: 엔진과 화면의 잠금 판정이 다르다`);
    }
  }
});

// ── 8. 화면 배선 ──────────────────────────────────────────────────

const strip = (p: string) =>
  readFileSync(join(import.meta.dirname, "..", p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

test("꾸미기 화면 — 세 칸(섬·상점·세트·조합) · 생산 모으기 · 섬 위 말풍선이 연결된다", () => {
  const g = strip("components/IslandGame.tsx");
  assert.match(g, /aria-label="꾸미기 메뉴"/);
  for (const c of ["<ProducePanel", "<DecorPicker", "<DecorShop", "<SetBoard", "<ComboBook"]) assert.ok(g.includes(c), `${c} 가 안 그려진다`);
  assert.match(g, /collectProduce\(/, "생산품을 모을 길이 없다");
  assert.match(g, /bubbles=\{/, "섬 위 생산 말풍선이 안 넘어간다");
  const scene = strip("components/island/IslandScene.tsx");
  assert.match(scene, /bubbles\[p\.id\]/);
});

test("상점·고르기 줄은 엔진의 가격·잠금을 부른다 — 화면에서 따로 판정 금지", () => {
  const p = strip("components/island/DecorPanels.tsx");
  assert.match(p, /decorLockReason\(/);
  assert.match(p, /decorPrice\(/);
  assert.ok(!/RARITY_PRICE\s*\[/.test(p), "등급가를 직접 본다 — 개별가 랜드마크가 싸게 표시된다");
  assert.ok(!/s\.level\s*</.test(p), "레벨 게이트를 화면에서 따로 계산한다");
});

test("★ 창고를 훑는 화면은 생산 재료를 안다 — 달걀 한 알에 먹이기 시트가 죽지 않게", () => {
  const g = strip("components/IslandGame.tsx");
  assert.ok(!/cropOf\(k as CropKey\)/.test(g), "창고 목록이 작물만 있다고 가정한다(cropOf)");
  assert.match(g, /barnItem\(k\)/);
  const w = strip("components/island/Workshop.tsx");
  assert.match(w, /isGoodsKey\(k\) \? goodsOf\(k\)\.name/, "재료 이름이 생산 재료를 모른다");
});
