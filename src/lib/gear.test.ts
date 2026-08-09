// 히어로 장비 lock. [사용자 요청 2026-08-05 "하트 재화로 할 것들 … 히어로 무기나 치장 아이템"]
//
// 잠그는 것 세 가지
//  1) **코인 싱크로 실제로 의미가 있는가** — 후반에 쓸 곳이 없으면 코인이 죽는다
//  2) **아이템끼리 죽지 않는가** — 슬롯마다 퍽 축이 달라야 최고템 하나만 사고 끝나지 않는다
//  3) **못 사는 이유가 보이는가** — 이 저장소는 '살 수 없는데 이유를 안 알려준' 골드비료 사고를 겪었다
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GEARS,
  GEAR_SLOTS,
  TUNING,
  buyGear,
  createIsland,
  equipGear,
  gearLockReason,
  gearPerks,
  heroOf,
  petNow,
  type IslandState,
} from "./island.ts";
import { gearSprite } from "./pixelgear.ts";
import { petSprites } from "./pixelart.ts";
import { pixelAt } from "./pixel.ts";

const T0 = Date.UTC(2026, 6, 15, 3, 0, 0);
const fresh = (): IslandState => createIsland("콩", null, T0);
/** 레벨/스킬/코인을 넉넉히 채운 상태 — 게이트가 아니라 **다른 것**을 보고 싶을 때. */
function maxed(): IslandState {
  const s = fresh();
  s.coins = 999_999;
  s.pet.careXp = 100_000;
  s.farm.skillXp = 100_000;
  return s;
}

test("슬롯마다 5등급씩 있고 key 가 중복되지 않는다", () => {
  const keys = new Set(GEARS.map((g) => g.key));
  assert.equal(keys.size, GEARS.length, "key 중복");
  /* 2026-08-07 확장: 슬롯당 3 → 5단계.
     ⚠ **슬롯끼리 개수가 같아야 한다.** 한쪽만 단계가 많으면 그 슬롯만 목표가 남고
     나머지는 일찍 끝나 '더 살 게 없다'가 된다. 개수 자체보다 이 균형이 중요하다. */
  const counts = GEAR_SLOTS.map((sl) => GEARS.filter((g) => g.slot === sl).length);
  assert.ok(
    counts.every((n) => n >= 5),
    `슬롯별 개수 ${counts.join(",")} — 5단계는 있어야 목표가 안 끊긴다`,
  );
  assert.equal(new Set(counts).size, 1, `슬롯마다 개수가 다르다: ${counts.join(",")}`);
});

test("★ 슬롯마다 퍽 축이 다르다 — 같은 축이면 최고템 하나 말고 다 죽는다", () => {
  const axisOf = (g: (typeof GEARS)[number]) =>
    [g.careXpPct && "careXp", g.quality && "quality", g.happyKeepPct && "happyKeep"].filter(Boolean);
  for (const g of GEARS) {
    assert.equal(axisOf(g).length, 1, `${g.name} 은 퍽 축이 정확히 1개여야 한다 (${axisOf(g)})`);
  }
  const axes = new Set(GEAR_SLOTS.map((sl) => axisOf(GEARS.find((g) => g.slot === sl)!)[0]));
  assert.equal(axes.size, GEAR_SLOTS.length, `슬롯끼리 축이 겹친다: ${[...axes]}`);
});

test("★ 등급이 오르면 값도 효과도 오른다", () => {
  for (const slot of GEAR_SLOTS) {
    const line = GEARS.filter((g) => g.slot === slot);
    const val = (g: (typeof GEARS)[number]) => (g.careXpPct ?? 0) + (g.quality ?? 0) + (g.happyKeepPct ?? 0);
    for (let i = 1; i < line.length; i++) {
      assert.ok(line[i].price > line[i - 1].price, `${slot}: ${line[i].name} 가격이 안 올랐다`);
      assert.ok(val(line[i]) > val(line[i - 1]), `${slot}: ${line[i].name} 효과가 안 올랐다`);
      assert.ok(line[i].minLevel >= line[i - 1].minLevel, `${slot}: 레벨 게이트가 역전됐다`);
    }
  }
});

test("★ 후반 코인 싱크로 의미가 있다 — 시작 코인으로는 어림도 없어야 한다", () => {
  const total = GEARS.reduce((a, g) => a + g.price, 0);
  assert.ok(total >= 10_000, `장비 총합 ${total}💗 — 후반 싱크로는 너무 싸다`);
  assert.ok(total > TUNING.startCoins * 50, "시작 코인으로 다 살 수 있으면 목표가 안 된다");
});

test("★ 레벨이 모자라면 코인이 넘쳐도 못 산다 + 이유가 보인다", () => {
  const s = fresh();
  s.coins = 999_999;
  const top = GEARS.find((g) => g.minLevel >= 25)!;
  const why = gearLockReason(s, top.key, T0);
  assert.ok(why && why.includes("Lv."), `잠긴 이유가 보여야 한다: ${why}`);
  assert.equal(buyGear(s, top.key, T0), s, "no-op 이어야 한다");
});

test("★ 코인이 모자라면 부족분을 알려준다", () => {
  const s = maxed();
  const g = GEARS[0];
  s.coins = g.price - 10;
  const why = gearLockReason(s, g.key, T0);
  assert.ok(why && why.includes("10"), `부족분을 알려야 한다: ${why}`);
});

test("★ 사면 바로 장착되고 코인이 빠진다", () => {
  const s = maxed();
  const g = GEARS[0];
  const before = s.coins;
  const after = buyGear(s, g.key, T0);
  assert.notEqual(after, s, "구매가 적용돼야 한다");
  assert.equal(after.coins, before - g.price);
  assert.ok(heroOf(after).owned.includes(g.key));
  assert.equal(heroOf(after).equip[g.slot], g.key, "사놓고 안 끼는 단계를 만들지 않는다");
});

test("같은 걸 두 번 사지 않는다", () => {
  const s = buyGear(maxed(), GEARS[0].key, T0);
  assert.equal(buyGear(s, GEARS[0].key, T0), s, "이미 가진 건 no-op");
});

test("★ 장착/해제가 토글이고, 안 가진 건 못 낀다", () => {
  const g = GEARS[0];
  const s = buyGear(maxed(), g.key, T0);
  const off = equipGear(s, g.key, g.slot);
  assert.equal(heroOf(off).equip[g.slot] ?? null, null, "같은 걸 다시 누르면 벗는다");
  const on = equipGear(off, g.key, g.slot);
  assert.equal(heroOf(on).equip[g.slot], g.key);
  // 안 가진 것
  const other = GEARS.find((x) => x.slot === g.slot && x.key !== g.key)!;
  assert.equal(equipGear(on, other.key, g.slot), on, "안 가진 장비는 못 낀다");
  // 슬롯이 다른 것
  const wrong = GEARS.find((x) => x.slot !== g.slot)!;
  assert.equal(equipGear(on, wrong.key, g.slot), on, "슬롯이 다르면 못 낀다");
});

test("★ 퍽이 합산되고, 아무것도 안 끼면 전부 0", () => {
  assert.deepEqual(gearPerks(fresh()), { careXpPct: 0, quality: 0, happyKeepPct: 0 });
  let s = maxed();
  for (const slot of GEAR_SLOTS) {
    const best = GEARS.filter((g) => g.slot === slot).at(-1)!;
    s = buyGear(s, best.key, T0);
  }
  const p = gearPerks(s);
  assert.ok(p.careXpPct > 0 && p.quality > 0 && p.happyKeepPct > 0, `세 축이 다 켜져야 한다 ${JSON.stringify(p)}`);
  assert.ok(p.happyKeepPct < 100, "행복 감쇠 완화가 100% 를 넘으면 감쇠가 뒤집힌다");
});

test("★ 구버전 저장 상태(hero 없음)에서도 안 터진다 — 무마이그레이션 호환", () => {
  const s = fresh();
  delete (s as { hero?: unknown }).hero;
  assert.deepEqual(heroOf(s), { owned: [], equip: {} });
  assert.deepEqual(gearPerks(s), { careXpPct: 0, quality: 0, happyKeepPct: 0 });
  assert.ok(petNow(s, T0).level >= 1, "파생 계산이 정상 동작");
});

test("★ 망토는 펫보다 넓다 — 안 그러면 뒤에 완전히 가려져 안 보인다", () => {
  // 첫 판은 폭 22~26 이라 펫(잉크 최대 46) 뒤로 **통째로 사라졌다**. 스탯만 오르고 그림은
  // 그대로였으니 '치장 아이템'이 아니었다. 텍스트로 겹쳐보고서야 알았다.
  let widest = 0;
  // ⚠ 0번 프레임만 보면 안 된다 — 걷기가 6프레임이 되면서 다리 벌림·꼬리 흔들림에 따라
  //   프레임마다 잉크 폭이 다르다. 망토는 **가장 넓은 프레임**보다 넓어야 한다.
  for (const form of ["egg", "fox", "cat", "royal_cat", "lunar_wolf"]) {
    for (const sp of petSprites(form)) {
      let x0 = sp.w;
      let x1 = -1;
      for (let y = 0; y < sp.h; y++)
        for (let x = 0; x < sp.w; x++) {
          if (!pixelAt(sp, x, y)) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      widest = Math.max(widest, x1 - x0 + 1);
    }
  }
  for (const g of GEARS.filter((x) => x.slot === "cape")) {
    const sp = gearSprite(g.key)!;
    assert.ok(sp.w > widest + 6, `${g.name} 폭 ${sp.w} ≤ 펫 최대 폭 ${widest}+6 — 뒤에 가려진다`);
  }
});

test("★ 모든 장비에 픽셀 스프라이트가 있다 — 치장은 보여야 치장이다", () => {
  for (const g of GEARS) {
    const sp = gearSprite(g.key);
    assert.ok(sp, `${g.name}(${g.key}) 스프라이트가 없다`);
    assert.ok(sp!.rows.length === sp!.h, `${g.key}: h 와 행 수가 다르다`);
    for (const r of sp!.rows) assert.equal(r.length, sp!.w, `${g.key}: 행 길이가 w 와 다르다 — 그림이 밀린다`);
    assert.ok(sp!.rows.some((r) => /[^.]/.test(r)), `${g.key}: 빈 스프라이트`);
  }
});
