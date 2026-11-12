// 장비 꾸미기 · 강화(2026-11-12) [사용자: "찌 · 낚싯줄 색 · 낚싯대 스킨을 하트로 사고, 낚싯대에 별 강화와 세트 효과를 붙입니다"]
// 잠그는 것: 사람마다 끼기 · 하트 · 별 값과 상한 · 능력치 덤의 크기(사람 흉내 봇) · 세트가 사는 걸 손해로 만들지 않기 · 낚시 저장을 지나도 남기 · 연출 연결.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createIsland, type IslandState } from "./island.ts";
import { BAITS, GREEN_HIGH, NETS, RODS, SPOTS, baitIndex, buffedStats, buyBait, buyNet, buyRod, fightLevel, fightTune, fishingOf, haulJunk, rollCatch, sellCatch, spotMinBait, startFight, stepFight, type Fight } from "./fishing.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";
import { FX_BOBBERS, FishFx, landingPoint, paintBobber, type FxCanvas } from "./fishingfx.ts";
import { LOOKS, STAR_BASE, STAR_MAX, STAR_TIER, buyLook, defaultLook, enhanceOf, enhanceRod, gearStats, lookSinkTotal, looksOf, setBonus, starBonus, starCost, starsOf, wearLook, wornLooks } from "./fishlooks.ts";

const root = process.cwd();
const DAY = "2026-11-12";
const T0 = Date.UTC(2026, 10, 12, 3);
const rich = (coins = 5_000_000): IslandState => ({ ...createIsland("콩", null, T0), coins });
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  assert.ok(r.ok, (r as { reason?: string }).reason);
  return r as Extract<T, { ok: true }>;
};
const withGear = (s: IslandState, rod: number, net: number): IslandState => ({ ...s, fishing: { ...fishingOf(s), rod, net } });
/** 화면처럼 — 지금 낚싯대 · 다음 별을 보고 누른다 */
const starUp = (s: IslandState) => enhanceRod(s, RODS[fishingOf(s).rod].key, starsOf(s, RODS[fishingOf(s).rod].key) + 1);

test("꾸미기 — 산 건 커플이 같이 갖고, 끼는 건 사람마다 · 산 사람이 바로 낀다 · 상대가 낀 건 그대로", () => {
  let s = rich(100_000);
  const star = LOOKS.find((x) => x.id === "bob_star")!;
  s = ok(buyLook(s, "a", "bob_star")).state;
  assert.equal(s.coins, 100_000 - star.price);
  assert.deepEqual(looksOf(s).owned, ["bob_star"]);
  assert.equal(wornLooks(s, "a").bobber.id, "bob_star");
  assert.equal(wornLooks(s, "b").bobber.id, "bob_red", "상대는 기본 그대로");
  // 상대도 공짜로 낀다(같이 산 것)
  s = ok(wearLook(s, "b", "bob_star")).state;
  s = ok(buyLook(s, "b", "line_mint")).state;
  assert.equal(wornLooks(s, "b").line.id, "line_mint");
  assert.equal(wornLooks(s, "a").line.id, "line_white", "b 가 산 줄을 a 에게 끼우지 않는다");
  assert.equal(wornLooks(s, "a").bobber.id, "bob_star", "b 의 끼기가 a 를 덮지 않는다");
  // 기본으로 되돌리기 — 칸을 비운다
  s = ok(wearLook(s, "a", "bob_red")).state;
  assert.equal(wornLooks(s, "a").bobber.id, "bob_red");
  assert.equal(looksOf(s).wear.a, undefined, "다 기본이면 사람 칸도 지운다");
  assert.equal(wornLooks(s, "b").bobber.id, "bob_star");
});

test("꾸미기 — 하트가 모자라면 못 산다 · 이미 있는 건 다시 안 산다 · 안 산 건 못 낀다 · 없는 id", () => {
  const gold = LOOKS.find((x) => x.id === "bob_gold")!;
  const poor = buyLook(rich(gold.price - 1), "a", "bob_gold");
  assert.equal(poor.ok, false);
  assert.match(!poor.ok ? poor.reason : "", /1개 모자라요/);
  const s = ok(buyLook(rich(gold.price), "a", "bob_gold")).state;
  assert.equal(s.coins, 0);
  assert.equal(buyLook({ ...s, coins: 1e6 }, "b", "bob_gold").ok, false, "이미 있다");
  assert.equal(buyLook(rich(), "a", "bob_red").ok, false, "기본은 처음부터 있다");
  assert.equal(wearLook(rich(), "a", "rod_gilt").ok, false, "안 산 건 못 낀다");
  assert.equal(buyLook(rich(), "a", "없는거").ok, false);
  assert.equal(wearLook(rich(), "a", "없는거").ok, false);
});

test("꾸미기 — 저장이 망가져도 화면이 안 깨진다(모르는 id · 안 산 끼기 · 종류가 다른 끼기는 버린다)", () => {
  const s = withFishPlus(rich(), { looks: { owned: ["bob_star", "bob_star", "bob_red", "없는거", 7], wear: { a: { bobber: "bob_star", line: "bob_star", rod: "rod_gilt" }, b: "망가짐", c: null } } });
  const r = looksOf(s);
  assert.deepEqual(r.owned, ["bob_star"]);
  assert.deepEqual(r.wear, { a: { bobber: "bob_star" } });
  assert.equal(wornLooks(s, "a").rod.id, "rod_plain");
  assert.deepEqual(looksOf(withFishPlus(rich(), { looks: "x" })), { owned: [], wear: {} });
  for (const k of ["bobber", "line", "rod"] as const) assert.equal(defaultLook(k).price, 0);
});

test("꾸미기 표 — 종류마다 기본 하나 + 산 것 · 값은 오르기만 · 줄 색은 밝고 붉지 않다(팽팽함 경고가 흰색 → 빨강이다)", () => {
  for (const k of ["bobber", "line", "rod"] as const) {
    const list = LOOKS.filter((x) => x.kind === k);
    assert.equal(list.filter((x) => x.price === 0).length, 1, k);
    assert.ok(list.length >= 5 && list.length <= 6, `${k} ${list.length}`);
    for (let i = 1; i < list.length; i++) assert.ok(list[i].price >= list[i - 1].price, `${k} 값 순서`);
  }
  assert.equal(new Set(LOOKS.map((x) => x.id)).size, LOOKS.length, "id 가 겹치지 않는다");
  for (const x of LOOKS.filter((l) => l.kind === "line")) {
    assert.match(x.color, /^#[0-9a-f]{6}$/i, x.id);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(x.color.slice(i, i + 2), 16));
    assert.ok(0.2126 * r + 0.7152 * g + 0.0722 * b > 180, `${x.id} 밝다`);
    assert.ok(r - Math.max(g, b) < 60, `${x.id} 붉지 않다`);
  }
  for (const x of LOOKS.filter((l) => l.kind === "rod" && l.price > 0)) assert.match(x.color, /^#[0-9a-f]{6}$/i, x.id);
});

test("강화 — 지금 낚싯대에 별 하나씩 · 값은 별마다 · 낚싯대 단계마다 오른다 · ★5 에서 멈춘다", () => {
  let s = withGear(rich(), 3, 0);
  let paid = 0;
  for (let n = 1; n <= STAR_MAX; n++) {
    const cost = starCost(3, n);
    const before = s.coins;
    s = ok(starUp(s)).state;
    assert.equal(before - s.coins, cost);
    paid += cost;
    assert.equal(starsOf(s, RODS[3].key), n);
  }
  assert.equal(starUp(s).ok, false, "별을 다 채웠다");
  assert.equal(paid, STAR_BASE.reduce((a, b) => a + b, 0) * STAR_TIER[3]);
  for (let i = 0; i < RODS.length; i++) {
    assert.ok(STAR_TIER[i] > 0, "대나무도 0 이 아니다 — 공짜 별 금지");
    for (let n = 1; n <= STAR_MAX; n++) {
      assert.ok(starCost(i, n) > 0 && starCost(i, n) % 100 === 0);
      if (n > 1) assert.ok(starCost(i, n) > starCost(i, n - 1));
      if (i > 0) assert.ok(starCost(i, n) > starCost(i - 1, n));
    }
  }
  // 대나무 ★1 은 다음 낚싯대보다 싸지만 얻는 게 적다 — 새 낚싯대가 늘 낫다
  assert.ok(starBonus(1).power < RODS[1].power);
  const short = starUp({ ...withGear(rich(), 0, 0), coins: starCost(0, 1) - 1 });
  assert.equal(short.ok, false);
});

test("강화 — 새 낚싯대를 사도 옛 낚싯대의 별은 그 낚싯대에 남는다 · 새 낚싯대는 0개부터", () => {
  let s = withGear(rich(), 1, 0);
  s = ok(starUp(s)).state;
  s = ok(starUp(s)).state;
  s = ok(buyRod(s)).state;
  assert.equal(fishingOf(s).rod, 2);
  assert.equal(starsOf(s, RODS[1].key), 2, "옛 낚싯대의 별");
  assert.equal(starsOf(s, RODS[2].key), 0);
  s = ok(starUp(s)).state;
  assert.deepEqual(enhanceOf(s), { [RODS[1].key]: 2, [RODS[2].key]: 1 });
  // 망가진 값은 버린다 · 범위 밖은 자른다
  assert.deepEqual(enhanceOf(withFishPlus(rich(), { enhance: { [RODS[0].key]: 99, [RODS[1].key]: -3, rod_x: 2, [RODS[2].key]: "3", [RODS[3].key]: 2.7 } })), { [RODS[0].key]: 5, [RODS[3].key]: 2 });
});

test("강화 — 누른 순간 본 낚싯대 · 별만 산다 · 저장 충돌로 다시 돌아도 두 번 사지 않고, 바뀐 낚싯대에 붙지 않는다", () => {
  const s = withGear(rich(), 2, 0), key = RODS[2].key;
  const once = ok(enhanceRod(s, key, 1)).state;
  const again = enhanceRod(once, key, 1);
  assert.equal(again.ok, false, "상대가 먼저 ★1 을 샀다 — 늦은 쪽의 다시 돌기는 ★2 를 사지 않는다");
  assert.equal(once.coins, s.coins - starCost(2, 1));
  assert.equal(enhanceRod(s, key, 3).ok, false, "본 적 없는 별");
  const moved = ok(buyRod(s)).state;
  assert.equal(enhanceRod(moved, key, 1).ok, false, "상대가 낚싯대를 바꿨다");
  assert.equal(starsOf(moved, RODS[3].key), 0);
});

test("저장 — 이 번들이 모르는 꾸미기 · 낚싯대 별(다음 버전이 더한 것)도 사기 · 끼기 · 강화를 지나 그대로 남는다", () => {
  let s = withGear(withFishPlus(rich(), { looks: { owned: ["bob_future"], wear: { b: { bobber: "bob_future", hat: "x" } }, extra: 1 }, enhance: { rod_future: 3 } }), 1, 0);
  s = ok(buyLook(s, "a", "bob_star")).state;
  s = ok(wearLook(s, "b", "bob_star")).state;
  s = ok(wearLook(s, "b", "bob_red")).state;
  s = ok(starUp(s)).state;
  const raw = fishPlusOf(s) as { looks: { owned: string[]; wear: Record<string, Record<string, string>>; extra: number }; enhance: Record<string, number> };
  assert.deepEqual(raw.looks.owned, ["bob_future", "bob_star"]);
  assert.deepEqual(raw.looks.wear.b, { hat: "x" }, "기본으로 돌려도 모르는 칸은 남는다");
  assert.equal(raw.looks.wear.a.bobber, "bob_star");
  assert.equal(raw.looks.extra, 1);
  assert.deepEqual(raw.enhance, { rod_future: 3, [RODS[1].key]: 1 });
  assert.deepEqual(looksOf(s).owned, ["bob_star"], "읽을 때만 거른다");
});

test("능력치 — 별은 힘(+1씩)과 ★5 줄 다루기 +1, 세트는 포획 · 도시락 % 뒤에 더해 표시한 만큼만", () => {
  assert.deepEqual(starBonus(0), { power: 0, line: 0 });
  assert.deepEqual(starBonus(3), { power: 3, line: 0 });
  assert.deepEqual(starBonus(5), { power: 5, line: 1 });
  assert.deepEqual(starBonus(9), { power: 5, line: 1 });
  let s = withGear(rich(), 4, 0);
  for (let i = 0; i < 5; i++) s = ok(starUp(s)).state;
  const f = fishingOf(s);
  const base = buffedStats(s, f, T0), g = gearStats(s, f, T0);
  assert.equal(g.power, base.power + 5);
  assert.equal(g.line, base.line + 1);
  assert.equal(g.catch, base.catch, "뜰채가 0단계라 세트 없음");
  assert.equal(g.luck, base.luck);
  const buffed = { ...s, buffs: { ...s.buffs, hunt: { amount: 50, until: T0 + 1000 } } } as IslandState;
  assert.equal(gearStats(buffed, f, T0).power, buffedStats(buffed, f, T0).power + 5, "도시락 % 는 별에 곱하지 않는다");
  // 다른 낚싯대의 별은 지금 낚싯대에 안 붙는다
  const other = withFishPlus(withGear(rich(), 2, 0), { enhance: { [RODS[4].key]: 5 } });
  assert.equal(gearStats(other, fishingOf(other), T0).power, buffedStats(other, fishingOf(other), T0).power);
});

test("세트 — 둘 다 3단계 이상 포획 +1 · 5단계 이상 +2 · 낚싯대만 올려도 포획이 내려가지 않는다(둘 중 낮은 쪽)", () => {
  assert.equal(setBonus({ rod: 1, net: 1 }).catch, 0);
  assert.equal(setBonus({ rod: 2, net: 2 }).catch, 1);
  assert.equal(setBonus({ rod: 5, net: 2 }).catch, 1);
  assert.equal(setBonus({ rod: 4, net: 4 }).catch, 2);
  assert.equal(setBonus({ rod: 5, net: 5 }).catch, 2);
  assert.deepEqual(setBonus({ rod: 3, net: 1 }).next, { from: 2, catch: 1 });
  assert.equal(setBonus({ rod: 5, net: 5 }).next, null);
  // 무엇을 사도 능력치가 줄지 않는다
  for (let rod = 0; rod < RODS.length; rod++) for (let net = 0; net < NETS.length; net++) {
    const s = withGear(rich(), rod, net), e = gearStats(s, fishingOf(s), T0);
    for (const [r2, n2] of [[rod + 1, net], [rod, net + 1]]) {
      if (r2 >= RODS.length || n2 >= NETS.length) continue;
      const s2 = withGear(rich(), r2, n2), e2 = gearStats(s2, fishingOf(s2), T0);
      for (const k of ["catch", "power", "line", "luck"] as const) assert.ok(e2[k] >= e[k], `${rod}/${net} → ${r2}/${n2} ${k}`);
    }
  }
  const s = withGear(rich(), 2, 2);
  assert.equal(gearStats(s, fishingOf(s), T0).catch, buffedStats(s, fishingOf(s), T0).catch + 1);
});

test("저장 — 꾸미기 · 별은 낚시 저장(낚싯대 · 뜰채 · 미끼 · 꽝 · 팔기)을 지나도 남는다 · s.fishing 안에 안 둔다", () => {
  let s = withGear(rich(), 1, 1);
  s = ok(buyLook(s, "a", "rod_ocean")).state;
  s = ok(starUp(s)).state;
  const fp = s.fishPlus;
  for (const r of [buyRod(s), buyNet(s), buyBait(s, BAITS[1].key, DAY), haulJunk(s, { family: "x", stage: 0, grade: "흔함", difficulty: 1, junk: "junk_can" }, DAY), sellCatch(s, { family: "guppy", stage: 0, grade: "흔함", difficulty: 0 }, DAY)]) {
    const st = ok(r).state;
    assert.deepEqual(st.fishPlus, fp);
    assert.equal(wornLooks(st, "a").rod.id, "rod_ocean");
    assert.equal(starsOf(st, RODS[1].key), 1);
  }
  assert.equal((s.fishing as Record<string, unknown> | undefined)?.looks, undefined);
  assert.deepEqual(Object.keys(fishPlusOf(s)).sort(), ["enhance", "looks"]);
  // 다른 갈래의 칸은 건드리지 않는다
  const other = withFishPlus(rich(), { bottles: [{ id: "b1" }] });
  assert.deepEqual(fishPlusOf(ok(buyLook(other, "a", "line_sky")).state).bottles, [{ id: "b1" }]);
});

test("경제 — 새 소모처의 크기 · 1년 시뮬레이션 수입(대충 하루 약 1만 · 열심 약 2만 · 365일째 약 210만)에 비춰", () => {
  const t = lookSinkTotal();
  assert.equal(t.looks, 282_000);
  assert.equal(t.topRodStars, 240_100);
  assert.equal(t.realistic, 522_100, "꾸미기 전부 + 별빛 낚싯대 ★5");
  assert.equal(t.allRodStars, 825_800);
  assert.equal(t.max, 1_107_800);
  const casual = 10_316, eager = 19_800, yearCasual = 2_107_716;
  const days = t.realistic / casual;
  assert.ok(days > 30 && days < 90, `대충 커플 ${days.toFixed(0)}일치`);
  assert.ok(t.realistic / eager > 15, "열심 커플도 보름은 넘게 모아야 한다");
  assert.ok(t.max < yearCasual, "다 사도 1년치 잔액 아래 — 끝이 보이는 목표");
  for (const x of LOOKS.filter((l) => l.price > 0)) assert.ok(x.price >= 2000 && x.price <= 60_000, x.id);
});

/** 사람 흉내 봇(fishing.test 의 play 와 같은 손 — 0.28초 늦게 보고, 차고 나가면 떼고, 빨간 칸 전에 뗀다) */
function play(d: number, power: number, line: number, seed: number): Fight {
  const tune = fightTune(d, { power, line }, "guppy");
  let f = startFight(seed, tune);
  let hold = true;
  const seen: Fight[] = [];
  let noise = seed >>> 0;
  const human = () => {
    const x = seen[Math.max(0, seen.length - 9)];
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const err = (noise / 2 ** 32 - 0.5) * 0.15;
    const ev = x.surgeLeft > 0 || x.warnLeft > 0 ? x.event : null;
    if (ev === "surge") hold = false;
    else if (ev === "jump") hold = true;
    else if (x.tension > GREEN_HIGH - 0.06 + err) hold = false;
    else if (x.tension < 0.45 + err) hold = true;
    return hold;
  };
  for (let i = 0; i < 4000 && f.status === "on"; i++) {
    seen.push(f);
    f = stepFight(f, 0.033, human(), tune);
  }
  return f;
}

test("밸런스 — ★5 는 그 낚시터 수준 장비의 끌어올림을 몇 %p 만 올린다(가장 빡빡한 용궁사 · 심해도 8%p 아래)", () => {
  // 낚시터 · 그 수준의 장비(fishingworld.test 의 주인 GEAR) · 시작 미끼보다 두 단계 위 미끼(위 등급이 섞여 가장 빡빡하다)
  const CASES: [string, number, number][] = [["brook", 0, 3], ["seomjin", 1, 8], ["harbor", 2, 12], ["palace", 4, 18], ["abyss", 5, 20]];
  const star = starBonus(STAR_MAX);
  const N = 200;
  for (const [key, rod, pts] of CASES) {
    const spot = SPOTS.find((s) => s.key === key)!;
    const p = 1 + RODS[rod].power + pts, l = 1 + RODS[rod].line + pts;
    const bait = Math.min(BAITS.length - 1, baitIndex(spotMinBait(spot).key) + 2);
    const ds = Array.from({ length: N }, (_, i) => fightLevel(rollCatch(spot, 1 + pts / 2, 0.5, i * 7919 + 3, { bait })));
    const rate = (dp: number, dl: number) => ds.filter((d, i) => play(d, p + dp, l + dl, i * 97 + 1).status === "landed").length / N;
    const base = rate(0, 0), up = rate(star.power, star.line);
    console.log(`  ${key} ${RODS[rod].key} 끌어올림 ${(base * 100).toFixed(1)}% → ★5 ${(up * 100).toFixed(1)}%`);
    assert.ok(up >= base - 0.02, `${key}: 강화가 손해가 되면 안 된다`);
    assert.ok(up - base < 0.08, `${key}: +${((up - base) * 100).toFixed(1)}%p`);
  }
});

/** 캔버스 가짜 — fishingfx.test 와 같다(그리기 인자에 NaN 이 없는지) */
function fakeCanvas() {
  const calls = { n: 0, bad: [] as string[] };
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(_t, name: string) {
      return (...args: unknown[]) => {
        calls.n += 1;
        for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) calls.bad.push(`${name}(${args.join(",")})`);
        return name.startsWith("create") ? grad : undefined;
      };
    },
    set() {
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  const canvas: FxCanvas = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, ctx, calls };
}

test("연출 — 상점의 찌 id 를 연출이 다 안다 · 찌마다 한 판을 돌려도 잘못된 값이 없다 · 모르는 값은 기본으로", () => {
  assert.deepEqual([...FX_BOBBERS].sort(), LOOKS.filter((x) => x.kind === "bobber").map((x) => x.id).sort());
  for (const b of FX_BOBBERS) {
    const { canvas, calls } = fakeCanvas();
    const fx = new FishFx(canvas);
    fx.resize(360, 450, 2);
    fx.setLook({ bobber: b, line: LOOKS.find((x) => x.kind === "line" && x.price > 0)!.color, rodTint: "#38bdf8" });
    fx.set({ spot: "brook", rod: "rod_carbon", phase: "ready" });
    for (let t = 0; t < 300; t += 16) fx.frame(16);
    fx.set({ phase: "wait" });
    fx.cast(landingPoint(0.8, 0.4), 2000, 0.8, 7, 1);
    for (let t = 0; t < 900; t += 16) fx.frame(16);
    fx.set({ phase: "fight", tension: 0.95, dist: 0.6, holding: true });
    for (let t = 0; t < 300; t += 16) fx.frame(16);
    assert.ok(calls.n > 100, b);
    assert.deepEqual(calls.bad, [], b);
  }
  const { canvas } = fakeCanvas();
  const fx = new FishFx(canvas);
  fx.setLook({ bobber: "없는거", line: "red", rodTint: "rgba(0,0,0,1)" });
  assert.deepEqual(fx.lookNow(), { bobber: "bob_red", line: "#ffffff", rodTint: "" });
  fx.setLook({ line: "#a7f3d0" });
  assert.equal(fx.lookNow().bobber, "bob_red", "넘긴 칸만 바꾼다");
  // 상점 미리보기도 같은 함수 — 찌마다 그려진다
  for (const b of FX_BOBBERS) {
    const { ctx, calls } = fakeCanvas();
    paintBobber(ctx, b, 24, 34, 1.75, (_k, make) => make());
    assert.ok(calls.n > 10 && calls.bad.length === 0, b);
  }
});

test("연결 — 화면의 능력치는 gearStats · 연출은 이 사람의 꾸미기 · fishing.ts 는 이 파일을 부르지 않는다(순환 import 금지)", () => {
  const strip = (f: string) => readFileSync(join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const game = strip("src/components/FishingGame.tsx");
  assert.match(game, /const eff = gearStats\(st, fs, clock\(\)\);/);
  assert.doesNotMatch(game, /buffedStats\(/, "능력치 계산이 두 갈래가 되지 않게");
  assert.match(game, /const look = wornLooks\(row\.state, who\);\s*fx\.setLook\(\{ bobber: look\.bobber\.id, line: look\.line\.color, rodTint: look\.rod\.color \}\);/);
  assert.doesNotMatch(strip("src/lib/fishing.ts"), /fishlooks/);
  assert.match(strip("src/components/FishGearPlus.tsx"), /<FishLooks \{\.\.\.p\} \/>/);
  const fx = strip("src/lib/fishingfx.ts");
  assert.doesNotMatch(fx, /shadowBlur|\.filter\s*=/, "색 입히기도 ctx.filter 없이");
  assert.match(fx, /`float:\$\{id\}`/, "찌 그라디언트 열쇠가 찌마다");
});
