// 잡아먹기(2026-11-11) — 상성 · 배고픔 · 하루 한 번 · 쪼갠 정산 = 한 번 정산 · 왕관은 안 먹힘
import { test } from "node:test";
import assert from "node:assert/strict";
import { aquaDangers, tickAqua, type AquaFish, type AquaState } from "./aquarium.ts";
import { DAY_MS, HUNGRY_BELOW, PREDATORS, canEat, mealHash, nextMealTime } from "./predation.ts";
import { FAMILIES } from "./aquarium.ts";

const fish = (id: number, family: string, stage: 0 | 1 | 2, cm: number, extra: Partial<AquaFish> = {}): AquaFish => ({ id, family, stage, growH: 0, goodH: 0, totalH: 0, adultCm: cm, ...extra });
const tank = (f: AquaFish[], hunger: number, at: number): AquaState => ({ tank: 6, hunger, water: 100, at, nextId: 50, fish: f, placed: [], bag: {}, dex: [] });
const T0 = Date.UTC(2026, 10, 1);

test("사냥꾼 목록은 실제 계열이다 · 걸러 먹는 종은 아니다", () => {
  const keys = new Set(FAMILIES.map((f) => f.key));
  for (const k of PREDATORS) assert.ok(keys.has(k), k);
  for (const k of ["whale_shark", "megamouth", "manta", "guppy"]) assert.ok(!PREDATORS.has(k), k);
});

test("상성 — 사냥꾼보다 한참 작은 다른 계열만 · 치어 사냥꾼은 못 먹는다 · 왕관은 안 먹힌다", () => {
  const shark = { id: 1, family: "great_white", stage: 2 as const, cm: 400 };
  assert.ok(canEat(shark, { id: 2, family: "guppy", stage: 2, cm: 5 }));
  assert.ok(!canEat(shark, { id: 3, family: "whale_shark", stage: 2, cm: 1200 }), "큰 건 못 먹는다");
  assert.ok(!canEat(shark, { id: 4, family: "great_white", stage: 0, cm: 40 }), "같은 계열은 안 먹는다");
  assert.ok(!canEat({ ...shark, stage: 0 }, { id: 2, family: "guppy", stage: 2, cm: 5 }), "치어는 사냥 못 한다");
  assert.ok(!canEat(shark, { id: 2, family: "guppy", stage: 2, cm: 5, crown: "돌쇠" }), "왕관은 안 먹힌다");
  assert.ok(!canEat({ id: 9, family: "koi", stage: 2, cm: 80 }, { id: 2, family: "guppy", stage: 2, cm: 5 }), "잉어는 사냥꾼이 아니다");
});

test("배가 고프면 며칠 안에 먹힌다 · 배부르면 안 먹힌다 · 소식에 남는다", () => {
  const f = [fish(1, "arowana", 2, 90), fish(2, "guppy", 2, 5)];
  // 배고픔을 0 에 두고 10일 — 하루 다섯 기회 · 확률 0.6 이라 열흘 안에 거의 늘 일어난다(정해진 해시라 매번 같다)
  const hungry = tickAqua(tank(f, 0, T0), T0 + 10 * DAY_MS).a;
  assert.equal(hungry.fish.length, 1, "구피가 먹혔다");
  const n = hungry.news?.find((x) => x.ate);
  assert.ok(n && n.family === "arowana" && n.ate?.family === "guppy");
  assert.ok(aquaDangers({ fish: f }).length === 1, "미리 알린다");
  // 먹이를 계속 준 수조 — 네 시간마다 다시 채워 HUNGRY_BELOW 위로 두면 안 먹힌다
  let a = tank(f, 100, T0);
  for (let h = 4; h <= 240; h += 4) { a = tickAqua(a, T0 + h * 3_600_000).a; a = { ...a, hunger: Math.max(a.hunger, HUNGRY_BELOW + 30) }; }
  assert.equal(a.fish.length, 2, "배부르면 안 먹는다");
});

test("쪼개 정산 = 한 번 정산 · 하루 다섯 번까지", () => {
  const f = [fish(1, "great_white", 2, 400), fish(2, "guppy", 2, 5), fish(3, "tetra", 2, 4), fish(4, "clown", 2, 9)];
  const once = tickAqua(tank(f, 0, T0), T0 + 6 * DAY_MS).a;
  let split = tank(f, 0, T0);
  for (let h = 1; h <= 6 * 24; h += 5) split = tickAqua(split, T0 + h * 3_600_000).a;
  split = tickAqua(split, T0 + 6 * DAY_MS).a;
  assert.deepEqual(once.fish.map((x) => x.id), split.fish.map((x) => x.id));
  const eaten = (once.news ?? []).filter((x) => x.ate).length;
  assert.ok(eaten >= 1 && eaten <= 6, `엿새에 ${eaten}번`);
  // 하루 기회 다섯 번(4.8시간마다 하나) · 확률 0.6 — 400일에 기대 1200번, 하루 최대 5번 · 사냥이 없는 날은 드물다(0.4⁵ ≈ 1%)
  let total = 0, most = 0, none = 0;
  for (let d = 0; d < 400; d++) {
    let n = 0;
    const t = d * DAY_MS;
    for (let m = nextMealTime(t, (d + 1) * DAY_MS); m; m = nextMealTime(m.t, (d + 1) * DAY_MS)) n++;
    total += n; most = Math.max(most, n); if (!n) none++;
  }
  assert.ok(total > 1080 && total < 1320, `400일에 ${total}번`);
  assert.ok(most <= 5, `하루 최대 ${most}번`);
  assert.ok(none < 15, `사냥 없는 날 ${none}일`);
  assert.ok(mealHash(5, 3) === mealHash(5, 3));
});
